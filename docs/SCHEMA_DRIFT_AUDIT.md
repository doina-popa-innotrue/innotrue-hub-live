# Schema Drift Audit Report

**Date:** 2026-03-23
**Status:** Decisions made — awaiting confirmation to start fixing
**Priority:** CRITICAL — multiple production features silently broken

---

## Executive Summary

A comprehensive audit found widespread code-to-DB mismatches causing silent failures. PostgREST returns `null` for non-existent columns instead of erroring, so these bugs are invisible to users — features just silently don't work.

**Key production impacts:**
- Disabled users receive ALL emails (is_disabled check bypassed)
- Cal.com booking notifications have null emails (never sent)
- Session participant notifications fail (trigger references non-existent column)
- Calendar feed is non-functional (10+ schema mismatches)
- Staff/client names show as fallbacks in multiple admin views

---

## Decisions Made

| Decision | Chosen Approach | Rationale |
|----------|----------------|-----------|
| `profiles.email` | **Add column + auto-sync trigger on auth.users** | Single migration fixes 16+ files; semantically correct; DB triggers can read it directly without auth API calls; existing email-change flows already update `profiles.username` — we add `email` to same paths |
| `profiles.is_disabled` | **Hybrid: add column + keep auth ban** | Auth ban blocks login (authoritative); `is_disabled` column enables fast reads in DB triggers, edge functions, and RLS; `delete-user` edge function sets both; auto-sync trigger catches any direct auth changes |
| `profiles.full_name` | **Fix code → `name`** | No column to add; just wrong name in 8 references |
| Sync safety | **Auto-sync trigger on `auth.users`** | Catches ALL changes (edge functions, admin API, dashboard, CLI); edge function updates are belt+suspenders on top |

---

## Sprint 1 — CRITICAL: Profiles Migration + Session Fixes

### 1A. Migration: Add `email` + `is_disabled` to `profiles`

**New migration:** `20260324100000_profiles_email_and_disabled.sql`

```
STEP 1: Add columns
  - profiles.email TEXT (nullable initially)
  - profiles.is_disabled BOOLEAN NOT NULL DEFAULT false

STEP 2: Backfill from auth.users
  - email ← auth.users.email
  - is_disabled ← true WHERE auth.users.banned_until > now()

STEP 3: Create index
  - idx_profiles_email ON profiles(email) WHERE email IS NOT NULL

STEP 4: Auto-sync trigger on auth.users
  - AFTER UPDATE ON auth.users
  - WHEN email changes OR banned_until changes
  - Updates profiles.email and profiles.is_disabled

STEP 5: Update handle_new_user() to also set email

STEP 6: Recreate notify_program_assignment() using p.email + p.is_disabled
  (these columns will now exist)
```

**Edge function updates (belt+suspenders):**
- `verify-email-change/index.ts`: add `profiles.email` update alongside existing `profiles.username` update
- `update-user-email/index.ts`: same
- `delete-user/index.ts`: add `profiles.is_disabled = true/false` on disable/enable

**Files that will auto-fix once column exists (16+ files):**
All files listed in the audit that reference `profiles.email` or `profiles.is_disabled` — they already have the correct code, they just need the column to exist.

### 1B. Fix `full_name` → `name` (code changes, 8 references)

| File | Change |
|------|--------|
| `src/pages/admin/PartnerCodesManagement.tsx` | `full_name` → `name` (lines 176, 182, ~280) |
| `src/pages/instructor/StudentDevelopmentProfile.tsx` | `full_name` → `name` (lines 30, 70) |
| `src/hooks/useFeedbackInbox.ts` | `full_name` → `name` (lines 50, 104, 157, 207) |
| `src/hooks/useContentPackages.ts` | `full_name` → `name` (line 64) |
| `supabase/functions/calendar-feed/index.ts` | `full_name` → `name` (lines 152, 168, 197, 244) |
| Migration for `create_notification()` DB function | `full_name` → `name` |

### 1C. Migration: Fix `notify_session_participant_added()` trigger

**Bug:** Line 90 references `COALESCE(ms.instructor_id, ms.coach_id)` — `module_sessions` has NO `coach_id` column.

**Fix:** Replace with `ms.instructor_id`

This trigger fires on EVERY `module_session_participants` INSERT — it's part of the core session booking flow. Currently the COALESCE silently returns null for the coach fallback (harmless in practice since `instructor_id` usually has a value), but it's technically a bug that could cause issues if instructor_id is null.

### 1D. Migration: Fix `staff_has_client_relationship()` function

**Bug:** Missing `enrollment_module_staff` check. The function checks program-level, module-level, and direct client assignments — but NOT enrollment-level staff assignments.

**Fix:** Add `enrollment_module_staff` EXISTS check.

### 1E. Session Architecture — Validation & calendar-feed Fix

**Session architecture is correct and intentional:**

| Table | Purpose | Status |
|-------|---------|--------|
| `module_sessions` | Individual 1:1 coaching + group module sessions | ACTIVE, working |
| `module_session_participants` | Participants in module sessions | ACTIVE, working |
| `group_sessions` | Peer group sessions (study groups, project groups) | ACTIVE, working |
| `group_session_participants` | Participants in group sessions | ACTIVE, working |
| `sessions` + `session_types` + `session_type_roles` + `session_participants` | Generic session framework | Legacy/framework, not used by booking flow |

**Peer group scheduling (groups@innotrue.com pattern):**
- Groups have `calcom_mapping_id` → points to a shared Cal.com event type
- `calcom_event_type_mappings` has `session_target: "group_session"` + `default_group_id`
- When booked via Cal.com: webhook creates `group_sessions` record, auto-adds all `group_memberships` active members as `group_session_participants`
- **Validation needed:** Confirm this flow works end-to-end (the webhook code handles it, but email lookup uses `profiles.email` which is currently null — will be fixed by 1A)

**calendar-feed rewrite plan:**
The `calendar-feed/index.ts` function needs rewriting to use the actual session tables:

| Current (broken) | Should be |
|---|---|
| `client_sessions` (doesn't exist) | `module_sessions` WHERE enrollment_id IN (user's enrollments) |
| `scheduled_at` | `session_date` |
| `client_sessions_instructor_id_fkey` | `module_sessions.instructor_id` → profiles |
| `group_sessions.scheduled_at` | `group_sessions.session_date` |
| `group_members` | `group_memberships` |
| `full_name` on profiles | `name` |
| `modules (title)` on module_assignments | Remove or fix — `module_assignments` has no FK to modules |
| `due_date`, `client_id` on module_assignments | Don't exist — remove this section or rewrite |

---

## Sprint 2 — HIGH: Wrong Table Names + Readiness Dashboard

### 2A. `accept-org-invite` — Wrong table name + columns

| Current | Fix |
|---|---|
| `user_organization_sharing_consent` | `organization_sharing_consent` |
| `share_profile`, `share_enrollments` columns | Remove (don't exist); table has `share_wheel` instead |

### 2B. `useReadinessDashboard` — Phantom `instructor_assignments` table

| Current | Fix |
|---|---|
| `.from("instructor_assignments").select("program_id").eq("user_id", ...)` | Union query: `program_instructors` WHERE `instructor_id = user.id` UNION `program_coaches` WHERE `coach_id = user.id` |

### 2C. `generate-reflection-prompt` — Wrong table name + columns

| Current | Fix |
|---|---|
| `wheel_of_life_scores` with `domain`, `score`, `assessed_at` | `wheel_of_life_snapshots` with individual columns (`career_business`, `finances`, etc.) + `created_at` |

Note: The `wheel_of_life_snapshots` table already stores scores in **structured columns** (one per domain), NOT as JSON. This is the correct schema.

### 2D. RPC type assertions (2 files)

- `CohortWaitlistManager.tsx`: cast `enroll_with_credits` result
- `CohortWaitlistButton.tsx`: cast `join_cohort_waitlist` result

### 2E. Push updated `types.ts` to Lovable

Resolves all `as string` cast build errors (20+ files). The tables exist in our types.ts but Lovable has a stale snapshot.

---

## Sprint 3 — MEDIUM: Edge Function Rewrites

### 3A. Rewrite `calendar-feed/index.ts`

Full rewrite needed (10+ schema mismatches). See 1E above for the mapping table.

### 3B. Fix `credit-maintenance/index.ts`

| Current | Fix |
|---|---|
| `user_subscriptions` (doesn't exist) | Use `profiles.plan_id` + `plans.credit_allowance` |
| `organization_subscriptions` (wrong name) | `org_platform_subscriptions` |
| No cron trigger | Add to Supabase cron schedule or external trigger |

### 3C. Miscellaneous edge function fixes

| File | Issue | Fix |
|------|-------|-----|
| `check-org-seat-limits/index.ts` | `organizations.platform_tier_id` doesn't exist | Investigate correct column |
| `export-feature-config/index.ts` | `program:programs(name)` — no FK | Route through `program_tier_plans` |
| `stripe-webhook/index.ts` | Null into NOT NULL `payment_schedules.enrollment_id` | Handle null case |

---

## "Phantom Tables" — Corrected Assessment

| Referenced Table | Actually Exists As | Fix Type |
|---|---|---|
| `organization_subscriptions` | **`org_platform_subscriptions`** (same purpose, different name) | Easy rename |
| `user_organization_sharing_consent` | **`organization_sharing_consent`** (slightly different columns) | Easy rename + column adjustment |
| `instructor_assignments` | **Data in `program_instructors` + `program_coaches`** | Easy union query |
| `wheel_of_life_scores` | **`wheel_of_life_snapshots`** (structured columns, not JSON) | Easy rename + column mapping |
| `client_sessions` | **Never built** — use `module_sessions` + `module_session_participants` | Medium rewrite (calendar-feed) |
| `user_subscriptions` | **Never built** — individual subscriptions use `profiles.plan_id` directly | Medium rewrite (credit-maintenance) |

**4 of 6 are just wrong names for features that DO exist.** Only `client_sessions` and `user_subscriptions` represent functionality that was designed differently than the code expected.

---

## Sync Safety Architecture

### Auto-sync trigger (primary mechanism)
```sql
CREATE TRIGGER on_auth_user_updated
  AFTER UPDATE ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email
     OR OLD.banned_until IS DISTINCT FROM NEW.banned_until)
  EXECUTE FUNCTION sync_auth_to_profiles();
```

### Edge function updates (belt+suspenders)
- `verify-email-change`: updates `profiles.email` + `profiles.username`
- `update-user-email`: updates `profiles.email` + `profiles.username`
- `delete-user`: updates `profiles.is_disabled`

### New user creation
- `handle_new_user()`: sets `profiles.email` + `profiles.username` from `NEW.email`

**If trigger on auth.users is not allowed by Supabase:** Fall back to edge-function-only sync (covers all current code paths: user signup, email change verification, admin email update, admin disable/enable).

---

## Complete File Change Summary

### Migration Files (NEW)
| File | Purpose |
|------|---------|
| `20260324100000_profiles_email_and_disabled.sql` | Add email + is_disabled, backfill, sync trigger, fix handle_new_user, fix notify_program_assignment |
| `20260324100001_fix_session_triggers.sql` | Fix notify_session_participant_added (coach_id), fix staff_has_client_relationship |

### Edge Functions to Update
| File | Change |
|------|--------|
| `delete-user/index.ts` | Add `profiles.is_disabled` update |
| `verify-email-change/index.ts` | Add `profiles.email` update |
| `update-user-email/index.ts` | Add `profiles.email` update |

### Frontend Code Fixes
| File | Change |
|------|--------|
| `PartnerCodesManagement.tsx` | `full_name` → `name` |
| `StudentDevelopmentProfile.tsx` | `full_name` → `name` |
| `useFeedbackInbox.ts` | `full_name` → `name` (4 places) |
| `useContentPackages.ts` | `full_name` → `name` |

### Sprint 2 Code Fixes
| File | Change |
|------|--------|
| `accept-org-invite/index.ts` | Fix table name + columns |
| `useReadinessDashboard.ts` | Fix phantom table → union query |
| `generate-reflection-prompt/index.ts` | Fix table name + column mapping |
| `CohortWaitlistManager.tsx` | Add RPC type assertion |
| `CohortWaitlistButton.tsx` | Add RPC type assertion |

### Sprint 3 Rewrites
| File | Change |
|------|--------|
| `calendar-feed/index.ts` | Full rewrite to use actual session tables |
| `credit-maintenance/index.ts` | Fix phantom tables + add cron trigger |
