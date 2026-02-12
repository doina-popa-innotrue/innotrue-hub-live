#!/usr/bin/env bash
# ============================================================================
# import-from-lovable.sh — Import files from a Lovable repo into the live repo
# ============================================================================
#
# Usage:
#   npm run import:lovable -- /path/to/lovable-repo src/components/NewFeature
#   npm run import:lovable -- /path/to/lovable-repo src/hooks/useNew.ts src/pages/NewPage.tsx
#   bash scripts/import-from-lovable.sh /path/to/lovable-repo src/components/Foo src/hooks/useFoo.ts
#
# What it does:
#   1. Validates the Lovable repo path
#   2. Creates a feature branch from develop: feature/lovable-import-YYYY-MM-DD-HHMMSS
#   3. Copies specified files/dirs into the live repo (preserving structure)
#   4. Runs the cleanup script automatically
#   5. Stages files and shows a diff summary
#   6. Does NOT auto-commit — you review first
#
# ============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# ---- Argument validation ----
if [ $# -lt 2 ]; then
  echo "Usage: $0 <lovable-repo-path> <file-or-dir> [<file-or-dir> ...]"
  echo ""
  echo "Examples:"
  echo "  $0 /path/to/lovable-repo src/components/NewFeature"
  echo "  $0 /path/to/lovable-repo src/hooks/useNew.ts src/pages/NewPage.tsx"
  echo ""
  echo "Paths are relative to the repo root (e.g., src/components/Foo)"
  exit 1
fi

LOVABLE_REPO="$1"
shift
IMPORT_PATHS=("$@")

# ---- Validate Lovable repo ----
if [ ! -d "$LOVABLE_REPO" ]; then
  echo "Error: Lovable repo path does not exist: $LOVABLE_REPO"
  exit 1
fi

if [ ! -f "$LOVABLE_REPO/package.json" ]; then
  echo "Error: No package.json found in $LOVABLE_REPO — is this a valid project?"
  exit 1
fi

# ---- Check git status ----
if [ -n "$(git status --porcelain)" ]; then
  echo "Error: Working tree has uncommitted changes."
  echo "Please commit or stash your changes before importing."
  echo ""
  git status --short
  exit 1
fi

# ---- Ensure we're on develop ----
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "develop" ]; then
  echo "Warning: You are on '$CURRENT_BRANCH', not 'develop'."
  read -p "Switch to develop first? (y/n) " -n 1 -r
  echo ""
  if [[ $REPLY =~ ^[Yy]$ ]]; then
    git checkout develop
    git pull origin develop
  else
    echo "Continuing on '$CURRENT_BRANCH'..."
  fi
fi

# ---- Create feature branch ----
TIMESTAMP=$(date +%Y-%m-%d-%H%M%S)
BRANCH_NAME="feature/lovable-import-$TIMESTAMP"
echo ""
echo "Creating branch: $BRANCH_NAME"
git checkout -b "$BRANCH_NAME"

# ---- Copy files ----
echo ""
echo "Importing files from Lovable repo..."
COPIED_FILES=()

for IMPORT_PATH in "${IMPORT_PATHS[@]}"; do
  SOURCE="$LOVABLE_REPO/$IMPORT_PATH"

  if [ ! -e "$SOURCE" ]; then
    echo "  ⚠  Skipping (not found): $IMPORT_PATH"
    continue
  fi

  if [ -d "$SOURCE" ]; then
    # Directory: use rsync to preserve structure
    echo "  📁 Copying directory: $IMPORT_PATH"
    mkdir -p "$REPO_ROOT/$IMPORT_PATH"
    rsync -av --exclude='node_modules' --exclude='.git' "$SOURCE/" "$REPO_ROOT/$IMPORT_PATH/" 2>/dev/null
  else
    # Single file: ensure parent dir exists, then copy
    echo "  📄 Copying file: $IMPORT_PATH"
    mkdir -p "$(dirname "$REPO_ROOT/$IMPORT_PATH")"
    cp "$SOURCE" "$REPO_ROOT/$IMPORT_PATH"
  fi

  COPIED_FILES+=("$IMPORT_PATH")
done

if [ ${#COPIED_FILES[@]} -eq 0 ]; then
  echo ""
  echo "Error: No files were copied. Check your paths."
  git checkout -
  git branch -d "$BRANCH_NAME"
  exit 1
fi

echo ""
echo "Copied ${#COPIED_FILES[@]} item(s)."

# ---- Run cleanup ----
echo ""
echo "Running cleanup on imported files..."
echo ""
bash "$REPO_ROOT/scripts/cleanup-lovable-code.sh" "${COPIED_FILES[@]}"

# ---- Stage and show diff ----
echo ""
echo "━━━ Staging changes ━━━"
for ITEM in "${COPIED_FILES[@]}"; do
  git add "$ITEM"
done

echo ""
echo "━━━ Diff summary ━━━"
git diff --cached --stat

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║                  Import Complete                    ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Branch: $BRANCH_NAME"
echo "║  Files imported: ${#COPIED_FILES[@]}"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Next steps:                                        ║"
echo "║  1. Review the diff: git diff --cached              ║"
echo "║  2. Fix any TypeScript errors reported above        ║"
echo "║  3. Remove any @lovable references                  ║"
echo "║  4. Commit: git commit -m 'feat: import X from      ║"
echo "║     Lovable prototype'                              ║"
echo "║  5. Push: git push -u origin $BRANCH_NAME"
echo "║  6. Create PR to develop on GitHub                  ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
