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
- **NEVER merge lovable into main.** Lovable is a one-way push target only. A `pre-merge-commit` git hook enforces this.

## Git Hooks (auto-installed)
Git hooks in `scripts/hooks/` are installed automatically via `npm install` (`prepare` script → `scripts/setup-hooks.sh`).
- **`pre-merge-commit`** — blocks merges from the Lovable remote (prevents `as any` pollution from Lovable's stale types)
- **`post-checkout`** — warns when on `main` or `preprod` (reminder to switch back to `develop`)

To add a new hook: create it in `scripts/hooks/`, make it executable. It will be installed for all developers on their next `npm install`.

## Edge Function Standards (MANDATORY)
All 71 edge functions use shared utilities. New functions MUST follow the same patterns:

1. **CORS:** `import { getCorsHeaders } from "../_shared/cors.ts"` → `const cors = getCorsHeaders(req)`
   - NEVER use inline/wildcard CORS headers
   - Variable MUST be named `cors` (not `corsHeaders`)

2. **Responses:** `import { errorResponse, successResponse } from "../_shared/error-response.ts"`
   - Use `errorResponse.badRequest/unauthorized/forbidden/notFound/rateLimit/serverError` for errors
   - Use `successResponse.ok/created/noContent` for success
   - NEVER construct `new Response(JSON.stringify({error}), {status, headers})` manually

3. **AI:** Use `_shared/ai-config.ts` for provider config and `_shared/ai-input-limits.ts` for prompt truncation
   - NEVER hardcode AI URLs or keys

4. **Config:** New edge functions MUST be added to `supabase/config.toml` with `verify_jwt = false`
   - Without this, Supabase relay rejects requests before they reach the function

## Database Schema Change Protocol (MANDATORY)
Schema changes MUST follow this process to prevent code/DB drift:

1. **NEVER apply schema changes directly** to the Supabase dashboard SQL editor without also creating a migration file
2. **Every schema change** (columns, constraints, indexes, RLS policies, functions) MUST have a migration in `supabase/migrations/`
3. **After applying any migration** (`supabase db push`), ALWAYS regenerate types:
   ```
   npx supabase gen types typescript --project-id jtzcrirqflfnagceendt > src/integrations/supabase/types.ts
   ```
4. **After regenerating types**, run `npm run verify` to catch any type mismatches between code and DB
5. **Code that references DB columns** must match the generated types — never use column names that don't exist in `types.ts`
6. Migration naming convention: `YYYYMMDDHHMMSS_descriptive_name.sql`

Why: Schema drift causes silent failures (queries return empty results for non-existent columns) and Lovable build failures when it regenerates types from the live DB.

## Frontend Standards
- Use `@/` import alias for all imports
- TanStack React Query for data fetching (check existing hooks before creating new ones)
- New pages MUST be lazy-loaded in `src/App.tsx`
- `useEntitlements()` for feature access checks, `<FeatureGate>` / `<CapabilityGate>` for UI gating
- `useIsMaxPlan()` to detect max-plan users (show "Contact administrator" instead of "Upgrade")
