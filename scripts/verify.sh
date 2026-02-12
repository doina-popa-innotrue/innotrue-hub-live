#!/usr/bin/env bash
# ============================================================================
# verify.sh — Local pre-push verification (mirrors CI quality job)
# ============================================================================
#
# Usage:
#   npm run verify
#   bash scripts/verify.sh
#
# Runs: lint → typecheck → unit tests → build
# Exits on first failure.
# ============================================================================

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║         Pre-Push Verification                       ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

STEP=0
TOTAL=4

# --- Step 1: Lint ---
STEP=$((STEP + 1))
echo "━━━ [$STEP/$TOTAL] ESLint ━━━"
npm run lint
echo "  ✓ Lint passed"
echo ""

# --- Step 2: Type check ---
STEP=$((STEP + 1))
echo "━━━ [$STEP/$TOTAL] TypeScript ━━━"
npm run typecheck
echo "  ✓ Type check passed"
echo ""

# --- Step 3: Unit tests ---
STEP=$((STEP + 1))
echo "━━━ [$STEP/$TOTAL] Unit Tests ━━━"
npm test
echo "  ✓ Tests passed"
echo ""

# --- Step 4: Build ---
STEP=$((STEP + 1))
echo "━━━ [$STEP/$TOTAL] Production Build ━━━"
VITE_SUPABASE_URL="https://placeholder.supabase.co" \
VITE_SUPABASE_PUBLISHABLE_KEY="placeholder-key" \
npm run build
echo "  ✓ Build passed"
echo ""

echo "╔══════════════════════════════════════════════════════╗"
echo "║  ✓ All checks passed — safe to push                ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
