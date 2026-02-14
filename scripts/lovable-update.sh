#!/usr/bin/env bash
# ============================================================================
# lovable-update.sh — Push live changes to the Lovable sandbox
# ============================================================================
#
# Usage:
#   npm run update:lovable                  # Merge live main → Lovable main
#   npm run update:lovable -- --dry-run     # Show what would be merged, don't push
#   npm run update:lovable -- --source preprod  # Merge from preprod instead of main
#
# What it does:
#   1. Pulls latest from both repos
#   2. Merges live branch into Lovable's main (git merge, not force-push)
#   3. Verifies Lovable-specific files are preserved
#   4. Pushes to Lovable's origin
#
# Safe because:
#   - Uses git merge (preserves Lovable's local patches via merge resolution)
#   - Verifies critical Lovable-only files are untouched after merge
#   - Aborts on any conflict (you resolve manually)
#   - Never touches the live repo
#
# ============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOVABLE_REPO_PATH="${LOVABLE_REPO_PATH:-$(cd "$REPO_ROOT/.." && pwd)/lovable-sandbox}"

# ---- Configuration ----
# Files that Lovable maintains its own version of — must NOT change during merge
LOVABLE_OWNED_FILES=(
  "vite.config.ts"
  "src/integrations/supabase/client.ts"
  "src/integrations/supabase/types.ts"
)

# ---- Parse arguments ----
DRY_RUN=false
SOURCE_BRANCH="main"

while [[ $# -gt 0 ]]; do
  case $1 in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --source)
      SOURCE_BRANCH="$2"
      shift 2
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--dry-run] [--source main|preprod]"
      exit 1
      ;;
  esac
done

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║         Lovable Update (Live → Sandbox)             ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ---- Validate Lovable repo ----
if [ ! -d "$LOVABLE_REPO_PATH" ]; then
  echo "Error: Lovable repo not found at: $LOVABLE_REPO_PATH"
  echo ""
  echo "Clone it first:"
  echo "  cd \"$(dirname "$LOVABLE_REPO_PATH")\""
  echo "  git clone https://github.com/doina-popa-innotrue/innotrue-hub-lovable-sandbox.git lovable-sandbox"
  exit 1
fi

if [ ! -d "$LOVABLE_REPO_PATH/.git" ]; then
  echo "Error: $LOVABLE_REPO_PATH is not a git repository"
  exit 1
fi

# ============================================================================
# STEP 1: Pull latest from both repos
# ============================================================================
echo "━━━ Step 1/5: Pulling latest ━━━"
echo ""

echo "  Live repo ($SOURCE_BRANCH)..."
(cd "$REPO_ROOT" && git fetch origin "$SOURCE_BRANCH" 2>&1) | sed 's/^/    /'
LIVE_HEAD=$(cd "$REPO_ROOT" && git rev-parse "origin/$SOURCE_BRANCH")
echo "    HEAD: ${LIVE_HEAD:0:8}"
echo ""

echo "  Lovable sandbox (main)..."
cd "$LOVABLE_REPO_PATH"
git checkout main 2>&1 | sed 's/^/    /'
git pull origin main 2>&1 | sed 's/^/    /'
LOVABLE_HEAD=$(git rev-parse HEAD)
echo "    HEAD: ${LOVABLE_HEAD:0:8}"
echo ""

# Check if already up to date
MERGE_BASE=$(git merge-base HEAD "$LIVE_HEAD" 2>/dev/null || echo "none")
if [ "$MERGE_BASE" = "$LIVE_HEAD" ] || [ "$LOVABLE_HEAD" = "$LIVE_HEAD" ]; then
  echo "✓  Lovable sandbox is already up to date with live/$SOURCE_BRANCH."
  exit 0
fi

# ============================================================================
# STEP 2: Ensure live remote is configured in Lovable repo
# ============================================================================
echo "━━━ Step 2/5: Configuring remotes ━━━"
echo ""

if ! git remote get-url live &>/dev/null; then
  echo "  Adding 'live' remote..."
  git remote add live https://github.com/doina-popa-innotrue/innotrue-hub-live.git
fi
git fetch live "$SOURCE_BRANCH" 2>&1 | sed 's/^/    /'
echo ""

# ============================================================================
# STEP 3: Record checksums of Lovable-owned files (for verification)
# ============================================================================
echo "━━━ Step 3/5: Recording Lovable file checksums ━━━"
echo ""

declare -A FILE_CHECKSUMS
for F in "${LOVABLE_OWNED_FILES[@]}"; do
  if [ -f "$F" ]; then
    FILE_CHECKSUMS["$F"]=$(md5 -q "$F" 2>/dev/null || md5sum "$F" | cut -d' ' -f1)
    echo "  $F: ${FILE_CHECKSUMS[$F]:0:8}..."
  fi
done
echo ""

# ============================================================================
# STEP 4: Merge
# ============================================================================
echo "━━━ Step 4/5: Merging live/$SOURCE_BRANCH → Lovable main ━━━"
echo ""

# Count commits ahead
COMMITS_AHEAD=$(git rev-list HEAD..live/"$SOURCE_BRANCH" --count)
echo "  Commits to merge: $COMMITS_AHEAD"
echo ""

if [ "$DRY_RUN" = true ]; then
  echo "  [DRY RUN] Would merge these changes:"
  echo ""
  git diff --stat HEAD..live/"$SOURCE_BRANCH" 2>&1 | sed 's/^/    /'
  echo ""
  echo "  [DRY RUN] Checking for conflicts..."
  if git merge --no-commit --no-ff live/"$SOURCE_BRANCH" 2>&1 | grep -q "CONFLICT"; then
    echo "  ⚠  Merge conflicts detected! Manual resolution needed."
    git merge --abort
  else
    echo "  ✓  No conflicts. Merge would succeed cleanly."
    git merge --abort
  fi
  echo ""
  echo "Done (--dry-run mode). Run without --dry-run to apply."
  exit 0
fi

# Attempt the merge
MERGE_OUTPUT=$(git merge live/"$SOURCE_BRANCH" --no-edit 2>&1)
MERGE_STATUS=$?

if [ $MERGE_STATUS -ne 0 ]; then
  echo "  ⚠  Merge conflicts!"
  echo ""
  echo "$MERGE_OUTPUT" | sed 's/^/    /'
  echo ""
  echo "  Resolve conflicts in: $LOVABLE_REPO_PATH"
  echo "  Then run:"
  echo "    cd \"$LOVABLE_REPO_PATH\""
  echo "    # fix conflicts..."
  echo "    git add ."
  echo "    git commit"
  echo "    git push origin main"
  exit 1
fi

echo "$MERGE_OUTPUT" | sed 's/^/    /'
echo ""

# ============================================================================
# STEP 5: Verify Lovable-owned files are preserved
# ============================================================================
echo "━━━ Step 5/5: Verifying Lovable files preserved ━━━"
echo ""

VERIFICATION_FAILED=false
for F in "${LOVABLE_OWNED_FILES[@]}"; do
  if [ -f "$F" ]; then
    NEW_CHECKSUM=$(md5 -q "$F" 2>/dev/null || md5sum "$F" | cut -d' ' -f1)
    if [ "${FILE_CHECKSUMS[$F]:-}" = "$NEW_CHECKSUM" ]; then
      echo "  ✓ $F (unchanged)"
    else
      echo "  ⚠ $F (CHANGED — Lovable patch may be lost!)"
      VERIFICATION_FAILED=true
    fi
  fi
done
echo ""

if [ "$VERIFICATION_FAILED" = true ]; then
  echo "  ⚠  Some Lovable-owned files were modified!"
  echo "  Review the changes and restore Lovable patches if needed:"
  echo "    cd \"$LOVABLE_REPO_PATH\""
  echo "    git diff HEAD~1 -- vite.config.ts src/integrations/supabase/client.ts"
  echo ""
  read -p "  Continue and push anyway? (y/n) " -n 1 -r
  echo ""
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "  Aborting. Merge is committed locally but NOT pushed."
    echo "  To undo: git reset --hard HEAD~1"
    exit 1
  fi
fi

# Push
echo "  Pushing to Lovable sandbox..."
git push origin main 2>&1 | sed 's/^/    /'
echo ""

# Show final state
echo "╔══════════════════════════════════════════════════════╗"
echo "║                    Done!                            ║"
echo "╠══════════════════════════════════════════════════════╣"
printf "║  Merged: %d commits from live/%-7s               ║\n" "$COMMITS_AHEAD" "$SOURCE_BRANCH"
echo "║  Lovable sandbox is now up to date.                 ║"
echo "║                                                     ║"
echo "║  ⚠  Lovable IDE may need a refresh/pull to see     ║"
echo "║     the new code.                                   ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
