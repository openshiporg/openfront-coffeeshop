"use client";

import * as React from "react";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
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
    <Link href="/checkout" className="sf-cart-link" aria-label={count > 0 ? `Cart, ${itemsLabel(count)}` : "Cart, empty"}>
      <ShoppingBag className="size-4" aria-hidden="true" />
      <span className="sf-cart-word" aria-hidden="true">Cart</span>
      {count > 0 ? <span className="sf-cart-badge" aria-hidden="true">{count}</span> : null}
    </Link>
  );
}

/** The sleeve: a kraft bar docked at the bottom once the cart has something in it. */
export function StorefrontCartBar() {
  const count = useCartCount();
  if (!count) return null;

  return (
    <Link href="/checkout" className="sf-cartbar" aria-label={`Review order, ${itemsLabel(count)}`}>
      <span className="sf-cartbar-count" aria-hidden="true">
        <span className="sf-marker">{count}</span>
        {count === 1 ? "item in your order" : "items in your order"}
      </span>
      <span className="sf-cartbar-cta" aria-hidden="true">Review order</span>
    </Link>
  );
}
