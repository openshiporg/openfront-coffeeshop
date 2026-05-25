"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { createPosOrderAction } from "../actions/create-pos-order";

type Modifier = {
  id: string;
  name: string;
  modifierGroup: string;
  modifierGroupLabel?: string | null;
  priceAdjustment: number;
  defaultSelected?: boolean;
  inStock?: boolean;
};

type MenuItem = {
  id: string;
  name: string;
  price: number;
  category?: { id: string; name: string } | null;
  modifiers?: Modifier[];
};

export type PosCartItem = {
  cartId: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  modifierIds: string[];
  modifierNames: string[];
  notes?: string;
};

function money(cents = 0) {
  return `$${(cents / 100).toFixed(2)}`;
}

function defaultModifierIds(item: MenuItem) {
  return (item.modifiers || []).filter((modifier) => modifier.defaultSelected && modifier.inStock !== false).map((modifier) => modifier.id);
}

function unitPrice(item: MenuItem, modifierIds: string[]) {
  return item.price + (item.modifiers || []).filter((modifier) => modifierIds.includes(modifier.id)).reduce((sum, modifier) => sum + Number(modifier.priceAdjustment || 0), 0);
}

export function PosRegister({ items }: { items: MenuItem[] }) {
  const router = useRouter();
  const [cart, setCart] = React.useState<PosCartItem[]>([]);
  const [customerName, setCustomerName] = React.useState("Counter guest");
  const [notes, setNotes] = React.useState("");
  const [paymentMethod, setPaymentMethod] = React.useState<'cash' | 'manual_card'>('manual_card');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [lastOrder, setLastOrder] = React.useState<any | null>(null);

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const tax = Math.round(subtotal * 0.0875);
  const total = subtotal + tax;

  function addItem(item: MenuItem) {
    const modifierIds = defaultModifierIds(item);
    const modifiers = (item.modifiers || []).filter((modifier) => modifierIds.includes(modifier.id));
    setCart((current) => [
      ...current,
      {
        cartId: `${item.id}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
        menuItemId: item.id,
        name: item.name,
        quantity: 1,
        unitPrice: unitPrice(item, modifierIds),
        modifierIds,
        modifierNames: modifiers.map((modifier) => modifier.name),
      },
    ]);
  }

  function updateQuantity(cartId: string, quantity: number) {
    setCart((current) => current.map((item) => item.cartId === cartId ? { ...item, quantity: Math.max(1, quantity) } : item));
  }

  async function completeOrder() {
    if (!cart.length) return;
    setPending(true);
    setError(null);
    setLastOrder(null);
    const response = await createPosOrderAction({ customerName, notes, paymentMethod, items: cart });
    setPending(false);
    if (!response.success) {
      setError(response.error);
      return;
    }
    setCart([]);
    setNotes("");
    setLastOrder(response.data.createCafePickupOrder);
    router.refresh();
  }

  const groupedItems = items.reduce<Record<string, MenuItem[]>>((groups, item) => {
    const key = item.category?.name || "Menu";
    groups[key] = groups[key] || [];
    groups[key].push(item);
    return groups;
  }, {});

  return (
    <div className="grid min-h-[calc(100vh-4rem)] gap-6 p-6 lg:grid-cols-[1fr_24rem]">
      <section className="space-y-6">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-amber-700">Counter register</p>
          <h1 className="text-3xl font-semibold tracking-tight">Cafe POS</h1>
          <p className="text-muted-foreground">Tap items into a counter order, collect cash or card, and send the ticket to the bar queue.</p>
        </div>

        {Object.entries(groupedItems).map(([category, categoryItems]) => (
          <div key={category} className="space-y-3">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{category}</h2>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {categoryItems.map((item) => (
                <button key={item.id} type="button" onClick={() => addItem(item)} className="rounded-3xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-amber-700 hover:shadow-md">
                  <div className="flex justify-between gap-3">
                    <div>
                      <div className="font-semibold">{item.name}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{item.modifiers?.length || 0} modifier options</div>
                    </div>
                    <div className="font-semibold">{money(item.price)}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </section>

      <aside className="rounded-[2rem] border bg-white p-5 shadow-sm lg:sticky lg:top-6 lg:self-start">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Current ticket</h2>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-medium text-amber-900">{cart.length} lines</span>
        </div>

        <div className="space-y-3">
          {cart.map((item) => (
            <div key={item.cartId} className="rounded-2xl border p-3">
              <div className="flex justify-between gap-3">
                <div>
                  <div className="font-medium">{item.name}</div>
                  {item.modifierNames.length > 0 && <div className="mt-1 text-xs text-muted-foreground">{item.modifierNames.join(", ")}</div>}
                </div>
                <button type="button" onClick={() => setCart((current) => current.filter((line) => line.cartId !== item.cartId))} className="text-xs text-red-600">Remove</button>
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <button onClick={() => updateQuantity(item.cartId, item.quantity - 1)} className="grid h-7 w-7 place-items-center rounded-full border">−</button>
                  <span className="w-5 text-center text-sm font-semibold">{item.quantity}</span>
                  <button onClick={() => updateQuantity(item.cartId, item.quantity + 1)} className="grid h-7 w-7 place-items-center rounded-full border">+</button>
                </div>
                <span className="font-semibold">{money(item.unitPrice * item.quantity)}</span>
              </div>
            </div>
          ))}
          {!cart.length && <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">Tap a menu item to start a counter ticket.</div>}
        </div>

        <div className="mt-5 space-y-3 border-t pt-4">
          <label className="block text-sm font-medium">Name
            <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="mt-1 w-full rounded-xl border px-3 py-2" />
          </label>
          <label className="block text-sm font-medium">Ticket notes
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 min-h-16 w-full rounded-xl border px-3 py-2" />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setPaymentMethod('manual_card')} className={`rounded-xl border px-3 py-2 text-sm font-medium ${paymentMethod === 'manual_card' ? 'border-stone-950 bg-stone-950 text-white' : ''}`}>Card</button>
            <button onClick={() => setPaymentMethod('cash')} className={`rounded-xl border px-3 py-2 text-sm font-medium ${paymentMethod === 'cash' ? 'border-stone-950 bg-stone-950 text-white' : ''}`}>Cash</button>
          </div>
          <div className="space-y-1 text-sm">
            <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal)}</span></div>
            <div className="flex justify-between"><span>Tax</span><span>{money(tax)}</span></div>
            <div className="flex justify-between text-lg font-bold"><span>Total</span><span>{money(total)}</span></div>
          </div>
          <button disabled={!cart.length || pending} onClick={completeOrder} className="w-full rounded-full bg-stone-950 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">
            {pending ? 'Sending…' : `Complete ${paymentMethod === 'cash' ? 'cash' : 'card'} order`}
          </button>
          {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
          {lastOrder && <p className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">Created order #{lastOrder.orderNumber} · handoff {lastOrder.handoffCode}</p>}
        </div>
      </aside>
    </div>
  );
}
