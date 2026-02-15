# Responsive UI Testing & Building Workflow

## For Responsive UI Testing

Don't use Cursor for this — use your browser instead:

1. **Chrome DevTools** (`Cmd+Option+I` → toggle device toolbar `Cmd+Shift+M`)
   - Test any screen size instantly
   - Preset devices (iPhone, iPad, etc.)
   - Throttle network speed to simulate mobile

2. **Side-by-side workflow**: Keep Chrome open next to Cursor, with `npm run dev` running. Edit in Cursor, see results live in the browser.

## For Building Responsive UI

Use Cursor Agent for code changes:
- Prompt example: *"Make the dashboard sidebar collapse into a hamburger menu on screens below 768px. Use Tailwind responsive prefixes (sm:, md:, lg:)."*
- It knows the Tailwind + shadcn/ui stack and will edit the right files

**Tailwind breakpoints** (project defaults):
- `sm:` → 640px+
- `md:` → 768px+
- `lg:` → 1024px+
- `xl:` → 1280px+

## Recommended Workflow

1. Open Chrome DevTools at a mobile size (e.g. 375px iPhone)
2. Spot what's broken
3. Tell Cursor Agent: *"In [component], the [element] overflows on mobile. Fix it using Tailwind responsive classes."*
4. Check the result in Chrome
5. Repeat

**Key tip**: Always describe the *problem* to Cursor ("the table overflows on mobile"), not just "make it responsive" — it gives much better results when it knows what's broken.
