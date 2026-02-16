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
| `docs/ISSUES_AND_IMPROVEMENTS.md` | **11-part platform analysis + 9-phase roadmap** (C1-C4 critical, H1-H10 high, M1-M16 medium) |
| `docs/DATA_CONFIGURATION_GUIDE.md` | **Data model reference** — 5-layer dependency chain, 3 assessment systems, data population plan |
| `docs/RLS_FIX_PLAN.md` | RLS gap fixes (30 gaps: 5 critical, 9 high, 16 medium) |
| `docs/ENVIRONMENT_CONFIGURATION.md` | 41 env vars, per-env values, cross-contamination risks |
| `docs/INTEGRATION_SETUP_GUIDE.md` | Cal.com, TalentLMS, Circle, Google Calendar setup |
| `docs/SUPABASE_OPS_QUICKSTART.md` | Edge function deploy, migration push, data/storage sync |
| `docs/LOVABLE_INTEGRATION.md` | Bidirectional Lovable ↔ live repo sync |
| `docs/TEST_PLAN.md` | Unit + E2E test plan |
| `docs/CURSOR_AND_WORKFLOW_GUIDE.md` | Cursor IDE setup, git deploy pipeline, responsive testing |
| `docs/ENTITLEMENTS_AND_FEATURE_ACCESS.md` | **Entitlements system** — 5 access sources, deny override, plan tiers, FeatureGate/CapabilityGate, admin config |

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

## Priority Roadmap (from ISSUES_AND_IMPROVEMENTS.md Part 11)
**Critical (C1-C4):** ~~Credits FeatureGate~~ ✅, ~~AuthContext role fallback~~ ✅, ~~credit loss on failed enrollment~~ ✅, ~~Cal.com orphaned bookings~~ ✅
**High (H1-H10):** ~~Empty client dashboard~~ ✅, ~~file upload validation~~ ✅, ~~AI input limits~~ ✅, ~~welcome email~~ ✅, ~~express interest status~~ ✅, feature gate messaging, ~~N+1 query~~ ✅, ~~assignment guard~~ ✅, error handling, org deny override
**Phases:** 1-Onboarding/UX → 2-Assessment Intelligence → 3-AI/Engagement → 4-Peer/Social → 5-Self-Registration → 6-Enterprise → 7-Mobile → 8-Integrations → 9-Strategic

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

## Current State (as of 2026-02-15)
- All strict TypeScript flags enabled (including strictNullChecks). 0 errors.
- Self-registration disabled during pilot. All users admin-created.
- 15 storage buckets on all 3 Supabase projects
- Full environment isolation (Stripe test/live, separate Cal.com keys, etc.)
- Resend: 1 API key, 1 domain, SMTP configured on all projects
- Lovable sync pipeline operational (bidirectional)
- Supabase ops scripts operational (deploy, push, sync data/storage)
- Comprehensive analysis complete: 11-part issues doc + data config guide deployed

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
