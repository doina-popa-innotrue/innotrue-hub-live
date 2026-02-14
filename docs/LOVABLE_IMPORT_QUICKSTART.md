# Lovable Import — Quick Reference

## When to Use This

Use this workflow when you've prototyped new features or UI changes in the Lovable sandbox and want to bring them into the production codebase.

## Prerequisites

- You're working in the **live repo**: `innotrue-hub-live`
- The Lovable sandbox repo is cloned locally (one-time setup)
- Your working tree is clean (`git status` shows no changes)
- You're on the `develop` branch

## One-Time Setup

Clone the Lovable sandbox repo next to the live repo:

```bash
cd "/Users/doina/Library/CloudStorage/GoogleDrive-doina.popa@innotrue.com/My Drive/InnoTrue/Work_GDrive"
git clone https://github.com/doina-popa-innotrue/innotrue-hub-lovable-sandbox.git lovable-sandbox
```

This creates: `.../Work_GDrive/lovable-sandbox/`

## Step-by-Step Workflow

### Step 1: Pull Latest from Both Repos

```bash
# Pull latest live repo
cd ".../Work_GDrive/innotrue-hub-live"
git checkout develop
git pull origin develop

# Pull latest Lovable sandbox
cd ".../Work_GDrive/lovable-sandbox"
git pull
```

### Step 2: Run the Diff

From the live repo:

```bash
cd ".../Work_GDrive/innotrue-hub-live"

# Diff everything in src/
npm run diff:lovable -- "../lovable-sandbox"

# Or scope to specific directories:
npm run diff:lovable -- "../lovable-sandbox" src/components/NewFeature src/pages/NewPage.tsx
```

**What happens:**
1. Compares all files in Lovable `src/` against live `src/`
2. Auto-excludes 16+ config files (vite.config, package.json, types.ts, etc.)
3. Shows summary: new files, modified files, identical files
4. Generates `.lovable-diff-pick.txt` with importable files listed

### Step 3: Review the Pick-List

Open `.lovable-diff-pick.txt` in your editor. It lists all new and modified files.

**Key decisions:**
- **New files** — Usually safe to import (new components, pages, hooks)
- **Modified files** — Review carefully! If live repo has newer changes (like our visibility cleanup), **remove those lines** from the pick-list to avoid reverting live fixes
- **Comment out** (prefix with `#`) or **delete lines** you don't want to import

### Step 4: Confirm Import

Go back to the terminal and press Enter. The import script:
1. Verifies clean git status
2. Creates a feature branch: `feature/lovable-import-YYYY-MM-DD-HHMMSS`
3. Copies selected files via `rsync`
4. Runs cleanup automatically (ESLint fix, Prettier, TypeScript check, Lovable reference scan)
5. Stages all changes
6. Shows diff summary
7. **Does NOT commit** — you must review and commit manually

### Step 5: Fix Any Issues

The cleanup script reports but doesn't auto-fix:
- TypeScript errors (fix manually)
- `@lovable` / `lovable-uploads` references (remove manually)
- Stale URLs like `innotruehub.com` or `lovable.dev` (update to `app.innotrue.com`)
- Unknown Supabase project refs (replace with correct project ID)
- `console.log` statements (remove for production code)

### Step 6: Verify

```bash
npm run verify
```

This runs: ESLint → TypeScript → Tests (210) → Build. All must pass.

### Step 7: Commit

```bash
git commit -m "feat: import [feature name] from Lovable sandbox"
```

### Step 8: Push and Create PR

```bash
git push -u origin feature/lovable-import-YYYY-MM-DD-HHMMSS
gh pr create --base develop --title "Import [feature] from Lovable" --body "..."
```

### Step 9: Promote Through Pipeline

After PR is merged to develop:

```bash
# Promote to preprod
git checkout preprod
git pull origin preprod
git merge develop --no-edit
git push origin preprod
# → Test on Cloudflare preview URL

# Promote to production
git checkout main
git pull origin main
git merge preprod --no-edit
git push origin main
# → Deployed to app.innotrue.com

# Sync develop with main
git checkout develop
git pull origin develop
```

### Step 10: Monitor

- Check Sentry for new errors (30 min after deploy)
- Verify the imported feature works on `app.innotrue.com`

---

## Available NPM Scripts

| Script | Command | Purpose |
|--------|---------|---------|
| Diff | `npm run diff:lovable -- <path> [scope...]` | Compare repos, generate pick-list |
| Import | `npm run import:lovable -- <path> <files...>` | Copy files, create branch, run cleanup |
| Cleanup | `npm run cleanup:lovable [-- scope]` | Run cleanup on already-imported files |
| Verify | `npm run verify` | Full lint + typecheck + test + build |

## What Gets Auto-Excluded

These files are **never imported** from Lovable (they differ intentionally):

- Config: `vite.config.ts`, `tsconfig*.json`, `eslint.config.js`, `components.json`
- Dependencies: `package.json`, `package-lock.json`, `bun.lockb`
- Project files: `.gitignore`, `.npmrc`, `.prettierrc`, `.cursorrules`, `README.md`
- Live-only: `src/main.tsx`, `src/lib/vitals.ts`, `src/components/ErrorBoundary.tsx`
- Supabase: `src/integrations/supabase/client.ts`, `types.ts`, `supabase/config.toml`
- Lovable-specific: any file matching `*lovable-tagger*` or `*lovable*.ts`

## Critical Rules

1. **NEVER import migrations** from Lovable — they have different IDs. Recreate as new migrations.
2. **NEVER import edge functions wholesale** — they lack CORS, auth, staging email override. Import file-by-file and adapt.
3. **NEVER overwrite files where live is ahead** — check diffs carefully, remove from pick-list.
4. **ALWAYS run `npm run verify`** before committing.
5. **ALWAYS push through develop → preprod → main** — never push directly to main.

## Data Sync (Database Content)

For importing database content (programs, modules, assessment questions, etc.) created in Lovable:

1. Use `scripts/export-lovable-data.sql` queries in Lovable's Supabase SQL Editor
2. Generate idempotent INSERT SQL from the exported JSON
3. Test on preprod first, then apply to prod
4. Update `supabase/seed.sql` so data survives `supabase db reset`

See `docs/LOVABLE_INTEGRATION.md` for full details.

## Dry-Run Example (2026-02-14)

Current state: 507 identical files, 9 modified (all live-ahead), 0 new, 5 auto-excluded.

The 9 modified files are all changes we made in the live repo that Lovable doesn't have yet:
- 6 files: `is_published` → `visibility` cleanup
- 1 file: Stripe hardcoded price IDs removal
- 2 files: `user!.id` → `user.id` null guard fix

**None should be imported** — importing them would revert our production fixes. This is the correct behavior: the diff shows them as "modified" and you'd remove them all from the pick-list.
