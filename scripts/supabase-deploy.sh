#!/usr/bin/env bash
# ============================================================================
# supabase-deploy.sh — Deploy edge functions to a Supabase environment
# ============================================================================
#
# Usage:
#   npm run deploy:functions                     # Deploy all to prod
#   npm run deploy:functions -- preprod          # Deploy all to preprod
#   npm run deploy:functions -- sandbox          # Deploy all to sandbox
#   npm run deploy:functions -- prod --only send-auth-email notify-assignment-graded
#   npm run deploy:functions -- --dry-run        # Show what would deploy
#
# What it does:
#   1. Links to the target Supabase project
#   2. Discovers all edge functions in supabase/functions/
#   3. Deploys each function (or only specified ones)
#   4. Reports success/failure per function
#   5. Restores original project link
#
# Prerequisites:
#   - Supabase CLI installed (brew install supabase/tap/supabase)
#   - Logged in to Supabase CLI (supabase login)
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
ONLY_FUNCTIONS=()

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
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --only)
      shift
      while [[ $# -gt 0 && ! "$1" =~ ^-- ]]; do
        ONLY_FUNCTIONS+=("$1")
        shift
      done
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [prod|preprod|sandbox] [--dry-run] [--only func1 func2 ...]"
      exit 1
      ;;
  esac
done

# Resolve project ref
case "$TARGET_ENV" in
  prod)    PROJECT_REF="$PROD_REF" ;;
  preprod) PROJECT_REF="$PREPROD_REF" ;;
  sandbox) PROJECT_REF="$SANDBOX_REF" ;;
esac

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║          Edge Function Deployment                   ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  Target    : $TARGET_ENV ($PROJECT_REF)"

# ---- Discover functions ----
FUNCTIONS_DIR="$REPO_ROOT/supabase/functions"
ALL_FUNCTIONS=()

for DIR in "$FUNCTIONS_DIR"/*/; do
  FUNC_NAME=$(basename "$DIR")
  # Skip _shared and node_modules
  [[ "$FUNC_NAME" == "_shared" ]] && continue
  [[ "$FUNC_NAME" == "node_modules" ]] && continue
  # Must have an index.ts
  [[ -f "$DIR/index.ts" ]] || continue
  ALL_FUNCTIONS+=("$FUNC_NAME")
done

# Filter if --only specified
if [ ${#ONLY_FUNCTIONS[@]} -gt 0 ]; then
  DEPLOY_FUNCTIONS=("${ONLY_FUNCTIONS[@]}")
  echo "  Functions : ${#DEPLOY_FUNCTIONS[@]} (filtered)"
else
  DEPLOY_FUNCTIONS=("${ALL_FUNCTIONS[@]}")
  echo "  Functions : ${#DEPLOY_FUNCTIONS[@]} (all)"
fi

if [ "$DRY_RUN" = true ]; then
  echo "  Mode      : DRY RUN"
fi
echo ""

# ---- Dry run: just list ----
if [ "$DRY_RUN" = true ]; then
  echo "  Would deploy:"
  for FUNC in "${DEPLOY_FUNCTIONS[@]}"; do
    if [[ -f "$FUNCTIONS_DIR/$FUNC/index.ts" ]]; then
      echo "    ✓ $FUNC"
    else
      echo "    ⚠ $FUNC (not found)"
    fi
  done
  echo ""
  echo "  Run without --dry-run to deploy."
  exit 0
fi

# ---- Check prerequisites ----
if ! command -v supabase &> /dev/null; then
  echo "Error: Supabase CLI not found."
  echo "Install with: brew install supabase/tap/supabase"
  exit 1
fi

# ---- Save and link project ----
ORIGINAL_REF=""
if [[ -f "$REPO_ROOT/supabase/.temp/project-ref" ]]; then
  ORIGINAL_REF=$(cat "$REPO_ROOT/supabase/.temp/project-ref")
fi

echo "  Linking to $TARGET_ENV ($PROJECT_REF)..."
supabase link --project-ref "$PROJECT_REF" 2>&1 | sed 's/^/    /'
echo ""

# ---- Deploy functions ----
SUCCESS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
FAILED_NAMES=()

for FUNC in "${DEPLOY_FUNCTIONS[@]}"; do
  if [[ ! -f "$FUNCTIONS_DIR/$FUNC/index.ts" ]]; then
    echo "  ⚠  Skipping $FUNC (not found)"
    SKIP_COUNT=$((SKIP_COUNT + 1))
    continue
  fi

  printf "  Deploying %-45s" "$FUNC..."
  if OUTPUT=$(supabase functions deploy "$FUNC" --no-verify-jwt 2>&1); then
    echo "✓"
    SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
  else
    echo "✗"
    FAILED_NAMES+=("$FUNC")
    FAIL_COUNT=$((FAIL_COUNT + 1))
    echo "$OUTPUT" | head -3 | sed 's/^/      /'
  fi
done

# ---- Restore original project link ----
if [[ -n "$ORIGINAL_REF" && "$ORIGINAL_REF" != "$PROJECT_REF" ]]; then
  echo ""
  echo "  Restoring link to $ORIGINAL_REF..."
  supabase link --project-ref "$ORIGINAL_REF" 2>&1 | sed 's/^/    /' || true
fi

# ---- Summary ----
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║                    Summary                          ║"
echo "╠══════════════════════════════════════════════════════╣"
printf "║  Target      : %-37s ║\n" "$TARGET_ENV"
printf "║  Deployed    : %-3d                                  ║\n" "$SUCCESS_COUNT"
printf "║  Failed      : %-3d                                  ║\n" "$FAIL_COUNT"
printf "║  Skipped     : %-3d                                  ║\n" "$SKIP_COUNT"
echo "╚══════════════════════════════════════════════════════╝"

if [ "$FAIL_COUNT" -gt 0 ]; then
  echo ""
  echo "  Failed functions:"
  for F in "${FAILED_NAMES[@]}"; do
    echo "    - $F"
  done
  echo ""
  echo "  Re-run individual failures with:"
  echo "    npm run deploy:functions -- $TARGET_ENV --only ${FAILED_NAMES[*]}"
fi
echo ""
