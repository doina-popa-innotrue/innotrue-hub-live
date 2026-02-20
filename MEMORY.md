# InnoTrue Hub App - Project Memory

> Detailed completed work history: [completed-work.md](completed-work.md)

## Stack
- React + Vite + TypeScript + Supabase + Tailwind + shadcn/ui
- Domain: `app.innotrue.com` | Hosting: Cloudflare Pages | AI: Vertex AI Gemini 3 Flash (EU/Frankfurt)
- Auth: Supabase built-in OAuth | Email: Resend via `mail.innotrue.com` | Payments: Stripe

## Environments
| Env | Branch | Supabase Ref | Frontend | APP_ENV |
|---|---|---|---|---|
| Development | `develop` | `pfwlsxovvqdiwaztqxrj` (OLD) | `localhost:8080` | `development` |
| Lovable Sandbox | `main` (lovable remote) | `cezlnvdjildzxpyxyabb` | Lovable preview | `development` |
| Pre-production | `preprod` | `jtzcrirqflfnagceendt` | Cloudflare preview | `staging` |
| Production | `main` | `qfdztdgublwlmewobxmx` | `app.innotrue.com` | `production` |

**Git flow:** `feature/xyz` → `develop` → `preprod` → `main`

## Project Locations
- **Git repo (PRIMARY):** `/Users/doina/.../Work_GDrive/innotrue-hub-live`
- **Backup (OUTDATED, do NOT work here):** `.../Backups/innotrue_hub_app-main_copy`
- **Lovable sandbox:** `.../Work_GDrive/lovable-sandbox/`

## Key Documentation
| Doc | Purpose |
|-----|---------|
| `docs/ISSUES_AND_IMPROVEMENTS.md` | **11-part platform analysis + 9-phase roadmap** + Priority 0 (content delivery + cohort readiness) |
| `docs/DATA_CONFIGURATION_GUIDE.md` | **Data model reference** — 5-layer dependency chain, 3 assessment systems, data population plan |
| `docs/RLS_FIX_PLAN.md` | RLS gap fixes (30 gaps: 5 critical, 9 high, 16 medium) |
| `docs/ENVIRONMENT_CONFIGURATION.md` | 41 env vars, per-env values, cross-contamination risks |
| `docs/INTEGRATION_SETUP_GUIDE.md` | Cal.com, TalentLMS, Circle, Google Calendar setup |
| `docs/SUPABASE_OPS_QUICKSTART.md` | Edge function deploy, migration push, data/storage sync |
| `docs/LOVABLE_INTEGRATION.md` | Bidirectional Lovable ↔ live repo sync |
| `docs/TEST_PLAN.md` | Unit + E2E test plan |
| `docs/CURSOR_AND_WORKFLOW_GUIDE.md` | Cursor IDE setup, git deploy pipeline, responsive testing |
| `docs/ENTITLEMENTS_AND_FEATURE_ACCESS.md` | **Entitlements system** — 5 access sources, deny override, plan tiers, FeatureGate/CapabilityGate, admin config |
| `docs/PHASE5_PLAN.md` | **Phase 5 Self-Registration** — 14-step implementation plan + 7 new roadmap items (R1-R7). Ready for implementation. |
| `docs/IDE_SETUP_GUIDE.md` | **IDE setup for team** — VS Code (recommended), Cursor, Eclipse. Step-by-step setup, extensions, workspace config. For onboarding new developers. |
| `docs/PRODUCT_STRATEGY_YOUNG_PROFESSIONALS_AND_AI_LEARNING.md` | **Product strategy** — 6 parts: young professionals (12 ideas), AI learning (5 features), content delivery (skip SCORM → xAPI), cohort readiness (6 gaps), coach/instructor onboarding readiness (6 gaps), instructor/coach assignment & grading routing (6 gaps) |
| `docs/PLATFORM_FUNCTIONAL_OVERVIEW.md` | **Platform functional overview** — human-readable guide to the entire platform: roles, architecture, 14 functional areas, staff assignment system, content delivery, integrations, admin tooling, key flows |
| `docs/VALUE_PROPOSITION_CANVAS.md` | **Strategyzer Value Proposition Canvas** — 4 customer segments (coaching orgs, learners, coaches/instructors, corporate L&D), each with Customer Profile (jobs, pains, gains) + Value Map (products, pain relievers, gain creators), competitive differentiation, assumptions to validate |
| `docs/BUSINESS_MODEL_CANVAS.md` | **Strategyzer Business Model Canvas** — 9 building blocks: customer segments (4, multi-sided platform), value propositions, channels (awareness/evaluation/delivery/support), customer relationships, revenue streams (subscriptions + credits + org billing), key resources, key activities, key partnerships (tech + business), cost structure. Includes cross-block analysis, assumptions/risks, business model patterns, current vs target state comparison |
| `docs/COHORT_SCHEDULING_ANALYSIS.md` | **Cohort scheduling audit** — full infrastructure audit (DB schema, admin UI, calendar integrations, 3 parallel session systems), scenario walkthroughs, 10 gaps (G1-G10), build vs buy recommendation (Google Calendar for Meet links, not TalentLMS/Zoom), 3-phase implementation plan with DB changes |
| `docs/DEVELOPMENT_PROFILE_ANALYSIS.md` | **Development Profile & Assessment-Driven Guided Paths** — 7-phase plan connecting 3 assessment systems + development items + goals + guided paths into unified development journey. Assessment-gated milestones, intake-driven path recommendation, readiness dashboard. 6 new tables, ~18-28 days total. Approved for development 2026-02-18. |

## Key Source Files
- Supabase client: `src/integrations/supabase/client.ts`
- Auth: `src/pages/Auth.tsx`, `src/contexts/AuthContext.tsx`
- Routes: `src/App.tsx` | Sentry: `src/main.tsx` | Error boundary: `src/components/ErrorBoundary.tsx`
- Edge functions: `supabase/functions/` (65 functions) | Shared: `_shared/cors.ts`, `ai-config.ts`, `email-utils.ts`, `error-response.ts`, `ai-input-limits.ts`, `calcom-utils.ts`
- xAPI: `supabase/functions/xapi-launch/` (session create/resume), `supabase/functions/xapi-statements/` (LRS endpoint + state persistence)
- Assessment scoring: `src/lib/assessmentScoring.ts` (weighted question type scoring for capability assessments)
- Guided path instantiation: `src/lib/guidedPathInstantiation.ts` (shared template→goals service with pace/date logic)
- Tests: `src/lib/__tests__/` (18 files, 303 tests) | CI: `.github/workflows/ci.yml`
- Seed: `supabase/seed.sql` | Cursor rules: `.cursorrules`

## Database Schema
- 380+ tables, 25 enums, 421 migrations
- Key tables (CT3): `content_packages` (shared content library), `content_completions` (cross-program completion tracking), `program_modules.content_package_id` FK
- Key enums: `app_role` (admin, client, coach, instructor), `module_type`, `enrollment_status`
- **Two plan systems:** Subscription plans (`plans` table, tier 0-4) + Program plans (`program_plans`, per-enrollment features)
- `useEntitlements` merges 5 sources: subscription, program plan, add-ons, tracks, org-sponsored (highest wins)
- Credits additive: `plans.credit_allowance` + `program_plans.credit_allowance` + top-ups

## Three Assessment Systems (share `assessment_categories`)
| System | Table | Scoring | Visualization |
|--------|-------|---------|---------------|
| Capability | `capability_assessments` | Client-side domain averages — simple or weighted by question types (slider 1-N) | Radar (by domains or types) + evolution charts |
| Definitions (Public) | `assessment_definitions` | Server-side via `compute-assessment-scores` (confidential matrix) | Dimension bars + interpretation text |
| Psychometric | `psychometric_assessments` | None (document catalog/PDF upload) | None |

## Cohort & Session Infrastructure (already built)
- **Cohorts:** `program_cohorts` (status, capacity, dates) + `cohort_sessions` (date, time, meeting link, module link)
- **Unified sessions:** `sessions` + `session_types` (8 types: coaching, group_coaching, workshop, mastermind, review_board, peer_coaching, office_hours, webinar) + `session_type_roles` (10 roles)
- **Session participants:** `session_participants` with attendance workflow (invited → registered → confirmed → attended/no_show)
- **Groups:** `groups` + `group_memberships` + tasks, check-ins, notes, peer assessments, member links
- **Scheduling:** Cal.com (SSO, booking, webhook), Google Calendar (sync, iCal feeds), Calendly support
- **Staff assignment (3 tiers):** Program-level (`program_instructors`, `program_coaches`), Module-level (`module_instructors`, `module_coaches`), Enrollment-level (`enrollment_module_staff` — per-client per-module, overrides above)
- **Direct client assignment:** `client_instructors`, `client_coaches`
- **Notifications:** 25+ types, 8 categories, email queue with retry, in-app notifications, announcements

## Content Delivery (current state + strategy)
- **Current flow (TalentLMS):** Rise → SCORM → TalentLMS → linked from Hub (5-7 clicks, 2 context switches — poor UX)
- **Existing integration:** `talentlms-sso` (SSO), `talentlms-webhook` (xAPI parsing), `sync-talentlms-progress` (manual sync)
- **Existing framework:** `external_sources` + `module_external_mappings` + `external_progress` (generic, any LMS)
- **Strategy (decided):** Skip SCORM entirely. Go: ~~Tier 1 (Rise Web embed via iframe)~~ ✅ → ~~Tier 2 (Rise xAPI direct to Hub)~~ ✅. TalentLMS kept for active programs only, no new programs added to it.
- **Why skip SCORM:** Rise exports xAPI natively; `talentlms-webhook` already parses xAPI; SCORM only tracks completion/score while xAPI tracks everything; xAPI data feeds AI coaching features

### Content Delivery Tier 2 — Rise xAPI Integration (✅ DONE 2026-02-22)
- **Architecture:** Rise xAPI ZIP → Supabase Storage → `serve-content-package` edge function (auth-gated proxy) → rendered in blob URL iframe on parent window → parent installs SCORM/LMS mock API → Rise calls parent window's mock → mock forwards xAPI statements to `xapi-statements` edge function
- **Session management:** `xapi-launch` edge function creates/resumes xAPI sessions with auth tokens. Resumes existing active sessions automatically (returns saved bookmark + suspend_data).
- **Statement processing:** `xapi-statements` edge function stores xAPI statements, auto-completes `module_progress` on completion/passed/mastered verbs, manages session lifecycle (initialized → completed → terminated)
- **Resume support:** Rise bookmark (scroll position) and suspend_data (full course state) saved via `PUT ?stateId=bookmark|suspend_data` on `xapi-statements`. On resume, saved state returned to frontend, LMS mock restores position.
- **Content rendering:** `ContentPackageViewer.tsx` — blob URL iframe approach. Fetches HTML from `serve-content-package`, rewrites relative URLs to absolute, renders in blob iframe. Installs LMS mock on parent window with `installLmsApiOnWindow()`. Supports both `web` (manual completion) and `xapi` (auto-tracking) content types.
- **Key stability fixes:** JWT token refresh no longer destroys iframe (accessToken stored in ref), xAPI completion no longer reloads page (React state update instead of `window.location.reload()`)
- **Database tables:** `xapi_sessions` (auth_token, status, bookmark, suspend_data), `xapi_statements` (verb_id, object_id, result fields, raw_statement JSONB)
- **Edge functions (3):** `xapi-launch` (session create/resume), `xapi-statements` (statement storage + state persistence), `serve-content-package` (content proxy — shared with Tier 1)
- **Module type:** `program_modules.content_package_type` enum: `web` (Tier 1 manual) or `xapi` (Tier 2 auto-tracking)

## Priority Roadmap (from ISSUES_AND_IMPROVEMENTS.md Part 11)
**Critical (C1-C4):** ~~All resolved~~ ✅
**High (H1-H10):** ~~All resolved~~ ✅
**Medium (remaining):** ~~M2 (psychometric interest tracking)~~ ✅ DONE, ~~M9 (async notifications)~~ ✅ DONE, ~~M11 (console.log cleanup)~~ ✅ DONE, M12 (resource ratings), M13 (Zod validation), M16 (assessment templates)
**New roadmap items (R1-R7):** ~~R1 assessment question types~~ ✅ DONE, R2 coach/instructor onboarding (Phase 1), R3 enhanced coach↔client interaction (Phases 1/4/6), R4 coaches invite own clients (Phase 5), R5 enhanced org management (Phase 6), R6 Sentry coverage (cross-cutting), R7 test coverage (continuous)
**Coach-created development items:** ✅ DONE

**Priority 0 — Status (updated 2026-02-18):**
- ~~Content Tier 1 Web embed~~ ✅ DONE — Rise ZIP upload + auth-gated edge function proxy + iframe embed
- ~~Coach onboarding~~ ✅ DONE — welcome card, profile setup, enhanced empty states, role-specific welcome email
- ~~Assignment routing~~ ✅ DONE — individualized filter removed, My Queue filtering, assignment transfer dialog, async notifications
- ~~CohortDashboard~~ ✅ DONE — participant view with schedule, next session highlight, ICS, progress, group section
- ~~Join Session one-click~~ ✅ DONE — time-aware status hook, pulsing join button, dashboard widget
- ~~Content Tier 2 xAPI direct~~ ✅ DONE — Rise xAPI session management + statement storage + auto-completion + resume support
- Cohort scheduling gaps — see below

**Priority 0 — Cohort Scheduling Gaps (see `docs/COHORT_SCHEDULING_ANALYSIS.md` for full analysis):**
- ~~G1: Cohort assignment UI on enrollment~~ ✅ DONE — `enroll_with_credits` RPC accepts `p_cohort_id`, cohort dropdown on enrollment form
- ~~G2: Google Meet link automation~~ ✅ DONE — auto-generates Meet link when creating sessions
- ~~G3: Instructor on cohort/session~~ ✅ DONE — `lead_instructor_id` on cohorts, `instructor_id` on sessions, admin UI dropdowns
- ~~G4: Attendance tracking~~ ✅ DONE — `cohort_session_attendance` table, `AttendanceTracker.tsx`, instructor/coach marking
- ~~G5: Recurring session generation~~ ✅ DONE — "Generate Sessions" bulk action, weekly/biweekly recurrence
- ~~G6: Session notifications/reminders~~ ✅ DONE — `send-schedule-reminders` edge function, 24h + 1h before, `create_notification` RPC
- ~~G7: Session notes/recap~~ ✅ DONE — `recording_url`, `summary`, `action_items` on `cohort_sessions`, recap section
- **GT1: Instructor/Coach Teaching Workflow (HIGH PRIORITY, ~1 week)** — G1-G7 built DB + admin/client UI but NO teaching UI for instructors/coaches. Plan ready in `.claude/plans/proud-jumping-fountain.md`. Covers: RLS fixes (4 policies: coach SELECT on program_cohorts, UPDATE on cohort_sessions for both roles, upgrade coach attendance to ALL), new `/teaching/cohorts` list page, new `/teaching/cohorts/:cohortId` detail page (attendance marking + recap editing), dashboard cohort sessions widget, StudentDetail cohort/attendance card. 3 new files, 4 modified, 1 migration.
- ~~G8: Enrollment codes~~ ✅ DONE — `enrollment_codes` table, `redeem-enrollment-code` edge function, admin management page, public `/enroll` page, `validate_enrollment_code` RPC
- G9: Cohort analytics dashboard (1 week) — medium
- G10: Session-linked homework (3-5 days) — medium

**Priority 0 — Development Profile & Assessment-Driven Guided Paths (see `docs/DEVELOPMENT_PROFILE_ANALYSIS.md`):**
Approved for development 2026-02-18. Connects 3 assessment systems + development items + goals + guided paths into unified development journey.
- ~~DP1: Assessment ↔ Goal traceability~~ ✅ DONE — `goal_assessment_links` table, GoalForm linked assessment section, GoalCard assessment badge, GoalDetail score history
- ~~DP2: Development Profile page~~ ✅ DONE — unified 5-section page (StrengthsGapsMatrix, ActiveDevelopmentItems, AssessmentGoalProgress, SkillsEarned, GuidedPathProgress) + coach/instructor StudentDevelopmentProfile view + sidebar nav + routes
- ~~DP3: Assessment-gated milestones~~ ✅ DONE — `guided_path_milestone_gates` + `milestone_gate_overrides` tables, admin gate config on template milestones, traffic-light indicators (🟢🟡🔴⚪), coach/instructor waive with reason
- ~~DP4: Intake-driven path recommendation~~ ✅ DONE — `guided_path_instantiations` table, shared `instantiateTemplate()` service, PathConfirmation with pace selector, survey wizard bug fix, GuidedPathDetail refactored to shared service
- ~~DP5: Module ↔ domain mapping~~ ✅ DONE — `module_domain_mappings` table, `ModuleDomainMapper` component, "Domains" tab in admin module editor
- ~~DP6: Psychometric structured results~~ ✅ DONE — `psychometric_result_schemas` + `psychometric_results` tables, admin dimension schema UI, score entry dialog, PsychometricScores card on Development Profile
- ~~DP7: Readiness dashboard~~ ✅ DONE — Coach ReadinessDashboard at `/teaching/readiness`, MyReadiness client widget on Development Profile
- ~~**Known bug:** `GuidedPathSurveyWizard` saves survey response but never instantiates template goals/milestones~~ ✅ Fixed in DP4

~~**Priority 0 — Content Delivery Tier 3: Shared Content Packages & Cross-Program Completion (CT3)**~~ ✅
Implemented: 1 migration (`20260224100000_ct3_shared_content_packages.sql`), 4 edge functions modified, new Content Library admin page, ModuleForm library picker, cross-program completion hook + auto-accept, CanonicalCodes extended with content packages tab. Deployed to all 3 environments.

- ~~**CT3a: Shared Content Library**~~ ✅ — `content_packages` table + `program_modules.content_package_id` FK. 3-mode upload (shared/replace/legacy). Admin Content Library page at `/admin/content-library`. ModuleForm two-tab picker (From Library / Upload New) with migrate-to-library button.
- ~~**CT3b: Cross-Program Completion**~~ ✅ — `content_completions` table. `xapi-statements` writes completion on xAPI verb. `useCrossProgramCompletion` extended with 3rd data source. Client `ModuleDetail` auto-accepts completion from shared content. `CanonicalCodesManagement` now shows content packages tab.
- **`canonical_code` override** — kept as manual override for different content that should count as equivalent.

**Phases:** ~~P0 cohort scheduling gaps (G1-G7)~~ ✅ → ~~Development Profile (DP1-DP4)~~ ✅ → ~~Content Tier 2 xAPI~~ ✅ → ~~Cohort quality (G9-G10, GT1)~~ ✅ → ~~DP5~~ ✅ → ~~CT3 Shared Content~~ ✅ → ~~DP6-DP7~~ ✅ → ~~G8 Enrollment Codes~~ ✅ → 5-Self-Registration (Phase 5) → 3-AI/Engagement → 1-Onboarding → 2-Assessment → 4-Peer → 6-Enterprise → 7-Mobile → 8-Integrations → 9-Strategic

## Coach/Instructor Readiness
- **Teaching workflows:** ✅ All production-ready (assignments, scenarios, badges, assessments, groups, cohorts, client progress, notes)
- **Cohort teaching workflow (GT1) ✅ DONE:** Instructors AND coaches can browse cohorts (`/teaching/cohorts`), view cohort detail with sessions, mark attendance (reuses `CohortSessionAttendance`), edit recap + recording URL, notify clients via RPC, see homework assignments per session, view enrolled clients with attendance summary. Dashboard widget shows upcoming cohort sessions merged with group sessions. StudentDetail shows cohort assignment card. Symmetric RLS for both roles.
- **Onboarding:** ✅ DONE — Staff Welcome Card with 4-step checklist, Staff Profile setup (bio, specializations, company), enhanced empty states on teaching pages, role-specific welcome emails
- **Admin creates coaches** via `/admin/users` — no self-registration needed currently
- **Key pages:** `/teaching` (dashboard), `/teaching/students` (clients), `/teaching/readiness` (DP7 readiness dashboard), `/teaching/assignments`, `/teaching/scenarios`, `/teaching/badges`, `/teaching/assessments`, `/teaching/groups`, `/teaching/cohorts`
- **Remaining:** Teaching FAQ/quick guide page (nice to have)

## Instructor/Coach Assignment & Grading
- **3-tier staff assignment:** program → module → enrollment (personal per client). All have admin UI.
- **Assignment grading:** Full rubric support, scored_by tracking, email notifications, PendingAssignments page scoped by module/program
- **What works:** Assign instructor to module (everyone sees same), personal instructor per client (ALL modules — individualized filter removed 2026-02-18), grading with rubric + development items, **"My Queue" filtering** on PendingAssignments, **assignment transfer dialog** between staff members
- **Session scheduling:** Already enrollment-aware via `useModuleSchedulingUrl` hook — resolves Cal.com booking URL using 3-tier hierarchy (enrollment_module_staff → module_instructors → program_instructors). No changes needed.
- **Notification behavior:** `notify-assignment-submitted` now uses smart routing — personal instructor (`enrollment_module_staff`) gets priority; falls back to broadcast to ALL instructors/coaches at module + program level. `notify-assignment-graded` notifies client.
- **Client sees personal instructor:** ✅ `ModuleTeamContact` checks `enrollment_module_staff` and highlights personal instructor with distinct styling
- **Remaining gaps:** `assessor_id` field is working correctly (tracks who created assessment, `scored_by` tracks grader)
- **Key components:** `InstructorCoachAssignment` (module/program), `EnrollmentModuleStaffManager` (per-client per-module), `InstructorAssignmentScoring` (grading), `PendingAssignments` (queue), `TransferAssignmentDialog` (transfer)
- **Key hooks:** `useModuleSchedulingUrl` (3-tier Cal.com URL resolution, enrollment-aware)
- **Key edge functions:** `notify-assignment-submitted` (async, broadcasts), `notify-assignment-graded` (async, notifies client)
- **Note:** `client_instructors`/`client_coaches` are separate from `enrollment_module_staff` — used for general coaching relationships (decisions, tasks), not synced by design

## Recommended Execution Order (updated 2026-02-19)
1. ~~C1-C4~~ ✅ → ~~H1-H10~~ ✅
2. ~~Priority 0 Content Delivery Tier 1~~ ✅ — Rise Web embed via iframe
3. ~~Priority 0 Coach Onboarding~~ ✅ — welcome card + profile setup + empty states + welcome email
4. ~~Priority 0 Assignment Routing~~ ✅ — individualized filter + My Queue + assignment transfer + async notifications + smart routing
5. ~~Priority 0 Cohort Core~~ ✅ — CohortDashboard + Join Session one-click + calendar + dashboard widget
6. ~~Priority 0 Cohort Scheduling Gaps (G1-G7)~~ ✅ — enrollment UI + Meet links + instructor + recurrence + attendance + notifications + session notes
7. ~~**Development Profile (DP1-DP4)**~~ ✅ — assessment↔goal links, profile page, gated milestones, intake-driven paths
8. ~~**Content Delivery Tier 2**~~ ✅ — Rise xAPI integration with session management, auto-completion, resume
9. ~~**GT1 Teaching Cohort Workflow**~~ ✅ — instructor/coach cohort UI, attendance, recap, homework, dashboard integration
10. ~~**Cohort Quality (G9-G10)**~~ ✅ — analytics dashboard + session-linked homework
11. ~~**DP5 Module↔Domain Mapping**~~ ✅ — `module_domain_mappings` table, admin UI, "Domains" tab
12. **CT3 Shared Content Packages & Cross-Program Completion** — `content_packages` table, `content_completions` table, content library picker, xAPI propagation (~3-5 days)
13. ~~Quick medium wins (M2, M11)~~ ✅ — assessment interest tracking on dashboard, console cleanup across 20 files
14. ~~G8 Self-Enrollment Codes~~ ✅ DONE (2026-02-25) — `enrollment_codes` table, `redeem-enrollment-code` edge function, admin EnrollmentCodesManagement page (quick generator + CRUD), public `/enroll` page (code validation + redemption), `validate_enrollment_code` RPC, notification on redemption
15. **Phase 5 Self-Registration** — plan complete in `docs/PHASE5_PLAN.md` (14 steps)
16. ~~Development Profile (DP6-DP7)~~ ✅ DONE (2026-02-24) — psychometric structured results, readiness dashboard
17. Phase 3 AI — system prompt hardening first (2-3 days), then AI Learning Companion
18. Remaining phases by business priority

## Known Issues
- (none currently — all critical/high items documented in roadmap above)

## Resolved Issues
- **C1 — Credits FeatureGate (2026-02-15):** Removed FeatureGate wrapper from Credits.tsx — credits is universal across all plans.
- **C2 — AuthContext role fallback (2026-02-15):** Removed silent `roles = ["client"]` fallback from 4 locations. Added `authError` state + error/no-roles UI in ProtectedRoute. Unblocks safe Google OAuth re-enable.
- **C3 — Credit loss on failed enrollment (2026-02-15):** Created `enroll_with_credits` atomic RPC. Credits + enrollment in single transaction with auto-rollback. Also fixed M6 (`FOR UPDATE SKIP LOCKED` on `consume_credits_fifo`).
- **H1 — Empty client dashboard (2026-02-16):** Added OnboardingWelcomeCard with 4-step getting-started checklist. Auto-hides on completion or dismiss (localStorage).
- **C4 — Cal.com orphaned bookings (2026-02-16):** Auto-cancel Cal.com booking on DB failure in both calcom-create-booking and calcom-webhook. Added BOOKING_CANCELLED handler for two-way sync. Created `_shared/calcom-utils.ts` helper.
- **H2 — File upload validation (2026-02-16):** Created `src/lib/fileValidation.ts` with bucket-specific MIME/size presets. Applied to all 13 upload interfaces across admin, client, coach, instructor areas.
- **H3 — AI input limits (2026-02-16):** Created `_shared/ai-input-limits.ts` with truncation helpers. Applied to 3 AI edge functions (generate-reflection-prompt, course-recommendations, decision-insights).
- **H5 — Express interest status (2026-02-16):** Added "My Interest Registrations" section to ClientDashboard with color-coded status badges (pending/contacted/enrolled/declined).
- **H4 — Welcome email (2026-02-15):** verify-signup now triggers send-welcome-email after successful verification (non-blocking, service role auth).
- **H7 — N+1 query (2026-02-15):** Replaced per-module progress queries with single batched `.in()` query in ClientDetail.
- **H8 — Assignment grading guard (2026-02-15):** Added status check — grading only allowed when assignment is "submitted".
- **Preprod Auth Email Hook (2026-02-14):** Incorrect Authorization header. Fixed with correct service role key.
- **Profiles RLS recursion (2026-02-14):** Circular RLS on profiles. Fixed via `client_can_view_staff_profile()` SECURITY DEFINER function.

## Current State (as of 2026-02-19)
- All strict TypeScript flags enabled (including strictNullChecks). 0 errors.
- Self-registration disabled during pilot. All users admin-created.
- 16 storage buckets on all 3 Supabase projects
- Full environment isolation (Stripe test/live, separate Cal.com keys, etc.)
- Resend: 1 API key, 1 domain, SMTP configured on all projects
- Lovable sync pipeline operational (bidirectional)
- Supabase ops scripts operational (deploy, push, sync data/storage)
- Comprehensive analysis complete: 11-part issues doc + data config guide deployed
- **All C1-C4 critical and H1-H10 high items resolved.** 3 medium items remain (M12, M13, M16). M2, M9, M11 resolved.
- **Phase 5 plan complete** (`docs/PHASE5_PLAN.md`) — 14 steps covering self-registration, role applications, enrollment codes, bulk import, org invite flow. Not yet implemented.
- **AI infrastructure:** 4 edge functions (decision-insights, course-recommendations, generate-reflection-prompt, analytics-ai-insights), Vertex AI Gemini 3 Flash (EU/Frankfurt), input truncation, credit-based consumption (`useConsumableFeature("ai_insights")` pattern), explicit consent gating, provider-agnostic architecture. All AI features gated behind `ai_insights` feature key with plan-based credit limits (free=5, base=50, pro=100, advanced=200, elite=300).
- **Product strategy documented** (`docs/PRODUCT_STRATEGY_YOUNG_PROFESSIONALS_AND_AI_LEARNING.md`): 6 parts — young professionals (12 ideas), AI learning (5 features), content delivery (skip SCORM → xAPI), cohort readiness (6 gaps), coach/instructor onboarding (6 gaps), instructor/coach assignment & grading routing (6 gaps)
- **Content delivery Tier 1 + Tier 2 DONE:** Tier 1: Rise ZIP upload + auth-gated edge function proxy + iframe embed in ModuleDetail. Private storage bucket, JWT + enrollment check on every request. Tier 2: Rise xAPI integration with session management (`xapi-launch`), statement storage (`xapi-statements`), auto-completion on xAPI verbs, resume support (bookmark + suspend_data persistence). TalentLMS kept for active programs only.
- **Cohort core experience + G1-G7 DONE:** CohortDashboard (schedule timeline, next session, ICS, progress), CohortSessionCard (time-aware status, pulsing join, ICS), Calendar integration, ClientDashboard widget. G1-G7 gaps resolved: cohort assignment on enrollment (`enroll_with_credits` RPC with `p_cohort_id`), Google Meet automation, instructor assignment on cohorts (`lead_instructor_id`) and sessions (`instructor_id`), attendance tracking (`cohort_session_attendance` — instructors/coaches mark, clients read own), bulk session generation, session reminders (`send-schedule-reminders` edge function), session notes/recap (instructors edit, participants view). **Remaining:** G8 (session quality/feedback), G9 (cohort analytics), G10 (multi-cohort management). See `docs/COHORT_SCHEDULING_ANALYSIS.md`.
- **Coach/instructor onboarding DONE:** Staff Welcome Card, profile setup (bio, specializations, company), enhanced empty states, role-specific welcome emails.
- **Assignment routing DONE:** My Queue filtering, assignment transfer dialog, async notifications via create_notification RPC. Remaining: configurable notification routing (nice to have), assessor_id cleanup.
- **Development Profile DP1-DP7 DONE** (`docs/DEVELOPMENT_PROFILE_ANALYSIS.md`): Assessment↔goal linking (`goal_assessment_links`), unified Development Profile page (7 sections), assessment-gated milestones (`guided_path_milestone_gates` + `milestone_gate_overrides`), path instantiation service (`guided_path_instantiations`), module↔domain mapping (`module_domain_mappings`), psychometric structured results (`psychometric_result_schemas` + `psychometric_results`), readiness dashboard (coach + client).
- **Key new components (DP1-DP4):**
  - `src/pages/client/DevelopmentProfile.tsx` — unified 5-section development profile (StrengthsGapsMatrix, ActiveDevelopmentItems, AssessmentGoalProgress, SkillsEarned, GuidedPathProgress)
  - `src/pages/instructor/StudentDevelopmentProfile.tsx` — coach/instructor view of client's development profile
  - `src/lib/guidedPathInstantiation.ts` — shared `instantiateTemplate()` + `estimateCompletionDate()` service
  - `src/components/guided-paths/PathConfirmation.tsx` — pace selector + instantiation confirmation
  - `src/components/guided-paths/MilestoneGateStatus.tsx` — traffic-light gate indicators (🟢🟡🔴⚪)
  - `src/components/guided-paths/MilestoneGateDialog.tsx` — admin gate config dialog
  - `src/components/guided-paths/WaiveGateDialog.tsx` — coach/instructor gate waiver
  - `src/hooks/useGoalAssessmentLinks.ts` — goal↔assessment CRUD
  - `src/hooks/useMilestoneGates.ts` — gates CRUD, batch fetch, status computation, overrides
- **Content delivery Tier 2 xAPI DONE** (2026-02-22): 3 new edge functions (`xapi-launch`, `xapi-statements`, plus modified `serve-content-package`), 2 new DB tables (`xapi_sessions`, `xapi_statements`), `ContentPackageViewer.tsx` rewritten with LMS mock + resume support. Deployed to prod + preprod.
- **Key xAPI components:**
  - `src/components/modules/ContentPackageViewer.tsx` — blob URL iframe rendering, LMS mock installation, xAPI launch/resume, bookmark/suspend_data persistence
  - `supabase/functions/xapi-launch/index.ts` — session create/resume, auth token generation, enrollment/staff access checks
  - `supabase/functions/xapi-statements/index.ts` — statement storage, session lifecycle, auto-completion, state persistence
- **AI reflection prompt fix (2026-02-19):** `WeeklyReflectionCard` now gated behind `hasFeature("ai_insights")`, consumes credits via `useConsumableFeature("ai_insights")` before generating, shows remaining credits + specific error messages (rate limit vs credit exhaustion vs generic). Edge function returns specific 429/402 responses. Hook parses error body for user-friendly messages.
- **G8 Self-Enrollment Codes (2026-02-25):** `enrollment_codes` table with RLS, `validate_enrollment_code` SECURITY DEFINER RPC, `redeem-enrollment-code` edge function (free enrollments only for G8 scope), admin EnrollmentCodesManagement page with quick code generator + full CRUD dialog, public `/enroll` page with code validation → program info → auth redirect → enrollment flow. Notification type `enrollment_code_redeemed` notifies code creator. Shareable links: `{origin}/enroll?code={CODE}`.
- **Next steps:** Phase 5 Self-Registration → Phase 3 AI

## npm Scripts
```
npm run verify              # lint + typecheck + tests + build
npm run deploy:all          # develop → preprod → main (with confirmation)
npm run deploy:functions    # edge functions to prod (--only fn1, -- preprod)
npm run push:migrations     # DB migrations (-- preprod, -- all)
npm run sync:data           # config tables (--from prod --to preprod)
npm run sync:storage        # storage buckets
npm run sync:lovable        # import from Lovable
npm run update:lovable      # push to Lovable
```

## Env Vars (41 total)
Full reference: `docs/ENVIRONMENT_CONFIGURATION.md`
- NEVER share: `STRIPE_SECRET_KEY`, `OAUTH_ENCRYPTION_KEY`, Cal.com/TalentLMS/Circle keys
- Safe to share: `RESEND_API_KEY` (with staging override), `GCP_*` (stateless)
- MUST set on all envs: `SITE_URL` (falls back to prod URL if unset)

## Notes
- `npm install` needs `--legacy-peer-deps` (react-day-picker conflict)
- Edge functions all have `verify_jwt = false` — custom auth checks inside
- `send-auth-email` uses Standard Webhooks HMAC (not Bearer token)
- Supabase RPC params must use `null` not `undefined` (undefined stripped from JSON)
- Demo credentials: all use `DemoPass123!` — see `supabase/seed.sql`
