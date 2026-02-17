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
| `docs/PRODUCT_STRATEGY_YOUNG_PROFESSIONALS_AND_AI_LEARNING.md` | **Product strategy** — 4 parts: young professional engagement (12 ideas), AI-guided learning (5 features + anti-hallucination), content delivery fix (skip SCORM → xAPI), cohort readiness assessment (6 gaps identified) |

## Key Source Files
- Supabase client: `src/integrations/supabase/client.ts`
- Auth: `src/pages/Auth.tsx`, `src/contexts/AuthContext.tsx`
- Routes: `src/App.tsx` | Sentry: `src/main.tsx` | Error boundary: `src/components/ErrorBoundary.tsx`
- Edge functions: `supabase/functions/` (61 functions) | Shared: `_shared/cors.ts`, `ai-config.ts`, `email-utils.ts`
- Tests: `src/lib/__tests__/` (16 files, 279 tests) | CI: `.github/workflows/ci.yml`
- Seed: `supabase/seed.sql` | Cursor rules: `.cursorrules`

## Database Schema
- 369+ tables, 25 enums, 403 migrations
- Key enums: `app_role` (admin, client, coach, instructor), `module_type`, `enrollment_status`
- **Two plan systems:** Subscription plans (`plans` table, tier 0-4) + Program plans (`program_plans`, per-enrollment features)
- `useEntitlements` merges 5 sources: subscription, program plan, add-ons, tracks, org-sponsored (highest wins)
- Credits additive: `plans.credit_allowance` + `program_plans.credit_allowance` + top-ups

## Three Assessment Systems (share `assessment_categories`)
| System | Table | Scoring | Visualization |
|--------|-------|---------|---------------|
| Capability | `capability_assessments` | Client-side domain averages (slider 1-N) | Radar + evolution charts |
| Definitions (Public) | `assessment_definitions` | Server-side via `compute-assessment-scores` (confidential matrix) | Dimension bars + interpretation text |
| Psychometric | `psychometric_assessments` | None (document catalog/PDF upload) | None |

## Cohort & Session Infrastructure (already built)
- **Cohorts:** `program_cohorts` (status, capacity, dates) + `cohort_sessions` (date, time, meeting link, module link)
- **Unified sessions:** `sessions` + `session_types` (8 types: coaching, group_coaching, workshop, mastermind, review_board, peer_coaching, office_hours, webinar) + `session_type_roles` (10 roles)
- **Session participants:** `session_participants` with attendance workflow (invited → registered → confirmed → attended/no_show)
- **Groups:** `groups` + `group_memberships` + tasks, check-ins, notes, peer assessments, member links
- **Scheduling:** Cal.com (SSO, booking, webhook), Google Calendar (sync, iCal feeds), Calendly support
- **Staff assignment:** `program_instructors`, `program_coaches`, `module_instructors`, `module_coaches`, `client_instructors`, `client_coaches`
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
**Medium (remaining):** M2 (psychometric interest tracking), M9 (async notifications), M11 (console.log cleanup), M12 (resource ratings), M13 (Zod validation), M16 (assessment templates)
**New roadmap items (R1-R7):** R1 assessment question types (Phase 2), R2 coach/instructor onboarding (Phase 1), R3 enhanced coach↔client interaction (Phases 1/4/6), R4 coaches invite own clients (Phase 5), R5 enhanced org management (Phase 6), R6 Sentry coverage (cross-cutting), R7 test coverage (continuous)

**Priority 0 — Content Delivery + Cohort Readiness (NEW, highest priority):**
- Content: Tier 1 Web embed (3-5 days) → Tier 2 xAPI direct (1-2 weeks)
- Cohort gaps to fill: CohortDashboard for participants (1 week), Join Session one-click (3-5 days), Session Notes/Recap (3-5 days), Auto cohort enrollment via codes (2-3 days), Cohort analytics (1 week), Session-linked homework (3-5 days)

**Phases:** **Priority 0 (content + cohort)** → 5-Self-Registration → 3-AI/Engagement → 1-Onboarding → 2-Assessment → 4-Peer → 6-Enterprise → 7-Mobile → 8-Integrations → 9-Strategic

## Recommended Execution Order (updated 2026-02-17)
1. ~~C1-C4~~ ✅ → ~~H1-H10~~ ✅
2. **Priority 0 Content Delivery Tier 1** — Rise Web embed via iframe (3-5 days)
3. **Priority 0 Cohort Readiness** — CohortDashboard + Join Session one-click (2 weeks)
4. Quick medium wins (M2, M11, M9) — interleaved (2-3 days)
5. **Phase 5 Self-Registration** — plan complete in `docs/PHASE5_PLAN.md` (14 steps)
6. **Priority 0 Content Delivery Tier 2** — xAPI direct (1-2 weeks)
7. Phase 3 AI — system prompt hardening first (2-3 days), then AI Learning Companion
8. Remaining phases by business priority

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

## Current State (as of 2026-02-17)
- All strict TypeScript flags enabled (including strictNullChecks). 0 errors.
- Self-registration disabled during pilot. All users admin-created.
- 15 storage buckets on all 3 Supabase projects
- Full environment isolation (Stripe test/live, separate Cal.com keys, etc.)
- Resend: 1 API key, 1 domain, SMTP configured on all projects
- Lovable sync pipeline operational (bidirectional)
- Supabase ops scripts operational (deploy, push, sync data/storage)
- Comprehensive analysis complete: 11-part issues doc + data config guide deployed
- **All C1-C4 critical and H1-H10 high items resolved.** 6 medium items remain (M2, M9, M11, M12, M13, M16).
- **Phase 5 plan complete** (`docs/PHASE5_PLAN.md`) — 14 steps covering self-registration, role applications, enrollment codes, bulk import, org invite flow. Not yet implemented.
- **AI infrastructure:** 4 edge functions (decision-insights, course-recommendations, generate-reflection-prompt, analytics-ai-insights), Vertex AI Gemini 3 Flash (EU/Frankfurt), input truncation, credit-based consumption, explicit consent gating, provider-agnostic architecture
- **Product strategy documented** (`docs/PRODUCT_STRATEGY_YOUNG_PROFESSIONALS_AND_AI_LEARNING.md`): 4 parts — young professionals (12 ideas), AI learning (5 features), content delivery (skip SCORM → xAPI), cohort readiness (6 gaps)
- **Content delivery strategy decided:** Skip SCORM. Tier 1 (Web embed) → Tier 2 (xAPI direct). TalentLMS kept for active programs only.
- **Cohort infrastructure strong:** 8 session types, full attendance tracking, groups with collaboration, Cal.com/Google Calendar. Gaps: CohortDashboard, Join Session UX, Session Notes, auto enrollment, cohort analytics, session homework.
- **Next steps:** Priority 0 (content embed + cohort dashboard) → Phase 5 → AI prompt hardening → Phase 3

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
