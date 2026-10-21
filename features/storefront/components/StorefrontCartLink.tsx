"use client";

import * as React from "react";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { CART_EVENT, loadCartLines } from "@/features/storefront/lib/cart/storage";

function getCartCount() {
  return loadCartLines().reduce((sum, line) => sum + line.quantity, 0);
}

export function StorefrontCartLink() {
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

  return (
    <Link href="/checkout" className="sf-cart-link" aria-label={`Cart, ${count} ${count === 1 ? "item" : "items"}`}>
      <ShoppingBag className="h-4 w-4" aria-hidden="true" />
      <span className="hidden sm:inline" aria-hidden="true">Cart</span>
      <span className="sf-cart-badge" aria-hidden="true">{count}</span>
    </Link>
  );
}
