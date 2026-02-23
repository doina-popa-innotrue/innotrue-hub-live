# Unified Credit Economy & Payment System

> Comprehensive specification for the InnoTrue Hub credit system, payment flows, installment plans, and discount/voucher system.

## 1. Credit Economy Overview

### Base Ratio: 1 EUR = 2 Credits

All pricing across the platform uses a unified **2:1 credit-to-euro ratio**. This creates a platform currency that is psychologically distinct from direct pricing while remaining intuitive.

**Why 2:1 (not 1:1 or 10:1):**
- At 1:1, credits feel like "euros with extra steps" — no psychological benefit
- At 10:1+, mental math becomes difficult and feels manipulative for a professional audience
- At 2:1, services feel substantial (coaching session = 200 credits, not 1 or 1000), small services aren't trivially cheap (AI = 2 credits, not 0.01), and the ratio is easy to mentally convert

### Credit Sources

| Source | How Credits Are Obtained | Expiry |
|--------|------------------------|--------|
| **Plan allowance** | Monthly refill from subscription plan | Resets each billing period (no rollover) |
| **Program enrollment** | Granted via `program_plans.credit_allowance` | Tied to enrollment duration |
| **Individual top-ups** | Purchased via Stripe Checkout (one-time) | 10 years (effectively permanent) |
| **Org credit bundles** | Purchased by org admin via Stripe (one-time) | 10 years (effectively permanent) |
| **Admin grants** | Manually granted by admin (`grant_credit_batch` RPC) | Configurable (default: 10 years) |
| **Add-on credits** | From consumable add-ons assigned to user | Per add-on config |

### Consumption Order (FIFO)

Credits are consumed via `consume_credits_fifo` RPC in this priority:
1. **Plan credits** — monthly allowance (use-it-or-lose-it per period)
2. **Program credits** — from active enrollments (oldest expiry first)
3. **Bonus/purchased credits** — from top-ups, grants, add-ons (oldest expiry first)

---

## 2. Pricing Tables (at 2:1 ratio)

### 2a. Subscription Plans

| Plan | Monthly | Annual (20% off) | Credits/month | Effective ratio |
|------|---------|-------------------|---------------|----------------|
| **Free** | EUR 0 | EUR 0 | 40 | -- |
| **Base** | EUR 49 | EUR 470/yr | 100 | 2.04:1 |
| **Pro** | EUR 99 | EUR 950/yr | 200 | 2.02:1 |
| **Advanced** | EUR 179 | EUR 1,718/yr | 360 | 2.01:1 |
| **Elite** | EUR 249 | EUR 2,390/yr | 500 | 2.01:1 |

Plans provide monthly credit allowances plus feature access (AI limits, session booking, program access tiers). Credits reset each billing period.

### 2b. Individual Credit Top-Up Packages

| Package | Price (EUR) | Credits | Ratio | Target Use Case |
|---------|------------|---------|-------|-----------------|
| **Micro** | 10 | 20 | 2.00:1 | A few AI insights |
| **Session** | 75 | 150 | 2.00:1 | One coaching session |
| **Module** | 250 | 500 | 2.00:1 | Short course or workshop bundle |
| **Program** | 1,500 | 3,000 | 2.00:1 | Small program enrollment |
| **Premium Program** | 4,500 | 9,000 | 2.00:1 | Mid-tier program enrollment |
| **Immersion** | 8,500 | 17,000 | 2.00:1 | Premium program (CTA Immersion etc.) |

**Display strategy:** The Micro, Session, and Module packages are always visible. The Program, Premium Program, and Immersion packages are shown:
- When the client is redirected from an enrollment flow (contextual)
- Behind a "Show all packages" toggle on the Credits page
- With a "Recommended" badge on the smallest package that covers the shortfall

### 2c. Organization Credit Bundles

Org bundles include volume-based bonus credits (same as Stripe products):

| Package | Price (EUR) | Base Credits (at 2:1) | Bonus % | Total Credits | Effective ratio |
|---------|------------|----------------------|---------|---------------|----------------|
| Bundle 500 | 500 | 1,000 | 5% | 1,050 | 2.10:1 |
| Bundle 1000 | 1,000 | 2,000 | 10% | 2,200 | 2.20:1 |
| Bundle 2500 | 2,500 | 5,000 | 15% | 5,750 | 2.30:1 |
| Bundle 5000 | 5,000 | 10,000 | 20% | 12,000 | 2.40:1 |
| Bundle 7500 | 7,500 | 15,000 | 25% | 18,750 | 2.50:1 |
| Bundle 10000 | 10,000 | 20,000 | 30% | 26,000 | 2.60:1 |
| Bundle 15000 | 15,000 | 30,000 | 35% | 40,500 | 2.70:1 |
| Bundle 20000 | 20,000 | 40,000 | 40% | 56,000 | 2.80:1 |

### 2d. Credit Service Costs

| Category | Service | Credits | EUR equivalent |
|----------|---------|---------|---------------|
| **AI** | AI Coach query | 2 | EUR 1 |
| **AI** | AI Insight / Recommendation | 2 | EUR 1 |
| **Goals** | Goal creation | 4 | EUR 2 |
| **Sessions** | Peer coaching | 60 | EUR 30 |
| **Sessions** | Group session | 100 | EUR 50 |
| **Sessions** | Workshop | 150 | EUR 75 |
| **Sessions** | Coaching (1:1) | 200 | EUR 100 |
| **Sessions** | Mastermind | 200 | EUR 100 |
| **Sessions** | Review Board Mock (async) | 300 | EUR 150 |
| **Sessions** | Review Board Mock (live) | 1,500 | EUR 750 |
| **Programs** | Micro-learning course | 100 | EUR 50 |
| **Programs** | Base program enrollment | 500 | EUR 250 |
| **Programs** | Pro program enrollment | 2,000 | EUR 1,000 |
| **Programs** | Advanced program enrollment | 6,000 | EUR 3,000 |
| **Programs** | Premium program (e.g. CTA Immersion) | 16,896 | EUR 8,448 |

**Note:** Program credit costs are configured per-program per-tier via the admin `ProgramPlanConfig` component, stored in `program_tier_plans.credit_cost`. The values above are examples; actual pricing is set per program.

---

## 3. Enrollment & Payment Flows

### 3a. Standard Enrollment (credits sufficient)

```
Client browses /explore → sees program with credit cost on card
  → Clicks "Enrol" → ExpressInterestDialog shows:
    - Tier selection (if multiple)
    - Credit cost: "16,896 credits"
    - User balance: "17,200 credits available"
    - Optional: discount code input
    - Optional: partner code input
  → Client confirms → useProgramEnrollment:
    1. Validates discount code (if entered)
    2. Checks capacity (program + cohort)
    3. Consumes credits via FIFO
    4. Creates client_enrollments record
    5. Records discount usage + partner attribution
  → Toast: "Successfully enrolled! 16,896 credits deducted."
```

### 3b. Top Up & Enrol (credits insufficient)

```
Client clicks "Enrol" on CTA Immersion Premium (16,896 credits)
  → Has 200 credits, needs 16,696 more
  → useProgramEnrollment detects shortfall
  → Toast: "You need 16,696 more credits"
  → Stores pending enrollment in sessionStorage
  → Redirects to /credits?return=/explore

On /credits page:
  → Large packages revealed (contextual: redirected from enrollment)
  → "Recommended" badge on Immersion package (17,000 credits, EUR 8,500)
    "Covers your enrollment + 304 credits remaining"
  → Client clicks "Purchase" → Stripe Checkout (one-time payment)

After Stripe payment succeeds:
  → Redirected to /credits?success=true&session_id=...
  → confirm-credit-topup grants 17,000 credits
  → checkPendingEnrollment detects stored intent
  → Confirmation: "You have a pending enrollment for CTA Immersion Premium. Enrol now?"
  → Client confirms → enrollment proceeds (consumes 16,896 credits)
  → Toast: "Successfully enrolled!"
```

### 3c. Installment Plan Enrollment (future — Phase 3)

```
Client clicks "Enrol" on CTA Immersion Premium (16,896 credits)
  → Has 200 credits, needs 16,696 more
  → Redirected to /credits with enrollment context

On /credits page:
  → Sees Immersion package (EUR 8,500 / 17,000 credits)
  → Payment options:
    - "Pay in full: EUR 8,500" (one-time Stripe Checkout)
    - "3 instalments: 3x EUR 2,833/mo" (Stripe Subscription, auto-cancel after 3)
    - "6 instalments: 6x EUR 1,417/mo"
    - "12 instalments: 12x EUR 708/mo"

Client chooses 3 instalments:
  → create-installment-checkout edge function:
    1. Creates Stripe Subscription: EUR 2,833/mo, cancel_at = 3 months
    2. Sets metadata: { type: 'credit_installment', package_id, user_id, ... }
  → Stripe Checkout (subscription mode)

First payment succeeds:
  → Webhook: checkout.session.completed
    1. Grants FULL 17,000 credits to wallet immediately
    2. Creates payment_schedules record (1/3 paid)
  → confirm-credit-topup grants credits
  → Pending enrollment resumes → consumes 16,896 credits
  → Enrollment created: payment_type='payment_plan', payment_status='paid'
  → Client has FULL ACCESS + 304 spare credits

Month 2: Stripe charges EUR 2,833
  → Webhook: invoice.paid
    → payment_schedules: 2/3 paid
    → payment_status stays 'paid' → access continues

Month 3: Stripe charges EUR 2,833
  → Webhook: invoice.paid
    → payment_schedules: 3/3 paid, status='completed'
    → Stripe subscription auto-cancels (cancel_at reached)

IF Month 2 payment fails:
  → Webhook: invoice.payment_failed
    → payment_status set to 'outstanding'
    → usePlanAccess: isLocked=true, reason='payment_outstanding'
    → Client sees "Payment overdue" banner, program content locked
    → Stripe retries per dunning schedule
    → IF retry succeeds → payment_status='paid' → access restored
    → IF all retries fail → payment_status='overdue' → stays locked
```

### Key Design Principle: Credits Consumed Upfront

For installment plans, **all credits are consumed at enrollment time**, not released per payment. This means:
- No risk of the client spending credits on other things before the program is paid for
- The credit system and the financial obligation are decoupled
- Stripe tracks the EUR owed; the credit system tracks the service entitlement
- If a payment fails, access is locked via `payment_status` — not via credit shortage
- Refunds only cover the amount actually paid (Stripe enforces this)

---

## 4. Discount Code / Voucher System

### 4a. Architecture

**Status: Backend 100% complete. Admin UI complete. Client-facing input needs wiring.**

| Component | Status | Location |
|-----------|--------|----------|
| `discount_codes` table | BUILT | Migration `20260117040119` |
| `discount_code_uses` audit table | BUILT | Migration `20260117040119` |
| `validate_discount_code` RPC | BUILT | Migration `20260117040119` (SECURITY DEFINER) |
| `useDiscountCode` hook | BUILT | `src/hooks/useDiscountCode.ts` |
| `useProgramEnrollment` integration | BUILT | `src/hooks/useProgramEnrollment.ts` (accepts `discountCode` option) |
| Admin CRUD page | BUILT | `src/pages/admin/DiscountCodesManagement.tsx` (~806 lines) |
| Quick referral code generator | BUILT | Part of `DiscountCodesManagement.tsx` |
| Client discount code input in enrollment | PARTIAL | `ExpressInterestDialog.tsx` accepts props but needs wiring |
| Discount preview (savings badge) | NOT BUILT | Show "You save X credits" before confirming |

### 4b. Discount Code Schema

```sql
discount_codes:
  id              UUID PK
  code            TEXT UNIQUE (auto-uppercased)
  description     TEXT
  discount_type   TEXT CHECK ('percent' | 'fixed_amount')
  discount_value  NUMERIC (> 0)
  valid_for_program_ids  UUID[]    -- null = all programs
  valid_for_tier_names   TEXT[]    -- null = all tiers
  max_uses        INTEGER          -- null = unlimited
  uses_count      INTEGER          -- tracks current usage
  assigned_user_id     UUID        -- restrict to specific user
  assigned_user_email  TEXT        -- denormalized for display
  starts_at       TIMESTAMPTZ      -- activation date
  expires_at      TIMESTAMPTZ      -- expiration date
  is_active       BOOLEAN
  created_by      UUID
```

### 4c. Validation Rules (validate_discount_code RPC)

The RPC performs a 9-point validation chain:
1. Code exists (case-insensitive lookup)
2. Code is active (`is_active = true`)
3. Not expired (`expires_at > now()` or NULL)
4. Started (`starts_at <= now()` or NULL)
5. Not used up (`uses_count < max_uses` or max_uses is NULL)
6. User assignment check (if `assigned_user_id` set, must match)
7. Program restriction (if `valid_for_program_ids` set, program must be in array)
8. Tier restriction (if `valid_for_tier_names` set, tier must be in array)
9. Per-user limit (one use per user, via UNIQUE constraint on `discount_code_uses`)

### 4d. Discount Types

| Type | Example | How It Works |
|------|---------|-------------|
| **Percentage** | 10% off | `finalCost = originalCost - (originalCost * value / 100)` |
| **Fixed amount** | 500 credits off | `finalCost = max(0, originalCost - value)` |

### 4e. Use Cases

| Scenario | Configuration |
|----------|--------------|
| Early-bird discount | `discount_type: 'percent'`, `discount_value: 10`, `expires_at: launch_date` |
| Referral voucher | `discount_type: 'fixed_amount'`, `discount_value: 2000` (= EUR 1,000 off), `max_uses: 1` |
| VIP/returning client | `assigned_user_id: user_uuid`, `discount_type: 'percent'`, `discount_value: 15` |
| Program-specific promo | `valid_for_program_ids: [cta_id]`, `discount_type: 'percent'`, `discount_value: 20` |
| Partner referral discount | Use `partner_codes` system (separate from discount_codes) |

### 4f. Admin UI Features

The admin page at `/admin/discount-codes` provides:
- **Quick Referral Code Generator** — auto-generates REF-prefixed codes, single-use, configurable %
- **Full CRUD** — create/edit/delete codes with all fields
- **Program & tier restrictions** — multi-select checkboxes
- **User assignment** — restrict code to specific email
- **Date range** — start/expiry pickers
- **Status badges** — Active (green), Expired (red), Used Up (outline), Inactive (grey)
- **Usage tracking** — "X / Y" display, linked to `discount_code_uses` audit table
- **Copy to clipboard** — one-click copy for sharing

---

## 5. Payment Plan / Installment System

### 5a. Current State

**Database scaffolding exists, implementation does not.**

Existing columns on `client_enrollments`:
- `payment_type` TEXT — CHECK ('upfront' | 'payment_plan' | 'free'). Default: 'upfront'
- `payment_status` TEXT — CHECK ('paid' | 'outstanding' | 'overdue'). Default: 'paid'

Existing access control (fully built):
- `usePlanAccess` hook: `payment_plan + outstanding/overdue → isLocked=true, reason='payment_outstanding'`
- `has_program_plan_access()` DB function: mirrors the same logic server-side
- Content access denied when locked (serve-content-package, xapi-launch check access)

### 5b. What Needs to Be Built (Phase 3)

| Component | Description |
|-----------|------------|
| **`payment_schedules` table** | `enrollment_id`, `stripe_subscription_id`, `total_amount_cents`, `installment_count`, `installment_amount_cents`, `installments_paid`, `next_payment_date`, `status` (active/completed/defaulted) |
| **Per-program installment config** | Admin UI: allowed installment options per program (e.g., [1, 3, 6, 12]), whether upfront discount applies |
| **`create-installment-checkout` edge function** | Creates Stripe Subscription with `cancel_at`, grants full credits on first payment, creates payment_schedules record |
| **Webhook: `invoice.paid` for instalments** | Updates `installments_paid`, keeps `payment_status: 'paid'`. On final payment: marks complete |
| **Webhook: `invoice.payment_failed` for instalments** | Sets `payment_status: 'outstanding'` → access locked |
| **Webhook: subscription recovery** | On retry success: `payment_status: 'paid'` → access restored |
| **Webhook: subscription cancelled** | Sets `payment_status: 'overdue'` → stays locked, admin notified |
| **Client UI: payment plan selector** | In top-up flow: "Pay in full" / "3 instalments" / "6 instalments" / "12 instalments" |
| **Client UI: payment status banner** | On program detail: "Payment overdue" banner with Stripe portal link when locked |
| **Admin UI: installment tracking** | View active payment plans, status, next due date, manual override |

### 5c. Refund Handling

Stripe enforces that refunds cannot exceed the amount charged:

| Scenario | Amount Paid | Max Refund | Access After Refund |
|----------|-----------|------------|-------------------|
| Cancel after 1 of 3 instalments | EUR 2,833 | EUR 2,833 | Enrollment cancelled, credits reversed |
| Cancel after 2 of 3 | EUR 5,666 | EUR 5,666 | Same |
| Default (never pays 2nd) | EUR 2,833 | EUR 2,833 (if you choose) | Locked until paid or cancelled |
| Completed all instalments | EUR 8,500 | Up to EUR 8,500 | Normal refund policy |

---

## 6. Database Tables Reference

### Credit-Related Tables

| Table | Purpose |
|-------|---------|
| `plans` | Subscription plans with `credit_allowance` |
| `plan_prices` | Plan pricing with `stripe_price_id` per billing interval |
| `credit_topup_packages` | Individual top-up packages with `stripe_price_id` |
| `org_credit_packages` | Organization credit bundles with `stripe_price_id` |
| `credit_batches` | Individual credit batches with expiry, source type, feature key |
| `user_credit_purchases` | Purchase records with Stripe session IDs |
| `user_credit_transactions` | Full transaction audit trail |
| `org_credit_purchases` | Org purchase records |
| `org_credit_transactions` | Org transaction audit trail |
| `credit_services` | Central registry of services that cost credits |
| `program_tier_plans` | Per-program per-tier credit costs |

### Discount/Voucher Tables

| Table | Purpose |
|-------|---------|
| `discount_codes` | Discount code definitions (type, value, scope, limits) |
| `discount_code_uses` | Audit trail of discount redemptions |

### Payment/Enrollment Tables

| Table | Purpose |
|-------|---------|
| `client_enrollments` | Enrollments with `payment_type`, `payment_status`, discount fields |
| `payment_schedules` | **FUTURE** — installment tracking per enrollment |

### Stripe Integration Tables

| Table | Stripe Columns |
|-------|---------------|
| `plans` | `stripe_product_id` |
| `plan_prices` | `stripe_price_id` (indexed) |
| `credit_topup_packages` | `stripe_price_id` |
| `org_credit_packages` | `stripe_price_id` |
| `org_platform_tiers` | `stripe_annual_price_id`, `stripe_monthly_price_id` |
| `user_credit_purchases` | `stripe_checkout_session_id`, `stripe_payment_intent_id` |
| `org_credit_purchases` | `stripe_checkout_session_id`, `stripe_payment_intent_id` |

---

## 7. Edge Functions

| Function | Purpose | Payment Type |
|----------|---------|-------------|
| `create-checkout` | Individual subscription checkout | Subscription |
| `customer-portal` | Stripe Billing Portal | -- |
| `stripe-webhook` | Receives Stripe events, syncs DB | -- |
| `purchase-credit-topup` | Individual credit top-up checkout | One-time |
| `confirm-credit-topup` | Verify credit top-up on return | One-time |
| `org-purchase-credits` | Org credit bundle checkout | One-time |
| `org-confirm-credit-purchase` | Verify org credit on return | One-time |
| `org-platform-subscription` | Org subscription checkout | Subscription |
| `subscription-reminders` | Renewal reminder emails (cron) | -- |
| `create-installment-checkout` | **FUTURE** — installment subscription | Subscription (fixed-term) |

---

## 8. Frontend Components

| Component | Purpose | Credit Integration |
|-----------|---------|-------------------|
| `/credits` (`Credits.tsx`) | Credit balance, top-up purchase, transaction history | `useUserCredits` hook, `purchase-credit-topup` |
| `/subscription` (`Subscription.tsx`) | Plan selection, billing management | `create-checkout`, `customer-portal` |
| `/explore` (`ExplorePrograms.tsx`) | Browse programs, see credit costs, enrol | `useProgramEnrollment` |
| `ExpressInterestDialog.tsx` | Enrollment dialog with tier/discount/partner code | `useDiscountCode`, credit cost display |
| `ProgramPreviewDialog.tsx` | Program details modal | Shows credit cost per tier |
| `LowBalanceAlert.tsx` | Low/zero credit warning banner | `useCreditBatches`, configurable threshold |
| `/admin/org-billing` (`OrgBillingManagement.tsx`) | Admin: org credit packages + platform tiers | Direct CRUD on `org_credit_packages` |
| `/admin/discount-codes` (`DiscountCodesManagement.tsx`) | Admin: discount code CRUD + referral generator | Direct CRUD on `discount_codes` |
| `ProgramPlanConfig.tsx` | Admin: per-program per-tier credit cost config | Direct CRUD on `program_tier_plans` |

---

## 9. Implementation Phases

### Phase 1: Credit Recalibration (data migration)
- Recalibrate plan allowances to 2:1 ratio
- Replace 3 individual top-up packages with 6 (EUR 10 to EUR 8,500)
- Recalibrate org bundles to 2:1 base + volume bonuses
- Recalibrate credit service costs
- Update seed.sql for fresh environments
- Reset `stripe_price_id` on changed packages

### Phase 2: Top Up & Enrol UX
- Smart package recommendation when redirected from enrollment
- Contextual display of large packages
- One-click "Top Up & Enrol" resume flow
- Discount code input field in enrollment dialog
- Credit cost display on program cards and preview
- Add `/admin/org-billing` to admin sidebar

### Phase 3: Installment Plans (future)
- `payment_schedules` table
- `create-installment-checkout` edge function
- Webhook handlers for instalment lifecycle
- Client UI: payment plan selector, overdue banner
- Admin UI: installment tracking dashboard

### Phase 4: Documentation & Polish
- Update MEMORY.md, completed-work.md
- Update SUBSCRIPTIONS_AND_PLANS.md
- Add this document to MEMORY.md key docs table

---

## 10. Key Hooks Reference

| Hook | Purpose | File |
|------|---------|------|
| `useCreditBatches` | Credit summary, balance, consumption | `src/hooks/useCreditBatches.ts` |
| `useUserCredits` | Legacy wrapper over useCreditBatches + packages + transactions | `src/hooks/useUserCredits.ts` |
| `useProgramEnrollment` | Full enrollment flow with credits, discounts, partners | `src/hooks/useProgramEnrollment.ts` |
| `useDiscountCode` | Discount code validation + recording | `src/hooks/useDiscountCode.ts` |
| `usePlanAccess` | Program access check including payment plan locking | `src/hooks/usePlanAccess.ts` |
| `useEntitlements` | Feature access merging 5 sources (plan, program, add-on, track, org) | `src/hooks/useEntitlements.ts` |
| `useLowBalance` | Low balance detection with system threshold | `src/components/credits/LowBalanceAlert.tsx` |

---

## 11. Credit Expiry Policy (decided 2026-03-04)

### Policy Summary

| Credit Type | Expiry | Rollover | Rationale |
|-------------|--------|----------|-----------|
| **Plan credits** (monthly allowance) | Resets each billing period | No rollover | Creates natural scarcity; drives top-up purchases for larger actions. Industry standard (Canva, ChatGPT, etc.). |
| **Purchased credits** (individual top-ups) | 10 years from purchase | N/A (long-lived) | User paid real money — expiring paid credits erodes trust and discourages purchasing. 10-year expiry avoids permanent deferred revenue liability while being functionally permanent. |
| **Org credit bundles** | 10 years from purchase | N/A (long-lived) | Same reasoning as individual top-ups — paid credits should persist. |
| **Admin grants** | Configurable (default: 10 years) | N/A | Admin can set any expiry. Default matches purchased credits. |
| **Program credits** | Tied to enrollment duration | N/A | Expires when enrollment ends. |
| **Add-on credits** | Per add-on config | N/A | Depends on the add-on's validity period. |

### Rationale: Why Purchased Credits Should Not Effectively Expire

1. **Users paid real money.** Expiring something someone paid for on top of their subscription feels punitive and erodes trust. It's fundamentally different from a free monthly allowance that resets.

2. **Simpler mental model.** Plan credits = monthly reset. Purchased credits = yours effectively forever. No confusion about "will I use them in time?"

3. **Encourages purchasing.** Users are more likely to buy larger packages upfront (especially before program enrollment) when they know credits won't expire before they're ready to use them.

4. **FIFO protects the business.** Plan credits are consumed first (Priority 1 in `consume_credits_fifo`). Purchased credits only get touched after the free monthly allowance is exhausted. There's no risk of users hoarding free credits — only paid ones persist.

5. **Industry precedent.** Most platforms that sell credit packs (gaming, cloud computing) either don't expire them or give very long windows (2-5 years). 12 months is unusually aggressive for a coaching platform where programs can last 6-12 months.

### Rationale: Why Plan Credits Should NOT Roll Over

1. **Creates natural scarcity.** Monthly reset encourages users to use credits or lose them, driving engagement and preventing stockpiling that would reduce top-up revenue.

2. **Industry standard.** Most SaaS platforms reset monthly allowances without rollover. Users understand and expect this.

3. **FIFO already preserves purchased credits.** Since plan credits are consumed first, any purchased credits are naturally protected — the system already favours spending the "free" ones first.

4. **Simplifies accounting.** No need to track rollover amounts, caps, or cascading expiry chains.

### Technical: 10 Years Instead of Truly "Never"

We use `expires_at = NOW() + INTERVAL '10 years'` instead of `expires_at = NULL` because:

- The `consume_credits_fifo` function orders batches by `expires_at NULLS LAST`. NULL expiry would always be consumed last, even after batches expiring in 9 years. This is incorrect — FIFO should be by `created_at` for same-priority batches.
- `get_user_credit_summary_v2` uses `expires_at` to calculate `expiring_soon`. NULL values would need special handling.
- A 10-year horizon is functionally permanent for users while keeping the DB schema and queries clean.
- From an accounting perspective, a defined (if distant) expiry avoids creating a permanent deferred revenue liability.

### Implementation Status

- ⬜ **Migration needed:** Update `grant_credit_batch` RPC and all edge functions that grant credits to use 10-year expiry for `source_type = 'purchase'`. Currently hardcoded to 12 months.
- ⬜ **Retroactive fix:** Update existing `credit_batches` with `source_type = 'purchase'` to extend `expires_at` to 10 years from `granted_at`.
- ⬜ **Seed data:** Update `credit_topup_packages.validity_months` from 12 to 120.
- ✅ **No FIFO changes needed:** `consume_credits_fifo` orders by `expires_at NULLS LAST, created_at` — 10-year expiry works correctly with existing logic.
- ✅ **No plan credit changes needed:** Plan credits are virtual (calculated, not batched) and already reset each billing period.

### 2B.13 Credit Expiry Awareness (planned)

Even with long expiry on purchased credits, users benefit from awareness of their credit lifecycle:

| Component | What | Effort | Priority |
|-----------|------|--------|----------|
| **Dashboard expiry banner** | Banner showing credits expiring within 30 days (plan credits at billing reset, any expiring batches). Similar to `LowBalanceAlert`. | Low (1-2 days) | 🔴 High |
| **Email notification cron** | Scheduled notification 7 days before credits expire. Notification type `credits_expiring` already exists in seed data but no cron sends it. Add to `subscription-reminders` or new cron. | Low (1-2 days) | 🟠 High |
| **AI spend suggestions** | When credits are about to expire, suggest actions based on user context: "You have 45 credits expiring. Book a coaching session (200 cr), generate AI insights (2 cr each), or explore [program]." | Medium (1 week) | 🟡 Later (Phase 3 AI) |
