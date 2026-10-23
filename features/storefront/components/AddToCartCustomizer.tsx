"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Minus, Plus } from "lucide-react";
import { formatMoney, formatModifierAdjustment } from "@/features/storefront/lib/format";
import { addCartLine, CART_LIMITS } from "@/features/storefront/lib/cart/storage";
import { buildQuotedCartLine, defaultModifierIds, modifierGroups, unavailableRequiredModifierGroups } from "@/features/storefront/lib/cart/menuCart";
import type { StorefrontMenuItem } from "@/features/storefront/lib/data/menu";
import { quoteCafePickupOrder } from "@/features/storefront/lib/data/orders";

const UNAVAILABLE_MESSAGE = "This item can’t be added right now. It may be sold out or outside its service hours.";
// Single-choice groups this small read best as a segmented control (size, milk temperature).
const SEGMENT_MAX_OPTIONS = 4;

export function AddToCartCustomizer({ item, compact = false, orderingAvailable = true, notes: allowNotes = true }: { item: StorefrontMenuItem; compact?: boolean; orderingAvailable?: boolean; notes?: boolean }) {
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
  const orderable = orderingAvailable && unavailableGroups.length === 0;
  const unavailableLabel = item.availability === "sold_out" || unavailableGroups.length > 0 ? "Sold out" : "Unavailable";
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
        setError((!result.success && result.customerMessage) || UNAVAILABLE_MESSAGE);
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
      <div className="sf-panel">
        {!compact ? <h2 className="sf-display mb-5 text-xl">{orderable ? "Make it yours" : unavailableLabel}</h2> : null}

        {groups.map((group) => {
          const memberIds = group.modifiers.map((modifier) => modifier.id);
          const single = group.maximum === 1;
          const selectedCount = group.modifiers.filter((modifier) => selectedModifiers.includes(modifier.id)).length;
          const unmet = selectedCount < group.minimum;
          const helpId = `modifier-help-${item.id}-${group.key}`;
          const segmented = single && group.minimum > 0 && group.modifiers.length <= SEGMENT_MAX_OPTIONS;
          const rule = group.minimum
            ? group.minimum === group.maximum ? (group.minimum === 1 ? "Required" : `Choose ${group.minimum}`) : `Choose ${group.minimum}–${group.maximum}`
            : group.maximum === 1 ? "Optional" : `Optional · up to ${group.maximum}`;

          const options = group.modifiers.map((modifier) => {
            const active = selectedModifiers.includes(modifier.id);
            const atLimit = !single && !active && selectedCount >= group.maximum;
            const disabled = !modifier.inStock || atLimit;
            const price = !modifier.inStock ? "Sold out" : modifier.priceAdjustment ? formatModifierAdjustment(modifier.priceAdjustment) : null;
            const input = (
              <input
                type={single ? "radio" : "checkbox"}
                name={`modifier-${item.id}-${group.key}`}
                value={modifier.id}
                checked={active}
                disabled={disabled}
                onChange={() => toggleModifier(modifier.id, group.maximum, memberIds)}
                onClick={(event) => { if (single && active && group.minimum === 0) { event.preventDefault(); toggleModifier(modifier.id, group.maximum, memberIds); } }}
                className={segmented ? "sr-only" : undefined}
              />
            );
            return segmented ? (
              <label key={modifier.id} className="sf-track-item">
                {input}
                <span className="[overflow-wrap:anywhere]">{modifier.name}</span>
                {price ? <small>{price}</small> : null}
              </label>
            ) : (
              <label key={modifier.id} className="sf-option">
                <span className="flex min-w-0 items-center gap-3">
                  {input}
                  <span className="font-medium [overflow-wrap:anywhere]">{modifier.name}</span>
                </span>
                {price ? <span className="sf-option-price">{price}</span> : null}
              </label>
            );
          });

          return (
            <fieldset key={group.key} className="sf-group" aria-describedby={helpId}>
              <legend>
                <span>{group.label}</span>
                <span id={helpId} className={`sf-group-rule ${unmet ? "is-unmet" : ""}`}>{rule}</span>
              </legend>
              {segmented ? (
                <div className="sf-track sf-track-fill sf-segment w-full" role="radiogroup" aria-label={group.label}>{options}</div>
              ) : (
                <div className="sf-options" role={single ? "radiogroup" : "group"} aria-label={group.label}>{options}</div>
              )}
            </fieldset>
          );
        })}

        {allowNotes ? (
          <div className="sf-group">
            <label htmlFor={`barista-notes-${item.id}`} className="sf-form-label">
              Notes for the barista
              <textarea
                id={`barista-notes-${item.id}`}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="sf-field !min-h-[4.5rem]"
                maxLength={500}
                placeholder="Optional"
              />
            </label>
          </div>
        ) : null}

        <div aria-live="polite" className="grid gap-3 [&:not(:empty)]:mt-1">
          {!orderingAvailable ? <p className="sf-alert-error">{item.availability === "sold_out" ? "Sold out right now." : "Not available to order right now."}</p> : null}
          {error ? <p className="sf-alert-error" role="alert">{error}</p> : null}
          {unavailableGroups.length > 0 ? <p className="sf-alert-error">{unavailableGroups.join(", ")} sold out. This item can’t be added.</p> : null}
          {unmetGroups.length > 0 && unavailableGroups.length === 0 ? <p className="sf-alert-error">Choose {unmetGroups.map((group) => group.label).join(", ")}.</p> : null}
          {added ? (
            <div className="sf-alert-success flex flex-wrap items-center justify-between gap-2" role="status">
              <span>Added to cart</span>
              <Link href="/checkout" className="inline-flex min-h-11 items-center gap-1 font-semibold underline underline-offset-4">
                Checkout
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          ) : null}
        </div>

        <div className="sf-addbar mt-0 lg:mt-5">
          {orderable ? <div className="sf-stepper">
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={quantity <= 1}
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            >
              <Minus className="size-4" aria-hidden="true" />
            </button>
            <span aria-live="polite" aria-label={`Quantity ${quantity}`}>{quantity}</span>
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={quantity >= CART_LIMITS.maxLineQuantity}
              onClick={() => setQuantity((value) => Math.min(CART_LIMITS.maxLineQuantity, value + 1))}
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
          </div> : null}
          <button type="button" onClick={addToCart} disabled={blocked} className="sf-btn sf-btn-primary sf-btn-lg">
            {!orderable ? unavailableLabel : pending ? "Adding…" : (
              <>
                <span>Add to cart</span>
                <span className="sf-mono opacity-80">{formatMoney(unitPrice * quantity)}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
