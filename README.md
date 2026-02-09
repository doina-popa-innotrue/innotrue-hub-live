# InnoTrue Hub

Your learning and development platform.

**Production URL**: https://app.innotrue.com

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Backend**: Supabase (Auth, Database, Edge Functions, Storage)
- **Hosting**: Cloudflare Pages
- **AI**: Mistral AI (via Supabase Edge Functions)

## Local Development

Requires Node.js & npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

```sh
# Install dependencies
npm install --legacy-peer-deps

# Start the development server
npm run dev
```

The app runs at `http://localhost:8080`.

## Environment Variables

Create a `.env` file with:

```
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_PUBLISHABLE_KEY=<your-supabase-anon-key>
```

## Testing

```sh
# Run unit tests
npm run test

# Run E2E tests (requires dev server running)
npx playwright test
```

## Building

```sh
npm run build
```

Output goes to `dist/`, ready for deployment to Cloudflare Pages.

## Supabase Edge Functions

Edge functions live in `supabase/functions/`. AI provider configuration is centralized in `supabase/functions/_shared/ai-config.ts`.

To deploy edge functions:

```sh
supabase functions deploy
```

Required secrets (set via `supabase secrets set`):
- `MISTRAL_API_KEY` — AI provider
- `SITE_URL` — `https://app.innotrue.com`
- `STRIPE_SECRET_KEY` — Payments
