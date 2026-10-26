import Link from "next/link";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/features/dashboard/components/PageContainer";
import { PillLink, PillTrack } from "@/features/platform/components/PillTabs";
import { PlatformEmpty, PlatformHeader, PlatformTable, platformTd } from "@/features/platform/components/PlatformPage";
import { StatusDot } from "@/features/platform/components/StatusTitle";
import { OPERATIONS_PATH } from "@/features/platform/inventory/lib/inventory";
import { cn } from "@/lib/utils";
import { loadSupplierList } from "../actions/suppliers";
import { SupplierDrawer } from "../components/SupplierDrawer";
import {
  SUPPLIER_PAGE_SIZE,
  SUPPLIERS_PATH,
  supplierListHref,
  supplierStatus,
  type SupplierListView,
  type SupplierRow,
  type SupplierStatusFilter,
} from "../lib/suppliers";

const breadcrumbs = [
  { type: "link" as const, label: "Dashboard", href: "/dashboard" },
  { type: "page" as const, label: "Platform" },
  { type: "page" as const, label: "Suppliers" },
];

const STATUS_TABS: Array<{ value: SupplierStatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "archived", label: "Archived" },
];

function telHref(phone: string) {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

function orderHref(supplier: SupplierRow) {
  return `${OPERATIONS_PATH}?purchaseSupplierSearch=${encodeURIComponent(supplier.name || "")}`;
}

function SupplierTable({ suppliers, canOrder }: { suppliers: SupplierRow[]; canOrder: boolean }) {
  return (
    <PlatformTable
      label="Suppliers"
      head={[
        { label: "Supplier" },
        { label: "Status" },
        { label: "Contact", className: "hidden md:table-cell" },
        { label: "Phone" },
        { label: "Email", className: "hidden lg:table-cell" },
        { label: "Lead", className: "hidden text-right sm:table-cell" },
        { label: <span className="sr-only">Actions</span>, className: "w-0" },
      ]}
    >
      {suppliers.map((supplier) => {
        const status = supplierStatus(supplier.status);
        const lead = supplier.leadTimeDays ?? 0;
        return (
          <tr key={supplier.id} className="transition-colors hover:bg-muted/30">
            <td className={cn(platformTd, "min-w-36")}>
              <Link href={`${SUPPLIERS_PATH}/${supplier.id}`} className="font-medium underline-offset-4 hover:underline focus-visible:underline [overflow-wrap:anywhere]">{supplier.name || "Untitled supplier"}</Link>
              {supplier.contactName ? <p className="text-xs text-muted-foreground md:hidden">{supplier.contactName}</p> : null}
            </td>
            <td className={cn(platformTd, "whitespace-nowrap")}><span className="inline-flex items-center gap-2"><StatusDot tone={status.tone} />{status.label}</span></td>
            <td className={cn(platformTd, "hidden max-w-44 truncate md:table-cell")}>{supplier.contactName || <span className="text-muted-foreground">—</span>}</td>
            <td className={cn(platformTd, "whitespace-nowrap tabular-nums")}>
              {supplier.phone ? <a href={telHref(supplier.phone)} className="underline decoration-border underline-offset-4 hover:decoration-foreground">{supplier.phone}</a> : <span className="text-muted-foreground">—</span>}
            </td>
            <td className={cn(platformTd, "hidden max-w-56 truncate lg:table-cell")}>
              {supplier.email ? <a href={`mailto:${supplier.email}`} className="underline decoration-border underline-offset-4 hover:decoration-foreground">{supplier.email}</a> : <span className="text-muted-foreground">—</span>}
            </td>
            <td className={cn(platformTd, "hidden whitespace-nowrap text-right tabular-nums text-muted-foreground sm:table-cell")}>{lead} {lead === 1 ? "day" : "days"}</td>
            <td className={cn(platformTd, "whitespace-nowrap py-1.5 text-right")}>
              {canOrder && supplier.status !== "archived" ? (
                <Button asChild size="sm" variant="outline" className="h-8 rounded-[6px] active:scale-[0.97]"><Link href={orderHref(supplier)}>Order</Link></Button>
              ) : null}
            </td>
          </tr>
        );
      })}
    </PlatformTable>
  );
}

export async function SupplierListPage({ view }: { view: SupplierListView }) {
  const result = await loadSupplierList(view);
  const data = result.success ? result.data : null;
  const total = data ? data.counts[view.status] : 0;
  const pageCount = Math.max(1, Math.ceil(total / SUPPLIER_PAGE_SIZE));

  const header = (
    <PlatformHeader
      title="Suppliers"
      meta={data ? <span className="tabular-nums">{data.counts.active} active</span> : null}
      actions={(
        <>
          <Button asChild variant="outline" className="rounded-[6px] active:scale-[0.97]">
            <Link href="/dashboard/platform/inventory">Inventory to reorder</Link>
          </Button>
          {data?.canManage ? <SupplierDrawer /> : null}
        </>
      )}
    />
  );

  return (
    <PageContainer title="Suppliers" header={header} breadcrumbs={breadcrumbs}>
      <div className="space-y-4 px-4 pb-24 md:px-6">
        <div className="space-y-4">
          <nav aria-label="Status" className="min-w-0 max-w-full">
            <PillTrack label="Status">
              {STATUS_TABS.map((tab) => (
                <PillLink key={tab.value} href={supplierListHref(view, { status: tab.value, page: 1 })} active={view.status === tab.value} count={data?.counts[tab.value]}>
                  {tab.label}
                </PillLink>
              ))}
            </PillTrack>
          </nav>
          <form method="get" role="search" className="flex max-w-xl items-center gap-2">
            {view.status !== "all" ? <input type="hidden" name="status" value={view.status} /> : null}
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="supplier-search" className="sr-only">Search suppliers</label>
              <Input id="supplier-search" type="search" name="search" defaultValue={view.search} placeholder="Name, contact or email" className="h-9 rounded-[6px] pl-9" />
            </div>
            <Button type="submit" variant="outline" className="h-9 rounded-[6px]">Search</Button>
            {view.search ? <Button asChild variant="ghost" className="h-9 rounded-[6px]"><Link href={supplierListHref(view, { search: "", page: 1 })}>Clear</Link></Button> : null}
          </form>
        </div>

        {!data ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <div className="space-y-0.5"><p className="font-medium">Suppliers didn&apos;t load</p><p className="text-muted-foreground">Nothing was changed. Inventory still opens.</p></div>
            <Button asChild variant="outline" className="rounded-[6px] active:scale-[0.97]"><Link href={supplierListHref(view)}>Try again</Link></Button>
          </div>
        ) : data.suppliers.length ? (
          <>
            <SupplierTable suppliers={data.suppliers} canOrder={data.canManage} />
            {pageCount > 1 ? (
              <nav aria-label="Supplier pages" className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm tabular-nums text-muted-foreground">Page {view.page} of {pageCount}</span>
                <div className="flex gap-2">
                  {view.page > 1 ? <Button asChild size="sm" variant="outline" className="rounded-[6px] active:scale-[0.97]"><Link href={supplierListHref(view, { page: view.page - 1 })}>Previous</Link></Button> : null}
                  {view.page < pageCount ? <Button asChild size="sm" variant="outline" className="rounded-[6px] active:scale-[0.97]"><Link href={supplierListHref(view, { page: view.page + 1 })}>Next</Link></Button> : null}
                </div>
              </nav>
            ) : null}
          </>
        ) : (
          <PlatformEmpty>{view.page > 1 ? "No more suppliers." : view.search ? `No suppliers match "${view.search}".` : "No suppliers."}</PlatformEmpty>
        )}
      </div>
    </PageContainer>
  );
}
