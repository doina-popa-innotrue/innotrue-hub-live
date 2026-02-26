# Phase 5 — Self-Registration & Scale: Implementation Plan

> **Partial completion:** G8 Self-Enrollment Codes (Step 1 enrollment_codes, Step 11 enrollment channels, Step 14 enrollment flow) completed 2026-02-25. See `completed-work.md` for details.
>
> **Core self-registration (Batches 1-3) completed 2026-02-26:**
> - Batch 1: DB migration (`20260226100000_phase5_self_registration.sql`), `complete-registration` edge function, `CompleteRegistration.tsx` page, App.tsx route
> - Batch 2: `verify-signup` modified (pending_role_selection, 7-table placeholder transfer), Auth.tsx re-enabled (signup form + Google OAuth), AuthContext `registrationStatus`, ProtectedRoute pending states, Index.tsx redirect
> - Batch 3: `CoachInstructorRequests.tsx` rewritten with "Role Applications" + "Coach Assignments" tabs, approve/decline mutations for role applications
>
> **Steps 7 + 9 completed 2026-03-26:** Step 7 (Wheel of Life → Signup Pipeline) — `submit-wheel-intent` edge function + plan interest resolution in `verify-signup`. Step 9 (Bulk User Import) — `bulk-create-users` edge function + `BulkUserImport.tsx` dialog with CSV parsing. Commit `6c924df`.
>
> **New Roadmap Items R2/R3/R4 completed 2026-03-26:**
> - R2: Teaching Guide — `/teaching/guide` page with quick actions grid, 5-step getting started checklist, 9-question FAQ accordion, role explanation cards
> - R3 Phase 1: Coach↔Client UX — Quick Actions bar in StudentDetail (4 action buttons), `CoachingSessionNotes.tsx` (structured session logs with JSON content in `client_staff_notes` table)
> - R4: Coach Client Invites — `coach_client_invites` table, `send-coach-invite` edge function (auto-links existing users, emails new), `InviteClientDialog.tsx` (send+history tabs), `verify-signup` auto-links pending invites on signup
>
> **Remaining Phase 5 steps (not yet implemented):** Step 12 (Public assessment funnels), Step 13 (Org self-service), Step 14 partial (enhanced consent dialog)

## Context

The platform is currently invitation-only (pilot mode). Self-signup form, Google OAuth, and "Create Account" links are all hidden in `Auth.tsx`. The underlying infrastructure works — `signup-user` and `verify-signup` edge functions are fully functional, the C2 AuthContext fallback bug is resolved, and `ProtectedRoute` gracefully handles users with zero roles.

Phase 5 transforms the platform to support self-registration with role selection, dormant user activation, the Wheel of Life lead pipeline, and bulk admin import.

**User requirements:**
- Users may have multiple roles (e.g. instructor + org_admin)
- Org self-registration is a **separate flow** (noted in roadmap, not built in Phase 5)
- Handle: existing client gets org invite (add role, don't disrupt)
- Handle: dormant/placeholder users activating when they sign up
- Full Phase 5 scope including Cal.com and bulk import
- **Coach/instructor registration model**: They sign up as regular users (optionally choosing client role too), then apply for coach/instructor role. Admin curates and approves. Some coaches/instructors will also be clients; others will be staff/partners only (no client role).
- Admin can also directly add coaches/instructors via existing admin tools (for partnerships, etc.)

---

## Step 1: Database Migration

**New file:** `supabase/migrations/20260218_phase5_self_registration.sql`

```sql
-- 1. Add registration_status to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS registration_status TEXT DEFAULT 'complete';

-- 2. Add context columns to signup_verification_requests
ALTER TABLE public.signup_verification_requests
  ADD COLUMN IF NOT EXISTS plan_interest TEXT,
  ADD COLUMN IF NOT EXISTS context_data JSONB;

-- 3. Add source_type to coach_instructor_requests (distinguish client-requesting-coach vs self-registration)
ALTER TABLE public.coach_instructor_requests
  ADD COLUMN IF NOT EXISTS source_type TEXT DEFAULT 'client_request';
-- Values: 'client_request' (existing: client wants A coach), 'role_application' (new: user wants to BE a coach)
-- Add application fields for self-registration
ALTER TABLE public.coach_instructor_requests
  ADD COLUMN IF NOT EXISTS specialties TEXT,
  ADD COLUMN IF NOT EXISTS certifications TEXT,
  ADD COLUMN IF NOT EXISTS bio TEXT,
  ADD COLUMN IF NOT EXISTS scheduling_url TEXT,
  ADD COLUMN IF NOT EXISTS admin_notes TEXT;

-- 4. Add verification_status to profiles (for coach verification)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS verification_status TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- 5. ✅ DONE (G8, 2026-02-25) — Enrollment codes implemented with additional cohort_id FK,
-- validate_enrollment_code RPC, redeem-enrollment-code edge function, admin UI + public page.
-- See migration: 20260225100000_g8_enrollment_codes.sql
-- CREATE TABLE public.enrollment_codes (...) — DONE
-- ALTER TABLE public.enrollment_codes ENABLE ROW LEVEL SECURITY — DONE
```

Reuse `coach_instructor_requests` with `source_type` column for role applications. New `enrollment_codes` table for shareable program links.

---

## Step 2: Re-enable Self-Signup in Auth.tsx

**File:** `src/pages/Auth.tsx`

Changes:
1. **Line 104**: Restore `wheelCompleted` → default to signup tab when coming from Wheel
2. **Lines 107-110**: Restore `useEffect` for `context.default_to_signup`
3. **Lines 795-796**: Add back Google OAuth button calling existing `handleGoogleSignIn`
4. **Lines 798-813**: Replace "invitation only" message with actual signup form (fields + `handleSignup` already exist)
5. **Lines 816-829**: Restore "Don't have an account?" / "Already have an account?" toggle links

The `handleSignup` function (lines 407-461) already calls `signup-user` edge function — no changes needed there.

---

## Step 3: Modify verify-signup Edge Function

**File:** `supabase/functions/verify-signup/index.ts`

Current behavior (lines 138-149): auto-assigns `client` role + creates profile.

New behavior:
1. Create profile with `registration_status = 'pending_role_selection'`
2. **Do NOT** assign `client` role yet (user will choose on `/complete-registration`)
3. **Exception — placeholder match (not hidden)**: If placeholder found with `is_hidden = false` (lines 164-189), keep existing behavior: transfer all data, copy placeholder's roles, set `registration_status = 'complete'`. The user never sees the placeholder — it's a seamless transition.
4. **Exception — placeholder match (hidden)**: If placeholder found with `is_hidden = true`, **skip auto-transfer** (current behavior preserved). The user signs up as a fresh account. Admin can manually link later via UsersManagement "Transfer Placeholder Data" action. User is never aware their data was pre-staged.
5. **Exception — auto-enroll context**: If `signup_verification_requests` has `context_data` with `auto_enroll_program`, assign `client` role + assign free plan + set status to `complete` (these users are coming from a program-specific signup link and skip `/complete-registration`). The actual program enrollment happens separately (admin-managed for now, or via auto-enroll logic in `complete-registration`).
6. **Enhance non-hidden placeholder transfer** (lines 178-188): Currently only transfers `client_enrollments`. Also transfer: `capability_snapshots`, `client_badges`, `client_coaches`, `client_instructors`, `assessment_responses` (extract shared helper `_shared/placeholder-transfer.ts` — same logic as `transfer-placeholder-data` edge function lines 113-234)

**Placeholder privacy model (already implemented, preserving):**
- `real_email`: The actual email of the person. Used ONLY for matching during signup.
- `is_hidden = true`: Admin created the placeholder but doesn't want user to see pre-existing data. System skips auto-transfer. Admin links manually later.
- `is_hidden = false`: Admin is fine with auto-transfer. Data silently merges when user signs up.
- In both cases, the user's signup experience is identical — they never see "we already had your data" messaging.

---

## Step 4: Create /complete-registration Page

**New file:** `src/pages/CompleteRegistration.tsx`

- Route: `/complete-registration` (add to `App.tsx` as lazy-loaded, NOT inside ProtectedRoute)
- Auth guard: redirect to `/auth` if not authenticated, redirect to `/dashboard` if `registration_status === 'complete'`
- Three cards:
  - **"I'm here to grow" (Client)** — immediate. Calls `complete-registration` edge function → assigns `client` role → redirects to `/dashboard`
  - **"I'm a Coach or Instructor"** — expands form with:
    - **Checkbox: "I'd also like to use the platform as a client"** (optional — some coaches/instructors are staff-only partners, not clients)
    - Fields: request_type (coach/instructor/both), specialties, certifications, bio, scheduling_url
    - Submits to `coach_instructor_requests` with `source_type = 'role_application'`
    - If "also a client" checked → assigns `client` role immediately so they can use the platform while their application is reviewed
    - If not checked → no client role; user is in a holding state until admin approves their coach/instructor application
    - Sets `registration_status = 'pending_approval'`
  - **"I represent an Organization"** — greyed out card with "Coming soon" badge. Note in small text: "Organization registration is handled separately. Contact us for details."

**New edge function:** `supabase/functions/complete-registration/index.ts`
- Auth: requires JWT
- For `role_choice = 'client'`:
  - Insert `client` role in `user_roles`
  - Create `client_profiles` + `notification_preferences`
  - **Assign the "free" plan** (`profiles.plan_id` → free plan UUID). This gives baseline features (decision_toolkit_basic, 20 AI coach calls/month). Users can later upgrade or get elevated access through program enrollment.
  - Set `profiles.registration_status = 'complete'`
- For `role_choice = 'coach'/'instructor'/'both'`:
  - Insert into `coach_instructor_requests` with `source_type = 'role_application'`
  - If `also_client = true`: also assign `client` role + create `client_profiles` + `notification_preferences` + assign free plan (they can use platform as client while pending)
  - If `also_client = false`: no client role, no plan; user is `pending_approval` only
  - Set `profiles.registration_status = 'pending_approval'`
- Check for placeholder match (for Google OAuth users): if placeholder with matching email exists, run transfer logic, copy roles + plan

---

## Step 5: Modify AuthContext + ProtectedRoute

**File:** `src/contexts/AuthContext.tsx`
- In `fetchUserRolesAndMembership`: also fetch `registration_status` from `profiles`
- Add `registrationStatus` to AuthContext state and interface

**File:** `src/components/ProtectedRoute.tsx`
- Modify zero-roles handling (lines 66-86):
  - If `registrationStatus === 'pending_role_selection'` → redirect to `/complete-registration`
  - If `registrationStatus === 'pending_approval'` AND user has `client` role → let them through (they chose "also a client" and can use the platform while coach/instructor application is reviewed; show a subtle banner: "Your coach/instructor application is under review")
  - If `registrationStatus === 'pending_approval'` AND user has NO roles → show "Application Under Review" card (with sign-out button and explanation that admin will review their application)
  - If roles empty + status `complete` → keep existing "Account Not Configured" card

**File:** `src/pages/Index.tsx`
- Add same `pending_role_selection` redirect logic

---

## Step 6: Admin Approval for Role Applications

**File:** `src/pages/admin/CoachInstructorRequests.tsx`

The existing page handles "client requesting A coach" (assigns a coach TO the client). For Phase 5, we need a second mode: "user applying to BE a coach."

Changes:
- Add tabs or filter: "Coach Assignments" (existing `source_type = 'client_request'`) vs "Role Applications" (`source_type = 'role_application'`)
- For role applications, the approve mutation should:
  - Add requested role(s) to `user_roles` (instead of inserting into `client_coaches`)
  - Update `profiles.registration_status = 'complete'`
  - Update `profiles.verification_status = 'verified'` + `verified_at`
  - Show the application details (specialties, certifications, bio, scheduling_url)
- Decline mutation:
  - If user also has `client` role: set `profiles.registration_status = 'complete'` (they can continue as client), update request status to `declined`
  - If user has NO other roles (staff-only applicant): set `profiles.registration_status = 'declined'`, show message in ProtectedRoute that application was not approved (with contact info and sign-out button)
  - Admin can optionally add a decline reason (stored in `coach_instructor_requests.admin_notes`)

---

## Step 7: Wheel of Life → Signup Pipeline

**File:** `src/pages/public/WheelAssessment.tsx`

Currently inserts directly into `ac_signup_intents` from the browser, but the page is public and RLS only allows `authenticated` INSERT.

Fix: Create edge function `supabase/functions/submit-wheel-intent/index.ts` that handles the insert with service role (avoids opening anon INSERT policy). WheelAssessment calls this instead of direct Supabase insert.

**File:** `supabase/functions/signup-user/index.ts`
- Accept `plan_interest` from request body (already sent by Auth.tsx)
- Store in `signup_verification_requests.plan_interest`

**File:** `supabase/functions/verify-signup/index.ts`
- After profile creation, look up `ac_signup_intents` by email
- If found with `plan_interest`: look up matching plan in `plans` table, set `profiles.plan_id`
- Update `ac_signup_intents.status` to `'registered'`

---

## Step 8: Google OAuth Placeholder Handling

**File:** `supabase/functions/complete-registration/index.ts`

Google OAuth bypasses `verify-signup`, so placeholder matching must happen in `complete-registration`:
- When user completes registration, check if a placeholder exists with matching email (`profiles.real_email`)
- If found: transfer data (same `_shared/placeholder-transfer.ts` helper)
- If placeholder had roles: copy those roles, skip role selection, return `registration_status = 'complete'`

---

## Step 9: Bulk User Import

**New file:** `src/components/admin/BulkUserImport.tsx` (dialog triggered from UsersManagement.tsx)

Steps:
1. **Upload**: CSV drag-and-drop. Required columns: `name`, `email`. Optional: `role` (default: client), `plan`, `is_placeholder`, `real_email`
2. **Preview**: Parse with Papa Parse, validate emails, check duplicates, show table with error highlighting
3. **Import**: Call `bulk-create-users` edge function with batch
4. **Results**: Progress bar, per-row results, download results CSV

**New edge function:** `supabase/functions/bulk-create-users/index.ts`
- Admin-only auth check
- Accepts array of user objects (max 200)
- For each: create user via `supabaseAdmin.auth.admin.createUser()`, assign roles, set plan, handle placeholder flags
- Return per-user results `{ email, status: 'created' | 'error', error?, userId? }`

**File:** `src/pages/admin/UsersManagement.tsx`
- Add "Import Users" button next to "Create User" that opens `BulkUserImport` dialog

---

## Step 10: Coach Availability (Cal.com)

Minimal scope — coaches already have `profiles.scheduling_url`:
- In `CompleteRegistration.tsx` coach form: include `scheduling_url` field with URL validation
- The existing Cal.com integration handles booking. Deeper availability management deferred to Phase 8.

---

## Step 11: Plan Assignment & Enrollment Lifecycle

### Plan at registration — two paths
**Path 1: Default signup** (user lands on `/auth` directly)
- Gets **free plan** at registration
- Free plan = baseline features (decision_toolkit_basic, 20 AI coach calls/month)
- Can upgrade anytime via `/subscription` (existing Stripe checkout)

**Path 2: Plan-specific signup** (user comes from pricing page)
- Pricing page links to `/auth?plan=pro` (or `enterprise`)
- After registration, `complete-registration` detects `plan` param
- Redirects to Stripe checkout for selected plan instead of dashboard
- On payment success: `profiles.plan_id` = chosen plan
- On payment cancel/failure: falls back to free plan, can retry from `/subscription`
- This is industry standard (Notion, Figma, Slack all support plan-specific signup links)

### Program enrollment scenarios
The entitlements system already handles all these correctly via feature merging (max limit wins):

**Scenario A: Self-registered client on free plan enrolls in a program**
- Free plan features + program_plan_features = merged access
- Program gives them what they need; no paid subscription required
- When program ends (`client_enrollments.status` != active): program features revoke, back to free plan
- All data created during program persists (goals, decisions, tasks, assessments, development items)
- Feature-locked content becomes read-only (UI shows "Upgrade" via `FeatureGate`/`CapabilityGate`)

**Scenario B: Paid subscriber's subscription ends/downgrades**
- `profiles.plan_id` → free plan
- If still in active program: program features remain
- If no active program: only free plan features
- Existing data persists, feature-locked content is read-only

**Scenario C: Program ends, user wants to keep access**
- **Option 1:** User upgrades to paid subscription (pro/enterprise)
- **Option 2:** Admin assigns `continuation` plan — see recommendation below
- **Option 3:** User stays on free plan (limited features, data preserved but gated)

**Recommendation on Continuation plan:**
Keep it but make it purpose-driven. Rename conceptually to "Alumni / Post-Program" access:
- Use it ONLY for programs that explicitly offer post-completion benefits (e.g. "6 months of continued AI coach access after CTA ends")
- Make it time-limited: admin sets expiry when assigning (e.g. 6 months). After expiry → auto-downgrade to Free.
- If a program doesn't offer post-completion benefits, user simply goes back to Free. No continuation needed.
- This makes Continuation an intentional admin decision per program, not a blanket default.
- Add `continuation_expires_at` to profiles or use existing `plan_expires_at` field (exists but unused).
- Future: allow programs to define a `post_completion_plan_id` + `post_completion_duration` so continuation is auto-assigned when a program enrollment completes.

**Scenario D: Program-specific signup link (e.g. CTA)**
- `signup_verification_requests.context_data` has `auto_enroll_program`
- `verify-signup` assigns `client` role + sets `registration_status = 'complete'` (skips role selection)
- `complete-registration` detects context, assigns free plan + auto-enrolls in program
- User lands directly on dashboard with program access

### Enrollment channels (recommended model, based on industry best practices)

Industry leaders (Teachable, Kajabi, Thinkific) use a **link-first enrollment model**: each program/course has a unique enrollment URL. Users land on the program page, enroll (free or paid), and get an account created as part of the flow. This is the most frictionless approach.

**For Phase 5, implement 3 enrollment channels:**

**Channel 1: Admin-managed (keep current, for B2B/partnerships)**
- Admin creates user → assigns plan → enrolls in program
- No change needed. This is for CTA, org-sponsored, and partnership clients
- Admin controls everything: pricing, plan, enrollment timing

**Channel 2: Shareable program enrollment links (NEW — Phase 5 scope)**
- Each program gets a unique shareable URL: `/enroll/{program-slug}` or `/enroll/{program-slug}?code=XXXXX`
- URL includes optional enrollment code (for pre-paid, sponsored, or discounted access)
- Flow for **new user**: lands on program page → sees details → clicks "Join" → redirected to signup → after signup, auto-redirected back to enrollment → enrolled
- Flow for **existing user**: lands on program page → clicks "Join" → logged in? → enrolled. Not logged in? → login → enrolled
- The signup URL carries `context_data.enroll_program_id` so the system knows to redirect back after registration
- **Enrollment codes** (new table `enrollment_codes`): admin generates codes per program (single-use or multi-use, with expiry). Codes can grant: free enrollment, specific plan tier, coupon discount. This replaces manual admin enrollment for pre-paid clients — you give them a code, they self-enroll.
- **Benefits**: You generate a link/code for CTA participants, share it, they self-register + self-enroll. Zero admin work per user.

**Channel 3: Browse & enroll (self-service marketplace)**
- User browses `/explore-programs` → finds program → pays via Stripe checkout OR credits → auto-enrolled
- Already partially built (explore-programs page exists, create-checkout edge function exists)
- Phase 5: ensure the flow works end-to-end for self-registered users
- Deeper marketplace features (reviews, recommendations, trial access) deferred to Phase 3/6

**Channel 4: Enroll with credits (roadmap — add to Phase 5 or Phase 3)**
- Backend fully ready: `enroll_with_user_credits()` RPC exists, `consume_credits_fifo()` works, credit purchase flow works standalone
- **Missing UI**: No "Pay with Credits" button in enrollment flow. Users can only "Express Interest" (admin review)
- **What needs to be built** (roadmap item, not Phase 5 core):
  - Show `programs.credit_cost` in program preview/enrollment page
  - "Enroll with Credits" button if user has enough credits
  - "Buy Credits" redirect if insufficient credits
  - Confirmation dialog showing credit deduction
  - Optional: inline credit top-up during enrollment
- **Recommendation**: Build this in Phase 5 as part of the ProgramEnroll page (it's a natural fit alongside enrollment codes). If scope is too large, defer to Phase 3.

### Enrollment codes design (new in Phase 5)

**New table:** `enrollment_codes`
```
id (UUID), program_id (UUID), code (TEXT unique),
code_type ('single_use' | 'multi_use' | 'bulk'),
max_uses (INT, null=unlimited), current_uses (INT default 0),
grants_plan_id (UUID nullable — override plan for this enrollment),
grants_tier (TEXT nullable — override tier within program),
discount_percent (INT nullable — for paid programs),
is_free (BOOLEAN default false — bypass payment),
expires_at (TIMESTAMPTZ nullable),
created_by (UUID), created_at, is_active (BOOLEAN default true)
```

**New edge function:** `supabase/functions/validate-enrollment-code/index.ts`
- Validates code, checks expiry/uses, returns program details + what it grants

**New page:** `src/pages/ProgramEnroll.tsx` (route: `/enroll/:slugOrId`)
- Shows program details (reuse from explore-programs)
- Optional code input field (pre-filled from URL `?code=`)
- If code is free: "Join Program" button → enrolls directly
- If code has discount: shows discounted price → Stripe checkout
- If no code + program is paid: shows price → Stripe checkout
- If no code + program is free: "Join Program" button → enrolls directly
- Handles auth: if not logged in, redirect to `/auth?redirect=/enroll/...`

**Admin UI addition:** In program management, add "Enrollment Codes" tab
- Generate single codes, bulk codes (CSV download)
- View usage stats per code
- Deactivate codes

This model means for CTA or similar programs, you:
1. Create the program in admin
2. Generate enrollment codes (or a multi-use link)
3. Share the link with participants
4. They self-register and self-enroll — zero per-user admin work

---

## Step 12: Public Assessment → Signup Funnel (Generalized Hooks)

The Wheel of Life already works as a marketing hook: free assessment → email capture → plan selection → signup. Two other assessment systems exist (`/assess/:slug` generic assessments, capability assessments) but lack the conversion funnel.

**Changes (minimal — generalize existing pattern):**

1. **Reusable `PlanSelectionStep` component** — extract from WheelAssessment's Step 4. Shows plan cards with "Get Started" buttons. Accepts `assessmentType` + `assessmentSlug` for tracking.

2. **Add funnel to `PublicAssessment.tsx`** (`/assess/:slug`):
   - After results display, show PlanSelectionStep
   - On plan selection: redirect to `/auth?assessment={slug}&plan_interest={plan}&default_to_signup=true`
   - Track in `assessment_responses.plan_interest` (add column if missing)

3. **Future: Public capability assessments** (roadmap, not Phase 5):
   - New page `PublicCapabilityAssessment.tsx` at `/assess-capability/:slug`
   - Only shows assessments with `capability_assessments.is_public = true`
   - Mini version: admin can mark specific domains as "public preview" (subset of full assessment)
   - Results + plan selection + signup funnel

4. **Generalize `submit-wheel-intent` edge function** → rename to `submit-assessment-intent`:
   - Accepts `assessment_type` ('wheel' | 'generic' | 'capability'), `assessment_slug`, `results_data`
   - Stores in `ac_signup_intents` with assessment context in `notes` JSON
   - Works for any public assessment, not just Wheel

5. **`verify-signup` enhancement**: When matching `ac_signup_intents`, check for both `plan_interest` AND assessment data:
   - If assessment was a program-specific mini-assessment (e.g. CTA preview): store `program_interest` in signup intent → after registration, suggest that program on dashboard or auto-redirect to enrollment page

**Net effect:** Any public assessment becomes a signup funnel. You create the assessment (generic or capability), set `is_public=true`, and it automatically gets the plan selection step + signup redirect. Mini CTA assessments would work the same way — take free assessment → see results → "Want to go deeper? Join CTA program" → signup → enroll.

---

## Step 13: Org Self-Service (Roadmap Note Only)

**NOT implemented in Phase 5.** Add note in `ISSUES_AND_IMPROVEMENTS.md`:
- Future: `org_applications` table, "Create Organization" form in CompleteRegistration, admin review, trial mode (`organizations.is_trial`, `organizations.trial_ends_at`)
- The third card on CompleteRegistration shows "Coming soon"

---

## Step 14: Existing Client + Org Invite — Enhanced Choice Flow

**Current state:** `AcceptInvite.tsx` (lines 314-382) has a consent dialog for existing users. It's binary: "Link Your Account" (consent checkbox + join) or cancel. The backend (`accept-org-invite`) receives `link_existing_account` boolean but doesn't differentiate behavior — it always adds the user to the org. The `organization_sharing_consent` table has granular controls (share_assessments, share_goals, share_progress, share_tasks, share_decisions, share_assignments, share_development_items) initialized to `false`.

**Enhancement: Give users a real choice when they already have an account.**

**Modified `AcceptInvite.tsx` consent dialog — two paths:**

**Option A: "Link my existing account" (recommended, highlighted)**
- Benefits explained: "Access org-sponsored programs AND keep your personal programs. Your combined progress and development history stays in one place."
- Sharing controls: show the granular sharing toggles inline (pre-set to conservative defaults: all false). User can enable what they want to share with the org.
- Proceeds with current flow: adds user to `organization_members`, creates `organization_sharing_consent` with user's chosen settings
- Auth state refreshes → org_admin role available in switcher
- User keeps all existing enrollments, goals, assessments, everything

**Option B: "Keep my accounts separate"**
- Explanation: "Start fresh within the organization. Your personal account and org account will be independent."
- Implementation: The user signs out, then signs up with a **different email** for the org (their work email vs personal email). The invite gets re-sent to the new email by the org admin.
- OR: If they want same email → not possible with Supabase (one auth user per email). In that case, the platform should explain that same-email = same account, but sharing controls let them keep personal data private.
- **Recommended UX**: When user picks "Keep separate", show an explanation: "Since you're already registered with {email}, your accounts will be linked. However, you have full control over what the organization can see. All personal data sharing is off by default."

**Recommendation:**

True account separation (different user IDs for same person) creates data management nightmares — duplicate profiles, split progress history, confusion about which account has what. Instead, the better approach is:

1. **One account, granular sharing** (the current architecture is correct for this)
2. The consent dialog should clearly explain that sharing defaults to OFF
3. Add a "Manage Organization Sharing" link/section in Account Settings where users can toggle each category
4. The org admin sees ONLY what the user has consented to share

**Changes to `AcceptInvite.tsx`:**
- Replace "Link Your Account" consent dialog with an enhanced version:
  - Title: "Join {org name}"
  - Info card: "You already have an InnoTrue account. Joining this organization will give you access to org-sponsored programs while keeping your personal data private by default."
  - Granular sharing toggles (collapsed by default under "Choose what to share"):
    - Share progress with organization (default: off)
    - Share assessment results (default: off)
    - Share goals (default: off)
    - Share tasks & decisions (default: off)
  - Note: "You can change these settings anytime in Account > Organization Sharing"
  - Consent checkbox: "I understand and agree to join {org name}"
  - Button: "Join Organization"

**Changes to `accept-org-invite` edge function:**
- Accept optional `sharing_preferences` object from the frontend
- Use provided preferences instead of all-false defaults when creating `organization_sharing_consent`

**No separate account option needed** — the granular sharing controls solve the privacy concern without the complexity of dual accounts.

---

## Files Summary

### New files:
- `supabase/migrations/20260218_phase5_self_registration.sql`
- `src/pages/CompleteRegistration.tsx`
- `src/pages/ProgramEnroll.tsx`
- `supabase/functions/complete-registration/index.ts`
- `supabase/functions/submit-wheel-intent/index.ts`
- ~~`supabase/functions/validate-enrollment-code/index.ts`~~ ✅ Implemented as `validate_enrollment_code` RPC (not edge function) + `redeem-enrollment-code` edge function (G8)
- `supabase/functions/bulk-create-users/index.ts`
- `supabase/functions/_shared/placeholder-transfer.ts`
- `src/components/admin/BulkUserImport.tsx`
- ~~`src/components/admin/EnrollmentCodesManager.tsx`~~ ✅ Implemented as `src/pages/admin/EnrollmentCodesManagement.tsx` + `src/pages/public/EnrollWithCode.tsx` (G8)

### Modified files:
- `src/pages/Auth.tsx` — re-enable signup form + Google OAuth
- `src/App.tsx` — add `/complete-registration` route
- `src/contexts/AuthContext.tsx` — add `registrationStatus` state
- `src/components/ProtectedRoute.tsx` — redirect pending users
- `src/pages/Index.tsx` — redirect pending users
- `supabase/functions/verify-signup/index.ts` — don't auto-assign client, enhanced placeholder transfer
- `supabase/functions/signup-user/index.ts` — store `plan_interest`
- `src/pages/public/WheelAssessment.tsx` — use edge function instead of direct insert
- `src/pages/admin/CoachInstructorRequests.tsx` — add role application approval mode
- `src/pages/admin/UsersManagement.tsx` — add "Import Users" button
- `src/pages/AcceptInvite.tsx` — enhanced consent dialog with granular sharing controls
- `src/App.tsx` — add `/enroll/:slugOrId` route (public, no auth required to view)
- `supabase/functions/accept-org-invite/index.ts` — accept sharing preferences from frontend
- `src/integrations/supabase/types.ts` — regenerate after migration
- `docs/ISSUES_AND_IMPROVEMENTS.md` — update Phase 5 status + new roadmap items R1-R7

---

## Verification

1. `npm run verify` (lint + typecheck + tests + build)
2. Test scenarios:
   - Fresh email/password signup → complete-registration → client → dashboard
   - Fresh signup → complete-registration → coach application (also client) → uses platform as client → admin approves → user gets coach role
   - Fresh signup → complete-registration → coach application (staff-only, NOT client) → sees "under review" → admin approves → user gets coach role → dashboard
   - Fresh signup → coach application (staff-only) → admin declines → user sees "not approved" message
   - Google OAuth new user → complete-registration → role selection
   - Placeholder user activation (email/password + Google OAuth)
   - Wheel of Life → signup with plan interest → plan auto-assigned
   - Existing client accepts org invite → both roles preserved, granular sharing controls
   - Admin bulk CSV import → users created with correct roles
   - Admin directly creates coach/instructor via existing admin tools (partnership flow unchanged)
   - Self-registered client gets free plan → can see features gated by plan → upgrades via /subscription
   - Client on free plan enrolls in program → gets program features → program ends → back to free plan, data preserved
   - Program-specific signup link → auto-enrolled, skips role selection
   - Shareable enrollment link (new user) → signup → auto-redirect → enrolled
   - Shareable enrollment link (existing user) → login → enrolled
   - Enrollment code: free code → enroll without payment
   - Enrollment code: expired/used-up code → shows error
   - Admin generates bulk codes → downloads CSV → shares with participants
3. Push migration to preprod, test, then prod
4. Re-enable Google OAuth in Supabase Dashboard (all environments)
5. Update roadmap, commit, deploy to all environments + lovable sync

---

## New Roadmap Items (to add to ISSUES_AND_IMPROVEMENTS.md)

The user identified 7 additional enhancement areas. Here's the analysis, recommended phasing, and what to add to the roadmap.

### R1: Assessment Domain Question Types & Weighted Scoring

**Current state:** `capability_domain_questions` has `input_type` (slider/single_choice/multi_choice/text) and `options` (JSON). Scoring is simple: average of question ratings per domain, all questions weighted equally. No concept of "question type" like Knowledge vs Judgement vs Communication.

**What's needed:**
- Add `question_type` field to `capability_domain_questions` (configurable per assessment, e.g. "Knowledge", "Judgement", "Communication", custom)
- Add `question_types` config to `capability_assessments` (defines available types + weights)
- Scoring enhancement: calculate sub-scores per type within each domain, weighted overall domain score, weighted overall assessment score
- Admin UI: type configuration when creating/editing assessments, weight assignment
- Visualization: breakdown by type in radar/bar charts, type-level comparison across snapshots
- Instructor scoring UI: show type labels, display per-type subtotals

**Recommended phase:** Phase 2 (Assessment Intelligence) — extends existing assessment architecture
**Effort:** 2-3 weeks (schema + scoring logic + admin UI + visualization)
**Dependencies:** None — builds on existing `capability_assessments` infrastructure

### R2: Instructor & Coach Onboarding Process

**Current state:** Coaches/instructors are admin-created (`create-admin-user`). No guided onboarding: they land on `InstructorCoachDashboard.tsx` which shows programs/modules/clients but no "getting started" guidance. No profile completeness prompts for coach-specific fields (bio, specialties, scheduling_url, certifications).

**What's needed:**
- Onboarding wizard for new coaches/instructors (similar to client's JourneyProgressWidget but for teaching role)
- Steps: complete profile → set up scheduling URL → review assigned programs → meet first client
- Coach/instructor profile completion checklist
- Role-specific welcome email with first-steps guide
- For Phase 5 self-registration: the `CompleteRegistration.tsx` coach form captures initial profile data (bio, specialties, certifications, scheduling_url) — this seeds the onboarding

**No conflict with Phase 5 self-registration:** Phase 5 handles *registration* (sign up → apply for role → admin approves). R2 handles *post-approval onboarding* (approved → guided setup wizard on teaching dashboard). The Phase 5 application form seeds R2 onboarding data so coaches don't re-enter info. Timeline: Phase 5 first, R2 follows.

**Recommended phase:** Phase 1 (Onboarding/UX) — add item under existing onboarding phase
**Effort:** 1-2 weeks
**Dependencies:** Phase 5 (self-registration provides initial coach profile data)

### R3: Enhanced Coach/Instructor ↔ Client Interaction

**Current state:**
- `InstructorCoachDashboard.tsx`: Shows shared goals, decisions, tasks, sessions, badges
- `StudentDetail.tsx`: Full client progress view with reflections, feedback, assignments, sessions, staff notes
- `StudentProgress.tsx`: List of all clients with progress tracking
- Communication: Staff notes only (no real-time messaging)
- No in-app messaging, no structured coaching session notes, no action item assignment from coach to client

**What's needed:**
- **Coaching session notes**: Structured form for coaches to record session outcomes, action items, follow-ups (linked to `module_sessions` or standalone)
- **Action items from coach to client**: Coach creates development items (already possible via `create-client-development-item` edge function) — but needs better UI discoverability
- **Direct messaging or conversation threads**: In-app messaging between coach/instructor and client (new tables: `conversations`, `messages`)
- **Client progress summary for coaches**: One-page overview of client's journey (enrollments, assessment scores, goals progress, session history)
- **Individual coaching (non-program)**: Currently coaching is program-linked. Support standalone coach-client relationships via `client_coaches` table (exists but underutilized)

**Recommended phase:** Split across phases:
- Phase 1: Better UI discoverability for existing features (coaching notes via development items, progress summary)
- Phase 4 (Peer & Social): In-app messaging
- Phase 6 (Enterprise): Coaching session report generation, client progress reports

**Effort:** 3-5 weeks total across phases
**Dependencies:** Messaging needs new tables (`conversations`, `messages`)

### R4: Coaches Can Invite and Add Their Own Clients

**Current state:** Only admins can create users. Coaches have no way to invite or add clients. `RequestCoachInstructorDialog.tsx` is client-initiated (client requests a coach, admin approves).

**What's needed:**
- Coach UI: "Invite Client" button in teaching dashboard
- Flow: Coach enters client email → system creates invite → client receives email → signs up → auto-linked to coach via `client_coaches`
- If client already exists: add `client_coaches` link directly
- New table or reuse: `coach_client_invites` (coach_id, email, status, token)
- Admin visibility: admin can see coach-initiated invites
- Scope control: coaches can only invite as individual clients (not assign to programs — that stays admin-only)

**Recommended phase:** Phase 5 (Self-Registration & Scale) — natural extension of registration flow
**Effort:** 1-2 weeks
**Dependencies:** Phase 5 core (signup infrastructure must work first)

### R5: Enhanced Organization Management

**Current state:** Org admin pages exist: OrgAdminDashboard, OrgMembers, OrgEnrollments, OrgPrograms, OrgTerms, OrgAnalytics, OrgBilling, OrgSettings, OrgAdminFAQ. Member invite/role management works. Credit tracking works.

**What's needed:**
- **Org branding**: Logo, accent color, custom name (Phase 6 roadmap item exists)
- **Seat management**: Track max seats, warn on approaching limits (Phase 6 roadmap item exists)
- **Org-level reporting**: Member progress aggregation, completion rates, assessment score distributions
- **Org program customization**: Org-specific program variants with custom content
- **Self-service org creation**: Application form + admin approval (Phase 5 roadmap item — deferred to "Coming soon")
- **Org billing enhancements**: Invoice history, payment method management, usage-based billing
- **Multi-org support**: Users belonging to multiple organizations

**Recommended phase:** Phase 6 (Enterprise & Analytics) — most items already in roadmap
**Effort:** 5-7 weeks (already estimated in Phase 6)
**New items to add:** Multi-org support, org billing enhancements, member progress aggregation

### R6: Enhanced Sentry Coverage

**Current state:**
- Sentry initialized in `src/main.tsx` (production only, 10% trace sample rate)
- `ErrorBoundary.tsx` catches React errors with Sentry event IDs
- `src/lib/vitals.ts` tracks Core Web Vitals
- No Sentry on edge functions (Deno runtime, not browser)
- No structured error tracking for API call failures, auth errors, or form validation issues

**What's needed:**
- **Frontend breadcrumbs**: Add Sentry breadcrumbs at key user journey points (signup, login, enrollment, payment, assessment completion)
- **API error tracking**: Wrap Supabase function calls with Sentry error capture (create `src/lib/sentry-utils.ts` helper)
- **User identification**: Set Sentry user context when authenticated (currently not done)
- **Edge function monitoring**: Evaluate Sentry Deno SDK for edge functions, or use structured logging to a monitoring service
- **Custom performance spans**: Track key user flows (signup-to-first-login, assessment completion time)
- **Error grouping**: Add custom fingerprints for common error types
- **Source maps**: Ensure Vite build uploads source maps to Sentry for readable stack traces

**Recommended phase:** Cross-cutting — can be done incrementally alongside any phase
**Effort:** 1-2 weeks
**Dependencies:** None

### R7: Enhanced Test Coverage (Unit + E2E)

**Current state:**
- 17 unit test files, 251+ tests (Vitest) — covers utilities, schemas, hooks
- 19 E2E test files (Playwright) — covers auth, dashboard loading, basic flows
- Gaps: No tests for assessment workflows, coaching interactions, org management, bulk operations, credit system flows, entitlements logic in context, resource access

**What's needed:**
- **Unit test expansion**:
  - Assessment scoring logic tests
  - Entitlement resolution tests (5 source merge, deny override)
  - Credit consumption/refund logic tests
  - Placeholder transfer logic tests
  - CSV parser/validator tests (for bulk import)
  - Form validation tests for new forms
- **E2E test expansion**:
  - Self-signup → verification → role selection → dashboard (full flow)
  - Coach/instructor: view client progress, create development items
  - Assessment: take self-assessment, view results, create goals from weak areas
  - Org admin: invite member, manage roles, view enrollments
  - Program enrollment with credit deduction
  - Wheel of Life → signup pipeline
- **CI integration**: Ensure all tests run in GitHub Actions (CI config exists at `.github/workflows/ci.yml`)
- **Coverage reporting**: Add `vitest --coverage` to verify script or separate command

**Recommended phase:** Continuous — add tests alongside each feature implementation
**Effort:** 3-5 weeks if done as dedicated effort, or incremental with each phase
**Dependencies:** Features must exist before testing them

---

## Roadmap Updates to Make in ISSUES_AND_IMPROVEMENTS.md

Add to existing phases:
- **Phase 1**: R2 (Coach/instructor onboarding wizard), R3 partial (better UI for existing coach features)
- **Phase 2**: R1 (Assessment domain question types & weighted scoring)
- **Phase 5**: R4 (Coaches invite own clients)
- **Phase 6**: R5 additions (multi-org, org billing, member progress aggregation)
- **Cross-cutting**: R6 (Sentry), R7 (Tests) — note as continuous improvement items

New section 11.9 "New Data Tables Required" additions:
- R1: `capability_assessments.question_types` (JSONB), `capability_domain_questions.question_type` (TEXT), `capability_domain_questions.type_weight` (NUMERIC)
- R3: `conversations` (participants, type), `messages` (conversation_id, sender_id, content, sent_at)
- R4: `coach_client_invites` (coach_id, email, status, token, expires_at)
