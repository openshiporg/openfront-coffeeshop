"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, CircleCheck, Minus, Plus } from "lucide-react";
import { CART_LIMITS, cartQuantity, clearCartLines, saveCartLines } from "@/features/storefront/lib/cart/storage";
import { formatMoney } from "@/features/storefront/lib/format";
import { earliestPickup } from "@/features/storefront/lib/hours";
import { usePickupChoice } from "@/features/storefront/lib/cart/pickup";
import { cartSubtotal, useCartLines } from "./StorefrontCartLink";
import { StorefrontMedia } from "./StorefrontMedia";

type Hours = { weeklyHours: unknown; timezone: string; pickupLeadTimeMinutes: number | null };


function clockIn(at: Date, timeZone: string) {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(at);
  } catch {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(at);
  }
}

/** Desktop order rail: pickup time, the bag, and checkout. The cart is the same browser cart checkout reads. */
export function OrderPanel({ hours }: { hours: Hours }) {
  const { lines, loaded } = useCartLines();
  const [readyAt, setReadyAt] = React.useState<string | null>(null);
  const count = cartQuantity(lines);
  const [choice] = usePickupChoice();

  const prepKey = lines.map((line) => line.prepTimeMinutes ?? "").join(",");

  React.useEffect(() => {
    const prepTimes = prepKey ? prepKey.split(",").map((value) => (value ? Number(value) : null)) : [];
    const update = () => {
      const now = new Date();
      // The time scheduled ahead on the menu's pickup bar, while it is still later than the earliest pickup.
      const earliest = earliestPickup(hours, now, prepTimes);
      const at = choice != null && earliest && choice > earliest.getTime() ? new Date(choice) : earliest;
      setReadyAt(at ? clockIn(at, hours.timezone) : null);
    };
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [hours, prepKey, choice]);

  function setQuantity(cartId: string, quantity: number) {
    const next = lines.map((line) => (line.cartId === cartId ? { ...line, quantity } : line)).filter((line) => line.quantity > 0);
    if (cartQuantity(next) > CART_LIMITS.maxTotalQuantity) return;
    saveCartLines(next);
  }

  return (
    <aside className="sf-rail" aria-labelledby="order-rail-title">
      <div className="sf-rail-head">
        <h2 id="order-rail-title" className="sf-script sf-rail-title">Order</h2>
        <div className="sf-rail-pickup">
          <span>Pickup</span>
          <span className="sf-rail-time" aria-live="polite">
            {readyAt ?? "—"}
            <CircleCheck className="size-5" aria-hidden="true" />
          </span>
        </div>
        {hours.pickupLeadTimeMinutes ? (
          <span className="sf-pill sf-pill-soft">
            {hours.pickupLeadTimeMinutes} minutes
            <ChevronDown className="size-4" aria-hidden="true" />
          </span>
        ) : null}
      </div>

      <div className="sf-rail-body">
        {loaded && !count ? (
          <div className="sf-rail-empty">
            <p className="sf-script">Nothing In Here Yet</p>
            <span>Tap add when you find something you love</span>
          </div>
        ) : (
          <ul className="sf-rail-lines">
            {lines.map((line) => (
              <li key={line.cartId} className="sf-rail-line">
                <StorefrontMedia item={{ name: line.name, imageUrl: line.imageUrl, primaryImageUrl: line.imageUrl }} className="sf-rail-line-media" sizes="56px" />
                <div className="min-w-0">
                  <p className="sf-rail-line-name">{line.name}</p>
                  {line.modifierNames.length ? <p className="sf-rail-line-mods">{line.modifierNames.join(", ")}</p> : null}
                  <div className="sf-rail-line-foot">
                    <div className="sf-stepper sf-stepper-sm">
                      <button type="button" aria-label={line.quantity === 1 ? `Remove ${line.name}` : `Decrease ${line.name}`} onClick={() => setQuantity(line.cartId, line.quantity - 1)}>
                        <Minus className="size-3.5" aria-hidden="true" />
                      </button>
                      <span aria-label={`Quantity ${line.quantity}`}>{line.quantity}</span>
                      <button type="button" aria-label={`Increase ${line.name}`} disabled={line.quantity >= CART_LIMITS.maxLineQuantity || count >= CART_LIMITS.maxTotalQuantity} onClick={() => setQuantity(line.cartId, line.quantity + 1)}>
                        <Plus className="size-3.5" aria-hidden="true" />
                      </button>
                    </div>
                    <span className="sf-price">{formatMoney(line.unitPrice * line.quantity)}</span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="sf-rail-foot">
        <div className="sf-rail-actions">
          <button type="button" className="sf-rail-clear" disabled={!count} onClick={() => clearCartLines()}>Clear Bag</button>
          <span className="sf-pill sf-pill-outline">Pickup</span>
        </div>
        <Link href="/checkout" className={`sf-rail-checkout ${count ? "" : "is-empty"}`} aria-disabled={!count || undefined}>
          <span>Checkout</span>
          <span className="sf-rail-checkout-total">{formatMoney(cartSubtotal(lines))}</span>
        </Link>
      </div>
    </aside>
  );
}
