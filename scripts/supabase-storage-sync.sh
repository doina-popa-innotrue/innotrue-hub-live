#!/usr/bin/env bash
# ============================================================================
# supabase-storage-sync.sh — Copy storage buckets between Supabase environments
# ============================================================================
#
# Usage:
#   npm run sync:storage -- --from prod --to preprod           # All buckets
#   npm run sync:storage -- --from prod --to preprod --buckets avatars program-logos
#   npm run sync:storage -- --from prod --to sandbox           # Prod → sandbox
#   npm run sync:storage -- --dry-run --from prod --to preprod # Show what would sync
#
# What it does:
#   1. Downloads all files from source buckets to a temp directory
#   2. Uploads them to the target environment
#   3. Reports files synced per bucket
#
# Prerequisites:
#   - Supabase CLI installed + logged in
#   - Storage experimental commands available (supabase storage cp)
#
# Notes:
#   - This copies FILES only (not bucket policies or settings)
#   - Existing files in target are overwritten (idempotent)
#   - Empty buckets are skipped
#   - Uses temp directory, cleaned up after sync
# ============================================================================

set -uo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

# ---- Configuration ----
PROD_REF="qfdztdgublwlmewobxmx"
PREPROD_REF="jtzcrirqflfnagceendt"
SANDBOX_REF="cezlnvdjildzxpyxyabb"

# All known buckets
ALL_BUCKETS=(
  avatars
  program-logos
  email-assets
  task-note-resources
  goal-resources
  resource-library
  module-client-content
  module-assignment-attachments
  module-reflection-resources
  module-assessment-attachments
  coach-feedback-attachments
  development-item-files
  client-badges
  group-notes
  psychometric-assessments
)

# ---- Parse arguments ----
FROM_ENV=""
TO_ENV=""
DRY_RUN=false
SELECTED_BUCKETS=()

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
    --buckets)
      shift
      while [[ $# -gt 0 && ! "$1" =~ ^-- ]]; do
        SELECTED_BUCKETS+=("$1")
        shift
      done
      ;;
    *)
      echo "Unknown option: $1"
      echo "Usage: $0 --from <env> --to <env> [--dry-run] [--buckets b1 b2 ...]"
      exit 1
      ;;
  esac
done

# Validate required args
if [ -z "$FROM_ENV" ] || [ -z "$TO_ENV" ]; then
  echo "Error: Both --from and --to are required."
  echo "Usage: $0 --from <env> --to <env> [--dry-run] [--buckets b1 b2 ...]"
  exit 1
fi

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
TO_REF=$(resolve_ref "$TO_ENV")

if [ -z "$FROM_REF" ]; then
  echo "Error: Unknown source environment: $FROM_ENV"
  exit 1
fi
if [ -z "$TO_REF" ]; then
  echo "Error: Unknown target environment: $TO_ENV"
  exit 1
fi
if [ "$FROM_REF" = "$TO_REF" ]; then
  echo "Error: Source and target are the same environment."
  exit 1
fi

# Determine which buckets to sync
if [ ${#SELECTED_BUCKETS[@]} -gt 0 ]; then
  SYNC_BUCKETS=("${SELECTED_BUCKETS[@]}")
else
  SYNC_BUCKETS=("${ALL_BUCKETS[@]}")
fi

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║          Supabase Storage Sync                      ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
echo "  Source  : $FROM_ENV ($FROM_REF)"
echo "  Target  : $TO_ENV ($TO_REF)"
echo "  Buckets : ${#SYNC_BUCKETS[@]}"
if [ "$DRY_RUN" = true ]; then
  echo "  Mode    : DRY RUN"
fi
echo ""

# ---- Dry run ----
if [ "$DRY_RUN" = true ]; then
  echo "  Would sync these buckets:"
  for B in "${SYNC_BUCKETS[@]}"; do
    echo "    - $B"
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

# ---- Save original project link ----
ORIGINAL_REF=""
if [[ -f "$REPO_ROOT/supabase/.temp/project-ref" ]]; then
  ORIGINAL_REF=$(cat "$REPO_ROOT/supabase/.temp/project-ref")
fi

# ---- Create temp directory ----
TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

# ---- Download from source ----
echo "━━━ Downloading from $FROM_ENV ━━━"
echo ""

echo "  Linking to source ($FROM_ENV)..."
supabase link --project-ref "$FROM_REF" 2>&1 | sed 's/^/    /'
echo ""

DOWNLOADED_BUCKETS=()
EMPTY_COUNT=0
FAIL_COUNT=0

for BUCKET in "${SYNC_BUCKETS[@]}"; do
  BUCKET_DIR="$TEMP_DIR/$BUCKET"
  mkdir -p "$BUCKET_DIR"

  printf "  Downloading %-35s" "$BUCKET..."

  if OUTPUT=$(supabase storage cp -r "ss:///$BUCKET/" "$BUCKET_DIR/" --linked --experimental -j 4 2>&1); then
    if [[ -z "$(ls -A "$BUCKET_DIR" 2>/dev/null)" ]]; then
      echo "(empty)"
      rmdir "$BUCKET_DIR" 2>/dev/null || true
      EMPTY_COUNT=$((EMPTY_COUNT + 1))
    else
      FILE_COUNT=$(find "$BUCKET_DIR" -type f | wc -l | tr -d ' ')
      echo "$FILE_COUNT files"
      DOWNLOADED_BUCKETS+=("$BUCKET")
    fi
  else
    if echo "$OUTPUT" | grep -qi "not found\|does not exist\|no objects found\|empty"; then
      echo "(empty/not found)"
      rmdir "$BUCKET_DIR" 2>/dev/null || true
      EMPTY_COUNT=$((EMPTY_COUNT + 1))
    else
      echo "FAILED"
      echo "$OUTPUT" | head -2 | sed 's/^/      /'
      rmdir "$BUCKET_DIR" 2>/dev/null || true
      FAIL_COUNT=$((FAIL_COUNT + 1))
    fi
  fi
done

echo ""

if [ ${#DOWNLOADED_BUCKETS[@]} -eq 0 ]; then
  echo "  No files to sync (all buckets empty or failed)."
  # Restore link
  if [[ -n "$ORIGINAL_REF" ]]; then
    supabase link --project-ref "$ORIGINAL_REF" 2>&1 > /dev/null || true
  fi
  exit 0
fi

# ---- Upload to target ----
echo "━━━ Uploading to $TO_ENV ━━━"
echo ""

echo "  Linking to target ($TO_ENV)..."
supabase link --project-ref "$TO_REF" 2>&1 | sed 's/^/    /'
echo ""

UPLOAD_SUCCESS=0
UPLOAD_FAIL=0

for BUCKET in "${DOWNLOADED_BUCKETS[@]}"; do
  BUCKET_DIR="$TEMP_DIR/$BUCKET"
  FILE_COUNT=$(find "$BUCKET_DIR" -type f | wc -l | tr -d ' ')

  printf "  Uploading  %-35s" "$BUCKET ($FILE_COUNT files)..."

  if OUTPUT=$(supabase storage cp -r "$BUCKET_DIR/" "ss:///$BUCKET/" --linked --experimental -j 4 2>&1); then
    echo "✓"
    UPLOAD_SUCCESS=$((UPLOAD_SUCCESS + 1))
  else
    echo "✗"
    echo "$OUTPUT" | head -2 | sed 's/^/      /'
    UPLOAD_FAIL=$((UPLOAD_FAIL + 1))
  fi
done

echo ""

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
printf "║  Source          : %-33s ║\n" "$FROM_ENV"
printf "║  Target          : %-33s ║\n" "$TO_ENV"
printf "║  Buckets synced  : %-3d                              ║\n" "$UPLOAD_SUCCESS"
printf "║  Buckets empty   : %-3d                              ║\n" "$EMPTY_COUNT"
printf "║  Buckets failed  : %-3d                              ║\n" "$((FAIL_COUNT + UPLOAD_FAIL))"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
