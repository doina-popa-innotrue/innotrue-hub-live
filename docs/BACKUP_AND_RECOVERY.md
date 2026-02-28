# Backup and Recovery Guide

## Overview

InnoTrue Hub has **six** data layers that need separate backup strategies:

| Layer | What | Backup method | Recovery time |
|-------|------|---------------|---------------|
| **Code** | Frontend, edge functions, migrations | Git (GitHub) | Minutes |
| **Database** | PostgreSQL data (users, enrollments, etc.) | Supabase PITR | 10-30 min |
| **Storage** | Files in Supabase Storage buckets | `backup-storage.sh` script | Minutes |
| **Secrets** | 34 edge function env vars + 4 frontend vars | Manual export / password manager | Minutes |
| **Hosting config** | Cloudflare Pages settings, custom domain, DNS | Manual documentation | 30-60 min |
| **Third-party config** | Webhook URLs, OAuth apps, DNS records | Manual documentation | 1-2 hours |

> **Cross-reference:** See [ENVIRONMENT_CONFIGURATION.md](./ENVIRONMENT_CONFIGURATION.md) for the full secrets inventory per environment with cross-contamination risk ratings.

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

The app uses 16 storage buckets:

| Bucket | Content | Priority |
|--------|---------|----------|
| `avatars` | User profile photos | Low |
| `program-logos` | Program logos + badge images | Medium |
| `email-assets` | Email template images | Medium |
| `task-note-resources` | Task note attachments | Low |
| `goal-resources` | Goal-related files | Medium |
| `resource-library` | Admin learning resources (PDFs, docs) | **High** |
| `module-client-content` | Module content + inline editor files | **High** |
| `module-content-packages` | Rise/xAPI ZIP content packages (up to 500 MB each) | **Critical** |
| `module-assignment-attachments` | Assignment submissions | **High** |
| `module-reflection-resources` | Reflection uploads | **High** |
| `module-assessment-attachments` | Assessment file uploads | **High** |
| `coach-feedback-attachments` | Coach feedback files | **High** |
| `development-item-files` | Capability development items | **High** |
| `client-badges` | Earned badge images | Medium |
| `group-notes` | Group session notes | Medium |
| `psychometric-assessments` | Psychometric assessment files | Medium |

> **Critical:** `module-content-packages` contains Rise/xAPI learning content served by the `serve-content-package` edge function. These ZIP files are NOT in Git and are the only source of interactive learning content. Loss of this bucket means all Rise content becomes unavailable until re-uploaded.

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

# Deploy all functions (uses npm script)
npm run deploy:functions

# Deploy to a specific environment
npm run deploy:functions -- preprod

# Deploy specific functions only
npm run deploy:functions -- --only xapi-launch,xapi-statements,serve-content-package

# Manual deploy loop (alternative)
for dir in supabase/functions/*/; do
  fname=$(basename "$dir")
  [[ "$fname" == "_shared" ]] && continue
  supabase functions deploy "$fname" --project-ref <ref>
done
```

### xAPI Edge Functions (critical for Rise content)

The xAPI content delivery system uses 3 edge functions that must be deployed together and to all environments:

| Function | Purpose | Impact if missing |
|----------|---------|------------------|
| `serve-content-package` | Auth-gated Rise content proxy | Rise content won't load at all |
| `xapi-launch` | Session creation/resume | xAPI tracking won't start, no resume |
| `xapi-statements` | Statement storage + state persistence | No progress tracking, no auto-completion, no resume data saved |

**Deploy xAPI functions to all environments:**
```bash
# Deploy to production (default — must be linked to prod)
npm run deploy:functions -- --only xapi-launch,xapi-statements,serve-content-package

# Deploy to preprod
npm run deploy:functions -- preprod --only xapi-launch,xapi-statements,serve-content-package
```

### Multi-Environment Deployment

Edge functions must be deployed separately to each Supabase project. Database migrations are pushed via `supabase db push`:

```bash
# Push migrations to all environments
npm run push:migrations -- all

# Push to preprod only
npm run push:migrations -- preprod

# Deploy functions to preprod (link, deploy, link back)
supabase link --project-ref jtzcrirqflfnagceendt
supabase functions deploy xapi-launch
supabase functions deploy xapi-statements
supabase functions deploy serve-content-package
supabase link --project-ref qfdztdgublwlmewobxmx  # link back to prod
```

## 5. Secrets and Environment Variables

### What needs backing up

Edge functions use **28 manually-set secrets** (3 more are auto-injected by Supabase). The full inventory with per-environment values and cross-contamination risk ratings lives in [ENVIRONMENT_CONFIGURATION.md](./ENVIRONMENT_CONFIGURATION.md).

**Complete list of secrets that must be set per environment:**

| Category | Secrets | Where to get replacements |
|----------|---------|---------------------------|
| **Core** | `SITE_URL` | Known value per environment |
| **Email** | `RESEND_API_KEY` | Resend dashboard → API Keys |
| **Payments** | `STRIPE_SECRET_KEY` | Stripe dashboard → API Keys |
| **AI** | `GCP_SERVICE_ACCOUNT_KEY`, `GCP_PROJECT_ID`, `GCP_LOCATION` | Google Cloud Console → IAM → Service Accounts |
| **Calendar** | `CALCOM_API_KEY`, `CALCOM_WEBHOOK_SECRET` | Cal.com dashboard → Settings → API |
| **Calendar** | `GOOGLE_SERVICE_ACCOUNT_JSON`, `GOOGLE_CALENDAR_IMPERSONATE_EMAIL`, `CALENDAR_HMAC_SECRET` | Google Cloud Console + generated |
| **OAuth** | `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET` | Google Cloud Console → Credentials |
| **OAuth** | `MICROSOFT_CLIENT_ID`, `MICROSOFT_CLIENT_SECRET` | Azure Portal → App Registrations |
| **OAuth** | `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET` | Zoom Marketplace → App Dashboard |
| **Security** | `OAUTH_ENCRYPTION_KEY`, `REQUEST_SIGNING_SECRET`, `SEND_EMAIL_HOOK_SECRET` | Generated — **if lost, must regenerate (invalidates existing encrypted tokens)** |
| **LMS** | `TALENTLMS_API_KEY`, `TALENTLMS_DOMAIN`, `TALENTLMS_WEBHOOK_SECRET` | TalentLMS admin panel |
| **Community** | `CIRCLE_API_KEY`, `CIRCLE_COMMUNITY_ID`, `CIRCLE_COMMUNITY_DOMAIN`, `CIRCLE_HEADLESS_AUTH_TOKEN` | Circle admin panel |
| **Staging** | `APP_ENV`, `STAGING_EMAIL_OVERRIDE` | Known values |
| **Demo** | `DEMO_ADMIN_EMAIL`, `DEMO_ADMIN_PASSWORD`, `DEMO_CLIENT_PASSWORD` | seed.sql or known values |

**Frontend vars** (set in Cloudflare Pages build settings, NOT in Supabase):

| Var | Value |
|-----|-------|
| `VITE_SUPABASE_URL` | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key |
| `VITE_APP_ENV` | `production` |
| `VITE_SENTRY_DSN` | Sentry DSN (optional) |

### Backup strategy

**Option A (recommended):** Store all secrets in a password manager (1Password, Bitwarden, etc.) in a vault named "InnoTrue Hub — Production Secrets". Update the vault whenever a secret changes.

**Option B:** Export secrets to an encrypted file:
```bash
# Export current secrets (requires Supabase CLI + project linked)
supabase secrets list --project-ref qfdztdgublwlmewobxmx > secrets-prod-$(date +%Y%m%d).txt
# Encrypt immediately
gpg -c secrets-prod-*.txt && rm secrets-prod-*.txt
```

> **Warning:** `OAUTH_ENCRYPTION_KEY`, `REQUEST_SIGNING_SECRET`, and `SEND_EMAIL_HOOK_SECRET` are generated values. If lost, you must regenerate them — but this invalidates all existing encrypted OAuth tokens (users must re-authorize calendar/meeting integrations) and any in-flight signed requests.

### Recovery

```bash
# Restore secrets from backup
supabase secrets set --env-file secrets-prod.txt --project-ref qfdztdgublwlmewobxmx

# Or set individually
supabase secrets set RESEND_API_KEY=re_xxxx --project-ref qfdztdgublwlmewobxmx
```

## 6. Hosting and DNS Configuration

These settings live **outside Git and Supabase** and must be documented manually.

### Cloudflare Pages

| Setting | Production value |
|---------|-----------------|
| Project name | `innotrue-hub-live` |
| Production branch | `main` |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Node.js version | 18 (or as set in `.node-version`) |
| Environment variables | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_APP_ENV`, `VITE_SENTRY_DSN` |
| Custom domain | `app.innotrue.com` |
| Preview branches | `preprod`, `develop` auto-deploy |

**Recovery:** If the Cloudflare Pages project is deleted, create a new one connected to the same GitHub repo with the settings above. Cloudflare auto-deploys on push.

### DNS Records (domain registrar)

| Type | Name | Value | Purpose |
|------|------|-------|---------|
| CNAME | `app` | Cloudflare Pages URL | Frontend hosting |
| MX/TXT | `mail` | Resend verification records | Transactional email (`mail.innotrue.com`) |
| TXT | `_dmarc` | DMARC policy | Email authentication |

**Recovery:** If DNS records are lost, re-add them from your domain registrar. Resend dashboard shows the required MX/SPF/DKIM records under Domains → `mail.innotrue.com`.

### Supabase Auth Dashboard Settings

These survive PITR but NOT a project recreation:

| Setting | Production value |
|---------|-----------------|
| Email signup | OFF (pilot phase) |
| Confirm email | ON |
| Google provider | OFF (pilot phase) |
| Site URL | `https://app.innotrue.com` |
| Redirect URLs | `https://app.innotrue.com/**` |

## 7. Third-Party Webhook and OAuth Configuration

These settings live in **external service dashboards** — not in Git, not in the database.

| Service | What to configure | Dashboard location |
|---------|-------------------|--------------------|
| **Stripe** | Webhook endpoint URL → `https://qfdztdgublwlmewobxmx.supabase.co/functions/v1/stripe-webhook` | Stripe → Developers → Webhooks |
| **Cal.com** | Webhook URL → `https://qfdztdgublwlmewobxmx.supabase.co/functions/v1/calcom-webhook` | Cal.com → Settings → Webhooks |
| **TalentLMS** | Webhook URL → `https://qfdztdgublwlmewobxmx.supabase.co/functions/v1/talentlms-webhook` | TalentLMS → admin panel |
| **Google OAuth (login)** | Redirect URIs → `https://{PROJECT_REF}.supabase.co/auth/v1/callback` (one per env) | Supabase Dashboard → Auth → Providers → Google + Google Cloud Console → Credentials |
| **Google OAuth (calendar)** | Redirect URI → `https://qfdztdgublwlmewobxmx.supabase.co/functions/v1/oauth-callback` | Google Cloud Console → Credentials |
| **Microsoft OAuth** | Redirect URI → same pattern as Google calendar | Azure Portal → App Registrations |
| **Zoom OAuth** | Redirect URI → same pattern as Google calendar | Zoom Marketplace → App Dashboard |
| **Supabase Auth** | Send Email Hook → `https://qfdztdgublwlmewobxmx.supabase.co/functions/v1/send-auth-email` | Supabase Dashboard → Auth → Hooks |

> **Note:** If the Supabase project ref changes (e.g. after project recreation), ALL webhook URLs and OAuth redirect URIs above must be updated to the new project ref.
>
> **Google OAuth redirect URIs (all must be in Google Cloud Console):**
> - `https://qfdztdgublwlmewobxmx.supabase.co/auth/v1/callback` (prod)
> - `https://jtzcrirqflfnagceendt.supabase.co/auth/v1/callback` (preprod)
> - `https://cezlnvdjildzxpyxyabb.supabase.co/auth/v1/callback` (sandbox)
> - `https://app.innotrue.com/~oauth/callback` (custom calendar/meeting integrations)

## 8. Database Scheduled Jobs (pg_cron)

> **Full reference:** See [CRON_JOBS.md](./CRON_JOBS.md) for monitoring queries, management commands, and detailed job descriptions.

9 cron jobs are defined in migrations and restored by `supabase db push`:

| Job | Schedule (UTC) | Type | What It Does |
|-----|----------------|------|--------------|
| `cohort-session-reminders` | Every 15 min | Direct SQL | 24h + 1h session reminders |
| `monthly-credit-rollover` | 1st of month, midnight | Direct SQL | Monthly credit batch rollover |
| `daily-credit-expiry` | 2:00 AM | Direct SQL | Mark expired credit batches |
| `cleanup-webhook-logs-daily` | 3:00 AM | Direct SQL | Delete webhook logs > 30 days |
| `daily-credit-expiry-notifications` | 3:00 AM | HTTP → Edge Fn | Notify users/orgs of expiring credits |
| `daily-notification-cleanup` | 4:00 AM | HTTP → Edge Fn | Delete old notifications |
| `daily-coach-access-log-cleanup` | 4:15 AM | Direct SQL | Delete coach logs > 90 days |
| `daily-analytics-cleanup` | 4:30 AM | Direct SQL | Delete analytics > 180 days |
| `daily-enforce-enrollment-deadlines` | 5:00 AM | HTTP → Edge Fn | Warn/auto-complete expiring enrollments |

**Recovery after PITR or project recreation:**
- Normal path: `supabase db push` replays all migrations including cron job creation
- If migrations are already applied but cron jobs are missing: run `supabase/migrations/20260228120000_restore_all_cron_jobs.sql` directly in the SQL editor (it's idempotent — safe to run multiple times)

**Quick health check:**
```sql
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
-- Expected: 9 rows, all active = true
```

HTTP-based jobs use `current_setting('app.settings.supabase_url')` which Supabase auto-populates, so after a project recreation the URLs automatically point to the new project.

## 9. Emergency Recovery Playbook

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
5. Edge functions do NOT need redeployment (PITR only touches the database)

### Scenario: Storage files accidentally deleted

1. Check if a recent backup exists in `backups/storage/`
2. Restore using `supabase storage cp -r` (see Recovery section above)
3. If no backup exists, files are lost — Supabase Storage has no built-in recovery

### Scenario: Need to roll back everything (code + data)

> **Key concern:** Code, database, and edge functions must be compatible. A migration that adds a column referenced by new code will break if the DB is rolled back but the code isn't (or vice versa).

**Coordinated rollback procedure:**

1. **Identify the target timestamp** — find the last known-good moment (before the bad deploy)
2. **Code:** `git revert` all commits after that timestamp, push to `main`
3. **Database:** PITR to the same timestamp
4. **Storage:** Restore from the most recent backup before that timestamp
5. **Edge functions:** Redeploy from the reverted git commit (`npm run deploy:functions`)
6. **Verify:** Test critical flows (login, enrollment, content access, payments)

**Why this order matters:**
- PITR restores the entire database including schema. If code expects a column that PITR removed, the app breaks.
- Always revert code first (Cloudflare deploys in ~2 min), then restore the database.
- Edge functions must match the code version — they share types and database expectations.

### Scenario: Full rebuild from scratch (Supabase project lost)

If the Supabase project must be recreated from scratch:

1. **Create new Supabase project** (Pro plan, same region)
2. **Push schema:** `supabase link --project-ref <new-ref> && supabase db push`
3. **Run seed data:** `psql <new-db-url> < supabase/seed.sql` (or use Supabase SQL editor)
4. **Restore secrets:** Set all 28 env vars from password manager (see Section 5)
5. **Deploy edge functions:** `npm run deploy:functions`
6. **Verify cron jobs:** `SELECT jobname, active FROM cron.job ORDER BY jobname;` — expect 9 rows. If missing, run `20260228120000_restore_all_cron_jobs.sql` via SQL editor.
7. **Restore storage:** Upload from backup (`supabase storage cp -r ...`)
8. **Update hosting:**
   - Cloudflare Pages: update `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`
   - Update `SITE_URL` edge function secret
9. **Update webhooks:** Re-register all webhook URLs with new project ref (see Section 7)
10. **Update OAuth:** Re-register redirect URIs with new project ref (see Section 7)
11. **Update Auth settings:** Configure email provider, Google provider (see Section 6)
12. **Verify:** Test all critical flows + integrations
13. **Data:** User data, enrollments, etc. are lost unless you have a database dump. PITR only works within the same project.

> **Note:** This scenario means all user data is lost (PITR cannot restore to a different project). The only protection is a separate database dump. Consider periodic `pg_dump` exports for catastrophic scenarios beyond the 7-day PITR window.

## 10. Environment Reference

| Environment | Project Ref | Branch | Frontend |
|-------------|-------------|--------|----------|
| Production | `qfdztdgublwlmewobxmx` | `main` | `app.innotrue.com` |
| Pre-production | `jtzcrirqflfnagceendt` | `preprod` | Cloudflare preview |
| Sandbox | `cezlnvdjildzxpyxyabb` | Lovable | Lovable preview |

## 11. Backup Schedule Summary

| What | Frequency | Method | Owner |
|------|-----------|--------|-------|
| Code | Continuous | Git push (automatic) | Developer |
| Database | Continuous | Supabase PITR (automatic, 7-day window) | Supabase |
| Storage buckets | Weekly (or after significant uploads) | `./scripts/backup-storage.sh` | Developer |
| Secrets | On every change | Update password manager vault | Developer |
| Cloudflare settings | On every change | Screenshot or document | Developer |
| Webhook URLs | On every change | Document in this file | Developer |
| Database dump (catastrophic) | Monthly (recommended) | `pg_dump` to encrypted file | Developer |

### Recommended: Monthly database dump

For protection beyond the 7-day PITR window:

```bash
# Get the database URL from Supabase Dashboard → Settings → Database → Connection String
pg_dump "postgresql://postgres:[password]@db.qfdztdgublwlmewobxmx.supabase.co:5432/postgres" \
  --format=custom \
  --file="backups/db/prod-$(date +%Y%m%d).dump"

# Encrypt
gpg -c "backups/db/prod-$(date +%Y%m%d).dump"
```

This provides a safety net for scenarios where the Supabase project is lost or PITR's 7-day window has passed.
