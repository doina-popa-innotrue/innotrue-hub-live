# Completed Work — Detailed History

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
