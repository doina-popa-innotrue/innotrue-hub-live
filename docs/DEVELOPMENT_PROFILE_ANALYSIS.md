# Development Profile & Assessment-Driven Guided Paths

> **Status:** DP1-DP4 ✅ DONE (2026-02-19, commit `c6b2e11`). DP5-DP7 pending. Approved for development (2026-02-18).
>
> **Scope:** Connect the platform's three assessment systems, development items, goals, and guided paths into a unified development journey — so clients can identify gaps, track progress, and follow structured paths (e.g., CTA review board preparation) with realistic timelines.

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Audit](#2-current-state-audit)
3. [The Gap: Why These Systems Don't Talk](#3-the-gap-why-these-systems-dont-talk)
4. [7-Phase Implementation Plan](#4-7-phase-implementation-plan)
5. [Database Changes Summary](#5-database-changes-summary)
6. [UX Wireframes (Conceptual)](#6-ux-wireframes-conceptual)
7. [Key Design Decisions](#7-key-design-decisions)

---

## 1. Executive Summary

### The Problem

InnoTrue Hub has three assessment systems, a development items system with 8 link tables, a goals system with milestones, and a guided paths system with template-based instantiation — but **none of them are connected at the database level**. A client who scores low on "Coaching Presence" in a capability assessment has no system-assisted path to improving that score. A client following a CTA guided path has no way to see whether their assessment results indicate they're ready for the next milestone.

### The Vision

A **Development Profile** page that unifies strengths, gaps, and progress from all assessment sources into a single view. **Assessment-gated milestones** on guided paths that show traffic-light readiness signals. An **intake-driven recommendation engine** that assesses where a client stands and recommends the right path variant with a realistic timeline — rather than letting clients work backward from unrealistic deadlines.

### Business Value

- **Immediate:** Coaches preparing clients for CTA review boards can see a data-driven readiness view instead of relying on subjective judgment
- **Retention:** Clients see tangible progress across their development journey, reducing drop-off
- **Differentiation:** No competing coaching platform connects assessments → gaps → guided paths → readiness in a single system
- **Scalability:** Coaches can manage more clients when the system surfaces who needs attention and who's on track

---

## 2. Current State Audit

### 2.1 Three Assessment Systems

| System | Table | Scoring | Visualization | Status |
|--------|-------|---------|---------------|--------|
| **Capability Assessments** | `capability_assessments` | Client-side domain averages — simple or weighted by question types (slider 1-N) | Radar chart (by domains or question types) + evolution charts | ✅ Working. Question types + weighted scoring added 2026-02-18 |
| **Assessment Definitions** (Public/Quiz) | `assessment_definitions` | Server-side via `compute-assessment-scores` (confidential scoring matrix) | Dimension bars + interpretation text | ✅ Working |
| **Psychometric Assessments** | `psychometric_assessments` | None — document catalog + PDF upload only | None | ⚠️ Incomplete — no scoring engine, no structured results, no visualization |

### 2.2 Development Items (8 Link Tables)

The `development_items` table (types: reflection, resource, action_item, note) connects to everything via explicit junction tables:

| Link Table | Connects To | Purpose |
|------------|-------------|---------|
| `development_item_question_links` | `capability_domain_questions` + `capability_snapshots` | Link dev item to specific assessment question |
| `development_item_domain_links` | `capability_domains` + `capability_snapshots` | Link dev item to assessment domain |
| `development_item_snapshot_links` | `capability_snapshots` | Link dev item to a snapshot (point-in-time assessment) |
| `development_item_goal_links` | `goals` | Link dev item to a goal |
| `development_item_milestone_links` | `goal_milestones` | Link dev item to a milestone |
| `development_item_task_links` | `tasks` | Link dev item to a task |
| `development_item_group_links` | `groups` | Link dev item to a group |
| `development_item_module_links` | `module_progress` | Link dev item to module progress |

**Key insight:** Development items are the existing bridge between assessments and goals — but the bridge is incomplete. A dev item can be linked to both a capability question AND a goal, but there's no direct `assessment → goal` link at the database level.

### 2.3 Goals System

- **Tables:** `goals`, `goal_milestones`, `goal_shares`, `goal_comments`, `goal_reflections`, `goal_resources`, `decision_goals`
- **Categories:** family/home, financial/career, mental/educational, spiritual/ethical, social/cultural, physical/health
- **Progress:** Auto-calculated via trigger when milestones change (percentage)
- **Sharing:** Coach visibility via `goal_shares`
- **What's missing:** No link to assessments. No concept of "this goal was created because of assessment gap X."

### 2.4 Guided Paths System

**9 tables:**
- `guided_path_template_families` — top-level grouping (e.g., "CTA Preparation")
- `family_survey_questions` — intake survey questions per family
- `template_conditions` — conditional logic mapping survey answers to templates
- `guided_path_templates` — template variants within a family (e.g., "CTA 12-month", "CTA 6-month")
- `guided_path_template_goals` — template goals
- `guided_path_template_milestones` — template milestones with `recommended_days_min/max/optimal`
- `guided_path_template_tasks` — template tasks per milestone
- `guided_path_survey_responses` — user's survey answers + `selected_template_ids`

~~**Critical bug:** `GuidedPathSurveyWizard` saves the survey response with `selected_template_ids` but **never instantiates** the template into real `goals` + `goal_milestones` + `tasks`. The toast says "Generating your personalized path..." but no goals are created. The user is navigated to `/goals` where their goal list remains unchanged.~~ ✅ **Fixed in DP4** (2026-02-19): Survey wizard now shows `PathConfirmation` step with pace selector + start date → calls shared `instantiateTemplate()` service → creates goals/milestones/tasks with pace-adjusted dates.

The standalone "Copy This Path" flow (from `GuidedPathTemplateDetail.tsx`) also refactored to use the shared `instantiateTemplate()` service.

### 2.5 Skills System

- `skills` table — defined per program module
- `user_skills` — awarded on module completion
- Displayed as badges on client profile
- **Not connected** to assessments or goals

---

## 3. The Gap: Why These Systems Don't Talk

### Missing Links

```
┌─────────────────────┐     ┌─────────────────────┐
│  ASSESSMENTS        │     │  GOALS              │
│  ─────────────      │     │  ─────              │
│  capability_*       │     │  goals              │
│  assessment_*       │  ?  │  goal_milestones    │
│  psychometric_*     │◄───►│  goal_resources     │
│                     │     │                     │
│  Knows: what you    │     │  Knows: what you    │
│  scored on each     │     │  want to achieve    │
│  domain/question    │     │                     │
└─────────────────────┘     └─────────────────────┘
         │                           │
         │  development_items        │
         │  (weak bridge via         │
         │   8 junction tables)      │
         │                           │
         ▼                           ▼
┌─────────────────────┐     ┌─────────────────────┐
│  GUIDED PATHS       │     │  MODULES            │
│  ─────────────      │     │  ───────            │
│  templates          │     │  program_modules    │
│  survey questions   │  ?  │  module_progress    │
│  conditions         │◄───►│  skills             │
│                     │     │                     │
│  Knows: the steps   │     │  Knows: what you    │
│  to get from A to B │     │  learned/completed  │
└─────────────────────┘     └─────────────────────┘
```

### Specific Missing Connections

1. **Assessment → Goal:** No FK or table linking "this goal was created to address capability domain X scoring below threshold Y"
2. **Assessment → Guided Path Gate:** No way to say "milestone M requires minimum score of 7/10 on domain D before it's considered ready"
3. **Survey → Goal Instantiation:** Survey determines the right template but doesn't create goals
4. **Module → Assessment Domain:** No mapping between "Module: Coaching Ethics" and "Domain: Ethical Practice" — so completing a module doesn't inform assessment readiness
5. **Psychometric → Structured Data:** PDF uploads only — no structured scores that could feed into development profile
6. **Cross-Assessment Correlation:** No way to see "your DISC profile suggests X, and your capability assessment shows Y — here's the intersection"

---

## 4. 7-Phase Implementation Plan

### Phase 1: Assessment ↔ Goal Traceability (1-2 days) ✅ DONE

**Why first:** Smallest change, highest immediate value. Coaches can see why a goal exists.

**What:**
- New `goal_assessment_links` table connecting `goals` to assessment sources
- When creating a development item from an assessment question/domain, if the user also links it to a goal, store the assessment context
- Show assessment origin badge on goal cards ("From: Coaching Presence assessment, scored 4/10")

**Database:**
```sql
CREATE TABLE goal_assessment_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  -- Polymorphic: exactly one of these should be set
  capability_assessment_id UUID REFERENCES capability_assessments(id) ON DELETE SET NULL,
  capability_domain_id UUID REFERENCES capability_domains(id) ON DELETE SET NULL,
  capability_snapshot_id UUID REFERENCES capability_snapshots(id) ON DELETE SET NULL,
  assessment_definition_id UUID REFERENCES assessment_definitions(id) ON DELETE SET NULL,
  psychometric_assessment_id UUID REFERENCES psychometric_assessments(id) ON DELETE SET NULL,
  -- Context
  score_at_creation NUMERIC,        -- what the score was when goal was created
  target_score NUMERIC,             -- what score the user is aiming for
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(goal_id, capability_domain_id)  -- one link per domain per goal
);
```

**UI changes:**
- Goal creation dialog: optional "Linked Assessment" section when creating from assessment context
- Goal card: small badge showing assessment origin
- Goal detail: assessment score history (current vs. at-creation)

---

### Phase 2: Development Profile Page (3-5 days) ✅ DONE

**Why:** The unified view that makes everything else meaningful. Coaches and clients need this to see the full picture.

**What:** New page at `/development-profile` (client) and `/teaching/students/:id/profile` (coach view) that aggregates:

**Section A — Strengths & Gaps Matrix:**
- Pull all capability snapshots → compute domain averages
- Pull assessment definition responses → dimension scores
- Merge into a single strengths/gaps view
- Color coding: green (≥80%), amber (50-79%), red (<50%)
- Show trend arrows (improving ↑, declining ↓, stable →) from evolution data

**Section B — Active Development Items:**
- Grouped by assessment domain (using existing junction tables)
- Show status (in-progress, completed)
- Link to the source assessment question/domain

**Section C — Goal Progress:**
- Goals linked to assessments (via Phase 1 `goal_assessment_links`)
- Progress bars from milestone completion
- Assessment score overlay: "Goal: Improve Coaching Presence. Started at 4/10, now 6/10, target 8/10"

**Section D — Skills Earned:**
- Badges from completed modules
- Mapped to assessment domains (Phase 5 — shown as placeholder until then)

**Section E — Guided Path Progress (if any):**
- Active guided path with milestone timeline
- Readiness signals per milestone (Phase 3 — shown as placeholder until then)

---

### Phase 3: Assessment-Gated Milestones (3-5 days) ✅ DONE

**Why:** The feature that makes guided paths intelligent. Without it, milestones are just a checklist — with it, they reflect actual readiness.

**What:**
- Admin can configure assessment gates on guided path template milestones
- Each gate specifies: assessment, domain/dimension, minimum score
- Client view shows traffic-light readiness per milestone:
  - 🟢 Green: all gates met
  - 🟡 Amber: some gates met, others close (within 1 point)
  - 🔴 Red: gates not met
  - ⚪ Grey: no assessment data yet
- **Coach override:** Coaches can mark a gate as "waived" with a note (e.g., "Demonstrated in live session, not reflected in self-assessment")
- Milestones are NOT locked — clients can still mark them complete. Gates are advisory, not blocking.

**Database:**
```sql
CREATE TABLE guided_path_milestone_gates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_milestone_id UUID NOT NULL REFERENCES guided_path_template_milestones(id) ON DELETE CASCADE,
  -- Assessment source (exactly one set)
  capability_assessment_id UUID REFERENCES capability_assessments(id) ON DELETE CASCADE,
  capability_domain_id UUID REFERENCES capability_domains(id) ON DELETE CASCADE,
  assessment_definition_id UUID REFERENCES assessment_definitions(id) ON DELETE CASCADE,
  assessment_dimension_id UUID REFERENCES assessment_dimensions(id) ON DELETE CASCADE,
  -- Gate criteria
  min_score NUMERIC NOT NULL,
  gate_label TEXT,  -- e.g., "Coaching Presence ≥ 7"
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE milestone_gate_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_milestone_id UUID NOT NULL REFERENCES goal_milestones(id) ON DELETE CASCADE,
  gate_id UUID NOT NULL REFERENCES guided_path_milestone_gates(id) ON DELETE CASCADE,
  overridden_by UUID NOT NULL REFERENCES auth.users(id),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(goal_milestone_id, gate_id)
);
```

**UI changes:**
- Admin: gate configuration on template milestone edit dialog
- Client: traffic-light indicators on milestone cards in guided path view
- Coach: "Waive Gate" button with required reason field on student's milestone view

---

### Phase 4: Intake-Driven Path Recommendation (3-5 days) ✅ DONE

**Why:** Fixes the critical survey instantiation bug AND ensures clients start on realistic paths.

**Context:** The current `GuidedPathSurveyWizard` saves survey responses but never creates goals. Additionally, clients sometimes set unrealistic timelines (e.g., "I want CTA in 6 months" when 12 months is realistic). The intake survey should assess where they stand and recommend the right variant.

**What:**

**4a. Fix survey instantiation (must-have):**
- After `GuidedPathSurveyWizard` saves `selected_template_ids`, instantiate the matched template:
  - Copy `guided_path_template_goals` → `goals`
  - Copy `guided_path_template_milestones` → `goal_milestones`
  - Copy `guided_path_template_tasks` → `tasks`
  - Apply pace calculation using `recommended_days_optimal` (or min/max based on pace selection)
  - Create `goal_assessment_links` for any gates defined on the template milestones (Phase 3)
- Store the template→goal mapping for traceability

**4b. Conditional milestone skipping:**
- If assessment data exists at instantiation time, check gates
- Skip milestones where all gates are already met (mark as pre-completed)
- Adjust subsequent milestone dates accordingly
- Show "Skipped — already demonstrated" in the path view

**4c. Pace multiplier:**
- Survey includes a "How much time can you dedicate?" question
- Options map to pace multipliers: intensive (0.7x), standard (1.0x), part-time (1.5x)
- Applied to `recommended_days_optimal` when calculating milestone target dates

**4d. Estimated duration display:**
- After survey completion, before instantiation, show: "Based on your responses, this path typically takes **10-14 months**. Your personalized estimate: **12 months** based on standard pace."
- User confirms or adjusts before goals are created

**Database:**
```sql
-- Track which template was instantiated for a user
CREATE TABLE guided_path_instantiations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  template_id UUID NOT NULL REFERENCES guided_path_templates(id) ON DELETE SET NULL,
  survey_response_id UUID REFERENCES guided_path_survey_responses(id) ON DELETE SET NULL,
  pace_multiplier NUMERIC NOT NULL DEFAULT 1.0,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  estimated_completion_date DATE,
  actual_completion_date DATE,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed', 'abandoned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Map instantiated goals back to template goals
ALTER TABLE goals ADD COLUMN template_goal_id UUID REFERENCES guided_path_template_goals(id) ON DELETE SET NULL;
ALTER TABLE goals ADD COLUMN instantiation_id UUID REFERENCES guided_path_instantiations(id) ON DELETE SET NULL;
```

---

### Phase 5: Module ↔ Assessment Domain Mapping (2-3 days)

**Why:** Completing a module should inform the development profile. "You completed Coaching Ethics → your Ethical Practice domain is likely improving."

**What:**
- Admin can tag modules with capability assessment domains
- When a module is completed, the Development Profile shows it as evidence for the mapped domain
- Does NOT auto-update assessment scores (that requires re-assessment) — but shows "Module completed, re-assessment recommended"

**Database:**
```sql
CREATE TABLE module_domain_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID NOT NULL REFERENCES program_modules(id) ON DELETE CASCADE,
  capability_domain_id UUID NOT NULL REFERENCES capability_domains(id) ON DELETE CASCADE,
  relevance TEXT DEFAULT 'primary' CHECK (relevance IN ('primary', 'secondary')),
  UNIQUE(module_id, capability_domain_id)
);
```

**UI changes:**
- Admin module form: multi-select "Related Assessment Domains" dropdown
- Development Profile: "Evidence" column showing completed modules per domain
- Module completion: toast/badge "This module relates to [Domain]. Consider re-assessing."

---

### Phase 6: Psychometric Structured Results (2-3 days)

**Why:** Psychometric assessments are currently PDF-only. To include them in the Development Profile, we need structured data.

**What:**
- New `psychometric_results` table for structured score entry
- Coaches or clients can manually enter key scores from external assessments (e.g., DISC: D=85, I=42, S=28, C=65)
- Pre-defined result schemas per assessment type (DISC, VIA, MBTI, etc.)
- Results displayed in Development Profile alongside capability scores
- Future: AI PDF parsing to auto-extract scores (deferred — manual entry first)

**Database:**
```sql
CREATE TABLE psychometric_result_schemas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assessment_id UUID NOT NULL REFERENCES psychometric_assessments(id) ON DELETE CASCADE,
  dimensions JSONB NOT NULL,  -- e.g., [{"key":"D","label":"Dominance","min":0,"max":100}, ...]
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE psychometric_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  user_assessment_id UUID NOT NULL REFERENCES user_assessments(id) ON DELETE CASCADE,
  scores JSONB NOT NULL,  -- e.g., {"D": 85, "I": 42, "S": 28, "C": 65}
  entered_by UUID NOT NULL REFERENCES auth.users(id),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

---

### Phase 7: Readiness Dashboard (3-5 days)

**Why:** The capstone view. Combines everything into a single "Are you ready?" answer.

**What:** A coach-facing dashboard showing all clients on guided paths with:

- **Readiness score** per client: percentage of assessment gates met across all active milestones
- **Attention signals:** clients whose readiness has stalled or declined
- **Path progress:** visual timeline with milestone completion vs. target dates
- **Overdue milestones:** milestones past their target date with unmet gates
- **Batch actions:** "Schedule re-assessment for all clients on CTA path"

**Client-facing version:** "My Readiness" widget on the Development Profile showing:
- Overall readiness percentage
- Next milestone with gate status
- "What I need to work on" — domains where gaps exist for upcoming milestones
- Estimated time to next milestone based on current pace

---

## 5. Database Changes Summary

| Phase | Tables Created/Modified | Effort | Status |
|-------|------------------------|--------|--------|
| 1 | `goal_assessment_links` (CREATE) | 1-2 days | ✅ DONE |
| 2 | No schema changes (UI only, reads existing data) | 3-5 days | ✅ DONE |
| 3 | `guided_path_milestone_gates` (CREATE), `milestone_gate_overrides` (CREATE) | 3-5 days | ✅ DONE |
| 4 | `guided_path_instantiations` (CREATE), `goals.template_goal_id` + `goals.instantiation_id` (ALTER) | 3-5 days | ✅ DONE |
| 5 | `module_domain_mappings` (CREATE) | 2-3 days | Pending |
| 6 | `psychometric_result_schemas` (CREATE), `psychometric_results` (CREATE) | 2-3 days | Pending |
| 7 | No schema changes (UI only, reads Phase 1-6 data) | 3-5 days | Pending |
| **Total** | **6 new tables, 2 altered columns** | **~18-28 days** | **4/7 done** |

---

## 6. UX Wireframes (Conceptual)

### Development Profile Page Layout

```
┌────────────────────────────────────────────────────────────────┐
│  Development Profile — Sarah Johnson                           │
│  ─────────────────────────────────────────────────────         │
│                                                                │
│  ┌─── Strengths & Gaps ────────────────────────────────────┐  │
│  │                                                          │  │
│  │  [Radar Chart: capability domains]                       │  │
│  │                                                          │  │
│  │  🟢 Ethical Practice ........... 8.5/10  ↑ (+1.2)       │  │
│  │  🟢 Coaching Agreements ........ 7.8/10  → (stable)     │  │
│  │  🟡 Active Listening ........... 6.2/10  ↑ (+0.8)       │  │
│  │  🔴 Powerful Questioning ....... 4.1/10  ↓ (-0.3)       │  │
│  │  🔴 Direct Communication ....... 3.8/10  → (stable)     │  │
│  │                                                          │  │
│  │  [Dimension Scores from Assessment Definitions]          │  │
│  │  [Psychometric Summary: DISC D=85 I=42 S=28 C=65]       │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─── Active Goals (linked to assessments) ────────────────┐  │
│  │                                                          │  │
│  │  📎 Improve Powerful Questioning         ████████░░ 75%  │  │
│  │     From: ICF Core Competencies, scored 4.1/10           │  │
│  │     Target: 7.0/10  |  3 milestones, 2 completed        │  │
│  │                                                          │  │
│  │  📎 Develop Direct Communication         ████░░░░░░ 40%  │  │
│  │     From: ICF Core Competencies, scored 3.8/10           │  │
│  │     Target: 7.0/10  |  4 milestones, 1 completed        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─── Guided Path: CTA Preparation ───────────────────────┐   │
│  │                                                          │  │
│  │  Overall Readiness: 62%  |  Est. completion: Oct 2026    │  │
│  │                                                          │  │
│  │  ✅ M1: Foundation Review ............ Complete           │  │
│  │  ✅ M2: Ethics Certification ......... Complete           │  │
│  │  🟡 M3: Competency Portfolio ......... In Progress       │  │
│  │     Gate: Coaching Presence ≥ 7 ... currently 6.2 🟡     │  │
│  │     Gate: Direct Communication ≥ 6 . currently 3.8 🔴    │  │
│  │  ⚪ M4: Mock Review Board ............ Not Started        │  │
│  │  ⚪ M5: Application Submission ....... Not Started        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─── Development Items ───────────────────────────────────┐  │
│  │  Grouped by domain, showing recent items                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌─── Skills Earned ───────────────────────────────────────┐  │
│  │  🏅 Coaching Ethics  🏅 Client Intake  🏅 Goal Setting  │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

### Readiness Dashboard (Coach View)

```
┌────────────────────────────────────────────────────────────────┐
│  Client Readiness — CTA Preparation Path                       │
│  ─────────────────────────────────────────                     │
│                                                                │
│  Client           Readiness  Progress  Next Milestone   Alert  │
│  ────────────────────────────────────────────────────────────  │
│  Sarah Johnson    62%        M3/5      Competency Port  🟡     │
│  Michael Chen     85%        M4/5      Mock Review      🟢     │
│  Emily Parker     31%        M2/5      Ethics Cert      🔴     │
│  James Wilson     45%        M2/5      Ethics Cert      ⚠️     │
│                                                                │
│  ⚠️ = readiness stalled for 30+ days                          │
│  🔴 = behind schedule + unmet gates                            │
└────────────────────────────────────────────────────────────────┘
```

---

## 7. Key Design Decisions

### 7.1 Gates Are Advisory, Not Blocking

Milestones are never locked behind assessment scores. Reasons:
- Coaching is inherently human-judgment-based — a score doesn't capture everything
- Clients demonstrated competencies may not be reflected in self-assessments
- Coach override with documented reason provides accountability without rigidity

### 7.2 Intake-Driven Recommendation, Not Backward Planning

**Rejected approach:** Client picks a target date and the system compresses milestones backward.

**Chosen approach:** Intake survey assesses starting point → selects the right template variant → applies pace multiplier → skips already-demonstrated milestones → shows a realistic duration estimate.

**Why:** Clients often set unrealistic timelines (e.g., "CTA in 6 months" when 12 months is realistic). Coaches need the system to support realistic expectations, not enable compression of essential development steps. The system recommends; the coach guides; the client decides with full information.

### 7.3 Phased Rollout, Not Big Bang

Each phase delivers standalone value:
- Phase 1 alone: coaches see why goals exist
- Phase 2 alone: unified view of all assessment data
- Phase 3 alone: intelligent guided paths
- Phase 4 alone: fixes a critical bug and adds realistic timing

### 7.4 Manual-First for Psychometrics

Rather than building AI PDF parsing (complex, error-prone), start with manual structured entry for psychometric results. This gets data into the system immediately. AI parsing can be added later as an enhancement.

### 7.5 Strengths Matter Too

The system doesn't just track gaps — it also tracks strengths. A client scoring 9/10 on Ethical Practice should see that celebrated, not just focus on what's below threshold. Strengths inform coaching approach (leverage strengths to address gaps) and contribute to readiness signals.

---

## Appendix A: Existing Tables Referenced

### Assessment Tables
- `capability_assessments`, `capability_domains`, `capability_domain_questions`
- `capability_snapshots`, `capability_snapshot_ratings`, `capability_domain_notes`
- `instructor_capability_evaluations`, `instructor_capability_ratings`
- `assessment_definitions`, `assessment_dimensions`, `assessment_questions`
- `assessment_options`, `assessment_option_scores`, `assessment_interpretations`
- `assessment_responses`
- `psychometric_assessments`, `user_assessments`
- `assessment_categories`, `assessment_families`

### Development Item Tables
- `development_items`
- `development_item_question_links`, `development_item_domain_links`
- `development_item_snapshot_links`, `development_item_goal_links`
- `development_item_milestone_links`, `development_item_task_links`
- `development_item_group_links`, `development_item_module_links`

### Goal Tables
- `goals`, `goal_milestones`, `goal_shares`, `goal_comments`
- `goal_reflections`, `goal_resources`, `decision_goals`

### Guided Path Tables
- `guided_path_template_families`, `family_survey_questions`, `template_conditions`
- `guided_path_templates`, `guided_path_template_goals`
- `guided_path_template_milestones`, `guided_path_template_tasks`
- `guided_path_survey_responses`

### Other Referenced Tables
- `program_modules`, `module_progress`, `skills`, `user_skills`
- `programs`, `client_enrollments`
