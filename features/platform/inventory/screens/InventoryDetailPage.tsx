import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/features/dashboard/components/PageContainer";
import { PlatformEmpty, PlatformHeader, PlatformSection } from "@/features/platform/components/PlatformPage";
import { StatusDot } from "@/features/platform/components/StatusTitle";
import { formatStoreDateTime } from "@/lib/date-time";
import { loadInventoryDetail } from "../actions/inventory";
import { InventoryItemDrawer } from "../components/InventoryItemDrawer";
import { LotList, PurchaseOrderList, RecordLink } from "../components/PurchasingLists";
import {
  categoryLabel,
  formatCents,
  formatQuantity,
  INVENTORY_PATH,
  MOVEMENT_PAGE_SIZE,
  MOVEMENT_TYPE_LABELS,
  OPERATIONS_PATH,
  STOCK_STATE,
  SUPPLIERS_PATH,
  stockState,
  toNumber,
  unitLabel,
  WASTE_REASON_LABELS,
} from "../lib/inventory";
import type { StockMovementRow } from "../lib/types";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm tabular-nums [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

function movementLinks(movement: StockMovementRow): ReactNode[] {
  const links: ReactNode[] = [];
  if (movement.order) links.push(<RecordLink key="order" href={`/dashboard/platform/orders?search=${encodeURIComponent(movement.order.orderNumber || "")}`}>Order #{movement.order.orderNumber}</RecordLink>);
  if (movement.purchaseOrder) links.push(<span key="po">{movement.purchaseOrder.poNumber}</span>);
  if (movement.inventoryLot) links.push(<span key="lot">Lot {movement.inventoryLot.lotNumber}</span>);
  if (movement.prepBatch) links.push(<span key="prep">Batch {movement.prepBatch.batchNumber}</span>);
  if (movement.wasteLog) links.push(<span key="waste">{movement.wasteLog.logNumber}</span>);
  return links;
}

export async function InventoryDetailPage({ id, movementPage }: { id: string; movementPage: number }) {
  const result = await loadInventoryDetail(id, movementPage);
  if (result.success && !result.data.item) notFound();

  const breadcrumbs = [
    { type: "link" as const, label: "Dashboard", href: "/dashboard" },
    { type: "link" as const, label: "Inventory", href: INVENTORY_PATH },
    { type: "page" as const, label: result.success ? result.data.item?.name || "Item" : "Item" },
  ];

  if (!result.success) {
    return (
      <PageContainer title="Inventory item" header={<PlatformHeader title="Inventory item" />} breadcrumbs={breadcrumbs}>
        <div className="px-4 pb-8 md:px-6">
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <p className="font-medium">Unable to load this item.</p>
            <Button asChild variant="outline" className="rounded-full"><Link href={`${INVENTORY_PATH}/${id}`}>Try again</Link></Button>
          </div>
        </div>
      </PageContainer>
    );
  }

  const { item, movements, canManage, hasHistory, supplier, supplierNames, storeTimezone } = result.data;
  if (!item) notFound();
  const unit = unitLabel(item.unit);
  const state = STOCK_STATE[stockState(item.currentStock, item.reorderPoint)];
  const toPar = Math.max(0, toNumber(item.parLevel) - toNumber(item.currentStock));
  const movementTotal = item.stockMovementsCount ?? 0;
  const movementPages = Math.max(1, Math.ceil(movementTotal / MOVEMENT_PAGE_SIZE));
  const detailPath = `${INVENTORY_PATH}/${item.id}`;
  const lotsWithUnit = item.inventoryLots.map((lot) => ({ ...lot, inventoryItem: { id: item.id, name: item.name, unit: item.unit } }));
  const revalidate = [detailPath, INVENTORY_PATH, ...item.purchaseOrders.flatMap((order) => (order.supplier ? [`${SUPPLIERS_PATH}/${order.supplier.id}`] : []))];

  const header = (
    <PlatformHeader
      title={(
        <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-2">
          <span className="inline-flex min-w-0 items-center gap-2"><StatusDot tone={state.tone} className="size-2.5" /><span className="[overflow-wrap:anywhere]">{item.name || "Untitled item"}</span></span>
          <span className="text-sm font-medium text-muted-foreground">{state.label}</span>
        </span>
      )}
      meta={(
        <>
          <span className="tabular-nums">{formatQuantity(item.currentStock)} {unit} on hand</span>
          <span>{categoryLabel(item.category)}</span>
          {item.sku ? <span>SKU {item.sku}</span> : null}
        </>
      )}
      actions={(
        <>
          {canManage ? <InventoryItemDrawer item={item} supplierNames={supplierNames} unitLocked={hasHistory} /> : null}
          <Button asChild variant="outline" className="rounded-full"><Link href={OPERATIONS_PATH}>Count stock<ArrowUpRight className="size-4" aria-hidden="true" /></Link></Button>
          <Button asChild variant="outline" className="rounded-full"><Link href={`${OPERATIONS_PATH}?purchaseInventorySearch=${encodeURIComponent(item.name || "")}`}>Order stock<ArrowUpRight className="size-4" aria-hidden="true" /></Link></Button>
          <Button asChild variant="outline" className="rounded-full"><Link href={`${OPERATIONS_PATH}?inventoryWasteSearch=${encodeURIComponent(item.name || "")}`}>Waste<ArrowUpRight className="size-4" aria-hidden="true" /></Link></Button>
        </>
      )}
    />
  );

  return (
    <PageContainer title={item.name || "Inventory item"} header={header} breadcrumbs={breadcrumbs}>
      <div className="space-y-8 px-4 pb-24 md:px-6">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-4 rounded-xl border border-border bg-card p-4 sm:grid-cols-3 lg:grid-cols-4">
          <Field label="On hand">{formatQuantity(item.currentStock)} {unit}</Field>
          <Field label="Reorder point">{formatQuantity(item.reorderPoint)} {unit}</Field>
          <Field label="Par level">{formatQuantity(item.parLevel)} {unit}</Field>
          <Field label="To par">{formatQuantity(toPar)} {unit}</Field>
          <Field label="Cost / unit">{formatCents(item.costPerUnit)}</Field>
          <Field label="Unit">{unit}</Field>
          <Field label="Supplier">
            {supplier ? <RecordLink href={`${SUPPLIERS_PATH}/${supplier.id}`}>{item.supplierName}</RecordLink> : item.supplierName || "—"}
          </Field>
          <Field label="Updated">{formatStoreDateTime(item.updatedAt, storeTimezone)}</Field>
        </dl>

        <PlatformSection id="menu-items-heading" title="Menu items" meta={item.menuItemsCount ?? item.menuItems.length}>
          {item.menuItems.length ? (
            <ul className="flex flex-wrap gap-2">
              {item.menuItems.map((menuItem) => (
                <li key={menuItem.id} className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-sm">
                  <StatusDot tone={menuItem.available ? "green" : "zinc"} />
                  <Link href="/dashboard/platform/menu" className="inline-flex items-center gap-0.5 hover:underline">
                    {menuItem.name || "Menu item"}<ArrowUpRight className="size-3.5" aria-hidden="true" />
                  </Link>
                  <span className="tabular-nums text-muted-foreground">{formatCents(menuItem.price)}</span>
                </li>
              ))}
            </ul>
          ) : <PlatformEmpty>No linked menu items.</PlatformEmpty>}
        </PlatformSection>

        <PlatformSection
          id="movements-heading"
          title="Stock movements"
          meta={movementTotal}
          actions={movementPages > 1 ? (
            <nav aria-label="Movement pages" className="flex items-center gap-2">
              <span className="text-xs tabular-nums text-muted-foreground">{movementPage} / {movementPages}</span>
              {movementPage > 1 ? <Button asChild size="sm" variant="outline" className="rounded-full"><Link href={`${detailPath}${movementPage > 2 ? `?movements=${movementPage - 1}` : ""}`} scroll={false}>Newer</Link></Button> : null}
              {movementPage < movementPages ? <Button asChild size="sm" variant="outline" className="rounded-full"><Link href={`${detailPath}?movements=${movementPage + 1}`} scroll={false}>Older</Link></Button> : null}
            </nav>
          ) : null}
        >
          {movements.length ? (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {movements.map((movement) => {
                const quantity = toNumber(movement.quantity);
                const links = movementLinks(movement);
                return (
                  <li key={movement.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 space-y-0.5">
                      <p className="text-sm font-medium">{MOVEMENT_TYPE_LABELS[movement.type || ""] || movement.type || "Movement"}{movement.reason ? <span className="font-normal text-muted-foreground"> · {movement.reason}</span> : null}</p>
                      {movement.notes ? <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{movement.notes}</p> : null}
                      <p className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
                        <span>{formatStoreDateTime(movement.createdAt, storeTimezone)}</span>
                        {movement.createdBy?.name ? <span>{movement.createdBy.name}</span> : null}
                        {links}
                      </p>
                    </div>
                    <p className={`shrink-0 text-sm font-semibold tabular-nums ${quantity < 0 ? "text-red-600 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>
                      {quantity > 0 ? "+" : ""}{formatQuantity(quantity)} {unit}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : <PlatformEmpty>{movementPage > 1 ? "No more movements." : "No stock movements."}</PlatformEmpty>}
        </PlatformSection>

        <PlatformSection id="lots-heading" title="Lots" meta={item.inventoryLotsCount ?? item.inventoryLots.length}>
          {lotsWithUnit.length ? <LotList lots={lotsWithUnit} timezone={storeTimezone} show="supplier" /> : <PlatformEmpty>No lots.</PlatformEmpty>}
        </PlatformSection>

        <PlatformSection id="purchase-orders-heading" title="Purchase orders" meta={item.purchaseOrdersCount ?? item.purchaseOrders.length}>
          {item.purchaseOrders.length ? (
            <PurchaseOrderList orders={item.purchaseOrders} canManage={canManage} timezone={storeTimezone} revalidate={revalidate} show="supplier" />
          ) : <PlatformEmpty>No purchase orders.</PlatformEmpty>}
        </PlatformSection>

        <PlatformSection id="waste-heading" title="Waste" meta={item.wasteLogsCount ?? item.wasteLogs.length}>
          {item.wasteLogs.length ? (
            <ul className="divide-y divide-border rounded-xl border border-border bg-card">
              {item.wasteLogs.map((log) => (
                <li key={log.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-sm font-medium">{log.logNumber}<span className="font-normal text-muted-foreground"> · {WASTE_REASON_LABELS[log.reason || ""] || log.reason}</span></p>
                    {log.notes ? <p className="text-sm text-muted-foreground [overflow-wrap:anywhere]">{log.notes}</p> : null}
                    <p className="text-xs text-muted-foreground">{formatStoreDateTime(log.loggedAt, storeTimezone)}{log.loggedBy?.name ? ` · ${log.loggedBy.name}` : ""}</p>
                  </div>
                  <div className="shrink-0 text-sm tabular-nums sm:text-right">
                    <p className="font-medium">{formatQuantity(log.quantity)} {log.unit || unit}</p>
                    <p className="text-xs text-muted-foreground">{formatCents(log.costCents)}</p>
                  </div>
                </li>
              ))}
            </ul>
          ) : <PlatformEmpty>No waste logged.</PlatformEmpty>}
        </PlatformSection>
      </div>
    </PageContainer>
  );
}
