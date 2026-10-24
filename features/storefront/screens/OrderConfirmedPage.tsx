import Link from "next/link";
import { cache } from "react";
import { ArrowLeft } from "lucide-react";
import { formatModifierAdjustment, formatMoney, formatPickupTime } from "@/features/storefront/lib/format";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { StorefrontShell } from "@/features/storefront/components/StorefrontShell";
import { StorefrontMedia } from "@/features/storefront/components/StorefrontMedia";
import { getCoffeeStoreResult } from "@/features/storefront/lib/data/store";
import { ReceiptRefreshButton } from "@/features/storefront/components/ReceiptRefreshButton";
import { ReceiptRewardsPanel } from "@/features/storefront/components/ReceiptRewardsPanel";
import { ReceiptPayOnline } from "@/features/storefront/components/ReceiptPayOnline";
import type { CafeOrderItemSnapshot, CafePickupOrder } from "@/features/storefront/lib/data/orders";
import { getCustomerOrderStatusCopy, getOrderConfirmationFailureCopy, resolveOrderConfirmation } from "@/features/storefront/lib/orderConfirmation";

const ORDER_QUERY = `
  query ConfirmedCafeOrder($id: ID!, $secretKey: String) {
    getCafeOrder(orderId: $id, secretKey: $secretKey) {
      id orderNumber status handoffCode pickupName promisedAt subtotal tax tip total currencyCode specialInstructions paidAt customerEmail rewardsLinked rewardsEligible
      orderItems {
        id quantity itemNameSnapshot imagePathSnapshot customizationsSummary specialInstructions price
        modifierSnapshot { id name group groupLabel priceAdjustment }
      }
    }
  }
`;

// Customer-facing progress. "paid" sits with "accepted": payment doesn't move the drink along.
const PROGRESS = [
  { label: "Received", statuses: ["open"] },
  { label: "Accepted", statuses: ["accepted", "paid"] },
  { label: "In queue", statuses: ["in_bar_queue"] },
  { label: "Preparing", statuses: ["preparing"] },
  { label: "Ready", statuses: ["ready"] },
  { label: "Picked up", statuses: ["completed"] },
];

function paymentLine(order: CafePickupOrder) {
  const total = formatMoney(order.total, order.currencyCode);
  if (order.status === "refunded") return `Refunded · ${total}`;
  if (order.status === "cancelled") return null;
  if (order.paidAt || order.status === "paid") return `Paid · ${total}`;
  return order.status === "completed" ? null : `Pay at pickup · ${total}`;
}

function statusDot(status: string) {
  if (status === "ready") return "sf-dot-ready";
  if (status === "completed") return "sf-dot-done";
  if (status === "cancelled" || status === "refunded") return "sf-dot-cancelled";
  return PROGRESS.some((step) => step.statuses.includes(status)) ? "sf-dot-active" : "";
}

/** One receipt read per request, shared by the page and its title. */
export const loadOrderReceipt = cache(async (id: string | undefined, secretKey: string | undefined) =>
  id ? keystoneClient<{ getCafeOrder: CafePickupOrder | null }>(ORDER_QUERY, { id, secretKey }, { cache: "no-store" }) : null,
);

export async function OrderConfirmedPage({ id, secretKey, payment: returnedFromPayment }: { id?: string; secretKey?: string; payment?: string }) {
  // The receipt is authorized on its own; current public store settings are optional context, never a gate.
  const [response, storeResult] = await Promise.all([
    loadOrderReceipt(id, secretKey),
    getCoffeeStoreResult(),
  ]);
  const store = storeResult.kind === "ok" ? storeResult.store : null;
  const loadedAt = formatPickupTime(new Date().toISOString(), store?.timezone);
  const confirmation = resolveOrderConfirmation(id, response);
  const order = confirmation.kind === "found" ? confirmation.order : null;
  const statusCopy = order ? getCustomerOrderStatusCopy(order.status) : null;
  const failureCopy = confirmation.kind === "found" ? null : getOrderConfirmationFailureCopy(confirmation.kind);
  const payment = order ? paymentLine(order) : null;
  const stepIndex = order ? PROGRESS.findIndex((step) => step.statuses.includes(order.status)) : -1;

  return (
    <StorefrontShell>
      <main className="sf-container sf-page">
        <Link href="/" className="sf-back-link">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Menu
        </Link>

        {order ? (
          <div className="sf-split mt-2">
            <section className="sf-ticket min-w-0" aria-labelledby="receipt-title">
              <div className="sf-ticket-section">
                <h1 id="receipt-title" className="sf-display sf-page-title sf-status [overflow-wrap:anywhere]">
                  <span className={`sf-dot !size-3 ${statusDot(order.status)}`} aria-hidden="true" />
                  <span>{statusCopy?.label}</span>
                </h1>
                <p className="sf-muted mt-2">{statusCopy?.message}</p>
                <dl className="mt-4 flex flex-wrap gap-x-8 gap-y-2 text-sm">
                  <div>
                    <dt className="sf-label">Order</dt>
                    <dd className="sf-mono font-semibold">#{order.orderNumber}</dd>
                  </div>
                  <div>
                    <dt className="sf-label">Name</dt>
                    <dd className="font-semibold [overflow-wrap:anywhere]">{order.pickupName || "Guest"}</dd>
                  </div>
                  {statusCopy?.showPickupEstimate ? (
                    <div>
                      <dt className="sf-label">{order.status === "open" ? "Requested pickup" : "Pickup"}</dt>
                      <dd className="font-semibold">{formatPickupTime(order.promisedAt, store?.timezone)}</dd>
                    </div>
                  ) : null}
                </dl>
              </div>

              {stepIndex >= 0 ? (
                <div className="sf-ticket-section !pt-0">
                  <ol className="sf-steps" aria-label="Order progress">
                    {PROGRESS.map((step, index) => (
                      <li
                        key={step.label}
                        className={`sf-step ${index < stepIndex ? "is-done" : ""} ${index === stepIndex ? "is-current is-done" : ""}`}
                        aria-current={index === stepIndex ? "step" : undefined}
                      >
                        <span className="sf-dot" aria-hidden="true" />
                        {step.label}
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}

              <div className="sf-perf" aria-hidden="true" />

              <div className="sf-ticket-section">
                <h2 className="sf-label mb-4">{order.status === "open" ? "Requested items" : "Items"}</h2>
                {order.orderItems?.map((item: CafeOrderItemSnapshot) => (
                  <div key={item.id} className="sf-line">
                    <StorefrontMedia
                      item={{
                        name: item.itemNameSnapshot || "Menu item",
                        imageUrl: item.imagePathSnapshot,
                        primaryImageUrl: item.imagePathSnapshot,
                      }}
                      className="sf-line-media"
                      sizes="64px"
                    />
                    <div className="min-w-0">
                      <div className="sf-line-top">
                        <p className="sf-line-name">
                          <span className="sf-mono">{item.quantity}×</span> {item.itemNameSnapshot}
                        </p>
                        <p className="sf-mono shrink-0 font-semibold">{formatMoney(item.price * item.quantity, order.currencyCode)}</p>
                      </div>
                      {item.modifierSnapshot?.length ? (
                        <ul className="sf-line-mods">
                          {item.modifierSnapshot.map((modifier) => (
                            <li key={`${modifier.id}:${modifier.name}`}>
                              {modifier.name}
                              {modifier.priceAdjustment ? ` · ${formatModifierAdjustment(modifier.priceAdjustment, order.currencyCode)}` : ""}
                            </li>
                          ))}
                        </ul>
                      ) : item.customizationsSummary ? (
                        <p className="sf-line-mods">{item.customizationsSummary}</p>
                      ) : null}
                      {item.specialInstructions ? <p className="sf-line-note">“{item.specialInstructions}”</p> : null}
                    </div>
                  </div>
                ))}
                {order.specialInstructions ? (
                  <div className="mt-4">
                    <h3 className="sf-label mb-1">Order notes</h3>
                    <p className="sf-line-note">“{order.specialInstructions}”</p>
                  </div>
                ) : null}
              </div>

              <div className="sf-perf" aria-hidden="true" />

              <div className="sf-ticket-section">
                <dl className="sf-totals">
                  <div>
                    <dt>Subtotal</dt>
                    <dd className="sf-mono">{formatMoney(order.subtotal, order.currencyCode)}</dd>
                  </div>
                  <div>
                    <dt>Tax</dt>
                    <dd className="sf-mono">{formatMoney(order.tax, order.currencyCode)}</dd>
                  </div>
                  {order.tip ? (
                    <div>
                      <dt>Tip</dt>
                      <dd className="sf-mono">{formatMoney(order.tip, order.currencyCode)}</dd>
                    </div>
                  ) : null}
                  <div className="is-total">
                    <dt>Total</dt>
                    <dd className="sf-mono">{formatMoney(order.total, order.currencyCode)}</dd>
                  </div>
                </dl>
                {payment ? <p className="sf-muted mt-3 text-sm font-semibold">{payment}</p> : null}
                {store?.onlinePayment && !order.paidAt && order.total > 0 && ["open", "accepted", "in_bar_queue", "preparing", "ready"].includes(order.status) ? (
                  <ReceiptPayOnline
                    orderId={order.id}
                    secretKey={secretKey}
                    returned={returnedFromPayment === "done" || returnedFromPayment === "cancelled" ? returnedFromPayment : null}
                  />
                ) : null}
              </div>
            </section>

            <aside className="sf-panel sf-sticky-panel text-center" aria-labelledby="handoff-title">
              <h2 id="handoff-title" className="sf-label">Handoff code</h2>
              <p className="sf-handoff mt-3 [overflow-wrap:anywhere]">{order.handoffCode || "—"}</p>
              <p className="sf-muted mt-3 text-sm">Show this at the counter</p>
              <div className="mt-5 grid justify-items-center gap-2">
                <ReceiptRefreshButton />
                <p className="text-xs text-[var(--sf-ink-faint)]">Status as of {loadedAt}</p>
              </div>
              {order.rewardsLinked || order.rewardsEligible ? (
                <ReceiptRewardsPanel
                  orderId={order.id}
                  secretKey={secretKey}
                  customerEmail={order.customerEmail || ""}
                  linked={Boolean(order.rewardsLinked)}
                />
              ) : null}
            </aside>
          </div>
        ) : failureCopy ? (
          <div className="sf-empty mt-4">
            <h1 className="sf-display text-2xl text-[var(--sf-ink)]">{failureCopy.title}</h1>
            <p className="max-w-md">{failureCopy.message}</p>
            {confirmation.kind === "unavailable" ? (
              <div className="mt-3">
                <ReceiptRefreshButton label="Try again" />
              </div>
            ) : null}
          </div>
        ) : null}
      </main>
    </StorefrontShell>
  );
}
