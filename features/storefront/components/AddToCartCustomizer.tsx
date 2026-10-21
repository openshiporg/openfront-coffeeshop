"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Minus, Plus, ShoppingBag } from "lucide-react";
import { formatMoney, formatModifierAdjustment } from "@/features/storefront/lib/format";
import { addCartLine, CART_LIMITS } from "@/features/storefront/lib/cart/storage";
import { buildQuotedCartLine, defaultModifierIds, modifierGroups, unavailableRequiredModifierGroups } from "@/features/storefront/lib/cart/menuCart";
import type { StorefrontMenuItem } from "@/features/storefront/lib/data/menu";
import { quoteCafePickupOrder } from "@/features/storefront/lib/data/orders";

const UNAVAILABLE_MESSAGE = "This item can’t be added right now. It may be sold out or outside its service hours.";

export function AddToCartCustomizer({ item, compact = false, orderingAvailable = true }: { item: StorefrontMenuItem; compact?: boolean; orderingAvailable?: boolean }) {
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<string[]>(() => defaultModifierIds(item));
  const [notes, setNotes] = useState("");
  const [added, setAdded] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const groups = useMemo(() => modifierGroups(item), [item]);
  const selectedModifierRecords = (item.modifiers || []).filter((modifier) => selectedModifiers.includes(modifier.id));
  const unitPrice = item.price + selectedModifierRecords.reduce((sum, modifier) => sum + Number(modifier.priceAdjustment || 0), 0);
  const unavailableGroups = unavailableRequiredModifierGroups(item);
  const unmetGroups = groups.filter((group) => group.modifiers.filter((modifier) => selectedModifiers.includes(modifier.id)).length < group.minimum);
  const blocked = !orderingAvailable || pending || unmetGroups.length > 0 || unavailableGroups.length > 0;

  function toggleModifier(id: string, maximum: number, groupMembers: string[]) {
    setAdded(false);
    setSelectedModifiers((current) => {
      if (current.includes(id)) return current.filter((modifierId) => modifierId !== id);
      if (maximum === 1) return [...current.filter((modifierId) => !groupMembers.includes(modifierId)), id];
      if (current.filter((modifierId) => groupMembers.includes(modifierId)).length >= maximum) return current;
      return [...current, id];
    });
  }

  async function addToCart() {
    if (blocked) return;
    const requestId = ++request.current;
    setPending(true);
    setAdded(false);
    setError(null);
    try {
      const result = await quoteCafePickupOrder([{ menuItemId: item.id, quantity, modifierIds: selectedModifiers, specialInstructions: notes || undefined }]);
      if (requestId !== request.current) return;
      if (!result.success || !result.quote) {
        setError(UNAVAILABLE_MESSAGE);
        return;
      }
      const line = buildQuotedCartLine(item, result.quote, selectedModifiers, crypto.randomUUID(), quantity);
      line.notes = notes;
      const reason = addCartLine(line);
      if (reason) setError(reason);
      else setAdded(true);
    } catch {
      if (requestId === request.current) setError(UNAVAILABLE_MESSAGE);
    } finally {
      if (requestId === request.current) setPending(false);
    }
  }

  return (
    <div className="sf-sticky-panel">
      {!compact ? (
        <div className="mb-5 border-b border-[var(--sf-rule)] pb-4">
          <p className="sf-kicker">Customize</p>
          <h2 className="sf-display mt-2 text-3xl leading-none [overflow-wrap:anywhere]">{item.name}</h2>
        </div>
      ) : null}

      <div className="sf-panel space-y-5">
        {groups.map((group) => {
          const memberIds = group.modifiers.map((modifier) => modifier.id);
          const single = group.maximum === 1;
          const selectedCount = group.modifiers.filter((modifier) => selectedModifiers.includes(modifier.id)).length;
          const helpId = `modifier-help-${item.id}-${group.key}`;
          return (
            <fieldset key={group.key} className="space-y-3 border-t border-[var(--sf-rule)] pt-4 first:border-t-0 first:pt-0" aria-describedby={helpId}>
              <legend className="flex w-full flex-wrap items-center justify-between gap-3 text-sm font-semibold">
                <span>{group.label}</span>
                <span id={helpId} className="text-xs font-medium text-[var(--sf-ink-faint)]">
                  {group.minimum ? (group.minimum === group.maximum ? `Choose ${group.minimum}` : `Choose ${group.minimum}–${group.maximum}`) : `Optional · up to ${group.maximum}`}
                </span>
              </legend>
              <div className="grid gap-2" role={single ? "radiogroup" : "group"} aria-label={group.label}>
                {group.modifiers.map((modifier) => {
                  const active = selectedModifiers.includes(modifier.id);
                  const atLimit = !single && !active && selectedCount >= group.maximum;
                  const disabled = !modifier.inStock || atLimit;
                  return (
                    <label key={modifier.id} className={`sf-modifier ${active ? "is-active" : ""} ${disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}>
                      <span className="flex min-w-0 items-center gap-3">
                        <input
                          type={single ? "radio" : "checkbox"}
                          name={`modifier-${item.id}-${group.key}`}
                          value={modifier.id}
                          checked={active}
                          disabled={disabled}
                          onChange={() => toggleModifier(modifier.id, group.maximum, memberIds)}
                          onClick={(event) => { if (single && active && group.minimum === 0) { event.preventDefault(); toggleModifier(modifier.id, group.maximum, memberIds); } }}
                          className="h-4 w-4 shrink-0 accent-[var(--sf-accent)]"
                        />
                        <span className="font-medium [overflow-wrap:anywhere]">{modifier.name}</span>
                      </span>
                      <span className="text-xs font-semibold">
                        {!modifier.inStock ? "Sold out" : formatModifierAdjustment(modifier.priceAdjustment)}
                      </span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}

        <label htmlFor={`barista-notes-${item.id}`} className="block space-y-2 text-sm font-medium">
          Barista notes (optional)
          <textarea
            id={`barista-notes-${item.id}`}
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            className="sf-field"
            maxLength={500}
            placeholder="Extra hot, light ice, no sleeve…"
          />
        </label>

        <div className="flex flex-wrap items-center justify-between gap-3 border border-[var(--sf-rule)] bg-[var(--sf-paper-inset)] p-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={quantity <= 1}
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
              className="grid h-11 w-11 place-items-center border border-[var(--sf-rule)] disabled:opacity-50"
            >
              <Minus className="h-4 w-4" aria-hidden="true" />
            </button>
            <span className="w-8 text-center text-lg font-semibold sf-ticket" aria-live="polite" aria-label={`Quantity ${quantity}`}>{quantity}</span>
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={quantity >= CART_LIMITS.maxLineQuantity}
              onClick={() => setQuantity((value) => Math.min(CART_LIMITS.maxLineQuantity, value + 1))}
              className="grid h-11 w-11 place-items-center border border-[var(--sf-rule)] disabled:opacity-50"
            >
              <Plus className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
          <button type="button" onClick={addToCart} disabled={blocked} className="sf-btn sf-btn-primary disabled:cursor-not-allowed disabled:opacity-50">
            <ShoppingBag className="h-4 w-4" aria-hidden="true" />
            {!orderingAvailable ? "Unavailable now" : pending ? "Checking price…" : `Add · ${formatMoney(unitPrice * quantity)}`}
          </button>
        </div>

        <div aria-live="polite" className="space-y-3">
          {!orderingAvailable ? <p className="sf-alert-error">Pickup ordering is closed for the current hours or this item&apos;s service window. You can still review its options.</p> : null}
          {error ? <p className="sf-alert-error" role="alert">{error}</p> : null}
          {unavailableGroups.length > 0 ? <p className="sf-alert-error">Required options in {unavailableGroups.join(", ")} are sold out, so this item can’t be added.</p> : null}
          {unmetGroups.length > 0 && unavailableGroups.length === 0 ? <p className="sf-alert-error">Choose {unmetGroups.map((group) => group.label).join(", ")} before adding this item.</p> : null}
          {added ? (
            <div className="sf-alert-success flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <span>Added to pickup cart.</span>
              <Link href="/checkout" className="font-semibold underline underline-offset-4">
                Go to checkout
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
