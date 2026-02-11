# InnoTrue Hub App — Production Migration Plan

**Date:** February 8, 2026
**Last updated:** February 12, 2026
**Prepared by:** Technical Analysis
**Scope:** Migration from Lovable Cloud to production-ready infrastructure

---

## Migration Progress

| Step | Description | Status |
|------|-------------|--------|
| 1 | Fresh Git repository + branching (main/preprod/develop) | DONE |
| 2 | Remove Lovable dependencies | DONE |
| 3 | Environment separation (.env.example, .gitignore) | DONE |
| 4c | SPA routing (_redirects, _headers) | DONE |
| 4 | Cloudflare Pages deployment (prod + preview branches) | DONE |
| 6 | Vitest unit testing (210 tests, 11 test files) | DONE |
| 7 | Sentry error monitoring (verified in production) | DONE (Feb 11) |
| 8 | GitHub Actions CI (lint, typecheck, test, build) | DONE (Feb 11) |
| 9a | Supabase projects created (preprod + prod) | DONE |
| 9b | Migrations pushed to preprod (393 migrations) | DONE |
| 9b | Seed data applied to preprod | DONE |
| 9b | Edge functions deployed to preprod (60 functions) | DONE |
| 9d | Migrations pushed to prod (393 migrations) | DONE |
| 9d | Seed data applied to prod | DONE |
| 9d | Edge functions deployed to prod (60 functions) | DONE |
| 9c | Pre-prod edge function secrets | DONE |
| 9e | Prod edge function secrets | DONE |
| 9f | Google OAuth config (both projects) | DONE |
| 9f | Auth Email Hook (both projects) | DONE — verify email delivery |
| 9f | Auth redirect URLs (both projects) | DONE |
| 9f | Resend domain DNS verification | DONE — verify email delivery |
| 9g | Cloudflare Pages environment variables | DONE (via CF_PAGES_BRANCH build command) |
| 12 | Code splitting / lazy loading (82% bundle reduction) | DONE |
| — | AI provider: Vertex AI Gemini 3 Flash (EU/Frankfurt) | DONE |
| — | CSP hardened (removed Lovable/OpenAI/Anthropic domains) | DONE |
| — | Domain refs updated (app.innotrue.com) | DONE |
| — | robots.txt, sitemap.xml, README.md rewritten | DONE |
| — | Email audit: all 13 functions via Resend, old domain fixed | DONE |
| — | Staging email override (all 13 functions wired) | DONE |
| — | Database seed file (supabase/seed.sql, 12 sections) | DONE |
| — | Old domain fallbacks fixed (7 occurrences in 3 functions) | DONE (Feb 10) |
| — | Staging env verified (login works on preprod + prod) | DONE (Feb 10) |
| 15 | Cursor IDE setup | DONE (Feb 11) |
| — | PR #1 merged: CI + Sentry + domain fixes deployed to prod | DONE (Feb 11) |
| 5a | Strict TypeScript Phase 1 (7 flags + 26 fixes) | DONE (Feb 12) |
| 5b | Strict TypeScript Phase 2 (strictNullChecks, ~269 errors) | PENDING |
| 10a | RLS audit (276 tables, all RLS enabled, 41 with policies) | DONE (Feb 12) |
| 10b | Edge function validation audit (23 ✅, 28 ⚠️, 6 ❌, 6 ℹ️) | DONE (Feb 12) |
| 11 | Supabase Pro upgrade | DONE (Feb 11) |
| 13 | PWA hardening (auth exclusion, caching strategies) | DONE (Feb 11) |
| 14 | Web Vitals monitoring (web-vitals v5 → Sentry) | DONE (Feb 11) |

---

## Table of Contents

1. [Current State Summary](#1-current-state-summary)
2. [Areas to Improve](#2-areas-to-improve)
3. [Recommended Production Stack](#3-recommended-production-stack)
4. [Recommended AI Development Tooling](#4-recommended-ai-development-tooling)
5. [Migration Steps](#5-migration-steps)
   - Phase 1: Foundation
   - Phase 2: Quality & Safety
   - Phase 3: Database & Backend Hardening
   - Phase 4: Performance & Reliability
6. [Priority Order](#6-priority-order)
7. [Risk Considerations](#7-risk-considerations)

---

## 1. Current State Summary

The InnoTrue Hub App is a substantial multi-tenant SaaS platform with the following scope:

| Metric | Value |
|---|---|
| Total TypeScript/TSX files | 507 |
| Custom React hooks | 65 |
| Supabase edge functions | 63 |
| Database migrations | 393 |
| Page-level components | 23 |
| User roles | admin, coach, client, instructor, org_admin |

### Current Tech Stack

- **Frontend:** React 18.3.1, TypeScript 5.8.3, Vite 5.4.19
- **Routing:** React Router DOM 6.30.1
- **UI:** Tailwind CSS 3.4.17, shadcn/ui (Radix UI), Lucide Icons
- **State Management:** TanStack React Query 5.83.0, React Context (AuthContext)
- **Backend:** Supabase (PostgreSQL + Auth + Storage + Edge Functions)
- **Auth:** Supabase Auth (native OAuth — Lovable Auth removed)
- **AI Backend:** Google Vertex AI, Gemini 3 Flash (EU/Frankfurt, europe-west3)
- **Rich Text:** Tiptap 3.14.0
- **Forms:** React Hook Form 7.61.1, Zod 3.25.76
- **Charts:** Recharts 2.15.4
- **Calendar:** React Big Calendar 1.19.4
- **File Generation:** jsPDF 3.0.4, docx 9.5.1
- **Testing:** Vitest 4.0.18 (210 unit tests) + Playwright 1.57.0 (E2E)
- **Deployment:** Cloudflare Pages (migrating from Lovable Cloud)
- **Domain:** app.innotrue.com

### Key Features

- Multi-tenant organization management
- Role-based access control (5 roles)
- Learning management (programs, modules, tracks, assessments)
- Decision tracking and AI-powered insights
- Goal management with categories
- Group collaboration and sessions
- Credit/payment system with add-ons
- Rich content editing
- Calendar and scheduling integrations (Google Calendar, Cal.com)
- SSO integrations (TalentLMS, Circle, Google Workspace, Lucid)
- Real-time data with Supabase subscriptions
- PWA with offline support
- Dark mode

---

## 2. Areas to Improve

### 2.1 TypeScript Strictness is Disabled

**Issue:** `tsconfig.json` has `noImplicitAny: false` and `strictNullChecks: false`. This masks bugs that will surface in production. Lovable generates loose types; a production codebase needs strict mode.

**Impact:** High — runtime errors that TypeScript should catch at compile time.

### 2.2 No Unit or Integration Tests — RESOLVED

**Issue:** Only Playwright E2E tests exist. With 507 files and complex business logic (credits, entitlements, assessments), there are no component-level or unit tests to catch regressions.

**Impact:** High — changes to business logic have no safety net.

**Resolution (Feb 9, 2026):** Vitest installed with 210 unit tests across 11 test files covering: admin schemas, date/scheduling utilities, decision templates, ICS generation, LinkedIn utilities, notification helpers, recurring dates, tier access logic, utility functions, and Zod validations.

### 2.3 No CI/CD Pipeline

**Issue:** No GitHub Actions or automated linting/testing/deployment. Everything runs through Lovable's dashboard, which is a single point of failure.

**Impact:** High — broken code can ship to production without checks.

### 2.4 Lovable Vendor Lock-in — RESOLVED

**Issue:** Three dependencies tie the app to Lovable:
- `@lovable.dev/cloud-auth-js` for OAuth
- `lovable-tagger` plugin in Vite config
- `.lovable/` configuration directory

**Impact:** Medium — blocks migration to any other hosting platform.

**Resolution (Feb 9, 2026):** All Lovable dependencies removed. OAuth replaced with Supabase built-in OAuth. `.lovable/` directory deleted. All domain references updated from `innotruehub.lovable.app` to `app.innotrue.com`. AI gateway replaced with centralized Vertex AI config (`supabase/functions/_shared/ai-config.ts`). CSP cleaned of Lovable/OpenAI/Anthropic domains. `grep -ri "lovable" src/ supabase/` returns zero results.

### 2.5 Hardcoded Supabase Credentials — PARTIALLY RESOLVED

**Issue:** The `.env` file contains the Supabase publishable key and is likely committed to version control. No separation between development, staging, and production environments.

**Impact:** High — security risk and inability to test safely.

**Partial Resolution (Feb 9, 2026):** `.gitignore` updated with `.env`, `.env.local`, `.env.development`, `.env.staging`, `.env.production` patterns. `.env.example` template created. Full environment separation (staging/production Supabase projects) still pending.

### 2.6 No Error Monitoring or Observability

**Issue:** No Sentry, no structured logging, no performance monitoring. Production errors are invisible unless a user reports them.

**Impact:** High — no visibility into production health.

### 2.7 No Database Branching or Staging Environment

**Issue:** 393 migrations run against presumably one Supabase project. No staging database exists for safe testing of schema changes.

**Impact:** High — database changes are tested directly against production data.

### 2.8 Large Component Files & Hook Proliferation

**Issue:** 65 custom hooks suggests some could be consolidated. Some components likely handle too many concerns, making them difficult to test and maintain.

**Impact:** Medium — maintainability and onboarding difficulty.

### 2.9 No Rate Limiting or API Protection

**Issue:** Edge functions lack middleware for rate limiting, input validation, or abuse prevention. Public-facing functions are exposed.

**Impact:** Medium — vulnerability to abuse and denial-of-service.

### 2.10 PWA Configuration Needs Hardening

**Issue:** 6MB service worker cache limit with Supabase endpoints cached. Risk of serving stale data, especially for auth-related endpoints.

**Impact:** Medium — users could see outdated data or experience auth issues.

---

## 3. Recommended Production Stack

| Layer | Current (Lovable) | Recommended | Why |
|---|---|---|---|
| **Hosting** | Lovable Cloud | **Cloudflare Pages** | Unlimited bandwidth on free tier, 300+ global PoPs, faster than alternatives, $5/mo paid plan, no vendor lock-in (serves static files) |
| **Database** | Supabase (free/shared) | **Supabase Pro** | Dedicated compute, point-in-time recovery, database branching, 8GB RAM, no connection limits |
| **Auth** | Supabase Auth + Lovable Auth | **Supabase Auth only** | Remove vendor dependency, configure OAuth providers directly in Supabase dashboard |
| **CI/CD** | Lovable dashboard | **GitHub Actions** | Automated lint, type-check, test, build, deploy pipeline |
| **Error Monitoring** | None | **Sentry** | React SDK with browser tracing, source maps, release tracking |
| **Web Analytics** | Custom edge function | Keep custom + add **Cloudflare Web Analytics** | Free, privacy-friendly, built into Cloudflare dashboard |
| **Email** | Supabase edge functions | **Resend** (already in use) | 13 edge functions already send via Resend; Auth Hook needed for auth emails |
| **Secrets Management** | `.env` file | **Cloudflare Pages Environment Variables** + GitHub Actions secrets | Per-environment (production/preview), encrypted |
| **Unit Testing** | None | **Vitest** | Fast, Vite-native, compatible with Testing Library |
| **E2E Testing** | Playwright | **Playwright** (keep) | Already configured, industry standard |
| **DNS/CDN** | Lovable | **Cloudflare** (built-in) | DDoS protection, edge caching, SSL, all included with Pages |

### Why Cloudflare Pages over Vercel

| Factor | Vercel | Cloudflare Pages |
|---|---|---|
| **Free tier bandwidth** | 100GB | Unlimited |
| **Free tier builds** | 100/day | 500/month |
| **Pro plan cost** | $20/month | $5/month |
| **Global edge PoPs** | ~30 regions | 300+ cities |
| **SPA support** | Requires `vercel.json` rewrites | Built-in SPA mode (one toggle) |
| **Vendor lock-in** | Medium (serverless tied to Vercel) | Low (just static hosting) |
| **Supabase compatibility** | Equal | Equal |
| **Custom domains** | Yes | Yes (with free Cloudflare DNS) |
| **Preview deploys** | Yes (per PR) | Yes (per branch/PR) |

Since the InnoTrue Hub App is a Vite SPA with Supabase handling all backend logic, there is no need for Vercel's server-side rendering features. Cloudflare Pages is cheaper, faster, and has less lock-in.

### Estimated Monthly Costs

| Service | Plan | Cost |
|---|---|---|
| Cloudflare Pages | Free or Workers Paid | $0–5/month |
| Supabase | Pro | $25/month |
| Sentry | Team | $26/month |
| Resend or Postmark | Starter | $0–20/month |
| GitHub | Team (if needed) | $4/user/month |
| **Total** | | **~$55–80/month** |

---

## 4. Recommended AI Development Tooling

Moving away from Lovable Cloud does not mean losing the AI-assisted "vibe coding" experience. The following tools provide the same describe-and-generate workflow with full production control.

### Primary: Cursor IDE ($20/month)

- Full IDE (VS Code fork) with AI built into every interaction
- **Chat mode:** Describe what you want in natural language, get multi-file code changes
- **Composer mode:** AI generates entire features across multiple files, similar to Lovable
- **Cmd+K inline editing:** Highlight code, describe changes, AI rewrites it
- Reads your entire codebase (all 507 files) for context-aware suggestions
- Works with Git, terminal, Supabase CLI — everything in one window
- Tab autocomplete that understands your patterns and codebase conventions

**When to use:** Daily development, new features, bug fixes, UI work

### Secondary: Claude Code (included in Anthropic plan)

- Terminal-based AI agent that reads, writes, and runs your entire codebase
- Best for complex multi-file refactors, architecture changes, and migration tasks
- Can run tests, check builds, and iterate until things work
- Operates autonomously on larger tasks

**When to use:** Architecture changes, complex debugging, migrations, code reviews

### Optional: Lovable as a Design Scratchpad

- Keep using Lovable for rapid UI prototyping and visual design exploration
- Export/copy generated components into your production Git repository
- Treat it as a "design tool" rather than your production environment

**When to use:** Quick visual prototyping, exploring layout ideas before committing to code

### Optional: Bolt.new / v0.dev for Component Generation

- Generate individual components or page layouts from descriptions
- Copy the output into your codebase and refine with Cursor
- Good for "I need a dashboard card that shows X" type tasks

**When to use:** One-off component generation, design inspiration

### Recommended AI Tooling Combo

| Tool | Purpose | Cost |
|---|---|---|
| **Cursor** | Daily AI-assisted development (replaces Lovable's chat-to-code) | $20/month |
| **Claude Code** | Complex tasks, architecture, migrations | Included in Anthropic plan |
| **Lovable** (optional) | Visual UI prototyping scratchpad | Existing plan |
| **Total AI tooling** | | **$20/month** |

### Complete Monthly Cost Summary (Infrastructure + AI Tooling)

| Category | Service | Cost |
|---|---|---|
| **Hosting** | Cloudflare Pages | $0–5/month |
| **Database** | Supabase Pro | $25/month |
| **Monitoring** | Sentry Team | $26/month |
| **Email** | Resend/Postmark | $0–20/month |
| **Source Control** | GitHub (Team if needed) | $0–4/user/month |
| **AI Development** | Cursor Pro | $20/month |
| **AI Development** | Claude Code | Included |
| **Total** | | **~$75–100/month** |

---

## 5. Migration Steps

### Phase 1: Foundation (Week 1–2)

#### Step 1 — Create Fresh Git Repository ✅ COMPLETED (Feb 9, 2026)

> **Why a fresh repo?** The Lovable-managed repo has their deployment config, commit history tied to their pipeline, and potentially committed secrets. A clean repo from the updated codebase is the safest approach. The Lovable repo stays available if you ever need to reference its history.

**Repository:** https://github.com/doina-popa-innotrue/innotrue-hub-live.git (Private)

**Branches:** `main` (production) → `preprod` (QA) → `develop` (daily work)

**1a. Create a new GitHub repository:**

1. Go to https://github.com/new
2. Name: `innotrue-hub` (or your preference)
3. Visibility: **Private**
4. Do NOT initialize with README, .gitignore, or license (we have all of these already)
5. Click "Create repository"
6. Copy the HTTPS URL (e.g., `https://github.com/your-org/innotrue-hub.git`)

**1b. Pre-flight check — ensure no secrets in the codebase:**

```bash
# Check for JWT-shaped strings (Supabase keys start with eyJ)
grep -r "eyJ" src/ supabase/ --include="*.ts" --include="*.tsx" --include="*.js" -l

# Check for .env files that shouldn't be committed
ls -la .env* 2>/dev/null

# Check for API keys or secrets in code
grep -ri "sk_live\|sk_test\|re_[a-zA-Z0-9]\|AIza" src/ supabase/ --include="*.ts" --include="*.tsx" -l
```

If any of the above return results, remove the secrets before committing. The `.gitignore` already covers `.env*` files.

**1c. Initialize and push:**

```bash
# From the project root directory
git init
git branch -M main
git remote add origin https://github.com/your-org/innotrue-hub.git

# Stage everything (gitignore will exclude .env files, node_modules, dist, etc.)
git add .

# Review what will be committed
git status

# Commit
git commit -m "Initial commit: InnoTrue Hub migrated from Lovable Cloud

- Lovable dependencies removed, Supabase native OAuth
- AI provider: Vertex AI Gemini 3 Flash (EU/Frankfurt)
- Staging email override wired into all 13 functions
- Database seed file (supabase/seed.sql)
- 210 unit tests, code splitting (82% bundle reduction)
- SPA routing, security headers, CSP hardened"

# Push
git push -u origin main
```

**1d. Branching strategy:**

Use a simple Git Flow with 3 long-lived branches:

```
main          → production deploys (Cloudflare Pages production)
preprod      → preproduction testing (Cloudflare Pages preview + preprod Supabase)
develop       → daily development (local + dev Supabase / Lovable project)
```

Set up the branches:

```bash
# Create develop branch (daily work happens here)
git checkout -b develop
git push -u origin develop

# Create preprod branch (integration testing before production)
git checkout -b preprod
git push -u origin preprod

# Go back to develop for daily work
git checkout develop
```

**Branch flow:**

```
feature/xyz → develop → preprod → main
                ↑            ↑         ↑
            daily work   QA/test   production
```

- **Feature branches:** Branch off `develop`, merge back via PR
  ```bash
  git checkout develop
  git checkout -b feature/add-new-assessment
  # ... make changes ...
  git push -u origin feature/add-new-assessment
  # Create PR: feature/add-new-assessment → develop
  ```

- **Promote to preprod:** When develop is stable, merge to preprod
  ```bash
  # Create PR: develop → preprod (test on preprod Supabase)
  ```

- **Promote to production:** When preprod passes testing, merge to main
  ```bash
  # Create PR: preprod → main (deploys to production)
  ```

**1e. Branch protection rules (recommended):**

In GitHub → Settings → Branches → Add rule:

| Branch | Rules |
|--------|-------|
| `main` | Require PR, require CI to pass, no force push, require 1 approval |
| `preprod` | Require PR, require CI to pass, no force push |
| `develop` | Require PR (optional), require CI to pass |

**1f. Connect Cloudflare Pages to the repo:**

Once pushed, connect the repo to Cloudflare Pages (Step 4). Configure:
- **Production branch:** `main`
- **Preview branches:** `preprod`, `develop`, `feature/*`

Cloudflare Pages will auto-deploy `main` to production and create preview deploys for all other branches.

**Verify:**
- Repository is on GitHub with 3 branches (`main`, `preprod`, `develop`)
- `.env` files are NOT in the repo (`git log --all --full-history -- .env` returns nothing)
- `git log` shows your initial commit

---

#### Step 2 — Remove Lovable Dependencies ✅ COMPLETED (Feb 9, 2026)

All Lovable dependencies have been removed. Here is what was done:

**2a. Deleted `.lovable/` directory** (contained only `plan.md`)

**2b. Removed `lovable-tagger` from Vite config** — import and plugin reference removed from `vite.config.ts`

**2c. Replaced Lovable Auth with native Supabase OAuth:**
- Removed `@lovable.dev/cloud-auth-js` import from `src/pages/Auth.tsx`
- Replaced `lovableAuth.signInWithOAuth(...)` with `supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: '...' } })`
- Removed Lovable domain redirect logic (`isOnLovableDomain`, `isCustomDomain` checks)
- Deleted `src/integrations/lovable/index.ts`
- Deleted `src/pages/OAuthInitiateProxy.tsx` and its route in `App.tsx`

**2d. Removed Lovable packages** — `@lovable.dev/cloud-auth-js`, `lovable-tagger` uninstalled

**2e. Updated Playwright config** — replaced Lovable helper with standard Playwright config

**2f. Additional Lovable cleanup performed:**
- All domain references updated: `innotruehub.lovable.app` → `app.innotrue.com` across 20+ files (frontend + edge functions)
- Logo image paths updated: `/lovable-uploads/...` → `/assets/...`
- CSP in `index.html`: removed `https://api.lovable.dev`, `https://*.lovable.app`, `https://cdn.gpteng.co`, `https://api.openai.com`, `https://api.anthropic.com`
- Edge function CORS: removed `.lovable.app` wildcard, updated to `app.innotrue.com`
- Documentation files: removed Lovable references from technical docs, privacy policy, future features
- `robots.txt` and `sitemap.xml`: updated to `app.innotrue.com`
- `README.md`: completely rewritten for current stack

**2g. AI provider migration:**
- Created centralized AI config at `supabase/functions/_shared/ai-config.ts`
- All 4 AI edge functions updated to use shared `aiChatCompletion()` helper
- Active provider: **Google Vertex AI** with Gemini 3 Flash (`google/gemini-3-flash-preview`)
- EU data residency: Frankfurt (`europe-west3`)
- OAuth2 service account auth with JWT signing and token caching
- Commented-out configs available for: Mistral, Gemini AI Studio, Azure OpenAI, OpenAI

**Remaining manual steps (do all at once in Supabase Dashboard):**

1. **Google OAuth:** Dashboard → Authentication → Providers → Google
   - Add Client ID and Client Secret from Google Cloud Console
   - Redirect URL: `https://pfwlsxovvqdiwaztqxrj.supabase.co/auth/v1/callback`

2. **Auth Email Hook (route auth emails through Resend):** Dashboard → Authentication → Hooks
   - Enable the "Send Email" hook
   - URI: `https://pfwlsxovvqdiwaztqxrj.supabase.co/functions/v1/send-auth-email`
   - HTTP Header: `Authorization: Bearer <service-role-key>`
   - **Why:** Without this, 4 auth email types (signup confirmation, magic link, password recovery, email change) are sent via Supabase's built-in SMTP (`noreply@mail.app.supabase.io`) which has poor deliverability and lands in spam. With the hook enabled, all auth emails go through Resend via `send-auth-email` edge function using your branded `noreply@mail.innotrue.com` sender.

3. **Verify Resend domain:** Resend Dashboard → Domains → verify `mail.innotrue.com`
   - SPF (TXT record) — required
   - DKIM (3 CNAME records) — required
   - DMARC (TXT record) — recommended
   - If already verified, no action needed

4. **Verify Edge Function secrets are set:** Dashboard → Edge Functions → Secrets
   - `RESEND_API_KEY` — Resend API key
   - `SITE_URL` — `https://app.innotrue.com`
   - `OPENAI_API_KEY` — (legacy, can remove after Vertex AI migration)
   - `GCP_SERVICE_ACCOUNT_KEY` — Vertex AI service account JSON (for AI features)
   - `GCP_PROJECT_ID` — Google Cloud project ID
   - `GCP_LOCATION` — `europe-west3` (Frankfurt)
   - `STRIPE_SECRET_KEY` — Stripe secret key (for payments)
   - `APP_ENV` — `staging` (staging project only; omit or set to `production` in prod)
   - `STAGING_EMAIL_OVERRIDE` — catch-all email address (staging project only; omit in prod)

**Email architecture (all 13 functions route through Resend):**

| Sender | Purpose | Functions |
|--------|---------|-----------|
| `noreply@mail.innotrue.com` | Auth & account emails | send-auth-email, send-welcome-email, signup-user, request-account-deletion, decision-reminders |
| `notifications@mail.innotrue.com` | Activity alerts | send-notification-email, process-email-queue, notify-assignment-graded, notify-assignment-submitted, check-ai-usage, subscription-reminders |
| `onboarding@mail.innotrue.com` | Org invitations | send-org-invite |
| `hello@mail.innotrue.com` | Assessment results | send-wheel-pdf |

**Fix applied (Feb 9, 2026):** `send-wheel-pdf/index.ts` had hardcoded `https://innotruehub.com/auth` — replaced with `SITE_URL` env var.

**Staging email override (Feb 9, 2026):** All 13 email-sending edge functions now use centralized staging helpers from `_shared/email-utils.ts`. In non-production environments, all emails are redirected to a single catch-all address with the real recipient shown in the subject line.

**Setup (staging Supabase project only):**
```
# In Supabase Dashboard → Edge Functions → Secrets (staging project):
APP_ENV = staging
STAGING_EMAIL_OVERRIDE = your-test-inbox@example.com
```

**How it works:**
- When `APP_ENV` is **not** `production` **and** `STAGING_EMAIL_OVERRIDE` is set, all emails are redirected
- Subject is prefixed with `[STAGING -> real@email.com]` so you can see who would have received it
- For multi-recipient emails, all recipients are de-duplicated to the single override address
- Console logs every redirect for debugging
- In production (or when `STAGING_EMAIL_OVERRIDE` is not set), emails go to real recipients normally — zero-impact passthrough

**Functions wired:** send-auth-email, send-welcome-email, send-org-invite, send-wheel-pdf, subscription-reminders, signup-user, request-account-deletion (2 send calls), check-ai-usage, send-notification-email, notify-assignment-graded, notify-assignment-submitted, decision-reminders, process-email-queue.

**Indirect functions** (send-schedule-reminders, notify-waitlist, registration-follow-ups) delegate to `send-notification-email` and automatically inherit the override.

**Verified:** `npm run build` succeeds. `grep -ri "lovable" src/ supabase/` returns zero results.

---

#### Step 3 — Create Environment Separation ✅ COMPLETED (Feb 9, 2026)

> `.gitignore` updated with all `.env.*` patterns. `.env.example` template created. Supabase projects created and configured.

**Environment map:**

| Environment | Git Branch | Supabase Project Ref | Frontend | APP_ENV |
|---|---|---|---|---|
| Development | `develop` | `pfwlsxovvqdiwaztqxrj` (Lovable-owned) | `localhost:8080` | `development` |
| Pre-production | `preprod` | `jtzcrirqflfnagceendt` | Cloudflare preview URL | `staging` |
| Production | `main` | `qfdztdgublwlmewobxmx` | `app.innotrue.com` | `production` |

Create three environment files (do NOT commit these — they're in `.gitignore`):

**`.env.development`** (local dev, points to existing Lovable-managed Supabase):
```env
VITE_SUPABASE_URL=https://pfwlsxovvqdiwaztqxrj.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<existing-anon-key>
VITE_APP_ENV=development
```

**`.env.staging`** (preprod Supabase):
```env
VITE_SUPABASE_URL=https://jtzcrirqflfnagceendt.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<preprod-anon-key-from-dashboard>
VITE_APP_ENV=staging
```

**`.env.production`** (production Supabase):
```env
VITE_SUPABASE_URL=https://qfdztdgublwlmewobxmx.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<prod-anon-key-from-dashboard>
VITE_SENTRY_DSN=<your-sentry-dsn>
VITE_APP_ENV=production
```

> **Note:** These local `.env` files are for local development only. Cloudflare Pages uses its own environment variables (configured in Step 9g) — it does NOT read local `.env` files. Get the anon keys from: Supabase Dashboard → Project → Settings → API → "Project API keys" → anon/public key.

**Verify:** `npm run dev` uses `.env.development` and connects to the correct Supabase project.

---

#### Step 4 — Deploy to Cloudflare Pages — MANUAL

**4a. Install Wrangler CLI (optional, for CLI deploys):**
```bash
npm install -g wrangler
wrangler login
```

**4b. Connect via Cloudflare Dashboard (Recommended) — Step by step:**

1. Go to https://dash.cloudflare.com
2. Navigate to **Workers & Pages** in the left sidebar
3. Click **Create** → select **Pages** tab → **Connect to Git**
4. Authorize GitHub if not already done → select repository **doina-popa-innotrue/innotrue-hub-live**
5. Configure build settings:
   - **Project name:** `innotrue-hub` (this determines your `.pages.dev` subdomain)
   - **Production branch:** `main`
   - **Framework preset:** None (or Vite if available)
   - **Build command:** `npm install --legacy-peer-deps && npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** `/` (project root)
6. Add **environment variables** (click "Add variable"):

   **Production environment** (used when deploying `main` branch):
   | Variable | Value |
   |----------|-------|
   | `NODE_VERSION` | `20` |
   | `VITE_SUPABASE_URL` | `https://qfdztdgublwlmewobxmx.supabase.co` |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | `<prod-anon-key from Supabase dashboard>` |
   | `VITE_APP_ENV` | `production` |

   **Preview environment** (used when deploying any other branch — preprod, develop, feature/*):
   | Variable | Value |
   |----------|-------|
   | `NODE_VERSION` | `20` |
   | `VITE_SUPABASE_URL` | `https://jtzcrirqflfnagceendt.supabase.co` |
   | `VITE_SUPABASE_PUBLISHABLE_KEY` | `<preprod-anon-key from Supabase dashboard>` |
   | `VITE_APP_ENV` | `staging` |

7. Click **Save and Deploy**
8. Wait for the first build to complete (2-3 minutes)
9. Note the `.pages.dev` URL that Cloudflare gives you — you'll need it for Supabase redirect URLs (Step 9f-3)

> **Important:** The build command includes `--legacy-peer-deps` because `react-day-picker` has a peer dependency conflict with React 18. This is harmless and expected.

**4b-alt. Deploy via CLI (alternative):**
```bash
# Build locally
npm run build

# Deploy to Cloudflare Pages
wrangler pages deploy dist --project-name=innotrue-hub
```

**4c. Enable SPA mode (critical for React Router):** ✅ COMPLETED (Feb 9, 2026)

`public/_redirects` created:
```
/* /index.html 200
```

`public/_headers` created with security headers:
```
/*
  X-Frame-Options: SAMEORIGIN
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: camera=(), microphone=(), geolocation=()
```

**4d. Configure preview deployments:**

Cloudflare Pages automatically creates preview deploys for every branch/PR push. Preview URLs follow the pattern:
```
https://<commit-hash>.innotrue-hub.pages.dev
```

**4e. Add a custom domain:**

1. Go to Cloudflare Dashboard → Pages → your project → Custom domains
2. Add your domain (e.g., `app.innotrue.com`)
3. If your domain is already on Cloudflare DNS, it configures automatically
4. If not, add the CNAME record: `app` → `innotrue-hub.pages.dev`

**4f. Update Supabase redirect URLs:**
- Go to Supabase Dashboard → Authentication → URL Configuration
- Add your Cloudflare Pages domain: `https://innotrue-hub.pages.dev`
- Add your custom domain: `https://app.innotrue.com` (if applicable)
- Add preview URL pattern if needed

**4g. Enable Cloudflare Web Analytics (free):**

1. Go to Cloudflare Dashboard → Web Analytics
2. Add your site
3. Copy the JS snippet or enable via Cloudflare automatic injection (no code change needed if proxied through Cloudflare DNS)

**Verify:** App loads on `https://innotrue-hub.pages.dev`, authentication works, data fetches correctly.

---

### Phase 2: Quality & Safety (Week 2–3)

#### Step 5 — Enable Strict TypeScript

Update `tsconfig.json`:
```json
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "strictNullChecks": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

**Incremental approach:**
```bash
# See how many errors exist
npx tsc --noEmit 2>&1 | wc -l

# Fix files in priority order:
# 1. src/contexts/ (auth logic — most critical)
# 2. src/hooks/ (business logic)
# 3. src/lib/ (utilities)
# 4. src/components/ (UI — least critical)
```

**Tip:** If the error count is overwhelming (500+), consider enabling strict mode file-by-file using `// @ts-strict` comments or a `tsconfig.strict.json` that extends the base config.

**Verify:** `npx tsc --noEmit` passes with zero errors.

---

#### Step 6 — Add Vitest for Unit Testing ✅ COMPLETED (Feb 9, 2026)

Vitest is fully set up with 210 tests across 11 test files, all passing.

**Installed:** `vitest`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`

**Configuration:** Test config integrated into `vite.config.ts` (jsdom environment, `@/` alias, setup file at `src/test/setup.ts`)

**Scripts in `package.json`:**
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "typecheck": "tsc --noEmit"
  }
}
```

**Test files created (`src/lib/__tests__/`):**

| Test File | Tests | Coverage |
|-----------|-------|----------|
| `adminSchemas.test.ts` | 31 | Zod admin form validation schemas |
| `validations.test.ts` | 32 | General validation utilities |
| `icsGenerator.test.ts` | 25 | ICS calendar file generation |
| `tierUtils.test.ts` | 23 | Tier access control logic |
| `recurringDates.test.ts` | 20 | Recurring date calculations |
| `dateUtils.test.ts` | 19 | Date formatting and manipulation |
| `decisionTemplates.test.ts` | 13 | Decision template structures |
| `linkedinUtils.test.ts` | 13 | LinkedIn URL generation |
| `notificationHelpers.test.ts` | 15 | Notification filtering/formatting |
| `utils.test.ts` | 7 | General utility functions |
| `gdprUtils.test.ts` | 12 | GDPR consent and cookie utilities |
| **Total** | **210** | |

**Verified:** `npm test` → 210 passed, 0 failed (1.83s).

---

#### Step 7 — Add Sentry Error Monitoring

**7a. Install Sentry:**
```bash
npm install @sentry/react
```

**7b. Initialize in `src/main.tsx` (before `ReactDOM.createRoot`):**
```ts
import * as Sentry from '@sentry/react';

if (import.meta.env.VITE_APP_ENV === 'production') {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    environment: import.meta.env.VITE_APP_ENV,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 1.0,
  });
}
```

**7c. Add Error Boundary to `App.tsx`:**
```tsx
import * as Sentry from '@sentry/react';

function App() {
  return (
    <Sentry.ErrorBoundary fallback={<ErrorFallback />}>
      {/* existing app content */}
    </Sentry.ErrorBoundary>
  );
}
```

**7d. Upload source maps in CI (add to GitHub Actions):**
```bash
npx @sentry/cli sourcemaps inject ./dist
npx @sentry/cli sourcemaps upload ./dist
```

**Verify:** Trigger a test error → appears in Sentry dashboard.

---

#### Step 8 — Set Up GitHub Actions CI/CD

**Create `.github/workflows/ci.yml`:**
```yaml
name: CI/CD

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
  VITE_SUPABASE_PUBLISHABLE_KEY: ${{ secrets.VITE_SUPABASE_PUBLISHABLE_KEY }}

jobs:
  quality:
    name: Lint, Type Check & Test
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Type check
        run: npx tsc --noEmit

      - name: Unit tests
        run: npm test

      - name: Build
        run: npm run build

  e2e:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: quality
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps chromium

      - name: Run E2E tests
        run: npx playwright test

      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: playwright-report/
```

**Note:** Cloudflare Pages auto-deploys when connected to your GitHub repo. GitHub Actions handles quality checks; Cloudflare Pages handles deployment. No additional deploy step needed in CI.

**Verify:** Push a commit → GitHub Actions runs checks → Cloudflare Pages deploys on success.

---

### Phase 3: Database & Backend Hardening (Week 3–4)

#### Step 9 — Create Supabase Environments (Pre-prod + Production)

> **Environment strategy:**
> - **Existing Lovable project** (`pfwlsxovvqdiwaztqxrj`) → stays as dev/staging, used with Lovable or as a data export source. Don't touch it.
> - **New preprod project** → for integration testing on `preprod` branch. Uses seed data.
> - **New production project** → for live users on `main` branch. Seed data initially, then real data.

**9a. Create two new Supabase projects ✅ COMPLETED (Feb 9, 2026)**

| Project | Ref | Plan | Purpose |
|---|---|---|---|
| Pre-prod | `jtzcrirqflfnagceendt` | Micro | Integration testing |
| Production | `qfdztdgublwlmewobxmx` | Small | Live production |

**9b. Push migrations, seed, and edge functions to preprod ✅ COMPLETED (Feb 9, 2026)**

- 393 migrations applied successfully
- Seed data (12 sections) applied — demo users, plans, programs, etc.
- 60 edge functions deployed
- Dashboard: https://supabase.com/dashboard/project/jtzcrirqflfnagceendt/functions

**9c. Set preprod edge function secrets — MANUAL**

Run these commands in your terminal, replacing placeholder values with your actual keys:

```bash
# ── CORE (required for most functionality) ──
supabase secrets set RESEND_API_KEY='re_xxxxxxxxxxxx' \
  --project-ref jtzcrirqflfnagceendt

supabase secrets set SITE_URL='https://YOUR-PREPROD-PREVIEW.pages.dev' \
  --project-ref jtzcrirqflfnagceendt

supabase secrets set STRIPE_SECRET_KEY='sk_test_xxxxxxxxxxxx' \
  --project-ref jtzcrirqflfnagceendt

# ── STAGING EMAIL OVERRIDE (redirects ALL emails to you) ──
supabase secrets set APP_ENV='staging' \
  --project-ref jtzcrirqflfnagceendt

supabase secrets set STAGING_EMAIL_OVERRIDE='doina.popa@innotrue.com' \
  --project-ref jtzcrirqflfnagceendt

# ── AI (Vertex AI — used by 4 AI functions) ──
supabase secrets set GCP_SERVICE_ACCOUNT_KEY='{ paste contents of key.json }' \
  --project-ref jtzcrirqflfnagceendt

supabase secrets set GCP_PROJECT_ID='your-gcp-project-id' \
  --project-ref jtzcrirqflfnagceendt

supabase secrets set GCP_LOCATION='europe-west3' \
  --project-ref jtzcrirqflfnagceendt

# ── SECURITY (for Google Calendar/OAuth integrations) ──
supabase secrets set OAUTH_ENCRYPTION_KEY='<run: openssl rand -hex 32>' \
  --project-ref jtzcrirqflfnagceendt

supabase secrets set CALENDAR_HMAC_SECRET='<run: openssl rand -hex 32>' \
  --project-ref jtzcrirqflfnagceendt
```

**Optional integration secrets** (set later when you configure these services):
```bash
# Cal.com
supabase secrets set CALCOM_API_KEY='cal_xxxx' --project-ref jtzcrirqflfnagceendt
supabase secrets set CALCOM_WEBHOOK_SECRET='whsec_xxxx' --project-ref jtzcrirqflfnagceendt

# TalentLMS
supabase secrets set TALENTLMS_API_KEY='xxxx' --project-ref jtzcrirqflfnagceendt
supabase secrets set TALENTLMS_DOMAIN='yourcompany.talentlms.com' --project-ref jtzcrirqflfnagceendt
supabase secrets set TALENTLMS_WEBHOOK_SECRET='xxxx' --project-ref jtzcrirqflfnagceendt

# Circle SSO
supabase secrets set CIRCLE_API_KEY='xxxx' --project-ref jtzcrirqflfnagceendt
supabase secrets set CIRCLE_COMMUNITY_ID='xxxx' --project-ref jtzcrirqflfnagceendt
supabase secrets set CIRCLE_HEADLESS_AUTH_TOKEN='xxxx' --project-ref jtzcrirqflfnagceendt
supabase secrets set CIRCLE_COMMUNITY_DOMAIN='xxxx' --project-ref jtzcrirqflfnagceendt

# Google Calendar (service account for creating calendar events)
supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON='{ service-account-json }' --project-ref jtzcrirqflfnagceendt
supabase secrets set GOOGLE_CALENDAR_IMPERSONATE_EMAIL='admin@yourdomain.com' --project-ref jtzcrirqflfnagceendt
```

**Where to get each key:**

| Secret | Where to get it |
|--------|----------------|
| `RESEND_API_KEY` | https://resend.com/api-keys → Create API Key |
| `STRIPE_SECRET_KEY` | https://dashboard.stripe.com/apikeys → Secret key (use **test** key for preprod) |
| `GCP_SERVICE_ACCOUNT_KEY` | Google Cloud Console → IAM → Service Accounts → Create Key (JSON format) |
| `GCP_PROJECT_ID` | Google Cloud Console → top bar shows project ID |
| `OAUTH_ENCRYPTION_KEY` | Generate locally: `openssl rand -hex 32` |
| `CALENDAR_HMAC_SECRET` | Generate locally: `openssl rand -hex 32` |

**9d. Push migrations, seed, and edge functions to prod ✅ COMPLETED (Feb 9, 2026)**

- 393 migrations applied successfully
- Seed data (12 sections) applied — demo users, plans, programs, etc.
- 60 edge functions deployed
- Dashboard: https://supabase.com/dashboard/project/qfdztdgublwlmewobxmx/functions

**9e. Set production edge function secrets — MANUAL**

Same as preprod but with **production values** and **NO staging override**:

```bash
# ── CORE ──
supabase secrets set RESEND_API_KEY='re_xxxxxxxxxxxx' \
  --project-ref qfdztdgublwlmewobxmx

supabase secrets set SITE_URL='https://app.innotrue.com' \
  --project-ref qfdztdgublwlmewobxmx

supabase secrets set STRIPE_SECRET_KEY='sk_live_xxxxxxxxxxxx' \
  --project-ref qfdztdgublwlmewobxmx

# ── AI ──
supabase secrets set GCP_SERVICE_ACCOUNT_KEY='{ paste contents of key.json }' \
  --project-ref qfdztdgublwlmewobxmx

supabase secrets set GCP_PROJECT_ID='your-gcp-project-id' \
  --project-ref qfdztdgublwlmewobxmx

supabase secrets set GCP_LOCATION='europe-west3' \
  --project-ref qfdztdgublwlmewobxmx

# ── SECURITY ──
supabase secrets set OAUTH_ENCRYPTION_KEY='<run: openssl rand -hex 32>' \
  --project-ref qfdztdgublwlmewobxmx

supabase secrets set CALENDAR_HMAC_SECRET='<run: openssl rand -hex 32>' \
  --project-ref qfdztdgublwlmewobxmx

# IMPORTANT: Do NOT set APP_ENV or STAGING_EMAIL_OVERRIDE on production!
# Emails must go to real recipients in production.
```

**9f. Configure manual dashboard settings — MANUAL**

Do these for **EACH** project (preprod and prod). Detailed steps below:

##### 9f-1. Google OAuth

**In Google Cloud Console (one-time, add both callback URLs):**

1. Go to https://console.cloud.google.com/apis/credentials
2. Find your existing OAuth 2.0 Client (or create one: Application type → Web application, Name → InnoTrue Hub)
3. Under **Authorized redirect URIs**, add **both** callback URLs:
   - `https://jtzcrirqflfnagceendt.supabase.co/auth/v1/callback` (preprod)
   - `https://qfdztdgublwlmewobxmx.supabase.co/auth/v1/callback` (prod)
4. Click **Save**
5. Copy the **Client ID** and **Client Secret**

**In Supabase Dashboard — Pre-prod:**

1. Go to https://supabase.com/dashboard/project/jtzcrirqflfnagceendt/auth/providers
2. Find **Google** in the list → Click to expand
3. Toggle **Enable Google provider** → ON
4. Paste your **Client ID** and **Client Secret**
5. Click **Save**

**In Supabase Dashboard — Prod:**

1. Go to https://supabase.com/dashboard/project/qfdztdgublwlmewobxmx/auth/providers
2. Same steps: Enable Google, paste same Client ID and Client Secret
3. Click **Save**

##### 9f-2. Auth Email Hook

Your app uses a custom `send-auth-email` edge function that sends auth emails (signup confirmation, password reset, magic link, email change) through Resend with your branded sender address. Without this hook, Supabase sends these emails from `noreply@mail.app.supabase.io` which lands in spam.

**Pre-prod:**

1. Go to https://supabase.com/dashboard/project/jtzcrirqflfnagceendt/auth/hooks
2. Find **Send Email Hook** (or "Custom SMTP / Email Hook")
3. Enable the hook and set:
   - **Hook type:** HTTP Request
   - **URI:** `https://jtzcrirqflfnagceendt.supabase.co/functions/v1/send-auth-email`
   - **HTTP Headers:** Add one header:
     - **Key:** `Authorization`
     - **Value:** `Bearer <YOUR_PREPROD_SERVICE_ROLE_KEY>`
4. Click **Save**

**To find the service role key:** Go to https://supabase.com/dashboard/project/jtzcrirqflfnagceendt/settings/api → "Project API keys" → copy the **service_role** key (the one marked as secret/hidden).

**Prod:**

1. Go to https://supabase.com/dashboard/project/qfdztdgublwlmewobxmx/auth/hooks
2. Same steps but with prod values:
   - **URI:** `https://qfdztdgublwlmewobxmx.supabase.co/functions/v1/send-auth-email`
   - **Authorization:** `Bearer <YOUR_PROD_SERVICE_ROLE_KEY>`
3. Click **Save**

**To find the prod service role key:** https://supabase.com/dashboard/project/qfdztdgublwlmewobxmx/settings/api

##### 9f-3. Auth Redirect URLs

**Pre-prod** — go to https://supabase.com/dashboard/project/jtzcrirqflfnagceendt/auth/url-configuration
- **Site URL:** Your Cloudflare Pages preview URL (e.g. `https://preprod.innotrue-hub-live.pages.dev`)
- **Redirect URLs:** Add:
  - `https://preprod.innotrue-hub-live.pages.dev/**`
  - `http://localhost:8080/**` (for local dev)

**Prod** — go to https://supabase.com/dashboard/project/qfdztdgublwlmewobxmx/auth/url-configuration
- **Site URL:** `https://app.innotrue.com`
- **Redirect URLs:** Add:
  - `https://app.innotrue.com/**`

##### 9f-4. Resend Domain DNS Verification

If not already done, verify your sending domain in Resend:

1. Go to https://resend.com/domains
2. Add domain: `mail.innotrue.com`
3. Add the DNS records Resend provides to your domain registrar:
   - **SPF** (TXT record) — required
   - **DKIM** (3 CNAME records) — required
   - **DMARC** (TXT record) — recommended
4. Click "Verify" in Resend after adding records (DNS propagation may take up to 48 hours)

##### 9f Checklist

| Task | Pre-prod | Prod |
|------|----------|------|
| Google OAuth callback URL in GCP | ⬜ | ⬜ |
| Enable Google provider in Supabase | ⬜ | ⬜ |
| Auth Email Hook configured | ⬜ | ⬜ |
| Auth redirect URLs set | ⬜ | ⬜ |
| Resend domain verified | ⬜ (shared) | ⬜ (shared) |
| Core secrets set (RESEND, SITE_URL, STRIPE) | ⬜ | ⬜ |
| AI secrets set (GCP_*) | ⬜ | ⬜ |
| Security secrets set (OAUTH_ENCRYPTION, CALENDAR_HMAC) | ⬜ | ⬜ |
| Staging override set (APP_ENV, STAGING_EMAIL_OVERRIDE) | ⬜ | N/A |

**9g. Wire Cloudflare Pages environment variables — MANUAL**

In Cloudflare Dashboard → Pages → your project → Settings → Environment variables:

| Variable | Production (`main`) | Preview (other branches) |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://qfdztdgublwlmewobxmx.supabase.co` | `https://jtzcrirqflfnagceendt.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `<prod-anon-key>` | `<preprod-anon-key>` |
| `VITE_APP_ENV` | `production` | `staging` |
| `NODE_VERSION` | `20` | `20` |

Get the anon keys from each project's dashboard: Settings → API → "Project API keys" → anon/public.

**9h. Switching Supabase CLI between projects:**

The CLI can only be linked to one project at a time. Use `--project-ref` flags or re-link:

```bash
# Quick switch
supabase link --project-ref jtzcrirqflfnagceendt   # work on preprod
supabase link --project-ref qfdztdgublwlmewobxmx   # switch to prod

# Or use --project-ref flag without re-linking
supabase functions deploy --project-ref jtzcrirqflfnagceendt
supabase functions deploy --project-ref qfdztdgublwlmewobxmx
```

**9i. Data migration from Lovable project (later):**

When you're ready to export real data from the Lovable-managed project:

```bash
# Export data from existing project (ask Lovable for DB credentials, or use their export)
pg_dump --data-only --no-owner --no-privileges \
  -h db.pfwlsxovvqdiwaztqxrj.supabase.co -U postgres -d postgres \
  --exclude-table-data='auth.*' \
  > data_export.sql

# Import into production (after reviewing the export)
psql -h db.qfdztdgublwlmewobxmx.supabase.co -U postgres -d postgres < data_export.sql
```

**Complete secrets reference — all 28 environment variables used by edge functions:**

> Note: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` are auto-provided by Supabase — you do NOT need to set them manually.

| Variable | Used by | Priority |
|----------|---------|----------|
| `RESEND_API_KEY` | 13 email functions | Required |
| `SITE_URL` | 24 functions (URLs in emails, redirects, CORS) | Required |
| `STRIPE_SECRET_KEY` | 7 payment functions | Required |
| `GCP_SERVICE_ACCOUNT_KEY` | 4 AI functions (via ai-config.ts) | Required for AI |
| `GCP_PROJECT_ID` | 4 AI functions | Required for AI |
| `GCP_LOCATION` | 4 AI functions (defaults to europe-west3) | Required for AI |
| `OAUTH_ENCRYPTION_KEY` | OAuth integrations (5 functions via oauth-crypto.ts) | Required for OAuth |
| `CALENDAR_HMAC_SECRET` | calendar-feed, generate-calendar-url | Required for calendars |
| `APP_ENV` | email-utils.ts staging override | Pre-prod only |
| `STAGING_EMAIL_OVERRIDE` | email-utils.ts staging override | Pre-prod only |
| `CALCOM_API_KEY` | calcom-create-booking, calcom-get-booking-url | Optional |
| `CALCOM_WEBHOOK_SECRET` | calcom-webhook | Optional |
| `TALENTLMS_API_KEY` | sync-talentlms-progress, talentlms-sso | Optional |
| `TALENTLMS_DOMAIN` | sync-talentlms-progress, talentlms-sso | Optional |
| `TALENTLMS_WEBHOOK_SECRET` | talentlms-webhook | Optional |
| `CIRCLE_API_KEY` | circle-sso | Optional |
| `CIRCLE_COMMUNITY_ID` | circle-sso | Optional |
| `CIRCLE_HEADLESS_AUTH_TOKEN` | circle-sso | Optional |
| `CIRCLE_COMMUNITY_DOMAIN` | circle-sso | Optional |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | google-calendar-create-event | Optional |
| `GOOGLE_CALENDAR_IMPERSONATE_EMAIL` | google-calendar-create-event | Optional |
| `REQUEST_SIGNING_SECRET` | request-signing.ts | Optional |

**Verify:**
- Both projects have 393 migrations applied ✅
- Seed data is present (log in with `doina.popa@innotrue.com` / `DemoPass123!`)
- Edge functions are deployed (60 per project) ✅
- Secrets are set (run `supabase secrets list --project-ref <ref>`)
- Google OAuth login works
- Auth emails are received (via Resend, not Supabase default SMTP)
- Cloudflare Pages preview deploys connect to preprod Supabase
- Cloudflare Pages production deploys connect to production Supabase

---

#### Step 10 — Audit Row Level Security (RLS) Policies

**10a. RLS Audit — COMPLETED (Feb 12, 2026)**

Audited all public-schema tables across 393 migrations using `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` and `CREATE POLICY` statements.

| Metric | Count |
|--------|-------|
| Total tables with RLS enabled | 276 |
| Tables with explicit policies | 41 |
| Tables with RLS but no policies (locked down) | 235 |
| Tables with RLS disabled | **0** |

**Result: ✅ Secure by default.** All 276 tables have RLS enabled. The 235 tables without explicit policies are fully locked — only `service_role` (used by edge functions) can access them. The 41 tables with explicit policies grant scoped access to authenticated users (e.g., users can read their own data).

**No action needed** — the schema is properly secured.

**10b. Edge function input validation audit — COMPLETED (Feb 12, 2026)**

Audited all 63 edge functions for input validation quality.

| Category | Count | Description |
|----------|-------|-------------|
| ✅ Proper validation | 23 | Zod, UUID regex, rate limiting, HMAC, timing-safe checks |
| ⚠️ Partial validation | 28 | Auth checks present but gaps in body/param validation |
| ❌ No validation | 6 | Accept user input with minimal checks |
| ℹ️ No user input | 6 | Cron jobs, webhooks with signature verification |

**Strong practices already in place:**
- JWT auth verification consistent across authenticated endpoints
- UUID format validation in critical functions (delete-user, get-user-email, create-client-development-item)
- Timing attack mitigation in verify-signup, verify-email-change, calendar-feed
- Rate limiting in track-analytics and delete-user
- HMAC signature verification for calendar tokens
- Webhook signature verification for Cal.com and TalentLMS

**Gaps identified (non-blocking, future improvement):**
- Email format validation missing in several email-sending functions
- Password strength not enforced in signup-user, create-admin-user
- Numeric range validation absent for financial/credit parameters
- Some functions use loose string checks instead of strict enums
- AI prompt functions (generate-reflection-prompt, course-recommendations, decision-insights) lack input size limits

**Assessment:** The security posture is acceptable for launch. Auth checks protect all sensitive endpoints. The identified gaps are hardening improvements, not vulnerabilities — most inputs flow through RLS-protected database queries which provide a secondary validation layer.

**10c. Rate limiting (deferred):**

Supabase Edge Functions run on Deno Deploy with built-in DDoS protection. Additional rate limiting can be added later if abuse is observed. Not a launch blocker.

---

#### Step 11 — Upgrade Supabase to Pro Plan

**What Pro gives you:**
- Dedicated compute (not shared)
- 8GB RAM
- Daily automated backups
- Point-in-time recovery (up to 7 days)
- Database branching for safe schema testing
- No connection pooling limits
- Priority support
- Custom domains for auth

**Steps:**
1. Go to Supabase Dashboard → Project → Billing
2. Upgrade to Pro ($25/month)
3. Enable Point-in-Time Recovery in Settings → Database
4. Configure daily backup schedule

**Verify:** Backup appears in dashboard; connection limits are removed.

---

### Phase 4: Performance & Reliability (Week 4–5)

#### Step 12 — Add Code Splitting (Lazy Loading) ✅ COMPLETED (Feb 9, 2026)

All 160+ page components in `src/App.tsx` converted from eager `import` to `lazy(() => import(...))` with a single `<Suspense>` wrapper around all routes.

**Eagerly loaded (critical path):** `Index`, `Auth`, `NotFound` — these stay in the main bundle for instant first paint.

**Lazy-loaded:** All admin, client, instructor, org-admin, and shared pages — each gets its own chunk, loaded on demand.

**Suspense fallback:** Centered spinning loader (`animate-spin rounded-full border-b-2 border-primary`).

**Result:** Main bundle reduced from **5.3MB → 977KB** (82% reduction). Each page loads as a separate ~10–115KB chunk on navigation.

**Verified:** `npm run build` succeeds, `npm test` → 210 tests pass.

---

#### Step 13 — Harden PWA Configuration

Update `vite.config.ts` PWA plugin settings:

```ts
import { VitePWA } from 'vite-plugin-pwa';

VitePWA({
  registerType: 'autoUpdate',
  workbox: {
    // Cache static assets aggressively
    runtimeCaching: [
      {
        urlPattern: /\.(js|css|png|jpg|svg|woff2?)$/,
        handler: 'CacheFirst',
        options: {
          cacheName: 'static-assets',
          expiration: { maxEntries: 100, maxAgeSeconds: 30 * 24 * 60 * 60 },
        },
      },
      {
        // API calls: always go to network first
        urlPattern: /supabase\.co/,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          expiration: { maxEntries: 50, maxAgeSeconds: 5 * 60 },
          networkTimeoutSeconds: 10,
        },
      },
    ],
    // Never cache auth endpoints
    navigateFallbackDenylist: [/\/auth\//],
  },
})
```

**Verify:** API calls always fetch fresh data; static assets load from cache.

---

#### Step 14 — Add Web Vitals Monitoring

```bash
npm install web-vitals
```

Create `src/lib/vitals.ts`:
```ts
import { onCLS, onFID, onLCP, onFCP, onTTFB } from 'web-vitals';

export function reportWebVitals() {
  onCLS(console.log);
  onFID(console.log);
  onLCP(console.log);
  onFCP(console.log);
  onTTFB(console.log);
}
```

Call in `main.tsx`:
```ts
import { reportWebVitals } from '@/lib/vitals';
reportWebVitals();
```

**Cloudflare Web Analytics** (recommended — free, no code needed):
- Enable in Cloudflare Dashboard → Web Analytics
- Automatically tracks Core Web Vitals, page views, and performance
- No JavaScript snippet needed if your domain is proxied through Cloudflare

**Verify:** Web vitals appear in Cloudflare dashboard or browser console.

---

### Phase 5: Developer Environment Setup

#### Step 15 — Cursor IDE & Developer Tools Setup

Cursor replaces Lovable's browser-based editor. It's a VS Code fork with built-in AI (Claude, GPT-4) that understands your entire codebase.

##### 15a. Install Cursor

1. Download from [cursor.com](https://cursor.com)
2. Install and open
3. If prompted, import VS Code settings/extensions → **Yes** (brings over your themes, keybindings, etc.)
4. Sign in to Cursor (free tier works; Pro at $20/month gives unlimited AI usage)

##### 15b. Open the Project

```bash
# Clone the repo (if not already done)
git clone https://github.com/doina-popa-innotrue/innotrue-hub-live.git
cd innotrue-hub-live

# Install dependencies
npm install --legacy-peer-deps

# Open in Cursor
cursor .
```

Or: **File → Open Folder** → select the `innotrue-hub-live` folder.

##### 15c. Recommended Extensions

Install these from the Extensions panel (`Cmd+Shift+X`):

| Extension | Purpose |
|---|---|
| **Tailwind CSS IntelliSense** | Autocomplete for Tailwind classes |
| **ESLint** | Linting JavaScript/TypeScript |
| **Prettier** | Code formatting |
| **GitLens** | Git blame, history, comparison |
| **Supabase** | Supabase schema/types integration |
| **Error Lens** | Inline error/warning display |
| **Auto Rename Tag** | Auto-rename paired HTML/JSX tags |
| **Path Intellisense** | Autocomplete file paths |

##### 15d. Workspace Settings

Create `.vscode/settings.json` in the project root (if it doesn't exist):

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.tabSize": 2,
  "typescript.tsdk": "node_modules/typescript/lib",
  "tailwindCSS.experimental.classRegex": [
    ["cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"],
    ["cn\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]"]
  ],
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true
  },
  "search.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/.git": true
  }
}
```

##### 15e. Cursor AI Configuration

1. **Open Settings:** `Cmd+,` → search "Cursor"
2. **Set AI Model:** Claude Sonnet 4 (recommended) or GPT-4o
3. **Enable Codebase Indexing:**
   - Go to Cursor Settings → Features → Codebase Indexing
   - Click "Index Codebase" — this lets AI search your entire project
   - Wait for indexing to complete (~1-2 minutes for 507 files)
4. **Add Project Rules** (optional):
   - Create `.cursorrules` in project root with project-specific context:
   ```
   This is the InnoTrue Hub App — a coaching/learning platform.
   Stack: React + Vite + TypeScript + Supabase + Tailwind + shadcn/ui.
   Use existing patterns from the codebase.
   Follow the component structure in src/components/.
   Use hooks from src/hooks/ for data fetching.
   Use Supabase RPC calls for complex queries.
   ```

##### 15f. Using Cursor for Development

| Action | Shortcut | Description |
|---|---|---|
| **AI Chat** | `Cmd+L` | Ask questions, generate code, debug |
| **Inline Edit** | `Cmd+K` | Edit selected code with AI |
| **Composer** | `Cmd+I` | Multi-file AI editing (like Lovable but better) |
| **Terminal** | `` Ctrl+` `` | Open integrated terminal |
| **Search Files** | `Cmd+P` | Quick file search |
| **Search Text** | `Cmd+Shift+F` | Search across all files |
| **Go to Definition** | `Cmd+Click` | Jump to function/type definition |

**Typical workflow:**
```
1. Open Cursor → Cmd+L to open AI chat
2. Describe the change: "Add a filter dropdown to the programs list page"
3. AI generates code → review in diff view
4. Accept changes → test in browser (npm run dev)
5. Run tests: npm test
6. Git commit and push → Cloudflare auto-deploys
```

##### 15g. Claude Code (Terminal AI) Setup

Claude Code is a CLI tool for complex, multi-file tasks directly in the terminal.

```bash
# Install Claude Code
npm install -g @anthropic-ai/claude-code

# Navigate to project
cd /path/to/innotrue-hub-live

# Start Claude Code
claude

# Example prompts:
# "Read all edge functions and list which ones send emails"
# "Add a new notification type for session reminders"
# "Refactor the auth flow to add remember-me functionality"
```

**When to use which:**
| Tool | Best for |
|---|---|
| **Cursor (Cmd+L)** | Quick questions, single-file edits, UI changes |
| **Cursor Composer (Cmd+I)** | Multi-file feature work, component creation |
| **Claude Code (terminal)** | Large refactors, codebase analysis, migration tasks, debugging complex issues |

##### 15h. Other Essential Tools

| Tool | Install | Purpose |
|---|---|---|
| **Node.js 20+** | [nodejs.org](https://nodejs.org) or `brew install node` | JavaScript runtime |
| **Supabase CLI** | `brew install supabase/tap/supabase` | Database migrations, edge functions, local dev |
| **Wrangler CLI** | `npm install -g wrangler` | Cloudflare Pages manual deploys |
| **GitHub CLI** | `brew install gh` | PR management, issue tracking from terminal |
| **Git** | `brew install git` | Version control (pre-installed on macOS) |

**Verify all tools are installed:**
```bash
node --version      # v20.x or higher
npm --version       # 10.x or higher
supabase --version  # 2.x
wrangler --version  # 3.x
gh --version        # 2.x
git --version       # 2.x
```

##### 15i. Local Development Workflow

```bash
# 1. Start local dev server
npm run dev
# → Opens http://localhost:8080

# 2. (Optional) Start local Supabase for offline development
supabase start
# → Local Supabase at http://localhost:54321

# 3. Run tests before committing
npm test

# 4. Type-check before pushing
npm run typecheck

# 5. Build to verify production readiness
npm run build
```

**Environment files:**
- `.env.local` — your local overrides (gitignored)
- `.env.example` — template showing required variables

Create `.env.local` for local development:
```bash
VITE_SUPABASE_URL=https://jtzcrirqflfnagceendt.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key-here
```

Or for local Supabase:
```bash
VITE_SUPABASE_URL=http://localhost:54321
VITE_SUPABASE_PUBLISHABLE_KEY=your-local-anon-key
```

---

## 6. Priority Order

| Priority | Step | Impact | Effort | Status |
|---|---|---|---|---|
| 1 | Step 1: Git repo + remove Lovable deps | Unblocks everything | Low | ✅ DONE |
| 2 | Step 2: Environment separation | Security, safe testing | Low | ✅ DONE |
| 3 | Step 3: Supabase projects + migrations | Database ready | Medium | ✅ DONE |
| 4 | Step 9: Secrets, OAuth, Email Hook | App functional | Low | 🔧 MANUAL — see Step 9 |
| 5 | Step 4: Deploy to Cloudflare Pages | Production deploy | Low | 🔧 MANUAL — see Step 4 |
| 6 | Step 15: Cursor IDE + dev tools | Developer workflow | Low | 🔧 MANUAL — see Step 15 |
| 7 | Step 12: Code splitting | Performance | Medium | ✅ DONE (82% reduction) |
| 8 | Step 7: Vitest unit tests | Business logic safety | High | ✅ DONE (210 tests) |
| 9 | Step 5: Sentry error monitoring | Production visibility | Low | Pending |
| 10 | Step 6: GitHub Actions CI | Prevent broken deploys | Medium | Pending |
| 11 | Step 8: Strict TypeScript | Catch bugs at compile | High | Pending |
| 12 | Step 10a: RLS audit | Security hardening | Medium | **Done** |
| 12b | Step 10b: Edge function validation audit | Security hardening | Medium | **Done** |
| 13 | Step 11: Supabase Pro upgrade | Data protection, SLA | Medium | Pending |
| 14 | Step 13: PWA hardening | Offline + caching | Medium | Pending |
| 15 | Step 14: Web Vitals monitoring | Performance tracking | Low | Pending |

---

## 7. Risk Considerations

### During Migration

| Risk | Mitigation |
|---|---|
| Lovable Auth removal breaks login | Test OAuth flow on staging before cutting over |
| Database migration drift between environments | Use Supabase CLI to keep migrations in sync |
| Environment variable misconfiguration | Document all required vars; CI fails on missing vars |
| Downtime during DNS cutover | Use Cloudflare Pages preview URL first; switch DNS only when verified |

### After Migration

| Risk | Mitigation |
|---|---|
| Supabase outage | Supabase Pro includes SLA; consider read replicas later |
| Cloudflare Pages build failures | GitHub Actions catches issues before deploy triggers |
| Cost increase | Monitor usage; current estimate is ~$55–80/month infrastructure + $20/month AI tooling |
| Team onboarding to new workflow | Document the new workflow in a CONTRIBUTING.md |

---

## Appendix A: Quick Reference Commands

```bash
# Local development
npm run dev                    # Start dev server on localhost:8080

# Testing
npm test                       # Run unit tests (Vitest)
npm run test:watch             # Watch mode
npx playwright test            # Run E2E tests

# Type checking
npm run typecheck               # Check for type errors (tsc --noEmit)

# Build
npm run build                  # Production build
npm run preview                # Preview production build locally

# Supabase
supabase start                 # Start local Supabase
supabase db push               # Apply migrations to linked project
supabase functions deploy      # Deploy all edge functions
supabase db lint               # Check for RLS issues

# Cloudflare Pages
wrangler pages deploy dist     # Manual deploy to Cloudflare Pages
wrangler pages project list    # List Pages projects
wrangler pages deployment list # List deployments

# Git workflow
git checkout -b feature/name   # Create feature branch
git push -u origin feature/name # Push and create PR
# → GitHub Actions runs CI (lint, type-check, test, build)
# → Cloudflare Pages creates preview deploy automatically
# → Merge to main triggers production deploy on Cloudflare Pages
```

---

## Appendix B: AI Development Workflow (Replacing Lovable)

### Daily Development with Cursor

```
1. Open project in Cursor
2. Press Cmd+L to open AI chat
3. Describe what you want: "Add a new assessment type selector to the admin dashboard"
4. Cursor generates code across multiple files
5. Review changes in the diff view
6. Accept, modify, or reject each change
7. Git commit and push → CI runs → Cloudflare deploys
```

### Complex Tasks with Claude Code

```
1. Open terminal in project directory
2. Run: claude
3. Describe the task: "Refactor all 65 hooks to consolidate duplicated Supabase query patterns"
4. Claude Code reads the codebase, plans changes, and executes them
5. Review the changes in Git diff
6. Commit and push
```

### Key Differences from Lovable

| Aspect | Lovable | Cursor + Claude Code |
|---|---|---|
| Code visibility | Hidden until export | Full visibility always |
| Version control | Lovable-managed | Standard Git |
| Deployment control | One-click (opaque) | CI/CD pipeline (transparent) |
| AI context | Limited to current file | Entire codebase (507 files) |
| Rollback | Limited | Full Git history |
| Multi-file changes | Limited | Full support (Composer mode) |
| Terminal access | None | Full (run tests, builds, CLI tools) |
| Collaboration | Lovable sharing | GitHub PRs, code review |

---

*End of document.*
