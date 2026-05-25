"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  createQuickMenuItemAction,
  updateMenuItemFlagsAction,
  updateMenuItemPriceAction,
  updateModifierStockAction,
} from "../actions/menu-management";

type Modifier = {
  id: string;
  name: string;
  modifierGroup: string;
  modifierGroupLabel?: string | null;
  priceAdjustment: number;
  inStock: boolean;
  defaultSelected?: boolean;
};

type MenuItem = {
  id: string;
  name: string;
  shortDescription?: string | null;
  price: number;
  available: boolean;
  featured: boolean;
  popular: boolean;
  prepTimeMinutes?: number | null;
  barStation?: string | null;
  category?: { id: string; name: string } | null;
  modifiers?: Modifier[];
};

type Category = { id: string; name: string; description?: string | null };

function money(cents = 0) {
  return `$${(cents / 100).toFixed(2)}`;
}

function centsFromDollars(value: string) {
  return Math.max(0, Math.round(Number(value || 0) * 100));
}

export function MenuManager({ categories, items }: { categories: Category[]; items: MenuItem[] }) {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [categoryFilter, setCategoryFilter] = React.useState("all");
  const [pendingKey, setPendingKey] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [newItem, setNewItem] = React.useState({ name: "", price: "5.00", categoryId: categories[0]?.id || "", barStation: "espresso_bar" });

  const filteredItems = items.filter((item) => {
    const matchesQuery = !query.trim() || item.name.toLowerCase().includes(query.toLowerCase()) || item.shortDescription?.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = categoryFilter === "all" || item.category?.id === categoryFilter;
    return matchesQuery && matchesCategory;
  });

  const unavailable = items.filter((item) => !item.available).length;
  const outOfStockModifiers = items.flatMap((item) => item.modifiers || []).filter((modifier) => !modifier.inStock).length;

  async function run(key: string, action: () => Promise<any>) {
    setPendingKey(key);
    setError(null);
    const response = await action();
    setPendingKey(null);
    if (!response.success) {
      setError(response.error);
      return;
    }
    router.refresh();
  }

  async function createQuickItem() {
    if (!newItem.name.trim()) return;
    await run("create-item", () => createQuickMenuItemAction({
      name: newItem.name.trim(),
      price: centsFromDollars(newItem.price),
      categoryId: newItem.categoryId || undefined,
      barStation: newItem.barStation,
      shortDescription: "Quick-added from menu manager.",
    }));
    setNewItem((current) => ({ ...current, name: "" }));
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-amber-700">Menu control</p>
          <h1 className="text-3xl font-semibold tracking-tight">Coffee menu manager</h1>
          <p className="text-muted-foreground">Make day-of availability, price, and modifier stock changes without dropping into raw CRUD.</p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <Stat label="Items" value={String(items.length)} />
          <Stat label="Hidden" value={String(unavailable)} />
          <Stat label="Mods out" value={String(outOfStockModifiers)} />
        </div>
      </div>

      {error && <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>}

      <section className="rounded-[2rem] border bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h2 className="text-xl font-semibold">Quick add</h2>
            <p className="text-sm text-muted-foreground">Add a temporary drink or pastry, then refine details later.</p>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-[1fr_8rem_12rem_12rem_auto]">
          <input value={newItem.name} onChange={(e) => setNewItem({ ...newItem, name: e.target.value })} placeholder="Seasonal latte" className="rounded-2xl border px-3 py-2" />
          <input value={newItem.price} onChange={(e) => setNewItem({ ...newItem, price: e.target.value })} placeholder="5.75" className="rounded-2xl border px-3 py-2" />
          <select value={newItem.categoryId} onChange={(e) => setNewItem({ ...newItem, categoryId: e.target.value })} className="rounded-2xl border px-3 py-2">
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <select value={newItem.barStation} onChange={(e) => setNewItem({ ...newItem, barStation: e.target.value })} className="rounded-2xl border px-3 py-2">
            <option value="espresso_bar">Espresso Bar</option>
            <option value="cold_bar">Cold Bar</option>
            <option value="brew_bar">Brew Bar</option>
            <option value="pastry_case">Pastry Case</option>
            <option value="retail_shelf">Retail Shelf</option>
          </select>
          <button disabled={pendingKey === "create-item" || !newItem.name.trim()} onClick={createQuickItem} className="rounded-full bg-stone-950 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">Add</button>
        </div>
      </section>

      <section className="rounded-[2rem] border bg-white/70 p-5 shadow-sm">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-1 flex-col gap-3 md:flex-row">
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search drinks, pastries, modifiers…" className="rounded-2xl border bg-white px-3 py-2 md:max-w-sm" />
            <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-2xl border bg-white px-3 py-2 md:w-56">
              <option value="all">All categories</option>
              {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
            </select>
          </div>
          <div className="text-sm text-muted-foreground">{filteredItems.length} visible</div>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {filteredItems.map((item) => (
            <article key={item.id} className="rounded-3xl border bg-white p-4 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-lg font-semibold">{item.name}</h3>
                    {!item.available && <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Hidden</span>}
                    {item.popular && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800">Popular</span>}
                    {item.featured && <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-800">Featured</span>}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{item.category?.name || "Uncategorized"} · {item.barStation?.replaceAll("_", " ") || "no station"} · {item.prepTimeMinutes || 5} min</p>
                </div>
                <PriceEditor item={item} pendingKey={pendingKey} run={run} />
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <FlagButton label={item.available ? "Available" : "Unavailable"} active={item.available} pending={pendingKey === `${item.id}-available`} onClick={() => run(`${item.id}-available`, () => updateMenuItemFlagsAction({ id: item.id, available: !item.available }))} />
                <FlagButton label="Featured" active={item.featured} pending={pendingKey === `${item.id}-featured`} onClick={() => run(`${item.id}-featured`, () => updateMenuItemFlagsAction({ id: item.id, featured: !item.featured }))} />
                <FlagButton label="Popular" active={item.popular} pending={pendingKey === `${item.id}-popular`} onClick={() => run(`${item.id}-popular`, () => updateMenuItemFlagsAction({ id: item.id, popular: !item.popular }))} />
              </div>

              {(item.modifiers || []).length > 0 && (
                <div className="mt-4 rounded-2xl bg-stone-50 p-3">
                  <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Modifiers</div>
                  <div className="flex flex-wrap gap-2">
                    {item.modifiers!.map((modifier) => (
                      <button key={modifier.id} disabled={pendingKey === `modifier-${modifier.id}`} onClick={() => run(`modifier-${modifier.id}`, () => updateModifierStockAction(modifier.id, !modifier.inStock))} className={`rounded-full border px-3 py-1 text-xs font-medium ${modifier.inStock ? "border-stone-300 bg-white text-stone-800" : "border-red-200 bg-red-50 text-red-700"}`}>
                        {modifier.name}{modifier.priceAdjustment ? ` · ${money(modifier.priceAdjustment)}` : ""}{!modifier.inStock ? " · out" : ""}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </article>
          ))}
          {!filteredItems.length && <div className="rounded-3xl border border-dashed p-8 text-center text-muted-foreground xl:col-span-2">No menu items match this view.</div>}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border bg-white px-4 py-3"><div className="text-xs text-muted-foreground">{label}</div><div className="text-xl font-semibold">{value}</div></div>;
}

function FlagButton({ label, active, pending, onClick }: { label: string; active: boolean; pending: boolean; onClick: () => void }) {
  return <button disabled={pending} onClick={onClick} className={`rounded-full px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${active ? "bg-stone-950 text-white" : "bg-stone-100 text-stone-700"}`}>{pending ? "Saving…" : label}</button>;
}

function PriceEditor({ item, pendingKey, run }: { item: MenuItem; pendingKey: string | null; run: (key: string, action: () => Promise<any>) => Promise<void> }) {
  const [value, setValue] = React.useState((item.price / 100).toFixed(2));
  React.useEffect(() => setValue((item.price / 100).toFixed(2)), [item.price]);
  const dirty = centsFromDollars(value) !== item.price;
  return (
    <div className="flex items-center gap-2">
      <input value={value} onChange={(e) => setValue(e.target.value)} className="w-20 rounded-xl border px-2 py-1 text-right font-semibold" aria-label={`Price for ${item.name}`} />
      <button disabled={!dirty || pendingKey === `${item.id}-price`} onClick={() => run(`${item.id}-price`, () => updateMenuItemPriceAction(item.id, centsFromDollars(value)))} className="rounded-full bg-amber-900 px-3 py-1 text-xs font-semibold text-white disabled:opacity-40">Save</button>
    </div>
  );
}
