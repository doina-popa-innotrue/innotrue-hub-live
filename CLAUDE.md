# Claude Code Instructions

## Project Context
See [MEMORY.md](./MEMORY.md) for full project architecture, resolved issues, and roadmap.
See [completed-work.md](./completed-work.md) for detailed work history.
See [.cursorrules](./.cursorrules) for comprehensive coding patterns and conventions.

## Working Directory
ALWAYS work in this repo (`innotrue-hub-live`). NEVER work in the Backups folder.

## Key Rules
- Run `npm run verify` before committing (lint + typecheck + tests + build)
- Use `--legacy-peer-deps` for npm install
- Deploy pipeline: `develop` → `preprod` → `main` → `npm run update:lovable`
- Edge functions deployed separately via `npm run deploy:functions`
- Keep MEMORY.md updated when resolving issues from the roadmap
- **NEVER merge lovable into main.** Lovable is a one-way push target only.

## Edge Function Standards (MANDATORY)
All 61 edge functions use shared utilities. New functions MUST follow the same patterns:

1. **CORS:** `import { getCorsHeaders } from "../_shared/cors.ts"` → `const cors = getCorsHeaders(req)`
   - NEVER use inline/wildcard CORS headers
   - Variable MUST be named `cors` (not `corsHeaders`)

2. **Responses:** `import { errorResponse, successResponse } from "../_shared/error-response.ts"`
   - Use `errorResponse.badRequest/unauthorized/forbidden/notFound/rateLimit/serverError` for errors
   - Use `successResponse.ok/created/noContent` for success
   - NEVER construct `new Response(JSON.stringify({error}), {status, headers})` manually

3. **AI:** Use `_shared/ai-config.ts` for provider config and `_shared/ai-input-limits.ts` for prompt truncation
   - NEVER hardcode AI URLs or keys

## Frontend Standards
- Use `@/` import alias for all imports
- TanStack React Query for data fetching (check existing hooks before creating new ones)
- New pages MUST be lazy-loaded in `src/App.tsx`
- `useEntitlements()` for feature access checks, `<FeatureGate>` / `<CapabilityGate>` for UI gating
- `useIsMaxPlan()` to detect max-plan users (show "Contact administrator" instead of "Upgrade")
