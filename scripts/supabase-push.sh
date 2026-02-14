#!/usr/bin/env bash
# ============================================================================
# supabase-push.sh — Push pending migrations to a Supabase environment
# ============================================================================
#
# Usage:
#   npm run push:migrations                      # Push to prod
#   npm run push:migrations -- preprod           # Push to preprod
#   npm run push:migrations -- sandbox           # Push to sandbox
#   npm run push:migrations -- all               # Push to all 3 envs (preprod → prod → sandbox)
#   npm run push:migrations -- --dry-run         # Show pending migrations without applying
#   npm run push:migrations -- preprod --dry-run # Dry-run for preprod
#
# What it does:
#   1. Links to the target Supabase project
#   2. Shows pending migrations
#   3. Pushes (applies) them
#   4. Restores original project link
#
# Prerequisites:
#   - Supabase CLI installed
#   - Logged in to Supabase CLI (supabase login)
#   - Database password available (will prompt)
# ============================================================================

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# ---- Configuration ----
PROD_REF="qfdztdgublwlmewobxmx"
PREPROD_REF="jtzcrirqflfnagceendt"
SANDBOX_REF="cezlnvdjildzxpyxyabb"

# ---- Parse arguments ----
TARGET_ENV="prod"
DRY_RUN=false
PUSH_ALL=false

while [[ $# -gt 0 ]]; do
  case $1 in
    prod|production)
      TARGET_ENV="prod"
      shift
      ;;
    preprod|pre-production|staging)
      TARGET_ENV="preprod"
      shift
      ;;
    sandbox|lovable)
      TARGET_ENV="sandbox"
      shift
      ;;
    all)
      PUSH_ALL=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [prod|preprod|sandbox|all] [--dry-run]"
      exit 1
      ;;
  esac
done

# ---- Check prerequisites ----
if ! command -v supabase &> /dev/null; then
  echo "Error: Supabase CLI not found."
  echo "Install with: brew install supabase/tap/supabase"
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║          Migration Push                             ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Save original project link
ORIGINAL_REF=""
if [[ -f "$REPO_ROOT/supabase/.temp/project-ref" ]]; then
  ORIGINAL_REF=$(cat "$REPO_ROOT/supabase/.temp/project-ref")
fi

push_to_env() {
  local ENV_NAME="$1"
  local PROJECT_REF="$2"

  echo "━━━ $ENV_NAME ($PROJECT_REF) ━━━"
  echo ""

  echo "  Linking to $ENV_NAME..."
  supabase link --project-ref "$PROJECT_REF" 2>&1 | sed 's/^/    /'
  echo ""

  if [ "$DRY_RUN" = true ]; then
    echo "  Pending migrations (dry run):"
    # db push --dry-run shows what would be applied
    if OUTPUT=$(supabase db push --dry-run 2>&1); then
      if echo "$OUTPUT" | grep -q "No pending migrations"; then
        echo "    ✓ No pending migrations."
      else
        echo "$OUTPUT" | sed 's/^/    /'
      fi
    else
      echo "$OUTPUT" | sed 's/^/    /'
    fi
  else
    echo "  Pushing migrations..."
    if OUTPUT=$(supabase db push 2>&1); then
      if echo "$OUTPUT" | grep -q "No pending migrations"; then
        echo "    ✓ No pending migrations."
      else
        echo "$OUTPUT" | sed 's/^/    /'
        echo "    ✓ Migrations applied."
      fi
    else
      echo "$OUTPUT" | sed 's/^/    /'
      echo "    ✗ Push failed for $ENV_NAME."
      return 1
    fi
  fi
  echo ""
}

if [ "$PUSH_ALL" = true ]; then
  echo "  Pushing to all environments (preprod → prod → sandbox)"
  echo ""

  push_to_env "preprod" "$PREPROD_REF"
  PREPROD_OK=$?

  if [ "$PREPROD_OK" -ne 0 ] && [ "$DRY_RUN" = false ]; then
    echo "  ⚠  Preprod failed. Stopping (not pushing to prod or sandbox)."
    echo "     Fix the issue and retry."
  else
    push_to_env "prod" "$PROD_REF"
    push_to_env "sandbox" "$SANDBOX_REF"
  fi
else
  # Resolve project ref
  case "$TARGET_ENV" in
    prod)    PROJECT_REF="$PROD_REF" ;;
    preprod) PROJECT_REF="$PREPROD_REF" ;;
    sandbox) PROJECT_REF="$SANDBOX_REF" ;;
  esac

  push_to_env "$TARGET_ENV" "$PROJECT_REF"
fi

# ---- Restore original project link ----
if [[ -n "$ORIGINAL_REF" ]]; then
  echo "  Restoring link to $ORIGINAL_REF..."
  supabase link --project-ref "$ORIGINAL_REF" 2>&1 | sed 's/^/    /' || true
fi

echo ""
echo "  Done."
echo ""
