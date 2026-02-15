# Data Configuration Guide — Dependency Order

This guide explains what data must be configured, in what order, and what depends on what for the InnoTrue Hub to function correctly.

---

## Layer 1 — Foundations (no dependencies, configure first)

These tables have no foreign keys to other config tables. They must exist before anything else references them.

### 1.1 System Settings (`system_settings`)
Key-value pairs that control platform-wide behavior.

| Key | Purpose | Default |
|-----|---------|---------|
| `ai_monthly_credit_limit` | Max AI credits across the platform per month | 1000 |
| `platform_name` | Displayed in emails, UI | InnoTrue Hub |
| `support_email` | Shown in error pages, emails | support@innotrue.com |
| `default_timezone` | Default for scheduling | Europe/Berlin |

**Admin UI:** System Settings page
**Needed by:** AI edge functions, email templates, scheduling

### 1.2 Module Types (`module_types`)
Define the types of content a program module can be.

| Type | Purpose |
|------|---------|
| `session` | Live scheduled session (coaching, workshop, etc.) |
| `assignment` | Async work the client submits for grading |
| `reflection` | Self-guided journaling / reflection exercise |
| `resource` | Static learning material (PDF, video, link) |

**Admin UI:** Module Types Management
**Needed by:** Program modules (each module has a `module_type`)

### 1.3 Tracks (`tracks`)
Certification or learning paths that programs belong to.

| Track | Key | Description |
|-------|-----|-------------|
| CTA Track | `cta` | Certified Technology Architect certification path |
| Leadership Track | `leadership` | Leadership development path |

**Admin UI:** Tracks Management
**Needed by:** Programs (categorized by track), credit services (track-specific pricing)

### 1.4 Wheel of Life Categories (`wheel_categories`)
Categories for the Wheel of Life self-assessment feature.

10 categories: Career, Finances, Health, Relationships, Personal Growth, Fun & Recreation, Physical Environment, Family, Romance, Contribution

**Admin UI:** Wheel Categories Management
**Needed by:** Wheel of Life assessment feature (client-facing)

### 1.5 Assessment Categories (`assessment_categories`)
Top-level groupings shared across **all three assessment systems** (capability, self/public, psychometric).

6 categories: Personality, Aptitude, Career, Emotional Intelligence, Leadership, Other

**Admin UI:** Assessments Management
**Needed by:** Capability assessments, assessment definitions (public/self), psychometric assessments

---

## Layer 2 — Plans & Features (core gating system)

This is the foundation of the entitlement system. Everything that controls "who can access what" starts here.

### 2.1 Features (`features`)
Define every gatable capability in the platform. Each feature has a unique `key` used in code.

| Feature Key | Name | Is Consumable | Purpose |
|-------------|------|---------------|---------|
| `ai_coach` | AI Coach | Yes | AI coaching chat (costs credits per use) |
| `ai_insights` | AI Insights | Yes | AI-generated insights |
| `ai_recommendations` | AI Recommendations | Yes | AI course/action recommendations |
| `session_coaching` | Coaching Sessions | Yes | 1:1 coaching sessions |
| `session_group` | Group Sessions | Yes | Group coaching, mastermind, office hours |
| `session_workshop` | Workshops | Yes | Workshops and webinars |
| `session_peer_coaching` | Peer Coaching | Yes | Peer-to-peer coaching |
| `session_review_board` | Review Board | Yes | Mock review board sessions |
| `decision_toolkit_basic` | Basic Decision Toolkit | No | Access to basic decision tools |
| `decision_toolkit_advanced` | Advanced Decision Toolkit | No | Access to advanced decision tools |
| `programs_base` | Base Programs | No | Access to tier 1 programs |
| `programs_pro` | Pro Programs | No | Access to tier 2 programs |
| `programs_advanced` | Advanced Programs | No | Access to tier 3+ programs |
| `courses` | Courses | No | Access to TalentLMS courses |
| `credits` | Credits | No | Credit system access |
| `skills_map` | Skills Map | No | Skills visualization feature |
| `wheel_of_life` | Wheel of Life | No | Wheel of Life assessment |
| `assessments` | Assessments | No | Capability assessments |

**Consumable features** have a `limit_value` in plan_features — each use costs credits or counts against the limit.
**Non-consumable features** are binary: you either have access or you don't.

**Admin UI:** Features Management
**Needed by:** Plan features, program plan features, session types, credit services, program modules

### 2.2 Plans (`plans`)
Subscription tiers that users are assigned to. Stored on `profiles.plan_id`.

| Plan | Key | Tier | Credits | Purchasable | Notes |
|------|-----|------|---------|-------------|-------|
| Free | `free` | 0 | 20 | No | Default for new users |
| Base | `base` | 1 | 150 | Yes | Entry paid tier |
| Pro | `pro` | 2 | 250 | Yes | Mid tier |
| Advanced | `advanced` | 3 | 500 | Yes | High tier |
| Elite | `elite` | 4 | 750 | Yes | Top tier |
| Programs | `programs` | 0 | 0 | No | Admin-assigned, program-only access |
| Continuation | `continuation` | 0 | 0 | No | Admin-assigned, post-program access |

- `is_purchasable = true` → shown in Stripe checkout (subscription page)
- `is_purchasable = false` → admin-assigned only
- `tier_level` → used by programs to gate access (`programs.min_plan_tier`)
- `credit_allowance` → monthly credit budget for the user

**Admin UI:** Plans Management (has `is_purchasable` toggle)
**Needed by:** Plan features, plan prices, profiles, programs (min_plan_tier)

### 2.3 Plan Features (`plan_features`)
Map features to plans with optional limits. This defines what each plan tier can access.

| Plan | Feature | Limit | Meaning |
|------|---------|-------|---------|
| Free | ai_coach | 20 | 20 AI coach uses/month |
| Free | session_coaching | 1 | 1 coaching session/month |
| Base | ai_coach | 50 | 50 AI coach uses/month |
| Base | session_coaching | 3 | 3 coaching sessions/month |
| Pro | ai_coach | 100 | 100 AI coach uses/month |
| Pro | session_coaching | 5 | 5 coaching sessions/month |
| ... | ... | ... | Higher tiers get more |

- `limit_value = NULL` → unlimited access (non-consumable features)
- `limit_value = 0` → feature disabled for this plan
- `limit_value > 0` → monthly usage cap

**Admin UI:** Plans Management → Edit Plan → Features tab
**Depends on:** plans, features
**Needed by:** Entitlement resolution (`useEntitlements` hook)

### 2.4 Plan Prices (`plan_prices`)
Link plans to Stripe for billing. Each purchasable plan needs at least one price.

| Plan | Interval | Price | Stripe Price ID |
|------|----------|-------|-----------------|
| Base | monthly | 29.00 EUR | `price_xxx` (from Stripe) |
| Pro | monthly | 49.00 EUR | `price_xxx` |
| Advanced | monthly | 79.00 EUR | `price_xxx` |
| Elite | monthly | 129.00 EUR | `price_xxx` |

**External dependency:** Stripe products and prices must be created first in Stripe Dashboard, then IDs entered here.

**Admin UI:** Plans Management → Edit Plan → Pricing tab
**Depends on:** plans, Stripe (products + prices created in Stripe Dashboard)
**Needed by:** Subscription checkout page (`Subscription.tsx` reads `stripe_price_id` from this table)

---

## Layer 3A — Session System (depends on features)

### 3.1 Session Types (`session_types`)
Define the kinds of sessions that can be scheduled.

| Session Type | Duration | Max Participants | Feature Key | Cal.com Event Type |
|-------------|----------|-----------------|-------------|-------------------|
| Coaching | 60 min | 2 | `session_coaching` | Map in admin UI |
| Group Coaching | 90 min | 12 | `session_group` | Map in admin UI |
| Workshop | 120 min | 30 | `session_workshop` | Map in admin UI |
| Mastermind | 90 min | 8 | `session_group` | Map in admin UI |
| Review Board Mock | 60 min | 4 | `session_review_board` | Map in admin UI |
| Peer Coaching | 45 min | 2 | `session_peer_coaching` | Map in admin UI |
| Office Hours | 60 min | 10 | `session_group` | Map in admin UI |
| Webinar | 60 min | 100 | `session_workshop` | Map in admin UI |

- `feature_key` links to features table — user must have this feature via their plan to book
- Each session type needs a corresponding Cal.com event type for scheduling to work

**Admin UI:** Session Types Management
**Depends on:** features (feature_key)
**Needed by:** Session type roles, sessions, program modules (session-type modules), Cal.com mapping

### 3.2 Session Type Roles (`session_type_roles`)
Define participant roles for each session type.

| Session Type | Role | Max | Required |
|-------------|------|-----|----------|
| Review Board Mock | presenter | 1 | Yes |
| Review Board Mock | evaluator | 3 | Yes |
| Review Board Mock | observer | unlimited | No |
| Workshop | facilitator | 2 | Yes |
| Workshop | participant | unlimited | No |
| Mastermind | hot_seat | 1 | Yes |
| Mastermind | member | unlimited | No |
| Mastermind | moderator | 1 | No |
| Peer Coaching | coach | 1 | Yes |
| Peer Coaching | coachee | 1 | Yes |
| Webinar | presenter | 3 | Yes |
| Webinar | attendee | unlimited | No |

**Admin UI:** Session Types Management → Edit → Roles tab
**Depends on:** session_types
**Needed by:** Session booking (role assignment during registration)

### 3.3 Cal.com Event Type Mappings
Link session types to Cal.com event types for scheduling.

**Setup required in Cal.com first:**
1. Create event types in Cal.com organization (`innotrue-gmbh.cal.com`)
2. Note the event type IDs
3. Map them in admin UI: Session Type → Cal.com Event Type ID

**Environment variables needed:** `CALCOM_API_KEY`, `CALENDAR_HMAC_SECRET`

**Admin UI:** Cal.com Mappings Management
**Depends on:** session_types, Cal.com event types (created externally)
**Needed by:** `calcom-create-booking` edge function (booking flow)

---

## Layer 3B — Credit System (depends on features, tracks)

### 3.4 Credit Services (`credit_services`)
Define what actions cost credits.

| Service | Category | Cost | Feature | Track |
|---------|----------|------|---------|-------|
| AI Coach Query | ai | 1 | ai_coach | — |
| AI Insight | ai | 1 | ai_insights | — |
| AI Recommendation | ai | 1 | ai_recommendations | — |
| Coaching Session | sessions | 10 | session_coaching | — |
| Group Session | sessions | 5 | session_group | — |
| Workshop | sessions | 3 | session_workshop | — |
| Peer Coaching | sessions | 3 | session_peer_coaching | — |
| Review Board Mock | sessions | 15 | session_review_board | — |
| Program Enrollment (Base) | programs | 25 | programs_base | — |
| Program Enrollment (Pro) | programs | 50 | programs_pro | — |
| Program Enrollment (Advanced) | programs | 100 | programs_advanced | — |
| Goal Creation | goals | 2 | — | — |
| Skills Assessment | specialty | 5 | assessments | — |
| Decision Analysis | specialty | 3 | decision_toolkit_basic | — |
| Track-specific services | various | discounted | — | CTA/Leadership |

Track-linked services can have different pricing for track members.

**Admin UI:** Credit Services Management
**Depends on:** features (feature_id), tracks (track_id)
**Needed by:** Credit deduction when user performs an action

### 3.5 Credit Packages (`credit_topup_packages`, `org_credit_packages`)

**Individual packages:**

| Package | Price | Credits | Validity |
|---------|-------|---------|----------|
| Starter | 50 EUR | 55,000 | 6 months |
| Standard | 100 EUR | 120,000 | 12 months |
| Premium | 200 EUR | 260,000 | 12 months |

**Organization packages:**

| Package | Price | Credits | Validity |
|---------|-------|---------|----------|
| Starter | 2,500 EUR | 3,000,000 | 12 months |
| Growth | 5,000 EUR | 6,500,000 | 12 months |
| Enterprise | 10,000 EUR | 14,000,000 | 12 months |

**Organization platform tiers:**

| Tier | Monthly | Annual | Features |
|------|---------|--------|----------|
| Essentials | 30 EUR | — | Basic org features |
| Professional | 50 EUR | — | Full org features |

**External dependency:** Stripe for payment processing
**Admin UI:** Credit packages managed via admin, checkout via Stripe
**Depends on:** Stripe (payment processing)

---

## Layer 3C — Notifications (depends on notification categories)

### 3.6 Notification Categories (`notification_categories`)

| Category | Key | Description |
|----------|-----|-------------|
| Programs | `programs` | Enrollment, module, completion notifications |
| Sessions | `sessions` | Scheduling, reminders, cancellations |
| Assignments | `assignments` | Due dates, grading, feedback |
| Goals | `goals` | Reminders, milestones, comments |
| Decisions | `decisions` | Decision reminders, outcomes |
| Credits | `credits` | Low balance, purchases, expiry |
| Groups | `groups` | Group activity, tasks, sessions |
| System | `system` | Security, account, platform updates |

**Admin UI:** Notifications Management
**Needed by:** Notification types

### 3.7 Notification Types (`notification_types`)
31 types organized under the 8 categories. Each type has:
- `key` — used in code to trigger notifications
- `is_critical` — if true, cannot be disabled by user
- `email_template_key` — links to HTML email template

Examples:
- `program_enrolled` (programs) → "You've been enrolled in {program}"
- `session_reminder` (sessions) → "Your session starts in 24h"
- `assignment_due_soon` (assignments) → "Assignment due in 48h"
- `credits_low` (credits) → "Your credit balance is running low"
- `security_alert` (system, critical) → "New login from unknown device"

**Admin UI:** Notifications Management → Types tab
**Depends on:** notification_categories
**Needed by:** Edge functions that send notifications, user notification preferences

### 3.8 Email Templates
HTML email templates for each notification type. Created by migration `20260119014103`, not in seed.sql.

Each template uses Handlebars-style variables (`{{user_name}}`, `{{program_name}}`, etc.) and is rendered by the email-sending edge functions.

**External dependency:** Resend (email delivery)
**Managed by:** Database migration (not admin UI currently)

---

## Layer 3D — Assessments (depends on assessment categories)

The platform has **three distinct assessment systems** that share `assessment_categories` but serve different purposes.

### 3.9 Capability Assessments (`capability_assessments`)
Slider-based self/evaluator assessments where clients rate themselves (or are rated) across competency domains.

**Tables:**

| Table | Purpose |
|-------|---------|
| `capability_assessments` | Assessment definitions (name, instructions, scale, mode) |
| `capability_domains` | Competency areas within an assessment |
| `capability_domain_questions` | Questions per domain (rated on slider 1–N scale) |
| `assessment_families` | Group related capability assessments together |
| `capability_snapshots` | A completed assessment instance (scores, evaluator info) |
| `snapshot_domain_ratings` | Per-domain scores within a snapshot |

**Assessment Modes:** `self` (client only), `evaluator` (instructor/coach only), `both` (comparison)

**Five access paths:**
1. **Self-assessment** — client rates themselves via `CapabilityAssessments.tsx`
2. **Module-linked** — triggered from `program_modules.capability_assessment_id` via `ModuleSelfAssessment.tsx`
3. **Instructor/coach evaluation** — evaluator creates snapshot with `is_self_assessment=false`
4. **Peer evaluation** — via `GroupPeerAssessmentsPanel.tsx` (configured in `group_peer_assessments`)
5. **Public** — unauthenticated access is NOT supported for capability assessments (see 3.10 below)

**Scoring:** Client-side domain averages from slider ratings — NO server-side scoring matrix.
**Pass/fail:** Optional — `pass_fail_enabled`, `pass_fail_mode` (overall / per_domain), `pass_fail_threshold`
**Visualization:** Radar charts + line evolution charts comparing snapshots over time

**Structure:**
```
Assessment: "Architecture Self Knowledge Check"
├── Domain 1: System Architecture (9 questions, 5-point slider)
├── Domain 2: Security & Identity (7 questions)
├── ...
└── Domain 7: Communication (10 questions)
```

**Admin UI:** Assessments Management → Create/edit assessments, families, domains, questions
**Depends on:** assessment_categories, assessment_families (optional)
**Needed by:** Program modules (`capability_assessment_id`), scenario templates (`capability_assessment_id`), assignment types (`scoring_assessment_id`)

### 3.10 Assessment Definitions — Public/Self-Assessments (`assessment_definitions`)
Multiple-choice assessments with **server-side confidential scoring**. Used for public (unauthenticated) assessments and scored self-assessments.

**Tables:**

| Table | Purpose |
|-------|---------|
| `assessment_definitions` | Assessment meta (name, slug, description, is_active) |
| `assessment_dimensions` | What gets scored (e.g., "Analytical Thinking", "Communication Style") |
| `assessment_option_scores` | **Scoring matrix** — maps each answer option to dimension scores (CONFIDENTIAL, never exposed to frontend) |
| `assessment_interpretations` | Result text based on score range conditions |
| `assessment_responses` | User answers + computed `dimension_scores` + matched `interpretations` |

**Scoring engine:** `compute-assessment-scores` edge function
1. Client answers multiple-choice questions
2. Server fetches `assessment_option_scores` (never exposed to frontend)
3. Sums option scores by dimension
4. Evaluates `assessment_interpretations` conditions against dimension totals
5. Returns matched interpretation text — client never sees the scoring matrix

**Public access:** Via `PublicAssessment.tsx` at `/public-assessment/:slug` — unauthenticated, email capture, PDF download

**Admin UI:** Assessment Definitions Management → Create assessment, add dimensions, configure scoring matrix, write interpretations
**Depends on:** assessment_categories
**Needed by:** Public assessment pages, module-linked self-assessments

### 3.11 Psychometric Assessments (`psychometric_assessments`)
**Document management catalog** — not a scored assessment engine. Clients browse external psychometric assessments, express interest, upload result PDFs, and share with coaches.

**Tables:**

| Table | Purpose |
|-------|---------|
| `psychometric_assessments` | Catalog entries (name, provider, category, cost, external_url) |
| `assessment_interest_registrations` | Client interest → admin contacts → completed/declined |
| `user_assessments` | Uploaded PDF results per client |
| `user_assessment_shares` | Share uploaded PDFs with specific coaches/instructors |

**Current limitations:** No in-app taking, no scoring engine, no visualization, no external API integration. See ISSUES_AND_IMPROVEMENTS.md Part 10 for enhancement roadmap.

**Admin UI:** Assessments Management → Psychometric tab (CRUD catalog, manage interest registrations)
**Client UI:** Explore Assessments (browse catalog, express interest), My Assessments (upload PDFs, share)
**Depends on:** assessment_categories
**Storage bucket:** `psychometric-assessments`

---

## Layer 4 — Programs & Program Plans (depends on everything above)

### 4.1 Program Plans (`program_plans`)
Define feature access tiers **within a program** (separate from subscription plans).

Example program plans:
| Program Plan | Tier | Credits | Purpose |
|-------------|------|---------|---------|
| Basic Access | 0 | 0 | Minimal in-program features |
| Standard Access | 1 | 50 | Standard features + some AI |
| Premium Access | 2 | 100 | Full features + coaching |

**Admin UI:** Program Plans Management
**Needed by:** Program plan features, programs (default_program_plan_id), program tier plans

### 4.2 Program Plan Features (`program_plan_features`)
Map features to program plans with limits — same pattern as plan_features but scoped to a program enrollment.

| Program Plan | Feature | Limit |
|-------------|---------|-------|
| Basic Access | ai_coach | 5 |
| Basic Access | session_coaching | 0 |
| Standard Access | ai_coach | 20 |
| Standard Access | session_coaching | 2 |
| Premium Access | ai_coach | 50 |
| Premium Access | session_coaching | 5 |

**Admin UI:** Program Plans Management → Edit → Features tab
**Depends on:** program_plans, features
**Needed by:** Entitlement resolution (merged with subscription plan features — highest limit wins)

### 4.3 Programs (`programs`)
The main learning experiences users enroll in.

| Field | Purpose | Example |
|-------|---------|---------|
| `slug` | URL-friendly ID | `cta-immersion-premium` |
| `name` | Display name | CTA Immersion Premium |
| `category` | Track category | `cta` |
| `is_active` | Visible to users | true |
| `credit_cost` | Credits to enroll | 100 |
| `min_plan_tier` | Minimum subscription tier to access | 2 (Pro+) |
| `default_program_plan_id` | Fallback program plan for enrollees | → program_plans.id |

**Access gating chain:**
1. User's subscription `plan.tier_level` must be >= `program.min_plan_tier`
2. User pays `credit_cost` credits to enroll
3. Once enrolled, features gated by program plan (from enrollment or default)

**Admin UI:** Programs Management
**Depends on:** program_plans (default_program_plan_id), tracks (category)
**Needed by:** Program modules, program tier plans, client enrollments

### 4.4 Program Tier Plans (`program_tier_plans`)
Map tier names within a program to specific program plans.

| Program | Tier Name | Program Plan | Credit Cost |
|---------|-----------|-------------|-------------|
| CTA Immersion | base | Basic Access | 50 |
| CTA Immersion | pro | Standard Access | 75 |
| CTA Immersion | premium | Premium Access | 100 |

This allows the same program to offer different access levels at different prices.

**Resolution order:** explicit enrollment plan → program_tier_plans mapping → `programs.default_program_plan_id` fallback

**Admin UI:** Programs Management → Tier Plans tab
**Depends on:** programs, program_plans

### 4.5 Program Modules (`program_modules`)
The individual learning units within a program.

| Field | Purpose | Example |
|-------|---------|---------|
| `program_id` | Parent program | → CTA Immersion |
| `title` | Module name | "Architecture Deep Dive" |
| `module_type` | Type of content | `session` |
| `order_index` | Sequence in program | 2 |
| `estimated_minutes` | Duration estimate | 90 |
| `feature_key` | Required feature (optional) | `session_coaching` |
| `min_plan_tier` | Min tier for this module (optional) | 2 |
| `capability_assessment_id` | Linked assessment (optional) | → assessment.id |

**Module type determines behavior:**
- `session` → links to session scheduling (Cal.com)
- `assignment` → has submission + grading workflow
- `reflection` → self-guided journaling
- `resource` → static content (file/link)

**Admin UI:** Programs Management → Edit Program → Modules tab
**Depends on:** programs, module_types, features (feature_key), capability_assessments (optional)
**Needed by:** Module progress tracking, enrollment flow

---

## Layer 5 — Users & Enrollment (depends on all above)

### 5.1 Platform Terms (`platform_terms`)
Legal terms users must accept before using the platform. The `PlatformTermsAcceptanceGate` blocks access until accepted.

| Field | Purpose |
|-------|---------|
| `version` | Version string (e.g., "1") |
| `content_html` | Full HTML of the terms |
| `is_current` | Only one can be current |
| `is_blocking_on_update` | If true, shows blocking modal when terms update |
| `effective_from` | When these terms take effect |

**Must exist before** any user can log in and access the dashboard.

### 5.2 Users, Profiles, Roles
Created via auth (signup/invite) or seeded for demo.

**Profile fields that need configuration data:**
- `plan_id` → must reference a valid plan
- Role assignment → `user_roles` table (admin, client, coach, instructor)

### 5.3 Client Enrollments (`client_enrollments`)
Enroll a user in a program.

| Field | Purpose |
|-------|---------|
| `client_user_id` | The enrolled user |
| `program_id` | The program |
| `program_plan_id` | Their access tier within the program (optional) |
| `status` | active, completed, withdrawn, etc. |
| `enrolled_at` | Enrollment date |

**Depends on:** users (profiles), programs, program_plans (optional)

### 5.4 Credit Balances (`user_credit_balances`)
Each user has a credit balance initialized from their plan's `credit_allowance`.

| Field | Purpose |
|-------|---------|
| `available_credits` | Current spendable balance |
| `total_credits` | Total ever received |
| `consumed_credits` | Total spent |

**Replenished:** Monthly based on plan's credit_allowance
**Topped up:** Via Stripe credit package purchase

### 5.5 Coach Assignments
- `program_coaches` — which coaches are assigned to which programs
- `client_coaches` — which coach is assigned to which client

---

## Feature Area Details

### Assignments

Assignments are async tasks that clients complete and instructors grade. They live inside program modules (`module_type = 'assignment'`).

**Tables:**

| Table | Purpose |
|-------|---------|
| `module_assignment_types` | Reusable assignment templates with JSON structure defining form fields |
| `module_assignment_configs` | Links assignment types to specific modules (many-to-many) |
| `module_assignments` | Actual assignment instances per client's module_progress |
| `module_assignment_attachments` | File uploads for submissions |

**Assignment Type Structure:**
The `structure` JSON field defines the form fields clients fill out. Admin creates these in the Assignment Types Management page.

**Status Flow:**
```
draft → submitted → reviewed → completed
```

**Data Flow:**
1. Admin creates **assignment types** with JSON structure (form field definitions)
2. Admin links assignment types to specific **modules** via `module_assignment_configs`
3. When client starts a module, system auto-creates `module_assignments` records
4. Client fills out the form (responses stored as JSON), attaches files
5. Client submits → status changes to `submitted`
6. Instructor views pending assignments, scores them (`overall_score`, `overall_comments`)
7. Client views feedback → status = `reviewed`

**Optional assessment link:** Assignment types can link to a `capability_assessment` via `scoring_assessment_id` for automated scoring.

**Storage bucket:** `module-assignment-attachments`

**Admin UI:** Assignment Types Management, Module Assignment Config
**Instructor UI:** Pending Assignments page
**Client UI:** Assignments page (tabs: pending / submitted / reviewed)

**Dependencies:**
- Requires: module_types (`assignment`), program_modules, features (optional feature_key)
- Optional: capability_assessments (for scoring)

**Notifications:**
- `notify-assignment-submitted` → alerts instructor
- `notify-assignment-graded` → alerts client

---

### Assessments — Three Separate Systems

The platform has **three distinct assessment systems** sharing `assessment_categories` but with different tables, scoring engines, and UIs. See Layer 3D above for table-level details.

**System A: Capability Assessments** (`capability_assessments`)
- Slider-based (1–N scale) per question, organized by competency domains
- Scoring: client-side domain averages from slider ratings (no server-side matrix)
- Modes: `self`, `evaluator`, `both` (comparison)
- Visualization: radar charts + line evolution charts across snapshots
- 5 access paths: self, module-linked, instructor evaluation, peer evaluation, (no public)
- **Admin setup:** Create assessment → add domains → add questions per domain → optionally configure families, pass/fail

**System B: Assessment Definitions / Public** (`assessment_definitions`)
- Multiple-choice questions scored server-side via `compute-assessment-scores`
- Scoring: confidential matrix (`assessment_option_scores` → `assessment_dimensions` → `assessment_interpretations`)
- Client never sees scoring matrix — only interpretation text
- Public access via `/public-assessment/:slug` (unauthenticated)
- **Admin setup:** Create definition → add dimensions → add questions with options → configure scoring matrix per option → write interpretations with score conditions

**System C: Psychometric Assessments** (`psychometric_assessments`)
- Document catalog only — external assessments, no in-app scoring
- Clients browse catalog → express interest → admin contacts → client takes external assessment → uploads result PDF → shares with coach
- **Admin setup:** Create catalog entries (name, provider, category, cost, external URL)

**Cross-system links:**
- `assessment_categories` — shared across all three systems
- `assessment_families` — capability assessments only
- `program_modules.capability_assessment_id` → capability assessments
- `module_assignment_types.scoring_assessment_id` → capability assessments
- `scenario_templates.capability_assessment_id` → capability assessments
- `psychometric_assessments.feature_key` → features table (plan gating)

---

### Teaching Scenarios

Scenario-based learning where instructors create realistic situations and clients write responses. Scenarios have sections (context, task, reflection) and can be linked to capability assessments.

**Tables:**

| Table | Purpose |
|-------|---------|
| `scenario_categories` | Categorize scenarios (with color, display order) |
| `scenario_templates` | Scenario definitions (title, description, locked/protected flags) |
| `scenario_sections` | Ordered sections within a scenario (context, task, reflection, etc.) |
| `scenario_assignments` | Assign scenarios to specific users/enrollments/modules |
| Paragraph responses | Client text responses per section |

**Status Flow:**
```
draft → submitted → in_review → evaluated
```

**Data Flow:**
1. Admin creates **scenario categories** (e.g., "Leadership Challenges", "Technical Decision-Making")
2. Instructor creates **scenario template** with sections:
   - Each section has a title, instructions, and order
   - Sections represent parts of the scenario (context/background, task, reflection prompts)
3. Instructor optionally links a **capability assessment** for automated scoring
4. Instructor **assigns** scenario to students (individually or via module link)
5. Client opens scenario, reads sections, writes responses in each section
6. Client submits → status = `submitted`
7. Instructor reviews, adds feedback (`overall_notes`) → status = `evaluated`
8. If linked to assessment, system may compute scores from responses

**Template Protection:**
- `is_protected` — prevents deletion (defaults to true)

**Admin UI:** Scenario Templates Management, Scenario Categories Management
**Instructor UI:** Scenario Assignments Management (assign to students), Scenario Evaluation Page (grade)
**Client UI:** Scenarios page (active / completed tabs), Scenario Detail page (read & respond)

**Sidebar nav:** Teaching → Scenarios (added in recent fix)

**Dependencies:**
- Requires: scenario_categories
- Optional: capability_assessments (for linked scoring), program_modules (module_id on assignment)

---

### Sessions (Individual + Group)

Sessions are live scheduled meetings — coaching calls, workshops, group sessions, etc. Integrated with Cal.com for booking.

**Tables:**

| Table | Purpose |
|-------|---------|
| `session_types` | Define session kinds (coaching, workshop, etc.) with feature_key |
| `session_type_roles` | Participant roles per session type (presenter, evaluator, etc.) |
| `sessions` | Individual session records |
| `session_participants` | Who's attending + their role + status |
| `group_sessions` | Group session records (with Cal.com integration fields) |
| `group_session_participants` | Group session attendees |
| `cohort_sessions` | Sessions for cohort-based delivery |
| `module_sessions` | Link sessions to program modules |
| `session_module_links` | Additional session-to-module mapping |

**Individual vs Group Sessions:**

| Aspect | Individual Sessions | Group Sessions |
|--------|-------------------|---------------|
| Table | `sessions` | `group_sessions` |
| Participants | `session_participants` | `group_session_participants` |
| Typical use | 1:1 coaching, peer coaching | Workshops, masterminds, webinars |
| Max participants | Usually 2 | Up to 100 |
| Recurring | No | Yes (`is_recurring`, `recurrence_pattern`) |
| Cal.com fields | Via session_types mapping | Direct: `calcom_booking_id`, `calcom_event_type_id` |
| Meeting link | `meeting_url` | `meeting_link` |

**Session Type → Cal.com Mapping:**
Each session type needs a corresponding Cal.com event type for booking to work.

```
Session Type (DB)          → Cal.com Event Type (external)
coaching                   → "CTA Coaching" (event_type_id: xxx)
group_coaching             → "Group Coaching" (event_type_id: xxx)
workshop                   → "Workshop" (event_type_id: xxx)
review_board_mock          → "Review Board Mock" (event_type_id: xxx)
```

Mapping stored in `calcom_event_type_mappings` table (configured via admin UI).

**Session Lifecycle:**
```
draft → scheduled → requested → confirmed (via Cal.com webhook) → in_progress → completed
                              → cancelled
                              → rescheduled
```

**Booking Flow:**
1. Admin creates session types with roles and feature_key
2. Admin maps session types to Cal.com event types
3. Coach/instructor creates session (individual or group) with date/time
4. Client views available sessions
5. For Cal.com-integrated sessions: client clicks book → Cal.com booking page
6. Cal.com webhook fires → `calcom-webhook` edge function updates status
7. Meeting link sent to participants
8. Post-session: mark completed, optionally collect feedback

**Role-Based Sessions:**
Complex session types have defined roles:
- **Review Board Mock**: presenter (1, required), evaluator (3, required), observer (unlimited)
- **Workshop**: facilitator (2, required), participant (unlimited)
- **Mastermind**: hot_seat (1, required), member (unlimited), moderator (1, optional)
- **Peer Coaching**: coach (1, required), coachee (1, required)

**Calendar Integrations:**
- **Cal.com** — primary booking system (edge functions: `calcom-create-booking`, `calcom-webhook`, `calcom-get-booking-url`)
- **Google Calendar** — OAuth sync for personal calendars
- **Zoom / Microsoft Teams** — OAuth meeting creation (`oauth-create-meeting`)

**Admin UI:** Session Types Management, Cal.com Mappings Management
**Instructor UI:** Module Session Manager (create sessions for modules)
**Client UI:** Module Session Display (view/register), Group Session Detail

**Dependencies:**
- Requires: features (feature_key), Cal.com (event types created externally)
- Used by: program_modules (module_type = 'session'), module_sessions

---

### Resources

Resources are learning materials (documents, videos, links, templates) managed in a library with visibility controls and optional credit costs.

**Tables:**

| Table | Purpose |
|-------|---------|
| `resource_library` | Main resource records with metadata |
| `resource_categories` | Categorize resources |
| `resource_collections` | Group related resources into collections |
| `resource_collection_items` | Map resources to collections (ordered) |
| `resource_library_programs` | Link resources to specific programs |
| `resource_library_program_tiers` | Restrict resource access by subscription tier within program |
| `resource_library_skills` | Tag resources with skills |
| `module_client_content_resources` | Assign resources to modules (with section_type) |
| `module_reflection_resources` | Reflection-specific resource assignments |
| `resource_usage_tracking` | Track who accessed what and when |

**Resource Types:**
- `document` — PDF, Word, etc.
- `link` — External URL
- `video` — Video embed or file
- `image` — Image file
- `template` — Downloadable template
- `cheatsheet` — Quick reference
- `report` — Analysis or report

**Visibility System:**
| Visibility | Who Can Access |
|-----------|---------------|
| `private` | Only the creator |
| `enrolled` | Users enrolled in linked programs |
| `public` | All authenticated users |

Enforced server-side by `can_access_resource()` RLS function.

**Credit-Gated Resources:**
Resources can optionally cost credits:
- `is_consumable = true` → accessing deducts credits
- `credit_cost` → number of credits per access
- `feature_key` → user must have this feature via their plan

**Module Assignment:**
Resources are assigned to modules via `module_client_content_resources` with a `section_type`:
- `context` — background material before the module
- `during` — reference material during the module
- `reflection` — post-module reflection resources

**Data Flow:**
1. Admin uploads resource or links external URL
2. Sets resource_type, visibility, downloadable flag
3. Optionally sets credit cost and feature_key
4. Links to programs and tiers (access control)
5. Tags with skills and categories
6. Assigns to modules with section_type
7. Client sees resource if visibility + program + tier + feature checks pass
8. If consumable, system deducts credits on access
9. Usage tracked in `resource_usage_tracking`

**Storage bucket:** `resource-library`

**Admin UI:** Resource Library Management (CRUD, visibility dropdown: Private/Enrolled/Public), Resource Categories Management, Resource Collections Management
**Client UI:** My Resources page (filtered by enrollment + visibility)

**Dependencies:**
- Optional: features (feature_key), programs (resource_library_programs), plans (min_plan_tier)
- Used by: program_modules (module_type = 'resource'), module_client_content_resources

---

## How Module Types Connect to Feature Areas

When a program module is created, its `module_type` determines which feature system handles it:

| Module Type | Feature Area | Key Tables | What Happens |
|------------|-------------|-----------|--------------|
| `session` | Sessions | `module_sessions`, `sessions` or `group_sessions` | Admin creates/links a session, client books via Cal.com |
| `assignment` | Assignments | `module_assignment_configs`, `module_assignments` | System creates assignment instances, client submits, instructor grades |
| `reflection` | Resources + Scenarios | `module_reflection_resources`, `module_client_content_resources` | Client accesses reflection resources and prompts |
| `resource` | Resources | `module_client_content_resources` | Client views/downloads assigned resources |
| `content` | Generic Content | `module_client_content_resources` | Generic content modules |

Additionally, **scenarios** can be linked to any module via `scenario_assignments.module_id`, and **assessments** can be linked via `program_modules.capability_assessment_id` or `module_assignment_types.scoring_assessment_id`.

---

## Storage Buckets Reference

| Bucket | Feature Area | Purpose |
|--------|-------------|---------|
| `module-assignment-attachments` | Assignments | Client file uploads during submission |
| `module-client-content` | Modules | Module-level content files |
| `module-reflection-resources` | Reflections | Reflection resource files |
| `coach-feedback-attachments` | Coaching | Coach feedback file uploads |
| `resource-library` | Resources | Resource library file storage |
| `goal-resources` | Goals | Goal-related file uploads |
| `task-note-resources` | Tasks | Task note attachments |
| `development-item-files` | Development | Development item uploads |
| `program-logos` | Programs | Program and badge images |
| `avatars` | Users | Profile pictures |
| `email-assets` | Email | Email template assets |
| `psychometric-assessments` | Psychometric | Client-uploaded PDF results |
| `session-attachments` | Sessions | Session-related file uploads |
| `scenario-attachments` | Scenarios | Scenario-related files |
| `wheel-pdfs` | Wheel of Life | Generated Wheel PDF exports |

---

## External Service Configuration Summary

| Service | When Needed | What to Configure | Env Vars |
|---------|-------------|-------------------|----------|
| **Stripe** | Layer 2 (plan prices) + Layer 3B (credit packages) | Create products & prices in Stripe Dashboard, copy IDs to DB | `STRIPE_SECRET_KEY` |
| **Cal.com** | Layer 3A (session scheduling) | Create event types in Cal.com org, map to session types in admin UI | `CALCOM_API_KEY`, `CALENDAR_HMAC_SECRET` |
| **Resend** | Layer 3C (email notifications) | Already configured, single API key + domain | `RESEND_API_KEY` |
| **Vertex AI** | AI features (credits system) | Already configured, GCP project + service account | `GCP_SERVICE_ACCOUNT_KEY`, `GCP_PROJECT_ID`, `GCP_LOCATION` |
| **TalentLMS** | Layer 4 (course modules) | Setup courses, configure webhook for xAPI | `TALENTLMS_API_KEY`, `TALENTLMS_WEBHOOK_SECRET`, `TALENTLMS_DOMAIN` |
| **Circle** | Community SSO | Setup community, configure headless auth | `CIRCLE_API_KEY`, `CIRCLE_COMMUNITY_ID`, `CIRCLE_COMMUNITY_DOMAIN`, `CIRCLE_HEADLESS_AUTH_TOKEN` |

---

## Key Dependency Chains (what breaks if something is missing)

```
Missing plans           → Users can't be assigned a tier → No feature access
Missing features        → Plan features can't be mapped → Entitlements empty
Missing plan_features   → Users have plans but no feature limits → Everything blocked
Missing plan_prices     → Subscription checkout fails (no Stripe price to charge)
Missing session_types   → Can't create sessions → Scheduling broken
Missing Cal.com mapping → Session types exist but can't book → "No event type" error
Missing credit_services → Actions don't know their credit cost → Deductions fail
Missing program_plans   → Programs have no in-program feature gating
Missing platform_terms  → ToS gate blocks ALL users from dashboard
Missing assignment_types       → Assignment modules have no form structure → Clients can't submit
Missing assignment_configs     → Assignment types not linked to modules → No assignments created
Missing scenario_categories    → Can't create scenario templates
Missing scenario_templates     → Instructors can't assign scenarios to students
Missing scoring_matrix         → compute-assessment-scores returns empty results (assessment_definitions only)
Missing capability_domains     → Capability assessment has no questions to rate → Empty form
Missing assessment_dimensions  → Assessment definition has no scoring dimensions → No scores computed
Missing assessment_families    → Capability assessments ungrouped (non-breaking, just UI organization)
Missing psychometric catalog   → Clients see empty Explore Assessments page
Missing resource_categories    → Resources have no categorization
Missing module_sessions        → Session modules have no linked session → Nothing to book
Missing module_resources       → Resource modules have no content to display
```

---

## Entitlement Resolution (how it all comes together)

The `useEntitlements` hook merges **5 sources** at runtime. For each feature, the **highest limit wins**:

1. **Subscription plan features** — from `plan_features` via user's `profiles.plan_id`
2. **Program plan features** — from `program_plan_features` via enrollment's `program_plan_id`
3. **User add-ons** — manual feature grants (admin can give individual users extra access)
4. **Track-specific allocations** — track membership can provide additional features
5. **Org-sponsored features** — organization can sponsor features for their members

Credits are **additive**: `plans.credit_allowance` + `program_plans.credit_allowance` + top-ups.

---

## Quick Reference: Admin Configuration Checklist

Use this checklist when setting up a new environment or verifying configuration.

### Layer 1 — Foundations
- [ ] **System settings** — AI limits, platform name, support email, timezone
- [ ] **Module types** — 5 types exist (session, assignment, reflection, resource, content)
- [ ] **Tracks** — CTA and Leadership tracks created
- [ ] **Wheel categories** — 10 categories
- [ ] **Assessment categories** — 6 categories (Personality, Aptitude, Career, EI, Leadership, Other)

### Layer 2 — Plans & Features
- [ ] **Features** — All 34 features created with correct keys
- [ ] **Plans** — 7 plans with correct tier levels and credit allowances
- [ ] **Plan features** — Every plan has feature mappings with limits
- [ ] **Plan prices** — Purchasable plans have Stripe price IDs (Stripe products created)

### Layer 3A — Sessions
- [ ] **Session types** — 8 types with feature_key links
- [ ] **Session type roles** — Roles defined for complex session types (review board, workshop, mastermind, peer coaching, webinar)
- [ ] **Cal.com mappings** — Each session type mapped to a Cal.com event type

### Layer 3B — Credits
- [ ] **Credit services** — 14 services with credit costs and feature links
- [ ] **Credit packages** — Individual (3) and org (3) packages defined

### Layer 3C — Notifications
- [ ] **Notification categories** — 8 categories
- [ ] **Notification types** — 31 types under categories with email_template_key links

### Layer 3D — Assessments (three systems)

**Capability Assessments:**
- [ ] **Assessment families** — Group related capability assessments (optional but recommended)
- [ ] **Capability assessments** — At least one assessment with mode (self/evaluator/both), scale, pass/fail config
- [ ] **Capability domains** — Competency areas per assessment with order_index
- [ ] **Domain questions** — Questions per domain (slider-rated 1–N)
- [ ] **Group peer assessments** — Configured per group if peer evaluation is used

**Assessment Definitions (Public/Self):**
- [ ] **Assessment definitions** — At least one definition with slug, description, is_active
- [ ] **Assessment dimensions** — Scoring dimensions (what gets measured)
- [ ] **Questions with options** — Multiple-choice questions with answer options
- [ ] **Scoring matrix** — `assessment_option_scores` mapping each option to dimension scores (confidential)
- [ ] **Interpretations** — `assessment_interpretations` with score range conditions and result text

**Psychometric Assessments:**
- [ ] **Psychometric catalog** — Entries with name, provider, category, cost, external_url
- [ ] **Feature gating** — Optional feature_key per assessment for plan-based access

### Layer 3E — Scenarios
- [ ] **Scenario categories** — Categories with color and display order
- [ ] **Scenario templates** — At least one template with sections and paragraphs
- [ ] **Paragraph question links** — Link section paragraphs to capability assessment questions (for scoring)

### Layer 3F — Resources & Feedback
- [ ] **Resource categories** — Categories for the resource library
- [ ] **Resource collections** — Optional grouped collections with ordered items
- [ ] **Coach feedback templates** — Module feedback templates for structured coach feedback

### Layer 4 — Programs
- [ ] **Program plans** — At least one program plan with features
- [ ] **Program plan features** — Feature mappings with limits for each program plan
- [ ] **Programs** — Programs created with correct min_plan_tier and default_program_plan
- [ ] **Program tier plans** — Map tier names to program plans per program (if multiple tiers offered)
- [ ] **Program modules** — Modules linked to programs with correct types and feature keys

### Layer 4 — Module Linking
- [ ] **Assignment types** — At least one assignment type with JSON structure defined
- [ ] **Module assignment configs** — Assignment types linked to assignment-type modules
- [ ] **Module sessions** — Sessions linked to session-type modules, Cal.com events mapped
- [ ] **Module resources** — Resources assigned to resource-type modules with section_type (context/during/reflection)
- [ ] **Module assessments** — `capability_assessment_id` set on modules that include assessments
- [ ] **Scenario assignments** — Scenarios assigned to students/modules

### Layer 5 — Platform & Users
- [ ] **Platform terms** — Current terms exist (is_current = true)
- [ ] **Demo users** — Test users with correct roles and plan assignments
- [ ] **Storage buckets** — All 15 buckets exist (including `module-assessment-attachments`)

---

## Data Population Plan — New Environment Setup Sequence

Follow this exact order when populating a new environment from scratch. Each step depends on the previous ones.

### Step 1: Run Seed File
```bash
# Handles Layers 1-3 automatically: system settings, module types, tracks, wheel categories,
# assessment categories, features, plans, plan features, session types, session type roles,
# credit services, credit packages, notification categories, notification types,
# sample programs with modules, demo users
supabase db reset    # runs all migrations + seed.sql
```

### Step 2: External Services (parallel with Step 3)
- [ ] Create Stripe products + prices → copy price IDs into `plan_prices` table
- [ ] Create Cal.com event types → map to session types via admin UI
- [ ] Set all environment variables (see `docs/ENVIRONMENT_CONFIGURATION.md`)
- [ ] Configure Resend SMTP in Supabase Dashboard (Authentication → Email → SMTP)
- [ ] Configure Auth Email Hook → `send-auth-email` in Supabase Dashboard
- [ ] Set `SEND_EMAIL_HOOK_SECRET` env var

### Step 3: Assessment Configuration (parallel with Step 2)

**Capability Assessments:**
1. Create assessment families (optional grouping)
2. Create capability assessments (name, mode, scale, pass/fail settings)
3. Add domains per assessment (ordered competency areas)
4. Add questions per domain (slider-rated)
5. Configure group peer assessments if peer evaluation is used

**Assessment Definitions (Public/Self):**
1. Create assessment definitions (name, slug, is_active)
2. Add dimensions (scoring categories)
3. Add questions with multiple-choice options
4. Configure scoring matrix: map each option to dimension scores
5. Write interpretations with score range conditions

**Psychometric Catalog:**
1. Add psychometric assessment entries (name, provider, category, cost, URL)
2. Optionally set feature_key for plan gating

### Step 4: Scenario Configuration
1. Create scenario categories
2. Create scenario templates with sections and paragraphs
3. Link paragraphs to capability assessment questions (for domain scoring reference)
4. Set locking flags on finalized templates

### Step 5: Resource Library
1. Create resource categories
2. Upload resources with visibility (private/enrolled/public) and optional credit cost
3. Create resource collections and add items (ordered)
4. Tag resources with skills

### Step 6: Programs & Modules
1. Create program plans with feature mappings
2. Create programs with min_plan_tier, credit_cost, default_program_plan
3. Create program tier plans (if multiple tiers)
4. Add modules to programs:
   - `session` modules → link to session types
   - `assignment` modules → link to assignment types via module_assignment_configs
   - `reflection` modules → assign reflection resources
   - `resource` modules → assign resources with section_type
5. Set `capability_assessment_id` on modules that include assessments
6. Assign scenarios to modules/enrollments

### Step 7: Coach Feedback Templates
1. Create module feedback templates for structured coach feedback

### Step 8: Platform Terms & Demo Users
1. Create platform terms (is_current = true) — blocks all access if missing
2. Create demo users with roles, plan assignments, enrollments
3. Verify end-to-end: login → dashboard → program → module → assessment → session booking

### Verification Checklist
After population, verify each path works:
- [ ] Client login → dashboard → browse programs → enroll → access modules
- [ ] Client takes capability assessment (self-assessment mode)
- [ ] Public assessment at `/public-assessment/:slug` → email capture → scoring → PDF
- [ ] Instructor creates scenario assignment → client responds → instructor evaluates
- [ ] Session booking via Cal.com integration
- [ ] Credit deduction on AI use / session booking
- [ ] Notification delivery (email + in-app)
- [ ] Coach views assigned clients → provides module feedback
- [ ] Org admin invites member → member accepts → org dashboard shows member
- [ ] Psychometric assessment: browse catalog → express interest → admin sees registration
- [ ] Resource access: enrolled resource visible → public resource visible → private resource hidden
- [ ] Wheel of Life: client accesses from dashboard → rates categories → sees radar chart

---

## Feature Area: Coaching & Staff Configuration

### Coach Assignment Model

Coaches and instructors require data configuration at multiple levels:

**Tables:**

| Table | Purpose |
|-------|---------|
| `user_roles` | Assigns `coach` or `instructor` role to a user |
| `program_coaches` | Links coaches to programs (which programs they coach in) |
| `client_coaches` | Links a specific coach to a specific client (direct assignment) |
| `coach_instructor_requests` | Client requests for coach assignment (admin reviews) |

**Configuration sequence:**
1. Admin creates user with `coach` or `instructor` role
2. Admin assigns coach to programs via `program_coaches`
3. Admin assigns coach to specific clients via `client_coaches`
4. OR: client requests coach via `RequestCoachInstructorDialog` → admin approves

**What coaches need configured:**
- Profile: bio, specialties, meeting preferences, calendar URL, avatar, timezone
- Qualifications: which module types instructor can teach
- Program assignments: which programs they coach in
- Client assignments: which clients they're assigned to

**Current gaps (documented in ISSUES_AND_IMPROVEMENTS.md Part 5):**
- No coach verification workflow (no `verification_status` on profiles)
- No native Cal.com availability management
- No specialization tags for matching
- No coach performance metrics/dashboard
- All coaches must be admin-created (no self-registration application form)

### Organization Configuration

**Tables:**

| Table | Purpose |
|-------|---------|
| `organizations` | Org record (name, slug, industry, size_range) |
| `organization_members` | Links users to orgs with role (org_admin/org_manager/org_member) |
| `org_invitations` | Pending email invitations (7-day expiry tokens) |
| `org_credit_balances` | Organization credit pool |
| `org_sponsored_enrollments` | Org pays for member enrollments |
| `member_sharing_consent` | Granular privacy controls per member |

**Configuration sequence:**
1. Admin creates organization with name, slug, industry, size
2. Org admin invited via `send-org-invite` → accepts at `/accept-invite?token=...`
3. Org admin invites members with roles
4. Org purchases credit packages and/or platform tier (Essentials/Professional)
5. Org sponsors member enrollments (deducts from org credit balance)
6. Members configure sharing consent (profile, enrollments, progress, assessments, goals)

**Current gaps (documented in ISSUES_AND_IMPROVEMENTS.md Part 5):**
- No org onboarding wizard
- No org-level branding (logo, accent color)
- No org SSO (SAML/OIDC)
- No org data export (CSV/PDF)
- No seat management warnings
- No org welcome email
- No trial/demo mode

---

## Feature Area: Integration-Specific Data

### Partially Implemented Integrations

These external services have varying levels of data integration. See `docs/INTEGRATION_SETUP_GUIDE.md` for full setup instructions.

| Integration | Data Tables | Status | Config Required |
|------------|-----------|--------|----------------|
| **Circle** (Community) | `circle_community_sso` (implied by edge function) | SSO only — no content sync | `CIRCLE_API_KEY`, `CIRCLE_COMMUNITY_ID`, `CIRCLE_COMMUNITY_DOMAIN`, `CIRCLE_HEADLESS_AUTH_TOKEN` |
| **TalentLMS** (Courses) | `talentlms_user_mappings` (implied), xAPI progress via webhook | SSO + progress sync — no course discovery in Hub | `TALENTLMS_API_KEY`, `TALENTLMS_WEBHOOK_SECRET`, `TALENTLMS_DOMAIN` |
| **Lucid** | Admin maps user → Lucid URL | URL launcher only | Admin UI mapping |
| **Google Drive** | Admin maps user → folder URL | URL launcher only | Admin UI mapping |
| **Miro / Mural** | None | Sidebar placeholder only — no backend | N/A |

**Key insight:** Circle and TalentLMS have env vars and edge functions but minimal data tables. Deepening these integrations (embedding community feed, showing course catalog) would require new tables and sync jobs.

---

## Feature Area: Feedback & Goal Tracking

### 9 Feedback Mechanisms (Not Unified)

The platform has 9 distinct feedback mechanisms stored across different tables:

| Mechanism | Storage Table | Source → Target |
|-----------|-------------|----------------|
| Scenario evaluation | `paragraph_evaluations`, `scenario_assignments.overall_notes` | Instructor → Client |
| Module feedback | `coach_module_feedback` (with templates + attachments) | Coach → Client |
| Assignment grading | `module_assignments.overall_score/comments` | Instructor → Client |
| Assessment interpretations | `assessment_responses.interpretations` | System → Client |
| Decision AI insights | Via `decision-insights` edge function | AI → Client |
| Reflection prompts | Via `generate-reflection-prompt` edge function | AI → Client |
| Goal comments | `goal_comments` | Coach → Client |
| Session feedback | Unclear implementation | Post-session |
| Coach general | Via module feedback templates | Coach → Client |

**Current gap:** No unified feedback table or view. Client must navigate to each feature area to find feedback. See ISSUES_AND_IMPROVEMENTS.md Part 9 (§9.7) for unified feedback hub recommendation.

### Goal System Data

| Table | Purpose |
|-------|---------|
| `goals` | Client goals with category, status, target date |
| `goal_milestones` | Sub-goals/milestones within a goal |
| `goal_resources` | Files attached to goals |

**Goal categories:** Uses `goal_category` enum. Goals are not feature-gated — available to all authenticated users.

**Current gap:** Goals are not connected to assessment results. Low-scoring assessment domains don't prompt goal creation. See ISSUES_AND_IMPROVEMENTS.md Part 9 (§9.5.3).

---

## Future Data Tables (Roadmap)

These tables will be needed as the enhancement roadmap (ISSUES_AND_IMPROVEMENTS.md Part 11) is implemented. Listed here for planning — none exist yet.

| Roadmap Phase | Feature | New Table / Field | Purpose |
|---------------|---------|-------------------|---------|
| Phase 1 | Onboarding | `profiles.onboarding_completed` | Track whether client completed first-login checklist |
| Phase 3 | Streaks/XP | `engagement_streaks` | Daily/weekly streak tracking per user |
| Phase 3 | Streaks/XP | `user_xp` | XP points and level per user |
| Phase 3 | Activity feed | `activity_feed_events` | Social feed events (completed module, set goal, etc.) |
| Phase 3 | Smart notifications | `user_activity_patterns` | Per-user engagement timing data for ML-driven send times |
| Phase 4 | Coach matching | `coach_specializations` | Specialization tags per coach |
| Phase 4 | Coach matching | `matching_preferences` | Client preferences for coach specializations |
| Phase 5 | Coach registration | `coach_applications` | Self-registration applications with admin review |
| Phase 5 | Org self-service | `org_applications` | Self-service org creation with admin review |
| Phase 5 | Access requests | `access_requests` | For roleless OAuth users requesting access |
| Phase 5 | Coach verification | `profiles.verification_status` | Pending/verified/rejected verification state |
| Phase 5 | Org trials | `organizations.trial_ends_at`, `.is_trial` | Trial period tracking |
| Phase 6 | Org branding | `org_branding` | Logo, accent color, custom display name per org |
| Phase 6 | Seat warnings | `organizations.max_sponsored_seats`, `.seat_warning_threshold` | Seat limit tracking + alert threshold |
| Phase 7 | Flexible pacing | `client_enrollments.pacing_mode` | Self-paced vs cohort-paced toggle |
| Phase 7 | Module ordering | `program_modules.is_sequential`, `module_progress.unlock_override` | Allow non-sequential module access |
| Phase 9 | Micro-learning | `module_types` enum: `micro_learning` | New module type for 2-5 min content |
| M12 | Resource ratings | `resource_ratings` | 1-5 star rating + review text per resource |
| M4 | Assessment→Goal | `goals.assessment_snapshot_id` | Link goal to assessment result that prompted it |
