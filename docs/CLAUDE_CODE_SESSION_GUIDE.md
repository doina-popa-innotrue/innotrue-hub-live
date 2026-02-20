# Claude Code Session Guide
*InnoTrue Hub — Doina's Coding Workflow*

---

## Setup Summary
- **Tool:** Claude Code CLI in Mac terminal
- **Model:** Opus 4.6 (auto-selected)
- **Auth:** Claude Max account (no API billing, no overages)
- **IDE:** Cursor open alongside — for viewing changes, diffs, running verify manually
- **Repo:** `/Users/doina/Library/CloudStorage/GoogleDrive-doina.popa@innotrue.com/My Drive/InnoTrue/Work_GDrive/innotrue-hub-live`

**To start a session:**
```bash
cd /Users/doina/Library/CloudStorage/GoogleDrive-doina.popa@innotrue.com/My\ Drive/InnoTrue/Work_GDrive/innotrue-hub-live
claude
```

---

## Session Prompts

### OPENING
```
Check your memory for where we left off. Read CLAUDE.md, docs/MEMORY.md, 
and [relevant phase or topic doc e.g. docs/PHASE5_PLAN.md].

Summarise in 3 bullet points: current project state, where we stopped 
last session, and what's next. Then wait for my instructions.

Do not start any work yet.
```

---

### MID-SESSION CHECKPOINT
```
Pause before continuing.

1. Update MEMORY.md — mark completed items ✅, add any new decisions or gotchas
2. Update completed-work.md with a summary of what was just implemented
3. Update your memory with our exact position — phase, step, file, what's next
4. Note any architectural decisions or edge cases in the relevant docs file
5. Run `npm run verify` — if it fails, fix and re-run before reporting
6. Tell me current state in one sentence and what the next step is

Wait for my confirmation before continuing.
```

---

### CLOSING
```
Before we finish:

1. Run `npm run verify` — fix anything that fails before proceeding
2. Update MEMORY.md — current state, resolved items, any new roadmap items
3. Update completed-work.md with everything we did today
4. Update your memory with exactly where we stopped — phase, step, 
   file, and what's next
5. Prune MEMORY.md if needed — move resolved items older than 2 phases 
   to completed-work.md, keep the file focused on current state only
6. Tell me the next immediate step so I can pick up cleanly next session

Wait for my confirmation before I exit.
```

---

### PERIODIC MEMORY PRUNE
*Run every few weeks or at the end of a major phase.*
```
Review MEMORY.md and prune it:

1. Move fully resolved items older than 2 phases into completed-work.md
2. Remove any ✅ items that are no longer relevant as context
3. Keep only: current state, active roadmap, known issues, key architectural 
   decisions that still affect ongoing work
4. The file should reflect what's true now, not what's done

Show me a summary of what was moved or removed before saving.
Wait for my confirmation before writing the changes.
```

---

## Custom Slash Commands (Recommended Setup)

Save your prompts as custom commands so you don't have to paste them every session:

```bash
mkdir -p .claude/commands
```

Create these files in `.claude/commands/`:
- `open.md` — paste your Opening prompt
- `checkpoint.md` — paste your Mid-Session Checkpoint prompt
- `close.md` — paste your Closing prompt
- `prune.md` — paste your Periodic Memory Prune prompt

Then inside Claude Code just type `/open`, `/checkpoint`, `/close`, or `/prune`.

---

## Context Loading by Phase

Swap in the relevant doc alongside MEMORY.md depending on what you're working on:

| Work | Add to opening prompt |
|------|----------------------|
| Phase 5 Self-Registration | `docs/PHASE5_PLAN.md` |
| RLS fixes | `docs/RLS_FIX_PLAN.md` |
| Cohort scheduling | `docs/COHORT_SCHEDULING_ANALYSIS.md` |
| Development Profile | `docs/DEVELOPMENT_PROFILE_ANALYSIS.md` |
| Content delivery | MEMORY.md has enough — no extra doc needed |
| Environment/config | `docs/ENVIRONMENT_CONFIGURATION.md` |

---

## Best Practices

### 1. Use `/clear` liberally
When you finish a step and move to the next, run `/clear` to reset conversation context. Your memory and MEMORY.md preserve continuity — the conversation itself doesn't need to.

### 2. Name your sessions
```
/rename Phase5-Step3-verify-signup
```
Makes it easy to find sessions if you need to scroll back.

### 3. One step at a time
PHASE5_PLAN.md has 14 steps. Give Claude Code one step at a time, verify, checkpoint, then continue. Don't ask it to implement an entire phase in one go — subtle errors in step 9 can go unnoticed until step 12.

### 4. Paste screenshots when stuck
If you hit a UI bug or unexpected error, screenshot it and paste directly into Claude Code with `Ctrl+V` (not Cmd+V — image paste uses Ctrl). Much faster than describing what you're seeing.

### 5. RLS work — always be explicit
Before any RLS-related task, add this at the start:
```
Read docs/RLS_FIX_PLAN.md before touching any RLS policies. 
Check that any new policies follow the existing patterns exactly.
```
RLS mistakes are silent and dangerous. The extra instruction is worth it every time.

### 6. Set up GitHub PR auto-review
Claude Code can automatically review your PRs. Run once:
```
/install-github-app
```
Given your deploy pipeline (develop → preprod → main), automated PR review catching logic errors before they reach preprod is valuable for a solo developer on a complex codebase.

---

## Memory Architecture

| Layer | What it stores | Lives in |
|-------|---------------|----------|
| Built-in memory | Where you are (phase, step, file) | Claude Code's persistent memory |
| MEMORY.md | What the project is (architecture, state, roadmap) | Repo |
| Phase docs | What you're building right now | Repo `/docs/` |
| completed-work.md | Full history of what's been done | Repo |

**Rule of thumb:** Built-in memory = bookmark. MEMORY.md = the book.

---

## Why This Setup (Context)

- **Claude Max** ($100/month) — covers Claude Code usage via Opus 4.6, no API billing
- **Cursor Pro** ($20/month) — IDE features, tab completion, file viewer alongside Claude Code
- **No Claude Mac app** — was causing unpredictable overages during heavy coding sessions; Claude Code replaces it entirely for coding work
- **Opus 4.6 is non-negotiable** for InnoTrue Hub given: 380+ tables, 65 edge functions, 5-source entitlements system, complex RLS policies, and multi-phase interdependent roadmap. Sonnet carries real regression risk on architectural work at this complexity level.
