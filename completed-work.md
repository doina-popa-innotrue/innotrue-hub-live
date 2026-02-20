# Completed Work — Detailed History

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
