# Contributing to InnoTrue Hub

## Prerequisites

- **Node.js 20+** and npm
- **Cursor IDE** (or VS Code) — Cursor is strongly recommended for AI-assisted development
- **Git** with access to the private repo
- **Supabase CLI** (optional, for local edge function development)

## Getting Started

```bash
# 1. Clone the repo
git clone https://github.com/doina-popa-innotrue/innotrue-hub-live.git
cd innotrue-hub-live

# 2. Install dependencies (--legacy-peer-deps is required)
npm ci --legacy-peer-deps

# 3. Install Playwright browsers (for E2E tests)
npx playwright install

# 4. Start the dev server
npm run dev
```

The app runs at `http://localhost:8080` and connects to the preprod Supabase instance by default.

## The `.cursorrules` File — Read This First

The `.cursorrules` file at the repo root is the **single most important file for any developer or AI agent** working on this project. It contains:

- The full tech stack and architecture overview
- File structure and naming conventions
- Database schema summary (369+ tables, 20+ enums)
- Edge function patterns and shared utilities
- Testing strategy and code style rules
- Git workflow

**Why it matters:**

1. **For AI agents (Cursor, Claude Code, Copilot):** The `.cursorrules` file is automatically loaded as context by Cursor's AI agent. It ensures the AI understands the project's patterns, conventions, and architecture before generating code. Without it, AI suggestions will be generic and often wrong for this codebase.

2. **For human developers:** It serves as a concise architectural reference. Read it before making your first change — it will save you hours of codebase exploration.

3. **Keep it updated:** When you add significant new patterns, change architecture, or introduce new conventions, update `.cursorrules` to match. Every developer and AI agent benefits from accurate context.

**Rules for `.cursorrules`:**
- Keep it concise and factual — this is AI context, not documentation prose
- Focus on conventions and patterns, not implementation details
- Update it when adding new shared utilities, changing file structure, or introducing new patterns
- Never include secrets, credentials, or environment-specific values

## Editor Setup

When you open the project in Cursor/VS Code, you'll be prompted to install recommended extensions. Accept — they include ESLint, Prettier, Tailwind CSS IntelliSense, and other essentials.

The repo includes these committed config files:

| File | Purpose |
|------|---------|
| `.cursorrules` | AI agent context (architecture, conventions, patterns) |
| `.vscode/settings.json` | Editor formatting, TypeScript, Tailwind settings |
| `.vscode/extensions.json` | Recommended extensions (auto-prompted on open) |
| `.vscode/tasks.json` | Test shortcuts (Terminal > Run Task) |

### VS Code Tasks

Run via **Terminal > Run Task** (or `Cmd+Shift+P` > "Tasks: Run Task"):

| Task | Description |
|------|-------------|
| E2E: Run All Tests | Headless Playwright test run |
| E2E: Run All Tests (Headed) | Tests with visible browser |
| E2E: Interactive UI Mode | Playwright's interactive UI for debugging |
| E2E: Run Current File | Run only the currently open spec file |
| E2E: Clean Auth & Run All | Clear cached auth sessions, then run all |
| Unit: Run All Tests | Vitest unit tests (default test task) |
| Unit: Run Tests (Watch) | Vitest in watch mode |
| CI: Full Quality Check | Lint + typecheck + test + build |

## Git Workflow

```
feature/xyz  -->  develop  -->  preprod  -->  main
                  (daily)      (staging)     (production)
```

- **`develop`** — daily development, all feature branches merge here
- **`preprod`** — staging environment, deployed automatically via Cloudflare Pages preview
- **`main`** — production at `app.innotrue.com`, deployed automatically via Cloudflare Pages

### Branch Rules

1. Create feature branches from `develop`: `git checkout -b feature/my-feature develop`
2. Open PRs to `develop`
3. After testing on develop, merge to `preprod` for staging verification
4. After staging approval, merge to `main` for production

## Environments

| Environment | Branch | Supabase Project | Frontend URL |
|-------------|--------|-----------------|--------------|
| Development | `develop` | `pfwlsxovvqdiwaztqxrj` | `localhost:8080` |
| Pre-production | `preprod` | `jtzcrirqflfnagceendt` | Cloudflare Pages preview |
| Production | `main` | `qfdztdgublwlmewobxmx` | `app.innotrue.com` |

## Testing

### Unit Tests (Vitest)

```bash
npm test              # Run all 210+ tests
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
```

Unit tests live in `src/lib/__tests__/`.

### E2E Tests (Playwright)

E2E tests run against the **live preprod environment** using real user accounts.

```bash
npm run test:e2e          # Headless (default)
npm run test:e2e:headed   # With visible browser
npm run test:e2e:ui       # Interactive UI mode
```

**Test structure:**
```
e2e/
  fixtures/auth.ts          # Pre-authenticated page fixtures (adminPage, clientPage, etc.)
  helpers/
    test-users.ts           # Test credentials (env var overrides supported)
    auth-storage-paths.ts   # Cached auth session file paths
    dismiss-overlays.ts     # Cookie banner / ToS gate helpers
  tests/
    auth.setup.ts           # Logs in as each role, saves browser state
    auth.spec.ts            # Login/logout/redirect tests
    admin/dashboard.spec.ts # Admin-specific tests
    client/dashboard.spec.ts
    client/decisions.spec.ts
    coach/dashboard.spec.ts
    instructor/dashboard.spec.ts
```

**Test credentials** are configured in `e2e/helpers/test-users.ts` with env var overrides:
- `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`
- `E2E_CLIENT_EMAIL` / `E2E_CLIENT_PASSWORD`
- `E2E_COACH_EMAIL` / `E2E_COACH_PASSWORD`
- `E2E_INSTRUCTOR_EMAIL` / `E2E_INSTRUCTOR_PASSWORD`

Ask a team lead for the test credentials.

### CI Pipeline

GitHub Actions (`.github/workflows/ci.yml`) runs automatically on push/PR to `main`, `preprod`, and `develop`:

1. **Quality job:** Lint > Type check > Unit tests > Build
2. **E2E job:** Runs on `preprod` branch only (needs quality job to pass first)

E2E credentials are stored as GitHub repository secrets.

## Code Style

- TypeScript with strict mode enabled (all strict flags active)
- 2-space indentation
- Functional React components with hooks
- Tailwind CSS for styling (no CSS modules or styled-components)
- shadcn/ui for UI primitives (`src/components/ui/` — do not modify directly)
- Zod schemas for validation
- TanStack React Query for data fetching
- **Prefer existing patterns** from the codebase over introducing new ones

## Key Technical Notes

- `npm install` always requires `--legacy-peer-deps` (react-day-picker peer dep conflict)
- All Supabase edge functions have `verify_jwt = false` — they implement custom auth checks
- Supabase RPC params must use `null` (not `undefined`) — `undefined` gets stripped from JSON
- All pages are lazy-loaded in `src/App.tsx` for code splitting
- The `@/` import alias maps to `src/`

## What's Portable vs Machine-Specific

### Travels with the repo (portable)

Everything in the committed `.vscode/` directory, `.cursorrules`, `playwright.config.ts`, and all test infrastructure.

### Machine-specific (must be set up per machine)

| Item | How to set up |
|------|--------------|
| Node.js + npm | Install Node 20+ |
| Playwright browsers | `npx playwright install` |
| Git credentials | Authenticate with GitHub |
| Cursor global settings | Configure per preference |
| Claude Code memory (`~/.claude/`) | Copy from existing machine or start fresh |
| E2E cached auth sessions (`e2e/.auth/`) | Auto-generated on first test run |

## Getting Help

- Read `.cursorrules` for architecture and conventions
- Check `supabase/seed.sql` for database structure and demo data
- Review existing tests in `src/lib/__tests__/` and `e2e/tests/` for patterns
- Check the CI workflow in `.github/workflows/ci.yml`
