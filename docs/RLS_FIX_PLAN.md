# RLS Policy Fix Plan

Comprehensive audit completed 2026-02-12. Cross-referenced all 393 migrations, all frontend `.from()` queries, and all 63 edge functions.

## Corrections from Initial Audit

After verification against actual migration files:
- ~~`scenario_categories` zero policies~~ — **FALSE POSITIVE**: Has admin ALL + staff SELECT policies
- ~~`module_assignments` unknown policies~~ — **FALSE POSITIVE**: Has 5 policies (admin ALL, assessor ALL, client SELECT, coach SELECT, instructor SELECT with is_private respect)
- `email_change_requests` — SELECT is intentionally `USING (false)` with a safe VIEW replacement. **Not a bug** — frontend should use `email_change_requests_safe` view instead

## Priority 1: CRITICAL (Migration A)

### 1.1 `ac_signup_intents` — Public page INSERT/UPDATE broken
**Problem:** `WheelAssessment.tsx` (public page) performs INSERT/UPDATE, but only admin ALL policy exists.
**Fix:** Add authenticated INSERT + UPDATE policies (the page uses `supabase` client = authenticated).
**Risk:** Low — adds write access for authenticated users only, scoped to own records.

### 1.2 `module_progress` — Module-level instructors/coaches lost SELECT
**Problem:** Migration `20251214` removed module-level instructor/coach access. Only program-level primary instructors and program-level coaches remain.
**Fix:** Add back `module_instructors` and `module_coaches` OR clauses to the existing SELECT policy.
**Risk:** Low — restores previously-existing access that was accidentally removed.

### 1.3 `client_enrollments` — Staff missing SELECT (breaks `staff_enrollments` view)
**Problem:** `staff_enrollments` view uses `security_invoker = on`, but `client_enrollments` has no staff SELECT policy.
**Fix:** Add SELECT policy for instructors/coaches via `program_instructors`/`program_coaches`.
**Risk:** Low — staff could already see enrollment data through other queries; this formalizes it.

## Priority 2: HIGH (Migration B)

### 2.1 `notifications` — Admin can't see other users' notifications
**Problem:** `NotificationsManagement.tsx` queries all notifications, but only `user_id = auth.uid()` policy exists.
**Fix:** Add admin SELECT policy.

### 2.2 `email_queue` — Admin DELETE missing
**Problem:** `EmailQueueManagement.tsx` performs `.delete()`, but only SELECT + UPDATE policies exist.
**Fix:** Add admin DELETE policy.

### 2.3 `module_client_content_resources` — Staff policies too broad
**Problem:** Any instructor/coach can manage ALL clients' resources, not just their own clients.
**Fix:** Replace instructor/coach ALL policies with `staff_has_client_relationship` scoped versions.

### 2.4 `scenario_assignments` — Client DELETE missing
**Problem:** Frontend `useScenarioAssignments.ts` performs `.delete()`, but clients only have SELECT/INSERT/UPDATE.
**Fix:** Add client DELETE policy for draft/submitted assignments.

### 2.5 `module_scenarios` — Staff missing write access
**Problem:** Frontend hook does INSERT/UPDATE/DELETE, but only admin has write access.
**Fix:** Add instructor/coach ALL policies scoped via `is_program_instructor_or_coach`.

### ~~2.6 `assessment_option_scores` + `assessment_interpretations` — Public exposure~~
**RESOLVED:** Scoring already moved server-side via `compute-assessment-scores` edge function (uses `service_role`). Both tables tightened to admin-only SELECT in migrations `20260212190000` (authenticated-only) and `20260212200000` (admin-only). Frontend returns computed scores only, never raw scoring matrix. No further action needed.

### 2.7 `sessions` + related tables — Overly permissive staff ALL
**Problem:** Any instructor/coach has FOR ALL on ANY session record.
**Decision needed:** Scope to related sessions only, OR accept broad access.
**Action:** Flag for future sprint — requires careful analysis of all session workflows.

### 2.8 `group_session_participants` — Staff overpermission on SELECT
**Problem:** SELECT policy allows any instructor/coach to view ALL participants platform-wide (not group-scoped).
**Fix:** Scope instructor/coach access via `group_memberships` (same check used for regular users). Admin retains broad access.
**Migration:** `20260214180000_rls_fix_group_session_participants.sql`

## Priority 3: MEDIUM (Migration C)

### 3.1 `notification_preferences` — Admin can't manage for other users
**Fix:** Add admin SELECT + UPDATE policies.

### 3.2 `capability_domain_notes` + `capability_question_notes` — No instructor SELECT for shared
**Fix:** Add instructor SELECT policies matching the existing coach SELECT pattern.

### 3.3 `cohort_sessions` — No coach policy
**Fix:** Add coach SELECT policy matching the instructor pattern.

### 3.4 `assessment_interest_registrations` — Users can't update/delete own
**Fix:** Add user UPDATE + DELETE policies.

### 3.5 `user_assessments` — Admin lacks UPDATE/DELETE
**Fix:** Change admin SELECT to admin ALL.

### ~~3.6 `group_check_ins` — No admin ALL after re-creation~~
**FALSE POSITIVE:** Migration `20251226144743` already added admin ALL + full member policies (SELECT, INSERT, UPDATE, DELETE).

### ~~3.7 `group_tasks` + `group_notes` — No DELETE for members~~
**FALSE POSITIVE:** Migration `20251226144743` already added creator DELETE policies ("Task creators can delete their tasks", "Note creators can delete their notes").

### ~~3.8 `group_memberships` — Only SELECT exists~~
**FALSE POSITIVE:** Already has admin ALL policy ("Admins can manage all memberships").

### ~~3.9 `group_interest_registrations` — No SELECT for own, no admin policy~~
**FALSE POSITIVE:** Already has admin ALL + user SELECT + user INSERT policies.

### ~~3.10 `email_change_requests` — Frontend queries base table~~
**NOT NEEDED:** `AccountSettings.tsx` only does INSERT (not SELECT) on the base table. The `USING(false)` SELECT policy doesn't affect INSERTs. The safe view is for reading only. No change required.

### ~~3.11 `resource_library_skills` + `resource_library_programs` — `is_published` vs `visibility`~~
**RLS RESOLVED:** Migration `20260212190000` already updated both tables' SELECT policies to use `can_access_resource()` (which checks the new `visibility` field). RLS is correct.
**Frontend cleanup remaining:** `MyResources.tsx` still filters by deprecated `is_published` field, and admin UI still toggles `is_published` instead of `visibility`. This is a functional inconsistency, not a security risk. Deferred to frontend cleanup sprint.

## Deferred Items — Re-assessed 2026-02-14

| Item | Status | Notes |
|---|---|---|
| Assessment scoring exposure (#2.6) | ✅ **RESOLVED** | Already server-side via `compute-assessment-scores` edge function. RLS tightened to admin-only in migrations `20260212190000` + `20260212200000`. |
| Sessions "overly permissive" (#2.7) | ✅ **FALSE POSITIVE** | Re-verified: migration `20260113132730` recreated the instructor/coach policy with proper scoping (module-level + program-level via `is_program_instructor_or_coach`). Admin ALL, Client SELECT/INSERT, and Instructor/Coach ALL policies all exist and are correctly scoped. |
| Group session participants (#2.8) | ✅ **FIXED** | Migration `20260214180000`: Scoped instructor/coach SELECT to groups they're members of (via `group_memberships`). Admin retains broad access. |
| Resource library visibility model (#3.11) | ✅ **RLS RESOLVED** | Migration `20260212190000` already updated policies to use `can_access_resource()`. Frontend still references deprecated `is_published` — cosmetic cleanup deferred. |

## Deployment Plan

1. Create migrations on `develop` branch
2. Run `npm run verify` (lint + typecheck + test + build)
3. Apply to Lovable sandbox Supabase via SQL Editor
4. Apply to preprod Supabase via SQL Editor
5. Test affected pages on preprod
6. Apply to prod Supabase via SQL Editor
7. Commit + PR to propagate migration files

## Migration Files

- `20260212180000_rls_fix_critical.sql` — Priority 1 fixes
- `20260212180100_rls_fix_high.sql` — Priority 2 fixes
- `20260212180200_rls_fix_medium.sql` — Priority 3 fixes
- `20260212190000_rls_fix_deferred.sql` — Deferred items (#2.6, #2.7, #3.11)
- `20260212200000_assessment_scoring_server_side.sql` — Assessment scoring admin-only
- `20260214180000_rls_fix_group_session_participants.sql` — #2.8 staff scoping fix

## Deployment Status

**Verified: 2026-02-21** via `supabase migration list --linked`

All 6 RLS fix migrations are **deployed to production** and active.

| Migration | Status | Notes |
|-----------|--------|-------|
| `20260212180000_rls_fix_critical.sql` | ✅ Deployed | Priority 1: ac_signup_intents, module_progress, client_enrollments |
| `20260212180100_rls_fix_high.sql` | ✅ Deployed | Priority 2: notifications, email_queue, module_client_content_resources, scenario_assignments, module_scenarios |
| `20260212180200_rls_fix_medium.sql` | ✅ Deployed | Priority 3: notification_preferences, capability notes, cohort_sessions, assessment_interest_registrations, user_assessments |
| `20260212190000_rls_fix_deferred.sql` | ✅ Deployed | Assessment scoring authenticated-only, resource library visibility |
| `20260212200000_assessment_scoring_server_side.sql` | ✅ Deployed | Assessment scoring tightened to admin-only SELECT |
| `20260214180000_rls_fix_group_session_participants.sql` | ✅ Deployed | Staff SELECT scoped to own groups |

### Post-deployment Audit (2026-02-21)

Cross-referenced all 6 RLS fix migrations against 15+ later migrations (Feb 14–25) to check for regressions:

- **22 of 23 tables**: Policies from RLS fix migrations are **still active and unchanged**
- **1 table correctly overridden**: `assessment_option_scores` and `assessment_interpretations` — policies were intentionally dropped by later migration `20260214160000` because scoring moved entirely server-side via `compute-assessment-scores` edge function. This is a security improvement (less exposure), not a regression.
- `cohort_sessions`: Later migration `20260225` added compatible new policies (facilitator access) without removing any existing ones. No conflict.

**Conclusion:** No security regressions. All RLS fixes remain effective.
