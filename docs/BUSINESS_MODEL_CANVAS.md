# InnoTrue Hub — Business Model Canvas

> Based on the Strategyzer Business Model Canvas framework.
> Last updated: 2026-02-28
>
> This document maps InnoTrue Hub's business model across the nine building blocks of the Business Model Canvas. It complements the [Value Proposition Canvas](./VALUE_PROPOSITION_CANVAS.md), which details the fit between customer segments and value propositions.

---

## How to Read This Document

The Strategyzer Business Model Canvas has nine building blocks organized into four areas:

**Desirability (right side — who do we serve?):**
- **Customer Segments** — distinct groups the business serves
- **Value Propositions** — the bundle of value delivered to each segment
- **Channels** — how value propositions reach customers
- **Customer Relationships** — the type of relationship with each segment

**Feasibility (left side — how do we build it?):**
- **Key Resources** — the assets required to deliver the value proposition
- **Key Activities** — the most important things the business does
- **Key Partnerships** — the network of partners that make the model work

**Viability (bottom — is it financially sustainable?):**
- **Revenue Streams** — how the business earns money from each segment
- **Cost Structure** — the major costs incurred to operate the model

---

## Visual Overview

```
┌──────────────┬──────────────┬──────────────┬──────────────┬──────────────┐
│              │              │              │              │              │
│  KEY         │  KEY         │  VALUE       │  CUSTOMER    │  CUSTOMER    │
│  PARTNERS    │  ACTIVITIES  │  PROPOSITIONS│  RELATION-   │  SEGMENTS    │
│              │              │              │  SHIPS       │              │
│  • Articulate│  • Platform  │  Single      │              │  1. Coaching │
│  • Cal.com   │    dev &     │  platform    │  • Dedicated │     orgs     │
│  • Stripe    │    ops       │  replacing   │    onboard   │  2. Clients/ │
│  • Supabase  │  • Program   │  4-6 tool    │  • Platform  │     learners │
│  • Vertex AI │    design    │  stacks for  │    self-serve│  3. Coaches/ │
│  • Resend    │    support   │  professional│  • Community │     instrs   │
│  • Cloudflare│  • Coach     │  development │  • Coach-    │  4. Corp L&D │
│  • Coaching  │    onboard   │  delivery    │    mediated  │              │
│    orgs      │  • AI feature│              │              │              │
│  • Content   │    develop   │              │              │              │
│    providers │  • Security  │              │              │              │
│              │    & GDPR    │              │              │              │
│              │              │              │              │              │
├──────────────┴──────────────┼──────────────┼──────────────┴──────────────┤
│                             │              │                             │
│  COST STRUCTURE             │   KEY        │  REVENUE STREAMS            │
│                             │   RESOURCES  │                             │
│  • Infrastructure (Supabase,│              │  • Subscriptions (7 tiers)  │
│    Cloudflare, Vertex AI)   │  • Platform  │  • Program enrollments      │
│  • Development team         │    codebase  │  • Credit packages          │
│  • Email & scheduling       │  • Database  │  • Org plans + credits      │
│  • Content licensing        │  • AI infra  │  • Content licensing (future│
│  • Partner commissions      │  • Domain    │                             │
│                             │    expertise │                             │
│                             │  • Partner   │                             │
│                             │    network   │                             │
│                             │              │                             │
└─────────────────────────────┴──────────────┴─────────────────────────────┘
```

---

## 1. Customer Segments

InnoTrue Hub serves four distinct customer segments in a **multi-sided platform** model where the B2B buyer purchases the platform and the end users (clients, coaches) operate within it.

### Segment 1: Coaching & Development Organizations (Primary Buyer)

> Professional development firms, coaching practices, and certification bodies that purchase the platform to deliver their programs.

| Attribute | Detail |
|-----------|--------|
| **Who** | Small-to-medium coaching firms (5-50 coaches), certification bodies, professional development consultancies |
| **Geography** | EU-first (GDPR-compliant architecture), expandable globally |
| **Buying behavior** | B2B SaaS purchase; decision by founder/CEO or head of programs; evaluated on ROI, client outcomes, and operational efficiency |
| **Current alternatives** | TalentLMS + Cal.com + Google Sheets + email + Stripe (4-6 tool stack) |
| **Revenue role** | **Primary revenue source** — pays for subscriptions, program plans, and credits |

### Segment 2: Clients / Learners (End User)

> Individuals going through professional development programs — mid-career professionals, young professionals, leaders in certification tracks.

| Attribute | Detail |
|-----------|--------|
| **Who** | Professionals aged 22-55 in coaching or development programs. Two sub-segments: young professionals (career clarity) and senior professionals (leadership development) |
| **Relationship to buyer** | Either enrolled by the coaching org (B2B) or self-enrolled (B2C, future via Phase 5) |
| **Paying?** | Sometimes directly (individual subscriptions, credit top-ups); often sponsored by their organization or coaching firm |
| **Revenue role** | **Secondary revenue** — individual subscriptions and credit purchases; primary value is as the end user whose outcomes justify the B2B buyer's investment |

### Segment 3: Coaches & Instructors (Supply Side)

> The professionals who deliver programs, grade assignments, evaluate scenarios, and coach clients through the platform.

| Attribute | Detail |
|-----------|--------|
| **Who** | Independent coaches, certified instructors, subject-matter experts. Typically associated with one or more coaching organizations |
| **Relationship to buyer** | Employed by or contracted to the coaching organization. Admin-created accounts (no self-registration currently) |
| **Paying?** | No — they are the supply side. Their value is delivered through the platform. (Future: coaches may pay for premium tools or their own client management) |
| **Revenue role** | **Indirect** — their quality and efficiency drive client retention and org satisfaction |

### Segment 4: Corporate L&D / HR Teams (Organization Buyer)

> Companies that sponsor professional development for their employees through a coaching organization using the platform.

| Attribute | Detail |
|-----------|--------|
| **Who** | HR directors, L&D managers, talent development leads at mid-to-large companies |
| **Relationship to buyer** | Client of the coaching organization. Pays the coaching org, who pays for the platform. Or purchases platform access directly for their employees |
| **Paying?** | Yes — org credit packages (2,500-10,000 EUR), platform tiers (Essentials 30 EUR/mo, Professional 50 EUR/mo) |
| **Revenue role** | **Growing revenue source** — higher contract values than individual users; org billing unlocks enterprise-scale deals |

### Segment Relationships

```
Corporate L&D (Segment 4) ──pays──→ Coaching Org (Segment 1) ──pays──→ InnoTrue Hub
                                           │
                              ┌─────────────┼─────────────┐
                              │             │             │
                        Coaches (S3)   Instructors (S3)  Clients (S2)
                        deliver via      deliver via     learn via
                         platform         platform       platform
```

---

## 2. Value Propositions

> For the full Customer Profile ↔ Value Map fit analysis, see [VALUE_PROPOSITION_CANVAS.md](./VALUE_PROPOSITION_CANVAS.md).

### Per-Segment Value Propositions

| Segment | Value Proposition |
|---------|-------------------|
| **Coaching organizations** | Replace your 4-6 tool stack with one platform that handles programs, assessments, coaching, scheduling, billing, and AI — with data that connects everything. |
| **Clients / learners** | One workspace for your entire development journey — content, coaching, assessments, goals, and AI that knows you — so you always know where you stand and what to do next. |
| **Coaches / instructors** | Spend your time coaching, not administering — with a teaching dashboard that gives you full client context, structured grading tools, and a clear work queue. |
| **Corporate L&D** | Sponsor employee development with full organizational control — central billing, policy enforcement, privacy controls, and aggregate outcome data. |

### The Core Differentiator

InnoTrue Hub's competitive advantage rests on **three pillars** that generic tools cannot replicate:

| Pillar | What It Means | Why Competitors Can't Match It |
|--------|--------------|-------------------------------|
| **Context** | AI and coaching tools know the user's goals, assessments, program progress, and history | Generic LMS has no coaching data; coaching platforms have no learning data; external AI has neither |
| **Constraints** | AI stays within defined boundaries — no hallucinated research, structured output, turn limits, coach-visible | External AI (ChatGPT, Claude) has no guardrails, no program awareness, no coach oversight |
| **Continuity** | All interactions are stored, connected to goals, and visible to coaches — nothing is ephemeral | Tool fragmentation means data lives in silos; each tool starts from scratch |

---

## 3. Channels

How the value proposition reaches each customer segment.

### Awareness Channels

| Channel | Target Segment | Description |
|---------|---------------|-------------|
| **Direct outreach** | Coaching orgs, Corporate L&D | Founder-led sales to coaching firms and L&D teams. Relationship-driven, consultative sales |
| **Conference & events** | Coaching orgs, Corporate L&D | Coaching industry events (ICF conferences, L&D summits), speaking engagements, workshops |
| **Content marketing** | All segments | Thought leadership on AI in coaching, assessment-driven development, platform consolidation |
| **Word of mouth** | Coaching orgs | Coaches who use the platform recommend it to peer organizations. Network effects within the coaching community |
| **Shareable progress snapshots** (planned) | Clients | Visual growth cards shareable on LinkedIn/Instagram — turns users into an organic marketing channel |

### Evaluation Channels

| Channel | Description |
|---------|-------------|
| **Pilot programs** | Free or reduced-cost pilot with 1-2 coaching organizations to demonstrate value before full commitment |
| **Platform demo** | Live walkthrough of the platform customized to the prospect's program structure |
| **Documentation** | Platform Functional Overview, Value Proposition Canvas, and this Business Model Canvas as sales enablement materials |

### Delivery Channels

| Channel | Description |
|---------|-------------|
| **Web application** | `app.innotrue.com` — primary delivery channel. React SPA hosted on Cloudflare Pages. PWA-ready for mobile |
| **Email** | Transactional emails via Resend (`mail.innotrue.com`) for notifications, onboarding, session reminders |
| **Cal.com** | Session scheduling — embedded booking flows within the platform |
| **Integrated content** | Rise content embedded directly (Tier 1: iframe; Tier 2: xAPI with tracking) — learning happens inside the platform |

### Post-Sale / Support Channels

| Channel | Description |
|---------|-------------|
| **In-platform onboarding** | Welcome cards, step-by-step checklists, contextual empty states (client side built; coach side planned) |
| **Admin documentation** | Data Configuration Guide, Integration Setup Guide, Supabase Ops Quickstart for technical administrators |
| **Direct support** | Founder-led support during pilot phase. Platform admin tools for monitoring and troubleshooting |

---

## 4. Customer Relationships

The type of relationship established and maintained with each customer segment.

### Relationship Matrix

| Segment | Relationship Type | How It Works |
|---------|------------------|--------------|
| **Coaching organizations** | **Dedicated personal assistance** | Consultative onboarding: program design support, data configuration, staff training. Ongoing account management. Transitions to self-service as the org matures on the platform |
| **Clients / learners** | **Automated self-service + coach-mediated** | Platform is self-service (enroll, learn, reflect, book). The coaching organization's coaches provide the human relationship. AI augments with contextual prompts and nudges |
| **Coaches / instructors** | **Self-service with onboarding support** | Admin creates accounts. Teaching dashboard is self-explanatory for experienced coaches. Welcome card and guided onboarding for first login (planned). Teaching FAQ for reference |
| **Corporate L&D** | **Dedicated personal assistance** | Account setup by platform admin. Org admin portal for self-service member management. Periodic ROI reporting and program reviews |

### Relationship Lifecycle

```
Coaching Org:  Awareness → Demo → Pilot → Onboarding → Self-Service → Expansion (more programs)
                                                                          ↓
Client:                             Enrolled by org → Onboarding → Active learning → Completion → Re-enrollment
                                                                          ↓
Coach:                              Created by admin → Onboarding → Active teaching → Ongoing
                                                                          ↓
Corporate L&D:                      Introduced via org → Org setup → Member enrollment → Monitoring → Renewal
```

### Switching Costs & Lock-In

| Factor | Strength | Notes |
|--------|----------|-------|
| **Data accumulation** | High | Assessment history, goal progress, coaching notes, decision logs — all lose value if exported as flat files |
| **Program structure** | Medium | Programs, modules, scenarios, rubrics are platform-specific. Recreating in another tool is significant effort |
| **Workflow integration** | Medium | Cal.com mappings, Stripe billing, notification rules — operational setup that takes time to replicate |
| **Coach familiarity** | Low-Medium | Teaching dashboard and grading workflows require learning; switching means retraining |
| **Content** | Low | Rise content can be re-exported. Content is portable, but the wrapper (assessments, AI, coaching) is not |

---

## 5. Revenue Streams

### Current Revenue Model

| Stream | Type | Pricing | Who Pays | Status |
|--------|------|---------|----------|--------|
| **Individual subscriptions** | Recurring (monthly) | 7 tiers: Free → Starter → Professional → Premium → Elite → Programs → Continuation | Clients (directly or via org sponsorship) | ✅ Built (Stripe integration) |
| **Program enrollments** | Per-enrollment fee | Program plans with per-enrollment features and credit allowances | Coaching orgs (pass cost to clients or absorb) | ✅ Built |
| **Credit packages (individual)** | Consumable top-ups | Variable pricing, purchased via Stripe checkout | Clients | ✅ Built |
| **Organization credit packages** | Consumable (org pool) | Starter (2,500 EUR) / Growth / Enterprise (10,000 EUR) | Corporate L&D / org buyers | ✅ Built |
| **Organization platform tiers** | Recurring (monthly) | Essentials (30 EUR/mo) / Professional (50 EUR/mo) | Corporate L&D / org buyers | ✅ Built |

### Revenue Architecture

```
                         ┌─────────────────────┐
                         │   REVENUE STREAMS    │
                         └─────────┬───────────┘
              ┌────────────────────┼────────────────────┐
              │                    │                     │
     ┌────────▼────────┐  ┌───────▼────────┐  ┌────────▼────────┐
     │   SUBSCRIPTIONS  │  │    CREDITS      │  │  ORG BILLING    │
     │   (recurring)    │  │  (consumable)   │  │  (recurring +   │
     │                  │  │                 │  │   consumable)   │
     │  7 plan tiers    │  │  Individual     │  │  Platform tiers │
     │  Free → Elite    │  │  top-ups        │  │  Credit packages│
     │  + Programs      │  │  Program plan   │  │  Sponsored      │
     │  + Continuation  │  │  allowances     │  │  enrollments    │
     └─────────────────┘  └─────────────────┘  └─────────────────┘
```

### Pricing Mechanics

| Mechanic | How It Works |
|----------|-------------|
| **Tiered access** | Higher subscription tiers unlock more features via the entitlements system. `useEntitlements()` merges 5 sources (subscription, program plan, add-ons, tracks, org-sponsored) |
| **Credit consumption** | AI features, premium resources, and certain actions consume credits. FIFO consumption with atomic transactions. Creates natural upsell pressure as users hit limits |
| **Deny override** | Organizations can *restrict* features via `is_restrictive = true`, even if the employee's personal plan includes them. Enables policy-driven feature control |
| **Feature gating UI** | Lock indicators in navigation, upgrade prompts via `useIsMaxPlan()`, `<FeatureGate>` / `<CapabilityGate>` components drive conversion |

### Future Revenue Opportunities

| Opportunity | Description | Phase |
|------------|-------------|-------|
| **Self-registration** | Open sign-up with plan selection (currently admin-only enrollment). Unlocks B2C revenue | Phase 5 (planned, 14 steps designed) |
| **Content marketplace** | Coaching orgs sell their program templates to other orgs through the platform | Phase 9 (strategic) |
| **AI premium features** | Higher AI call limits, AI learning companion, conversational dashboard as premium tier features | Phase 3 |
| **White-label / custom branding** | Coaching orgs pay for branded platform experience | Phase 6+ |
| **Certification fees** | Charge for scenario certifications and badge issuance | Anytime |
| **Integration premium** | Advanced integrations (Notion, Slack/Discord, custom LRS) as add-ons | Phase 8 |

---

## 6. Key Resources

The most important assets required to deliver the value propositions.

### Intellectual / Digital Resources

| Resource | Description | Criticality |
|----------|-------------|-------------|
| **Platform codebase** | React + TypeScript frontend (181+ pages), 79 Deno edge functions, 380+ PostgreSQL tables, 474 migrations. Represents 2+ years of development | Critical |
| **Entitlements engine** | 5-source merging logic with deny override — the system that enables flexible monetization. Difficult to replicate | Critical |
| **3-tier staff assignment** | Program → module → enrollment hierarchy with Cal.com URL resolution. Core operational differentiator | Critical |
| **3 assessment systems** | Capability (radar/evolution), definition (server-side scoring), psychometric (catalog). Unique combination for coaching platforms | High |
| **AI infrastructure** | Vertex AI integration (EU/Frankfurt), input truncation, credit gating, consent system, provider-agnostic architecture. Foundation for all AI features | High |
| **Scenario engine** | Multi-section exercises with rubrics, AI debrief, revision workflow, certification thresholds. Unique to the platform | High |

### Human Resources

| Resource | Description | Criticality |
|----------|-------------|-------------|
| **Domain expertise** | Deep understanding of coaching industry workflows, assessment methodologies, and professional development program design | Critical |
| **Technical team** | Full-stack development capability (React, TypeScript, Supabase, Deno, PostgreSQL) | Critical |
| **Coaching network** | Relationships with coaching organizations who provide real-world validation and feedback | High |

### Infrastructure Resources

| Resource | Description | Criticality |
|----------|-------------|-------------|
| **Supabase projects** | 3 environments (dev, preprod, prod) with PostgreSQL, auth, storage, edge functions | Critical |
| **Cloudflare Pages** | Frontend hosting with CDN, custom domain (`app.innotrue.com`) | Critical |
| **Vertex AI (Frankfurt)** | EU-hosted AI inference — GDPR compliance for EU coaching firms | High |
| **Stripe account** | Payment processing with test/live modes, customer portal, credit top-ups | High |
| **Domain & email** | `innotrue.com` domain, `mail.innotrue.com` email sending via Resend | Medium |

---

## 7. Key Activities

The most important things the business must do to make the model work.

### Platform Development & Operations

| Activity | Description | Frequency |
|----------|-------------|-----------|
| **Feature development** | Building new capabilities following the 9-phase roadmap (Priority 0 → Phase 5 → Phase 3 → ...) | Continuous |
| **Platform reliability** | Monitoring, bug fixes, security patches, RLS policy maintenance, edge function health | Continuous |
| **Database management** | Migration management (474), schema evolution, performance optimization, data integrity | Continuous |
| **Deployment pipeline** | `develop` → `preprod` → `main` → Lovable sandbox. Edge function deployment. Environment sync | Per release |
| **Security & compliance** | GDPR compliance, RLS enforcement, auth security, data isolation between organizations | Continuous |

### Business Development & Customer Success

| Activity | Description | Frequency |
|----------|-------------|-----------|
| **Program design support** | Helping coaching organizations structure their programs, modules, assessments, and scenarios within the platform | Per customer |
| **Onboarding** | Setting up new coaching organizations: user creation, program configuration, staff assignment, integration setup | Per customer |
| **Coach training** | Training new coaches/instructors on the teaching dashboard, grading workflows, and client management | Per coach cohort |
| **Pilot management** | Running pilot programs with new coaching organizations to demonstrate value and gather feedback | Per prospect |
| **Content strategy** | Supporting the transition from TalentLMS to direct embedding (Tier 1 → Tier 2 xAPI) | Ongoing (transitional) |

### AI & Product Intelligence

| Activity | Description | Frequency |
|----------|-------------|-----------|
| **AI feature development** | Building contextual AI features (5 designed, 4 built). System prompt hardening, anti-hallucination improvements | Per phase |
| **Usage analytics** | Monitoring credit consumption, feature adoption, engagement patterns to inform product decisions | Continuous |
| **Feedback integration** | Processing user feedback to identify improvement priorities and validate assumptions | Continuous |

---

## 8. Key Partnerships

### Technology Partners

| Partner | Role | Dependency Level | Substitutability |
|---------|------|-----------------|------------------|
| **Supabase** | Backend infrastructure (database, auth, storage, edge functions) | Critical | Low — deeply integrated (380+ tables, 79 edge functions, RLS policies). Migration would be major effort |
| **Cloudflare** | Frontend hosting, CDN, custom domain | Medium | High — standard static hosting, easily switchable |
| **Stripe** | Payment processing, subscription management, customer portal | High | Medium — standard payment integration, but billing logic is deeply integrated |
| **Google Cloud (Vertex AI)** | AI inference (Gemini 3 Flash, EU/Frankfurt) | Medium | High — provider-agnostic architecture allows switching to Mistral, Azure OpenAI, or OpenAI |
| **Cal.com** | Session scheduling (SSO, booking API, webhooks) | Medium | Medium — deep integration (event type mappings, 3-tier URL resolution), but could be replaced with Calendly or custom scheduling |
| **Resend** | Transactional email delivery | Low-Medium | High — standard email API, easily replaceable |
| **Articulate (Rise)** | Learning content authoring | Low | High — content is exported as static files (Web/xAPI); any authoring tool that exports to these formats works |

### Business Partners

| Partner | Role | Value Exchange |
|---------|------|---------------|
| **Coaching organizations** | Distribution + content | They bring clients and domain expertise; the platform provides the delivery infrastructure. Symbiotic — their success drives platform revenue |
| **Content providers** | Learning content | Rise content authored by coaching orgs or licensed from third parties. The platform wraps content with assessments, AI, and coaching |
| **Certification bodies** | Credentialing | Scenario certifications and badge credentials (e.g., Credly integration). External validation adds value to the platform experience |
| **Corporate clients** | Volume + revenue | Corporate L&D teams bring groups of employees and predictable revenue. They need oversight and compliance, which the platform provides via the org admin portal |

### Partner Dependency Risk

```
Critical (hard to replace):     Supabase
High (replaceable with effort): Stripe, Cal.com
Medium (substitutable):         Vertex AI, Cloudflare, Resend
Low (commodity):                Articulate Rise, Sentry
```

---

## 9. Cost Structure

### Fixed Costs

| Cost Category | Components | Estimated Range | Notes |
|--------------|-----------|-----------------|-------|
| **Infrastructure** | Supabase (3 projects), Cloudflare Pages, domain registration | Low-Medium | Supabase Pro plan per project. Scales with usage but has base cost |
| **Development** | Engineering team salaries/contracts | High | Largest cost center. Full-stack TypeScript + Supabase expertise |
| **SaaS tools** | Sentry (error monitoring), GitHub (repos, CI), development tools | Low | Standard dev tooling |

### Variable Costs

| Cost Category | Driver | Scaling Behavior | Notes |
|--------------|--------|-------------------|-------|
| **AI inference** | AI feature usage (credit consumption) | Per-call to Vertex AI | Directly offset by credit revenue. EU hosting (Frankfurt) may cost more than US |
| **Email delivery** | Notification volume (25+ types) | Per-email via Resend | Scales with user count. Email queue with retry adds reliability cost |
| **Payment processing** | Transaction volume | Stripe fees (2.9% + 30¢ per transaction) | Standard, unavoidable |
| **Storage** | File uploads across 17 buckets | Per-GB on Supabase Storage | Grows with user content (assignments, assessments, resources, profile photos) |
| **Database** | Query volume, connection count | Supabase compute scaling | Grows with concurrent users. RLS policies add query overhead |

### Cost Structure Characteristics

| Characteristic | Assessment |
|---------------|------------|
| **Cost-driven vs. value-driven** | **Value-driven** — the platform competes on capability (replacing 4-6 tools), not on being the cheapest option |
| **Fixed vs. variable ratio** | **High fixed / low variable** — development is the dominant cost; infrastructure scales efficiently. AI inference is the largest variable cost |
| **Economies of scale** | **Strong** — platform development cost is amortized across all customers. Each new coaching org adds minimal marginal cost (database rows, storage) |
| **Economies of scope** | **Strong** — same platform serves 4 segments. Features built for one segment often benefit others (e.g., assessment system serves clients, coaches, and org buyers) |

### Unit Economics (Directional)

| Metric | Estimate | Notes |
|--------|----------|-------|
| **Marginal cost per user** | Very low | Database rows + storage. No per-user licensing from dependencies |
| **Marginal cost per AI call** | Low | Vertex AI inference cost, offset by credit consumption |
| **Customer acquisition cost** | High (currently) | Founder-led sales, relationship-driven. Expected to decrease with self-registration (Phase 5) and word-of-mouth |
| **Lifetime value potential** | High | Multi-year coaching programs, expanding program catalog, growing client base per org |

---

## Cross-Block Analysis

### How the Blocks Connect

```
Key Partners ──supply──→ Key Resources ──enable──→ Key Activities ──produce──→ Value Propositions
                                                                                      │
                                                                              delivered via
                                                                                      │
                                                                                      ▼
                              Revenue Streams ←──pay──── Customer Segments ←── Channels
                                    │                          │
                                    │                    maintained by
                                    │                          │
                                    ▼                          ▼
                              Cost Structure          Customer Relationships
```

### Strategic Fit Summary

| Question | Answer |
|----------|--------|
| **Do the value propositions address the most critical customer jobs?** | Yes — tool consolidation (coaching orgs), visible progress (clients), efficient grading (coaches), organizational control (L&D). See VPC for detailed fit analysis |
| **Are the channels appropriate for each segment?** | Yes — B2B segments reached via direct/consultative sales; end users reached through the platform itself; coaches reached via their employing organization |
| **Do revenue streams match willingness to pay?** | Partially validated — subscription tiers and credit model built; pricing validated with pilot customers; self-registration (Phase 5) needed to test B2C willingness |
| **Can key resources and activities deliver at scale?** | Yes architecturally — Supabase scales well, edge functions are serverless, React SPA is CDN-delivered. Bottleneck is currently human (program design support, onboarding) |
| **Are key partnerships sustainable?** | Yes — all technology partners are substitutable except Supabase (deep integration). Business partnerships (coaching orgs) are symbiotic |
| **Is the cost structure viable?** | Yes — high-fixed/low-variable favors scaling. Development is the dominant cost; each additional customer adds minimal marginal cost |

---

## Key Assumptions & Risks

### Business Model Assumptions

| # | Assumption | Block(s) | Risk Level | Validation Approach |
|---|-----------|----------|------------|-------------------|
| B1 | Coaching organizations will pay SaaS subscription rates for an integrated platform | Revenue, Segments | High | Pilot pricing validation with 2-3 orgs |
| B2 | The platform can replace (not just complement) existing tool stacks | Value Prop | High | Track tool reduction during pilot — do orgs actually cancel other subscriptions? |
| B3 | Corporate L&D teams will purchase org-level plans through coaching organizations (not direct) | Segments, Channels | Medium | Test both go-to-market paths: via coaching org vs direct to L&D |
| B4 | Credit-based consumption creates natural upsell pressure without causing churn | Revenue | Medium | Monitor credit exhaustion → upgrade vs credit exhaustion → churn rates |
| B5 | Self-registration (Phase 5) will open a viable B2C channel | Channels, Revenue | Medium | Conversion funnel analytics post-launch |
| B6 | Founder-led sales can transition to scalable sales motion | Channels | Medium | Track: can a non-founder close deals? What sales materials/demos are needed? |
| B7 | Coaches will adopt the teaching dashboard without heavy training | Relationships | Low-Medium | Time-to-first-graded-assignment metric during onboarding |
| B8 | AI features are a differentiator, not a commodity | Value Prop | Medium | Track: do prospects mention AI as a decision factor? Does AI usage correlate with retention? |

### Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| **Supabase dependency** | Provider-agnostic AI architecture already built. Database is standard PostgreSQL (portable). Edge functions are Deno (standard TypeScript). Storage is S3-compatible |
| **Slow B2B sales cycle** | Self-registration (Phase 5) opens B2C path. Content marketing for inbound. Pilot programs reduce commitment barrier |
| **Feature complexity overwhelming users** | Progressive disclosure via plan tiers. Onboarding checklists. Feature gating ensures users only see what's relevant to their plan |
| **AI costs scaling faster than revenue** | Credit-based consumption directly ties AI cost to revenue. Input truncation and output constraints limit per-call cost. Provider-agnostic architecture allows switching to lower-cost providers |
| **Coaching org concentration risk** | Expand customer base beyond pilot orgs. Self-registration reduces dependency on B2B channel. Content marketplace (Phase 9) creates platform stickiness |

---

## Business Model Patterns

InnoTrue Hub combines several established business model patterns:

### 1. Multi-Sided Platform
The platform creates value by connecting coaching organizations, coaches/instructors, clients, and corporate sponsors. Each side's participation makes the platform more valuable to the others.

### 2. Freemium
Free tier provides basic access; paid tiers unlock AI features, premium resources, and advanced capabilities. Credit consumption creates natural upgrade triggers.

### 3. SaaS (Software as a Service)
Recurring subscription revenue with tiered feature access. Cloud-hosted, no installation required. Continuous updates and improvements.

### 4. Razor and Blades
The platform (razor) enables program delivery; credits (blades) are consumed during use. Program enrollments and AI features drive ongoing credit consumption.

### 5. Lock-In Through Data
Assessment history, coaching notes, goal progression, and decision logs accumulate over time and become increasingly valuable — and increasingly difficult to replicate elsewhere.

---

## Comparison: Current State vs. Target State

| Block | Current State | Target State (12-18 months) |
|-------|-------------|---------------------------|
| **Customer Segments** | 1-2 pilot coaching orgs, admin-created users | 5-10 coaching orgs, self-registered users (Phase 5), 2-3 corporate L&D clients |
| **Value Propositions** | Full platform built, AI features foundational | AI Learning Companion, pre-session prep, content embedded inline (xAPI), cohort dashboard live |
| **Channels** | Founder-led sales, direct outreach | Self-registration funnel, content marketing, conference presence, shareable progress snapshots |
| **Customer Relationships** | Fully hands-on, founder-managed | Scaled onboarding (welcome cards, guided flows), self-service for mature orgs, community building |
| **Revenue Streams** | Subscription + credits + org billing (infrastructure built) | Active revenue from multiple orgs; validated pricing; credit upsell working; org deals closed |
| **Key Resources** | Comprehensive codebase, 3 environments, full documentation | Expanded content library, case studies from pilot programs, sales playbook |
| **Key Activities** | Platform development (Priority 0 + Phase 5) | Balanced: 50% feature development, 30% customer success, 20% sales/marketing |
| **Key Partnerships** | Technology stack in place | 2-3 content partners, coaching certification body partnerships, integration partners |
| **Cost Structure** | Development-heavy, low variable costs | Stable development cost, growing variable (AI, email, storage) offset by growing revenue |

---

## Action Items Derived From This Canvas

These are strategic actions suggested by the canvas analysis, mapped to the existing roadmap:

| # | Action | Canvas Block | Maps To |
|---|--------|-------------|---------|
| 1 | Launch self-registration to unlock B2C channel | Channels, Revenue | Phase 5 (14 steps planned) |
| 2 | Run pricing validation with pilot organizations | Revenue | Pre-Phase 5 |
| 3 | Build content embedding (Rise Web/xAPI) to deliver on "single platform" promise | Value Prop, Activities | Priority 0 Tier 1 + Tier 2 |
| 4 | Ship coach onboarding (welcome card, profile setup) to reduce support burden | Relationships, Activities | Priority 0 Coach Onboarding |
| 5 | Build cohort dashboard to enable live program delivery | Value Prop, Activities | Priority 0 Cohort Readiness |
| 6 | Develop AI Learning Companion as premium differentiator | Value Prop, Revenue | Phase 3 Feature A |
| 7 | Create sales materials from pilot program outcomes | Channels | Post-pilot |
| 8 | Track and publish customer success metrics (time saved, tool reduction, client outcomes) | Value Prop, Channels | Ongoing |
| 9 | Reduce Supabase dependency risk by documenting migration path | Resources, Partnerships | Low priority (architectural documentation) |
| 10 | Explore coaching certification body partnerships for distribution | Partnerships, Channels | Phase 9 |

---

*This document should be revisited after each major product milestone or business model pivot. The canvas is a living tool — update it as market feedback validates or invalidates the assumptions listed above. Use it alongside the [Value Proposition Canvas](./VALUE_PROPOSITION_CANVAS.md) for a complete strategic picture.*
