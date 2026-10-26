---
version: 1
slug: "features-storefront"
primary_target: "features/storefront"
related_targets: ["app/(storefront)","app/storefront.css"]
---

# Storefront (features/storefront, app/(storefront), app/storefront.css)

Mode: Persuade on home; Operate on menu item, checkout, order confirmation, account, catering.
Audience: a customer on a phone in morning daylight, ordering ahead on the way. Action in working form: add a drink to the order from the first viewport (quick add on real menu items) with an honest pickup time.
Constraints: keep every route, state, workflow, loader, server action, form field, cart/checkout behaviour; merchant name/logo/colour/images from settings; no invented claims (no roaster partners, origins, awards). Pickup lead time only from settings.
Decision: owner ordered the redesign with no approval round (2026-10-25); assigned direction taken unattended, code-led (no image generation).

## Direction contract

THESIS: The marked cup. A café order is written on the cup: a printed grid of boxes (shots, syrup, milk, custom, decaf) and the barista's marker filling them in, with your name on the side. The storefront is that cup: the menu is what can be written, and your order is the cup being marked. It refuses the dark espresso-and-crema café page and the chalkboard menu.

OWN-WORLD: Bright white cup paper (cool white, not cream), a printed band in the merchant's colour wrapping the top of the page and every product, kraft-brown sleeve as the second neutral for trays and the cart, black marker ink. Type: a condensed sans for the printed box labels and headings (Google Fonts, not Inter/DM/Space/Plex), a marker hand (e.g. Permanent Marker) used only for what is "written": the customer's name, chosen options, item counts and the order number. Square boxes with hairline print rules; no pills.

STORY: See the menu as cups ready to mark; tap a drink, its boxes fill as you choose size and milk; your cup joins the sleeve (cart); pick up at the stated time.

FIRST VIEWPORT: Merchant band across the top (name, open/closed, pickup lead time, address). Below it the menu begins immediately as a grid of cups: each item shows its photo in a cup-shaped crop-free tile, printed name, price, and a quick-add box that gets a marker tick when added. On phones, two columns of cups, the sleeve (cart) docked as a sticky bar at the bottom once anything is added.

FORM: Candidate 3 of 7 (the marked cup), seed: seed:61689434f74cf3b5. Silver-age comic page: declined; raise: lettering carries its own physics — the marker strokes draw themselves when an option is chosen (stroke-dashoffset, under 300ms, reduced-motion respected). Googie diner: declined; raise: one confident signage move — the merchant band is a real sign with weight, not a thin header. Blue-hour cityscape: declined; raise: time of day is information — opening state and pickup time lead. Jackfield normalling schedule: declined; raise: every option shows its default plainly, and a changed option is marked as changed. Moon-shadow bazaar and oscilloscope: declined, nothing kept beyond the above. Signature interaction: on the item page the option boxes on the cup fill with marker ticks as you choose, and the name box takes the customer's name at checkout.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
