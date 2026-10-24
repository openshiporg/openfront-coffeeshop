import { permissions, type Session } from "../access";
import { assertCoffeeStoreOwnership, enqueueCoffeeDomainEvent, getPrimaryCoffeeStoreId } from "../lib/coffeeDomainOutbox";
import { CAFE_ORDER_TRANSITIONS, evaluateTransition } from "./transitionPolicy";
import { requireCurrentCoffeeCapability } from "./coffeeKdsAuthority";
import { assertCafeOrderItemsReadyForHandoff, assertCafeSettlement, lockCoffeeOrder, type SettlementEvidence } from "./coffeeOrderPolicy";
import { releaseAbandonedOnlinePayments } from "./onlinePaymentRelease";

const allowedStatuses = ["open", "accepted", "paid", "in_bar_queue", "preparing", "ready", "completed", "cancelled", "refunded"] as const;
type CafeOrderStatus = (typeof allowedStatuses)[number];
type CafeOrderTimestampField = "startedAt" | "readyAt" | "completedAt" | "cancelledAt" | "paidAt";
type OrderItemBarStatus = "queued" | "preparing" | "ready" | "handed_off" | "voided";
type OrderItemTimestampField = "queuedAt" | "startedAt" | "readyAt" | "handedOffAt";
type OrderRecord = { id: string; storeId: string; orderNumber: string; status: CafeOrderStatus; total: number; discount: number; payments: SettlementEvidence[]; orderItems: Array<{ id: string; barStatus: string }> };
type TransactionClient = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  storeSetting: { findUnique(args: Record<string, unknown>): Promise<{ id: string } | null> };
  cafeOrder: {
    findUnique(args: Record<string, unknown>): Promise<OrderRecord | null>;
    update(args: Record<string, unknown>): Promise<unknown>;
  };
  orderItem: { updateMany(args: Record<string, unknown>): Promise<{ count: number }> };
  stockMovement: {
    findMany(args: Record<string, unknown>): Promise<Array<{ inventoryItemId: string; inventoryLotId?: string | null; quantity: unknown }>>;
    create(args: Record<string, unknown>): Promise<unknown>;
  };
  inventoryItem: { update(args: Record<string, unknown>): Promise<unknown> };
  prepBatchConsumption: { findMany(args: Record<string, unknown>): Promise<Array<{ id: string; prepBatchId: string; quantity: unknown }>>; create(args: Record<string, unknown>): Promise<unknown> };
  prepBatch: { findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>; update(args: Record<string, unknown>): Promise<unknown> };
  inventoryLot: {
    findUnique(args: Record<string, unknown>): Promise<{ quantityRemaining: unknown; status?: string | null; expiresAt?: Date | string | null } | null>;
    update(args: Record<string, unknown>): Promise<unknown>;
  };
};
type Context = {
  session?: Session;
  prisma: { $transaction<T>(fn: (tx: unknown) => Promise<T>, options: Record<string, unknown>): Promise<T> };
  sudo(): { query: { CafeOrder: { findOne(args: { where: { id: string }; query: string }): Promise<unknown> } } };
};

const TX_OPTIONS = { maxWait: 5000, timeout: 10000, isolationLevel: "ReadCommitted" };
const ORDER_QUERY = "id orderNumber status startedAt readyAt completedAt cancelledAt orderItems { id barStatus }";
const statusTimestampMap: Partial<Record<CafeOrderStatus, CafeOrderTimestampField>> = {
  preparing: "startedAt",
  ready: "readyAt",
  completed: "completedAt",
  cancelled: "cancelledAt",
  paid: "paidAt",
};
const itemStatusMap: Partial<Record<CafeOrderStatus, OrderItemBarStatus>> = {
  in_bar_queue: "queued",
  preparing: "preparing",
  ready: "ready",
  completed: "handed_off",
  cancelled: "voided",
};
const itemTimestampMap: Partial<Record<OrderItemBarStatus, OrderItemTimestampField>> = {
  queued: "queuedAt",
  preparing: "startedAt",
  ready: "readyAt",
  handed_off: "handedOffAt",
};

function isCafeOrderStatus(status: string): status is CafeOrderStatus {
  return (allowedStatuses as readonly string[]).includes(status);
}

export default async function updateCafeOrderStatus(
  _root: unknown,
  args: { orderId: string; status: string },
  context: Context,
) {
  if (!permissions.canManageOrders({ session: context.session })) throw new Error("Not authorized to update cafe order status");
  if (!isCafeOrderStatus(args.status)) throw new Error(`Unsupported cafe order status: ${args.status}`);
  if (args.status === "paid" || args.status === "refunded") {
    throw new Error(`Cafe order ${args.status} status is controlled by payment settlement`);
  }
  const status = args.status;
  if (status === "cancelled") await releaseAbandonedOnlinePayments(context.prisma as never, args.orderId);

  const orderId = await context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx as TransactionClient;
    await lockCoffeeOrder(tx, args.orderId);
    const actorId = await requireCurrentCoffeeCapability(rawTx as never, context.session, ["canManageOrders"], "Not authorized to update cafe order status");
    const existing = await tx.cafeOrder.findUnique({ where: { id: args.orderId }, include: { orderItems: { select: { id: true, barStatus: true } }, payments: { select: { status: true, amount: true, refundIdempotencyKey: true } } } });
    if (!existing) throw new Error("Cafe order not found");
    const storeId = await getPrimaryCoffeeStoreId(tx as never);
    assertCoffeeStoreOwnership(existing.storeId, storeId, "Cafe order");
    const transition = evaluateTransition(CAFE_ORDER_TRANSITIONS, existing.status, status);
    if (transition.replay) return existing.id;
    if (status === "ready" || status === "completed") assertCafeOrderItemsReadyForHandoff(existing.orderItems);
    if (status === "completed") assertCafeSettlement(existing.payments, Number(existing.total) - Number(existing.discount || 0));
    if (status === "cancelled" && existing.payments.some((payment) => ["pending", "authorized", "captured"].includes(String(payment.status)))) throw new Error("Resolve the payment attempt or refund before cancelling this order");

    const now = new Date();
    if (status === "cancelled") {
      const reservations = await tx.stockMovement.findMany({
        where: { orderId: existing.id, type: "sale" },
        orderBy: { id: "asc" },
        select: { inventoryItemId: true, inventoryLotId: true, quantity: true },
      });
      const inventoryTotals = new Map<string, number>();
      for (const inventoryItemId of [...new Set(reservations.map((reservation) => reservation.inventoryItemId))].sort()) {
        await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-inventory:${inventoryItemId}`);
      }
      for (const reservation of reservations) {
        const quantity = Math.abs(Number(reservation.quantity));
        if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Order inventory reservation evidence is invalid");
        inventoryTotals.set(reservation.inventoryItemId, (inventoryTotals.get(reservation.inventoryItemId) || 0) + quantity);
        // Only a lot this reservation emptied ("consumed") may become usable again, and only while unexpired.
        // A later quarantine, expiry or other hold is kept: released quantity is not proof the stock is saleable.
        let lotDisposition = "unlotted stock";
        if (reservation.inventoryLotId) {
          const lot = await tx.inventoryLot.findUnique({ where: { id: reservation.inventoryLotId }, select: { quantityRemaining: true, status: true, expiresAt: true } });
          if (!lot) throw new Error("Reserved inventory lot was not found");
          const currentStatus = lot.status || "active";
          const expired = Boolean(lot.expiresAt) && new Date(String(lot.expiresAt)).getTime() <= now.getTime();
          const nextStatus = currentStatus === "consumed" ? (expired ? "expired" : "active") : currentStatus === "active" && expired ? "expired" : currentStatus;
          await tx.inventoryLot.update({
            where: { id: reservation.inventoryLotId },
            data: { quantityRemaining: Number(lot.quantityRemaining || 0) + quantity, ...(nextStatus !== currentStatus ? { status: nextStatus } : {}) },
          });
          lotDisposition = `lot status ${nextStatus}`;
        }
        await tx.stockMovement.create({
          data: {
            inventoryItemId: reservation.inventoryItemId,
            inventoryLotId: reservation.inventoryLotId || null,
            storeId,
            orderId: existing.id,
            type: "return",
            quantity,
            reason: `Cancelled pickup order ${existing.orderNumber}`,
            notes: `Released unprepared order reservation; ${lotDisposition}`,
            createdById: actorId,
          },
        });
      }
      for (const [inventoryItemId, quantity] of [...inventoryTotals].sort(([left], [right]) => left.localeCompare(right))) {
        await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-inventory:${inventoryItemId}`);
        await tx.inventoryItem.update({ where: { id: inventoryItemId }, data: { currentStock: { increment: quantity } } });
      }
      const prepConsumptions = await tx.prepBatchConsumption.findMany({ where: { orderId: existing.id, quantity: { gt: 0 } }, orderBy: { id: "asc" }, select: { id: true, prepBatchId: true, quantity: true } });
      for (const consumption of prepConsumptions) {
        const quantity = Number(consumption.quantity);
        await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-prep-batch:${consumption.prepBatchId}`);
        const batch = await tx.prepBatch.findUnique({ where: { id: consumption.prepBatchId }, select: { id: true, storeId: true, quantityRemaining: true } });
        if (!batch || String(batch.storeId) !== storeId || !Number.isFinite(quantity) || quantity <= 0) throw new Error("Prepared batch reservation evidence is invalid");
        await tx.prepBatch.update({ where: { id: consumption.prepBatchId }, data: { quantityRemaining: { increment: quantity } } });
        await tx.prepBatchConsumption.create({ data: { idempotencyKey: `cancel:${existing.id}:${consumption.id}`, storeId, orderId: existing.id, prepBatchId: consumption.prepBatchId, quantity: -quantity } });
      }
    }
    const timestampField = statusTimestampMap[status];
    await tx.cafeOrder.update({
      where: { id: existing.id },
      data: { status, ...(timestampField ? { [timestampField]: now } : {}) },
    });
    const itemStatus = itemStatusMap[status];
    if (itemStatus && existing.orderItems.length) {
      const itemTimestamp = itemTimestampMap[itemStatus];
      const updated = await tx.orderItem.updateMany({
        where: { orderId: existing.id, barStatus: { in: itemStatus === "preparing" ? ["new", "queued"] : itemStatus === "ready" ? ["new", "queued", "preparing"] : itemStatus === "queued" ? ["new"] : ["new", "queued", "preparing", "ready"] } },
        data: { barStatus: itemStatus, ...(itemTimestamp ? { [itemTimestamp]: now } : {}) },
      });
      if (updated.count > existing.orderItems.length) throw new Error("Cafe order item status propagation was invalid");
    }
    await enqueueCoffeeDomainEvent(tx as never, {
      storeId,
      eventKey: `order:${existing.id}:status:${status}:v1`,
      eventType: "order.status_changed",
      aggregateType: "order",
      aggregateId: existing.id,
      occurredAt: now,
      payload: { orderId: existing.id, orderNumber: existing.orderNumber, previousStatus: existing.status, status, itemStatus: itemStatus || null, inventoryReleased: status === "cancelled" },
    });
    return existing.id;
  }, TX_OPTIONS);

  return context.sudo().query.CafeOrder.findOne({ where: { id: orderId }, query: ORDER_QUERY });
}
