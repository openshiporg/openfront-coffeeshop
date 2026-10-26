import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/features/dashboard/components/PageContainer";
import { PillLink, PillTrack } from "@/features/platform/components/PillTabs";
import { PlatformEmpty, PlatformHeader, PlatformSection, PlatformTable, platformTd } from "@/features/platform/components/PlatformPage";
import { StatusDot } from "@/features/platform/components/StatusTitle";
import { cn } from "@/lib/utils";
import { LotList, PurchaseOrderList } from "@/features/platform/inventory/components/PurchasingLists";
import { formatCents, formatQuantity, INVENTORY_PATH, OPERATIONS_PATH, STOCK_STATE, stockState, unitLabel } from "@/features/platform/inventory/lib/inventory";
import { formatStoreDateTime } from "@/lib/date-time";
import { loadSupplierDetail } from "../actions/suppliers";
import { SupplierDrawer } from "../components/SupplierDrawer";
import { SupplierStatusActions } from "../components/SupplierStatusActions";
import {
  normalizeWebsite,
  SUPPLIER_PO_PAGE_SIZE,
  SUPPLIERS_PATH,
  supplierDetailHref,
  supplierStatus,
  type PoStatusFilter,
  type SupplierDetailView,
} from "../lib/suppliers";

const PO_TABS: Array<{ value: PoStatusFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "submitted", label: "Submitted" },
  { value: "received", label: "Received" },
  { value: "cancelled", label: "Cancelled" },
  { value: "draft", label: "Draft" },
];

const STOCK_RANK = { out: 0, low: 1, ok: 2 } as const;
function stockRank(item: { currentStock: string | null; reorderPoint: string | null }) {
  return STOCK_RANK[stockState(item.currentStock, item.reorderPoint)];
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

export async function SupplierDetailPage({ id, view }: { id: string; view: SupplierDetailView }) {
  const result = await loadSupplierDetail(id, view.po, view.poPage);
  if (result.success && !result.data.supplier) notFound();

  const breadcrumbs = [
    { type: "link" as const, label: "Dashboard", href: "/dashboard" },
    { type: "link" as const, label: "Suppliers", href: SUPPLIERS_PATH },
    { type: "page" as const, label: result.success ? result.data.supplier?.name || "Supplier" : "Supplier" },
  ];

  if (!result.success) {
    return (
      <PageContainer title="Supplier" header={<PlatformHeader title="Supplier" />} breadcrumbs={breadcrumbs}>
        <div className="px-4 pb-8 md:px-6">
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <div className="space-y-0.5"><p className="font-medium">This supplier didn&apos;t load</p><p className="text-muted-foreground">Nothing was changed.</p></div>
            <Button asChild variant="outline" className="rounded-[6px]"><Link href={supplierDetailHref(id, view)}>Try again</Link></Button>
          </div>
        </div>
      </PageContainer>
    );
  }

  const { supplier, canManage, storeTimezone, poCounts, purchaseOrders, lots, lotsCount, items, itemsCount } = result.data;
  if (!supplier) notFound();
  const status = supplierStatus(supplier.status);
  const website = supplier.website ? normalizeWebsite(supplier.website) : null;
  const poTotal = poCounts[view.po];
  const poPages = Math.max(1, Math.ceil(poTotal / SUPPLIER_PO_PAGE_SIZE));
  const detailPath = `${SUPPLIERS_PATH}/${supplier.id}`;
  const revalidate = [detailPath, ...purchaseOrders.flatMap((order) => (order.inventoryItem ? [`${INVENTORY_PATH}/${order.inventoryItem.id}`] : [])), INVENTORY_PATH];
  const lead = supplier.leadTimeDays ?? 0;

  const header = (
    <PlatformHeader
      title={(
        <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-2">
          <span className="inline-flex min-w-0 items-center gap-2"><StatusDot tone={status.tone} className="size-2.5" /><span className="[overflow-wrap:anywhere]">{supplier.name || "Untitled supplier"}</span></span>
          <span className="text-sm font-medium text-muted-foreground">{status.label}</span>
        </span>
      )}
      meta={(
        <>
          <span className="tabular-nums">{lead} {lead === 1 ? "day" : "days"} lead time</span>
          <span className="tabular-nums">{poCounts.all} purchase orders</span>
        </>
      )}
      actions={canManage ? (
        <>
          {supplier.status !== "archived" ? (
            <Button asChild className="rounded-[6px] active:scale-[0.97]"><Link href={`${OPERATIONS_PATH}?purchaseSupplierSearch=${encodeURIComponent(supplier.name || "")}`}>New purchase order</Link></Button>
          ) : null}
          <SupplierDrawer supplier={supplier} />
          <SupplierStatusActions id={supplier.id} name={supplier.name || "supplier"} status={supplier.status || "active"} canDelete={poCounts.all === 0 && lotsCount === 0} />
        </>
      ) : null}
    />
  );

  return (
    <PageContainer title={supplier.name || "Supplier"} header={header} breadcrumbs={breadcrumbs}>
      <div className="space-y-8 px-4 pb-24 md:px-6">
        <dl className="grid grid-cols-1 gap-x-6 gap-y-4 rounded-[6px] border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Contact">{supplier.contactName || "—"}</Field>
          <Field label="Email">{supplier.email ? <a href={`mailto:${supplier.email}`} className="underline decoration-border underline-offset-4 hover:decoration-foreground">{supplier.email}</a> : "—"}</Field>
          <Field label="Phone">{supplier.phone ? <a href={`tel:${supplier.phone.replace(/[^\d+]/g, "")}`} className="underline decoration-border underline-offset-4 hover:decoration-foreground">{supplier.phone}</a> : "—"}</Field>
          <Field label="Website">
            {website ? (
              <a href={website} target="_blank" rel="noopener noreferrer" className="underline decoration-border underline-offset-4 hover:decoration-foreground">{supplier.website}</a>
            ) : supplier.website || "—"}
          </Field>
          <Field label="Lead time">{lead} {lead === 1 ? "day" : "days"}</Field>
          <Field label="Updated">{formatStoreDateTime(supplier.updatedAt, storeTimezone)}</Field>
          {supplier.notes ? <div className="sm:col-span-2 lg:col-span-3"><Field label="Notes"><span className="whitespace-pre-line">{supplier.notes}</span></Field></div> : null}
        </dl>

        <PlatformSection
          id="supplier-pos-heading"
          title="Purchase orders"
          meta={poTotal}
          actions={poPages > 1 ? (
            <nav aria-label="Purchase order pages" className="flex items-center gap-2">
              <span className="text-xs tabular-nums text-muted-foreground">{view.poPage} / {poPages}</span>
              {view.poPage > 1 ? <Button asChild size="sm" variant="outline" className="rounded-[6px]"><Link href={supplierDetailHref(supplier.id, view, { poPage: view.poPage - 1 })} scroll={false}>Newer</Link></Button> : null}
              {view.poPage < poPages ? <Button asChild size="sm" variant="outline" className="rounded-[6px]"><Link href={supplierDetailHref(supplier.id, view, { poPage: view.poPage + 1 })} scroll={false}>Older</Link></Button> : null}
            </nav>
          ) : null}
        >
          <nav aria-label="Purchase order status" className="min-w-0 max-w-full">
            <PillTrack label="Purchase order status">
              {PO_TABS.filter((tab) => tab.value !== "draft" || poCounts.draft > 0).map((tab) => (
                <PillLink key={tab.value} href={supplierDetailHref(supplier.id, view, { po: tab.value, poPage: 1 })} active={view.po === tab.value} count={poCounts[tab.value]}>
                  {tab.label}
                </PillLink>
              ))}
            </PillTrack>
          </nav>
          {purchaseOrders.length ? (
            <PurchaseOrderList orders={purchaseOrders} canManage={canManage} timezone={storeTimezone} revalidate={revalidate} show="item" />
          ) : <PlatformEmpty>{view.poPage > 1 ? "No more purchase orders." : "No purchase orders."}</PlatformEmpty>}
        </PlatformSection>

        <PlatformSection id="supplier-lots-heading" title="Lots" meta={lotsCount}>
          {lots.length ? <LotList lots={lots} timezone={storeTimezone} show="item" /> : <PlatformEmpty>No lots.</PlatformEmpty>}
        </PlatformSection>

        <PlatformSection id="supplier-items-heading" title="Inventory items" meta={itemsCount}>
          {items.length ? (
            <PlatformTable
              label="Inventory items"
              head={[
                { label: "Item" },
                { label: "Status" },
                { label: "On hand", className: "text-right" },
                { label: "Cost / unit", className: "hidden text-right sm:table-cell" },
                { label: <span className="sr-only">Actions</span>, className: "w-0" },
              ]}
            >
              {[...items].sort((a, b) => stockRank(a) - stockRank(b)).map((item) => {
                const stateKey = stockState(item.currentStock, item.reorderPoint);
                const state = STOCK_STATE[stateKey];
                const unit = unitLabel(item.unit);
                return (
                  <tr key={item.id} className="transition-colors hover:bg-muted/30">
                    <td className={cn(platformTd, "min-w-36")}>
                      <Link href={`${INVENTORY_PATH}/${item.id}`} className="font-medium underline-offset-4 hover:underline [overflow-wrap:anywhere]">{item.name || "Item"}</Link>
                      {item.sku ? <p className="text-xs text-muted-foreground">{item.sku}</p> : null}
                    </td>
                    <td className={cn(platformTd, "whitespace-nowrap")}><span className="inline-flex items-center gap-2"><StatusDot tone={state.tone} />{state.label}</span></td>
                    <td className={cn(platformTd, "whitespace-nowrap text-right tabular-nums")}>{formatQuantity(item.currentStock)} <span className="text-muted-foreground">{unit}</span></td>
                    <td className={cn(platformTd, "hidden whitespace-nowrap text-right tabular-nums sm:table-cell")}>{formatCents(item.costPerUnit)}</td>
                    <td className={cn(platformTd, "whitespace-nowrap py-1.5 text-right")}>
                      {canManage && stateKey !== "ok" ? (
                        <Button asChild size="sm" variant="outline" className="h-8 rounded-[6px] active:scale-[0.97]"><Link href={`${OPERATIONS_PATH}?purchaseInventorySearch=${encodeURIComponent(item.name || "")}&purchaseSupplierSearch=${encodeURIComponent(supplier.name || "")}`}>Order</Link></Button>
                      ) : null}
                    </td>
                  </tr>
                );
              })}
            </PlatformTable>
          ) : <PlatformEmpty>No inventory items.</PlatformEmpty>}
        </PlatformSection>
      </div>
    </PageContainer>
  );
}
