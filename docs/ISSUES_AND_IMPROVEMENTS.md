# Issues, Improvements & Enhancement Roadmap

---

## Part 1: Known Issues (prioritized)

### Critical — Fix before pilot users encounter them

#### 1.1 Credit Loss on Failed Enrollment — RESOLVED (2026-02-15)
**File:** `src/pages/admin/ClientDetail.tsx` (was lines 384-431)
**Problem:** Credits were deducted BEFORE enrollment was created. If enrollment failed, credits were lost with no refund.
**Resolution:** Created `enroll_with_credits` PL/pgSQL RPC that wraps credit consumption + enrollment insert in a single DB transaction with automatic rollback. ClientDetail.tsx now calls one atomic RPC instead of two separate operations. Also fixed M6 (credit batch race condition) by adding `FOR UPDATE SKIP LOCKED` to `consume_credits_fifo`.
**Migration:** `20260215190459_54d8beb9-850f-4f5f-b328-89926cb764b3.sql`

#### 1.2 Cal.com Booking Creates Orphaned Bookings on DB Failure — ✅ RESOLVED 2026-02-16
**File:** `supabase/functions/calcom-create-booking/index.ts`, `supabase/functions/calcom-webhook/index.ts`
**Problem:** If Cal.com booking succeeds but session DB update fails, orphaned bookings accumulate in Cal.com. Also, BOOKING_CANCELLED events from Cal.com were logged but never processed, causing DB sessions to remain "scheduled" after Cal.com cancellation.
**Resolution:**
1. **calcom-create-booking:** On DB update failure, auto-cancels the Cal.com booking via `cancelCalcomBooking()` helper.
2. **calcom-webhook BOOKING_CREATED:** On DB sync failure in catch block, auto-cancels the orphaned Cal.com booking.
3. **calcom-webhook BOOKING_CANCELLED:** New handler sets matching `module_sessions` / `group_sessions` status to "cancelled" by `calcom_booking_uid`. Works with or without event type mapping.
4. **Shared utility:** `_shared/calcom-utils.ts` provides `cancelCalcomBooking()` using Cal.com v2 API.

---

### High — Fix soon

#### 1.3 File Upload Validation — ✅ RESOLVED 2026-02-16
**Files:** All 13 upload interfaces across admin, client, coach, and instructor areas
**Problem:** Inconsistent upload validation — some interfaces had manual checks, others had none.
**Resolution:** Created `src/lib/fileValidation.ts` with bucket-specific MIME type and size presets (15 buckets). Applied `validateFile()` and `acceptStringForBucket()` to all 13 upload interfaces, replacing inline checks with centralized validation. Includes filename sanitization, format-friendly error messages, and consistent `accept` attributes on file inputs.

#### 1.4 AI Prompt Functions Accept Unlimited Input — ✅ RESOLVED 2026-02-16
**File:** `supabase/functions/generate-reflection-prompt/index.ts`, `course-recommendations/index.ts`, `decision-insights/index.ts`
**Problem:** No input size limits before sending to Vertex AI. Cost spikes, timeouts possible.
**Resolution:** Created `supabase/functions/_shared/ai-input-limits.ts` with `truncateArray()`, `truncateString()`, `truncateJson()`, `truncateObjectStrings()`, and `enforcePromptLimit()` helpers. Applied to all 3 unbounded AI functions: arrays capped at 20 items, strings at 500 chars, total prompts at 8K chars with truncation warning logging. `analytics-ai-insights` already had a 50K check.

#### 1.5 N+1 Query in Assessment Scoring — ✅ RESOLVED 2026-02-17
**File:** `src/components/modules/InstructorAssignmentScoring.tsx`
**Problem:** Fetches domains, then loops to query questions per domain. 10 domains = 11 DB calls.
**Resolution:** Replaced Promise.all loop with single nested Supabase select using `capability_domain_questions` relation. 10 domains now = 1 query instead of 11.

#### 1.6 Assignment Grading Lacks Status Guard — ✅ RESOLVED 2026-02-17
**File:** `src/components/modules/InstructorAssignmentScoring.tsx`
**Problem:** Didn't verify assignment is `submitted` before allowing grading.
**Resolution:** Added UI guard that shows a disabled card with message when assignment isn't submitted. Scoring form only renders for "submitted" or "reviewed" status. Save mutation already had a backend guard preventing completion of non-submitted assignments.

---

### Medium — Improve over time

#### 1.7 Console Statements in Production — ✅ RESOLVED 2026-02-20
**Problem:** ~36 console.log and ~22 console.warn statements across 20+ files leaked debug info to DevTools.
**Resolution:** Removed 49 console.log/warn statements across 20 files. Kept only: console.error (legitimate error handling), web vitals reporting (vitals.ts), error boundary logging (ErrorBoundary.tsx), and critical warnings (localStorage failures in AuthContext, xAPI in ContentPackageViewer, auth context in useAuthContext, file validation in fileValidation.ts, survey operator in GuidedPathSurveyWizard).

#### 1.8 Notification Sending Is Synchronous
**Problem:** Edge functions send notifications to all participants synchronously before returning. Group sessions with many participants could timeout.

**Cursor prompt:**
```
In supabase/functions/calcom-create-booking/index.ts and other edge functions that send multiple notifications, make notification sending asynchronous:

1. Instead of awaiting each notification send, insert into the process-email-queue table
2. The existing process-email-queue cron function will pick them up
3. Return success immediately after the main action (booking/enrollment) completes
4. This pattern should apply to: calcom-create-booking, notify-assignment-submitted, notify-assignment-graded, decision-reminders, subscription-reminders
```

#### 1.9 Credit Balance Race Condition — RESOLVED (2026-02-15)
**Problem:** Concurrent requests could both pass balance check and deduct, going negative.
**Resolution:** Added `FOR UPDATE SKIP LOCKED` to both credit_batches SELECT loops in `consume_credits_fifo`. This was fixed as part of the C3/M6 migration (`20260215190459_54d8beb9-850f-4f5f-b328-89926cb764b3.sql`).

#### 1.10 Entitlement Edge Case (org deny override) — ✅ RESOLVED 2026-02-16
**Problem:** Org sets feature limit=0 (disable), but user's subscription gives limit=100 → merged result is 100. Org intent bypassed.
**Resolution:** Added `is_restrictive` boolean column to `plan_features` table. When `is_restrictive=true`, the feature is explicitly DENIED, overriding all grants from any source (subscription, add-on, track, program plan). Updated `useEntitlements` merge logic to check for deny before processing grants. Added admin UI toggle (Deny checkbox with Ban icon) in Features Management > Plan Configuration. See `docs/ENTITLEMENTS_AND_FEATURE_ACCESS.md` for full documentation.

#### 1.11 Edge Function Error Handling Inconsistent — ✅ RESOLVED 2026-02-16
**Problem:** Some functions return proper 400/500 codes, others return generic 500 for everything.
**Resolution:** Created shared `supabase/functions/_shared/error-response.ts` with typed `errorResponse` (badRequest/unauthorized/forbidden/notFound/rateLimit/serverError) and `successResponse` (ok/created/noContent) helpers. Migrated 5 high-impact functions: create-checkout, generate-reflection-prompt, check-ai-usage, course-recommendations, decision-insights. Also upgraded them from wildcard CORS to origin-aware `getCorsHeaders`. Remaining 56 functions can be incrementally migrated.

#### 1.12 Dual Plans Admin UX Confusion
**Problem:** Two separate admin pages for subscription plans vs program plans with no guidance.

**Cursor prompt:**
```
Improve the admin Plans Management UX:

1. In src/pages/admin/PlansManagement.tsx, add a blue info banner at the top explaining: "Subscription Plans control account-level access and billing. They determine which programs users can access based on tier level."

2. In src/pages/admin/ProgramPlansManagement.tsx, add a similar banner: "Program Plans control feature access within a specific program enrollment. They are assigned when a user enrolls in a program."

3. Add a "Learn more" link in each banner that links to the other page with text like "Looking for Program Plans instead?" / "Looking for Subscription Plans instead?"

Use shadcn/ui Alert component with variant="default".
```

---

### Low — Nice to have

#### 1.13 No Zod Form Validation
**Problem:** Forms use manual validation. Inconsistent error messages.
**Action:** Adopt Zod starting with critical forms. Good task for Cursor.

#### 1.14 Loading/Error States Inconsistent — ✅ RESOLVED 2026-02-16
**Problem:** Mix of skeleton loaders and inline "Loading..." text.
**Resolution:** Created reusable `PageLoadingState` component (4 variants: centered, card, skeleton, inline) and `ErrorState` component (card/inline variants with retry support). Migrated 5 worst pages: ClientDashboard, Academy, Community, Goals, ProgramDetail. Remaining pages can be incrementally migrated.

#### 1.15 AuthContext Role Fallback Bug — RESOLVED (2026-02-15)
**Problem:** `if (roles.length === 0) roles = ["client"]` in AuthContext.tsx line 135. Silently assigned client role on fetch failure.
**Resolution:** Removed all 4 silent "client" fallbacks. Added `authError` state to AuthContext. ProtectedRoute now shows "Unable to Load Your Account" error card (with retry/sign-out) on fetch failure, and "Account Not Configured" for users with genuinely zero roles.

---

## Part 2: Incomplete / Partially Implemented Features

### Fully Functional (95% of the app)
All core features work end-to-end: programs, modules, assignments, assessments, scenarios, sessions, resources, goals, decisions, groups, skills map, wheel of life, badges, notifications, billing, calendar, public profiles, AI features.

### Partially Implemented Integrations

| Integration | What Works | What's Missing |
|------------|-----------|---------------|
| **Circle** | SSO login to external community | No content sync back to Hub, no in-app community features |
| **TalentLMS** | SSO + xAPI progress sync | No course discovery/browsing in Hub, no enrollment from Hub |
| **Lucid** | Admin maps users to Lucid URLs | No OAuth, no API integration, just URL launcher |
| **Google Drive** | Admin maps users to folder URLs | No OAuth, no file sync, just URL launcher |
| **Miro** | Sidebar placeholder only | No admin page, no backend, no SSO (removed dead link) |
| **Mural** | Sidebar placeholder only | No admin page, no backend, no SSO (removed dead link) |

### Intentionally Disabled (Pilot Mode)
- **Self-registration** — signup form hidden, Google OAuth button hidden
- **Google OAuth sign-in** — disabled in Supabase Dashboard + hidden in UI
- Comments marked with `/* ... during pilot — re-enable when self-registration opens */`

### Integration Enhancement Priority (if you want to deepen them)

1. **Circle** — highest value. Embed community feed/discussions in Hub. Adds stickiness.
2. **TalentLMS** — medium value. Show available courses in Hub, track progress visually.
3. **Lucid/Miro/Mural** — low priority. URL launchers are sufficient for pilot. Deepen later if users request it.
4. **Google Drive** — low priority. URL mapping works for now.

---

## Part 3: Business Enhancement Recommendations

### Tier 1 — High Impact, Differentiators

#### 3.1 AI-Powered Coaching Copilot
**What:** Expand beyond current AI features (insights, recommendations) to an interactive coaching assistant that:
- Prepares clients before sessions (summarizes progress, suggests discussion points)
- Helps coaches with session notes and follow-up actions
- Generates personalized learning paths based on assessment results + goals

**Why:** Most LMS platforms offer static content. An AI copilot that adapts to each learner's journey is a major differentiator. Vertex AI Gemini is already integrated — this extends its use.

**Effort:** Medium (3-4 weeks). Extend existing AI edge functions.

#### 3.2 Progress Analytics Dashboard with Predictive Insights
**What:** A visual dashboard showing:
- Enrollment completion predictions (based on current pace vs cohort average)
- Credit consumption trends with burn-rate alerts
- Skill gap analysis (assessment scores vs required competencies)
- Coach effectiveness metrics

**Why:** Data-driven coaching is a premium feature competitors lack. Organizations paying for coaching want ROI metrics.

**Effort:** Medium (2-3 weeks). Data is already in DB, needs visualization layer.

#### 3.3 Peer Learning Network
**What:** Enable structured peer coaching beyond the current group sessions:
- Auto-match peers by complementary skills (one strong where other is weak)
- Guided peer feedback templates
- Peer accountability partners for goals

**Why:** Scales coaching beyond 1:1 without additional coach cost. Builds community and retention.

**Effort:** Medium (3 weeks). Groups infrastructure exists, needs matching algorithm + templates.

#### 3.4 Organization ROI Dashboard
**What:** For org admins, show:
- Team skill evolution over time (aggregate assessment scores)
- Program completion rates vs industry benchmarks
- Credit utilization efficiency
- Employee engagement metrics (session attendance, assignment completion rates)

**Why:** This is what sells to enterprise buyers. HR/L&D leaders need to justify coaching spend to CFOs.

**Effort:** Medium (2-3 weeks). Most data exists, needs aggregation views + export.

### Tier 2 — Medium Impact, Retention Boosters

#### 3.5 Gamification Layer
**What:** Points, streaks, and leaderboards:
- Daily/weekly streak tracking for module completions
- Achievement badges beyond certification (e.g., "7-day streak", "First reflection")
- Optional team leaderboards for org cohorts

**Why:** Drives daily engagement. Badge system already exists — extend it.

**Effort:** Low-Medium (1-2 weeks). Badge infrastructure is in place.

#### 3.6 Mobile-First PWA Enhancements
**What:** Push notifications, offline access to resources, quick session check-in from phone.

**Why:** Coaching happens between sessions. Mobile access for reflections, goal tracking, and resource review increases engagement.

**Effort:** Low (1 week). PWA is already set up. Add push notifications + offline resource caching.

#### 3.7 White-Label / Custom Branding per Organization
**What:** Allow orgs to customize logo, colors, terminology (e.g., "modules" → "chapters").

**Why:** Enterprise customers want their branding. Differentiates from one-size-fits-all platforms.

**Effort:** Medium (2-3 weeks). Needs theme system + org settings.

#### 3.8 Integrated Video for Sessions
**What:** Instead of just linking to Zoom/Teams, embed video directly in the Hub for sessions. Record sessions, auto-generate transcripts and action items via AI.

**Why:** Keeps users in-platform. Session recordings + AI summaries are a premium coaching feature.

**Effort:** High (4-6 weeks). Needs video provider integration (Daily.co, Twilio).

### Tier 3 — Lower Effort, Polish

#### 3.9 Smart Notifications
**What:** ML-driven notification timing: send reminders when users are most likely to engage (based on historical activity patterns), not at fixed intervals.

**Why:** Reduces notification fatigue. Increases open rates.

**Effort:** Medium (2 weeks). Notification infrastructure exists, add timing intelligence.

#### 3.10 Export & Reporting
**What:** PDF export of: assessment results, development plans, coaching journey summaries, goal progress. Org-level CSV exports for analytics.

**Why:** Clients share progress with managers. Orgs need compliance reports.

**Effort:** Low (1 week). Data exists, add PDF generation + CSV export.

#### 3.11 Marketplace for Coaching Content
**What:** Allow certified coaches to publish their own scenarios, assessment templates, and resource collections. Revenue share model.

**Why:** Creates a content flywheel. Reduces your content creation burden. Attracts coaches to the platform.

**Effort:** High (6+ weeks). Needs content publishing workflow, review/approval, revenue tracking.

---

## Part 4: How to Get Strategic Product Input

### Best approach: Multi-model research sessions

Use this workflow to generate strategic insights for any product question:

#### Step 1 — Market Research (Claude Code or Web Search)
Ask me or use web search to research:
- "What are the top features of [competitor]?"
- "What do coaching platform buyers prioritize in 2026?"
- "What are the emerging trends in L&D technology?"

#### Step 2 — Competitive Analysis (Claude with web access)
Ask me to analyze specific competitors:
- BetterUp, CoachHub, Torch, Sounding Board, EZRA
- What do they offer that you don't?
- What do you offer that they don't?

#### Step 3 — User Journey Mapping (Claude)
Ask me to map specific user journeys and identify friction points:
- "Map the journey of a new client from first login to completing their first module"
- "What are the pain points for an instructor managing 20 students?"

#### Step 4 — Feature Prioritization (Claude)
Give me a list of potential features and I'll help you score them on:
- Impact (revenue, retention, differentiation)
- Effort (development time, dependencies)
- Risk (technical complexity, user adoption uncertainty)

#### Step 5 — Validation (Cursor + AI)
For features you decide to build, use Cursor Agent to prototype quickly:
- "Build a mockup of the organization ROI dashboard using existing data"
- "Add a basic streak counter to the client dashboard"

### Tools for ongoing product strategy:
- **Claude Code (this tool)** — deep codebase analysis, architecture decisions, competitive analysis
- **Cursor Agent** — rapid prototyping, UI work, implementing features
- **ChatGPT/Claude web** — market research, user persona development, pricing strategy
- **Perplexity** — quick competitor feature lookups with sources

### Recommended cadence:
- **Weekly**: 30 min competitive scan (what did BetterUp/CoachHub ship this week?)
- **Monthly**: Strategic review — which enhancement from Tier 1-3 to tackle next?
- **Per feature**: Research → Prototype → Test with 2-3 pilot users → Ship or kill

---

## Part 5: Onboarding Analysis (Coaches, Instructors, Organizations)

### Current State: Coach/Instructor Onboarding

**What works:**
- Admin creates coach/instructor via Users Management → assigns role → sends welcome email
- Welcome email includes a password setup link (24h expiry)
- After login, coach/instructor lands on `InstructorCoachDashboard` showing assigned programs, clients, pending tasks
- Profile settings available: bio, specialties, meeting preferences, calendar URL, avatar, timezone
- Admin can assign qualifications (which module types instructor can teach)
- Program assignment: admin links coaches to programs via `program_coaches`, then to clients via `client_coaches`

**What's missing:**

| Gap | Impact | Recommendation |
|-----|--------|---------------|
| **No onboarding wizard** | Coach/instructor lands on dashboard with no guidance on what to do first | Add a first-login guided flow: "Set up your profile → Review assigned programs → Check pending tasks" |
| **No coach verification workflow** | No way to verify coach credentials/certifications before they start coaching | Add a verification status (pending/verified/rejected) on profiles, with admin approval step |
| **No coach availability setup** | Coaches set a calendar URL, but no native availability management | Integrate Cal.com availability slots — coaches set availability directly in Hub |
| **No self-service coach registration** | All coaches must be admin-created | Add a "Become a Coach" application form → admin reviews → approves/rejects |
| **No coach performance dashboard** | No metrics on session ratings, client satisfaction, completion rates | Add coach analytics: session count, average rating, client progress, NPS |
| **Welcome email is minimal** | Just a password link, no introduction to the platform | Enhance with: platform overview, first steps, link to profile setup, help resources |
| **No bulk invite** | Admin must create coaches one-by-one | Add CSV upload for bulk coach/instructor creation |
| **No specialization matching** | No way to auto-match coaches to clients based on expertise areas | Add skill/specialization tags with matching algorithm |

### Current State: Organization Onboarding

**What works:**
- Admin creates organization with name, slug, industry, size range
- Org admin dashboard shows: member count, enrollment stats, credit balance, growth metrics
- Org members invited via email (7-day token), with role assignment (org_admin/org_manager/org_member)
- Organization credit system: purchase credit batches, sponsor member enrollments
- Org platform tiers: Essentials (€30k/yr) and Professional (€50k/yr)
- Member sharing consent: granular privacy controls (profile, enrollments, progress, assessments, goals)
- Org admins can manage programs, enrollments, billing

**What's missing:**

| Gap | Impact | Recommendation |
|-----|--------|---------------|
| **No org onboarding wizard** | New org admins don't know where to start | Add: "Welcome to your organization → Invite team → Assign programs → Set up billing" wizard |
| **No org-level branding** | All orgs see same InnoTrue branding | Add custom logo, color accent, org name in header (white-label lite) |
| **No org SSO (SAML/OIDC)** | Enterprise orgs want single sign-on with their identity provider | Add SAML/OIDC support — significant effort but critical for enterprise sales |
| **No org-level reporting/export** | Org admins can't export data for internal reporting | Add CSV/PDF export of enrollments, progress, credit usage |
| **No org program customization** | Orgs can't request custom programs or modify existing ones | Add org-specific program variants or configuration options |
| **No seat management warnings** | No alert when approaching max sponsored seats | Add low-seat-count notifications |
| **No org welcome email** | Org creation is silent — no email to the org contact | Send a branded welcome email with setup guide |
| **No trial/demo mode** | Orgs can't try before buying | Add 30-day free trial with limited credits and features |
| **No org health dashboard** | No aggregate view of team engagement, at-risk members | Add engagement scores, completion heatmaps, coach utilization |

### Current State: Client Onboarding

**What works:**
- Admin creates client → welcome email → password setup → login
- Client dashboard: enrolled programs, upcoming sessions, reflections, assignments, coaches, groups
- Explore Programs page for browsing available programs
- Full notification system (31 types, email + in-app)
- Profile + public profile settings with granular visibility
- Track selection (CTA/Leadership)

**What's missing:**

| Gap | Impact | Recommendation |
|-----|--------|---------------|
| **No onboarding wizard/tour** | Client lands on dashboard without knowing where to start | Add interactive product tour (Shepherd.js or custom): "This is your dashboard → Explore programs → Complete your profile → Set your goals" |
| **No progress onboarding checklist** | No visual "get started" checklist | Add a persistent "Getting Started" card: profile complete? first program enrolled? first goal set? first reflection? |
| **Self-registration disabled** | All clients must be admin-created during pilot | Plan for re-enabling: fix AuthContext role fallback, test Google OAuth, add email domain allowlisting |
| **No recommended programs** | Clients must browse all programs, no personalization | Use assessment results + goals to recommend programs (AI-powered) |
| **No coach matching** | Coach assigned by admin, no client preference input | Let clients see coach profiles, specialties, availability before matching |

---

## Part 6: Making It Great for the Young Generation (Gen Z / Young Millennials)

### Why It Matters
Gen Z (born 1997-2012) and young millennials are increasingly the target audience for professional development platforms. They have different expectations from legacy LMS tools.

### What Young Professionals Expect (and current gaps)

#### 6.1 Mobile-First, Not Desktop-Adapted
**Current state:** Responsive web app (PWA) with desktop-first design.
**Gap:** Young users do 80%+ on mobile. Quick check-ins, reflections, and goal updates should work seamlessly on a phone.
**Recommendations:**
- Bottom navigation bar on mobile (not hamburger menu)
- Swipeable cards for modules, sessions, goals
- Quick-action buttons: "Log reflection" (30-second capture), "Check in on goal" (one tap)
- Push notifications with deep links (PWA supports this)
- Offline access to resources and recent reflections

#### 6.2 Micro-Learning Over Long Modules
**Current state:** Modules are full-length (60-120 min sessions, assignments).
**Gap:** Young learners prefer 5-15 minute learning chunks throughout the day.
**Recommendations:**
- Add a `micro_learning` module type: short video (2-5 min) + one reflection question + one action item
- Daily learning bite: push a 3-minute micro-lesson each morning
- Spaced repetition: resurface key concepts from completed modules at intervals
- Content format: short video > long PDF. Support TikTok-style vertical video clips

#### 6.3 Social & Community Features
**Current state:** Groups exist but are task/session-focused. Circle SSO for community (external).
**Gap:** Young users expect in-app social features, not external redirects.
**Recommendations:**
- In-app activity feed: "Sarah completed Module 3", "Michael set a new goal", "Emily shared a reflection"
- Peer reactions (not just likes — meaningful reactions: "Inspired", "Same!", "Great insight")
- Public reflections with opt-in sharing (currently private)
- Cohort chat / discussion threads within groups
- Mentorship matching: pair junior + senior within org cohorts

#### 6.4 Gamification & Visual Progress
**Current state:** Badges exist but no streaks, points, or leaderboards.
**Gap:** Young users are motivated by visible progress and social comparison.
**Recommendations:**
- **Streaks:** Daily/weekly engagement streaks with visual fire/count
- **XP system:** Points for completing modules, reflections, sessions, goals → visible level progression
- **Achievement badges:** "7-day streak", "First scenario completed", "100 reflections", "Coach's favorite"
- **Progress visualization:** Animated skill radar chart that grows over time, not static
- **Optional leaderboards:** Per-cohort, anonymizable, opt-in. Focus on effort (completions) not scores
- **Celebration moments:** Confetti/animation on module completion, program graduation

#### 6.5 AI-Native Experience
**Current state:** AI features exist (insights, recommendations, reflection prompts) but require clicking into specific pages.
**Gap:** Young users expect AI woven into every interaction, not as a separate feature.
**Recommendations:**
- **AI assistant in every page:** Floating chat bubble — "Ask me anything about this module"
- **Smart nudges:** "You haven't reflected in 5 days. Here's a quick prompt based on your recent session."
- **Auto-generated session prep:** Before a coaching session, AI summarizes recent progress, goals, and suggested talking points
- **Voice input for reflections:** Speak instead of type (especially on mobile)
- **AI-powered skill gap analysis:** After each assessment, show "You're strong in X, here's how to close the gap in Y"

#### 6.6 Personalization & Agency
**Current state:** Programs are admin-assigned, structured paths.
**Gap:** Young learners want autonomy — choose their path, pace, and focus areas.
**Recommendations:**
- **Choose your adventure:** Let clients pick modules within a program (not strictly sequential)
- **Custom learning paths:** "Build your own path" from available modules across programs
- **Goal-driven recommendations:** "Based on your goal 'Improve public speaking', here are 3 modules and 2 resources"
- **Flexible pacing:** Self-paced vs cohort-paced toggle per enrollment
- **Interest-based discovery:** "Others with similar goals also completed..."

#### 6.7 Modern UX Patterns
**Current state:** Clean shadcn/ui design, functional.
**Gap:** Could feel corporate/clinical to younger users.
**Recommendations:**
- **Dark mode** (high demand from younger users)
- **Customizable dashboard:** Drag-and-drop widget arrangement
- **Quick actions from keyboard:** Cmd+K command palette for power users
- **Emoji reactions** in feedback and reflections
- **Progress animations:** Smooth transitions, micro-interactions on state changes
- **Skeleton loaders** everywhere (no blank states or "Loading..." text)

#### 6.8 Real-World Integration
**Current state:** Coaching stays in the platform.
**Gap:** Young professionals want learning integrated into their actual work.
**Recommendations:**
- **Slack/Teams integration:** Daily learning nudge, session reminders, goal check-ins in messaging tools
- **Calendar integration UX:** One-click "Add all sessions to my calendar" (not per-session)
- **LinkedIn badge sharing:** Already exists (good!) — make it more prominent post-certification
- **Export portfolio:** Generate a shareable coaching journey summary for career advancement
- **Manager visibility:** Opt-in sharing of progress with direct manager (separate from org consent)

### Implementation Priority for Young Generation Features

| Priority | Feature | Effort | Why Now |
|----------|---------|--------|---------|
| 1 | Dark mode | 1 week | Most requested UX feature across all demographics |
| 2 | Engagement streaks + XP | 1-2 weeks | Badge system exists, extend it. Huge retention boost |
| 3 | Mobile bottom nav + quick actions | 1 week | PWA exists, improve mobile experience |
| 4 | AI assistant everywhere | 2-3 weeks | Vertex AI integrated, extend to contextual chat |
| 5 | Activity feed + peer reactions | 2 weeks | Groups exist, add social layer |
| 6 | Micro-learning module type | 1-2 weeks | Module system exists, add short format |
| 7 | Push notifications | 1 week | PWA supports it, just needs implementation |
| 8 | Cmd+K command palette | 3 days | Power user feature, differentiator |
| 9 | Dark mode + customizable dashboard | 2 weeks | Modern UX expectations |
| 10 | Slack/Teams integration | 3-4 weeks | Enterprise + young user appeal |

### Key Insight for Young Generation Strategy
The platform already has **deep functionality** (assessments, scenarios, goals, decisions, groups, AI). The gap isn't features — it's **experience design**. Wrapping existing features in a more engaging, mobile-first, gamified, AI-native experience will resonate with younger users without requiring new backend systems. Most recommendations above are **frontend-only changes** that leverage existing data and infrastructure.

---

## Part 7: Self-Signup Flow Analysis (All Roles)

### Current Signup Architecture

There are **3 ways to create accounts** in the system:

| Method | Entry Point | Available Roles | Who Triggers | Status |
|--------|------------|----------------|-------------|--------|
| **Self-signup** | `/auth` signup form | `client` only (hardcoded) | User | **DISABLED** (pilot lockdown) |
| **Admin creation** | Admin → Users Management | Any role(s) | Admin | **WORKING** |
| **Org invite** | `/accept-invite?token=...` | `org_admin`, `org_member` | Org admin | **WORKING** |

### Self-Signup Flow (when re-enabled)

**Step 1 — Signup form** (`Auth.tsx` → calls `signup-user` edge function):
- Rate limited: 5 attempts per IP per 5 minutes (timing-safe)
- Creates unconfirmed user via Supabase admin API
- Generates SHA-256 hashed verification token (24h expiry)
- Sends verification email via Resend (template: `signup_verification`)
- Verification link: `/verify-signup?token={plainToken}`

**Step 2 — Email verification** (`verify-signup` edge function):
- Hashes plain token, compares against stored hash
- Confirms email via Supabase admin API
- **Hardcodes `client` role** (no role selection)
- Creates profile, notification preferences
- Transfers placeholder enrollments if matching `real_email` exists

**Step 3 — Post-login redirect** (`AuthContext.tsx` → `Index.tsx`):
- Fetches roles from `user_roles` table
- Priority: saved preference → admin → org_admin → first role → **fallback to `client`**
- Redirects: admin → `/admin`, instructor/coach → `/teaching`, client → `/dashboard`

### Self-Signup for Non-Client Roles: NOT SUPPORTED

| Role | Self-signup? | Current path | Gap |
|------|------------|-------------|-----|
| **Client** | Yes (disabled during pilot) | Signup form → verify email → client role | Only role available via self-signup |
| **Coach** | No | Admin creates manually | No "Become a Coach" application form |
| **Instructor** | No | Admin creates manually | No instructor registration flow |
| **Org Admin** | No | Admin creates org → invites org admin | No self-service org creation |
| **Admin** | No | Created via `create-admin-user` | Correct — should never be self-signup |

### Critical Issues for Re-enabling Self-Signup

#### 7.1 AuthContext Role Fallback — RESOLVED (2026-02-15)
**File:** `src/contexts/AuthContext.tsx`
**Problem:** `if (roles.length === 0) roles = ["client"]` — any user with no roles got auto-assigned `client`.
**Resolution:** Removed all silent "client" fallbacks. Added `authError` state to AuthContext. ProtectedRoute shows error card on fetch failure, "Account Not Configured" card for users with zero roles. This unblocks safe re-enabling of Google OAuth (Phase 5).
> **Note:** The `/complete-registration` page and `access_requests` table from the original Cursor prompt are still needed for Phase 5 (self-signup re-enable) but are separate work items.

#### 7.2 No Role Selection During Signup
**Problem:** Self-signup always assigns `client`. There's no way for coaches, instructors, or org admins to self-register.
**Impact:** All non-client users must be admin-created one-by-one.
**Recommendation:** Add a role-selection step to signup with admin approval for privileged roles:
- Client → auto-approved (immediate access)
- Coach/Instructor → "Application submitted" → admin reviews → approves/rejects
- Org Admin → "Create organization" flow → admin reviews → approves

**Cursor prompt:**
```
Add a role selection step to the signup flow. After email verification:

1. Create src/pages/RoleSelection.tsx:
   - Show 3 options: "I'm a Client" (immediate), "I'm a Coach/Instructor" (needs approval), "I represent an Organization" (needs approval)
   - Client selection: assign client role immediately, redirect to /dashboard
   - Coach/Instructor: show a form (specialties, certifications, bio) → insert into `coach_applications` table → show "Application under review" message
   - Organization: show a form (org name, size, industry) → insert into `org_applications` table → show "Application under review" message

2. In verify-signup edge function: don't auto-assign client role. Instead, set a `registration_status = 'pending_role_selection'` flag on the profile

3. In AuthContext: if profile has `registration_status = 'pending_role_selection'`, redirect to /role-selection

4. Create admin page for reviewing coach/org applications
```

#### 7.3 Wheel of Life → Signup Broken Pipeline
**File:** `src/pages/public/WheelAssessment.tsx`
**Problem:** The Wheel of Life assessment at `/wheel` collects leads into `ac_signup_intents` table, but:
1. RLS for `ac_signup_intents` INSERT is broken (documented in RLS_FIX_PLAN.md as critical #1)
2. Even if working, context data (plan_interest, wheel ratings) is NOT used by `verify-signup`
3. The signup button navigates to `/auth` with prefilled data, but signup is disabled during pilot

**Fix needed:** (1) Fix RLS for public INSERT, (2) Wire context from `ac_signup_intents` into signup flow so plan interest carries through, (3) After verification, auto-assign the selected plan tier.

#### 7.4 Welcome Email Not Auto-Triggered
**Problem:** `send-welcome-email` is only invoked manually from the admin Users Management page. Self-signup users never receive a welcome email — they only get the verification email.
**Impact:** No onboarding guidance, no "what's next" after email verification.
**Fix:** Call `send-welcome-email` at the end of `verify-signup` (after profile creation and role assignment).

**Cursor prompt:**
```
In supabase/functions/verify-signup/index.ts, after the profile is created and role assigned (around line 150), add a call to send the welcome email:

1. After successful verification, invoke the send-welcome-email function:
   - Use supabase.functions.invoke("send-welcome-email", { body: { userId: user.id } })
   - Or copy the relevant Resend email logic inline
2. Don't fail the verification if the welcome email fails — log the error but return success
3. The welcome email template should include: platform overview, first steps, link to profile setup, help resources
```

#### 7.5 No Bulk User Import
**Problem:** Admin must create users one-by-one via the Users Management page. No CSV upload or batch creation.
**Impact:** Onboarding 50+ org members or a cohort of clients is extremely time-consuming.
**Recommendation:** Add CSV upload in admin panel → validate → bulk create via `create-admin-user` in a loop.

### Signup Flow Summary Diagram

```
PUBLIC ENTRY POINTS:
  /wheel (Wheel of Life) ──→ ac_signup_intents ──→ /auth (signup disabled)
  /auth (login form)     ──→ login or "invitation only" message
  /accept-invite?token=  ──→ org invite acceptance (working)

ADMIN ENTRY POINTS:
  Admin Users Management ──→ create-admin-user ──→ send-welcome-email (manual)
  Admin Org Management   ──→ create org ──→ send-org-invite ──→ /accept-invite

SELF-SIGNUP (when re-enabled):
  /auth signup form
    → signup-user (rate limited, verification email)
    → /verify-signup?token=
    → verify-signup (confirm email, assign client role, transfer placeholders)
    → /auth login form
    → AuthContext (fetch roles, redirect by role)
    → /dashboard (client)
    ⚠ No welcome email
    ⚠ No role selection
    ⚠ No onboarding wizard
```

---

## Part 8: User Behavior Flow Analysis — Can It Actually Work?

### Method
Traced every user journey from login to feature usage, testing each role against the actual implementation. Verified routing, feature gates, data fetching, and UI rendering.

### 8.1 Role-Based Routing — WORKING

| Role | Login → Redirect | Dashboard | Protected By |
|------|-----------------|-----------|-------------|
| Admin | `/admin` | AdminDashboard.tsx | `requireRole="admin"` |
| Org Admin | `/org-admin` | OrgAdminDashboard.tsx | OrgAdminLayout |
| Instructor/Coach | `/teaching` | InstructorCoachDashboard.tsx | Role check in ProtectedRoute |
| Client | `/dashboard` | ClientDashboard.tsx | `requireRole="client"` |

Role switching works via `RoleSwitcher` in sidebar (for users with multiple roles). Saved to localStorage.

### 8.2 Client Journeys — Issues Found

#### JOURNEY A: Brand-New Client (No Enrollments)

```
Login → /dashboard → ClientDashboard.tsx
```

**What they see:** Mostly empty sections — no enrollments, no goals, no decisions, no tasks, no groups, no sessions. Some widgets still render (announcements, development hub, coaches section, weekly reflection card).

**Problem:** No onboarding guidance. No "Browse Programs" call-to-action. No "Getting Started" checklist. User doesn't know what to do next.

**Recommendation:**
```
Add a first-login detection and onboarding card to ClientDashboard.tsx:

1. Detect first login: check if user has 0 enrollments AND 0 goals AND profile.onboarding_completed is false/null
2. Show a prominent "Welcome to InnoTrue" card at the top of the dashboard with:
   - "Complete your profile" → /settings/profile
   - "Browse programs" → /programs/explore
   - "Set your first goal" → /goals
   - "Complete the Wheel of Life" → /wheel-of-life
3. Card dismisses when user completes all steps or clicks "Skip"
4. Track completion in profile.onboarding_completed boolean
```

#### JOURNEY B: Free-Tier Client Wants to Access Paid Program

```
/dashboard → /programs/explore → clicks paid program → PlanLockOverlay
```

**What works:**
- Program browsing shows tier requirements
- `PlanLockBadge` shows lock reason (crown icon for plan required)
- `PlanLockOverlay` shows "Upgrade to [Plan]" with "View Plans" button
- "View Plans" → `/subscription` → Stripe checkout → plan upgrade → program unlocked

**What's broken — Credits circular dependency (CRITICAL):**
- Credits page (`/credits`) is wrapped in `<FeatureGate featureKey="credits">`
- Free plan may not include the `credits` feature
- User who needs credits to purchase a top-up package → navigates to `/credits` → blocked by FeatureGate → sees "Premium Feature" with "Upgrade Plan" button
- **Dead-end:** User needs credits but can't reach the credits page to buy them

**Fix:**
```
In src/pages/client/Credits.tsx, the credit purchase section should NOT be behind a FeatureGate.

Option A (recommended): Split the page into two sections:
1. "My Credit Balance" + "Purchase Top-ups" → always visible to all authenticated users
2. "Credit Usage History" + "Advanced Credit Management" → behind FeatureGate

Option B: Remove FeatureGate from Credits.tsx entirely. Credits are a currency, not a feature.

Also update the sidebar: the "Credits" nav item in AppSidebar.tsx should NOT have a featureKey gate,
or should use a separate "credits_visible" feature that's enabled on all plans.
```

#### JOURNEY C: Client Wants to Express Interest in a Locked Program

```
/programs/explore → paid program → "Express Interest" button → ExpressInterestDialog
```

**What works:**
- Dialog collects timeframe, tier preference, discount code
- Cross-completion detection for discount eligibility
- Submits to backend

**What's broken:**
- After submission, no client-facing status page
- ClientDashboard shows "Pending Registrations" count but no detail view
- Client has no way to check: "Did admin approve my interest? When will I hear back?"

**Fix:**
```
Create a client-facing "My Interest Registrations" section:

1. In ClientDashboard.tsx, expand the "Pending Registrations" card to show:
   - Program name, date submitted, current status (pending/approved/rejected)
   - If approved: "Enroll Now" button
   - If rejected: reason text (optional, from admin notes)

2. Or create a dedicated page: src/pages/client/MyInterestRegistrations.tsx
   - List all interest registrations with status
   - Filter by status
   - Link from dashboard "Pending Registrations" count
```

#### JOURNEY D: Client Books a Coaching Session

```
/dashboard → enrolled program → module (type=session) → ModuleDetail → ModuleSessionDisplay
```

**What works:**
- `ModuleSessionDisplay` renders booking UI when module type is session
- Cal.com booking URL built via `useModuleSchedulingUrl` hook
- Session creation via `ClientSessionForm` component
- Reschedule via `buildCalcomRescheduleUrl`
- Calendar view at `/calendar` shows scheduled sessions

**Verdict:** Session booking flow is **functional** when all prerequisites are met (Cal.com mapping exists, module type is session, enrollment active, not plan-locked).

#### JOURNEY E: Client Requests a Coach

```
/dashboard → "My Coaches" section → RequestCoachInstructorDialog
```

**What works:**
- Dialog shows current assignments (direct + program-level)
- Request form: coach/instructor/both selection + optional message
- Submits to `coach_instructor_requests` table
- Request history with status tracking
- Admin reviews in admin panel

**Verdict:** Coach request flow is **functional**. The dialog is comprehensive.

#### JOURNEY F: Client Takes an Assessment

```
/dashboard → sidebar "Assessments" → My Assessments / Capability / Psychometric
```

**What works:**
- Assessment taking flow works (questions, responses, server-side scoring)
- Results displayed with interpretations (never raw scoring matrix)

**What's gated:**
- Assessment pages behind feature gates (`capabilities`, etc.)
- If feature disabled, user sees "Premium Feature" with upgrade button
- Same circular issue as credits if the feature they need is gated

### 8.3 Instructor/Coach Journeys — WORKING

```
Login → /teaching → InstructorCoachDashboard.tsx
```

**Tabs:** Programs, Modules, Shared Goals, Shared Decisions, Shared Tasks, Sessions, Badges

**Key flows verified:**
- View assigned programs and enrolled students
- Grade pending assignments (`/teaching/pending-assignments`)
- Manage scenarios (`/teaching/scenarios`)
- View student progress (`/teaching/students/:id`)
- Manage groups, sessions, coaching decisions/tasks

**No critical dead-ends found.** Instructor/coach dashboards are comprehensive.

### 8.4 Org Admin Journeys — WORKING (Limited)

```
Login → /org-admin → OrgAdminDashboard.tsx
```

**Available:** Members, Programs, Enrollments, Analytics, Billing, Terms, FAQ

**Issues:**
- Only `org_admin` and `org_manager` roles recognized — `org_member` has no org-level dashboard
- No org-level branding customization
- No org SSO (SAML/OIDC)
- No data export capability

### 8.5 Admin Journeys — FULLY WORKING

40+ management pages, all properly protected. No dead-ends found.

### 8.6 Cross-Role Issues

#### Feature Gate Confusion — ✅ RESOLVED 2026-02-16
**Problem:** When a feature is disabled, `FeatureGate` shows "Upgrade Plan" button. But sometimes the user IS on the highest plan — nothing to upgrade to.
**Resolution:** Added `useIsMaxPlan` hook (backed by `isMaxPlanTier` utility in `planUtils.ts`). When user is on the highest purchasable plan, FeatureGate and CapabilityGate now show "Feature Not Available — Contact your administrator" instead of "Upgrade Plan". Users on lower plans still see the upgrade button. See `docs/ENTITLEMENTS_AND_FEATURE_ACCESS.md`.

#### Locked Sidebar Items — Confusing UX
**Problem:** Sidebar shows locked items with a lock icon and tooltip. Users see features they can't access, creating frustration.

**Options:**
1. **Hide locked items** (less frustration, but users don't know what's available)
2. **Keep showing with clear upgrade path** (current approach, needs better messaging)
3. **Show locked items in a separate "Premium" section** (best of both — clear that it exists, clearly premium)

**Recommendation:** Option 3. Group locked items under a collapsible "Premium Features" section in the sidebar.

#### Empty Dashboard Sections — No Guidance
**Problem:** Multiple dashboard sections render empty with no call-to-action when a user has no data.

**Fix:**
```
For each major dashboard section (enrollments, goals, decisions, tasks, groups, sessions), add an empty state component:

1. Create src/components/EmptyState.tsx:
   - icon, title, description, actionButton (optional)
   - Example: icon=BookOpen, title="No programs yet", description="Browse available programs to get started", action="Explore Programs" → /programs/explore

2. Use in ClientDashboard.tsx for each section when data array is empty
3. Use in InstructorCoachDashboard.tsx for "No assigned students yet" etc.
```

### 8.7 Summary: What Works vs What Doesn't

| Flow | Status | Blocking? | Notes |
|------|--------|-----------|-------|
| Login + role-based redirect | WORKING | No | All roles route correctly |
| Password reset | WORKING | No | Full flow functional |
| Self-signup | DISABLED | Yes (pilot) | Multiple issues for re-enablement (see Part 7) |
| Program browsing | WORKING | No | Filters, tier badges, interest all work |
| Program enrollment (paid) | WORKING | No | Stripe checkout → plan upgrade → enroll |
| Credit purchase | BROKEN | Yes | FeatureGate blocks `/credits` for users who need it most |
| Express interest | PARTIAL | No | Submission works, no status tracking for client |
| Session booking (Cal.com) | WORKING | No | Requires Cal.com mapping + module type |
| Coach request | WORKING | No | Dialog functional, admin reviews |
| Assessments | WORKING | No | Feature-gated but functional when enabled |
| Goals/Decisions/Tasks | WORKING | No | Full CRUD, no gates |
| Wheel of Life | WORKING | No | Public page + logged-in dashboard widget |
| Groups | WORKING | No | Requires instructor invitation |
| Community/Academy | EXTERNAL LINKS | No | Redirect to Circle/TalentLMS |
| Client empty dashboard | POOR UX | No | No onboarding, no CTAs, many empty sections |
| Welcome email (self-signup) | NOT SENT | No | Only manual via admin panel |
| Org admin dashboard | WORKING | No | Limited but functional |

### 8.8 Priority Fix List

| # | Issue | Severity | Effort | Fix |
|---|-------|----------|--------|-----|
| 1 | Credits page FeatureGate blocks self-service | CRITICAL | 1 hour | Remove/split FeatureGate on Credits.tsx |
| 2 | AuthContext role fallback security risk | CRITICAL | 2 hours | Replace default "client" with registration redirect |
| 3 | Empty client dashboard — no onboarding | HIGH | 1 day | Add first-login welcome card with action checklist |
| 4 | Express interest — no status tracking | MEDIUM | 4 hours | Add status view to dashboard |
| 5 | Welcome email not auto-triggered | MEDIUM | 1 hour | Call send-welcome-email from verify-signup |
| 6 | Feature gate messaging for max-plan users | MEDIUM | 2 hours | ✅ RESOLVED — useIsMaxPlan + "Contact administrator" |
| 7 | Locked sidebar items confusing | LOW | 4 hours | Group under "Premium Features" section |
| 8 | Empty state components for all sections | LOW | 1 day | Create reusable EmptyState component |
| 9 | No role selection in self-signup | LOW (pilot) | 1 week | Role selection page + admin approval |
| 10 | No bulk user import | LOW (pilot) | 3 days | CSV upload in admin panel |

---

## Part 9: Capability Assessments, Scenarios, Feedback & Resources — Deep Analysis

### 9.1 Capability Assessment Access Modes

The system supports **three assessment modes** (`capability_assessments.assessment_mode`):

| Mode | Who Assesses | How It Works | Status |
|------|-------------|-------------|--------|
| `self` | Client assesses themselves | Slider rating (1–rating_scale) per question, domain notes | **WORKING** |
| `evaluator` | Instructor/coach assesses the client | Same form, but `is_self_assessment=false`, `evaluator_id` set | **WORKING** |
| `both` | Client + instructor/coach + peers | Separate snapshots, comparison via CapabilityEvolutionChart | **WORKING** |

**All five access paths:**

| Path | Entry Point | Flow | Status |
|------|------------|------|--------|
| **Public (web)** | `/public-assessment/:slug` via `PublicAssessment.tsx` | Unauthenticated, email capture, PDF download, scoring via `compute-assessment-scores` | **WORKING** — separate `assessment_definitions` table |
| **Self-assessment (client)** | `/capabilities/:id` via `CapabilityAssessments.tsx` | Client rates themselves, auto-save drafts, creates `capability_snapshots` | **WORKING** |
| **Module-linked** | Module detail via `ModuleSelfAssessment.tsx` | `program_modules.capability_assessment_id` triggers in-context assessment | **WORKING** — shows "Self ✓" / "Evaluator ✓" badges |
| **Instructor/coach evaluation** | Instructor creates snapshot with `is_self_assessment=false` | Same form, evaluator_id recorded, shared via snapshot sharing | **WORKING** |
| **Peer evaluation** | Group panel via `GroupPeerAssessmentsPanel.tsx` | Configured per group in `group_peer_assessments`, peer selects group member | **WORKING** |

### 9.2 Assessment Architecture — Three Separate Systems

The platform has **three distinct assessment systems** that share some infrastructure but serve different purposes:

| System | Table | Scoring | Visualization | Client Action |
|--------|-------|---------|---------------|---------------|
| **Capability Assessments** | `capability_assessments` | Domain averages from slider ratings (stored in `capability_snapshots`) | Radar + line evolution charts | Rate self / be evaluated / peer review |
| **Self-Assessments (Public)** | `assessment_definitions` | Server-side dimension scoring via `compute-assessment-scores` (option → dimension → interpretation) | Dimension bars + interpretation text | Answer multiple-choice questions, get scored |
| **Psychometric Assessments** | `psychometric_assessments` | ~~None~~ ✅ DP6: Structured scoring via `psychometric_result_schemas` + `psychometric_results` (manual entry with sliders per dimension) | ~~None~~ ✅ DP6: Color-coded bars (green/amber/red) + trend arrows on Development Profile | Upload PDF, share with coach; admin defines dimension schemas; coach/admin enters structured scores |

**Important distinction:**
- `assessment_categories` is shared across all three systems (Personality, Aptitude, Career, Emotional Intelligence, Leadership, Other)
- `assessment_families` is used only by capability assessments
- `assessment_dimensions`, `assessment_option_scores`, `assessment_interpretations` belong to the `assessment_definitions` system (public/self-assessments)
- `capability_domains`, `capability_domain_questions` belong to the `capability_assessments` system

### 9.3 Scoring Architecture — Two Different Engines

**Engine A: Capability Assessment Scoring (client-side aggregation)**
```
capability_snapshots → snapshot_domain_ratings → domain averages
```
- Client or evaluator fills slider ratings per question
- Domain averages calculated from question ratings
- Pass/fail: configurable threshold (overall or per-domain)
- Comparison: radar/line charts across snapshots (self vs evaluator vs peer, over time)
- **No server-side scoring matrix** — ratings are direct (1-N scale)

**Engine B: Assessment Definition Scoring (server-side `compute-assessment-scores`)**
```
assessment_definitions → questions → options → option_scores → dimension_scores → interpretations
```
- Client answers multiple-choice questions
- Server fetches `assessment_option_scores` (never exposed to frontend)
- Sums option scores by dimension
- Evaluates `assessment_interpretations` conditions against dimension scores
- Returns matched interpretation text to client
- **Scoring matrix is confidential** — protects assessment integrity

### 9.4 What's Working Well

1. **Auto-save drafts** — capability assessments save every 3 seconds, clients can resume later
2. **Multi-evaluator comparison** — radar chart overlays self vs instructor vs peer ratings
3. **Evolution tracking** — line chart shows domain score changes over time across all snapshots
4. **Pass/fail flexibility** — configurable per assessment: overall threshold OR all-domains-must-pass
5. **IP protection for scenarios** — context menu disabled, text un-selectable (UI-level only, no watermarking)
6. **Module integration** — assessments render inline in module detail with completion badges
7. **9 resource sources unified** — MyResources.tsx consolidates goals, tasks, reflections, assignments, coach feedback, module content, personalized resources, and shared library

### 9.5 Capability Assessment Issues

#### 9.5.1 No AI-Assisted Evaluation
**Problem:** All evaluator feedback is manual. Instructors write free-text feedback and assign numeric scores with no AI support.
**Impact:** Evaluation is time-consuming (especially for scenarios with many sections). Quality varies by evaluator.
**Recommendation:**
```
Add AI-assisted evaluation to scenario evaluation and capability assessment review:

1. In ScenarioEvaluationPage.tsx, add an "AI Suggest" button next to each paragraph feedback field:
   - Send client response + question context + domain rubric to Vertex AI
   - AI returns: suggested score, feedback draft, strength/weakness highlights
   - Instructor reviews/edits AI suggestions before saving

2. In capability assessment evaluator view, add "AI Compare":
   - Compare client self-rating vs evaluator rating
   - AI generates gap analysis: "Client rated themselves 8/10 on Leadership but evaluator gave 5/10 — significant self-perception gap in [specific questions]"

3. Use existing Vertex AI infrastructure (ai-config.ts)
4. Gate behind AI credit system (existing credit deduction)
```

#### 9.5.2 No Assessment Templates for Common Frameworks
**Problem:** Admins must build every assessment from scratch. No pre-built templates for common competency frameworks.
**Impact:** Setting up a new assessment with domains + questions + scoring takes hours.
**Recommendation:** Create seed assessment templates for common frameworks:
- Leadership Competencies (6 domains, 30 questions)
- Communication Skills (4 domains, 20 questions)
- Project Management (5 domains, 25 questions)
- Emotional Intelligence (4 domains, 20 questions)

#### 9.5.3 Assessment Insights Not Connected to Goals
**Problem:** Assessment results show strengths and weaknesses, but there's no automatic connection to the goals system.
**Impact:** Client takes assessment → sees low score in "Communication" → must manually create a goal. No prompt.
**Recommendation:**
```
After assessment completion (capability or self-assessment), show a "Create Goals" prompt:

1. In CapabilityAssessmentDetail.tsx, after viewing results:
   - Identify lowest-scoring domains (below pass threshold or bottom quartile)
   - Show: "You scored 3.2/5 in Communication. Would you like to set a goal to improve?"
   - Button: "Create Goal" → pre-fills goal with domain name, current score, target score
   - Links goal to assessment via goal.assessment_snapshot_id (new field)

2. For public assessments (assessment_definitions), after compute-assessment-scores:
   - Show: "Based on your results, here are suggested development areas:"
   - List dimensions with low scores + interpretation text
   - If user signs up, carry these into their goal recommendations
```

#### 9.5.4 No Assessment Reminders or Scheduling
**Problem:** No way to schedule recurring assessments (e.g., "retake this assessment every 90 days").
**Impact:** Evolution charts are powerful but depend on clients remembering to retake.
**Recommendation:** Add assessment cadence configuration: admin sets "recommended retake interval" per assessment. System sends notification when interval expires.

### 9.6 Scenario System Issues

#### 9.6.1 Scenario Evaluation is Not Linked to Auto-Scoring
**Problem:** Scenarios link to `capability_assessments` to define domains and questions, but evaluation is 100% manual. The instructor assigns numeric scores per question — there's no auto-computation from assessment scoring rules.
**Impact:** Scoring is inconsistent across evaluators. Same response could get different scores from different instructors.
**Recommendation:**
```
Add scoring rubrics to scenario paragraphs:

1. In admin ScenarioTemplateEditor, for each paragraph's linked questions:
   - Allow admin to define scoring rubric: "Score 5 if response mentions X AND demonstrates Y"
   - Store rubric in paragraph_question_links.rubric_text (new field)

2. In ScenarioEvaluationPage, display rubric alongside each question score input:
   - Instructor sees: "Communication (0-5): [rubric: 'Score 5 if candidate demonstrates active listening AND provides structured feedback']"
   - Helps standardize scoring across evaluators

3. Future: AI auto-suggests scores based on rubric matching (see 9.5.1)
```

#### 9.6.2 No Scenario Peer Review
**Problem:** Scenarios are only evaluated by instructors. No mechanism for peer feedback on scenario responses.
**Impact:** Misses the learning opportunity of peer-to-peer feedback, which is valuable in group cohorts.
**Recommendation:**
```
Add peer review to scenarios:

1. New assignment mode: "peer_review" on scenario_assignments
2. After client submits, randomly assign 2-3 peers from same group/cohort
3. Peers see responses (read-only) and provide feedback (not scores) per paragraph
4. Client sees peer feedback alongside instructor evaluation
5. Peer feedback is unscored (qualitative only) — only instructor scores count
```

#### 9.6.3 No Scenario Re-Submission
**Problem:** Once submitted, scenarios are read-only. Client cannot revise and re-submit after receiving feedback.
**Impact:** Learning loop is broken — client reads feedback but can't demonstrate improvement.
**Recommendation:** Add "Request Revision" button for instructor, which reopens the scenario for client editing. Track revision count.

### 9.7 Feedback System Issues

The platform has **9 distinct feedback mechanisms** (not unified):

| Mechanism | Source → Target | Storage | Status |
|-----------|----------------|---------|--------|
| Scenario evaluation | Instructor → Client (per paragraph + overall) | `paragraph_evaluations`, `scenario_assignments.overall_notes` | **WORKING** |
| Module feedback | Coach/Instructor → Client (per module) | `coach_module_feedback` with templates + attachments | **WORKING** |
| Assignment grading | Instructor → Client (per assignment) | `module_assignments.overall_score/comments` | **WORKING** |
| Assessment interpretations | System → Client (scored) | `assessment_responses.interpretations` | **WORKING** |
| Coach general feedback | Coach → Client | Via module feedback templates | **WORKING** |
| Decision AI insights | AI → Client | `decision-insights` edge function | **WORKING** (AI-gated) |
| Reflection prompts | AI → Client | `generate-reflection-prompt` edge function | **EXISTS** (unclear trigger) |
| Goal feedback | Coach → Client | `goal_comments` table | **WORKING** |
| Session feedback | Post-session | Unclear implementation | **UNCLEAR** |

**Key issue:** No unified feedback inbox. Client must navigate to each feature (assignments, scenarios, modules, goals) to find feedback. No "You have 3 new feedback items" notification aggregation.

**Recommendation:**
```
Create a unified feedback hub:

1. Create src/pages/client/MyFeedback.tsx:
   - Aggregate all feedback across scenarios, modules, assignments, assessments
   - Show chronologically: "Feb 15 — Module 3 feedback from Coach Emily" / "Feb 14 — Scenario evaluation from Instructor John"
   - Mark read/unread
   - Link to source context (jump to specific scenario/module/assignment)

2. Add feedback count badge to sidebar nav item
3. Add "Recent Feedback" widget to ClientDashboard.tsx
```

### 9.8 Resource System Issues

#### 9.8.1 No Resource Recommendations
**Problem:** Clients see a flat list of all resources they can access. No "Recommended for you" based on assessment results, goals, or current module.
**Impact:** Resource library becomes overwhelming as it grows. Clients don't discover relevant resources.
**Recommendation:** Add AI-powered resource recommendations based on assessment scores, current module context, and goal alignment.

#### 9.8.2 Credit-Gated Resources UX
**Problem:** Resources with `is_consumable=true` deduct credits on access. But there's no clear preview of what the resource contains before spending credits.
**Impact:** Users may spend credits on resources that aren't useful to them.
**Recommendation:** Add a resource preview (first page of PDF, video thumbnail, or AI-generated summary) visible before credit deduction.

#### 9.8.3 No Resource Ratings or Feedback
**Problem:** No way for clients to rate or review resources they've accessed.
**Impact:** Admin has no signal on resource quality. Popular/useful resources look the same as poor ones.
**Recommendation:** Add simple 1-5 star rating + optional short review per resource. Show average rating in resource listings.

---

## Part 10: Psychometric Assessments — Current State & Recommendations

### 10.1 Current Implementation

Psychometric assessments are a **completely separate system** from capability assessments. They originally functioned as a **document management catalog** — not as scored or analyzed assessments. **DP6 (2026-02-24) added structured scoring and visualization** — admins define dimension schemas per assessment, coaches/admins enter structured scores, and the Development Profile shows color-coded bars with trend tracking.

**What exists:**

| Feature | Implementation |
|---------|---------------|
| Assessment catalog | `psychometric_assessments` table — name, provider, category, cost, external URL |
| Client browsing | `ExploreAssessments.tsx` — filter by category, search, express interest |
| Interest registration | `assessment_interest_registrations` — pending → contacted → completed/declined |
| Admin management | `AssessmentsManagement.tsx` — CRUD on catalog, manage interest registrations, **define dimension schemas (DP6)** |
| PDF upload | `MyAssessments.tsx` — clients upload result PDFs to `psychometric-assessments` storage bucket |
| Sharing | `user_assessment_shares` — share uploaded PDFs with coaches/instructors |
| Categories | 6 categories: Personality, Aptitude, Career, Emotional Intelligence, Leadership, Other |
| Plan gating | `feature_key` on each assessment — can restrict by subscription plan |
| **Structured scoring (DP6)** | `psychometric_result_schemas` (assessment_id, dimensions JSONB key/label/min/max, version) + `psychometric_results` (user_id, assessment_id, schema_id, scores JSONB, entered_by, assessed_at). Admin defines dimension schemas; coach/admin enters scores via slider+number UI (`PsychometricScoreEntryDialog`) |
| **Visualization (DP6)** | `PsychometricScores` card on Development Profile — color-coded bars (green ≥70%, amber ≥40%, red <40%), trend arrows (↑↓→), grouped by assessment |

**What does NOT exist:**

| Missing Feature | Impact |
|----------------|--------|
| **No in-app psychometric assessment taking** | Clients must go to external site, take assessment, download PDF, upload to platform |
| ~~**No scoring engine**~~ | ✅ DP6 added manual structured scoring (admin defines dimensions, coach enters scores). AI-powered PDF extraction still pending. |
| ~~**No visualization**~~ | ✅ DP6 added color-coded bars + trend arrows on Development Profile |
| **No external API integration** | No connection to DISC, MBTI, Hogan, CliftonStrengths, or any provider API |
| ~~**No comparison**~~ | ✅ DP6 added trend tracking (previous score vs current with arrows). Benchmark comparison still pending. |
| **No AI interpretation** | No AI-powered analysis of uploaded assessment results |
| **No cross-assessment correlation** | No link between psychometric results and capability assessment results |
| **No team/group psychometric view** | Org admins can't see team psychometric profiles (e.g., DISC team wheel) |
| ~~**No client status tracking**~~ | ✅ M2 (2026-02-20) added assessment interest cards with status badges on ClientDashboard |

### 10.2 Recommended Enhancements (Prioritized)

#### Tier 1 — Quick Wins (1-2 weeks each)

**10.2.1 AI-Powered PDF Interpretation**
Parse uploaded psychometric PDFs using AI (Vertex AI) and extract structured data.
```
When client uploads a psychometric PDF:

1. Send PDF text to Vertex AI with prompt:
   "Extract the assessment type, dimension scores, and key findings from this psychometric report"
2. Store extracted data in user_assessments.extracted_data (new JSON field)
3. Display extracted dimensions as bar charts in MyAssessments
4. Show AI-generated summary: "Your DISC profile indicates..."
5. Gate behind AI credits (existing credit system)
```

**10.2.2 Psychometric Result Visualization**
Add basic visualization for uploaded/extracted psychometric results.
```
Create src/components/assessments/PsychometricResultsChart.tsx:

1. Based on extracted_data from PDF parsing, render:
   - Bar chart for dimension scores (e.g., DISC: D=65, I=42, S=78, C=55)
   - Pie chart for type distributions
   - Narrative summary card

2. For assessments without extracted data: show "Upload your results to get visualizations"
3. Reuse existing Recharts library (already used for capability charts)
```

**10.2.3 Interest Registration Status Tracking** — ✅ RESOLVED 2026-02-20
Added assessment interest registration cards to ClientDashboard with status-aware rendering (pending/contacted/completed/declined badges). Also fixed AC interest cards to display actual status instead of hardcoded "Pending".

#### Tier 2 — Medium Effort (2-4 weeks each)

**10.2.4 Built-In Psychometric Assessments**
Build self-service psychometric instruments directly in the platform.
```
Extend the assessment_definitions system to support psychometric-style assessments:

1. Add assessment_type field to assessment_definitions: 'self_assessment' | 'psychometric'
2. Psychometric assessments use:
   - Forced-choice questions (pick A or B, not rate 1-5)
   - Dimension scoring via option_scores (already exists)
   - Profile-based interpretations (already exists via assessment_interpretations)

3. Create psychometric-specific question types:
   - Likert scale (Strongly Disagree → Strongly Agree)
   - Forced choice (A vs B)
   - Ranking (order items 1-N)
   - Situational judgment (scenario → best/worst response)

4. Build well-known free framework clones:
   - Big Five (OCEAN) — public domain, 50 questions
   - VIA Character Strengths — Creative Commons, 120 questions
   - Emotional Intelligence (basic) — 30 questions
   - Leadership Style — 40 questions

5. These use compute-assessment-scores for server-side scoring
6. Results show dimension charts + interpretation text
```

**10.2.5 Cross-Assessment Correlation Dashboard**
Connect psychometric results with capability assessment results.
```
Create src/pages/client/AssessmentInsights.tsx:

1. Aggregate all assessment data:
   - Capability snapshots (domain scores)
   - Psychometric results (extracted dimensions)
   - Self-assessment responses (dimension scores)

2. Show correlation matrix:
   - "Your DISC 'Dominance' score correlates with high ratings in 'Leadership' capability domain"
   - "Your low 'Emotional Intelligence' psychometric score aligns with improvement area in 'Communication' capability domain"

3. AI-powered insight generation:
   - Send all assessment data to Vertex AI
   - Generate: "Based on your combined assessment profile, your key development areas are..."
   - Suggest specific programs/modules/goals

4. Update recommendations engine to use psychometric data
```

**10.2.6 Team Psychometric View (for Org Admins)**
Let org admins see team psychometric profiles for team-building.
```
Create src/pages/org-admin/TeamPsychometrics.tsx:

1. Aggregate consented member psychometric data (respects sharing_consent)
2. Visualize team composition:
   - DISC team wheel (how many D/I/S/C types)
   - Strengths distribution (most/least common strengths)
   - Development area heatmap

3. Show team balance recommendations:
   - "Your team is heavy on 'Influence' types but lacks 'Conscientiousness' — consider this in hiring"
   - "3 team members share the development area 'Strategic Thinking' — consider a group workshop"

4. Export team profile as PDF for stakeholders
```

#### Tier 3 — Strategic (1-3 months)

**10.2.7 External Psychometric Provider APIs**
Integrate directly with psychometric assessment providers.

| Provider | Integration Type | Cost | Effort |
|----------|-----------------|------|--------|
| **DISC (TTI Success)** | REST API — send email invite, receive scores | Per-assessment license | 2-3 weeks |
| **CliftonStrengths (Gallup)** | No public API — PDF upload only | $24.99/assessment | N/A |
| **Hogan** | Enterprise API — requires partnership | Negotiated | 1-2 months |
| **VIA Character Strengths** | Free API available | Free | 1-2 weeks |
| **16Personalities (MBTI-like)** | No public API — scraping not recommended | Free for users | N/A |

**Recommended first integration:** VIA Character Strengths (free, API available, widely respected).

**10.2.8 Adaptive Psychometric Assessments**
Build assessments that adapt question difficulty based on responses (Item Response Theory).
```
This is advanced but differentiating:

1. Use IRT (Item Response Theory) to build adaptive assessments
2. Each question has calibrated difficulty and discrimination parameters
3. After each response, system selects the next optimal question
4. Converges to accurate score in fewer questions (30 instead of 100)
5. Better user experience (shorter, more engaging) + more accurate results

Implementation: Edge function running IRT algorithm, question bank with calibrated parameters.
This is a competitive differentiator — most coaching platforms don't offer adaptive assessments.
```

### 10.3 Psychometric Assessment Priority Matrix

| # | Enhancement | Effort | Impact | Dependencies |
|---|------------|--------|--------|-------------|
| 1 | Interest status tracking for clients | 4 hours | MEDIUM | None |
| 2 | AI PDF interpretation | 1 week | HIGH | Vertex AI (already configured) |
| 3 | Basic result visualization (bar/pie charts) | 3 days | MEDIUM | Extracted data from #2 |
| 4 | Built-in Big Five / VIA assessments | 2-3 weeks | HIGH | Extend assessment_definitions |
| 5 | Cross-assessment correlation dashboard | 2 weeks | HIGH | Data from #2 and #4 |
| 6 | Team psychometric view for orgs | 2 weeks | MEDIUM | Member consent + data from #2 |
| 7 | VIA Character Strengths API integration | 1-2 weeks | MEDIUM | API partnership |
| 8 | Adaptive assessments (IRT) | 2-3 months | HIGH (differentiator) | Research + calibration |

### 10.4 Combined Assessment System Vision

The long-term goal should be a **unified assessment intelligence layer**:

```
┌─────────────────────────────────────────────────┐
│              Assessment Intelligence             │
│                                                   │
│  Capability ──┐                                   │
│  Assessments  │                                   │
│               ├─→ Unified Profile ──→ AI Insights │
│  Psychometric │      │                            │
│  Assessments  │      ├─→ Goal Recommendations     │
│               │      ├─→ Program Matching          │
│  Self-        │      ├─→ Coach Matching            │
│  Assessments ─┘      ├─→ Team Composition          │
│                      └─→ Evolution Tracking        │
│                                                   │
│  Scenario ──→ Scores feed into capability profile │
│  Evaluations                                      │
│                                                   │
│  Assignment ──→ Scores feed into capability       │
│  Grading        profile (via scoring_assessment)  │
└─────────────────────────────────────────────────┘
```

All assessment data (capability, psychometric, self-assessment, scenario scores, assignment scores) should feed into a **single client intelligence profile** that drives:
- Personalized program recommendations
- Coach/instructor matching based on development areas
- Goal suggestions based on lowest-scoring domains
- Team composition insights for org admins
- AI-powered development planning

---

## Part 11: Consolidated Recommendations & Priority Roadmap

This section synthesizes all findings from Parts 1–10 into a single prioritized action plan.

### 11.1 Critical Fixes (Must Fix — Blocking Users)

| # | Issue | Source | Effort | Description |
|---|-------|--------|--------|-------------|
| ~~C1~~ | ~~Credits page FeatureGate blocks self-service~~ — **RESOLVED 2026-02-15** | Part 8 (8.2B) | ~~1 hour~~ | Removed FeatureGate wrapper from Credits.tsx — credits is universal across all plans |
| ~~C2~~ | ~~AuthContext role fallback~~ — **RESOLVED 2026-02-15** | Part 7 (7.1), Part 1 (1.15) | ~~2 hours~~ | Removed silent "client" fallback. Added `authError` state + error/no-roles UI in ProtectedRoute |
| ~~C3~~ | ~~Credit loss on failed enrollment~~ — **RESOLVED 2026-02-15** | Part 1 (1.1) | ~~1 day~~ | Created atomic `enroll_with_credits` RPC. Also fixed M6 (`FOR UPDATE SKIP LOCKED`) |
| ~~C4~~ | ~~Cal.com orphaned bookings on DB failure~~ — **RESOLVED 2026-02-16** | Part 1 (1.2) | ~~4 hours~~ | Auto-cancel Cal.com booking on DB failure (both calcom-create-booking and calcom-webhook). Added BOOKING_CANCELLED handler for two-way sync. |

### 11.2 High Priority (Fix Before Wider Pilot)

| # | Issue | Source | Effort | Description |
|---|-------|--------|--------|-------------|
| ~~H1~~ | ~~Empty client dashboard — no onboarding~~ — **RESOLVED 2026-02-16, updated 2026-02-17** | Part 8 (8.2A) | ~~1 day~~ | Initially added OnboardingWelcomeCard with 4-step checklist. **Updated:** Fixed 404 (`/account-settings` → `/account`). Consolidated OnboardingWelcomeCard into JourneyProgressWidget to eliminate semantic overlap — single unified "Your Growth Journey" widget with 8 steps (Profile → Assess → Set Goals → Enroll → Decide → Act → Reflect → Review), dismissible welcome greeting for new users, and premium feature gating. |
| ~~H2~~ | ~~File upload validation inconsistent~~ — **RESOLVED 2026-02-16** | Part 1 (1.3) | ~~4 hours~~ | Created shared `fileValidation.ts` with bucket-specific presets. Applied to all 13 upload interfaces. |
| ~~H3~~ | ~~AI functions accept unlimited input~~ — **RESOLVED 2026-02-16** | Part 1 (1.4) | ~~4 hours~~ | Created `ai-input-limits.ts` with truncation helpers. Applied to 3 AI edge functions. |
| ~~H4~~ | ~~Welcome email not auto-triggered~~ — **RESOLVED 2026-02-15** | Part 7 (7.4) | ~~1 hour~~ | verify-signup now triggers send-welcome-email (non-blocking, service role auth) |
| ~~H5~~ | ~~Express interest — no status tracking~~ — **RESOLVED 2026-02-16** | Part 8 (8.2C) | ~~4 hours~~ | Added "My Interest Registrations" section to ClientDashboard with color-coded status badges (pending/contacted/enrolled/declined). Fetches both program_interest_registrations and ac_interest_registrations. |
| H6 | Feature gate messaging for max-plan users | Part 8 (8.6) | 2 hours | ✅ RESOLVED 2026-02-16 — useIsMaxPlan hook, "Contact administrator" messaging |
| ~~H7~~ | ~~N+1 query in module progress~~ — **RESOLVED 2026-02-15** | Part 1 (1.5) | ~~1 hour~~ | Replaced per-module progress queries with single batched `.in()` query |
| ~~H8~~ | ~~Assignment grading lacks status guard~~ — **RESOLVED 2026-02-15** | Part 1 (1.6) | ~~1 hour~~ | Added status guard: grading only allowed when assignment is "submitted" |
| ~~H9~~ | ~~Edge function error handling inconsistent~~ — **RESOLVED 2026-02-17** | Part 1 (1.11) | ~~1 day~~ | 60/61 functions now use shared errorResponse/successResponse (oauth-callback excluded: HTML only) |
| H10 | Entitlement org deny override not supported | Part 1 (1.10) | 4 hours | ✅ RESOLVED 2026-02-16 — is_restrictive flag, deny override in useEntitlements |

### 11.3 Medium Priority (Improve Experience)

| # | Issue | Source | Effort | Description |
|---|-------|--------|--------|-------------|
| ~~M1~~ | ~~No unified feedback inbox~~ — **RESOLVED 2026-02-16** | Part 9 (9.7) | ~~1 week~~ | Created `MyFeedback.tsx` with tabbed UI aggregating feedback from scenarios, modules, assignments, and goal comments. Hook `useFeedbackInbox.ts` fetches from 4 sources in parallel. Route at `/feedback`. |
| ~~M2~~ | ~~Psychometric interest status tracking~~ — **RESOLVED 2026-02-20** | Part 10 (10.2.3) | ~~4 hours~~ | Added assessment interest cards to ClientDashboard with status badges (pending/contacted/completed/declined). Also fixed AC interest cards to show actual status instead of hardcoded "Pending". |
| ~~M3~~ | ~~Scenario evaluation has no rubrics~~ — **RESOLVED 2026-02-16** | Part 9 (9.6.1) | ~~3 days~~ | Added `rubric_text` column to `paragraph_question_links`. Admin can create/edit rubrics in ScenarioTemplateDetail. Instructors see rubrics during evaluation for scoring guidance. |
| ~~M4~~ | ~~No assessment → goal connection~~ — **RESOLVED 2026-02-17** | Part 9 (9.5.3) | ~~3 days~~ | Added "Suggested Goals" section to CapabilitySnapshotView for both self and evaluator assessments. Uses assessment's `pass_fail_threshold` for pass/fail assessments; bottom 2 domains for non-pass/fail. "Create Goal" button navigates to Goals page with pre-filled title/description via URL params. GoalForm accepts `defaultTitle`/`defaultDescription` props. |
| ~~M5~~ | ~~No scenario re-submission~~ — **RESOLVED 2026-02-17** | Part 9 (9.6.3) | ~~2 days~~ | Added `allows_resubmission` template toggle, "Request Revision" button on evaluation page, new attempt model with `parent_assignment_id` + `attempt_number`, response pre-copying, revision banners on client pages |
| ~~M6~~ | ~~Credit balance race condition~~ — **RESOLVED 2026-02-15** | Part 1 (1.9) | ~~4 hours~~ | Added `FOR UPDATE SKIP LOCKED` to `consume_credits_fifo` (fixed with C3) |
| ~~M7~~ | ~~Empty state components~~ — **RESOLVED 2026-02-17** | Part 8 (8.6) | ~~2 hours~~ | Reusable `EmptyState` component (`empty-state.tsx`) with icon + title + description + optional CTA. Applied across all dashboard widgets: ClientDashboard, InstructorCoachDashboard, 19 admin pages, MyGroupsSection, AnnouncementsWidget, RecentGradedAssignmentsWidget, MyCoachesSection. RecentDevelopmentItemsWidget already had a custom empty state with CTA. |
| ~~M8~~ | ~~Locked sidebar items confusing UX~~ — **RESOLVED (already implemented)** | Part 8 (8.6) | ~~4 hours~~ | Lock icon + tooltip + toast with plan name already in place. Items stay in natural position. |
| ~~M9~~ | ~~Notification sending is synchronous~~ — **RESOLVED 2026-02-18** | Part 1 (1.8) | ~~1 day~~ | Refactored `notify-assignment-submitted` and `notify-assignment-graded` to async delivery via `create_notification` RPC (non-blocking). Email queue (`process-email-queue`) already handles batch sending. |
| ~~M10~~ | ~~Dual plans admin UX confusion~~ — **RESOLVED 2026-02-17** | Part 1 (1.12) | ~~2 hours~~ | Added info banners to both plan pages with cross-links explaining when to use each |
| ~~M11~~ | ~~Console statements in production~~ — **RESOLVED 2026-02-20** | Part 1 (1.7) | ~~4 hours~~ | Removed 49 console.log/warn from 20 files. Kept console.error, web vitals, error boundary, and critical warnings. |
| M12 | No resource ratings or feedback | Part 9 (9.8.3) | 3 days | No quality signal on resources. Add 1-5 star rating |
| M13 | No Zod form validation | Part 1 (1.13) | 1-2 weeks | Forms use manual validation. Adopt Zod starting with critical forms |
| M14 | Loading/error states inconsistent | Part 1 (1.14) | 1 week | ✅ RESOLVED 2026-02-16 — PageLoadingState + ErrorState components, 5 pages migrated |
| ~~M15~~ | ~~Credit-gated resources have no preview~~ — **RESOLVED 2026-02-17** | Part 9 (9.8.2) | ~~3 days~~ | Added `ResourceUnlockDialog` with credit cost, balance, and remaining display. MyResources intercepts view/download for consumable shared_library resources. Enrollment exemption: resources linked to user's enrolled programs (via `resource_library_programs`) are free. Credit cost badge shown on resource cards. |
| M16 | No assessment templates for common frameworks | Part 9 (9.5.2) | 1 week | Admins build every assessment from scratch. Create seed templates (Leadership, EI, etc.) |
| ~~M17~~ | ~~Development items ↔ tasks/groups linking UI~~ — **RESOLVED 2026-02-17** | DB schema | ~~3 days~~ | Added task/group selectors to DevelopmentItemDialog (works in both client and instructor mode). DevelopmentItems page query extended to include `task_links` and `group_links` with badges. Edge function `create-client-development-item` updated to handle `taskId`/`groupId` params. |

### 11.4 Enhancement Roadmap (Post-Fixes)

Organized by theme, drawing from Parts 2, 3, 5, 6, 9, and 10.

> **Updated 2026-02-18:** Added Priority 0 items (content delivery + cohort readiness + coach onboarding + assignment routing) that should be done before or alongside Phase 5. These are pre-requisites for running live/hybrid cohort programs, onboarding instructors/coaches, and multi-instructor assignment workflows.

#### Priority 0 — Content Delivery & Cohort Readiness (HIGH — do before next cohort program)

**Content Delivery (eliminate TalentLMS friction):**
- ~~Tier 1: Rise Web export → Supabase Storage → iframe embed~~ ✅ DONE (2026-02-18) — private storage bucket + `serve-content-package` auth-gated proxy + `upload-content-package` ZIP extraction + iframe embed in client/instructor ModuleDetail
- ~~Tier 2: Rise xAPI export → xAPI session management + statement storage → auto-complete modules~~ ✅ DONE (2026-02-22) — `xapi-launch` (session create/resume), `xapi-statements` (LRS endpoint + state persistence), `ContentPackageViewer.tsx` LMS mock with resume support (bookmark + suspend_data). 2 migrations, 3 edge functions, deployed to prod + preprod.
- ~~CT3: Shared Content Packages & Cross-Program Completion~~ ✅ DONE (2026-02-20) — 1 migration (`20260224100000_ct3_shared_content_packages.sql`), `content_packages` + `content_completions` tables, `program_modules.content_package_id` FK. 4 edge functions modified (upload/serve/xapi-launch/xapi-statements), new Content Library admin page (`/admin/content-library`), ModuleForm two-tab library picker, `useCrossProgramCompletion` extended with content_completions, client auto-accept on module load, CanonicalCodes page extended with content packages tab. Deployed to all 3 environments.
- TalentLMS transition: keep for active programs, no new programs on TalentLMS

**Cohort Experience (required for live/hybrid programs):**
- ~~`CohortDashboard.tsx`~~ ✅ DONE (2026-02-18) — schedule timeline, next session highlight, ICS download, module progress, group section
- ~~Join Session one-click~~ ✅ DONE (2026-02-18) — `useSessionTimeStatus` hook (30s reactive), CohortSessionCard + GroupSessionCard enhanced, Next Session widget on ClientDashboard
- ~~Session Notes / Recap~~ ✅ DONE (G7, 2026-02-19) — `recording_url`, `summary`, `action_items` on `cohort_sessions`
- ~~Auto cohort enrollment~~ ✅ DONE (G8, 2026-02-25) — `enrollment_codes.cohort_id` FK to `program_cohorts`, passed to `enroll_with_credits` during code redemption
- ~~Cohort analytics~~ ✅ DONE (G9, 2026-02-23) — `CohortAnalytics.tsx` admin dashboard with at-risk detection
- ~~Session-linked homework~~ ✅ DONE (G10, 2026-02-23) — `cohort_session_id` FK on `development_items`, `SessionHomework.tsx`

**Cohort Scheduling Gaps (identified 2026-02-18 — see `docs/COHORT_SCHEDULING_ANALYSIS.md`):**
- ~~G1: **Cohort assignment UI on enrollment**~~ ✅ DONE (2026-02-19) — `enroll_with_credits` RPC accepts `p_cohort_id`, cohort dropdown on enrollment form
- ~~G2: **Google Meet link automation**~~ ✅ DONE (2026-02-19) — auto-generates Meet link via `google-calendar-create-event` pattern
- ~~G3: **Instructor on cohort/session**~~ ✅ DONE (2026-02-19) — `program_cohorts.lead_instructor_id` + `cohort_sessions.instructor_id`, admin UI dropdowns
- ~~G4: **Attendance tracking**~~ ✅ DONE (2026-02-19) — `cohort_session_attendance` table, `AttendanceTracker.tsx` component, instructor/coach can mark
- ~~G5: **Recurring session generation**~~ ✅ DONE (2026-02-19) — "Generate Sessions" bulk action on cohort management
- ~~G6: **Session notifications/reminders**~~ ✅ DONE (2026-02-19) — `send-session-reminder` edge function, 24h + 1h before, `create_notification` RPC
- ~~G7: **Session notes/recap**~~ ✅ DONE (2026-02-19) — `recording_url`, `summary`, `action_items` on `cohort_sessions`, recap section
- ~~GT1: **Instructor/Coach Cohort Teaching Workflow**~~ ✅ DONE (2026-02-23) — RLS fixes (4 policies), `/teaching/cohorts` list page, `/teaching/cohorts/:cohortId` detail page (attendance + recap + homework), dashboard cohort sessions widget, StudentDetail cohort card. 3 new files, 4 modified, 1 migration.
- ~~G8: **Enrollment codes**~~ ✅ DONE (2026-02-25) — `enrollment_codes` table (program_id, cohort_id, code, code_type, max_uses, grants_tier, is_free, discount_percent, expires_at), `validate_enrollment_code` RPC, `redeem-enrollment-code` edge function, admin `EnrollmentCodesManagement.tsx` with quick generator + CRUD, public `EnrollWithCode.tsx` page at `/enroll?code=`. Free codes only for G8 scope; paid enrollment via code deferred.
- ~~G9: **Cohort analytics**~~ ✅ DONE (2026-02-23) — `CohortAnalytics.tsx` admin dashboard with attendance %, completion %, at-risk detection (<60% attendance or <30% completion)
- ~~G10: **Session-linked homework**~~ ✅ DONE (2026-02-23) — `cohort_session_id` FK on `development_items`, `SessionHomework.tsx` component for bulk assignment per session

**Existing cohort infrastructure (already built):**
- ✅ `program_cohorts` with status, capacity, dates
- ✅ `cohort_sessions` with date, time, timezone, meeting link, module link
- ✅ `ProgramCohortsManager` admin UI (full CRUD, session management, drag-and-drop reorder)
- ✅ `CohortDashboard` client view (schedule, next session, ICS, progress, groups)
- ✅ `CohortSessionCard` (time-aware status, pulsing join, ICS download)
- ✅ Calendar integration (cohort sessions on client Calendar, click → CohortDashboard)
- ✅ ClientDashboard "Next Live Session" widget
- ✅ Groups with memberships, tasks, check-ins, notes, peer assessments
- ✅ Cal.com (for module_sessions) + Google Calendar (for group_sessions) + ICS generation
- Note: Cal.com and Google Calendar integrations do NOT currently touch cohort_sessions (manual links only)

**Coach & Instructor Onboarding (required before onboarding new coaches):**
- ~~Welcome card + onboarding checklist~~ ✅ DONE (2026-02-18) — `StaffWelcomeCard` with 4-step checklist on teaching dashboard
- ~~Coach profile setup~~ ✅ DONE (2026-02-18) — bio, specializations, company fields in Account Settings
- ~~Enhanced empty states~~ ✅ DONE (2026-02-18) — contextual "what to expect" on teaching pages
- ~~Role-specific welcome email~~ ✅ DONE (2026-02-18) — instructor/coach/client variants in `send-welcome-email`
- ~~Coach-created development items~~ ✅ DONE (2026-02-18) — "+" button per module in StudentDetail
- Teaching FAQ / quick guide page (1-2 days) — nice to have

**Instructor/Coach Assignment & Grading Routing (required for multi-instructor programs):**
- ~~Remove individualized-only filter~~ ✅ DONE (2026-02-18) — `EnrollmentModuleStaffManager` shows ALL modules
- ~~"My Queue" filtering~~ ✅ DONE (2026-02-18) — PendingAssignments filters by `enrollment_module_staff`
- ~~Assignment transfer/reassignment~~ ✅ DONE (2026-02-18) — `TransferAssignmentDialog` component
- ~~Async notification delivery~~ ✅ DONE (2026-02-18) — `notify-assignment-submitted` and `notify-assignment-graded` now use `create_notification` RPC (non-blocking)
- ~~Configurable notification routing~~ ✅ DONE (2026-02-23) — `notify-assignment-submitted` checks `enrollment_module_staff` first (personal instructor priority), falls back to broadcast
- ~~Fix `assessor_id` / add designated grader~~ ✅ DONE (2026-02-23) — reviewed: `assessor_id` correctly tracks assessment creator, `scored_by` tracks grader. No changes needed.
- ~~Client-facing instructor display~~ ✅ DONE (2026-02-23) — `ModuleTeamContact` checks `enrollment_module_staff`, shows personal instructor with highlighted styling + "Your Instructor/Coach" badge
- ✅ Session scheduling already enrollment-aware: `useModuleSchedulingUrl` resolves Cal.com booking URLs using 3-tier hierarchy

**Existing coach/instructor infrastructure (all built):**
- ✅ Admin user creation with role assignment and welcome email
- ✅ Teaching dashboard with stats, assignments, sessions, shared client items + **Staff Welcome Card**
- ✅ **Staff profile setup** (bio, specializations, company) in Account Settings
- ✅ Client progress tracking with full student detail (notes, reflections, feedback, assignments)
- ✅ Assignment grading (search, filter, rubric, status guard) + **My Queue filtering** + **transfer dialog**
- ✅ Scenario evaluation (section-by-section, revision requests)
- ✅ Badge approval (batch + individual, credential URLs)
- ✅ Capability assessments (view shared + evaluate)
- ✅ Group management (sessions, tasks, check-ins, peer assessments)
- ✅ 10 sidebar nav items for teaching workflows
- ✅ Program/module-level instructor and coach assignment
- ✅ Enrollment-level (per-client) instructor/coach assignment for all modules
- ✅ Three-tier staff resolution: enrollment → module → program level
- ✅ 25+ notification types with email queue + **async delivery via RPC**

**Development Profile & Assessment-Driven Guided Paths (approved 2026-02-18 — see `docs/DEVELOPMENT_PROFILE_ANALYSIS.md`):**

Connects 3 assessment systems + development items + goals + guided paths into a unified development journey. 7 phases, 6 new tables, ~3-4 weeks total. Prioritised for immediate development — high value for CTA preparation clients.

- ~~DP1: **Assessment ↔ Goal traceability**~~ ✅ DONE (2026-02-19) — `goal_assessment_links` table, GoalForm linked assessment section, GoalCard badge, GoalDetail score history
- ~~DP2: **Development Profile page**~~ ✅ DONE (2026-02-19) — 5-section unified page (StrengthsGapsMatrix, ActiveDevelopmentItems, AssessmentGoalProgress, SkillsEarned, GuidedPathProgress) + coach/instructor/admin view
- ~~DP3: **Assessment-gated milestones**~~ ✅ DONE (2026-02-19) — `guided_path_milestone_gates` + `milestone_gate_overrides`, traffic-light indicators (🟢🟡🔴⚪), coach/instructor waive with reason, admin gate config on template milestones
- ~~DP4: **Intake-driven path recommendation**~~ ✅ DONE (2026-02-19) — `guided_path_instantiations` table, shared `instantiateTemplate()` service, PathConfirmation with pace selector, survey wizard bug fixed, GuidedPathDetail refactored
- ~~DP5: **Module ↔ domain mapping**~~ ✅ DONE (2026-02-23) — `module_domain_mappings` table, `ModuleDomainMapper` admin component, "Domains" tab in module editor
- ~~DP6: **Psychometric structured results**~~ ✅ DONE (2026-02-24) — `psychometric_result_schemas` + `psychometric_results` tables, admin dimension schema UI (key/label/min/max), PsychometricScoreEntryDialog with sliders, PsychometricScores card on Development Profile with color-coded bars and trend arrows
- ~~DP7: **Readiness dashboard**~~ ✅ DONE (2026-02-24) — Coach ReadinessDashboard at `/teaching/readiness` with stats cards + sortable client table (alert levels: green/amber/red/stalled), MyReadiness client widget on Development Profile with per-path gate status breakdown, sidebar nav link added
- ~~**Known bug:** `GuidedPathSurveyWizard` saves survey response + `selected_template_ids` but never instantiates template into real goals/milestones.~~ ✅ Fixed in DP4 (2026-02-19).
- **Key design decisions:** Gates advisory not blocking (coach override), intake-driven recommendation not backward planning (clients set unrealistic timelines), manual-first for psychometrics (AI parsing deferred), strengths matter too (not just gap-filling).

#### Phase 1 — Onboarding & UX Polish (2-3 weeks)
- Client onboarding wizard with persistent checklist (Part 5)
- Coach/instructor first-login guided flow (Part 5)
- Organization onboarding wizard (Part 5)
- Enhanced welcome emails — platform overview, first steps, help resources (Part 5)
- Dark mode (Part 6, §6.7)
- Cmd+K command palette (Part 6, §6.7)
- Reusable EmptyState component across all sections (Part 8)
- Standardize skeleton loaders / loading states (Part 1, §1.14)

#### Phase 2 — Assessment Intelligence (3-4 weeks)
- AI-powered PDF interpretation for psychometric results (Part 10, §10.2.1)
- Psychometric result visualization (bar/pie charts from extracted data) (Part 10, §10.2.2)
- Assessment insights → goal recommendations (Part 9, §9.5.3)
- Assessment reminders / scheduling (Part 9, §9.5.4)
- Built-in Big Five / VIA assessments using assessment_definitions (Part 10, §10.2.4)
- Cross-assessment correlation dashboard (Part 10, §10.2.5)
- Seed assessment templates for common frameworks — Leadership, Communication, PM, EI (Part 9, §9.5.2)

#### Phase 3 — AI & Engagement (3-4 weeks)
- AI-assisted scenario/assessment evaluation (Part 9, §9.5.1)
- AI coaching copilot — session prep, progress summary, learning path (Part 3, §3.1)
- AI resource recommendations based on assessments + goals (Part 9, §9.8.1)
- AI-powered program recommendations based on assessment results + goals (Part 5)
- Engagement streaks + XP system (Part 6, §6.4)
- Activity feed + peer reactions (Part 6, §6.3)
- Push notifications with deep links (Part 6, §6.8)
- Smart notification timing — ML-driven send times based on user activity patterns (Part 3, §3.9)

#### Phase 4 — Peer & Social (2-3 weeks)
- Scenario peer review (Part 9, §9.6.2)
- Peer learning network with auto-matching (Part 3, §3.3)
- Cohort chat / discussion threads (Part 6, §6.3)
- Team psychometric view for org admins (Part 10, §10.2.6)
- Coach/client specialization matching algorithm (Part 5)

#### Phase 5 — Self-Registration & Scale (2-3 weeks)
- Re-enable self-signup with AuthContext fix (Part 7, §7.1)
- Role selection during signup with admin approval for privileged roles (Part 7, §7.2)
- Bulk user import via CSV (Part 7, §7.5)
- Wheel of Life → signup pipeline fix (Part 7, §7.3)
- Coach self-registration application form with verification workflow (Part 5)
- Org self-service creation with trial/demo mode (Part 5)
- Coach availability integration via Cal.com (Part 5)

#### Phase 6 — Enterprise & Analytics (4-6 weeks)
- Organization ROI dashboard (Part 3, §3.4)
- Progress analytics with predictive insights (Part 3, §3.2)
- Coach performance dashboard — session count, ratings, client progress, NPS (Part 5)
- Org SSO (SAML/OIDC) (Part 5)
- White-label / custom branding per org (Part 3, §3.7)
- Export & reporting — PDF assessments, CSV analytics, coaching journey summaries (Part 3, §3.10)
- Org seat management warnings — low-seat-count notifications (Part 5)
- Org welcome email on creation (Part 5)
- Org health dashboard — engagement scores, completion heatmaps (Part 5)

#### Phase 7 — Mobile & Modern UX (2-3 weeks)
- Mobile-first PWA enhancements — bottom nav, swipeable cards, quick actions (Part 3, §3.6; Part 6, §6.1)
- Voice input for reflections (Part 6, §6.5)
- Flexible pacing — self-paced vs cohort-paced toggle per enrollment (Part 6, §6.6)
- Choose-your-adventure module ordering within programs (Part 6, §6.6)

#### Phase 8 — Integration Deepening (3-4 weeks)
- Circle community: embed feed/discussions in Hub (Part 2)
- TalentLMS: show courses in Hub, track progress visually (Part 2)
- Slack/Teams integration — daily nudges, session reminders, goal check-ins (Part 6, §6.8)
- Calendar UX: one-click "Add all sessions to my calendar" (Part 6, §6.8)

#### Phase 9 — Strategic Differentiators (3+ months)
- External psychometric provider APIs — VIA first (Part 10, §10.2.7)
- Adaptive assessments using IRT (Part 10, §10.2.8)
- Integrated video for sessions with AI transcripts (Part 3, §3.8)
- Marketplace for coaching content (Part 3, §3.11)
- Micro-learning module type — 2-5 min videos + spaced repetition (Part 6, §6.2)
- Org program customization — org-specific program variants (Part 5)

### 11.5 Dependency Map

```
Priority 0 (Content Delivery): ✅ ALL DONE
  ~~Tier 1 (Web embed)~~ ✅ DONE (2026-02-18)
  ~~Tier 2 (xAPI)~~ ✅ DONE (2026-02-22) — xapi-launch + xapi-statements + LMS mock + resume
  xAPI data → feeds Phase 3 AI Learning Companion (optional but high value)

Priority 0 (Cohort Readiness):
  CohortDashboard → needs program_cohorts + cohort_sessions (exist)
  Join Session one-click → needs session_participants + meeting URLs (exist)
  Session Notes → extends cohort_sessions (minor schema addition)
  ~~Auto cohort enrollment~~ ✅ DONE (G8) — enrollment_codes with cohort_id

Priority 0 (Assignment Routing):
  ~~Remove individualized filter~~ ✅ DONE (2026-02-18) — frontend-only change in EnrollmentModuleStaffManager.tsx
  Configurable notification routing → modifies notify-assignment-submitted edge function, uses enrollment_module_staff (exists) — nice to have (broadcast useful for now)
  "My Queue" filtering → modifies PendingAssignments.tsx, uses enrollment_module_staff (exists)
  Assignment transfer → needs module_assignments.assigned_grader_id (new column)
  Session scheduling → ✅ Already enrollment-aware via useModuleSchedulingUrl hook (no work needed)
  Remaining 3 items are independent — can be done in parallel

C1 (Credits FeatureGate) ← no dependencies, standalone fix
C2 (AuthContext fallback) ← must fix before: Phase 5 (self-signup re-enable)
C3 (Enrollment atomicity) ← no dependencies
C4 (Cal.com idempotency) ← no dependencies

H1 (Onboarding card) ← no dependencies, enables Phase 1 onboarding
H4 (Welcome email) ← no dependencies
H9 (Error handling) ← no dependencies, improves all edge functions
H10 (Org deny) ← no dependencies, fix before Phase 6 (enterprise)

Phase 1 (Onboarding/UX):
  Onboarding wizards → no dependencies
  Dark mode → needs theme system (new)
  EmptyState component → no dependencies

Phase 2 (Assessment Intelligence):
  AI PDF interpretation → Result visualization → Cross-assessment dashboard
  Built-in psychometric assessments → uses existing assessment_definitions + compute-assessment-scores
  Assessment → Goal connection ← no dependencies
  Seed templates → needs capability_assessments structure (exists)

Phase 3 (AI & Engagement):
  AI evaluation → uses existing Vertex AI + credit system
  Program recommendations → needs assessment data (Phase 2 helps but not required)
  Streaks/XP → extends existing badge system
  Smart notifications → needs user activity history (exists)

Phase 4 (Peer & Social):
  Scenario peer review → needs scenario system (exists)
  Coach matching → needs specialization tags (new table)

Phase 5 (Self-Registration):
  C2 (AuthContext fix) → Re-enable self-signup → Role selection → Bulk import
  Wheel → signup fix depends on: RLS fix for ac_signup_intents (RLS_FIX_PLAN.md critical #1)
  Coach application form → needs coach_applications table (new)
  Org trial mode → needs trial tracking fields on organizations table

Phase 6 (Enterprise):
  ROI dashboard → needs assessment + progress data (mostly exists)
  Org SSO → requires SAML/OIDC library integration
  White-label → needs org branding fields (new)
  H10 (Org deny) must be fixed first

Phase 7 (Mobile):
  PWA enhancements → needs service worker updates (exists)
  Voice input → needs Web Speech API integration

Phase 8 (Integrations):
  Circle → needs Circle API key set (env var exists, not configured)
  TalentLMS → needs course catalog sync (tables exist)
  Slack/Teams → needs new OAuth integration

Phase 9 (Strategic):
  VIA API → needs API partnership
  Adaptive assessments → needs IRT algorithm + calibrated question bank
  Video → needs video provider (Daily.co/Twilio) integration
```

### 11.6 Items NOT Included in Roadmap

These were analyzed but intentionally excluded from the prioritized roadmap:

| Item | Source | Reason |
|------|--------|--------|
| Lucid/Miro/Mural integration deepening | Part 2 | URL launchers sufficient — deepen only if users request |
| Google Drive OAuth integration | Part 2 | URL mapping works for pilot |
| Customizable dashboard drag-and-drop | Part 6, §6.7 | Nice-to-have, high effort, low impact vs other items |
| Emoji reactions in feedback | Part 6, §6.7 | Cosmetic, low priority |
| LinkedIn badge sharing improvements | Part 6, §6.8 | Already works, just needs prominence adjustment |
| Manager visibility opt-in | Part 6, §6.8 | Subset of org consent system (already exists) |

### 11.7 Effort Summary (updated 2026-02-18)

| Category | Items | Status |
|----------|-------|--------|
| ~~Critical fixes (C1-C4)~~ | ~~4~~ | ✅ ALL RESOLVED |
| ~~High priority (H1-H10)~~ | ~~10~~ | ✅ ALL RESOLVED |
| Medium priority (M1-M17) | 3 remaining (14 resolved) | M12, M13, M16 |
| ~~Priority 0 — Content Delivery Tier 1~~ | ~~3 items~~ | ✅ DONE (2026-02-18) |
| ~~Priority 0 — Coach Onboarding~~ | ~~6 items~~ | ✅ DONE (2026-02-18) |
| ~~Priority 0 — Assignment Routing~~ | ~~6 items~~ | ✅ DONE (2026-02-18) |
| ~~Priority 0 — Cohort Core~~ | ~~2 items~~ | ✅ DONE (2026-02-18) |
| ~~Priority 0 — Cohort Scheduling Gaps (G1-G7)~~ | ~~7 items~~ | ✅ DONE (2026-02-19) |
| ~~Priority 0 — Instructor/Coach Teaching Workflow (GT1)~~ | ~~1 item (6 phases)~~ | ✅ DONE (2026-02-23) |
| ~~Priority 0 — Cohort Quality (G9-G10)~~ | ~~2 items~~ | ✅ DONE (2026-02-23) |
| ~~Priority 0 — G8 Enrollment Codes~~ | ~~1 item~~ | ✅ DONE (2026-02-25) |
| ~~Priority 0 — Development Profile (DP1-DP5)~~ | ~~5 phases~~ | ✅ DONE (DP1-4: 2026-02-19, DP5: 2026-02-23) |
| ~~Priority 0 — Development Profile (DP6-DP7)~~ | ~~2 phases~~ | ✅ DONE (2026-02-24) |
| ~~Priority 0 — Content Delivery Tier 2~~ | ~~xAPI direct~~ | ✅ DONE (2026-02-22) |
| ~~**Priority 0 — Content Delivery Tier 3 (CT3)**~~ ✅ | ~~Shared content packages + cross-program completion~~ | ~~HIGH~~ DONE |
| Phase 1 — Onboarding/UX | 8 items | 2-3 weeks |
| Phase 2 — Assessment Intelligence | 7 items | 3-4 weeks |
| Phase 3 — AI & Engagement | 8 items | 3-4 weeks |
| Phase 4 — Peer & Social | 5 items | 2-3 weeks |
| Phase 5 — Self-Registration | 7 items | 2-3 weeks |
| Phase 6 — Enterprise & Analytics | 9 items | 5-7 weeks |
| Phase 7 — Mobile & Modern UX | 4 items | 2-3 weeks |
| Phase 8 — Integration Deepening | 4 items | 3-4 weeks |
| Phase 9 — Strategic | 6 items | 3+ months |

**Recommended execution order (updated 2026-02-19):**
1. ~~C1-C4~~ ✅ → ~~H1-H10~~ ✅
2. ~~Priority 0 Content Delivery Tier 1~~ ✅ — Rise embed + auth-gated proxy
3. ~~Priority 0 Coach Onboarding~~ ✅ — welcome card + profile setup + empty states + welcome email
4. ~~Priority 0 Assignment Routing~~ ✅ — My Queue + transfer dialog + async notifications
5. ~~Priority 0 Cohort Core~~ ✅ — CohortDashboard + Join Session + calendar + dashboard widget
6. ~~Priority 0 Cohort Scheduling Gaps (G1-G7)~~ ✅ — enrollment UI + Meet links + instructor + recurrence + attendance + notifications + session notes
7. ~~Development Profile (DP1-DP4)~~ ✅ — assessment↔goal links, profile page, gated milestones, intake-driven paths. See `docs/DEVELOPMENT_PROFILE_ANALYSIS.md`.
8. ~~Content Delivery Tier 2 (xAPI direct)~~ ✅ DONE (2026-02-22) — xapi-launch + xapi-statements + LMS mock + resume support
9. ~~Instructor/Coach Teaching Workflow (GT1)~~ ✅ DONE (2026-02-23) — RLS fixes + teaching cohorts list + cohort detail + dashboard widget + StudentDetail card
10. ~~Cohort Quality (G9-G10)~~ ✅ DONE (2026-02-23) — analytics dashboard + session-linked homework
11. ~~DP5 Module↔Domain Mapping~~ ✅ DONE (2026-02-23) — `module_domain_mappings` table, admin UI
12. ~~CT3 Shared Content Packages & Cross-Program Completion~~ ✅ DONE (2026-02-20) — `content_packages` + `content_completions` tables, content library picker, xAPI propagation, cross-program auto-accept
13. ~~Quick medium wins (M2, M11)~~ ✅ DONE (2026-02-20) — assessment interest tracking on dashboard, console cleanup across 20 files
14. ~~G8 Self-Enrollment Codes~~ ✅ DONE (2026-02-25) — `enrollment_codes` table, admin management page, public enrollment page, `redeem-enrollment-code` edge function
15. **Phase 5 Self-Registration** — plan complete in `docs/PHASE5_PLAN.md`
16. ~~Development Profile (DP6-DP7)~~ ✅ DONE (2026-02-24) — psychometric structured results (schema definition + score entry + profile card), readiness dashboard (coach view + client widget)
17. Phase 3 AI features (system prompt hardening first, then AI Learning Companion)
18. Remaining phases based on business priorities

### 11.8 New Data Tables Required by Roadmap

Several roadmap items require new database tables or fields. These should be planned as migrations before feature development begins.

| Phase | Feature | New Tables / Fields |
|-------|---------|-------------------|
| ~~Priority 0~~ | ~~Content delivery Tier 1~~ | ✅ DONE — `program_modules.content_package_path` (TEXT), `module-content-packages` private storage bucket |
| ~~Priority 0~~ | ~~xAPI content delivery (Tier 2)~~ | ✅ DONE — `program_modules.content_package_type` (`web`/`xapi`), `xapi_sessions` table (auth_token, status, bookmark, suspend_data), `xapi_statements` table (verb/object/result + raw JSONB), 2 new edge functions (`xapi-launch`, `xapi-statements`) |
| ~~Priority 0~~ | ~~Cohort dashboard~~ | ✅ DONE — uses existing tables, no new migrations needed |
| ~~Priority 0~~ | ~~G1 Cohort enrollment UI~~ | ✅ DONE — `enroll_with_credits` RPC accepts `p_cohort_id`, cohort dropdown on enrollment form |
| ~~Priority 0~~ | ~~G3 Instructor on cohort~~ | ✅ DONE — `program_cohorts.lead_instructor_id`, `cohort_sessions.instructor_id` |
| ~~Priority 0~~ | ~~G4 Attendance tracking~~ | ✅ DONE — `cohort_session_attendance` table + `AttendanceTracker.tsx` |
| ~~Priority 0~~ | ~~G7 Session notes~~ | ✅ DONE — `cohort_sessions.recording_url`, `.summary`, `.action_items` |
| ~~Priority 0~~ | ~~GT1 Teaching workflow RLS~~ | ✅ DONE — 4 RLS policies (coach SELECT on `program_cohorts`, UPDATE on `cohort_sessions` for both roles, upgrade coach attendance to ALL) + 3 new pages + 4 modified files |
| ~~Priority 0~~ | ~~CT3a Shared content library~~ | ✅ DONE — `content_packages` table, `program_modules.content_package_id` FK, Content Library admin page, ModuleForm picker |
| ~~Priority 0~~ | ~~CT3b Cross-program completion~~ | ✅ DONE — `content_completions` table, xAPI propagation, `useCrossProgramCompletion` extended, client auto-accept |
| ~~Priority 0~~ | ~~G8 Enrollment codes~~ | ✅ DONE — `enrollment_codes` table (program_id, cohort_id, code, code_type, max_uses, grants_tier, is_free, discount_percent, expires_at), `client_enrollments.enrollment_code_id` FK, `validate_enrollment_code` RPC, `redeem-enrollment-code` edge function |
| ~~Priority 0~~ | ~~Assignment routing~~ | ✅ DONE — async via `create_notification` RPC, My Queue via `enrollment_module_staff` |
| ~~Priority 0~~ | ~~Assignment transfer~~ | ✅ DONE — `TransferAssignmentDialog` component |
| Phase 1 | Onboarding | `profiles.onboarding_completed` (boolean) |
| Phase 3 | Streaks/XP | `engagement_streaks` (user, streak_type, current_count, longest_count, last_activity_date), `user_xp` (user, total_xp, level) |
| Phase 3 | Activity feed | `activity_feed_events` (user_id, event_type, target_type, target_id, created_at) |
| Phase 3 | Smart notifications | `user_activity_patterns` (user_id, day_of_week, hour, engagement_score) |
| Phase 4 | Coach matching | `coach_specializations` (coach_id, specialization_key), `matching_preferences` (client_id, preferred_specializations) |
| Phase 5 | Coach applications | `coach_applications` (user_id, specialties, certifications, bio, status, reviewed_by) |
| Phase 5 | Org applications | `org_applications` (user_id, org_name, size, industry, status, reviewed_by) |
| Phase 5 | Access requests | `access_requests` (user_id, requested_role, status, reviewed_by) — for roleless OAuth users |
| Phase 5 | Coach verification | `profiles.verification_status` (pending/verified/rejected), `profiles.verified_at` |
| Phase 5 | Org trial | `organizations.trial_ends_at`, `organizations.is_trial` |
| Phase 6 | Org branding | `org_branding` (org_id, logo_url, accent_color, custom_name) |
| Phase 6 | Seat warnings | `organizations.max_sponsored_seats`, `organizations.seat_warning_threshold` |
| Phase 7 | Flexible pacing | `client_enrollments.pacing_mode` (self_paced/cohort_paced) |
| Phase 7 | Module ordering | `program_modules.is_sequential` (boolean), `module_progress.unlock_override` |
| ~~Dev Profile DP1~~ | ~~Assessment ↔ Goal traceability~~ | ✅ DONE — `goal_assessment_links` table with polymorphic FK refs |
| ~~Dev Profile DP3~~ | ~~Assessment-gated milestones~~ | ✅ DONE — `guided_path_milestone_gates` + `milestone_gate_overrides` |
| ~~Dev Profile DP4~~ | ~~Intake-driven path recommendation~~ | ✅ DONE — `guided_path_instantiations` + `goals.template_goal_id` + `goals.instantiation_id` |
| ~~Dev Profile DP5~~ | ~~Module ↔ domain mapping~~ | ✅ DONE — `module_domain_mappings` (module_id, capability_domain_id, relevance) |
| ~~Dev Profile DP6~~ | ~~Psychometric structured results~~ | ✅ DONE — `psychometric_result_schemas` (assessment_id, dimensions JSONB, version) + `psychometric_results` (user_id, assessment_id, schema_id, scores JSONB, entered_by) |
| Phase 9 | Micro-learning | New `micro_learning` value in `module_types` enum |
| Phase 12 | Resource ratings | `resource_ratings` (user_id, resource_id, rating, review_text) |
