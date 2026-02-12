# Lovable Integration Guide

How to safely use Lovable as a prototyping sandbox and promote code/data into the production pipeline.

## Architecture

```
┌─────────────────┐     ┌──────────────────────────────────────────────────┐
│  LOVABLE        │     │  PRODUCTION PIPELINE                             │
│  SANDBOX        │     │                                                  │
│                 │     │  develop ──→ preprod ──→ main                    │
│  Own Supabase   │────▶│  (daily)    (staging)   (production)             │
│  Own GitHub repo│     │                                                  │
│  Rapid prototyp.│     │  CI: lint → typecheck → test → build → E2E      │
└─────────────────┘     └──────────────────────────────────────────────────┘
```

**Key principle:** Lovable is a sketch pad. The live repo is the source of truth. Never connect Lovable to production infrastructure.

## Prerequisites

| Requirement | Details |
|-------------|---------|
| Lovable project | With its own Supabase instance that **you own** |
| Live repo cloned | `innotrue-hub-live` at your local machine |
| Node.js 20+ | For running scripts |
| Supabase CLI | Optional, for data export via CLI |

> **Important:** Do NOT use the old Lovable-owned Supabase project (`pfwlsxovvqdiwaztqxrj`). Create a fresh one under your own Supabase account.

## Available Scripts

| Command | Script | Purpose |
|---------|--------|---------|
| `npm run diff:lovable` | `scripts/diff-lovable.sh` | **Compare** Lovable vs live, pick files, then import |
| `npm run import:lovable` | `scripts/import-from-lovable.sh` | Import specific files from Lovable repo (direct) |
| `npm run cleanup:lovable` | `scripts/cleanup-lovable-code.sh` | Clean up Lovable-generated code |
| `npm run verify` | `scripts/verify.sh` | Local pre-push check (lint + typecheck + test + build) |
| — | `scripts/export-lovable-data.sql` | SQL queries for Supabase data export |

> **Recommended:** Use `diff:lovable` instead of `import:lovable` when Lovable changes touch multiple existing files. It shows you exactly what's new vs. modified and lets you pick what to import.

---

## Full Workflow

### Phase 1: Prototype in Lovable

Build your feature in Lovable. Don't worry about:
- TypeScript strictness (Lovable uses loose types)
- ESLint compliance
- Production patterns

**Do** worry about:
- Using the same directory structure (`src/components/`, `src/hooks/`, `src/pages/`)
- Using shadcn/ui components (same as the live repo)
- Keeping your Lovable Supabase schema compatible with the live repo

### Phase 2: Export Code

Clone or pull the Lovable repo locally, then compare and import:

#### Option A: Diff first, then pick (recommended for widespread changes)

```bash
# Compare all of src/
npm run diff:lovable -- /path/to/lovable-repo

# Compare specific directories
npm run diff:lovable -- /path/to/lovable-repo src/components src/hooks
```

The diff script will:
1. Compare every file in the scope between both repos
2. Categorise as **NEW** (only in Lovable), **MODIFIED** (differs), **IDENTICAL**, or **ONLY IN LIVE**
3. Show line-change counts for modified files and optionally show diffs
4. Write a pick-list to `.lovable-diff-pick.txt`
5. Let you edit the pick-list (remove files you don't want)
6. Feed selected files to the import script automatically

#### Option B: Direct import (when you know exactly which files)

```bash
# Import specific components/hooks/pages
npm run import:lovable -- /path/to/lovable-repo src/components/NewFeature src/hooks/useNewFeature.ts

# Import a whole directory
npm run import:lovable -- /path/to/lovable-repo src/pages/admin/NewSection
```

Both options will:
1. Create a feature branch: `feature/lovable-import-2026-02-12-143022`
2. Copy the selected files (preserving directory structure)
3. Run the cleanup script automatically
4. Stage files and show a diff summary

### Phase 3: Clean Up

The import script runs cleanup automatically. You can also run it manually:

```bash
# Clean specific paths
npm run cleanup:lovable -- src/components/NewFeature

# Clean all of src/
npm run cleanup:lovable
```

The cleanup script:
1. **ESLint `--fix`** — auto-fixes simple violations
2. **Prettier** — normalizes formatting
3. **TypeScript check** — reports errors (fix manually)
4. **Lovable pattern scan** — flags `@lovable`, old URLs, unknown Supabase refs
5. **`any` type count** — reports for manual cleanup

**You must manually fix:**
- TypeScript errors (add proper types)
- `@lovable` references (remove or replace)
- Stale URLs (update to `app.innotrue.com`)
- Unknown Supabase project refs (remove or use env vars)
- `any` types (replace with proper types where feasible)

### Phase 4: PR to develop

```bash
# Review the diff
git diff --cached

# Commit
git commit -m "feat: import NewFeature from Lovable prototype"

# Push
git push -u origin feature/lovable-import-2026-02-12-143022
```

Create a PR to `develop` on GitHub. CI runs automatically:
- ESLint
- TypeScript strict mode check
- 210+ unit tests
- Production build

### Phase 5: develop → preprod

After the PR is merged to `develop`:

```bash
git checkout preprod
git merge develop --no-edit
git push origin preprod
```

This triggers:
- Cloudflare Pages preview deployment
- CI quality checks
- **E2E tests** (Playwright, 14 tests against live preprod)

Verify the feature on the preview URL.

### Phase 6: preprod → main (production)

After QA passes on preprod:

```bash
git checkout main
git merge preprod --no-edit
git push origin main
```

Cloudflare Pages deploys to `app.innotrue.com`. Monitor Sentry for errors.

---

## Data Sync from Lovable Supabase

When you've configured data in your Lovable Supabase (programs, assessments, plans, etc.), you can export and import it.

### Step 1: Export

Open your Lovable Supabase Dashboard → SQL Editor. Run queries from `scripts/export-lovable-data.sql` for the tables you need.

### Step 2: Generate SQL

Paste the JSON output to Claude Code with:
> "Generate idempotent INSERT SQL from this JSON export for [table name]. Use ON CONFLICT patterns matching our seed.sql style."

### Step 3: Apply

1. **Review** the generated SQL
2. **Apply to preprod first** — run in the preprod Supabase SQL Editor
3. **Verify** the data looks correct
4. **Apply to prod** — run in the production Supabase SQL Editor
5. **Update `seed.sql`** — add the data so it survives `supabase db reset`

### Safe Tables (configuration/content)

| Category | Tables |
|----------|--------|
| Plans & billing | `plans`, `features`, `plan_features`, `credit_services`, `credit_topup_packages`, `org_credit_packages`, `org_platform_tiers` |
| Programs | `programs`, `program_modules`, `program_versions` |
| Tracks | `tracks`, `track_features`, `module_types` |
| Sessions | `session_types`, `session_type_roles` |
| Assessments | `assessment_categories`, `assessment_families`, `assessment_domains`, `assessment_questions` |
| Notifications | `notification_categories`, `notification_types` |
| Content | `email_templates`, `platform_terms`, `wheel_categories`, `system_settings` |

### Never Export (user/runtime data)

`auth.users`, `profiles`, `user_roles`, `client_enrollments`, `module_progress`, `user_credit_balances`, `org_credit_balances`, `sessions`, `notifications`, `user_notification_preferences`, `oauth_tokens`, `audit_log`, `assessment_snapshots`, `assessment_ratings`

---

## What Belongs Where

| Aspect | Lovable Sandbox | Live Repo |
|--------|----------------|-----------|
| Rapid UI prototyping | ✅ Yes | ❌ No |
| TypeScript strict mode | ❌ No (loose) | ✅ Yes |
| ESLint / Prettier | ❌ No | ✅ Yes |
| Production deployment | ❌ Never | ✅ Yes |
| Database migrations | Experimental only | Source of truth |
| Edge functions | Prototype only | Production (with CORS, auth, email override) |
| Unit tests | None | Required (Vitest) |
| E2E tests | None | Required (Playwright) |
| CI/CD pipeline | None | GitHub Actions |
| Error monitoring | None | Sentry |
| PWA / service worker | None | Configured |

---

## Critical Rules

### Never Do These

1. **NEVER copy Lovable migrations** into the live repo. Lovable generates its own migration files with different IDs and potentially conflicting changes. Instead, manually recreate schema changes as new migrations: `supabase migration new my_change`

2. **NEVER copy edge functions wholesale.** Lovable edge functions lack the live repo's CORS config, auth patterns, staging email override, and AI provider setup. Import file-by-file and adapt to match `supabase/functions/_shared/` patterns.

3. **NEVER connect Lovable to production Supabase.** Lovable's Supabase must be a completely separate project.

4. **NEVER skip the cleanup step.** Lovable code with `any` types and missing null checks will break the strict TypeScript build.

5. **NEVER push directly to `main` or `preprod`.** Always go through the feature branch → `develop` → `preprod` → `main` flow.

---

## Rollback Procedures

### Code Rollback

**Revert a specific commit:**
```bash
git revert <commit-hash>
git push origin main  # or preprod/develop
```
Cloudflare Pages automatically redeploys on push.

**Revert a whole Lovable import:**
```bash
# Find the merge commit
git log --oneline | grep "lovable-import"

# Revert it
git revert <merge-commit-hash>
git push
```

**Emergency: revert via GitHub UI**
1. Go to the merged PR on GitHub
2. Click "Revert" to create a revert PR
3. Merge the revert PR
4. Cloudflare auto-redeploys

### Database Rollback

**Config data (programs, plans, features, etc.):**
- Re-run `supabase/seed.sql` which is fully idempotent (`ON CONFLICT` everywhere)
- Or manually DELETE/UPDATE specific rows

**Schema changes (if a migration was applied):**
- Use Supabase Point-in-Time Recovery (PITR) — available on Pro plan
- Or create a new "reverse" migration to undo the schema change

---

## Promotion Checklist

### Import from Lovable
- [ ] Files compared via `npm run diff:lovable` (or imported via `npm run import:lovable`)
- [ ] Cleanup script ran (auto or manual)
- [ ] All TypeScript errors resolved (`npm run typecheck` passes)
- [ ] No `@lovable` references remain
- [ ] No hardcoded URLs from other environments
- [ ] No `console.log` statements (use Sentry for error tracking)
- [ ] `any` types replaced where feasible
- [ ] Feature branch created with descriptive name
- [ ] PR to `develop` created

### develop → preprod
- [ ] PR merged to `develop`
- [ ] CI passes (lint, typecheck, test, build)
- [ ] Merged `develop` into `preprod`
- [ ] Cloudflare preview deployment verified
- [ ] E2E tests pass (14 Playwright tests)
- [ ] Manual QA on preview URL

### preprod → main (production)
- [ ] All QA passed on preprod
- [ ] Merged `preprod` into `main`
- [ ] CI passes
- [ ] Production deployment verified at `app.innotrue.com`
- [ ] Sentry shows no new errors (check for 30 minutes)
- [ ] Web vitals normal (LCP, CLS, INP)

### Data sync (if applicable)
- [ ] Config data exported from Lovable Supabase
- [ ] Idempotent SQL generated and reviewed
- [ ] Applied to preprod first
- [ ] Verified on preprod
- [ ] Applied to prod
- [ ] `seed.sql` updated with new data
