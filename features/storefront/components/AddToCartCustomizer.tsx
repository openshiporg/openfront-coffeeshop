"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, Minus, Plus, ShoppingBag } from "lucide-react";
import { formatMoney } from "@/features/storefront/lib/format";
import { loadCartLines, saveCartLines } from "@/features/storefront/lib/cart/storage";
import type { CartLine } from "@/features/storefront/lib/cart/types";
import type { StorefrontMenuItem } from "@/features/storefront/lib/data/menu";

function groupedModifiers(item: StorefrontMenuItem) {
  return (item.modifiers || []).reduce<Record<string, NonNullable<StorefrontMenuItem["modifiers"]>>>((groups, modifier) => {
    if (!modifier.inStock) return groups;
    const key = modifier.modifierGroupLabel || modifier.modifierGroup || "Options";
    groups[key] = groups[key] || [];
    groups[key].push(modifier);
    return groups;
  }, {});
}

export function AddToCartCustomizer({ item, compact = false }: { item: StorefrontMenuItem; compact?: boolean }) {
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<string[]>((item.modifiers || []).filter((modifier) => modifier.defaultSelected).map((modifier) => modifier.id));
  const [notes, setNotes] = useState("");
  const [added, setAdded] = useState(false);
  const groups = useMemo(() => groupedModifiers(item), [item]);
  const selectedModifierRecords = (item.modifiers || []).filter((modifier) => selectedModifiers.includes(modifier.id));
  const unitPrice = item.price + selectedModifierRecords.reduce((sum, modifier) => sum + Number(modifier.priceAdjustment || 0), 0);

  function toggleModifier(id: string, maxSelections: number, groupMembers: string[]) {
    setSelectedModifiers((current) => {
      if (current.includes(id)) return current.filter((modifierId) => modifierId !== id);
      const currentInGroup = current.filter((modifierId) => groupMembers.includes(modifierId));
      const pruned = maxSelections === 1 ? current.filter((modifierId) => !groupMembers.includes(modifierId)) : current;
      if (maxSelections > 1 && currentInGroup.length >= maxSelections) return current;
      return [...pruned, id];
    });
  }

  function addToCart() {
    const line: CartLine = {
      cartId: `${item.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      menuItemId: item.id,
      name: item.name,
      quantity,
      unitPrice,
      basePrice: item.price,
      modifierIds: selectedModifiers,
      modifierNames: selectedModifierRecords.map((modifier) => modifier.name),
      notes,
      prepTimeMinutes: item.prepTimeMinutes,
    };
    saveCartLines([...loadCartLines(), line]);
    setAdded(true);
  }

  return (
    <div className="rounded-lg border border-[#cdb894] bg-[#fff8ed] p-4 shadow-[0_18px_70px_rgba(32,23,21,0.12)] lg:sticky lg:top-6 lg:self-start">
      {!compact && (
        <div className="mb-5 border-b border-[#d7c7ad] pb-4">
          <div className="text-xs font-black uppercase tracking-[0.18em] text-[#8b5f2b]">Build your order</div>
          <h2 className="mt-2 text-2xl font-black text-[#201715]">{item.name}</h2>
        </div>
      )}

      <div className="space-y-5">
        {Object.entries(groups).map(([groupName, modifiers]) => {
          const max = Math.max(...modifiers.map((modifier) => modifier.maxSelections || 1));
          const memberIds = modifiers.map((modifier) => modifier.id);
          return (
            <fieldset key={groupName} className="space-y-2">
              <legend className="flex w-full items-center justify-between gap-3 text-sm font-black text-[#201715]">
                <span>{groupName}</span>
                <span className="text-xs font-semibold text-[#8b5f2b]">Choose up to {max}</span>
              </legend>
              <div className="grid gap-2">
                {modifiers.map((modifier) => {
                  const active = selectedModifiers.includes(modifier.id);
                  return (
                    <button
                      key={modifier.id}
                      type="button"
                      onClick={() => toggleModifier(modifier.id, modifier.maxSelections || max || 1, memberIds)}
                      className={`flex min-h-11 items-center justify-between gap-3 rounded-md border px-3 py-2 text-left text-sm transition ${active ? "border-[#201715] bg-[#201715] text-[#fff8ed]" : "border-[#d7c7ad] bg-white text-[#201715] hover:border-[#8b5f2b]"}`}
                    >
                      <span className="font-semibold">{modifier.name}</span>
                      <span className="flex items-center gap-2 text-xs font-bold">
                        {modifier.priceAdjustment ? `+${formatMoney(modifier.priceAdjustment)}` : "Included"}
                        {active ? <Check className="h-4 w-4" /> : null}
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        })}

        <label className="space-y-2 text-sm font-black text-[#201715]">
          Barista notes
          <textarea value={notes} onChange={(event) => setNotes(event.target.value)} className="min-h-20 w-full rounded-md border border-[#d7c7ad] bg-white px-3 py-2 font-medium outline-none focus:border-[#8b5f2b]" placeholder="Light ice, extra hot..." />
        </label>

        <div className="flex items-center justify-between gap-3 rounded-lg border border-[#d7c7ad] bg-white p-2">
          <div className="flex items-center gap-2">
            <button type="button" aria-label="Decrease quantity" onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="grid h-9 w-9 place-items-center rounded-md border border-[#d7c7ad] transition hover:border-[#8b5f2b]">
              <Minus className="h-4 w-4" />
            </button>
            <span className="w-7 text-center font-black">{quantity}</span>
            <button type="button" aria-label="Increase quantity" onClick={() => setQuantity((value) => value + 1)} className="grid h-9 w-9 place-items-center rounded-md border border-[#d7c7ad] transition hover:border-[#8b5f2b]">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <button type="button" onClick={addToCart} className="inline-flex items-center gap-2 rounded-md bg-[#201715] px-5 py-3 text-sm font-black text-[#fff8ed] transition hover:bg-[#8b3f24]">
            <ShoppingBag className="h-4 w-4" />
            Add / {formatMoney(unitPrice * quantity)}
          </button>
        </div>

        {added && (
          <div className="flex items-center justify-between gap-3 rounded-md border border-[#bad0b9] bg-[#edf6ea] px-3 py-2 text-sm text-[#355b3d]">
            <span>Added to pickup cart.</span>
            <Link href="/checkout" className="font-black underline underline-offset-4">Checkout</Link>
          </div>
        )}
      </div>
    </div>
  );
}
