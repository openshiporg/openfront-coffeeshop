"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Check, Plus, SlidersHorizontal } from "lucide-react";
import type { StorefrontMenuItem } from "@/features/storefront/lib/data/menu";
import { quoteCafePickupOrder } from "@/features/storefront/lib/data/orders";
import { buildQuotedCartLine, defaultModifierIds, requiresCustomization } from "@/features/storefront/lib/cart/menuCart";
import { addCartLine } from "@/features/storefront/lib/cart/storage";

export function MenuQuickAdd({ item }: { item: StorefrontMenuItem }) {
  const [pending, setPending] = useState(false);
  const [added, setAdded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const mustCustomize = requiresCustomization(item);

  if (!item.available) {
    return (
      <div className="sf-quick">
        <span className="sf-quick-btn !cursor-default !bg-[var(--sf-inset)] !text-[var(--sf-ink-muted)] !shadow-none">Unavailable</span>
      </div>
    );
  }

  if (mustCustomize) {
    return (
      <div className="sf-quick">
        <Link href={`/menu/${item.id}`} className="sf-quick-btn" aria-label={`Choose options for ${item.name}`}>
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          <span className="sr-only sm:not-sr-only">Options</span>
        </Link>
      </div>
    );
  }

  async function add() {
    if (pending) return;
    const requestId = ++request.current;
    setPending(true);
    setAdded(false);
    setError(null);
    const modifierIds = defaultModifierIds(item);
    try {
      const result = await quoteCafePickupOrder([{ menuItemId: item.id, quantity: 1, modifierIds }]);
      if (requestId !== request.current) return;
      if (!result.success || !result.quote) {
        setError("Can’t add this right now.");
        return;
      }
      const reason = addCartLine(buildQuotedCartLine(item, result.quote, modifierIds, crypto.randomUUID()));
      if (reason) setError(reason);
      else setAdded(true);
    } catch {
      if (requestId === request.current) setError("Can’t add this right now.");
    } finally {
      if (requestId === request.current) setPending(false);
    }
  }

  return (
    <div className="sf-quick">
      <button
        type="button"
        className={`sf-quick-btn ${added ? "is-added" : ""}`}
        onClick={add}
        disabled={pending}
        aria-label={added ? `${item.name} added to cart` : `Add ${item.name} to cart`}
      >
        {added ? <Check className="size-4" aria-hidden="true" /> : <Plus className={`size-4 ${pending ? "animate-pulse" : ""}`} aria-hidden="true" />}
        <span className="sr-only" aria-live="polite">{pending ? "Adding" : added ? "Added" : ""}</span>
      </button>
      {error ? <p className="sf-quick-error" role="alert">{error}</p> : null}
    </div>
  );
}
