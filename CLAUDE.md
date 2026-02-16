# Claude Code Instructions

## Project Context
See [MEMORY.md](./MEMORY.md) for full project architecture, resolved issues, and roadmap.
See [completed-work.md](./completed-work.md) for detailed work history.

## Working Directory
ALWAYS work in this repo (`innotrue-hub-live`). NEVER work in the Backups folder.

## Key Rules
- Run `npm run verify` before committing (lint + typecheck + tests + build)
- Use `--legacy-peer-deps` for npm install
- Deploy pipeline: `develop` → `preprod` → `main` → `npm run update:lovable`
- Edge functions deployed separately via `npm run deploy:functions`
- Keep MEMORY.md updated when resolving issues from the roadmap
