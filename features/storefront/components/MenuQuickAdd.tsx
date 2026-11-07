"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Check, Plus } from "lucide-react";
import type { StorefrontMenuItem } from "@/features/storefront/lib/data/menu";
import { quoteCafePickupOrder } from "@/features/storefront/lib/data/orders";
import {
  buildQuotedCartLine,
  defaultModifierIds,
  rowModifierLayout,
  selectionUnitPrice,
  toggleModifierSelection,
  unavailableRequiredModifierGroups,
  unmetModifierGroups,
} from "@/features/storefront/lib/cart/menuCart";
import { addCartLine } from "@/features/storefront/lib/cart/storage";
import { formatModifierAdjustment } from "@/features/storefront/lib/format";

export type MenuRowSelection = ReturnType<typeof useMenuRowSelection>;

/** The options picked on one menu row, priced live and checked by the same rules as the item page. */
export function useMenuRowSelection(item: StorefrontMenuItem) {
  const defaults = useMemo(() => defaultModifierIds(item), [item]);
  const layout = useMemo(() => rowModifierLayout(item), [item]);
  const [selected, setSelected] = useState<string[]>(defaults);
  const toggle = useCallback((id: string, groupKey: string) => {
    const group = layout.inline.find((candidate) => candidate.key === groupKey);
    if (group) setSelected((current) => toggleModifierSelection(current, id, group));
  }, [layout]);
  const reset = useCallback(() => setSelected(defaults), [defaults]);
  return {
    selected,
    layout,
    toggle,
    reset,
    unitPrice: selectionUnitPrice(item, selected),
    unmet: unmetModifierGroups(item, selected),
  };
}

/** The row's options as real choices: a size or milk is one-of (tap to switch), an add-on toggles. */
export function MenuRowOptions({ item, selection }: { item: StorefrontMenuItem; selection: MenuRowSelection }) {
  const { layout, selected, toggle } = selection;
  if (!item.available || (!layout.inline.length && !layout.more)) return <span />;
  return (
    <div className="sf-opts" aria-label={`${item.name} options`} role="group">
      {layout.inline.map((group) => {
        const single = group.maximum === 1 && group.modifiers.length > 1;
        const count = group.modifiers.filter((modifier) => selected.includes(modifier.id)).length;
        return (
          <div key={group.key} className="sf-opt-group" role={single ? "radiogroup" : "group"} aria-label={group.label}>
            {group.modifiers.map((modifier) => {
              const active = selected.includes(modifier.id);
              const atLimit = !active && group.maximum > 1 && count >= group.maximum;
              const price = modifier.priceAdjustment ? ` ${formatModifierAdjustment(modifier.priceAdjustment)}` : "";
              const addOn = !single && group.minimum === 0;
              return (
                <button
                  key={modifier.id}
                  type="button"
                  className={`sf-opt ${active ? "is-on" : ""} ${addOn ? "is-addon" : ""}`}
                  role={single ? "radio" : undefined}
                  aria-checked={single ? active : undefined}
                  aria-pressed={single ? undefined : active}
                  disabled={atLimit}
                  onClick={() => toggle(modifier.id, group.key)}
                >
                  <span className="sf-opt-pill">
                    {addOn ? (active ? <Check className="sf-opt-mark" aria-hidden="true" /> : <Plus className="sf-opt-mark" aria-hidden="true" />) : null}
                    {modifier.name}
                    {price ? <span className="sf-opt-price">{price}</span> : null}
                  </span>
                </button>
              );
            })}
          </div>
        );
      })}
      {layout.more ? <Link href={`/menu/${item.id}`} className="sf-opt-more">More options</Link> : null}
    </div>
  );
}

/** + adds the row's chosen options (priced by the server first); an unmet required choice opens the item instead. */
export function MenuQuickAdd({ item, selection }: { item: StorefrontMenuItem; selection: MenuRowSelection }) {
  const [pending, setPending] = useState(false);
  const [added, setAdded] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);

  if (!item.available || unavailableRequiredModifierGroups(item).length) {
    return (
      <div className="sf-quick">
        <span className="sf-quick-off">{item.availability === "sold_out" || item.available ? "Sold out" : "Unavailable"}</span>
      </div>
    );
  }

  if (selection.unmet.length) {
    return (
      <div className="sf-quick">
        <Link href={`/menu/${item.id}`} className="sf-quick-btn" aria-label={`Choose ${selection.unmet.map((group) => group.label).join(", ")} for ${item.name}`}>
          <Plus className="size-5" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  async function add() {
    if (pending) return;
    const requestId = ++request.current;
    const modifierIds = [...selection.selected];
    setPending(true);
    setAdded(null);
    setError(null);
    try {
      const result = await quoteCafePickupOrder([{ menuItemId: item.id, quantity: 1, modifierIds }]);
      if (requestId !== request.current) return;
      if (!result.success || !result.quote) {
        setError((!result.success && result.customerMessage) || "Can’t add this right now.");
        return;
      }
      const line = buildQuotedCartLine(item, result.quote, modifierIds, crypto.randomUUID());
      const reason = addCartLine(line);
      if (reason) setError(reason);
      else {
        setAdded(line.modifierNames.length ? `Added · ${line.modifierNames.join(", ")}` : "Added to your order");
        selection.reset();
        window.setTimeout(() => { if (requestId === request.current) setAdded(null); }, 2200);
      }
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
        aria-label={`Add ${item.name} to your order`}
      >
        {added ? <Check className="size-5" aria-hidden="true" /> : <Plus className={`size-5 ${pending ? "animate-pulse" : ""}`} aria-hidden="true" />}
      </button>
      <span className="sr-only" aria-live="polite">{pending ? "Adding" : added || ""}</span>
      {added ? <p className="sf-quick-note" aria-hidden="true">{added}</p> : null}
      {error ? <p className="sf-quick-error" role="alert">{error}</p> : null}
    </div>
  );
}
