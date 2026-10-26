# Coffee Shop (Neighborhood Roast): full redesign, platform and storefront (2026-10-26)

Brief: `Euler/state/briefs/batches-2-6-full-redesign-2026-10-25.md`. The owner ordered it with no approval round, so every impeccable decision point was taken unattended, as recorded in `PRODUCT.md` and the surface briefs.

Live: https://openfront-coffee-shop-production.up.railway.app (coffee-shop.openship.org once DNS is in).

## What it is now
- **Platform: "the bar".** Every operator screen opens on the next drink to make or ring up.
  - The pill-track kit and about 177 per-call `rounded-full` overrides are gone. Underline tabs carry counts, `Segmented` handles real choices, and dense `PlatformTable`s carry a dot-plus-word status.
  - Radii are explicit 6px and 4px, because the dashboard theme sets `--radius` to 10px.
  - Signature move: the KDS ticket-age timer grows heavier as a ticket waits (normal, then medium, then amber, then red), and bump buttons are 56px.
- **Storefront: "the marked cup".**
  - Cool-white cup paper, a printed band in the merchant's logo colour, a kraft sleeve for the cart, and marker ink only for things that are written: the name box, chosen options, counts and the order number.
  - The menu opens right under the sign as one grid of cups, with the category printed on each band and a quick-add box that takes a marker tick.
  - On the item page, option boxes tick in marker; the default is labelled "Standard" and a "Changed" stamp marks any change.
  - Checkout leads with an honest pickup time. The account shows real reward progress.
- **Shared dashboard shell:** byte-identical to E-commerce (parity drift 0). `components/ui/**` is untouched.

## Bugs fixed on the way
- **Inventory never loaded.** The dashboard GraphQL server rejects `@include`/`@skip` directives driven by a variable, so the inventory list query failed on every view. The same bug was in Subscriptions. Both queries now size their row reads with a `take` variable. Verified live: 8 items load.
- **Orders scrolled sideways on phones.** Loose screen-reader labels in a wrapping filter form caused it; Register had the same. Both forms now contain their labels.
- **The storefront home was 27px too wide on phones.** A hidden search submit picked up the global 44px minimum button width.

## Process (impeccable first)
1. Before screenshots, live at desktop 1440 and phone 390, saved in `before/` (43 files).
2. impeccable `critique` with isolated subagents A (design review) and B (`detect` plus a radius sweep), synthesized into `CRITIQUE.md` and persisted. Platform scored 23/40, storefront 27/40.
3. impeccable `init`: `PRODUCT.md` inferred, with every inference labelled.
4. Storefront direction: `concept-seed` (`seed:61689434f74cf3b5`) assigned grounded candidate 3 of 7, the barista's marked cup. Every challenger was declined, and each one's discipline was kept as a named raise.
5. Platform direction: the structure is pinned by the owner's brief. The surface roll `seed:af7f329aeda4e100` is recorded together with what it dealt and what was built.
6. Build: I rewrote the shared kit (`PillTabs.tsx`, `PlatformPage.tsx`). Three parallel agents then rebuilt the platform counter group (POS, orders, KDS, register, menu, coffee operations), the back-office group (recipes, inventory, suppliers, catering, loyalty, subscriptions, reports, store settings) and the storefront.
7. impeccable finish review. Round 1 found 8 material fixes, shipped in `6e7c9f5`. The verdict pass scored all 8 resolved, with the disposition **ship**.
8. impeccable documenter: `DESIGN.md` plus `.impeccable/design.json`, taken from the shipped CSS and components. The rectangular cup tiles are recorded as an adaptation: clipping a tapered silhouette cut the 1px side rules.

## Skills used, per screen, and what each changed

| Screen | Skills | What changed |
|---|---|---|
| Platform kit | impeccable craft-floor and operate, minimalist-ui, emil-design-eng | Pill tracks became underline tabs. Added `Segmented` and `PlatformTable`. Empty states became 6px dashed rows. Titles are smaller. |
| KDS | impeccable operate, emil-design-eng (decision framework: no entrance motion on high-frequency screens) | Station columns, full order numbers, the age-weight timer and 56px bump buttons. "Bar is clear" shows next to the next scheduled order. |
| POS | impeccable operate, hallmark (states) | A closed shift shows one card asking for opening cash. An open shift shows the item grid and ticket, with legible tiles and `Segmented` tender. The Record button is reachable on phone and the layout clears the assistant button. |
| Orders | impeccable operate and clarify | The live queue comes first, with pickup clocks. 14 pills became search plus two selects. History is a table. One status per order. |
| Register | impeccable operate | The current shift comes first (expected, counted, variance). Shifts and payments are tables. |
| Menu | impeccable operate | Dense table with inline price and availability, and status shown as dot plus word ("Selling"). |
| Coffee operations | impeccable distill | One underline tab per task, each starting with a short "today" table. Redundant pickers trimmed. |
| Inventory, suppliers, recipes | impeccable operate | Opens on "To reorder" with an Order action. Suppliers table with tel and mailto links. Recipes show cost per serving, menu price and margin. |
| Catering, loyalty, subscriptions, reports, store settings | impeccable operate and craft-floor (no hero metric), hallmark | Date-led agenda that says what each event waits on. Guest lookup first. Paused renewals first. Today against the same day last week, with no $0.00 hero. The missing required field sits at the top, and the save bar no longer covers Timezone. |
| Storefront home and menu | impeccable new-work and mode-persuade, frontend-design (two-pass token plan), design-taste-frontend (dials 6/4/6) | The merchant band is a real sign (Now, Pickup, Where). Below it the grid of cups (4 above the fold at 1440, two columns at 390). Popular appears once. Seed copy no longer shows. |
| Item page | emil-design-eng (240ms marker stroke), impeccable craft-floor | Marker ticks, "Standard" and "Changed". Plain-language chips. Price appears only in the button. No "Make it yours" heading over a lone field. |
| Checkout, account, catering, receipt | hallmark (mobile, states), impeccable craft-floor (truth) | The pickup time leads and is truthful when the café is closed. Empty state sits inside the tray. "Name on the cup" is written in marker. Reward punch row comes from real progress. Catering shows only the rules the server enforces. |

## Checks (final state, `6e7c9f5`)
- `tsc --noEmit` through heavy-exec, non-incremental: exit 0, 0 errors.
- Unit tests: `family-security` 14/0, `shared-dashboard` 8/0, feature `tsx` suite 50/0 (pass/fail).
- `parity-check.py openfront-coffee-shop`: drift 0, missing 0, sidebar ok.
- `impeccable detect --json features/platform features/storefront`: `[]`.
- Live: every captured route returns 200 with overflowX 0 at desktop and phone (`after/after-report.json`).

## Commits (master, auto-deployed)
- `85cabd7` Full redesign: coffee shop platform as the bar, storefront as the marked cup
- `6e7c9f5` Coffee shop finish-review fixes: inventory loads again, menu opens as a grid of cups, truthful pickup when closed
- `fa30255` Platform: flatten the shared button bevel inside platform screens (flat ink primary, no shadow or inset ring). Found while reviewing the sibling real-estate build. The shared shadcn `Button` draws a gradient, a 2px bottom border, a shadow and an inset ring; `PlatformLayout` neutralises them with scoped selectors. Buttons inside portalled sheets and dialogs sit outside that subtree and keep the shared style.

## Screenshots
- `before/`: 43 captures (Playwright Chromium, live).
- `after/`: 48 captures (Playwright WebKit, live).
- Five platform detail pages (inventory, register, catering, loyalty, subscription) had no list link in the demo data at capture time and were reviewed in code.

## Open items
- **Never seen in a capture:** the KDS age weight (the bar was clear) and the phone sleeve bar with items in it.
- **Copy:** "ready about 12 min after" ends on "after".
- **Menu rows:** availability shows three ways (dot, word, switch).
- **Server bug:** the GraphQL server's variable-directive rejection is still there. Any future query using `@include(if: $var)` will fail the same way. It belongs in the server handler or package layer, which this design work did not touch.
- **Radius drift:** onboarding components still use `rounded-lg`/`rounded-md` (onboarding files are off-limits), and the POS quantity stepper uses 5px.
