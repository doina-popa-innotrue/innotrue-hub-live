# InnoTrue Hub — Day-to-Day Workflow Guide

> A step-by-step guide to working with the InnoTrue Hub development setup. Covers which tool to use, when, and in what order — from planning a change to deploying it to production.

---

## Table of Contents

1. [Your Toolbox](#1-your-toolbox)
2. [Daily Development Workflow](#2-daily-development-workflow)
3. [Working in Cursor](#3-working-in-cursor)
4. [Working in Claude Code (Terminal)](#4-working-in-claude-code-terminal)
5. [Working in Supabase Dashboard](#5-working-in-supabase-dashboard)
6. [Working in GitHub](#6-working-in-github)
7. [Working in Cloudflare Pages](#7-working-in-cloudflare-pages)
8. [Working in Sentry](#8-working-in-sentry)
9. [Common Scenarios (Step-by-Step)](#9-common-scenarios-step-by-step)
10. [Testing Workflows](#10-testing-workflows)
11. [Deployment Checklist](#11-deployment-checklist)
12. [AI-Assisted Development Best Practices](#12-ai-assisted-development-best-practices)
13. [Monitoring & Troubleshooting](#13-monitoring--troubleshooting)
14. [Quick Reference Card](#14-quick-reference-card)

---

## 1. Your Toolbox

Here are all the tools you use, what each one is for, and when to reach for it:

| Tool | What it does | When to use it |
|------|-------------|----------------|
| **Cursor IDE** | Write code, review diffs, run tests, use AI agent | Your primary workspace — 80% of your time |
| **Claude Code** (terminal) | AI-powered coding assistant in the terminal | Complex multi-file changes, refactoring, infrastructure setup |
| **Supabase Dashboard** | Manage database, auth, edge functions, secrets | Database changes, SQL queries, checking logs, user management |
| **GitHub** | Code hosting, PRs, CI results, secrets | Review CI results, manage repo secrets, create PRs |
| **Cloudflare Pages** | Frontend hosting, deployment logs | Check deploy status, view preview URLs |
| **Sentry** | Error monitoring | Investigate production errors, check error trends |
| **Google Cloud Console** | Vertex AI, service accounts | Rarely — only if AI config changes |
| **Resend Dashboard** | Email delivery logs | Check if emails were sent/delivered |
| **Stripe Dashboard** | Payment management | Subscription and payment issues |

---

## 2. Daily Development Workflow

This is the standard flow for any change, from idea to production:

### Phase 1: Plan (5 min)

**Where:** Your head, or a conversation with Cursor AI / Claude Code

1. Decide what you're building or fixing
2. Think about which files will be affected
3. If it's complex, ask Cursor AI or Claude Code to explore the codebase first

### Phase 1b: First-Time Setup (once per machine)

If this is your first time working on the repo, run:
```bash
npm install --legacy-peer-deps
```
This installs dependencies **and** git hooks (via the `prepare` script). The hooks provide:
- **Lovable merge protection** — blocks accidental merges from the Lovable remote
- **Branch safety warning** — reminds you to switch back to `develop` when on `main`/`preprod`

### Phase 2: Code (in Cursor)

1. **Open Cursor** with the project at `/Users/doina/.../Work_GDrive/innotrue-hub-live`
2. **Make sure you're on `develop`:**
   - Check the branch in Cursor's bottom-left status bar
   - If not on `develop`, switch: `git checkout develop`
3. **For a new feature, create a feature branch:**
   ```
   git checkout -b feature/my-feature develop
   ```
   For small fixes, you can work directly on `develop`.
4. **Write your code** — use Cursor's AI agent (Cmd+I) for help
5. **Save files** — Cursor auto-saves, but verify

### Phase 3: Verify (in Cursor)

Before committing, run these checks. Use **Terminal > Run Task** in Cursor:

1. **Run "CI: Full Quality Check"** — this runs lint + typecheck + unit tests + build
   - If anything fails, fix it before proceeding
2. **Run "E2E: Run All Tests"** — verifies the app works end-to-end
   - If tests fail, run "E2E: Run All Tests (Headed)" to see what's happening in the browser

### Phase 4: Commit & Push (in Cursor terminal or Claude Code)

1. **Stage your files:** `git add <specific-files>`
2. **Commit:** `git commit -m "Description of what you changed"`
3. **Push to remote:** `git push origin develop` (or your feature branch)

### Phase 5: Deploy to Staging (in Cursor terminal)

1. **Merge to preprod:**
   ```
   git checkout preprod
   git merge develop --no-edit
   git push origin preprod
   git checkout develop
   ```
2. **Wait for CI** — GitHub Actions runs quality checks + E2E tests on preprod
3. **Check CI results** in GitHub: Actions tab, look for green checkmarks
4. **Verify on staging** — Cloudflare Pages auto-deploys preview URL for preprod

### Phase 6: Deploy to Production

1. **Merge to main:**
   ```
   git checkout main
   git merge preprod --no-edit
   git push origin main
   git checkout develop
   ```
2. **Cloudflare Pages** auto-deploys to `app.innotrue.com`
3. **Check Sentry** — monitor for new errors in the first 30 minutes

---

## 3. Working in Cursor

Cursor is your primary development environment. Here's how to get the most out of it.

### Starting your session

1. Open Cursor
2. Open the project folder: `/Users/doina/.../Work_GDrive/innotrue-hub-live`
3. Check you're on the right branch (bottom-left status bar)
4. If the dev server isn't running, open a terminal and run `npm run dev`

### Using Cursor's AI Agent

**Open AI chat:** `Cmd+I` (inline) or `Cmd+L` (sidebar chat)

The AI agent automatically reads `.cursorrules` for project context. Use it for:

- **"How does X work in this codebase?"** — it will search files and explain
- **"Add a new field to the user profile page"** — it will find the right files and suggest changes
- **"Fix the TypeScript error in this file"** — it will read the error and fix it
- **"Write a unit test for this function"** — it knows the Vitest patterns from existing tests

**Tips for better AI results:**
- Be specific: "Add a loading spinner to the `/teaching` dashboard" beats "make it better"
- Reference existing patterns: "Follow the same pattern as `useClientProfile` hook"
- Let it read first: "Read `src/pages/admin/AdminDashboard.tsx` and then add a new statistics card"

### Running tests from Cursor

Use **Terminal > Run Task** (`Cmd+Shift+P` > "Tasks: Run Task"):

| When to use | Task to run |
|-------------|-------------|
| Before committing | **CI: Full Quality Check** |
| After changing UI/routes | **E2E: Run All Tests** |
| Debugging a failing E2E test | **E2E: Interactive UI Mode** |
| After changing a single test file | **E2E: Run Current File** |
| E2E tests behaving weirdly | **E2E: Clean Auth & Run All** |
| While developing a utility function | **Unit: Run Tests (Watch)** |

### Useful keyboard shortcuts in Cursor

| Shortcut | Action |
|----------|--------|
| `Cmd+I` | Inline AI edit |
| `Cmd+L` | AI sidebar chat |
| `Cmd+Shift+P` | Command palette |
| `Cmd+P` | Quick file open |
| `Cmd+Shift+F` | Search across files |
| `Cmd+B` | Toggle sidebar |
| `Ctrl+`` ` | Toggle terminal |

---

## 4. Working in Claude Code (Terminal)

Claude Code runs in your terminal and is best for tasks that span many files or require deep codebase understanding.

### When to use Claude Code vs Cursor AI

| Task | Use Cursor AI | Use Claude Code |
|------|--------------|-----------------|
| Edit a single file | Yes | — |
| Quick question about code | Yes | — |
| Multi-file refactoring | — | Yes |
| Infrastructure changes (CI, config) | — | Yes |
| Complex debugging across files | — | Yes |
| Database migration planning | — | Yes |
| Setting up new tooling | — | Yes |
| Git operations (merge, push, propagate) | — | Yes |

### How to start a Claude Code session

1. Open a terminal
2. Navigate to the project: `cd "/Users/doina/.../Work_GDrive/innotrue-hub-live"`
3. Start Claude Code: `claude`
4. Claude Code reads `~/.claude/` memory files for project context

### Tips for Claude Code

- **Start with context:** "I need to add email notifications for when a coach is assigned to a program. Check the existing email edge functions and propose how to implement it."
- **Be explicit about scope:** "Only modify files in `src/hooks/` and `src/pages/client/`"
- **Ask to verify before committing:** "Run typecheck and tests before committing"
- **Request propagation:** "Push to develop and propagate to preprod and main"

### Claude Code memory

Claude Code stores project knowledge in `~/.claude/projects/.../.../memory/MEMORY.md`. This file contains accumulated context about the project — completed work, known issues, architecture decisions. It persists across sessions.

If you start a new session about a topic covered in a previous session, mention it: "In a previous session we set up E2E tests. Now I want to add more test coverage for the admin pages."

---

## 5. Working in Supabase Dashboard

**URLs:**
- Preprod: `https://supabase.com/dashboard/project/jtzcrirqflfnagceendt`
- Production: `https://supabase.com/dashboard/project/qfdztdgublwlmewobxmx`

### When to use Supabase Dashboard

| Task | Where in Supabase |
|------|-------------------|
| Run a SQL query | SQL Editor |
| Check table data | Table Editor |
| View edge function logs | Edge Functions > Select function > Logs |
| Manage auth users | Authentication > Users |
| Set edge function secrets | Settings > Edge Functions > Add secret |
| Check database migrations | Database > Migrations |
| Configure OAuth providers | Authentication > Providers |
| Check Auth Email Hook | Authentication > Hooks |
| Configure email rate limits | Authentication > Email > SMTP Settings |
| Manage Auth Email Hook secret | Authentication > Hooks > Send Email > Secret |

### Auth Email Hook

The `send-auth-email` edge function handles auth emails (password reset, magic link, email change). It uses **Standard Webhooks** HMAC verification — not Bearer token auth.

**Note:** Signup confirmation emails are sent by `signup-user`, NOT by `send-auth-email`. The `signup-user` function creates users with `email_confirm: true` to suppress the auth hook email, and sends its own custom verification email via Resend.

**Required setup per Supabase project:**
1. **Authentication > Hooks:** Enable "Send Email" hook, point URL to the `send-auth-email` function
2. **Edge Functions > Secrets:** Set `SEND_EMAIL_HOOK_SECRET` = the `v1,whsec_...` value from the hook's Secret field
3. **Authentication > Email > SMTP Settings:** Configure Resend SMTP (`smtp.resend.com`, port `465`, username `resend`, password = Resend API key) — this unlocks rate limit configuration

**Rate limits:** Default is 2/hour. Increase temporarily in Authentication > Rate Limits when testing, then reset. Requires custom SMTP to be configured (see step 3).

### Important Supabase operations

**Creating a test user (for E2E tests or manual testing):**

Use the SQL Editor. Example pattern:
```sql
INSERT INTO auth.users (id, instance_id, email, encrypted_password, ...)
VALUES ('...', '...', 'user@example.com', crypt('password', gen_salt('bf')), ...);

INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, ...)
VALUES (...);

INSERT INTO public.profiles (id, name) VALUES ('...', 'User Name');
INSERT INTO public.user_roles (user_id, role) VALUES ('...', 'client');
```

Always use `crypt('password', gen_salt('bf'))` for the password — never a hardcoded hash.

**Deploying edge functions:**

If you change edge functions locally:
```bash
supabase functions deploy <function-name> --project-ref <project-ref>
```

**Setting secrets:**
```bash
supabase secrets set KEY=value --project-ref <project-ref>
```
Or do it through Dashboard > Settings > Edge Functions.

### Rule: Always test on preprod first

Before making any database changes in production:
1. Run the SQL on **preprod** first
2. Verify the result
3. Then run the same SQL on **production**

---

## 6. Working in GitHub

**URL:** `https://github.com/doina-popa-innotrue/innotrue-hub-live`

### When to check GitHub

| Task | Where in GitHub |
|------|----------------|
| Check CI results | **Actions** tab |
| View failed test details | Actions > Click workflow run > Click failed job |
| Download Playwright report | Actions > Click workflow run > Artifacts section |
| Manage repository secrets | Settings > Secrets and variables > Actions |
| Review code changes | Pull Requests tab (if using PRs) |
| Check deployment triggers | Actions tab — look for runs triggered by push to `main` |

### Reading CI results

1. Go to **Actions** tab
2. Find the latest workflow run for your branch
3. **Green checkmark** = all passed
4. **Red X** = something failed — click to see which step

If E2E tests fail:
- Click the failed job
- Scroll to "Run E2E tests" step to see error output
- Download the **playwright-report** artifact for detailed HTML report with screenshots

### Managing secrets

GitHub repository secrets are needed for E2E tests in CI. To add or update:

1. Go to repo → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret** (or edit existing)
3. Current secrets: `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_CLIENT_EMAIL`, `E2E_CLIENT_PASSWORD`, `E2E_COACH_EMAIL`, `E2E_COACH_PASSWORD`, `E2E_INSTRUCTOR_EMAIL`, `E2E_INSTRUCTOR_PASSWORD`

---

## 7. Working in Cloudflare Pages

**URL:** Cloudflare Dashboard > Pages > your project

### What Cloudflare Pages does

- Automatically builds and deploys the frontend when you push to GitHub
- `main` branch → `app.innotrue.com` (production)
- Other branches → preview URLs (staging/testing)

### When to check Cloudflare Pages

- **After pushing to `main`:** Verify the production deploy succeeded
- **Build failures:** Check build logs in Cloudflare Pages dashboard
- **Environment variables:** The Cloudflare Pages build command sets `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SENTRY_DSN`, and `VITE_APP_ENV` based on the branch

### You rarely need to touch Cloudflare Pages

It's mostly set-and-forget. The only reasons to visit:
- Build failed (check logs)
- You need to update the build command (e.g., adding a new env var)
- You want to see the preview URL for a branch

---

## 8. Working in Sentry

**URL:** `https://innotrue.sentry.io`

### When to check Sentry

- **After deploying to production:** Check for new errors in the first 30 minutes
- **When users report issues:** Search by error ID (users see it in the error boundary UI)
- **Weekly:** Glance at error trends to catch regressions

### What Sentry shows you

- **Issues:** Grouped errors with frequency, user impact, and stack traces
- **Performance:** Web vitals (CLS, INP, LCP, FCP, TTFB) — sent from `src/lib/vitals.ts`
- **Session Replay:** Video replays of sessions where errors occurred (`replaysOnErrorSampleRate: 1.0`)

### Sentry is production-only

Sentry only initializes when both `VITE_SENTRY_DSN` and `VITE_APP_ENV=production` are set. No data is sent from localhost or staging.

---

## 9. Common Scenarios (Step-by-Step)

### Scenario A: Fix a bug reported by a user

1. **Sentry:** Search for the error by ID or description. Read the stack trace and session replay.
2. **Cursor:** Open the relevant file. Use AI to understand the issue: "This function crashes when `profileData` is null. Fix it."
3. **Cursor:** Run "CI: Full Quality Check" to verify fix doesn't break anything.
4. **Cursor:** Run "E2E: Run All Tests" if the fix touches UI or routes.
5. **Terminal:** Commit, push to `develop`, propagate to `preprod` → `main`.
6. **Sentry:** Monitor for 30 minutes to confirm the error stops occurring.

### Scenario B: Add a new page/feature

1. **Claude Code or Cursor AI:** "I want to add a page where coaches can view their session history. Explore the existing coach pages and propose how to implement it."
2. **Cursor:** Create the new page component in `src/pages/instructor/` or `src/pages/client/` (depending on the role).
3. **Cursor:** Add the route in `src/App.tsx` (lazy-loaded).
4. **Cursor:** Add any new hooks in `src/hooks/`.
5. **Cursor:** Run all tests.
6. **Cursor:** Write an E2E test in `e2e/tests/{role}/` for the new page.
7. **Terminal:** Commit, push, propagate.

### Scenario C: Change the database schema

1. **Supabase Dashboard (preprod):** Write and test your SQL migration in the SQL Editor.
2. **Local:** Create a migration file:
   ```bash
   supabase migration new my_change_description
   ```
   This creates a file in `supabase/migrations/`. Paste your SQL.
3. **Push migrations** using the npm script:
   ```bash
   npm run push:migrations -- preprod          # Push to preprod only
   npm run push:migrations -- all              # Push to all 3 envs (preprod → prod → sandbox)
   npm run push:migrations -- --dry-run        # Preview pending migrations
   ```
4. **Cursor:** If the change affects TypeScript types, regenerate types:
   ```bash
   supabase gen types typescript --project-id jtzcrirqflfnagceendt > src/integrations/supabase/types.ts
   ```
5. **Cursor:** Update any affected components/hooks to use new schema.
6. **Test:** Run unit and E2E tests.
7. **Deploy edge functions** if they reference new tables/columns:
   ```bash
   npm run deploy:functions -- preprod --only <function-name>
   ```
8. **After staging verification:** Push migration and deploy to production too.

### Scenario D: Change an edge function

1. **Cursor:** Edit the function in `supabase/functions/<name>/index.ts`.
2. **Test locally** (optional): `supabase functions serve <name>`
3. **Deploy using npm scripts:**
   ```bash
   npm run deploy:functions -- preprod --only <name>    # Deploy to preprod
   npm run deploy:functions -- prod --only <name>       # Deploy to prod
   npm run deploy:functions                              # Deploy ALL functions to prod
   npm run deploy:functions -- --dry-run                 # Preview what would deploy
   ```
4. **Verify** by testing the feature that uses this function.
5. **Supabase Dashboard (preprod):** Check edge function logs for errors.
6. **Deploy to production** once verified.

### Scenario E: Update platform Terms of Service

1. **Supabase Dashboard (preprod):** In the SQL Editor:
   ```sql
   UPDATE platform_terms SET is_current = false WHERE is_current = true;
   INSERT INTO platform_terms (title, content_html, version, is_current, is_blocking_on_update, effective_from)
   VALUES ('Terms v2', '<h1>Updated Terms</h1>...', 2, true, false, now());
   ```
   - `is_blocking_on_update = true` → users MUST accept before using the app
   - `is_blocking_on_update = false` → users see a banner but can dismiss it
2. **Test on preprod:** Log in and verify the ToS gate/banner appears.
3. **Apply same SQL on production.**

### Scenario F: Sync code between Lovable and Live repo

**Push live changes TO Lovable sandbox:**
```bash
npm run update:lovable                        # Merge main → Lovable main
npm run update:lovable -- --source preprod    # Merge preprod → Lovable main
npm run update:lovable -- --dry-run           # Preview without pushing
```

**Import Lovable changes INTO the live repo:**
```bash
npm run sync:lovable                          # Full pipeline: pull → diff → pick → import → cleanup → PR
npm run sync:lovable -- --diff-only           # Just compare, no import
npm run sync:lovable -- --no-pr               # Import but skip PR creation
npm run sync:lovable -- --scope src/components # Scope to specific dirs
```

**Key points:**
- Lovable sandbox is a **separate repo** — used for prototyping only
- Code always flows through the live repo's branch pipeline (`develop` → `preprod` → `main`)
- The sync script auto-excludes config files (vite.config, package.json, client.ts, types.ts)
- After `update:lovable`, Lovable IDE may need a refresh/pull to see new code
- **A `pre-merge-commit` git hook blocks `git merge lovable/main`** — prevents Lovable's `as any` casts and stale types from polluting the codebase. Cherry-pick individual commits if needed.
- Full docs: `docs/LOVABLE_IMPORT_QUICKSTART.md` and `docs/LOVABLE_INTEGRATION.md`

### Scenario G: Sync config data or storage between environments

**Sync config tables (plans, features, programs, etc.):**
```bash
npm run sync:data -- --from prod --to preprod                    # Full config sync
npm run sync:data -- --from prod --to preprod --tables programs   # Specific tables only
npm run sync:data -- --from prod --export-only                   # Export JSON only
```

**Sync storage buckets:**
```bash
npm run sync:storage -- --from prod --to preprod                 # All 15 buckets
npm run sync:storage -- --from prod --to preprod --buckets avatars program-logos  # Specific buckets
```

**Backup storage:**
```bash
npm run backup:storage
```

**Key points:**
- Data sync only copies safe config tables (26 tables) — user data is blocked
- All scripts support `--dry-run`
- Full docs: `docs/SUPABASE_OPS_QUICKSTART.md`

### Scenario H: Add a new E2E test

1. **Cursor:** Create or edit a test file in `e2e/tests/{role}/`.
2. **Follow existing patterns** — import from `../../fixtures/auth`, use role fixtures (`adminPage`, `clientPage`, etc.).
3. **Run:** "E2E: Run Current File" to test just your new file.
4. **Run:** "E2E: Run All Tests" to make sure nothing else broke.
5. **Commit and push.**

---

## 10. Testing Workflows

### Before every commit

Run the "CI: Full Quality Check" task in Cursor. This catches:
- Lint errors
- TypeScript type errors
- Unit test failures
- Build failures

### Before merging to preprod

Run "E2E: Run All Tests". This catches:
- Login/auth regressions
- Page-level rendering issues
- Navigation/routing bugs

### When E2E tests behave oddly

1. Run "E2E: Clean Auth & Run All" — stale cached auth sessions are the most common cause
2. If still failing, run "E2E: Interactive UI Mode" to watch and debug step-by-step
3. If a test is flaky (passes sometimes, fails sometimes), add `test.retry(2)` in the spec

### When to write new tests

- **Unit tests:** When you add utility functions, data transformations, or business logic in `src/lib/`
- **E2E tests:** When you add new pages, change navigation flows, or modify auth behavior
- **Don't test:** UI styling, third-party library internals, auto-generated code

---

## 11. Deployment Checklist

### Pre-deployment (before merging to main)

- [ ] All changes committed to `develop`
- [ ] `CI: Full Quality Check` passes locally
- [ ] `E2E: Run All Tests` passes locally
- [ ] Merged `develop` → `preprod`
- [ ] CI passes on `preprod` (check GitHub Actions)
- [ ] Manually tested the feature on staging (if applicable)
- [ ] Edge functions deployed to preprod (if changed)
- [ ] Database migrations applied to preprod (if changed)

### Deployment

- [ ] Merged `preprod` → `main`
- [ ] CI passes on `main` (check GitHub Actions)
- [ ] Cloudflare Pages deployment succeeded
- [ ] Edge functions deployed to production (if changed)
- [ ] Database migrations applied to production (if changed)

### Post-deployment

- [ ] Checked `app.innotrue.com` loads correctly
- [ ] Monitored Sentry for 30 minutes — no new errors
- [ ] Switched back to `develop` branch

---

## 12. AI-Assisted Development Best Practices

### Use AI for the right tasks

| Great for AI | Not great for AI |
|-------------|-----------------|
| Exploring unfamiliar code | Making business decisions |
| Writing boilerplate (hooks, components) | Security-critical logic review |
| Debugging TypeScript errors | Understanding user requirements |
| Writing tests | Deciding product features |
| Refactoring (rename, restructure) | Choosing architecture (have AI propose, you decide) |
| Git operations | — |

### Keep `.cursorrules` updated

After any significant change, ask yourself: "Would a new developer or AI agent need to know about this?" If yes, update `.cursorrules`.

Examples of when to update:
- Added a new shared utility or hook pattern
- Changed the file structure
- Introduced a new convention (e.g., "all new forms use Zod")
- Changed the database schema significantly

### Session continuity with Claude Code

When starting a new Claude Code session on a topic from a previous one:
- Reference what was done: "Previously we set up Sentry. Now I want to add custom error tracking for payment failures."
- Claude Code reads `MEMORY.md` automatically, so it has context from past sessions
- For complex tasks, ask Claude Code to update `MEMORY.md` when done

### Prompt patterns that work well

**For exploration:**
> "Read the files related to the credit system and explain how credits are consumed. List all hooks and edge functions involved."

**For implementation:**
> "Add a new hook `useCoachSessions` that fetches all sessions for the current coach. Follow the same pattern as `useClientProfile` in `src/hooks/useClientProfile.ts`."

**For fixing:**
> "The E2E test for admin dashboard is failing. Read the test file, the page component, and the auth setup. Identify what's wrong and fix it."

**For deployment:**
> "Run typecheck and unit tests. If they pass, commit with message 'Fix credit balance calculation' and push to develop. Then propagate to preprod and main."

---

## 13. Monitoring & Troubleshooting

### Daily monitoring routine (2 minutes)

1. **Sentry:** Open the dashboard. Any new issues? Any spike in error rate?
2. **Done.** That's it for routine monitoring.

### When something is broken in production

1. **Sentry:** Find the error. Read the stack trace. Check session replay.
2. **Identify the cause:** Is it a code bug, a database issue, or an edge function error?
3. **For code bugs:** Fix in Cursor, test, deploy via the standard flow.
4. **For edge function errors:** Check Supabase Dashboard > Edge Functions > Logs.
5. **For database issues:** Check Supabase Dashboard > SQL Editor or Table Editor.

### When CI fails

1. **GitHub Actions:** Click the failed run, read the error in the failed step.
2. **Common failures:**
   - **Lint:** Usually a missing import or unused variable. Fix in Cursor.
   - **Typecheck:** TypeScript error. Fix in Cursor.
   - **Unit tests:** A test assertion failed. Run "Unit: Run All Tests" locally to reproduce.
   - **Build:** Usually a missing env var or import error.
   - **E2E:** Authentication failed (credential issue) or UI changed (test needs updating).

### When E2E auth stops working

Usually means the test user's credentials changed or expired on preprod:
1. Try logging in manually at the preprod URL with the test credentials
2. If the password doesn't work, reset it in Supabase Dashboard > Authentication > Users
3. Or create a new user via SQL (use `crypt('password', gen_salt('bf'))` for the password)
4. Update the GitHub secrets if credentials changed

---

## 14. Quick Reference Card

### Commands you'll use most often

| What | Command / Action |
|------|-----------------|
| First-time setup (installs deps + hooks) | `npm install --legacy-peer-deps` |
| Start dev server | `npm run dev` |
| Run all quality checks | `npm run verify` or Cursor > Run Task > "CI: Full Quality Check" |
| Run E2E tests | Cursor > Terminal > Run Task > "E2E: Run All Tests" |
| Commit changes | `git add <files> && git commit -m "message"` |
| Push to develop | `git push origin develop` |
| Deploy to staging | `git checkout preprod && git merge develop --no-edit && git push origin preprod && git checkout develop` |
| Deploy to production | `git checkout main && git merge preprod --no-edit && git push origin main && git checkout develop` |
| Deploy edge functions | `npm run deploy:functions -- preprod` or `npm run deploy:functions` (prod) |
| Deploy specific function | `npm run deploy:functions -- preprod --only send-auth-email` |
| Push migrations | `npm run push:migrations -- all` (all envs) |
| Sync config data | `npm run sync:data -- --from prod --to preprod` |
| Sync storage | `npm run sync:storage -- --from prod --to preprod` |
| Push code to Lovable | `npm run update:lovable` |
| Import from Lovable | `npm run sync:lovable` |
| Backup storage | `npm run backup:storage` |
| Check CI results | GitHub > Actions tab |
| Check production errors | Sentry dashboard |
| Run SQL on preprod | Supabase Dashboard (preprod) > SQL Editor |

### URLs you'll visit

| What | URL |
|------|-----|
| Production app | `https://app.innotrue.com` |
| GitHub repo | `https://github.com/doina-popa-innotrue/innotrue-hub-live` |
| GitHub Actions (CI) | `https://github.com/doina-popa-innotrue/innotrue-hub-live/actions` |
| Supabase (preprod) | `https://supabase.com/dashboard/project/jtzcrirqflfnagceendt` |
| Supabase (production) | `https://supabase.com/dashboard/project/qfdztdgublwlmewobxmx` |
| Sentry | `https://innotrue.sentry.io` |
| Cloudflare Pages | Cloudflare Dashboard > Pages |

### File locations you'll reference

| What | Path |
|------|------|
| Project root | `/Users/doina/.../Work_GDrive/innotrue-hub-live` |
| AI context | `.cursorrules` |
| Architecture reference | `docs/TECHNICAL_REFERENCE.md` |
| This workflow guide | `docs/WORKFLOW_GUIDE.md` |
| Environment config reference | `docs/ENVIRONMENT_CONFIGURATION.md` |
| Integration setup guide | `docs/INTEGRATION_SETUP_GUIDE.md` |
| Supabase ops quickstart | `docs/SUPABASE_OPS_QUICKSTART.md` |
| Lovable sync quickstart | `docs/LOVABLE_IMPORT_QUICKSTART.md` |
| Git hooks (committed source) | `scripts/hooks/` |
| CI pipeline | `.github/workflows/ci.yml` |
| E2E tests | `e2e/tests/` |
| Unit tests | `src/lib/__tests__/` |
| Edge functions | `supabase/functions/` |
| Auth email hook | `supabase/functions/send-auth-email/index.ts` |
| Seed data | `supabase/seed.sql` |
| Lovable sandbox clone | `.../Work_GDrive/lovable-sandbox/` |
| Claude Code memory | `~/.claude/projects/.../.../memory/MEMORY.md` |
