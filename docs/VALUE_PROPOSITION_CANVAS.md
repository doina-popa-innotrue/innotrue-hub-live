# InnoTrue Hub — Value Proposition Canvas

> Based on the Strategyzer Value Proposition Canvas framework.
> Last updated: 2026-02-18
>
> This document maps the platform's value proposition against four customer segments: coaching/development organizations (B2B buyers), clients/learners, coaches/instructors, and corporate L&D teams. Each segment has its own Customer Profile (jobs, pains, gains) and a corresponding Value Map (products/services, pain relievers, gain creators).

---

## How to Read This Document

The Strategyzer Value Proposition Canvas has two sides:

**Customer Profile (right side):**
- **Customer Jobs** — what the customer is trying to accomplish in their work or life
- **Pains** — bad outcomes, risks, and obstacles related to those jobs
- **Gains** — the outcomes and benefits they desire

**Value Map (left side):**
- **Products & Services** — what we offer that helps them do their jobs
- **Pain Relievers** — how we specifically address their pains
- **Gain Creators** — how we create the outcomes they desire

**Fit** is achieved when the Value Map addresses the most important jobs, relieves the most severe pains, and creates the most desired gains.

---

## Segment 1: Coaching & Development Organizations (B2B Buyer)

> The professional development firm, coaching practice, or certification body that purchases the platform to deliver their programs. This is the primary buyer.

### Customer Profile

#### Customer Jobs

| # | Job | Type |
|---|-----|------|
| J1 | Deliver structured development programs to clients at scale | Core functional |
| J2 | Manage a roster of coaches and instructors across multiple programs | Core functional |
| J3 | Track client progress, completion, and learning outcomes to demonstrate ROI | Core functional |
| J4 | Create differentiated, high-quality learning experiences that justify premium pricing | Core functional |
| J5 | Onboard new coaches and instructors quickly without heavy training | Supporting |
| J6 | Bill clients and organizations through subscriptions and credit-based access | Supporting |
| J7 | Maintain data privacy and compliance (especially EU/GDPR) | Supporting |
| J8 | Grow their business by attracting new clients and organizations | Social/emotional |
| J9 | Establish themselves as innovative (technology-forward, AI-enabled) | Social/emotional |
| J10 | Reduce operational overhead — spend time on coaching, not on admin | Core functional |

#### Pains

| # | Pain | Severity |
|---|------|----------|
| P1 | **Tool fragmentation** — using 4-6 separate tools (LMS, scheduling, forms, email, billing, assessments) creates admin overhead and data silos | Extreme |
| P2 | **No unified view of client progress** — data scattered across TalentLMS, Google Sheets, Cal.com, email threads | Extreme |
| P3 | **Content delivery friction** — Rise content via TalentLMS requires 5-7 clicks and 2 context switches; clients disengage | High |
| P4 | **Instructor routing complexity** — assigning the right instructor to the right client on the right module is manual and error-prone | High |
| P5 | **Can't demonstrate ROI** — no aggregated data on client outcomes, assessment progress, or engagement patterns | High |
| P6 | **Scaling is manual** — enrolling 30 clients in a cohort, assigning coaches, setting up sessions is repetitive work | High |
| P7 | **Assessment results are disconnected** — assessment data doesn't feed into coaching conversations, goal setting, or program design | Medium |
| P8 | **Generic AI tools used outside the platform** — clients use ChatGPT/Claude for development conversations with no guardrails, no continuity, and no coach visibility | Medium |
| P9 | **Billing complexity** — managing plan tiers, credit consumption, organization-sponsored access, and Stripe across different clients | Medium |
| P10 | **Coach quality variability** — no structured onboarding, no performance visibility, no standardized evaluation rubrics | Medium |

#### Gains

| # | Gain | Importance |
|---|------|------------|
| G1 | **Single platform** for all program delivery — learning content, assessments, coaching, scheduling, billing, analytics | Must-have |
| G2 | **Quantifiable client outcomes** — assessment score progression, goal completion rates, engagement metrics | Must-have |
| G3 | **Professional client experience** — seamless, branded, no tool-switching for learners | Must-have |
| G4 | **Scalable program operations** — enroll a cohort in minutes, not hours | Expected |
| G5 | **AI-enhanced coaching** — contextual, bounded, coach-connected AI that augments human coaching | Expected |
| G6 | **Flexible monetization** — subscriptions, credits, organization sponsorship, per-program pricing, all in one system | Expected |
| G7 | **Multi-instructor programs** — assign, route, and manage multiple coaches/instructors per program with clear responsibilities | Nice-to-have |
| G8 | **Assessment-driven development** — weak domains automatically suggest goals, coach gets briefed before sessions | Nice-to-have |
| G9 | **Content authoring flexibility** — embed Rise content directly, use xAPI for rich learning analytics | Nice-to-have |
| G10 | **Organization/corporate client portal** — let corporate clients self-manage their members, view progress, control access | Nice-to-have |

### Value Map

#### Products & Services

| # | Offering | Segment Jobs Addressed |
|---|---------|----------------------|
| S1 | **Program & module system** — structured programs with 5 module types (content, assignment, session, reflection, resource), cohort support, badge milestones | J1, J4 |
| S2 | **3-tier staff assignment** — program → module → enrollment-level instructor/coach assignment with automatic Cal.com booking URL resolution | J2, J7 |
| S3 | **3 assessment systems** — capability assessments (slider + radar), definition assessments (confidential server-side scoring), psychometric catalog (document management) | J3, J4 |
| S4 | **Scenario-based learning** — multi-section exercises with rubrics, revision workflows, AI debrief, certification thresholds | J1, J4 |
| S5 | **Credits, plans & entitlements** — 7 subscription tiers, program plans, 5-source entitlement merging, deny overrides, consumable features, Stripe billing | J6 |
| S6 | **Organization management** — org admin portal, member management, sponsored enrollments, credit pools, privacy controls | J8, J10 |
| S7 | **AI coaching features** — reflection prompts, decision insights, course recommendations (Vertex AI, EU-hosted, credit-gated, consent-required) | J4, J9 |
| S8 | **Teaching dashboard** — 13 instructor/coach pages with pending assignments, client progress, scenario evaluation, badge approval, group sessions | J2, J5 |
| S9 | **Session & scheduling system** — 8 session types, 10 roles, Cal.com integration, Google Calendar sync, attendance tracking | J1, J2 |
| S10 | **Notification & email system** — 25+ types, 8 categories, email queue with retry, in-app notifications, user-configurable preferences | J1, J10 |

#### Pain Relievers

| # | Pain Relieved | How |
|---|--------------|-----|
| PR1 | **P1: Tool fragmentation** → Single platform replaces separate LMS + scheduling + forms + billing + assessment tools. All data in one PostgreSQL database with 369+ tables. | Eliminates tool-switching entirely |
| PR2 | **P2: No unified client view** → Client detail page shows enrollment, progress, assessments, feedback, goals, and coach notes in one place. Teaching dashboard aggregates pending work. | One-click full client picture |
| PR3 | **P3: Content delivery friction** → Direct Rise Web/xAPI embedding (planned Tier 1: iframe embed, Tier 2: xAPI with auto-tracking). Zero clicks from module to content. | Reduces 5-7 clicks to zero |
| PR4 | **P4: Instructor routing** → 3-tier hierarchy resolves automatically. `useModuleSchedulingUrl` walks enrollment → module → program level to find the right instructor. Staff assignment on all modules (not just individualized). | Automatic routing, no manual lookup |
| PR5 | **P5: Can't demonstrate ROI** → Assessment evolution charts (radar + line), module completion rates, engagement streaks, feedback aggregation. Assessment-driven goal suggestions connect scores to action. | Data-backed outcome measurement |
| PR6 | **P6: Scaling is manual** → Atomic enrollment RPC (`enroll_with_credits`), cohort infrastructure with session scheduling, batch badge approval, group auto-management. | Enrollment in one transaction |
| PR7 | **P7: Disconnected assessments** → Weak domains automatically suggest goals. Assessment context passed to AI prompts. Coach sees pre-session briefs. Capability assessments link to scenarios and assignments via `scoring_assessment_id`. | Assessment → coaching → goals loop |
| PR8 | **P8: Uncontrolled external AI** → Platform AI is context-rich (knows goals, assessments, program), output-constrained, coach-visible, and GDPR-compliant (EU data residency). Input truncation prevents oversized prompts. | Guided AI instead of generic AI |
| PR9 | **P9: Billing complexity** → Unified entitlements system merges 5 sources. `is_purchasable` flag controls what appears in checkout. Deny overrides let orgs restrict features. Plan prices linked to Stripe. | One system for all billing models |
| PR10 | **P10: Coach variability** → Structured teaching dashboard with rubric-based grading, scenario evaluation rubrics (`rubric_text`), standardized empty states, feedback templates. | Consistent coaching quality |

#### Gain Creators

| # | Gain Created | How |
|---|-------------|-----|
| GC1 | **G1: Single platform** → 160+ pages covering all roles. 71 edge functions for backend logic. 17 storage buckets for all file types. Everything integrated. | Comprehensive, not assembled |
| GC2 | **G2: Quantifiable outcomes** → Capability snapshots track score evolution over time. Radar charts compare self vs evaluator. Module completion rates per cohort. Credit consumption analytics. | Built-in outcome dashboards |
| GC3 | **G3: Professional client experience** → PWA-ready, responsive UI. Onboarding welcome card. Journey progress widget. Unified feedback inbox (`/feedback`). Resource unlock dialogs. | Polished learner-facing UX |
| GC4 | **G4: Scalable operations** → Cohort infrastructure (sessions, groups, member management). Enrollment codes with cohort auto-assignment (Phase 5 planned). Batch operations throughout admin. | Built for cohort-scale programs |
| GC5 | **G5: AI-enhanced coaching** → 4 AI functions today (reflections, recommendations, decision insights, admin analytics). Anti-hallucination design: input grounding, output constraints, source restriction. 5 more AI features designed (learning companion, pre-session prep, scenario debrief, goal nudges, conversational dashboard). | AI that augments, doesn't replace, coaches |
| GC6 | **G6: Flexible monetization** → 6 plan tiers (Free → Elite + Programs). Credit packages (individual + org). Program-level pricing. Feature-level gating. Stripe checkout + annual pricing. Alumni lifecycle with grace period. | Multiple revenue models from day one |
| GC7 | **G7: Multi-instructor programs** → 3-tier staff hierarchy. Per-client per-module instructor assignment. Broadcast notifications for team coverage. Multi-instructor grading guide built into documentation. | Enterprise-grade instructor management |
| GC8 | **G8: Assessment-driven development** → `CapabilitySnapshotView` surfaces weak domains with "Create Goal" action. Goals pre-filled with assessment context. Coach sees assessment evolution. | Closes the assessment-to-action gap |

---

## Segment 2: Clients / Learners

> The individual going through a professional development program — a mid-career professional, a young professional exploring career direction, a leader in a certification track.

### Customer Profile

#### Customer Jobs

| # | Job | Type |
|---|-----|------|
| J1 | Complete my professional development program and earn certification | Core functional |
| J2 | Understand my strengths, weaknesses, and growth areas | Core functional |
| J3 | Set meaningful goals and make progress on them with accountability | Core functional |
| J4 | Get personalized coaching and feedback on my work | Core functional |
| J5 | Make better decisions in my career and leadership | Supporting |
| J6 | Connect with peers going through similar development journeys | Social |
| J7 | Demonstrate my growth to employers, mentors, or myself | Social/emotional |
| J8 | Reflect on my development journey and build self-awareness | Emotional |
| J9 | Access learning content when and where it works for me | Supporting |
| J10 | Feel that my investment of time and money is worthwhile | Emotional |

#### Pains

| # | Pain | Severity |
|---|------|----------|
| P1 | **Too many tools** — logging into TalentLMS for content, Cal.com for booking, email for feedback, a different app for goals | Extreme |
| P2 | **No continuity** — each coaching conversation starts from scratch; coach doesn't remember my goals or assessment results | High |
| P3 | **Feedback is scattered** — assignment grades in one place, coach feedback in another, scenario evaluations in a third | High |
| P4 | **Can't see my progress** — no visual dashboard showing how far I've come, what's improved, what's next | High |
| P5 | **Assessments feel disconnected** — I take an assessment, see a score, but don't know what to do with it | Medium |
| P6 | **Sessions are hard to book** — multiple clicks, unclear which instructor to book with, scheduling friction | Medium |
| P7 | **Content consumption is clunky** — redirected to external LMS, context switches break my learning flow | Medium |
| P8 | **AI tools outside the program have no context** — ChatGPT doesn't know my goals, program, or coach | Medium |
| P9 | **Overwhelmed by long-term plans** — "improve communication skills over 6 months" is too abstract | Low-Medium |
| P10 | **No social accountability** — I'm doing this alone; nobody checks in on my progress | Low-Medium |

#### Gains

| # | Gain | Importance |
|---|------|------------|
| G1 | **One place for everything** — content, feedback, goals, sessions, assessments, all in one login | Must-have |
| G2 | **Visible progress** — see how I've grown over time (assessment evolution, goals completed, modules finished) | Must-have |
| G3 | **Personalized experience** — coaching, content, and AI that know my specific situation | Expected |
| G4 | **Quick, relevant feedback** — know what I did well and what to improve, without waiting weeks | Expected |
| G5 | **Clear next steps** — always know what to do next in my program | Expected |
| G6 | **Flexible scheduling** — book sessions easily with the right coach/instructor | Nice-to-have |
| G7 | **Peer connection** — learn alongside others, share progress, get accountability | Nice-to-have |
| G8 | **AI-assisted reflection** — prompts that help me think deeper, not generic questions | Nice-to-have |

### Value Map

#### Products & Services

| # | Offering |
|---|---------|
| S1 | **Program journey view** — ordered modules with progress tracking, completion badges, journey widget on dashboard |
| S2 | **Unified feedback inbox** — `/feedback` page aggregating scenario evaluations, module feedback, assignment grading, goal comments into one chronological view |
| S3 | **Capability assessments** — slider-based self-assessment with radar charts showing evolution across snapshots over time |
| S4 | **Goal system with assessment integration** — weak assessment domains auto-suggest goals with pre-filled context |
| S5 | **AI reflection prompts** — contextual questions generated from goals, assessments, program progress, and coach notes |
| S6 | **Session booking** — one-click Cal.com booking that automatically resolves to the correct instructor via 3-tier hierarchy |
| S7 | **Scenario exercises** — multi-section practice with AI debrief, instructor evaluation, and revision workflow |
| S8 | **Decision toolkit** — structured decision logging with AI-powered pattern analysis and outcome tracking |
| S9 | **Groups & peer collaboration** — shared tasks, check-ins with mood tracking, peer assessments, group sessions |
| S10 | **Resource library** — curated learning resources with credit-based unlocking and enrollment exemptions |

#### Pain Relievers

| # | Pain Relieved | How |
|---|--------------|-----|
| PR1 | **P1: Too many tools** → Everything is in the Hub: content (inline embed), scheduling (Cal.com one-click), feedback (unified inbox), goals, sessions. Single login, single dashboard. | One platform, one login |
| PR2 | **P2: No continuity** → AI knows user's goals, assessments, reflections, and program progress. Coach sees unified client view with history. Assessment evolution charts preserve longitudinal context. | Platform remembers everything |
| PR3 | **P3: Scattered feedback** → `useFeedbackInbox` aggregates 4 feedback sources. `RecentFeedbackWidget` on dashboard shows latest. Tab filtering by feedback type. | One inbox for all feedback |
| PR4 | **P4: Can't see progress** → Journey progress widget, onboarding welcome card with step tracking, capability radar charts showing growth over time, module completion percentages. | Visual growth dashboards |
| PR5 | **P5: Disconnected assessments** → Weak domains generate "Suggested Goals" with one-click creation. Goal title and description pre-filled from assessment context. Coach sees the same data. | Assessment → action in one click |
| PR6 | **P6: Booking friction** → `useModuleSchedulingUrl` resolves the correct instructor automatically. Client clicks "Book Session" → Cal.com opens with the right person's calendar. | One click to the right calendar |
| PR7 | **P7: Clunky content** → Direct Rise embed in iframe (Tier 1). Content loads inline inside the module page with zero context switches. | Content inside the learning flow |
| PR8 | **P8: AI without context** → Platform AI receives user's goals, assessments, reflections, and program content in every prompt. Output is structured, bounded, and coach-visible. EU data residency. | AI that knows your journey |

#### Gain Creators

| # | Gain Created | How |
|---|-------------|-----|
| GC1 | **G1: One place** → 54 client pages covering programs, assessments, goals, decisions, tasks, groups, sessions, resources, coaching, and community. PWA-ready for mobile. | Comprehensive learner workspace |
| GC2 | **G2: Visible progress** → Radar charts evolving over time, goal completion tracking, module progress bars, journey widget with step counts, badges as milestones. | Growth you can see and show |
| GC3 | **G3: Personalized** → Per-client instructor assignment (Tier 3). Individualized module content. AI prompts tailored to personal goals and assessment results. Credit-based access to premium resources. | Everything adapts to you |
| GC4 | **G4: Quick feedback** → Email notification when grading completes. Feedback inbox updates in real-time. Scenario revision workflow with instructor notes. Dashboard widget for recent feedback. | Feedback is never far away |
| GC5 | **G5: Clear next steps** → Module ordering in programs. "Suggested Goals" from assessments. AI-generated "what to focus on next" recommendations. Onboarding checklist for new users. | Always know the next step |
| GC6 | **G8: AI reflection** → `generate-reflection-prompt` uses rich context (goals, progress, assessments). 150-token constrained output. Socratic questioning design (asks, doesn't lecture). Connected to goal system. | Thoughtful AI, not generic AI |

---

## Segment 3: Coaches & Instructors

> The professionals who deliver programs, grade work, evaluate scenarios, and coach clients through the platform.

### Customer Profile

#### Customer Jobs

| # | Job | Type |
|---|-----|------|
| J1 | Grade client assignments and scenario submissions efficiently and fairly | Core functional |
| J2 | Track which clients need attention (falling behind, stalled goals, pending reviews) | Core functional |
| J3 | Prepare for coaching sessions with full client context | Core functional |
| J4 | Provide structured, consistent feedback across all clients | Core functional |
| J5 | Manage group sessions (scheduling, attendance, follow-up) | Supporting |
| J6 | See only my assigned clients and programs (not everyone else's) | Supporting |
| J7 | Maintain professional quality standards across evaluations | Supporting |
| J8 | Minimize admin work so I can focus on actual coaching/teaching | Emotional |

#### Pains

| # | Pain | Severity |
|---|------|----------|
| P1 | **Grading queue overload** — seeing ALL pending assignments across all programs with no way to filter "mine" | High |
| P2 | **No pre-session context** — going into a coaching call without knowing what the client has done since last time | High |
| P3 | **Inconsistent evaluation** — no standardized rubrics or scoring guidance, each instructor evaluates differently | Medium |
| P4 | **Empty dashboard confusion** — logging in for the first time and seeing empty pages with no guidance on what to do or expect | Medium |
| P5 | **Can't set up my profile** — no place to add bio, specialties, or scheduling URL | Medium |
| P6 | **Feedback is fire-and-forget** — I grade an assignment but don't know if the client read it or acted on it | Low-Medium |

#### Gains

| # | Gain | Importance |
|---|------|------------|
| G1 | **Clear work queue** — know exactly what needs my attention right now | Must-have |
| G2 | **Full client context** — see assessments, goals, progress, reflections before any interaction | Must-have |
| G3 | **Efficient grading** — rubric-based scoring with structured forms, not free-text | Expected |
| G4 | **Guided onboarding** — know how to get started when I first log in | Expected |
| G5 | **Feedback loop closure** — know that my feedback was received and acted upon | Nice-to-have |

### Value Map

#### Products & Services

| # | Offering |
|---|---------|
| S1 | **Teaching dashboard** — 5 stat cards, pending assignments (searchable/filterable), upcoming sessions, shared items |
| S2 | **Rubric-based grading** — assignment scoring linked to capability assessment domains and questions, with per-question notes |
| S3 | **Scenario evaluation** — section-by-section scoring (1-5), rubric text guidance, revision request workflow, response history |
| S4 | **Client progress page** — search/filter clients by name, email, program, status. Student detail with tabs: Overview, Notes, Reflections, Feedback, Assignments |
| S5 | **Staff notes system** — per-module instructor notes shared with other staff assigned to the same module |
| S6 | **Badge approval** — batch or individual, with credential URL support (e.g., Credly links) |
| S7 | **Group session management** — create, schedule, edit sessions, track attendance |

#### Pain Relievers

| # | Pain Relieved | How |
|---|--------------|-----|
| PR1 | **P1: Queue overload** → Assignments scoped by module/program assignment. Searchable and filterable. "My Queue" vs "All Pending" filtering planned. | See your assignments, not everyone's |
| PR2 | **P2: No pre-session context** → Client detail page with full history. Assessment evolution visible. Shared goals, decisions, and tasks shown in teaching dashboard. AI pre-session briefs designed (Feature B in roadmap). | Full context before every call |
| PR3 | **P3: Inconsistent evaluation** → `rubric_text` on paragraph-question links provides scoring guidance. Capability assessment domains give structured scoring dimensions. Feedback templates for modules. | Built-in rubrics and templates |
| PR4 | **P4: Empty dashboard confusion** → Onboarding welcome card planned (Gap 1 in coach onboarding). Enhanced empty states with "what to expect" context. Teaching FAQ planned. | Guided first-time experience |
| PR5 | **P5: Can't set up profile** → Coach profile fields (bio, specialties, scheduling URL) exist in data model. Dedicated profile setup UI planned (Gap 2 in coach onboarding). | Coach-specific profile setup |

#### Gain Creators

| # | Gain Created | How |
|---|-------------|-----|
| GC1 | **G1: Clear work queue** → Pending assignments widget with search, filter, sort. Programs tab showing module/client counts. 5 stat cards for quick status overview. | Dashboard tells you what needs doing |
| GC2 | **G2: Full client context** → Student detail page aggregates everything: enrollments, module progress, assessments, notes, reflections, feedback, assignments. All on one page. | One page, full picture |
| GC3 | **G3: Efficient grading** → Rubric-based scoring interface. Domain questions from capability assessments. Development items linked during grading. Grading guard prevents grading un-submitted work. | Structured, not free-form |
| GC4 | **G4: Guided onboarding** → Welcome card pattern established (client side). Coach version planned with 4 steps. Enhanced empty states provide "what's next" context. | Know what to do from day one |

---

## Segment 4: Corporate L&D / HR Teams (Organization Buyers)

> The corporate client who sponsors access for their employees. They care about oversight, compliance, ROI reporting, and employee engagement.

### Customer Profile

#### Customer Jobs

| # | Job | Type |
|---|-----|------|
| J1 | Provide professional development for our employees without building it ourselves | Core functional |
| J2 | Track employee participation, completion, and outcomes for reporting | Core functional |
| J3 | Control which features employees can access (enforce organizational policy) | Core functional |
| J4 | Manage costs — predict spending, control seat counts, handle billing centrally | Supporting |
| J5 | Onboard new employees into development programs quickly | Supporting |
| J6 | Protect employee data privacy (GDPR compliance, consent controls) | Supporting |
| J7 | Demonstrate ROI to leadership ("our investment in development is working") | Social/emotional |

#### Pains

| # | Pain | Severity |
|---|------|----------|
| P1 | **No organizational visibility** — can't see aggregate completion, engagement, or outcomes across all employees | High |
| P2 | **Can't enforce policy** — employees access features the org doesn't want (e.g., community platform, certain AI features) | High |
| P3 | **Billing is opaque** — can't predict or control costs, no central billing for the organization | Medium |
| P4 | **Manual member management** — adding/removing employees is admin-dependent, no self-service | Medium |
| P5 | **Privacy concerns** — worried about what data is collected and who can see employee development data | Medium |
| P6 | **No branded experience** — the platform doesn't feel like "ours" | Low |

#### Gains

| # | Gain | Importance |
|---|------|------------|
| G1 | **Org admin dashboard** — see all members, enrollments, and progress at a glance | Must-have |
| G2 | **Policy enforcement** — control which features are available to employees | Must-have |
| G3 | **Central billing** — one invoice, predictable costs, credit pool management | Expected |
| G4 | **Member self-management** — invite/remove members without platform admin intervention | Expected |
| G5 | **Privacy controls** — granular consent settings for what data is visible to whom | Expected |
| G6 | **ROI reporting** — exportable data on employee development outcomes | Nice-to-have |

### Value Map

#### Products & Services

| # | Offering |
|---|---------|
| S1 | **Org admin portal** — 9 dedicated pages for org management, member list, enrollment management, analytics, billing |
| S2 | **Deny override system** — `plan_features.is_restrictive = true` explicitly blocks features regardless of employee's personal plan |
| S3 | **Sponsored enrollments** — org purchases credits, sponsors member enrollments, org credit balance management |
| S4 | **Member invitation system** — `send-org-invite` with 7-day token expiry, role assignment (org_admin/org_manager/org_member) |
| S5 | **Granular privacy controls** — `member_sharing_consent` table with per-category consent (profile, enrollments, progress, assessments, goals) |
| S6 | **Org credit packages** — Starter/Growth/Enterprise tiers, org-level Stripe billing |
| S7 | **Platform tiers for orgs** — Essentials/Professional monthly plans with different feature sets |

#### Pain Relievers

| # | Pain Relieved | How |
|---|--------------|-----|
| PR1 | **P1: No visibility** → Org admin dashboard with member list, enrollment status, and analytics. | Aggregate view of all members |
| PR2 | **P2: Can't enforce policy** → Deny override: set `is_restrictive = true` on any feature in the org-sponsored plan. Blocks the feature for ALL employees even if their personal subscription includes it. | Org policy overrides personal plans |
| PR3 | **P3: Billing is opaque** → Org credit packages with defined prices and credit amounts. Org-level Stripe billing. Credit consumption tracking per member. | Central, predictable billing |
| PR4 | **P4: Manual management** → Org admin can invite members directly. Invitation system with email, role assignment, and 7-day expiry token. | Self-service member management |
| PR5 | **P5: Privacy concerns** → `member_sharing_consent` gives each member control over what data is visible. GDPR-compliant architecture. EU-hosted AI (Vertex AI Frankfurt). No data used for AI training. | Privacy by design |

#### Gain Creators

| # | Gain Created | How |
|---|-------------|-----|
| GC1 | **G1: Org dashboard** → 9 org-admin pages covering member management, enrollment management, analytics, billing, and settings. | Full organizational control panel |
| GC2 | **G2: Policy enforcement** → Deny overrides block specific features regardless of personal plans. Configurable per org-sponsored plan in admin UI. | Feature-level organizational control |
| GC3 | **G3: Central billing** → Organization credit packages (2,500-10,000 EUR). Platform tiers (Essentials at 30 EUR/mo, Professional at 50 EUR/mo). Sponsored enrollments deduct from org pool. | One pool, one invoice |
| GC4 | **G5: Privacy controls** → 5-category consent model. Each member controls visibility of: profile, enrollments, progress, assessments, goals. Org admin sees only consented data. | Employee-controlled data sharing |

---

## Cross-Segment Value Proposition Summary

### The Core Fit

InnoTrue Hub achieves fit by being the **single platform that connects all actors in the professional development ecosystem**:

```
                    ┌──────────────┐
                    │  Org Buyer   │ Sponsors, controls, monitors
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐
                    │ Dev Org /    │ Designs programs, manages delivery
                    │ Coach Firm   │
                    └──────┬───────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
       ┌──────▼───┐  ┌────▼─────┐ ┌───▼──────┐
       │ Instructor│  │  Coach   │ │  Client  │
       │ Delivers  │  │ Supports │ │  Learns  │
       │ content   │  │ growth   │ │  grows   │
       └──────┬───┘  └────┬─────┘ └───┬──────┘
              │            │            │
              └────────────┼────────────┘
                           │
                    ┌──────▼───────┐
                    │   InnoTrue   │ Unified data, AI, analytics
                    │     Hub      │
                    └──────────────┘
```

### One-Sentence Value Propositions

| Segment | Value Proposition |
|---------|-------------------|
| **Coaching organizations** | Replace your 4-6 tool stack with one platform that handles programs, assessments, coaching, scheduling, billing, and AI — with data that connects everything. |
| **Clients/learners** | One workspace for your entire development journey — content, coaching, assessments, goals, and AI that knows you — so you always know where you stand and what to do next. |
| **Coaches/instructors** | Spend your time coaching, not administering — with a teaching dashboard that gives you full client context, structured grading tools, and a clear work queue. |
| **Corporate L&D** | Sponsor employee development with full organizational control — central billing, policy enforcement, privacy controls, and aggregate outcome data. |

---

## Competitive Differentiation

### What Makes InnoTrue Hub Different

| Dimension | Generic LMS | Coaching Platform | InnoTrue Hub |
|-----------|------------|-------------------|--------------|
| Learning content | Yes | No | Yes (programs, modules, Rise embed) |
| Coaching/sessions | No | Yes | Yes (Cal.com, 8 session types, 10 roles) |
| Assessments | Basic (quizzes) | No | 3 systems (capability, scored, psychometric) |
| AI features | No | Basic | Contextual (knows goals, assessments, program) |
| Staff assignment | No | Basic (1 coach) | 3-tier hierarchy (program → module → client) |
| Organization billing | Basic | No | Full (credits, plans, deny overrides, sponsored enrollments) |
| Scenario exercises | No | No | Yes (multi-section, rubric, revision, AI debrief) |
| Goal/decision tracking | No | Basic | Full (milestones, AI insights, coach visibility) |
| GDPR compliance | Varies | Varies | EU-hosted AI (Frankfurt), consent controls, no AI training data |

### Key Differentiator: Context + Constraints + Continuity

The platform's competitive advantage, especially for AI features, is:

- **Context** — the AI knows the user's goals, assessments, program progress, and coaching history
- **Constraints** — AI stays within defined boundaries (no hallucinated research, structured output, turn limits)
- **Continuity** — AI interactions are stored, connected to goals, and visible to coaches (not ephemeral)

External AI gives breadth. Platform AI gives depth.

---

## Assumptions to Validate

These assumptions underpin the value propositions above. If they prove false, the proposition needs adjustment.

| # | Assumption | Risk | Validation Method |
|---|-----------|------|-------------------|
| A1 | Coaching organizations are willing to consolidate onto one platform (vs. best-of-breed tools) | High — switching costs of existing tools | Pilot program with 1-2 organizations |
| A2 | Clients value unified experience over flexibility to choose their own tools | Medium — power users may prefer their own apps | User interviews post-pilot |
| A3 | AI-assisted reflection is valued by clients (not just a novelty) | Medium — may try once and abandon | Usage analytics on AI features (credit consumption patterns) |
| A4 | Organizations will pay for deny overrides and policy enforcement | Medium — may just want basic sponsorship | Sales conversations with corporate prospects |
| A5 | Assessment-driven goal creation changes behavior (not just a notification) | Medium — clients may ignore suggestions | Track goal creation rate from assessment prompts |
| A6 | Instructors will adopt rubric-based grading (not revert to unstructured feedback) | Low-Medium — requires behavior change | Monitor rubric usage vs free-text-only grading |
| A7 | Content embed (Rise in iframe) is sufficient UX for learners | Low — depends on content design | A/B test embedded vs linked content completion rates |
| A8 | The 3-tier staff hierarchy is needed (vs. simpler 1-tier assignment) | Low — larger programs clearly need it | Monitor usage of Tier 2/3 vs Tier 1 only |

---

*This document should be revisited after each major product iteration or customer discovery cycle. The canvas is a living tool — update it as you learn what customers actually value vs. what you assumed.*
