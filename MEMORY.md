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
| `docs/TEST_PLAN.md` | Unit + E2E test plan (original priorities — all completed) |
| `docs/TESTING_ROADMAP.md` | **Comprehensive testing roadmap** — 6 phases: edge function utils, hooks, E2E expansion, function integration, components, CI gates |
| `docs/CURSOR_AND_WORKFLOW_GUIDE.md` | Cursor IDE setup, git deploy pipeline, responsive testing |
| `docs/ENTITLEMENTS_AND_FEATURE_ACCESS.md` | **Entitlements system** — 5 access sources, deny override, plan tiers, FeatureGate/CapabilityGate, admin config |
| `docs/PHASE5_PLAN.md` | **Phase 5 Self-Registration** — 14-step implementation plan + 7 new roadmap items (R1-R7). Ready for implementation. |
| `docs/IDE_SETUP_GUIDE.md` | **IDE setup for team** — VS Code (recommended), Cursor, Eclipse. Step-by-step setup, extensions, workspace config. For onboarding new developers. |
| `docs/PRODUCT_STRATEGY_YOUNG_PROFESSIONALS_AND_AI_LEARNING.md` | **Product strategy** — 6 parts: young professionals (12 ideas), AI learning (5 features), content delivery (skip SCORM → xAPI), cohort readiness (6 gaps), coach/instructor onboarding readiness (6 gaps), instructor/coach assignment & grading routing (6 gaps) |
| `docs/PLATFORM_FUNCTIONAL_OVERVIEW.md` | **Platform functional overview** — human-readable guide to the entire platform: roles, architecture, 14 functional areas, staff assignment system, content delivery, integrations, admin tooling, key flows |
| `docs/VALUE_PROPOSITION_CANVAS.md` | **Strategyzer Value Proposition Canvas** — 4 customer segments (coaching orgs, learners, coaches/instructors, corporate L&D), each with Customer Profile (jobs, pains, gains) + Value Map (products, pain relievers, gain creators), competitive differentiation, assumptions to validate |
| `docs/BUSINESS_MODEL_CANVAS.md` | **Strategyzer Business Model Canvas** — 9 building blocks: customer segments (4, multi-sided platform), value propositions, channels (awareness/evaluation/delivery/support), customer relationships, revenue streams (subscriptions + credits + org billing), key resources, key activities, key partnerships (tech + business), cost structure. Includes cross-block analysis, assumptions/risks, business model patterns, current vs target state comparison |
| `docs/CREDIT_ECONOMY_AND_PAYMENTS.md` | **Unified Credit Economy & Payment System** — 2:1 credit ratio spec, 6 pricing tables (plans, top-ups, org bundles, services), 3 enrollment flows (standard, top-up-&-enrol, installments), discount/voucher system (schema, validation, admin UI), payment plan architecture (Stripe subscription-as-instalment, upfront credit consumption, access locking), 4-phase implementation plan |
| `docs/COHORT_SCHEDULING_ANALYSIS.md` | **Cohort scheduling audit** — full infrastructure audit (DB schema, admin UI, calendar integrations, 3 parallel session systems), scenario walkthroughs, 10 gaps (G1-G10), build vs buy recommendation (Google Calendar for Meet links, not TalentLMS/Zoom), 3-phase implementation plan with DB changes |
| `docs/DEVELOPMENT_PROFILE_ANALYSIS.md` | **Development Profile & Assessment-Driven Guided Paths** — 7-phase plan connecting 3 assessment systems + development items + goals + guided paths into unified development journey. Assessment-gated milestones, intake-driven path recommendation, readiness dashboard. 6 new tables, ~18-28 days total. Approved for development 2026-02-18. |

## Key Source Files
- Supabase client: `src/integrations/supabase/client.ts`
- Auth: `src/pages/Auth.tsx`, `src/contexts/AuthContext.tsx`
- Routes: `src/App.tsx` | Sentry: `src/main.tsx` | Error boundary: `src/components/ErrorBoundary.tsx`
- Edge functions: `supabase/functions/` (71 functions) | Shared: `_shared/cors.ts`, `ai-config.ts`, `email-utils.ts`, `error-response.ts`, `ai-input-limits.ts`, `calcom-utils.ts`, `content-access.ts`
- xAPI: `supabase/functions/xapi-launch/` (session create/resume), `supabase/functions/xapi-statements/` (LRS endpoint + state persistence)
- Assessment scoring: `src/lib/assessmentScoring.ts` (weighted question type scoring for capability assessments)
- Guided path instantiation: `src/lib/guidedPathInstantiation.ts` (shared template→goals service with pace/date logic)
- Tests: `src/lib/__tests__/` (18 files, 303 tests) | CI: `.github/workflows/ci.yml`
- Seed: `supabase/seed.sql` | Cursor rules: `.cursorrules`

## Database Schema
- 380+ tables, 25 enums, 425+ migrations
- Key tables (CT3): `content_packages` (shared content library), `content_completions` (cross-program completion tracking), `program_modules.content_package_id` FK
- Key tables (waitlist): `cohort_waitlist` (user_id, cohort_id, position, notified), `programs.capacity`, `client_enrollments.enrollment_source/referred_by/referral_note`
- Key enums: `app_role` (admin, client, coach, instructor), `module_type`, `enrollment_status`
- **Two plan systems (independent, additive):**
  - **Subscription plans** (`plans` table, tier 0-4) — one per user (`profiles.plan_id`), Stripe-integrated, platform-wide features
  - **Program plans** (`program_plans`, per-enrollment features) — auto-resolved from enrollment tier, never set manually
  - `enroll_with_credits` RPC auto-resolves both: Step 0c defaults tier from `programs.tiers[0]`, Step 0d resolves `program_plan_id` from `program_tier_plans` → `programs.default_program_plan_id`
- `useEntitlements` merges 5 sources: subscription, program plan, add-ons, tracks, org-sponsored (highest wins)
- Credits additive: `plans.credit_allowance` (monthly, no rollover) + `program_plans.credit_allowance` + top-ups (10-year expiry, effectively permanent). FIFO consumes plan credits first.

## Three Assessment Systems (share `assessment_categories`)
| System | Table | Scoring | Visualization |
|--------|-------|---------|---------------|
| Capability | `capability_assessments` | Client-side domain averages — simple or weighted by question types (slider 1-N) | Radar (by domains or types) + evolution charts |
| Definitions (Public) | `assessment_definitions` | Server-side via `compute-assessment-scores` (confidential matrix) | Dimension bars + interpretation text |
| Psychometric | `psychometric_assessments` | None (document catalog/PDF upload) | None |

## Cohort & Session Infrastructure (already built)
- **Cohorts:** `program_cohorts` (status, capacity, dates) + `cohort_sessions` (date, time, meeting link, module link)
- **Waitlist:** `cohort_waitlist` (position-based queue, UNIQUE per user+cohort) + `check_cohort_capacity` RPC + `join_cohort_waitlist` RPC + `notify-cohort-waitlist` edge function
- **Program capacity:** `programs.capacity` column + `check_program_capacity` RPC — enforced in `enroll_with_credits` and `useProgramEnrollment`
- **Capacity enforcement:** `enroll_with_credits` RPC checks both program + cohort capacity (skippable with `p_force=true` for admin override)
- **Tier + plan auto-resolution:** `enroll_with_credits` Step 0c defaults `tier` from `programs.tiers[0]`, Step 0d resolves `program_plan_id` from `program_tier_plans` → `programs.default_program_plan_id`. All enrollment paths (self, codes, partner, admin) get correct tier + program plan automatically.
- **Enrollment attribution:** `client_enrollments.enrollment_source` (self/admin/enrollment_code/waitlist_promotion/partner_referral) + `referred_by` (UUID) + `referral_note` (text)
- **Unified sessions:** `sessions` + `session_types` (8 types: coaching, group_coaching, workshop, mastermind, review_board, peer_coaching, office_hours, webinar) + `session_type_roles` (10 roles)
- **Session participants:** `session_participants` with attendance workflow (invited → registered → confirmed → attended/no_show)
- **Groups:** `groups` + `group_memberships` + tasks, check-ins, notes, peer assessments, member links
- **Scheduling:** Cal.com (SSO, booking, webhook), Google Calendar (sync, iCal feeds), Calendly support
- **Staff assignment (3 tiers):** Program-level (`program_instructors`, `program_coaches`), Module-level (`module_instructors`, `module_coaches`), Enrollment-level (`enrollment_module_staff` — per-client per-module, many-to-many via `staff_user_id` + `role`, overrides above)
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

**Phases:** ~~P0 cohort scheduling gaps (G1-G7)~~ ✅ → ~~Development Profile (DP1-DP4)~~ ✅ → ~~Content Tier 2 xAPI~~ ✅ → ~~Cohort quality (G9-G10, GT1)~~ ✅ → ~~DP5~~ ✅ → ~~CT3 Shared Content~~ ✅ → ~~DP6-DP7~~ ✅ → ~~G8 Enrollment Codes~~ ✅ → ~~5-Self-Registration core (Batches 1-3)~~ ✅ → ~~2B.7 Module Prerequisite UI + Time-Gating~~ ✅ → ~~2B.6 Waitlist/Cohort Management~~ ✅ → ~~2B.2 Partner Codes~~ ✅ → ~~2B.1 Alumni Lifecycle~~ ✅ → ~~2B.3 Pricing Update~~ ✅ → ~~Credit Economy Redesign (Phases 1-4)~~ ✅ → ~~Enrollment Scale + Bulk Enrollment~~ ✅ → ~~SC-1 Critical Indexes~~ ✅ → ~~SC-2 N+1 Rewrites~~ ✅ → ~~2B.5 Certification~~ ✅ → ~~2B.10 Enrollment Duration~~ ✅ → SC-3 Pagination → Phase 5 remaining → SC-4 Organisation Audit → SC-5 Retention → 3-AI/Engagement

## Coach/Instructor Readiness
- **Teaching workflows:** ✅ All production-ready (assignments, scenarios, badges, assessments, groups, cohorts, client progress, notes)
- **Cohort teaching workflow (GT1) ✅ DONE:** Instructors AND coaches can browse cohorts (`/teaching/cohorts`), view cohort detail with sessions, mark attendance (reuses `CohortSessionAttendance`), edit recap + recording URL, notify clients via RPC, see homework assignments per session, view enrolled clients with attendance summary. Dashboard widget shows upcoming cohort sessions merged with group sessions. StudentDetail shows cohort assignment card. Symmetric RLS for both roles.
- **Onboarding:** ✅ DONE — Staff Welcome Card with 4-step checklist, Staff Profile setup (bio, specializations, company), enhanced empty states on teaching pages, role-specific welcome emails
- **Coach/instructor registration:** Self-registration with admin approval (Phase 5). Users apply at `/complete-registration`, get client role immediately, admin approves/declines via `/admin/coach-requests` "Role Applications" tab. Admin can also directly create via `/admin/users`.
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
15. ~~**Phase 5 Self-Registration (core Batches 1-3)**~~ ✅ DONE (2026-02-26) — DB migration, `complete-registration` edge function, `CompleteRegistration.tsx` role selection page, `verify-signup` modified for pending_role_selection + 7-table placeholder transfer, Auth.tsx re-enabled (signup form + Google OAuth + tab switching), AuthContext `registrationStatus`, ProtectedRoute pending states, Index.tsx redirect, admin `CoachInstructorRequests` rewritten with Role Applications + Coach Assignments tabs. **Remaining:** Wheel of Life pipeline, bulk import, public assessment funnels, org self-service
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

## Current State (as of 2026-03-25)
- All strict TypeScript flags enabled (including strictNullChecks). 0 errors.
- **Self-registration enabled** (Phase 5 core). Signup form + Google OAuth active in Auth.tsx. New users choose role at `/complete-registration` (client immediate, coach/instructor via admin approval). All self-registered users get client role + free plan immediately.
- 16 storage buckets on all 3 Supabase projects
- Full environment isolation (Stripe test/live, separate Cal.com keys, etc.)
- Resend: 1 API key, 1 domain, SMTP configured on all projects
- Lovable sync pipeline operational (bidirectional)
- Supabase ops scripts operational (deploy, push, sync data/storage)
- Comprehensive analysis complete: 11-part issues doc + data config guide deployed
- **All C1-C4 critical and H1-H10 high items resolved.** 3 medium items remain (M12, M13, M16). M2, M9, M11 resolved.
- **Phase 5 core implemented** (`docs/PHASE5_PLAN.md`) — Batches 1-3 complete: self-registration flow, role selection, admin approval for coach/instructor applications, enhanced placeholder transfer (7 tables), Google OAuth support. Remaining: Wheel of Life pipeline (Step 7), bulk import (Step 9), public assessment funnels (Step 12), org self-service (Step 13).
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
- **Phase 5 Self-Registration Core (2026-02-26):** Migration (`20260226100000_phase5_self_registration.sql`) adds `profiles.registration_status/verification_status/verified_at`, `signup_verification_requests.plan_interest/context_data`, `coach_instructor_requests.source_type/specialties/certifications/bio/scheduling_url`. `complete-registration` edge function handles role selection (client → immediate, coach/instructor → pending_approval + client role), free plan assignment, Google OAuth placeholder transfer (7 tables). `CompleteRegistration.tsx` three-card role selection page. `verify-signup` modified: sets `registration_status: 'pending_role_selection'`, no longer auto-assigns client role, enhanced 7-table placeholder transfer. Auth.tsx re-enabled: signup form + Google OAuth + tab switching. AuthContext tracks `registrationStatus`. ProtectedRoute redirects `pending_role_selection` to `/complete-registration`. `CoachInstructorRequests.tsx` rewritten with "Role Applications" tab (approve adds role on top of client, decline keeps client) and "Coach Assignments" tab (existing flow).
- **Key Phase 5 components:**
  - `src/pages/CompleteRegistration.tsx` — role selection after signup verification (client/coach/instructor/organization)
  - `supabase/functions/complete-registration/index.ts` — role assignment, free plan, placeholder transfer for Google OAuth
  - `src/pages/admin/CoachInstructorRequests.tsx` — dual-tab: Role Applications (approve/decline) + Coach Assignments (existing)
- **Phase 5 deployment fixes (2026-02-26):**
  - CORS: added `*.innotrue-hub-live.pages.dev` wildcard to `_shared/cors.ts` for Cloudflare Pages preview URLs
  - `config.toml`: added `complete-registration` and `redeem-enrollment-code` with `verify_jwt = false` (were missing, causing relay rejection)
  - `signup-user`: changed `email_confirm: true` in `createUser()` to suppress duplicate auth hook email ("Set Up Your Account")
  - Auth.tsx: check `data.error` before `error` in signup handler (show specific messages not generic "Edge Function returned a non-2xx"), switch to login tab after successful signup
  - ProtectedRoute: detect Google OAuth new users (`app_metadata.provider === "google"` + zero roles) and redirect to `/complete-registration` instead of "Account Not Configured"
  - **Google OAuth root cause:** `handle_new_user` trigger sets `registration_status='complete'` (column default) for ALL new users. Required 3 fixes: (1) detect OAuth new users by `zero roles + provider === "google"` only (not `!registrationStatus`), (2) `complete-registration` idempotency guard must also check `user_roles` count (was short-circuiting with `already_complete` before creating any roles), (3) `CompleteRegistration.tsx` redirect guard must check `userRoles.length > 0` before redirecting to `/dashboard`
  - Added sign out button to `/complete-registration` page
  - Index.tsx: 500ms fast fallback to `/dashboard` for Google OAuth users (vs 6s for others), ProtectedRoute then catches and redirects to `/complete-registration`
- **2B.7 Module Prerequisite UI + Time-Gating (2026-02-22):** Lock icons + "Complete X first" messages + disabled states on client module lists. Time-gating via `available_from_date` column on `program_modules` — modules hidden before date. Admin toggle in module editor. Commit `783f06d`.
- **2B.6 Cohort Waitlist Management (2026-03-01):** Full waitlist system with capacity enforcement, enrollment attribution, admin management, and notifications. 3 migrations, 2 new components, 1 new edge function, 6 modified files.
  - **Enrollment source tracking:** 3 columns on `client_enrollments` (`enrollment_source`, `referred_by`, `referral_note`) — tracks self/admin/enrollment_code/waitlist_promotion/partner_referral attribution
  - **Program-level capacity:** `programs.capacity` column + `check_program_capacity` RPC — enforced in `enroll_with_credits` and `useProgramEnrollment`
  - **Cohort waitlist:** `cohort_waitlist` table (position-based queue) + `check_cohort_capacity` RPC + `join_cohort_waitlist` RPC + RLS policies (users manage own, admins manage all)
  - **Capacity enforcement in `enroll_with_credits`:** New params `p_force` (admin override), `p_enrollment_source`, `p_referred_by`, `p_referral_note`. 13 params total (was 9, backward compatible). Program + cohort capacity checked unless `p_force=true`.
  - **Client UI:** `CohortWaitlistButton.tsx` — join/leave waitlist, position badge, capacity-aware visibility
  - **Admin UI:** `CohortWaitlistManager.tsx` — table with promote/remove actions, waitlist count badges in ProgramCohortsManager
  - **Notification:** `notify-cohort-waitlist` edge function — notifies next N users when spots open, reuses `waitlist_spot_available` email template
  - **Capacity check in `redeem-enrollment-code`:** Program + cohort capacity checked before enrollment
  - **Admin override:** `p_force=true` in ClientDetail.tsx admin enrollment and waitlist promotion — skips all capacity checks
- **Key waitlist components:**
  - `src/components/cohort/CohortWaitlistButton.tsx` — client-facing join/leave waitlist
  - `src/components/admin/CohortWaitlistManager.tsx` — admin promote/remove waitlist entries
  - `supabase/functions/notify-cohort-waitlist/index.ts` — spot availability notification
- **2B.2 Partner Codes MVP (2026-03-01):** Partner referral attribution system. `partner_codes` + `partner_referrals` tables with RLS. `validate_partner_code` RPC. `redeem-partner-code` edge function (validates → capacity check → enroll_with_credits with `enrollment_source='partner_referral'`). Admin `PartnerCodesManagement.tsx` (PRT prefix generator, CRUD, partner filter, copy code/link, **tier selector**). Public `/partner?code=X` redemption page (**shows tier badge**). Teaching dashboard referral stats card. Sidebar nav link. `partner_codes.grants_tier` column for tier override.
- **2B.1 Alumni Lifecycle (2026-03-01):** Read-only content access for completed enrollments with configurable grace period. `completed_at` column + trigger on `client_enrollments`. `check_alumni_access` RPC. Shared `_shared/content-access.ts` modifies `serve-content-package` + `xapi-launch` with staff→active→alumni→denied access chain. `alumni-lifecycle` cron function sends nurture emails at 0/30/60/90d + grace expiry. `alumni_touchpoints` table prevents duplicates. `useAlumniAccess` hook + read-only banner in ContentPackageViewer. xAPI suppressed in read-only mode. Admin alumni info in ClientDetail.
- **2B.3 Pricing Update (2026-03-01):** Migration updates plan_prices to €49/99/179/249 monthly + annual at 20% discount. Credits scaled ~2x (300/500/1000/1500). `stripe_price_id` nulled for Stripe auto-create. Continuation plan deactivated. Subscription page already had toggle — no frontend changes needed.
- **Key new files (2B.2 + 2B.1 + 2B.3):**
  - `supabase/migrations/20260301110000_partner_codes.sql` — partner codes + referrals tables
  - `supabase/migrations/20260301120000_alumni_lifecycle.sql` — alumni grace period system
  - `supabase/migrations/20260301130000_pricing_update.sql` — pricing + credits + continuation deprecation
  - `supabase/functions/redeem-partner-code/index.ts` — partner code redemption
  - `supabase/functions/_shared/content-access.ts` — shared content access helper (staff/active/alumni/denied)
  - `supabase/functions/alumni-lifecycle/index.ts` — alumni nurture cron
  - `src/pages/admin/PartnerCodesManagement.tsx` — admin partner codes CRUD
  - `src/pages/public/RedeemPartnerCode.tsx` — public partner code redemption
  - `src/hooks/useAlumniAccess.ts` — alumni status hook
- **Tier & Program Plan Defaulting (2026-03-01):** Ensures every enrollment has consistent tier + program_plan_id. Migration `20260301140000_tier_defaulting.sql` adds:
  - `partner_codes.grants_tier` column + updated `validate_partner_code` RPC
  - `enroll_with_credits` Step 0c: tier defaults to `programs.tiers[0]` when NULL
  - `enroll_with_credits` Step 0d: `program_plan_id` resolved from `program_tier_plans(program_id, tier_name)` → `programs.default_program_plan_id` fallback
  - Fixed `redeem-enrollment-code` bug: was passing `grants_plan_id` (subscription plan FK) as `p_program_plan_id` (program plan FK) — now passes NULL, lets RPC resolve correctly
  - Partner codes admin UI: tier selector, tier badge on redemption page
  - All enrollment paths (self, enrollment codes, partner codes, admin) now auto-resolve tier + program plan
- **Stripe Credit Bundles Sync (2026-03-02):** Synced 8 Stripe "Credit Bundle" products to `org_credit_packages` with `stripe_price_id` linking. Volume-based bonus credits: 5%→40%. Migration `20260302100000_sync_stripe_credit_bundles.sql`. No individual top-up products in Stripe yet (auto-created on first checkout).
- **Credit Economy Redesign (2026-03-02 – 2026-03-03):** Unified 2:1 credit-to-EUR ratio across all pricing. 4-phase implementation:
  - **Phase 1 (Credit Recalibration):** Migration `20260302120000_credit_recalibration_2to1.sql` recalibrates all plans, packages, services, and program costs to 2:1 ratio. Seed.sql updated for fresh environments.
  - **Phase 2 (Top Up & Enrol UX):** Smart package recommendation on Credits page (reads `pendingEnrollment` from sessionStorage, computes shortfall, finds smallest adequate package). Contextual large package display (≥€1,500 hidden unless needed). "Top Up & Enroll" one-click flow. Discount code input in enrollment dialog with per-tier credit cost display. Credit cost badges on program cards. `creditsToEur()` and `formatCreditsAsEur()` utility functions in `useUserCredits.ts`.
  - **Phase 3 (Installment Plans):** `payment_schedules` table (migration `20260303010000`). Per-program installment config (`installment_options` JSONB, `upfront_discount_percent` on programs). `create-installment-checkout` edge function (Stripe subscription with `cancel_at` for fixed-term). Webhook handlers for `invoice.paid`, `invoice.payment_failed`, `subscription.deleted` with credit_installment metadata routing. Client UI payment plan selector (RadioGroup: pay in full / 3x / 6x / 12x). Enhanced `PlanLockOverlay` for payment_outstanding. Admin `PaymentSchedulesManagement` dashboard with stats, progress bars, status badges.
  - **Phase 4 (Documentation):** Updated MEMORY.md, completed-work.md, SUBSCRIPTIONS_AND_PLANS.md.
- **Key credit economy components:**
  - `src/pages/client/Credits.tsx` — complete rewrite: smart recommendation, contextual display, installment selector, "Top Up & Enroll" flow
  - `src/pages/client/ExplorePrograms.tsx` — credit cost badges on program cards, discount code wiring
  - `src/components/programs/ExpressInterestDialog.tsx` — `tierCreditCosts` map, per-tier cost display in RadioGroup
  - `src/components/admin/ProgramPlanConfig.tsx` — installment options checkboxes (3/6/12 months), upfront discount percent
  - `src/pages/admin/PaymentSchedulesManagement.tsx` — admin installment tracking dashboard
  - `supabase/functions/create-installment-checkout/index.ts` — Stripe subscription-as-instalment
  - Stripe webhook (`stripe-webhook/index.ts`) — installment lifecycle handlers (invoice.paid, payment_failed, subscription.deleted)
- **Remove Continuation Plan (2026-03-04):** Deleted ContinuationBanner component, removed continuation state from ClientDashboard, rewrote ProgramCompletions as read-only view (no "Move to Continuation"), updated AdminFAQ/PlansManagement/platformDocumentation/seed.sql. Safety-net migration `20260304100000_remove_continuation_plan.sql` moves any remaining Continuation users to Free. Alumni lifecycle (2B.1) handles completed programs — alumni is an enrollment-level state, not a plan change.
- **Stripe Webhook Config (2026-03-04):** Webhooks configured in both preprod (test mode) and production (live mode) with all 5 events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`. `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` set in both environments. Stripe price IDs auto-created on first checkout per environment.
- **Enrollment Lifecycle Features (decided 2026-03-04):** Three new roadmap items:
  - **2B.10 Enrollment Duration & Deadline Enforcement** (🔴 High) — `programs.default_duration_days` → auto-calculate `end_date` → cron enforces expiry → alumni grace starts. Prevents indefinite feature freeloading. Foundation: `end_date` column exists but unenforced, `alumni-lifecycle` cron extensible.
  - **2B.11 Feature Loss Communication** (🟠 High) — pre-completion warning (features you'll lose), post-completion dashboard notice, alumni grace banner with days remaining, `useRecentlyLostFeatures()` hook. Foundation: `useEntitlements().getAccessSource()`, `useAlumniAccess().days_remaining`.
  - **2B.12 Feature Gain Visibility** (🟡 Medium) — "What's included" on program page, dashboard feature attribution badges ("Via [Program]"), subscription page context. Foundation: `getAccessSource()`, `program_plan_features` table.
- **Credit Expiry Policy (decided 2026-03-04):** Purchased credits (top-ups + org bundles) changed from 12-month to **10-year expiry** (effectively permanent). Plan credits continue monthly reset with no rollover. Rationale: users paid real money — expiring paid credits erodes trust; FIFO already consumes plan credits first so purchased are naturally protected; 10-year avoids permanent deferred revenue liability. Migration needed to update `grant_credit_batch`, edge functions, and existing batches. Full spec in `docs/CREDIT_ECONOMY_AND_PAYMENTS.md` Section 11.
  - **2B.13 Credit Expiry Awareness** (🟠 High) — dashboard expiry banner (data exists via `get_user_credit_summary_v2`), email notification cron (`credits_expiring` notification type exists but no cron sends it), AI spend suggestions (future, Phase 3).
- **Admin Features Management UX (noted 2026-03-04):** Deny checkbox (`plan_features.is_restrictive`) is fully implemented end-to-end but **only takes effect for org-sponsored plans** — `useEntitlements` checks `is_restrictive` only in `fetchOrgSponsoredFeatures`. UI needs clarification. Also: "Programs" plan column needs explanation (admin-only, features come from per-program config not this grid), non-purchasable plans should be moved to end of table with separator.
  - **2B.14 Admin Features UX** (🟡 Medium) — deny scope tooltip, Programs plan info banner, column reordering (purchasable first, special plans at end), Enterprise legacy note if present.
- **enrollment_module_staff Unified Schema (2026-03-23):** Restructured from `instructor_id`/`coach_id` columns (one row per enrollment+module) to `staff_user_id` + `role` pattern (many-to-many). Migration `20260323100000_enrollment_module_staff_unified.sql`. Updated: `EnrollmentModuleStaffManager.tsx` (admin), `useModuleSchedulingUrl.ts`, `types.ts` regenerated. RLS policies recreated with staff self-service (view/update/insert). `client_can_view_staff_profile` function and `instructor_calcom_event_types` policy updated. Code in `ModuleTeamContact.tsx`, `TransferAssignmentDialog.tsx`, `PendingAssignments.tsx`, `notify-assignment-submitted` already used `staff_user_id`/`role` — DB now matches.
- **Schema Change Prevention Protocol (2026-03-23):** Added to CLAUDE.md. All DB changes MUST go through migrations + type regeneration + verify. Never apply schema changes directly to Supabase dashboard without a migration file.
- **Schema Drift Audit (2026-03-23):** Comprehensive audit found widespread code-to-DB mismatches. Full report: `docs/SCHEMA_DRIFT_AUDIT.md`.
  - 🟡 **Lovable type mismatch** — 20+ files use `as string` casts for tables that DO exist in DB but weren't in Lovable's type snapshot. Resolves by pushing current `types.ts`. RPC return types (`enroll_with_credits`, `join_cohort_waitlist`) return `Json` — need type assertions.
  - 🔵 **`credit-maintenance` has no cron trigger** — function exists but nothing invokes it. Credits may not be expiring as intended.
- **Schema Drift Fixes (2026-03-24):** All 3 sprints completed (18 files, 3 migrations). Details in `completed-work.md`.
  - ✅ Sprint 1 (CRITICAL): `profiles.email` + `profiles.is_disabled` columns added via migration + sync trigger, `full_name` → `name` in 5 files + 2 DB functions, `notify_session_participant_added` + `staff_has_client_relationship` fixed, 3 edge functions belt-and-suspenders
  - ✅ Sprint 2 (HIGH): 7 files fixed — phantom tables (`client_sessions`, `user_subscriptions`, `organization_subscriptions`, `wheel_of_life_scores`, `user_organization_sharing_consent`, `instructor_assignments`) replaced with correct tables, `payment_schedules.enrollment_id` made nullable, `platform_tier_id` phantom column removed
  - ✅ Sprint 3 (MEDIUM): `calendar-feed` fully rewritten — uses `module_session_participants` → `module_sessions`, `group_memberships` → `group_sessions`, `client_enrollments` → `cohort_sessions` (new), batch instructor name lookup, removed broken assignment section
  - ✅ Types regenerated from preprod after migration push, `credit-maintenance` daily cron added (`daily-credit-expiry`, 2 AM UTC)
  - ⚠️ Remaining: Lovable type mismatch — 20+ files use `as string` casts. Resolves when updated `types.ts` is pushed to Lovable. Not blocking.
- **2B.13 Credit Expiry Policy + Awareness (2026-03-24):** ✅ Completed.
  - Migration `20260324110000_credit_expiry_10year.sql`: system_settings `purchased_credit_expiry_months` = 120, updated `credit_source_types`, `credit_topup_packages`, `org_credit_packages`, retroactively extended existing batches.
  - Fixed 3 edge functions: `confirm-credit-topup` (source_type, param name, hardcoded expiry), `org-confirm-credit-purchase` (param name, hardcoded expiry), `stripe-webhook` (wrong RPC params). All now use `system_settings` as single source of truth.
  - `CreditExpiryAlert` component on ClientDashboard + Credits page. Credits page enhanced with per-batch expiry display.
  - `credit-expiry-notifications` edge function + cron migration `20260324110001_credit_expiry_notification_cron.sql` (daily 3 AM UTC). Users: 7-day window. Orgs: 30-day window → admin notifications. Deduplication built-in.
- **2B.11 Feature Loss Communication (2026-03-24):** ✅ Completed.
  - `useFeatureLossPreview()` hook — computes features at risk when access source removed. Uses `useEntitlements()` internally.
  - `AlumniGraceBanner` — amber/red banner for alumni grace period. Integrated in ClientDashboard (recently completed enrollments) + ProgramDetail.
  - `CompletionFeatureWarning` — pre-completion info alert when progress > 80%. Integrated in ProgramDetail after progress bar.
  - Post-completion dashboard notice with congratulations + grace period info.
- **2B.12 Feature Gain Visibility (2026-03-24):** ✅ Completed.
  - `FeatureSourceBadge` — color-coded badges ("Via Plan", "Via Program", "Via Add-on", "Via Track", "Via Org"). Integrated in Subscription page feature lists.
  - `ProgramFeatureList` — "What's Included" card fetching `program_plan_features`. Integrated in ProgramDetail with resolved program_plan_id (enrollment → tier mapping → program default).
  - Subscription page enhanced with source context per feature.
- **Git Hooks Infrastructure (2026-03-24):** Committed hooks in `scripts/hooks/`, auto-installed via `npm install` → `prepare` script → `scripts/setup-hooks.sh`. Two hooks: `pre-merge-commit` (blocks Lovable merges) and `post-checkout` (branch safety warning). Protects against Lovable's `as any` type pollution from its stale `types.ts` regeneration.
- **Credit Top-Up Packages Admin UI (2026-03-24):** New admin page at `/admin/credit-topup-packages` with full CRUD. Previously packages could only be managed via seed.sql. Sidebar entry: "Credit Packages".
- **Features Audit + admin_notes (2026-03-24):** Migration adds `admin_notes` column to `features` table. Marked `ai_coach`, `coach_dashboard`, `org_analytics` as system features. Populated admin_notes for all 34 features with operational context (gating, plan availability, integration details). Notes visible in Features Management admin page only.
- **Credits Page — Show All Packages (2026-03-24):** Removed `LARGE_PACKAGE_THRESHOLD_CENTS` filter. All packages always visible to users.
- **Migration Push Protocol (2026-03-24):** Documented `npm run push:migrations` as the ONLY way to apply migrations. NEVER use the Supabase dashboard SQL editor (risks type drift). Script handles project linking across all 3 environments.
- **Feature Gating — 5 New System Features (2026-03-24):** Added `resource_library`, `feedback_reviews`, `development_profile`, `export_reports`, `certificates` as system features with admin_notes. Plan mappings: resource_library/feedback_reviews/export_reports → Base+; development_profile/certificates → Pro+. FeatureGate wrappers added to MyFeedback.tsx, MyResources.tsx, DevelopmentProfile.tsx. Sidebar entries updated with featureKey for lock icon gating. Migration: `20260324130000_add_new_gating_features.sql`.
- **Enrollment Scale & Bulk Enrollment (2026-03-24):** Performance indexes migration (`20260324170000`) adds 8 critical indexes on `client_enrollments`, `program_instructors`, `program_coaches`, `module_progress`. EnrolmentsManagement fully rewritten with React Query, server-side pagination (25/page), server-side filters, progress column. New `BulkEnrollmentDialog` (4-step: program→clients→confirm→result) with `enroll_with_credits` RPC + `p_force=true`. ClientDetail enrollment cards now show inline progress bars (batch-queried module_progress).
- **Scalability & Performance Audit (2026-03-24):** Comprehensive audit of all data-heavy areas. Full findings documented below in "Scalability Audit" section. Key patterns found: N+1 queries in 14+ admin pages, missing indexes on 6 critical tables, no server-side pagination on most admin list pages, unbounded summary queries loading entire tables client-side. Roadmap items SC-1 through SC-5 created.
- **SC-1 Critical Missing Indexes (2026-03-24):** Migration `20260324180000_sc1_critical_missing_indexes.sql` adds 17 indexes across 8 tables: module_assignments (4), module_sessions (3), capability_assessments (3), assessment_responses (2), assessment_questions (1), module_progress (2), calcom_webhook_logs (1), user_credit_transactions (1 composite). Pushed to all 3 environments.
- **SC-2 N+1 Query Rewrites (2026-02-25):** Rewrote 13 pages to replace O(N) per-record DB calls with batch `.in()` queries and lookup maps. Critical: StaffAssignments (4 nested loops → 1 batch), UsersManagement (4N → 4 batch), ClientsList (5N → 5 batch), ProgramCompletions (sequential for → 1 batch). High: CoachesList, InstructorsList, ProgramsList, AssessmentInterestRegistrations, ProgramDetail, ExplorePrograms, CapabilityAssessments. Medium/Low: GroupsManagement, AdminDashboard. CapabilityAssessmentsManagement snapshot count was already acceptable (single column fetch).
- **2B.5 Certification — Auto-Badge, Verification & PDF Certificates (2026-03-25):** Complete certification system. Migration `20260325100000_certification_auto_badge.sql` adds `expires_at` on `client_badges`, `renewal_period_months` on `program_badges`, 3 indexes, 3 notification types (`badge_pending_approval`, `badge_issued`, `badge_expiring`), email template `notification_badge_pending`, and `trg_auto_create_badge_on_completion` AFTER trigger on `client_enrollments` that auto-creates `client_badges` with `pending_approval` when enrollment status changes to `completed`. **Bug fix:** `ClientBadgesSection` was fully built but never imported — now displayed in DevelopmentProfile and ClientDashboard (compact, gated behind `certificates` feature). Pending badges notice with Clock icon. Expiry display (expired/expiring_soon badges). Download Certificate (PDF) button. LinkedIn expiry params passed. **New edge functions:** `verify-badge` (public, no JWT, returns badge data for issued+public badges), `generate-certificate-pdf` (auth required, A4 landscape PDF via pdf-lib). **New page:** `/verify/badge/:badgeId` (public BadgeVerification page with certificate-style display). **ProgramBadgeManager:** `renewal_period_months` field for badge expiry configuration. **BadgeApproval:** calculates `expires_at` per badge on issuance. **send-notification-email:** added `badge_pending_approval` type mapping.
- **Admin User Management Fixes (2026-03-25):** Two bugs fixed: (1) `supabase.functions.invoke` error extraction — when edge function returns non-2xx, `data` is `null` and actual error body is in `error.context` (Response object). Created `extractFnError()` helper applied to all 7 edge function calls in UsersManagement.tsx. (2) Auto-generated password (`Math.random().toString(36)`) didn't meet `validatePassword` requirements (needs uppercase+lowercase+digit+special). New generator produces 12-char passwords with all required classes.
- **Users List Performance Fix (2026-03-25):** Eliminated N individual `get-user-email` edge function calls by reading `email` and `is_disabled` directly from `profiles` table (synced from `auth.users` by trigger). Changed profiles SELECT to include `email, is_disabled`.
- **Configurable Credit-to-EUR Ratio + Scaling Tool (2026-03-25):** Made the credit-to-EUR ratio configurable via `system_settings.credit_to_eur_ratio` (default: 2) instead of hardcoded. New `useCreditRatio()` hook reads setting with 5-min cache. Utility functions (`creditsToEur`, `formatCreditsAsEur`, `calculatePackageBonus`, `formatRatioText`) all accept ratio parameter with default fallback. Updated 5 consuming components (Credits.tsx, CreditTopupPackagesManagement.tsx, ProgramPlanConfig.tsx, ExplorePrograms.tsx, ExpressInterestDialog.tsx). New `CreditScaleDialog` on System Settings page — 3-step admin tool (configure → confirm with "SCALE" typing → result) to proportionally scale all credit balances when changing the ratio. New `scale_credit_batches` RPC with atomic scaling (SECURITY DEFINER, FOR UPDATE row locking, CEIL rounding, audit logging) — scales credit_batches, credit_topup_packages, org_credit_packages, plans.credit_allowance, program_plans.credit_allowance, program_tier_plans.credit_cost.
  - **Key new files:** `src/hooks/useCreditRatio.ts`, `src/components/admin/CreditScaleDialog.tsx`, `supabase/migrations/20260325120000_configurable_credit_ratio.sql`
  - **System Settings RLS Whitelist:** Added RLS policy allowing authenticated users to SELECT only `credit_to_eur_ratio` and `support_email` from `system_settings`. All other keys remain admin-only. Migration `20260325140000_public_system_settings_whitelist.sql`.
- **TDZ Crash Fix — Client ProgramDetail (2026-03-25):** Moved helper functions (`isTimeGated`, `arePrerequisitesMet`, etc.) before `isModuleAccessible` to fix temporal dead zone ReferenceError when `modules.filter()` invoked callback before const declarations. Commit `51894d1`.
- **Add-On Edit Dialog Fix (2026-03-25):** Local `formData` state was shadowing the `useAdminCRUD` hook's state, so `openEdit` updated the hook's form but the dialog read from the empty local state. Now uses the hook's `formData`/`setFormData` directly. Commit `a9ccbab`.
- **Multi-Role Route Enforcement (2026-03-25):** `ProtectedRoute` only checked `userRoles.includes(requireRole)` (access control), not whether the **selected** role matched the route group. Multi-role users (e.g. admin+client) could see the wrong dashboard after page refresh. Added role-route group sync check that maps roles to groups (admin/org_admin/teaching/client) and redirects to the correct dashboard when the route group doesn't match the selected role. Only applies to multi-role users (`userRoles.length > 1`). Commit `44ed12b`.
- **2B.10 Enrollment Duration & Deadline Enforcement (2026-03-25):** Time-bounded enrollments. Migration `20260325200000_enrollment_duration.sql` adds `programs.default_duration_days` (nullable INT), updates `enroll_with_credits` to auto-set `start_date = now()` and `end_date = start_date + duration_days`, backfills `start_date` on existing enrollments, creates `enrollment_deadline_touchpoints` table, 3 notification types, partial index, daily cron. New `enforce-enrollment-deadlines` edge function (5 AM UTC): 30d warning, 7d warning, expiry enforcement (transitions to `completed` → triggers alumni lifecycle). Admin: duration config in `ProgramPlanConfig.tsx` (Switch + days input), deadline display + `ExtendDeadlineButton` dialog in `ClientDetail.tsx`. Client: `EnrollmentDeadlineBanner.tsx` (amber 8-30d, red 1-7d) on `ProgramDetail.tsx` and `ClientDashboard.tsx`. NULL duration = self-paced. Deadline does not pause when enrollment paused (admin can extend manually).
  - **Key new files:** `supabase/functions/enforce-enrollment-deadlines/index.ts`, `src/components/enrollment/EnrollmentDeadlineBanner.tsx`
- **Next steps:** SC-3 Pagination → Phase 5 remaining → SC-4 Organisation audit → Phase 3 AI

## Scalability & Performance Audit (2026-03-24)

Comprehensive audit of all data-heavy areas. Findings grouped by severity with roadmap items.

### ~~SC-1: Critical Missing Indexes~~ ✅ DONE (2026-03-24)
17 indexes added via migration `20260324180000_sc1_critical_missing_indexes.sql`. Pushed to all 3 environments.

| Table | Missing Indexes | Used By |
|-------|----------------|---------|
| `module_assignments` | `module_progress_id`, `status`, `(status, updated_at)`, `scored_at` | Assignments.tsx, PendingAssignments.tsx |
| `module_sessions` | `module_id`, `enrollment_id`, `session_date` | Calendar.tsx, ModuleSessionManager.tsx |
| `module_instructors` | `(module_id, instructor_id)` composite for RLS | module_sessions RLS, module_progress RLS |
| `module_coaches` | `(module_id, coach_id)` composite for RLS | module_sessions RLS, module_progress RLS |
| `capability_assessments` | `is_active`, `program_id`, `slug` | Client assessment pages, RLS policies |
| `assessment_responses` | `user_id`, `assessment_id` | MyAssessments.tsx |
| `assessment_questions` | `assessment_id` | AssessmentBuilderDetail.tsx |
| `module_progress` | `module_id`, composite `(enrollment_id, module_id)` | Progress queries, RLS policies |
| `calcom_webhook_logs` | `created_at` | Cleanup queries |
| `user_credit_transactions` | composite `(user_id, created_at DESC)` | Transaction history queries |

**Already indexed (recent):** `client_enrollments` (8 indexes via `20260324170000`), `program_instructors`, `program_coaches`, `module_progress(enrollment_id)`.

### ~~SC-2: N+1 Query Rewrites~~ ✅ DONE (2026-02-25)
13 pages rewritten with batch `.in()` queries and lookup maps. All O(N) per-record queries eliminated.

| Severity | Page | Fix Applied |
|----------|------|-------------|
| **Critical** | `admin/StaffAssignments.tsx` | 6 sources fetched in parallel + 1 batch enrollment query with Map lookup |
| **Critical** | `admin/UsersManagement.tsx` | 4 batch queries (roles, quals, prefs, module_types) + parallel email edge calls |
| **Critical** | `admin/ClientsList.tsx` | 5 batch queries (profiles, client_profiles, enrollments, coaches, coach profiles) |
| **Critical** | `admin/ProgramCompletions.tsx` | 1 batch enrollment query grouped by user in JS |
| **High** | `admin/CoachesList.tsx` | Batch profiles with plan JOINs + batch client_coaches count |
| **High** | `admin/InstructorsList.tsx` | Batch profiles with plan JOINs + batch program_instructors count |
| **High** | `admin/ProgramsList.tsx` | 1 batch program_modules query → Map count |
| **High** | `admin/AssessmentInterestRegistrations.tsx` | 1 batch profiles query → Map lookup |
| **High** | `client/ProgramDetail.tsx` | 1 batch module_progress query → Map lookup |
| **High** | `client/ExplorePrograms.tsx` | 1 batch program_skills query → Map lookup for recommendation scoring |
| **High** | `client/CapabilityAssessments.tsx` | 1 batch evaluator profiles query → Map lookup |
| **Medium** | `admin/GroupsManagement.tsx` | 1 batch group_memberships query → Map count |
| **Low** | `admin/AdminDashboard.tsx` | 4 data fetches in parallel + 1 batch profiles query for all user IDs |

**Skipped:** `CapabilityAssessmentsManagement.tsx` snapshot count — already fetches only `assessment_id` column, acceptable for current scale.

### SC-3: Server-Side Pagination Needed (🟠 ~3-5 days)
Admin pages that load ALL records client-side with no `.range()` or `.limit()`.

| Severity | Page | Current State | Fix |
|----------|------|---------------|-----|
| **High** | `admin/NotificationsManagement.tsx` | `.limit(500)`, no pagination controls | Server-side pagination like EnrolmentsManagement |
| **High** | `admin/CapabilityAssessmentDetail.tsx` | Loads ALL snapshots (with ratings+notes) for an assessment | Paginate snapshot list |
| **High** | `client/Calendar.tsx` | 6 sequential unbounded queries | Date-range bounded + parallel queries |
| **High** | `client/Assignments.tsx` | Loads ALL assignments into memory | Server-side pagination + filters |
| **High** | `admin/ConsumptionAnalytics.tsx` | Loads ALL credit transactions to sum client-side | Server-side aggregate RPC |
| **Medium** | `admin/EmailQueueManagement.tsx` | `.limit(200)`, no pagination controls | Add pagination |
| **Medium** | `instructor/PendingAssignments.tsx` | Pending tab has no limit | Add limit + pagination |
| **Medium** | `admin/DataCleanupManager.tsx` | Loads ALL session_ids + categories to count client-side | Server-side COUNT aggregate |

**Already paginated (model to follow):** `EnrolmentsManagement.tsx` (React Query + `.range()` + count queries).

### SC-4: Organisation Functionality Audit (🟡 Future — mark for assessment)
Organisation-related tables and pages will grow significantly as org billing, multi-tenant features, and enterprise clients scale. **Not yet audited.** Items to assess in future:

- `organizations`, `organization_members`, `organization_invitations` — membership queries, admin detail pages
- `org_credit_packages`, `org_credit_purchases` — org billing, bulk credit management
- `organization_subscriptions` — org-level subscription management
- `OrganizationsManagement.tsx`, `OrganizationDetail.tsx` — N+1 patterns already detected in OrganizationDetail
- Organisation-sponsored features (`fetchOrgSponsoredFeatures` in useEntitlements) — scales with org member count
- Multi-org support — cross-org queries, org switching

### SC-5: Retention & Cleanup Policies (🟡 ~1 day)
Append-only tables that grow indefinitely without cleanup.

| Table | Current State | Risk |
|-------|---------------|------|
| `admin_audit_logs` | No cleanup. Well-indexed. | Medium — compliance may require keeping, but needs archival strategy |
| `coach_access_logs` | No cleanup. Well-indexed. | Medium — every coach page view generates a row |
| `calcom_webhook_logs` | Manual cleanup UI only. Missing `created_at` index. | Medium |
| `credit_consumption_log` | No cleanup. Well-indexed. | Low — bounded by credit usage |
| `analytics_events` | Manual cleanup only. No automated cron. | Medium — grows with every page view |
| `notifications` | ✅ Has `cleanup_old_notifications()` + edge function + configurable retention. **Verify daily cron is active.** | Low if cron verified |

### SC-6: RLS Policy Performance (🟡 Medium priority)
Complex RLS policies that may slow down as data grows.

| Policy | Concern |
|--------|---------|
| `is_session_instructor_or_coach()` on `sessions` | 5-way UNION called per-row. Expensive with many sessions. |
| `module_progress` SELECT policy | 6 OR branches with correlated EXISTS subqueries per-row |
| `user_has_feature()` | 4-way UNION ALL across 8 tables. Called per-row on `capability_assessments`. |
| `module_assignments` | **May lack RLS entirely** — no policies found in migrations. Security + performance concern. |

### SC-7: Search Performance (🟢 Low priority, future)
All search uses `ilike '%term%'` (leading wildcard = sequential scan). At thousands of records, consider adding GIN trigram indexes on `profiles.name`, `notifications.title`, and other frequently-searched text columns.

### Positive Findings (well-designed areas)
- ✅ `EnrolmentsManagement.tsx` — model for server-side pagination (React Query + `.range()` + parallel count queries)
- ✅ `useCreditBatches.ts` — uses server-side RPC for summary calculation
- ✅ `useNotifications.ts` — `.limit(50)` + realtime subscription
- ✅ `UserBehaviorAnalytics.tsx` — server-side aggregation RPC
- ✅ `notifications` table — composite + partial indexes, retention policy with cleanup function
- ✅ Credit tables — comprehensive index coverage (9+ indexes)
- ✅ Session tables — good index coverage on `sessions`, `session_participants`, `group_sessions`, `cohort_sessions`
- ✅ `client_enrollments` — 8 indexes (added 2026-03-24)

### Roadmap Priority Order
**SC-1** (indexes, ~1 day) → **SC-2** (N+1 rewrites, ~3-5 days) → **SC-3** (pagination, ~3-5 days) → **SC-5** (retention, ~1 day) → **SC-6** (RLS, ~1-2 days) → **SC-4** (org audit, future) → **SC-7** (search, future)

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
