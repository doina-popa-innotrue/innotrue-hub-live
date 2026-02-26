# Entitlements & Feature Access System

> How the platform decides what each user can and cannot do.

## Overview

Every UI feature, AI tool, and consumable action in the platform is controlled by **feature keys** (e.g., `goals`, `community`, `decision_toolkit_advanced`, `ai_reflection`). A user's access to each feature is resolved at runtime by merging grants from up to **five independent sources**, then applying any explicit deny overrides.

```
                   +-----------------+
                   |  Feature Gate   |   <FeatureGate featureKey="goals">
                   |  (React UI)    |   <CapabilityGate capability="...">
                   +--------+--------+
                            |
                   +--------v--------+
                   | useCombined-    |   Checks access + tracks usage
                   | FeatureAccess   |
                   +--------+--------+
                            |
                   +--------v--------+
                   | useEntitlements |   Merges 5 sources, caches 5 min
                   +--------+--------+
                            |
          +-----------------+------------------+
          |        |         |        |        |
     Subscription  Program  Add-on  Track  Org-sponsored
       Plan         Plan                     Plan
```

## The Five Access Sources

Each source is fetched in parallel and produces a map of `featureKey -> { enabled, limit, source }`.

| # | Source | DB Path | Priority | Typical Use |
|---|--------|---------|----------|-------------|
| 1 | **Subscription Plan** | `profiles.plan_id` -> `plan_features` | 4th | Monthly subscription (Free, Premium, Enterprise) |
| 2 | **Program Plan** | `client_enrollments.program_plan_id` -> `program_plan_features` | 5th (lowest) | Features bundled with a specific program enrollment |
| 3 | **Add-on** | `user_add_ons` -> `add_on_features` | 1st (highest) | Purchased add-ons (e.g., extra AI credits pack) |
| 4 | **Track** | `user_tracks` -> `track_features` | 2nd | Learning tracks that unlock specific feature sets |
| 5 | **Org-sponsored Plan** | `organization_members.sponsored_plan_id` -> `plan_features` | 3rd | Organization pays for a plan on behalf of its members |

### Source Priority

When multiple sources grant the same feature, the system picks the **highest-priority source** as the display source:

```
add_on > track > org_sponsored > subscription > program_plan
```

### Limit Resolution

For consumable features (e.g., AI credits), the **highest limit wins**. A `null` limit means unlimited and always wins over any numeric limit.

```
User has: subscription limit=10, track limit=25, add-on limit=null
Result:   limit=null (unlimited), source="add_on"
```

## Deny Override (Restrictive Features)

An org-sponsored plan can **explicitly deny** a feature by marking it as `is_restrictive = true` in `plan_features`. This is the "org policy override" mechanism.

### How It Works

1. Admin marks a feature as "Deny" for a plan in **Features Management > Plan Configuration**
2. This sets `plan_features.is_restrictive = true` and `enabled = false`
3. When `useEntitlements` fetches org-sponsored features, it creates a deny entry: `{ enabled: false, limit: 0, source: "org_sponsored", isDenied: true }`
4. During merge, **deny always wins** — if ANY source has `isDenied: true`, the feature is blocked regardless of grants from other sources

### Example

```
Organization "Acme Corp" sponsors the "Enterprise" plan for its employees.
Acme wants to block the "community" feature (their employees use a different community).

Admin action:
  Features Management > Plan Configuration > Enterprise plan > Community feature > Check "Deny"

Result for Acme employees:
  - Even if they personally subscribe to Premium (which includes "community")
  - Even if they have an add-on that grants "community"
  - The feature is DENIED because org_sponsored has is_restrictive=true
  - UI shows: "Feature Not Available — Contact your administrator"
```

### DB Schema

```sql
-- plan_features table
ALTER TABLE public.plan_features
ADD COLUMN is_restrictive BOOLEAN NOT NULL DEFAULT false;

-- When is_restrictive = true:
--   The feature is explicitly DENIED for this plan
--   Overrides grants from ALL other sources
--   Primary use: org-sponsored plans blocking specific features
```

## Plan Tiers

Plans have a `tier_level` (integer, 0-4) that determines hierarchical access:

| Tier | Typical Plan | Description |
|------|-------------|-------------|
| 0 | Free / Essentials | Base tier, minimal features |
| 1 | Premium / Professional | Mid-tier with additional features |
| 2 | Enterprise | Full feature set |
| 3-4 | Reserved | Future expansion |

### Hybrid Plan Model

A user's **effective plan** = `MAX(personal_plan.tier_level, highest_org_sponsored_plan.tier_level)`

This means:
- If a user has Premium (tier 1) personally AND their org sponsors Enterprise (tier 2), they get Enterprise features
- If a user has Enterprise (tier 2) personally but their org sponsors Free (tier 0), they keep Enterprise
- The highest tier always wins for plan-level access

### Purchasable vs Non-Purchasable Plans

Plans have an `is_purchasable` flag:
- **Purchasable plans** appear in the subscription/pricing UI and can be self-selected by users
- **Non-purchasable plans** are admin-only (e.g., internal staff plans, special org plans)

The `isMaxPlanTier()` utility checks if a user is on the highest **purchasable** plan, used to adjust UI messaging.

## UI Components

### FeatureGate

Wraps content that requires a specific feature key. Shows upgrade prompts or admin contact messages when access is denied.

```tsx
<FeatureGate featureKey="goals" fallback={<GoalsFallback />}>
  {/* Content shown when user has "goals" feature */}
</FeatureGate>
```

**Behavior when blocked:**
- User on lower plan: "Premium Feature" + "Upgrade Plan" button
- User on max purchasable plan: "Feature Not Available" + "Contact your administrator"
- Custom fallback provided: renders the fallback component instead

### CapabilityGate

Same pattern as FeatureGate but for decision toolkit capabilities specifically.

```tsx
<CapabilityGate capability="weighted_criteria" hideWhenLocked={true}>
  {/* Content shown when user has this capability */}
</CapabilityGate>
```

### Using useEntitlements Directly

For programmatic access checks (not UI gating):

```tsx
const { hasFeature, getLimit, getAccessSource } = useEntitlements();

if (hasFeature("ai_reflection")) {
  const limit = getLimit("ai_reflection"); // null = unlimited
  const source = getAccessSource("ai_reflection"); // "subscription" | "add_on" | etc.
}
```

### Async Check (Non-Hook Context)

For server-side or non-component contexts:

```tsx
import { checkFeatureAccessAsync } from "@/hooks/useEntitlements";

const { hasAccess, limit, source } = await checkFeatureAccessAsync(userId, "goals");
```

## Admin Configuration

### Features Management Page

**Location:** Admin > Features Management > Plan Configuration tab

The plan configuration table shows a grid of features (rows) x plans (columns). Each cell has:

1. **Enable/Disable Switch** — grants or removes the feature for that plan
2. **Usage Limit Input** — for consumable features, sets the monthly limit (empty = unlimited)
3. **Deny Checkbox** (with Ban icon) — when checked, explicitly blocks the feature (overrides all grants)

When Deny is checked:
- The cell background turns red
- The enable switch is disabled (feature is force-disabled)
- The deny flag is stored as `is_restrictive = true` in `plan_features`

### Setting Up an Org-Sponsored Deny

1. Go to **Features Management > Plan Configuration**
2. Find the plan used by the organization (e.g., "Acme Enterprise")
3. For each feature to block, check the **Deny checkbox** (Ban icon)
4. The deny takes effect immediately for all users whose org sponsors that plan

## Caching

- `useEntitlements` caches results for **5 minutes** (`staleTime: 5 * 60 * 1000`)
- Garbage collection at **10 minutes** (`gcTime: 10 * 60 * 1000`)
- Cache key: `["user-entitlements", userId]`
- Call `refetch()` to force a refresh (e.g., after a plan change)

## Key Files

| File | Purpose |
|------|---------|
| `src/hooks/useEntitlements.ts` | Core entitlements engine — fetches 5 sources, merges, resolves deny |
| `src/hooks/useCombinedFeatureAccess.ts` | Wraps useEntitlements + usage tracking for consumable features |
| `src/hooks/usePlanAccess.ts` | Plan tier access — hybrid model, program/module/resource checks |
| `src/hooks/useIsMaxPlan.ts` | Detects if user is on highest purchasable plan (for UI messaging) |
| `src/hooks/useFeatureLossPreview.ts` | Compares current entitlements vs program plan to show which features will be lost on completion |
| `src/lib/planUtils.ts` | Pure utility functions for plan filtering and tier comparison |
| `src/components/FeatureGate.tsx` | UI gate component for feature-key-based access |
| `src/components/decisions/CapabilityGate.tsx` | UI gate for decision toolkit capabilities |
| `src/components/enrollment/CompletionFeatureWarning.tsx` | Pre-completion warning listing features that will be lost |
| `src/components/alumni/AlumniGraceBanner.tsx` | Grace period countdown for completed enrollments |
| `src/components/program/ProgramFeatureList.tsx` | "What's included" section showing program plan features |
| `src/components/features/FeatureSourceBadge.tsx` | Attribution badge showing feature source ("Via [Program Name]") |
| `src/pages/admin/FeaturesManagement.tsx` | Admin UI for configuring features per plan (includes `admin_notes` column) |

## Data Flow Summary

```
1. User logs in
2. useEntitlements fires (cached 5 min)
3. Five parallel fetches:
   a. profiles.plan_id -> plan_features (subscription)
   b. client_enrollments -> program_plan_features (program)
   c. user_add_ons -> add_on_features (add-ons)
   d. user_tracks -> track_features (tracks)
   e. organization_members.sponsored_plan_id -> plan_features (org, incl. is_restrictive)
4. Merge phase:
   a. For each feature key, collect all entitlements
   b. If ANY entitlement has isDenied=true -> feature is BLOCKED (deny wins)
   c. Otherwise, take highest limit (null=unlimited) and highest-priority source
5. Result cached in React Query
6. FeatureGate / CapabilityGate / hasFeature() read from cache
```

## Feature Visibility & Loss Communication (2B.11, 2B.12)

The entitlements system now communicates feature changes to users proactively:

### Feature Gain Visibility (2B.12)
When a user enrolls in a program, `ProgramFeatureList.tsx` shows a "What's included" section on the program detail page, listing features granted by the program plan. `FeatureSourceBadge.tsx` adds subtle attribution badges ("Via [Program Name]") to features that come from a program enrollment rather than the subscription.

### Feature Loss Communication (2B.11)
When a user is about to complete a program, `CompletionFeatureWarning.tsx` lists the features that will be lost upon completion. After completion, `AlumniGraceBanner.tsx` shows the grace period countdown (read-only content access for N days). The `useFeatureLossPreview` hook compares the user's current entitlements against their program plan features to identify exactly which features are at risk.

### Feature-Gated Pages (updated 2026-03-24)
The following client pages are now behind feature gates (configurable per plan):
- **My Feedback** (`my_feedback`)
- **My Resources** (`my_resources`)
- **Development Profile** (`development_profile`)

These join existing gated features like `goals`, `community`, `decision_toolkit_advanced`, `ai_reflection`, etc.

### Feature-Gated Actions (updated 2026-03-26)

Some UI actions are feature-gated without wrapping entire pages:
- **Promote to Task** (`decision_toolkit_basic`) — The "Promote to Task" button on action items (in `ActionItemsSection` on Tasks page and `DevelopmentItems` page) is only shown to users with `decision_toolkit_basic`. The action items section itself is free for all users. Pattern: `useEntitlements().hasFeature("decision_toolkit_basic")` inline check.
- **AI Reflection Prompt** (`ai_insights`) — Weekly reflection card gated behind `hasFeature("ai_insights")` with credit consumption via `useConsumableFeature`.

This inline gating pattern (vs wrapping in `<FeatureGate>`) is used when the surrounding content should be visible to all users but a specific action requires a premium feature.
