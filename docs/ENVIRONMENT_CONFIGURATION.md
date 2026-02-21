# Environment Configuration Guide

Reference for all environment variables, external service integrations, and cross-environment isolation settings across Production, Preprod, and Lovable Sandbox.

Last updated: 2026-02-26

---

## Environments Overview

| | **Production** | **Preprod** | **Lovable Sandbox** |
|---|---|---|---|
| Supabase ref | `qfdztdgublwlmewobxmx` | `jtzcrirqflfnagceendt` | `cezlnvdjildzxpyxyabb` |
| Frontend URL | `app.innotrue.com` | Cloudflare Pages preview | Lovable preview |
| Git branch | `main` | `preprod` | `lovable-sync` → lovable remote `main` |
| `APP_ENV` | `production` | `staging` | `development` |

---

## Frontend Environment Variables (VITE_)

Set via Cloudflare Pages build command (prod/preprod) or hardcoded fallbacks (Lovable).

| Env Var | Required | Production | Preprod | Lovable Sandbox |
|---|---|---|---|---|
| `VITE_SUPABASE_URL` | YES | Prod Supabase URL | Preprod Supabase URL | Hardcoded fallback in `client.ts` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | YES | Prod anon key | Preprod anon key | Hardcoded fallback in `client.ts` |
| `VITE_APP_ENV` | NO | `production` | Not set | Not set |
| `VITE_SENTRY_DSN` | NO | Sentry DSN | Not set (disabled) | Not set (disabled) |

**Cloudflare Pages** build command handles prod vs preprod switching via `CF_PAGES_BRANCH`.
**Lovable** uses fallback values baked into `src/integrations/supabase/client.ts` on the `lovable-sync` branch.

---

## Edge Function Secrets

Set via: **Supabase Dashboard → Project Settings → Edge Function Secrets**
- Prod: https://supabase.com/dashboard/project/qfdztdgublwlmewobxmx/settings/functions
- Preprod: https://supabase.com/dashboard/project/jtzcrirqflfnagceendt/settings/functions
- Sandbox: https://supabase.com/dashboard/project/cezlnvdjildzxpyxyabb/settings/functions

### Auto-Provided by Supabase (do NOT set manually)

| Secret | Notes |
|---|---|
| `SUPABASE_URL` | Auto-injected by Supabase runtime |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-injected by Supabase runtime |
| `SUPABASE_ANON_KEY` | Auto-injected by Supabase runtime |

### Core Infrastructure (MUST set on all environments)

| Secret | Production | Preprod | Lovable Sandbox | Notes |
|---|---|---|---|---|
| `SITE_URL` | `https://app.innotrue.com` | Cloudflare preview URL | Lovable preview URL | **CRITICAL**: Falls back to `https://app.innotrue.com` if unset — would cause preprod/sandbox email links and callbacks to point to production |

### Staging Controls (set on preprod + sandbox only)

| Secret | Production | Preprod | Lovable Sandbox | Notes |
|---|---|---|---|---|
| `APP_ENV` | `production` (or unset) | `staging` | `development` | Controls email staging override |
| `STAGING_EMAIL_OVERRIDE` | Not set | Your email | Your email | When `APP_ENV != production`, ALL outbound emails redirect here |

---

## External Service Integrations

### Email — Resend

| Secret | Production | Preprod | Lovable Sandbox |
|---|---|---|---|
| `RESEND_API_KEY` | Live key | Same key OK (staging override protects) | Leave unset OR same key (staging override protects) |

**Cross-contamination risk: VERY LOW**
- Staging email override (`APP_ENV` + `STAGING_EMAIL_OVERRIDE`) redirects all emails to override address
- Subject line prefixed with `[STAGING → original@email.com]`
- All 13 email-sending functions wired to use override
- If `RESEND_API_KEY` is unset, email functions fail gracefully

**Used by:** `send-auth-email`, `send-welcome-email`, `send-org-invite`, `send-wheel-pdf`, `subscription-reminders`, `signup-user`, `request-account-deletion`, `check-ai-usage`, `send-notification-email`, `notify-assignment-graded`, `notify-assignment-submitted`, `decision-reminders`, `process-email-queue`

### Payments — Stripe

| Secret | Production | Preprod | Lovable Sandbox |
|---|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_live_...` | **MUST be `sk_test_...`** | Leave unset |

**Cross-contamination risk: LOW if keys are correct**
- Stripe test keys (`sk_test_`) create test charges only — no real money
- **DANGER**: If preprod accidentally has a live key, real charges occur
- If unset, payment functions fail gracefully

**Verification**: Check that preprod key starts with `sk_test_`

**Used by:** `create-checkout`, `customer-portal`, `confirm-credit-topup`, `org-confirm-credit-purchase`, `purchase-credit-topup`, `org-purchase-credits`

**Future: Stripe Sandboxes.** As of 2026, Stripe recommends Sandboxes over test mode for teams with multiple developers. Sandboxes provide fully isolated test environments (separate data, webhooks, logs) per developer. Currently we use a single test mode key on preprod which is fine for a solo developer. When the team grows, consider creating per-developer Sandboxes in the Stripe Dashboard and issuing separate sandbox API keys.

### AI — Vertex AI (Google Cloud)

| Secret | Production | Preprod | Lovable Sandbox |
|---|---|---|---|
| `GCP_SERVICE_ACCOUNT_KEY` | Service account JSON | Same key OK for light testing | Leave unset |
| `GCP_PROJECT_ID` | GCP project ID | Same project OK | Leave unset |
| `GCP_LOCATION` | `europe-west3` | Same | Leave unset |

**Cross-contamination risk: MEDIUM**
- All environments share the same GCP project = shared billing + quota
- No data contamination (AI calls are stateless), but costs accrue to same project
- If unset, AI features fail gracefully (recommendations, reflections, insights unavailable)

**Recommendation**: For heavy preprod testing, create a separate GCP service account with lower quota limits

**Used by:** `analytics-ai-insights`, `course-recommendations`, `decision-insights`, `generate-reflection-prompt`, `check-ai-usage`

### Scheduling — Cal.com

| Secret | Production | Preprod | Lovable Sandbox |
|---|---|---|---|
| `CALCOM_API_KEY` | Live key | Leave unset unless testing | Leave unset |
| `CALCOM_WEBHOOK_SECRET` | Webhook secret | Leave unset unless testing | Leave unset |

**Cross-contamination risk: HIGH if configured**
- Same API key = creates real bookings on production Cal.com account
- Webhook receiver exists on each Supabase project, but Cal.com sends webhooks to whichever URL is configured in Cal.com dashboard
- If unset, booking features fail gracefully

**If testing Cal.com on preprod:**
- Use a separate Cal.com environment/team
- Register webhook URL pointing to preprod Supabase function URL
- Never point Cal.com webhooks at both prod and preprod simultaneously

**Used by:** `calcom-webhook`, `calcom-create-booking`, `calcom-get-booking-url`

### Calendar — Google Calendar

| Secret | Production | Preprod | Lovable Sandbox |
|---|---|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Service account JSON | Leave unset unless testing | Leave unset |
| `GOOGLE_CALENDAR_IMPERSONATE_EMAIL` | Impersonation email | Leave unset unless testing | Leave unset |
| `CALENDAR_HMAC_SECRET` | HMAC secret | Leave unset unless testing | Leave unset |

**Cross-contamination risk: HIGH if configured**
- Same service account = creates real calendar events on production Google Workspace
- If unset, calendar sync features fail gracefully

**Used by:** `google-calendar-create-event`

### OAuth Providers — Zoom, Google, Microsoft

| Secret | Production | Preprod | Lovable Sandbox |
|---|---|---|---|
| `ZOOM_CLIENT_ID` / `ZOOM_CLIENT_SECRET` | Prod OAuth app | Leave unset | Leave unset |
| `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET` | Prod OAuth app | Leave unset | Leave unset |
| `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET` | Prod OAuth app | Leave unset | Leave unset |

**Cross-contamination risk: LOW**
- OAuth apps have registered redirect URIs that lock them to specific domains
- Sharing credentials across environments would fail due to redirect URI mismatch
- If unset, OAuth-based meeting creation features are unavailable

**If testing on preprod:** Register separate OAuth apps with preprod redirect URIs at each provider's dashboard

**Used by:** `oauth-authorize`, `oauth-callback`, `oauth-create-meeting`

### Security — OAuth Token Encryption

| Secret | Production | Preprod | Lovable Sandbox |
|---|---|---|---|
| `OAUTH_ENCRYPTION_KEY` | Unique 32-byte hex | Generate NEW key | Generate NEW key |

**NEVER share between environments** — tokens encrypted with one key cannot be decrypted with another, which is the desired isolation behavior.

**Used by:** `oauth-authorize`, `oauth-callback`, `oauth-disconnect` (via `_shared/oauth-crypto.ts`)

### LMS — TalentLMS

| Secret | Production | Preprod | Lovable Sandbox |
|---|---|---|---|
| `TALENTLMS_API_KEY` | Live key | Leave unset | Leave unset |
| `TALENTLMS_DOMAIN` | LMS domain | Leave unset | Leave unset |
| `TALENTLMS_WEBHOOK_SECRET` | Webhook secret | Leave unset | Leave unset |

**Cross-contamination risk: HIGH if configured**
- Same API key + domain = operations affect real LMS courses/users
- Webhook completions from real courses would sync to preprod database
- If unset, LMS features fail gracefully

**If testing:** Use a separate TalentLMS sandbox/workspace

**Used by:** `talentlms-sso`, `talentlms-webhook`, `sync-talentlms-progress`

### Community — Circle

| Secret | Production | Preprod | Lovable Sandbox |
|---|---|---|---|
| `CIRCLE_API_KEY` | Live key | Leave unset | Leave unset |
| `CIRCLE_COMMUNITY_ID` | Community ID | Leave unset | Leave unset |
| `CIRCLE_COMMUNITY_DOMAIN` | Domain | Leave unset | Leave unset |
| `CIRCLE_HEADLESS_AUTH_TOKEN` | Auth token | Leave unset | Leave unset |

**Cross-contamination risk: HIGH if configured**
- Same community = SSO creates real user accounts/mappings in production Circle
- If unset, Circle SSO features fail gracefully

**If testing:** Use a separate Circle community

**Used by:** `circle-sso`

### Request Signing

| Secret | Production | Preprod | Lovable Sandbox |
|---|---|---|---|
| `REQUEST_SIGNING_SECRET` | Unique secret | Generate NEW | Generate NEW |

No cross-contamination risk — used for internal request signing only.

---

## Supabase Dashboard Auth Settings

Set via: **Authentication → Configuration → Auth Providers**

### Email Provider

| Setting | Production | Preprod | Lovable Sandbox |
|---|---|---|---|
| Enable Email Signup | OFF | OFF | OFF |
| Confirm Email | ON | ON | ON |

**Note:** App uses `auth.admin.createUser()` via the `signup-user` edge function, which bypasses dashboard Email Signup settings. The Supabase Email Signup toggle does NOT need to be ON — our custom flow handles signup independently. `email_confirm: true` is set in `createUser()` to suppress the Supabase auth hook from sending a duplicate email.

### Google Provider

| Setting | Production | Preprod | Lovable Sandbox |
|---|---|---|---|
| Enable Google Provider | ON (Phase 5) | ON (Phase 5) | OFF |

**Phase 5 status (2026-02-26):** Google sign-in is now re-enabled on prod and preprod. Self-registered users land on `/complete-registration` to choose their role (client/coach/instructor). The `ProtectedRoute` detects Google OAuth new users via `app_metadata.provider === "google"` and redirects them.

### Google OAuth Setup Per Environment

Each Supabase project needs the Google Client ID + Secret from Google Cloud Console (APIs & Services → Credentials → OAuth 2.0 Client IDs).

**Authorized redirect URIs in Google Cloud Console:**
- `https://qfdztdgublwlmewobxmx.supabase.co/auth/v1/callback` (prod)
- `https://jtzcrirqflfnagceendt.supabase.co/auth/v1/callback` (preprod)
- `https://cezlnvdjildzxpyxyabb.supabase.co/auth/v1/callback` (sandbox)
- `https://app.innotrue.com/~oauth/callback` (custom OAuth for calendar/meeting integrations)

---

## Configuration Checklist

### Lovable Sandbox — Minimum Setup

- [ ] Set `SITE_URL` = Lovable preview URL (Edge Function Secrets)
- [ ] Set `APP_ENV` = `development` (Edge Function Secrets)
- [ ] Set `STAGING_EMAIL_OVERRIDE` = your email (Edge Function Secrets)
- [ ] Google Provider disabled (not needed for sandbox)

### Preprod — Verify

- [ ] `SITE_URL` is NOT `https://app.innotrue.com`
- [ ] `APP_ENV` = `staging`
- [ ] `STAGING_EMAIL_OVERRIDE` is set
- [ ] `STRIPE_SECRET_KEY` starts with `sk_test_`
- [ ] TalentLMS secrets are NOT set (unless testing with separate workspace)
- [ ] Circle secrets are NOT set (unless testing with separate community)
- [ ] Cal.com secrets are NOT set (unless testing with separate environment)
- [ ] Google Provider enabled with correct Client ID + Secret (Phase 5)

### Production — Verify

- [ ] `SITE_URL` = `https://app.innotrue.com`
- [ ] `STRIPE_SECRET_KEY` starts with `sk_live_`
- [ ] `APP_ENV` is NOT set or is `production`
- [ ] `STAGING_EMAIL_OVERRIDE` is NOT set
- [ ] `VITE_SENTRY_DSN` is set in Cloudflare Pages build
- [ ] `VITE_APP_ENV` = `production` in Cloudflare Pages build

---

## Quick Reference: Safe to Share vs Must Isolate

| Secret | Share across environments? | Reason |
|---|---|---|
| `RESEND_API_KEY` | Yes (with staging override) | Email override catches all outbound |
| `GCP_*` (Vertex AI) | Yes (for light use) | Stateless calls; only quota is shared |
| `STRIPE_SECRET_KEY` | **NO** | Test vs live keys = test vs real charges |
| `OAUTH_ENCRYPTION_KEY` | **NO** | Tokens must not be portable between envs |
| `REQUEST_SIGNING_SECRET` | **NO** | Request signatures must be env-specific |
| `CALCOM_API_KEY` | **NO** | Creates real bookings |
| `GOOGLE_SERVICE_ACCOUNT_JSON` (Calendar) | **NO** | Creates real calendar events |
| `TALENTLMS_*` | **NO** | Affects real LMS data |
| `CIRCLE_*` | **NO** | Affects real community |
| `ZOOM/GOOGLE/MICROSOFT OAuth` | **NO** | Redirect URIs are domain-locked |
