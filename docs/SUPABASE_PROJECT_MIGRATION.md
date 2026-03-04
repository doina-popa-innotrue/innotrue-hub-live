# Supabase Project Migration — London → Frankfurt

> **Status:** Planning
> **Reason:** Production project (`qfdztdgublwlmewobxmx`) is on London cluster; need Frankfurt (eu-central-1) for GDPR data residency
> **Estimated effort:** 1-2 days prep + 30-60 min downtime window
> **Created:** 2026-03-30

---

## Table of Contents

1. [Impact Summary](#1-impact-summary)
2. [Current Project Refs](#2-current-project-refs)
3. [Edge Function Secrets](#3-edge-function-secrets-28-manual--3-auto-injected)
4. [External Webhook URLs](#4-external-webhook-urls)
5. [OAuth Redirect URIs](#5-oauth-redirect-uris)
6. [Storage Strategy](#6-storage-strategy)
7. [Cron Jobs](#7-cron-jobs-9-total)
8. [Cloudflare Pages Environment Variables](#8-cloudflare-pages-environment-variables)
9. [Supabase Auth Configuration](#9-supabase-auth-configuration)
10. [Detailed Migration Plan](#10-detailed-migration-plan)
11. [Rollback Plan](#11-rollback-plan)

---

## 1. Impact Summary

| Category | Items | Effort |
|----------|-------|--------|
| **Code changes** | 5 scripts with hardcoded project ref, 1 test file | 15 min |
| **Supabase Dashboard** | 28 edge function secrets, auth providers, email hook | 30-45 min |
| **External services** | Stripe, Cal.com, TalentLMS webhooks; Google/Microsoft/Zoom OAuth redirect URIs | 30-45 min |
| **Cloudflare Pages** | 2 env vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`) | 5 min |
| **Database migration** | pg_dump/restore of production DB including `auth` schema | 30-60 min |
| **Storage** | Re-upload admin content (xAPI, resources); migrate user-generated files | 1-2 hours |
| **Testing** | Auth flows, payments, webhooks, email, content delivery | 1-2 hours |

### Three Risk Areas

1. **Auth users** — `auth.users` can't be recreated via migrations. Must pg_dump/pg_restore the auth schema with `encrypted_password` intact, or users will need password resets.
2. **User-generated storage** — Assignment submissions, reflections, avatars, etc. are referenced by DB paths and cannot be re-created. Must be exported/imported with matching paths.
3. **Downtime window** — DNS/URL cutover must be atomic. Plan 30-60 minutes.

### What Makes It Manageable

- Schema fully captured in 481 migrations → `npm run push:migrations` recreates entire DB
- Edge functions deploy in one command → `npm run deploy:functions` handles all 80
- Cron jobs auto-create from migrations → `20260228120000_restore_all_cron_jobs.sql`
- Storage backup script exists → `npm run backup:storage`
- Cron jobs use `current_setting('app.settings.supabase_url')` → auto-detect new project URL
- Admin content (xAPI packages, resources) can be re-uploaded manually — no export/import needed

---

## 2. Current Project Refs

| Environment | Project Ref | Purpose |
|---|---|---|
| **Production** | `qfdztdgublwlmewobxmx` | Live platform (`app.innotrue.com`) |
| **Pre-production** | `jtzcrirqflfnagceendt` | Staging (Cloudflare preview) |
| **Sandbox** | `cezlnvdjildzxpyxyabb` | Lovable visual editor |

**Hardcoded in scripts (must update with new prod ref):**
- `scripts/supabase-push.sh` (lines 32-34)
- `scripts/supabase-deploy.sh` (lines 31-33)
- `scripts/backup-storage.sh` (lines 15-17)
- `scripts/supabase-data-sync.sh`
- `scripts/supabase-storage-sync.sh`
- `supabase/functions/_shared/__tests__/cors.test.ts` (test URLs)

---

## 3. Edge Function Secrets (28 manual + 3 auto-injected)

All must be manually set in the new project's Dashboard → Edge Function Secrets.

### Core Infrastructure
| Secret | Value Source | Notes |
|--------|-------------|-------|
| `SITE_URL` | `https://app.innotrue.com` | **CRITICAL** — falls back to prod URL if unset |
| `APP_ENV` | `production` | Set on preprod/sandbox only for email override |

### Email (Resend) — used by 13+ functions
| Secret | Notes |
|--------|-------|
| `RESEND_API_KEY` | Same key works across environments |
| `STAGING_EMAIL_OVERRIDE` | Preprod/sandbox only — prevents real emails |

### Payments (Stripe)
| Secret | Notes |
|--------|-------|
| `STRIPE_SECRET_KEY` | Must be `sk_live_*` in prod |
| `STRIPE_WEBHOOK_SECRET` | **New secret generated per webhook endpoint** — must reconfigure in Stripe first |

### AI (Vertex AI / Google Cloud)
| Secret | Notes |
|--------|-------|
| `GCP_SERVICE_ACCOUNT_KEY` | Service account JSON |
| `GCP_PROJECT_ID` | Google Cloud project ID |
| `GCP_LOCATION` | `europe-west3` |

### Calendar (Cal.com)
| Secret | Notes |
|--------|-------|
| `CALCOM_API_KEY` | Live key |
| `CALCOM_WEBHOOK_SECRET` | Webhook secret |

### Calendar (Google)
| Secret | Notes |
|--------|-------|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service account for calendar impersonation |
| `GOOGLE_CALENDAR_IMPERSONATE_EMAIL` | Email to impersonate |
| `CALENDAR_HMAC_SECRET` | HMAC secret for signing |

### OAuth Providers
| Secret | Notes |
|--------|-------|
| `GOOGLE_OAUTH_CLIENT_ID` | Same credentials, new redirect URIs |
| `GOOGLE_OAUTH_CLIENT_SECRET` | |
| `MICROSOFT_CLIENT_ID` | |
| `MICROSOFT_CLIENT_SECRET` | |
| `ZOOM_CLIENT_ID` | |
| `ZOOM_CLIENT_SECRET` | |

### Security (Encryption & Signing)
| Secret | Notes |
|--------|-------|
| `OAUTH_ENCRYPTION_KEY` | 32-byte hex — **MUST copy exactly; if lost, existing encrypted OAuth tokens are invalidated** |
| `REQUEST_SIGNING_SECRET` | Unique per environment |
| `SEND_EMAIL_HOOK_SECRET` | For Supabase auth email hook |

### LMS (TalentLMS)
| Secret | Notes |
|--------|-------|
| `TALENTLMS_API_KEY` | Live key |
| `TALENTLMS_DOMAIN` | LMS domain |
| `TALENTLMS_WEBHOOK_SECRET` | Webhook secret |

### Community (Circle)
| Secret | Notes |
|--------|-------|
| `CIRCLE_API_KEY` | Live key |
| `CIRCLE_COMMUNITY_ID` | Community ID |
| `CIRCLE_COMMUNITY_DOMAIN` | Domain |
| `CIRCLE_HEADLESS_AUTH_TOKEN` | Auth token |

### Demo/Testing
| Secret | Notes |
|--------|-------|
| `DEMO_ADMIN_EMAIL` | For seeding |
| `DEMO_ADMIN_PASSWORD` | For seeding |
| `DEMO_CLIENT_PASSWORD` | For seeding |

---

## 4. External Webhook URLs

All currently point to `https://qfdztdgublwlmewobxmx.supabase.co/functions/v1/...`

| Service | Webhook URL Path | Where to Update |
|---|---|---|
| **Stripe** | `/functions/v1/stripe-webhook` | Stripe Dashboard → Developers → Webhooks |
| **Cal.com** | `/functions/v1/calcom-webhook` | Cal.com → Settings → Webhooks |
| **TalentLMS** | `/functions/v1/talentlms-webhook` | TalentLMS → Admin Panel |
| **Supabase Auth** | `/functions/v1/send-auth-email` | Supabase Dashboard → Auth → Hooks |

**Stripe webhook events (5):** `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`

**⚠️ Stripe note:** When you create a new webhook endpoint in Stripe, it generates a new `STRIPE_WEBHOOK_SECRET`. You must copy this new secret to the edge function secrets on the new project. The old webhook endpoint on the old project should be disabled (not deleted) until decommission.

---

## 5. OAuth Redirect URIs

| Provider | Current Redirect URI | Where to Update |
|---|---|---|
| **Google (Auth)** | `https://qfdztdgublwlmewobxmx.supabase.co/auth/v1/callback` | Google Cloud Console → APIs & Services → Credentials |
| **Google (Calendar OAuth)** | `https://qfdztdgublwlmewobxmx.supabase.co/functions/v1/oauth-callback` | Google Cloud Console |
| **Microsoft** | `https://qfdztdgublwlmewobxmx.supabase.co/functions/v1/oauth-callback` | Azure Portal → App Registrations |
| **Zoom** | `https://qfdztdgublwlmewobxmx.supabase.co/functions/v1/oauth-callback` | Zoom Marketplace → App Dashboard |

Frontend redirect URI (`https://app.innotrue.com/~oauth/callback`) stays the same — no change needed.

**Tip:** Add the NEW redirect URIs to each provider BEFORE cutover (most OAuth providers allow multiple redirect URIs). This way the new project works immediately. Remove the old URIs after decommission.

---

## 6. Storage Strategy

### Re-upload manually (admin content — no export needed)

These are admin-uploaded files that you already have locally or can re-upload through the admin UI:

| Bucket | Content | Why re-upload is fine |
|--------|---------|----------------------|
| `module-content-packages` | Rise/xAPI ZIP files | You have the original ZIPs; re-upload via admin UI. DB path in `program_modules.content_package_path` will be set by the upload flow. |
| `resource-library` | Admin learning resources | Re-upload via admin Resources page. DB path in `resource_library.file_path` set by upload flow. |
| `program-logos` | Program/badge images | Re-upload via admin Program editor |

**⚠️ Important:** When re-uploading xAPI packages and resources, the upload flow in the admin UI will write the correct `file_path`/`content_package_path` to the DB. If you instead manually upload files to the bucket (e.g., via Supabase Dashboard or CLI), you must ensure the paths match what the DB expects OR the DB records will need to be updated/recreated.

### Must migrate (user-generated content — referenced by DB paths)

These files were uploaded by users/clients/coaches and are tied to specific DB records via `file_path`, `file_url`, or `avatar_url` columns. They CANNOT be re-created — they must be exported from the old project and imported to the new one at the **exact same paths**.

| Bucket | DB Reference Column | Content |
|--------|---------------------|---------|
| `avatars` | `profiles.avatar_url` | User profile photos |
| `module-assignment-attachments` | `module_assignments.file_path` | Student assignment submissions |
| `module-reflection-resources` | `module_reflections.file_path` (or related) | Student reflection uploads |
| `module-assessment-attachments` | Assessment-related `file_path` columns | Assessment file uploads |
| `module-client-content` | Various `file_path`/`file_url` columns | Inline editor uploads, personalized content |
| `coach-feedback-attachments` | Feedback-related `file_path` columns | Coach feedback files |
| `development-item-files` | `development_items.file_path` | Dev item attachments |
| `goal-resources` | Goal-related `file_path` columns | Goal file attachments |
| `group-notes` | Group note `file_path` columns | Group session notes |
| `task-note-resources` | Task note `file_path` columns | Task attachments |
| `psychometric-assessments` | Assessment `file_path` columns | Psychometric documents |
| `client-badges` | Badge image paths | Earned badge images |
| `email-assets` | Email template `src` URLs | Email template images (no local copies to re-upload) |

**Migration approach for user-generated content:**

```bash
# 1. Export from old project (uses existing backup script)
npm run backup:storage

# 2. Upload to new project (bucket by bucket)
# For each bucket, use supabase CLI or a script:
npx supabase storage cp -r ./backup/avatars/ sb://<NEW_REF>/avatars/ --project-ref <NEW_REF>
# ... repeat for each user-generated bucket
```

Alternatively, write a migration script that:
1. Lists all objects in each bucket on the old project
2. Downloads each file
3. Uploads to the same path on the new project

The existing `scripts/supabase-storage-sync.sh` already does something similar between environments — it can be adapted.

---

## 7. Cron Jobs (9 total)

Auto-created by migration `20260228120000_restore_all_cron_jobs.sql`.

| Job | Schedule | Type | Notes |
|---|---|---|---|
| `monthly-credit-rollover` | 1st of month, midnight | SQL | Direct |
| `daily-credit-expiry` | 2:00 AM | SQL | Direct |
| `cleanup-webhook-logs-daily` | 3:00 AM | SQL | Direct |
| `daily-credit-expiry-notifications` | 3:00 AM | HTTP → edge fn | Uses `current_setting()` for URL |
| `daily-notification-cleanup` | 4:00 AM | HTTP → edge fn | Uses `current_setting()` for URL |
| `daily-coach-access-log-cleanup` | 4:15 AM | SQL | Direct |
| `daily-analytics-cleanup` | 4:30 AM | SQL | Direct |
| `daily-enforce-enrollment-deadlines` | 5:00 AM | HTTP → edge fn | Uses `current_setting()` for URL |
| `cohort-session-reminders` | Every 15 min | SQL | Direct |

HTTP-based cron jobs automatically route to the correct project via `current_setting('app.settings.supabase_url')`.

**Verification after migration:**
```sql
-- Check all 9 jobs exist
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;

-- Check recent runs (wait 24h after migration)
SELECT jobname, status, start_time FROM cron.job_run_details ORDER BY start_time DESC LIMIT 20;
```

---

## 8. Cloudflare Pages Environment Variables

| Variable | Current Value | New Value |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://qfdztdgublwlmewobxmx.supabase.co` | `https://<NEW_REF>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Current prod anon key | New project's anon key |
| `VITE_APP_ENV` | `production` | `production` (unchanged) |
| `VITE_SENTRY_DSN` | Sentry DSN | Unchanged |

**After updating:** Trigger a rebuild by pushing to `main` or using the Cloudflare dashboard "Retry deployment" button.

---

## 9. Supabase Auth Configuration

Must configure in **new project Dashboard → Auth**:

- [ ] **Email provider:** Enable email/password signup
- [ ] **Google OAuth provider:** Client ID + secret + redirect URI
- [ ] **Auth email hook:** Point to `send-auth-email` edge function URL on new project
- [ ] **Email templates:** Custom templates if any were modified in Dashboard (check old project)
- [ ] **URL Configuration:**
  - Site URL: `https://app.innotrue.com`
  - Redirect URLs: `https://app.innotrue.com`, `https://*.innotrue-hub-live.pages.dev`
- [ ] **Minimum password length:** Match old project setting (check Settings → Auth → Security)
- [ ] **Enable signup:** Match old project setting

---

## 10. Detailed Migration Plan

### Day 1: Preparation (no downtime, no user impact)

#### Step 1.1 — Create new Supabase project (~5 min)

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard)
2. Create new project:
   - **Organization:** Same org as current project
   - **Name:** `innotrue-hub-prod` (or similar)
   - **Database password:** Generate strong password, save securely
   - **Region:** Frankfurt (eu-central-1)
   - **Plan:** Pro
3. Record credentials:

```
New project ref:          _________________________
New anon key:             _________________________
New service role key:     _________________________
New DB connection string: _________________________
New DB password:          _________________________
```

#### Step 1.2 — Update code with new project ref (~15 min)

On `develop` branch:

```bash
# Update all 5 scripts — replace qfdztdgublwlmewobxmx with new ref
# scripts/supabase-push.sh
# scripts/supabase-deploy.sh
# scripts/backup-storage.sh
# scripts/supabase-data-sync.sh
# scripts/supabase-storage-sync.sh

# Update test file
# supabase/functions/_shared/__tests__/cors.test.ts — update prod URL in test cases
```

Do NOT commit yet — wait until cutover is complete.

#### Step 1.3 — Deploy schema and functions (~30 min)

```bash
# Link CLI to new project
npx supabase link --project-ref <NEW_REF>

# Push all 481 migrations
npx supabase db push

# Verify migration count
npx supabase migration list --linked | wc -l
# Should show 481

# Deploy all 80 edge functions
npm run deploy:functions
# (script must be temporarily pointed at new ref, or use --project-ref flag)

# Verify functions deployed
# Check Supabase Dashboard → Edge Functions — should show 80 functions
```

#### Step 1.4 — Configure auth (~10 min)

In new project's Supabase Dashboard → Auth:

1. **URL Configuration:**
   - Site URL: `https://app.innotrue.com`
   - Redirect URLs: Add `https://app.innotrue.com` and `https://*.innotrue-hub-live.pages.dev`

2. **Providers:**
   - Enable Email (should be enabled by default)
   - Enable Google OAuth: paste Client ID + Secret from Google Cloud Console
     - **Do NOT update Google's redirect URIs yet** — just configure Supabase side

3. **Email Hook:**
   - Hook URL: `https://<NEW_REF>.supabase.co/functions/v1/send-auth-email`
   - HTTP Authorization Header: `Bearer <SEND_EMAIL_HOOK_SECRET value>`

4. **Security settings:**
   - Match minimum password length from old project
   - Verify signup is enabled

#### Step 1.5 — Set all edge function secrets (~20 min)

In new project Dashboard → Edge Function Secrets, set all 28 secrets from Section 3.

**Critical order:**
1. `SITE_URL` = `https://app.innotrue.com` (set first — many functions depend on it)
2. `STRIPE_SECRET_KEY` = copy from old project
3. `STRIPE_WEBHOOK_SECRET` = **leave blank for now** — will be set after creating Stripe webhook
4. `RESEND_API_KEY` = copy from old project
5. `SEND_EMAIL_HOOK_SECRET` = copy from old project
6. All remaining secrets — copy values from old project Dashboard

**⚠️ OAUTH_ENCRYPTION_KEY:** Copy the EXACT value from the old project. If you generate a new one, all existing OAuth calendar integrations will break (tokens can't be decrypted).

#### Step 1.6 — Create storage buckets (~10 min)

The 481 migrations should create the buckets, but verify all 16 exist:

```sql
SELECT id, name, public FROM storage.buckets ORDER BY name;
```

Expected: `avatars`, `client-badges`, `coach-feedback-attachments`, `development-item-files`, `email-assets`, `goal-resources`, `group-notes`, `module-assessment-attachments`, `module-assignment-attachments`, `module-client-content`, `module-content-packages`, `module-reflection-resources`, `program-logos`, `psychometric-assessments`, `resource-library`, `task-note-resources`

If any are missing, create them manually in the Dashboard.

#### Step 1.7 — Verify cron jobs (~5 min)

```sql
SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
-- Should show 9 active jobs
```

#### Step 1.8 — Add new OAuth redirect URIs to providers (before cutover)

Add the NEW redirect URIs **alongside** the existing ones (most providers allow multiple):

| Provider | Add This URI |
|---|---|
| Google Cloud Console (Auth) | `https://<NEW_REF>.supabase.co/auth/v1/callback` |
| Google Cloud Console (Calendar) | `https://<NEW_REF>.supabase.co/functions/v1/oauth-callback` |
| Azure Portal | `https://<NEW_REF>.supabase.co/functions/v1/oauth-callback` |
| Zoom Marketplace | `https://<NEW_REF>.supabase.co/functions/v1/oauth-callback` |

This ensures both old and new projects work during the transition.

---

### Day 1 or 2: Data Pre-Copy (no downtime)

#### Step 2.1 — Export database from old project (~15-30 min)

Get the connection string from old project Dashboard → Settings → Database → Connection string (URI).

```bash
# Full dump including auth schema, data, and extensions
pg_dump \
  "postgresql://postgres.[OLD_REF]:[PASSWORD]@aws-0-eu-west-2.pooler.supabase.com:5432/postgres" \
  --no-owner \
  --no-privileges \
  --schema=auth \
  --schema=public \
  --schema=storage \
  --data-only \
  > innotrue_prod_data_$(date +%Y%m%d).sql

# Separate auth-only dump (safety backup)
pg_dump \
  "postgresql://postgres.[OLD_REF]:[PASSWORD]@aws-0-eu-west-2.pooler.supabase.com:5432/postgres" \
  --no-owner \
  --no-privileges \
  --schema=auth \
  --data-only \
  > innotrue_prod_auth_$(date +%Y%m%d).sql
```

**⚠️ Important:** Use `--data-only` because the schema is already created by migrations. We only need the data.

**⚠️ Connection string:** The old project is on `eu-west-2` (London). The new project will be on `eu-central-1` (Frankfurt). Make sure you're using the correct connection strings for each.

#### Step 2.2 — Import data to new project (~15-30 min)

```bash
# Import to new project
# IMPORTANT: Disable triggers during import to avoid side effects
psql "postgresql://postgres.[NEW_REF]:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres" \
  -c "SET session_replication_role = 'replica';" \
  -f innotrue_prod_data_$(date +%Y%m%d).sql

# Re-enable triggers
psql "postgresql://postgres.[NEW_REF]:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres" \
  -c "SET session_replication_role = 'origin';"
```

#### Step 2.3 — Verify user data (~5 min)

```sql
-- On new project:
SELECT COUNT(*) FROM auth.users;          -- Should match old project
SELECT COUNT(*) FROM public.profiles;     -- Should match old project
SELECT COUNT(*) FROM public.client_enrollments; -- Should match old project

-- Verify a known user exists with correct data
SELECT id, email, encrypted_password IS NOT NULL as has_password
FROM auth.users
WHERE email = '<your-email>';
```

#### Step 2.4 — Migrate user-generated storage (~30-60 min)

```bash
# Backup from old project
npm run backup:storage
# This downloads all 16 buckets to ./storage-backup/

# Upload user-generated buckets to new project
# Use supabase CLI or a custom script
for bucket in avatars module-assignment-attachments module-reflection-resources \
  module-assessment-attachments module-client-content coach-feedback-attachments \
  development-item-files goal-resources group-notes task-note-resources \
  psychometric-assessments client-badges email-assets; do
  echo "Uploading $bucket..."
  # Upload each file preserving the path structure
  # (exact command depends on your backup script's output format)
done
```

**Skip these buckets** (will be re-uploaded manually via admin UI):
- `module-content-packages` — re-upload Rise xAPI ZIPs
- `resource-library` — re-upload learning resources
- `program-logos` — re-upload program images

#### Step 2.5 — Verify storage (~5 min)

```sql
-- On new project: check file counts per bucket
SELECT bucket_id, COUNT(*) FROM storage.objects GROUP BY bucket_id ORDER BY bucket_id;
-- Compare with old project — user-generated buckets should match
```

---

### Cutover Day: The Switch (DOWNTIME WINDOW — 30-60 min)

**Timing:** Schedule during lowest-traffic period (e.g., Sunday evening or early morning).

#### Pre-cutover: Announce maintenance

- [ ] Send notification/email to active users: "Platform maintenance scheduled for [date/time], ~1 hour downtime"
- [ ] Consider adding a maintenance banner to the app 24h before

#### Step 3.1 — Final data sync (~15 min)

Capture any data changes since the pre-copy:

```bash
# Final pg_dump from old project (data-only, all schemas)
pg_dump \
  "postgresql://postgres.[OLD_REF]:[PASSWORD]@aws-0-eu-west-2.pooler.supabase.com:5432/postgres" \
  --no-owner --no-privileges \
  --schema=auth --schema=public --schema=storage \
  --data-only \
  > innotrue_prod_final_$(date +%Y%m%d_%H%M).sql

# Import to new project (with triggers disabled)
psql "postgresql://postgres.[NEW_REF]:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres" \
  -c "TRUNCATE auth.users CASCADE; TRUNCATE auth.sessions CASCADE;" # Clear pre-copied data

psql "postgresql://postgres.[NEW_REF]:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres" \
  -c "SET session_replication_role = 'replica';" \
  -f innotrue_prod_final_$(date +%Y%m%d_%H%M).sql

psql "postgresql://postgres.[NEW_REF]:[PASSWORD]@aws-0-eu-central-1.pooler.supabase.com:5432/postgres" \
  -c "SET session_replication_role = 'origin';"
```

**⚠️ Alternative safer approach:** Instead of TRUNCATE + re-import, you could use `pg_dump` with `--inserts` and `ON CONFLICT DO UPDATE` wrappers. But for a short maintenance window where no new data is being written, TRUNCATE + re-import is faster and simpler.

#### Step 3.2 — Final storage sync (~5 min)

Check if any new user uploads happened since pre-copy:

```sql
-- On old project: find recent uploads
SELECT bucket_id, name, created_at FROM storage.objects
WHERE created_at > '<pre-copy-timestamp>'
ORDER BY created_at DESC;
```

Download and upload any new files to the matching paths on the new project.

#### Step 3.3 — Stripe webhook (~5 min)

1. Go to [Stripe Dashboard → Developers → Webhooks](https://dashboard.stripe.com/webhooks)
2. Add new endpoint: `https://<NEW_REF>.supabase.co/functions/v1/stripe-webhook`
3. Select events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
4. Copy the new **Signing secret** (`whsec_...`)
5. Set `STRIPE_WEBHOOK_SECRET` = new signing secret in new project's Edge Function Secrets
6. **Disable** (don't delete) the old webhook endpoint

#### Step 3.4 — Cal.com webhook (~3 min)

1. Go to Cal.com → Settings → Webhooks
2. Update endpoint URL to `https://<NEW_REF>.supabase.co/functions/v1/calcom-webhook`
3. Webhook secret stays the same (already set as `CALCOM_WEBHOOK_SECRET`)

#### Step 3.5 — TalentLMS webhook (~3 min)

1. Go to TalentLMS Admin Panel → Webhooks (or API settings)
2. Update endpoint URL to `https://<NEW_REF>.supabase.co/functions/v1/talentlms-webhook`

#### Step 3.6 — OAuth redirect URIs (~10 min)

If you pre-added new URIs in Step 1.8, you can skip adding — just verify they're there.

**Google Cloud Console:**
- [ ] Verify `https://<NEW_REF>.supabase.co/auth/v1/callback` is listed
- [ ] Verify `https://<NEW_REF>.supabase.co/functions/v1/oauth-callback` is listed

**Azure Portal:**
- [ ] Verify `https://<NEW_REF>.supabase.co/functions/v1/oauth-callback` is listed

**Zoom Marketplace:**
- [ ] Verify `https://<NEW_REF>.supabase.co/functions/v1/oauth-callback` is listed

#### Step 3.7 — Cloudflare Pages env vars (~5 min)

1. Go to [Cloudflare Dashboard](https://dash.cloudflare.com) → Pages → `innotrue-hub-live` → Settings → Environment Variables
2. Update **Production** variables:
   - `VITE_SUPABASE_URL` = `https://<NEW_REF>.supabase.co`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` = new project's anon key
3. Trigger rebuild: push to `main` or click "Retry deployment"
4. Wait for build to complete (~2-3 min)

#### Step 3.8 — Verify auth email hook (~2 min)

In new project Dashboard → Auth → Hooks:
- Verify email hook points to: `https://<NEW_REF>.supabase.co/functions/v1/send-auth-email`
- Verify Authorization header is set correctly

---

### Post-Cutover: Verification (~30-60 min)

#### Critical path tests (do these first)

- [ ] **Login — email/password:** Log in with a known user. Verify dashboard loads correctly.
- [ ] **Login — Google OAuth:** Sign out, click "Continue with Google". Verify redirect works and user lands on dashboard.
- [ ] **Password reset:** Trigger "Forgot password" → verify email arrives → verify reset link works.
- [ ] **Signup flow:** Create a new test user → verify verification email arrives → verify `/complete-registration` works.

#### Functional tests

- [ ] **Stripe payment:** Navigate to Credits → attempt a top-up purchase. Verify Stripe Checkout opens. (Cancel before paying unless you want to test end-to-end.)
- [ ] **Cal.com booking:** Navigate to a module with scheduling → verify booking URL resolves.
- [ ] **Content delivery:** Open a module with xAPI content. If content was re-uploaded, verify it loads. If not yet re-uploaded, verify the page handles the missing content gracefully.
- [ ] **Email notifications:** Submit an assignment or trigger an action that sends a notification. Verify email arrives.
- [ ] **Storage files:** Check that avatars load, program logos display, assignment attachments are downloadable.

#### Infrastructure verification

- [ ] **Cron jobs:**
  ```sql
  SELECT jobname, schedule, active FROM cron.job ORDER BY jobname;
  -- All 9 should be active
  ```
- [ ] **Edge functions:** Check Supabase Dashboard → Edge Functions → verify 80 functions listed, no errors in logs.
- [ ] **Sentry:** Check [sentry.io](https://sentry.io) for any new error spikes in the last 30 minutes.

---

### Post-Migration: Cleanup (next few days)

#### Immediate (same day)

- [ ] Commit code changes with new project ref
- [ ] Deploy: `develop` → `preprod` → `main` → `npm run update:lovable`
- [ ] Run `npm run verify` to ensure nothing is broken

#### Next 1-3 days

- [ ] Re-upload xAPI content packages via admin UI (for each program module that uses xAPI)
- [ ] Re-upload learning resources via admin Resources page
- [ ] Re-upload program logos
- [ ] Update documentation:
  - `MEMORY.md` — new project ref
  - `docs/SUPABASE_OPS_QUICKSTART.md` — new project ref in examples
  - `docs/ENVIRONMENT_CONFIGURATION.md` — new project ref
  - `docs/BACKUP_AND_RECOVERY.md` — verify connection strings
- [ ] Regenerate types from new project (if preprod also moves to Frankfurt):
  ```bash
  npx supabase gen types typescript --project-id <NEW_REF> > src/integrations/supabase/types.ts
  ```

#### After 7 days (if no issues)

- [ ] Remove old redirect URIs from Google/Azure/Zoom OAuth providers
- [ ] Delete old Stripe webhook endpoint (was disabled, now safe to delete)

#### After 30 days (decommission)

- [ ] Pause old Supabase project (stops billing but preserves data)
- [ ] After 90 days with zero issues: delete old project

---

## 11. Rollback Plan

If migration fails during cutover:

1. **Revert Cloudflare Pages** env vars to old project values → trigger rebuild
2. **Revert Stripe** webhook to old endpoint (re-enable the disabled one)
3. **Revert Cal.com** webhook URL to old project
4. **Revert TalentLMS** webhook URL to old project
5. OAuth redirect URIs — old URIs are still in place (we added new ones alongside, not replaced)
6. Old project is completely intact — no data was modified or deleted
7. Users return to London-hosted project with zero data loss

**Time to rollback:** ~15 minutes (just reverting URLs and env vars).

The old project should NOT be deleted or paused until the new project has been running successfully for at least 30 days.

---

## Appendix: Quick Reference Card

Print this for the cutover day:

```
OLD PROJECT: qfdztdgublwlmewobxmx (London)
NEW PROJECT: _________________________ (Frankfurt)

NEW ANON KEY: _________________________
NEW SERVICE ROLE KEY: _________________________

CUTOVER STEPS:
1. Final pg_dump → pg_restore
2. Final storage sync
3. Stripe: new webhook + copy whsec_ to secrets
4. Cal.com: update webhook URL
5. TalentLMS: update webhook URL
6. Verify OAuth URIs added
7. Cloudflare: VITE_SUPABASE_URL + KEY → rebuild
8. Verify auth email hook
9. TEST: login, OAuth, password reset, payment, email
10. ✅ DONE — announce maintenance complete
```
