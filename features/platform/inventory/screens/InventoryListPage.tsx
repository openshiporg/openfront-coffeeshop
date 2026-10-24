import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/features/dashboard/components/PageContainer";
import { PillLink, PillTrack } from "@/features/platform/components/PillTabs";
import { PlatformEmpty, PlatformHeader } from "@/features/platform/components/PlatformPage";
import { StatusTitle } from "@/features/platform/components/StatusTitle";
import { loadInventoryList } from "../actions/inventory";
import { InventoryItemDrawer } from "../components/InventoryItemDrawer";
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
  unitLabel,
  type InventoryListView,
  type StockFilter,
} from "../lib/inventory";
import type { InventoryListItem } from "../lib/types";

const breadcrumbs = [
  { type: "link" as const, label: "Dashboard", href: "/dashboard" },
  { type: "page" as const, label: "Platform" },
  { type: "page" as const, label: "Inventory" },
];

const STOCK_TABS: Array<{ value: StockFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "low", label: "Low" },
  { value: "out", label: "Out" },
];

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="truncate text-sm tabular-nums">{children}</dd>
    </div>
  );
}

function InventoryCard({ item }: { item: InventoryListItem }) {
  const state = STOCK_STATE[stockState(item.currentStock, item.reorderPoint)];
  const unit = unitLabel(item.unit);
  return (
    <article aria-labelledby={`inventory-${item.id}-title`} className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <StatusTitle id={`inventory-${item.id}-title`} tone={state.tone} status={state.label} className="text-base font-semibold tracking-tight">
            <Link href={`${INVENTORY_PATH}/${item.id}`} className="underline-offset-4 hover:underline">{item.name || "Untitled item"}<ArrowUpRight className="ml-0.5 inline size-3.5 align-[-0.125em] text-muted-foreground" aria-hidden="true" /></Link>
          </StatusTitle>
          <p className="text-xs text-muted-foreground">{categoryLabel(item.category)}{item.sku ? ` · ${item.sku}` : ""}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-lg font-semibold tabular-nums">{formatQuantity(item.currentStock)}</p>
          <p className="text-xs text-muted-foreground">{unit} on hand</p>
        </div>
      </div>
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-4">
        <Fact label="Reorder at">{formatQuantity(item.reorderPoint)} {unit}</Fact>
        <Fact label="Par">{formatQuantity(item.parLevel)} {unit}</Fact>
        <Fact label="Cost / unit">{formatCents(item.costPerUnit)}</Fact>
        <Fact label="Supplier">{item.supplierName || "—"}</Fact>
      </dl>
    </article>
  );
}

export async function InventoryListPage({ view }: { view: InventoryListView }) {
  const result = await loadInventoryList(view);
  const data = result.success ? result.data : null;
  const pageCount = data ? Math.max(1, Math.ceil(data.total / INVENTORY_PAGE_SIZE)) : 1;

  const header = (
    <PlatformHeader
      title="Inventory"
      meta={data ? <span className="tabular-nums">{data.counts.all} items</span> : null}
      actions={(
        <>
          <Button asChild variant="outline" className="rounded-full">
            <Link href={OPERATIONS_PATH}>Stock tasks<ArrowUpRight className="size-4" aria-hidden="true" /></Link>
          </Button>
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/dashboard/platform/suppliers">Suppliers<ArrowUpRight className="size-4" aria-hidden="true" /></Link>
          </Button>
          {data?.canManage ? <InventoryItemDrawer supplierNames={data.supplierNames} /> : null}
        </>
      )}
    />
  );

  return (
    <PageContainer title="Inventory" header={header} breadcrumbs={breadcrumbs}>
      <div className="space-y-6 px-4 pb-24 md:px-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <nav aria-label="Stock" className="min-w-0 max-w-full">
              <PillTrack label="Stock">
                {STOCK_TABS.map((tab) => (
                  <PillLink key={tab.value} href={inventoryListHref(view, { stock: tab.value, page: 1 })} active={view.stock === tab.value} count={data?.counts[tab.value]}>
                    {tab.label}
                  </PillLink>
                ))}
              </PillTrack>
            </nav>
            <nav aria-label="Category" className="min-w-0 max-w-full">
              <PillTrack label="Category">
                <PillLink href={inventoryListHref(view, { category: "", page: 1 })} active={!view.category}>All categories</PillLink>
                {INVENTORY_CATEGORIES.map((option) => (
                  <PillLink key={option.value} href={inventoryListHref(view, { category: option.value, page: 1 })} active={view.category === option.value}>
                    {option.label}
                  </PillLink>
                ))}
              </PillTrack>
            </nav>
          </div>
          <form method="get" role="search" className="flex max-w-xl items-center gap-2">
            {view.stock !== "all" ? <input type="hidden" name="stock" value={view.stock} /> : null}
            {view.category ? <input type="hidden" name="category" value={view.category} /> : null}
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="inventory-search" className="sr-only">Search inventory</label>
              <Input id="inventory-search" type="search" name="search" defaultValue={view.search} placeholder="Name or SKU" className="h-10 rounded-full pl-9" />
            </div>
            <Button type="submit" variant="outline" className="h-10 rounded-full">Search</Button>
            {view.search ? <Button asChild variant="ghost" className="h-10 rounded-full"><Link href={inventoryListHref(view, { search: "", page: 1 })}>Clear</Link></Button> : null}
          </form>
        </div>

        {!data ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <p className="font-medium">Unable to load inventory.</p>
            <Button asChild variant="outline" className="rounded-full"><Link href={inventoryListHref(view)}>Try again</Link></Button>
          </div>
        ) : data.items.length ? (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.items.map((item) => <InventoryCard key={item.id} item={item} />)}
            </div>
            {pageCount > 1 ? (
              <nav aria-label="Inventory pages" className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm tabular-nums text-muted-foreground">Page {view.page} of {pageCount}</span>
                <div className="flex gap-2">
                  {view.page > 1 ? <Button asChild size="sm" variant="outline" className="rounded-full"><Link href={inventoryListHref(view, { page: view.page - 1 })}>Previous</Link></Button> : null}
                  {view.page < pageCount ? <Button asChild size="sm" variant="outline" className="rounded-full"><Link href={inventoryListHref(view, { page: view.page + 1 })}>Next</Link></Button> : null}
                </div>
              </nav>
            ) : null}
          </>
        ) : (
          <PlatformEmpty>
            {view.page > 1 ? "No more items." : view.search ? `No items match "${view.search}".` : view.stock === "low" ? "No low items." : view.stock === "out" ? "Nothing out of stock." : "No inventory items."}
          </PlatformEmpty>
        )}
      </div>
    </PageContainer>
  );
}
