---
version: 1
slug: "features-platform"
primary_target: "features/platform"
related_targets: ["app/dashboard/(admin)/platform"]
---

# Platform pages (features/platform, /dashboard/platform/*)

Mode: Operate. Users: baristas, shift lead, owner. Inside the fixed shared dashboard shell, byte-identical to E-commerce; `components/ui/**` also shared (pass explicit radius classes, never edit).
Rules (owner, 2026-10-25): no pill or heavily rounded tabs, chips or cards; radii at most 6px (explicit `rounded-[6px]`, since the dashboard's `--radius` is 10px); flat underline tabs; dense tables with real status columns; each page opens on the operator's first-10-seconds task.

## Direction contract

THESIS: The bar. Every screen opens on the next drink to make or ring up, and refuses the pill-track-over-card-grid template.

OWN-WORLD: The shell's neutral palette; status colour only where it carries meaning (dot + word); one sans with tabular numerals for ticket ages, times and money; dense rows; flat 6px buttons with a filled ink primary; underline tabs with counts; filters as compact selects or underline tabs, never pill rows.

STORY: See what's waiting and how old it is, act from the ticket (start, ready, picked up, take payment), reach stock/recipe/register detail only when needed.

FIRST VIEWPORT: Title with one truthful status and the primary action; then the work: on KDS station columns of tickets with age timers and big flat bump buttons; on POS the item grid and ticket owning the screen (one-card open-shift state when closed); on Orders the live queue above history.

FORM: Extension of the established shell world. The concept roll was skipped on purpose: the owner's brief pins this surface's structure (task-first pages, dense tables with a status column, flat underline tabs, radii at most 6px), and a pinned brief outranks the roll. Owner's words (brief batches-2-6-full-redesign-2026-10-25.md): "No pill-shaped or heavily rounded tabs, chips or cards. Use tight radii (≤6px), flat or underline tabs, dense readable tables and lists, clear hierarchy, real status columns." and "Rebuild each page around the operator's main tasks (what they open it to do in the first 10 seconds), not around the data model." seed: none (skipped, structure pinned by the owner's brief). Signature move: ticket age shown as a timer that changes weight as the ticket gets old.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
