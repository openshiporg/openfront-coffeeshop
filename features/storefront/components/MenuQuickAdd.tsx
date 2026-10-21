"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Check, Plus } from "lucide-react";
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

  if (mustCustomize) {
    return (
      <Link href={`/menu/${item.id}`} className="sf-menu-action sf-menu-action-customize">
        {item.available ? "Customize" : "View · unavailable"}
      </Link>
    );
  }

  async function add() {
    if (!item.available || pending) return;
    const requestId = ++request.current;
    setPending(true);
    setAdded(false);
    setError(null);
    const modifierIds = defaultModifierIds(item);
    try {
      const result = await quoteCafePickupOrder([{ menuItemId: item.id, quantity: 1, modifierIds }]);
      if (requestId !== request.current) return;
      if (!result.success || !result.quote) {
        setError("This item can’t be added right now.");
        return;
      }
      const reason = addCartLine(buildQuotedCartLine(item, result.quote, modifierIds, crypto.randomUUID()));
      if (reason) setError(reason);
      else setAdded(true);
    } catch {
      if (requestId === request.current) setError("This item can’t be added right now.");
    } finally {
      if (requestId === request.current) setPending(false);
    }
  }

  return (
    <div className="sf-menu-quick-add">
      <button
        type="button"
        className="sf-menu-action"
        onClick={add}
        disabled={!item.available || pending}
        aria-label={`Add ${item.name} to cart`}
      >
        {added ? <Check className="h-4 w-4" aria-hidden="true" /> : <Plus className="h-4 w-4" aria-hidden="true" />}
        {!item.available ? "Unavailable" : pending ? "Checking…" : added ? "Added" : "Quick add"}
      </button>
      {error ? <p className="sf-menu-action-error" role="alert">{error}</p> : null}
    </div>
  );
}
