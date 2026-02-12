#!/usr/bin/env bash
# =============================================================================
# InnoTrue Hub — Supabase Storage Backup Script
# =============================================================================
# Downloads all storage buckets from a Supabase project to a local directory.
# Uses the Supabase CLI's experimental storage commands.
#
# Usage:
#   ./scripts/backup-storage.sh [environment]
#
# Environments:
#   prod      — Production (qfdztdgublwlmewobxmx)   [default]
#   preprod   — Pre-production (jtzcrirqflfnagceendt)
#   sandbox   — Lovable sandbox (cezlnvdjildzxpyxyabb)
#
# Examples:
#   ./scripts/backup-storage.sh              # Backs up production
#   ./scripts/backup-storage.sh prod         # Same as above
#   ./scripts/backup-storage.sh preprod      # Backs up pre-production
#   ./scripts/backup-storage.sh all          # Backs up all environments
#
# Output:
#   backups/storage/<env>-<project-ref>/<date>/<bucket-name>/...
#
# Prerequisites:
#   - Supabase CLI installed (brew install supabase/tap/supabase)
#   - Logged in to Supabase CLI (supabase login)
#   - Run from the repo root directory
# =============================================================================

set -euo pipefail

# --- Configuration ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BACKUP_BASE="$REPO_ROOT/backups/storage"
DATE=$(date +%Y-%m-%d_%H%M%S)

# Project refs
PROD_REF="qfdztdgublwlmewobxmx"
PREPROD_REF="jtzcrirqflfnagceendt"
SANDBOX_REF="cezlnvdjildzxpyxyabb"

# All known buckets (from migrations)
BUCKETS=(
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

# --- Functions ---
log() { echo "[$(date +%H:%M:%S)] $*"; }
warn() { echo "[$(date +%H:%M:%S)] WARNING: $*" >&2; }
error() { echo "[$(date +%H:%M:%S)] ERROR: $*" >&2; }

check_prerequisites() {
  if ! command -v supabase &>/dev/null; then
    error "Supabase CLI not found. Install with: brew install supabase/tap/supabase"
    exit 1
  fi

  # Verify we're in the repo root (has supabase/config.toml)
  if [[ ! -f "$REPO_ROOT/supabase/config.toml" ]]; then
    error "Must run from the repo root (or a subdirectory of it)"
    exit 1
  fi
}

backup_project() {
  local project_ref="$1"
  local env_name="$2"
  local backup_dir="$BACKUP_BASE/${env_name}-${project_ref}/$DATE"

  log "=== Backing up $env_name ($project_ref) ==="
  log "Destination: $backup_dir"

  # Link to this project
  log "Linking to project $project_ref..."
  (cd "$REPO_ROOT" && supabase link --project-ref "$project_ref" 2>&1) || {
    error "Failed to link to project $project_ref"
    return 1
  }

  # Create backup directory
  mkdir -p "$backup_dir"

  local success_count=0
  local skip_count=0
  local fail_count=0

  for bucket in "${BUCKETS[@]}"; do
    local bucket_dir="$backup_dir/$bucket"
    mkdir -p "$bucket_dir"

    log "  Downloading bucket: $bucket..."

    # Try to copy all files from this bucket
    local output
    if output=$(cd "$REPO_ROOT" && supabase storage cp -r "ss:///$bucket/" "$bucket_dir/" --linked --experimental -j 4 2>&1); then
      # Check if anything was actually downloaded
      if [[ -z "$(ls -A "$bucket_dir" 2>/dev/null)" ]]; then
        log "    (empty bucket)"
        rmdir "$bucket_dir" 2>/dev/null || true
        ((skip_count++))
      else
        local file_count
        file_count=$(find "$bucket_dir" -type f | wc -l | tr -d ' ')
        log "    Downloaded $file_count file(s)"
        ((success_count++))
      fi
    else
      # Check if it's just an empty bucket vs actual error
      if echo "$output" | grep -qi "not found\|does not exist"; then
        log "    (bucket does not exist on this project)"
        rmdir "$bucket_dir" 2>/dev/null || true
        ((skip_count++))
      elif echo "$output" | grep -qi "no objects found\|empty"; then
        log "    (empty bucket)"
        rmdir "$bucket_dir" 2>/dev/null || true
        ((skip_count++))
      else
        warn "  Failed to download $bucket: $output"
        rmdir "$bucket_dir" 2>/dev/null || true
        ((fail_count++))
      fi
    fi
  done

  # Write backup metadata
  cat > "$backup_dir/_backup_metadata.json" <<METADATA
{
  "project_ref": "$project_ref",
  "environment": "$env_name",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "buckets_downloaded": $success_count,
  "buckets_empty": $skip_count,
  "buckets_failed": $fail_count,
  "supabase_cli_version": "$(supabase --version 2>&1)"
}
METADATA

  log "=== $env_name backup complete ==="
  log "    Downloaded: $success_count | Empty/skipped: $skip_count | Failed: $fail_count"
  log "    Location: $backup_dir"
  echo ""
}

cleanup_old_backups() {
  local env_dir="$1"
  local keep_count="${2:-5}"

  if [[ ! -d "$env_dir" ]]; then
    return
  fi

  local backup_count
  backup_count=$(ls -1d "$env_dir"/20* 2>/dev/null | wc -l | tr -d ' ')

  if [[ "$backup_count" -gt "$keep_count" ]]; then
    local to_remove=$((backup_count - keep_count))
    log "Cleaning up $to_remove old backup(s) from $env_dir..."
    ls -1d "$env_dir"/20* | head -n "$to_remove" | while read -r dir; do
      log "  Removing: $(basename "$dir")"
      rm -rf "$dir"
    done
  fi
}

# --- Main ---
check_prerequisites

# Save current linked project to restore later
ORIGINAL_REF=""
if [[ -f "$REPO_ROOT/supabase/.temp/project-ref" ]]; then
  ORIGINAL_REF=$(cat "$REPO_ROOT/supabase/.temp/project-ref")
fi

ENV="${1:-prod}"

case "$ENV" in
  prod|production)
    backup_project "$PROD_REF" "prod"
    cleanup_old_backups "$BACKUP_BASE/prod-$PROD_REF"
    ;;
  preprod|pre-production|staging)
    backup_project "$PREPROD_REF" "preprod"
    cleanup_old_backups "$BACKUP_BASE/preprod-$PREPROD_REF"
    ;;
  sandbox|lovable)
    backup_project "$SANDBOX_REF" "sandbox"
    cleanup_old_backups "$BACKUP_BASE/sandbox-$SANDBOX_REF"
    ;;
  all)
    backup_project "$PROD_REF" "prod"
    backup_project "$PREPROD_REF" "preprod"
    backup_project "$SANDBOX_REF" "sandbox"
    cleanup_old_backups "$BACKUP_BASE/prod-$PROD_REF"
    cleanup_old_backups "$BACKUP_BASE/preprod-$PREPROD_REF"
    cleanup_old_backups "$BACKUP_BASE/sandbox-$SANDBOX_REF"
    ;;
  *)
    error "Unknown environment: $ENV"
    echo "Usage: $0 [prod|preprod|sandbox|all]"
    exit 1
    ;;
esac

# Restore original linked project
if [[ -n "$ORIGINAL_REF" ]]; then
  log "Restoring link to original project ($ORIGINAL_REF)..."
  (cd "$REPO_ROOT" && supabase link --project-ref "$ORIGINAL_REF" 2>&1) || true
fi

log "All done."
