import Link from "next/link";
import { GiftCardBuy } from "../components/GiftCardBuy";
import { StorefrontShell } from "../components/StorefrontShell";
import { getCheckoutCustomer } from "../lib/data/account";
import { confirmGiftCardOrder, getGiftCardOptions, type GiftCardOrder } from "../lib/data/giftCards";
import { getCoffeeStoreResult } from "../lib/data/store";
import { formatMoney } from "../lib/format";

function validUntil(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null;
}

function OrderResult({ order, cancelled }: { order: GiftCardOrder; cancelled: boolean }) {
  const amount = formatMoney(order.amount, order.currencyCode);
  if (order.code) {
    const until = validUntil(order.expiresAt);
    return (
      <section className="sf-panel sf-stack" aria-labelledby="gift-done-title">
        <h2 id="gift-done-title" className="sf-display sf-panel-title">Your {amount} gift card is ready</h2>
        <p className="sf-gift-code" aria-label={`Gift card code ${order.code.split("").join(" ")}`}>{order.code}</p>
        <p>
          {order.recipientEmail ? <>We’ve emailed the code to {order.recipientName || order.recipientEmail} at {order.recipientEmail}. </> : null}
          Show it at the counter or read it out at pickup.{until ? ` Good until ${until}.` : ""}
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/#menu" className="sf-btn sf-btn-ink">See the menu</Link>
          <Link href="/gift-cards" className="sf-btn">Buy another</Link>
        </div>
      </section>
    );
  }
  if (order.status === "cancelled" || cancelled) {
    return (
      <div className="sf-alert-error" role="status">
        <p>{cancelled ? "Payment was cancelled, so no gift card was bought." : "This gift card order didn’t go through."} Nothing was charged.</p>
      </div>
    );
  }
  return (
    <div className="sf-alert-success" role="status">
      <p>Waiting for Stripe to confirm your {amount} payment. Refresh in a moment; the code appears here and in the email.</p>
    </div>
  );
}

export default async function GiftCardsPage({ card, token, result }: { card?: string; token?: string; result?: string }) {
  const [customer, storeResult, options, confirmation] = await Promise.all([
    getCheckoutCustomer().catch(() => null),
    getCoffeeStoreResult(),
    getGiftCardOptions(),
    card && token ? confirmGiftCardOrder(card, token) : Promise.resolve(null),
  ]);
  const store = storeResult.kind === "ok" ? storeResult.store : null;
  return (
    <StorefrontShell cartBar={false} active="giftcards">
      <main className="sf-container sf-page">
        <h1 className="sf-display sf-page-title">Gift cards</h1>
        <p className="sf-page-lead">Coffee for someone else. Pick an amount, and we email them a code to spend at {store?.name || "the café"}.</p>
        {confirmation ? (
          <div className="mb-6">
            {confirmation.order ? <OrderResult order={confirmation.order} cancelled={result === "cancelled"} /> : <div className="sf-alert-error" role="alert">{confirmation.error}</div>}
          </div>
        ) : null}
        {options.online && options.amounts.length ? (
          <div className="sf-split">
            <div className="min-w-0">
              <GiftCardBuy amounts={options.amounts} currencyCode={options.currencyCode} customer={customer} />
            </div>
            <aside className="sf-panel sf-sticky-panel" aria-labelledby="gift-rules-title">
              <h2 id="gift-rules-title" className="sf-display sf-panel-title">How it works</h2>
              <dl className="sf-rules">
                <div>
                  <dt>Delivery</dt>
                  <dd>By email, as soon as the payment clears</dd>
                </div>
                <div>
                  <dt>Spending it</dt>
                  <dd>At the counter or when picking up an order ahead; any balance stays on the card</dd>
                </div>
                <div>
                  <dt>Good for</dt>
                  <dd>Five years from purchase</dd>
                </div>
                {store?.address ? (
                  <div>
                    <dt>Café</dt>
                    <dd>{store.address}</dd>
                  </div>
                ) : null}
              </dl>
            </aside>
          </div>
        ) : (
          <div className="sf-empty" role="status">
            <strong>Gift cards are sold at the counter</strong>
            <span>Online gift cards aren’t available right now.{store?.address ? ` Stop by ${store.address}.` : ""}</span>
          </div>
        )}
      </main>
    </StorefrontShell>
  );
}
