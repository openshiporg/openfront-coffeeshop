"use client";

import * as React from "react";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { CART_EVENT, cartQuantity, loadCartLines } from "@/features/storefront/lib/cart/storage";
import type { CartLine } from "@/features/storefront/lib/cart/types";
import { formatMoney } from "@/features/storefront/lib/format";
import { StorefrontMedia } from "./StorefrontMedia";

/** The cart as saved in this browser, kept in step with other tabs and components. */
export function useCartLines() {
  const [lines, setLines] = React.useState<CartLine[]>([]);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    const sync = () => setLines(loadCartLines());
    sync();
    setLoaded(true);
    window.addEventListener("storage", sync);
    window.addEventListener(CART_EVENT, sync as EventListener);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(CART_EVENT, sync as EventListener);
    };
  }, []);

  return { lines, loaded };
}

export function cartSubtotal(lines: CartLine[]) {
  return lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
}

function itemsLabel(count: number) {
  return `${count} ${count === 1 ? "item" : "items"}`;
}

export function StorefrontCartLink() {
  const { lines } = useCartLines();
  const count = cartQuantity(lines);

  return (
    <Link href="/checkout" className="sf-cart-link" aria-label={count > 0 ? `Bag, ${itemsLabel(count)}` : "Bag, empty"}>
      <ShoppingBag className="size-5" aria-hidden="true" />
      {count > 0 ? <span className="sf-cart-badge" aria-hidden="true">{count}</span> : null}
    </Link>
  );
}

/**
 * Phone and tablet: one docked unit at the bottom of the screen. The order row (last thing added, item count,
 * total, Review Order) sits directly above the tab bar on the same surface; it opens and closes with the cart.
 */
export function StorefrontDock({ cart = true, children }: { cart?: boolean; children?: React.ReactNode }) {
  const { lines } = useCartLines();
  const count = cart ? cartQuantity(lines) : 0;
  // Keep the last non-empty cart on screen while the row slides closed.
  const [shown, setShown] = React.useState<CartLine[]>([]);
  if (count && shown !== lines) setShown(lines);
  const display = count ? lines : shown;
  const displayCount = cartQuantity(display);
  const last = display[display.length - 1];
  const open = count > 0;

  return (
    <div className={`sf-dock ${open ? "has-cart" : ""}`}>
      <div className="sf-dock-cart" role="region" aria-label="Your order" aria-hidden={open ? undefined : true} inert={open ? undefined : true}>
        <div className="sf-dock-cart-inner">
          {last ? (
            <div className="sf-cartbar">
              <StorefrontMedia item={{ name: last.name, imageUrl: last.imageUrl, primaryImageUrl: last.imageUrl }} className="sf-cartbar-media" sizes="48px" />
              <span className="sf-cartbar-text">
                <strong>{last.name}</strong>
                <span>{last.modifierNames.length ? last.modifierNames.join(", ") : itemsLabel(displayCount)}</span>
              </span>
              <span className="sf-cartbar-sum">
                <span className="sf-cartbar-count">{itemsLabel(displayCount)}</span>
                <span className="sf-cartbar-total">{formatMoney(cartSubtotal(display))}</span>
              </span>
              <Link href="/checkout" className="sf-cartbar-cta" aria-label={`Review order, ${itemsLabel(displayCount)}, ${formatMoney(cartSubtotal(display))}`}>Review Order</Link>
            </div>
          ) : null}
        </div>
      </div>
      {children}
    </div>
  );
}
