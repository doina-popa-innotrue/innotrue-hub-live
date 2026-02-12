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

### 2.6 `assessment_option_scores` + `assessment_interpretations` — Public exposure
**Problem:** Anonymous users can read scoring matrix and interpretation rules (reveals answer key).
**Decision needed:** Move scoring server-side via edge function, OR accept the exposure for now.
**Action:** Flag for future sprint — requires frontend refactor to compute scores via edge function.

### 2.7 `sessions` + related tables — Overly permissive staff ALL
**Problem:** Any instructor/coach has FOR ALL on ANY session record.
**Decision needed:** Scope to related sessions only, OR accept broad access.
**Action:** Flag for future sprint — requires careful analysis of all session workflows.

### 2.8 `group_session_participants` — Any auth can view ALL
**Problem:** `USING (true)` SELECT policy.
**Action:** Flag for future sprint — needs group membership scoping.

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

### 3.11 `resource_library_skills` + `resource_library_programs` — `is_published` vs `visibility`
**Action:** Flag for future sprint — requires understanding of the `can_access_resource()` function.

## Deferred Items (Future Sprint)

| Item | Reason |
|---|---|
| Assessment scoring exposure (#2.6) | Requires frontend refactor to server-side scoring |
| Sessions overly permissive (#2.7) | Requires analysis of all session workflows |
| Group session participants (#2.8) | Requires group membership scoping |
| Resource library visibility model (#3.11) | Requires `can_access_resource()` analysis |

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
