# InnoTrue Hub — Technical Reference

> Detailed reference of the technical infrastructure, tooling, and architecture decisions implemented during the Feb 2026 migration and hardening sprint.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Environments & Deployment](#2-environments--deployment)
3. [Authentication & Authorization](#3-authentication--authorization)
4. [Database](#4-database)
5. [Edge Functions](#5-edge-functions)
6. [AI Integration](#6-ai-integration)
7. [Email System](#7-email-system)
8. [Frontend Architecture](#8-frontend-architecture)
9. [TypeScript Configuration](#9-typescript-configuration)
10. [Error Monitoring (Sentry)](#10-error-monitoring-sentry)
11. [Web Vitals](#11-web-vitals)
12. [PWA & Service Worker](#12-pwa--service-worker)
13. [Testing Infrastructure](#13-testing-infrastructure)
14. [CI/CD Pipeline](#14-cicd-pipeline)
15. [Security](#15-security)
16. [Developer Tooling](#16-developer-tooling)
17. [Environment Variables Reference](#17-environment-variables-reference)
18. [Known Issues & Caveats](#18-known-issues--caveats)

---

## 1. Architecture Overview

```
┌──────────────────────────────────────────────────────────────┐
│                    Cloudflare Pages                          │
│         React 18 + Vite 5 + TypeScript SPA                 │
│         app.innotrue.com (production)                       │
└──────────────────┬───────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────┐
│                     Supabase                                 │
│  ┌────────────┐  ┌──────────────┐  ┌───────────────────┐   │
│  │ PostgreSQL │  │   Auth       │  │   Storage          │   │
│  │ 380+ tables│  │ Google OAuth │  │   File uploads     │   │
│  │ RLS on all │  │ Email/Pass   │  │   Wheel PDFs       │   │
│  └────────────┘  └──────────────┘  └───────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              65 Edge Functions (Deno)                 │   │
│  │  Email (13) │ AI (5+) │ xAPI (3) │ Stripe │ Cal.com │   │
│  └──────────────────────────────────────────────────────┘   │
└──────────────────┬───────────────────────────────────────────┘
                   │
       ┌───────────┼───────────┐
       ▼           ▼           ▼
   Vertex AI    Resend      Stripe
   (Frankfurt)  (Email)    (Payments)
```

**Stack:** React 18 + Vite 5 + TypeScript (strict) + Supabase + Tailwind CSS + shadcn/ui

**Key design decisions:**
- SPA with lazy-loaded routes (164+ pages, code-split to 977KB main bundle)
- Supabase for backend (auth, database, storage, edge functions) — no custom server
- Google Vertex AI for AI features (EU data residency in Frankfurt, europe-west3)
- Resend for transactional email (13 edge functions)
- Stripe for payments (credit system with individual + org balances)
- Cloudflare Pages for hosting (auto-deploy from GitHub)

---

## 2. Environments & Deployment

### Three-environment setup

| Environment | Git Branch | Supabase Project | Frontend URL | `APP_ENV` |
|-------------|-----------|-----------------|--------------|-----------|
| Development | `develop` | `pfwlsxovvqdiwaztqxrj` (Lovable-owned) | `localhost:8080` | `development` |
| Pre-production | `preprod` | `jtzcrirqflfnagceendt` | Cloudflare Pages preview | `staging` |
| Production | `main` | `qfdztdgublwlmewobxmx` | `app.innotrue.com` | `production` |

### Git branch flow

```
feature/xyz  ──►  develop  ──►  preprod  ──►  main
                  (daily)      (staging)     (production)
```

All merges are fast-forward when possible. No squash merges.

### Cloudflare Pages deployment

- **Connected to:** GitHub repo `doina-popa-innotrue/innotrue-hub-live`
- **Production branch:** `main` (auto-deploys to `app.innotrue.com`)
- **Preview branches:** All other branches get preview URLs
- **Build command** (handles env switching via `CF_PAGES_BRANCH`):

```bash
if [ "$CF_PAGES_BRANCH" = "main" ]; then
  export VITE_SUPABASE_URL="https://qfdztdgublwlmewobxmx.supabase.co"
  export VITE_SUPABASE_PUBLISHABLE_KEY="<prod-key>"
  export VITE_SENTRY_DSN="https://53c8f56b03ee...@o451...ingest.de.sentry.io/451..."
  export VITE_APP_ENV="production"
else
  export VITE_SUPABASE_URL="https://jtzcrirqflfnagceendt.supabase.co"
  export VITE_SUPABASE_PUBLISHABLE_KEY="<preprod-key>"
fi && npm run build
```

### Supabase project details

Both preprod and prod have:
- 421+ database migrations applied (including Phase 5 self-registration)
- Seed data loaded (`supabase/seed.sql`)
- 71 edge functions deployed (including `complete-registration`, `redeem-enrollment-code`, `redeem-partner-code`, `alumni-lifecycle`)
- Google OAuth enabled (Phase 5)
- Auth email hook pointing to `send-auth-email` edge function
- Self-registration active: signup form + Google OAuth + role selection

---

## 3. Authentication & Authorization

### Auth providers

- **Email/Password + custom verification** — primary signup method via `signup-user` → email → `verify-signup` → `/complete-registration`
- **Google OAuth** — Supabase built-in provider, redirects new users to `/complete-registration`

### Self-registration flow (Phase 5)

1. **Email signup:** User fills form → `signup-user` creates user + sends verification email → user clicks link → `verify-signup` creates profile with `registration_status: 'pending_role_selection'` → redirect to `/complete-registration`
2. **Google OAuth:** User clicks "Continue with Google" → Supabase handles OAuth → `ProtectedRoute` detects new user (no profile, `app_metadata.provider === "google"`) → redirect to `/complete-registration`
3. **Role selection:** At `/complete-registration`, user picks client (immediate) or coach/instructor (pending admin approval). All users get client role + free plan. Coach/instructor role is additive after admin approves at `/admin/coach-requests`.
4. **Placeholder handling:** If the user's email matches a hidden placeholder profile, `verify-signup` (email) or `complete-registration` (Google OAuth) transfers data from 7 tables and copies roles + plan.

### User roles

Defined in the `app_role` enum: `admin`, `client`, `coach`, `instructor`, `org_admin`

Roles are stored in `public.user_roles(user_id, role)` — a user can have multiple roles.

### Route protection

- `src/App.tsx` wraps routes in `<ProtectedRoute>` (optionally with `requireRole="admin"`)
- `src/contexts/AuthContext.tsx` manages auth state, role detection, `registrationStatus`, and route redirects
- `ProtectedRoute` handles: `pending_role_selection` → `/complete-registration`, `pending_approval` → safety net card, Google OAuth new users → `/complete-registration`
- Role-based redirects after login:
  - `admin` → `/admin`
  - `client` → `/dashboard`
  - `coach` / `instructor` → `/teaching`

### Platform Terms of Service gate

**File:** `src/components/terms/PlatformTermsAcceptanceGate.tsx`

After login, users must accept the current platform terms before accessing the app. Implementation:

- Uses React Query (`useQuery`) with 5-minute `staleTime` and 30-minute `gcTime`
- Query key: `['platform-terms-acceptance', userId]`
- Three states: `blocking` (first time or blocking update), `update-banner` (non-blocking update), `accepted`
- After acceptance, calls `queryClient.invalidateQueries()` to refresh state
- Content hash (SHA-256 via CryptoJS) stored for audit trail
- Blocking modal renders at `z-[60]` to sit above the cookie banner (`z-50`)
- Update banner modal also at `z-[60]`

---

## 4. Database

### Schema overview

- **380+ tables**, 20+ enum types, 420 migrations
- All public tables have **RLS enabled** (276 tables total, 41 with explicit policies, 235 locked to service_role only)
- Key enums: `app_role`, `program_category`, `module_type`, `enrollment_status`, `decision_status`, `goal_category`

### Plans & features system

- Plans: `key`, `name`, `tier_level` (0-4), `is_free`, `credit_allowance`, `is_purchasable`
- Seed plans: Free (tier 0, 20 credits), Base (tier 1, 150), Pro (tier 2, 250), Advanced (tier 3, 500), Elite (tier 4, 750), Programs (tier 0), Continuation (tier 0)
- Features: `key`, `name`, `is_consumable`; linked to plans via `plan_features` (with `limit_value`)

### Credit system

Dual credit system:
- **Individual:** `user_credit_balances` — per-user credits
- **Organization:** `org_credit_balances` — shared org credits
- 15 credit services, 3 individual top-up packages, 3 org packages, 2 org platform tiers

### Seed data

**File:** `supabase/seed.sql` — runs automatically on `supabase db reset`

12 sections covering system settings, plans, features, tracks, session types, credit system, notification system, Wheel of Life categories, sample programs, demo users with enrollments, and platform terms.

All INSERTs use `ON CONFLICT` for idempotency.

**Demo users:**

| Role | Email | Password |
|------|-------|----------|
| Admin | `doina.popa@innotrue.com` | `DemoPass123!` |
| Client | `sarah.johnson@demo.innotrue.com` | `DemoPass123!` |
| Client | `michael.chen@demo.innotrue.com` | `DemoPass123!` |
| Coach | `emily.parker@demo.innotrue.com` | `DemoPass123!` |

---

## 5. Edge Functions

### Overview

66 Deno/TypeScript edge functions in `supabase/functions/`.

All functions have `verify_jwt = false` in `supabase/config.toml` — they implement custom auth checks internally (checking the `Authorization` header via `supabase.auth.getUser()`).

### Shared utilities

| File | Purpose |
|------|---------|
| `_shared/cors.ts` | Environment-aware CORS with origin allowlisting (`getCorsHeaders(req)`) |
| `_shared/error-response.ts` | Typed error/success response helpers (`errorResponse.*`, `successResponse.*`) |
| `_shared/ai-config.ts` | AI provider configuration (swappable: Vertex AI, Mistral, Azure, OpenAI) |
| `_shared/ai-input-limits.ts` | Prompt truncation helpers (`truncateString`, `truncateArray`, `enforcePromptLimit`) |
| `_shared/email-utils.ts` | Staging email override + user email status checks |
| `_shared/calcom-utils.ts` | Cal.com API helpers (booking cancellation) |

### CORS configuration

**File:** `supabase/functions/_shared/cors.ts`

- `getCorsHeaders(request)` — returns CORS headers with the request's origin if it's in the allowlist
- Allowed origins: `app.innotrue.com`, `SITE_URL` env var, `SUPABASE_URL` env var, `localhost:*`
- `corsHeaders` (legacy) — uses `*`, deprecated in favor of `getCorsHeaders()`

---

## 6. AI Integration

### Provider: Google Vertex AI

**File:** `supabase/functions/_shared/ai-config.ts`

- **Model:** `google/gemini-3-flash-preview`
- **Region:** `europe-west3` (Frankfurt, Germany) — EU data residency
- **Auth:** GCP service account → JWT → OAuth2 access token (cached with 5-min buffer)
- **Endpoint:** OpenAI-compatible chat completions on Vertex AI

### How it works

1. Service account key (`GCP_SERVICE_ACCOUNT_KEY`) is stored as a Supabase secret
2. `ai-config.ts` creates a signed JWT, exchanges it for a Google OAuth2 access token
3. Token is cached in memory until 5 minutes before expiry
4. All AI calls use the standard OpenAI chat completions format via `aiChatCompletion()`

### Switching providers

The config supports 5 providers (uncomment the desired one in `ai-config.ts`):

| Provider | Endpoint | EU Data Residency | Notes |
|----------|----------|-------------------|-------|
| **Vertex AI** (active) | Dynamic (Frankfurt) | Yes (europe-west3) | Recommended |
| Mistral AI | `api.mistral.ai` | Yes (Paris HQ) | Best price-performance |
| Google AI Studio | `generativelanguage.googleapis.com` | No (US) | Free tier |
| Azure OpenAI | `{resource}.openai.azure.com` | Yes (Sweden Central) | Enterprise SLA |
| OpenAI | `api.openai.com` | Opt-in | Widest model selection |

No code changes needed when switching — all providers use the OpenAI-compatible chat format.

---

## 7. Email System

### Provider: Resend

13 edge functions send branded transactional emails via two patterns:

**Resend SDK pattern (8 functions):**
`send-auth-email`, `send-welcome-email`, `send-org-invite`, `send-wheel-pdf`, `subscription-reminders`, `signup-user`, `request-account-deletion`, `check-ai-usage`

**Fetch API pattern (5 functions):**
`send-notification-email`, `notify-assignment-graded`, `notify-assignment-submitted`, `decision-reminders`, `process-email-queue`

### Staging email override

**File:** `supabase/functions/_shared/email-utils.ts`

When `APP_ENV` is not `production` and `STAGING_EMAIL_OVERRIDE` is set, all emails are redirected to the override address:

- `getStagingRecipient(email)` — returns override or original email
- `getStagingRecipients(emails[])` — array version, de-duplicated
- `getStagingSubject(subject, originalRecipient)` — prefixes subject with `[STAGING -> original@email]`

All 13 email-sending functions are wired to use these helpers.

**Setup:** Set these as Supabase Edge Function secrets:
```
APP_ENV=staging
STAGING_EMAIL_OVERRIDE=your@email.com
```

### Email status checks

`email-utils.ts` also provides `checkUserEmailStatus()` and `checkEmailRecipientStatus()` to prevent sending emails to disabled or inactive users. Admin notification types bypass this check.

---

## 8. Frontend Architecture

### Code splitting

All 164+ page components are lazy-loaded in `src/App.tsx`:
```typescript
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
```

**Result:** Main bundle reduced from 5.3MB to 977KB (82% reduction).

### Key UI patterns

| Pattern | Implementation |
|---------|---------------|
| Data fetching | TanStack React Query hooks in `src/hooks/` |
| Forms | React Hook Form + Zod validation |
| UI primitives | shadcn/ui (`src/components/ui/` — do not modify directly) |
| Styling | Tailwind CSS (no CSS modules or styled-components) |
| State management | React Query for server state, React Context for auth |
| Path alias | `@/` maps to `src/` |
| Icons | Lucide React |

### Shared services (`src/lib/`)

Reusable business logic extracted into shared service modules:

| Service | File | Purpose |
|---------|------|---------|
| Assessment scoring | `src/lib/assessmentScoring.ts` | `calculateDomainScore()`, `parseQuestionTypes()`, `validateTypeWeights()` — shared by snapshot form, view, and charts |
| Path instantiation | `src/lib/guidedPathInstantiation.ts` | `instantiateTemplate()`, `estimateCompletionDate()` — shared by survey wizard PathConfirmation and GuidedPathDetail copy dialog |
| File validation | `src/lib/fileValidation.ts` | `validateFile(file, bucket)`, `sanitizeFilename()` — shared by all 13 upload interfaces |

### Key hooks (DP1-DP4 additions)

| Hook | File | Purpose |
|------|------|---------|
| `useGoalAssessmentLinks` | `src/hooks/useGoalAssessmentLinks.ts` | Goal↔assessment link CRUD with domain/assessment name joins |
| `useMilestoneGates` | `src/hooks/useMilestoneGates.ts` | Gates CRUD, batch fetch, traffic-light status computation, override creation |

### Cookie consent banner

**File:** `src/components/gdpr/CookieConsentBanner.tsx`

- Consent stored in `localStorage` key `innotrue_cookie_consent`
- Hidden on `/auth` routes (via `useLocation()` check)
- Renders at `z-50`
- Three categories: necessary (always on), analytics, marketing

### z-index stacking order

| Layer | z-index | Component |
|-------|---------|-----------|
| Cookie banner | `z-50` | `CookieConsentBanner` |
| ToS gate (blocking) | `z-[60]` | `PlatformTermsAcceptanceGate` |
| ToS update modal | `z-[60]` | `PlatformTermsUpdateBanner` modal |
| Toast notifications | `z-[100]` | Sonner toasts |

---

## 9. TypeScript Configuration

### Strict mode — fully enabled

**Files:** `tsconfig.json`, `tsconfig.app.json`

All strict flags are active:

| Flag | Status |
|------|--------|
| `noImplicitAny` | Enabled |
| `strictFunctionTypes` | Enabled |
| `strictBindCallApply` | Enabled |
| `noImplicitThis` | Enabled |
| `alwaysStrict` | Enabled |
| `useUnknownInCatchVariables` | Enabled |
| `noFallthroughCasesInSwitch` | Enabled |
| `strictNullChecks` | Enabled |

**Note:** `strict: false` is set in `tsconfig.app.json` because the individual flags above are enabled explicitly (equivalent to `strict: true` but gives granular control). Both `tsconfig.json` and `tsconfig.app.json` have `strictNullChecks: true`.

### Common fix patterns used during strict migration

- `useParams()` early guards: `if (!id) return null`
- Null coalescing: `?? ''`, `?? false`, `?? undefined`
- Type assertions for Supabase query results: `as Type` / `as unknown as Type`
- `.filter()` to remove nulls from arrays
- Supabase RPC params: use `null` (not `undefined`) — `undefined` gets stripped from JSON

---

## 10. Error Monitoring (Sentry)

### Setup

**File:** `src/main.tsx`

- **Package:** `@sentry/react@10.38.0`
- **DSN:** `https://53c8f56b03ee0ae03b41eb79dd643cbd@o4510864206659584.ingest.de.sentry.io/4510864215703632`
- **Gated:** Only initializes when both `VITE_SENTRY_DSN` and `VITE_APP_ENV=production` are set
- **Integrations:** Browser tracing + session replay (replay only on errors)
- **Sample rates:** `tracesSampleRate: 0.1`, `replaysSessionSampleRate: 0`, `replaysOnErrorSampleRate: 1.0`

### Error boundary

**File:** `src/components/ErrorBoundary.tsx`

- Wraps the entire app
- Reports caught errors to Sentry via `Sentry.captureException()`
- Uses Sentry event ID as the error reference (falls back to generated ID)
- Shows user-friendly error card with "Try Again" and "Reload Page" buttons
- Error ID is copyable for support reference
- Dev mode shows full stack trace; production shows minimal info

### CSP

`connect-src` includes `https://*.sentry.io` to allow Sentry reporting.

---

## 11. Web Vitals

### Setup

**File:** `src/lib/vitals.ts`

- **Package:** `web-vitals@5.1.0`
- **Metrics tracked:** CLS, INP, LCP, FCP, TTFB
- **Production:** Sends metrics to Sentry as custom distributions
- **Development:** Logs to console
- **Loading:** Lazy-loaded in `src/main.tsx` (`import('@/lib/vitals').then(...)`)

---

## 12. PWA & Service Worker

### Configuration

**File:** `vite.config.ts` (via `vite-plugin-pwa`)

- **Register type:** `autoUpdate`
- **Max cache size:** 6 MB per file
- **Navigation fallback denylists:** `/auth/`, `/callback` (prevents service worker from intercepting auth flows)

### Caching strategies

| Pattern | Strategy | TTL | Max Entries |
|---------|----------|-----|-------------|
| Static assets (images, fonts) | CacheFirst | 30 days | 100 |
| Supabase API (`/rest/`) | NetworkFirst (10s timeout) | 5 minutes | 50 |
| Supabase Storage (`/storage/`) | CacheFirst | 7 days | 50 |

Auth endpoints are never cached.

---

## 13. Testing Infrastructure

### Unit tests (Vitest)

- **303 tests** in `src/lib/__tests__/` (18 test files)
- Run: `npm test` (single run), `npm run test:watch` (watch mode)
- Coverage: `npm run test:coverage`

### E2E tests (Playwright)

**Config:** `playwright.config.ts`

- Tests run against **live preprod** environment (or localhost for local dev)
- Chromium only (Firefox/WebKit configs available but commented out)
- CI mode: 2 retries, 1 worker, `github` reporter, no webServer
- Local mode: 0 retries, parallel workers, `html` reporter, auto-starts dev server

### E2E test structure

```
e2e/
├── fixtures/
│   └── auth.ts                    # Pre-authenticated page fixtures
├── helpers/
│   ├── test-users.ts              # Credentials (env var overrides)
│   ├── auth-storage-paths.ts      # Cached session file paths
│   └── dismiss-overlays.ts        # Cookie/ToS overlay helpers
└── tests/
    ├── auth.setup.ts              # Login as each role, save state
    ├── auth.spec.ts               # Login/logout/redirect tests
    ├── admin/dashboard.spec.ts    # Admin tests
    ├── client/dashboard.spec.ts   # Client tests
    ├── client/decisions.spec.ts   # Client decisions tests
    ├── coach/dashboard.spec.ts    # Coach tests
    └── instructor/dashboard.spec.ts # Instructor tests
```

### Auth setup pattern

1. `auth.setup.ts` logs in via UI for each role (admin, client, coach, instructor)
2. Dismisses cookie banner and accepts ToS if present
3. Saves browser `storageState` to `e2e/.auth/{role}.json` (gitignored)
4. Test specs use `auth.ts` fixtures (`adminPage`, `clientPage`, `coachPage`, `instructorPage`) that load the saved state

### Test user credentials

Configured in `e2e/helpers/test-users.ts` with env var overrides:

| Role | Env Vars | Default Email | Dashboard Path |
|------|----------|--------------|----------------|
| Admin | `E2E_ADMIN_EMAIL/PASSWORD` | `doinapopade@gmail.com` | `/admin` |
| Client | `E2E_CLIENT_EMAIL/PASSWORD` | `innohub_client1@innotrue.com` | `/dashboard` |
| Coach | `E2E_COACH_EMAIL/PASSWORD` | `emily.parker@demo.innotrue.com` | `/teaching` |
| Instructor | `E2E_INSTRUCTOR_EMAIL/PASSWORD` | `innohub_instructor@innotrue.com` | `/teaching` |

### Running E2E tests

```bash
npm run test:e2e          # Headless
npm run test:e2e:headed   # With visible browser
npm run test:e2e:ui       # Interactive UI mode (debugging)
```

Clean cached auth and re-run: `rm -rf e2e/.auth && npm run test:e2e`

### Current test results

**14 passed, 0 failed** (4 auth setups + 10 test specs)

---

## 14. CI/CD Pipeline

### GitHub Actions

**File:** `.github/workflows/ci.yml`

**Triggers:** Push or PR to `main`, `preprod`, `develop`

### Jobs

#### 1. `quality` — runs on all branches

```
Checkout → Node 20 → npm ci → Lint → Typecheck → Unit Tests → Build
```

- Build uses placeholder Supabase env vars (just validates the build succeeds)
- Completes in ~1 minute

#### 2. `e2e` — runs only on `preprod`

```
Checkout → Node 20 → npm ci → Install Chromium → Run E2E → Upload Report
```

- Depends on `quality` job passing
- Triggers only on `preprod` branch pushes/PRs
- Credentials from GitHub repository secrets (8 secrets for 4 user roles)
- `PLAYWRIGHT_BASE_URL` set to `https://app.innotrue.com`
- Playwright HTML report uploaded as artifact (14-day retention)

### GitHub repository secrets needed

| Secret | Purpose |
|--------|---------|
| `E2E_ADMIN_EMAIL` | Admin test user email |
| `E2E_ADMIN_PASSWORD` | Admin test user password |
| `E2E_CLIENT_EMAIL` | Client test user email |
| `E2E_CLIENT_PASSWORD` | Client test user password |
| `E2E_COACH_EMAIL` | Coach test user email |
| `E2E_COACH_PASSWORD` | Coach test user password |
| `E2E_INSTRUCTOR_EMAIL` | Instructor test user email |
| `E2E_INSTRUCTOR_PASSWORD` | Instructor test user password |

Set in: GitHub repo → Settings → Secrets and variables → Actions

### ESLint configuration

8 rules downgraded from errors to warnings to accommodate 931 pre-existing violations from Lovable-generated code (mostly `@typescript-eslint/no-explicit-any`). CI passes despite warnings.

---

## 15. Security

### RLS audit results

- **276 tables** total, all have RLS enabled
- **41** with explicit access policies
- **235** locked down (service_role only — no public access)
- **0** tables without RLS

### Edge function validation audit

- **23** functions with proper validation (Zod, UUID regex, rate limiting, HMAC, timing-safe)
- **28** with partial validation (auth checks present, body validation gaps)
- **6** with no validation on user input
- **6** need no user input (cron jobs, webhooks with signature verification)

### CORS

Origin-aware CORS in `_shared/cors.ts` — only `app.innotrue.com`, configured `SITE_URL`, and localhost are allowed.

### Content Security Policy

- Main app CSP includes `https://*.sentry.io` in `connect-src` for error reporting
- Rise content served via `serve-content-package` has its own CSP allowing `blob:` URIs, inline scripts/styles (`unsafe-inline`, `unsafe-eval`), and Supabase domain connections for xAPI statement submission

### Secrets management

- Frontend: `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `VITE_SENTRY_DSN`, `VITE_APP_ENV`
- Edge functions: `SITE_URL`, `STRIPE_SECRET_KEY`, `RESEND_API_KEY`, `GCP_SERVICE_ACCOUNT_KEY`, `GCP_PROJECT_ID`, `GCP_LOCATION`, `OAUTH_ENCRYPTION_KEY`, `CALENDAR_HMAC_SECRET`
- Staging: `APP_ENV`, `STAGING_EMAIL_OVERRIDE`
- Supabase Dashboard: Google OAuth Client ID/Secret, Auth Email Hook → `send-auth-email`

---

## 15b. Rise xAPI Content Delivery Architecture

### Overview

Rise content packages (exported as xAPI/Tin Can from Articulate Rise) are served inline within the platform using a blob URL iframe approach with a parent-window LMS mock.

### Content Flow

```
Rise xAPI ZIP → Admin upload (upload-content-package) → Supabase Storage (private bucket)
                                                            │
Client opens module → xapi-launch (session create/resume) → serve-content-package (auth proxy)
                                                            │
                                         HTML fetched → URLs rewritten → blob URL iframe rendered
                                                            │
                                         Rise calls window.parent.* → LMS mock on parent window
                                                            │
                                         Mock sends xAPI statements → xapi-statements edge function
                                                            │
                                         Auto-completion on completed/passed/mastered verbs
```

### Key Technical Decisions

1. **Blob URL iframe (not direct iframe):** Rise content uses relative paths (`lib/`, `assets/`). Direct iframe from edge function would require full URL rewriting of all JS/CSS/media. Instead, HTML is fetched, script/link URLs are rewritten to absolute URLs pointing at the edge function, and the modified HTML is rendered as a `blob:` URL. This lets Rise JS execute in a sandboxed origin while still loading assets from the real server.

2. **Parent-window LMS mock (not postMessage):** Rise expects SCORM/xAPI LMS functions on `window.parent` (e.g., `window.parent.GetBookmark()`). The frontend installs these functions on the parent window before loading the iframe. This avoids cross-origin postMessage complexity and works because the blob iframe's scripts can access the parent window's functions.

3. **Basic auth for xAPI (not Bearer JWT):** Rise xAPI runtime sends statements using Basic auth (`Authorization: Basic <base64(token:)>`). The `xapi-statements` edge function decodes this to extract the raw auth token matching `xapi_sessions.auth_token`. This is standard xAPI 1.0.3 behavior.

4. **Session resume via bookmark/suspend_data:** Rise uses SCORM-compatible `SetBookmark()`/`GetBookmark()` for scroll position and `SetDataChunk()`/`GetDataChunk()` for full course state. These are persisted to `xapi_sessions` columns via `PUT ?stateId=bookmark|suspend_data` on the xapi-statements endpoint.

5. **Ref-based dependency stabilization:** `ContentPackageViewer.tsx` stores `accessToken` and `onXapiComplete` in React refs to prevent Supabase JWT token refresh events from destroying the iframe. Without this, every ~60-minute token refresh would reload the content.

### Edge Functions

| Function | Auth | Purpose |
|----------|------|---------|
| `serve-content-package` | Bearer JWT (user must be enrolled or staff) | Serves Rise files from private storage, injects `<base>` tag + URL rewrite scripts into HTML |
| `xapi-launch` | Bearer JWT | Creates new xAPI session or resumes existing one. Returns session ID, auth token, xAPI config, saved bookmark/suspendData |
| `xapi-statements` | Basic auth (session token) | POST: stores statements, auto-completes on completion verbs. PUT with `?stateId=`: saves bookmark/suspend_data. GET: retrieves statements |

### Database Tables

| Table | Indexes | Purpose |
|-------|---------|---------|
| `xapi_sessions` | `auth_token` (unique), `user_id+module_id`, `status` (partial) | Session lifecycle + resume state |
| `xapi_statements` | `session_id`, `user_id+module_id`, `verb_id` | Statement storage + query |

### CSP Configuration

Content served via `serve-content-package` includes a Content-Security-Policy header allowing `blob:` URIs, inline scripts/styles (required by Rise), and connections to the Supabase domain for xAPI statement submission.

### Content Package Upload

1. Admin uploads ZIP via `upload-content-package` edge function
2. ZIP extracted with JSZip, files uploaded to `module-content-packages/{moduleId}/{uuid}/`
3. Previous package files cleaned up
4. `program_modules.content_package_path` updated
5. Admin sets `content_package_type` to `web` or `xapi`

---

## 15c. Shared Content Library & Cross-Program Completion (CT3)

### Shared Content Packages

Content packages can be uploaded once to a shared library and assigned to modules across programs. The `content_packages` table stores metadata (title, description, storage_path, package_type, file_count). Modules reference shared packages via `program_modules.content_package_id` FK.

**Upload modes in `upload-content-package`:**
1. **Shared** — title + file → `shared/{uuid}/`, creates `content_packages` row
2. **Replace** — contentPackageId + file → replaces ZIP in existing package
3. **Legacy** — moduleId + file → unchanged per-module upload (backward compat)

**Content Library Admin Page (`/admin/content-library`):** Stats cards, search/filter, table with title/type/files/module count/uploader, upload/replace/delete dialogs.

**ModuleForm Integration:** Two-tab card — "From Library" (combobox picker) / "Upload New" (creates shared + auto-assigns). "Migrate to Library" button for legacy modules.

### Cross-Program Completion

When a client completes content via xAPI (`xapi-statements` edge function), the system checks if the module has a `content_package_id`. If so, it upserts a `content_completions` record (user_id + content_package_id = UNIQUE). On subsequent module loads, if the module's content package has a completion record, `module_progress` auto-upserts to "completed" with a toast notification.

The `useCrossProgramCompletion` hook resolves completions from 3 sources: canonical codes, TalentLMS, and content packages.

### Database Tables

| Table | Key Fields | Purpose |
|-------|-----------|---------|
| `content_packages` | id, title, storage_path, package_type, file_count, uploaded_by, is_active | Shared content library |
| `content_completions` | user_id, content_package_id, source_module_id, result_score_scaled | Cross-program completion tracking (UNIQUE on user_id + content_package_id) |

---

## 15d. Self-Enrollment Codes (G8)

### Overview

Admins generate shareable enrollment codes per program. Authenticated users redeem codes at `/enroll?code=CODE` to self-enroll without admin intervention.

### Database

| Table/Object | Purpose |
|-------------|---------|
| `enrollment_codes` | Code registry — program_id, cohort_id, code (unique), code_type, max_uses, current_uses, grants_tier, is_free, discount_percent, expires_at, created_by, is_active |
| `client_enrollments.enrollment_code_id` | FK tracking which code was used for enrollment |
| `validate_enrollment_code(p_code)` | SECURITY DEFINER RPC — validates code, returns program info + code validity as JSONB |

### Edge Function: `redeem-enrollment-code`

**Auth:** Bearer JWT → `supabase.auth.getUser()`
**Input:** `{ code: string }`
**Flow:**
1. Validate code (active, not expired, not at max_uses, program active)
2. Check user not already enrolled (duplicate prevention)
3. G8 scope: free codes only (`is_free = true` or `discount_percent = 100`); partial discounts return error
4. Call `enroll_with_credits` RPC with `p_final_credit_cost = 0`, passes `p_cohort_id` from code
5. Update enrollment with `enrollment_code_id`, increment `current_uses`
6. Notify code creator via `create_notification` RPC (`enrollment_code_redeemed` type)

### Frontend

| Page | Route | Purpose |
|------|-------|---------|
| `EnrollmentCodesManagement.tsx` | `/admin/enrollment-codes` | Admin CRUD with quick code generator, table with status badges, create/edit dialog |
| `EnrollWithCode.tsx` | `/enroll?code=` | Public enrollment page — state machine (input → validating → valid → enrolling → enrolled → error), auth redirect |

---

## 16. Developer Tooling

### IDE configuration (committed to repo)

| File | Purpose |
|------|---------|
| `.cursorrules` | AI agent context — architecture, conventions, patterns |
| `.vscode/settings.json` | Editor formatting, TypeScript, Tailwind CSS IntelliSense |
| `.vscode/extensions.json` | 7 recommended extensions (auto-prompted on open) |
| `.vscode/tasks.json` | Test shortcuts (Terminal > Run Task) |

### VS Code tasks

| Task | Command |
|------|---------|
| E2E: Run All Tests | `npm run test:e2e` |
| E2E: Run All Tests (Headed) | `npm run test:e2e:headed` |
| E2E: Interactive UI Mode | `npm run test:e2e:ui` |
| E2E: Run Current File | `npx playwright test ${relativeFile}` |
| E2E: Clean Auth & Run All | `rm -rf e2e/.auth && npm run test:e2e` |
| Unit: Run All Tests | `npm test` |
| Unit: Run Tests (Watch) | `npm run test:watch` |
| CI: Full Quality Check | `npm run lint && npm run typecheck && npm test && npm run build` |

### Recommended extensions

- Tailwind CSS IntelliSense (`bradlc.vscode-tailwindcss`)
- ESLint (`dbaeumer.vscode-eslint`)
- Prettier (`esbenp.prettier-vscode`)
- GitLens (`eamodio.gitlens`)
- Error Lens (`usernamehw.errorlens`)
- Auto Rename Tag (`formulahendry.auto-rename-tag`)
- Path Intellisense (`christian-kohler.path-intellisense`)

---

## 17. Environment Variables Reference

### Frontend (Vite — prefixed with `VITE_`)

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | Yes | Supabase project URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Yes | Supabase anon/public key |
| `VITE_SENTRY_DSN` | Production only | Sentry error tracking DSN |
| `VITE_APP_ENV` | Production only | Set to `production` to enable Sentry |

### Supabase Edge Function Secrets

| Variable | Required | Description |
|----------|----------|-------------|
| `SITE_URL` | Yes | Frontend URL (e.g., `https://app.innotrue.com`) |
| `SUPABASE_URL` | Auto-set | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-set | Service role key for admin operations |
| `STRIPE_SECRET_KEY` | Yes | Stripe API secret key |
| `RESEND_API_KEY` | Yes | Resend email API key |
| `GCP_SERVICE_ACCOUNT_KEY` | Yes | Google Cloud service account JSON (for Vertex AI) |
| `GCP_PROJECT_ID` | Yes | Google Cloud project ID |
| `GCP_LOCATION` | No | GCP region (default: `europe-west3`) |
| `OAUTH_ENCRYPTION_KEY` | Yes | Encryption key for OAuth state |
| `CALENDAR_HMAC_SECRET` | Yes | HMAC secret for Cal.com webhook verification |
| `APP_ENV` | Staging only | Set to `staging` to enable email override |
| `STAGING_EMAIL_OVERRIDE` | Staging only | Catch-all email for staging |

### E2E Test Credentials (env vars or GitHub secrets)

| Variable | Description |
|----------|-------------|
| `E2E_ADMIN_EMAIL` | Admin test account email |
| `E2E_ADMIN_PASSWORD` | Admin test account password |
| `E2E_CLIENT_EMAIL` | Client test account email |
| `E2E_CLIENT_PASSWORD` | Client test account password |
| `E2E_COACH_EMAIL` | Coach test account email |
| `E2E_COACH_PASSWORD` | Coach test account password |
| `E2E_INSTRUCTOR_EMAIL` | Instructor test account email |
| `E2E_INSTRUCTOR_PASSWORD` | Instructor test account password |

---

## 18. Known Issues & Caveats

### Active issues

1. **Preprod Auth Email Hook not firing** — configured in Supabase dashboard but edge function logs don't appear. Prod hook works fine. Try toggling off/on.

2. **Radix UI Checkbox not clickable in Playwright** — `<Checkbox>` from shadcn/ui renders as `<button role="checkbox">` but does not respond to Playwright `.click()`. The admin sidebar E2E test that requires ToS acceptance is commented out with a TODO. All other ToS interactions are handled by the auth setup (which works because the overlay helpers attempt the click anyway).

### Development caveats

- `npm install` **always requires `--legacy-peer-deps`** due to a react-day-picker peer dependency conflict
- Supabase RPC params must use `null` (not `undefined`) — `undefined` gets stripped from JSON serialization
- Edge functions all have `verify_jwt = false` in `supabase/config.toml` — they implement custom auth checks internally
- `supabase/seed.sql` runs automatically after migrations on `supabase db reset`
- The `@/` path alias in imports maps to `src/`

### Migration history

The project was migrated from Lovable Cloud in Feb 2026. Key migration steps:
- Removed all Lovable dependencies and `@lovable.dev/cloud-auth-js`
- Replaced with Supabase built-in OAuth
- Moved assets from `/lovable-uploads/` to `/assets/`
- Swapped AI gateway to Vertex AI
- Updated all domain references from `innotruehub.com` to `app.innotrue.com`
- Fixed 7 stale domain fallbacks in edge functions

Full migration history is documented in `InnoTrue_Hub_Migration_Plan.md` (tracked in git but gitignored for future changes).
