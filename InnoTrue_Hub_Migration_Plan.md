# InnoTrue Hub App — Production Migration Plan

**Date:** February 8, 2026
**Last updated:** February 9, 2026
**Prepared by:** Technical Analysis
**Scope:** Migration from Lovable Cloud to production-ready infrastructure

---

## Migration Progress

| Step | Description | Status |
|------|-------------|--------|
| 2 | Remove Lovable dependencies | DONE |
| 3 | Environment separation (.env.example, .gitignore) | PARTIAL |
| 4c | SPA routing (_redirects, _headers) | DONE |
| 6 | Vitest unit testing (210 tests, 11 test files) | DONE |
| 8 | CI scripts (typecheck added to package.json) | PARTIAL |
| 12 | Code splitting / lazy loading (82% bundle reduction) | DONE |
| — | AI provider: Vertex AI Gemini 3 Flash (EU/Frankfurt) | DONE |
| — | CSP hardened (removed Lovable/OpenAI/Anthropic domains) | DONE |
| — | Domain refs updated (app.innotrue.com) | DONE |
| — | robots.txt, sitemap.xml, README.md rewritten | DONE |
| — | Email audit: all 13 functions via Resend, old domain fixed | DONE |
| — | Supabase Auth Email Hook config (dashboard) | MANUAL — see Step 2 |
| — | Resend domain DNS verification (dashboard) | MANUAL — see Step 2 |
| — | Google OAuth config (dashboard) | MANUAL — see Step 2 |
| — | Edge function secrets (dashboard) | MANUAL — see Step 2 |
| — | Staging email override (all 13 functions wired) | DONE |
| — | Database seed file (supabase/seed.sql, 12 sections) | DONE |

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

#### Step 1 — Create Fresh Git Repository

> **Why a fresh repo?** The Lovable-managed repo has their deployment config, commit history tied to their pipeline, and potentially committed secrets. A clean repo from the updated codebase is the safest approach. The Lovable repo stays available if you ever need to reference its history.

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
pre-prod      → pre-production testing (Cloudflare Pages preview + pre-prod Supabase)
develop       → daily development (local + dev Supabase / Lovable project)
```

Set up the branches:

```bash
# Create develop branch (daily work happens here)
git checkout -b develop
git push -u origin develop

# Create pre-prod branch (integration testing before production)
git checkout -b pre-prod
git push -u origin pre-prod

# Go back to develop for daily work
git checkout develop
```

**Branch flow:**

```
feature/xyz → develop → pre-prod → main
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

- **Promote to pre-prod:** When develop is stable, merge to pre-prod
  ```bash
  # Create PR: develop → pre-prod (test on pre-prod Supabase)
  ```

- **Promote to production:** When pre-prod passes testing, merge to main
  ```bash
  # Create PR: pre-prod → main (deploys to production)
  ```

**1e. Branch protection rules (recommended):**

In GitHub → Settings → Branches → Add rule:

| Branch | Rules |
|--------|-------|
| `main` | Require PR, require CI to pass, no force push, require 1 approval |
| `pre-prod` | Require PR, require CI to pass, no force push |
| `develop` | Require PR (optional), require CI to pass |

**1f. Connect Cloudflare Pages to the repo:**

Once pushed, connect the repo to Cloudflare Pages (Step 4). Configure:
- **Production branch:** `main`
- **Preview branches:** `pre-prod`, `develop`, `feature/*`

Cloudflare Pages will auto-deploy `main` to production and create preview deploys for all other branches.

**Verify:**
- Repository is on GitHub with 3 branches (`main`, `pre-prod`, `develop`)
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

#### Step 3 — Create Environment Separation (PARTIALLY DONE)

> **Completed (Feb 9, 2026):** `.gitignore` updated with all `.env.*` patterns. `.env.example` template created with `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Remaining: create actual environment files once Supabase projects exist.

**Environment map:**

| Environment | Git Branch | Supabase Project | Frontend | APP_ENV |
|---|---|---|---|---|
| Development | `develop` | Existing Lovable project (`pfwlsxovvqdiwaztqxrj`) | `localhost:8080` | `development` |
| Pre-production | `pre-prod` | New: `innotrue-hub-preprod` | Cloudflare preview URL | `staging` |
| Production | `main` | New: `innotrue-hub-prod` | `app.innotrue.com` | `production` |

Create three environment files (do NOT commit these — they're in `.gitignore`):

**`.env.development`** (local dev, points to existing Lovable-managed Supabase):
```env
VITE_SUPABASE_URL=https://pfwlsxovvqdiwaztqxrj.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<existing-anon-key>
VITE_APP_ENV=development
```

**`.env.staging`** (pre-prod Supabase, created in Step 9):
```env
VITE_SUPABASE_URL=https://<preprod-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<preprod-anon-key>
VITE_APP_ENV=staging
```

**`.env.production`** (production Supabase, created in Step 9):
```env
VITE_SUPABASE_URL=https://<prod-project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<prod-anon-key>
VITE_SENTRY_DSN=<your-sentry-dsn>
VITE_APP_ENV=production
```

> **Note:** These local `.env` files are for local development only. Cloudflare Pages uses its own environment variables (configured in Step 9g) — it does NOT read local `.env` files.

**Verify:** `npm run dev` uses `.env.development` and connects to the correct Supabase project.

---

#### Step 4 — Deploy to Cloudflare Pages

**4a. Install Wrangler CLI:**
```bash
npm install -g wrangler
wrangler login
```

**4b. Option A — Connect via Cloudflare Dashboard (Recommended):**

1. Go to https://dash.cloudflare.com → Workers & Pages → Create application → Pages
2. Connect your GitHub repository
3. Configure build settings:
   - **Framework preset:** None (or Vite if available)
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - **Root directory:** `/` (project root)
   - **Node.js version:** Set environment variable `NODE_VERSION` = `20`
4. Add environment variables:
   - `VITE_SUPABASE_URL` → your production Supabase URL
   - `VITE_SUPABASE_PUBLISHABLE_KEY` → your production anon key
   - `VITE_SENTRY_DSN` → your Sentry DSN
   - `VITE_APP_ENV` → `production`
5. Click "Save and Deploy"

**4b. Option B — Deploy via CLI:**
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
> - **New pre-prod project** → for integration testing on `pre-prod` branch. Uses seed data.
> - **New production project** → for live users on `main` branch. Seed data initially, then real data.

**9a. Create two new Supabase projects:**

1. Go to https://supabase.com/dashboard → New Project
2. Create **both** projects in the **same region** (ideally `eu-west-1` or wherever existing project is):

| Project Name | Purpose | Branch | APP_ENV |
|---|---|---|---|
| `innotrue-hub-preprod` | Integration testing | `pre-prod` | `staging` |
| `innotrue-hub-prod` | Production | `main` | `production` |

3. For each project, note the:
   - **Project ref** (e.g., `abcdefghijklmnop`)
   - **Anon key** (public, starts with `eyJ...`)
   - **Service role key** (secret, starts with `eyJ...`)
   - **Database password** (set during creation)

**9b. Push migrations and seed to pre-prod:**

```bash
# Link to pre-prod project
supabase link --project-ref <preprod-project-ref>

# Push all 393 migrations (this may take a few minutes)
supabase db push

# Seed runs automatically on `supabase db reset`, but for a fresh
# remote project you need to run seed manually:
supabase db seed --project-ref <preprod-project-ref>
# OR run the seed SQL directly via Supabase Dashboard → SQL Editor:
# Copy/paste contents of supabase/seed.sql and execute

# Deploy all edge functions
supabase functions deploy --all --project-ref <preprod-project-ref>
```

**9c. Set pre-prod edge function secrets:**

```bash
# Required secrets for pre-prod
supabase secrets set RESEND_API_KEY=<your-resend-key> --project-ref <preprod-ref>
supabase secrets set SITE_URL=https://<preprod-preview-url>.pages.dev --project-ref <preprod-ref>
supabase secrets set STRIPE_SECRET_KEY=<stripe-TEST-key> --project-ref <preprod-ref>
supabase secrets set GCP_SERVICE_ACCOUNT_KEY='<service-account-json>' --project-ref <preprod-ref>
supabase secrets set GCP_PROJECT_ID=<gcp-project-id> --project-ref <preprod-ref>
supabase secrets set GCP_LOCATION=europe-west3 --project-ref <preprod-ref>

# Staging email override (all emails go to your inbox)
supabase secrets set APP_ENV=staging --project-ref <preprod-ref>
supabase secrets set STAGING_EMAIL_OVERRIDE=doina.popa@innotrue.com --project-ref <preprod-ref>
```

**9d. Push migrations and seed to production:**

```bash
# Link to production project
supabase link --project-ref <prod-project-ref>

# Push all migrations
supabase db push

# Seed the database (for initial testing — you can clear demo users later)
supabase db seed --project-ref <prod-project-ref>
# OR run via SQL Editor

# Deploy all edge functions
supabase functions deploy --all --project-ref <prod-project-ref>
```

**9e. Set production edge function secrets:**

```bash
# Required secrets for production
supabase secrets set RESEND_API_KEY=<your-resend-key> --project-ref <prod-ref>
supabase secrets set SITE_URL=https://app.innotrue.com --project-ref <prod-ref>
supabase secrets set STRIPE_SECRET_KEY=<stripe-LIVE-key> --project-ref <prod-ref>
supabase secrets set GCP_SERVICE_ACCOUNT_KEY='<service-account-json>' --project-ref <prod-ref>
supabase secrets set GCP_PROJECT_ID=<gcp-project-id> --project-ref <prod-ref>
supabase secrets set GCP_LOCATION=europe-west3 --project-ref <prod-ref>

# Production: do NOT set APP_ENV or STAGING_EMAIL_OVERRIDE
# (emails go to real recipients)
```

**9f. Configure manual dashboard settings for EACH new project:**

Repeat the manual steps from Step 2 for both pre-prod and prod:

1. **Google OAuth:** Dashboard → Authentication → Providers → Google
   - Callback URL differs per project: `https://<project-ref>.supabase.co/auth/v1/callback`
   - Add both callback URLs to your Google Cloud Console OAuth client

2. **Auth Email Hook:** Dashboard → Authentication → Hooks → Send Email
   - URI: `https://<project-ref>.supabase.co/functions/v1/send-auth-email`
   - Header: `Authorization: Bearer <service-role-key-for-that-project>`

3. **Auth redirect URLs:** Dashboard → Authentication → URL Configuration
   - Pre-prod: add your Cloudflare Pages preview URL
   - Prod: add `https://app.innotrue.com`

**9g. Wire Cloudflare Pages environment variables:**

In Cloudflare Dashboard → Pages → your project → Settings → Environment variables:

| Variable | Production (`main`) | Preview (other branches) |
|---|---|---|
| `VITE_SUPABASE_URL` | `https://<prod-ref>.supabase.co` | `https://<preprod-ref>.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | `<prod-anon-key>` | `<preprod-anon-key>` |
| `VITE_APP_ENV` | `production` | `staging` |

**9h. Switching Supabase CLI between projects:**

The CLI can only be linked to one project at a time. Use `--project-ref` flags or re-link:

```bash
# Quick switch
supabase link --project-ref <preprod-ref>   # work on pre-prod
supabase link --project-ref <prod-ref>      # switch to prod

# Or use --project-ref flag without re-linking
supabase db push --project-ref <preprod-ref>
supabase functions deploy --all --project-ref <prod-ref>
```

**9i. Data migration from Lovable project (later):**

When you're ready to export real data from the Lovable-managed project:

```bash
# Export data from existing project (ask Lovable for DB credentials, or use their export)
pg_dump --data-only --no-owner --no-privileges \
  -h db.<lovable-project-ref>.supabase.co -U postgres -d postgres \
  --exclude-table-data='auth.*' \
  > data_export.sql

# Import into production (after reviewing the export)
psql -h db.<prod-ref>.supabase.co -U postgres -d postgres < data_export.sql
```

**Verify:**
- Both new projects have 393 migrations applied
- Seed data is present (log in with demo credentials)
- Edge functions are deployed (`supabase functions list --project-ref <ref>`)
- Cloudflare Pages preview deploys connect to pre-prod Supabase
- Cloudflare Pages production deploys connect to production Supabase

---

#### Step 10 — Audit Row Level Security (RLS) Policies

**10a. Check for unprotected tables:**
```sql
-- Run in Supabase SQL Editor
SELECT schemaname, tablename
FROM pg_tables
WHERE schemaname = 'public'
AND tablename NOT IN (
  SELECT tablename FROM pg_policies WHERE schemaname = 'public'
);
```

Any tables returned have NO RLS policies and are potentially exposed.

**10b. Audit edge functions for input validation:**

Add Zod validation to all public-facing edge functions:
```ts
import { z } from 'zod';

const RequestSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1).max(100),
});

// In the function handler:
const body = RequestSchema.parse(await req.json());
```

**10c. Add rate limiting to public edge functions:**

Use Supabase's built-in rate limiting or add a simple in-memory counter:
```ts
// In edge function
const rateLimitKey = `rate_limit:${clientIp}`;
// Check against Supabase KV or Redis
```

**Verify:** All public tables have RLS policies; edge functions validate input.

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

## 6. Priority Order

| Priority | Step | Impact | Effort | Status |
|---|---|---|---|---|
| 1 | Git repo + remove Lovable deps | Unblocks everything | Low | ✅ Lovable removed, git init pending |
| 2 | Deploy to Cloudflare Pages | Independent production deploy | Low | Pending (SPA files ready) |
| 3 | Environment separation | Security, safe testing | Low | ✅ .env.example + .gitignore done |
| 4 | Sentry error monitoring | Production visibility | Low | Pending |
| 5 | GitHub Actions CI | Prevent broken deploys | Medium | Partial (typecheck script added) |
| 6 | Strict TypeScript | Catch bugs at compile time | High | Pending |
| 7 | Vitest unit tests | Business logic safety net | High | ✅ 210 tests passing |
| 8 | Supabase Pro + staging DB | Data protection | Medium | Pending |
| 9 | Code splitting + PWA hardening | Performance | Medium | ✅ Code splitting done (82% reduction) |
| 10 | RLS audit + rate limiting | Security hardening | Medium | Pending |

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
