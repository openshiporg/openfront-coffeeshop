"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createCafePickupOrder } from "@/features/storefront/lib/data/orders";
import { applyCafeLoyalty } from "@/features/storefront/lib/data/loyalty";
import { initiateCafePaymentSession } from "@/features/storefront/lib/data/payment";
import { formatMoney } from "@/features/storefront/lib/format";
import { LoyaltyLookup } from "./LoyaltyLookup";
import type { StorefrontMenuItem } from "@/features/storefront/lib/data/menu";

type Props = {
  item: StorefrontMenuItem;
  compact?: boolean;
};

function groupedModifiers(item: StorefrontMenuItem) {
  return (item.modifiers || []).reduce<Record<string, NonNullable<StorefrontMenuItem["modifiers"]>>>((groups, modifier) => {
    if (!modifier.inStock) return groups;
    const key = modifier.modifierGroupLabel || modifier.modifierGroup || "Options";
    groups[key] = groups[key] || [];
    groups[key].push(modifier);
    return groups;
  }, {});
}

export function AddToPickupOrder({ item, compact = false }: Props) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [selectedModifiers, setSelectedModifiers] = useState<string[]>(
    (item.modifiers || []).filter((modifier) => modifier.defaultSelected).map((modifier) => modifier.id)
  );
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [redeemDrinkCredit, setRedeemDrinkCredit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const groups = useMemo(() => groupedModifiers(item), [item]);
  const selectedModifierRecords = (item.modifiers || []).filter((modifier) => selectedModifiers.includes(modifier.id));
  const unitPrice = item.price + selectedModifierRecords.reduce((sum, modifier) => sum + (modifier.priceAdjustment || 0), 0);
  const total = unitPrice * quantity;

  function toggleModifier(id: string, maxSelections: number, groupMembers: string[]) {
    setSelectedModifiers((current) => {
      if (current.includes(id)) return current.filter((modifierId) => modifierId !== id);

      const currentInGroup = current.filter((modifierId) => groupMembers.includes(modifierId));
      const pruned = maxSelections === 1 ? current.filter((modifierId) => !groupMembers.includes(modifierId)) : current;
      if (maxSelections > 1 && currentInGroup.length >= maxSelections) return current;
      return [...pruned, id];
    });
  }

  function submitOrder() {
    setError(null);
    startTransition(async () => {
      const result = await createCafePickupOrder({
        customerName: customerName || "Guest",
        customerEmail: customerEmail || undefined,
        pickupName: customerName || "Guest",
        requestedPickupMinutes: item.prepTimeMinutes ? Math.max(8, item.prepTimeMinutes + 5) : 12,
        specialInstructions: notes || undefined,
        paymentMethod: "manual",
        items: [
          {
            menuItemId: item.id,
            quantity,
            modifierIds: selectedModifiers,
            specialInstructions: notes || undefined,
          },
        ],
      });

      if (!result.success) {
        setError(result.error);
        return;
      }

      if (customerEmail.trim()) {
        const loyaltyResult = await applyCafeLoyalty({
          orderId: result.order.id,
          secretKey: result.order.secretKey,
          customerEmail,
          customerName: customerName || "Guest",
          redeemDrinkCredit,
        });

        if (!loyaltyResult.success) {
          setError(`Order created, but loyalty could not be applied: ${loyaltyResult.error}`);
          return;
        }
      }

      const paymentResult = await initiateCafePaymentSession(result.order.id, result.order.secretKey, "stripe");
      if (!paymentResult.success || !paymentResult.session?.success) {
        setError(paymentResult.success ? paymentResult.session?.error || "Payment could not be initiated" : paymentResult.error);
        return;
      }

      router.push(`/order-confirmed?id=${result.order.id}&key=${result.order.secretKey || ""}`);
    });
  }

  return (
    <div className="rounded-[2rem] border border-stone-200 bg-[#fffaf1] p-4 shadow-[0_18px_60px_rgba(77,44,20,0.10)]">
      {!compact && (
        <div className="mb-4">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-800">Build your drink</div>
          <h2 className="mt-1 text-2xl font-semibold text-stone-950">{item.name}</h2>
        </div>
      )}

      <div className="space-y-4">
        {Object.entries(groups).map(([groupName, modifiers]) => {
          const max = Math.max(...modifiers.map((modifier) => modifier.maxSelections || 1));
          const memberIds = modifiers.map((modifier) => modifier.id);
          return (
            <fieldset key={groupName} className="space-y-2">
              <legend className="text-sm font-semibold text-stone-800">{groupName}</legend>
              <div className="flex flex-wrap gap-2">
                {modifiers.map((modifier) => {
                  const active = selectedModifiers.includes(modifier.id);
                  return (
                    <button
                      key={modifier.id}
                      type="button"
                      onClick={() => toggleModifier(modifier.id, modifier.maxSelections || max || 1, memberIds)}
                      className={`rounded-full border px-3 py-2 text-sm transition ${
                        active
                          ? "border-amber-900 bg-amber-900 text-white"
                          : "border-stone-300 bg-white text-stone-800 hover:border-amber-700"
                      }`}
                    >
                      {modifier.name}{modifier.priceAdjustment ? ` +${formatMoney(modifier.priceAdjustment)}` : ""}
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        })}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-medium text-stone-800">
            Pickup name
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full rounded-2xl border border-stone-300 bg-white px-3 py-2 outline-none focus:border-amber-800" placeholder="Maya" />
          </label>
          <label className="space-y-1 text-sm font-medium text-stone-800">
            Receipt email
            <input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} className="w-full rounded-2xl border border-stone-300 bg-white px-3 py-2 outline-none focus:border-amber-800" placeholder="you@example.com" />
          </label>
        </div>

        <LoyaltyLookup email={customerEmail} onApplyEmail={setCustomerEmail} />

        <label className="flex items-center gap-2 rounded-2xl border border-amber-200 bg-white px-3 py-2 text-sm font-medium text-stone-800">
          <input type="checkbox" checked={redeemDrinkCredit} onChange={(e) => setRedeemDrinkCredit(e.target.checked)} />
          Redeem one drink credit if available
        </label>

        <label className="space-y-1 text-sm font-medium text-stone-800">
          Barista notes
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-20 w-full rounded-2xl border border-stone-300 bg-white px-3 py-2 outline-none focus:border-amber-800" placeholder="Light ice, extra hot, no sleeve…" />
        </label>

        <div className="flex items-center justify-between gap-3 rounded-2xl bg-white p-2">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setQuantity((value) => Math.max(1, value - 1))} className="grid h-9 w-9 place-items-center rounded-full border">−</button>
            <span className="w-6 text-center font-semibold">{quantity}</span>
            <button type="button" onClick={() => setQuantity((value) => value + 1)} className="grid h-9 w-9 place-items-center rounded-full border">+</button>
          </div>
          <button type="button" onClick={submitOrder} disabled={isPending} className="rounded-full bg-stone-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-amber-900 disabled:opacity-60">
            {isPending ? "Sending to bar…" : `Order pickup · ${formatMoney(total)}`}
          </button>
        </div>

        {error && <p className="rounded-2xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      </div>
    </div>
  );
}
