# Subscriptions, Plans & Stripe Integration

> How subscription plans work, how Stripe is integrated, and architectural recommendations.

## Plan Architecture

### Subscription Plans (plans table)

| Key | Name | Tier | is_free | is_purchasable | Credit Allowance | Purpose |
|-----|------|------|---------|----------------|-----------------|---------|
| `free` | Free | 0 | yes | yes | 20 | Default plan for all new users |
| `base` | Base | 1 | no | yes | 300 | Entry paid tier |
| `pro` | Pro | 2 | no | yes | 500 | Professional tier |
| `advanced` | Advanced | 3 | no | yes | 1000 | Advanced tier |
| `elite` | Elite | 4 | no | yes | 1500 | Top tier |
| `programs` | Programs | 0 | yes | **no** | - | Admin-assigned: users with purchased programs only |
| `continuation` | Continuation | 0 | yes | **no (deprecated)** | - | ~~Post-program alumni access~~ — replaced by alumni lifecycle (2B.1). `is_active = false` since 2026-03-01. |

### How plan_id Gets Assigned

| Path | When | What Happens |
|------|------|-------------|
| Self-registration | `complete-registration` edge function | Sets `plan_id` to Free (only if null) |
| Placeholder transfer | `verify-signup` or `complete-registration` | Copies placeholder's `plan_id` to real user |
| Stripe checkout | `stripe-webhook` on `checkout.session.completed` | Sets `plan_id` to the purchased plan |
| Stripe plan change | `stripe-webhook` on `customer.subscription.updated` | Updates `plan_id` to new plan |
| Stripe cancellation | `stripe-webhook` on `customer.subscription.deleted` | Downgrades `plan_id` to Free |
| Admin manual | ClientDetail page or `create-admin-user` | Direct `plan_id` update |
| Admin bulk | ProgramCompletions page | ~~Moves users to Continuation plan~~ (deprecated — alumni lifecycle handles this automatically) |
| Org-sponsored | `organization_members.sponsored_plan_id` | Separate column, not `profiles.plan_id` |

### Plans vs. Program Enrollments

These are **two separate access systems** that the entitlements engine merges:

```
profiles.plan_id ──────────> plan_features ─────────> useEntitlements (source: subscription)
                                                              ↓
client_enrollments ────────> program_plan_features ──> useEntitlements (source: program_plan)
  .program_plan_id                                            ↓
  .tier                                              Merge: highest limit wins
```

**Key distinction:**
- `profiles.plan_id` = the user's personal subscription (monthly/yearly Stripe billing)
- `client_enrollments.program_plan_id` = features granted by an active program enrollment
- Enrollment codes create enrollments, they do NOT change `profiles.plan_id`
- When an enrollment ends, the program plan features are simply no longer returned by `useEntitlements`

### The Programs & Continuation Plans: Current Status

**Continuation plan — DEPRECATED (2026-03-01):** Set `is_active = false` by migration `20260301130000_pricing_update.sql`. Replaced by the alumni lifecycle system (2B.1): completed enrollments automatically enter a configurable grace period (default 90 days) with read-only content access. No manual "Move to Continuation" needed — the `check_alumni_access` RPC and `_shared/content-access.ts` helper handle access gating automatically. Nurture emails sent by `alumni-lifecycle` cron function.

**Programs plan — still active:** Used for admin-assigned users who bought a program directly. The `programs` plan remains as a non-purchasable admin tool for edge cases where a user needs platform features without a subscription.

---

## Stripe Integration

### Architecture

```
Frontend                       Edge Functions                Stripe
─────────────────────────────────────────────────────────────────────
Subscription.tsx ────────────> create-checkout ────────────> Checkout Session (subscription)
                 ────────────> customer-portal ────────────> Billing Portal
Credits.tsx ─────────────────> purchase-credit-topup ──────> Checkout Session (one-time)
             (return URL) ───> confirm-credit-topup ───────> Session.retrieve (verify)
OrgBilling.tsx ──────────────> org-purchase-credits ───────> Checkout Session (one-time)
               (return URL) ─> org-confirm-credit-purchase > Session.retrieve (verify)
               ──────────────> org-platform-subscription ──> Checkout Session (subscription)

Stripe ──────────────────────> stripe-webhook ─────────────> DB updates
  (checkout.session.completed)    ↓
  (subscription.updated)         profiles.plan_id
  (subscription.deleted)         org_platform_subscriptions
  (invoice.payment_failed)       (log only)
```

### Edge Functions (8 total)

| Function | Purpose | Payment Type |
|----------|---------|-------------|
| `create-checkout` | Individual user subscription checkout | Subscription |
| `customer-portal` | Stripe Billing Portal (manage/cancel) | - |
| `stripe-webhook` | Receives Stripe events, syncs DB state | - |
| `subscription-reminders` | Sends renewal reminder emails (cron) | - |
| `org-platform-subscription` | Org subscription checkout | Subscription |
| `org-purchase-credits` | Org credit package checkout | One-time |
| `org-confirm-credit-purchase` | Verify org credit payment on return | One-time |
| `purchase-credit-topup` | User credit top-up checkout | One-time |
| `confirm-credit-topup` | Verify user credit top-up on return | One-time |

### Payment Verification Strategy

The system uses **two patterns** for verifying payments:

1. **Webhooks** (for subscriptions): Stripe sends events to `stripe-webhook`. The webhook verifies the signature, identifies the event type, and updates the DB. This handles all lifecycle events (activation, plan changes, cancellation, payment failures).

2. **Confirm-on-return** (for one-time payments): After Stripe Checkout, the user's browser returns to a URL with `?session_id=...`. The frontend calls a `confirm-*` edge function that retrieves the session from Stripe, verifies payment, and grants credits. Idempotency guards prevent double-granting.

### Stripe Webhook Setup

The `stripe-webhook` edge function handles these events:

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Activates subscription: sets `profiles.plan_id` (user) or `org_platform_subscriptions.status` (org) |
| `customer.subscription.updated` | Syncs plan changes (up/downgrade via Billing Portal): resolves new Stripe price to `plan_id` |
| `customer.subscription.deleted` | Downgrades user to Free plan or cancels org subscription |
| `invoice.payment_failed` | Logs the failure (Stripe handles dunning/retry automatically) |

**To configure the webhook in Stripe Dashboard:**

1. Go to **Developers > Webhooks > Add endpoint**
2. URL: `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
3. Events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_failed`
4. Copy the signing secret (`whsec_...`)
5. Set it as an edge function secret:
   ```bash
   # Preprod
   npx supabase secrets set STRIPE_WEBHOOK_SECRET='whsec_...' --project-ref jtzcrirqflfnagceendt
   # Prod
   npx supabase secrets set STRIPE_WEBHOOK_SECRET='whsec_...' --project-ref qfdztdgublwlmewobxmx
   ```

### How Plan Resolution Works (Webhook)

When the webhook receives a subscription event, it needs to map Stripe's price to our plan:

```
Stripe subscription.items[0].price.id  (e.g., "price_1ABC...")
              ↓
plan_prices.stripe_price_id → plan_prices.plan_id  (e.g., "uuid-of-pro-plan")
              ↓
profiles.plan_id = plan_id
```

The `create-checkout` function adds metadata to both the checkout session and the subscription:
```json
{
  "type": "user_subscription",
  "user_id": "auth-user-uuid",
  "plan_id": "plans-table-uuid"
}
```

This metadata persists on the Stripe subscription object and is available in all future webhook events, so the webhook always knows which user and plan to update.

### Database Tables with Stripe Columns

| Table | Stripe Columns |
|-------|---------------|
| `plans` | `stripe_product_id` |
| `plan_prices` | `stripe_price_id` (indexed) |
| `credit_topup_packages` | `stripe_price_id` |
| `org_credit_packages` | `stripe_price_id` |
| `org_platform_tiers` | `stripe_annual_price_id`, `stripe_monthly_price_id` |
| `org_platform_subscriptions` | `stripe_subscription_id`, `stripe_customer_id` |
| `org_credit_purchases` | `stripe_checkout_session_id`, `stripe_payment_intent_id` |
| `user_credit_purchases` | `stripe_checkout_session_id`, `stripe_payment_intent_id` |

### Environment Configuration

| Secret | Where | Purpose |
|--------|-------|---------|
| `STRIPE_SECRET_KEY` | Edge function secrets | API key for Stripe operations |
| `STRIPE_WEBHOOK_SECRET` | Edge function secrets | Webhook signature verification |

- Production uses `sk_live_...` / `whsec_...` (live mode)
- Preprod uses `sk_test_...` / `whsec_...` (test mode)
- No frontend Stripe.js needed: all payments use Stripe Checkout (redirect)

---

## Credit System

Credits are a separate dimension from plans. Plans provide a monthly `credit_allowance` that auto-refills, while purchased credits are stored in `credit_batches` with expiry dates.

### Credit Scale

| Category | Service | Cost (credits) |
|----------|---------|---------------|
| AI | AI Coach query, Insight, Recommendation | 1 each |
| Goals | Goal creation | 2 |
| Sessions | Peer coaching | 3 |
| Sessions | Group session | 5 |
| Sessions | Workshop | 8 |
| Sessions | Coaching (1:1) | 10 |
| Sessions | Review Board Mock | 15 |
| Programs | Base program enrollment | 25 |
| Programs | Pro program enrollment | 50 |
| Programs | Advanced program enrollment | 100 |
| Specialty | SF CTA RBM (async) | 75 |
| Specialty | SF CTA RBM (live) | 150 |

### Credit Top-Up Packages

Users and organizations can purchase additional credits via Stripe Checkout.

**Individual packages** (`credit_topup_packages`):

| Package | Price | Credits | Per-Credit | Validity |
|---------|-------|---------|-----------|----------|
| Starter | €9.99 | 50 | €0.20 | 12 months |
| Standard (featured) | €24.99 | 150 | €0.17 | 12 months |
| Premium | €69.99 | 500 | €0.14 | 12 months |

**Organization packages** (`org_credit_packages`):

| Package | Price | Credits | Per-Credit | Validity | Team Size |
|---------|-------|---------|-----------|----------|-----------|
| Starter | €399 | 2,500 | €0.16 | 12 months | 5-10 |
| Growth | €999 | 7,500 | €0.13 | 12 months | 10-25 |
| Enterprise | €2,499 | 20,000 | €0.12 | 12 months | 25-50 |

Each package has a `stripe_price_id` that is auto-created on first purchase. When prices change, the migration resets `stripe_price_id = NULL` so new Stripe products/prices are created automatically.

### Purchase Flow (Individual)

```
/credits page → "Purchase" button
      ↓
purchase-credit-topup (edge function)
  → Creates/reuses Stripe product + price
  → Creates user_credit_purchases record (status: pending)
  → Returns Stripe Checkout URL
      ↓
Stripe hosted checkout page (user pays)
      ↓
Return to /credits?success=true&session_id={ID}
      ↓
confirm-credit-topup (edge function)
  → stripe.checkout.sessions.retrieve (verify payment)
  → Update purchase to status: completed
  → grant_credit_batch RPC (adds credits with 12-month expiry)
      ↓
Toast: "Credits Added! X credits have been added to your account."
```

### Consumption Order

FIFO by expiry, via `consume_credits_fifo` SQL function:
1. Plan credits (monthly allowance from `plans.credit_allowance`)
2. Program-specific credit batches (from enrollment codes)
3. Bonus/purchased batches (earliest expiry first)

Credits are used for AI operations (coaching, insights, recommendations), session bookings, and program enrollments. Tracked per feature key via `credit_batches` and `add_on_consumption_log`.

---

## Frontend Pages

| Page | Purpose | Stripe Integration |
|------|---------|-------------------|
| `/subscription` | View plans, upgrade, manage billing | `create-checkout`, `customer-portal` |
| `/credits` | View credit balance, purchase top-ups | `purchase-credit-topup`, `confirm-credit-topup` |
| `/org-admin/billing` | Org subscription + credit purchases | `org-platform-subscription`, `org-purchase-credits` |
| `/admin/plans` | Admin CRUD for plans + Stripe price IDs | Read/write `plan_prices.stripe_price_id` |

---

## Testing Guide

### Prerequisites

Before testing any payment flow on **preprod**:

1. **Stripe test mode is active** — preprod uses `sk_test_...` key
2. **Webhook is configured** — endpoint `https://jtzcrirqflfnagceendt.supabase.co/functions/v1/stripe-webhook` with the 4 events
3. **`STRIPE_WEBHOOK_SECRET`** is set on preprod
4. **`plan_prices.stripe_price_id`** is populated for all purchasable plans (admin Plans Management page)
5. **Credit packages exist** — `credit_topup_packages` populated (via seed data or migration)

### Test Cards

| Card Number | Behaviour |
|-------------|-----------|
| `4242 4242 4242 4242` | Always succeeds |
| `5555 5555 5555 4444` | Mastercard, always succeeds |
| `4000 0025 0000 3155` | Requires 3D Secure authentication |
| `4000 0000 0000 0002` | Always declines |

Use any future expiry date (e.g. `12/30`), any CVC (e.g. `123`), and any billing address.

### Test A: New Subscription

**Goal:** Verify a user can purchase a plan and their `plan_id` gets updated.

1. Log in as a test user on Free plan (e.g. `sarah.johnson@demo.innotrue.com` / `DemoPass123!`)
2. Navigate to `/subscription`
3. Select a plan (e.g. Pro) and billing interval (Monthly)
4. Click **Subscribe Now** → redirected to Stripe Checkout
5. Enter test card `4242 4242 4242 4242`, any expiry, any CVC, any address
6. Complete payment → redirected to `/subscription?success=true`
7. A toast should appear confirming the subscription

**Verify in database** (Supabase SQL Editor):
```sql
-- Check user's plan was updated
SELECT p.email, pl.key AS plan_key, pl.name AS plan_name
FROM profiles p
JOIN plans pl ON p.plan_id = pl.id
WHERE p.email = 'sarah.johnson@demo.innotrue.com';
-- Expected: plan_key = 'pro'

-- Check Stripe webhook logged the event
SELECT * FROM edge_function_logs
WHERE function_name = 'stripe-webhook'
ORDER BY created_at DESC LIMIT 5;
```

**Verify in Stripe Dashboard:**
- Toggle to Test mode → Payments → should see the test charge
- Customers → the test user's email should appear as a customer

### Test B: Upgrade/Downgrade via Billing Portal

**Goal:** Verify plan changes made in the Stripe Billing Portal sync back to the database.

1. Log in as the user who has an active subscription (from Test A)
2. Navigate to `/subscription`
3. Click **Manage Billing** → redirected to Stripe Billing Portal
4. In the portal, click **Update plan** or change to a different plan
5. Complete the change → redirected back to `/subscription`

**Verify in database:**
```sql
-- Check plan_id was updated to the new plan
SELECT p.email, pl.key AS plan_key
FROM profiles p
JOIN plans pl ON p.plan_id = pl.id
WHERE p.email = 'sarah.johnson@demo.innotrue.com';
```

**Note:** Downgrades typically take effect at the end of the billing period. Upgrades are immediate. The webhook fires `customer.subscription.updated` which resolves the new Stripe price → `plan_prices.plan_id` → updates `profiles.plan_id`.

### Test C: Subscription Cancellation

**Goal:** Verify cancelling a subscription downgrades the user to Free.

1. Log in as the user with an active subscription
2. Navigate to `/subscription` → click **Manage Billing**
3. In the Stripe portal, click **Cancel plan**
4. Choose "Cancel immediately" (for testing; in production users may choose end-of-period)
5. Confirm cancellation → redirected back to `/subscription`

**Verify in database:**
```sql
-- Check user was downgraded to Free
SELECT p.email, pl.key AS plan_key
FROM profiles p
JOIN plans pl ON p.plan_id = pl.id
WHERE p.email = 'sarah.johnson@demo.innotrue.com';
-- Expected: plan_key = 'free'
```

### Test D: Credit Top-Up Purchase

**Goal:** Verify a user can purchase credits and they appear in their balance.

1. Log in as a test user
2. Navigate to `/credits`
3. In the "Purchase Credit Top-ups" section, click **Purchase** on the Standard package (150 credits, €24.99)
4. Stripe Checkout opens → enter test card `4242 4242 4242 4242`
5. Complete payment → redirected to `/credits?success=true&session_id=cs_...`
6. Toast: "Credits Added! 150 credits have been added to your account."
7. Credit balance on the page should increase

**Verify in database:**
```sql
-- Check purchase record was completed
SELECT status, credits_purchased, amount_cents, stripe_checkout_session_id
FROM user_credit_purchases
WHERE user_id = (SELECT id FROM auth.users WHERE email = 'sarah.johnson@demo.innotrue.com')
ORDER BY created_at DESC LIMIT 1;
-- Expected: status = 'completed', credits_purchased = 150

-- Check credit batch was granted
SELECT amount, source_type, expires_at
FROM credit_grant_batches
WHERE owner_id = (SELECT id FROM auth.users WHERE email = 'sarah.johnson@demo.innotrue.com')
  AND source_type = 'topup'
ORDER BY created_at DESC LIMIT 1;
-- Expected: amount = 150, expires_at ~12 months from now
```

### Test E: Payment Failure (declined card)

**Goal:** Verify declined payments are handled gracefully.

1. Navigate to `/subscription` or `/credits`
2. Start a checkout
3. Enter test card `4000 0000 0000 0002` (always declines)
4. Stripe shows a decline error on the checkout page
5. User can retry with a different card or close the page
6. If closed, the user returns to the app with `?canceled=true`

**Verify:** No changes in database — `plan_id` unchanged, no credit purchase records created.

### Test F: Webhook Delivery (Stripe Dashboard)

**Goal:** Verify the webhook endpoint is receiving and processing events correctly.

1. Go to Stripe Dashboard → Developers → Webhooks
2. Click your webhook endpoint
3. Click **Send test webhook** → select `checkout.session.completed`
4. Check the response — should be `200 OK`
5. Check the event log for any delivery failures

**Verify in Supabase:**
- Edge Functions → `stripe-webhook` → Logs tab shows the invocation
- If using test events, the function will log the event but may not find a matching user (that's OK for connectivity testing)

### Test G: Stripe Price ID Setup (first-time setup)

If `plan_prices.stripe_price_id` is empty (new environment), you need to create Stripe products first:

1. Go to Stripe Dashboard → Products (in test mode for preprod)
2. Create a product for each purchasable plan (Base, Pro, Advanced, Elite)
3. Add a recurring price to each (e.g. €29/month for Base)
4. Copy each price ID (`price_...`)
5. In the app, go to admin Plans Management → edit each plan → Pricing tab
6. Paste the Stripe price ID for each billing interval

**Or via SQL:**
```sql
-- Example: set Pro monthly price
UPDATE plan_prices
SET stripe_price_id = 'price_1ABC...'
WHERE plan_id = (SELECT id FROM plans WHERE key = 'pro')
  AND billing_interval = 'month';
```

Credit packages auto-create their Stripe products/prices on first purchase — no manual setup needed.

### Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| Checkout redirects but plan doesn't update | Webhook not configured or secret wrong | Check Stripe Dashboard → Webhooks → endpoint status. Verify `STRIPE_WEBHOOK_SECRET` matches |
| "No prices found" on subscription page | `plan_prices.stripe_price_id` is null | Create Stripe products/prices and update `plan_prices` table |
| Webhook returns 401/403 | Missing `STRIPE_WEBHOOK_SECRET` | Set the secret via `npx supabase secrets set` |
| Webhook returns 400 | Signature verification failed | The signing secret doesn't match — copy it again from Stripe Dashboard |
| Credits not appearing after purchase | `confirm-credit-topup` not called | Check browser console — the return URL must include `session_id` parameter |
| Webhook fires but plan doesn't update | Price ID not in `plan_prices` table | The webhook resolves Stripe price → `plan_prices.plan_id`. Add the missing `stripe_price_id` |
| "Checkout session expired" | Test session older than 24h | Start a new checkout |

---

## Strategic Roadmap

### Pricing Strategy (revised 2026-02-22)

**Context:** Programs generate €3K–€12K per client (leadership programs up to €12K). Subscription pricing should reflect the ecosystem value. The subscription creates the recurring relationship; programs and credits drive the high-ticket revenue.

**Recommended individual pricing (4 paid tiers):**

| Plan | Monthly | Annual (20% off) | Credits/mo | Target Audience |
|------|---------|-------------------|-----------|-----------------|
| **Free** | €0 | €0 | 20 | Lead capture — AI Coach taster, Wheel of Life, basic tools |
| **Base** | €49/mo | €468/yr (€39/mo) | 150-200 | Entry professionals — full AI, sessions, assessments, basic programs |
| **Pro** | €99/mo | €948/yr (€79/mo) | 300-400 | Active career developers — higher credits, advanced tools |
| **Advanced** | €179/mo | €1,716/yr (€143/mo) | 500-600 | Serious professionals — cert prep, priority booking, advanced programs |
| **Elite** | €249/mo | €2,388/yr (€199/mo) | 750-1000 | Top tier — maximum credits, all features, premium support |

**Why 4 paid tiers (not 2):** With Elite at €249/mo, the jump from €49 to €249 is too steep for a single upgrade. 4 tiers create natural stepping stones. At €4K–€12K program values, even Elite is <6% of total client spend.

**Current seed prices** (€19/€29/€49/€99) need to be updated to the above. This is a plan_prices + plans data migration.

**Annual pricing:** Must be added. Annual subscriptions reduce churn, improve cash flow, and are standard across all platforms. Add rows to `plan_prices` with `billing_interval = 'year'` — the auto-create Stripe flow handles the rest.

### Alumni Lifecycle (decided 2026-02-21)

**Problem:** When users complete a program, they need a graceful transition that maintains belonging, not a hard cutoff.

**Solution:** Alumni is an enrollment lifecycle state, NOT a plan or track.

**How it works:**

1. When `client_enrollments.status = 'completed'`, the enrollment enters an alumni grace period
2. During the grace period, user retains **read-only access** to program content (modules, resources, recordings) but cannot submit assignments or book new sessions
3. After the grace period, content access is fully revoked
4. User's subscription plan does NOT change — they stay on whatever plan they had

**Configuration:**
- `system_settings` key: `alumni_grace_period_days` (default: 90)
- Entitlements check: enrollment completed AND `completed_at + grace_period > now()` → grant read-only program access

**✅ IMPLEMENTED (2026-03-01)** — See `completed-work.md` for full details.

**What was built:**
- `completed_at` column + trigger on `client_enrollments` (auto-set on status → completed)
- `alumni_touchpoints` table (prevents duplicate nurture emails via UNIQUE constraint)
- `check_alumni_access` RPC — computes grace period from `system_settings.alumni_grace_period_days` (default 90)
- Shared `_shared/content-access.ts` helper — staff → active enrollment → alumni grace → denied access chain
- `serve-content-package` + `xapi-launch` modified to use shared access check (alumni get read-only)
- `alumni-lifecycle` cron edge function — nurture emails at 0/30/60/90 days + grace expiry notification
- `useAlumniAccess` hook + read-only banner in `ContentPackageViewer` + xAPI suppression
- Admin: `ClientDetail.tsx` shows alumni access expiry countdown
- **Continuation plan deprecated** (`is_active = false`)

### Coach/Instructor Revenue Model (decided 2026-02-21)

**Phase 1 (MVP) — ✅ IMPLEMENTED (2026-03-01):** See `completed-work.md` for full details.

**What was built:**
- `partner_codes` table — partner_id, program_id, cohort_id (optional), code (UNIQUE), label, discount_percent, is_free, max_uses, current_uses, expires_at, is_active
- `partner_referrals` table — partner_code_id, partner_id (denormalized), referred_user_id, enrollment_id, referral_type, status
- `validate_partner_code` RPC — validates code, returns program info + discount + partner_id
- `redeem-partner-code` edge function — validate → capacity check → enroll_with_credits with `enrollment_source='partner_referral'` → track referral → notify partner
- Admin `PartnerCodesManagement.tsx` — PRT prefix code generator, CRUD dialog, partner filter, copy code/link, referral counts
- Public `/partner?code=X` redemption page — auto-validate from URL, show program + discount, auth redirect, enroll
- Teaching dashboard referral stats card (My Referrals)

**Future phases (not yet built):**
- Phase 2: Automated commission calculation, coach earnings dashboard
- Phase 3: Coach tiers (Partner → Senior → Principal), performance bonuses, program co-creation revenue share
- Tables needed for Phase 2-3: `partner_payouts`, `coach_rewards`

### Identified Gaps (revised 2026-02-22)

**A. Corporate/B2B Program Enrollment Flow**
- How does HR enroll 20 employees in a program? Current flow is one-by-one.
- Need: bulk "Program Seats" purchase for orgs — buy N seats at per-seat price with volume tiers.
- Separate from credits, more intuitive for B2B buyers.
- Priority: Medium — needs more design work.

**B. Certification Verification via Credly/Accredible** (partially built — see below)
- Foundation exists: `program_badges`, `client_badges`, `program_badge_credentials` tables, admin badge manager, instructor approval flow, client display with LinkedIn share.
- Credly/Accredible template URLs are stored but **no API integration** to push credentials.
- What's missing:
  1. **Auto-badge creation** — edge function triggered on program completion (all modules + scenarios done) → auto-creates `client_badges` with status `pending_approval`
  2. **Credly/Accredible API push** — edge function to call their API on badge approval, store response ID, handle webhook for acceptance
  3. **Public verification page** — route `/verify/:code` showing certificate details without login
  4. **PDF certificate generation** — branded PDF alongside digital badge
  5. **Badge expiry/renewal** — `expires_at` field on `client_badges` for certs requiring continuing education
- Priority: High — certification is a key differentiator.

**C. Waitlist / Cohort Management** ✅ DONE (2026-03-01)
- Implemented: `cohort_waitlist` table (position-based queue), `programs.capacity` column, `check_cohort_capacity` + `check_program_capacity` RPCs, `join_cohort_waitlist` RPC, `enroll_with_credits` capacity enforcement (13 params, `p_force` admin override), `CohortWaitlistButton` (client), `CohortWaitlistManager` (admin promote/remove), `notify-cohort-waitlist` edge function.
- Enrollment attribution: `enrollment_source`, `referred_by`, `referral_note` on `client_enrollments` — tracks self/admin/code/waitlist/partner sources.
- See `completed-work.md` for full details.

**D. Module Prerequisite UI + Time-Gating** ✅ DONE (2026-02-22)
- Implemented: lock icons, "Complete Module X first" messages, disabled states on locked modules. Time-gating via `available_from_date` on `program_modules`. Admin toggle in module editor. Commit `783f06d`.

**E. Renewal & Win-Back Flows — System + ActiveCampaign**
- `subscription-reminders` does renewal emails but no win-back or re-engagement.
- Two layers needed:
  1. **In-system:** Extend cron with credit expiry warnings, dormant user detection, re-engagement notifications
  2. **ActiveCampaign:** `activecampaign-sync` edge function that pushes key events (subscription created/cancelled, program completed, credits low, dormant 30 days) to ActiveCampaign API for journey automation
- Priority: Medium — important for retention.

**F. Org Analytics & ROI Dashboard**
- Org admins need to justify spend to leadership.
- Need: aggregate dashboard — programs completed, skills gaps closed, session utilization, credits consumed vs purchased, engagement scores.
- Critical for B2B retention and expansion.
- Priority: Medium-High.

---

## Future Improvements (Technical)

### 1. ~~Programs/Continuation Plan Deprecation~~ ✅ PARTIALLY DONE (2026-03-01)
- ✅ Alumni lifecycle implemented as Continuation replacement (2B.1)
- ✅ Continuation plan set `is_active = false` (migration `20260301130000_pricing_update.sql`)
- ⬜ ContinuationBanner still triggers on `plan_key === 'continuation'` — should migrate to enrollment status + grace period
- ⬜ "Move to Continuation" admin action still exists in ProgramCompletions — should be removed
- ⬜ Existing users on continuation plan need migration to Free
- ⬜ `programs` plan still active for admin-assigned users — evaluate if still needed

### 2. Fallback Plan Activation
The `fallback_plan_id` field exists on the `plans` table with a validation trigger, but no code executes the fallback. This could be wired to `stripe-webhook` on `customer.subscription.deleted` to downgrade to the plan's configured fallback instead of always defaulting to Free.

### 3. Subscription Confirmation Page
Currently, after Stripe Checkout for subscriptions, the user returns to `/subscription?success=true` which shows a toast. Unlike credit purchases, there's no `confirm-*` call. The webhook handles activation asynchronously. Consider adding a polling mechanism on the success page to confirm the plan_id has been updated before showing the success state.

### 4. Stripe Customer Portal Enhancements
The Billing Portal allows subscription management, but plan changes made there rely on the webhook to sync. Ensure all Stripe price IDs in the Portal match `plan_prices.stripe_price_id` entries.

### 5. ~~Annual Pricing~~ ✅ DONE (2026-03-01)
Annual prices added by migration `20260301130000_pricing_update.sql`: Base €470/yr, Pro €950/yr, Advanced €1718/yr, Elite €2390/yr (20% discount vs monthly). Frontend already had billing interval toggle — no changes needed.
