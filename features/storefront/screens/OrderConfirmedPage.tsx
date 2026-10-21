import Link from "next/link";
import { formatModifierAdjustment, formatMoney, formatPickupTime } from "@/features/storefront/lib/format";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { StorefrontShell } from "@/features/storefront/components/StorefrontShell";
import { StorefrontMedia } from "@/features/storefront/components/StorefrontMedia";
import { getCoffeeStoreResult } from "@/features/storefront/lib/data/store";
import { ReceiptRefreshButton } from "@/features/storefront/components/ReceiptRefreshButton";
import type { CafeOrderItemSnapshot, CafePickupOrder } from "@/features/storefront/lib/data/orders";
import { getCustomerOrderStatusCopy, getOrderConfirmationFailureCopy, resolveOrderConfirmation } from "@/features/storefront/lib/orderConfirmation";

const ORDER_QUERY = `
  query ConfirmedCafeOrder($id: ID!, $secretKey: String) {
    getCafeOrder(orderId: $id, secretKey: $secretKey) {
      id orderNumber status handoffCode pickupName promisedAt subtotal tax tip total currencyCode
      orderItems {
        id quantity itemNameSnapshot imagePathSnapshot customizationsSummary specialInstructions price
        modifierSnapshot { id name group groupLabel priceAdjustment }
      }
    }
  }
`;

export async function OrderConfirmedPage({ id, secretKey }: { id?: string; secretKey?: string }) {
  // The receipt is authorized on its own; current public store settings are optional context, never a gate.
  const [response, storeResult] = await Promise.all([
    id
      ? keystoneClient<{ getCafeOrder: CafePickupOrder | null }>(ORDER_QUERY, { id, secretKey }, { cache: "no-store" })
      : Promise.resolve(null),
    getCoffeeStoreResult(),
  ]);
  const store = storeResult.kind === "ok" ? storeResult.store : null;
  const loadedAt = formatPickupTime(new Date().toISOString(), store?.timezone);
  const confirmation = resolveOrderConfirmation(id, response);
  const order = confirmation.kind === "found" ? confirmation.order : null;
  const statusCopy = order ? getCustomerOrderStatusCopy(order.status) : null;
  const failureCopy = confirmation.kind === "found" ? null : getOrderConfirmationFailureCopy(confirmation.kind);

  return (
    <StorefrontShell>
      <main className="sf-container py-8 sm:py-10">
        {order ? (
          <section className="space-y-10">
            <div className="border-b border-[var(--sf-rule)] pb-8">
              <p className="sf-kicker">{statusCopy?.label}</p>
              <div className="mt-4 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <div>
                  <h1 className="sf-display text-[var(--sf-text-display)] leading-[0.9] [overflow-wrap:anywhere]">#{order.orderNumber}</h1>
                  <p className="mt-4 max-w-xl text-[var(--sf-ink-muted)] leading-relaxed">
                    For {order.pickupName || "Guest"} · {statusCopy?.message}
                  </p>
                  {statusCopy?.showPickupEstimate ? (
                    <p className="mt-2 text-sm text-[var(--sf-ink-muted)]">
                      {order.status === "open" ? "Requested pickup time" : "Pickup time"}: {formatPickupTime(order.promisedAt, store?.timezone)}
                    </p>
                  ) : null}
                  <p className="mt-2 text-xs text-[var(--sf-ink-muted)]">
                    Status as of {loadedAt}. Email or text notification delivery is not confirmed here.
                  </p>
                  <div className="mt-4">
                    <ReceiptRefreshButton />
                  </div>
                </div>
                <div>
                  <p className="sf-kicker">Handoff code</p>
                  <p className="sf-handoff sf-ticket mt-2">{order.handoffCode || "—"}</p>
                </div>
              </div>
            </div>

            <div className="sf-split">
              <div>
                <h2 className="sf-display text-[var(--sf-text-display-s)]">{order.status === "open" ? "Requested items" : "Order items"}</h2>
                <div className="mt-4 divide-y divide-[var(--sf-rule)] border-t border-[var(--sf-rule)]">
                  {order.orderItems?.map((item: CafeOrderItemSnapshot) => (
                    <div key={item.id} className="flex justify-between gap-4 py-4">
                      <div className="flex min-w-0 gap-4">
                        <StorefrontMedia
                          item={{
                            name: item.itemNameSnapshot || "Menu item",
                            imageUrl: item.imagePathSnapshot,
                            primaryImageUrl: item.imagePathSnapshot,
                          }}
                          className="h-16 w-16 shrink-0 border border-[var(--sf-rule)]"
                        />
                        <div className="min-w-0">
                          <p className="font-semibold">
                            {item.quantity}× {item.itemNameSnapshot}
                          </p>
                          {item.modifierSnapshot?.length ? (
                            <ul className="mt-1 space-y-0.5 text-sm text-[var(--sf-ink-muted)]">
                              {item.modifierSnapshot.map((modifier) => (
                                <li key={`${modifier.id}:${modifier.name}`}>
                                  {modifier.name}
                                  {modifier.priceAdjustment ? ` · ${formatModifierAdjustment(modifier.priceAdjustment, order.currencyCode)}` : ""}
                                </li>
                              ))}
                            </ul>
                          ) : item.customizationsSummary ? (
                            <p className="mt-1 text-sm text-[var(--sf-ink-muted)]">{item.customizationsSummary}</p>
                          ) : null}
                          {item.specialInstructions ? (
                            <p className="mt-2 text-sm italic text-[var(--sf-ink-muted)]">Note: {item.specialInstructions}</p>
                          ) : null}
                        </div>
                      </div>
                      <p className="sf-ticket font-semibold">{formatMoney(item.price * item.quantity, order.currencyCode)}</p>
                    </div>
                  ))}
                </div>
              </div>

              <aside className="sf-panel sf-sticky-panel">
                <p className="sf-kicker">Order reference</p>
                <p className="mt-3 text-sm leading-relaxed text-[var(--sf-ink-muted)]">
                  This handoff code is associated with this order.
                </p>

                <hr className="sf-rule my-5" />

                <p className="sf-kicker">Totals</p>
                <div className="mt-4 space-y-2 text-sm text-[var(--sf-ink-muted)] sf-ticket">
                  <div className="flex justify-between">
                    <span>Subtotal</span>
                    <span>{formatMoney(order.subtotal, order.currencyCode)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tax</span>
                    <span>{formatMoney(order.tax, order.currencyCode)}</span>
                  </div>
                  {order.tip ? (
                    <div className="flex justify-between">
                      <span>Tip</span>
                      <span>{formatMoney(order.tip, order.currencyCode)}</span>
                    </div>
                  ) : null}
                  <div className="flex justify-between pt-2 text-lg font-semibold text-[var(--sf-ink)]">
                    <span>Total</span>
                    <span>{formatMoney(order.total, order.currencyCode)}</span>
                  </div>
                </div>
              </aside>
            </div>
          </section>
        ) : failureCopy ? (
          <div className="sf-panel text-center">
            <h1 className="sf-display text-[var(--sf-text-display-s)]">{failureCopy.title}</h1>
            <p className="mt-3 text-sm text-[var(--sf-ink-muted)]">{failureCopy.message}</p>
            {confirmation.kind === "unavailable" ? (
              <div className="mt-5 flex justify-center">
                <ReceiptRefreshButton label="Try again" />
              </div>
            ) : null}
          </div>
        ) : null}

        <Link href="/" className="sf-back-link mt-8 inline-flex">
          ← Back to menu
        </Link>
      </main>
    </StorefrontShell>
  );
}
