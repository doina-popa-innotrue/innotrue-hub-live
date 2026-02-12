# Backup and Recovery Guide

## Overview

InnoTrue Hub has three data layers that need separate backup strategies:

| Layer | What | Backup method | Recovery time |
|-------|------|---------------|---------------|
| **Code** | Frontend, edge functions, migrations | Git (GitHub) | Minutes |
| **Database** | PostgreSQL data (users, enrollments, etc.) | Supabase PITR | 10-30 min |
| **Storage** | Files in Supabase Storage buckets | `backup-storage.sh` script | Minutes |

## 1. Code (Git)

### Backup

Code is automatically backed up via Git. Every push goes to GitHub (`doina-popa-innotrue/innotrue-hub-live`). Three clones exist:

- GitHub remote (primary)
- Local working copy (`Work_GDrive/innotrue-hub-live`)
- Lovable sandbox remote (synced from main)

### Recovery

**Revert a bad commit:**
```bash
git revert <commit-hash>
git push origin <branch>
# Cloudflare auto-redeploys within ~2 minutes
```

**Restore a deleted branch:**
```bash
# Find the commit hash from reflog (available for ~90 days locally)
git reflog
git checkout -b <branch-name> <commit-hash>
```

### Branch Protection

The following rules are configured on GitHub:

| Branch | Force push | Delete | CI required |
|--------|-----------|--------|-------------|
| `main` | Blocked | Blocked | Yes (`quality` job) |
| `preprod` | Blocked | Blocked | No |
| `develop` | Allowed | Allowed | No |

## 2. Database (Supabase PITR)

### Backup

Supabase Pro plan includes:

- **Daily automated backups** — retained for 7 days
- **Point-in-Time Recovery (PITR)** — restore to any second within the last 7 days

No action needed — backups are automatic.

### Recovery

1. Go to **Supabase Dashboard** → **Project Settings** → **Database** → **Backups**
2. Choose **Point in Time** tab
3. Select the exact timestamp to restore to
4. Click **Restore** — this replaces the entire database

**Important:** PITR restores the entire database. You cannot selectively restore individual tables.

### What PITR Does NOT Cover

- Storage bucket files (use `backup-storage.sh`)
- Edge function code (stored in Git)
- Dashboard configuration (Auth settings, OAuth config)
- Supabase secrets/env vars

## 3. Storage Buckets

### Buckets

The app uses 15 storage buckets:

| Bucket | Content | Priority |
|--------|---------|----------|
| `avatars` | User profile photos | Low |
| `program-logos` | Program logos + badge images | Medium |
| `email-assets` | Email template images | Medium |
| `task-note-resources` | Task note attachments | Low |
| `goal-resources` | Goal-related files | Medium |
| `resource-library` | Admin learning resources (PDFs, docs) | **High** |
| `module-client-content` | Module content + inline editor files | **High** |
| `module-assignment-attachments` | Assignment submissions | **High** |
| `module-reflection-resources` | Reflection uploads | **High** |
| `module-assessment-attachments` | Assessment file uploads | **High** |
| `coach-feedback-attachments` | Coach feedback files | **High** |
| `development-item-files` | Capability development items | **High** |
| `client-badges` | Earned badge images | Medium |
| `group-notes` | Group session notes | Medium |
| `psychometric-assessments` | Psychometric assessment files | Medium |

### Backup

Use the `backup-storage.sh` script:

```bash
# Back up production (default)
./scripts/backup-storage.sh

# Back up pre-production
./scripts/backup-storage.sh preprod

# Back up Lovable sandbox
./scripts/backup-storage.sh sandbox

# Back up all three environments
./scripts/backup-storage.sh all
```

**Output location:**
```
backups/storage/<env>-<project-ref>/<date>/
  _backup_metadata.json
  avatars/
  program-logos/
  resource-library/
  ...
```

The script:
- Downloads all 15 buckets recursively
- Skips empty buckets
- Writes a `_backup_metadata.json` with timestamp and stats
- Auto-cleans backups older than the 5 most recent
- Restores the original linked project ref when done

**Recommended schedule:**
- **Pilot phase:** Run manually after significant data changes
- **Production:** Weekly (consider automating with cron)

### Prerequisites

1. **Supabase CLI** installed:
   ```bash
   brew install supabase/tap/supabase
   ```

2. **Logged in** to Supabase CLI:
   ```bash
   supabase login
   ```

3. Run from the **repo root** directory

### Recovery

To restore files from a backup to a Supabase project:

```bash
# 1. Link to the target project
supabase link --project-ref <project-ref>

# 2. Upload files back to a bucket
supabase storage cp -r backups/storage/<env>/<date>/<bucket>/ ss:///<bucket>/ --linked --experimental -j 4
```

**Example — restore resource-library to prod:**
```bash
supabase link --project-ref qfdztdgublwlmewobxmx
supabase storage cp -r backups/storage/prod-qfdztdgublwlmewobxmx/2026-02-12_153000/resource-library/ ss:///resource-library/ --linked --experimental -j 4
```

**Note:** This overwrites existing files with the same name. It does NOT delete files that exist in the bucket but not in the backup.

## 4. Edge Functions

Edge functions are stored in Git (`supabase/functions/`). To redeploy after recovery:

```bash
# Deploy a single function
supabase functions deploy <function-name> --project-ref <ref>

# Deploy all functions
for dir in supabase/functions/*/; do
  fname=$(basename "$dir")
  [[ "$fname" == "_shared" ]] && continue
  supabase functions deploy "$fname" --project-ref <ref>
done
```

## 5. Emergency Recovery Playbook

### Scenario: Bad code deployed to production

1. `git revert <commit>` on the `main` branch
2. `git push origin main`
3. Cloudflare auto-redeploys (~2 min)
4. If edge functions were affected: redeploy from git

### Scenario: Database corruption or accidental data deletion

1. Go to Supabase Dashboard → Backups → Point in Time
2. Select a timestamp before the incident
3. Restore (takes 10-30 min depending on database size)
4. Verify the app works after restore

### Scenario: Storage files accidentally deleted

1. Check if a recent backup exists in `backups/storage/`
2. Restore using `supabase storage cp -r` (see Recovery section above)
3. If no backup exists, files are lost — Supabase Storage has no built-in recovery

### Scenario: Need to roll back everything

1. **Code:** `git revert` to the last known good commit, push
2. **Database:** PITR to the last known good timestamp
3. **Storage:** Restore from most recent backup
4. **Edge functions:** Redeploy from the reverted git commit

## 6. Environment Reference

| Environment | Project Ref | Branch | Frontend |
|-------------|-------------|--------|----------|
| Production | `qfdztdgublwlmewobxmx` | `main` | `app.innotrue.com` |
| Pre-production | `jtzcrirqflfnagceendt` | `preprod` | Cloudflare preview |
| Sandbox | `cezlnvdjildzxpyxyabb` | Lovable | Lovable preview |
