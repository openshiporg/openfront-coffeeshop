import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";

import { StatusTitle } from "@/features/platform/components/StatusTitle";
import { formatStoreDateTime } from "@/lib/date-time";
import { CancelPurchaseOrderButton } from "./CancelPurchaseOrderButton";
import { formatCents, formatQuantity, INVENTORY_PATH, LOT_STATUS, PO_STATUS, SUPPLIERS_PATH, unitLabel } from "../lib/inventory";
import type { InventoryLotRow, PurchaseOrderRow } from "../lib/types";

/** Link to another record or page: always carries the up-right arrow. */
export function RecordLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="inline-flex items-center gap-0.5 font-medium underline-offset-4 hover:underline">
      {children}<ArrowUpRight className="size-3.5 shrink-0" aria-hidden="true" />
    </Link>
  );
}

function lotOrder(lot: InventoryLotRow) {
  return lot.status === "active" ? 0 : 1;
}

export function PurchaseOrderList({
  orders,
  canManage,
  timezone,
  revalidate,
  show,
}: {
  orders: PurchaseOrderRow[];
  canManage: boolean;
  timezone: string | null;
  revalidate: string[];
  show: "supplier" | "item";
}) {
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {orders.map((order) => {
        const status = PO_STATUS[order.status || ""] ?? { label: order.status || "Unknown", tone: "zinc" as const };
        const unit = unitLabel(order.inventoryItem?.unit);
        const cancellable = canManage && (order.status === "submitted" || order.status === "draft");
        return (
          <li key={order.id} className="flex flex-col gap-2 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <StatusTitle as="p" tone={status.tone} status={status.label} className="text-sm font-semibold">{order.poNumber || "Purchase order"}</StatusTitle>
              <p className="text-sm text-muted-foreground">
                {show === "supplier"
                  ? (order.supplier ? <RecordLink href={`${SUPPLIERS_PATH}/${order.supplier.id}`}>{order.supplier.name || "Supplier"}</RecordLink> : "No supplier")
                  : (order.inventoryItem ? <RecordLink href={`${INVENTORY_PATH}/${order.inventoryItem.id}`}>{order.inventoryItem.name || "Item"}</RecordLink> : "No item")}
              </p>
              <p className="text-xs tabular-nums text-muted-foreground">
                {formatQuantity(order.orderedQuantity)} {unit} × {formatCents(order.unitCostCents)} = {formatCents(order.subtotalCents)}
              </p>
              <p className="text-xs text-muted-foreground">
                Expected {formatStoreDateTime(order.expectedAt, timezone)}{order.receivedAt ? ` · Received ${formatStoreDateTime(order.receivedAt, timezone)}` : ""}
              </p>
            </div>
            {cancellable ? <div className="shrink-0"><CancelPurchaseOrderButton purchaseOrderId={order.id} poNumber={order.poNumber} revalidate={revalidate} /></div> : null}
          </li>
        );
      })}
    </ul>
  );
}

export function LotList({ lots, timezone, show }: { lots: InventoryLotRow[]; timezone: string | null; show: "supplier" | "item" }) {
  const sorted = [...lots].sort((a, b) => lotOrder(a) - lotOrder(b));
  return (
    <ul className="divide-y divide-border rounded-xl border border-border bg-card">
      {sorted.map((lot) => {
        const status = LOT_STATUS[lot.status || ""] ?? { label: lot.status || "Unknown", tone: "zinc" as const };
        const unit = unitLabel(lot.inventoryItem?.unit);
        return (
          <li key={lot.id} className="flex flex-col gap-1 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0 space-y-1">
              <StatusTitle as="p" tone={status.tone} status={status.label} className="text-sm font-semibold">Lot {lot.lotNumber}</StatusTitle>
              <p className="text-sm text-muted-foreground">
                {show === "supplier"
                  ? (lot.supplier ? <RecordLink href={`${SUPPLIERS_PATH}/${lot.supplier.id}`}>{lot.supplier.name || "Supplier"}</RecordLink> : "No supplier")
                  : (lot.inventoryItem ? <RecordLink href={`${INVENTORY_PATH}/${lot.inventoryItem.id}`}>{lot.inventoryItem.name || "Item"}</RecordLink> : "No item")}
                {lot.purchaseOrder?.poNumber ? ` · ${lot.purchaseOrder.poNumber}` : ""}
              </p>
              <p className="text-xs text-muted-foreground">
                Received {formatStoreDateTime(lot.receivedAt, timezone)} · Expires {formatStoreDateTime(lot.expiresAt, timezone)}
              </p>
            </div>
            <div className="shrink-0 text-sm tabular-nums sm:text-right">
              <p className="font-medium">{formatQuantity(lot.quantityRemaining)} / {formatQuantity(lot.quantityReceived)} {unit}</p>
              <p className="text-xs text-muted-foreground">{formatCents(lot.unitCostCents)} / unit</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

