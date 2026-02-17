# Product Strategy: Young Professionals & AI-Guided Learning

> This document captures product ideas for expanding the platform's appeal to younger users (18-30), and a separate section on embedding AI for guided learning across all audiences — including senior professionals already using external AI tools.

---

## Part 1: Making the Platform Valuable for Young Professionals

### What We Already Have That Resonates

The platform has a strong foundation for this audience:
- **AI coaching** — they expect AI-first experiences
- **Capability assessments** — they want to know where they stand
- **Goal setting + development items** — they're growth-oriented
- **Decision toolkit** — they struggle with decision overload
- **Wheel of Life** — self-discovery hooks are viral with this demographic
- **Scenario-based learning** — they prefer interactive over lecture

What's missing is the **wrapper** — how these features are framed, delivered, and socially reinforced.

---

### Quick Wins — Reframing What Exists

#### 1. "Career Clarity" Positioning Instead of "Development"

Young people don't think "I need professional development." They think "I have no idea what to do with my life" or "Am I on the right track?"

Reframe assessments and goals around **career clarity, life direction, and self-discovery** — same underlying features, different language in the UI copy, onboarding flow, and marketing.

**Examples:**
- "Capability Assessment" → "Discover Your Strengths"
- "Set Development Goals" → "What Do You Want to Build Next?"
- "Decision Toolkit" → "Stuck on a Big Decision?"
- "Reflection Journal" → "Weekly Check-In With Yourself"

**Effort:** Copy changes only. No code restructuring needed.

---

#### 2. Micro-Goals Instead of Big Plans

Gen Z is overwhelmed by long-term planning. The current goal system is open-ended — users set goals with no time frame guidance.

Offer **7-day or 30-day micro-challenges** alongside existing goals:
- "This week: have one difficult conversation"
- "This month: identify 3 things that energize you at work"
- "7-day challenge: make one decision per day using a framework"

These feel achievable. "Improve communication skills over 6 months" feels abstract and gets abandoned.

**Implementation:** Add `goal_type` field (long_term / micro_challenge) with optional `challenge_duration_days`. Surface micro-challenges with a different UI treatment — card-based, with countdown timers and completion celebrations.

---

#### 3. AI Coach Personality / Tone Options

The current AI system prompts use a professional coaching tone. Younger users want to feel like they're talking to a peer, not a corporate HR tool.

Add a tone selector to AI preferences:
- **"Supportive Mentor"** — warm, encouraging (current default)
- **"Direct Challenger"** — pushes harder, less hand-holding
- **"Curious Friend"** — casual, conversational, asks questions

**Implementation:** Store `ai_tone_preference` in `ai_preferences` table. Prepend a tone-specific system instruction to existing prompts. Same underlying AI logic, different conversational wrapper.

---

### Medium Effort — New Features on Existing Infrastructure

#### 4. "Life Compass" — Guided Onboarding Journey

Combine Wheel of Life + capability assessment + goal setting into a **single guided flow**: "In 15 minutes, discover your strengths, blind spots, and what to focus on next."

This replaces the scattered "take an assessment, then separately go set goals" experience with a narrative arc. Think BuzzFeed quiz meets professional development.

**Flow:**
1. Quick Wheel of Life (5 min) → shows life balance
2. Mini capability check (5 min) → shows top 3 strengths and 2 growth areas
3. AI-generated "Your Growth Map" → personalized summary combining both
4. "Pick one thing to work on" → auto-creates a micro-goal
5. "Want to go deeper?" → suggests a program or full assessment

**Why it works:** Young users don't explore — they need to be guided. A single linear flow converts signups into engaged users who understand what the platform offers.

---

#### 5. Peer Accountability Circles

Small groups (3-5 people) who share goals and check in weekly. The platform already has groups infrastructure.

Add a lightweight weekly check-in:
- "Did you make progress on your goal?"
- "Share one win and one struggle"
- See what others in your circle shared

This taps into social accountability — the mechanic that makes Strava, Duolingo, and running clubs work. Young professionals especially respond to peer pressure (positive) over top-down coaching.

**Implementation:** Reuse existing groups + announcements infrastructure. Add a `check_in` table linked to groups, with a weekly cadence trigger.

---

#### 6. Reflection Streaks and Nudges

Gamify the existing reflection system:
- "You've reflected 3 weeks in a row 🔥"
- Streak counter on dashboard
- Email/push nudge when streak is about to break: "Don't lose your 4-week streak!"

Streaks are the single most effective retention mechanic for younger users. Snapchat, Duolingo, BeReal all proved this. Simple to implement, disproportionate impact on retention.

**Implementation:** Count consecutive weekly reflections per user. Add streak count to profile/dashboard. Trigger nudge email via existing notification system when streak is at risk (e.g., Friday of a week with no reflection).

---

#### 7. Shareable Progress Snapshots

Let users generate a visual card showing their growth:
- Assessment radar chart
- Goals completed
- Streak count
- "I've been growing for X weeks on InnoTrue"

Shareable on LinkedIn and Instagram. This turns users into a marketing channel. Young professionals love sharing personal growth content on social media — it signals ambition and self-awareness.

**Implementation:** Server-side or client-side image generation (e.g., `html-to-image` library). Template with user data overlaid. Share button with platform branding.

---

#### 8. Mentorship Matching

Beyond formal coaching (which is program-linked and coach-assigned), let users opt into peer mentoring:
- A senior user who completed a program could mentor someone starting it
- A coach could offer "office hours" slots visible to all their clients
- Users could browse mentor profiles and request a connection

This creates community stickiness and gives advanced users a reason to stay engaged after completing their program.

**Implementation:** Extend `client_coaches` with a `relationship_type` field (formal_coaching / peer_mentoring / office_hours). Add opt-in flag to profiles. Matching could be manual (browse + request) initially, AI-assisted later.

---

### Bigger Bets — New Product Directions

#### 9. "First Job / Career Transition" Program Template

Create a pre-built program specifically for 20-somethings:
- "Understanding your work style"
- "Navigating office politics"
- "When to stay vs. leave"
- "Building a career without a linear plan"
- "Having difficult conversations with your manager"

This could be the acquisition hook — partner with universities, bootcamps, or career services offices. They're always looking for structured post-graduation support tools.

**Implementation:** Build as a standard program using existing modules, scenarios, and assessments. The content is the product here, not the technology.

---

#### 10. Community-Driven Scenarios

Let users or coaches submit real-world dilemmas as scenario templates:
- "Your manager takes credit for your work — what do you do?"
- "A colleague is underperforming and it's affecting your project"
- "You got a job offer but your current team is counting on you"

Young users engage more with crowdsourced, relatable content than corporate training material. The scenario engine already supports rich branching — it just needs a submission pipeline and curation workflow.

---

#### 11. Mobile-First "Daily Growth" Experience

A 5-minute daily touchpoint:
- One reflection prompt (AI-generated, already exists)
- One micro-learning nugget (from program content)
- One goal check-in

Not a full app rewrite — a focused mobile view of existing features. Young users engage in short bursts throughout the day, not 45-minute desktop sessions.

---

#### 12. Integration With Their Existing Tools

- **Notion** — sync goals and development items
- **Slack / Discord** — weekly accountability bot messages
- **Calendar** — auto-block "reflection time" or "growth time"

These make the platform part of their workflow rather than "another app to check."

---

### Recommended Priorities for Young Professionals

If starting with 3 items:

1. **Reflection streaks + nudges** (#6) — highest retention impact, low effort, builds on what exists
2. **Life Compass guided onboarding** (#4) — converts signups to engaged users
3. **Shareable progress snapshots** (#7) — organic growth channel

All three build on existing features. None require new infrastructure. They change **how users experience** the platform more than what the platform does.

---

## Part 2: AI-Guided Learning — Embedding AI Into Programs and Beyond

### The Opportunity

Senior professionals are already using AI tools (ChatGPT, Claude, Perplexity) for their own development — but outside the platform, in an unstructured way. They get value, but also face:
- **Hallucinations** — AI confidently provides wrong frameworks, misattributed research, or invented case studies
- **Going off track** — without guardrails, conversations drift from development goals into general chat, amateur therapy, or irrelevant tangents
- **No continuity** — each conversation starts from scratch; there's no memory of their goals, progress, or coaching context
- **No accountability** — insights generated in ChatGPT don't connect back to goals, reflections, or coach visibility

The platform can solve all four problems by making AI a **guided, contextual, bounded** part of the development experience rather than a separate tool.

---

### Current AI Infrastructure (What We Have)

The platform already has:
- **4 AI edge functions**: decision insights, course recommendations, reflection prompts, admin analytics
- **Vertex AI Gemini (EU/Frankfurt)** as the provider — GDPR-compliant, no data used for training
- **Input truncation system** — all prompts capped at 8,000 characters, arrays at 20 items, strings at 500 chars
- **Credit-based consumption** — users have monthly AI call limits tied to their plan
- **Explicit consent** — users must opt in before any AI feature activates
- **Privacy notice** — displayed on every AI feature, explaining data is never stored by the AI provider
- **Provider-agnostic architecture** — can switch between Vertex AI, Mistral, Azure OpenAI, or OpenAI with zero code changes

This is a solid foundation. The recommendations below extend it.

---

### Design Principles for Safe AI-Guided Learning

These principles apply across all audiences — young professionals, senior executives, coaches, and instructors.

#### Principle 1: AI Is the Guide, Not the Expert

The AI should never present itself as an authority on the user's field. It should:
- **Ask questions** more than give answers
- **Reflect back** what the user said, reframed
- **Suggest frameworks** from the platform's toolkit (not invented ones)
- **Point to resources** in the platform's library, not external URLs
- **Defer to the human coach** on complex or sensitive topics

This is the fundamental anti-hallucination strategy: an AI that asks "What do you think about that?" can't hallucinate. An AI that says "Research shows..." will.

**Implementation:** System prompts must explicitly instruct the AI to operate in Socratic mode — ask, reflect, reframe — and to never cite research, statistics, or case studies unless they come from data the system provides in the prompt context.

#### Principle 2: Context-Rich, Output-Constrained

The more context you give the AI, the less room it has to hallucinate. The less output you allow, the less room it has to drift.

- **Rich input:** Pass the user's goals, recent reflections, assessment scores, program progress, coach notes (with consent) into every AI interaction
- **Constrained output:** Limit responses to specific formats (3 questions, a summary paragraph, a framework suggestion) rather than open-ended essays
- **Structured responses:** Use JSON-mode or explicit format instructions ("Respond with exactly 3 reflection questions, each under 20 words")

**Current state:** The reflection prompt function already does this well — rich context in, short prompt out (150 tokens max). Decision insights is looser (longer output). Course recommendations has good constraints (prioritize platform content first).

#### Principle 3: Everything Connects Back to the Platform

AI outputs should not be standalone. Every AI interaction should:
- Reference the user's existing goals, decisions, or reflections
- Offer to create a new goal, reflection, or development item from the insight
- Be visible to the user's coach (with consent)
- Be stored and retrievable (not ephemeral like ChatGPT)

This prevents the "interesting conversation that goes nowhere" problem. If the AI suggests a growth area, one click turns it into a tracked goal.

#### Principle 4: Human Coach as Safety Net

For anything beyond reflection and exploration, the AI should flag for human review:
- "This might be worth discussing with your coach"
- "I've shared this insight with [Coach Name] for your next session" (with consent)
- Coach sees AI interaction summaries in their client dashboard

The coach can correct course if the AI went off track. This is the ultimate guardrail — a human in the loop who knows the client.

#### Principle 5: Transparent Boundaries

Tell users explicitly what the AI can and cannot do:
- "I can help you reflect on your decisions, but I can't give you career advice"
- "I can suggest frameworks from the InnoTrue toolkit, but I'm not a therapist"
- "If you're dealing with something serious, here's how to reach your coach"

Young users especially appreciate transparency about AI limitations — they're more AI-literate than older generations and distrust systems that pretend to be more capable than they are.

---

### Recommended AI Features to Build

#### Feature A: AI Learning Companion (Per-Module)

**What:** Each program module gets an AI companion that helps the user process what they learned. After completing a module, the user can "discuss" it with the AI.

**How it works:**
1. User completes a module (watches video, reads content, does exercise)
2. "Reflect on this module" button appears
3. AI receives: module content summary, learning objectives, user's goals, recent reflections, assessment context
4. AI asks 2-3 targeted questions: "You just learned about [topic]. How does this relate to [user's goal]? What's one thing you could try this week?"
5. User responds → AI follows up with one more question or a summary
6. Conversation saved as a reflection entry, visible to coach

**Anti-hallucination design:**
- AI only references module content (provided in prompt) and user data (provided in prompt)
- Never cites external research or statistics
- Output format: exactly 2-3 questions, then a summary
- Max 3 conversation turns — prevents drift
- System prompt: "You are helping the user connect [specific module topic] to their personal development. Do NOT provide information beyond what is in the module content. Ask questions to help the user think, do not lecture."

**Why it matters:** This is the single highest-value AI feature for programs. It turns passive content consumption into active learning. Research on learning science consistently shows that retrieval practice (being asked questions about what you learned) is far more effective than re-reading.

---

#### Feature B: AI-Powered Pre-Session Prep (For Coaching Sessions)

**What:** Before a scheduled coaching session, the AI generates a prep brief for both the client and the coach.

**For the client (24h before session):**
- "Here's what's happened since your last session: [goal progress, completed modules, reflections summary]"
- "Three questions to think about before meeting your coach:"
  1. (Based on stalled goal) "Your goal [X] hasn't moved in 2 weeks — what's blocking you?"
  2. (Based on reflection) "You mentioned [Y] in your reflection — is this something you want to explore with your coach?"
  3. (Based on assessment) "Your [domain] score suggests an opportunity — do you want to discuss strategies?"

**For the coach (same time):**
- Client progress summary since last session
- Flagged items: stalled goals, missed reflections, assessment changes
- Suggested session topics based on client data

**Anti-hallucination design:**
- AI generates questions only from verified platform data (goals, reflections, assessments, module completions)
- No interpretation of what the data "means" — just surfaces patterns and asks questions
- Coach sees the same data and can override or adjust before the session
- Output is structured: exactly 3 prep questions for client, exactly 1 summary + 3 flags for coach

---

#### Feature C: Scenario Debrief Conversations

**What:** After a user completes a scenario exercise, the AI leads a short debrief conversation.

**How it works:**
1. User completes scenario (makes choices, writes responses)
2. AI receives: scenario template, user's choices, rubric criteria, ideal responses (admin-defined)
3. AI asks: "You chose [X] in this situation. Walk me through your thinking."
4. User explains → AI reflects back: "It sounds like you prioritized [value]. The framework suggests also considering [other perspective]. What do you think?"
5. 2-3 turns max → summary saved

**Anti-hallucination design:**
- AI is grounded entirely in the scenario content and rubric (admin-authored, trusted)
- Never invents alternative scenarios or hypothetical outcomes
- Stays within the rubric's framework — doesn't add its own evaluation criteria
- System prompt: "You are debriefing a scenario exercise. Only reference the scenario content and rubric provided. Help the user understand their choices, do not evaluate or grade them — that is the instructor's role."

---

#### Feature D: Goal Coaching Nudges

**What:** When a user's goal has been stalled (no progress update in X days), the AI sends a contextual nudge.

**Examples:**
- "You set a goal to [X] three weeks ago. What's one small step you could take today?"
- "Your reflection last week mentioned [Y]. Could that be connected to your goal [X]?"
- "Other users working on similar goals found it helpful to break them into weekly milestones. Want to try that?"

**Anti-hallucination design:**
- Nudges are generated from templates with variable slots filled by real user data
- No free-form AI generation for nudges — use a library of 20-30 nudge templates, AI selects the most relevant one based on context
- "Other users" phrasing is only used if backed by actual aggregated data, otherwise removed from the template
- Max 2 sentences per nudge

---

#### Feature E: "Ask About My Progress" — Conversational Dashboard

**What:** Users can ask natural-language questions about their own data:
- "How am I doing on my goals?"
- "What did I reflect on last month?"
- "Which assessment areas have improved?"
- "What should I focus on next?"

**How it works:**
- AI receives the user's full context (goals, assessments, reflections, enrollments, module progress)
- Answers strictly from that data — acts as a natural-language interface to the dashboard
- Can generate mini-visualizations or comparisons

**Anti-hallucination design:**
- AI is explicitly a data reporter, not an advisor
- System prompt: "Answer the user's question using ONLY the data provided. If the data doesn't contain the answer, say 'I don't have that information.' Never speculate, infer, or provide advice beyond what the data shows."
- Every response includes a "Based on:" citation showing which data points were used
- No external knowledge — model temperature set to 0 (deterministic)

---

### Anti-Hallucination Strategy — Summary

| Layer | Mechanism | Already Built? |
|-------|-----------|---------------|
| **Input grounding** | Rich context from platform data in every prompt | ✅ Partial (reflections, goals, assessments passed to prompts) |
| **Input limits** | Truncation system caps all inputs | ✅ Yes (`ai-input-limits.ts`) |
| **Output constraints** | Structured formats, token limits, turn limits | ✅ Partial (reflections = 150 tokens; others are open-ended) |
| **Source restriction** | AI told to only reference provided data, never external knowledge | ⚠️ Needs strengthening in system prompts |
| **Framework anchoring** | AI only suggests frameworks that exist in the platform | ✅ Decision insights does this |
| **Human review** | Coach sees AI outputs, can correct | ❌ Not built yet |
| **Template-based generation** | Use templates with variable slots instead of free-form | ❌ Not built (nudges, prep briefs) |
| **Conversation limits** | Max turns per interaction (prevents drift) | ❌ Not built (current features are single-shot) |
| **Temperature control** | Low temperature for factual queries, higher for creative reflection | ✅ Partial (reflections use 0.8, others use default) |
| **Explicit boundaries** | AI states what it cannot do | ⚠️ Needs adding to system prompts |
| **Citation / "Based on"** | AI shows which data points informed its response | ❌ Not built |
| **Consent gating** | Users opt in before any AI interaction | ✅ Yes (AIConsentGate) |
| **Credit limits** | Monthly consumption caps prevent overuse | ✅ Yes |
| **Privacy / GDPR** | EU data residency, no training on user data | ✅ Yes (Vertex AI Frankfurt) |

---

### Addressing Senior Professionals Using External AI

Senior professionals currently using ChatGPT/Claude externally for development is both a validation and a risk:
- **Validation:** They find AI-assisted reflection valuable
- **Risk:** They're getting ungrounded, context-free AI interactions that may reinforce biases or provide inaccurate frameworks

**Strategy: Don't compete with ChatGPT — complement it.**

Position the platform's AI as the **structured, contextual, coach-connected** layer that external AI can't provide:

1. **"Your AI here knows your journey"** — external AI starts from scratch every time. The platform's AI knows their goals, assessments, coach notes, and program progress
2. **"Your AI here stays on track"** — bounded conversations focused on their development, not random exploration
3. **"Your coach sees what the AI suggests"** — accountability and correction loop that external AI doesn't have
4. **"Your data stays in Europe"** — for EU clients especially, this matters. ChatGPT conversations go to US servers

**Practical recommendation:** In the next program you run, dedicate 10 minutes to showing participants how the platform's AI features work, and explain why using the platform's AI instead of external tools gives them better, safer results. Frame it as "AI that knows you" vs "AI that just met you."

---

### Implementation Phasing

| Priority | Feature | Effort | Phase |
|----------|---------|--------|-------|
| 1 | **A: AI Learning Companion** (per-module debrief) | 1-2 weeks | Phase 3 (AI & Engagement) |
| 2 | **D: Goal Coaching Nudges** (template-based) | 3-5 days | Phase 3 |
| 3 | **B: Pre-Session Prep** (client + coach briefs) | 1-2 weeks | Phase 3 |
| 4 | **C: Scenario Debrief Conversations** | 1 week | Phase 2 or 3 |
| 5 | **E: Conversational Dashboard** | 2-3 weeks | Phase 3 or later |
| — | **System prompt hardening** (source restriction, boundaries) | 2-3 days | Anytime (do this first) |
| — | **Coach visibility of AI interactions** | 1 week | Phase 3 |
| — | **Conversation turn limits** (multi-turn support) | 1 week | Phase 3 prerequisite |

**Recommended first step:** Harden existing system prompts (add source restrictions, explicit boundaries, "Based on" citations) before building new features. This is 2-3 days of work and immediately improves all 4 existing AI functions.

---

### Key Takeaway

The platform's competitive advantage over general-purpose AI is **context + constraints + continuity:**
- **Context:** The AI knows the user's goals, progress, assessments, and program content
- **Constraints:** The AI stays within defined boundaries — no hallucinated research, no therapy, no career advice
- **Continuity:** AI interactions are stored, connected to goals, and visible to coaches — not ephemeral conversations lost in a chat window

This is what makes in-platform AI valuable for both young professionals (who need guidance and structure) and senior professionals (who need grounding and accountability). External AI gives breadth. Platform AI gives depth.

---

## Part 3: Fixing the Learning Content Delivery Experience

### The Problem

The current flow for accessing learning content is:

```
Hub → Open program → Open module → Click TalentLMS link → SSO redirect to Academy
→ Navigate TalentLMS UI → Click "Resume Course" → Popup opens with Rise content
```

That's **5-7 clicks and 2 full context switches** between "I want to learn" and "I'm learning." Every extra step loses users. For younger users especially, if the first interaction feels clunky, they won't come back.

The root cause: content is authored in **Articulate Rise**, exported as **SCORM**, uploaded to **TalentLMS**, then **linked** from the Hub. Each layer adds friction.

### Current Architecture (What Exists)

The platform already has:
- **TalentLMS SSO** (`talentlms-sso` edge function) — users authenticate seamlessly
- **xAPI webhook** (`talentlms-webhook`) — completion data flows back automatically
- **Progress sync** (`sync-talentlms-progress`) — manual sync button as fallback
- **Module sections** (`module_sections` table) — multi-block content within modules
- **External source framework** (`external_sources`, `module_external_mappings`, `external_progress`) — generic framework for any LMS
- **Resource viewer** — already handles iframe embedding for PDFs and media

The infrastructure is solid. The problem is the delivery path, not the plumbing.

---

### Option Analysis: What Articulate Rise Can Export

Rise supports multiple export formats. Each has different implications:

| Export Format | What It Is | Embeddable? | Tracks Progress? | Needs LMS? |
|---|---|---|---|---|
| **SCORM 1.2 / 2004** | Packaged course with tracking API | ✅ With SCORM player | ✅ Via SCORM API | Yes (or SCORM player) |
| **xAPI (Tin Can)** | Packaged course with xAPI tracking | ✅ With xAPI wrapper | ✅ Via xAPI statements | No (needs LRS) |
| **Web (HTML)** | Static HTML/CSS/JS bundle | ✅ Direct iframe | ❌ No tracking | No |
| **PDF** | Flat document | ✅ Via viewer | ❌ No tracking | No |
| **Video** | MP4 export | ✅ Native player | ❌ No tracking | No |

---

### Recommended Approach: Three Tiers (Pick Based on Need)

#### Tier 1: Quick Win — Embed Rise Web Export Directly (No TalentLMS)

**What:** Export Rise courses as **Web (HTML)** packages. Host the static files in Supabase Storage (or a CDN). Embed them in an iframe directly in the module page.

**User experience:**
```
Hub → Open module → Content loads inline (zero clicks)
```

**Pros:**
- Eliminates TalentLMS entirely for content delivery
- Zero context switches — learning happens inside the Hub
- Works today with existing `ModuleDetail.tsx` + iframe
- Static files are fast, cacheable, and fully under your control

**Cons:**
- No automatic progress/completion tracking (Rise Web export doesn't report back)
- You'd need to track completion manually (user marks "I finished this" or time-based heuristic)

**When to use:** For content where completion tracking isn't critical — introductory modules, awareness content, supplementary reading. Or where you track completion through a follow-up activity (reflection, quiz, assignment) rather than the content itself.

**Implementation:**
1. Export Rise course as "Web" format (produces a folder with `index.html` + assets)
2. Upload to Supabase Storage bucket (e.g., `learning-content/{module-id}/`)
3. Generate a signed URL for `index.html`
4. Embed in `ModuleDetail.tsx` via iframe:
   ```html
   <iframe src="{signed_url}" class="w-full h-[80vh] rounded-lg border" />
   ```
5. Add a "Mark as Complete" button below the iframe (updates `module_progress`)
6. Or: track completion through the next module activity (reflection prompt, quiz)

**Effort:** 3-5 days (upload tooling + iframe component + completion button)

---

#### Tier 2: Better — SCORM Player Embedded in the Hub (No TalentLMS for Delivery)

**What:** Export Rise courses as **SCORM packages**. Use an open-source JavaScript SCORM player to run them directly inside the Hub. SCORM completion events update `module_progress` automatically.

**User experience:**
```
Hub → Open module → SCORM content loads inline → Completion auto-tracked
```

**Pros:**
- Content loads inside the Hub (no context switch)
- Automatic progress and completion tracking via SCORM API
- Quiz scores, time spent, and interaction data captured
- Rise SCORM exports include all tracking that TalentLMS currently captures

**Cons:**
- Need to integrate a SCORM player (but good open-source options exist)
- SCORM packages are larger than web exports (includes tracking JS)
- Need storage for SCORM packages

**SCORM Player Options:**
- **SCORM Again** (`scorm-again`, npm) — lightweight, modern SCORM 1.2/2004 runtime. MIT license. Under 50KB. This is the recommended choice.
- **Rustici SCORM Cloud** — hosted service, paid. Overkill for this use case.
- **Custom minimal player** — SCORM API is well-documented; a minimal implementation that just captures completion + score is ~200 lines of JS.

**Implementation:**
1. Install `scorm-again` as a dependency
2. Create `ScormPlayer.tsx` component:
   - Extracts SCORM package from Supabase Storage
   - Initializes SCORM API (handles `LMSInitialize`, `LMSGetValue`, `LMSSetValue`, `LMSCommit`)
   - Renders content in sandboxed iframe
   - Listens for completion events (`cmi.core.lesson_status = "completed"`)
   - On completion: calls `module_progress` update
3. Create `upload-scorm-package` edge function (admin uploads SCORM .zip → extracts to storage)
4. Add SCORM content type to module admin form
5. In `ModuleDetail.tsx`: if module has SCORM content, render `ScormPlayer` instead of link card

**Effort:** 1-2 weeks

**Important note:** This approach means TalentLMS is no longer needed for content delivery. You'd keep TalentLMS only if you use it for other things (enrollment management, certificates, reporting). If the Hub handles all of that (which it increasingly does), you could eventually drop TalentLMS entirely and save the subscription cost.

---

#### Tier 3: Best — xAPI with Learning Record Store (Full Analytics)

**What:** Export Rise courses as **xAPI packages**. Run them in the Hub with an xAPI wrapper. All learning interactions (not just completion, but every click, quiz answer, time spent per slide) flow to a Learning Record Store (LRS).

**User experience:** Same as Tier 2 — inline, zero clicks.

**Additional benefit:** Rich analytics on how users engage with content (which slides they skip, where they spend time, which quiz questions they fail). This data can feed into the AI coaching features — "I noticed you spent extra time on the conflict resolution section. Want to explore that topic further?"

**Cons:**
- More complex to implement
- Need an LRS (can use the existing `external_progress` table as a lightweight LRS, or integrate a proper one like Learning Locker / Veracity)
- xAPI exports from Rise are larger

**When to use:** When you want learning analytics to drive personalization and AI coaching. This is the long-term ideal but not needed now.

**Effort:** 3-4 weeks

**Recommendation:** Plan for this in Phase 3 (AI & Engagement) or Phase 8 (Integrations). The xAPI data would power the AI Learning Companion feature from Part 2 of this document.

---

### What to Do With TalentLMS

TalentLMS currently serves three purposes:
1. **Content delivery** — hosting and playing Rise SCORM packages
2. **Progress tracking** — recording completion, scores, time spent
3. **User management** — TalentLMS user accounts linked to Hub users

With Tier 1 or 2, the Hub takes over purposes 1 and 2. Purpose 3 becomes unnecessary.

**Transition plan:**
- **Now:** Keep TalentLMS for existing programs already running. Don't disrupt live users.
- **New programs:** Use Tier 1 (Web embed) or Tier 2 (SCORM player) for all new content. No TalentLMS linking needed.
- **Migration:** When current programs end, don't re-link them through TalentLMS. Re-upload content directly to the Hub.
- **Sunset:** Once no active programs use TalentLMS, evaluate whether to keep the subscription. The xAPI webhook and SSO infrastructure stays in the codebase (zero cost when unused) in case you need it again.

**Cost consideration:** TalentLMS has a monthly subscription. If the Hub handles content delivery directly, that subscription becomes unnecessary — saving both money and complexity.

---

### Third-Party Content Strategy (Revisited)

This connects to the earlier question about using TalentLMS/Articulate Rise partner content:

**With direct embedding (Tier 1 or 2), the content strategy becomes cleaner:**

1. **Author in Rise** — it's a good authoring tool, keep using it
2. **Export as Web or SCORM** — skip TalentLMS entirely
3. **Upload to Hub storage** — content lives where users are
4. **Wrap in program** — your assessments, reflections, scenarios, AI debrief around the content
5. **Track in Hub** — completion, progress, scores all in one place

The "wrapper" strategy from the content discussion becomes much more compelling when the content actually lives inside the wrapper instead of being linked out to another platform.

---

### Recommended Path (Revised — Skip SCORM, Go Direct to xAPI)

After analysis, **SCORM is a dead end.** It's a frozen standard (last updated 2004) that only tracks completion and score. xAPI is the active industry standard that tracks everything — every interaction, time per slide, quiz attempts, revisits. And Rise exports xAPI natively.

The existing `talentlms-webhook` edge function already parses xAPI statements. The `external_progress` table already stores xAPI-style data with `external_metadata` JSONB. Going direct to xAPI is actually *less* work than building a SCORM player you'd throw away.

| Step | Action | Effort | Impact |
|------|--------|--------|--------|
| 1 | **Tier 1: Web embed** for next new program | 3-5 days | Eliminates TalentLMS for new content, zero-click learning |
| 2 | **Direct to xAPI** — Rise xAPI export + lightweight LRS endpoint in Hub | 1-2 weeks | Auto-tracking + rich learning analytics, no SCORM detour |
| 3 | Keep TalentLMS for active programs only, don't add new ones | — | Transition path |
| 4 | **xAPI → AI coaching** — feed learning behavior into AI features | Phase 3 | "I noticed you revisited the conflict section — want to explore that?" |

**Start with Tier 1** for the immediate UX win. Then go **direct to xAPI** — the effort is comparable to SCORM but the data is vastly richer and future-proof.

**Why skip SCORM:**
- Rise exports xAPI directly — no intermediate step needed
- SCORM only tells you "they finished, score 75%." xAPI tells you "how they learned."
- Building a SCORM player is 1-2 weeks of work you'd throw away when moving to xAPI
- The existing `talentlms-webhook` already parses xAPI statements — you're halfway there
- xAPI data feeds directly into the AI Learning Companion feature (Part 2 of this doc)

---

## Part 4: Cohort-Based Programs — Readiness Assessment

### Context

The platform needs to support live and hybrid cohort-based programs (e.g., CTA, leadership programs). Users enroll in a specific cohort, follow a schedule of live sessions + self-paced content, interact with their group, and get coached.

### What Already Exists (Strong Foundation)

The platform has **comprehensive cohort infrastructure** — significantly more than most platforms at this stage:

#### ✅ Cohort Management
- `program_cohorts` table with status (upcoming/active/completed/cancelled), capacity, start/end dates
- `cohort_sessions` table linking sessions to cohorts with date, time, location, meeting link, and order
- `client_enrollments.cohort_id` for cohort-based enrollment
- Admin UI: `ProgramCohortsManager.tsx` + `CohortSessionsManager.tsx`

#### ✅ Unified Session System (8 Pre-Configured Types)
- `sessions` table with status workflow (draft → scheduled → confirmed → in_progress → completed)
- `session_types`: coaching, group_coaching, workshop, mastermind, review_board_mock, peer_coaching, office_hours, webinar
- `session_type_roles`: presenter, evaluator, observer, facilitator, participant, hot_seat, member, coach, coachee, attendee
- Max participants, self-registration, registration deadlines
- `session_participants` with attendance tracking (invited → registered → confirmed → attended/no_show)

#### ✅ Group System
- `groups` table with status, join type (invitation/open), program association, max members
- `group_memberships` with roles (member/leader), status (active/pending/left)
- Group collaboration: tasks, check-ins (with mood tracking), shared notes, member links
- Group sessions with participant response tracking
- Peer assessments within groups (`group_peer_assessments`)
- Integration slots: Circle, Slack, Google Drive, Cal.com, Calendly

#### ✅ Scheduling & Calendar
- Cal.com integration (SSO, booking creation, webhook for booking events, event type mappings)
- Google Calendar sync (create events, iCal feeds, calendar tokens)
- Calendly support (event URI tracking on group sessions)
- `ProgramCalendar.tsx` admin view

#### ✅ Instructor/Coach Assignment
- Program-level: `program_instructors`, `program_coaches`
- Module-level: `module_instructors`, `module_coaches`
- Client-level: `client_instructors`, `client_coaches`
- Admin UI: `StaffAssignments.tsx`

#### ✅ Communication
- 25+ notification types across 8 categories (programs, sessions, assignments, goals, groups, etc.)
- Email queue with retry logic and template system
- In-app notifications with read/unread tracking
- Announcements system with categories
- Group check-ins for regular updates

#### ✅ Progress Tracking
- Module-level: `module_progress` (not_started/in_progress/completed)
- TalentLMS sync (completion, score, time spent)
- Session attendance (attended/no_show/cancelled)
- Group session response tracking

---

### What's Missing for Solid Cohort Delivery

Despite the strong foundation, there are gaps that would cause friction in a live cohort program:

#### Gap 1: No Cohort Dashboard for Participants (HIGH PRIORITY)
**Problem:** Enrolled participants have no single view of "my cohort" — upcoming sessions, group members, progress through the cohort schedule, announcements.

**What's needed:**
- `CohortDashboard.tsx` — a dedicated page showing:
  - Cohort name, dates, progress (week X of Y)
  - Next upcoming session with countdown + join link
  - Cohort schedule timeline (past sessions marked, future sessions with dates)
  - Quick links to group, announcements, resources
  - Cohort-mates list (fellow participants)
  - My progress vs cohort average (optional, motivational)
- Route: `/programs/:programId/cohort/:cohortId`
- Accessible from client dashboard "My Programs" section

**Effort:** 1 week

#### Gap 2: No "Join Session" One-Click Experience (HIGH PRIORITY)
**Problem:** When a live session starts, participants need a single "Join Now" button that takes them directly to the video call. Currently, meeting URLs are stored but there's no prominent, time-aware "Join" experience.

**What's needed:**
- Time-aware session card: "Starting in 15 min" → "Join Now" (green button) → "Session in progress" → "Session ended"
- One-click join via meeting_url (Zoom, Google Meet, Teams — whatever the URL is)
- Dashboard notification: "Your session starts in 15 minutes" with join button
- Email reminder with join link (15 min + 1 hour before)

**Effort:** 3-5 days

#### Gap 3: No Session Notes / Post-Session Summary (MEDIUM)
**Problem:** After a live session, there's no structured place for session outcomes, action items, or recording links. Instructors have `instructor_module_notes` but there's no shared session debrief visible to participants.

**What's needed:**
- `session_notes` or extend `cohort_sessions` with: summary, recording_url, action_items, resources shared
- After session: instructor/coach fills in notes → participants see "Session Recap" card
- AI integration point: AI could auto-generate session summary from notes (future)

**Effort:** 3-5 days

#### Gap 4: No Automated Cohort Enrollment Workflow (MEDIUM)
**Problem:** Enrolling users in a cohort is manual — admin must assign each user. With Phase 5 self-registration and enrollment codes, cohort assignment should be automatic.

**What's needed:**
- Enrollment codes should support `cohort_id` — when a user enrolls with a code, they're auto-assigned to the specified cohort
- Group auto-creation: when a cohort fills up, auto-create a group for the cohort members
- Extend `enrollment_codes` table: add `cohort_id` field

**Effort:** 2-3 days (extends Phase 5 Step 1 migration)

#### Gap 5: No Cohort-Level Analytics for Admin/Instructor (LOW)
**Problem:** Admin and instructors can see individual progress but not cohort-level aggregates (completion rate, attendance rate, average scores).

**What's needed:**
- Cohort analytics panel in admin: attendance %, module completion %, average assessment scores
- Instructor view: which participants are falling behind, who hasn't completed this week's module

**Effort:** 1 week

#### Gap 6: No Pre/Post-Session Tasks or Homework (LOW)
**Problem:** Live sessions often have pre-work ("read this before Thursday's session") or homework ("complete this reflection by next week"). No structured way to assign session-linked tasks with deadlines.

**What's needed:**
- Link existing development items or assignments to specific cohort sessions
- "Before next session" task category with session-linked deadline
- Dashboard shows: "Before Thursday's session: Complete Module 3 reflection"

**Effort:** 3-5 days

---

### Recommended Priority for Cohort Readiness

| Priority | Gap | Effort | Why |
|----------|-----|--------|-----|
| 🔴 1 | **Cohort Dashboard** for participants | 1 week | Without this, participants are lost — no single view of their cohort experience |
| 🔴 2 | **Join Session one-click** + time-aware cards | 3-5 days | Live sessions are the core of cohort programs — joining must be frictionless |
| 🟡 3 | **Session Notes / Recap** | 3-5 days | Participants need post-session reference; instructors need a place for notes |
| 🟡 4 | **Auto cohort enrollment** (extend Phase 5) | 2-3 days | Manual enrollment doesn't scale for cohort programs |
| 🟢 5 | **Cohort analytics** | 1 week | Important for instructors but not launch-blocking |
| 🟢 6 | **Session-linked homework** | 3-5 days | Nice to have; workaround exists via development items |

**To run your first cohort program, you need gaps 1 and 2.** Gaps 3-4 should follow quickly. Gaps 5-6 can wait.

---

### Hybrid Program Model

For a hybrid cohort (live sessions + self-paced content + coaching), the delivery model with the content fix from Part 3 becomes:

```
Week 1:
├── Module 1: Self-paced content (Rise xAPI embed — inline, zero clicks)
├── Live Session: Group workshop (one-click join from cohort dashboard)
├── Reflection: AI-prompted weekly reflection
└── Coaching: 1:1 session via Cal.com

Week 2:
├── Module 2: Self-paced content (Rise xAPI embed)
├── Scenario: Practice exercise with AI debrief
├── Live Session: Peer coaching / mastermind
├── Group Check-in: Weekly accountability
└── Homework: Complete capability assessment before Week 3
```

Everything except the live video call happens inside the Hub. The live video is one click away. Content delivery (Part 3) and cohort experience (Part 4) together make this seamless.

---

## Part 5: Coach & Instructor Onboarding Readiness

### Context

Coaches and instructors are admin-created (no self-registration needed for now). The question is: when a new coach or instructor logs in for the first time, is the experience solid enough that they can get productive quickly without hand-holding?

### What Already Exists (Good Foundation)

#### ✅ Account Creation & Access
- Admin creates users via `/admin/users` with role assignment (coach, instructor, or both)
- Welcome email with password setup link (24h expiry) via `send-welcome-email`
- Email auto-confirmed for admin-created users
- Qualification assignment (module types they specialize in)

#### ✅ Teaching Dashboard (`/teaching`)
- 5 stat cards: Total Programs, Active Clients, Groups, Pending Badges, Your Roles
- Pending assignments widget (searchable, filterable, sortable)
- Upcoming sessions widget (next 3 group sessions)
- Shared items from clients: goals, decisions, tasks (3 columns)
- Programs tab: card grid with role badge, category, module/client counts
- Individual modules tab: list view with type icons

#### ✅ Client Management
- Client progress page with stats (total clients, avg completion, active enrollments)
- Search + filter by name/email/program/status
- Student detail with tabs: Overview, Notes, Reflections, Feedback, Assignments
- Manual module completion control

#### ✅ Core Teaching Workflows
- **Assignment grading:** Pending/Scored tabs, search, filter, scoring interface with rubric support
- **Scenario evaluation:** Section-by-section evaluation, question scoring (1-5), revision requests, response history
- **Badge approval:** Batch or individual, credential URL input (e.g., Credly links)
- **Capability assessments:** View shared assessments, give evaluations, domain/question notes
- **Development items:** Review client items, add coaching notes (client-created, coach-reviewed)
- **Staff notes:** Per-module instructor notes, shared staff notes visible to all staff

#### ✅ Group & Session Management
- Group listing with member count, status, program link
- Group sessions: create, schedule, edit, mark attendance
- Group tasks, check-ins, notes, peer assessments

#### ✅ Navigation
- 10 sidebar items: Programs, Client Progress, Assignments, Groups, Shared Goals, Shared Decisions, Shared Tasks, Assessments, Scenarios, Badge Approvals
- External platforms submenu (Academy, Lucid, GDrive, Miro, Mural)

#### ✅ Communication
- Notification preferences (configurable per type)
- In-app notifications
- Email notifications via queue

---

### What's Missing (Gaps for Smooth Onboarding)

#### Gap 1: No Guided First-Login Experience (HIGH)
**Problem:** A new coach logs in and sees an empty dashboard with 5 zero-count stat cards and empty widgets. There's no guidance on what to do, what to expect, or how to get started. They don't know if something is broken or if they just haven't been assigned anything yet.

**What's needed:**
- **Welcome card** (similar to client's `JourneyProgressWidget`) with coach-specific steps:
  1. ✅ Set up your password (auto-complete on first login)
  2. Complete your profile (bio, specialties, scheduling URL)
  3. Review your assigned programs (or: "Waiting for admin to assign programs")
  4. Meet your first client
- Dismissible after completion
- Shows "You're all set!" state when all steps done

**Effort:** 2-3 days (reuse `JourneyProgressWidget` pattern)

#### Gap 2: No Profile Completion for Coach-Specific Fields (HIGH)
**Problem:** Coaches have important fields — `bio`, `specialties`, `certifications`, `scheduling_url` — but there's no dedicated UI to edit them. The public profile settings page handles visibility toggles, but not the actual content of these fields. A new coach can't set up their bio or booking link.

**What's needed:**
- **Coach Profile Setup** section in Account Settings (or a dedicated page):
  - Bio (rich text)
  - Specialties (tags or multi-select)
  - Certifications (list with optional credential URLs)
  - Scheduling URL (Cal.com or Calendly link) with URL validation
  - Profile photo (already exists in general profile)
- Profile completeness indicator on dashboard ("Your profile is 60% complete")
- Prompt to complete profile in the onboarding welcome card

**Effort:** 3-5 days

#### Gap 3: No "What to Expect" Context When Empty (MEDIUM)
**Problem:** Empty states say things like "No program assignments yet" — but don't explain what happens next. A new coach doesn't know if they need to do something or wait for admin.

**What's needed:**
- Enhanced empty states with context:
  - Programs: "Your administrator will assign you to programs. Once assigned, your clients and modules will appear here."
  - Clients: "Clients enrolled in your programs will appear here once you're assigned to a program."
  - Assignments: "When your clients submit assignments, they'll appear here for your review."
  - Sessions: "Group sessions will appear once you're assigned to a group or create sessions in your programs."
- Add admin contact link or "Request assignment" action in empty states

**Effort:** 1-2 days (copy changes + minor component updates)

#### Gap 4: No Coach-Specific Welcome Email Content (MEDIUM)
**Problem:** The welcome email template is generic — it mentions "programs and modules" and "coaches and instructors" regardless of role. A coach should get coach-specific guidance: "Here's what you'll be doing: reviewing client goals, grading assignments, leading sessions."

**What's needed:**
- Role-aware welcome email template:
  - **For coaches:** Emphasize client relationship, shared goals/decisions, coaching sessions, capability assessments
  - **For instructors:** Emphasize program delivery, assignment grading, scenario evaluation, badge approval
  - **For both:** Emphasize both sets of responsibilities
- Include 3-4 "first things to do" specific to their role
- Link directly to `/teaching` dashboard

**Effort:** 1-2 days (template changes in `send-welcome-email` edge function)

#### Gap 5: No Quick Reference / Help for Teaching Tools (LOW)
**Problem:** The teaching dashboard has 10+ different tools (assignments, scenarios, badges, assessments, etc.). A new coach doesn't know when to use what. There's no in-context help or quick reference.

**What's needed:**
- **Teaching FAQ or Quick Guide** page (similar to `OrgAdminFAQ.tsx` which already exists for org admins):
  - "How do I grade an assignment?"
  - "How do I evaluate a scenario?"
  - "What are capability assessments?"
  - "How do I manage group sessions?"
  - "What are development items?"
- Link from sidebar navigation
- Or: tooltip/info icons on each dashboard section

**Effort:** 1-2 days

#### Gap 6: No Way for Coaches to Create Development Items for Clients (LOW)
**Problem:** Development items are client-created. Coaches can review and add notes, but can't create items for their clients. In coaching practice, a coach often assigns actions: "By next session, I want you to practice X." The `create-client-development-item` edge function exists and accepts instructor context, but there's no prominent UI for coaches to initiate this.

**What's needed:**
- "Add Development Item" button in Student Detail page (coach/instructor view)
- Quick-create dialog: title, description, category, optional deadline, optional link to task/group
- Shows in client's development items with "Assigned by [Coach Name]" badge

**Effort:** 2-3 days (UI only — edge function already exists)

---

### Recommended Priority for Coach Onboarding

| Priority | Gap | Effort | Why |
|----------|-----|--------|-----|
| 🔴 1 | **Welcome card + onboarding checklist** | 2-3 days | First impression matters — empty dashboard with no guidance is confusing |
| 🔴 2 | **Coach profile setup** (bio, specialties, scheduling URL) | 3-5 days | Coaches need to present themselves; scheduling URL is essential for bookings |
| 🟡 3 | **Enhanced empty states** with context | 1-2 days | Removes confusion about "is this broken?" |
| 🟡 4 | **Role-specific welcome email** | 1-2 days | Sets expectations before they even log in |
| 🟢 5 | **Teaching FAQ / quick guide** | 1-2 days | Reduces support burden, helps self-service |
| 🟢 6 | **Coach-created development items** | 2-3 days | Enables natural coaching workflow |

**To onboard your first coaches confidently, you need gaps 1 and 2.** Gap 3 is quick and should be included. Gaps 4-6 improve the experience but aren't blocking.

**Total effort for solid coach onboarding: ~1.5-2 weeks** (gaps 1-4).

---

### Overall Readiness Assessment

| Area | Status | Notes |
|------|--------|-------|
| Account creation | ✅ Ready | Admin creates, welcome email works |
| Dashboard | ✅ Ready | Rich, functional, good empty states (but no onboarding) |
| Client management | ✅ Ready | Full progress tracking, notes, feedback |
| Assignment grading | ✅ Ready | Search, filter, rubric support, status guard |
| Scenario evaluation | ✅ Ready | Section-by-section, revision requests |
| Badge approval | ✅ Ready | Batch + individual, credential URLs |
| Capability assessments | ✅ Ready | View + evaluate, domain notes |
| Group sessions | ✅ Ready | Create, schedule, attendance |
| Profile setup | ❌ Missing | No UI for bio, specialties, scheduling URL |
| Onboarding guidance | ❌ Missing | No welcome card, no "getting started" flow |
| Empty state context | ⚠️ Partial | Icons + messages exist, but no "what to expect" |
| Welcome email | ⚠️ Partial | Works but generic, not role-specific |
| Teaching FAQ | ❌ Missing | No in-context help for coaching tools |
| Development item creation | ⚠️ Partial | Backend exists, UI not prominent for coaches |

**Bottom line:** The teaching workflows are production-ready. What's missing is the onboarding wrapper — the first 10 minutes of a new coach's experience. Fix that, and you're ready to onboard coaches confidently.
