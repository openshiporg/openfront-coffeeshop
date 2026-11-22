# Agent rules

NEVER build outbox/texting/email notification machinery, cron, worker services, or setInterval/setTimeout loops in `instrumentation.ts` into this Openfront.
- Time-based state is computed on read, advanced idempotently on the request that touches it, or advanced by a staff button.
- External events go only through Openfront Commerce webhooks (`~/Code/openfronts/openfront/features/webhooks`).
- Reports are Export buttons; invites are copyable links.
- Allowed (product decision 2026-11-22): two inline transactional emails sent right after the command commits, once, with no queue/retry/worker: the storefront order confirmation (`lib/orderConfirmation.ts`) and the gift card code (`emailGiftCardOnce`, guarded by `GiftCard.emailedAt`). Do not remove them.
- `CoffeeCommandReceipt` is an idempotency ledger only (replay receipts written with the command's effect). Nothing delivers from it.
