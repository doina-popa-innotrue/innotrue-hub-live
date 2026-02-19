# InnoTrue Hub — Platform Functional Overview

> Last updated: 2026-02-22
> This document describes the InnoTrue Hub platform from a functional perspective: what it does, who uses it, how the pieces connect, and how things flow. It is intended for platform administrators, partner instructors, developers joining the project, and stakeholders evaluating platform capabilities.

---

## Table of Contents

1. [What Is InnoTrue Hub?](#1-what-is-innotrue-hub)
2. [User Roles & What Each Can Do](#2-user-roles--what-each-can-do)
3. [Platform Architecture Overview](#3-platform-architecture-overview)
4. [Core Functional Areas](#4-core-functional-areas)
   - 4.1 Programs & Modules
   - 4.2 Assignments & Grading
   - 4.3 Assessments (3 Systems)
   - 4.4 Scenarios & Simulations
   - 4.5 Goals, Decisions & Tasks
   - 4.6 Groups & Collaboration
   - 4.7 Sessions & Scheduling
   - 4.8 Coaching & Instructor Workflows
   - 4.9 Resources & Learning Content
   - 4.10 Guided Paths
   - 4.11 Development Profile
   - 4.12 Credits, Plans & Entitlements
   - 4.13 Notifications & Communication
   - 4.14 Organizations
   - 4.15 AI Features
5. [Instructor & Coach Assignment System](#5-instructor--coach-assignment-system)
6. [Content Delivery](#6-content-delivery)
7. [Integrations & External Tools](#7-integrations--external-tools)
8. [Admin Tooling](#8-admin-tooling)
9. [Platform Numbers at a Glance](#9-platform-numbers-at-a-glance)

---

## 1. What Is InnoTrue Hub?

InnoTrue Hub is a **coaching and professional development platform** that combines structured learning programs with coaching, assessment, and AI-assisted reflection. It supports:

- **Self-paced learning** — modules with content, assignments, and scenarios
- **Live cohort programs** — group sessions, peer coaching, workshops
- **1:1 coaching** — goal setting, decision tracking, feedback, development items
- **Assessment & measurement** — capability assessments, psychometric catalogs, custom evaluation rubrics
- **AI-assisted reflection** — contextual prompts based on goals, progress, and program content

The platform serves professional development organizations, coaching firms, and corporate learning teams.

**Domain:** `app.innotrue.com`
**Hosting:** Cloudflare Pages (frontend) + Supabase (backend, database, auth, storage, edge functions)

---

## 2. User Roles & What Each Can Do

The platform has four primary roles, plus an organization administrator role:

### Admin
The platform operator. Full control over all configuration, users, programs, and data.

**What they do:**
- Create and manage programs (content, modules, assessments, assignments, scenarios)
- Create user accounts (clients, coaches, instructors) and assign roles
- Manage subscriptions, credits, plans, features, and entitlements
- Assign instructors and coaches to programs, modules, and individual clients
- Configure integrations (Cal.com, TalentLMS, Circle, Google Calendar)
- Monitor email queue, notifications, analytics, and audit logs
- Manage organizations, platform terms, and system settings

**Key pages:** 71 admin pages covering every aspect of platform management

### Client (Learner)
The end user going through a development program.

**What they do:**
- Enroll in programs, complete modules (content + assignments + scenarios)
- Set goals, track decisions, manage tasks, log development items
- Take assessments (capability, psychometric, custom)
- Participate in group sessions, peer coaching, and check-ins
- Book coaching/instructor sessions via Cal.com
- View feedback, badges, skills map, and progress analytics
- View their **Development Profile** — unified strengths/gaps/goals/skills/paths dashboard
- Access the resource library and AI-powered recommendations
- Use AI reflection prompts connected to their goals and progress

**Key pages:** 54 client pages organized around "My Journey," programs, assessments, and collaboration

### Instructor
Delivers program content and evaluates client work.

**What they do:**
- View assigned programs and their modules
- Grade client assignments using rubric-based scoring with capability domain questions
- Evaluate scenario submissions section by section (with revision requests)
- Approve badge completion (batch or individual, with credential URLs)
- Track client progress across programs and modules
- Write staff notes (per-module, shared with other staff)
- Manage group sessions and attendance

**Key pages:** 13 teaching pages, all under `/teaching`

### Coach
Supports client development through ongoing relationship.

**What they do:**
- Everything instructors can do, plus:
- View shared goals, decisions, and tasks from their clients
- Evaluate capability assessments (domain-level scoring with notes)
- Provide feedback and development items
- Access coaching-specific views (decision insights, task tracking)

**Key pages:** Same 13 teaching pages plus coaching-specific pages (`/coaching/decisions`, `/coaching/tasks`)

### Organization Administrator
Manages their organization's members and program access within the platform.

**What they do:**
- View organization dashboard and member list
- Manage program enrollments for their members
- View organization analytics and billing
- Manage organization settings and terms

**Key pages:** 9 org-admin pages under `/org-admin`

---

## 3. Platform Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Frontend (React + Vite)               │
│  React 18 · TypeScript · Tailwind · shadcn/ui · PWA     │
│  Hosted on Cloudflare Pages (app.innotrue.com)          │
├─────────────────────────────────────────────────────────┤
│                    Supabase Backend                      │
│  ┌─────────┐ ┌──────────┐ ┌─────────┐ ┌─────────────┐  │
│  │  Auth    │ │ Database │ │ Storage │ │ Edge Funcs   │  │
│  │  (OAuth) │ │ (Postgres│ │ (16     │ │ (65          │  │
│  │         │ │  380+    │ │ buckets)│ │  functions)  │  │
│  │         │ │  tables) │ │         │ │              │  │
│  └─────────┘ └──────────┘ └─────────┘ └─────────────┘  │
├─────────────────────────────────────────────────────────┤
│                  External Services                       │
│  Cal.com · Stripe · Resend · Vertex AI · TalentLMS      │
│  Google Calendar · Circle · Sentry                       │
└─────────────────────────────────────────────────────────┘
```

**Key technical characteristics:**
- **Data fetching:** TanStack React Query (hooks-based, with caching and invalidation)
- **Auth:** Supabase built-in OAuth (Google, email/password)
- **Email:** Resend via `mail.innotrue.com` with email queue and retry logic
- **AI:** Vertex AI Gemini 3 Flash (EU/Frankfurt region), credit-based consumption
- **Payments:** Stripe (checkout, customer portal, credit top-ups)
- **Row-Level Security:** All database tables have RLS policies for data isolation
- **Feature gating:** Entitlements system with 5 access sources (subscription, program plan, add-ons, tracks, org-sponsored)

---

## 4. Core Functional Areas

### 4.1 Programs & Modules

**Programs** are the top-level container for learning experiences. A program consists of:
- **Modules** — ordered learning units, each with a type (e.g., content, assignment, assessment, coaching, workshop)
- **Assignments** — work products clients submit for instructor grading
- **Scenarios** — multi-section practice exercises with AI debrief and instructor evaluation
- **Badges** — completion milestones that instructors approve
- **Cohorts** — time-bound groups of clients going through the program together

**Module types** are configurable by admin (e.g., "Content Module," "Assignment Module," "Coaching Session," "Workshop"). Each type can require sessions, have tier-level access restrictions, and link to specific assessment frameworks.

**Module content can be individualized:** When `is_individualized` is enabled, each client can receive different content for the same module via `module_client_content`. This is independent of staff assignment (see Section 5).

**Enrollment flow:**
1. Admin enrolls a client in a program (with optional cohort and plan assignment)
2. Enrollment creates `module_progress` records for each module (status: not_started)
3. Client sees the program in their dashboard with module progression
4. Credits are consumed atomically during enrollment (transaction-safe)

---

### 4.2 Assignments & Grading

**Client side:**
- Each module can have one or more assignment types
- Client fills out an assignment form (text responses, file uploads) and submits
- On submission, all instructors and coaches assigned to the module/program are notified via email

**Instructor/grading side:**
- Instructors see pending assignments at `/teaching/assignments`
- Visibility is scoped: instructors only see assignments from modules and programs they are assigned to
- Grading interface includes:
  - Rubric-based scoring tied to capability assessment domains and questions
  - Per-question and per-domain notes
  - Development items that get linked to the client's development plan
  - Resource recommendations
- `scored_by` and `scored_at` are recorded when grading is completed
- Client receives email notification when grading is done
- Status workflow: `not_started` → `in_progress` → `submitted` → `reviewed` (graded)

---

### 4.3 Assessments (3 Systems)

The platform has three distinct assessment systems that share a common category framework (`assessment_categories`):

| System | Purpose | Scoring | Visualization |
|--------|---------|---------|---------------|
| **Capability Assessments** | Self-assessment and evaluator-assessment on skill domains | Client-side domain averages — simple average or **weighted by question types** | Radar chart (by domains or by question types) + evolution over time |
| **Definition Assessments** | Structured evaluations with server-side scoring | Server-side via `compute-assessment-scores` edge function (confidential scoring matrix) | Dimension bars + interpretation text |
| **Psychometric Assessments** | External assessment catalog (MBTI, Big Five, etc.) | None — document/PDF upload catalog | None — storage and reference |

**Capability assessments** are the most actively used:
- Admin creates assessment frameworks with domains and questions
- Admin can optionally configure **question types** (e.g., Knowledge, Judgement, Communication) with weighted scoring — types are fully dynamic and admin-defined per assessment
- Each question can be assigned to a type; untyped questions are grouped separately
- Client takes self-assessment (slider ratings per question per domain)
- Domain scores show either simple average (default) or weighted average by question type
- Type subtotals are displayed per domain (e.g., "Knowledge: 7.5 / 10, Judgement: 8.0 / 10")
- Coach/instructor can add their own evaluation
- Results show radar chart comparing self vs evaluator over time, with toggle between **"By Domains"** and **"By Question Types"** views
- Assessments can be shared with staff for review

---

### 4.4 Scenarios & Simulations

Scenarios are multi-section practice exercises designed to simulate real-world situations:

1. Admin creates scenario templates with sections (each section has setup text, questions, expected behaviors)
2. Client is assigned a scenario
3. Client works through sections, submitting responses to each
4. AI generates a debrief based on the client's responses
5. Instructor evaluates each section with scores (1-5) and feedback
6. Instructor can request revision on specific sections
7. Client revises and resubmits; full response history is preserved

Scenarios support certification: if a client meets the scoring threshold across all sections, they earn the scenario certification.

---

### 4.5 Goals, Decisions & Tasks

These are the ongoing coaching tools clients use alongside structured programs:

**Goals:** Client sets goals with milestones, progress tracking, and AI-generated reflection prompts. Coaches see shared goals and can add notes. Goals can be **linked to assessments** (capability assessments, domains, definitions, or psychometric assessments) for traceability — showing a score journey from creation through current to target score. Goals created from guided path templates retain `template_goal_id` and `instantiation_id` for full path traceability.

**Decisions:** A structured decision-making framework with:
- Decision logging with context, options, and chosen path
- AI-powered decision insights (analyzes patterns across decisions)
- Follow-up tracking (did the decision work out?)
- Outcome recording
- Analytics dashboard showing decision patterns over time

**Tasks:** Action items that can be standalone or linked to goals, decisions, or group activities. Status workflow with completion tracking.

**Development Items:** Items on the client's personal development plan. Can be client-created or coach/instructor-created. Coaches and instructors can create development items directly from the Student Detail page via a "+" button on each module row, opening the `DevelopmentItemDialog` in instructor mode. Linked to assessments, feedback, and coaching notes.

---

### 4.6 Groups & Collaboration

Groups bring clients together for peer learning:

- **Group types:** invitation-only or open join
- **Memberships:** member or leader roles, active/pending/left status
- **Group sessions:** scheduled events with participant tracking, meeting URLs, and attendance workflow (invited → registered → confirmed → attended/no_show)
- **Collaboration tools:** shared tasks, check-ins (with mood tracking), shared notes, member links
- **Peer assessments:** within-group peer evaluations
- **Integration slots:** Circle, Slack, Google Drive, Cal.com, Calendly connections per group

---

### 4.7 Sessions & Scheduling

**Unified session system with 8 pre-configured types:**
coaching, group_coaching, workshop, mastermind, review_board_mock, peer_coaching, office_hours, webinar

**Each session type has defined roles** (10 available): presenter, evaluator, observer, facilitator, participant, hot_seat, member, coach, coachee, attendee

**Scheduling integrations:**
- **Cal.com** — primary scheduling tool. SSO authentication, booking creation via API, webhook for booking events (created, cancelled). Event type mappings link Cal.com event types to session types.
- **Google Calendar** — event creation, iCal feed generation, calendar token management
- **Calendly** — event URI tracking for group sessions

**How scheduling works for clients:**
1. Module has a session component (e.g., coaching session)
2. Client clicks "Book Session" on the module page
3. The platform resolves the correct instructor's Cal.com booking URL using the 3-tier staff hierarchy (see Section 5)
4. Client books directly through Cal.com
5. Cal.com webhook updates the session record in the database
6. Both client and instructor get email confirmation

**Cohort session management (G1-G7):**
- **Cohort assignment on enrollment (G1):** Admin selects cohort when enrolling a client; the `enroll_with_credits` RPC accepts `p_cohort_id` for atomic enrollment + cohort assignment.
- **Google Meet automation (G2):** Sessions auto-generate Meet links via Google Calendar API when created.
- **Instructor assignment (G3):** Cohorts have a `lead_instructor_id`; individual sessions have an `instructor_id`. Instructor name displayed on session cards.
- **Attendance tracking (G4):** `cohort_session_attendance` table tracks present/absent/excused/late per participant. `AttendanceTracker` component for instructors/coaches to mark attendance.
- **Bulk session generation (G5):** "Generate Sessions" action creates weekly or biweekly sessions linked to sequential modules.
- **Session reminders (G6):** `send-schedule-reminders` edge function sends email + in-app notifications 24h and 1h before sessions.
- **Session notes/recap (G7):** Past sessions display recording URL, summary, and action items. Instructors can edit recap content visible to participants.

---

### 4.8 Coaching & Instructor Workflows

**Teaching Dashboard** (`/teaching`):
- 5 stat cards: Total Programs, Active Clients, Groups, Pending Badges, Your Roles
- Pending assignments widget (searchable, filterable, sortable)
- Upcoming sessions widget (next 3 group sessions)
- Shared items from clients: goals, decisions, tasks (3 columns)
- Programs tab: card grid with role badge, category, module/client counts
- Individual modules tab: list view with type icons

**Client Progress Tracking:**
- Client list with stats (total clients, avg completion, active enrollments)
- Search and filter by name, email, program, status
- Student detail page with tabs: Overview, Notes, Reflections, Feedback, Assignments
- Manual module completion control (instructor can mark modules complete)
- **Development item creation** — "+" button per module row to create development items for the client

**Cohort & Session Management (Instructor/Coach):**
- **Cohort instructor assignment:** Lead instructor assigned at cohort level (`lead_instructor_id`), individual session instructors assigned per session (`instructor_id`). Names displayed on session cards.
- **Attendance tracking:** `AttendanceTracker` component allows instructors and coaches to mark attendance (present/absent/excused/late) per participant per session. Clients can view their own attendance record.
- **Session recap editing:** After sessions, instructors can edit recording URL, session summary, and action items. Participants view the published recap on their session detail page.
- **Gate waiver (DP3):** Coaches and instructors can waive assessment gates on guided path milestones via `WaiveGateDialog` with required reason. Gates are advisory (never blocking).
- **Development Profile view:** Coaches and instructors can view a client's unified Development Profile (5 sections) via `/teaching/students/:enrollmentId/development-profile`.

> ⚠️ **Gap (GT1):** The above cohort features (attendance marking, recap editing) are currently only accessible through admin UI. The instructor/coach **teaching workflow** for cohorts is not yet built — no `/teaching/cohorts` page, no cohort sessions on the teaching dashboard, and missing RLS policies for coach access to `program_cohorts`. Implementation plan ready: see `docs/COHORT_SCHEDULING_ANALYSIS.md` GT1 section and `.claude/plans/proud-jumping-fountain.md`.

**Teaching Tools:**
- Assignment grading with rubric support
- Scenario evaluation with section-by-section scoring and revision requests
- Badge approval (batch or individual) with credential URL support
- Capability assessment evaluation (view shared assessments, give evaluations)
- Staff notes per module (shared with other staff)
- Group management with session scheduling and attendance

---

### 4.9 Resources & Learning Content

**Resource Library:** Admin-curated collection of learning resources:
- Organized by categories and collections
- Feature-gated access (some resources require specific plan levels or credits)
- Resource viewer page for inline viewing (PDFs, videos, documents)
- Credit-based unlocking for premium resources

**Learning Content Delivery:**
- **Current (primary):** Rise content embedded directly in Hub — xAPI mode (auto-tracking, resume) or web mode (manual completion). See Section 6 for details.
- **Legacy:** TalentLMS (SSO, SCORM, xAPI webhooks) — kept for active programs only, being sunset

---

### 4.10 Guided Paths

Guided paths are structured development journeys that convert assessment-driven recommendations into actionable goals, milestones, and tasks:

- **Templates:** Admin creates guided path templates with goals → milestones → tasks. Each milestone has recommended days (min/optimal/max) for pace calculation.
- **Families:** Templates belong to guided path families for grouping related paths.
- **Survey-driven matching:** Clients take an intake survey (`GuidedPathSurveyWizard`) that matches them to appropriate templates based on their responses. After completing the survey, a **PathConfirmation** step shows matched templates with pace selection and estimated completion date.
- **Pace selection:** Three pace options — Intensive (min days), Standard (optimal days, recommended), Part-time (max days). The selected pace determines milestone due dates.
- **Instantiation:** When the client confirms, the shared `instantiateTemplate()` service creates actual goals, milestones, and tasks from the template. Each goal retains `template_goal_id` and `instantiation_id` for traceability.
- **Manual copy:** Clients can also copy a path directly from the `GuidedPathDetail` page using the same shared instantiation service.
- **Assessment gates (advisory):** Template milestones can have assessment gates configured by admin — linking to capability domains or assessment dimensions with a minimum score. Gates show traffic-light indicators (🟢🟡🔴⚪) but are advisory, not blocking. Coaches and instructors can waive gates with a required reason.
- **Tracking:** `guided_path_instantiations` tracks the lifecycle (active/paused/completed/abandoned) with pace, estimated and actual completion dates.

---

### 4.11 Development Profile

The **Development Profile** (`/development-profile`) is a unified view connecting assessments, goals, development items, skills, and guided paths into a single dashboard:

**Five sections:**

| Section | What It Shows |
|---------|---------------|
| **Strengths & Gaps Matrix** | Latest capability snapshot domain scores normalized to percentages, color-coded (green ≥80%, amber 50-79%, red <50%), with trend arrows comparing latest vs previous snapshot |
| **Active Development Items** | Development items grouped by linked domain, with status badges (pending/in_progress/completed) |
| **Assessment-Linked Goal Progress** | Goals with assessment links showing progress bar + score journey (creation → current → target) |
| **Skills Earned** | User skills displayed as badge grid grouped by skill category |
| **Guided Path Progress** | Active guided paths from survey responses with completion percentage and template details |

**Access:**
- **Client:** `/development-profile` — sees their own data
- **Coach/Instructor:** `/teaching/students/:enrollmentId/development-profile` — sees client's data (resolves client user ID from enrollment)
- **Admin:** Can view any profile via admin tools

---

### 4.12 Credits, Plans & Entitlements

**Two plan systems:**

| System | Table | Purpose |
|--------|-------|---------|
| **Subscription Plans** | `plans` (tier 0-4) | Account-level access and billing. Determines which features users can access based on tier level. |
| **Program Plans** | `program_plans` | Per-enrollment features. Controls what a client can do within a specific program. |

**Entitlements merging:** The `useEntitlements` hook merges 5 access sources (highest wins):
1. Subscription plan
2. Program plan
3. Add-ons
4. Tracks (learning path bundles)
5. Organization-sponsored features

**Deny override:** When an organization sets `is_restrictive = true` on a feature, it's explicitly DENIED, overriding all grants from any source.

**Credits system:**
- Credits are the platform's internal currency for consuming services (AI features, premium resources, etc.)
- Sources: plan allowance + program plan allowance + purchased top-ups
- FIFO consumption with atomic transactions (`consume_credits_fifo` with `FOR UPDATE SKIP LOCKED`)
- Credit batches with expiration dates
- Stripe integration for purchasing top-ups

**Feature gating in the UI:**
- `<FeatureGate>` and `<CapabilityGate>` components for conditional rendering
- `useEntitlements()` hook for programmatic access checks
- `useIsMaxPlan()` to detect max-plan users (show "Contact administrator" instead of "Upgrade")
- Lock indicators in navigation for features beyond the user's plan

---

### 4.13 Notifications & Communication

**25+ notification types across 8 categories:** programs, sessions, assignments, goals, groups, assessments, system, billing

**Delivery channels:**
- In-app notifications with read/unread tracking
- Email notifications via Resend with queue and retry logic
- User-configurable notification preferences per type

**Email infrastructure:**
- Email templates stored in database (admin-editable)
- Email assets management (images, logos for templates)
- Email queue with processing and retry
- Staging mode: all emails redirect to test recipients in non-production environments

**Announcements:** Platform-wide or category-targeted announcements visible on dashboards

---

### 4.14 Organizations

Organizations allow companies to manage groups of users:

- **Organization management:** name, settings, terms, billing
- **Member management:** invite, enroll, track progress
- **Program access:** organization-sponsored program enrollments
- **Seat limits:** configurable maximum members
- **Billing:** organization-level credit purchasing and subscription management
- **Org Admin role:** dedicated dashboard with analytics, enrollment management, and billing

---

### 4.15 AI Features

**4 AI edge functions powered by Vertex AI Gemini 3 Flash (EU/Frankfurt):**

| Function | What It Does |
|----------|--------------|
| `generate-reflection-prompt` | Creates contextual reflection questions based on the client's goals, progress, assessments, and current module content |
| `course-recommendations` | Suggests next courses/modules based on assessment results, completed work, and stated goals |
| `decision-insights` | Analyzes patterns across a client's decision history — recurring themes, bias indicators, outcome patterns |
| `analytics-ai-insights` | Admin-facing analytics insights from platform usage data |

**AI safeguards:**
- Feature gating: all AI features gated behind `ai_insights` feature key (hidden from dashboard if plan lacks access)
- Credit-based consumption via `useConsumableFeature("ai_insights")` — credits deducted before each AI call
- Plan-based credit limits (free=5, base=50, pro=100, advanced=200, elite=300 uses/month)
- Specific error handling: rate limit (retry), credit exhaustion (upgrade prompt), and generic errors distinguished in UI
- Explicit consent gating (user must opt in)
- Input truncation limits (arrays capped at 20 items, strings at 500 chars, total prompts at 8K chars)
- Provider-agnostic architecture (can switch from Vertex AI to another provider)
- EU data residency (Frankfurt region)

---

## 5. Instructor & Coach Assignment System

This is one of the platform's most sophisticated systems. It controls who teaches/coaches whom, and affects scheduling, notifications, and grading visibility.

### Three-Tier Staff Hierarchy

```
┌─────────────────────────────────────────┐
│  Tier 1: Program Level (default)        │
│  program_instructors / program_coaches   │
│  "Everyone in this program"             │
├─────────────────────────────────────────┤
│  Tier 2: Module Level (overrides Tier 1)│
│  module_instructors / module_coaches     │
│  "This person teaches this module"      │
├─────────────────────────────────────────┤
│  Tier 3: Enrollment Level (highest)     │
│  enrollment_module_staff                 │
│  "This instructor handles THIS client   │
│   on THIS module"                        │
└─────────────────────────────────────────┘
```

**Resolution order (highest wins):**
1. Check `enrollment_module_staff` for a per-client assignment → use it
2. Check `module_instructors` / `module_coaches` → use it
3. Fall back to `program_instructors` / `program_coaches`

### What Each Tier Controls

| Function | Which Tier Is Used |
|----------|-------------------|
| **Session booking (Cal.com URL)** | Resolved by `useModuleSchedulingUrl` using the 3-tier hierarchy. Client sees the correct instructor's booking link. |
| **Assignment visibility** | All instructors/coaches at module + program level see pending assignments. (Enrollment-level "My Queue" filtering is planned.) |
| **Assignment notifications** | All instructors/coaches at module + program level are notified when a client submits. (Broadcast behavior — useful for partner instructors and small teams.) |
| **Grading** | Any instructor with visibility can grade. `scored_by` records who actually graded. |

### Admin UI for Assignment

| Where | What You Configure |
|-------|-------------------|
| **Admin → Programs → [Program] → Instructors/Coaches** | Program-level assignment (Tier 1) |
| **Admin → Programs → [Program] → Modules → [Module] → Staff** | Module-level assignment (Tier 2) |
| **Admin → Users → [Client] → Enrollment → Staff Assignments** | Per-client per-module assignment (Tier 3) |

### Separate System: Client Instructors & Coaches

`client_instructors` and `client_coaches` tables exist separately from `enrollment_module_staff`. These are used for **general coaching relationships** (shared goals, decisions, tasks) — not for module-level scheduling or grading. The two systems are NOT synced, by design, since a client's general coach is not necessarily their instructor on every module.

---

## 6. Content Delivery

### Legacy Flow (via TalentLMS — being sunset)

```
Rise (authoring) → SCORM export → TalentLMS (hosting) → Link from Hub
```

Client experience: Hub → Program → Module → Click link → SSO to TalentLMS → Navigate UI → Resume course → Rise content in popup. That's 5-7 clicks and 2 context switches. Kept for active legacy programs only.

### Current Flow (direct embedding — Tier 1 + Tier 2 ✅ DONE)

```
Rise (authoring) → Web or xAPI export → ZIP upload → Supabase Storage → Embedded in Hub
```

Client experience: Hub → Program → Module → Content loads inline. Zero clicks, zero context switches. Progress auto-tracked (xAPI mode) or manually marked (web mode).

### Two Content Modes

| Mode | `content_package_type` | Completion | Resume | Tracking |
|------|----------------------|------------|--------|----------|
| **Web** (Tier 1) ✅ | `web` | Manual "Mark as Complete" button | No | None |
| **xAPI** (Tier 2) ✅ | `xapi` | Auto-complete on Rise completion/passed/mastered signals | Yes (bookmark + suspend_data) | Full xAPI statements stored |

### How xAPI Content Works (Tier 2)

1. **Launch:** Client opens module → frontend calls `xapi-launch` edge function → creates or resumes xAPI session → returns auth token + xAPI config + saved resume data
2. **Render:** Frontend fetches Rise HTML from `serve-content-package`, rewrites relative URLs, renders in blob URL iframe. Installs SCORM-compatible LMS mock on parent window.
3. **Track:** As learner progresses, Rise calls mock functions (`SetBookmark`, `SetDataChunk`, etc.). Mock forwards xAPI statements to `xapi-statements` edge function.
4. **Complete:** When Rise sends completion/passed/mastered verbs, backend auto-updates `module_progress` to `completed`. Frontend polls and shows toast.
5. **Resume:** On next visit, `xapi-launch` finds existing active session, returns saved bookmark + suspend_data. LMS mock restores learner's position.

### Content Delivery Infrastructure

| Component | Purpose |
|-----------|---------|
| `serve-content-package` edge function | Auth-gated file proxy from private storage (JWT + enrollment/staff check) |
| `upload-content-package` edge function | Admin ZIP upload, extraction, storage |
| `xapi-launch` edge function | Session create/resume, auth token generation |
| `xapi-statements` edge function | xAPI statement storage, state persistence, auto-completion |
| `ContentPackageViewer.tsx` | Frontend component: blob URL iframe, LMS mock, xAPI launch/resume |
| `xapi_sessions` table | Session lifecycle, auth tokens, bookmark, suspend_data |
| `xapi_statements` table | Stored xAPI statements with verb/object/result fields |
| `module-content-packages` bucket | Private storage for Rise ZIP content (500MB limit) |

### Legacy TalentLMS Infrastructure (kept for active programs)

- `talentlms-sso` edge function for seamless SSO
- `talentlms-webhook` edge function that already parses xAPI statements
- `external_sources` + `module_external_mappings` + `external_progress` tables (generic framework for any LMS)
- `sync-talentlms-progress` for manual progress sync

---

## 7. Integrations & External Tools

| Integration | Purpose | Implementation |
|------------|---------|---------------|
| **Cal.com** | Session scheduling (1:1, group) | SSO, booking API, webhook (created/cancelled), event type mappings |
| **Google Calendar** | Calendar sync for clients and staff | Event creation, iCal feeds, token management |
| **Stripe** | Payments and billing | Checkout sessions, customer portal, credit top-ups, org billing |
| **Resend** | Transactional email | Email queue with retry, staging redirect, template system |
| **Vertex AI (Gemini)** | AI features | Reflection prompts, recommendations, insights. EU/Frankfurt region. |
| **TalentLMS** | Learning content hosting (transitioning away) | SSO, xAPI webhooks, progress sync |
| **Circle** | Community platform | SSO integration |
| **Sentry** | Error monitoring | Frontend error tracking |
| **Cloudflare Pages** | Frontend hosting | Auto-deploy from git, custom domain |

---

## 8. Admin Tooling

The admin area is the most extensive part of the platform with 71 pages. Key areas:

### Program Management
Programs, modules, module types, assignment types, scenario templates, guided paths, partner programs, tracks, skills/categories, feedback templates

### User Management
User creation with role assignment, client detail with enrollment management, instructor/coach lists, staff assignments, interest registrations, deletion requests, coach/instructor access requests

### Assessment Configuration
Assessment builder (custom assessments), capability assessments with domain/question configuration and **question type management** (dynamic types with weighted scoring), assessment families and categories, wheel of life categories, psychometric assessment catalog

### Plans & Billing
Subscription plans (tier 0-4), program plans (per-enrollment features), features management with deny override, add-ons, credit services, discount codes, consumption analytics

### Communication
Email templates (database-stored, variable substitution), email assets, email queue monitoring, notifications management, announcements with categories

### Integrations
Cal.com event type mappings, TalentLMS user management, Circle community management, Lucid/Google Drive connections

### Analytics & Monitoring
Consumption analytics, user behavior analytics, program completions, system settings, auth contexts, audit trail

---

## 9. Platform Numbers at a Glance

| Metric | Count |
|--------|-------|
| Database tables | 380+ |
| Database enums | 25 |
| Database migrations | 420 |
| Edge functions | 65 |
| Frontend pages | 164+ (71 admin, 58 client, 13 teaching, 9 org-admin, 13+ shared) |
| React hooks | 69 |
| Storage buckets | 16 |
| Notification types | 25+ |
| Session types | 8 |
| Session roles | 10 |
| Unit tests | 303 (18 test files) |
| Environment variables | 41 |

### Tech Stack Summary

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| State/Data | TanStack React Query |
| Backend | Supabase (PostgreSQL + Edge Functions + Auth + Storage) |
| Edge Functions | Deno (TypeScript) |
| Hosting | Cloudflare Pages |
| Auth | Supabase OAuth (Google, email/password) |
| Email | Resend (mail.innotrue.com) |
| Payments | Stripe |
| AI | Vertex AI Gemini 3 Flash (EU/Frankfurt) |
| Scheduling | Cal.com + Google Calendar |
| Monitoring | Sentry |
| CI/CD | GitHub Actions |

### Environments

| Environment | Branch | Purpose |
|-------------|--------|---------|
| Development | `develop` | Active development |
| Pre-production | `preprod` | Staging/QA testing |
| Production | `main` | Live platform (app.innotrue.com) |

**Deploy pipeline:** `develop` → `preprod` → `main` → push to Lovable sandbox

---

## Appendix: Key Flows

### Client Enrollment Flow
```
Admin creates enrollment
  → Credits consumed atomically (enroll_with_credits RPC)
  → module_progress records created for all active modules
  → Client sees program on dashboard
  → Welcome notification sent
```

### Assignment Submission & Grading Flow
```
Client opens module → completes assignment form → submits
  → Status: submitted
  → notify-assignment-submitted sends email to ALL staff on module + program
  → Instructor opens /teaching/assignments → finds submission
  → Grades with rubric (domain questions, scores, notes, development items)
  → scored_by + scored_at recorded
  → Status: reviewed
  → notify-assignment-graded sends email to client
```

### Session Booking Flow
```
Client clicks "Book Session" on module
  → useModuleSchedulingUrl resolves instructor's Cal.com URL
    (checks: enrollment_module_staff → module_instructors → program_instructors)
  → Client books via Cal.com
  → Cal.com webhook fires → calcom-webhook edge function
  → Session record created/updated in database
  → Both parties get confirmation email
  → If booking fails after Cal.com confirms: auto-cancel via calcom-utils
```

### Notification Flow
```
Event occurs (assignment submitted, session booked, etc.)
  → Edge function determines recipients
  → Email inserted into process-email-queue (or sent directly via Resend)
  → In-app notification created
  → Staging environment: emails redirected to test recipients
  → Production: emails sent to actual recipients via mail.innotrue.com
```

### Credit Consumption Flow
```
User triggers credit-consuming action (AI feature, resource unlock, etc.)
  → check-ai-usage verifies sufficient credits
  → consume_credits_fifo selects oldest non-expired batches (FIFO)
  → FOR UPDATE SKIP LOCKED prevents race conditions
  → Credits deducted atomically
  → If insufficient: action blocked, user shown upgrade prompt
```

---

*This document is auto-maintained alongside the codebase. For technical implementation details, see `MEMORY.md`. For the development roadmap, see `docs/ISSUES_AND_IMPROVEMENTS.md`. For product strategy, see `docs/PRODUCT_STRATEGY_YOUNG_PROFESSIONALS_AND_AI_LEARNING.md`.*
