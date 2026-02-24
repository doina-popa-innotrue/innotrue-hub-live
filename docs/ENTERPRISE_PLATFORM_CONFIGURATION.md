# Enterprise Platform Configuration

How organizations subscribe to the platform, sponsor member plans, and manage team access.

Last updated: 2026-03-24

---

## Architecture Overview

InnoTrue does not have an explicit "enterprise plan" for individual users. Instead, the enterprise model is an **organization sponsorship layer** on top of the standard plan hierarchy.

```
┌─────────────────────────────────────────────────────────┐
│  Organization                                           │
│                                                         │
│  org_platform_tiers (billing)                           │
│  ├── Essentials: €3,000/yr  (€300/mo)                  │
│  └── Professional: €5,000/yr  (€500/mo)                │
│                                                         │
│  organization_members                                   │
│  ├── Member A  → sponsored_plan_id → Pro plan           │
│  ├── Member B  → sponsored_plan_id → Advanced plan      │
│  └── Member C  → sponsored_plan_id → NULL (own plan)    │
│                                                         │
│  Effective plan per member = MAX(personal, org-sponsored)│
└─────────────────────────────────────────────────────────┘
```

**Key principle:** An organization subscribes to a platform tier (which determines billing, seat limits, and org-level features), then assigns individual subscription plans to its members. Members get the *higher* of their personal plan and their org-sponsored plan.

---

## Plans Hierarchy (Individual)

| Plan Key | Name | Tier Level | Credit Allowance | Purchasable | Notes |
|----------|------|-----------|-----------------|-------------|-------|
| `free` | Free | 0 | 40/month | No | Default for all new users |
| `base` | Base | 1 | 100/month | Yes | €19/month |
| `pro` | Pro | 2 | 200/month | Yes | €29/month |
| `advanced` | Advanced | 3 | 360/month | Yes | €49/month |
| `elite` | Elite | 4 | 500/month | Yes | €99/month |
| `programs` | Programs | 0 | — | No | Assigned via program enrollment |

**Non-purchasable plans** (`is_purchasable = false`) are not shown on the Subscription page for regular users. They only appear if the user is currently on that plan.

---

## Organization Platform Tiers

Organizations subscribe to a platform tier that determines their billing, seat limits, and org-level capabilities.

### Current Tiers

| Tier | Annual Fee | Monthly Fee | Max Sponsored Seats | Analytics |
|------|-----------|-------------|-------------------|-----------|
| Essentials | €3,000/yr | €300/mo | Configurable | Yes |
| Professional | €5,000/yr | €500/mo | Configurable | Yes |

### Database: `org_platform_tiers`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `name` | text | Display name (e.g., "Essentials") |
| `slug` | text | URL-safe identifier (unique) |
| `annual_fee_cents` | integer | Annual subscription cost in cents |
| `monthly_fee_cents` | integer | Monthly subscription cost in cents |
| `currency` | text | Default `'eur'` |
| `stripe_annual_price_id` | text | Stripe price ID for annual billing |
| `stripe_monthly_price_id` | text | Stripe price ID for monthly billing |
| `features` | jsonb | Org-level feature flags (array) |
| `max_members` | integer | Max total members (NULL = unlimited) |
| `max_sponsored_seats` | integer | Max members with sponsored plans |
| `includes_analytics` | boolean | Whether tier includes analytics dashboard |
| `display_order` | integer | Sort order for display |
| `is_active` | boolean | Whether tier is available for purchase |

### Database: `org_platform_subscriptions`

Tracks the organization's active platform tier subscription (linked to Stripe).

---

## Member Plan Sponsorship

### How It Works

1. Organization subscribes to a platform tier (e.g., Professional)
2. Platform tier includes a seat limit (`max_sponsored_seats`)
3. Org admin assigns individual plans to members via `organization_members.sponsored_plan_id`
4. Each member's effective plan = `MAX(personal_plan.tier_level, org_sponsored_plan.tier_level)`

### Database: `organization_members`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `user_id` | UUID | → `auth.users` |
| `organization_id` | UUID | → `organizations` |
| `role` | enum | `org_admin`, `org_manager`, `org_member` |
| `sponsored_plan_id` | UUID (nullable) | → `plans` — the plan this org sponsors for this member |
| `is_active` | boolean | Membership status |
| `department` | text | Optional department |
| `title` | text | Optional job title |
| `invited_at` / `invited_by` / `joined_at` | timestamps | Invitation tracking |

### Effective Plan Computation

**Code:** `src/hooks/usePlanAccess.ts`

```
Personal plan:  profiles.plan_id → plans (tier_level)
Org sponsored:  organization_members.sponsored_plan_id → plans (tier_level)
                (highest tier across ALL active org memberships)

Effective = MAX(personal.tier_level, org_sponsored.tier_level)
```

If a user is a member of multiple organizations, the highest sponsored plan across all orgs is used.

### Seat Limit Enforcement

| RPC | Purpose |
|-----|---------|
| `get_org_sponsored_seat_count` | Count of members with non-null `sponsored_plan_id` |
| `get_org_max_sponsored_seats` | Max seats from the org's platform tier |
| `can_assign_sponsored_seat` | Boolean: is there room for another sponsored member? |

Alerts are sent at 80% and 100% seat usage thresholds via `org_seat_limit_warning` and `org_seat_limit_reached` notification types.

---

## Org Admin Workflow

### Assigning Sponsored Plans

1. Navigate to **Organization → Members** (`/org-admin/members`)
2. Each member row has a "Sponsored Plan" dropdown
3. Select a plan (Free, Base, Pro, Advanced, Elite)
4. The member immediately gets the benefits of that plan (or their personal plan, whichever is higher)

**Permissions:**
- Only `org_admin` can assign/change sponsored plans
- `org_manager` can invite members (if org setting allows) but cannot assign plans
- `org_member` has no management capabilities

### Inviting Members

1. Org admin or manager clicks "Invite Member" on the Members page
2. Enters email address and selects role
3. System sends invitation email
4. User accepts invitation and joins the organization
5. Org admin can then assign a sponsored plan

---

## Feature Access Sources

The entitlements system (`src/hooks/useEntitlements.ts`) resolves features from 5 sources in priority order:

| Priority | Source | Description |
|----------|--------|-------------|
| 1 (highest) | `add_on` | Purchased add-ons |
| 2 | `track` | Track-based features |
| 3 | `org_sponsored` | Org-sponsored plan features |
| 4 | `subscription` | Personal subscription plan |
| 5 (lowest) | `program_plan` | Program enrollment features |

### Restrictive (Deny) Features

Org-sponsored plans can include **restrictive features** (`plan_features.is_restrictive = true`). These explicitly deny access to a feature, overriding ALL other sources. This allows organizations to restrict certain features for their members (e.g., blocking external integrations).

---

## Org Credit System

Organizations have their own credit system, separate from individual user credits:

| Table | Purpose |
|-------|---------|
| `org_credit_balances` | Organization's current credit balance |
| `org_credit_purchases` | Credit purchase history (Stripe integration) |
| `org_credit_transactions` | All credit movements (purchase, consumption, refund) |
| `org_credit_packages` | Available credit packages for purchase |

**Credit packages** for organizations follow the same expiry policy as individual purchased credits (configurable via `system_settings.purchased_credit_expiry_months`, default 10 years).

---

## Configuration Checklist

### Setting Up a New Organization

1. **Create organization** in admin panel (`/admin/organizations`)
2. **Assign platform tier** — select from available `org_platform_tiers`
3. **Configure Stripe** — ensure the tier's `stripe_annual_price_id` or `stripe_monthly_price_id` is set
4. **Set seat limits** — configure `max_sponsored_seats` for the tier
5. **Invite members** — org admin invites team members
6. **Assign plans** — org admin assigns sponsored plans to members

### Modifying Platform Tiers

Platform tiers are seeded in `supabase/seed.sql` and can be modified via:
- **Database:** Update `org_platform_tiers` rows directly
- **Admin UI:** Not yet available (planned for Phase 3)
- **Stripe:** Update corresponding price IDs when changing pricing

### Adding a New Tier

1. Insert into `org_platform_tiers` with appropriate pricing and limits
2. Create corresponding Stripe price objects
3. Update `stripe_annual_price_id` / `stripe_monthly_price_id`
4. Update `seed.sql` to include the new tier (for `supabase db reset`)

---

## Related Documentation

- [MEMORY.md](../MEMORY.md) — Overall architecture and roadmap
- [ENVIRONMENT_CONFIGURATION.md](./ENVIRONMENT_CONFIGURATION.md) — Environment-specific secrets (Stripe keys, etc.)
- [DATA_CONFIGURATION_GUIDE.md](./DATA_CONFIGURATION_GUIDE.md) — Seed data and configuration tables
