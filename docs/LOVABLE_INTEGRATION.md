# Lovable Integration Guide

How to safely prototype in Lovable and promote code/data into the production pipeline.

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
| Lovable project | With its own Supabase instance that **you own** (ref: `cezlnvdjildzxpyxyabb`) |
| Live repo cloned | `innotrue-hub-live` at your local machine |
| Lovable repo cloned | The Lovable GitHub repo, pulled to a local folder |
| Node.js 20+ | For running scripts |
| Terminal | macOS Terminal, iTerm, or VS Code / Cursor integrated terminal |

> **Important:** Do NOT use the old Lovable-owned Supabase project (`pfwlsxovvqdiwaztqxrj`). Use the fresh one under your own Supabase account.

## Available Scripts

| Command | What it does |
|---------|-------------|
| `npm run diff:lovable` | Compare Lovable repo vs live repo, review differences, pick files to import |
| `npm run import:lovable` | Import specific files directly (when you know exactly which ones) |
| `npm run cleanup:lovable` | Run code cleanup on imported files (ESLint, Prettier, TypeScript check) |
| `npm run verify` | Run full quality check locally (lint + typecheck + test + build) |

---

## Step-by-Step: Promoting Code from Lovable to Production

### Step 1: Prototype in Lovable

Build your feature in Lovable as you normally would.

**Tips for smoother imports later:**
- Use the same folder structure as the live repo (`src/components/`, `src/hooks/`, `src/pages/`)
- Use shadcn/ui components (same library as the live repo)
- Don't worry about TypeScript strictness or ESLint — the cleanup script handles that

### Step 2: Pull the Lovable repo to your machine

Open Terminal and clone or pull the latest from your Lovable GitHub repo:

```bash
# First time — clone it somewhere on your machine
git clone https://github.com/YOUR-USERNAME/YOUR-LOVABLE-REPO.git ~/lovable-sandbox

# After that — just pull latest changes
cd ~/lovable-sandbox
git pull
```

### Step 3: Open Terminal in the live repo

```bash
cd "/Users/doina/Library/CloudStorage/GoogleDrive-doina.popa@innotrue.com/My Drive/InnoTrue/Work_GDrive/innotrue-hub-live"
```

Or open the `innotrue-hub-live` folder in Cursor/VS Code and use the integrated terminal.

### Step 4: Run the diff to compare repos

```bash
# Compare everything in src/
npm run diff:lovable -- ~/lovable-sandbox

# Or compare only specific folders
npm run diff:lovable -- ~/lovable-sandbox src/components src/hooks src/pages
```

**What you'll see:**

```
━━━ Summary ━━━
  New files:     3       ← Files only in Lovable (safe to import)
  Modified:      12      ← Files that differ between repos (review carefully!)
  Identical:     87      ← No changes needed
  Only in live:  5       ← Files only in your live repo (won't be touched)
```

Then for each modified file, you'll see how many lines changed. You can type `y` to see the actual diffs.

### Step 5: Edit the pick-list

The script creates a file called `.lovable-diff-pick.txt` in your project root. It lists all new and modified files.

**Open it** in your editor (Cursor, VS Code, or any text editor) and:
- **Keep** lines for files you want to import
- **Delete** lines for files you want to skip (e.g., files you've already improved in the live repo)
- Lines starting with `#` are comments — they're ignored

Example pick-list:
```
# --- NEW FILES (only in Lovable) ---
src/components/coaching/SessionNotes.tsx        ← keep this (new feature)
src/hooks/useSessionNotes.ts                    ← keep this

# --- MODIFIED FILES (differ between repos) ---
# ⚠ These will OVERWRITE your live versions!
src/components/layout/Sidebar.tsx               ← delete if you don't want to overwrite
src/pages/Dashboard.tsx                         ← delete if live version is better
```

**Save the file** when you're done editing.

### Step 6: Confirm the import

Go back to Terminal and **press Enter**. The script will:
1. Create a new branch: `feature/lovable-import-YYYY-MM-DD-HHMMSS`
2. Copy only the files you kept in the pick-list
3. Run the cleanup script automatically (ESLint fix, Prettier, TypeScript check)
4. Stage everything and show you the diff

### Step 7: Review and fix issues

The cleanup script will show a summary like:

```
┌────────────────────┬───────┐
│ Check              │ Count │
├────────────────────┼───────┤
│ ESLint auto-fixed  │ 5     │
│ TypeScript errors  │ 3     │  ← you must fix these manually
│ Lovable patterns   │ 0     │
│ `any` types        │ 2     │  ← fix if feasible
└────────────────────┴───────┘
```

**Fix any TypeScript errors manually.** Common fixes:
- Add proper types where Lovable used `any`
- Add null checks (the live repo has `strictNullChecks` enabled)
- Remove any `@lovable` references or old Lovable URLs

You can also run cleanup again on specific files:
```bash
npm run cleanup:lovable -- src/components/coaching
```

### Step 8: Verify everything passes locally

```bash
npm run verify
```

This runs the same checks as CI: lint → typecheck → tests → build. **All four must pass** before you push.

### Step 9: Commit and push

```bash
# Review what's staged
git diff --cached

# Commit
git commit -m "feat: import session notes from Lovable prototype"

# Push the feature branch
git push -u origin feature/lovable-import-2026-02-12-143022
```

### Step 10: Create a PR to develop

Go to GitHub and create a Pull Request from your feature branch → `develop`.

CI runs automatically and checks:
- ESLint
- TypeScript strict mode
- 210+ unit tests
- Production build

**Wait for CI to pass**, then merge the PR.

### Step 11: Promote develop → preprod

After the PR is merged:

```bash
git checkout develop
git pull origin develop
git checkout preprod
git merge develop --no-edit
git push origin preprod
```

This triggers:
- Cloudflare Pages preview deployment (you'll get a preview URL)
- CI quality checks
- E2E tests (Playwright)

**Test the feature on the preview URL** before moving to production.

### Step 12: Promote preprod → main (production)

After QA passes on preprod:

```bash
git checkout main
git merge preprod --no-edit
git push origin main
```

Cloudflare Pages deploys to `app.innotrue.com`.

**After deploying:**
- Check Sentry for new errors (monitor for 30 minutes)
- Verify the feature works on `app.innotrue.com`
- Check web vitals are normal

---

## Data Sync from Lovable Supabase

If you configured data in Lovable's Supabase (programs, assessments, plans, etc.), you need to sync it separately. Code imports don't touch the database.

### Step 1: Export data from Lovable Supabase

1. Go to your **Lovable Supabase Dashboard** → SQL Editor
2. Open `scripts/export-lovable-data.sql` in your editor
3. Copy and run the queries for the tables you need (e.g., programs, assessment questions)
4. Copy the JSON output

### Step 2: Generate SQL

Paste the JSON to Claude Code with this prompt:
> "Generate idempotent INSERT SQL from this JSON export for [table name]. Use ON CONFLICT patterns matching our seed.sql style."

### Step 3: Apply to environments

1. **Review** the generated SQL carefully
2. **Run on preprod first** — paste into the preprod Supabase SQL Editor
3. **Verify** the data looks correct on the preprod app
4. **Run on prod** — paste into the production Supabase SQL Editor
5. **Update `seed.sql`** — add the new data so it survives `supabase db reset`

### Safe tables (OK to sync)

| Category | Tables |
|----------|--------|
| Plans & billing | `plans`, `features`, `plan_features`, `credit_services`, `credit_topup_packages`, `org_credit_packages`, `org_platform_tiers` |
| Programs | `programs`, `program_modules`, `program_versions` |
| Tracks | `tracks`, `track_features`, `module_types` |
| Sessions | `session_types`, `session_type_roles` |
| Assessments | `assessment_categories`, `assessment_families`, `assessment_domains`, `assessment_questions` |
| Notifications | `notification_categories`, `notification_types` |
| Content | `email_templates`, `platform_terms`, `wheel_categories`, `system_settings` |

### Never sync (user/runtime data)

`auth.users`, `profiles`, `user_roles`, `client_enrollments`, `module_progress`, `user_credit_balances`, `org_credit_balances`, `sessions`, `notifications`, `user_notification_preferences`, `oauth_tokens`, `audit_log`, `assessment_snapshots`, `assessment_ratings`

---

## Critical Rules

1. **NEVER merge Lovable into the live repo.** Lovable is a one-way push target. A `pre-merge-commit` git hook enforces this — `git merge lovable/main` is blocked automatically. If you need a specific Lovable change, cherry-pick it: `git cherry-pick <commit-sha>`.

2. **NEVER copy Lovable migrations** into the live repo. Lovable generates migration files with different IDs that will conflict. Instead, recreate schema changes as new migrations: `supabase migration new my_change`

3. **NEVER copy edge functions wholesale.** Lovable edge functions lack the live repo's CORS config, auth patterns, staging email override, and AI provider setup. Import file-by-file and adapt to match `supabase/functions/_shared/` patterns.

4. **NEVER connect Lovable to production Supabase.** Lovable's Supabase must be a completely separate project.

5. **NEVER skip the cleanup step.** Lovable code with `any` types and missing null checks will break the strict TypeScript build.

6. **NEVER push directly to `main` or `preprod`.** Always go through: feature branch → `develop` → `preprod` → `main`.

### Why merging from Lovable is dangerous

Lovable regenerates `types.ts` from its own database snapshot, which is often stale. When it encounters type errors from missing tables/columns, it applies `(supabase as any).from(...)` casts across dozens of files. Merging these changes would:
- Destroy type safety across ~25+ files
- Hide real bugs (wrong column names silently return null)
- Conflict with every future merge from the live repo

The `pre-merge-commit` hook (installed automatically via `npm install`) prevents this. Source: `scripts/hooks/pre-merge-commit`.

---

## Rollback Procedures

### Code rollback

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

### Database rollback

**Config data (programs, plans, features, etc.):**
- Re-run `supabase/seed.sql` which is fully idempotent (`ON CONFLICT` everywhere)
- Or manually DELETE/UPDATE specific rows

**Schema changes (if a migration was applied):**
- Use Supabase Point-in-Time Recovery (PITR) — available on Pro plan
- Or create a new "reverse" migration to undo the schema change

---

## Quick Reference Checklist

### Before pushing
- [ ] `npm run verify` passes (lint + typecheck + test + build)
- [ ] No `@lovable` references remain
- [ ] No hardcoded URLs from other environments
- [ ] No `console.log` statements (use Sentry for error tracking)
- [ ] `any` types replaced where feasible

### Before merging to preprod
- [ ] PR merged to `develop`
- [ ] CI passes on GitHub

### Before merging to main
- [ ] Feature tested on preprod preview URL
- [ ] E2E tests pass

### After deploying to production
- [ ] Feature works on `app.innotrue.com`
- [ ] Sentry shows no new errors (check for 30 minutes)
- [ ] Web vitals normal (LCP, CLS, INP)
