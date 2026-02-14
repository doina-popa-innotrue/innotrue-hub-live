# Supabase Operations — Quick Reference

## Environments

| Environment | Project Ref | Branch | Frontend |
|---|---|---|---|
| **Production** | `qfdztdgublwlmewobxmx` | `main` | `app.innotrue.com` |
| **Preprod** | `jtzcrirqflfnagceendt` | `preprod` | Cloudflare Pages preview |
| **Sandbox** | `cezlnvdjildzxpyxyabb` | Lovable `main` | Lovable preview |

---

## Available NPM Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| **Deploy Functions** | `npm run deploy:functions` | Deploy all 61 edge functions to an env |
| **Push Migrations** | `npm run push:migrations` | Apply pending DB migrations to an env |
| **Sync Data** | `npm run sync:data` | Export/import config tables between envs |
| **Sync Storage** | `npm run sync:storage` | Copy storage bucket files between envs |
| **Backup Storage** | `npm run backup:storage` | One-way backup of all 15 storage buckets |

---

## 1. Edge Function Deployment

Deploy all 61 edge functions (or specific ones) to any environment.

### Deploy all functions

```bash
# Deploy to production (default)
npm run deploy:functions

# Deploy to preprod
npm run deploy:functions -- preprod

# Deploy to sandbox
npm run deploy:functions -- sandbox
```

### Deploy specific functions

```bash
npm run deploy:functions -- prod --only send-auth-email send-welcome-email
npm run deploy:functions -- preprod --only calcom-webhook
```

### Preview what would deploy

```bash
npm run deploy:functions -- --dry-run
npm run deploy:functions -- preprod --dry-run
```

### When to use

- After modifying any edge function code
- After merging a PR that touches `supabase/functions/`
- After the initial setup of a new environment
- To re-deploy after changing Supabase secrets

### Notes

- All functions deploy with `--no-verify-jwt` (they handle auth internally)
- Failed functions are listed at the end with a re-run command
- The script saves and restores your current `supabase link`

---

## 2. Migration Push

Apply pending database migrations to any environment.

### Push to a specific environment

```bash
# Push to production (default)
npm run push:migrations

# Push to preprod
npm run push:migrations -- preprod

# Push to sandbox
npm run push:migrations -- sandbox
```

### Push to all environments

```bash
# Pushes: preprod → prod → sandbox (stops on first failure)
npm run push:migrations -- all
```

### Preview pending migrations

```bash
npm run push:migrations -- --dry-run
npm run push:migrations -- preprod --dry-run
```

### Typical workflow

After creating a new migration and merging to develop:

```bash
# 1. Push to preprod first, test
npm run push:migrations -- preprod

# 2. Test on Cloudflare preview URL

# 3. Merge to main, push to prod
npm run push:migrations -- prod

# 4. Optionally push to sandbox
npm run push:migrations -- sandbox
```

### Notes

- Supabase CLI will prompt for the database password
- Migrations run in order by timestamp prefix
- If a migration fails, fix it and retry — Supabase tracks which have been applied
- The `all` flag stops at the first failure to prevent cascading issues

---

## 3. Data Sync (Config Tables)

Export configuration data from one environment and import to another. Only syncs safe config tables — **never user data**.

### Full sync between environments

```bash
# Prod config → preprod
npm run sync:data -- --from prod --to preprod

# Sandbox → preprod (after prototyping in Lovable)
npm run sync:data -- --from sandbox --to preprod

# Prod → sandbox (bring sandbox up to date)
npm run sync:data -- --from prod --to sandbox
```

### Sync specific tables only

```bash
npm run sync:data -- --from prod --to preprod --tables plans features plan_features
npm run sync:data -- --from sandbox --to preprod --tables programs program_modules
```

### Export only (no import)

```bash
# Export prod config as JSON files
npm run sync:data -- --from prod --export-only

# Export specific tables
npm run sync:data -- --from prod --export-only --tables plans features
```

### Preview what would sync

```bash
npm run sync:data -- --dry-run --from prod --to preprod
```

### Safe tables (always synced)

These contain configuration and content only — no user data:

- **Plans & pricing:** `plans`, `features`, `plan_features`, `plan_prices`
- **Programs:** `programs`, `program_modules`
- **Tracks:** `tracks`, `track_features`
- **Sessions:** `session_types`, `session_type_roles`
- **Credits:** `credit_services`, `credit_topup_packages`, `org_credit_packages`, `org_platform_tiers`
- **Notifications:** `notification_categories`, `notification_types`
- **Assessments:** `assessment_categories`, `assessment_families`, `assessment_domains`, `assessment_questions`
- **Other:** `system_settings`, `wheel_categories`, `module_types`, `platform_terms`, `email_templates`, `resource_categories`

### Blocked tables (never synced)

The script refuses to sync these even if explicitly requested:

- `profiles`, `user_roles`, `client_enrollments`, `module_progress`
- `user_credit_balances`, `org_credit_balances`, `client_coaches`
- `sessions`, `notifications`, `user_notification_preferences`
- `oauth_tokens`, `audit_log`, `assessment_snapshots`, `assessment_ratings`

### How it works

1. Links to source project, exports each table as JSON
2. Links to target project, generates idempotent `INSERT ... ON CONFLICT DO UPDATE` SQL
3. Applies the SQL (upserts — safe to run repeatedly)
4. Restores your original project link

### When to use

- After creating new plans, features, or programs in one environment
- After prototyping content in Lovable sandbox
- To ensure preprod matches prod configuration
- Before running E2E tests that depend on config data

---

## 4. Storage Sync

Copy files from storage buckets between environments.

### Sync all buckets

```bash
# Prod files → preprod
npm run sync:storage -- --from prod --to preprod

# Prod files → sandbox
npm run sync:storage -- --from prod --to sandbox
```

### Sync specific buckets

```bash
npm run sync:storage -- --from prod --to preprod --buckets avatars program-logos
npm run sync:storage -- --from prod --to preprod --buckets resource-library
```

### Preview what would sync

```bash
npm run sync:storage -- --dry-run --from prod --to preprod
```

### All 15 buckets

`avatars`, `program-logos`, `email-assets`, `task-note-resources`, `goal-resources`, `resource-library`, `module-client-content`, `module-assignment-attachments`, `module-reflection-resources`, `module-assessment-attachments`, `coach-feedback-attachments`, `development-item-files`, `client-badges`, `group-notes`, `psychometric-assessments`

### How it works

1. Downloads all files from source buckets to a temp directory
2. Uploads them to the target environment
3. Existing files in target are overwritten (idempotent)
4. Temp directory is cleaned up automatically

### Notes

- Copies files only — bucket policies/settings are managed by migrations
- Empty buckets are skipped
- Large buckets may take a while (uses 4 parallel threads)

---

## 5. Storage Backup (One-Way)

Back up storage buckets to your local machine. Different from sync — this is for disaster recovery.

```bash
# Back up production (default)
npm run backup:storage

# Back up preprod
npm run backup:storage -- preprod

# Back up all environments
npm run backup:storage -- all
```

Backups are saved to `backups/storage/<env>-<ref>/<date>/`. Keeps the 5 most recent backups per environment.

---

## Common Workflows

### After merging a PR with DB + function changes

```bash
# 1. Push migrations
npm run push:migrations -- preprod

# 2. Deploy affected functions
npm run deploy:functions -- preprod --only <changed-functions>

# 3. Test on preprod preview URL

# 4. Merge to main, repeat for prod
npm run push:migrations -- prod
npm run deploy:functions -- prod --only <changed-functions>
```

### After prototyping in Lovable sandbox

```bash
# 1. Sync Lovable code → live (separate workflow)
npm run sync:lovable -- --diff-only    # Check what changed

# 2. If Lovable has new config data (plans, programs, etc.)
npm run sync:data -- --from sandbox --to preprod --tables programs program_modules

# 3. Test on preprod

# 4. Promote config to prod
npm run sync:data -- --from preprod --to prod --tables programs program_modules
```

### Full environment reset (bring preprod in sync with prod)

```bash
# 1. Migrations (should already match via git)
npm run push:migrations -- preprod

# 2. Config data
npm run sync:data -- --from prod --to preprod

# 3. Storage files
npm run sync:storage -- --from prod --to preprod

# 4. Edge functions
npm run deploy:functions -- preprod
```

### Bringing Lovable sandbox up to date

```bash
# 1. Code (via git merge)
npm run update:lovable

# 2. Migrations
npm run push:migrations -- sandbox

# 3. Config data
npm run sync:data -- --from prod --to sandbox

# 4. Storage (optional — sandbox usually doesn't need files)
npm run sync:storage -- --from prod --to sandbox --buckets program-logos email-assets
```

---

## Prerequisites

All scripts require:

- **Supabase CLI** — `brew install supabase/tap/supabase`
- **Logged in** — `supabase login`
- **Python 3** — for data sync JSON processing (pre-installed on macOS)

The scripts automatically save and restore your current `supabase link` project.

---

## Critical Rules

1. **NEVER sync user data** — the data sync script blocks user tables automatically
2. **Always test on preprod first** — push migrations and deploy functions to preprod before prod
3. **Migrations are one-way** — once applied, they can't be rolled back automatically. Use PITR for database recovery.
4. **Storage sync overwrites** — files with the same path in the target bucket are replaced
5. **Env secrets are separate** — deploying functions doesn't copy secrets. Set secrets via Supabase Dashboard.
6. **Database passwords** — the CLI will prompt for the database password when pushing migrations
