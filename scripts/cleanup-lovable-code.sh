#!/usr/bin/env bash
# ============================================================================
# cleanup-lovable-code.sh — Clean up Lovable-generated code for production
# ============================================================================
#
# Usage:
#   npm run cleanup:lovable                    # Clean all of src/
#   npm run cleanup:lovable -- src/components/NewFeature
#   bash scripts/cleanup-lovable-code.sh src/pages/NewPage.tsx
#
# This script:
#   1. Runs ESLint --fix to auto-fix simple violations
#   2. Runs Prettier to normalize formatting
#   3. Reports TypeScript errors (manual fix needed)
#   4. Scans for Lovable-specific patterns that must be removed
#   5. Reports 'any' type usage for manual cleanup
#
# Exit code: 0 (always succeeds — issues are reported, not blocking)
# ============================================================================

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

TARGETS="${*:-src/}"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║         Lovable Code Cleanup                        ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "Targets: $TARGETS"
echo ""

# Track counts for summary
ESLINT_FIXED=0
PRETTIER_FIXED=0
TS_ERROR_COUNT=0
LOVABLE_REFS=0
STALE_URLS=0
HARDCODED_SUPA=0
CONSOLE_COUNT=0
ANY_COUNT=0

# --- STEP 1: ESLint auto-fix ---
echo "━━━ Step 1/5: ESLint --fix ━━━"
ESLINT_OUTPUT=$(npx eslint --fix $TARGETS 2>&1) || true
ESLINT_FIXED=$(echo "$ESLINT_OUTPUT" | grep -c "problem" || echo "0")
if [ -n "$ESLINT_OUTPUT" ]; then
  echo "$ESLINT_OUTPUT" | tail -5
else
  echo "  No issues found or all auto-fixed."
fi
echo ""

# --- STEP 2: Prettier formatting ---
echo "━━━ Step 2/5: Prettier --write ━━━"
PRETTIER_OUTPUT=$(npx prettier --write $TARGETS --ignore-unknown 2>&1) || true
PRETTIER_FIXED=$(echo "$PRETTIER_OUTPUT" | grep -cv "unchanged" || echo "0")
echo "  Files formatted: $PRETTIER_FIXED"
echo ""

# --- STEP 3: TypeScript error report ---
echo "━━━ Step 3/5: TypeScript errors ━━━"
TS_OUTPUT=$(npx tsc --noEmit 2>&1) || true
TS_ERROR_COUNT=$(echo "$TS_OUTPUT" | grep -c "error TS" || echo "0")
echo "  TypeScript errors: $TS_ERROR_COUNT"
if [ "$TS_ERROR_COUNT" -gt 0 ]; then
  echo ""
  echo "  First 20 errors:"
  echo "$TS_OUTPUT" | grep "error TS" | head -20 | sed 's/^/    /'
fi
echo ""

# --- STEP 4: Lovable-specific pattern scan ---
echo "━━━ Step 4/5: Lovable pattern scan ━━━"

# 4a. @lovable references
LOVABLE_REFS=$(grep -rn "@lovable\|lovable-uploads\|lovable-tagger\|gptengineer\|from.*lovable" $TARGETS 2>/dev/null | grep -v node_modules | grep -v "\.sh:" | wc -l | tr -d ' ')
echo "  @lovable / GPT Engineer references: $LOVABLE_REFS"
if [ "$LOVABLE_REFS" -gt 0 ]; then
  grep -rn "@lovable\|lovable-uploads\|lovable-tagger\|gptengineer\|from.*lovable" $TARGETS 2>/dev/null | grep -v node_modules | grep -v "\.sh:" | head -10 | sed 's/^/    /'
fi

# 4b. Stale URLs (old domains)
STALE_URLS=$(grep -rn "innotruehub\.com\|lovable\.dev\|lovable\.app" $TARGETS 2>/dev/null | grep -v node_modules | grep -v "\.sh:" | wc -l | tr -d ' ')
echo "  Stale URLs (old domains): $STALE_URLS"
if [ "$STALE_URLS" -gt 0 ]; then
  grep -rn "innotruehub\.com\|lovable\.dev\|lovable\.app" $TARGETS 2>/dev/null | grep -v node_modules | grep -v "\.sh:" | head -10 | sed 's/^/    /'
fi

# 4c. Unknown Supabase project refs (not our known 3 projects)
HARDCODED_SUPA=$(grep -rn "supabase\.co" $TARGETS 2>/dev/null \
  | grep -v "qfdztdgublwlmewobxmx\|jtzcrirqflfnagceendt\|pfwlsxovvqdiwaztqxrj\|cezlnvdjildzxpyxyabb" \
  | grep -v node_modules | grep -v "\.sh:" | grep -v "placeholder" | wc -l | tr -d ' ')
echo "  Unknown Supabase project refs: $HARDCODED_SUPA"
if [ "$HARDCODED_SUPA" -gt 0 ]; then
  grep -rn "supabase\.co" $TARGETS 2>/dev/null \
    | grep -v "qfdztdgublwlmewobxmx\|jtzcrirqflfnagceendt\|pfwlsxovvqdiwaztqxrj\|cezlnvdjildzxpyxyabb" \
    | grep -v node_modules | grep -v "\.sh:" | grep -v "placeholder" | head -10 | sed 's/^/    /'
fi

# 4d. console.log/warn/error (outside test files)
CONSOLE_COUNT=$(grep -rn "console\.\(log\|warn\|error\)" $TARGETS 2>/dev/null \
  | grep -v "__tests__\|\.test\.\|\.spec\.\|test/\|setup\.ts" \
  | grep -v node_modules | grep -v "\.sh:" | wc -l | tr -d ' ')
echo "  console.log/warn/error statements: $CONSOLE_COUNT"
echo ""

# --- STEP 5: 'any' type count ---
echo "━━━ Step 5/5: 'any' type usage ━━━"
ANY_COUNT=$(grep -rn ": any\b\|: any;\|: any,\|: any)\|as any\b\|<any>" $TARGETS 2>/dev/null \
  | grep -v node_modules | grep -v "\.test\.\|__tests__" | grep -v "\.sh:" | wc -l | tr -d ' ')
echo "  'any' type occurrences: $ANY_COUNT"
echo ""

# --- SUMMARY ---
echo "╔══════════════════════════════════════════════════════╗"
echo "║                    Summary                          ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  ESLint + Prettier     : auto-fixed                 ║"
printf "║  TypeScript errors     : %-4s (manual fix needed)   ║\n" "$TS_ERROR_COUNT"
printf "║  @lovable references   : %-4s (must remove)         ║\n" "$LOVABLE_REFS"
printf "║  Stale URLs            : %-4s (must update)         ║\n" "$STALE_URLS"
printf "║  Unknown Supabase refs : %-4s (must update)         ║\n" "$HARDCODED_SUPA"
printf "║  'any' types           : %-4s (should fix)          ║\n" "$ANY_COUNT"
printf "║  console.* calls       : %-4s (review needed)       ║\n" "$CONSOLE_COUNT"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

if [ "$LOVABLE_REFS" -gt 0 ] || [ "$STALE_URLS" -gt 0 ] || [ "$HARDCODED_SUPA" -gt 0 ] || [ "$TS_ERROR_COUNT" -gt 0 ]; then
  echo "⚠  Manual fixes required before committing."
else
  echo "✓  No blocking issues found. Ready for review and commit."
fi
echo ""
