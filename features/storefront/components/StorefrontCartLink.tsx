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

/** Phone and tablet: the last thing added, the running total and the way to checkout, docked above the tab bar. */
export function StorefrontCartBar() {
  const { lines } = useCartLines();
  const count = cartQuantity(lines);
  if (!count) return null;
  const last = lines[lines.length - 1];

  return (
    <div className="sf-cartbar" role="region" aria-label="Your order">
      <StorefrontMedia item={{ name: last.name, imageUrl: last.imageUrl, primaryImageUrl: last.imageUrl }} className="sf-cartbar-media" sizes="48px" />
      <span className="sf-cartbar-text">
        <strong>{last.name}</strong>
        {last.modifierNames.length ? <span>{last.modifierNames.join(", ")}</span> : null}
      </span>
      <span className="sf-cartbar-count" aria-label={itemsLabel(count)}>{count}</span>
      <span className="sf-cartbar-total">{formatMoney(cartSubtotal(lines))}</span>
      <Link href="/checkout" className="sf-cartbar-cta" aria-label={`Review order, ${itemsLabel(count)}`}>Review Order</Link>
    </div>
  );
}
