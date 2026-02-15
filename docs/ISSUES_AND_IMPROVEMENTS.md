# Issues, Improvements & Enhancement Roadmap

---

## Part 1: Known Issues (prioritized)

### Critical — Fix before pilot users encounter them

#### 1.1 Credit Loss on Failed Enrollment
**File:** `src/hooks/useProgramEnrollment.ts` (lines 179-233)
**Problem:** Credits are deducted BEFORE enrollment is created. If enrollment fails, credits are lost with no refund. The code has a comment acknowledging this.
**Impact:** Users lose credits on any enrollment failure (DB error, network timeout).
**Fix:** Create an edge function that atomically deducts credits + creates enrollment in a single DB transaction with rollback.

**Cursor prompt:**
```
In src/hooks/useProgramEnrollment.ts, the enrollment flow deducts credits before creating the enrollment. If enrollment fails, credits are lost. Fix this by:
1. Create a new edge function supabase/functions/enroll-in-program/index.ts
2. The function should: validate credits → start DB transaction → deduct credits → create enrollment → commit (or rollback on failure)
3. Update useProgramEnrollment.ts to call this edge function instead of doing credits + enrollment separately
4. Follow existing edge function patterns (auth check, CORS, error handling)
```

#### 1.2 Cal.com Booking Creates Orphaned Bookings on DB Failure
**File:** `supabase/functions/calcom-create-booking/index.ts` (lines 219-257)
**Problem:** If Cal.com booking succeeds but session DB update fails, returns 500. Frontend may retry → duplicate Cal.com bookings.
**Impact:** Duplicate bookings, confused participants.
**Fix:** Return 201 with partial success + booking UID, or add idempotency key.

**Cursor prompt:**
```
In supabase/functions/calcom-create-booking/index.ts, if the Cal.com API call succeeds but the DB session update fails, the function returns 500 which may cause the frontend to retry and create duplicate bookings.

Fix by:
1. If Cal.com booking succeeds but DB update fails, return 207 (Multi-Status) with the booking details
2. Add an idempotency check at the top of the function: if a booking with the same session_id + user_id exists in the last 5 minutes, return the existing booking instead of creating a new one
3. Log the partial failure to console.error for monitoring
```

---

### High — Fix soon

#### 1.3 File Upload Missing Size + MIME Validation
**Files:** 30+ upload components across the codebase
**Problem:** Only `AccountSettings.tsx` validates file size (5MB). No MIME type validation anywhere. Users could upload multi-GB files or malicious file types.
**Fix:** Create shared utility, apply to all upload components.

**Cursor prompt:**
```
Create a shared file upload validation utility and apply it across the codebase:

1. Create src/lib/uploadValidation.ts with:
   - validateFileUpload(file: File, options: { maxSizeMB?: number, allowedTypes?: string[] }): { valid: boolean, error?: string }
   - Default maxSizeMB: 10
   - Default allowedTypes: ['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'video/mp4', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
   - UPLOAD_LIMITS constant with per-context limits (avatar: 5MB images only, assignment: 25MB any doc, resource: 50MB any)

2. Find all file upload handlers in the codebase (search for "upload", "file", ".put(" in src/) and add validation before the upload call

3. Show toast.error with the validation message on failure

4. Write a unit test in src/lib/__tests__/uploadValidation.test.ts
```

#### 1.4 AI Prompt Functions Accept Unlimited Input
**File:** `supabase/functions/generate-reflection-prompt/index.ts` and similar AI functions
**Problem:** No input size limits before sending to Vertex AI. Cost spikes, timeouts possible.
**Fix:** Truncate input arrays and string lengths.

**Cursor prompt:**
```
In all AI-related edge functions (generate-reflection-prompt, generate-ai-recommendations, generate-ai-insights, course-recommendations, decision-insights), add input size limits:

1. Truncate any user-provided arrays to max 10 items
2. Truncate any user-provided strings to max 500 characters
3. Truncate the assembled prompt to max 4000 characters before sending to Vertex AI
4. Add a shared helper in supabase/functions/_shared/ai-input-limits.ts:
   - truncateArray(arr, maxItems)
   - truncateString(str, maxLength)
   - truncatePrompt(prompt, maxChars)
```

#### 1.5 N+1 Query in Assessment Scoring
**File:** `src/components/modules/InstructorAssignmentScoring.tsx` (lines 123-134)
**Problem:** Fetches domains, then loops to query questions per domain. 10 domains = 11 DB calls.
**Fix:** Use Supabase nested select.

**Cursor prompt:**
```
In src/components/modules/InstructorAssignmentScoring.tsx, fix the N+1 query pattern around lines 123-134.

Currently it fetches capability_domains, then loops to query capability_domain_questions for each domain separately.

Replace with a single Supabase nested select:
const { data } = await supabase
  .from("capability_domains")
  .select("id, name, description, order_index, capability_domain_questions(id, question_text, description, order_index)")
  .eq("assessment_id", assessment.id)
  .order("order_index");

Then map the nested result to the existing Domain type.
```

#### 1.6 Assignment Grading Lacks Status Guard
**File:** `src/components/modules/InstructorAssignmentScoring.tsx`
**Problem:** Doesn't verify assignment is `submitted` before allowing grading.

**Cursor prompt:**
```
In src/components/modules/InstructorAssignmentScoring.tsx, add a guard that checks the assignment status before allowing grading.

1. After fetching the assignment, check if status === 'submitted'
2. If status is 'draft' or 'in_progress', show a disabled state with message "Assignment not yet submitted"
3. If status is 'reviewed', show the existing scores in read-only mode
4. Only enable the scoring form when status === 'submitted'
```

---

### Medium — Improve over time

#### 1.7 Console Statements in Production (164 files)
**Problem:** 164 files have console.log/error/warn. Leaks internal data to browser DevTools.

**Cursor prompt:**
```
Remove all console.log, console.warn, and console.debug statements from src/ files. Keep console.error only where Sentry isn't already capturing the error.

Rules:
- In src/ files: replace console.error with Sentry.captureException where not already done
- In supabase/functions/ files: console.error is OK (server-side logging), but remove console.log
- Don't touch test files (src/lib/__tests__/)
- Don't touch node_modules

Run npm run lint after to verify no issues introduced.
```

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

#### 1.9 Credit Balance Race Condition
**Problem:** Concurrent requests could both pass balance check and deduct, going negative.
**Action:** Audit the `consume_credit_service` RPC to verify it uses `SELECT ... FOR UPDATE`.

**Cursor prompt:**
```
Check the consume_credit_service RPC function in supabase/migrations/ for row-level locking. Search for the function definition and verify it uses SELECT ... FOR UPDATE or SERIALIZABLE isolation on user_credit_balances before deducting. If it doesn't, create a migration to fix it.
```

#### 1.10 Entitlement Edge Case (org deny override)
**Problem:** Org sets feature limit=0 (disable), but user's subscription gives limit=100 → merged result is 100. Org intent bypassed.

**Cursor prompt:**
```
In src/hooks/useEntitlements.ts, the current logic takes Math.max of all limits. This means a limit=0 from one source can be overridden by a higher limit from another source.

Add support for explicit deny: if any source sets limit=0 AND has a flag like "is_restrictive: true" or "override: deny", that takes precedence over other sources. Check how org-sponsored features are structured and add a deny mechanism.
```

#### 1.11 Edge Function Error Handling Inconsistent
**Problem:** Some functions return proper 400/500 codes, others return generic 500 for everything.

**Cursor prompt:**
```
Create a shared error response utility in supabase/functions/_shared/error-response.ts:

export function createErrorResponse(status: number, message: string, details?: unknown) {
  return new Response(JSON.stringify({ error: message, details }), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

export function createValidationError(message: string) {
  return createErrorResponse(400, message);
}

export function createAuthError(message?: string) {
  return createErrorResponse(401, message || "Unauthorized");
}

export function createServerError(message: string, error?: unknown) {
  console.error(message, error);
  return createErrorResponse(500, message);
}

Then update edge functions to use these instead of inline Response construction. Start with the most-used ones: calcom-create-booking, send-auth-email, create-checkout.
```

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

#### 1.14 Loading/Error States Inconsistent
**Problem:** Mix of skeleton loaders and inline "Loading..." text.
**Action:** Standardize with shadcn/ui Skeleton. Good task for Cursor.

#### 1.15 AuthContext Role Fallback Bug
**Problem:** `if (roles.length === 0) roles = ["client"]` in AuthContext.tsx line 135. Must fix before re-enabling Google OAuth.
**Action:** Replace with error redirect.

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
- Full notification system (34 types, email + in-app)
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

#### 7.1 AuthContext Role Fallback — SECURITY RISK
**File:** `src/contexts/AuthContext.tsx` (line 135)
**Problem:** `if (roles.length === 0) roles = ["client"]` — any Google OAuth user with no roles gets auto-assigned `client`. When Google OAuth is re-enabled, unregistered Google users bypass the signup flow entirely and get client access.
**Fix:** Instead of defaulting to `client`, redirect to a "complete registration" page or block access until admin approves.

**Cursor prompt:**
```
In src/contexts/AuthContext.tsx, line 135 has a dangerous fallback: if a user has no roles, they default to "client". This is a security risk when Google OAuth is re-enabled because unregistered users bypass signup.

Fix this by:
1. Remove the `roles = ["client"]` fallback
2. If roles.length === 0 after fetching from user_roles:
   - Set a new state: `needsRegistration = true`
   - In the auth flow, redirect users with no roles to a new page `/complete-registration`
3. Create src/pages/CompleteRegistration.tsx that:
   - Shows "Your account needs to be set up by an administrator"
   - Has a "Request Access" button that inserts into a new `access_requests` table
   - Shows a "Back to Login" button
4. Add route in App.tsx for /complete-registration (public, requires auth but no role)
```

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

#### Feature Gate Confusion
**Problem:** When a feature is disabled, `FeatureGate` shows "This feature is not available on your current plan" with an "Upgrade Plan" button. But sometimes the user IS on the right plan — the feature just isn't mapped to their plan in `plan_features`.

**Impact:** User clicks upgrade → sees they're already on the highest plan → confused.

**Fix:**
```
In src/components/FeatureGate.tsx, improve the blocked state message:

1. Check if user is already on the highest purchasable plan
2. If yes: show "This feature requires additional configuration. Contact your administrator."
3. If no: show current "Upgrade Plan" message
4. Add a "Learn More" link to a help page explaining the feature system
```

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
| 6 | Feature gate messaging for max-plan users | MEDIUM | 2 hours | Improve FeatureGate blocked state |
| 7 | Locked sidebar items confusing | LOW | 4 hours | Group under "Premium Features" section |
| 8 | Empty state components for all sections | LOW | 1 day | Create reusable EmptyState component |
| 9 | No role selection in self-signup | LOW (pilot) | 1 week | Role selection page + admin approval |
| 10 | No bulk user import | LOW (pilot) | 3 days | CSV upload in admin panel |
