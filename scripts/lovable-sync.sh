#!/usr/bin/env bash
# ============================================================================
# lovable-sync.sh — One-command Lovable import pipeline
# ============================================================================
#
# Usage:
#   npm run sync:lovable                    # Full pipeline (pull, diff, import, verify, commit, push, PR)
#   npm run sync:lovable -- --diff-only     # Just pull + diff (no import)
#   npm run sync:lovable -- --no-pr         # Skip PR creation
#   npm run sync:lovable -- --scope src/components/NewFeature  # Only diff specific dirs
#
# What it does:
#   1. Pulls latest from both repos
#   2. Runs diff (calls diff-lovable.sh logic internally)
#   3. Opens pick-list for review
#   4. Imports selected files (branch, copy, cleanup)
#   5. Runs full verification (lint, typecheck, tests, build)
#   6. Commits with descriptive message
#   7. Pushes and creates PR to develop
#
# Prerequisites:
#   - Lovable sandbox cloned at LOVABLE_REPO_PATH (see below)
#   - gh CLI installed (for PR creation)
#   - Clean working tree, on develop branch
#
# ============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# ---- Configuration ----
# Default Lovable repo path (sibling directory)
LOVABLE_REPO_PATH="${LOVABLE_REPO_PATH:-$(cd "$REPO_ROOT/.." && pwd)/lovable-sandbox}"

# ---- Parse arguments ----
DIFF_ONLY=false
SKIP_PR=false
SCOPES=()

while [[ $# -gt 0 ]]; do
  case $1 in
    --diff-only)
      DIFF_ONLY=true
      shift
      ;;
    --no-pr)
      SKIP_PR=true
      shift
      ;;
    --scope)
      shift
      while [[ $# -gt 0 && ! "$1" =~ ^-- ]]; do
        SCOPES+=("$1")
        shift
      done
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 [--diff-only] [--no-pr] [--scope dir1 dir2 ...]"
      exit 1
      ;;
  esac
done

# Default scope
if [ ${#SCOPES[@]} -eq 0 ]; then
  SCOPES=("src/")
fi

# ---- Validate environment ----
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║            Lovable Sync Pipeline                    ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# Check Lovable repo exists
if [ ! -d "$LOVABLE_REPO_PATH" ]; then
  echo "Error: Lovable repo not found at: $LOVABLE_REPO_PATH"
  echo ""
  echo "Clone it first:"
  echo "  cd \"$(dirname "$LOVABLE_REPO_PATH")\""
  echo "  git clone https://github.com/doina-popa-innotrue/innotrue-hub-lovable-sandbox.git lovable-sandbox"
  echo ""
  echo "Or set LOVABLE_REPO_PATH environment variable."
  exit 1
fi

# Check clean working tree
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: Working tree has uncommitted changes."
  echo ""
  git status --short
  echo ""
  echo "Commit or stash your changes first."
  exit 1
fi

# Check we're on develop
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "develop" ]; then
  echo "Switching to develop..."
  git checkout develop
fi

# ============================================================================
# STEP 1: Pull latest from both repos
# ============================================================================
echo "━━━ Step 1/7: Pulling latest ━━━"
echo ""
echo "  Pulling live repo (develop)..."
git pull origin develop 2>&1 | sed 's/^/    /'
echo ""
echo "  Pulling Lovable sandbox..."
(cd "$LOVABLE_REPO_PATH" && git pull 2>&1) | sed 's/^/    /'
echo ""

# ============================================================================
# STEP 2: Run diff
# ============================================================================
echo "━━━ Step 2/7: Comparing repos ━━━"
echo ""
echo "  Live repo    : $REPO_ROOT"
echo "  Lovable repo : $LOVABLE_REPO_PATH"
echo "  Scope        : ${SCOPES[*]}"
echo ""

# ---- Auto-exclusion list (same as diff-lovable.sh) ----
EXCLUDE_PATTERNS=(
  "vite.config.ts" "tsconfig.json" "tsconfig.app.json" "tsconfig.node.json"
  "eslint.config.js" "components.json" "package.json" "package-lock.json"
  "bun.lockb" ".gitignore" ".npmrc" ".prettierrc" ".cursorrules"
  "README.md" "CONTRIBUTING.md" "vitest.config.ts"
  "src/main.tsx" "src/lib/vitals.ts" "src/components/ErrorBoundary.tsx"
  "src/integrations/supabase/client.ts" "src/integrations/supabase/types.ts"
  "supabase/config.toml"
)

is_excluded() {
  local FILE="$1"
  for PATTERN in "${EXCLUDE_PATTERNS[@]}"; do
    if [[ "$FILE" == "$PATTERN" ]]; then return 0; fi
  done
  # Lovable-specific files
  if [[ "$FILE" == *"/lovable-tagger"* ]] || [[ "$FILE" == *"lovable"* && "$FILE" == *.ts ]]; then
    return 0
  fi
  return 1
}

NEW_FILES=()
MODIFIED_FILES=()
IDENTICAL_COUNT=0
EXCLUDED_COUNT=0

for SCOPE in "${SCOPES[@]}"; do
  LOVABLE_SCOPE="$LOVABLE_REPO_PATH/$SCOPE"
  if [ ! -e "$LOVABLE_SCOPE" ]; then
    echo "  Warning: Scope not found in Lovable: $SCOPE"
    continue
  fi

  while IFS= read -r -d '' FILE; do
    REL_PATH="${FILE#$LOVABLE_REPO_PATH/}"
    LIVE_FILE="$REPO_ROOT/$REL_PATH"

    if is_excluded "$REL_PATH"; then
      EXCLUDED_COUNT=$((EXCLUDED_COUNT + 1))
      continue
    fi

    if [ ! -f "$LIVE_FILE" ]; then
      NEW_FILES+=("$REL_PATH")
    elif diff -q "$FILE" "$LIVE_FILE" > /dev/null 2>&1; then
      IDENTICAL_COUNT=$((IDENTICAL_COUNT + 1))
    else
      MODIFIED_FILES+=("$REL_PATH")
    fi
  done < <(find "$LOVABLE_SCOPE" -type f \
    ! -path '*/node_modules/*' ! -path '*/.git/*' ! -path '*/dist/*' \
    ! -name '.DS_Store' -print0 2>/dev/null)
done

TOTAL_IMPORTABLE=$(( ${#NEW_FILES[@]} + ${#MODIFIED_FILES[@]} ))

echo "  Results:"
printf "    %-16s %d\n" "New files:" "${#NEW_FILES[@]}"
printf "    %-16s %d\n" "Modified:" "${#MODIFIED_FILES[@]}"
printf "    %-16s %d\n" "Identical:" "$IDENTICAL_COUNT"
printf "    %-16s %d\n" "Auto-excluded:" "$EXCLUDED_COUNT"
echo ""

if [ "$TOTAL_IMPORTABLE" -eq 0 ]; then
  echo "✓  Repos are in sync. Nothing to import."
  exit 0
fi

# Show new files
if [ ${#NEW_FILES[@]} -gt 0 ]; then
  echo "  New files (only in Lovable):"
  for F in "${NEW_FILES[@]}"; do
    echo "    + $F"
  done
  echo ""
fi

# Show modified files with line counts
if [ ${#MODIFIED_FILES[@]} -gt 0 ]; then
  echo "  Modified files (differ between repos):"
  echo "  ⚠  Review these carefully — if live is ahead, do NOT import them."
  echo ""
  for F in "${MODIFIED_FILES[@]}"; do
    LINES=$(diff -u "$REPO_ROOT/$F" "$LOVABLE_REPO_PATH/$F" 2>/dev/null | grep -c '^[+-]' || echo "0")
    echo "    ~ $F  ($LINES lines changed)"
  done
  echo ""

  # Show diffs
  read -p "  Show diffs? (y/n) " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    for F in "${MODIFIED_FILES[@]}"; do
      echo ""
      echo "  ━━━ $F ━━━"
      diff -u "$REPO_ROOT/$F" "$LOVABLE_REPO_PATH/$F" 2>/dev/null | head -40 || true
      TOTAL_LINES=$(diff -u "$REPO_ROOT/$F" "$LOVABLE_REPO_PATH/$F" 2>/dev/null | wc -l | tr -d ' ')
      if [ "$TOTAL_LINES" -gt 40 ]; then
        echo "  ... ($TOTAL_LINES total lines, showing first 40)"
      fi
    done
    echo ""
  fi
fi

if [ "$DIFF_ONLY" = true ]; then
  echo "Done (--diff-only mode)."
  exit 0
fi

# ============================================================================
# STEP 3: Generate and edit pick-list
# ============================================================================
echo "━━━ Step 3/7: Pick-list ━━━"
echo ""

PICK_FILE="$REPO_ROOT/.lovable-diff-pick.txt"

{
  echo "# ================================================================"
  echo "# Lovable Import Pick-List — $(date '+%Y-%m-%d %H:%M:%S')"
  echo "# ================================================================"
  echo "#"
  echo "# Remove lines you DON'T want to import. Comment with # to skip."
  echo "# ⚠  Modified files will OVERWRITE live versions!"
  echo "# ================================================================"
  echo ""

  if [ ${#NEW_FILES[@]} -gt 0 ]; then
    echo "# --- NEW FILES ---"
    for F in "${NEW_FILES[@]}"; do echo "$F"; done
    echo ""
  fi

  if [ ${#MODIFIED_FILES[@]} -gt 0 ]; then
    echo "# --- MODIFIED FILES (review diffs above before importing!) ---"
    for F in "${MODIFIED_FILES[@]}"; do echo "# $F"; done
    echo ""
  fi
} > "$PICK_FILE"

echo "  Pick-list written to: .lovable-diff-pick.txt"
echo ""
echo "  New files are included by default."
echo "  Modified files are COMMENTED OUT by default (uncomment to import)."
echo ""
echo "  Open the file, review, save, then come back."
echo ""
read -p "  Press Enter when ready (or Ctrl+C to cancel)... " -r

# Read selected files
SELECTED_FILES=()
while IFS= read -r LINE; do
  [[ "$LINE" =~ ^#.*$ ]] && continue
  [[ -z "${LINE// /}" ]] && continue
  SELECTED_FILES+=("$LINE")
done < "$PICK_FILE"

rm -f "$PICK_FILE"

if [ ${#SELECTED_FILES[@]} -eq 0 ]; then
  echo ""
  echo "  No files selected. Nothing to import."
  exit 0
fi

echo ""
echo "  Selected ${#SELECTED_FILES[@]} file(s) for import."

# ============================================================================
# STEP 4: Import files (create branch, copy, cleanup)
# ============================================================================
echo ""
echo "━━━ Step 4/7: Importing files ━━━"
echo ""

TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)
BRANCH_NAME="feature/lovable-import-$TIMESTAMP"
echo "  Creating branch: $BRANCH_NAME"
git checkout -b "$BRANCH_NAME"

COPIED_COUNT=0
for IMPORT_PATH in "${SELECTED_FILES[@]}"; do
  SOURCE="$LOVABLE_REPO_PATH/$IMPORT_PATH"
  if [ ! -e "$SOURCE" ]; then
    echo "  ⚠  Skipping (not found): $IMPORT_PATH"
    continue
  fi

  if [ -d "$SOURCE" ]; then
    echo "  📁 $IMPORT_PATH/"
    mkdir -p "$REPO_ROOT/$IMPORT_PATH"
    rsync -a --exclude='node_modules' --exclude='.git' "$SOURCE/" "$REPO_ROOT/$IMPORT_PATH/" 2>/dev/null
  else
    echo "  📄 $IMPORT_PATH"
    mkdir -p "$(dirname "$REPO_ROOT/$IMPORT_PATH")"
    cp "$SOURCE" "$REPO_ROOT/$IMPORT_PATH"
  fi
  COPIED_COUNT=$((COPIED_COUNT + 1))
done

echo ""
echo "  Copied $COPIED_COUNT item(s)."

# ============================================================================
# STEP 5: Cleanup + Verify
# ============================================================================
echo ""
echo "━━━ Step 5/7: Cleanup + Verify ━━━"
echo ""

# Run cleanup on imported files
echo "  Running cleanup..."
bash "$REPO_ROOT/scripts/cleanup-lovable-code.sh" "${SELECTED_FILES[@]}" 2>&1 | sed 's/^/  /'

echo ""
echo "  Running full verification..."
echo ""

# Run verify (lint, typecheck, tests, build)
VERIFY_PASSED=true
if ! bash "$REPO_ROOT/scripts/verify.sh" 2>&1 | sed 's/^/  /'; then
  VERIFY_PASSED=false
fi

if [ "$VERIFY_PASSED" = false ]; then
  echo ""
  echo "  ⚠  Verification failed. Fix the issues above, then:"
  echo "    git add -A"
  echo "    git commit -m 'feat: import from Lovable'"
  echo "    git push -u origin $BRANCH_NAME"
  echo ""
  echo "  Branch: $BRANCH_NAME"
  echo "  Files are staged but NOT committed."
  git add -A
  exit 1
fi

# ============================================================================
# STEP 6: Commit
# ============================================================================
echo ""
echo "━━━ Step 6/7: Commit ━━━"
echo ""

git add -A

# Build commit message from selected files
FILE_LIST=""
for F in "${SELECTED_FILES[@]}"; do
  FILE_LIST+="  - $F"$'\n'
done

COMMIT_MSG="feat: import ${#SELECTED_FILES[@]} file(s) from Lovable sandbox

Files imported:
$FILE_LIST
Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

git commit -m "$COMMIT_MSG"
echo "  Committed."

# ============================================================================
# STEP 7: Push + PR
# ============================================================================
echo ""
echo "━━━ Step 7/7: Push + PR ━━━"
echo ""

git push -u origin "$BRANCH_NAME" 2>&1 | sed 's/^/  /'

if [ "$SKIP_PR" = false ]; then
  if command -v gh &> /dev/null; then
    echo ""
    echo "  Creating PR..."
    PR_URL=$(gh pr create \
      --base develop \
      --title "Import ${#SELECTED_FILES[@]} file(s) from Lovable sandbox" \
      --body "$(cat <<PREOF
## Summary
Imported ${#SELECTED_FILES[@]} file(s) from Lovable sandbox.

### Files
$(for F in "${SELECTED_FILES[@]}"; do echo "- \`$F\`"; done)

## Checklist
- [x] Cleanup script ran (ESLint, Prettier, Lovable reference scan)
- [x] Full verification passed (lint, typecheck, tests, build)
- [ ] Manual review of diffs
- [ ] Test on preprod after merge

Generated with [lovable-sync.sh](scripts/lovable-sync.sh)
PREOF
)" 2>&1)
    echo "  PR created: $PR_URL"
  else
    echo "  ⚠  gh CLI not found. Create PR manually:"
    echo "     https://github.com/doina-popa-innotrue/innotrue-hub-live/compare/develop...$BRANCH_NAME"
  fi
else
  echo "  Skipped PR creation (--no-pr)."
  echo "  Create manually: https://github.com/doina-popa-innotrue/innotrue-hub-live/compare/develop...$BRANCH_NAME"
fi

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║                    Done!                            ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Branch : $BRANCH_NAME"
printf "║  Files  : %-3d imported                              ║\n" "${#SELECTED_FILES[@]}"
echo "║                                                     ║"
echo "║  Next: merge PR, then promote:                      ║"
echo "║    git checkout preprod && git merge develop         ║"
echo "║    git push origin preprod                          ║"
echo "║    # test on preview URL                            ║"
echo "║    git checkout main && git merge preprod            ║"
echo "║    git push origin main                             ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
