import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/features/dashboard/components/PageContainer";
import { PillLink, PillTrack } from "@/features/platform/components/PillTabs";
import { PlatformEmpty, PlatformHeader } from "@/features/platform/components/PlatformPage";
import { StatusTitle } from "@/features/platform/components/StatusTitle";
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

function SupplierCard({ supplier }: { supplier: SupplierRow }) {
  const status = supplierStatus(supplier.status);
  const lead = supplier.leadTimeDays ?? 0;
  return (
    <article aria-labelledby={`supplier-${supplier.id}-title`} className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-xs">
      <div className="flex items-start justify-between gap-3">
        <StatusTitle id={`supplier-${supplier.id}-title`} tone={status.tone} status={status.label} className="text-base font-semibold tracking-tight">
          <Link href={`${SUPPLIERS_PATH}/${supplier.id}`} className="underline-offset-4 hover:underline">
            {supplier.name || "Untitled supplier"}<ArrowUpRight className="ml-0.5 inline size-3.5 align-[-0.125em] text-muted-foreground" aria-hidden="true" />
          </Link>
        </StatusTitle>
        <span className="shrink-0 text-sm tabular-nums text-muted-foreground">{lead} {lead === 1 ? "day" : "days"} lead</span>
      </div>
      <dl className="grid gap-1 text-sm">
        <div className="flex min-w-0 gap-2"><dt className="w-14 shrink-0 text-muted-foreground">Contact</dt><dd className="min-w-0 truncate">{supplier.contactName || "—"}</dd></div>
        <div className="flex min-w-0 gap-2"><dt className="w-14 shrink-0 text-muted-foreground">Email</dt><dd className="min-w-0 truncate">{supplier.email ? <a href={`mailto:${supplier.email}`} className="hover:underline">{supplier.email}</a> : "—"}</dd></div>
        <div className="flex min-w-0 gap-2"><dt className="w-14 shrink-0 text-muted-foreground">Phone</dt><dd className="min-w-0 truncate">{supplier.phone ? <a href={`tel:${supplier.phone.replace(/[^\d+]/g, "")}`} className="hover:underline">{supplier.phone}</a> : "—"}</dd></div>
      </dl>
    </article>
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
          <Button asChild variant="outline" className="rounded-full">
            <Link href="/dashboard/platform/inventory">Inventory<ArrowUpRight className="size-4" aria-hidden="true" /></Link>
          </Button>
          {data?.canManage ? <SupplierDrawer /> : null}
        </>
      )}
    />
  );

  return (
    <PageContainer title="Suppliers" header={header} breadcrumbs={breadcrumbs}>
      <div className="space-y-6 px-4 pb-24 md:px-6">
        <div className="space-y-3">
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
              <Input id="supplier-search" type="search" name="search" defaultValue={view.search} placeholder="Name, contact or email" className="h-10 rounded-full pl-9" />
            </div>
            <Button type="submit" variant="outline" className="h-10 rounded-full">Search</Button>
            {view.search ? <Button asChild variant="ghost" className="h-10 rounded-full"><Link href={supplierListHref(view, { search: "", page: 1 })}>Clear</Link></Button> : null}
          </form>
        </div>

        {!data ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <p className="font-medium">Unable to load suppliers.</p>
            <Button asChild variant="outline" className="rounded-full"><Link href={supplierListHref(view)}>Try again</Link></Button>
          </div>
        ) : data.suppliers.length ? (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {data.suppliers.map((supplier) => <SupplierCard key={supplier.id} supplier={supplier} />)}
            </div>
            {pageCount > 1 ? (
              <nav aria-label="Supplier pages" className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm tabular-nums text-muted-foreground">Page {view.page} of {pageCount}</span>
                <div className="flex gap-2">
                  {view.page > 1 ? <Button asChild size="sm" variant="outline" className="rounded-full"><Link href={supplierListHref(view, { page: view.page - 1 })}>Previous</Link></Button> : null}
                  {view.page < pageCount ? <Button asChild size="sm" variant="outline" className="rounded-full"><Link href={supplierListHref(view, { page: view.page + 1 })}>Next</Link></Button> : null}
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
