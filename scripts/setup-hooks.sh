#!/bin/bash
# Install committed git hooks from scripts/hooks/ into .git/hooks/
# Runs automatically on `npm install` via the "prepare" script.

HOOKS_SRC="$(dirname "$0")/hooks"
HOOKS_DST="$(git rev-parse --git-dir 2>/dev/null)/hooks"

if [ -z "$HOOKS_DST" ]; then
  echo "⚠️  Not a git repository — skipping hook installation."
  exit 0
fi

installed=0
for hook in "$HOOKS_SRC"/*; do
  [ -f "$hook" ] || continue
  name=$(basename "$hook")
  cp "$hook" "$HOOKS_DST/$name"
  chmod +x "$HOOKS_DST/$name"
  installed=$((installed + 1))
done

if [ "$installed" -gt 0 ]; then
  echo "✓ Installed $installed git hook(s) from scripts/hooks/"
fi
