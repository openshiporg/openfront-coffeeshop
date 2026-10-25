# Coffee Shop (Neighborhood Roast): storefront redesign (2026-10-25)

Brief: `Euler/state/briefs/design-skills-redesign-2026-10-25.md` (Openfront Batch 2, storefront only).

**Live:** https://openfront-coffee-shop-production.up.railway.app (coffee-shop.openship.org once DNS is added)

## The world
**Espresso bar before open.**
- **Ground:** a warm espresso-black.
- **Ink:** crema.
- **Accent:** the saved logo colour, lifted to read on dark.
- **Type:** Bricolage Grotesque display at poster size; menu photography carries the colour.
- **Spotlight:** a portrait-format featured item on desktop.

## What changed
- `app/storefront.css` (the storefront's own stylesheet): dark tokens; dark shadows; tighter radii; larger display scale; hero title sized to its column; portrait spotlight card; quick-add 'added' state text and selection colours fixed for dark; page ground under overscroll.

Every route, state and workflow is unchanged: no route, data loader, server action, form field or test was removed or renamed. The shared dashboard shell and platform pages were not touched.

## Skills used, and how
- **impeccable**: read SKILL.md and set the surface modes: Persuade for the home page, Operate for booking, cart, checkout and account. Its "redesign replaces, it doesn't polish the old look" rule set the scope: a new world (ground, type, shape, signature motif), with every route, state and workflow kept. Its design hook scanned each stylesheet as it was written and reported no deterministic issues. I did **not** run `/impeccable init`, `critique` or `polish` as separate commands.
- **frontend-design**: the two-pass plan (palette of named tokens, type roles, layout sketch, principles), then a review of that plan against its list of generated-design defaults. That review removed the single italic accent word in headlines (salon), dropped 01/02 numbering on a list that isn't a sequence (vape) and kept the "near-black plus one acid accent" look out of every palette: accents are the merchant's own hue, lifted for dark and softened.
- **design-taste-frontend (tasteskill v2)**: the "idea comes from the subject" inventory. Each world comes from a physical object in the business. I didn't run its `draw.mjs` or `inspect.mjs` scripts; the live Playwright check below did that job.
- **high-end-visual-design / emil-design-eng**: custom ease-out curves only; transform and opacity motion; grain and blur kept to fixed layers; reduced motion respected (the existing guards were kept).
- **mobile-native**: 44px+ targets, `100svh`/`dvh` instead of `100vh` for heroes, no horizontal scroll at 390px (measured: overflowX=0 on every captured page).
- **Tessier as the bar**: near-black but never flat grey, off-white ink, one restrained accent, few radii, product and photography carrying the colour.

## Checks
- `tsc --noEmit`: exit 0, 0 errors.
- `tsx --test` (format, catering, hours): 16 pass, 0 fail.
- `parity-check.py`: drift 0.
- Live: overflowX 0 at both widths.

## Commits (pushed to `master`, auto-deployed)
- `51e5472` Storefront redesign: espresso bar before open
- `47b8d4b` Size the hero name to its column so words never split

## Screenshots (Playwright 1.62, 1440x900 desktop and 390x844 phone, full page)
Before, in `design/before-20261025/`:
- `before-home-desktop.jpg`
- `before-home-phone.jpg`
- `before-menu-desktop.jpg`
- `before-menu-phone.jpg`

After (live), in `design/after-20261025/`:
- `after-account-desktop.jpg`
- `after-account-phone.jpg`
- `after-home-desktop.jpg`
- `after-home-phone.jpg`

## Notes
A parallel session (`demo-data-reset-2026-10-25.md`) reset this demo's database and is re-onboarding it with the full seed while this redesign shipped. The before shots were taken during or after that reset, so they may show an empty or not-configured store rather than the old design with data. The old design is in git (the parent of the first commit below). When I started, the live coffee storefront showed 'Store details are temporarily unavailable': the database had no `StoreSetting` table (Prisma P2021). That was the reset in progress, not a code fault.
