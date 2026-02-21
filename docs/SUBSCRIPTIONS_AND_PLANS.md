# Subscriptions, Plans & Stripe Integration

> How subscription plans work, how Stripe is integrated, and architectural recommendations.

## Plan Architecture

### Subscription Plans (plans table)

| Key | Name | Tier | is_free | is_purchasable | Credit Allowance | Purpose |
|-----|------|------|---------|----------------|-----------------|---------|
| `free` | Free | 0 | yes | yes | 20 | Default plan for all new users |
| `base` | Base | 1 | no | yes | 150 | Entry paid tier |
| `pro` | Pro | 2 | no | yes | 250 | Professional tier |
| `advanced` | Advanced | 3 | no | yes | 500 | Advanced tier |
| `elite` | Elite | 4 | no | yes | 750 | Top tier |
| `programs` | Programs | 0 | yes | **no** | - | Admin-assigned: users with purchased programs only |
| `continuation` | Continuation | 0 | yes | **no** | - | Admin-assigned: post-program alumni access |

### How plan_id Gets Assigned

| Path | When | What Happens |
|------|------|-------------|
| Self-registration | `complete-registration` edge function | Sets `plan_id` to Free (only if null) |
| Placeholder transfer | `verify-signup` or `complete-registration` | Copies placeholder's `plan_id` to real user |
| Stripe checkout | `stripe-webhook` on `checkout.session.completed` | Sets `plan_id` to the purchased plan |
| Stripe plan change | `stripe-webhook` on `customer.subscription.updated` | Updates `plan_id` to new plan |
| Stripe cancellation | `stripe-webhook` on `customer.subscription.deleted` | Downgrades `plan_id` to Free |
| Admin manual | ClientDetail page or `create-admin-user` | Direct `plan_id` update |
| Admin bulk | ProgramCompletions page | Moves users to Continuation plan |
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

### The Programs & Continuation Plans: Current Status and Recommendation

**Current state:** The `programs` and `continuation` plans are non-purchasable, admin-assigned plans that sit outside the Stripe billing flow. They're used for:
- Users who bought a program directly (not via subscription) and need platform access
- Alumni who completed a program and should retain some access while being nudged to upgrade

**Analysis:** The 3-layer entitlements engine (subscription + program plan + org-sponsored) already handles these use cases without needing dedicated plans:
- A Free-plan user with an active enrollment gets program features via `program_plan_features`
- The ContinuationBanner could trigger on "has completed enrollments but no active ones" instead of checking `plan_key === 'continuation'`
- The admin "Move to Continuation" action could be replaced by the natural fallback to Free

**Recommendation:** These plans can be deprecated in a future cleanup. They don't cause harm (non-purchasable, no Stripe mapping), but they add a manual admin workflow that the automated system doesn't need. See the "Future Improvements" section below.

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

## Future Improvements

### 1. Programs/Continuation Plan Deprecation
The `programs` and `continuation` plans can be removed once:
- The ContinuationBanner triggers on enrollment status instead of plan_key
- The "Move to Continuation" admin action is removed from ProgramCompletions
- Any users currently on these plans are migrated to Free
- The plans are soft-deleted (set `is_active = false`)

### 2. Fallback Plan Activation
The `fallback_plan_id` field exists on the `plans` table with a validation trigger, but no code executes the fallback. This could be wired to `stripe-webhook` on `customer.subscription.deleted` to downgrade to the plan's configured fallback instead of always defaulting to Free.

### 3. Subscription Confirmation Page
Currently, after Stripe Checkout for subscriptions, the user returns to `/subscription?success=true` which shows a toast. Unlike credit purchases, there's no `confirm-*` call. The webhook handles activation asynchronously. Consider adding a polling mechanism on the success page to confirm the plan_id has been updated before showing the success state.

### 4. Stripe Customer Portal Enhancements
The Billing Portal allows subscription management, but plan changes made there rely on the webhook to sync. Ensure all Stripe price IDs in the Portal match `plan_prices.stripe_price_id` entries.
