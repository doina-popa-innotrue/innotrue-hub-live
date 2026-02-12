#!/usr/bin/env bash
# ============================================================================
# diff-lovable.sh — Compare Lovable repo against live repo, then import
# ============================================================================
#
# Usage:
#   npm run diff:lovable -- /path/to/lovable-repo
#   npm run diff:lovable -- /path/to/lovable-repo src/components src/hooks
#   bash scripts/diff-lovable.sh /path/to/lovable-repo [scope...]
#
# What it does:
#   1. Compares the Lovable repo against the live repo (full src/ or scoped)
#   2. Categorises files: NEW | MODIFIED | DELETED (in Lovable) | IDENTICAL
#   3. Shows a summary with file-by-file diffs for modified files
#   4. Writes a pick-list to .lovable-diff-pick.txt for you to edit
#   5. After you confirm, feeds the selected files to import-from-lovable.sh
#
# Scope examples:
#   No scope      → compares all of src/
#   src/components → only compares src/components/
#   src/hooks src/pages → compares both directories
#
# ============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

PICK_FILE="$REPO_ROOT/.lovable-diff-pick.txt"

# ---- Files to NEVER import from Lovable (Lovable-specific or config diffs) ----
EXCLUDE_PATTERNS=(
  "vite.config.ts"
  "tsconfig.json"
  "tsconfig.app.json"
  "tsconfig.node.json"
  "eslint.config.js"
  "components.json"
  "package.json"
  "package-lock.json"
  "bun.lockb"
  ".gitignore"
  ".npmrc"
  ".prettierrc"
  ".cursorrules"
  "README.md"
  "CONTRIBUTING.md"
  "vitest.config.ts"
  "src/main.tsx"
  "src/lib/vitals.ts"
  "src/components/ErrorBoundary.tsx"
)

# Check if a file should be excluded
is_excluded() {
  local FILE="$1"
  for PATTERN in "${EXCLUDE_PATTERNS[@]}"; do
    if [[ "$FILE" == "$PATTERN" ]] || [[ "$FILE" == *"/lovable-tagger"* ]] || [[ "$FILE" == *"lovable"* && "$FILE" == *.ts ]]; then
      return 0
    fi
  done
  return 1
}

# ---- Argument validation ----
if [ $# -lt 1 ]; then
  echo "Usage: $0 <lovable-repo-path> [scope-dir-or-file ...]"
  echo ""
  echo "Examples:"
  echo "  $0 /path/to/lovable-repo                          # diff all of src/"
  echo "  $0 /path/to/lovable-repo src/components src/hooks  # diff specific dirs"
  echo ""
  exit 1
fi

LOVABLE_REPO="$1"
shift
SCOPES=("${@:-src/}")
# If no scopes were passed, default to src/
if [ ${#SCOPES[@]} -eq 0 ]; then
  SCOPES=("src/")
fi

# ---- Validate Lovable repo ----
if [ ! -d "$LOVABLE_REPO" ]; then
  echo "Error: Lovable repo path does not exist: $LOVABLE_REPO"
  exit 1
fi

if [ ! -f "$LOVABLE_REPO/package.json" ]; then
  echo "Error: No package.json found in $LOVABLE_REPO — is this a valid project?"
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║         Lovable ↔ Live Repo Diff                    ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  Lovable repo : $LOVABLE_REPO"
echo "  Live repo    : $REPO_ROOT"
echo "  Scope        : ${SCOPES[*]}"
echo ""

# ---- Collect all files from both repos ----
NEW_FILES=()
MODIFIED_FILES=()
IDENTICAL_FILES=()
DELETED_FILES=()

for SCOPE in "${SCOPES[@]}"; do
  LOVABLE_SCOPE="$LOVABLE_REPO/$SCOPE"
  LIVE_SCOPE="$REPO_ROOT/$SCOPE"

  if [ ! -e "$LOVABLE_SCOPE" ]; then
    echo "  ⚠  Scope not found in Lovable repo: $SCOPE (skipping)"
    continue
  fi

  # Find all files in the Lovable scope (excluding node_modules, .git, etc.)
  SKIPPED_COUNT=0
  while IFS= read -r -d '' FILE; do
    REL_PATH="${FILE#$LOVABLE_REPO/}"
    LIVE_FILE="$REPO_ROOT/$REL_PATH"

    # Skip Lovable-specific files that should never be imported
    if is_excluded "$REL_PATH"; then
      SKIPPED_COUNT=$((SKIPPED_COUNT + 1))
      continue
    fi

    if [ ! -f "$LIVE_FILE" ]; then
      NEW_FILES+=("$REL_PATH")
    elif diff -q "$FILE" "$LIVE_FILE" > /dev/null 2>&1; then
      IDENTICAL_FILES+=("$REL_PATH")
    else
      MODIFIED_FILES+=("$REL_PATH")
    fi
  done < <(find "$LOVABLE_SCOPE" -type f \
    ! -path '*/node_modules/*' \
    ! -path '*/.git/*' \
    ! -path '*/dist/*' \
    ! -path '*/.next/*' \
    ! -name '.DS_Store' \
    -print0 2>/dev/null)

  # Find files that exist in live but NOT in Lovable (deleted in Lovable)
  if [ -e "$LIVE_SCOPE" ]; then
    while IFS= read -r -d '' FILE; do
      REL_PATH="${FILE#$REPO_ROOT/}"
      LOVABLE_FILE="$LOVABLE_REPO/$REL_PATH"

      if [ ! -f "$LOVABLE_FILE" ]; then
        DELETED_FILES+=("$REL_PATH")
      fi
    done < <(find "$LIVE_SCOPE" -type f \
      ! -path '*/node_modules/*' \
      ! -path '*/.git/*' \
      ! -path '*/dist/*' \
      ! -name '.DS_Store' \
      -print0 2>/dev/null)
  fi
done

# ---- Summary ----
echo "━━━ Summary ━━━"
echo ""
printf "  %-14s %d\n" "New files:" "${#NEW_FILES[@]}"
printf "  %-14s %d\n" "Modified:" "${#MODIFIED_FILES[@]}"
printf "  %-14s %d\n" "Identical:" "${#IDENTICAL_FILES[@]}"
printf "  %-14s %d\n" "Only in live:" "${#DELETED_FILES[@]}"
printf "  %-14s %d\n" "Auto-excluded:" "$SKIPPED_COUNT"
echo ""
if [ "$SKIPPED_COUNT" -gt 0 ]; then
  echo "  (Auto-excluded files: Lovable config, tsconfig, vite.config, main.tsx, etc."
  echo "   These differ intentionally between Lovable and live repos.)"
  echo ""
fi

TOTAL_ACTIONABLE=$(( ${#NEW_FILES[@]} + ${#MODIFIED_FILES[@]} ))
if [ "$TOTAL_ACTIONABLE" -eq 0 ]; then
  echo "✓  No differences found. Lovable and live repos are in sync."
  exit 0
fi

# ---- List new files ----
if [ ${#NEW_FILES[@]} -gt 0 ]; then
  echo "━━━ New files (only in Lovable) ━━━"
  for F in "${NEW_FILES[@]}"; do
    echo "  + $F"
  done
  echo ""
fi

# ---- List and show modified files ----
if [ ${#MODIFIED_FILES[@]} -gt 0 ]; then
  echo "━━━ Modified files (differ between repos) ━━━"
  for F in "${MODIFIED_FILES[@]}"; do
    # Count lines changed
    DIFF_STAT=$(diff --brief "$LOVABLE_REPO/$F" "$REPO_ROOT/$F" 2>/dev/null || true)
    LINES_CHANGED=$(diff -u "$REPO_ROOT/$F" "$LOVABLE_REPO/$F" 2>/dev/null | grep -c '^[+-]' || echo "0")
    echo "  ~ $F  ($LINES_CHANGED lines changed)"
  done
  echo ""

  # Ask if user wants to see diffs
  echo "Would you like to see the diffs for modified files? (y/n/file-number)"
  read -p "> " -r SHOW_DIFFS
  echo ""

  if [[ "$SHOW_DIFFS" =~ ^[Yy]$ ]]; then
    for F in "${MODIFIED_FILES[@]}"; do
      echo "━━━ Diff: $F ━━━"
      # Show diff: live (old) → lovable (new), limited to 60 lines
      diff -u "$REPO_ROOT/$F" "$LOVABLE_REPO/$F" 2>/dev/null | head -60 || true
      TOTAL_DIFF_LINES=$(diff -u "$REPO_ROOT/$F" "$LOVABLE_REPO/$F" 2>/dev/null | wc -l | tr -d ' ')
      if [ "$TOTAL_DIFF_LINES" -gt 60 ]; then
        echo "  ... ($TOTAL_DIFF_LINES total diff lines, showing first 60)"
      fi
      echo ""
    done
  fi
fi

# ---- List files only in live (deleted in Lovable or never existed there) ----
if [ ${#DELETED_FILES[@]} -gt 0 ]; then
  echo "━━━ Files only in live repo (not in Lovable) ━━━"
  echo "  (These are safe — they won't be affected by import)"
  for F in "${DELETED_FILES[@]}"; do
    echo "  - $F"
  done
  echo ""
fi

# ---- Generate pick-list file ----
echo "━━━ Generating pick-list ━━━"
{
  echo "# ================================================================"
  echo "# Lovable Import Pick-List"
  echo "# ================================================================"
  echo "#"
  echo "# Review this file and remove any lines you DON'T want to import."
  echo "# Lines starting with # are comments and will be ignored."
  echo "# Save and close the file, then confirm to proceed."
  echo "#"
  echo "# Generated: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "# Lovable repo: $LOVABLE_REPO"
  echo "# ================================================================"
  echo ""

  if [ ${#NEW_FILES[@]} -gt 0 ]; then
    echo "# --- NEW FILES (only in Lovable) ---"
    for F in "${NEW_FILES[@]}"; do
      echo "$F"
    done
    echo ""
  fi

  if [ ${#MODIFIED_FILES[@]} -gt 0 ]; then
    echo "# --- MODIFIED FILES (differ between repos) ---"
    echo "# ⚠ These will OVERWRITE your live versions!"
    for F in "${MODIFIED_FILES[@]}"; do
      echo "$F"
    done
    echo ""
  fi
} > "$PICK_FILE"

echo "  Pick-list written to: .lovable-diff-pick.txt"
echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║  Next steps:                                        ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  1. Open .lovable-diff-pick.txt                     ║"
echo "║  2. Remove lines you DON'T want to import           ║"
echo "║  3. Save the file                                   ║"
echo "║  4. Come back here and press Enter to continue      ║"
echo "║                                                     ║"
echo "║  Or press Ctrl+C to cancel.                         ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
read -p "Press Enter when pick-list is ready (or Ctrl+C to cancel)... " -r

# ---- Read pick-list and import ----
SELECTED_FILES=()
while IFS= read -r LINE; do
  # Skip comments and empty lines
  [[ "$LINE" =~ ^#.*$ ]] && continue
  [[ -z "${LINE// /}" ]] && continue
  SELECTED_FILES+=("$LINE")
done < "$PICK_FILE"

if [ ${#SELECTED_FILES[@]} -eq 0 ]; then
  echo ""
  echo "No files selected. Nothing to import."
  rm -f "$PICK_FILE"
  exit 0
fi

echo ""
echo "Importing ${#SELECTED_FILES[@]} file(s)..."
echo ""

# Hand off to the import script
bash "$REPO_ROOT/scripts/import-from-lovable.sh" "$LOVABLE_REPO" "${SELECTED_FILES[@]}"

# Clean up pick-list
rm -f "$PICK_FILE"
