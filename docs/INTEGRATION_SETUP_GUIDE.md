# Integration Setup Guide — Full Environment Isolation

How to set up every external integration so that Production, Preprod, and Lovable Sandbox are fully isolated with zero risk of cross-contamination.

Last updated: 2026-02-13

---

## Table of Contents

1. [Guiding Principles](#guiding-principles)
2. [Stripe (Payments)](#1-stripe-payments)
3. [Cal.com (Scheduling)](#2-calcom-scheduling)
4. [TalentLMS (LMS)](#3-talentlms-lms)
5. [Circle (Community)](#4-circle-community)
6. [Google Calendar (Events)](#5-google-calendar-events)
7. [Zoom / Google / Microsoft OAuth (Meetings)](#6-zoom--google--microsoft-oauth-meetings)
8. [Resend (Email)](#7-resend-email)
9. [Vertex AI (AI Features)](#8-vertex-ai-ai-features)
10. [Sentry (Error Monitoring)](#9-sentry-error-monitoring)
11. [Google Auth via Supabase (User Login)](#10-google-auth-via-supabase-user-login)
12. [Core: SITE_URL](#11-core-site_url)
13. [Security Secrets](#12-security-secrets)
14. [Staging Email Override](#13-staging-email-override)
15. [Master Checklist](#master-checklist)
16. [Configuration Record](#configuration-record)

---

## Guiding Principles

1. **Every environment gets its own account/instance/workspace** for services that hold state (bookings, users, courses, payments).
2. **Stateless services** (AI, email with staging override) can share credentials with safeguards.
3. **Webhook URLs must point to the correct Supabase project** — never have two environments receiving the same webhook.
4. **SITE_URL must be set on every environment** — the hardcoded fallback to `app.innotrue.com` is a contamination vector.
5. **When in doubt, leave a secret unset** — all integrations fail gracefully when their secrets are missing.

### Environment URLs and Identifiers

| | **Production** | **Preprod** | **Lovable Sandbox** |
|---|---|---|---|
| **Frontend URL** | `https://app.innotrue.com` | `https://preprod.innotrue-hub-live.pages.dev` | `https://innotrue-hub-lovable-sandbox.lovable.app` |
| **Supabase ref** | `qfdztdgublwlmewobxmx` | `jtzcrirqflfnagceendt` | `cezlnvdjildzxpyxyabb` |
| **Supabase URL** | `https://qfdztdgublwlmewobxmx.supabase.co` | `https://jtzcrirqflfnagceendt.supabase.co` | `https://cezlnvdjildzxpyxyabb.supabase.co` |
| **`SITE_URL` value** | `https://app.innotrue.com` | `https://preprod.innotrue-hub-live.pages.dev` | `https://innotrue-hub-lovable-sandbox.lovable.app` |
| **`APP_ENV` value** | `production` | `staging` | `development` |
| **Git branch** | `main` | `preprod` | `lovable-sync` → lovable remote `main` |
| **Hosting** | Cloudflare Pages | Cloudflare Pages (preview) | Lovable Cloud |
| **Supabase Dashboard** | [Open](https://supabase.com/dashboard/project/qfdztdgublwlmewobxmx) | [Open](https://supabase.com/dashboard/project/jtzcrirqflfnagceendt) | [Open](https://supabase.com/dashboard/project/cezlnvdjildzxpyxyabb) |
| **Edge Function Secrets** | [Open](https://supabase.com/dashboard/project/qfdztdgublwlmewobxmx/settings/functions) | [Open](https://supabase.com/dashboard/project/jtzcrirqflfnagceendt/settings/functions) | [Open](https://supabase.com/dashboard/project/cezlnvdjildzxpyxyabb/settings/functions) |

---

## Emergency: Reset Uncertain Preprod Secrets

**When to use this:** You're not sure whether the preprod secrets are copies of production values. Since Supabase hashes secrets after saving (you can only see names, not values), you cannot verify what's actually set. The safest action is to **delete the high-risk secrets now** and re-add them later with proper separate accounts.

### Step 1: Delete high-risk shared secrets from preprod

Go to **Preprod Edge Function Secrets**: https://supabase.com/dashboard/project/jtzcrirqflfnagceendt/settings/functions

Delete these 11 secrets (click the trash icon next to each):

**Cal.com** (risk: real bookings on production calendar):
- [ ] `CALCOM_API_KEY` — delete
- [ ] `CALCOM_WEBHOOK_SECRET` — delete

**TalentLMS** (risk: real LMS data modified, SSO to production LMS):
- [ ] `TALENTLMS_API_KEY` — delete
- [ ] `TALENTLMS_DOMAIN` — delete
- [ ] `TALENTLMS_WEBHOOK_SECRET` — delete

**Circle** (risk: real community members created/modified):
- [ ] `CIRCLE_API_KEY` — delete
- [ ] `CIRCLE_COMMUNITY_ID` — delete
- [ ] `CIRCLE_HEADLESS_AUTH_TOKEN` — delete
- [ ] `CIRCLE_COMMUNITY_DOMAIN` — delete

**Google Calendar** (risk: real calendar events created on production workspace):
- [ ] `GOOGLE_SERVICE_ACCOUNT_JSON` — delete
- [ ] `GOOGLE_CALENDAR_IMPERSONATE_EMAIL` — delete

**What happens after deletion:** Scheduling, LMS, community, and calendar features on preprod will show graceful errors or be unavailable. No other features are affected.

### Step 2: Regenerate security secrets that must be unique

These secrets must be **different from production**. Since you can't verify values, regenerate them.

Run in your terminal to generate 3 new values:
```bash
echo "OAUTH_ENCRYPTION_KEY: $(openssl rand -hex 32)"
echo "CALENDAR_HMAC_SECRET: $(openssl rand -hex 32)"
echo "REQUEST_SIGNING_SECRET: $(openssl rand -hex 32)"
```

Then in preprod Edge Function Secrets:
- [ ] Re-set `OAUTH_ENCRYPTION_KEY` with new value
- [ ] Re-set `CALENDAR_HMAC_SECRET` with new value
- [ ] Add `REQUEST_SIGNING_SECRET` with new value

**Note:** Regenerating `OAUTH_ENCRYPTION_KEY` will invalidate any existing OAuth tokens in the preprod `user_oauth_tokens` table. Instructors will need to re-connect their Zoom/Google/Microsoft accounts. This is expected and safe.

### Step 3: Also add REQUEST_SIGNING_SECRET to production

Production is currently missing this secret. Generate a **different** value:
```bash
echo "REQUEST_SIGNING_SECRET (prod): $(openssl rand -hex 32)"
```

Set it at: https://supabase.com/dashboard/project/qfdztdgublwlmewobxmx/settings/functions

### Step 4: Verify what you need before re-adding

When you're ready to test a specific integration on preprod, follow the per-service setup instructions:
- **Cal.com** → Section 2 (create preprod team first)
- **TalentLMS** → Section 3 (create free preprod account first)
- **Circle** → Section 4 (create preprod community first)
- **Google Calendar** → Section 5 (create preprod impersonation email first)

**Do NOT re-add secrets until you have a separate preprod account/instance for that service.**

### After this procedure, preprod should have these secrets:

| Secret | Status |
|---|---|
| `SUPABASE_URL` | Auto-provided ✅ |
| `SUPABASE_ANON_KEY` | Auto-provided ✅ |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-provided ✅ |
| `SUPABASE_DB_URL` | Auto-provided ✅ |
| `SITE_URL` | Set to preprod URL ✅ |
| `APP_ENV` | `staging` ✅ |
| `STAGING_EMAIL_OVERRIDE` | Your email ✅ |
| `STRIPE_SECRET_KEY` | `sk_test_...` ✅ |
| `RESEND_API_KEY` | Same as prod (safe with staging override) ✅ |
| `GCP_SERVICE_ACCOUNT_KEY` | Same as prod (stateless, safe) ✅ |
| `GCP_PROJECT_ID` | Same as prod ✅ |
| `GCP_LOCATION` | `europe-west3` ✅ |
| `OAUTH_ENCRYPTION_KEY` | New unique value ✅ |
| `CALENDAR_HMAC_SECRET` | New unique value ✅ |
| `REQUEST_SIGNING_SECRET` | New unique value ✅ |
| `CALCOM_*` | Deleted (re-add with preprod account later) |
| `TALENTLMS_*` | Deleted (re-add with preprod account later) |
| `CIRCLE_*` | Deleted (re-add with preprod account later) |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Deleted (re-add with preprod SA later) |
| `GOOGLE_CALENDAR_IMPERSONATE_EMAIL` | Deleted (re-add with preprod email later) |

---

## 1. Stripe (Payments)

**Risk if shared:** Real credit card charges on production account.

### What you need per environment

| Environment | Stripe Account | Key Type | Webhook |
|---|---|---|---|
| **Production** | Live account | `sk_live_...` / `pk_live_...` | Points to prod Supabase |
| **Preprod** | Same account, TEST mode | `sk_test_...` / `pk_test_...` | Points to preprod Supabase |
| **Lovable Sandbox** | Leave unset | — | — |

Stripe has built-in test mode on the same account — no extra cost.

### Setup steps

**Preprod:**
1. Go to https://dashboard.stripe.com
2. Toggle "Test mode" ON (top-right switch)
3. Go to **Developers → API Keys**
4. Copy the **Secret key** (`sk_test_...`)
5. In Supabase Dashboard (preprod project `jtzcrirqflfnagceendt`):
   - Go to **Project Settings → Edge Function Secrets**
   - Set `STRIPE_SECRET_KEY` = the test secret key
6. **(Optional) Webhook for preprod:**
   - Go to **Developers → Webhooks** (still in test mode)
   - Add endpoint: `https://jtzcrirqflfnagceendt.supabase.co/functions/v1/stripe-webhook` (if you have a webhook handler)
   - Select relevant events (checkout.session.completed, etc.)

**Production:**
1. Toggle test mode OFF
2. Copy the live **Secret key** (`sk_live_...`)
3. Set in prod Supabase project (`qfdztdgublwlmewobxmx`) Edge Function Secrets

**Lovable Sandbox:**
- Do NOT set `STRIPE_SECRET_KEY` — payment features will be unavailable (graceful failure)

### Verification
- Preprod key starts with `sk_test_`
- Prod key starts with `sk_live_`
- Test mode charges show in Stripe dashboard under "Test mode" only

### Configuration Record

| Environment | Secret | Value | Status |
|---|---|---|---|
| Production | `STRIPE_SECRET_KEY` | `sk_live_...` | [ ] Verified |
| Preprod | `STRIPE_SECRET_KEY` | `sk_test_...` | [ ] Verified |
| Sandbox | `STRIPE_SECRET_KEY` | Not set | [ ] Verified |

### Future: Stripe Sandboxes

Stripe now recommends Sandboxes over test mode for multi-developer teams. Sandboxes provide fully isolated test environments (separate data, webhooks, logs) per developer. Currently we use a single test mode key on preprod — sufficient for a solo developer. When adding more developers, consider creating per-developer Sandboxes in the Stripe Dashboard and issuing separate sandbox API keys. See: https://docs.stripe.com/sandboxes

---

## 2. Cal.com (Scheduling)

**Risk if shared:** Creates real bookings on production calendar, sends notifications to real clients.

### Three booking patterns in the app

The app uses Cal.com in three distinct ways, all of which need separate configuration per environment:

**Pattern 1 — Team-managed events (instructor/coach assigned via team)**
- A Cal.com **team** has managed event types
- Each instructor/coach is a team member with a **child event type**
- Cal.com routes bookings to the assigned team member
- DB tables: `calcom_event_type_mappings` (parent event type ID) + `instructor_calcom_event_types` (child event type ID per instructor)

**Pattern 2 — Individual instructor/coach calendar (direct booking)**
- An instructor/coach has their own Cal.com account or standalone event types
- Clients book directly on their personal calendar
- DB tables: `instructor_calcom_event_types` (with `booking_url` or `child_event_type_id`) + fallback to `profiles.scheduling_url`

**Pattern 3 — Group sessions (shared group calendar, any member can book)**
- A separate Cal.com user or team event type is used for group sessions
- Any group member can create a session — there is no single "owner"
- DB tables: `groups.calcom_mapping_id` → `calcom_event_type_mappings` (with `session_target = "group_session"`)

### Resolution order for booking URLs

The hook `useModuleSchedulingUrl.ts` resolves which Cal.com event to use in this priority:
1. **Enrollment-specific staff** → `enrollment_module_staff` table (instructor or coach assigned to this specific client + module)
2. **Module-level instructor/coach** → `module_instructors` / `module_coaches`
3. **Program-level instructor/coach** → `program_instructors` / `program_coaches`
4. **Global mapping** → `calcom_event_type_mappings` by `module_type`

### What you need per environment

| Environment | Cal.com Setup | Cost |
|---|---|---|
| **Production** | Organization tier, production subteam | $37/mo (upgraded from $15/mo Teams) |
| **Preprod** | Same org, preprod subteam | Included in Organization tier |
| **Lovable Sandbox** | Leave unset | Free |

### Architecture decision: Organization tier with subteams (2026-02-13)

**Upgraded to Cal.com Organization tier** (`innotrue-gmbh.cal.com`) to get subteam-based isolation:
- Organization public profile disabled, redirects to `innotrue.com`
- Production subteam and Preprod subteam under one org
- **Webhooks are configured at event-type level** (not team or org level), because Cal.com Org tier only supports account-level or event-type-level webhooks — not team-level
- Each event type on the production team has its webhook pointing to prod Supabase
- Each event type on the preprod team has its webhook pointing to preprod Supabase
- **One webhook secret per environment** — all event types within a team share the same secret, but prod and preprod use different secrets
- **One API key per environment** — API keys are account-level, but create a separate labeled key for each environment (for revocation isolation)
- Old account-level webhooks (including stale Lovable one) deleted

### Setup steps

**Cal.com Organization setup (completed 2026-02-13):**

1. Upgraded to Organization tier at https://app.cal.com
2. Org subdomain: `innotrue-gmbh.cal.com` (auto-assigned, not changeable)
3. Public profile disabled → redirects to `innotrue.com`
4. Created separate API key labeled "Preprod" (Settings → Developer → API Keys)
5. **Mirror your production event types on the preprod team for all 3 patterns:**

   **For Pattern 1 (team-managed):**
   - Create managed event types on the preprod team (mirror production session types)
   - Add at least one test team member (instructor)
   - Note the parent event type ID and each member's child event type ID

   **For Pattern 2 (individual instructor):**
   - Create standalone event types for test instructors
   - Or use the child event types from the team setup above

   **For Pattern 3 (group sessions):**
   - Create a Cal.com user or event type dedicated to group sessions (e.g., "InnoTrue Preprod Groups")
   - This acts as the shared calendar that any group member can book through

6. **Add a webhook to EACH preprod event type** (event-type-level, not account-level):
   - On each event type → Webhooks → Add
   - **URL**: `https://jtzcrirqflfnagceendt.supabase.co/functions/v1/calcom-webhook`
   - **Secret**: use the same secret across all preprod event types (generate one with `openssl rand -hex 32`)
   - **Triggers**: BOOKING_CREATED, BOOKING_RESCHEDULED, BOOKING_CANCELLED
   - **Tip**: you can use the same secret across all event types on the same team — the `calcom-webhook` function uses a single `CALCOM_WEBHOOK_SECRET` to verify all incoming webhooks

7. **Set preprod secrets:**
   In Supabase Dashboard (preprod `jtzcrirqflfnagceendt`) → Edge Function Secrets:
   - `CALCOM_API_KEY` = preprod API key (labeled "Preprod" in Cal.com)
   - `CALCOM_WEBHOOK_SECRET` = the secret used across all preprod event type webhooks

8. **Populate preprod database mapping tables** (see [Why event type IDs matter](#why-event-type-ids-matter) below):

   These tables contain Cal.com IDs that are **different per environment** — you cannot reuse production IDs.

   ```sql
   -- In preprod Supabase SQL Editor:

   -- Pattern 1: Global event type mappings
   INSERT INTO calcom_event_type_mappings
     (calcom_event_type_id, calcom_event_type_slug, calcom_event_type_name, session_target, module_type, is_active)
   VALUES
     (<preprod_parent_event_id>, '<slug>', '<name>', 'module_session', '<module_type>', true),
     (<preprod_group_event_id>, '<slug>', '<name>', 'group_session', null, true);

   -- Pattern 2: Instructor child event types
   INSERT INTO instructor_calcom_event_types
     (instructor_id, module_type, child_event_type_id, booking_url)
   VALUES
     ('<test_instructor_uuid>', '<module_type>', <preprod_child_event_id>, '<booking_url>');

   -- Pattern 3: Link groups to group event mapping
   UPDATE groups
   SET calcom_mapping_id = '<preprod_group_mapping_uuid>'
   WHERE id = '<test_group_uuid>';
   ```

**Production (completed 2026-02-13):**
- Event-type-level webhooks added to all production event types
- Webhook URL: `https://qfdztdgublwlmewobxmx.supabase.co/functions/v1/calcom-webhook`
- Same webhook secret used across all prod event types → stored as `CALCOM_WEBHOOK_SECRET`
- Old account-level webhooks (including stale Lovable one) deleted
- `CALCOM_API_KEY` set (production API key)

**Lovable Sandbox:**
- Do NOT set Cal.com secrets — booking features will be unavailable (graceful failure)

### Critical: Webhook isolation via event-type-level webhooks

Webhooks are **per event type**, NOT per team or org. This means:
- Each **production** event type has a webhook → `https://qfdztdgublwlmewobxmx.supabase.co/functions/v1/calcom-webhook`
- Each **preprod** event type has a webhook → `https://jtzcrirqflfnagceendt.supabase.co/functions/v1/calcom-webhook`
- **No account-level webhooks** — these would fire for ALL teams and cause cross-contamination
- When creating a new event type on either team, **always add the correct webhook** to it

### Why event type IDs matter

When Cal.com sends a webhook for a booking, the payload includes `eventTypeId`. The `calcom-webhook` edge function uses this ID to figure out **what kind of session to create** in the app:

1. **Looks up `calcom_event_type_mappings`** by `calcom_event_type_id` — this tells it the `session_target` (module session vs group session) and `module_type`
2. **If not found, looks up `instructor_calcom_event_types`** by `child_event_type_id` — this tells it which instructor and module type
3. **Falls back to `calcom_event_type_slug`** if no ID match

Without the correct event type IDs in the database, the webhook receives bookings but **can't match them to any session type** — the booking gets logged but no session is created.

**These IDs are different per environment** because Cal.com assigns unique numeric IDs when you create event types. Production event type "30-min Coaching Session" might be ID `12345` in prod but ID `67890` on the preprod team. Both database tables must contain the correct IDs for their environment:

| Table | Column | What it stores | Per-environment? |
|---|---|---|---|
| `calcom_event_type_mappings` | `calcom_event_type_id` | Parent (team-managed) event type ID | YES — different IDs per Cal.com team |
| `calcom_event_type_mappings` | `calcom_event_type_slug` | Event type slug (fallback matching) | May be same if you mirror slugs |
| `instructor_calcom_event_types` | `child_event_type_id` | Child event type ID per instructor | YES — different IDs per Cal.com team |
| `groups` | `calcom_mapping_id` | FK to `calcom_event_type_mappings` | YES — points to env-specific mapping row |

**These are NOT created by migrations or seed data.** They are configured per environment through the admin UI or SQL, and must be set up separately on each Supabase project.

### Configuration Record

| Environment | Secret | Value | Status |
|---|---|---|---|
| Production | `CALCOM_API_KEY` | Prod team key | [ ] Verified |
| Production | `CALCOM_WEBHOOK_SECRET` | Prod webhook secret | [ ] Verified |
| Production | Webhook URL in Cal.com | → `qfdztdgublwlmewobxmx` | [ ] Verified |
| Production | `calcom_event_type_mappings` data | Prod event type IDs | [ ] Verified |
| Production | `instructor_calcom_event_types` data | Prod child event IDs | [ ] Verified |
| Preprod | `CALCOM_API_KEY` | Preprod team key | [ ] Set up |
| Preprod | `CALCOM_WEBHOOK_SECRET` | Preprod webhook secret | [ ] Set up |
| Preprod | Webhook URL in Cal.com | → `jtzcrirqflfnagceendt` | [ ] Set up |
| Preprod | `calcom_event_type_mappings` data | Preprod event type IDs | [ ] Set up |
| Preprod | `instructor_calcom_event_types` data | Preprod child event IDs | [ ] Set up |
| Preprod | `groups.calcom_mapping_id` data | Preprod mapping IDs | [ ] Set up |
| Sandbox | `CALCOM_API_KEY` | Not set | [ ] Verified |

---

## 3. TalentLMS (LMS)

**Risk if shared:** Course completions from preprod testing sync to production user progress; SSO redirects to production LMS.

### What you need per environment

| Environment | TalentLMS Setup | Cost |
|---|---|---|
| **Production** | Main TalentLMS domain | Existing plan |
| **Preprod** | Separate TalentLMS account (free tier: 5 users, 10 courses) | Free |
| **Lovable Sandbox** | Leave unset | Free |

### Setup steps

**Create a free TalentLMS account for preprod:**
1. Go to https://www.talentlms.com/sign-up
2. Create a new account with a preprod-specific domain (e.g., `innotrue-preprod.talentlms.com`)
3. Set up a test user and test course
4. Get the API key: **Home → Account & Settings → Security → API Key**
5. Configure webhook:
   - Go to **Home → Account & Settings → Integrations**
   - Set webhook URL: `https://jtzcrirqflfnagceendt.supabase.co/functions/v1/talentlms-webhook`
   - Note/set the webhook secret

**Set preprod secrets:**
In Supabase Dashboard (preprod) → Edge Function Secrets:
- `TALENTLMS_API_KEY` = preprod API key
- `TALENTLMS_DOMAIN` = `innotrue-preprod.talentlms.com`
- `TALENTLMS_WEBHOOK_SECRET` = preprod webhook secret

**Production:**
- Verify secrets point to production TalentLMS domain

**Lovable Sandbox:**
- Do NOT set TalentLMS secrets

### Configuration Record

| Environment | Secret | Value | Status |
|---|---|---|---|
| Production | `TALENTLMS_API_KEY` | Prod key | [ ] Verified |
| Production | `TALENTLMS_DOMAIN` | Prod domain | [ ] Verified |
| Production | `TALENTLMS_WEBHOOK_SECRET` | Prod secret | [ ] Verified |
| Preprod | `TALENTLMS_API_KEY` | Preprod key | [ ] Set up |
| Preprod | `TALENTLMS_DOMAIN` | Preprod domain | [ ] Set up |
| Preprod | `TALENTLMS_WEBHOOK_SECRET` | Preprod secret | [ ] Set up |
| Sandbox | All TalentLMS secrets | Not set | [ ] Verified |

---

## 4. Circle (Community)

**Risk if shared:** SSO from preprod creates real user accounts in production Circle community.

### What you need per environment

| Environment | Circle Setup | Cost |
|---|---|---|
| **Production** | Main Circle community | Existing plan |
| **Preprod** | Separate Circle community (free trial or basic plan) | Free trial or ~$49/mo |
| **Lovable Sandbox** | Leave unset | Free |

### Setup steps

**Create a separate Circle community for preprod:**
1. Go to https://circle.so and create a new community (e.g., "InnoTrue Preprod")
2. Get community settings:
   - **Community ID**: visible in Circle admin URL or API
   - **Community domain**: the domain assigned to your community
3. Generate API credentials:
   - **Admin API Key**: Settings → API → Generate API Key
   - **Headless Auth Token**: Settings → API → Headless Authentication → Generate Token
   - Note: These are TWO DIFFERENT tokens — both are required

**Set preprod secrets:**
In Supabase Dashboard (preprod) → Edge Function Secrets:
- `CIRCLE_API_KEY` = preprod admin API key
- `CIRCLE_COMMUNITY_ID` = preprod community ID
- `CIRCLE_COMMUNITY_DOMAIN` = preprod community domain
- `CIRCLE_HEADLESS_AUTH_TOKEN` = preprod headless auth token

**Production:**
- Verify all 4 secrets point to production Circle community

**Lovable Sandbox:**
- Do NOT set Circle secrets

### Cost consideration
If Circle is not yet active for clients, you can defer the preprod setup and only set it up when testing Circle SSO specifically. Leave secrets unset until then.

### Configuration Record

| Environment | Secret | Value | Status |
|---|---|---|---|
| Production | `CIRCLE_API_KEY` | Prod key | [ ] Verified |
| Production | `CIRCLE_COMMUNITY_ID` | Prod ID | [ ] Verified |
| Production | `CIRCLE_COMMUNITY_DOMAIN` | Prod domain | [ ] Verified |
| Production | `CIRCLE_HEADLESS_AUTH_TOKEN` | Prod token | [ ] Verified |
| Preprod | All Circle secrets | Preprod community values | [ ] Set up when needed |
| Sandbox | All Circle secrets | Not set | [ ] Verified |

---

## 5. Google Calendar (Events)

**Risk if shared:** Creates real calendar events and Google Meet links in production Google Workspace.

### What you need per environment

| Environment | Service Account | Impersonation | Cost |
|---|---|---|---|
| **Production** | Prod service account | Prod Workspace user | Existing |
| **Preprod** | Same or separate service account | **Different** impersonation email | Free |
| **Lovable Sandbox** | Leave unset | — | Free |

### Setup steps

**Option A: Separate impersonation email (simpler, recommended)**

Uses the same GCP service account but impersonates a different Workspace user so calendar events go to a test calendar, not production calendars.

1. Create a Workspace user for testing (e.g., `preprod-calendar@innotrue.com`)
2. Grant the existing service account Domain-Wide Delegation for this user (if not already granted domain-wide)
3. Set preprod secrets:
   - `GOOGLE_SERVICE_ACCOUNT_JSON` = same service account JSON
   - `GOOGLE_CALENDAR_IMPERSONATE_EMAIL` = `preprod-calendar@innotrue.com`
   - `CALENDAR_HMAC_SECRET` = generate a new unique secret

**Option B: Separate service account (maximum isolation)**

1. In GCP Console → IAM → Service Accounts → Create new account
2. Grant Calendar API access
3. Enable Domain-Wide Delegation
4. Download JSON key

**Production:**
- Verify `GOOGLE_CALENDAR_IMPERSONATE_EMAIL` is the production Workspace user

**Lovable Sandbox:**
- Do NOT set Google Calendar secrets

### Configuration Record

| Environment | Secret | Value | Status |
|---|---|---|---|
| Production | `GOOGLE_SERVICE_ACCOUNT_JSON` | Prod SA JSON | [ ] Verified |
| Production | `GOOGLE_CALENDAR_IMPERSONATE_EMAIL` | Prod email | [ ] Verified |
| Production | `CALENDAR_HMAC_SECRET` | Prod secret | [ ] Verified |
| Preprod | `GOOGLE_SERVICE_ACCOUNT_JSON` | Same or separate SA | [ ] Set up when needed |
| Preprod | `GOOGLE_CALENDAR_IMPERSONATE_EMAIL` | Preprod test email | [ ] Set up when needed |
| Preprod | `CALENDAR_HMAC_SECRET` | Unique preprod secret | [ ] Set up when needed |
| Sandbox | All Calendar secrets | Not set | [ ] Verified |

---

## 6. Zoom / Google / Microsoft OAuth (Meetings)

**Risk if shared:** LOW — OAuth apps have registered redirect URIs that are domain-locked.

### What you need per environment

Each OAuth provider requires a registered app with specific redirect URIs. If you want meeting creation to work on preprod, you need separate OAuth apps per provider per environment.

| Provider | Production App | Preprod App | Sandbox |
|---|---|---|---|
| Zoom | Redirect: `app.innotrue.com` | Separate app with preprod redirect | Leave unset |
| Google | Redirect: `app.innotrue.com` | Separate app with preprod redirect | Leave unset |
| Microsoft | Redirect: `app.innotrue.com` | Separate app with preprod redirect | Leave unset |

### Setup steps (per provider, for preprod)

**Zoom:**
1. Go to https://marketplace.zoom.us/develop/create
2. Create a new OAuth app (e.g., "InnoTrue Hub Preprod")
3. Set redirect URL to include: `https://jtzcrirqflfnagceendt.supabase.co/functions/v1/oauth-callback`
4. Add required scopes: `meeting:write:meeting`, `user:read:user`
5. Copy Client ID and Secret

**Google (Meeting OAuth — separate from Supabase Auth!):**
1. Go to https://console.cloud.google.com → APIs & Services → Credentials
2. Create a new OAuth 2.0 Client ID (Web application)
3. Set authorized redirect URI: `https://jtzcrirqflfnagceendt.supabase.co/functions/v1/oauth-callback`
4. Enable Calendar API if not already enabled
5. Copy Client ID and Secret

**Microsoft:**
1. Go to https://portal.azure.com → App registrations
2. Register a new application (e.g., "InnoTrue Hub Preprod")
3. Set redirect URI: `https://jtzcrirqflfnagceendt.supabase.co/functions/v1/oauth-callback`
4. Add API permissions: `Calendars.ReadWrite`, `OnlineMeetings.ReadWrite`, `User.Read`
5. Create client secret, copy value

**Set preprod secrets (Supabase Edge Function Secrets):**
- `ZOOM_CLIENT_ID` / `ZOOM_CLIENT_SECRET`
- `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`
- `MICROSOFT_CLIENT_ID` / `MICROSOFT_CLIENT_SECRET`

**Important:** The redirect URI pattern used by the app is built from `SITE_URL`, so `SITE_URL` must be correctly set for OAuth flows to complete. The actual redirect URI is constructed as:
`{SUPABASE_URL}/functions/v1/oauth-callback`

### Cost consideration
Creating OAuth apps is free on all three providers. Only do this when you need to test meeting creation on preprod.

### Configuration Record

| Environment | Secrets | Status |
|---|---|---|
| Production | All 6 OAuth secrets | [ ] Verified |
| Preprod | All 6 OAuth secrets | [ ] Set up when needed |
| Sandbox | Not set | [ ] Verified |

---

## 7. Resend (Email)

**Risk if shared:** Emails sent to real recipients from preprod. **Mitigated** by staging email override.

### What you need per environment

| Environment | API Key | Staging Override | Cost |
|---|---|---|---|
| **Production** | Live key | OFF | Existing plan |
| **Preprod** | Same key (safe with override) | ON | No extra cost |
| **Lovable Sandbox** | Same key or unset | ON (if set) | No extra cost |

Resend does not have separate test/live modes. Instead, our staging email override mechanism provides full isolation.

### Setup steps

**Preprod:**
1. Set `RESEND_API_KEY` = same as production (or leave unset if email testing not needed)
2. Set `APP_ENV` = `staging`
3. Set `STAGING_EMAIL_OVERRIDE` = your personal email (e.g., `doina.popa@innotrue.com`)

This ensures ALL emails from preprod are:
- Redirected to your override email address
- Subject prefixed with `[STAGING → original@email.com]`

**Lovable Sandbox:**
- Either leave `RESEND_API_KEY` unset (email functions fail gracefully)
- Or set it with `APP_ENV=development` + `STAGING_EMAIL_OVERRIDE` for testing

**Production:**
- `RESEND_API_KEY` = live key
- `APP_ENV` = `production` (or unset, defaults to production behavior)
- `STAGING_EMAIL_OVERRIDE` = must NOT be set

### Sender domain
All environments use `noreply@mail.innotrue.com`. This is fine because:
- The domain is verified once in Resend
- Staging override controls who receives the email, not who sends it

### Verification
Send a test email from preprod. It should arrive at your override address with `[STAGING → intended-recipient@email.com]` in the subject.

### Configuration Record

| Environment | Secret | Value | Status |
|---|---|---|---|
| Production | `RESEND_API_KEY` | Live key | [ ] Verified |
| Production | `APP_ENV` | `production` or unset | [ ] Verified |
| Production | `STAGING_EMAIL_OVERRIDE` | NOT set | [ ] Verified |
| Preprod | `RESEND_API_KEY` | Same live key or unset | [ ] Set |
| Preprod | `APP_ENV` | `staging` | [ ] Verified |
| Preprod | `STAGING_EMAIL_OVERRIDE` | Your email | [ ] Verified |
| Sandbox | `RESEND_API_KEY` | Same or unset | [ ] Set |
| Sandbox | `APP_ENV` | `development` | [ ] Set |
| Sandbox | `STAGING_EMAIL_OVERRIDE` | Your email | [ ] Set |

---

## 8. Vertex AI (AI Features)

**Risk if shared:** Only quota and billing — no data contamination. AI calls are stateless.

### What you need per environment

| Environment | GCP Project | Cost |
|---|---|---|
| **Production** | Main GCP project | Pay-per-use |
| **Preprod** | Same project OK (shared quota) | Shared billing |
| **Lovable Sandbox** | Leave unset | Free |

### Setup steps

**Option A: Shared project (acceptable for pilot)**
- All environments use the same `GCP_SERVICE_ACCOUNT_KEY`, `GCP_PROJECT_ID`, `GCP_LOCATION`
- Risk: preprod AI testing consumes production quota/budget
- Mitigation: Set GCP budget alerts

**Option B: Separate project (recommended for heavy testing)**
1. Create a new GCP project (e.g., `innotrue-hub-preprod`)
2. Enable Vertex AI API
3. Create a service account with Vertex AI User role
4. Download JSON key
5. Set preprod secrets with the new project's values

**Lovable Sandbox:**
- Leave all `GCP_*` secrets unset — AI features will be unavailable

### Cost consideration
Vertex AI charges per token. For light preprod testing, sharing the project is fine. For load testing, use a separate project with budget limits.

### Configuration Record

| Environment | Secret | Value | Status |
|---|---|---|---|
| Production | `GCP_SERVICE_ACCOUNT_KEY` | Prod SA JSON | [ ] Verified |
| Production | `GCP_PROJECT_ID` | Prod project ID | [ ] Verified |
| Production | `GCP_LOCATION` | `europe-west3` | [ ] Verified |
| Preprod | `GCP_*` | Same as prod or separate | [ ] Set |
| Sandbox | `GCP_*` | Not set | [ ] Verified |

---

## 9. Sentry (Error Monitoring)

**Risk if shared:** Preprod errors pollute production error dashboard.

### What you need per environment

| Environment | Sentry Project | Cost |
|---|---|---|
| **Production** | Main Sentry project | Existing plan |
| **Preprod** | Separate Sentry project (same org) | Free tier covers it |
| **Lovable Sandbox** | Disabled | Free |

### Setup steps

Sentry is currently **production-only** (gated by `VITE_APP_ENV === "production"` in `src/main.tsx`).

**If you want Sentry on preprod:**
1. Create a new Sentry project in the same org (e.g., "innotrue-hub-preprod")
2. Get its DSN
3. Set in Cloudflare Pages preview build:
   - `VITE_SENTRY_DSN` = preprod DSN
   - `VITE_APP_ENV` = `staging` (but note: current code requires `production` to enable Sentry)
4. Update `src/main.tsx` to also initialize Sentry for `staging` environment (code change needed)

**Current recommendation:** Leave Sentry disabled on preprod and sandbox. Enable only for production.

### Configuration Record

| Environment | Variable | Value | Status |
|---|---|---|---|
| Production | `VITE_SENTRY_DSN` | Prod DSN | [ ] Verified |
| Production | `VITE_APP_ENV` | `production` | [ ] Verified |
| Preprod | `VITE_SENTRY_DSN` | Not set (disabled) | [ ] Verified |
| Sandbox | `VITE_SENTRY_DSN` | Not set (disabled) | [ ] Verified |

---

## 10. Google Auth via Supabase (User Login)

**Risk:** Users authenticate against wrong Supabase project. Currently disabled during pilot.

### What you need per environment

Each Supabase project needs its own Google OAuth Client ID registered with the correct redirect URI.

| Environment | Google OAuth App | Redirect URI |
|---|---|---|
| **Production** | Prod OAuth client | `https://qfdztdgublwlmewobxmx.supabase.co/auth/v1/callback` |
| **Preprod** | Separate OAuth client | `https://jtzcrirqflfnagceendt.supabase.co/auth/v1/callback` |
| **Lovable Sandbox** | Separate OAuth client | `https://cezlnvdjildzxpyxyabb.supabase.co/auth/v1/callback` |

### Setup steps (for when Google Auth is re-enabled)

1. Go to https://console.cloud.google.com → APIs & Services → Credentials
2. Create an OAuth 2.0 Client ID for each environment
3. Set authorized redirect URI to the environment's Supabase auth callback URL
4. In each Supabase project dashboard:
   - Go to **Authentication → Providers → Google**
   - Enter the corresponding Client ID and Secret
   - Enable the provider

**Important: Before re-enabling, fix the AuthContext fallback:**
- `AuthContext.tsx` line 135: change `if (roles.length === 0) roles = ["client"]` to `roles = []`
- Implement an admin-approval or allowlist flow for new Google sign-ins

### Current status: All disabled during pilot.

### Configuration Record

| Environment | Setting | Value | Status |
|---|---|---|---|
| Production | Google Provider | OFF (pilot) | [ ] |
| Preprod | Google Provider | OFF (pilot) | [ ] |
| Sandbox | Google Provider | OFF (pilot) | [ ] |

---

## 11. Core: SITE_URL

**Risk if not set:** Email links, booking callbacks, and OAuth redirects point to `https://app.innotrue.com` (production).

This is the single most important secret to get right on every environment.

### What to set

| Environment | `SITE_URL` value |
|---|---|
| **Production** | `https://app.innotrue.com` |
| **Preprod** | `https://preprod.innotrue-hub-live.pages.dev` |
| **Lovable Sandbox** | `https://innotrue-hub-lovable-sandbox.lovable.app` |

### Where it's used (40+ edge functions)
- Email links ("Click here to view your session")
- Cal.com booking metadata (return URLs)
- OAuth redirect flows
- Notification URLs

### Setup steps

Set `SITE_URL` in **Edge Function Secrets** on each Supabase project:

1. **Production:** https://supabase.com/dashboard/project/qfdztdgublwlmewobxmx/settings/functions
   → `SITE_URL` = `https://app.innotrue.com`

2. **Preprod:** https://supabase.com/dashboard/project/jtzcrirqflfnagceendt/settings/functions
   → `SITE_URL` = `https://preprod.innotrue-hub-live.pages.dev`

3. **Lovable Sandbox:** https://supabase.com/dashboard/project/cezlnvdjildzxpyxyabb/settings/functions
   → `SITE_URL` = `https://innotrue-hub-lovable-sandbox.lovable.app`

### Configuration Record

| Environment | Secret | Value | Status |
|---|---|---|---|
| Production | `SITE_URL` | `https://app.innotrue.com` | [ ] Verified |
| Preprod | `SITE_URL` | `https://preprod.innotrue-hub-live.pages.dev` | [ ] Set |
| Sandbox | `SITE_URL` | `https://innotrue-hub-lovable-sandbox.lovable.app` | [ ] Set |

---

## 12. Security Secrets

These must be **unique per environment** — sharing them would allow cross-environment token/signature reuse.

| Secret | Purpose | How to generate |
|---|---|---|
| `OAUTH_ENCRYPTION_KEY` | Encrypts stored OAuth tokens | `openssl rand -hex 32` |
| `REQUEST_SIGNING_SECRET` | Signs internal requests | `openssl rand -hex 32` |

### Setup steps

For each environment, generate a unique value:
```bash
# Run once per environment
openssl rand -hex 32
```

Set in Supabase Dashboard → Edge Function Secrets for each project.

### Configuration Record

| Environment | Secret | Status |
|---|---|---|
| Production | `OAUTH_ENCRYPTION_KEY` | [ ] Verified (unique) |
| Production | `REQUEST_SIGNING_SECRET` | [ ] Verified (unique) |
| Preprod | `OAUTH_ENCRYPTION_KEY` | [ ] Generated + set |
| Preprod | `REQUEST_SIGNING_SECRET` | [ ] Generated + set |
| Sandbox | `OAUTH_ENCRYPTION_KEY` | [ ] Generated + set (if OAuth testing needed) |
| Sandbox | `REQUEST_SIGNING_SECRET` | [ ] Generated + set (if needed) |

---

## 13. Staging Email Override

Ensures preprod and sandbox never send emails to real users.

### How it works

When `APP_ENV` is not `production` and `STAGING_EMAIL_OVERRIDE` is set:
- ALL outbound emails (13 functions) are redirected to the override address
- Subject line is prefixed: `[STAGING → original-recipient@email.com] Original Subject`
- The original recipient is preserved in the subject for debugging

### Setup

| Environment | `APP_ENV` | `STAGING_EMAIL_OVERRIDE` |
|---|---|---|
| **Production** | `production` (or unset) | **Must NOT be set** |
| **Preprod** | `staging` | `doina.popa@innotrue.com` (or your email) |
| **Lovable Sandbox** | `development` | `doina.popa@innotrue.com` (or your email) |

---

## 14. Test User Setup Per Environment

Use the **same test personas** across all environments for consistency, but each external tool instance needs its own accounts created separately.

### Test personas (from seed data)

| Persona | Email | Role | Password |
|---|---|---|---|
| Doina Popa | `doina.popa@innotrue.com` | Admin | `DemoPass123!` |
| Sarah Johnson | `sarah.johnson@demo.innotrue.com` | Client | `DemoPass123!` |
| Michael Chen | `michael.chen@demo.innotrue.com` | Client | `DemoPass123!` |
| Emily Parker | `emily.parker@demo.innotrue.com` | Coach/Instructor | `DemoPass123!` |

These users exist in all Supabase projects via the seed file (`supabase/seed.sql`). The steps below explain how to link these personas to each external tool **per environment**.

### Where: Supabase SQL Editor or Admin UI

All mapping data is stored in Supabase tables, not in the external tools. You configure it per Supabase project using either:
- **Admin UI** in the app (if the relevant admin page exists)
- **Supabase SQL Editor** (Dashboard → SQL Editor) for direct inserts

Links to SQL Editors:
- Prod: https://supabase.com/dashboard/project/qfdztdgublwlmewobxmx/sql/new
- Preprod: https://supabase.com/dashboard/project/jtzcrirqflfnagceendt/sql/new
- Sandbox: https://supabase.com/dashboard/project/cezlnvdjildzxpyxyabb/sql/new

---

### 14.1 Cal.com — User-to-Event-Type Mapping

**What needs to be set up:** Link each instructor/coach to their Cal.com event types so the app knows which booking page to show clients.

**Tables involved:**
- `profiles.scheduling_url` — fallback booking URL per user
- `instructor_calcom_event_types` — maps instructor + module type → Cal.com child event type ID
- `calcom_event_type_mappings` — global event type mappings (team events, group events)
- `groups.calcom_mapping_id` — links a group to its Cal.com group event mapping

**Admin UI available:**
- `CalcomMappingsManagement.tsx` — for managing `calcom_event_type_mappings` (accessible to admins)
- `InstructorCalcomEventTypes.tsx` — for mapping instructors to child event types (accessible to admins)

**Step-by-step for preprod:**

1. **First, create the Cal.com preprod team and event types** (see Section 2 above)
2. **Note down the IDs** you get from Cal.com:
   - Parent (team) event type IDs
   - Child event type IDs per team member (instructor)
   - Group event type ID
3. **Set instructor scheduling URLs** — run in preprod SQL Editor:
   ```sql
   -- Set Emily Parker's scheduling URL to her preprod Cal.com page
   UPDATE profiles
   SET scheduling_url = 'https://cal.com/innotrue-preprod/emily-parker'
   WHERE email = 'emily.parker@demo.innotrue.com';
   ```
4. **Create global event type mappings** — run in preprod SQL Editor:
   ```sql
   -- Map team-managed event types (Pattern 1)
   INSERT INTO calcom_event_type_mappings
     (calcom_event_type_id, calcom_event_type_slug, calcom_event_type_name,
      session_target, module_type, is_active)
   VALUES
     -- Replace <ID> with actual preprod Cal.com event type IDs
     (<preprod_session_event_id>, 'coaching-session', 'Coaching Session',
      'module_session', 'session', true),
     (<preprod_group_event_id>, 'group-session', 'Group Session',
      'group_session', null, true);
   ```
5. **Map instructor to child event types** — run in preprod SQL Editor:
   ```sql
   -- Get Emily's profile ID
   -- (or look it up: SELECT id FROM profiles WHERE email = 'emily.parker@demo.innotrue.com')
   INSERT INTO instructor_calcom_event_types
     (instructor_id, module_type, child_event_type_id, booking_url)
   VALUES
     -- Replace UUIDs and IDs with actual preprod values
     ('<emily_profile_uuid>', 'session', <preprod_child_event_id>, 'https://cal.com/innotrue-preprod/emily-parker/coaching');
   ```
6. **Link groups to group event mapping** — run in preprod SQL Editor:
   ```sql
   -- Get the group mapping ID from step 4
   UPDATE groups
   SET calcom_mapping_id = (
     SELECT id FROM calcom_event_type_mappings
     WHERE calcom_event_type_slug = 'group-session'
     LIMIT 1
   )
   WHERE id = '<test_group_uuid>';
   ```

**Or use the Admin UI:**
- Log into preprod app as admin (`doina.popa@innotrue.com`)
- Navigate to Cal.com Mappings admin page → add mappings
- Navigate to Instructor Cal.com Event Types admin page → add instructor mappings

**Repeat for production** with production Cal.com IDs. **Skip for sandbox** (Cal.com not configured).

---

### 14.2 TalentLMS — User Account Linking

**What needs to be set up:** Link InnoTrue users to their TalentLMS accounts so SSO and progress sync work.

**Tables involved:**
- `talentlms_users` — maps `user_id` → `talentlms_user_id` + `talentlms_username`
- `talentlms_progress` — stores course progress per user (auto-populated by sync/webhooks)

**Admin UI available:**
- `TalentLmsUsers.tsx` — admin page for viewing/managing TalentLMS user links

**How linking normally works:**
The `talentlms-sso` edge function **automatically creates** the mapping when a user does SSO for the first time:
1. User clicks "Go to Academy" in the app
2. Edge function calls TalentLMS API to look up user by email
3. If found → stores mapping in `talentlms_users`
4. If not found → creates user in TalentLMS → stores mapping
5. Redirects user to TalentLMS with SSO login key

**So for most cases, you don't need to manually create mappings.** But if you want to pre-link test users:

**Step-by-step for preprod:**

1. **First, create the preprod TalentLMS account** (see Section 3 above)
2. **Create test users in preprod TalentLMS:**
   - Go to `https://innotrue-preprod.talentlms.com/plus/admin`
   - Add users: Emily Parker (`emily.parker@demo.innotrue.com`), Sarah Johnson, Michael Chen
   - Note their TalentLMS user IDs
3. **Create at least one test course** in preprod TalentLMS and enroll the test users
4. **(Optional) Pre-link users** — run in preprod SQL Editor:
   ```sql
   -- Usually auto-created by SSO, but can be pre-populated:
   INSERT INTO talentlms_users (user_id, talentlms_user_id, talentlms_username)
   VALUES
     (
       (SELECT id FROM auth.users WHERE email = 'emily.parker@demo.innotrue.com'),
       '<preprod_talentlms_user_id>',
       'emily.parker'
     )
   ON CONFLICT (user_id) DO UPDATE
   SET talentlms_user_id = EXCLUDED.talentlms_user_id,
       talentlms_username = EXCLUDED.talentlms_username;
   ```

**Repeat for production** with production TalentLMS user IDs. **Skip for sandbox**.

---

### 14.3 Circle — Community Member Linking

**What needs to be set up:** Link InnoTrue users to their Circle community accounts for SSO.

**Tables involved:**
- `circle_users` — maps `user_id` → `circle_user_id` + `circle_email`

**Admin UI available:**
- `CircleManagement.tsx` — admin page for viewing/managing Circle user links

**How linking normally works:**
The `circle-sso` edge function **automatically creates** the mapping when a user does SSO for the first time:
1. User clicks "Go to Community" in the app
2. Edge function searches Circle for member by email
3. If found → stores mapping in `circle_users`
4. If not found → creates member in Circle → stores mapping
5. Returns SSO login URL with session cookie

**So for most cases, you don't need to manually create mappings.** But if you want to pre-link test users:

**Step-by-step for preprod:**

1. **First, create the preprod Circle community** (see Section 4 above)
2. **Invite test users** to the preprod Circle community:
   - Go to Circle admin → Members → Invite
   - Invite: `emily.parker@demo.innotrue.com`, `sarah.johnson@demo.innotrue.com`, etc.
   - Note their Circle member IDs (visible in Circle admin or API)
3. **(Optional) Pre-link users** — run in preprod SQL Editor:
   ```sql
   -- Usually auto-created by SSO, but can be pre-populated:
   INSERT INTO circle_users (user_id, circle_user_id, circle_email)
   VALUES
     (
       (SELECT id FROM auth.users WHERE email = 'emily.parker@demo.innotrue.com'),
       '<preprod_circle_member_id>',
       'emily.parker@demo.innotrue.com'
     )
   ON CONFLICT (user_id) DO UPDATE
   SET circle_user_id = EXCLUDED.circle_user_id,
       circle_email = EXCLUDED.circle_email;
   ```

**Repeat for production** with production Circle member IDs. **Skip for sandbox**.

---

### 14.4 Zoom/Google/Microsoft OAuth — Meeting Provider Tokens

**What needs to be set up:** Each instructor/coach connects their own Zoom/Google/Microsoft account to create meetings.

**Tables involved:**
- `user_oauth_tokens` — stores encrypted access + refresh tokens per user per provider

**How it works:**
This is **user-driven, not admin-configured.** Each instructor connects their own account:
1. Instructor goes to Account Settings → Connected Accounts
2. Clicks "Connect Zoom" (or Google Calendar, Microsoft)
3. OAuth flow redirects to provider → user authorizes → callback stores encrypted tokens
4. Tokens are encrypted with `OAUTH_ENCRYPTION_KEY` before storage

**Environment considerations:**
- Tokens are encrypted with the **environment's `OAUTH_ENCRYPTION_KEY`** — they are NOT portable between environments
- Each environment needs its own OAuth app registered (see Section 6 above)
- Test instructors need to re-connect their accounts on each environment

**Step-by-step for preprod:**

1. **First, register preprod OAuth apps** with each provider (see Section 6)
2. **Set `OAUTH_ENCRYPTION_KEY`** on preprod (unique value, see Section 12)
3. **Log in as Emily Parker** on preprod app
4. **Go to Account Settings → Connected Accounts**
5. **Connect Zoom/Google/Microsoft** — this creates the `user_oauth_tokens` entry automatically

**No SQL needed** — the OAuth flow handles everything. Just make sure:
- The preprod OAuth app has the correct redirect URI: `https://jtzcrirqflfnagceendt.supabase.co/functions/v1/oauth-callback`
- `OAUTH_ENCRYPTION_KEY` is set (tokens can't be stored without it)

**Repeat for production** (instructors connect their real accounts). **Skip for sandbox**.

---

### 14.5 Stripe — Customer Mapping

**What needs to be set up:** Nothing manual — Stripe customer IDs are created automatically.

**Tables involved:**
- `org_platform_subscriptions.stripe_customer_id` — Stripe customer ID per organization
- `org_platform_subscriptions.stripe_subscription_id` — Stripe subscription ID
- `org_credit_purchases.stripe_checkout_session_id` — checkout session per purchase

**How it works:**
- When an org admin starts a checkout, `create-checkout` edge function calls Stripe
- Stripe creates/finds a customer by email
- Customer ID and subscription ID are stored after successful checkout
- Test mode (`sk_test_`) creates test customers that don't appear in live Stripe dashboard

**No manual setup needed.** Just ensure:
- Preprod uses `sk_test_...` key (test customers, test payments)
- Production uses `sk_live_...` key (real customers, real payments)
- Test payments in preprod use Stripe test card: `4242 4242 4242 4242`, any future expiry, any CVC

---

### Summary: What's manual vs automatic per tool

| Tool | User linking | How | Manual SQL needed? |
|---|---|---|---|
| **Cal.com** | Admin configures | Admin UI or SQL | YES — event type IDs are different per environment |
| **TalentLMS** | Auto on first SSO | `talentlms-sso` edge function | NO — auto-created (optional pre-link) |
| **Circle** | Auto on first SSO | `circle-sso` edge function | NO — auto-created (optional pre-link) |
| **Zoom/Google/Microsoft** | User connects | OAuth flow in Account Settings | NO — user-driven |
| **Stripe** | Auto on checkout | `create-checkout` edge function | NO — auto-created |

**Only Cal.com requires manual database configuration per environment** because the event type IDs are tool-instance-specific and must be set by an admin. All other tools auto-link users on first use.

---

## Master Checklist

### Priority 1: Must do NOW (prevents cross-contamination)

- [x] **Preprod `SITE_URL`** — set to `https://preprod.innotrue-hub-live.pages.dev` ✅ (2026-02-13)
- [x] **Sandbox `SITE_URL`** — set to `https://innotrue-hub-lovable-sandbox.lovable.app` ✅ (2026-02-13)
- [x] **Preprod `STRIPE_SECRET_KEY`** — re-set with `sk_test_` key ✅ (2026-02-13)
- [x] **Sandbox `APP_ENV`** — set to `development` ✅ (2026-02-13)
- [x] **Sandbox `STAGING_EMAIL_OVERRIDE`** — set to your email ✅ (2026-02-13)
- [x] **Preprod `APP_ENV`** — verified `staging` ✅ (2026-02-13)
- [x] **Preprod `STAGING_EMAIL_OVERRIDE`** — verified set ✅ (2026-02-13)
- [x] **Production `STAGING_EMAIL_OVERRIDE`** — verified NOT set ✅ (2026-02-13)
- [x] **Preprod high-risk secrets** — deleted Cal.com/TalentLMS/Circle/Google Calendar secrets ✅ (2026-02-13)
- [x] **Preprod security secrets** — regenerated `OAUTH_ENCRYPTION_KEY` + `CALENDAR_HMAC_SECRET`, added `REQUEST_SIGNING_SECRET` ✅ (2026-02-13)
- [x] **Production `REQUEST_SIGNING_SECRET`** — added ✅ (2026-02-13)

### Priority 2: Before testing specific integrations on preprod

- [x] **Cal.com** — upgraded to Organization tier, created preprod subteam, event-type-level webhooks on all event types (prod + preprod), API key + webhook secret set on preprod Supabase, exposed key regenerated ✅ (2026-02-13)
- [ ] **Cal.com user mapping** — populate `calcom_event_type_mappings` + `instructor_calcom_event_types` + `profiles.scheduling_url` in preprod DB with preprod Cal.com IDs (Section 14.1). Preprod child IDs documented in this guide.
- [x] **TalentLMS** — shared prod account with preprod (same API key/domain/webhook secret). Webhook points to prod only (single URL limit). SSO works on preprod, completion webhooks only arrive at prod. ✅ (2026-02-13)
- [ ] **TalentLMS users** — create separate test users in prod TalentLMS for preprod testing (different emails from real users)
- [ ] **Circle** — DEFERRED. Not yet set up on prod either. Create preprod community when ready to build community features.
- [ ] **Circle members** — DEFERRED.
- [ ] **Google Calendar** — DEFERRED. Requires additional Workspace user ($) for preprod impersonation email. Features fail gracefully when unset.
- [ ] **OAuth providers** — register preprod apps with preprod redirect URIs (Zoom, Google, Microsoft)
- [ ] **OAuth user connections** — log in as test instructor on preprod, connect Zoom/Google/Microsoft in Account Settings (Section 14.4)
- [x] **Security secrets** — regenerated `OAUTH_ENCRYPTION_KEY` + `CALENDAR_HMAC_SECRET`, added `REQUEST_SIGNING_SECRET` for preprod ✅ (2026-02-13)

### Priority 3: Optional improvements

- [ ] **Vertex AI** — separate GCP project for preprod (only if heavy AI testing needed)
- [ ] **Sentry** — separate project for preprod (only if error monitoring needed in preprod)
- [ ] **Google Auth** — register OAuth clients per environment (when re-enabling Google login)

---

## Configuration Record

Track your actual configuration here as you complete each step. Update the Status column and add notes.

### Production (Supabase: `qfdztdgublwlmewobxmx`)

| Secret | Expected Value | Status | Notes |
|---|---|---|---|
| `SITE_URL` | `https://app.innotrue.com` | [ ] | |
| `APP_ENV` | `production` or unset | [ ] | |
| `STAGING_EMAIL_OVERRIDE` | NOT set | [ ] | |
| `STRIPE_SECRET_KEY` | `sk_live_...` | [ ] | |
| `RESEND_API_KEY` | Live key | [ ] | |
| `GCP_SERVICE_ACCOUNT_KEY` | Service account JSON | [ ] | |
| `GCP_PROJECT_ID` | GCP project ID | [ ] | |
| `GCP_LOCATION` | `europe-west3` | [ ] | |
| `CALCOM_API_KEY` | Prod team key | [ ] | |
| `CALCOM_WEBHOOK_SECRET` | Prod webhook secret | [ ] | |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Calendar SA JSON | [ ] | |
| `GOOGLE_CALENDAR_IMPERSONATE_EMAIL` | Prod workspace email | [ ] | |
| `CALENDAR_HMAC_SECRET` | Unique secret | [ ] | |
| `ZOOM_CLIENT_ID` | Prod app ID | [ ] | |
| `ZOOM_CLIENT_SECRET` | Prod app secret | [ ] | |
| `GOOGLE_OAUTH_CLIENT_ID` | Prod app ID | [ ] | |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Prod app secret | [ ] | |
| `MICROSOFT_CLIENT_ID` | Prod app ID | [ ] | |
| `MICROSOFT_CLIENT_SECRET` | Prod app secret | [ ] | |
| `OAUTH_ENCRYPTION_KEY` | Unique 32-byte hex | [ ] | |
| `REQUEST_SIGNING_SECRET` | Unique secret | [ ] | |
| `TALENTLMS_API_KEY` | Prod key | [ ] | |
| `TALENTLMS_DOMAIN` | Prod domain | [ ] | |
| `TALENTLMS_WEBHOOK_SECRET` | Prod secret | [ ] | |
| `CIRCLE_API_KEY` | Prod key | [ ] | |
| `CIRCLE_COMMUNITY_ID` | Prod ID | [ ] | |
| `CIRCLE_COMMUNITY_DOMAIN` | Prod domain | [ ] | |
| `CIRCLE_HEADLESS_AUTH_TOKEN` | Prod token | [ ] | |

### Preprod (Supabase: `jtzcrirqflfnagceendt`)

| Secret | Expected Value | Status | Notes |
|---|---|---|---|
| `SITE_URL` | Cloudflare preview URL | [ ] | |
| `APP_ENV` | `staging` | [ ] | |
| `STAGING_EMAIL_OVERRIDE` | Your email | [ ] | |
| `STRIPE_SECRET_KEY` | `sk_test_...` | [ ] | |
| `RESEND_API_KEY` | Same as prod or unset | [ ] | |
| `GCP_SERVICE_ACCOUNT_KEY` | Same as prod or separate | [ ] | |
| `GCP_PROJECT_ID` | Same as prod or separate | [ ] | |
| `GCP_LOCATION` | `europe-west3` | [ ] | |
| `CALCOM_API_KEY` | Preprod team key | [ ] | |
| `CALCOM_WEBHOOK_SECRET` | Preprod webhook secret | [ ] | |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | Same SA or separate | [ ] | |
| `GOOGLE_CALENDAR_IMPERSONATE_EMAIL` | Preprod test email | [ ] | |
| `CALENDAR_HMAC_SECRET` | Unique preprod secret | [ ] | |
| `ZOOM_CLIENT_ID` | Preprod app ID | [ ] | |
| `ZOOM_CLIENT_SECRET` | Preprod app secret | [ ] | |
| `GOOGLE_OAUTH_CLIENT_ID` | Preprod app ID | [ ] | |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Preprod app secret | [ ] | |
| `MICROSOFT_CLIENT_ID` | Preprod app ID | [ ] | |
| `MICROSOFT_CLIENT_SECRET` | Preprod app secret | [ ] | |
| `OAUTH_ENCRYPTION_KEY` | Unique 32-byte hex | [ ] | |
| `REQUEST_SIGNING_SECRET` | Unique secret | [ ] | |
| `TALENTLMS_API_KEY` | Preprod key or unset | [ ] | |
| `TALENTLMS_DOMAIN` | Preprod domain or unset | [ ] | |
| `TALENTLMS_WEBHOOK_SECRET` | Preprod secret or unset | [ ] | |
| `CIRCLE_API_KEY` | Preprod key or unset | [ ] | |
| `CIRCLE_COMMUNITY_ID` | Preprod ID or unset | [ ] | |
| `CIRCLE_COMMUNITY_DOMAIN` | Preprod domain or unset | [ ] | |
| `CIRCLE_HEADLESS_AUTH_TOKEN` | Preprod token or unset | [ ] | |

### Lovable Sandbox (Supabase: `cezlnvdjildzxpyxyabb`)

| Secret | Expected Value | Status | Notes |
|---|---|---|---|
| `SITE_URL` | Lovable preview URL | [ ] | |
| `APP_ENV` | `development` | [ ] | |
| `STAGING_EMAIL_OVERRIDE` | Your email | [ ] | |
| `STRIPE_SECRET_KEY` | NOT set | [ ] | |
| `RESEND_API_KEY` | NOT set or same as prod | [ ] | |
| `GCP_*` | NOT set | [ ] | |
| `CALCOM_*` | NOT set | [ ] | |
| `GOOGLE_SERVICE_ACCOUNT_JSON` | NOT set | [ ] | |
| `GOOGLE_CALENDAR_IMPERSONATE_EMAIL` | NOT set | [ ] | |
| `CALENDAR_HMAC_SECRET` | NOT set | [ ] | |
| `ZOOM_*` | NOT set | [ ] | |
| `GOOGLE_OAUTH_*` | NOT set | [ ] | |
| `MICROSOFT_*` | NOT set | [ ] | |
| `OAUTH_ENCRYPTION_KEY` | NOT set | [ ] | |
| `REQUEST_SIGNING_SECRET` | NOT set | [ ] | |
| `TALENTLMS_*` | NOT set | [ ] | |
| `CIRCLE_*` | NOT set | [ ] | |

### Supabase Dashboard Auth Settings

| Setting | Production | Preprod | Sandbox |
|---|---|---|---|
| Email Signup | OFF (pilot) [ ] | OFF (pilot) [ ] | OFF (pilot) [ ] |
| Confirm Email | ON [ ] | ON [ ] | ON [ ] |
| Google Provider | OFF (pilot) [ ] | OFF [ ] | OFF [ ] |
| Auth Email Hook → `send-auth-email` | Enabled [ ] | Enabled [ ] | Enabled [ ] |

### Cloudflare Pages

| Setting | Value | Status |
|---|---|---|
| Build command includes `VITE_SENTRY_DSN` | Yes | [ ] |
| Build command includes `VITE_APP_ENV=production` for main | Yes | [ ] |
| Build command switches Supabase URL/key by branch | Yes | [ ] |

---

## Appendix: External Service Dashboard URLs

| Service | Dashboard URL |
|---|---|
| Stripe | https://dashboard.stripe.com |
| Cal.com | https://app.cal.com |
| TalentLMS | https://{domain}.talentlms.com/plus/admin |
| Circle | https://app.circle.so/admin |
| Google Cloud Console | https://console.cloud.google.com |
| Zoom Marketplace | https://marketplace.zoom.us |
| Microsoft Azure | https://portal.azure.com |
| Resend | https://resend.com/overview |
| Sentry | https://sentry.io |
| Supabase (prod) | https://supabase.com/dashboard/project/qfdztdgublwlmewobxmx |
| Supabase (preprod) | https://supabase.com/dashboard/project/jtzcrirqflfnagceendt |
| Supabase (sandbox) | https://supabase.com/dashboard/project/cezlnvdjildzxpyxyabb |
| Cloudflare Pages | https://dash.cloudflare.com → Pages → innotrue-hub-live |
