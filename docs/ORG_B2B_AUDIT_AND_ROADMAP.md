# Organisation B2B Audit & Roadmap

Full audit of organisation-related functionality for B2B selling.

Last updated: 2026-04-13

---

## Current State Summary

The B2B org system is **architecturally complete** with dual admin portals, credit/billing, member management, and feature gating. What follows is an inventory of what's built, what's partially done, and what's missing for enterprise sales.

---

## 1. What's Built

### Core Tables (13)

| Table | Purpose |
|-------|---------|
| `organizations` | Root entity (name, slug, industry, size, settings JSONB) |
| `organization_members` | User-to-org mapping, 3 roles, sponsored plan FK |
| `organization_invites` | Pending invitations (7-day token expiry) |
| `organization_programs` | Program licensing (max enrollments, expiry) |
| `organization_sharing_consent` | 7 granular data-sharing flags per member |
| `organization_terms` | Version-controlled custom T&Cs |
| `user_organization_terms_acceptance` | GDPR audit trail (IP, user-agent, content hash, 7yr retention) |
| `org_platform_tiers` | Subscription offerings (Essentials €3K/yr, Professional €5K/yr) |
| `org_platform_subscriptions` | Org's active Stripe subscription |
| `org_credit_balances` | Organisation credit ledger |
| `org_credit_purchases` | Credit purchase history (Stripe) |
| `org_credit_transactions` | Debit/credit audit trail |
| `org_credit_packages` | 8 purchasable bundles (5%–40% volume bonus) |

### Security Model

| Mechanism | Status |
|-----------|--------|
| RLS on all org tables | Done |
| `has_org_role()` SECURITY DEFINER | Done (avoids RLS self-recursion) |
| `is_org_admin_or_manager()` | Done |
| `get_user_organization_id()` | Done |
| `is_same_organization()` | Done |
| One-user-per-org constraint | Done (`UNIQUE(user_id)`) |
| Last-admin-removal protection | Done |

### Edge Functions (6)

| Function | Purpose |
|----------|---------|
| `send-org-invite` | Email invitation with template system, timing attack mitigation |
| `accept-org-invite` | Join org, initialise sharing consent (all flags FALSE) |
| `org-purchase-credits` | Stripe checkout for credit packages |
| `org-confirm-credit-purchase` | Verify Stripe payment, grant credits via `grant_credit_batch` |
| `org-platform-subscription` | Stripe subscription for platform tiers |
| `check-org-seat-limits` | Cron: alerts at 80% and 100% seat usage |

### Frontend Pages (17)

**Org Admin Portal** (`/org-admin/*`, 9 pages):

| Page | Route | Features |
|------|-------|----------|
| Dashboard | `/org-admin` | Stats (members, programs, enrollments, growth), credit balance, quick actions |
| Members | `/org-admin/members` | Active tab (role mgmt, sponsored plan assignment) + Invites tab |
| Programs | `/org-admin/programs` | Licensed programs, enrollment caps, credit costs |
| Enrollments | `/org-admin/enrollments` | Multi-filter (search, status, program), status actions (pause/resume/complete/cancel) |
| Billing | `/org-admin/billing` | Credit balance, purchase packages, subscribe to tier, transaction history |
| Analytics | `/org-admin/analytics` | Usage analytics (if tier includes) |
| Terms | `/org-admin/terms` | Custom org terms acceptance |
| Settings | `/org-admin/settings` | Org details, notification toggles, permission toggles |
| FAQ | `/org-admin/faq` | Help content |

**Platform Admin** (`/admin/*`, 4 pages):

| Page | Route | Features |
|------|-------|----------|
| Organisations | `/admin/organizations` | CRUD, search, stats (total/active/members) |
| Org Detail | `/admin/organizations/:id` | Members tab, Licensed Programs tab, Details tab |
| Program Licensing | `/admin/organization-programs` | Add/remove program access, capacity limits, expiry |
| Billing Config | `/admin/org-billing-management` | Credit packages CRUD, Platform tiers CRUD |

### Feature Access Model

```
Priority order (highest to lowest):
1. add_on
2. track
3. org_sponsored  ← org context
4. subscription
5. program_plan

Effective plan = MAX(personal_plan.tier_level, org_sponsored_plan.tier_level)
Restrictive features (is_restrictive = true) → deny override regardless of other sources
```

### Key Architecture Decisions

- **No `org_id` on core tables** — program access via `organization_programs` junction, not direct FK
- **Dual credit systems** — separate user + org credit pools with FIFO expiry
- **Dual layout system** — `DashboardLayout` (main app) + `OrgAdminLayout` (org portal)
- **JSONB settings** — `organizations.settings` for flexible extension (`allowMemberInvites`, notification flags)
- **Conservative consent** — sharing defaults to all-FALSE on join; user opts in

---

## 2. Partially Built / Needs Attention

### A. Org Analytics Dashboard
- **Status:** Page exists (`/org-admin/analytics`) but content is basic
- **Gap:** No ROI metrics (completion rates, skills gaps closed, engagement, credits consumed vs purchased)
- **Impact:** Org admins can't justify spend to leadership — critical for B2B retention/expansion
- **Priority:** High

### B. Bulk Enrollment
- **Status:** `BulkEnrollmentDialog.tsx` exists for platform admin
- **Gap:** No org-admin self-service bulk enrollment (admin only)
- **Priority:** Medium

### C. Per-Seat Pricing
- **Status:** Credits system works for enrollment costs
- **Gap:** No volume-tiered seat pricing for org self-serve (separate from credits)
- **Priority:** Medium (depends on sales model)

---

## 3. Not Yet Built — B2B Selling Gaps

### High Priority (Blocks Enterprise Sales)

| # | Feature | Description | Effort |
|---|---------|-------------|--------|
| 1 | **Org Analytics & ROI Dashboard** | Aggregate dashboard: programs completed, skills gaps closed, session utilisation, credits consumed vs purchased, engagement scores. Required for org admins to justify spend. | Large |
| 2 | **Bulk Invite (CSV)** | Upload CSV of emails to invite multiple members at once. Currently one-by-one only. | Small |
| 3 | **SSO / SAML** | Enterprise buyers expect this. Currently password + Google OAuth only. Supabase supports SAML via Auth config. | Large |
| 4 | **Audit Logging** | Action history for org changes (who invited whom, plan changes, enrollment actions, billing events). Required for compliance in enterprise. | Medium |

### Medium Priority (Improves B2B Competitiveness)

| # | Feature | Description | Effort |
|---|---------|-------------|--------|
| 5 | **Org Branding** | Logo upload, colour scheme, custom domain/subdomain. White-label potential. | Medium |
| 6 | **Export / Reporting** | CSV/PDF export from analytics, member lists, enrollment reports. | Small |
| 7 | **Org Hierarchy** | Sub-orgs, departments, or teams within an org. Currently flat structure only. | Large |
| 8 | **API Keys / Webhooks** | Programmatic integration for enterprise IT teams (member sync, enrollment events). | Medium |
| 9 | **Org Platform Tier Self-Service Upgrade** | Currently managed via Stripe Billing Portal only. Add in-app upgrade/downgrade flow. | Small |
| 10 | **Bulk Plan Assignment** | Assign sponsored plan to all/filtered members at once (not one by one). | Small |

### Low Priority (Future / Nice-to-Have)

| # | Feature | Description | Effort |
|---|---------|-------------|--------|
| 11 | **IP Whitelisting** | Org-level access restrictions by IP range. | Small |
| 12 | **Win-Back Flows** | Re-engagement campaigns for inactive org members (cron + ActiveCampaign). | Medium |
| 13 | **Org Dashboard for Members** | Member-facing org page showing their team, shared progress (based on consent). | Medium |
| 14 | **Multi-Org Support** | Allow users to belong to multiple orgs (currently `UNIQUE(user_id)` constraint). | Large |
| 15 | **Custom Roles** | Beyond the 3 fixed roles — allow orgs to define custom permission sets. | Large |

---

## 4. Known Issues / Technical Debt

| Issue | Description | Severity |
|-------|-------------|----------|
| **Stripe customer reuse risk** | `org-purchase-credits` searches by billing email. Multiple orgs with same billing contact could share a Stripe customer ID. | Low |
| **Email template seeding** | `send-org-invite` supports custom templates from DB with fallback. Verify `email_templates.org_invite` row exists in migrations (not just seed). | Low |
| **No test coverage** | Org edge functions have no automated tests. | Medium |
| **`profiles.organisation` legacy field** | String column (not FK) — legacy from before the org system. Could confuse developers. | Low |
| **RLS cross-org data leakage** | Orgs share a single database. Periodic RLS audit recommended — especially for new tables. | Medium |
| **Org settings validation** | `organizations.settings` is free-form JSONB. No schema validation on write. | Low |

---

## 5. Database Schema Reference

### Helper Functions (SECURITY DEFINER)

```sql
has_org_role(_user_id UUID, _org_id UUID, _role TEXT) → BOOLEAN
is_org_admin_or_manager(_user_id UUID, _org_id UUID) → BOOLEAN
get_user_organization_id(_user_id UUID) → UUID
is_same_organization(_user_id_1 UUID, _user_id_2 UUID) → BOOLEAN
```

### Credit Functions

```sql
get_org_credit_summary_v2(p_org_id UUID) → JSONB
consume_credits_fifo(p_owner_type TEXT, p_owner_id UUID, p_amount INT, ...) → JSONB
grant_credit_batch(...) → UUID
```

### Seat Limit RPCs

```sql
get_org_sponsored_seat_count(p_org_id UUID) → INTEGER
get_org_max_sponsored_seats(p_org_id UUID) → INTEGER
can_assign_sponsored_seat(p_org_id UUID) → BOOLEAN
```

### Org Role Enum

```
org_admin    — Full control (members, billing, settings, terms, programs)
org_manager  — Member mgmt + enrollments (if allowMemberInvites enabled)
org_member   — View-only access to programs/analytics
```

---

## 6. Suggested Implementation Order

### Phase 1 — Quick Wins (enable sales demos)
1. Bulk Invite (CSV upload) — Small effort, high demo impact
2. Bulk Plan Assignment — Small effort, reduces onboarding friction
3. Export / Reporting (CSV) — Small effort, expected by enterprise buyers
4. Org Platform Tier Self-Service Upgrade — Small effort

### Phase 2 — Analytics (prove ROI)
5. Org Analytics & ROI Dashboard — Large but critical for retention
6. Audit Logging — Medium, builds trust with compliance-conscious buyers

### Phase 3 — Enterprise Features (close large deals)
7. SSO / SAML — Large, often a hard requirement for 100+ seat deals
8. Org Branding — Medium, enables white-label reselling

### Phase 4 — Scale
9. API Keys / Webhooks — Medium, for IT integration
10. Org Hierarchy — Large, for large enterprises with departments

---

## Related Documentation

- [ENTERPRISE_PLATFORM_CONFIGURATION.md](./ENTERPRISE_PLATFORM_CONFIGURATION.md) — Tier config, sponsorship model, setup checklist
- [SUBSCRIPTIONS_AND_PLANS.md](./SUBSCRIPTIONS_AND_PLANS.md) — Individual plans, billing tables, Stripe webhooks
- [CREDIT_ECONOMY_AND_PAYMENTS.md](./CREDIT_ECONOMY_AND_PAYMENTS.md) — Credit system details
- [ENTITLEMENTS_AND_FEATURE_ACCESS.md](./ENTITLEMENTS_AND_FEATURE_ACCESS.md) — Feature gating logic
- [MEMORY.md](../MEMORY.md) — Overall architecture and roadmap
