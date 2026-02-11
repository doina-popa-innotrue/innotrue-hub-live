# InnoTrue Hub — Post-Migration Next Steps

**Created:** February 12, 2026
**Status:** In progress

---

## Overview

With the core migration complete (Lovable removal, strict TypeScript, CI/CD, Sentry, environments, PWA hardening), these are the next steps to reach full production readiness.

---

## Step 1: Deploy develop to production (PR #3)

**Status:** DONE
**PR:** https://github.com/doina-popa-innotrue/innotrue-hub-live/pull/3
**Branch:** develop -> main
**Includes:** Strict TypeScript (Phase 1 + 2), Web Vitals, PWA hardening, Cursor IDE setup, ESLint fixes

**Actions:**
- [x] Push develop to remote
- [x] Create PR #3
- [x] Fix CI failures (2 ESLint errors: `no-non-null-asserted-optional-chain`)
- [x] CI passes
- [ ] Merge PR #3 to main
- [ ] Verify Cloudflare Pages production deploy succeeds
- [ ] Verify app.innotrue.com loads correctly after deploy

---

## Step 2: End-to-end smoke test on production

**Status:** Pending
**Effort:** 1-2 hours (manual)
**Purpose:** Verify all critical flows work on the production environment after deployment.

**Test checklist — by role:**

### Admin (doina.popa@innotrue.com)
- [ ] Google OAuth login works
- [ ] Dashboard loads with correct data
- [ ] Navigate to Programs -> view a program detail
- [ ] Navigate to Clients -> view a client detail
- [ ] Navigate to Settings -> verify account settings load
- [ ] Create/edit a program (test CRUD)
- [ ] Verify AI features work (decision insights, course recommendations)
- [ ] Verify email sending (test notification)
- [ ] Check credit system (view balances, test consumption)

### Client (sarah.johnson@demo.innotrue.com / DemoPass123!)
- [ ] Email/password login works
- [ ] Dashboard loads
- [ ] View enrolled programs
- [ ] View and complete a task
- [ ] View decisions
- [ ] View Wheel of Life

### Coach (emily.parker@demo.innotrue.com / DemoPass123!)
- [ ] Login works
- [ ] Dashboard loads
- [ ] View assigned clients
- [ ] View coaching decisions
- [ ] View coaching tasks

### General
- [ ] PWA install prompt works
- [ ] Offline caching works (static assets)
- [ ] Dark mode toggle works
- [ ] Web Vitals reporting to Sentry (check Sentry dashboard)
- [ ] Error boundary catches errors (trigger test error)
- [ ] Calendar integrations (if configured)

---

## Step 3: Fix preprod Auth Email Hook

**Status:** Pending
**Effort:** 30 minutes
**Issue:** Auth Email Hook not firing on preprod (`jtzcrirqflfnagceendt`) despite being configured. No edge function logs appear. Prod hook works fine.

**Debug steps:**
1. Go to Supabase Dashboard -> preprod project -> Authentication -> Hooks
2. Disable the Send Email hook, save
3. Re-enable the Send Email hook with:
   - URI: `https://jtzcrirqflfnagceendt.supabase.co/functions/v1/send-auth-email`
   - Header: `Authorization: Bearer <preprod-service-role-key>`
4. Test: trigger a password reset or magic link on preprod
5. Check edge function logs: Dashboard -> Edge Functions -> send-auth-email -> Logs
6. If still not working, try re-deploying the function:
   ```bash
   supabase functions deploy send-auth-email --project-ref jtzcrirqflfnagceendt
   ```
7. Check that RESEND_API_KEY secret is set on preprod

---

## Step 4: Sentry source maps in CI

**Status:** Pending
**Effort:** 1 hour
**Purpose:** Upload source maps to Sentry during CI builds so production error stack traces show original TypeScript line numbers instead of minified bundle references.

**Implementation:**
1. Install Sentry CLI:
   ```bash
   npm install --save-dev @sentry/cli
   ```

2. Add GitHub Actions secrets:
   - `SENTRY_AUTH_TOKEN` — from Sentry Settings -> API Keys -> Create Token (org:read, project:releases)
   - `SENTRY_ORG` — your Sentry organization slug
   - `SENTRY_PROJECT` — your Sentry project slug

3. Update `.github/workflows/ci.yml` — add source map upload step after build:
   ```yaml
   - name: Upload source maps to Sentry
     if: github.ref == 'refs/heads/main'
     env:
       SENTRY_AUTH_TOKEN: ${{ secrets.SENTRY_AUTH_TOKEN }}
       SENTRY_ORG: ${{ secrets.SENTRY_ORG }}
       SENTRY_PROJECT: ${{ secrets.SENTRY_PROJECT }}
     run: |
       npx sentry-cli releases new "${{ github.sha }}"
       npx sentry-cli releases files "${{ github.sha }}" upload-sourcemaps ./dist
       npx sentry-cli releases finalize "${{ github.sha }}"
   ```

4. Update `src/main.tsx` Sentry init to include release:
   ```ts
   Sentry.init({
     release: import.meta.env.VITE_SENTRY_RELEASE,
     // ... existing config
   });
   ```

5. Add `VITE_SENTRY_RELEASE` to Cloudflare Pages build command (set to `$CF_PAGES_COMMIT_SHA`)

**Verify:** Trigger an error in production -> Sentry shows original TypeScript source with correct line numbers.

---

## Step 5: E2E test suite (Playwright critical-path tests)

**Status:** Pending
**Effort:** 4-8 hours
**Purpose:** Automated tests for critical user flows to catch regressions before deployment.

**Priority test scenarios:**

### P0 — Authentication (must work)
- [ ] Google OAuth login flow
- [ ] Email/password login
- [ ] Logout
- [ ] Auth redirect (unauthenticated user -> login -> redirect back)

### P0 — Core navigation
- [ ] Admin dashboard loads
- [ ] Client dashboard loads
- [ ] Coach dashboard loads
- [ ] 404 page for invalid routes

### P1 — Critical CRUD flows
- [ ] Admin: Create a program
- [ ] Admin: View client detail
- [ ] Client: View enrolled program
- [ ] Client: Create/update a decision
- [ ] Client: Complete a task

### P2 — Integrations
- [ ] AI feature: generate decision insight
- [ ] Email: trigger a notification (verify edge function call)
- [ ] Credit consumption flow

**Implementation:**
1. Create test fixtures for each role (admin, client, coach)
2. Use Playwright's `storageState` for auth persistence
3. Tests run against preprod Supabase
4. Add to CI as a separate job (after build succeeds)

**File structure:**
```
e2e/
  fixtures/
    auth.ts          # Login helpers per role
  tests/
    auth.spec.ts     # Login/logout flows
    admin/
      dashboard.spec.ts
      programs.spec.ts
    client/
      dashboard.spec.ts
      decisions.spec.ts
    coach/
      dashboard.spec.ts
```

---

## Step 6: Edge function input validation hardening

**Status:** Pending
**Effort:** 4-6 hours
**Purpose:** Close the validation gaps identified in the security audit (Step 10b).

**Priority fixes:**

### High priority (6 functions with no validation)
Identify the 6 functions with no input validation and add:
- Request body type checking (Zod schemas)
- Required field validation
- String length limits

### Medium priority (email-sending functions)
Add email format validation to all 13 email-sending functions:
```typescript
import { z } from 'zod';
const emailSchema = z.string().email().max(254);
```

### Medium priority (auth functions)
Add password strength enforcement to:
- `signup-user`
- `create-admin-user`

```typescript
const passwordSchema = z.string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Must contain uppercase letter')
  .regex(/[a-z]/, 'Must contain lowercase letter')
  .regex(/[0-9]/, 'Must contain a number');
```

### Lower priority (AI functions)
Add input size limits to:
- `generate-reflection-prompt`
- `course-recommendations`
- `decision-insights`

```typescript
const promptSchema = z.string().max(10000, 'Input too long');
```

**Testing:** Each function should be tested with:
1. Valid input -> success
2. Missing required fields -> 400 error
3. Invalid email format -> 400 error
4. Oversized input -> 400 error

---

## Progress Summary

| Step | Description | Status | Effort |
|------|-------------|--------|--------|
| 1 | Deploy develop -> main (PR #3) | CI passing, ready to merge | Done |
| 2 | End-to-end smoke test | Pending | 1-2h manual |
| 3 | Fix preprod Auth Email Hook | Pending | 30min |
| 4 | Sentry source maps in CI | Pending | 1h |
| 5 | E2E test suite (Playwright) | Pending | 4-8h |
| 6 | Edge function validation hardening | Pending | 4-6h |

**Total estimated effort:** ~11-18 hours

---

*End of document.*
