Method: dual-agent (A: design review subagent · B: detector subagent)

# Coffee shop critique, before the 2026-10-25 full redesign

Evidence: live screenshots in `design/2026-10-25-full/before/` (desktop 1440, phone 390); source in `features/platform/**` and `features/storefront/**`.

## Scores (Nielsen, 0–4)
Platform 23/40: status 3 · real world 2 · control 3 · consistency 2 · error prevention 3 · recognition 3 · efficiency 1 · minimalist 2 · error recovery 2 · help 2.
Storefront 27/40: status 3 · real world 3 · control 3 · consistency 2 · error prevention 3 · recognition 3 · efficiency 3 · minimalist 2 · error recovery 3 · help 2.

## Design specificity
- Platform: generic shadcn admin; one template on every screen (H1 + count, pill track, pill search + Search button, dashed empty box or rounded card grid). Pill source: `features/platform/components/PillTabs.tsx:10,19` (recessed track, raised pill), used by 17 screens; 177 per-call `rounded-full` overrides; `PlatformPage.tsx:49` `PlatformEmpty` rounded-xl dashed. In the dashboard scope `--radius` is 10px (`app/dashboard/globals.css:83`, shared shell, cannot change), so `rounded-md` renders 8px: platform code must use explicit 6px radii.
- Storefront: dark espresso mood with real food photos but interchangeable: seed name/tagline, blue asterisk logo and blue "Popular" tags clash with the roast palette, empty upper-left hero, croissant instead of the bar, prices in Geist mono, no room, people or roaster. Pills: `app/storefront.css:359` and chips/tabs at :198, :213, :231, :247, :267, :324.
## Detector (impeccable detect)
- platform: clean ([]). storefront: clean ([]).
- Radius sweep (features/platform): rounded-full 207 in 42 files (~189 banned: ~157 pill buttons incl. `<Button className="rounded-full">`, shared `components/PillTabs.tsx` track L10 + tab L19 used in 17 files, 11 pill search inputs/selects on every list page, 7 chips/count badges, 4 tracks incl. POS floating cart bar; ~9 legit dots), rounded-2xl 9 (OperationsTaskPanel cards, KdsBoard, POS cart), rounded-xl 76 in 29 files, rounded-lg 24 in 16 files.
- Browser overlay skipped (no mutable browser automation). Raw hit list: scratchpad rf.txt.

## Priority issues: platform
- P0 the shared pill kit breaks the owner's rule on every screen (PillTabs, 177 overrides, 8px "md" in dashboard scope).
- P1 KDS is an empty dashed box: no station columns, ticket age, big flat bump targets; the scheduled order is invisible.
- P1 POS opens on admin chrome: closed shift shows a register-name input and a greyed ticket form; tiles faded; sale button at the bottom on phone. Needs a one-card open-shift state and an item grid + ticket that own the screen.
- P1 lists are card grids (recipes, suppliers, orders history, catering, subscriptions, rewards); need dense tables (recipe detail ingredients table is the model).
- P2 Coffee operations is a kitchen sink (6-mode pill track, 7-field form, 10 record cards).
- P2 Inventory: bare error state and 11 filter pills; low/out should be the default view.
- P2 Orders: 10 status pills + 4 channel pills before the queue.
- P2 Reports: $0.00 hero and 10 zero tiles, no today-vs-normal.

## Priority issues: storefront
- P1 not a specific café (seed copy, clashing blue logo/tags, empty hero half, no room/bar/roaster/pickup promise).
- P2 menu item: "Make it yours" over a lone notes field, title-case system chips, price repeated, empty right column.
- P2 account titled "Orders"; three stacked "No …" cards don't show reward progress.
- P3 checkout: pickup time slot not visible in empty state; "Cart empty" far from cart; mixed radii.
- P3 catering is a bare form (no minimums, lead time, packages).

## Per-route main task (first 10 seconds)
orders: what's waiting, start/hand off next (partial) · kds: what to make now by station with age (not served) · pos: ring up a drink fast (not served closed; partial open) · menu: 86 an item or change a price (mostly) · register: open/close till, cash variance (not served) · inventory: what's low or out (not served) · suppliers: contact or PO (partial) · suppliers/[id]: reorder (partial) · recipes: cost per serving (partial) · recipes/[id]: ingredients and margin (served) · coffee-operations: log prep/waste/receipt (partial) · loyalty: look up a guest, adjust points (partial) · catering: upcoming events, quotes needed (partial) · subscriptions: failed/paused renewals (not served) · reports: today vs normal (not served) · store-settings: fix the missing required field (partial; sticky save covers Timezone).

## Persona red flags
- Shift lead: no keyboard path on POS/KDS/Orders, search needs a submit click, 10-pill filters, three clicks to low stock.
- New barista: "Coffee Operations", "build", "Full record", "External card", "Queued vs Accepted vs Paid" unexplained; KDS doesn't show the coming scheduled order.
- Owner: analytics leads with zeros; "Contact email missing" is a small amber line.
- Customer on phone: menu starts ~1,100px down; "Closed" with no pre-order prompt; clipped category tabs.

Questions skipped: the owner ordered the redesign directly with no approval stops; all P0–P2 issues are in scope.
