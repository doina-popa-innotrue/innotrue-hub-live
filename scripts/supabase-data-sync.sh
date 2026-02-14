#!/usr/bin/env bash
# ============================================================================
# supabase-data-sync.sh — Export config data from one env, import to another
# ============================================================================
#
# Usage:
#   npm run sync:data                            # Export prod config, show SQL
#   npm run sync:data -- --from prod --to preprod  # Export prod → import to preprod
#   npm run sync:data -- --from sandbox --to preprod  # Sandbox → preprod
#   npm run sync:data -- --from prod --export-only    # Just export JSON, no import
#   npm run sync:data -- --from prod --to preprod --tables plans features
#   npm run sync:data -- --dry-run --from prod --to preprod  # Show what would sync
#
# What it does:
#   1. Links to source Supabase project
#   2. Exports config tables as JSON via psql/supabase
#   3. Generates idempotent INSERT SQL (ON CONFLICT DO UPDATE)
#   4. Optionally applies to target environment
#
# SAFE tables (config/content only — no user data):
#   system_settings, plans, features, plan_features, programs,
#   program_modules, tracks, track_features, session_types,
#   session_type_roles, credit_services, credit_topup_packages,
#   org_credit_packages, org_platform_tiers, notification_categories,
#   notification_types, assessment_categories, assessment_families,
#   assessment_domains, assessment_questions, wheel_categories,
#   module_types, platform_terms, email_templates, resource_categories,
#   plan_prices
#
# NEVER synced (user/runtime data):
#   auth.users, profiles, user_roles, client_enrollments,
#   module_progress, credit_balances, sessions, notifications,
#   oauth_tokens, audit_log, assessment_snapshots
#
# Prerequisites:
#   - Supabase CLI installed + logged in
#   - psql available (bundled with Supabase CLI or installed separately)
# ============================================================================

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# ---- Configuration ----
PROD_REF="qfdztdgublwlmewobxmx"
PREPROD_REF="jtzcrirqflfnagceendt"
SANDBOX_REF="cezlnvdjildzxpyxyabb"

EXPORT_DIR="$REPO_ROOT/.supabase-data-sync"

# Tables safe to sync (config/content only)
SAFE_TABLES=(
  "system_settings"
  "plans"
  "features"
  "plan_features"
  "plan_prices"
  "programs"
  "program_modules"
  "tracks"
  "track_features"
  "session_types"
  "session_type_roles"
  "credit_services"
  "credit_topup_packages"
  "org_credit_packages"
  "org_platform_tiers"
  "notification_categories"
  "notification_types"
  "assessment_categories"
  "assessment_families"
  "assessment_domains"
  "assessment_questions"
  "wheel_categories"
  "module_types"
  "platform_terms"
  "email_templates"
  "resource_categories"
)

# Tables that should NEVER be synced
BLOCKED_TABLES=(
  "profiles" "user_roles" "client_enrollments" "module_progress"
  "user_credit_balances" "org_credit_balances" "client_coaches"
  "sessions" "notifications" "user_notification_preferences"
  "oauth_tokens" "audit_log" "assessment_snapshots" "assessment_ratings"
)

# ---- Parse arguments ----
FROM_ENV="prod"
TO_ENV=""
DRY_RUN=false
EXPORT_ONLY=false
SELECTED_TABLES=()

while [[ $# -gt 0 ]]; do
  case $1 in
    --from)
      shift
      FROM_ENV="$1"
      shift
      ;;
    --to)
      shift
      TO_ENV="$1"
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --export-only)
      EXPORT_ONLY=true
      shift
      ;;
    --tables)
      shift
      while [[ $# -gt 0 && ! "$1" =~ ^-- ]]; do
        SELECTED_TABLES+=("$1")
        shift
      done
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 --from <env> [--to <env>] [--dry-run] [--export-only] [--tables t1 t2 ...]"
      exit 1
      ;;
  esac
done

# Resolve project refs
resolve_ref() {
  case "$1" in
    prod|production)         echo "$PROD_REF" ;;
    preprod|pre-production|staging) echo "$PREPROD_REF" ;;
    sandbox|lovable)         echo "$SANDBOX_REF" ;;
    *) echo ""; return 1 ;;
  esac
}

FROM_REF=$(resolve_ref "$FROM_ENV")
if [ -z "$FROM_REF" ]; then
  echo "Error: Unknown source environment: $FROM_ENV"
  exit 1
fi

TO_REF=""
if [ -n "$TO_ENV" ]; then
  TO_REF=$(resolve_ref "$TO_ENV")
  if [ -z "$TO_REF" ]; then
    echo "Error: Unknown target environment: $TO_ENV"
    exit 1
  fi
  if [ "$FROM_REF" = "$TO_REF" ]; then
    echo "Error: Source and target are the same environment."
    exit 1
  fi
fi

# Determine which tables to sync
if [ ${#SELECTED_TABLES[@]} -gt 0 ]; then
  # Validate selected tables
  SYNC_TABLES=()
  for T in "${SELECTED_TABLES[@]}"; do
    IS_BLOCKED=false
    for B in "${BLOCKED_TABLES[@]}"; do
      if [ "$T" = "$B" ]; then
        IS_BLOCKED=true
        break
      fi
    done
    if [ "$IS_BLOCKED" = true ]; then
      echo "⚠  Refusing to sync blocked table: $T (contains user data)"
      continue
    fi
    SYNC_TABLES+=("$T")
  done
else
  SYNC_TABLES=("${SAFE_TABLES[@]}")
fi

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║          Supabase Data Sync                         ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  Source  : $FROM_ENV ($FROM_REF)"
if [ -n "$TO_ENV" ]; then
  echo "  Target  : $TO_ENV ($TO_REF)"
else
  echo "  Target  : (export only)"
fi
echo "  Tables  : ${#SYNC_TABLES[@]}"
if [ "$DRY_RUN" = true ]; then
  echo "  Mode    : DRY RUN"
fi
echo ""

# ---- Dry run: just list ----
if [ "$DRY_RUN" = true ]; then
  echo "  Would sync these tables:"
  for T in "${SYNC_TABLES[@]}"; do
    echo "    - $T"
  done
  echo ""
  echo "  Run without --dry-run to proceed."
  exit 0
fi

# ---- Check prerequisites ----
if ! command -v supabase &> /dev/null; then
  echo "Error: Supabase CLI not found."
  echo "Install with: brew install supabase/tap/supabase"
  exit 1
fi

# ---- Save and link to source project ----
ORIGINAL_REF=""
if [[ -f "$REPO_ROOT/supabase/.temp/project-ref" ]]; then
  ORIGINAL_REF=$(cat "$REPO_ROOT/supabase/.temp/project-ref")
fi

echo "  Linking to source ($FROM_ENV)..."
supabase link --project-ref "$FROM_REF" 2>&1 | sed 's/^/    /'
echo ""

# ---- Export data ----
mkdir -p "$EXPORT_DIR"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "━━━ Exporting from $FROM_ENV ━━━"
echo ""

EXPORTED_COUNT=0
EMPTY_COUNT=0
FAIL_COUNT=0

for TABLE in "${SYNC_TABLES[@]}"; do
  EXPORT_FILE="$EXPORT_DIR/${TABLE}_${TIMESTAMP}.json"
  printf "  Exporting %-40s" "$TABLE..."

  # Use supabase db execute to run SQL and get JSON
  QUERY="SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json) FROM (SELECT * FROM public.${TABLE} ORDER BY 1) t;"

  if OUTPUT=$(echo "$QUERY" | supabase db execute --linked 2>&1); then
    # Extract JSON from output (skip headers)
    JSON=$(echo "$OUTPUT" | grep -E '^\[' | head -1)
    if [ -z "$JSON" ]; then
      # Try alternate extraction — output may have different format
      JSON=$(echo "$OUTPUT" | tail -n +3 | head -1 | tr -d ' ')
    fi

    if [ -z "$JSON" ] || [ "$JSON" = "[]" ]; then
      echo "(empty)"
      EMPTY_COUNT=$((EMPTY_COUNT + 1))
    else
      echo "$JSON" > "$EXPORT_FILE"
      ROW_COUNT=$(echo "$JSON" | python3 -c "import sys,json; print(len(json.load(sys.stdin)))" 2>/dev/null || echo "?")
      echo "$ROW_COUNT rows"
      EXPORTED_COUNT=$((EXPORTED_COUNT + 1))
    fi
  else
    echo "FAILED"
    echo "$OUTPUT" | head -2 | sed 's/^/      /'
    FAIL_COUNT=$((FAIL_COUNT + 1))
  fi
done

echo ""
echo "  Exported: $EXPORTED_COUNT | Empty: $EMPTY_COUNT | Failed: $FAIL_COUNT"
echo "  Files in: $EXPORT_DIR/"
echo ""

if [ "$EXPORT_ONLY" = true ] || [ -z "$TO_ENV" ]; then
  echo "  Export complete. Files saved to $EXPORT_DIR/"
  echo ""
  echo "  To import manually:"
  echo "    1. Review the JSON files"
  echo "    2. Run: npm run sync:data -- --from $FROM_ENV --to <target_env>"
  echo ""

  # Restore original link
  if [[ -n "$ORIGINAL_REF" ]]; then
    supabase link --project-ref "$ORIGINAL_REF" 2>&1 > /dev/null || true
  fi
  exit 0
fi

# ---- Generate and apply import SQL ----
echo "━━━ Importing to $TO_ENV ━━━"
echo ""

echo "  Linking to target ($TO_ENV)..."
supabase link --project-ref "$TO_REF" 2>&1 | sed 's/^/    /'
echo ""

IMPORT_COUNT=0
IMPORT_FAIL=0

for TABLE in "${SYNC_TABLES[@]}"; do
  EXPORT_FILE="$EXPORT_DIR/${TABLE}_${TIMESTAMP}.json"

  if [[ ! -f "$EXPORT_FILE" ]]; then
    continue
  fi

  printf "  Importing %-40s" "$TABLE..."

  # Generate upsert SQL from JSON using Python
  UPSERT_SQL=$(python3 -c "
import json, sys

with open('$EXPORT_FILE') as f:
    rows = json.load(f)

if not rows:
    sys.exit(0)

table = '$TABLE'
columns = list(rows[0].keys())
col_list = ', '.join(columns)

statements = []
for row in rows:
    values = []
    for col in columns:
        val = row.get(col)
        if val is None:
            values.append('NULL')
        elif isinstance(val, bool):
            values.append('true' if val else 'false')
        elif isinstance(val, (int, float)):
            values.append(str(val))
        elif isinstance(val, (dict, list)):
            escaped = json.dumps(val).replace(\"'\", \"''\")
            values.append(f\"'{escaped}'::jsonb\")
        else:
            escaped = str(val).replace(\"'\", \"''\")
            values.append(f\"'{escaped}'\")
    val_list = ', '.join(values)

    # Use first column as conflict target (usually id, key, or slug)
    conflict_col = columns[0]
    update_cols = [c for c in columns if c != conflict_col and c not in ('id', 'created_at')]
    if update_cols:
        update_set = ', '.join(f'{c} = EXCLUDED.{c}' for c in update_cols)
        stmt = f'INSERT INTO public.{table} ({col_list}) VALUES ({val_list}) ON CONFLICT ({conflict_col}) DO UPDATE SET {update_set};'
    else:
        stmt = f'INSERT INTO public.{table} ({col_list}) VALUES ({val_list}) ON CONFLICT ({conflict_col}) DO NOTHING;'
    statements.append(stmt)

print('\\n'.join(statements))
" 2>&1)

  if [ -z "$UPSERT_SQL" ]; then
    echo "(empty, skipped)"
    continue
  fi

  # Apply SQL to target
  if OUTPUT=$(echo "$UPSERT_SQL" | supabase db execute --linked 2>&1); then
    ROW_COUNT=$(echo "$UPSERT_SQL" | grep -c "INSERT INTO" || echo "0")
    echo "$ROW_COUNT rows"
    IMPORT_COUNT=$((IMPORT_COUNT + 1))
  else
    echo "FAILED"
    echo "$OUTPUT" | head -3 | sed 's/^/      /'
    IMPORT_FAIL=$((IMPORT_FAIL + 1))
  fi
done

echo ""

# ---- Cleanup export files ----
rm -rf "$EXPORT_DIR"

# ---- Restore original project link ----
if [[ -n "$ORIGINAL_REF" ]]; then
  echo "  Restoring link to $ORIGINAL_REF..."
  supabase link --project-ref "$ORIGINAL_REF" 2>&1 | sed 's/^/    /' || true
fi

# ---- Summary ----
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║                    Summary                          ║"
echo "╠══════════════════════════════════════════════════════╣"
printf "║  Source        : %-35s ║\n" "$FROM_ENV"
printf "║  Target        : %-35s ║\n" "$TO_ENV"
printf "║  Tables synced : %-3d                                ║\n" "$IMPORT_COUNT"
printf "║  Tables failed : %-3d                                ║\n" "$IMPORT_FAIL"
echo "╚══════════════════════════════════════════════════════╝"

if [ "$IMPORT_FAIL" -gt 0 ]; then
  echo ""
  echo "  ⚠  Some tables failed. Check errors above."
  echo "     Tables with FK dependencies may need specific ordering."
  echo "     Try syncing individual tables: --tables plans features"
fi
echo ""
