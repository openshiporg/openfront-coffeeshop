"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { CART_EVENT, loadCartLines } from "@/features/storefront/lib/cart/storage";

function getCartCount() {
  return loadCartLines().reduce((sum, line) => sum + line.quantity, 0);
}

function useCartCount() {
  const [count, setCount] = React.useState(0);

  React.useEffect(() => {
    const sync = () => setCount(getCartCount());
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener(CART_EVENT, sync as EventListener);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(CART_EVENT, sync as EventListener);
    };
  }, []);

  return count;
}

function itemsLabel(count: number) {
  return `${count} ${count === 1 ? "item" : "items"}`;
}

export function StorefrontCartLink() {
  const count = useCartCount();

  return (
    <Link href="/checkout" className="sf-cart-link" aria-label={`Cart, ${itemsLabel(count)}`}>
      <ShoppingBag className="size-4" aria-hidden="true" />
      <span className="hidden sm:inline" aria-hidden="true">Cart</span>
      <span className="sf-cart-badge" aria-hidden="true">{count}</span>
    </Link>
  );
}

/** Bottom bar that appears once the cart has something in it. */
export function StorefrontCartBar() {
  const count = useCartCount();
  if (!count) return null;

  return (
    <Link href="/checkout" className="sf-cartbar" aria-label={`Review order, ${itemsLabel(count)}`}>
      <span className="inline-flex items-center gap-2.5" aria-hidden="true">
        <ShoppingBag className="size-4" />
        {itemsLabel(count)}
      </span>
      <span className="sf-cartbar-cta" aria-hidden="true">
        Review order
        <ArrowRight className="size-4" />
      </span>
    </Link>
  );
}
