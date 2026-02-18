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
- Edge functions: `supabase/functions/` (61 functions) | Shared: `_shared/cors.ts`, `ai-config.ts`, `email-utils.ts`
- Assessment scoring: `src/lib/assessmentScoring.ts` (weighted question type scoring for capability assessments)
- Guided path instantiation: `src/lib/guidedPathInstantiation.ts` (shared template→goals service with pace/date logic)
- Tests: `src/lib/__tests__/` (18 files, 303 tests) | CI: `.github/workflows/ci.yml`
- Seed: `supabase/seed.sql` | Cursor rules: `.cursorrules`

## Database Schema
- 373+ tables, 25 enums, 414 migrations
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
- **Strategy (decided):** Skip SCORM entirely. Go: Tier 1 (Rise Web embed via iframe, 3-5 days) → Tier 2 (Rise xAPI direct to Hub, 1-2 weeks). TalentLMS kept for active programs only, no new programs added to it.
- **Why skip SCORM:** Rise exports xAPI natively; `talentlms-webhook` already parses xAPI; SCORM only tracks completion/score while xAPI tracks everything; xAPI data feeds AI coaching features

## Priority Roadmap (from ISSUES_AND_IMPROVEMENTS.md Part 11)
**Critical (C1-C4):** ~~All resolved~~ ✅
**High (H1-H10):** ~~All resolved~~ ✅
**Medium (remaining):** M2 (psychometric interest tracking), ~~M9 (async notifications)~~ ✅ DONE, M11 (console.log cleanup), M12 (resource ratings), M13 (Zod validation), M16 (assessment templates)
**New roadmap items (R1-R7):** ~~R1 assessment question types~~ ✅ DONE, R2 coach/instructor onboarding (Phase 1), R3 enhanced coach↔client interaction (Phases 1/4/6), R4 coaches invite own clients (Phase 5), R5 enhanced org management (Phase 6), R6 Sentry coverage (cross-cutting), R7 test coverage (continuous)
**Coach-created development items:** ✅ DONE

**Priority 0 — Status (updated 2026-02-18):**
- ~~Content Tier 1 Web embed~~ ✅ DONE — Rise ZIP upload + auth-gated edge function proxy + iframe embed
- ~~Coach onboarding~~ ✅ DONE — welcome card, profile setup, enhanced empty states, role-specific welcome email
- ~~Assignment routing~~ ✅ DONE — individualized filter removed, My Queue filtering, assignment transfer dialog, async notifications
- ~~CohortDashboard~~ ✅ DONE — participant view with schedule, next session highlight, ICS, progress, group section
- ~~Join Session one-click~~ ✅ DONE — time-aware status hook, pulsing join button, dashboard widget
- Content Tier 2 xAPI direct — not started (1-2 weeks)
- Cohort scheduling gaps — see below

**Priority 0 — Cohort Scheduling Gaps (see `docs/COHORT_SCHEDULING_ANALYSIS.md` for full analysis):**
- G1: Cohort assignment UI on enrollment (1 day) — **blocker**
- G2: Google Meet link automation for sessions (2 days) — **blocker**
- G3: Instructor assignment on cohort/session (1-2 days) — high
- G4: Attendance tracking (2-3 days) — high
- G5: Recurring session generation (1-2 days) — high
- G6: Session notifications/reminders (2 days) — high
- G7: Session notes/recap (3 days) — medium
- G8: Enrollment codes (2-3 days) — Phase 5
- G9: Cohort analytics dashboard (1 week) — medium
- G10: Session-linked homework (3-5 days) — medium

**Priority 0 — Development Profile & Assessment-Driven Guided Paths (see `docs/DEVELOPMENT_PROFILE_ANALYSIS.md`):**
Approved for development 2026-02-18. Connects 3 assessment systems + development items + goals + guided paths into unified development journey.
- ~~DP1: Assessment ↔ Goal traceability~~ ✅ DONE — `goal_assessment_links` table, GoalForm linked assessment section, GoalCard assessment badge, GoalDetail score history
- ~~DP2: Development Profile page~~ ✅ DONE — unified 5-section page (StrengthsGapsMatrix, ActiveDevelopmentItems, AssessmentGoalProgress, SkillsEarned, GuidedPathProgress) + coach/instructor StudentDevelopmentProfile view + sidebar nav + routes
- ~~DP3: Assessment-gated milestones~~ ✅ DONE — `guided_path_milestone_gates` + `milestone_gate_overrides` tables, admin gate config on template milestones, traffic-light indicators (🟢🟡🔴⚪), coach/instructor waive with reason
- ~~DP4: Intake-driven path recommendation~~ ✅ DONE — `guided_path_instantiations` table, shared `instantiateTemplate()` service, PathConfirmation with pace selector, survey wizard bug fix, GuidedPathDetail refactored to shared service
- DP5: Module ↔ domain mapping (2-3 days) — modules tagged to assessment domains
- DP6: Psychometric structured results (2-3 days) — manual score entry for DISC/VIA/etc.
- DP7: Readiness dashboard (3-5 days) — capstone coach + client view combining all data
- ~~**Known bug:** `GuidedPathSurveyWizard` saves survey response but never instantiates template goals/milestones~~ ✅ Fixed in DP4

**Phases:** ~~P0 cohort scheduling gaps (G1-G6)~~ ✅ → ~~Development Profile (DP1-DP4)~~ ✅ → 5-Self-Registration → Development Profile (DP5-DP7) → Content Tier 2 xAPI → 3-AI/Engagement → 1-Onboarding → 2-Assessment → 4-Peer → 6-Enterprise → 7-Mobile → 8-Integrations → 9-Strategic

## Coach/Instructor Readiness
- **Teaching workflows:** ✅ All production-ready (assignments, scenarios, badges, assessments, groups, client progress, notes)
- **Onboarding:** ✅ DONE — Staff Welcome Card with 4-step checklist, Staff Profile setup (bio, specializations, company), enhanced empty states on teaching pages, role-specific welcome emails
- **Admin creates coaches** via `/admin/users` — no self-registration needed currently
- **Key pages:** `/teaching` (dashboard), `/teaching/students` (clients), `/teaching/assignments`, `/teaching/scenarios`, `/teaching/badges`, `/teaching/assessments`, `/teaching/groups`
- **Remaining:** Teaching FAQ/quick guide page (nice to have)

## Instructor/Coach Assignment & Grading
- **3-tier staff assignment:** program → module → enrollment (personal per client). All have admin UI.
- **Assignment grading:** Full rubric support, scored_by tracking, email notifications, PendingAssignments page scoped by module/program
- **What works:** Assign instructor to module (everyone sees same), personal instructor per client (ALL modules — individualized filter removed 2026-02-18), grading with rubric + development items, **"My Queue" filtering** on PendingAssignments, **assignment transfer dialog** between staff members
- **Session scheduling:** Already enrollment-aware via `useModuleSchedulingUrl` hook — resolves Cal.com booking URL using 3-tier hierarchy (enrollment_module_staff → module_instructors → program_instructors). No changes needed.
- **Notification behavior:** `notify-assignment-submitted` and `notify-assignment-graded` now use async `create_notification` RPC (non-blocking). Broadcasts to ALL instructors/coaches at module + program level — intentionally kept for partner instructors in small teams.
- **Remaining gaps:** Configurable notification routing (nice to have), `assessor_id` cleanup (nice to have), client doesn't see personal instructor (nice to have)
- **Key components:** `InstructorCoachAssignment` (module/program), `EnrollmentModuleStaffManager` (per-client per-module), `InstructorAssignmentScoring` (grading), `PendingAssignments` (queue), `TransferAssignmentDialog` (transfer)
- **Key hooks:** `useModuleSchedulingUrl` (3-tier Cal.com URL resolution, enrollment-aware)
- **Key edge functions:** `notify-assignment-submitted` (async, broadcasts), `notify-assignment-graded` (async, notifies client)
- **Note:** `client_instructors`/`client_coaches` are separate from `enrollment_module_staff` — used for general coaching relationships (decisions, tasks), not synced by design

## Recommended Execution Order (updated 2026-02-18)
1. ~~C1-C4~~ ✅ → ~~H1-H10~~ ✅
2. ~~Priority 0 Content Delivery Tier 1~~ ✅ — Rise Web embed via iframe
3. ~~Priority 0 Coach Onboarding~~ ✅ — welcome card + profile setup + empty states + welcome email
4. ~~Priority 0 Assignment Routing~~ ✅ — individualized filter + My Queue + assignment transfer + async notifications
5. ~~Priority 0 Cohort Core~~ ✅ — CohortDashboard + Join Session one-click + calendar + dashboard widget
6. **Priority 0 Cohort Scheduling Gaps** — G1 enrollment UI + G2 Meet links + G3 instructor + G5 recurrence (~1 week)
7. ~~**Priority 0 Cohort Quality**~~ ✅ — G4 attendance + G6 notifications + G7 session notes
8. ~~**Development Profile (DP1-DP4)**~~ ✅ — assessment↔goal links, profile page, gated milestones, intake-driven paths
9. Quick medium wins (M2, M11) — interleaved (2 days)
10. **Phase 5 Self-Registration** — plan complete in `docs/PHASE5_PLAN.md` (14 steps)
11. **Development Profile (DP5-DP7)** — module↔domain mapping, psychometric structured results, readiness dashboard (~1-2 weeks)
12. **Content Delivery Tier 2** — xAPI direct (1-2 weeks)
13. Phase 3 AI — system prompt hardening first (2-3 days), then AI Learning Companion
14. Remaining phases by business priority

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
- 15 storage buckets on all 3 Supabase projects
- Full environment isolation (Stripe test/live, separate Cal.com keys, etc.)
- Resend: 1 API key, 1 domain, SMTP configured on all projects
- Lovable sync pipeline operational (bidirectional)
- Supabase ops scripts operational (deploy, push, sync data/storage)
- Comprehensive analysis complete: 11-part issues doc + data config guide deployed
- **All C1-C4 critical and H1-H10 high items resolved.** 5 medium items remain (M2, M11, M12, M13, M16). M9 resolved.
- **Phase 5 plan complete** (`docs/PHASE5_PLAN.md`) — 14 steps covering self-registration, role applications, enrollment codes, bulk import, org invite flow. Not yet implemented.
- **AI infrastructure:** 4 edge functions (decision-insights, course-recommendations, generate-reflection-prompt, analytics-ai-insights), Vertex AI Gemini 3 Flash (EU/Frankfurt), input truncation, credit-based consumption, explicit consent gating, provider-agnostic architecture
- **Product strategy documented** (`docs/PRODUCT_STRATEGY_YOUNG_PROFESSIONALS_AND_AI_LEARNING.md`): 6 parts — young professionals (12 ideas), AI learning (5 features), content delivery (skip SCORM → xAPI), cohort readiness (6 gaps), coach/instructor onboarding (6 gaps), instructor/coach assignment & grading routing (6 gaps)
- **Content delivery Tier 1 DONE:** Rise ZIP upload + auth-gated edge function proxy + iframe embed in ModuleDetail. Private storage bucket, JWT + enrollment check on every request. TalentLMS kept for active programs only. Tier 2 (xAPI direct) not started.
- **Cohort core experience DONE:** CohortDashboard (schedule timeline, next session, ICS, progress), CohortSessionCard (time-aware status, pulsing join, ICS), Calendar integration, ClientDashboard widget. **Remaining gaps:** cohort assignment UI on enrollment, Google Meet automation, instructor on cohort, attendance tracking, recurrence, notifications, session notes. See `docs/COHORT_SCHEDULING_ANALYSIS.md`.
- **Coach/instructor onboarding DONE:** Staff Welcome Card, profile setup (bio, specializations, company), enhanced empty states, role-specific welcome emails.
- **Assignment routing DONE:** My Queue filtering, assignment transfer dialog, async notifications via create_notification RPC. Remaining: configurable notification routing (nice to have), assessor_id cleanup.
- **Development Profile DP1-DP4 DONE** (`docs/DEVELOPMENT_PROFILE_ANALYSIS.md`): Assessment↔goal linking (`goal_assessment_links`), unified Development Profile page (5 sections), assessment-gated milestones (`guided_path_milestone_gates` + `milestone_gate_overrides`), path instantiation service (`guided_path_instantiations`). 4 new tables, 15 new files, 7 modified files. Survey wizard bug fixed. DP5-DP7 remaining.
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
- **Next steps:** Phase 5 Self-Registration → DP5-DP7 → Content Tier 2 xAPI → Phase 3 AI

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
