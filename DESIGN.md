---
name: Openfront Coffee Shop
description: A calm, app-like order-ahead storefront (Rigel, minimal Nordic) and a dense operator platform built like the bar.
colors:
  paper: "oklch(97.6% 0.003 250)"
  side: "oklch(95.8% 0.004 250)"
  card: "oklch(100% 0 0)"
  wash: "oklch(92.5% 0.004 250)"
  ink: "oklch(21% 0.008 260)"
  ink-soft: "oklch(40% 0.01 260)"
  ink-muted: "oklch(47% 0.012 258)"
  ink-faint: "oklch(56% 0.01 258)"
  line: "oklch(90% 0.004 250)"
  line-strong: "oklch(84% 0.006 250)"
  accent: "oklch(50% 0.17 260)"
  accent-hover: "oklch(45% 0.16 260)"
  accent-soft: "oklch(95.5% 0.025 260)"
  on-accent: "oklch(100% 0 0)"
  state-open: "oklch(52% 0.13 150)"
  state-closed: "oklch(54% 0.17 28)"
  state-pending: "oklch(66% 0.14 75)"
  danger-ink: "oklch(46% 0.17 28)"
  danger-bg: "oklch(96.5% 0.02 28)"
  success-ink: "oklch(40% 0.1 150)"
  success-bg: "oklch(96.5% 0.03 150)"
typography:
  script:
    fontFamily: "Instrument Serif (italic), Georgia, serif"
    fontSize: "clamp(2.5rem, 6vw, 5rem)"
    fontWeight: 400
    lineHeight: 1.02
  feature:
    fontFamily: "Jost, system-ui, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 400
    letterSpacing: "0.04em"
  title:
    fontFamily: "Jost, system-ui, sans-serif"
    fontSize: "1.375rem"
    fontWeight: 500
    lineHeight: 1.25
  body:
    fontFamily: "Jost, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Jost, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    letterSpacing: "0.06em"
rounded:
  pill: "999px"
  card: "20px"
  photo: "14px"
  control: "12px"
  platform-sm: "4px"
  platform-md: "6px"
spacing:
  tap: "44px"
  sidebar: "15rem"
  rail: "23rem"
  tabbar: "4.25rem"
  gutter-phone: "16px"
  gutter-desktop: "40px"
  container: "72rem"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.pill}"
    height: "44px"
    padding: "0 20px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-outline:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    height: "44px"
  checkout-button:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.card}"
    rounded: "{rounded.control}"
  category-chip:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.pill}"
    height: "44px"
  category-chip-active:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
  option-chip:
    backgroundColor: "{colors.wash}"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.pill}"
    height: "32px"
  quick-add:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.on-accent}"
    rounded: "{rounded.control}"
    size: "44px"
  option-box:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.pill}"
    height: "44px"
  option-box-marked:
    backgroundColor: "{colors.accent-soft}"
  field:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "46px"
  card:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.card}"
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

Two worlds share this codebase. The **storefront** (`features/storefront`, `app/storefront-rigel.css`, scoped to `.sf-root`) is **Rigel**, a minimal Nordic order-ahead app. The **platform** (`features/platform`, `/dashboard/platform/*`) is the bar, an extension of the shared Openfront dashboard shell. The shell itself (`features/dashboard/**`, `proxy.ts`, `app/dashboard/**` outside platform routes, `components/ui/**`) is untouched by this system and stays byte-identical to Openfront E-commerce; platform code adapts to it with explicit classes instead of editing it.

The storefront is built from the owner's chosen design (sf_themes "rigel", prompt "Minimal Nordic order-ahead", notes "Calm and quick, app-like ordering"; reference images in `Euler/state/storefront-themes/coffee-shop/rigel/`). It replaces the earlier "marked cup" storefront.

## Overview

**Creative North Star: "Rigel"** (storefront) / **"The Bar"** (platform)

Ordering coffee should feel like a quiet, well-made app. There is cool near-white paper, white cards with hairline borders and one accent: the merchant's saved logo colour, which marks the primary action, the add buttons, the active category and the active tab. Everything else is greys. A few large italic serif lines (Welcome, Order, page titles, empty states) give the calm, Nordic voice. Everything you read and tap is set in a light geometric sans.

- **Desktop (1024px+)** is a three-column app. The store sidebar holds the brand, Order Online, the nav and the pickup time. The middle column is the menu. The live **Order rail** (pickup time, lead time, the bag, Clear Bag, Checkout with the total) runs on home and item pages. From 1536px the home page adds an intro column with "Welcome", a line drawing of the bar and the menu sections.
- **Phone** is a single column. A brand header ("Order Ahead · Pick Up", account and bag) sits over the pickup card ("Pickup on {street}"), the ready line, the pickup-time pill, category chips, then menu rows. The last-added item docks as a **bag bar** (photo, name, options, count, total and Review Order) above a five-tab bar: Menu, Orders, Rewards, Beans and Profile.

The platform is the bar: every operator screen opens on the next drink to make or ring up. It inherits the shell's neutral palette and type, adds flat 6px corners (4px for small inner pieces), underline tabs with counts, dense hairline tables, and status as a dot plus a word. The one signature move is ticket age on the KDS, which gets heavier and warmer as a ticket gets old.

**Key Characteristics:**
- Storefront: cool paper, white cards, hairline borders, one merchant accent, pill chips and buttons, 14px photo corners.
- Two type voices on the storefront: Jost for everything functional, and Instrument Serif italic for the few greeting lines.
- Every pickup time comes from the store's hours and lead time (`earliestPickup`, the checkout quote). Nothing is invented.
- Platform: shell neutrals, explicit 6px/4px radii, underline tabs, Segmented choices, dense tables, dot-plus-word status.

## Colors

Storefront colours are OKLCH and defined on `.sf-root`. The accent family is computed from one runtime hue; the frontmatter records it at the demo's resolved hue (260).

### Accent
- **Merchant Accent** (`accent`, `accent-hover`, `accent-soft`): the hue comes from the merchant's saved logo colour. `--sf-logo-hue` falls back to `--sf-brand-hue`, which is `getStoreLogoThemeHue(logoColor)`. Lightness and chroma are fixed (50% / 0.17), so any hue holds white text. The accent fills the Order Online and primary buttons, the add buttons, the active category chip, chosen option pills, the step tracker and the focus ring, and colours the active tab, the "ready in" minutes and "today" in the hours table. Accent-soft is the fill of chosen options.

### Neutral
- **Paper** (`paper`) is the page ground. **Side** (`side`) is the sidebar and order rail. **Card** (`card`) is cards, fields, chips and pills. **Wash** (`wash`) is chips on phones, soft pills, the beans promo and the illustration's backdrop.
- **Ink** (`ink`, `ink-soft`, `ink-muted`, `ink-faint`): text in four steps. Ink also fills the desktop Checkout button.
- **Lines** (`line`, `line-strong`): hairline borders and row dividers, with the strong line on interactive borders.

### States
- **Open / Closed / Pending** dots (8px, round). Success green is also the bag bar's count and total.
- **Danger / Success** ink and background pairs for notices.

### Platform
The platform has no palette of its own. It uses the shell's `foreground`, `background`, `muted`, `border` and `ring`, and Tailwind status hues only where they carry meaning: status dots, rush tickets (red border), special instructions (amber wash), and ticket age.

### Named Rules
**The Merchant's Accent Rule.** The accent is the merchant's setting and is never hard-coded. Design every accent surface to work at any hue.

**The One Accent Rule.** Only actions and the current location get the accent. Content (photos, prices, chips) stays neutral.

## Typography

**Body:** Jost (`--font-sf-body`), 400/500.
**Script:** Instrument Serif italic (`--font-sf-script`), 400. Use it only for greeting and page lines: "Welcome", "Order", "Nothing In Here Yet", page and panel titles, and the receipt status.
**Platform:** the shell's Geist, unchanged, with tabular numerals.

### Hierarchy
- **Script** (clamp(2.5rem, 6vw, 3.5rem) for page titles; up to 5rem for Welcome; 3rem for the rail's Order and 2rem for panel titles).
- **Feature** (desktop "FEATURED"): 2.5rem, 400, 0.04em, uppercase. On phones it is a 1.375rem/500 sentence-case "Featured".
- **Title** (500): 1.1875rem for menu row names on phones and 1.375rem on desktop; item title clamp(1.875rem, 4vw, 2.5rem).
- **Body** (400, 1rem/1.5), with descriptions in ink-faint at 0.9375–1rem.
- **Label** (500, 0.8125rem, 0.06em, uppercase): box labels ("Hours", "Items", "Handoff code").
- Prices, totals, counts and hours use tabular numerals.

## Layout

The sidebar is 15rem and the order rail 23rem; both are sticky and full height from 1024px. The middle column's content maxes at 72rem with 40px gutters (16px on phones). Menu rows are a photo (14rem on desktop at 1.28:1, 7.5rem on phones) beside the name, price, description, up to three option chips and the add button, divided by hairlines. On phones the tab bar is 4.25rem plus the safe area, and the bag bar floats 0.5rem above it. The item page is the photo and facts beside option cards, with a sticky add bar. Checkout, receipt and catering split into content plus a 22rem sticky panel from 900px. Every target is at least 44px.

On the platform, pages open on `PlatformHeader` (a title with one truthful status line and the primary action), then the work. Sections are `PlatformSection` blocks with a title and a tabular count. The KDS lays station columns out as 1 column, 2 from md, and auto-fit 18rem columns from xl. Each column is headed by its station name and count over a 2px foreground rule.

## Elevation & Depth

The storefront is nearly flat. Cards are separated by a 1px hairline and a fill change. One soft shadow (`--sf-shadow`) lifts only the active sidebar item, the selected segment, the floating bag bar and the desktop add bar. The platform has none.

## Shapes

**Storefront:** pills (999px) for buttons, category and option chips, steppers and the search field. 20px for cards. 14px for menu photos. 12px for fields, the add button, the checkout button and alerts. Status dots and step circles are round.

On the platform, corners are explicit pixel radii, because the dashboard's `--radius` is 10px and the shell's defaults would round everything too much. Use 6px (`rounded-[6px]`) for buttons, bump buttons, Segmented, tables, ticket cards and empty states, and 4px (`rounded-[4px]`) for small inner pieces such as dropdown items, special-instruction notes and logo swatches. The only round shape is the 8px status dot.

## Components

### Sidebar (desktop)
The saved logo mark sits above the store name (Jost 500, 1.375rem) with the Order Online pill below. Nav rows (44px, a 1.25rem lucide icon and the label) cover Order, Rewards, Your Orders, Shop (only when the menu has a retail-shelf category), Catering, Our Café and Account. The current row is a white card with a soft shadow. At the bottom, "Pickup Time" shows a soft pill reading "Now" while the café is open, or the first pickup after it opens; it links to checkout, where the time is chosen.

### Order Rail (desktop)
"Order" in script, then the pickup line (the earliest ready time with a check icon) and a soft pill showing the store's lead time. The body is either the empty state ("Nothing In Here Yet" in script, with "Tap add when you find something you love") or the bag lines, each with a photo, name, options, a small stepper and the line total. The foot holds Clear Bag, a Pickup pill and the ink Checkout button with the running total. It reads and writes the same browser cart as checkout.

### Pickup Header (phone)
The pickup card (map pin, "Pickup on {street}", name · address, chevron) links to maps. Below it, the ready line reads "Ready in about **N min**" while open, or "Opens … · order ahead" when closed. The pickup-time pill to its right is captioned "Pickup Time".

### Menu Row (signature)
Photo, name, description and price (top right on desktop; beside the add button on phones). Option chips come from the item's own modifiers: standard choices plainly (with a size/milk/ice/grind icon on desktop), then up to two alternates with a "+" and their price adjustment. On phones the chips are limited to one line. The add button is a 44px accent square with 12px corners. It adds with the standard choices after a server quote, or opens the item page when a required choice has no default. It flashes green with a check when added.

### Beans
On phones, "{Retail category}" with its description and a chevron, over a horizontal shelf of bean cards (photo, name, accent price). On desktop, a wash-filled promo card ("Our Beans", the description, "Shop now").

### Bag Bar (phone)
A white floating card: the last item's photo, name and options, a green count badge, the green total and the accent "Review Order" pill.

### Tab Bar (phone)
Five tabs with 1.5rem lucide icons over 0.75rem labels: Menu, Orders, Rewards, Beans (Visit when there is no retail shelf) and Profile. The active tab is accent coloured. Item pages hide the tab bar for their own add bar.

### Option Pills (item page)
Each modifier group is a white card with its name, its rule ("Pick one", which turns danger when unmet), the written choice and a **Changed** badge. Options are pills with a round check: chosen pills take the accent border and accent-soft fill with a white check on accent. A default shows **Standard**. The check draws itself (stroke-dashoffset, 260ms) and is still under reduced motion.

### Buttons, Fields, Toggles
Buttons are pills at 44px (52px large). Primary is accent, the default is white outlined, ink is used for decisive actions, quiet has no border, and press is scale(0.98). Fields are 12px rounded with a strong hairline border; on focus the border turns accent with a 3px accent-soft ring. Segmented toggles (payment, sign in / create account) are a wash track with a white raised selected segment.

### Receipt
The status line is in script with a dot. The facts are order, name and pickup. The step tracker is accent circles joined by a line, in rows of three on phones. Items, totals and the handoff code (3rem, tracked) sit in a sticky card with Refresh status.

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
- **Do** derive every accent surface from the accent variables, so the merchant's saved logo colour sets the hue.
- **Do** keep the storefront calm: white cards, hairlines, one accent, generous space.
- **Do** keep the script serif for greeting and page lines only.
- **Do** take every pickup time, lead time and option chip from the store's settings and menu data.
- **Do** keep 44px minimum targets on the storefront.
- **Do** pass explicit `rounded-[6px]` (or `rounded-[4px]` for small inner pieces) on every platform surface and `components/ui` instance.
- **Do** use underline tabs with counts for platform views, and Segmented for in-form value choices.
- **Do** show platform status as a dot plus a word, and ticket age with its weight ramp.

### Don't:
- **Don't** hard-code an accent colour or assume it is blue.
- **Don't** spread the accent onto content, prices or decorative fills.
- **Don't** add heavy shadows or dark storefront surfaces beyond the ink Checkout button.
- **Don't** use pill-shaped or heavily rounded tabs, chips or cards on the platform (owner rule, 2026-10-25); pills are a storefront-only shape.
- **Don't** edit the shared dashboard shell or `components/ui/**`; adapt with explicit classes.
- **Don't** invent claims (roaster partners, origins, awards), menu items or pickup times that don't come from settings.
