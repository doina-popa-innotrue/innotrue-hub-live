# Completed Work — Detailed History

## UX Improvements: Groups Scroll, Program Draft Status, Timezone Codes (2026-02-27)

Three UX improvements across admin and client-facing pages. 1 migration, 7 modified files. `npm run verify` passed.

### Group Creation Dialog Scroll Fix
- **Problem:** On smaller screens the 13+ field form overflowed the viewport, making the Create Group button unreachable.
- **Fix:** Wrapped form fields in `max-h-[60vh] overflow-y-auto pr-1` container inside the `<form>`, keeping `DialogFooter` (Cancel/Create) always visible below the scroll area.
- **File:** `src/pages/admin/GroupsManagement.tsx`

### Program Draft/Published Status
- **Problem:** `is_active` conflated "not archived" with "visible to clients." Programs being built had no way to be hidden from Explore Programs without archiving.
- **Solution:** New `is_published` boolean column (default `false`). Decouples admin lifecycle (`is_active`) from client visibility (`is_published`).
- **Migration:** `20260227100000_add_programs_is_published.sql` — adds column, backfills active → published, partial index.
- **States:** `is_active=true, is_published=false` → Draft | `is_active=true, is_published=true` → Published | `is_active=false` → Archived
- **Files modified:**
  - `src/pages/admin/ProgramsList.tsx` — Status column (Published/Draft badge), Eye/EyeOff toggle, `toggleProgramPublished()` function
  - `src/pages/admin/ProgramDetail.tsx` — Published/Draft badge next to name, Publish/Unpublish button, `togglePublished()` function
  - `src/pages/client/ExplorePrograms.tsx` — `.eq("is_published", true)` filter
  - `src/pages/org-admin/OrgPrograms.tsx` — `is_published` in SELECT + filter

### Timezone Abbreviation Codes
- **Problem:** Timezone selectors and session cards showed city names but no timezone code (EST, CET, IST, etc.).
- **Solution:** New `getTimezoneAbbreviation(iana)` utility using `Intl.DateTimeFormat` with `timeZoneName: "short"`. DST-aware (shows EDT in summer, EST in winter).
- **Files modified:**
  - `src/components/profile/TimezoneSelect.tsx` — Labels now show `(EST)`, `(CET)`, etc. Exports `getTimezoneAbbreviation()`.
  - `src/components/cohort/CohortSessionCard.tsx` — Shows timezone code after time (e.g. "14:30 – 16:00 CET")
  - `src/components/groups/sessions/GroupSessionCard.tsx` — Shows timezone code after time
  - `src/pages/client/GroupSessionDetail.tsx` — Shows timezone code in date/time display

## Action Items ↔ Timeline & Tasks Integration (2026-03-26)

Bridged the gap between Development Items action items and the rest of the platform. Action items now surface in the Development Timeline, the Timeline Progress chart, and a new free section on the Tasks page. Users can promote action items to full Eisenhower Matrix tasks (feature-gated). 3 new files, 4 modified. No migrations needed. `npm run verify` passed. Deployed to all 3 environments + Lovable. Commit `d7cc154`.

### New Files

| File | Purpose |
|------|---------|
| `src/hooks/useActionItems.ts` | Shared TanStack Query hook for action items. Queries `development_items` where `item_type = 'action_item'` with task_links JOIN. Exports `useActionItems(options?)` with optional status filter and `useToggleActionItemStatus()` mutation. Query key: `["action-items", user?.id, statusFilter]`. |
| `src/components/capabilities/PromoteToTaskDialog.tsx` | Compact dialog for promoting action items to Eisenhower Matrix tasks. Pre-filled title, importance/urgency Switch toggles, due date. Auto-sets urgency if due within 7 days. Creates task with status `"todo"` + junction link in `development_item_task_links`. Invalidates `["tasks"]`, `["action-items"]`, `["development-items"]` query caches. |
| `src/components/tasks/ActionItemsSection.tsx` | Collapsible section showing all action items with status toggle, due dates, linked task badges, promote button. Uses `useActionItems` hook. Feature-gates promote button via `useEntitlements().hasFeature("decision_toolkit_basic")`. Returns null if no action items. "View All" navigates to `/development-items`. |

### Modified Files

| File | Change |
|------|--------|
| `src/pages/client/DevelopmentTimeline.tsx` | Extended `TimelineItem.type` union to include `"action_item"`. Added `ActionItemRaw` interface, `actionItems` state, `showActionItems` filter, action items fetch in `fetchData()`, ListTodo icon + violet accent color, filter checkbox, click handler navigating to `/development-items`. Category set to `null` — hidden when specific category filter selected. |
| `src/components/timeline/TimelineProgressSection.tsx` | Extended `CompletedItem.type` to include `"action_item"`. Added completed action items query, `actionItems` field in WeekData, violet stat card (4-column grid), actionItems bar segment in stacked chart (top position), legend entry. |
| `src/pages/client/DevelopmentItems.tsx` | Added `PromoteToTaskDialog` import, `useEntitlements` check, `promotingItem` state. "Promote to Task" button (ArrowUpRight icon, violet, ghost) shown only for action items without existing task_links and when user has `decision_toolkit_basic` feature. |
| `src/pages/client/Tasks.tsx` | Wrapped return in fragment. Added `<ActionItemsSection />` OUTSIDE and BELOW the `<FeatureGate>` wrapper — visible to ALL users (free), promote button feature-gated inside. |

### Design Decisions

- **No migrations needed:** All tables existed (`development_items`, `tasks`, `development_item_task_links`)
- **Free/premium boundary:** Action items section on Tasks page is free; only the "Promote to Task" button requires `decision_toolkit_basic`
- **Duplicate promotion prevention:** Promote button hidden when `task_links.length > 0`, shows linked task badge instead
- **Independent status:** Promoting to task does NOT change the action item's status — they track independently
- **Category filter edge case:** Action items have no wheel category; hidden when specific category is selected in Timeline
- **Title fallback:** Uses first 60 chars of `content` with "…" when `title` is null
- **Task status:** Uses `"todo"` (not `"active"`) per actual DB enum `task_status`

## Bug Fixes — Reflection Resources + xAPI Library Content (2026-03-26)

Two client-facing bugs fixed, 5 files changed. `npm run verify` passed. Deployed to all 3 environments + Lovable.

### 1. Reflection Resource Refresh

**Problem:** Adding a resource to a reflection on a module page didn't show it in the "Attachments" section until a full page refresh.

**Root cause:** `ReflectionResourceForm.onSuccess` only closed the form (`setAddingResourceTo(null)`) but never triggered a refetch in the sibling `ReflectionResources` component, which managed its own state independently.

**Fix:** Added `refreshKey` prop to `ReflectionResources` (included in `useEffect` deps). `ModuleReflections` tracks a `resourceRefreshKey` counter that bumps on successful resource add.

| File | Change |
|------|--------|
| `src/components/modules/ReflectionResources.tsx` | Added `refreshKey` prop to interface + `useEffect` dependency |
| `src/components/modules/ModuleReflections.tsx` | Added `resourceRefreshKey` state, bumps on `onSuccess`, passes to `ReflectionResources` |

### 2. xAPI Library Content "File not found: index.html"

**Problem:** xAPI content assigned to a module from the shared content library failed with `"File not found: index.html"`, but the same ZIP uploaded directly to the module worked fine.

**Root cause:** Both client and instructor `ModuleDetail` pages determined content type via `module.content_package_type` (from `program_modules` table). For shared library content, this field is `null` — the package type lives on `content_packages.package_type`. So it always defaulted to `"web"` mode, requesting `index.html` at root instead of `scormcontent/index.html` (xAPI entry point).

**Fix:** Added `content_packages(package_type)` JOIN to module queries. Type resolution now checks library package type first, falls back to legacy column. Also fixed instructor page not showing shared library content at all (condition only checked `content_package_path`, not `content_package_id`).

| File | Change |
|------|--------|
| `src/pages/client/ModuleDetail.tsx` | Added `content_packages(package_type)` JOIN, updated interface, fixed type resolution |
| `src/pages/instructor/ModuleDetail.tsx` | Same JOIN + interface + type resolution, also fixed display condition to include `content_package_id` |

**Note:** Edge functions (`serve-content-package`, `xapi-launch`) already had the correct JOIN + fallback logic — the bug was purely frontend.

## SC-3/SC-5/SC-6/SC-7 Performance & Scalability (2026-03-26)

Completed 4 scalability items from the audit: server-side pagination, retention policies, RLS indexes, and search indexes. 4 migrations, 8 frontend files modified. `npm run verify` passed.

### Migrations

1. **`20260326100000_sc7_search_trigram_indexes.sql`** — Enables `pg_trgm` extension + 4 GIN trigram indexes on `profiles(name)`, `notifications(title)`, `notifications(message)`, `organizations(name)` for `ilike '%term%'` search optimization.

2. **`20260326110000_sc6_rls_performance_indexes.sql`** — 11 composite indexes supporting hot RLS functions (`is_session_instructor_or_coach`, `user_has_feature`, module_assignments policies).

3. **`20260326120000_sc5_retention_cleanup_policies.sql`** — Automated cleanup: schedules existing `cleanup-notifications` edge function (4 AM UTC), creates `cleanup_old_analytics_events()` (180d, 4:30 AM), creates `cleanup_old_coach_access_logs()` (90d, 4:15 AM). Configurable via `system_settings`. Skipped: `admin_audit_logs` (compliance), `credit_consumption_log` (bounded).

4. **`20260326130000_sc3_server_aggregation_rpcs.sql`** — 3 RPCs: `get_feature_usage_summary()` (replaces client-side Map aggregation), `get_credit_transaction_summary()` (replaces client-side reduce), `get_analytics_cleanup_preview()` (replaces 4 separate queries).

### Frontend Changes (SC-3)

| File | Changes |
|------|---------|
| `NotificationsManagement.tsx` | Server-side pagination (count + range), server-side category filter via type ID resolution, separate stats query, Pagination UI |
| `EmailQueueManagement.tsx` | Server-side pagination (count + range), useMemo for filtered items, Pagination UI |
| `ConsumptionAnalytics.tsx` | Features tab: `get_feature_usage_summary` RPC. Credit summary: `get_credit_transaction_summary` RPC |
| `DataCleanupManager.tsx` | Single `get_analytics_cleanup_preview` RPC replacing 4 queries |
| `CapabilityAssessmentDetail.tsx` | Server-side snapshot pagination (count + range), scoped bulk select, Pagination UI |
| `Assignments.tsx` (client) | Migrated from useEffect to React Query, client-side pagination with useMemo, parallel queries |
| `Calendar.tsx` (client) | Migrated from useEffect to React Query, ±3 month date bounding, parallel queries with Promise.all, month-based queryKey |
| `PendingAssignments.tsx` (instructor) | Migrated from useEffect to React Query (3 hooks: module IDs, pending, scored), scored time filter moved server-side (.gte), pagination on both tabs |

## 2B.10 Enrollment Duration & Deadline Enforcement (2026-03-25)

Time-bounded enrollment system. Admins can set a default duration per program; new enrollments get automatic deadlines with warnings and enforcement. 1 migration, 1 new edge function, 1 new component, 5 modified files. `npm run verify` passed. Deployed to all environments.

### Migration: `20260325200000_enrollment_duration.sql`

**New column:**
- `programs.default_duration_days` INTEGER (nullable — NULL = self-paced, no deadline)

**Updated `enroll_with_credits` RPC:**
- Same 13-param signature (no breaking change)
- New Step 0e: `v_start_date := now()`, looks up `programs.default_duration_days`, calculates `v_end_date := v_start_date + (duration || ' days')::interval` when non-null
- `start_date` and `end_date` added to INSERT columns/values

**Backfill:**
- All existing enrollments get `start_date = COALESCE(created_at, now())` where NULL
- Existing enrollments do NOT get `end_date` (stay self-paced)

**Touchpoints table:** `enrollment_deadline_touchpoints` (enrollment_id, touchpoint_type, sent_at, UNIQUE constraint). Types: `deadline_warning_30d`, `deadline_warning_7d`, `deadline_expired`. RLS: admins manage all, users read own.

**Notification types (3):** `enrollment_deadline_30d`, `enrollment_deadline_7d`, `enrollment_deadline_expired` in `programs` category.

**Performance index:** Partial index on `client_enrollments(end_date) WHERE status = 'active' AND end_date IS NOT NULL`.

**Cron:** `daily-enforce-enrollment-deadlines` at `0 5 * * *` (5 AM UTC) calling `enforce-enrollment-deadlines` edge function.

### New Edge Function: `supabase/functions/enforce-enrollment-deadlines/index.ts`

Daily cron with 3 phases:
1. **30-day warnings** — active enrollments with `end_date` ~30 days from now → email + in-app notification + touchpoint record
2. **7-day warnings** — active enrollments with `end_date` ~7 days from now → same
3. **Expiry enforcement** — active enrollments where `end_date < now()` → transitions to `completed` (triggers `trg_set_enrollment_completed_at` + `trg_auto_create_badge_on_completion` + alumni lifecycle cron) → expiry notification + touchpoint record

Follows `alumni-lifecycle/index.ts` pattern: touchpoint dedup, email via `send-notification-email`, in-app via `create_notification` RPC.

### New Component: `src/components/enrollment/EnrollmentDeadlineBanner.tsx`

Pure component (no RPC call — reads `endDate` prop directly from enrollment row):
- Hidden when 30+ days remaining or expired
- Amber Alert with Clock icon when 8-30 days remaining
- Red/destructive Alert with ShieldAlert icon when 1-7 days remaining
- Pattern follows `AlumniGraceBanner.tsx`

### Modified: `src/components/admin/ProgramPlanConfig.tsx`

New "Enrollment Duration" Card (between Premium Program and Repeat Enrollment):
- Switch: "Enable Enrollment Deadline" (toggles `durationEnabled` state)
- When enabled: number input for days (min 1, max 1095, placeholder "e.g. 90, 180, 365")
- Info alert: "Existing enrollments are not affected"
- Fetches `default_duration_days` in existing `fetchData()`, saves in existing `handleSave()` programs update

### Modified: `src/pages/admin/ClientDetail.tsx`

**Deadline display** in enrollment info section:
- Shows "Deadline: {date} · {N} days remaining" (color-coded: red ≤7d, amber ≤30d, default otherwise)
- Shows "Self-paced (no deadline)" when `end_date` is null

**`ExtendDeadlineButton` component** (inline, before main export):
- Dialog with current deadline display, "Extend by N days" input (default 30), preview of new deadline
- Saves via `supabase.from("client_enrollments").update({ end_date })`
- Shows "Set Deadline" when no current deadline, "Extend Deadline" when deadline exists

### Modified: `src/pages/client/ProgramDetail.tsx`

Added `EnrollmentDeadlineBanner` import. Renders before `AlumniGraceBanner` for active enrollments with `end_date`.

### Modified: `src/pages/client/ClientDashboard.tsx`

- Added `end_date: string | null` to `Enrollment` interface
- Added `end_date` to enrollment select query
- Renders `EnrollmentDeadlineBanner` for active enrollments within 30 days of expiry (after `CreditExpiryAlert`, before `AlumniGraceBanner`)

### Key Design Decisions

- **Separate edge function** (not extending `alumni-lifecycle`) — pre-completion enforcement vs post-completion nurture
- **Deadline does NOT pause** when enrollment is paused — admin can manually extend to compensate
- **No new enrollment status** — expired enrollments transition to `completed` (reuses existing triggers)
- **NULL duration = self-paced** — opt-in enforcement, no breaking change

---

## Bug Fixes (2026-03-25, commits 51894d1, a9ccbab, 44ed12b)

### TDZ Crash on Client ProgramDetail (`51894d1`)
Helper functions (`isTimeGated`, `arePrerequisitesMet`, `isModuleAccessible`) were defined as `const` arrow functions but referenced before declaration inside a `modules.filter()` callback. Moved all helpers above `isModuleAccessible` to fix temporal dead zone ReferenceError. 1 file changed (67 lines reordered).

### Add-On Edit Dialog Not Loading Existing Data (`a9ccbab`)
`AddOnsManagement.tsx` had a local `formData` state that shadowed the `useAdminCRUD` hook's form state. When `openEdit()` was called, it updated the hook's `formData` but the dialog rendered from the empty local state. Fix: removed local state, now uses the hook's `formData`/`setFormData` directly. 1 file, 2 lines changed.

### Multi-Role Users See Wrong Dashboard After Refresh (`44ed12b`)
`ProtectedRoute` checked `userRoles.includes(requireRole)` (whether the user **has** the role) but not whether the **selected** role matched the route. For multi-role users (e.g. admin+client), both `/admin` and `/dashboard` passed the access check regardless of which role was selected via the sidebar. After page refresh, the URL could stay on a route that didn't match the selected role.

**Fix:** Added role-route group sync check in `ProtectedRoute` (lines 142-160). Maps roles to route groups:
- `admin` → "admin"
- `org_admin` → "org_admin"
- `instructor`/`coach` → "teaching"
- everything else → "client"

When `routeGroup(requireRole) !== routeGroup(userRole)` for a multi-role user, redirects to the selected role's dashboard. Single-role users are unaffected (`userRoles.length > 1` guard). Teaching routes without `requireRole` are unaffected.

**Deployed to:** all 3 environments + Lovable sandbox.

---

## Configurable Credit-to-EUR Ratio + Scaling Tool (2026-03-25)

Made the hardcoded 2:1 credit-to-EUR ratio configurable via `system_settings.credit_to_eur_ratio`. Added admin scaling tool to proportionally adjust all credit balances when the ratio changes. 3 new files, 7 modified files, 2 migrations. `npm run verify` passed. Deployed to all environments.

### Migration: `20260325120000_configurable_credit_ratio.sql`

**Setting insert:**
- `credit_to_eur_ratio` = '2' in `system_settings` with description

**`scale_credit_batches` RPC (SECURITY DEFINER):**
- Accepts: `p_old_ratio NUMERIC`, `p_new_ratio NUMERIC`, `p_admin_user_id UUID`
- Calculates `scale_factor = new_ratio / old_ratio`
- Scales with `CEIL` rounding (fair to users):
  - `credit_batches` where `remaining_amount > 0 AND is_expired = false` (both `remaining_amount` and `original_amount`)
  - `credit_topup_packages.credit_value` (active packages)
  - `org_credit_packages.credit_value` (active packages)
  - `plans.credit_allowance` (where > 0)
  - `program_plans.credit_allowance` (where > 0)
  - `program_tier_plans.credit_cost` (where > 0)
- Updates `system_settings` value to new ratio
- Inserts audit log into `admin_audit_logs`
- Returns `{ success, batches_affected, total_old_credits, total_new_credits, scale_factor }`
- Uses `FOR UPDATE` row locking for atomicity

### New Hook: `src/hooks/useCreditRatio.ts`
- `useCreditRatio()` — React Query hook reading `credit_to_eur_ratio` from `system_settings` (5-min staleTime)
- `creditsToEur(credits, ratio)` — pure function with default fallback
- `formatCreditsAsEur(credits, ratio)` — formatted EUR string
- `calculatePackageBonus(priceCents, creditValue, ratio)` — bonus percentage calculation
- `formatRatioText(ratio)` — returns "2 credits = EUR 1" dynamically

### New Component: `src/components/admin/CreditScaleDialog.tsx`
- 3-step admin dialog (configure → confirm → result) following `BulkCreditGrantDialog` pattern
- Step 1: current ratio, new ratio input, preview with scale factor and examples
- Step 2: destructive warning listing all affected entities, type "SCALE" to confirm
- Step 3: shows batches_affected, total_old/new_credits, scale_factor
- Calls `supabase.rpc("scale_credit_batches", ...)` and invalidates all credit-related React Query keys

### Updated Consuming Components (5 files)
- `Credits.tsx` — 3× "2 credits = EUR 1" → `formatRatioText(creditRatio)`, `creditRatio` passed to utility functions
- `CreditTopupPackagesManagement.tsx` — `calculateBonus` uses `creditRatio` instead of `* 2`, description text dynamic
- `ProgramPlanConfig.tsx` — help text uses `formatRatioText(creditRatio)`
- `ExplorePrograms.tsx` — `creditRatio` passed to `formatCreditsAsEur()`
- `ExpressInterestDialog.tsx` — `creditRatio` passed to `formatCreditsAsEur()`

### Updated: `src/hooks/useUserCredits.ts`
- Removed 3 hardcoded utility functions (`calculatePackageBonus`, `creditsToEur`, `formatCreditsAsEur`)
- Re-exported from `useCreditRatio.ts` for backward compatibility

### Updated: `src/pages/admin/SystemSettings.tsx`
- Added "Credit-to-EUR Ratio" label, number input type
- Added "Scale Credit Balances" button below ratio setting
- Renders `CreditScaleDialog` with current ratio

### System Settings RLS Whitelist: `20260325140000_public_system_settings_whitelist.sql`
- `useCreditRatio()` hook queries `system_settings` from client-facing pages
- Non-admin users were blocked by admin-only RLS → API errors (silent fallback to default)
- Whitelist RLS policy allows authenticated users to SELECT only `credit_to_eur_ratio` and `support_email`
- All other system_settings keys remain admin-only

---

## 2B.5 Certification — Auto-Badge, Verification & PDF Certificates (2026-03-25)

Complete certification system with automatic badge creation on program completion, public verification page, and downloadable PDF certificates. 1 migration, 2 new edge functions, 1 new page, multiple modified files. `npm run verify` passed. Deployed to all environments.

### Migration: `20260325100000_certification_auto_badge.sql`
- `client_badges.expires_at` TIMESTAMPTZ column
- `program_badges.renewal_period_months` INTEGER column
- 3 indexes: `client_badges(user_id, badge_id)`, `client_badges(status)`, `client_badges(expires_at)`
- 3 notification types: `badge_pending_approval`, `badge_issued`, `badge_expiring`
- Email template: `notification_badge_pending`
- `trg_auto_create_badge_on_completion` — AFTER trigger on `client_enrollments` auto-creates `client_badges` with `pending_approval` status when enrollment changes to `completed`

### New Edge Functions
- `verify-badge/index.ts` — public (no JWT), returns badge data for issued+public badges. Verification URL: `/verify/badge/:badgeId`
- `generate-certificate-pdf/index.ts` — auth required, generates A4 landscape PDF via pdf-lib. InnoTrue branded certificate with recipient name, program, date, unique badge ID

### New Page: `src/pages/public/BadgeVerification.tsx`
- Public `/verify/badge/:badgeId` route — certificate-style display with issuer, program, date, status

### Key UI Changes
- **ClientBadgesSection** — was fully built but never imported. Now displayed in DevelopmentProfile and ClientDashboard (compact, gated behind `certificates` feature)
- Pending badges notice with Clock icon
- Expiry display for expired/expiring_soon badges
- Download Certificate (PDF) button
- LinkedIn expiry params passed when sharing

### Admin Changes
- **ProgramBadgeManager** — `renewal_period_months` field for badge expiry configuration
- **BadgeApproval** — calculates `expires_at` per badge on issuance
- **send-notification-email** — added `badge_pending_approval` type mapping

---

## SC-2 N+1 Query Rewrites (2026-03-25)

Rewrote 13 admin and client pages to replace O(N) per-record database calls with batch `.in()` queries and lookup maps. `npm run verify` passed.

### Critical (4 pages)
- `StaffAssignments.tsx` — 4 nested loops (programs→modules→staff→enrollments) → 6 parallel sources + 1 batch enrollment query with Map lookup
- `UsersManagement.tsx` — 4N queries (roles, qualifications, preferences, module_types per user) → 4 batch queries + parallel email resolution
- `ClientsList.tsx` — 5N queries → 5 batch queries (profiles, client_profiles, enrollments, coaches, coach profiles)
- `ProgramCompletions.tsx` — sequential for loop → 1 batch enrollment query grouped by user in JS

### High (7 pages)
- `CoachesList.tsx` — batch profiles with plan JOINs + batch client_coaches count
- `InstructorsList.tsx` — batch profiles with plan JOINs + batch program_instructors count
- `ProgramsList.tsx` — 1 batch program_modules query → Map count
- `AssessmentInterestRegistrations.tsx` — 1 batch profiles query → Map lookup
- `ProgramDetail.tsx` (client) — 1 batch module_progress query → Map lookup
- `ExplorePrograms.tsx` — 1 batch program_skills query → Map lookup for recommendation scoring
- `CapabilityAssessments.tsx` — 1 batch evaluator profiles query → Map lookup

### Medium/Low (2 pages)
- `GroupsManagement.tsx` — 1 batch group_memberships query → Map count
- `AdminDashboard.tsx` — 4 data fetches in parallel + 1 batch profiles query

---

## Admin User Management & Users List Fixes (2026-03-25)

Two performance/correctness fixes for admin user management. `npm run verify` passed.

### Edge Function Error Extraction Fix
- `supabase.functions.invoke` returns `data: null` and `error.context` (Response object) on non-2xx responses
- Created `extractFnError()` helper that extracts actual error message via `await error.context.json()`
- Applied to all 7 edge function calls in `UsersManagement.tsx` (create, delete, ban, unban, etc.)
- Previously showed generic "Edge Function returned a non-2xx status code" instead of actual error

### Admin User Creation Password Fix
- Auto-generated password (`Math.random().toString(36)`) didn't meet `validatePassword` requirements (uppercase + lowercase + digit + special)
- New generator produces 12-char passwords with all required character classes

### Users List N+1 Elimination
- Eliminated N individual `get-user-email` edge function calls (one per user row)
- Reads `email` and `is_disabled` directly from `profiles` table (synced from `auth.users` by `sync_auth_to_profiles` trigger from Sprint 1)
- Changed profiles SELECT to include `email, is_disabled` columns

### Files Modified
- `src/pages/admin/UsersManagement.tsx` — `extractFnError()` helper, password generator, profiles query updated

---

## 2B.13 Credit Expiry Policy + 2B.11 Feature Loss + 2B.12 Feature Gain (2026-03-24)

Three related roadmap features implemented end-to-end and deployed to all environments.

### 2B.13 Credit Expiry Policy + Awareness

**Migration: `20260324110000_credit_expiry_10year.sql`**
- Added `system_settings.purchased_credit_expiry_months` = 120 (10 years) as single source of truth
- Updated `credit_source_types.default_expiry_months` for purchase, admin_grant, addon
- Updated `credit_topup_packages.validity_months` and `org_credit_packages.validity_months` from 12 → 120
- Retroactively extended existing batches using dynamic PL/pgSQL (reads from system setting, no hardcoded values)

**Edge Function Bug Fixes (3 functions):**
- `confirm-credit-topup/index.ts` — 3 bugs: `p_source_type: 'topup'` → `'purchase'`, `p_notes` → `p_description`, hardcoded 12-month expiry → `metadata.expires_at` with system setting fallback via `getDefaultPurchaseExpiry()`
- `org-confirm-credit-purchase/index.ts` — 2 bugs: `p_notes` → `p_description`, hardcoded 12-month expiry → dynamic (same pattern)
- `stripe-webhook/index.ts` — `p_user_id` → `p_owner_type: 'user', p_owner_id: userId` + added `p_feature_key: null, p_source_reference_id: null`

**UI — CreditExpiryAlert:**
- New `src/components/credits/CreditExpiryAlert.tsx` — amber banner when credits expiring within 7 days
- Two variants: `"inline"` and `"banner"` (following `LowBalanceAlert` pattern)
- Integrated in `ClientDashboard.tsx` and `Credits.tsx`

**UI — Credits Page Enhancements:**
- `src/pages/client/Credits.tsx` — enhanced "Expiring Soon" card with per-batch details (source type, remaining credits, days left, color-coded urgency)
- Added new "Purchased & Bonus Credits" section showing all bonus batches with expiry dates

**Notification Cron:**
- New `supabase/functions/credit-expiry-notifications/index.ts` — daily cron (3 AM UTC)
- Users: notified when batches expire within 7 days. Orgs: notified when batches expire within 30 days (org admins)
- Deduplication: only one notification per user per day
- Migration `20260324110001_credit_expiry_notification_cron.sql` schedules cron
- Added to `supabase/config.toml` with `verify_jwt = false`

### 2B.11 Feature Loss Communication

**Hook: `useFeatureLossPreview()`**
- New `src/hooks/useFeatureLossPreview.ts` — computes features at risk when a specific `AccessSource` is removed
- Uses `useEntitlements()` internally: `getAllEnabledFeatures()` + `getAccessSource()`
- Returns `{ featuresToLose, featuresRetained, isLoading }`

**AlumniGraceBanner:**
- New `src/components/alumni/AlumniGraceBanner.tsx`
- Amber banner when `daysRemaining > 7`, red/destructive when `<= 7`
- Shows features at risk via `useFeatureLossPreview("program_plan")`
- CTA: "Explore Plans" → `/subscription`
- Integrated in `ClientDashboard.tsx` (recently completed enrollments loop) and `ProgramDetail.tsx`

**CompletionFeatureWarning:**
- New `src/components/enrollment/CompletionFeatureWarning.tsx`
- Info alert shown when `progressPercent > 80%` (configurable via `showAfterPercent` prop)
- Shows features retained vs features at risk, fetches alumni grace period from system_settings
- Integrated in `ProgramDetail.tsx` after the progress bar section

**Post-completion Dashboard Notice:**
- Added query for recently completed enrollments (last 30 days) in `ClientDashboard.tsx`
- Shows `AlumniGraceBanner` for each completed enrollment with grace period info

### 2B.12 Feature Gain Visibility

**FeatureSourceBadge:**
- New `src/components/features/FeatureSourceBadge.tsx`
- Color-coded badges: "Via Plan" (blue), "Via Program" (purple), "Via Add-on" (green), "Via Track" (orange), "Via Org" (teal)
- Uses `useEntitlements().getAccessSource(featureKey)`
- Integrated in `Subscription.tsx` feature lists

**ProgramFeatureList:**
- New `src/components/program/ProgramFeatureList.tsx`
- "What's Included" card fetching `program_plan_features` with joined `features` table
- Two modes: full card or compact inline list
- Resolves `program_plan_id` via: enrollment → tier mapping → program default
- Integrated in `ProgramDetail.tsx`

**Subscription Page Enhancement:**
- Added `FeatureSourceBadge` to plan feature list items in `Subscription.tsx`
- Updated query to include `features.key` for badge lookup

### Files Modified/Created (22 total)

| File | Action |
|------|--------|
| `supabase/migrations/20260324110000_credit_expiry_10year.sql` | NEW |
| `supabase/migrations/20260324110001_credit_expiry_notification_cron.sql` | NEW |
| `supabase/functions/confirm-credit-topup/index.ts` | FIX |
| `supabase/functions/org-confirm-credit-purchase/index.ts` | FIX |
| `supabase/functions/stripe-webhook/index.ts` | FIX |
| `supabase/functions/credit-expiry-notifications/index.ts` | NEW |
| `supabase/config.toml` | MODIFY |
| `src/components/credits/CreditExpiryAlert.tsx` | NEW |
| `src/pages/client/Credits.tsx` | MODIFY |
| `src/pages/client/ClientDashboard.tsx` | MODIFY |
| `src/hooks/useFeatureLossPreview.ts` | NEW |
| `src/components/alumni/AlumniGraceBanner.tsx` | NEW |
| `src/components/enrollment/CompletionFeatureWarning.tsx` | NEW |
| `src/components/features/FeatureSourceBadge.tsx` | NEW |
| `src/components/program/ProgramFeatureList.tsx` | NEW |
| `src/pages/Subscription.tsx` | MODIFY |
| `src/pages/client/ProgramDetail.tsx` | MODIFY |

---

## Schema Drift Fixes — All 3 Sprints (2026-03-24)

Fixed all code-to-DB mismatches identified in the Schema Drift Audit (`docs/SCHEMA_DRIFT_AUDIT.md`). 18 files modified/created, 4 migrations. `npm run verify` passed after each sprint. All migrations pushed to preprod, types.ts regenerated.

### Post-Sprint: Deployment & Cron

- All 4 migrations pushed to preprod (`jtzcrirqflfnagceendt`) successfully
- `types.ts` regenerated from preprod — `profiles.email` and `profiles.is_disabled` now in generated types
- **Migration `20260324100003_credit_expiry_cron.sql`:** Added `daily-credit-expiry` pg_cron job (2 AM UTC daily) calling `expire_credit_batches()`. Previously, batch expiration only happened lazily when users checked their credits — inactive users' batches could stay "active" past expiry.

### Sprint 1 — CRITICAL: Profiles + DB Functions

**Migration `20260324100000_profiles_email_and_disabled.sql`:**
- Added `profiles.email` TEXT + `profiles.is_disabled` BOOLEAN columns
- Backfilled from `auth.users` (email from `auth.users.email`, is_disabled from `banned_until`)
- Created `sync_auth_to_profiles()` trigger on `auth.users` (auto-syncs email + ban changes)
- Updated `handle_new_user()` to set `profiles.email` on signup
- Fixed `create_notification()` — `full_name` → `name`

**Migration `20260324100001_fix_session_and_staff_functions.sql`:**
- Fixed `notify_session_participant_added()` — removed phantom `ms.coach_id`, uses `ms.instructor_id`
- Fixed `staff_has_client_relationship()` — added `enrollment_module_staff` EXISTS check

**Edge function belt+suspenders (3 files):**
- `delete-user/index.ts` — updates `profiles.is_disabled` after ban/unban
- `verify-email-change/index.ts` — updates `profiles.email` alongside username
- `update-user-email/index.ts` — updates `profiles.email` alongside username

**`full_name` → `name` fixes (4 frontend files):**
- `PartnerCodesManagement.tsx` — interface, queries, display
- `StudentDevelopmentProfile.tsx` — select + property access
- `useFeedbackInbox.ts` — 4 fetch functions
- `useContentPackages.ts` — select + property access

### Sprint 2 — HIGH: Wrong Table Names + Phantom Tables

| File | Fix |
|------|-----|
| `accept-org-invite/index.ts` | `user_organization_sharing_consent` → `organization_sharing_consent`, fixed columns |
| `useReadinessDashboard.ts` | `instructor_assignments` → union of `program_instructors` + `program_coaches` |
| `generate-reflection-prompt/index.ts` | `wheel_of_life_scores` → `wheel_of_life_snapshots`, restructured columns |
| `credit-maintenance/index.ts` | `user_subscriptions` → `profiles`, `organization_subscriptions` → `org_platform_subscriptions` |
| `stripe-webhook/index.ts` | `enrollment_id: null as unknown as string` → `null` (+ migration to make nullable) |
| `check-org-seat-limits/index.ts` | Removed phantom `platform_tier_id` column |
| `export-feature-config/index.ts` | Removed broken `program:programs(name)` FK join |

**Migration `20260324100002_schema_drift_fixes.sql`:** Made `payment_schedules.enrollment_id` nullable.

### Sprint 3 — MEDIUM: calendar-feed Full Rewrite

**`calendar-feed/index.ts`** — complete rewrite of data-fetching section:
- `client_sessions` (doesn't exist) → `module_session_participants` + `module_sessions`
- `scheduled_at` → `session_date` everywhere
- `group_members` (doesn't exist) → `group_memberships`
- `full_name` → `name` in profile type/queries/access
- Added cohort sessions (via `client_enrollments.cohort_id` → `cohort_sessions`)
- Instructor names via batch `profiles` lookup (no FK from `module_sessions.instructor_id`)
- Removed broken assignments section (`module_assignments` has no `due_date`/`client_id`)

## Remove Continuation Plan (2026-03-04)

Removed the deprecated Continuation plan and all code remnants. The Continuation plan was an old concept where clients who finished a program were moved to a special tier-0 plan — replaced by Alumni Lifecycle (2B.1) where alumni is an enrollment-level state, not a plan change. 1 new migration, 1 deleted component, 6 modified files. `npm run verify` passed.

**Migration (`20260304100000_remove_continuation_plan.sql`):** Safety-net to move any remaining Continuation plan users to Free (none found in practice).

**Deleted:** `src/components/dashboard/ContinuationBanner.tsx`

**Modified:**
- `src/pages/client/ClientDashboard.tsx` — removed `isOnContinuationPlan` state, continuation plan check query, and banner render
- `src/pages/admin/ProgramCompletions.tsx` — rewritten as read-only view: removed selection state, `moveToContinuationMutation`, bulk/individual move buttons, confirmation dialog, checkbox and action columns. Title changed to "Program Completions" / "Completed Programs"
- `src/pages/admin/AdminFAQ.tsx` — Tier 0 label: "Continuation (free/limited)" → "Free (base access)"
- `src/pages/admin/PlansManagement.tsx` — help text: removed ", Continuation"
- `src/lib/documentation/platformDocumentation.ts` — updated continuation banner text and tier 0 table row
- `supabase/seed.sql` — removed continuation plan INSERT

## Stripe Webhook Configuration (2026-03-04)

Configured Stripe webhooks for both preprod and production environments. All 5 events enabled: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`. `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` set in both environments (test key for preprod, live key for prod). Stripe price IDs auto-created on first checkout — no manual product sync needed between environments.

---

## Credit Economy Redesign — Phases 1-4 (2026-03-02 – 2026-03-03)

Unified 2:1 credit-to-EUR ratio across the entire platform. 4-phase implementation: credit recalibration migration, Top Up & Enrol UX, installment plans (Stripe subscription-as-instalment), documentation. 1 new migration, 1 new edge function, 1 new admin page, 8+ modified files. `npm run verify` passed.

**Problem solved:** Credit values were inconsistent across plans, packages, and services. No installment payment option for high-value programs. No smart package recommendation when users needed credits for enrollment. Large top-up packages cluttered the Credits page for casual users.

### Phase 1 — Credit Recalibration

**Migration (`20260302120000_credit_recalibration_2to1.sql`):**
- Recalibrates ALL pricing to unified 2:1 ratio (1 EUR = 2 credits)
- Plan allowances: Free=40, Base=100, Pro=200, Advanced=360, Elite=500
- 6 individual top-up packages: Micro (€10/20cr), Session (€75/150cr), Module (€250/500cr), Program (€1,500/3,000cr), Premium Program (€4,500/9,000cr), Immersion (€8,500/17,000cr)
- 8 org credit bundles recalibrated with new slugs (bundle-1050 through bundle-56000)
- Credit services doubled: AI=2, Goals=4, Peer coaching=60, Group session=100, Workshop=150, Coaching 1:1=200, RBM async=300, RBM live=1,500
- Program costs: CTA Immersion=16,896cr, Leadership Elevate=2,000cr
- Payment columns on `client_enrollments`: `payment_type` (upfront/payment_plan/free), `payment_status` (paid/outstanding/overdue)

**Seed.sql updated** to match all 2:1 values for fresh environments.

**Utility functions (`useUserCredits.ts`):**
- `calculatePackageBonus()` updated: `baseCredits = (priceCents / 100) * 2`
- New: `creditsToEur(credits)` → `credits / 2`
- New: `formatCreditsAsEur(credits)` → formatted EUR string (e.g., "€4,250.00")

### Phase 2 — Top Up & Enrol UX

**Credits.tsx (complete rewrite):**
- Smart package recommendation: reads `pendingEnrollment` from sessionStorage, computes credit shortfall, finds smallest adequate package
- Contextual display: `LARGE_PACKAGE_THRESHOLD_CENTS = 150000` (€1,500); large packages hidden unless needed for enrollment
- Pending enrollment banner with shortfall info and "Complete Enrollment" button (when already have enough credits)
- Package cards: "Recommended" badge, "Covers your enrollment" indicator, "Top Up & Enroll" button text
- Toggle "Show X larger packages" for browsing users

**ExplorePrograms.tsx:**
- Credit cost badge on program cards: `{formatCredits(credit_cost)} credits` with EUR tooltip
- Wired discount code props to `ExpressInterestDialog`: `programId`, `tierCreditCost`, `tierCreditCosts`, `onValidateDiscount`

**ExpressInterestDialog.tsx:**
- New `tierCreditCosts?: Record<string, number | null>` prop for dynamic per-tier cost lookup
- `resolvedTierCost` computed from map or scalar fallback
- Credit cost display next to each tier option: `{formatCredits(cost)} credits` + `{formatCreditsAsEur(cost)}`

### Phase 3 — Installment Plans

**Phase 3a — Database (`20260303010000_payment_schedules.sql`):**
- `payment_schedules` table: enrollment_id, stripe_subscription_id, total_amount_cents, installment_count, installment_amount_cents, installments_paid, amount_paid_cents, next_payment_date, status (active/completed/defaulted/cancelled), credits_granted
- RLS: users SELECT own, service_role full access
- `installment_options` JSONB column on `programs` (e.g., `[{"months":3,"label":"3 monthly payments"}]`)
- `upfront_discount_percent` NUMERIC column on `programs`
- `stripe_subscription_id` TEXT column on `client_enrollments`
- `update_installment_payment_status()` SECURITY DEFINER function for webhook use

**Phase 3b — Admin UI (`ProgramPlanConfig.tsx`):**
- Installment options section: checkboxes for 3/6/12 months
- Upfront discount percent input
- Fixed "1 credit = €1" → "2 credits = €1"
- Fetches + saves `installment_options` and `upfront_discount_percent` from programs table

**Phase 3c — Edge Function (`create-installment-checkout/index.ts`):**
- Creates Stripe Checkout in subscription mode with `cancel_at` for fixed-term installments
- Creates recurring price per-installment: `Math.ceil(price_cents / installmentMonths)`
- Metadata: `type: "credit_installment"`, user_id, package_id, credit_value, installment_count
- Creates pending `user_credit_purchases` record
- Returns `{ url, installmentMonths, perInstallment, totalCharged }`
- Added to `config.toml` with `verify_jwt = false`

**Phase 3d — Webhook Handlers (`stripe-webhook/index.ts`):**
- `invoice.paid` → `handleInvoicePaid()`: checks subscription metadata for `credit_installment`, skips first invoice (`billing_reason === "subscription_create"`), calls `update_installment_payment_status` RPC
- Enhanced `invoice.payment_failed` → checks for installment subscriptions, sets `payment_status` to 'outstanding' via RPC
- `handleInstallmentCheckoutCompleted()`: grants FULL credits upfront via `grant_credit_batch` RPC, creates `payment_schedules` record with installments_paid=1
- `handleInstallmentSubscriptionDeleted()`: marks completed (all paid) or defaulted (not all paid), locks enrollment if defaulted
- Routing via `metadata.type === "credit_installment"` in checkout.completed and subscription.deleted handlers

**Phase 3e — Client UI (Credits.tsx):**
- Installment payment plan selector with RadioGroup: "Pay in full (X% discount)" / "3 monthly payments" / "6 monthly payments" / "12 monthly payments"
- `purchaseWithInstallments()` calling `create-installment-checkout` edge function
- Fetches `installment_options` from program table when pending enrollment exists
- State: `installmentOptions`, `upfrontDiscountPercent`, `selectedPaymentMode`, `isCreatingInstallment`

**Phase 3f — Enhanced PlanLockOverlay (`PlanLockOverlay.tsx`):**
- Payment outstanding display: Contact Support button alongside Manage Billing button

**Phase 3g — Admin Dashboard (`PaymentSchedulesManagement.tsx`):**
- Summary cards: Active Plans, Defaulted, Outstanding amount, Total Collected
- Table: client name/email, status badge, progress bar (X/Y payments), total, paid, next payment, credits, started date
- Queries `payment_schedules` with joined `profiles` data
- Lazy-loaded route `/admin/payment-schedules` in App.tsx
- Sidebar link in AppSidebar.tsx under admin monetization

### Phase 4 — Documentation

Updated MEMORY.md, completed-work.md, and SUBSCRIPTIONS_AND_PLANS.md with all Phase 1-4 changes.

**Files created:** `supabase/migrations/20260302120000_credit_recalibration_2to1.sql`, `supabase/migrations/20260303010000_payment_schedules.sql`, `supabase/functions/create-installment-checkout/index.ts`, `src/pages/admin/PaymentSchedulesManagement.tsx`

**Files modified:** `supabase/seed.sql`, `src/hooks/useUserCredits.ts`, `src/pages/client/Credits.tsx`, `src/pages/client/ExplorePrograms.tsx`, `src/components/programs/ExpressInterestDialog.tsx`, `src/components/admin/ProgramPlanConfig.tsx`, `supabase/functions/stripe-webhook/index.ts`, `src/components/programs/PlanLockOverlay.tsx`, `src/components/AppSidebar.tsx`, `src/App.tsx`, `supabase/config.toml`

---

## Stripe Credit Bundles Sync (2026-03-02)

Synced 8 Stripe "Credit Bundle" products to `org_credit_packages` database table with direct `stripe_price_id` linking. Eliminates auto-creation of duplicate Stripe products on first org credit purchase. 1 new migration, seed.sql updated, 2 docs updated. `npm run verify` passed.

**Problem solved:** After the previous Supabase project crash (Lovable cloud), `org_credit_packages` had no `stripe_price_id` values. The 8 Credit Bundle products already existed in the Stripe account but weren't linked to database records. Without linking, each first purchase would auto-create a duplicate Stripe product/price.

**Migration (`20260302100000_sync_stripe_credit_bundles.sql`):**
- Deactivates old 3 placeholder packages (starter/growth/enterprise) that had no Stripe linkage
- Inserts 8 new Credit Bundle packages with volume-based bonus credits and direct Stripe price IDs:

| Slug | Name | Price | Base Credits | Bonus | Total Credits | Stripe Price ID |
|------|------|-------|-------------|-------|--------------|----------------|
| `bundle-525` | Credit Bundle - 525 Credits | €500 | 500 | 5% | 525 | `price_1SqR2cKTUzwyKyi3uAIH6MEt` |
| `bundle-1100` | Credit Bundle - 1,100 Credits | €1,000 | 1,000 | 10% | 1,100 | `price_1SqR33KTUzwyKyi3l2dJ8gcb` |
| `bundle-2875` | Credit Bundle - 2,875 Credits | €2,500 | 2,500 | 15% | 2,875 | `price_1SqR3QKTUzwyKyi38wHvLsBh` |
| `bundle-6000` | Credit Bundle - 6,000 Credits | €5,000 | 5,000 | 20% | 6,000 | `price_1SqR3kKTUzwyKyi3yq5pI8TR` |
| `bundle-9375` | Credit Bundle - 9,375 Credits | €7,500 | 7,500 | 25% | 9,375 | `price_1SqR7MKTUzwyKyi3k5Adok6m` |
| `bundle-13000` | Credit Bundle - 13,000 Credits | €10,000 | 10,000 | 30% | 13,000 | `price_1SqR7WKTUzwyKyi3C3W53I8L` |
| `bundle-20250` | Credit Bundle - 20,250 Credits | €15,000 | 15,000 | 35% | 20,250 | `price_1SqR7gKTUzwyKyi34HWzcSe9` |
| `bundle-28000` | Credit Bundle - 28,000 Credits | €20,000 | 20,000 | 40% | 28,000 | `price_1SqR81KTUzwyKyi3OnZfVqrp` |

**Also modified:**
- `supabase/seed.sql` — replaced 3 old org packages with 8 Stripe-linked bundles (for fresh environments)
- `MEMORY.md` — added entry for Stripe credit bundles sync
- `completed-work.md` — this entry

**Note:** Individual credit top-up packages (`credit_topup_packages`) have no Stripe products yet — they use auto-creation on first purchase via `purchase-credit-topup` edge function.

## Tier & Program Plan Defaulting (2026-03-01)

Ensures every enrollment across all paths gets a consistent `tier` and `program_plan_id`. Fixes a bug in `redeem-enrollment-code` that was passing a subscription plan ID as a program plan ID. 1 migration (updated), 2 edge functions modified, 2 admin components modified, 1 public page modified, 1 types file updated, 3 docs updated. `npm run verify` passed.

**Problem solved:** Enrollment flows (enrollment codes, partner codes) could leave `tier` as NULL even when a program defines tiers, and `program_plan_id` was either NULL or wrong (subscription plan FK instead of program plan FK). The entitlements system (`useEntitlements.ts`) had runtime fallbacks, but enrollment records themselves were inconsistent.

**Database Migration (`20260301140000_tier_defaulting.sql`) — updated from initial version:**
- `partner_codes.grants_tier` TEXT column — optional tier override on partner codes
- Updated `validate_partner_code()` RPC to return `grants_tier` in JSONB response
- Updated `enroll_with_credits()` RPC with two new auto-resolution steps:
  - **Step 0c — Tier defaulting:** If `p_tier IS NULL`, defaults to `programs.tiers->>0` (first/lowest tier in program's JSONB tier array)
  - **Step 0d — Program plan resolution:** If `p_program_plan_id IS NULL`:
    1. Look up `program_tier_plans` for `(program_id, tier_name)` → get `program_plan_id`
    2. If no tier mapping, fall back to `programs.default_program_plan_id`
  - Explicit values are never overridden — only NULL values get defaulted

**Bug fix — `redeem-enrollment-code/index.ts`:**
- Was passing `enrollCode.grants_plan_id` (FK to `plans` — subscription plans) as `p_program_plan_id` (expects FK to `program_plans` — in-program feature templates)
- Now passes `p_program_plan_id: null`, letting the RPC resolve it correctly via Step 0d
- Added explanatory comments documenting the type mismatch

**Modified — `redeem-partner-code/index.ts`:**
- Changed `p_tier: null` to `p_tier: codeValidation.grants_tier || null` — passes partner code's tier override to RPC

**Modified — `PartnerCodesManagement.tsx`:**
- Added tier selector in create/edit dialog (shows program's tiers from `programs.tiers` JSONB)
- Shows "X tier" badge below program name in table when `grants_tier` is set
- Selector shows "Default (lowest) tier" as first option with helper text

**Modified — `RedeemPartnerCode.tsx`:**
- Added `grants_tier` to `ValidationResult` interface
- Shows tier badge in program info card when partner code specifies a tier

**Modified — `types.ts`:**
- Added `grants_tier: string | null` to `partner_codes` Row/Insert/Update types

**All enrollment paths now auto-resolve:**
| Path | Before | After |
|------|--------|-------|
| Self-enrollment (credits) | ✅ Already resolved tier + plan | ✅ No change needed |
| Enrollment code | ❌ Wrong `program_plan_id` (subscription FK) | ✅ RPC resolves from tier |
| Partner code | ❌ NULL tier, NULL plan | ✅ Tier from code or defaulted, plan from RPC |
| Admin enrollment | ✅ Already resolved tier + plan | ✅ No change needed |

**Deployed to:** prod, preprod, sandbox (migration + both edge functions)

---

## 2B.3 Pricing Update (2026-03-01)

Migration-only update to new pricing tiers. `npm run verify` passed on first try.

**Database Migration (`20260301130000_pricing_update.sql`):**
- Monthly prices updated: base=€49, pro=€99, advanced=€179, elite=€249
- Annual prices added (20% discount): base=€470, pro=€950, advanced=€1718, elite=€2390
- Credit allowances scaled ~2x: base=300, pro=500, advanced=1000, elite=1500 (free stays at 20)
- `stripe_price_id` set to NULL on all updated rows to force Stripe auto-create on next checkout
- Continuation plan deactivated (`is_active = false`)

**No frontend changes needed:** Subscription page already had monthly/annual toggle with dynamic pricing from `plan_prices`.

---

## 2B.1 Alumni Lifecycle (2026-03-01)

Read-only content access for completed program enrollments with configurable grace period and automated nurture email sequence. 1 migration, 1 new edge function, 1 shared helper, 1 new hook, 5 modified files. `npm run verify` passed on first try.

**Database Migration (`20260301120000_alumni_lifecycle.sql`):**
- `client_enrollments.completed_at` (TIMESTAMPTZ) — auto-set by trigger when status changes to 'completed', backfilled for existing completed enrollments
- `system_settings.alumni_grace_period_days` (default 90) — admin-configurable
- `alumni_touchpoints` table — tracks nurture emails per enrollment with UNIQUE(enrollment_id, touchpoint_type) to prevent duplicates
- `check_alumni_access(uuid, uuid)` RPC — computes grace period, returns has_access/read_only/in_grace_period/days_remaining/grace_expires_at
- `set_enrollment_completed_at()` trigger — auto-sets completed_at on status transition to 'completed'

**New Shared Helper (`_shared/content-access.ts`):**
- `checkContentAccess(serviceClient, userId, programId)` → `ContentAccessResult`
- Access chain: staff (full) → active enrollment (full) → alumni grace (read-only) → denied
- Used by both `serve-content-package` and `xapi-launch` edge functions

**Modified — `serve-content-package/index.ts`:**
- Replaced inline staff+enrollment check with shared `checkContentAccess()` call
- Alumni get read-only content access (no X-Alumni-Read-Only header needed — frontend handles via launch data)

**Modified — `xapi-launch/index.ts`:**
- Replaced inline access check with shared `checkContentAccess()` helper
- Added `readOnly` flag to all success responses (staff session, normal session, resumed session)
- Module progress upsert wrapped in `if (!isReadOnly)` guard
- `tryResumeSession` accepts `readOnly` parameter

**New Edge Function (`alumni-lifecycle/index.ts`):**
- Daily cron function for alumni nurture email sequence
- Touchpoints: completion_congratulations (day 0), nurture_30d/60d/90d, access_expired (grace period end)
- Records touchpoints in `alumni_touchpoints` (UNIQUE constraint prevents duplicates)
- Sends emails via `send-notification-email` + creates in-app notifications via `create_notification` RPC

**New Hook (`useAlumniAccess.ts`):**
- Calls `check_alumni_access` RPC for current user + program
- Returns `{ alumniAccess, isLoading }` with full alumni status info
- 5-minute stale time via TanStack React Query

**Modified — `ContentPackageViewer.tsx`:**
- Added `readOnly` prop
- Alumni read-only banner (amber): "Read-Only — Alumni Access"
- xAPI statement sending suppressed when `readOnly` or `launchData.readOnly` is true

**Modified — `ClientDetail.tsx`:**
- Shows `completed_at` timestamp for completed enrollments
- Computed alumni access expiry (completed_at + 90 days) with countdown

---

## 2B.2 Partner Codes MVP (2026-03-01)

Partner referral attribution system for coach/instructor onboarding. Admin-created codes, public redemption page, referral tracking. 1 migration, 1 new edge function, 2 new pages, 7 modified files. `npm run verify` passed on first try.

**Database Migration (`20260301110000_partner_codes.sql`):**
- `partner_codes` table — partner_id (FK→auth.users), program_id, cohort_id (optional), code (UNIQUE), label, discount_percent, is_free, max_uses, current_uses, expires_at, is_active
- `partner_referrals` table — partner_code_id, partner_id (denormalized), referred_user_id, enrollment_id, referral_type, status
- RLS: admins full CRUD, partners view own, authenticated validate active codes
- `validate_partner_code(text)` RPC — validates code, returns program info + discount + partner_id
- Indexes on partner_id, program_id, code

**New Edge Function (`redeem-partner-code/index.ts`):**
- Mirrors `redeem-enrollment-code` pattern (~230 lines)
- Flow: auth → validate via RPC → check existing enrollment → program capacity → cohort capacity → `enroll_with_credits` with `enrollment_source='partner_referral'` → insert `partner_referrals` → increment usage → notify partner
- Uses `successResponse.ok` / `errorResponse.*` standard pattern

**New Page (`PartnerCodesManagement.tsx`):**
- Admin page mirroring `EnrollmentCodesManagement.tsx` (~650 lines)
- Quick generator: PRT prefix + 6 random chars, copies shareable link
- CRUD dialog: label, discount_percent, is_free, max_uses, expires_at, cohort_id, is_active
- Partner selector: dropdown from `user_roles` (coach/instructor)
- Codes table: code, partner name, program, uses (current/max), status badge, referral count
- Filter by partner dropdown, copy code/link buttons

**New Page (`RedeemPartnerCode.tsx`):**
- Public page mirroring `EnrollWithCode.tsx` (~340 lines)
- URL: `/partner?code=PRTABCDEF`
- Auto-validates from URL param → shows program info + discount + partner attribution
- Auth redirect for unauthenticated users → calls `redeem-partner-code` edge function → redirect to program

**Modified — `App.tsx`:**
- Added lazy imports: `PartnerCodesManagement`, `RedeemPartnerCode`
- Added routes: `/partner` (public), `/admin/partner-codes` (admin ProtectedRoute + DashboardLayout)

**Modified — `AppSidebar.tsx`:**
- Added "Partner Codes" to `adminProgramItems` (after Enrollment Codes, before Guided Path Templates) with `Users` icon

**Modified — `InstructorCoachDashboard.tsx`:**
- Added referral state (referralCount, activePartnerCodes)
- Query in `loadAdditionalData`: counts from `partner_referrals` + `partner_codes` for current user
- Conditional "My Referrals" card in stats grid (only shows if referralCount > 0 or activePartnerCodes > 0)

**Modified — `types.ts`:**
- Added `partner_codes` table type (Row/Insert/Update with Relationships)
- Added `partner_referrals` table type (Row/Insert/Update with Relationships)
- Added `alumni_touchpoints` table type (Row/Insert/Update)
- Added `completed_at` to `client_enrollments` Row/Insert/Update
- Added `validate_partner_code` function signature
- Added `check_alumni_access` function signature

**Modified — `config.toml`:**
- Added `[functions.redeem-partner-code]` with `verify_jwt = false`
- Added `[functions.alumni-lifecycle]` with `verify_jwt = false`

---

## 2B.6 Cohort Waitlist Management (2026-03-01)

Full waitlist system with capacity enforcement at program + cohort level, enrollment source attribution, client-facing waitlist UI, admin management, and spot availability notifications. 3 migrations, 2 new components, 1 new edge function, 6 modified files. `npm run verify` passed on first try.

**Database Migration 1 (`20260301090000_enrollment_source_and_capacity.sql`):**
- `client_enrollments.enrollment_source` (TEXT) — values: self, admin, enrollment_code, waitlist_promotion, partner_referral
- `client_enrollments.referred_by` (UUID FK → auth.users) — who referred or promoted the enrollment
- `client_enrollments.referral_note` (TEXT) — free text context (partner name, code used, etc.)
- `programs.capacity` (INTEGER, nullable) — max enrollments for program. NULL = unlimited.
- `check_program_capacity(uuid)` RPC — returns JSON: has_capacity, capacity, enrolled_count, available_spots
- Backfill: existing enrollment-code enrollments get `enrollment_source = 'enrollment_code'`

**Database Migration 2 (`20260301100000_cohort_waitlist.sql`):**
- `cohort_waitlist` table: id, user_id, cohort_id, position, notified, created_at, updated_at. UNIQUE(user_id, cohort_id).
- RLS: users manage own entries, admins manage all (via `user_roles` check)
- `check_cohort_capacity(uuid)` RPC — returns JSON: has_capacity, capacity, enrolled_count, waitlist_count, available_spots
- `join_cohort_waitlist(uuid)` RPC — validates not enrolled, checks cohort IS full, assigns next position. Returns `{success, position}`.

**Database Migration 3 (`20260301100001_enroll_with_credits_capacity.sql`):**
- Full `CREATE OR REPLACE` of `enroll_with_credits` — 13 params (was 9), all new params have defaults (backward compatible)
- New params: `p_force` (boolean, skips capacity), `p_enrollment_source` (text), `p_referred_by` (uuid), `p_referral_note` (text)
- Program capacity check → cohort capacity check → credit consumption → INSERT with source tracking
- Drops old 8-param and 9-param overloads to avoid PostgreSQL ambiguity
- GRANT with full 13-param signature

**New Component — `CohortWaitlistButton.tsx`:**
- Client-facing: shows nothing when cohort has capacity, "Join Waitlist" when full, "On Waitlist #N" badge when joined
- Calls `check_cohort_capacity` and `join_cohort_waitlist` RPCs
- Leave waitlist via direct DELETE
- TanStack React Query with 15s staleTime

**New Component — `CohortWaitlistManager.tsx`:**
- Admin panel: table view of waitlist entries (position, name, email, joined date, notified status)
- Promote action: calls `enroll_with_credits` with `p_force: true`, `p_enrollment_source: 'waitlist_promotion'`, `p_discount_percent: 100`
- Remove action: deletes from `cohort_waitlist`
- Shows available spots count from `check_cohort_capacity`

**New Edge Function — `notify-cohort-waitlist/index.ts`:**
- Input: `{ cohortId }`, auth via anon/service role key
- Checks capacity → gets next N unnotified entries by position → sends email via `send-notification-email` with type `waitlist_spot_available` → marks `notified = true`
- Added to `config.toml` with `verify_jwt = false`

**Modified — `redeem-enrollment-code/index.ts`:**
- Added program capacity check (calls `check_program_capacity` RPC)
- Added cohort capacity check (calls `check_cohort_capacity` RPC)
- Passes `p_enrollment_source: 'enrollment_code'`, `p_referred_by: enrollCode.created_by`, `p_referral_note: 'Via code ${code}'` to `enroll_with_credits`

**Modified — `useProgramEnrollment.ts`:**
- Added program capacity check at start of `enrollInProgram`: calls `check_program_capacity` RPC, shows toast if full
- Added `enrollment_source: 'self'` to direct `client_enrollments.insert`

**Modified — `ClientDetail.tsx`:**
- Added `useAuth()` for admin user ID
- Passes `p_force: true`, `p_enrollment_source: 'admin'`, `p_referred_by: adminUser.id`, `p_referral_note: 'Enrolled by admin'` to `enroll_with_credits`

**Modified — `ProgramCohortsManager.tsx`:**
- Added waitlist count query (parallel to existing enrollment counts)
- Shows waitlist badge per cohort: `⏳ N waiting` in amber
- Embeds `CohortWaitlistManager` inside collapsible content (after sessions)

**Modified — `types.ts`:**
- Added `cohort_waitlist` table types (Row/Insert/Update with Relationships)
- Added enrollment source columns to `client_enrollments` Row/Insert/Update
- Added `capacity` to `programs` Row/Insert/Update
- Added function signatures: `check_cohort_capacity`, `check_program_capacity`, `join_cohort_waitlist`
- Updated `enroll_with_credits` Args with 4 new params

---

## 2B.7 Module Prerequisite UI + Time-Gating (2026-02-22)

Lock icons + "Complete X first" messages + disabled states on client module lists. Time-gating via `available_from_date` column on `program_modules` — modules hidden/locked before date. Admin toggle in module editor. Commit `783f06d`.

---

## Phase 5 — Self-Registration Core, Batches 1-3 (2026-02-26)

Self-registration with role selection and admin approval flow. Transforms platform from invitation-only to self-registration. Commits `6cd54f5` (core), `b0b3f41` (CORS fix), `b5a659b` (config.toml fix), `9d598e7` (error messages), `ebba49f` (login tab switch), `7f7040e` (duplicate email fix), `0ca3358`..`01652f3` (Google OAuth fixes — 8 commits). 3 new files, 9 modified, 1 migration, 1 new edge function. Deployed to all 3 environments.

**Database Migration (`20260226100000_phase5_self_registration.sql`):**
- `profiles.registration_status` (TEXT DEFAULT 'complete') — state machine: `pending_role_selection` → `complete` or `pending_approval` → `complete`
- `profiles.verification_status` (TEXT), `profiles.verified_at` (TIMESTAMPTZ)
- `signup_verification_requests.plan_interest` (TEXT), `.context_data` (JSONB)
- `coach_instructor_requests.source_type` (TEXT DEFAULT 'client_request') — values: `client_request` (existing), `role_application` (Phase 5)
- `coach_instructor_requests.specialties`, `.certifications`, `.bio`, `.scheduling_url` (application fields)
- No new RLS policies needed — existing policies sufficient

**Edge Function (`complete-registration/index.ts`):**
- Auth via JWT Bearer token from `supabase.functions.invoke`
- Accepts `{ role_choice, specialties?, certifications?, bio?, scheduling_url?, message? }`
- All paths: upsert client role → create client_profiles → create notification_preferences → assign free plan (lookup via `plans WHERE key = 'free'`)
- Client-only: sets `registration_status = 'complete'`
- Coach/instructor: inserts `coach_instructor_requests` with `source_type = 'role_application'`, sets `registration_status = 'pending_approval'`
- Includes `transferPlaceholderIfExists()` for Google OAuth users — 7-table transfer (client_enrollments, capability_snapshots, client_badges, client_coaches, client_instructors, assessment_responses, client_profiles) + role copy + plan copy
- Idempotency guard: returns early if `registration_status === 'complete'` AND user has roles (handles Google OAuth users whose `handle_new_user` trigger sets status='complete' but have no roles yet)

**Frontend — CompleteRegistration.tsx (new):**
- Route: `/complete-registration` (outside ProtectedRoute in App.tsx)
- Auth guard: redirects to `/auth` if not logged in, to `/dashboard` if already complete AND has roles
- Sign out button in top-right corner
- Three cards: "I'm here to grow" (client), "I'm a Coach or Instructor" (expands form), "I represent an Organization" (greyed out, coming soon)
- Coach form: request_type select, bio, specialties, certifications, scheduling_url, message
- Info card: "You'll get immediate platform access as a client. Once approved, your coach/instructor tools will be unlocked."

**Frontend — Auth.tsx (modified):**
- Signup form re-enabled: Full name + Email + Password fields with show/hide toggle
- Google OAuth button with "Or" divider on both login and signup tabs
- Bidirectional tab switching links restored ("Don't have an account?" / "Already have an account?")
- Signup handler: calls `supabase.functions.invoke("signup-user")`, checks `data.error` first for specific messages
- Switches to login tab after successful signup with toast "Account created! Please check your email to confirm."

**Frontend — AuthContext.tsx (modified):**
- Added `registrationStatus: string | null` to interface, state, provider value
- `fetchUserRolesAndMembership`: fetches `profiles.registration_status`
- `signOut`: resets `registrationStatus` to null

**Frontend — ProtectedRoute.tsx (modified):**
- `isResolvingRoles`: accounts for `registrationStatus` to prevent infinite loading for users with `pending_role_selection` (zero roles is legitimate)
- `pending_role_selection` → redirect to `/complete-registration`
- Google OAuth new user detection: `app_metadata.provider === "google"` + zero roles → redirect to `/complete-registration` (regardless of `registrationStatus`, since `handle_new_user` trigger sets it to 'complete')
- `pending_approval` safety net card: "Application Under Review"

**Frontend — Index.tsx (modified):**
- Added `registrationStatus` redirect: `pending_role_selection` → navigate to `/complete-registration`

**Edge Function — verify-signup (modified):**
- Profile upsert includes `registration_status: 'pending_role_selection'`
- Removed auto-assign client role (moved to complete-registration)
- Removed notification_preferences creation (moved to complete-registration)
- Enhanced placeholder transfer: 7 tables (client_enrollments, capability_snapshots, client_badges, client_coaches, client_instructors, assessment_responses, client_profiles with note merging)
- Copies placeholder roles via `user_roles` upsert loop, copies plan_id
- Sets `registration_status = 'complete'` for placeholder matches (user skips /complete-registration)

**Edge Function — signup-user (modified):**
- Changed `email_confirm: true` to suppress Supabase auth hook sending duplicate "Set Up Your Account" email
- Our custom `signup-user` → `verify-signup` flow handles email verification independently

**Admin — CoachInstructorRequests.tsx (rewritten):**
- Tabs: "Role Applications" (source_type = 'role_application') + "Coach Assignments" (existing flow)
- Role Applications: approve upserts roles into user_roles, updates profiles (registration_status='complete', verification_status='verified', verified_at, bio, scheduling_url, certifications); decline sets registration_status='complete' (user keeps client role)
- Coach Assignments: existing approve flow (inserts into client_coaches/client_instructors)
- Application details panel in review dialog shows bio, specialties, certifications, scheduling_url

**Google OAuth flow fixes (`0ca3358`..`01652f3`):**
- Root cause: `handle_new_user` DB trigger sets `registration_status='complete'` (column default) for ALL new users, including Google OAuth — detection logic assumed `null`
- ProtectedRoute/Auth.tsx/Index.tsx: detect OAuth new users by `zero roles + provider === "google"` only (removed `!registrationStatus` condition)
- `complete-registration` edge function: idempotency guard now checks `user_roles` count too — was short-circuiting with `already_complete: true` before creating any roles
- `CompleteRegistration.tsx`: redirect to `/dashboard` only when `userRoles.length > 0` — prevents navigation loop
- Index.tsx: 500ms fast fallback for Google OAuth users (vs 6s for others)
- Added sign out button to `/complete-registration` page
- Both email signup and Google OAuth → role selection → dashboard flows confirmed working end-to-end on preprod

**Infrastructure fixes:**
- `_shared/cors.ts`: added `*.innotrue-hub-live.pages.dev` wildcard for Cloudflare Pages preview URLs
- `config.toml`: added `complete-registration` and `redeem-enrollment-code` with `verify_jwt = false`

---

## G8 — Self-Enrollment Codes (2026-02-25)

Self-enrollment via shareable codes/links. Admins generate enrollment codes per program; authenticated users redeem codes to self-enroll without admin intervention. Commits `0db6aa3`, `3558ddc`, 4 new files, 3 modified, 1 migration, 1 edge function. Deployed to all 3 environments (prod + preprod + sandbox).

**Database Migration (`20260225100000_g8_enrollment_codes.sql`):**
- `enrollment_codes` table: id, program_id, cohort_id (optional cohort assignment), code (unique), code_type (single_use/multi_use), max_uses, current_uses, grants_plan_id, grants_tier, discount_percent, is_free, expires_at, created_by, is_active
- RLS: admin full CRUD, authenticated users can view active codes (for validation)
- Indexes on code + program_id
- `client_enrollments.enrollment_code_id` FK to track which code was used
- `validate_enrollment_code(p_code)` SECURITY DEFINER RPC — validates code, returns program info + code validity as JSONB
- Notification type seed: `enrollment_code_redeemed` under programs category

**Edge Function (`redeem-enrollment-code/index.ts`):**
- Auth from Bearer token, service role client for atomic operations
- Validates code (active, not expired, not at max_uses, program active)
- Checks user not already enrolled (duplicate prevention)
- G8 scope: free codes only (`is_free = true` or `discount_percent = 100`); partial discounts return "coming soon"
- Calls `enroll_with_credits` RPC with `p_final_credit_cost = 0`, passes `p_cohort_id` from code
- Updates enrollment with `enrollment_code_id`, increments `current_uses`
- Notifies code creator via `create_notification` RPC

**Admin UI (`EnrollmentCodesManagement.tsx`):**
- Quick code generator card: select program → generate ENR code → copy shareable link
- Full CRUD table: Code (copy buttons), Program/Cohort, Type, Usage (X/Y), Enrollment details, Status badges (Active/Expired/Used Up/Inactive), Actions
- Create/Edit dialog: auto-generated or custom code, program selector, cohort selector (filtered by program), code_type, max_uses, grants_tier, is_free, discount_percent, expires_at, is_active, shareable link preview
- Uses `useAdminCRUD` hook + custom mutations

**Public Enrollment Page (`EnrollWithCode.tsx`):**
- Route: `/enroll` with optional `?code=` query param
- State machine: input → validating → valid → enrolling → enrolled → error
- Auto-validates code from URL via `validate_enrollment_code` RPC on mount
- Shows program info card with free/discount/tier badges
- Auth redirect: `/auth?redirect=/enroll?code={CODE}` for unauthenticated users
- Calls `redeem-enrollment-code` edge function for redemption
- Success redirects to program page

**Routing & Sidebar:**
- App.tsx: lazy imports + public route `/enroll` + admin route `/admin/enrollment-codes`
- AppSidebar.tsx: Ticket icon nav item in admin Programs submenu

**Files:** 4 new (`EnrollmentCodesManagement.tsx`, `EnrollWithCode.tsx`, migration, edge function), 3 modified (App.tsx, AppSidebar.tsx, types.ts)

## DP6 + DP7 — Psychometric Structured Results & Readiness Dashboard (2026-02-24)

**DP6 — Psychometric Structured Results:**
- Migration: `psychometric_result_schemas` (assessment_id, dimensions JSONB, version) + `psychometric_results` (user_id, assessment_id, schema_id, scores JSONB, entered_by, assessed_at) with full RLS
- Hook: `usePsychometricSchemas.ts` — fetch schemas, get latest per assessment, schema map, upsert mutation
- Hook: `usePsychometricResults.ts` — fetch user results, latest per assessment with trend previous, create/update mutations
- Admin UI: "Define Dimensions" button + dialog on `AssessmentsManagement.tsx` — dynamic dimension list (key/label/min/max), dimension count badge on cards
- Score entry: `PsychometricScoreEntryDialog.tsx` — slider + number input per dimension, assessment date, source description, notes
- Development Profile: `PsychometricScores.tsx` card — color-coded bars (green/amber/red), trend arrows, grouped by assessment

**DP7 — Readiness Dashboard:**
- Hook: `useReadinessDashboard.ts` — batch gate status computation, coach dashboard query (via instructor_assignments → staff_enrollments → guided_path_instantiations → gates), client readiness query. Alert levels: green (≥80% + on schedule), amber (<80% but on schedule), red (behind + unmet), stalled (30+ days no progress)
- Coach page: `ReadinessDashboard.tsx` at `/teaching/readiness` — stats row (clients on paths, average readiness, needing attention), sortable client table with alert badges, progress bars, click-through to StudentDevelopmentProfile
- Client widget: `MyReadiness.tsx` — per-path readiness with gate breakdown, current milestone, estimated completion date, "gates remaining" hints
- Sidebar nav: "Readiness" added to teaching items with Gauge icon
- Route: lazy-loaded in App.tsx with ProtectedRoute

**Files:** 7 new (1 migration, 3 hooks, 1 dialog, 1 card, 1 page), 6 modified (App.tsx, AppSidebar.tsx, AssessmentsManagement.tsx, DevelopmentProfile.tsx, StudentDevelopmentProfile.tsx)

## M2 + M11 — Quick Medium Wins (2026-02-20)

**M2 — Assessment Interest Status Tracking:**
- Added `AssessmentInterest` interface and state to `ClientDashboard.tsx`
- Fetch `assessment_interest_registrations` with `psychometric_assessments` join (name, provider)
- Added assessment interest cards with status badges (pending/contacted/completed/declined) matching existing program interest pattern
- Fixed AC interest cards: replaced hardcoded "Pending" badge with actual status from database
- Changed `ac_interest_registrations` query to fetch all statuses (removed `.eq("status", "pending")`)

**M11 — Console Statement Cleanup:**
- Removed 49 `console.log` and `console.warn` statements across 20 files
- **Files cleaned:** GroupSessionDetail, ClientDashboard, GroupDetail (client+admin), Auth, Calendar, Index, AccountSettings, OrgMembers, CapabilityAssessmentDetail, ModuleSessionManager, ContentPackageViewer, useAdminRefreshSignal, useAuditLog, useFeatureVisibility, useModuleSchedulingUrl, useModuleSessionCapability, useNotifications, tierUtils, pdfExport, feedbackPdfExport
- **Kept intentionally:** `console.error` (all), `vitals.ts` (web vitals), `ErrorBoundary.tsx` (error ID), `AuthContext.tsx` (localStorage warnings), `useAuthContext.ts` (auth context warning), `fileValidation.ts` (unknown bucket), `GuidedPathSurveyWizard.tsx` (unknown operator), `ContentPackageViewer.tsx` (xAPI warnings)
- Replaced empty catch variables with bare `catch {}` for unused error params
- Added descriptive comments where console statements were removed

## CT3 — Shared Content Packages & Cross-Program Completion (2026-02-20)

Shared content library and cross-program completion propagation. Upload Rise/xAPI packages once, assign to modules across programs. Completing content in one program auto-completes it in others. 1 migration, 4 edge functions modified, 3 new files, 5 modified files. Deployed to all 3 environments (prod + preprod + sandbox).

**CT3a — Shared Content Library:**

- **Migration (`20260224100000_ct3_shared_content_packages.sql`):** `content_packages` table (id, title, description, storage_path, package_type, file_count, original_filename, uploaded_by, is_active). `content_completions` table (user_id, content_package_id, completed_at, source_module_id, source_enrollment_id, result_score_scaled; UNIQUE on user_id+content_package_id). `program_modules.content_package_id` FK. RLS: admin ALL, staff SELECT, clients SELECT. Indexes, triggers, comments.
- **Upload edge function (`upload-content-package`):** 3 modes — Shared (title+file → `shared/{uuid}/`, creates `content_packages` row), Replace (contentPackageId+file → replaces ZIP in existing package), Legacy (moduleId+file → unchanged per-module). Extracted `cleanupStoragePath()` helper.
- **Serve edge function (`serve-content-package`):** Module query includes `content_package_id, content_packages(storage_path)`. Resolves `effectiveContentPath` from shared FK or legacy path.
- **xAPI Launch (`xapi-launch`):** Same FK resolution for `effectiveContentPath` and `effectivePackageType`.
- **Content Library Admin Page (`/admin/content-library`):** Stats cards (total, web, xAPI, modules using shared). Search/filter. Table with title, type badge, files, module count, date, uploader. Upload dialog (title+ZIP → shared mode). Replace dialog. Delete confirmation (blocks if modules reference). Detail dialog showing modules using package. Added to sidebar as first item in Resources section.
- **ModuleForm Integration:** Two-tab content package card (From Library / Upload New). Combobox picker from `useContentPackagesList()`. Upload New creates shared package and auto-assigns. "Migrate to Library" button for legacy modules. Removal clears both `content_package_id` and `content_package_path`.
- **ProgramDetail Integration:** Passes `contentPackageId` in `initialData` to ModuleForm. Saves `content_package_id` in add/update module functions.
- **Hook (`useContentPackages.ts`):** `useContentPackages()` (list all with counts), `useContentPackage(id)` (single with modules), `useContentPackagesList()` (simple list for picker), `useDeleteContentPackage()`, `useAssignContentPackage()`.

**CT3b — Cross-Program Completion:**

- **xAPI Statements edge function (`xapi-statements`):** After existing `module_progress` upsert on completion verb, looks up module's `content_package_id`. If set, upserts `content_completions(user_id, content_package_id, source_module_id, source_enrollment_id, result_score_scaled)`.
- **`useCrossProgramCompletion` hook:** Extended with `content_completions` as 3rd data source (alongside canonical_code and TalentLMS). Fetches user's content completions, resolves source module details, adds `completedVia: "content_package"` entries.
- **Client ModuleDetail auto-accept:** New `useEffect` checks if module has `content_package_id` and user has `content_completions` row. If found, auto-upserts `module_progress` to "completed" with toast notification. Also updated content package viewer condition to show for `content_package_id` (not just legacy path).
- **CanonicalCodesManagement page:** Renamed to "Cross-Program Linking". Added 3-tab layout: Canonical Codes (unchanged), Content Packages (new — shows packages assigned to modules across programs with "shared across N programs" badges), Unlinked (modules without codes). Stats row expanded with "Shared Content Packages" count.

## GT1, G9, G10, DP5, NTH-2, NTH-3, NTH-4 — Teaching Cohort Workflow & Enhancements (2026-02-23)

Full instructor/coach cohort teaching workflow, cohort analytics, session-linked homework, module↔domain mapping, smart notification routing, and client personal instructor visibility. Commit `ed0254b`, 3 migrations, 4 new pages/components, 8 modified files. Deployed to prod + preprod + Lovable.

**GT1 — Teaching Cohort Workflow (6 phases):**

- **Phase 1 — RLS Migration (`20260223100000_teaching_cohort_rls.sql`):** 4 policies for symmetric instructor/coach access: coach SELECT on `program_cohorts`, instructor+coach UPDATE on `cohort_sessions` (with WITH CHECK), upgrade coach attendance from SELECT-only to ALL on `cohort_session_attendance`.
- **Phase 2 — Cohorts List (`src/pages/instructor/Cohorts.tsx`):** Teaching cohorts list page following `Groups.tsx` pattern. Fetches program IDs from both `program_instructors` + `program_coaches`. Card grid with status badge, name, program, lead instructor, dates, enrolled/capacity, session count.
- **Phase 3 — Cohort Detail (`src/pages/instructor/CohortDetail.tsx`):** Main teaching cohort management page for both roles. Expandable session panels with: `CohortSessionAttendance` component (reused as-is), `SessionHomework` component (G10), recap editor (textarea + recording URL), Save/Save & Notify buttons via `notify_cohort_session_recap` RPC. Enrolled clients list with attendance summaries.
- **Phase 4 — Dashboard Integration (`InstructorCoachDashboard.tsx`):** Extended `UpcomingSession` interface with `source: "group" | "cohort"`, `cohort_id?`, nullable `group_id`. Added cohort sessions query in `loadAdditionalData` (merges with group sessions, sorts by date). Added Cohorts stat card. Updated session card navigation for cohort vs group.
- **Phase 5 — Sidebar + Routes:** Added `CalendarDays` icon Cohorts item to `teachingItems` in `AppSidebar.tsx`. Added lazy-loaded routes `/teaching/cohorts` and `/teaching/cohorts/:cohortId` in `App.tsx`.
- **Phase 6 — StudentDetail Integration:** Added cohort assignment card to `StudentDetail.tsx` — loads cohort info + attendance summary when enrollment has `cohort_id`. Shows cohort name, status badge, date range, attendance stats, link to cohort detail.

**G9 — Cohort Analytics Dashboard (`src/pages/admin/CohortAnalytics.tsx`):**
- Cross-program admin analytics: active cohorts, total enrolled, avg attendance %, avg completion %, at-risk count
- Per-cohort breakdown cards with attendance/completion progress bars
- At-risk client identification (<60% attendance OR <30% completion)
- Added to admin sidebar monitoring section + lazy-loaded route `/admin/cohort-analytics`

**G10 — Session-Linked Homework:**
- **Migration (`20260223100001_session_linked_homework.sql`):** Added `cohort_session_id UUID` to `development_items` with FK to `cohort_sessions`, partial index
- **Component (`src/components/cohort/SessionHomework.tsx`):** Bulk homework assignment for all enrolled clients per session. De-duplicated display by title, completion progress tracking per item. Integrated into CohortDetail expanded session view.

**DP5 — Module ↔ Domain Mapping:**
- **Migration (`20260223100002_module_domain_mapping.sql`):** `module_domain_mappings` table (module_id, capability_domain_id, relevance primary/secondary). RLS: admin ALL, staff SELECT, client SELECT. Indexes on both FKs.
- **Component (`src/components/admin/ModuleDomainMapper.tsx`):** Admin UI for tagging modules with assessment domains. Add/remove mappings with relevance selector, badge display. Added as "Domains" tab in admin `ProgramDetail.tsx` module editor.

**NTH-2 — Smart Notification Routing (`notify-assignment-submitted/index.ts`):**
- Added personal instructor priority check: queries `enrollment_module_staff` for the specific enrollment+module. If personal staff exists, only notifies them. Otherwise falls back to broadcast (module instructors/coaches → program instructors/coaches).

**NTH-3 — assessor_id Review:** Reviewed `assessor_id` on capability snapshots — correctly tracks who created the assessment while `scored_by` tracks the grader. No code change needed.

**NTH-4 — Client Sees Personal Instructor:**
- **`ModuleTeamContact.tsx`:** Added `enrollmentId` prop, queries `enrollment_module_staff` for personal instructor. Shows personal instructor with highlighted styling (primary color background, "Your Instructor/Coach" badge). Filters duplicates from general lists.
- **`ModuleDetail.tsx` (client):** Passes `enrollmentId={enrollment?.id}` to `ModuleTeamContact`.

## AI Reflection Prompt — Credit Gating & Error Handling Fix (2026-02-19)

Fixed AI reflection prompt failing silently for clients. Root cause: no feature gating, no credit consumption, generic error messages. Commit `96a2409`, 4 files, 117 insertions, 28 deletions. Edge function deployed to prod + preprod.

**Edge function (`generate-reflection-prompt/index.ts`):**
- Added specific HTTP responses for AI API rate limits (429 → `errorResponse.rateLimit()`) and credit exhaustion (402 → `errorResponse.badRequest()`) instead of throwing a generic server error

**Hook (`useReflectionPrompt.ts`):**
- Parses error response body from edge function via `invokeError.context.body.text()` to extract specific error messages
- Checks `data.error` for structured error responses returned in non-error HTTP status
- Shows specific messages (rate limit, credits, etc.) instead of generic "Failed to generate reflection prompt"

**Card component (`WeeklyReflectionCard.tsx`):**
- Added `useConsumableFeature("ai_insights")` — calls `consume()` before `generatePrompt()`, matching `DecisionInsights` pattern
- Generate buttons disabled when `canConsume` is false (no credits remaining)
- Shows "X credits remaining" below generate button when credits are available
- No-credits state: "No credits remaining" with Upgrade link (or "Contact your administrator" for max-plan users via `useIsMaxPlan`)
- Error state: icon + specific message + context-appropriate action (Retry for rate limits, Upgrade Plan for credit exhaustion, Retry for generic errors)

**Dashboard (`ClientDashboard.tsx`):**
- `WeeklyReflectionCard` gated behind `hasFeature("ai_insights")` — hidden entirely when user's plan lacks the feature

## Content Delivery Tier 2 — Rise xAPI Integration (2026-02-22)

Full Rise xAPI content integration with session management, auto-completion, and resume support. Three commits: `79738a5` (CSP fix + LMS mock), `f948be9` + `0f259bd` (URL rewriting + webpack chunk fix), `4422aac` (iframe stability fix), `6235bf4` (resume support). Deployed to prod + preprod.

**Rise xAPI Content Delivery:**
- **`xapi-launch` edge function:** Creates or resumes xAPI sessions. Validates JWT, checks enrollment/staff access, generates unique auth token per session. Returns xAPI config (endpoint, auth, actor, activityId) for frontend. Resume: finds existing active session (status `launched`/`initialized`), returns saved bookmark + suspend_data + reuses auth token.
- **`xapi-statements` edge function:** Lightweight LRS endpoint. POST stores xAPI statements with verb/object/result extraction. Auto-updates `module_progress` to `completed` on completion/passed/mastered verbs. PUT with `?stateId=bookmark|suspend_data` saves learner position. GET retrieves session statements. Session lifecycle: `launched` → `initialized` → `completed`/`terminated`.
- **`serve-content-package` edge function (enhanced):** Added CSP headers for blob URLs, inline scripts/styles, and Supabase domain connections. Injects `<script>` block that rewrites Rise's relative URLs (in `<script src>`, `<link href>`, CSS `url()`, dynamic `fetch()`, webpack chunk loading) to absolute URLs pointing at the edge function.
- **Migration `20260222100000_xapi_integration.sql`:** `program_modules.content_package_type` column (`web`/`xapi`), `xapi_sessions` table (auth_token, status lifecycle, FK to users/modules/enrollments, indexes), `xapi_statements` table (verb/object/result fields, raw_statement JSONB, indexes), RLS policies (users SELECT own, service role manages), auto-updated timestamps.
- **Migration `20260222200000_xapi_session_resume.sql`:** Added `bookmark` (TEXT) and `suspend_data` (TEXT) columns to `xapi_sessions` for Rise content resume support.

**ContentPackageViewer.tsx — Major Rewrite:**
- **LMS mock (`installLmsApiOnWindow()`):** Installs SCORM-compatible API functions on parent window: `IsLmsPresent`, `LMSIsInitialized`, `GetStudentName`, `GetBookmark`/`SetBookmark`, `GetDataChunk`/`SetDataChunk`, `GetEntryMode` (returns `resume`/`ab-initio`), `SetReachedEnd`, `SetPassed`, `SetProgressMeasure`, `SetFailed`, `Terminate`, `Finish`. Each setter persists state to backend via `saveState()` helper.
- **`saveState()` helper:** Sends `PUT ?stateId=bookmark|suspend_data` to xapi-statements endpoint with Basic auth. Fire-and-forget with error logging.
- **Resume data flow:** `xapi-launch` response includes `resumed`, `bookmark`, `suspendData`. Passed to `installLmsApiOnWindow()` which initializes mock state from saved values.
- **Completion polling:** 10-second interval checks `xapi_sessions.status` via Supabase query. On `completed`/`terminated`, sets `xapiCompleted` state and calls `onXapiComplete` callback.

**Iframe Stability Fixes (commit `4422aac`):**
- **JWT token refresh fix:** `accessToken` stored in `useRef` to prevent Supabase `TOKEN_REFRESHED` events from re-triggering content-loading useEffect and destroying iframe.
- **Callback stability:** `onXapiComplete` stored in ref (`onXapiCompleteRef`), `startCompletionPolling` made dependency-free with empty dependency array. Breaks the chain: inline arrow → callback recreated → useEffect re-runs → iframe destroyed.
- **Completion handler fix:** `src/pages/client/ModuleDetail.tsx` — replaced `window.location.reload()` with React state update (`setModule()`) + `toast.success("Module completed! 🎉")`.

**URL Rewriting for Rise Content:**
- Rise xAPI exports use relative paths (`lib/main.bundle.js`, `assets/...`, CSS `url(...)`)
- `serve-content-package` injects a script that:
  - Intercepts `<script>` and `<link>` tags, rewrites `src`/`href` to absolute edge function URLs
  - Overrides `window.fetch` to rewrite relative fetch URLs
  - Patches `Object.defineProperty` to intercept webpack's `__webpack_require__.p` (public path) and set it to the edge function base URL
  - Handles CSS `url()` references by rewriting `<style>` blocks
- Webpack chunk loading fixed by intercepting the property descriptor for the public path variable

## DP1-DP4 Development Profile (2026-02-19)

Assessment ↔ goal traceability, unified Development Profile page, assessment-gated milestones, and intake-driven path instantiation. Commit `c6b2e11`, 26 files, 3,519 insertions, 182 deletions. 3 migrations, 15 new files, 12 modified files.

**DP1 — Assessment ↔ Goal Traceability:**
- **Migration:** `20260219400000_dp1_goal_assessment_links.sql` — `goal_assessment_links` table with polymorphic FK refs to capability_assessments, capability_domains, capability_snapshots, assessment_definitions, psychometric_assessments. Score tracking: `score_at_creation`, `target_score`. RLS: owner, shared users (via `goal_shares`), coaches (via `client_coaches`), instructors (via `client_instructors`), admin.
- **`useGoalAssessmentLinks.ts`** — `useGoalAssessmentLink(goalId)` + `useCreateGoalAssessmentLink()` hooks with domain name joins.
- **`GoalForm.tsx`** — Collapsible "Linked Assessment" section: assessment type select → cascading domain/dimension → score inputs. `assessmentContext` prop for pre-population from assessment detail pages.
- **`GoalCard.tsx`** — Assessment origin badge: "📊 [Domain Name] (X/N)" when linked.
- **`GoalDetail.tsx`** — "Assessment Progress" section: score at creation → current → target progress bar, "Re-assess" link.

**DP2 — Development Profile Page:**
- **`DevelopmentProfile.tsx`** — 5-section unified page at `/development-profile`:
  - **StrengthsGapsMatrix** — capability snapshot domain averages (via `calculateDomainScore()`) + assessment definition dimension scores, normalized to %, color-coded (green/amber/red), trend arrows from evolution data.
  - **ActiveDevelopmentItems** — `development_items` + `development_item_links` grouped by domain, status badges.
  - **AssessmentGoalProgress** — goals joined with `goal_assessment_links`, progress bars + score overlay.
  - **SkillsEarned** — `user_skills` + `skills` + `skill_categories` badge grid.
  - **GuidedPathProgress** — active path survey responses with template goals, gate traffic-light indicators.
- **`StudentDevelopmentProfile.tsx`** — Coach/instructor/admin view reusing same sub-components with `userId` prop.
- **Router:** Lazy-loaded at `/development-profile` (client) and `/teaching/students/:enrollmentId/development-profile`.
- **Sidebar:** Added to `clientPlanningItems` in `AppSidebar.tsx`.

**DP3 — Assessment-Gated Milestones:**
- **Migration:** `20260220400000_dp3_milestone_gates.sql` — `guided_path_milestone_gates` (template_milestone_id, assessment/domain refs, min_score, gate_label) + `milestone_gate_overrides` (goal_milestone_id, gate_id, overridden_by, reason). RLS: gates SELECT all auth / INSERT+UPDATE+DELETE admin only; overrides SELECT via goal chain / INSERT for coach+instructor+admin / DELETE admin only.
- **`MilestoneGateDialog.tsx`** — Admin gate config: assessment type → domain/dimension → min_score → gate_label.
- **`MilestoneGateStatus.tsx`** — Traffic-light indicators: 🟢 met or overridden, 🟡 within 1 point, 🔴 below threshold, ⚪ no data.
- **`WaiveGateDialog.tsx`** — Coach/instructor override with required reason field.
- **`useMilestoneGates.ts`** — `useMilestoneGates(templateMilestoneId)` + `useMilestoneGateStatus(goalMilestoneId, userId)`.
- **`GuidedPathTemplateDetail.tsx`** — "Gates" sub-section per milestone in admin view.

**DP4 — Intake-Driven Path Instantiation:**
- **Migration:** `20260221400000_dp4_path_instantiation.sql` — `guided_path_instantiations` table (user_id, template_id, survey_response_id, pace_multiplier, started_at, estimated_completion_date, status). `goals` table altered: `template_goal_id` + `instantiation_id` columns.
- **`guidedPathInstantiation.ts`** — Shared service: `instantiateTemplate()` creates instantiation record → fetches template goals/milestones/tasks → creates goals with `template_goal_id` + `instantiation_id` → pace-adjusted milestone due dates → creates tasks. Returns `InstantiationResult` with counts + estimated completion. `estimateCompletionDate()` for preview.
- **`PathConfirmation.tsx`** — Shown after survey: matched template summary, pace selector (Intensive 0.7x / Standard 1.0x / Part-time 1.5x), start date picker, estimated completion display, "Create My Path" button.
- **`GuidedPathSurveyWizard.tsx`** — Added PathConfirmation as final step instead of immediate save+navigate. Survey wizard bug ✅ fixed.
- **`GuidedPathDetail.tsx`** — Refactored inline `copyMutation` (206-339 lines) to use shared `instantiateTemplate()`.

## G1-G7 Cohort Scheduling Gaps (2026-02-18 – 2026-02-19)

Three commits resolving 7 of 10 identified cohort scheduling gaps. `fddd72a` (G1+G2), `b858d38` (G3+G5), `a0bc2ad` (G4+G6+G7).

- **G1 — Cohort assignment on enrollment:** Migration adds `p_cohort_id` parameter to `enroll_with_credits` RPC. Enrollment form shows cohort dropdown when program has cohorts. Auto-assigns client to selected cohort on enrollment.
- **G2 — Google Meet link automation:** Reuses `google-calendar-create-event` edge function pattern. Auto-generates Meet link when creating cohort sessions. Stored in `cohort_sessions.meeting_link`.
- **G3 — Instructor on cohort/session:** Migration adds `program_cohorts.lead_instructor_id` and `cohort_sessions.instructor_id` FK columns. Admin UI: instructor dropdowns on cohort and session forms. Instructor name shown on session cards.
- **G4 — Attendance tracking:** New `cohort_session_attendance` table (session_id, user_id, status [present/absent/excused/late], marked_by, notes). RLS: instructors/coaches can mark, clients read own, admin full. `AttendanceTracker.tsx` component on session detail.
- **G5 — Recurring session generation:** "Generate Sessions" bulk action on cohort management. Inputs: recurrence (weekly/biweekly), day of week, time, timezone, count. Creates N sessions linked to sequential modules.
- **G6 — Session notifications/reminders:** `send-schedule-reminders` edge function. Sends email 24h and 1h before session. Uses `create_notification` RPC for in-app. Triggered by pg_cron job.
- **G7 — Session notes/recap:** Migration adds `cohort_sessions.recording_url`, `cohort_sessions.summary`, `cohort_sessions.action_items` (JSONB). Session recap section visible to participants after session. Instructor can edit notes.

## P0 Tier 1 — Content Delivery + CohortDashboard + Join Session (2026-02-18)

Three features enabling live cohort program delivery end-to-end. Commit `6ab2ca5`, 16 files, 1,740 insertions.

**Feature A — Content Delivery Tier 1 (auth-protected):**
- **Migration:** `20260218300000_add_content_package_path.sql` — `content_package_path` TEXT on `program_modules`, private `module-content-packages` storage bucket (500MB limit)
- **`serve-content-package` edge function:** Auth-gated proxy. Validates JWT, checks enrollment/role, serves files from private storage. Injects `<base>` tag + fetch rewrite script into HTML for Rise relative path resolution. Non-HTML: 24h cache. HTML: 5min private cache.
- **`upload-content-package` edge function:** Admin-only. Accepts ZIP via multipart form, extracts with JSZip, uploads to `{moduleId}/{uuid}/`, verifies `index.html`, cleans up previous package, updates `content_package_path`.
- **Admin UI:** Content Package upload card in `ModuleForm.tsx` (edit mode only). Progress bar, remove button, file validation.
- **Client embed:** iframe in `ModuleDetail.tsx` with `sandbox="allow-scripts allow-same-origin allow-forms allow-popups"`, 75vh min-height
- **Instructor preview:** iframe in instructor `ModuleDetail.tsx` Overview tab
- **ProgramDetail.tsx:** Passes `id` + `contentPackagePath` to ModuleForm initialData
- **fileValidation.ts:** Added `module-content-packages` preset (ZIP only, 500MB)

**Feature B — CohortDashboard:**
- **`CohortDashboard.tsx`:** Route `/programs/:programId/cohort`. Loads enrollment → cohort → sessions (with module title join) → module progress → group. Sections: breadcrumb, cohort header, next session highlight, session timeline, "Add All to Calendar", module progress bar, group section.
- **`App.tsx`:** Lazy-loaded route with ProtectedRoute + DashboardLayout
- **`ProgramDetail.tsx` (client):** "Cohort Schedule" card with navigate to CohortDashboard
- **`Calendar.tsx`:** Click handler for cohort_session events → navigates to CohortDashboard

**Feature C — Join Session One-Click:**
- **`useSessionTimeStatus.ts`:** Reactive hook (30s interval). Returns label ("Upcoming"/"Starts in X min"/"Live Now"/"Ended"), variant, isJoinable.
- **`CohortSessionCard.tsx`:** New component with time-aware status badge, pulsing "Join Now" button, ICS download, module link, highlighted variant.
- **`GroupSessionCard.tsx`:** Enhanced with `useSessionTimeStatus` hook, time-aware badge, pulsing join.
- **`ClientDashboard.tsx`:** "Next Live Session" widget fetching next cohort session across all enrollments.

## P0 — Staff Onboarding + Async Notifications (2026-02-18)

7 features for coach/instructor onboarding and assignment workflow. Commit `5865146`, 9 files, 1,194 insertions.

- **`StaffWelcomeCard.tsx`:** 4-step onboarding checklist (profile, students, assignments, sessions) on teaching dashboard. Auto-hides on dismiss (localStorage).
- **Account Settings:** Staff Profile section with bio, specializations, company fields.
- **`InstructorCoachDashboard.tsx`:** Enhanced empty states with "what to expect" context.
- **`PendingAssignments.tsx`:** "My Queue" filtering via `enrollment_module_staff` + "All" toggle. Assignment count badges.
- **`TransferAssignmentDialog.tsx`:** Transfer grading between staff members. Dropdown of eligible staff, updates assignment record.
- **`send-welcome-email`:** Role-specific variants (instructor/coach/client) with different content.
- **`notify-assignment-submitted` + `notify-assignment-graded`:** Refactored to async delivery via `create_notification` RPC (non-blocking). Reduced complexity.

## Development Profile & Assessment-Driven Guided Paths — Analysis (2026-02-18)

Strategic analysis and 7-phase implementation plan approved for development. Connects 3 assessment systems + development items + goals + guided paths into a unified development journey.

**Document:** `docs/DEVELOPMENT_PROFILE_ANALYSIS.md` — full analysis including:
- Current state audit of all assessment, development item, goal, and guided path tables
- Gap analysis: systems exist but don't talk to each other (no assessment→goal FK, survey wizard doesn't instantiate templates)
- 7-phase plan (DP1-DP7): assessment↔goal traceability, Development Profile page, assessment-gated milestones, intake-driven path recommendation, module↔domain mapping, psychometric structured results, readiness dashboard
- 6 new database tables, 2 altered columns, ~18-28 days total
- UX wireframes for Development Profile and Readiness Dashboard
- Key design decisions: gates advisory not blocking, intake-driven not backward planning, manual-first for psychometrics

**Roadmap updates:** MEMORY.md, ISSUES_AND_IMPROVEMENTS.md updated with DP1-DP7 items in execution order and data tables section.

## R1 — Assessment Question Types & Weighted Scoring (2026-02-18)

Added dynamic question type categorization and weighted scoring to capability assessments. Fully backward-compatible — assessments without types work exactly as before.

**Migration:** `20260218200000_add_assessment_question_types.sql` — 3 new columns:
- `capability_assessments.question_types` (JSONB) — admin-defined types with weights, e.g., `[{"name":"Knowledge","weight":30},{"name":"Judgement","weight":50},{"name":"Communication","weight":20}]`
- `capability_domain_questions.question_type` (TEXT) — which type a question belongs to (nullable)
- `capability_domain_questions.type_weight` (NUMERIC) — optional per-question weight override

**Scoring helper:** `src/lib/assessmentScoring.ts` with 16 unit tests in `src/lib/__tests__/assessmentScoring.test.ts`:
- `parseQuestionTypes()` — parses and validates JSONB input
- `validateTypeWeights()` — checks weights sum to 100 (with floating-point tolerance)
- `calculateDomainScore()` — returns `{simpleAverage, weightedAverage, typeSubtotals, questionCount}`
- `calculateTypeScores()` — cross-domain type averages for radar chart types mode

**Admin UI** (`CapabilityAssessmentDetail.tsx`):
- "Question Types" configuration card — add/edit/delete types with name + weight, sum-to-100 validation (green/amber indicator)
- Question type dropdown + weight override input in question create/edit dialog (only shown when types configured)
- Type badge on question list items

**Client form** (`CapabilitySnapshotForm.tsx`):
- Type label badge next to each question
- Domain score displays weighted average when types configured ("Weighted" badge instead of "Avg")
- Type subtotals section below domain questions (per-type averages with bars)

**Snapshot view** (`CapabilitySnapshotView.tsx`):
- Read-only type badges on questions + type subtotals (same pattern as form)

**Evolution chart** (`CapabilityEvolutionChart.tsx`):
- "By Domains" / "By Question Types" Select toggle (only visible when types configured)
- Types mode: radar chart axes are question types showing cross-domain type averages

## Coach-Created Development Items (2026-02-18)

Added UI entry point for coaches/instructors to create development items for clients from the Student Detail page. No backend changes needed — uses existing `create-client-development-item` edge function and `DevelopmentItemDialog` component (already supports instructor mode via `forUserId` prop).

**StudentDetail.tsx changes:**
- "+" button per module row in Actions column (alongside ManualCompletionControls)
- Opens `DevelopmentItemDialog` with `forUserId={studentInfo.id}` and `moduleProgressId={module.id}`
- Custom dialog title: "Add Development Item for {student name}"

## H6, H9, M14, H10 — Feature Improvements (2026-02-16)

**H6 — Feature gate messaging for max-plan users:**
Added `useIsMaxPlan` hook and `isMaxPlanTier()` utility in `planUtils.ts`. When user is on the highest purchasable plan, `FeatureGate` and `CapabilityGate` show "Feature Not Available — Contact your administrator" instead of "Upgrade Plan". 8 unit tests.

**H9 — Edge function error handling standardization:**
Created shared `supabase/functions/_shared/error-response.ts` with typed helpers: `errorResponse.badRequest()`, `.unauthorized()`, `.forbidden()`, `.notFound()`, `.rateLimit()`, `.serverError()`, `.serverErrorWithMessage()` and `successResponse.ok()`, `.created()`, `.noContent()`. Migrated 5 high-impact functions (create-checkout, generate-reflection-prompt, check-ai-usage, course-recommendations, decision-insights) from generic 500s to proper status codes. Also upgraded from wildcard CORS to origin-aware `getCorsHeaders`.

**M14 — Inconsistent loading/error states:**
Created reusable `PageLoadingState` component (4 variants: centered, card, skeleton, inline) and `ErrorState` component (card/inline with retry). Migrated 5 pages: ClientDashboard, Academy, Community, Goals, ProgramDetail.

**H10 — Entitlement org deny override:**
Added `is_restrictive` boolean column to `plan_features` (migration `20260216200000`). Updated `useEntitlements` merge logic: deny entries (`isDenied=true`) override ALL grants from any source. Updated `fetchOrgSponsoredFeatures` and `checkFeatureAccessAsync` to respect deny. Added admin UI toggle (Deny checkbox + Ban icon) in Features Management > Plan Configuration. Full documentation in `docs/ENTITLEMENTS_AND_FEATURE_ACCESS.md`.

## Lovable Removal (2026-02-09)
Removed all Lovable dependencies, replaced OAuth with Supabase built-in, updated all domain refs, moved assets from /lovable-uploads/ to /assets/, swapped AI gateway to Vertex AI, updated edge functions CORS.

## Staging Email Override (2026-02-09)
Wired staging email override into all 13 email-sending edge functions. When `APP_ENV=staging` and `STAGING_EMAIL_OVERRIDE` is set, all emails redirect to the override address with original recipient shown in subject line.

**Shared helpers** in `_shared/email-utils.ts`:
- `getStagingRecipient(email)` — returns override or original email
- `getStagingRecipients(emails[])` — array version
- `getStagingSubject(subject, originalRecipient)` — prefixes subject with `[STAGING -> original@email]`

**13 wired functions** (2 email patterns):
- Resend SDK pattern (8): `send-auth-email`, `send-welcome-email`, `send-org-invite`, `send-wheel-pdf`, `subscription-reminders`, `signup-user`, `request-account-deletion` (2 send calls), `check-ai-usage`
- Fetch API pattern (5): `send-notification-email`, `notify-assignment-graded`, `notify-assignment-submitted`, `decision-reminders`, `process-email-queue`

## Database Seed File (2026-02-09)
Comprehensive `supabase/seed.sql` (runs automatically on `supabase db reset`). 12 sections covering system settings, plans, features, tracks, session types, credits, notifications, wheel categories, sample programs, demo users, platform terms.

**Demo Credentials:** Admin (`doina.popa@innotrue.com`), Client (`sarah.johnson@demo.innotrue.com`), Client (`michael.chen@demo.innotrue.com`), Coach (`emily.parker@demo.innotrue.com`) — all `DemoPass123!`

## Staging Environment Setup (2026-02-10)
Both preprod and prod have 393 migrations + seed + 60 edge functions. Cloudflare Pages auto-deploys. Google OAuth working. Fixed 7 stale `innotruehub.com` fallbacks.

## Code Splitting (2026-02-09)
Main bundle: 5.3MB → 977KB (82% reduction). All 160+ page components lazy-loaded.

## GitHub Actions CI (2026-02-11)
`.github/workflows/ci.yml` — lint, typecheck, test, build on push/PR. 8 ESLint rules downgraded to warnings (931 pre-existing violations). CI passes ~1m.

## Sentry Error Monitoring (2026-02-11)
`@sentry/react@10.38.0`, production only (gated by VITE_SENTRY_DSN + VITE_APP_ENV). DSN: `https://53c8f56b03ee0ae03b41eb79dd643cbd@o4510864206659584.ingest.de.sentry.io/4510864215703632`.

## Web Vitals Monitoring (2026-02-11)
`web-vitals@5.1.0`, tracks CLS/INP/LCP/FCP/TTFB. Production → Sentry; Development → console.

## PWA Hardening (2026-02-11)
Excluded auth/callback from SW. CacheFirst static (30d), NetworkFirst Supabase API (5min), CacheFirst storage (7d).

## Cursor IDE Setup (2026-02-11)
`.cursorrules`, `.vscode/settings.json`, `.vscode/extensions.json`. Agent mode default, Auto model.

## Security Audit (2026-02-12)
**RLS:** 276 tables, all RLS enabled. 41 with policies, 235 locked down. 30 gaps found (5 critical, 9 high, 16 medium). Fix plan in `docs/RLS_FIX_PLAN.md`.
**Edge Functions:** 23 proper validation, 28 partial, 6 none, 6 N/A.

## Strict TypeScript (2026-02-12)
Phase 1: 7 strict flags enabled, 26 errors fixed.
Phase 2: `strictNullChecks` enabled, 245 errors fixed across 76 files. All flags active, 0 errors.

## Pilot Auth Lockdown (2026-02-13)
Self-registration disabled, Google sign-in hidden. All marked with `/* ... during pilot */` comments.

## Storage Bucket Fix (2026-02-13)
`module-assessment-attachments` bucket created on all 3 projects. 15 buckets total.

## Environment Configuration (2026-02-13)
41 env vars audited. `docs/ENVIRONMENT_CONFIGURATION.md` created. Full isolation setup completed.

## Cal.com Organization Upgrade (2026-02-13)
Org tier ($37/mo), `innotrue-gmbh.cal.com`, preprod subteam, event-type-level webhooks, separate keys per env.

## RLS Deferred Items (2026-02-14)
#2.6 already resolved, #2.7 false positive, #2.8 fixed (migration), #3.11 fully resolved.

## Stripe Environment Fix (2026-02-14)
Removed 8 hardcoded price IDs from `Subscription.tsx`. Now reads from `plan_prices` table per-env.

## Resource Library Visibility Cleanup (2026-02-14)
Removed `is_published` column. Visibility now fully `private`/`enrolled`/`public`. RLS via `can_access_resource()`.

## Lovable Sync Pipeline (2026-02-14)
Bidirectional sync: `npm run sync:lovable` (import) and `npm run update:lovable` (export). Auto-excludes config files.

## Supabase Ops Scripts (2026-02-14)
4 scripts: `deploy:functions`, `push:migrations`, `sync:data`, `sync:storage`. All support `--dry-run`.

## Send Auth Email Hook Fix (2026-02-14)
Replaced Bearer token with Standard Webhooks HMAC. Fixed confirmation link to use `SUPABASE_URL`. New env: `SEND_EMAIL_HOOK_SECRET`.

## Forgot Password Flow (2026-02-14)
"Forgot password?" link on login → email form → `resetPasswordForEmail` → confirmation view.

## Resend Consolidation (2026-02-14)
1 API key, 1 domain (`mail.innotrue.com`). SMTP configured in Supabase Dashboard.

## Profiles RLS Fix (2026-02-14)
`client_can_view_staff_profile()` SECURITY DEFINER function to prevent circular RLS. Migration `20260214200000`.

## Comprehensive Platform Analysis (2026-02-15)
Created `docs/ISSUES_AND_IMPROVEMENTS.md` (11 parts, ~1700 lines) — full platform analysis:
- Part 1: Code quality bugs (15 issues)
- Part 2: Integration ecosystem analysis
- Part 3: Enhancement opportunities
- Part 4: Competitive analysis
- Part 5: Onboarding analysis (coaches, orgs, clients)
- Part 6: Gen Z/young generation UX
- Part 7: Self-signup flow analysis
- Part 8: User behavior flow analysis (all roles)
- Part 9: Capability assessments, scenarios, feedback, resources
- Part 10: Psychometric assessments
- Part 11: Consolidated roadmap (C1-C4, H1-H10, M1-M16, 9 phases)

Created `docs/DATA_CONFIGURATION_GUIDE.md` (~900 lines) — comprehensive data model reference:
- 5-layer dependency chain (Foundations → Plans → Sessions/Credits/Notifications/Assessments → Programs → Users)
- 3 assessment systems documented (Capability, Assessment Definitions, Psychometric)
- Feature area details: Assignments, Scenarios, Sessions, Resources
- Coaching/staff config, integration data, feedback/goal tracking
- 8-step data population plan + verification checklist
- Future data tables (19 entries) mapped to roadmap phases

## Phase 5 Remaining + R2/R3/R4 (2026-03-26)

### Phase 5 Step 7: Wheel of Life → Signup Pipeline
- Created `submit-wheel-intent` edge function — public (no JWT), upserts `ac_signup_intents` via service role
- Modified `WheelAssessment.tsx` — replaced direct `supabase.from("ac_signup_intents").insert()` (blocked by RLS) with edge function invocation
- Modified `signup-user` — stores `plan_interest` in `signup_verification_requests`
- Modified `verify-signup` — resolves plan interest from `signup_verification_requests` → `ac_signup_intents` fallback, updates intent status to "registered", applies resolved plan to profile

### Phase 5 Step 9: Bulk User Import
- Created `bulk-create-users` edge function — admin-only, batch creation (max 200), creates auth user + profile + roles + client_profiles + plan + notification_preferences
- Created `BulkUserImport.tsx` — 4-step dialog (upload → preview → importing → results), CSV drag-drop with Papa Parse, row validation, batch processing (50/batch), progress bar, results download
- Modified `UsersManagement.tsx` — added "Import Users" button

### R2: Teaching Quick-Start Guide
- Created `TeachingGuide.tsx` at `/teaching/guide` — quick actions grid (6 nav buttons), 5-step getting started checklist, 9-question FAQ accordion, role explanation cards (coach vs instructor)
- Modified `App.tsx` — lazy import + route
- Modified `AppSidebar.tsx` — added "Teaching Guide" nav item with HelpCircle icon

### R3 Phase 1: Enhanced Coach↔Client Interaction
- Created `CoachingSessionNotes.tsx` — structured coaching session notes stored as JSON in `client_staff_notes` (note_type: "coaching_session"), timeline display with summary/action items/next steps, "Log Session" dialog
- Modified `StudentDetail.tsx` — added Quick Actions bar (Development Item, Development Profile, View Assignments, Add Staff Note), added CoachingSessionNotes component

### R4: Coach Client Invite System
- Created migration `20260326140000_phase5_r4_coach_invites.sql` — `coach_client_invites` table with id, coach_id, email, name, message, token, status, linked_user_id, expires_at; indexes; RLS policies (coach own, client by email, admin full)
- Created `send-coach-invite` edge function — coach/instructor auth required, auto-links existing users via `client_coaches`/`client_instructors`, creates pending invite with token for new users, sends Resend email
- Created `InviteClientDialog.tsx` — dialog with Send Invite tab (email/name/message form) and History tab (invite status table)
- Modified `InstructorCoachDashboard.tsx` — added "Invite Client" button (visible for coaches)
- Modified `verify-signup` — auto-links pending coach invites on new user signup (creates coach/instructor relationships, marks invites accepted)

**Files changed:** 19 files, 2255 insertions
**New edge functions (3):** `submit-wheel-intent`, `bulk-create-users`, `send-coach-invite`
**New components (4):** `BulkUserImport.tsx`, `CoachingSessionNotes.tsx`, `InviteClientDialog.tsx`, `TeachingGuide.tsx`
**New migration:** `20260326140000_phase5_r4_coach_invites.sql`
**Deployed:** All 3 environments + Lovable + 79 edge functions + migration
