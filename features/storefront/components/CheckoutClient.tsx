"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Clock, CreditCard, Minus, Plus, ReceiptText, Trash2 } from "lucide-react";
import { createCafePickupOrder } from "@/features/storefront/lib/data/orders";
import { applyCafeLoyalty } from "@/features/storefront/lib/data/loyalty";
import { initiateCafePaymentSession } from "@/features/storefront/lib/data/payment";
import { formatMoney } from "@/features/storefront/lib/format";
import { clearCartLines, loadCartLines, saveCartLines } from "@/features/storefront/lib/cart/storage";
import type { CartLine } from "@/features/storefront/lib/cart/types";
import { LoyaltyLookup } from "./LoyaltyLookup";

export function CheckoutClient() {
  const router = useRouter();
  const [lines, setLines] = React.useState<CartLine[]>([]);
  const [customerName, setCustomerName] = React.useState("");
  const [customerEmail, setCustomerEmail] = React.useState("");
  const [customerPhone, setCustomerPhone] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [redeemDrinkCredit, setRedeemDrinkCredit] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => setLines(loadCartLines()), []);

  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const tax = Math.round(subtotal * 0.0875);
  const total = subtotal + tax;
  const pickupMinutes = Math.max(8, ...lines.map((line) => Number(line.prepTimeMinutes || 5) + 5));

  function updateQuantity(cartId: string, quantity: number) {
    const next = lines.map((line) => line.cartId === cartId ? { ...line, quantity: Math.max(1, quantity) } : line);
    setLines(next);
    saveCartLines(next);
  }

  function removeLine(cartId: string) {
    const next = lines.filter((line) => line.cartId !== cartId);
    setLines(next);
    saveCartLines(next);
  }

  async function submit() {
    if (!lines.length) return;
    setPending(true);
    setError(null);

    const orderResult = await createCafePickupOrder({
      customerName: customerName || "Guest",
      customerEmail: customerEmail || undefined,
      customerPhone: customerPhone || undefined,
      pickupName: customerName || "Guest",
      requestedPickupMinutes: pickupMinutes,
      specialInstructions: notes || undefined,
      paymentMethod: "manual",
      items: lines.map((line) => ({
        menuItemId: line.menuItemId,
        quantity: line.quantity,
        modifierIds: line.modifierIds,
        specialInstructions: line.notes || undefined,
      })),
    });

    if (!orderResult.success) {
      setPending(false);
      setError(orderResult.error);
      return;
    }

    if (customerEmail.trim()) {
      const loyaltyResult = await applyCafeLoyalty({
        orderId: orderResult.order.id,
        secretKey: orderResult.order.secretKey,
        customerEmail,
        customerName: customerName || "Guest",
        customerPhone: customerPhone || undefined,
        redeemDrinkCredit,
      });
      if (!loyaltyResult.success) {
        setPending(false);
        setError(`Order created, but loyalty could not be applied: ${loyaltyResult.error}`);
        return;
      }
    }

    const paymentResult = await initiateCafePaymentSession(orderResult.order.id, orderResult.order.secretKey, "stripe");
    setPending(false);
    if (!paymentResult.success || !paymentResult.session?.success) {
      setError(paymentResult.success ? paymentResult.session?.error || "Payment could not be initiated" : paymentResult.error);
      return;
    }

    clearCartLines();
    router.push(`/order-confirmed?id=${orderResult.order.id}&key=${orderResult.order.secretKey || ""}`);
  }

  return (
    <main className="min-h-screen bg-[#f4ead9] px-5 py-6 text-[#201715] md:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-center justify-between border-b border-[#cdb894] pb-5">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-[#8b5f2b]">
            <ArrowLeft className="h-4 w-4" />
            Keep shopping
          </Link>
          <div className="hidden items-center gap-2 text-sm font-semibold text-[#6d5e52] sm:flex">
            <Clock className="h-4 w-4 text-[#557260]" />
            Pickup estimate updates with your cart
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_26rem] xl:grid-cols-[minmax(0,1fr)_30rem]">
        <section className="space-y-6">
          <div>
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#8b5f2b]">
              <ReceiptText className="h-4 w-4" />
              Pickup checkout
            </p>
            <h1 className="mt-3 text-5xl font-black leading-none md:text-6xl">Review your cafe ticket.</h1>
            <p className="mt-4 max-w-2xl text-lg leading-8 text-[#6d5e52]">Your order is created through the cafe pickup mutation and sent to payment initiation before the confirmation link is shown.</p>
          </div>

          <div className="overflow-hidden rounded-lg border border-[#cdb894] bg-[#fff8ed]">
            {lines.map((line) => (
              <div key={line.cartId} className="border-b border-[#d7c7ad] p-4 last:border-b-0">
                <div className="flex justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-black">{line.name}</h2>
                    {line.modifierNames.length > 0 && <p className="mt-1 text-sm text-[#6d5e52]">{line.modifierNames.join(", ")}</p>}
                    {line.notes && <p className="mt-1 text-sm text-[#8b5f2b]">Note: {line.notes}</p>}
                  </div>
                  <div className="text-right font-black">{formatMoney(line.unitPrice * line.quantity)}</div>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button aria-label={`Decrease ${line.name}`} onClick={() => updateQuantity(line.cartId, line.quantity - 1)} className="grid h-9 w-9 place-items-center rounded-md border border-[#d7c7ad] bg-white">
                      <Minus className="h-4 w-4" />
                    </button>
                    <span className="w-7 text-center font-black">{line.quantity}</span>
                    <button aria-label={`Increase ${line.name}`} onClick={() => updateQuantity(line.cartId, line.quantity + 1)} className="grid h-9 w-9 place-items-center rounded-md border border-[#d7c7ad] bg-white">
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                  <button aria-label={`Remove ${line.name}`} onClick={() => removeLine(line.cartId)} className="inline-flex items-center gap-2 rounded-md border border-red-200 bg-white px-3 py-2 text-sm font-bold text-red-700">
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </button>
                </div>
              </div>
            ))}
            {!lines.length && <div className="p-10 text-center text-[#6d5e52]">Your cart is empty.</div>}
          </div>
        </section>

        <aside className="rounded-lg border border-[#cdb894] bg-[#fff8ed] p-5 shadow-[0_24px_80px_rgba(32,23,21,0.14)] lg:sticky lg:top-6 lg:self-start">
          <h2 className="text-xl font-black">Pickup details</h2>
          <div className="mt-4 space-y-3">
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Pickup name" className="w-full rounded-md border border-[#d7c7ad] bg-white px-3 py-2 outline-none focus:border-[#8b5f2b]" />
            <input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="Receipt / loyalty email" className="w-full rounded-md border border-[#d7c7ad] bg-white px-3 py-2 outline-none focus:border-[#8b5f2b]" />
            <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="Phone" className="w-full rounded-md border border-[#d7c7ad] bg-white px-3 py-2 outline-none focus:border-[#8b5f2b]" />
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Order notes" className="min-h-20 w-full rounded-md border border-[#d7c7ad] bg-white px-3 py-2 outline-none focus:border-[#8b5f2b]" />
            <LoyaltyLookup email={customerEmail} onApplyEmail={setCustomerEmail} />
            <label className="flex items-center gap-2 rounded-md border border-[#d7c7ad] bg-white px-3 py-2 text-sm font-bold">
              <input type="checkbox" checked={redeemDrinkCredit} onChange={(e) => setRedeemDrinkCredit(e.target.checked)} />
              Redeem drink credit before payment
            </label>
          </div>
          <div className="mt-5 space-y-2 border-t border-[#d7c7ad] pt-4 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(subtotal)}</span></div>
            <div className="flex justify-between"><span>Tax</span><span>{formatMoney(tax)}</span></div>
            <div className="flex justify-between text-lg font-black"><span>Total</span><span>{formatMoney(total)}</span></div>
            <div className="flex items-center gap-2 text-[#6d5e52]"><Clock className="h-4 w-4 text-[#557260]" /> Estimated pickup: {pickupMinutes} minutes</div>
          </div>
          <button disabled={!lines.length || pending} onClick={submit} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-md bg-[#201715] px-5 py-3 text-sm font-black text-[#fff8ed] disabled:opacity-50">
            <CreditCard className="h-4 w-4" />
            {pending ? "Placing order..." : `Pay and send to bar / ${formatMoney(total)}`}
          </button>
          {error && <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        </aside>
        </div>
      </div>
    </main>
  );
}
