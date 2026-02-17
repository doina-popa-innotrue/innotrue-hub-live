# IDE Setup Guide for InnoTrue Hub

This guide covers IDE options for contributing to this project. It addresses Eclipse vs VS Code vs Cursor, and provides step-by-step setup for each.

---

## TL;DR — Which IDE Should I Use?

| IDE | Verdict | Best For |
|-----|---------|----------|
| **Cursor** | ✅ Recommended (what the team uses) | Full AI-assisted development, project-aware context |
| **VS Code** | ✅ Good alternative | Same experience as Cursor minus AI — free, zero learning curve |
| **Eclipse** | ⚠️ Not recommended | Java/JVM projects — poor fit for this stack |

**If you are coming from Eclipse:** use VS Code for this project. It takes 10 minutes to set up and you'll have a much better experience. You can keep Eclipse open for other Java work side-by-side.

---

## Why Eclipse Is a Poor Fit

This project is built on:
- React + TypeScript + Vite
- Supabase edge functions (Deno/TypeScript)
- Tailwind CSS + shadcn/ui
- TanStack Query, Zod, ESLint, Prettier

Eclipse was designed for Java/JVM development. Its JavaScript/TypeScript tooling (via plugins) lags significantly behind VS Code and Cursor:

| Capability | Eclipse | VS Code | Cursor |
|---|---|---|---|
| TypeScript IntelliSense | ⚠️ Plugin-based, partial | ✅ Native, best-in-class | ✅ Native |
| `@/` path alias resolution | ❌ False errors everywhere | ✅ Via tsconfig.json | ✅ Via tsconfig.json |
| Tailwind class autocomplete | ❌ Not available | ✅ Full plugin | ✅ Full plugin |
| ESLint / Prettier integration | ⚠️ Finicky plugins | ✅ Native | ✅ Native |
| Deno / edge function support | ❌ None | ⚠️ Via plugin | ⚠️ Via plugin |
| AI coding assistance | ❌ Copilot only (basic) | ⚠️ Copilot plugin | ✅ Claude-native |
| Vite dev server | ❌ None | ✅ Integrated terminal | ✅ Integrated terminal |
| Project context (`.cursorrules`) | ❌ N/A | ❌ N/A | ✅ Core feature |

The `@/` import alias is used throughout this codebase. Eclipse's JS tooling cannot resolve it — every file will show false red errors. This alone makes Eclipse very frustrating for day-to-day work.

---

## Option A: VS Code Setup (Recommended for non-Cursor users)

### 1. Install VS Code

Download from: https://code.visualstudio.com/

### 2. Open the project

```bash
# In terminal
code "/path/to/innotrue-hub-live"
```

Or: File → Open Folder → select the repo directory.

> **Important:** Always open the repo root (`innotrue-hub-live`), not a subfolder. TypeScript path resolution and ESLint config depend on the root.

### 3. Install required extensions

Open Extensions panel (`Cmd+Shift+X` / `Ctrl+Shift+X`) and install:

| Extension | Publisher | Purpose |
|-----------|-----------|---------|
| **ESLint** | Microsoft | Lint feedback inline |
| **Prettier - Code formatter** | Prettier | Auto-format on save |
| **Tailwind CSS IntelliSense** | Tailwind Labs | Class autocomplete + hover docs |
| **TypeScript Vue Plugin** | Vue | (skip if not using Vue) |
| **GitLens** | GitKraken | Enhanced git blame, history |
| **Deno** | denoland | Edge function support |
| **Error Lens** | Alexander | Inline error display |
| **Pretty TypeScript Errors** | yoavbls | Readable TS errors |

Search by name in the Extensions panel — install the one matching the publisher listed above.

### 4. Apply workspace settings

Create `.vscode/settings.json` in the repo root (if it doesn't exist):

```json
{
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib",
  "typescript.enablePromptUseWorkspaceTsdk": true,
  "tailwindCSS.experimental.classRegex": [
    ["clsx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"],
    ["cn\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)"]
  ],
  "deno.enable": false,
  "deno.enablePaths": ["supabase/functions"],
  "deno.importMap": "./supabase/functions/import_map.json",
  "[typescript]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[typescriptreact]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  },
  "[json]": {
    "editor.defaultFormatter": "esbenp.prettier-vscode"
  }
}
```

> **Note on Deno:** `deno.enable: false` with `deno.enablePaths` scoped to `supabase/functions` means Deno mode only activates for edge functions — the rest of the project uses Node/TypeScript normally. This prevents conflicts.

### 5. Install dependencies

```bash
npm install --legacy-peer-deps
```

> `--legacy-peer-deps` is required due to a react-day-picker peer dependency conflict. Always use this flag.

### 6. Verify the setup

```bash
npm run verify
```

This runs lint + typecheck + tests + build. Should complete with 0 errors. If you see TypeScript errors on `@/` imports, ensure you opened the repo root (not a subfolder).

### 7. Run the dev server

```bash
npm run dev
```

Opens at `http://localhost:8080`.

### 8. Read the rules

Before making any changes, read:
- `.cursorrules` — coding conventions, patterns, what to never do
- `MEMORY.md` — architecture overview, current state
- `docs/CURSOR_AND_WORKFLOW_GUIDE.md` — git pipeline and deploy process

Even if you're not using Cursor, `.cursorrules` is the team's coding contract. Follow it.

---

## Option B: Cursor Setup

Cursor is VS Code with Claude AI built in. Setup is identical to VS Code above, with these additions:

### 1. Install Cursor

Download from: https://cursor.sh/

### 2. Apply the same workspace settings

Same `.vscode/settings.json` as above — Cursor reads it identically.

### 3. AI features

- **Agent mode** (`Cmd+Shift+I`) — edits multiple files, runs terminal commands. Use for most tasks.
- **Inline chat** (`Cmd+K`) — edits a single file or selection.
- **Ask mode** — answers questions without changing files.

Cursor automatically picks up `.cursorrules` and `MEMORY.md` as project context — the AI understands the codebase conventions without you having to explain them.

### 4. Model selection

- **Auto** — good default
- **Claude Sonnet** — reliable for most coding tasks
- **Claude Opus** — use for complex debugging or architecture decisions (slower)

---

## Option C: Eclipse (If Absolutely Required)

> Only follow this if VS Code is not an option. Expect daily friction.

### 1. Install the correct Eclipse variant

You need **Eclipse IDE for Web and JavaScript Developers** — not the standard Eclipse or Java EE edition.

Download: https://www.eclipse.org/downloads/packages/
Select: "Eclipse IDE for Web and JavaScript Developers"

### 2. Install plugins

Help → Eclipse Marketplace → search and install:

- **Wild Web Developer** — TypeScript/JS language server (required)
- **EGit** — Git (usually pre-installed)
- **EditorConfig** — respects `.editorconfig` if present

### 3. Import the project

File → Import → General → Projects from Folder or Archive → select the repo root → Finish

### 4. Known limitations you must work around

**`@/` path aliases:** Eclipse cannot resolve these. Every `@/` import will show a red error. This is a false error — the build still works. You must mentally ignore these.

**Tailwind classes:** No autocomplete. You'll need to reference https://tailwindcss.com/docs manually.

**ESLint:** No reliable plugin. Run manually in terminal:
```bash
npm run lint
```

**Prettier:** No native integration. Configure as an external tool:
- Run → External Tools → External Tools Configurations → Program
  - Name: `Prettier`
  - Location: `${workspace_loc}/node_modules/.bin/prettier`
  - Arguments: `--write ${resource_loc}`

Or just run `npm run format` in terminal before committing.

### 5. Terminal (critical)

Use Eclipse's built-in terminal for all npm commands:
Window → Show View → Terminal

```bash
npm install --legacy-peer-deps
npm run dev
npm run verify
```

### 6. Prevent Eclipse files from entering git

Ensure `.gitignore` includes (already present in this repo):
```
.project
.classpath
.settings/
.metadata/
```

**Do not commit any Eclipse project files to the repo.**

### 7. What you cannot do in Eclipse (delegate to terminal or team)

- TypeScript-aware refactoring across files
- Tailwind class suggestions
- AI-assisted code completion with project context
- Automatic import resolution for `@/` aliases

---

## Team Configuration — Mixed IDEs

It is fine for different team members to use different IDEs. The repo is IDE-agnostic. What matters is:

1. **All team members run `npm run verify` before every commit** — this is the shared quality gate regardless of IDE
2. **Follow `.cursorrules`** — read it once, refer back as needed
3. **Do not commit IDE config files** — `.vscode/` is gitignored; Eclipse files must also stay out
4. **Use the same git workflow** — see `docs/CURSOR_AND_WORKFLOW_GUIDE.md`

### Current team setup

| Developer | IDE | Notes |
|-----------|-----|-------|
| Doina | Cursor + Lovable | Primary — AI-assisted, full project context |
| (teammate) | VS Code or Eclipse | Follow this guide |

---

## Quick Reference — Daily Commands

```bash
# Install dependencies (always use this flag)
npm install --legacy-peer-deps

# Start dev server
npm run dev                    # localhost:8080

# Before every commit
npm run verify                 # lint + typecheck + tests + build

# Deploy pipeline (Doina runs this)
npm run deploy:all             # develop → preprod → main

# Edge functions
npm run deploy:functions       # deploy to prod
npm run deploy:functions -- --only function-name   # deploy one function
```

---

## Getting Help

- Architecture questions: read `MEMORY.md` first
- Coding conventions: read `.cursorrules`
- Deployment: read `docs/CURSOR_AND_WORKFLOW_GUIDE.md`
- Data model: read `docs/DATA_CONFIGURATION_GUIDE.md`
- Environment variables: read `docs/ENVIRONMENT_CONFIGURATION.md`
