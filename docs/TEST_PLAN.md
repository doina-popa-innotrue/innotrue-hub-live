# Test Coverage Plan

## Current State
- 210 unit tests (Vitest) in `src/lib/__tests__/`
- E2E infrastructure (Playwright) with role-based fixtures in `e2e/fixtures/`
- CI pipeline: lint → typecheck → test → build

## Strategy
Focus on business-critical logic and user journeys. Skip component rendering tests, snapshot tests, and React Query internals.

---

## Priority 1 — Unit Tests (business logic)

| # | File to Create | What It Tests |
|---|----------------|---------------|
| 1 | `src/lib/__tests__/creditUtils.test.ts` | Credit balance calculations, deductions, insufficient balance checks |
| 2 | `src/lib/__tests__/entitlementUtils.test.ts` | Feature entitlement merging from 5 sources (plan, program plan, add-ons, tracks, org) |
| 3 | `src/lib/__tests__/planUtils.test.ts` | Plan filtering (is_purchasable), tier comparisons, fallback plan resolution |
| 4 | `src/lib/__tests__/linkedinUtils.test.ts` | LinkedIn URL generation, badge verification URLs |
| 5 | `src/lib/__tests__/emailUtils.test.ts` | Staging recipient/subject overrides |

## Priority 2 — E2E Tests (critical user journeys)

| # | File to Create | What It Tests |
|---|----------------|---------------|
| 6 | `e2e/tests/auth/password-reset.spec.ts` | Forgot password → enter email → form submits successfully |
| 7 | `e2e/tests/admin/plans-management.spec.ts` | Admin → Plans Management → list loads → edit → toggle is_purchasable → save |
| 8 | `e2e/tests/instructor/scenarios.spec.ts` | Instructor → Scenarios in sidebar → page loads (no 404) |
| 9 | `e2e/tests/auth/login.spec.ts` | Google OAuth login → dashboard redirect per role |
| 10 | `e2e/tests/client/enrollment.spec.ts` | Client enrolls in program → sees content → accesses modules |

## Priority 3 — Nice to have

| # | File to Create | What It Tests |
|---|----------------|---------------|
| 11 | `src/lib/__tests__/seoUtils.test.ts` | SEO JSON-LD generation uses dynamic origin |
| 12 | `e2e/tests/client/public-profile.spec.ts` | Client configures public profile → publishes → views at /p/slug |
| 13 | `e2e/tests/admin/sidebar-navigation.spec.ts` | All admin sidebar links resolve (no 404s) |

---

## What NOT to Test
- shadcn/ui primitives (not our code)
- React Query caching behavior (library responsibility)
- Component rendering / snapshot tests (fragile, low value)
- Every Supabase hook wrapper (thin wrappers, better covered by E2E)

---

## Cursor Composer Prompt

Open Cursor in the `innotrue-hub-live` project, press **Cmd+I** (Composer), and paste:

```
I want to expand test coverage for this project. Follow existing patterns from src/lib/__tests__/ for unit tests and e2e/tests/ for E2E tests.

## Rules
- Use Vitest for unit tests (already configured)
- Use Playwright for E2E tests (already configured with role fixtures in e2e/fixtures/)
- Follow existing test patterns exactly — look at 2-3 existing test files first before writing new ones
- For unit tests: test pure functions only, mock Supabase client where needed
- For E2E tests: use the role-based fixtures (adminPage, clientPage, instructorPage) from e2e/fixtures/auth
- Run `npm run test` after each new test file to verify it passes
- Don't test shadcn/ui components or React Query internals

## Priority 1 — Unit Tests

1. **src/lib/__tests__/creditUtils.test.ts** — Test credit balance calculations, deductions, and insufficient balance checks. Look at how credits are calculated in src/lib/ and src/hooks/useCredits*.

2. **src/lib/__tests__/entitlementUtils.test.ts** — Test the feature entitlement merging logic. The useEntitlements hook merges 5 sources: subscription plan, program plan, add-ons, tracks, org-sponsored. Test that merging works correctly and that missing features default to accessible.

3. **src/lib/__tests__/planUtils.test.ts** — Test plan filtering (is_purchasable), tier level comparisons, and fallback plan resolution.

4. **src/lib/__tests__/linkedinUtils.test.ts** — Test generateLinkedInAddToProfileUrl and generateBadgeVerificationUrl functions.

## Priority 2 — E2E Tests

5. **e2e/tests/auth/password-reset.spec.ts** — Test the forgot password flow: navigate to login → click "Forgot password" → enter email → verify form submission succeeds.

6. **e2e/tests/admin/plans-management.spec.ts** — Admin logs in → navigates to Plans Management → verifies plan list loads → opens edit form → toggles is_purchasable → saves.

7. **e2e/tests/instructor/scenarios.spec.ts** — Instructor logs in → sees "Scenarios" in sidebar under Teaching → clicks it → page loads without 404.

Start with Priority 1 unit tests. After each file, run the tests to verify they pass before moving to the next one.
```

## Tips
- Use **Composer** (Cmd+I) for this task — it creates/edits multiple files
- If the response is too long, say "continue with the next test file"
- After it writes each test, ask it to run `npm run test` to verify
- For E2E tests, you'll need test users in preprod — Cursor can help create them via SQL
- When done, run `npm run verify` to confirm everything passes
