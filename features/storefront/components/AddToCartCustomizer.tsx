"use client";

import { useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Minus, Plus } from "lucide-react";
import { MarkerTick } from "./MarkerTick";
import { formatMoney, formatModifierAdjustment } from "@/features/storefront/lib/format";
import { addCartLine, CART_LIMITS } from "@/features/storefront/lib/cart/storage";
import { buildQuotedCartLine, defaultModifierIds, modifierGroups, unavailableRequiredModifierGroups } from "@/features/storefront/lib/cart/menuCart";
import type { StorefrontMenuItem } from "@/features/storefront/lib/data/menu";
import { quoteCafePickupOrder } from "@/features/storefront/lib/data/orders";

const UNAVAILABLE_MESSAGE = "This item can’t be added right now. It may be sold out or outside its service hours.";

export function AddToCartCustomizer({ item, orderingAvailable = true, notes: allowNotes = true }: { item: StorefrontMenuItem; compact?: boolean; orderingAvailable?: boolean; notes?: boolean }) {
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<string[]>(() => defaultModifierIds(item));
  const [notes, setNotes] = useState("");
  const [added, setAdded] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const request = useRef(0);
  const groups = useMemo(() => modifierGroups(item), [item]);
  const defaults = useMemo(() => defaultModifierIds(item), [item]);
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
      <div className="sf-cup-sheet">
        {groups.map((group) => {
          const memberIds = group.modifiers.map((modifier) => modifier.id);
          const single = group.maximum === 1;
          const chosen = group.modifiers.filter((modifier) => selectedModifiers.includes(modifier.id));
          const selectedCount = chosen.length;
          const unmet = selectedCount < group.minimum;
          const helpId = `modifier-help-${item.id}-${group.key}`;
          const groupDefaults = memberIds.filter((id) => defaults.includes(id));
          // The jackfield rule: the standard choice reads plainly; a change from it is marked as changed.
          const changed = chosen.length !== groupDefaults.length || chosen.some((modifier) => !groupDefaults.includes(modifier.id));
          const rule = group.minimum
            ? group.minimum === group.maximum ? (group.minimum === 1 ? "Pick one" : `Pick ${group.minimum}`) : `Pick ${group.minimum} to ${group.maximum}`
            : group.maximum === 1 ? "Optional" : `Optional, up to ${group.maximum}`;

          return (
            <fieldset key={group.key} className={`sf-boxrow ${changed ? "is-changed" : ""}`} aria-describedby={helpId}>
              <legend className="sf-boxrow-head">
                <span className="sf-boxrow-label">{group.label}</span>
                <span id={helpId} className={`sf-boxrow-rule ${unmet ? "is-unmet" : ""}`}>{rule}</span>
              </legend>
              <p className="sf-boxrow-written" aria-live="polite">
                {chosen.length ? <span className="sf-marker">{chosen.map((modifier) => modifier.name).join(", ")}</span> : <span className="sf-boxrow-none">{group.minimum ? "Not chosen yet" : "None"}</span>}
                {changed && (chosen.length || groupDefaults.length) ? <span className="sf-changed">Changed</span> : null}
              </p>
              <div className="sf-boxes" role={single ? "radiogroup" : "group"} aria-label={group.label}>
                {group.modifiers.map((modifier) => {
                  const active = selectedModifiers.includes(modifier.id);
                  const atLimit = !single && !active && selectedCount >= group.maximum;
                  const disabled = !modifier.inStock || atLimit;
                  const note = !modifier.inStock ? "Sold out" : modifier.priceAdjustment ? formatModifierAdjustment(modifier.priceAdjustment) : null;
                  const standard = groupDefaults.includes(modifier.id);
                  return (
                    <label key={modifier.id} className={`sf-box ${active ? "is-marked" : ""} ${disabled ? "is-off" : ""}`}>
                      <input
                        type={single ? "radio" : "checkbox"}
                        name={`modifier-${item.id}-${group.key}`}
                        value={modifier.id}
                        checked={active}
                        disabled={disabled}
                        onChange={() => toggleModifier(modifier.id, group.maximum, memberIds)}
                        onClick={(event) => { if (single && active && group.minimum === 0) { event.preventDefault(); toggleModifier(modifier.id, group.maximum, memberIds); } }}
                        className="sr-only"
                      />
                      <span className="sf-box-square" aria-hidden="true">{active ? <MarkerTick /> : null}</span>
                      <span className="sf-box-name">{modifier.name}</span>
                      {note || standard ? (
                        <span className="sf-box-note">
                          {standard ? "Standard" : null}
                          {standard && note ? ", " : null}
                          {note}
                        </span>
                      ) : null}
                    </label>
                  );
                })}
              </div>
            </fieldset>
          );
        })}

        {allowNotes ? (
          <div className="sf-boxrow">
            <label htmlFor={`barista-notes-${item.id}`} className="sf-form-label">
              <span>Note for the barista <span className="sf-optional">optional</span></span>
              <textarea
                id={`barista-notes-${item.id}`}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className="sf-field sf-field-written"
                rows={2}
                maxLength={500}
              />
            </label>
          </div>
        ) : null}

        <div aria-live="polite" className="sf-messages">
          {!orderingAvailable ? <p className="sf-alert-error">{item.availability === "sold_out" ? "Sold out right now." : "Not available to order right now."}</p> : null}
          {error ? <p className="sf-alert-error" role="alert">{error}</p> : null}
          {unavailableGroups.length > 0 ? <p className="sf-alert-error">{unavailableGroups.join(", ")} sold out. This item can’t be added.</p> : null}
          {unmetGroups.length > 0 && unavailableGroups.length === 0 ? <p className="sf-alert-error">Choose {unmetGroups.map((group) => group.label).join(", ")}.</p> : null}
          {added ? (
            <div className="sf-alert-success" role="status">
              <span>Added to your order</span>
              <Link href="/checkout" className="sf-link">Review order</Link>
            </div>
          ) : null}
        </div>

        <div className="sf-addbar">
          {orderable ? <div className="sf-stepper">
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={quantity <= 1}
              onClick={() => setQuantity((value) => Math.max(1, value - 1))}
            >
              <Minus className="size-4" aria-hidden="true" />
            </button>
            <span className="sf-marker" aria-live="polite" aria-label={`Quantity ${quantity}`}>{quantity}</span>
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
                <span>Add to order</span>
                <span className="sf-btn-price">{formatMoney(unitPrice * quantity)}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
