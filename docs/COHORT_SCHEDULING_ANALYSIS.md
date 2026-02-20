# Cohort Scheduling Analysis

> Full audit of cohort/session scheduling infrastructure — what exists, what's missing, and recommended implementation plan.
>
> Created: 2026-02-18 | Status: Planning (not yet implemented)

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Infrastructure Audit](#2-current-infrastructure-audit)
3. [Scenario Walkthroughs](#3-scenario-walkthroughs)
4. [Gap Analysis](#4-gap-analysis)
5. [Build vs Buy Recommendation](#5-build-vs-buy-recommendation)
6. [Implementation Plan](#6-implementation-plan)
7. [Database Changes Required](#7-database-changes-required)

---

## 1. Executive Summary

The platform has ~80% of cohort delivery infrastructure built. The core experience (CohortDashboard, session cards with live status, content embed, calendar integration) is production-ready. However, **admin workflow gaps** make it impractical to run cohorts without direct database edits. Specifically: no cohort assignment UI on enrollment, no automated meeting link generation, no attendance tracking, and no recurring session generation.

**Estimated effort to fill all gaps: ~2 weeks.** Must-haves for first cohort: ~1 week.

---

## 2. Current Infrastructure Audit

### 2.1 Database Schema

#### `program_cohorts` — EXISTS, WORKS
```sql
CREATE TABLE public.program_cohorts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE,
  end_date DATE,
  capacity INTEGER,
  status TEXT NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming', 'active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
RLS: Admins full CRUD, instructors SELECT on their programs, clients SELECT on their enrolled cohorts. Indexes on `program_id` and `status`.

#### `cohort_sessions` — EXISTS, WORKS
```sql
CREATE TABLE public.cohort_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cohort_id UUID NOT NULL REFERENCES program_cohorts(id) ON DELETE CASCADE,
  module_id UUID REFERENCES program_modules(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  session_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  location TEXT,
  meeting_link TEXT,
  notes TEXT,
  order_index INTEGER NOT NULL DEFAULT 0,
  timezone TEXT DEFAULT 'UTC',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
RLS: Admins full CRUD, instructors SELECT via their programs, clients SELECT via enrolled cohort.

**Key observation:** No `instructor_id` column. No `session_type_id`. No Cal.com booking columns. Cohort sessions are a simplified, standalone scheduling model — NOT linked to the unified `sessions`, `module_sessions`, or `group_sessions` tables.

#### `client_enrollments.cohort_id` — EXISTS, WORKS
The `cohort_id` column is a nullable FK on `client_enrollments`. Clients are linked to a cohort through their enrollment record. However, there is no admin UI to set this value.

#### Three Parallel Scheduling Systems

| System | Table | Use Case | Cal.com | Google Cal | Attendance |
|--------|-------|----------|---------|------------|------------|
| **Cohort sessions** | `cohort_sessions` | Fixed-date group schedule | No | No | No |
| **Module sessions** | `module_sessions` | 1:1 bookable per enrollment | Yes | No | Yes |
| **Group sessions** | `group_sessions` | Group-level scheduling | Yes | Yes | Yes |

Additionally, a **unified sessions architecture** (`sessions` + `session_types` + `session_participants`) exists in the DB with 8 session types and 10 roles, but is not yet the active scheduling path. It appears to be a parallel/future design.

#### ~~Enrollment Codes — DO NOT EXIST~~ ✅ DONE (G8, 2026-02-25)
`enrollment_codes` table now exists with full self-enrollment flow: admin generates codes, authenticated users redeem at `/enroll?code=CODE`. See migration `20260225100000_g8_enrollment_codes.sql`, edge function `redeem-enrollment-code`, admin page `EnrollmentCodesManagement.tsx`, public page `EnrollWithCode.tsx`.

### 2.2 Admin UI

#### `ProgramCohortsManager` — EXISTS, FULLY FUNCTIONAL
- **File:** `src/components/admin/ProgramCohortsManager.tsx`
- Rendered inside the "Cohorts" tab on admin ProgramDetail page
- Full CRUD: create, edit, delete cohorts
- Form: name, description, start/end dates, capacity, status
- Shows enrollment count per cohort
- Each cohort contains `CohortSessionsManager` inline
- **Cannot assign clients to cohorts** — only shows counts

#### `CohortSessionsManager` — EXISTS, FULLY FUNCTIONAL
- **File:** `src/components/admin/CohortSessionsManager.tsx`
- Full CRUD for sessions within a cohort
- Form: title, description, session_date, start/end time, timezone (`TimezoneSelect`), location, meeting_link (manual URL), linked module dropdown, notes
- Drag-and-drop reordering with `@dnd-kit`
- **Meeting links are entered manually** — no Cal.com or Google Calendar integration

#### Enrollment Flow — INCOMPLETE
- **File:** `src/pages/admin/ClientDetail.tsx` (enrollment section)
- Uses `enroll_with_credits` RPC function
- RPC does NOT accept a `cohort_id` parameter
- Enrollment form has NO cohort selector dropdown
- Admin must edit `client_enrollments.cohort_id` directly in the database

### 2.3 Client-Facing UI

#### `CohortDashboard` — EXISTS, WORKS
- **File:** `src/pages/client/CohortDashboard.tsx`
- Route: `/programs/:programId/cohort`
- Shows: breadcrumb, cohort header (name/dates/status), next session highlight, session timeline (upcoming/past), "Add All to Calendar" button, module progress bar, group section
- Falls back to EmptyState when no cohort enrollment

#### `CohortSessionCard` — EXISTS, WORKS
- **File:** `src/components/cohort/CohortSessionCard.tsx`
- Time-aware status badge (Upcoming, Starts in X min, Live Now, Ended)
- Pulsing "Join Now" button when live
- ICS calendar download per session
- Module link (navigate to module detail)
- Highlighted variant for "next session"

#### Calendar Integration — EXISTS, WORKS
- Cohort sessions appear on client Calendar page as "Live Workshop" events
- Click navigates to CohortDashboard
- ICS file generation via `src/lib/icsGenerator.ts`

#### Dashboard Widget — EXISTS, WORKS
- "Next Live Session" widget on ClientDashboard
- Fetches next upcoming cohort session across all enrollments

### 2.4 Instructor-Facing UI

#### Instructor Visibility — PARTIAL
- Instructors can SELECT cohort sessions for programs they are assigned to (via RLS)
- No dedicated instructor view for cohort sessions
- No cohort-specific instructor assignment (only program-level and module-level)
- Instructors cannot see who is in which cohort from their dashboard

### 2.5 Calendar/Meeting Integrations

#### Cal.com — EXISTS, WORKS (for module_sessions and group_sessions ONLY)
- `calcom-create-booking` edge function — creates bookings, updates session records
- `calcom-webhook` — processes BOOKING_CREATED/RESCHEDULED/CANCELLED
- `calcom-get-booking-url` — fetches event type details
- `_shared/calcom-utils.ts` — shared cancellation helper
- **Not connected to cohort sessions at all**
- Best suited for: 1:1 module sessions where client picks a time slot

#### Google Calendar — EXISTS, WORKS (for group_sessions ONLY)
- `google-calendar-create-event` edge function
- Uses Google Service Account with Domain-Wide Delegation
- Creates Google Calendar events with attendees, recurrence, Google Meet links
- Updates `group_sessions.meeting_link` with Meet link
- **Not connected to cohort sessions at all**
- Best suited for: fixed-schedule group/cohort sessions

#### ICS Generation — EXISTS, WORKS
- `src/lib/icsGenerator.ts` — client-side .ics file generation
- Used by `CohortSessionCard` for "Add to Calendar" per session
- Used by `CohortDashboard` for "Add All to Calendar"

### 2.6 Notification System

- 25+ notification types, 8 categories, email queue with retry
- Module sessions and group sessions trigger notifications on create/update/cancel
- **Cohort sessions trigger NO notifications** — no email or in-app when sessions are created, updated, or approaching

---

## 3. Scenario Walkthroughs

### Scenario A: "Every 2 months, 3-day intensive live class"

| Step | Status | Notes |
|------|--------|-------|
| Create program "Sharing and Visibility" | Works | Admin UI |
| Create cohort "March 2026 Intensive" (Mar 10-12) | Works | ProgramCohortsManager |
| Create 3 sessions (Day 1, 2, 3) with times | Works | CohortSessionsManager |
| Link each session to a module | Works | Module dropdown in session form |
| Upload Rise content per module | Works | Content package upload (just built) |
| Assign instructor to program | Works | program_instructors admin UI |
| Create client users | Works | Admin user creation |
| Enroll clients in program | Works | Admin enrollment |
| Assign clients to cohort | **Manual DB edit** | No UI for `cohort_id` |
| Generate Google Meet links | **Manual per session** | No automation |
| Clients see schedule + join sessions | Works | CohortDashboard + CohortSessionCard |
| Track attendance | **Not possible** | No attendance table |
| Send session reminders | **Not possible** | No notification support |

### Scenario B: "6-month hybrid — on-demand + weekly 2h sessions"

| Step | Status | Notes |
|------|--------|-------|
| Create program with content modules | Works | Admin UI |
| Upload Rise content packages | Works | Content package upload (just built) |
| Create cohort spanning 6 months | Works | ProgramCohortsManager |
| Create ~16 weekly sessions | **Tedious** | Must create each manually, no recurrence |
| Generate Meet links for 16 sessions | **Very tedious** | Manual per session |
| Assign clients to cohort | **Manual DB edit** | No UI |
| Clients access content + attend sessions | Works | Content embed + CohortDashboard |
| Track which content is completed | **Partial** | Module progress exists, but no xAPI auto-complete (Tier 2) |
| Track session attendance | **Not possible** | No attendance table |

### Scenario C: "Rolling enrollment, self-paced with monthly office hours"

| Step | Status | Notes |
|------|--------|-------|
| Create program with modules | Works | Admin UI |
| Create open cohort | Works | No end date |
| Create monthly recurring sessions | **Not possible** | No recurrence support |
| Clients self-enroll | ✅ Works (G8) | Enrollment codes + `/enroll?code=` page |
| Clients pace themselves through content | Works | Content embed, module progress |

---

## 4. Gap Analysis

### 4.1 Critical Gaps (blockers for first cohort)

| # | Gap | Impact | Effort |
|---|-----|--------|--------|
| G1 | **No cohort assignment UI on enrollment** — admin can't assign client to cohort from the enrollment form. Must edit DB directly. | Blocks daily operations | 1 day |
| G2 | **No meeting link automation** — admin manually types Google Meet/Zoom URL for each session. For 16 weekly sessions, this is extremely tedious and error-prone. | Significant admin friction | 2 days |

### 4.2 High-Priority Gaps (needed for quality delivery)

| # | Gap | Impact | Effort |
|---|-----|--------|--------|
| G3 | **No instructor assignment on cohort/session** — can't specify "this instructor leads this cohort" or "this instructor runs this session." Instructors only have program-level visibility. | Instructor confusion in multi-cohort programs | 1-2 days |
| G4 | **No attendance tracking** — no way to record who attended a live session. Critical for compliance, progress tracking, and engagement monitoring. | No accountability | 2-3 days |
| G5 | **No recurring session generation** — admin must create each session individually. For a 16-week program, that's 16 manual form submissions. | Admin tedium | 1-2 days |
| G6 | **No session notifications** — no email when sessions are created, no reminders before sessions. Clients must check the dashboard proactively. | Clients miss sessions | 2 days |

### 4.3 Medium-Priority Gaps (improve over time)

| # | Gap | Impact | Effort |
|---|-----|--------|--------|
| G7 | **No session notes/recap** — no way to add post-session summary, recording link, or action items. | Lost session value | 3 days |
| ~~**GT1**~~ | ~~**No instructor/coach teaching UI for cohorts**~~ ✅ DONE (2026-02-23) — `/teaching/cohorts` list + detail page, RLS fixes, dashboard integration, StudentDetail cohort card | ~~Instructors need admin access~~ | ~~**~1 week**~~ |
| ~~G8~~ | ~~**No enrollment codes**~~ ✅ DONE (2026-02-25) — `enrollment_codes` table, `validate_enrollment_code` RPC, `redeem-enrollment-code` edge function, admin `EnrollmentCodesManagement.tsx`, public `EnrollWithCode.tsx` | ~~Scaling friction~~ | ~~2-3 days~~ |
| ~~G9~~ | ~~**No cohort analytics**~~ ✅ DONE (2026-02-23) — `CohortAnalytics.tsx` admin dashboard | ~~Blind spots~~ | ~~1 week~~ |
| ~~G10~~ | ~~**No session-linked homework**~~ ✅ DONE (2026-02-23) — `cohort_session_id` on `development_items`, `SessionHomework.tsx` | ~~Missed reinforcement~~ | ~~3-5 days~~ |

---

## 5. Build vs Buy Recommendation

### Don't use TalentLMS for scheduling

1. **TalentLMS is an LMS, not a scheduling tool** — it can schedule ILT sessions but offers basic UX (no real-time join status, no ICS download, no cohort dashboard, no calendar view)
2. **The platform already has 80% of the cohort experience built** — CohortDashboard, session cards, join flow, calendar, content embed. TalentLMS can't match that integration level
3. **Content delivery has moved away from TalentLMS** — Rise content now served directly via auth-gated edge function proxy. Adding scheduling back through TalentLMS creates fragmentation

### Use Google Calendar for meeting link generation

- The `google-calendar-create-event` edge function already exists and works (used for group sessions)
- It creates Google Meet links automatically via Service Account + Domain-Wide Delegation
- Use `group@innotrue.com` as the organizer
- Google Calendar handles conflicting meetings natively (unlike Cal.com which blocks double-booking by default)
- Admin can still view/manage all sessions in the Google Calendar UI as a secondary view

### Use Cal.com only for 1:1 bookable sessions

- Cal.com is ideal when clients need to pick a time slot (module sessions, coaching sessions)
- For cohort sessions, dates are fixed by the admin — there's nothing to "book"
- The existing Cal.com integration for module_sessions already covers this use case

### Don't use Zoom unless specifically required

- Google Meet is simpler (no extra account), works with your Workspace
- The Google Calendar integration already generates Meet links
- Zoom would require a separate integration (OAuth, API keys, webhook)
- Only consider Zoom if clients have specific Zoom requirements (breakout rooms, recording, etc.)

---

## 6. Implementation Plan

### Phase 1: Must-Haves for First Cohort (~1 week)

| # | Item | Est. | Description |
|---|------|------|-------------|
| G1 | **Cohort assignment on enrollment** | 1 day | Add cohort dropdown to enrollment form in ClientDetail.tsx. Add `p_cohort_id` param to `enroll_with_credits` RPC. Add cohort reassignment option in ProgramCohortsManager (move client between cohorts). |
| G2 | **Google Meet link generation** | 2 days | Extend `CohortSessionsManager` with "Generate Meet Link" button. Calls existing `google-calendar-create-event` edge function adapted for cohort sessions. Auto-populates `meeting_link` field. Optional: auto-create for all sessions at once. |
| G3 | **Instructor on cohort** | 1-2 days | Add `lead_instructor_id` column to `program_cohorts`. Optional `instructor_id` on `cohort_sessions` (defaults to cohort lead). Admin UI dropdown in cohort form. Instructor dashboard shows their cohorts. |
| G5 | **Recurring session generation** | 1-2 days | "Repeat" option in CohortSessionsManager: weekly/biweekly/monthly for N occurrences. Generates N sessions with incrementing dates, same time, auto-titled "Session 1", "Session 2", etc. |

### Phase 2: Quality & Tracking (~1 week)

| # | Item | Est. | Description |
|---|------|------|-------------|
| G4 | **Attendance tracking** | 2-3 days | Migration: `cohort_session_attendance` table (session_id, user_id, status: present/absent/excused, marked_by, notes). Instructor UI: attendance sheet per session. Admin view: attendance summary per cohort. Client view: attendance badge on past sessions. |
| G6 | **Session notifications** | 2 days | New notification types: `cohort_session_created`, `cohort_session_reminder_24h`, `cohort_session_reminder_1h`. Trigger on session creation. Cron job or scheduled function for reminders. Email + in-app. |
| G7 | **Session notes/recap** | 3 days | Add `recording_url`, `summary`, `action_items` columns to `cohort_sessions`. Instructor/admin can add after session ends. Clients see recap card on past sessions in CohortDashboard. |

### Phase 3: Scale (deferred to Phase 5+)

| # | Item | Est. | Description |
|---|------|------|-------------|
| ~~G8~~ | ~~Enrollment codes~~ | ~~2-3 days~~ | ✅ DONE (2026-02-25) — `enrollment_codes` table with `cohort_id`, self-enrollment via link/code |
| ~~G9~~ | ~~Cohort analytics~~ | ~~1 week~~ | ✅ DONE (2026-02-23) |
| ~~G10~~ | ~~Session-linked homework~~ | ~~3-5 days~~ | ✅ DONE (2026-02-23) |

---

## 7. Database Changes Required

### Phase 1 Migrations

```sql
-- G1: Add cohort_id to enroll_with_credits RPC (alter function)
-- No new tables needed, just RPC update

-- G3: Instructor assignment on cohorts
ALTER TABLE program_cohorts
  ADD COLUMN lead_instructor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE cohort_sessions
  ADD COLUMN instructor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- G5: No DB changes needed (generates multiple rows via existing insert)
```

### Phase 2 Migrations

```sql
-- G4: Attendance tracking
CREATE TABLE public.cohort_session_attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES cohort_sessions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'present'
    CHECK (status IN ('present', 'absent', 'excused', 'late')),
  marked_by UUID REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(session_id, user_id)
);

-- G7: Session notes/recap
ALTER TABLE cohort_sessions
  ADD COLUMN recording_url TEXT,
  ADD COLUMN summary TEXT,
  ADD COLUMN action_items JSONB DEFAULT '[]'::jsonb;
```

---

## Appendix: Existing Integration Points

### Files to Modify (Phase 1)

| File | Change |
|------|--------|
| `src/pages/admin/ClientDetail.tsx` | Add cohort dropdown to enrollment form |
| `supabase/migrations/YYYYMMDD_enroll_with_credits_cohort.sql` | Add `p_cohort_id` to RPC |
| `src/components/admin/ProgramCohortsManager.tsx` | Add instructor dropdown, enrollment management |
| `src/components/admin/CohortSessionsManager.tsx` | Add recurrence option, Meet link generation, instructor |
| `supabase/functions/google-calendar-create-event/index.ts` | Adapt for cohort sessions (or create wrapper) |
| Migration for `lead_instructor_id` and `instructor_id` columns | New migration |

### Files to Modify (Phase 2)

| File | Change |
|------|--------|
| New: `src/components/cohort/CohortAttendanceSheet.tsx` | Instructor attendance marking UI |
| `src/pages/client/CohortDashboard.tsx` | Show attendance badges, session recaps |
| `src/components/cohort/CohortSessionCard.tsx` | Show recap section for past sessions |
| `supabase/functions/` | New notification triggers for session reminders |
| Migration for `cohort_session_attendance` table | New migration |
| Migration for `recording_url`, `summary`, `action_items` columns | New migration |

### Existing Edge Functions to Reuse

| Function | Current Use | Reuse For |
|----------|-------------|-----------|
| `google-calendar-create-event` | Group sessions | Cohort session Meet links |
| `process-email-queue` | All emails | Session reminder emails |
| `_shared/email-utils.ts` | Email helpers | Reminder formatting |
| `_shared/cors.ts` + `_shared/error-response.ts` | All functions | New functions |

---

## GT1: Instructor/Coach Cohort Teaching Workflow — ✅ DONE (2026-02-23)

> **Added 2026-02-19. Completed 2026-02-23 (commit `ed0254b`).** All 6 phases implemented: RLS migration (4 policies), `/teaching/cohorts` list page, `/teaching/cohorts/:cohortId` detail page (attendance + recap + homework), dashboard integration, sidebar + routes, StudentDetail cohort card. Both instructors and coaches have full symmetric access.

### Gaps (affects BOTH instructors AND coaches)

| Area | Current State | Gap |
|------|--------------|-----|
| Teaching Dashboard | Upcoming sessions widget queries only `group_sessions` | Neither instructors nor coaches see cohort sessions |
| Cohort browsing | No `/teaching/cohorts` route | Neither role can browse their assigned cohorts |
| Attendance marking | `CohortSessionAttendance` component exists in admin only | Not exposed to teaching workflow for either role |
| Recap editing | Admin-only via `CohortSessionsManager` | No UPDATE RLS on `cohort_sessions` for either role |
| Coach program_cohorts access | Coach has NO SELECT policy on `program_cohorts` | Coach can't see cohorts at all (asymmetric with instructor) |
| Coach attendance access | Coach has SELECT-only on `cohort_session_attendance` | Coach can view but can't mark (instructor has ALL) |
| Student cohort info | `StudentDetail.tsx` shows no cohort assignment or attendance | Neither role sees cohort context for their students |

### RLS Fixes Required (4 policies)

| Table | Instructor | Coach | Action |
|-------|-----------|-------|--------|
| `program_cohorts` SELECT | ✅ Has | ❌ Missing | Add coach SELECT via `program_coaches` |
| `cohort_sessions` UPDATE | ❌ Missing | ❌ Missing | Add UPDATE for both roles (recap editing) |
| `cohort_session_attendance` | ✅ ALL | ⚠️ SELECT only | Upgrade coach to ALL |

### Implementation Plan (6 phases, ~1 week)

| Phase | Description | Files |
|-------|-------------|-------|
| 1. RLS Migration | 4 new policies: coach SELECT on `program_cohorts`, UPDATE on `cohort_sessions` for both roles, upgrade coach attendance to ALL | `supabase/migrations/` |
| 2. Teaching Cohorts List | New `/teaching/cohorts` page following `Groups.tsx` pattern — card grid with cohort info, enrollment count, session count | `src/pages/instructor/Cohorts.tsx` (CREATE) |
| 3. Cohort Detail Page | Main teaching interface — sessions list, expandable attendance panel (reuses `CohortSessionAttendance`), recap editor, enrolled clients list | `src/pages/instructor/CohortDetail.tsx` (CREATE) |
| 4. Dashboard Integration | Merge cohort sessions into upcoming sessions widget — query program IDs from both `program_instructors` and `program_coaches`, fetch `cohort_sessions`, merge with group sessions | `src/pages/instructor/InstructorCoachDashboard.tsx` (MODIFY) |
| 5. Sidebar + Routes | Add "Cohorts" to teaching sidebar, 2 lazy-loaded routes | `src/components/AppSidebar.tsx`, `src/App.tsx` (MODIFY) |
| 6. StudentDetail Integration | Show cohort assignment card + attendance summary for enrolled students | `src/pages/instructor/StudentDetail.tsx` (MODIFY) |

**Key reuse:** `CohortSessionAttendance` component imported directly from admin — no modifications needed (uses `useAuth()` for `marked_by`, role-agnostic). `notify_cohort_session_recap` RPC already exists as SECURITY DEFINER, granted to authenticated.
