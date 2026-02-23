# Subscriptions, Plans & Stripe Integration

> How subscription plans work, how Stripe is integrated, and architectural recommendations.

## Plan Architecture

### Subscription Plans (plans table)

| Key | Name | Tier | is_free | is_purchasable | Credit Allowance | Purpose |
|-----|------|------|---------|----------------|-----------------|---------|
| `free` | Free | 0 | yes | yes | 40 | Default plan for all new users |
| `base` | Base | 1 | no | yes | 100 | Entry paid tier |
| `pro` | Pro | 2 | no | yes | 200 | Professional tier |
| `advanced` | Advanced | 3 | no | yes | 360 | Advanced tier |
| `elite` | Elite | 4 | no | yes | 500 | Top tier |
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
Credits.tsx ─────────────────> create-installment-checkout ─> Checkout Session (subscription + cancel_at)
OrgBilling.tsx ──────────────> org-purchase-credits ───────> Checkout Session (one-time)
               (return URL) ─> org-confirm-credit-purchase > Session.retrieve (verify)
               ──────────────> org-platform-subscription ──> Checkout Session (subscription)

Stripe ──────────────────────> stripe-webhook ─────────────> DB updates
  (checkout.session.completed)    ↓
  (subscription.updated)         profiles.plan_id
  (subscription.deleted)         org_platform_subscriptions + payment_schedules
  (invoice.paid)                 payment_schedules (installment tracking)
  (invoice.payment_failed)       payment_schedules + enrollment payment_status
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
| `create-installment-checkout` | User installment plan checkout | Subscription (fixed-term) |

### Payment Verification Strategy

The system uses **two patterns** for verifying payments:

1. **Webhooks** (for subscriptions): Stripe sends events to `stripe-webhook`. The webhook verifies the signature, identifies the event type, and updates the DB. This handles all lifecycle events (activation, plan changes, cancellation, payment failures).

2. **Confirm-on-return** (for one-time payments): After Stripe Checkout, the user's browser returns to a URL with `?session_id=...`. The frontend calls a `confirm-*` edge function that retrieves the session from Stripe, verifies payment, and grants credits. Idempotency guards prevent double-granting.

### Stripe Webhook Setup

The `stripe-webhook` edge function handles these events:

| Event | Action |
|-------|--------|
| `checkout.session.completed` | Activates subscription: sets `profiles.plan_id` (user) or `org_platform_subscriptions.status` (org). For `credit_installment` type: grants full credits upfront + creates `payment_schedules` record |
| `customer.subscription.updated` | Syncs plan changes (up/downgrade via Billing Portal): resolves new Stripe price to `plan_id` |
| `customer.subscription.deleted` | Downgrades user to Free plan or cancels org subscription. For `credit_installment` type: marks completed or defaulted, locks enrollment if defaulted |
| `invoice.paid` | For installment subscriptions: updates `payment_schedules` (increments installments_paid, amount_paid_cents), sets enrollment `payment_status` to 'paid' |
| `invoice.payment_failed` | Logs the failure (Stripe handles dunning/retry automatically). For installment subscriptions: sets enrollment `payment_status` to 'outstanding' |

**To configure the webhook in Stripe Dashboard:**

1. Go to **Developers > Webhooks > Add endpoint**
2. URL: `https://<project-ref>.supabase.co/functions/v1/stripe-webhook`
3. Events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.paid`
   - `invoice.payment_failed`
4. Copy the signing secret (`whsec_...`)
5. Set it as an edge function secret:
   ```bash
   # Preprod
   npx supabase secrets set STRIPE_WEBHOOK_SECRET='whsec_...' --project-ref jtzcrirqflfnagceendt
   # Prod
   npx supabase secrets set STRIPE_WEBHOOK_SECRET='whsec_...' --project-ref qfdztdgublwlmewobxmx
   ```

**Current Status (2026-03-04):**
- ✅ **Preprod** webhook configured — all 5 events, `STRIPE_SECRET_KEY` (`sk_test_...`) and `STRIPE_WEBHOOK_SECRET` set
- ✅ **Production** webhook configured — all 5 events, `STRIPE_SECRET_KEY` (`sk_live_...`) and `STRIPE_WEBHOOK_SECRET` set
- Stripe price IDs: auto-created on first checkout per environment (no manual sync needed)

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
| `payment_schedules` | `stripe_subscription_id` |
| `client_enrollments` | `stripe_subscription_id`, `payment_type`, `payment_status` |
| `programs` | `installment_options` (JSONB), `upfront_discount_percent` |

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

> **Full specification:** See [`CREDIT_ECONOMY_AND_PAYMENTS.md`](CREDIT_ECONOMY_AND_PAYMENTS.md) for the complete unified credit economy spec including pricing tables, enrollment flows, installment plans, and discount/voucher system.

Credits are a separate dimension from plans. Plans provide a monthly `credit_allowance` that auto-refills (no rollover, resets each billing period), while purchased credits are stored in `credit_batches` with a 10-year expiry (effectively permanent — users paid real money, so purchased credits should persist).

**Base ratio: 1 EUR = 2 credits** (unified across all pricing — plans, top-ups, org bundles, services).

**Credit expiry policy (decided 2026-03-04):** Plan credits reset monthly (use-it-or-lose-it). Purchased/org credits expire after 10 years (functionally permanent). FIFO consumption uses plan credits first, protecting purchased credits. Full rationale in [`CREDIT_ECONOMY_AND_PAYMENTS.md` Section 11](CREDIT_ECONOMY_AND_PAYMENTS.md#11-credit-expiry-policy-decided-2026-03-04).

### Credit Scale (at 2:1 ratio)

| Category | Service | Credits | EUR equivalent |
|----------|---------|---------|---------------|
| AI | AI Coach query, Insight, Recommendation | 2 each | EUR 1 |
| Goals | Goal creation | 4 | EUR 2 |
| Sessions | Peer coaching | 60 | EUR 30 |
| Sessions | Group session | 100 | EUR 50 |
| Sessions | Workshop | 150 | EUR 75 |
| Sessions | Coaching (1:1) | 200 | EUR 100 |
| Sessions | Review Board Mock (async) | 300 | EUR 150 |
| Sessions | Review Board Mock (live) | 1,500 | EUR 750 |
| Programs | Base program enrollment | 500 | EUR 250 |
| Programs | Pro program enrollment | 2,000 | EUR 1,000 |
| Programs | Advanced / Premium enrollment | 6,000-17,000 | EUR 3,000-8,500 |

### Credit Top-Up Packages

Users and organizations can purchase additional credits via Stripe Checkout.

**Individual packages** (`credit_topup_packages`) — 6 tiers from EUR 10 to EUR 8,500:

| Package | Price | Credits | Target Use Case |
|---------|-------|---------|-----------------|
| Micro | EUR 10 | 20 | AI insights |
| Session | EUR 75 | 150 | One coaching session |
| Module | EUR 250 | 500 | Short course / workshop |
| Program | EUR 1,500 | 3,000 | Small program |
| Premium Program | EUR 4,500 | 9,000 | Mid-tier program |
| Immersion | EUR 8,500 | 17,000 | Premium program (CTA etc.) |

**Organization bundles** (`org_credit_packages`) — 8 tiers with volume bonuses (5%-40%):
See [`CREDIT_ECONOMY_AND_PAYMENTS.md`](CREDIT_ECONOMY_AND_PAYMENTS.md) Section 2c for full table.

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
  → grant_credit_batch RPC (adds credits with 10-year expiry)
      ↓
Toast: "Credits Added! X credits have been added to your account."
```

### Installment Plan Flow (✅ IMPLEMENTED 2026-03-03)

Installment plans allow high-value program enrollments to be paid over 3, 6, or 12 monthly payments via a Stripe subscription with a fixed end date.

**Architecture:**
```
/credits page → Select package + installment option
      ↓
create-installment-checkout (edge function)
  → Creates Stripe product/price for installment amount
  → Creates Stripe Checkout Session (mode: subscription)
  → Sets cancel_at for auto-termination after N months
  → Creates pending user_credit_purchases record
  → Returns Stripe Checkout URL
      ↓
Stripe hosted checkout (user pays first installment)
      ↓
stripe-webhook: checkout.session.completed (metadata.type = "credit_installment")
  → handleInstallmentCheckoutCompleted()
  → Grants ALL credits upfront via grant_credit_batch RPC
  → Creates payment_schedules record (installments_paid = 1)
  → Updates enrollment with stripe_subscription_id
      ↓
Monthly: Stripe auto-charges → invoice.paid webhook
  → handleInvoicePaid() → update_installment_payment_status RPC
  → Increments installments_paid, amount_paid_cents
  → Sets enrollment payment_status = 'paid'
      ↓
On missed payment: invoice.payment_failed webhook
  → Sets enrollment payment_status = 'outstanding'
  → PlanLockOverlay shows "Payment Required" on program access
      ↓
After N months: Stripe auto-cancels (cancel_at reached)
  → customer.subscription.deleted webhook
  → handleInstallmentSubscriptionDeleted()
  → If all paid: status = 'completed'
  → If not all paid: status = 'defaulted', enrollment locked
```

**Key design decisions:**
- **Credits granted upfront** — all credits consumed at enrollment time, not dripped per payment. Prevents clients from spending credits elsewhere before program is paid for.
- **Access locking on missed payment** — `usePlanAccess` checks `payment_type = 'payment_plan'` + `payment_status IN ('outstanding','overdue')` → `isLocked = true`
- **Stripe cancel_at** — subscription auto-terminates, no manual intervention needed
- **First invoice deduplication** — `handleInvoicePaid` skips `billing_reason === "subscription_create"` (already handled in checkout.completed)

**Per-program configuration:**
- `programs.installment_options` (JSONB): `[{"months":3,"label":"3 monthly payments"},{"months":6,...},{"months":12,...}]`
- `programs.upfront_discount_percent` (NUMERIC): e.g., 5% off for paying in full
- Admin UI: ProgramPlanConfig.tsx checkboxes for 3/6/12 months + discount input

**Admin tracking:**
- `/admin/payment-schedules` — PaymentSchedulesManagement page
- Summary stats: active plans, defaulted, outstanding amount, total collected
- Per-schedule: status badge, progress bar (X/Y payments), next payment date

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
| `/admin/payment-schedules` | Admin installment tracking dashboard | Reads `payment_schedules` table |

---

## Testing Guide

### Prerequisites

Before testing any payment flow on **preprod**:

1. **Stripe test mode is active** — preprod uses `sk_test_...` key
2. **Webhook is configured** ✅ — endpoint `https://jtzcrirqflfnagceendt.supabase.co/functions/v1/stripe-webhook` with all 5 events (`checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`)
3. **`STRIPE_WEBHOOK_SECRET`** is set on preprod ✅
4. **`plan_prices.stripe_price_id`** — auto-created on first checkout (edge functions create Stripe products/prices if `stripe_price_id` is NULL, then save the ID back to the database)
5. **Credit packages exist** — `credit_topup_packages` populated (via seed data or migration). Stripe prices auto-created on first purchase.

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
-- Expected: amount = 150, expires_at ~10 years from now
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

### Pricing Strategy (revised 2026-03-02)

**Context:** Programs generate EUR 3K-12K per client (leadership programs up to EUR 12K). Subscription pricing reflects ecosystem value. Subscriptions create the recurring relationship; programs and credits drive high-ticket revenue.

**Unified credit ratio: 1 EUR = 2 credits.** See [`CREDIT_ECONOMY_AND_PAYMENTS.md`](CREDIT_ECONOMY_AND_PAYMENTS.md) for full specification.

**Individual pricing (4 paid tiers) — IMPLEMENTED (2026-03-01):**

| Plan | Monthly | Annual (20% off) | Credits/mo (at 2:1) | Target Audience |
|------|---------|-------------------|---------------------|-----------------|
| **Free** | EUR 0 | EUR 0 | 40 | Lead capture — AI Coach taster, Wheel of Life, basic tools |
| **Base** | EUR 49/mo | EUR 470/yr | 100 | Entry professionals — full AI, sessions, assessments, basic programs |
| **Pro** | EUR 99/mo | EUR 950/yr | 200 | Active career developers — higher credits, advanced tools |
| **Advanced** | EUR 179/mo | EUR 1,718/yr | 360 | Serious professionals — cert prep, priority booking, advanced programs |
| **Elite** | EUR 249/mo | EUR 2,390/yr | 500 | Top tier — maximum credits, all features, premium support |

**Why 4 paid tiers (not 2):** With Elite at EUR 249/mo, the jump from EUR 49 to EUR 249 is too steep for a single upgrade. 4 tiers create natural stepping stones. At EUR 4K-12K program values, even Elite is <6% of total client spend.

**Annual pricing:** IMPLEMENTED (2026-03-01). 20% discount vs monthly. `plan_prices` with `billing_interval = 'year'` — Stripe auto-create handles the rest. Frontend already had billing interval toggle.

**Individual top-ups:** 6 packages from EUR 10 to EUR 8,500. Large packages shown contextually when redirected from enrollment.

**Installment plans:** ✅ IMPLEMENTED (2026-03-03). Stripe subscription-as-instalment with `cancel_at` for fixed-term. Credits consumed upfront, access locked on missed payment. Per-program config (`installment_options` JSONB). Admin tracking dashboard at `/admin/payment-schedules`. See credit economy doc for full spec.

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

### Enrollment Lifecycle: Duration, Feature Visibility & Loss Communication (decided 2026-03-04)

Three related features that complete the enrollment lifecycle beyond Alumni:

**2B.10 — Enrollment Duration & Deadline Enforcement (🔴 High)**

Problem: Enrollments stay `active` indefinitely. `client_enrollments.end_date` exists but is unenforced. Users could enroll, access premium features via `program_plan_id`, and never complete.

Plan:
- Add `programs.default_duration_days` (nullable INT). `enroll_with_credits` auto-calculates `end_date`.
- Cron job (extend `alumni-lifecycle`) transitions past-due enrollments to `completed` → triggers alumni grace.
- Expiry warnings at 30 days, 7 days, and on expiry (email + dashboard banner).
- Admin can extend `end_date` per-enrollment. `NULL` duration = self-paced (no deadline).

Foundation already exists: `end_date` column, `completed_at` trigger, `alumni-lifecycle` cron.

**2B.11 — Feature Loss Communication (🟠 High)**

Problem: When enrollment completes, program plan features silently disappear from `useEntitlements` (only fetches `status = 'active'`). No warning.

Plan:
- Pre-completion warning when last module finishes: list features that will be lost.
- Post-completion dashboard notice for 7-14 days: features lost + upgrade CTA.
- Alumni grace banner on program content pages: "Alumni access — X days remaining (read-only)."
- New `useRecentlyLostFeatures()` hook comparing current entitlements vs recently completed enrollments.

Foundation: `useEntitlements().getAccessSource()` returns `"program_plan"`, `useAlumniAccess().days_remaining`.

**2B.12 — Feature Gain Visibility (🟡 Medium)**

Problem: Users don't know which features come from their program vs subscription. No visibility into the temporary feature boost.

Plan:
- "What's included" section on program detail page (pre-enroll) — shows program plan features.
- Dashboard feature attribution badges: "Via [Program Name]" tags on feature cards.
- Subscription page: note which features user already has via active enrollment.

Foundation: `getAccessSource()`, `program_plan_features` table, existing subscription comparison grid.

### Credit Expiry Policy & Awareness (decided 2026-03-04)

**Policy change:** Purchased credits (individual top-ups + org bundles) changed from 12-month expiry to **10-year expiry** (effectively permanent). Plan credits continue to reset monthly with no rollover.

**Rationale:** Users paid real money for top-up credits — expiring them after 12 months erodes trust and discourages purchasing. FIFO consumption already protects the business (plan credits consumed first). 10-year horizon avoids permanent deferred revenue liability while being functionally permanent.

Full rationale and implementation details in [`CREDIT_ECONOMY_AND_PAYMENTS.md` Section 11](CREDIT_ECONOMY_AND_PAYMENTS.md#11-credit-expiry-policy-decided-2026-03-04).

**2B.13 — Credit Expiry Awareness (planned):**
- Dashboard expiry banner (data exists via `get_user_credit_summary_v2`, UI needed)
- Email notification cron (notification type `credits_expiring` exists, no cron sends it)
- AI spend suggestions (future, Phase 3)

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

### 1. ~~Programs/Continuation Plan Deprecation~~ ✅ FULLY DONE (2026-03-04)
- ✅ Alumni lifecycle implemented as Continuation replacement (2B.1, 2026-03-01)
- ✅ Continuation plan set `is_active = false` (migration `20260301130000_pricing_update.sql`)
- ✅ ContinuationBanner deleted (2026-03-04)
- ✅ "Move to Continuation" admin action removed from ProgramCompletions (2026-03-04)
- ✅ Remaining users migrated to Free (migration `20260304100000_remove_continuation_plan.sql`)
- `programs` plan still active for admin-assigned users — this is intentional (not Continuation)

### 2. Fallback Plan Activation
The `fallback_plan_id` field exists on the `plans` table with a validation trigger, but no code executes the fallback. This could be wired to `stripe-webhook` on `customer.subscription.deleted` to downgrade to the plan's configured fallback instead of always defaulting to Free.

### 3. Subscription Confirmation Page
Currently, after Stripe Checkout for subscriptions, the user returns to `/subscription?success=true` which shows a toast. Unlike credit purchases, there's no `confirm-*` call. The webhook handles activation asynchronously. Consider adding a polling mechanism on the success page to confirm the plan_id has been updated before showing the success state.

### 4. Stripe Customer Portal Enhancements
The Billing Portal allows subscription management, but plan changes made there rely on the webhook to sync. Ensure all Stripe price IDs in the Portal match `plan_prices.stripe_price_id` entries.

### 5. ~~Annual Pricing~~ ✅ DONE (2026-03-01)
Annual prices added by migration `20260301130000_pricing_update.sql`: Base €470/yr, Pro €950/yr, Advanced €1718/yr, Elite €2390/yr (20% discount vs monthly). Frontend already had billing interval toggle — no changes needed.
