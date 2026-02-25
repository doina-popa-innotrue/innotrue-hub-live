# Testing Roadmap

> Comprehensive, phased plan for achieving solid test coverage across all layers of the InnoTrue Hub platform.

## Current State (as of 2026-03-25)

| Layer | Framework | Test Files | Tests | Coverage |
|-------|-----------|------------|-------|----------|
| **Unit tests** (`src/lib/`) | Vitest + jsdom | 20 | 453 | 97% stmts, 95% branches |
| **E2E tests** (`e2e/tests/`) | Playwright (Chromium) | 13 | ~45 scenarios | Core journeys covered |
| **Edge functions** (`supabase/functions/`) | None | 0 | 0 | 0% |
| **React components** (`src/components/`) | None | 0 | 0 | 0% |
| **React hooks** (`src/hooks/`) | None | 0 | 0 | 0% (1 hook tested via lib/) |
| **Pages** (`src/pages/`) | None | 0 | 0 | 0% |

### What's Tested Well

- All pure utility functions in `src/lib/` (97% statement coverage)
- 22 Zod admin schemas + `validateForm` helper (100%)
- File validation, credit utils, entitlements, assessment scoring, ICS generation
- Guided path instantiation (both pure estimation and async Supabase workflow)
- 13 E2E specs covering auth, admin dashboard/plans/sidebar, client dashboard/decisions/enrollment/profile, coach dashboard, instructor dashboard/scenarios

### Key Gaps

1. **Edge functions** — 76 functions, 11 shared utilities, zero tests
2. **React components** — 273 component files, zero component-level tests
3. **React hooks** — 76 custom hooks, only `useIsMaxPlan` tested (via lib/)
4. **Pages** — 181 page files, only tested via E2E (surface level)
5. **E2E breadth** — Many features lack journey tests (content library, development profile, assessments, cohort teaching flow, enrollment codes, calendar sync)

---

## Guiding Principles

1. **Test real behavior, not implementation** — prefer testing what users/consumers see, not internal state
2. **Pure functions first** — highest ROI: fast, deterministic, no mocking needed
3. **Mock at boundaries** — Supabase client, browser APIs, fetch — not internal modules
4. **E2E for critical paths** — signup → onboard → core action → verify outcome
5. **Skip low-value targets** — shadcn/ui primitives, React Query caching, thin wrapper hooks, snapshot tests, PDF/canvas rendering
6. **Each phase is independently valuable** — ship after every phase, don't wait for "complete"

---

## Phase 1 — Edge Function Shared Utilities (Est. 2-3 sessions)

**Goal:** Test the 11 shared modules that ALL 76 edge functions depend on. Bugs here affect everything.

**Approach:** Create a Deno test runner alongside the functions, or create Node-compatible mirror tests.

### Option A: Deno Test Runner (Recommended)

```
supabase/functions/_shared/__tests__/
  cors.test.ts
  error-response.test.ts
  validation.test.ts
  ai-input-limits.test.ts
  oauth-crypto.test.ts
  request-signing.test.ts
```

Add to `package.json`:
```json
"test:functions": "cd supabase/functions && deno test _shared/__tests__/ --allow-env --allow-net"
```

### Option B: Node Mirror Tests

Copy the shared utilities' pure logic into `src/lib/` wrappers and test with Vitest. Less ideal but avoids Deno tooling setup.

### What to Test

| File | Tests | Priority |
|------|-------|----------|
| `cors.ts` | Origin matching, method filtering, preflight responses | High |
| `error-response.ts` | All error types (400/401/403/404/429/500), success types (200/201/204), CORS headers attached | High |
| `validation.ts` | Input sanitization, required field checks, type coercion | High |
| `ai-input-limits.ts` | Prompt truncation at limits, token counting, multi-field truncation | Medium |
| `oauth-crypto.ts` | Encrypt/decrypt round-trip, invalid key handling, token expiry | Medium |
| `request-signing.ts` | HMAC signature generation, verification, timestamp validation | Medium |
| `calcom-utils.ts` | URL construction, booking parameter mapping | Low |
| `email-utils.ts` | Template rendering, staging override logic, recipient validation, global mute flag | Medium |
| `content-access.ts` | Staff/active/alumni/denied access chain, grace period calculation | High |
| `ai-config.ts` | Provider selection, model fallback, endpoint URL construction | Low |
| `oauth-providers.ts` | Provider config lookup, scope generation | Low |

**Estimated tests:** ~60-80

---

## Phase 2 — Critical React Hooks (Est. 2-3 sessions)

**Goal:** Test hooks that contain significant business logic beyond simple Supabase queries.

**Approach:** Use `@testing-library/react-hooks` (or `renderHook` from `@testing-library/react`) with a mocked Supabase provider.

### Setup Required

1. Create `src/test/supabase-mock.ts` — mock Supabase client factory
2. Create `src/test/providers.tsx` — wrapper with mocked QueryClientProvider + AuthProvider + SupabaseProvider
3. Add `@testing-library/react` as a dev dependency (if not already present)

### Hooks to Test (Priority Order)

| Hook | Why | Est. Tests |
|------|-----|-----------|
| `useEntitlements` | Core gating logic, 5-source merge, deny override | 15-20 |
| `useCredits` / `useCreditBatches` | Financial logic, credit deduction, balance calculation | 10-15 |
| `useCombinedFeatureAccess` | Feature + capability merge, admin override | 8-10 |
| `useConsumableAddOns` | Quantity tracking, consumption, top-up | 8-10 |
| `useCalendarSync` | Calendar provider integration, conflict detection | 6-8 |
| `useCoachingConsent` | Consent status, gating logic | 5-6 |
| `useAuthContext` | Role detection, session management | 5-8 |
| `useAnalytics` | Event tracking, session tracking | 4-6 |

**Estimated tests:** ~70-90

### Hooks to Skip

- `useAdminCRUD` — thin CRUD wrapper, covered by E2E
- `useToast` — UI-only, shadcn wrapper
- `useSidebar` — UI state only
- Simple data-fetching hooks (`useAssessments`, `usePrograms`, etc.) — thin React Query wrappers

---

## Phase 3 — E2E Test Expansion (Est. 3-4 sessions)

**Goal:** Cover all major user journeys that aren't tested yet.

### New E2E Specs to Create

| # | File | Journey | Priority |
|---|------|---------|----------|
| 1 | `e2e/tests/client/development-profile.spec.ts` | Client views development profile → wheel of life → guided path progress | High |
| 2 | `e2e/tests/client/assessments.spec.ts` | Client takes capability assessment → views results → sees scores | High |
| 3 | `e2e/tests/client/content-library.spec.ts` | Client opens content library → launches xAPI content → completes module | High |
| 4 | `e2e/tests/admin/enrollment-codes.spec.ts` | Admin creates enrollment code → copies link → verifies code is active | High |
| 5 | `e2e/tests/client/calendar-sync.spec.ts` | Client adds session to calendar → downloads ICS file | Medium |
| 6 | `e2e/tests/instructor/cohort-teaching.spec.ts` | Instructor views cohort → sees students → opens grading | Medium |
| 7 | `e2e/tests/client/guided-path.spec.ts` | Client starts guided path → completes task → milestone progress updates | Medium |
| 8 | `e2e/tests/admin/programs.spec.ts` | Admin creates program → adds modules → assigns to plan | Medium |
| 9 | `e2e/tests/client/subscription.spec.ts` | Client views plan → sees features → (mock) checkout redirect works | Low |
| 10 | `e2e/tests/admin/user-management.spec.ts` | Admin views users → filters by role → edits profile | Low |

### E2E Infrastructure Improvements

- [ ] Add `coachPage` fixture to `e2e/fixtures/auth.ts` (currently only admin/client/instructor)
- [ ] Add visual regression with `@playwright/test` `.toHaveScreenshot()` for key pages
- [ ] Add API response mocking for Stripe/Cal.com/TalentLMS in E2E tests
- [ ] Add mobile viewport tests for responsive layouts (at least client dashboard, public profile)

**Estimated tests:** ~50-70 scenarios

---

## Phase 4 — Edge Function Integration Tests (Est. 3-4 sessions)

**Goal:** Test individual edge functions end-to-end with a real (or mocked) Supabase client.

**Approach:** Use Deno's built-in test runner with `supabase start` for a local Supabase instance.

### Setup Required

1. Create `supabase/functions/test-utils/` — shared test helpers (create test user, create test data, cleanup)
2. Add `deno.json` with test configuration
3. Document `supabase start` + `supabase db reset` as pre-test requirements

### Functions to Test (Priority Order)

| Function | Why | Est. Tests |
|----------|-----|-----------|
| `redeem-enrollment-code` | Financial/access impact, complex validation | 8-10 |
| `compute-assessment-scores` | Critical data integrity, scoring algorithms | 8-10 |
| `create-checkout` / `confirm-credit-topup` | Payment flows, credit allocation | 6-8 |
| `signup-user` / `verify-signup` | User lifecycle, data integrity | 6-8 |
| `send-auth-email` | Auth flow, HMAC verification | 5-6 |
| `oauth-authorize` / `oauth-callback` | Token exchange, state validation | 6-8 |
| `generate-reflection-prompt` | AI integration, credit deduction, rate limiting | 5-6 |
| `xapi-launch` / `xapi-statements` | Content tracking, completion logic | 8-10 |
| `calcom-webhook` | External webhook processing, booking sync | 5-6 |
| `process-email-queue` | Queue processing, retry logic | 4-5 |

**Estimated tests:** ~70-90

### Functions to Skip (Low ROI)

- `seed-demo-data` — dev-only utility
- `export-feature-config` — admin-only read
- `track-analytics` — fire-and-forget, no critical logic
- Simple CRUD proxies (`get-user-email`, `delete-user`)

---

## Phase 5 — React Component Tests (Est. 4-6 sessions)

**Goal:** Test complex interactive components that have significant UI logic beyond what E2E covers.

**Approach:** Use `@testing-library/react` + Vitest with jsdom. Focus on components with conditional rendering, form validation, or complex state.

### Components to Test (Priority Order)

| Component | Why | Est. Tests |
|-----------|-----|-----------|
| `FeatureGate` / `CapabilityGate` | Core access control UI, wrong behavior = users see/miss features | 8-10 |
| `ProtectedRoute` | Auth routing, role-based access | 6-8 |
| `ErrorBoundary` | Error recovery, user messaging | 4-5 |
| Assessment result visualizations | Data display accuracy (scores, charts) | 6-8 |
| Credit display components | Balance display, low-credit warnings | 4-5 |
| Enrollment code form | Validation, redemption flow, error states | 5-6 |
| Session booking components | Time slot selection, conflict handling | 6-8 |
| Admin CRUD dialogs | Form validation, save/cancel/delete states | 8-10 |

**Estimated tests:** ~60-80

### Components to Skip

- Layout components (Sidebar, Header, Footer) — tested by E2E
- Pure display components with no logic — low value
- shadcn/ui wrappers — not our code
- Page-level components — better tested by E2E

---

## Phase 6 — CI/CD Integration & Quality Gates (Est. 1-2 sessions)

**Goal:** Enforce quality standards automatically.

### Tasks

- [ ] Add coverage thresholds to `vitest.config.ts`:
  ```ts
  coverage: {
    thresholds: {
      statements: 90,
      branches: 85,
      functions: 90,
      lines: 90,
    }
  }
  ```
- [ ] Add Playwright to CI pipeline (currently runs unit tests only)
- [ ] Add edge function tests to CI (requires `supabase start` or mock setup)
- [ ] Add coverage badge to README
- [ ] Set up coverage trend tracking (Codecov or similar)
- [ ] Add pre-push hook that runs `npm run verify` (includes tests)

---

## Summary & Timeline

| Phase | Focus | Est. New Tests | Cumulative | Sessions |
|-------|-------|---------------|------------|----------|
| Current | Unit tests (src/lib/) | 453 | 453 | Done |
| Phase 1 | Edge function shared utils | 60-80 | ~530 | 2-3 |
| Phase 2 | React hooks (business logic) | 70-90 | ~610 | 2-3 |
| Phase 3 | E2E expansion | 50-70 | ~670 | 3-4 |
| Phase 4 | Edge function integration | 70-90 | ~750 | 3-4 |
| Phase 5 | React components | 60-80 | ~820 | 4-6 |
| Phase 6 | CI/CD quality gates | — | ~820 | 1-2 |
| **Total** | | **~310-410 new** | **~760-860** | **~15-22** |

### Priority Recommendation

**Do Phase 1 + Phase 3 next.** Edge function shared utilities are the highest-risk untested code (bugs affect all 76 functions). E2E expansion covers the most user-facing gaps with the least setup effort. Phase 2 (hooks) and Phase 4 (function integration) require more infrastructure but are the next logical steps.

---

## What NOT to Test (Firm Boundaries)

| Category | Reason |
|----------|--------|
| shadcn/ui primitives | Library code, not ours |
| React Query caching | Library internals |
| Thin Supabase query hooks | Wrappers with no logic, better tested via E2E |
| PDF/canvas rendering | Heavy mocking, fragile, low business value |
| Snapshot tests | Fragile, noisy diffs, low signal |
| `vitals.ts` / web vitals | Browser API + Sentry, no testable logic |
| Lovable-generated boilerplate | Will be overwritten; test the behavior, not the scaffolding |

---

## Related Files

| File | Relationship |
|------|-------------|
| `docs/TEST_PLAN.md` | Original test plan (Phase 1 priorities — now completed) |
| `vitest.config.ts` | Vitest configuration |
| `playwright.config.ts` | Playwright E2E configuration |
| `src/test/setup.ts` | Vitest setup file |
| `e2e/fixtures/auth.ts` | Playwright role-based fixtures |
| `e2e/helpers/` | E2E helper utilities (test users, dismiss overlays) |
| `MEMORY.md` | Project memory (references this file) |
