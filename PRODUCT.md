# Product

<!-- impeccable:product-schema 1 -->

Inferred on 2026-10-25 from the repository and the owner's redesign brief (`Euler/state/briefs/batches-2-6-full-redesign-2026-10-25.md`). The owner ordered the work without an interview round; every fact below is taken from code, seed data or the brief.

## Platform

web

## Users
- **Baristas and shift lead** (dashboard, `/dashboard/platform/*`): take counter orders at the POS, work the order queue and the kitchen display (KDS), open and close the register shift, log prep, waste, counts and deliveries.
- **Owner / manager**: menu and prices, recipes and costs, inventory and suppliers, catering, loyalty, subscriptions, reports and store settings.
- **Customers** (storefront): browse the menu, order ahead for pickup, request catering, see their orders and rewards. Mostly on a phone, often on the way.

## Product Purpose
A self-hostable café ordering and operations application: order-ahead storefront plus counter POS, production queue, payments, recipes, inventory, loyalty, catering and shifts.

## Operating Context
- Orders arrive from the counter (POS) and online; they move through queued → in production → ready → picked up; the KDS shows what to make, by station.
- A register shift must be open to take payments at the POS.
- Menu items have modifiers (size, milk), prep time and availability; recipes tie items to ingredients and cost.

## Capabilities and Constraints
- Next.js + Keystone 6. The shared dashboard shell (`features/dashboard/**`, `proxy.ts`, `app/dashboard/**` outside platform routes) and `components/ui/**` stay identical to Openfront E-commerce; in the dashboard scope `--radius` is 10px, so platform code uses explicit pixel radii.
- No new environment variables; onboarding/seed files are not edited by design work.

## Brand Commitments
- The storefront brand is the merchant's (name, logo, colour, imagery from settings; demo: Neighborhood Roast, 128 Market Street, Brooklyn). Design must work for any merchant name and colour.
- Platform UI: no pill-shaped or heavily rounded tabs, chips or cards; radii ≤ 6px; flat or underline tabs (owner, 2026-10-25).

## Evidence on Hand
- Menu photography in `public/images/` (almond croissant, americano, cardamom cold brew, house blend beans, vanilla latte).
- No real testimonials, press, roaster partnerships or origin stories; none may be invented.

## Product Principles
1. The next drink is the product: every operator screen answers "what do I make or ring up now".
2. Ordering ahead takes as few taps as possible on a phone, with an honest pickup time.
3. Truthful labels and states from real data (open/closed, ready times, stock).
4. Keep every route, state and workflow when changing presentation.
