import Link from "next/link";
import { RotateCw, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/features/dashboard/components/PageContainer";
import { PillLink, PillTrack } from "@/features/platform/components/PillTabs";
import { PlatformEmpty, PlatformHeader, PlatformTable, platformTd } from "@/features/platform/components/PlatformPage";
import { StatusDot } from "@/features/platform/components/StatusTitle";
import { cn } from "@/lib/utils";
import { loadInventoryList } from "../actions/inventory";
import { InventoryItemDrawer } from "../components/InventoryItemDrawer";
import { LinkSelect } from "../components/LinkSelect";
import {
  categoryLabel,
  formatCents,
  formatQuantity,
  INVENTORY_CATEGORIES,
  INVENTORY_PAGE_SIZE,
  INVENTORY_PATH,
  inventoryListHref,
  OPERATIONS_PATH,
  STOCK_STATE,
  stockState,
  SUPPLIERS_PATH,
  toNumber,
  unitLabel,
  type InventoryListView,
  type InventoryTab,
} from "../lib/inventory";
import type { InventoryListData, InventoryListItem } from "../lib/types";

const breadcrumbs = [
  { type: "link" as const, label: "Dashboard", href: "/dashboard" },
  { type: "page" as const, label: "Platform" },
  { type: "page" as const, label: "Inventory" },
];

const TABS: Array<{ value: InventoryTab; label: string }> = [
  { value: "reorder", label: "To reorder" },
  { value: "out", label: "Out" },
  { value: "low", label: "Low" },
  { value: "all", label: "All items" },
];

function orderStockHref(item: InventoryListItem) {
  return `${OPERATIONS_PATH}?purchaseInventorySearch=${encodeURIComponent(item.name || "")}`;
}

/** Quantity still needed to bring the item back to par. */
function shortfall(item: InventoryListItem) {
  const need = toNumber(item.parLevel) - toNumber(item.currentStock);
  return need > 0 ? need : 0;
}

function InventoryTable({ items, label, showReorder }: { items: InventoryListItem[]; label: string; showReorder: boolean }) {
  return (
    <PlatformTable
      label={label}
      head={[
        { label: "Item" },
        { label: "Status" },
        { label: "On hand", className: "text-right" },
        { label: "Reorder at", className: "hidden text-right sm:table-cell" },
        { label: "To par", className: "text-right" },
        { label: "Cost / unit", className: "hidden text-right md:table-cell" },
        { label: "Supplier", className: "hidden lg:table-cell" },
        { label: <span className="sr-only">Actions</span>, className: "w-0" },
      ]}
    >
      {items.map((item) => {
        const stateKey = stockState(item.currentStock, item.reorderPoint);
        const state = STOCK_STATE[stateKey];
        const unit = unitLabel(item.unit);
        const need = shortfall(item);
        return (
          <tr key={item.id} className="transition-colors hover:bg-muted/30">
            <td className={cn(platformTd, "min-w-40")}>
              <Link href={`${INVENTORY_PATH}/${item.id}`} className="font-medium underline-offset-4 hover:underline focus-visible:underline [overflow-wrap:anywhere]">{item.name || "Untitled item"}</Link>
              <p className="text-xs text-muted-foreground">{categoryLabel(item.category)}{item.sku ? ` · ${item.sku}` : ""}</p>
            </td>
            <td className={cn(platformTd, "whitespace-nowrap")}>
              <span className="inline-flex items-center gap-2"><StatusDot tone={state.tone} />{state.label}</span>
            </td>
            <td className={cn(platformTd, "whitespace-nowrap text-right tabular-nums", stateKey !== "ok" && "font-semibold")}>{formatQuantity(item.currentStock)} <span className="font-normal text-muted-foreground">{unit}</span></td>
            <td className={cn(platformTd, "hidden whitespace-nowrap text-right tabular-nums text-muted-foreground sm:table-cell")}>{formatQuantity(item.reorderPoint)}</td>
            <td className={cn(platformTd, "whitespace-nowrap text-right tabular-nums")}>{need ? formatQuantity(need) : <span className="text-muted-foreground">—</span>}</td>
            <td className={cn(platformTd, "hidden whitespace-nowrap text-right tabular-nums md:table-cell")}>{formatCents(item.costPerUnit)}</td>
            <td className={cn(platformTd, "hidden max-w-48 truncate lg:table-cell")}>{item.supplierName || <span className="text-muted-foreground">—</span>}</td>
            <td className={cn(platformTd, "whitespace-nowrap py-1.5 text-right")}>
              {showReorder && stateKey !== "ok" ? (
                <Button asChild size="sm" variant="outline" className="h-8 rounded-[6px] active:scale-[0.97]">
                  <Link href={orderStockHref(item)}>Order</Link>
                </Button>
              ) : null}
            </td>
          </tr>
        );
      })}
    </PlatformTable>
  );
}

function LoadError({ view }: { view: InventoryListView }) {
  return (
    <div role="alert" className="flex flex-col gap-3 rounded-[6px] border border-destructive/40 bg-destructive/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="space-y-0.5">
        <p className="font-medium">Inventory didn&apos;t load</p>
        <p className="text-muted-foreground">Nothing was changed. Stock tasks and suppliers still open.</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button asChild className="rounded-[6px] active:scale-[0.97]"><Link href={inventoryListHref(view)}><RotateCw className="size-4" aria-hidden="true" />Try again</Link></Button>
        <Button asChild variant="outline" className="rounded-[6px] active:scale-[0.97]"><Link href={OPERATIONS_PATH}>Stock tasks</Link></Button>
        <Button asChild variant="outline" className="rounded-[6px] active:scale-[0.97]"><Link href={SUPPLIERS_PATH}>Suppliers</Link></Button>
      </div>
    </div>
  );
}

type Loaded = { data: InventoryListData; items: InventoryListItem[]; total: number; overflow: Array<{ tab: InventoryTab; shown: number; total: number }> };

async function loadView(view: InventoryListView): Promise<Loaded | null> {
  if (view.stock !== "reorder") {
    const result = await loadInventoryList(view);
    return result.success ? { data: result.data, items: result.data.items, total: result.data.total, overflow: [] } : null;
  }
  // Default view: everything that needs ordering, out of stock first, then low.
  const [out, low] = await Promise.all([
    loadInventoryList({ ...view, stock: "out", page: 1 }),
    loadInventoryList({ ...view, stock: "low", page: 1 }),
  ]);
  if (!out.success || !low.success) return null;
  const overflow: Loaded["overflow"] = [];
  if (out.data.total > out.data.items.length) overflow.push({ tab: "out", shown: out.data.items.length, total: out.data.total });
  if (low.data.total > low.data.items.length) overflow.push({ tab: "low", shown: low.data.items.length, total: low.data.total });
  const items = [...out.data.items, ...low.data.items];
  return { data: out.data, items, total: items.length, overflow };
}

export async function InventoryListPage({ view }: { view: InventoryListView }) {
  const loaded = await loadView(view);
  const data = loaded?.data ?? null;
  const pageCount = loaded && view.stock !== "reorder" ? Math.max(1, Math.ceil(loaded.total / INVENTORY_PAGE_SIZE)) : 1;
  const tabCount = (tab: InventoryTab) => (data ? (tab === "reorder" ? data.counts.low + data.counts.out : data.counts[tab]) : undefined);

  const header = (
    <PlatformHeader
      title="Inventory"
      meta={data ? (
        <span className="tabular-nums">
          {data.counts.all} items
          {data.counts.out ? <> · <span className="font-medium text-foreground">{data.counts.out} out</span></> : null}
          {data.counts.low ? <> · {data.counts.low} low</> : null}
        </span>
      ) : null}
      actions={(
        <>
          <Button asChild variant="outline" className="rounded-[6px] active:scale-[0.97]"><Link href={OPERATIONS_PATH}>Stock tasks</Link></Button>
          <Button asChild variant="outline" className="rounded-[6px] active:scale-[0.97]"><Link href={SUPPLIERS_PATH}>Suppliers</Link></Button>
          {data?.canManage ? <InventoryItemDrawer supplierNames={data.supplierNames} /> : null}
        </>
      )}
    />
  );

  const emptyText = view.page > 1
    ? "No more items."
    : view.search
      ? `No items match "${view.search}".`
      : view.stock === "reorder"
        ? "Nothing to reorder. Every item is above its reorder point."
        : view.stock === "low"
          ? "No low items."
          : view.stock === "out"
            ? "Nothing out of stock."
            : "No inventory items.";

  return (
    <PageContainer title="Inventory" header={header} breadcrumbs={breadcrumbs}>
      <div className="space-y-4 px-4 pb-24 md:px-6">
        <nav aria-label="Stock">
          <PillTrack label="Stock">
            {TABS.map((tab) => (
              <PillLink key={tab.value} href={inventoryListHref(view, { stock: tab.value, page: 1 })} active={view.stock === tab.value} count={tabCount(tab.value)}>
                {tab.label}
              </PillLink>
            ))}
          </PillTrack>
        </nav>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <form method="get" role="search" className="flex min-w-0 flex-1 items-center gap-2 sm:max-w-md">
            {view.stock !== "reorder" ? <input type="hidden" name="stock" value={view.stock} /> : null}
            {view.category ? <input type="hidden" name="category" value={view.category} /> : null}
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="inventory-search" className="sr-only">Search inventory</label>
              <Input id="inventory-search" type="search" name="search" defaultValue={view.search} placeholder="Name or SKU" className="h-9 rounded-[6px] pl-9" />
            </div>
            <Button type="submit" variant="outline" className="h-9 rounded-[6px] active:scale-[0.97]">Search</Button>
            {view.search ? <Button asChild variant="ghost" className="h-9 rounded-[6px]"><Link href={inventoryListHref(view, { search: "", page: 1 })}>Clear</Link></Button> : null}
          </form>
          <LinkSelect
            label="Category"
            value={view.category}
            className="sm:w-44"
            options={[
              { value: "", label: "All categories", href: inventoryListHref(view, { category: "", page: 1 }) },
              ...INVENTORY_CATEGORIES.map((option) => ({ value: option.value, label: option.label, href: inventoryListHref(view, { category: option.value, page: 1 }) })),
            ]}
          />
        </div>

        {!loaded ? (
          <LoadError view={view} />
        ) : loaded.items.length ? (
          <>
            <InventoryTable items={loaded.items} label={TABS.find((tab) => tab.value === view.stock)?.label ?? "Inventory"} showReorder={Boolean(data?.canManage)} />
            {loaded.overflow.length ? (
              <p className="text-sm text-muted-foreground">
                {loaded.overflow.map((entry, index) => (
                  <span key={entry.tab}>
                    {index ? " · " : ""}
                    Showing {entry.shown} of {entry.total} {entry.tab === "out" ? "out" : "low"}:{" "}
                    <Link href={inventoryListHref(view, { stock: entry.tab, page: 1 })} className="font-medium text-foreground underline underline-offset-4">see all</Link>
                  </span>
                ))}
              </p>
            ) : null}
            {pageCount > 1 ? (
              <nav aria-label="Inventory pages" className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm tabular-nums text-muted-foreground">Page {view.page} of {pageCount}</span>
                <div className="flex gap-2">
                  {view.page > 1 ? <Button asChild size="sm" variant="outline" className="rounded-[6px]"><Link href={inventoryListHref(view, { page: view.page - 1 })}>Previous</Link></Button> : null}
                  {view.page < pageCount ? <Button asChild size="sm" variant="outline" className="rounded-[6px]"><Link href={inventoryListHref(view, { page: view.page + 1 })}>Next</Link></Button> : null}
                </div>
              </nav>
            ) : null}
          </>
        ) : (
          <PlatformEmpty>
            {emptyText}
            {view.stock === "reorder" && !view.search ? <> <Link href={inventoryListHref(view, { stock: "all", page: 1 })} className="font-medium text-foreground underline underline-offset-4">All items</Link></> : null}
          </PlatformEmpty>
        )}
      </div>
    </PageContainer>
  );
}
