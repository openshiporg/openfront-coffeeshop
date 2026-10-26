---
name: Openfront Coffee Shop
description: An order-ahead storefront printed like a marked paper cup, and a dense operator platform built like the bar.
colors:
  cup-paper: "oklch(98.4% 0.004 240)"
  cup-white: "oklch(100% 0 0)"
  marker-ink: "oklch(19% 0.006 260)"
  ink-muted: "oklch(42% 0.012 255)"
  ink-faint: "oklch(50% 0.012 255)"
  rule-soft: "oklch(87% 0.006 250)"
  band: "oklch(46% 0.14 260)"
  band-deep: "oklch(37% 0.12 260)"
  band-ink: "oklch(38% 0.13 260)"
  band-tint: "oklch(94.5% 0.03 260)"
  band-wash: "oklch(97.5% 0.014 260)"
  on-band: "oklch(100% 0 0)"
  kraft: "oklch(76% 0.062 70)"
  kraft-light: "oklch(88% 0.04 74)"
  kraft-deep: "oklch(54% 0.07 62)"
  kraft-ink: "oklch(30% 0.03 60)"
  state-open: "oklch(50% 0.13 150)"
  state-closed: "oklch(52% 0.18 28)"
  state-pending: "oklch(64% 0.14 75)"
  danger-ink: "oklch(45% 0.17 28)"
  danger-bg: "oklch(96.5% 0.02 28)"
  success-ink: "oklch(38% 0.1 150)"
  success-bg: "oklch(96% 0.03 150)"
typography:
  display:
    fontFamily: "Sofia Sans Condensed, system-ui, sans-serif"
    fontSize: "clamp(2.375rem, 8vw, 4.5rem)"
    fontWeight: 800
    lineHeight: 0.92
    letterSpacing: "-0.005em"
  wordmark:
    fontFamily: "Sofia Sans Condensed, system-ui, sans-serif"
    fontSize: "clamp(1.375rem, 6vw, 2.75rem)"
    fontWeight: 850
    lineHeight: 0.9
    letterSpacing: "0.005em"
  headline:
    fontFamily: "Sofia Sans Condensed, system-ui, sans-serif"
    fontSize: "clamp(2.25rem, 7vw, 4rem)"
    fontWeight: 800
    lineHeight: 0.95
  title:
    fontFamily: "Sofia Sans Condensed, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 800
    lineHeight: 1.02
  body:
    fontFamily: "Sofia Sans, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Sofia Sans Condensed, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 750
    letterSpacing: "0.07em"
  marker:
    fontFamily: "Permanent Marker, Comic Sans MS, cursive"
    fontSize: "1.375rem"
    fontWeight: 400
    lineHeight: 1.15
    letterSpacing: "0.01em"
rounded:
  cup: "0px"
  platform-sm: "4px"
  platform-md: "6px"
spacing:
  tap: "44px"
  gutter-phone: "16px"
  gutter-tablet: "24px"
  gutter-desktop: "40px"
  cup-gap-phone: "12px"
  cup-gap-tablet: "16px"
  cup-gap-desktop: "20px"
  container: "78rem"
components:
  button-primary:
    backgroundColor: "{colors.band}"
    textColor: "{colors.on-band}"
    typography: "{typography.label}"
    rounded: "{rounded.cup}"
    padding: "0 18px"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.band-deep}"
  button-ink:
    backgroundColor: "{colors.marker-ink}"
    textColor: "{colors.cup-white}"
    rounded: "{rounded.cup}"
    height: "44px"
  button-outline:
    backgroundColor: "{colors.cup-white}"
    textColor: "{colors.marker-ink}"
    rounded: "{rounded.cup}"
    padding: "0 18px"
    height: "44px"
  button-outline-hover:
    backgroundColor: "{colors.band-wash}"
  cup-tile:
    backgroundColor: "{colors.cup-white}"
    textColor: "{colors.marker-ink}"
    rounded: "{rounded.cup}"
  cup-band:
    backgroundColor: "{colors.band}"
    textColor: "{colors.on-band}"
    typography: "{typography.label}"
    padding: "4px 10px 5px"
  quick-add:
    backgroundColor: "{colors.cup-white}"
    textColor: "{colors.marker-ink}"
    rounded: "{rounded.cup}"
    size: "44px"
  quick-add-added:
    backgroundColor: "{colors.band-tint}"
  option-box:
    backgroundColor: "{colors.cup-white}"
    textColor: "{colors.marker-ink}"
    rounded: "{rounded.cup}"
    padding: "8px 12px"
    height: "56px"
  option-box-marked:
    backgroundColor: "{colors.band-tint}"
  changed-mark:
    backgroundColor: "{colors.band-tint}"
    textColor: "{colors.band-ink}"
    padding: "1px 6px"
  field:
    backgroundColor: "{colors.cup-white}"
    textColor: "{colors.marker-ink}"
    typography: "{typography.body}"
    rounded: "{rounded.cup}"
    padding: "10px 12px"
    height: "44px"
  name-box:
    backgroundColor: "{colors.cup-white}"
    textColor: "{colors.marker-ink}"
    typography: "{typography.marker}"
    rounded: "{rounded.cup}"
    height: "56px"
  sleeve-bar:
    backgroundColor: "{colors.kraft}"
    textColor: "{colors.marker-ink}"
    height: "64px"
  kraft-tray:
    backgroundColor: "{colors.kraft-light}"
    textColor: "{colors.marker-ink}"
    padding: "20px"
  platform-button:
    rounded: "{rounded.platform-md}"
    height: "40px"
    padding: "0 16px"
  platform-bump-button:
    rounded: "{rounded.platform-md}"
    height: "56px"
  platform-segmented:
    rounded: "{rounded.platform-md}"
    height: "40px"
  platform-table:
    rounded: "{rounded.platform-md}"
  platform-menu-item:
    rounded: "{rounded.platform-sm}"
---

# Design System: Openfront Coffee Shop

Two worlds share this codebase. The **storefront** (`features/storefront`, `app/storefront-cup.css`, scoped to `.sf-root`) is the marked cup. The **platform** (`features/platform`, `/dashboard/platform/*`) is the bar, an extension of the shared Openfront dashboard shell. The shell itself (`features/dashboard/**`, `proxy.ts`, `app/dashboard/**` outside platform routes, `components/ui/**`) is untouched by this system and stays byte-identical to Openfront E-commerce; platform code adapts to it with explicit classes instead of editing it.

Recorded from the shipped build (commits 85cabd7 and 6e7c9f5; live at https://openfront-coffee-shop-production.up.railway.app; finish review: ship, all eight material fixes resolved). It replaces the earlier espresso-black storefront.

## Overview

**Creative North Star: "The Marked Cup"** (storefront) / **"The Bar"** (platform)

A café order is written on the cup: a printed grid of boxes and the barista's marker filling them in. The storefront is that cup. Bright cool-white paper, a printed band in the merchant's own colour across the top of the page and every product, a kraft-brown sleeve for the cart and the checkout tray, black marker ink. Printed things (headings, box labels, buttons) are set in a condensed sans; written things (the customer's name, chosen options, counts, the order number, "today" on the hours table) are in a marker hand. Everything is square: 1px ink print rules, no radii, no pills. It is phone-first, with 44px targets, two columns of cups, and a sticky kraft sleeve once something is in the order.

The platform is the bar: every operator screen opens on the next drink to make or ring up. It inherits the shell's neutral palette and type, adds flat 6px corners (4px for small inner pieces), underline tabs with counts, dense hairline tables, and status as a dot plus a word. The one signature move is ticket age on the KDS, which gets heavier and warmer as a ticket gets old.

**Key Characteristics:**
- Storefront: cool cup paper, a merchant-hue band, kraft sleeve, black marker ink; square everything.
- Two type voices on the storefront: printed (Sofia Sans Condensed / Sofia Sans) and written (Permanent Marker).
- Marker ticks draw themselves with stroke-dashoffset in 240ms and appear already drawn under reduced motion.
- Platform: shell neutrals, explicit 6px/4px radii, underline tabs, Segmented choices, dense tables, dot-plus-word status.
- KDS: station columns with age weight.

## Colors

Storefront colours are OKLCH and defined on `.sf-root`. The band family is computed from one runtime hue; the frontmatter records it at the demo's resolved hue (260).

### Primary
- **Merchant Band** (`band`, with `band-deep`, `band-ink`, `band-tint`, `band-wash`): the printed band. It covers the header sign, the top of every cup tile, the item photo and the option sheet, and fills primary buttons, focus rings, selection and caret. The hue comes from the merchant's saved logo colour: `--sf-logo-hue` falls back to `--sf-brand-hue`, which is `getStoreLogoThemeHue(logoColor)` (a base of 260 plus the saved rotation) and defaults to 45 when no store is configured. Lightness and chroma are fixed (46% / 0.14 for the band), so any merchant hue stays legible behind white type. Tint and wash are the marked and hover fills of boxes.
- **On Band** (`on-band`): white type and rules reversed out of the band.

### Secondary
- **Kraft Sleeve** (`kraft`, `kraft-light`, `kraft-deep`, `kraft-ink`): the second neutral, used for the cart and nothing else. Kraft is the sticky sleeve bar, kraft-light is the checkout tray, kraft-deep is their rules, and kraft-ink replaces muted ink inside the tray. It is flat, with no faked corrugation (removed in the finish review).

### Neutral
- **Cup Paper** (`cup-paper`): the page ground, a cool white rather than cream.
- **Cup White** (`cup-white`): tiles, boxes, fields and buttons sitting on the paper.
- **Marker Ink** (`marker-ink`): all text, 1px print rules, ticks, and the selected (inverted) state of tracks.
- **Muted / Faint Ink** (`ink-muted`, `ink-faint`): secondary copy and placeholders; faint also draws the dashed border of unavailable boxes.
- **Soft Rule** (`rule-soft`): row dividers inside hours and facts lists. Structural frames always use ink.

### States
- **Open / Closed / Pending** (`state-open`, `state-closed`, `state-pending`): square status dots on the storefront. On the band, open and closed use lighter fills so they read on the merchant colour.
- **Danger / Success** ink and background pairs: field errors and notices.

### Platform
The platform has no palette of its own. It uses the shell's `foreground`, `background`, `muted`, `border` and `ring`, and Tailwind status hues only where they carry meaning: status dots, rush tickets (red border), special instructions (amber wash), and ticket age.

### Named Rules
**The Merchant's Band Rule.** The band hue is the merchant's setting and is never hard-coded. The demo band renders blue because Neighborhood Roast's saved logo colour is hue 0, which the settings preset maps onto the 260 base. That is the merchant's choice, not a palette decision. Design every band surface to work at any hue.

**The Kraft Is the Cart Rule.** Kraft appears only where the order lives: the sleeve bar and the checkout tray.

## Typography

**Display Font:** Sofia Sans Condensed (`--font-sf-display`, with system-ui)
**Body Font:** Sofia Sans (`--font-sf-body`, with system-ui)
**Written Font:** Permanent Marker (`--font-sf-marker`, with Comic Sans MS, cursive)
**Platform:** the shell's Geist, unchanged, with tabular numerals for ages, times and money.

**Character:** The condensed sans is the print on the cup: heavy (750 to 850), uppercase for labels and buttons, tight on headings. The marker is the barista's hand and appears only where something has been written.

### Hierarchy
- **Display** (800, clamp(2.375rem, 8vw, 4.5rem), 0.92): item page title.
- **Wordmark** (850, clamp(1.375rem, 6vw, 2.75rem), up to 4rem on the tall home band, uppercase): the merchant name on the sign.
- **Headline** (800, clamp(2.25rem, 7vw, 4rem), 0.95): page titles. Section titles use clamp(1.875rem, 5vw, 2.75rem).
- **Title** (800, 1.1875rem on phones and 1.375rem from 640px, 1.02): cup names.
- **Body** (400, 1rem, 1.5): reading copy. Leads max out at 52 to 60ch.
- **Label** (750, 0.875rem, 0.07em, uppercase): printed box labels ("Hours", "Find us", "Handoff code"), and buttons and tracks at 1rem / 0.05em. Band facts use 0.75rem / 0.09em.
- **Marker** (400, 1.375rem in option rows and counts, 1.5rem in the name box, 1.75rem on the sleeve count).

### Named Rules
**The Written-Only Rule.** Permanent Marker is used only for what a barista writes: the customer's name (the checkout name box and the barista note), chosen options, item counts and the cart badge, the order number, and "today". Never use it for headings, prices, buttons or decoration.

**The Tabular Money Rule.** Prices, hours and every platform age, time or amount use tabular numerals.

## Layout

The storefront container is 78rem with gutters of 16px, 24px from 640px and 40px from 1024px. The cup grid has 2 columns on phones (12px gap), 3 from 640px (16px) and 4 from 1024px (20px). The All view is one grid with the category printed on each band, so four cups sit above the fold on desktop and two columns open the phone view. The first viewport is the merchant band (name, open/closed, pickup lead time, address as boxed facts), then the menu immediately. The item page is the photo beside a 26rem option sheet from 1024px. Below that width the add bar pins to the bottom of the viewport. Checkout splits into content plus a 24rem sticky panel from 1024px. Every target is at least 44px.

On the platform, pages open on `PlatformHeader` (a title with one truthful status line and the primary action), then the work. Sections are `PlatformSection` blocks with a title and a tabular count. The KDS lays station columns out as 1 column, 2 from md, and auto-fit 18rem columns from xl. Each column is headed by its station name and count over a 2px foreground rule.

## Elevation & Depth

Both worlds are flat. There are no shadows in the storefront stylesheet and none in the platform kit. Depth comes from ink rules: 1px frames, 1.5px on controls, and 2px under the header sign, above the sleeve and on the name box. The band sits at the top of tiles as an 8px (0.5rem) or 10px (0.625rem) solid top border. Colour layering does the rest: paper, cup white, band tint, and kraft for the cart.

### Named Rules
**The Print-Rule Depth Rule.** Separation is a ruled line or a fill change, never a shadow.

## Shapes

On the storefront, every box is square (0 radius): buttons, fields, cup tiles, option boxes, quick-add, the stepper, square status dots and the logo label. Adjacent boxes share one hairline: a -1px margin overlap with a 1px pad on the container, so the grid reads as one printed sheet. Unavailable boxes switch to dashed faint borders. The header carries a printed 1px white pinstripe 6px above its bottom edge.

On the platform, corners are explicit pixel radii, because the dashboard's `--radius` is 10px and the shell's defaults would round everything too much. Use 6px (`rounded-[6px]`) for buttons, bump buttons, Segmented, tables, ticket cards and empty states, and 4px (`rounded-[4px]`) for small inner pieces such as dropdown items, special-instruction notes and logo swatches. The only round shape is the 8px status dot.

**Built adaptation: rectangular cups.** The contract asked for cup-shaped tiles. The build uses rectangular tiles carrying the printed band, because clipping a tapered cup silhouette cut the 1px side rules. The band, the photo and the ruled print are what make it a cup. Do not reintroduce a tapered clip-path.

## Components

### Cup Tile (signature)
A cup on the menu, from top to bottom:
1. **Band.** In the All view, the category is printed on it in uppercase label type (0.8125rem / 750 / 0.06em, ellipsis), reversed out of the band. Category views drop the printed name and keep an 8px band top border.
2. **Photo.** A square 1:1 crop with a 1px ink rule below. Unavailable items are greyscaled at 70% opacity.
3. **Name.** In title type. A 2px underline appears on hover, and a two-line description shows from 640px.
4. **Foot.** The price (700, tabular, set on the 44px line) and the quick-add box on the right.
The tile is cup white with a 1px ink frame. Tags use the changed-mark style (band-tint fill, band-ink rule and text).

### Quick-Add Box
A 44px square with a 1.5px ink border that tints to band-tint on hover. When added it stays band-tint and holds a 28px marker tick. The text variant uses label type. The unavailable variant is dashed faint with muted 0.8125rem text and cannot be pressed. Errors are set right-aligned at 0.75rem in danger ink.

### Marker Tick
An SVG path (`pathLength=1`, stroke-dasharray 1) at a 3.6 stroke with round caps, in ink. It draws itself from stroke-dashoffset 1 to 0 over 240ms on `cubic-bezier(0.23, 1, 0.32, 1)`. Under reduced motion the animation is removed and the tick appears already drawn. It is used in quick-add boxes and option-box squares.

### Option Boxes (item page)
The option sheet is cup white with a 10px band top border, holding one row per modifier group. Each row header pairs the group name in label type (1.0625rem / 800) with its rule ("Choose 1"). The rule turns danger ink and semibold when unmet. Below it, the written line shows the chosen options in marker. A **Changed** mark (band-tint, band-ink 1px rule, 0.75rem uppercase label) appears when the choice differs from the defaults; "None" or "Not chosen yet" appears in muted body type when nothing is chosen. Boxes sit in an auto-fill grid of 8rem minimum: a 28px ink square, the option name (650) and a note line where a default reads **Standard**. Marking a box fills it band-tint and draws the tick. Focus is a 2px band outline inset 4px. Disabled boxes are dashed.

### Sleeve Bar
The cart, docked as a kraft bar once anything is in the order. On phones it spans the full width at the bottom (64px minimum, with a safe-area pad and a kraft-deep 2px top rule). From 768px it is a 24rem card at the bottom right. It slides in once (260ms translateY), and not at all under reduced motion. It holds the marker count (1.75rem) and an ink "checkout" CTA in uppercase label type.

### Buttons
- **Shape:** square (0), 44px minimum (52px for the large size), uppercase label type at 1rem / 750 / 0.05em, 1.5px border.
- **Primary:** band fill and border with on-band text. Hover goes to band-deep.
- **Ink:** marker-ink fill with cup-white text. Used for the sleeve CTA and decisive actions.
- **Outline (default):** cup white with an ink border. Hover goes to band-wash.
- **Ghost / Quiet:** transparent; quiet also drops the border.
- **Press:** scale(0.97) over 140ms. Disabled is 50% opacity.

### Tracks (storefront tabs and segments)
Square boxes on one shared hairline. The current, pressed or checked box inverts to an ink fill with cup-white text. Hover goes to band-wash. Focus is a band outline inset 4px. This is the storefront's only tab form; there are no pills.

### Inputs / Fields
- **Style:** cup white, 1px ink border, square, 44px, body type.
- **Focus:** the border turns band colour with a 2px band outline.
- **Error:** danger-ink border and a 0.875rem danger message.
- **Written fields:** the name box (56px, 2px border, marker at 1.5rem) and the barista note use marker, because they are written on the cup.

### Kraft Tray (checkout)
The order sits on kraft-light with a kraft-deep 1px frame and 20px sections (24px from 640px). It holds the line items with options written in marker, a marker count beside "Items", and a kraft-deep rule above the totals.

### Navigation
The merchant band is the sign. It carries the wordmark next to the logo on a white 44px label with an ink frame, so the logo keeps its own colour on any band. From 960px there are uppercase label-type links whose 2px underline appears on hover. The cart link is a cup-white ink-framed box with the word "Cart" at every width (the bag icon hides on phones) and a marker count only when the cart is not empty. Band facts are boxed cells with white 60% rules.

### Platform Kit
- **Underline tabs** (`PillTrack`, `PillLink`, `PillButton`; the names are kept from the old kit). Flat tabs sit on one bottom border with a 20px gap, at 36px (40px for md), 0.875rem medium. The active tab gets a 2px foreground underline. Inactive tabs are muted and gain a border-coloured underline on hover. Each tab can show a tabular count. Rows scroll sideways and never wrap.
- **Segmented.** For a choice between two and five values inside a form (tender, size): 6px-radius segments on one hairline frame, with left borders between them. The chosen segment is filled foreground with background text. Heights are 40px (32px for sm). Press is scale(0.98). Focus is an inset ring.
- **PlatformTable.** A dense operator table: 6px hairline frame on the background colour, a muted/40 header band 36px tall in 0.75rem medium muted type, 12px cell padding, 10px vertical cell padding (rows about 40px), hairline row dividers with none on the last row, and sideways scroll on overflow.
- **PlatformHeader / PlatformSection / PlatformEmpty.** The title is 1.25rem semibold (1.375rem from md) above one status line and the actions. Sections take a 1rem semibold title with a tabular count. Empty states are quiet dashed 6px boxes with muted copy.
- **Status: dot plus a word.** An 8px coloured dot sits on the heading's first line, followed by the status word in 0.75rem muted medium type (`StatusTitle`). It can pulse when live, but not under reduced motion. Status is never a coloured chip, and never a dot without its word.
- **Buttons.** Flat 6px, 40px minimum. The primary is filled foreground ink with background text and goes to 90% opacity on hover. The quiet button is bordered on the background colour and goes muted on hover. Press is scale(0.97).
- **KDS station columns and age weight.** Each station is a column of 6px ticket cards (a rush ticket gets a red/60 border) with a full-width 56px bump button in foreground ink at 1.125rem semibold. Ticket age (`TicketAge`, tabular, refreshed every 15s) gets heavier with time: under 5 min it is normal weight and muted; 5 to 9 min it is medium in foreground; 10 to 14 min it is semibold amber-700; 15 min and over, or late against the promised time, it is bold red-600. Timed tickets count down ("Due in"), and late ones read "Late".

### Named Rules
**The Dot-Plus-Word Rule.** Platform status is an 8px dot and a word. Colour appears only where it carries meaning.

**The Explicit Radius Rule.** Every platform corner is `rounded-[6px]` or `rounded-[4px]`. Never inherit the 10px dashboard `--radius` from `components/ui` defaults.

## Do's and Don'ts

### Do:
- **Do** derive every band surface from the band variables, so the merchant's saved logo colour sets the hue.
- **Do** keep storefront boxes square, sharing one hairline (-1px overlap) and framed in marker ink.
- **Do** reserve Permanent Marker for written things: names, chosen options, counts, order numbers and "today".
- **Do** mark a changed option with **Changed** and a default with **Standard**, and draw the marker tick with stroke-dashoffset in 240ms, appearing already drawn under reduced motion.
- **Do** keep kraft for the cart (the sleeve bar and the checkout tray).
- **Do** keep 44px minimum targets on the storefront.
- **Do** pass explicit `rounded-[6px]` (or `rounded-[4px]` for small inner pieces) on every platform surface and `components/ui` instance.
- **Do** use underline tabs with counts for platform views, and Segmented for in-form value choices.
- **Do** show platform status as a dot plus a word, and ticket age with its weight ramp.

### Don't:
- **Don't** use pills or rounded corners on the storefront, or pill-shaped or heavily rounded tabs, chips or cards on the platform (owner rule, 2026-10-25).
- **Don't** hard-code a band colour or assume the band is blue.
- **Don't** clip cup tiles to a tapered silhouette; it cuts the 1px side rules.
- **Don't** add shadows to either world.
- **Don't** fake kraft texture (corrugation); the sleeve is flat.
- **Don't** edit the shared dashboard shell or `components/ui/**`; adapt with explicit classes.
- **Don't** invent claims (roaster partners, origins, awards) or pickup times that don't come from settings.
