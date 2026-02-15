# Cursor & Development Workflow Guide

## Cursor Basics

### Chat Modes
- **Agent** — creates/edits multiple files, runs terminal commands. Use for most tasks.
- **Plan** — explores and plans before making changes. Good for complex features.
- **Debug** — specialized for debugging errors.
- **Ask** — answers questions without changing files.

### Model Source (dropdown below Agent)
- **Local** — uses your machine's context, reads/writes your files. Use this.
- **Worktree** — scoped to a git worktree (for multi-branch work). Not needed.
- **Cloud** — runs remotely, no local file access. Don't use.

### AI Model Selection
- **Auto** — Cursor picks. Fine for simple tasks.
- **Claude Sonnet** — good default for most coding tasks.
- **Claude Opus** — best for complex debugging. Slower, more credits. Use when Auto goes in circles.

### When to Use What
- **1 file edit** → Inline chat (`Cmd+K`)
- **2+ files** → Agent mode in sidebar chat
- **Complex debugging** → Agent mode + switch to Opus

### Agent Review Settings
- **Default Approach**: Set to **Deep** (Settings → Agent Review)
- Catches more issues, better suggestions. Worth the extra time for production code.

### Cursor Sandbox Terminal
- "Run in sandbox" = runs locally in an isolated shell. Safe to approve.
- **E2E tests won't work in sandbox** (can't open browser windows) — run those in your own terminal.

---

## Git Deployment Pipeline

After committing and pushing to `develop`, run these in order:

```bash
# 0. Make sure you're on develop with everything committed
cd "/Users/doina/Library/CloudStorage/GoogleDrive-doina.popa@innotrue.com/My Drive/InnoTrue/Work_GDrive/innotrue-hub-live"
git status

# 1. Merge to preprod
git checkout preprod && git merge develop && git push origin preprod

# 2. Merge to main (production)
git checkout main && git merge preprod && git push origin main

# 3. Sync to Lovable
npm run update:lovable

# 4. Go back to develop
git checkout develop
```

A git hook will warn you if you forget step 4.

### One-Command Deploy (shortcut)

```bash
npm run deploy:all                # full pipeline with production confirmation prompt
npm run deploy:all -- --dry-run   # preview what would deploy
npm run deploy:all -- --skip-lovable  # skip Lovable sync
```

**WARNING:** This deploys to production. The script will ask you to confirm before pushing to main. It also checks that you're on develop, everything is committed, and everything is pushed before starting.

### If You Forget to Switch Back to Develop
```bash
git stash && git checkout develop && git stash pop
```

---

## Responsive UI Testing & Building

### Testing (use browser, not Cursor)
1. **Chrome DevTools** (`Cmd+Option+I` → toggle device toolbar `Cmd+Shift+M`)
   - Test any screen size instantly
   - Preset devices (iPhone, iPad, etc.)
   - Throttle network speed to simulate mobile

2. **Side-by-side workflow**: Keep Chrome open next to Cursor, with `npm run dev` running.

### Building (use Cursor Agent)
- Prompt example: *"Make the dashboard sidebar collapse into a hamburger menu on screens below 768px. Use Tailwind responsive prefixes (sm:, md:, lg:)."*

**Tailwind breakpoints** (project defaults):
- `sm:` → 640px+
- `md:` → 768px+
- `lg:` → 1024px+
- `xl:` → 1280px+

**Key tip**: Describe the *problem* ("the table overflows on mobile"), not just "make it responsive."

---

## Running Tests

### Unit Tests (Vitest)
```bash
npm run test              # all unit tests
npm run test -- --run src/lib/__tests__/creditUtils.test.ts  # specific file
```

### E2E Tests (Playwright)

**One-time setup:**
```bash
npx playwright install    # downloads browser binaries (~200-300MB)
```

**Running** (needs dev server in a separate terminal):
```bash
# Terminal 1
npm run dev

# Terminal 2
npx playwright test                          # all E2E tests
npx playwright test e2e/tests/auth/          # specific folder
npx playwright test e2e/tests/auth/password-reset.spec.ts  # specific test
```

**Important:** Always run E2E tests in your own terminal, not Cursor's sandbox.

### Full Verification
```bash
npm run verify            # lint + typecheck + tests + build
```
