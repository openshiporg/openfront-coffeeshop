import { permissions, type Session } from "../access";
import type { CoffeeKdsCommandReceipt } from "./coffeeKdsReceipt";
import { requireCurrentCoffeeKdsOperator } from "./coffeeKdsAuthority";
import { buildScopedIdempotencyKey, fingerprintInput, normalizeIdempotencyKey } from "./idempotency";
import { assertCafeSettlement, lockCoffeeOrder, type SettlementEvidence } from "./coffeeOrderPolicy";
import { assertCoffeeStoreOwnership, enqueueCoffeeDomainEvent, getPrimaryCoffeeStoreId } from "../lib/coffeeDomainOutbox";
import {
  advanceKdsOrderStatus,
  evaluateKdsItemTransition,
  isKdsItemStatus,
  rollupCafeOrderStatus,
  type KdsItemStatus,
  type KdsOrderStatus,
} from "./kdsPolicy";

type Context = {
  session?: Session;
  prisma: { $transaction<T>(fn: (tx: unknown) => Promise<T>, options: Record<string, unknown>): Promise<T> };
};
type TransactionClient = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  orderItem: {
    findUnique(args: Record<string, unknown>): Promise<{ id: string; storeId: string; barStatus: string | null; station: string | null; orderId: string | null; quantity?: number; itemNameSnapshot?: string; customizationsSummary?: string | null; queuedAt?: Date | null; startedAt?: Date | null; readyAt?: Date | null; handedOffAt?: Date | null } | null>;
    findMany(args: Record<string, unknown>): Promise<Array<{ barStatus: string | null }>>;
    update(args: Record<string, unknown>): Promise<unknown>;
  };
  cafeOrder: {
    findUnique(args: Record<string, unknown>): Promise<{ id: string; storeId: string; status: string | null; total: number; discount: number; payments?: SettlementEvidence[]; orderNumber?: string; pickupName?: string | null; promisedAt?: Date | null } | null>;
    update(args: Record<string, unknown>): Promise<unknown>;
  };
  storeSetting: { findUnique(args: Record<string, unknown>): Promise<{ id: string } | null> };
  user: { findUnique(args: Record<string, unknown>): Promise<{ id: string; roleId: string | null } | null> };
  role: { findUnique(args: Record<string, unknown>): Promise<{ canManageOrders: boolean } | null> };
  coffeeDomainEvent: { findUnique(args: Record<string, unknown>): Promise<{ storeId: string; aggregateType: string; aggregateId: string; eventType: string; payload: unknown } | null> };
};

const TX_OPTIONS = { maxWait: 5000, timeout: 10000, isolationLevel: "ReadCommitted" };
const TERMINAL_ORDER_STATUSES = new Set(["cancelled", "refunded", "completed"]);
async function committedReceipt(tx: TransactionClient, scope: { itemId: string; orderId: string; storeId: string; actorId: string; idempotencyKey: string; expectedStatus: string; requestedStatus: string }): Promise<CoffeeKdsCommandReceipt> {
  const item = await tx.orderItem.findUnique({ where: { id: scope.itemId }, select: { id: true, storeId: true, orderId: true, quantity: true, itemNameSnapshot: true, customizationsSummary: true, barStatus: true, station: true, queuedAt: true, startedAt: true, readyAt: true, handedOffAt: true } });
  const order = await tx.cafeOrder.findUnique({ where: { id: scope.orderId }, select: { id: true, storeId: true, orderNumber: true, status: true, pickupName: true, promisedAt: true } });
  if (!item || !order || item.id !== scope.itemId || item.orderId !== scope.orderId || order.id !== scope.orderId || item.storeId !== scope.storeId || order.storeId !== scope.storeId) throw new Error("KDS committed projection scope changed");
  if (!item.barStatus || !isKdsItemStatus(item.barStatus) || !Number.isSafeInteger(item.quantity) || Number(item.quantity) < 1 || typeof item.itemNameSnapshot !== "string" || typeof order.orderNumber !== "string" || !order.status) throw new Error("KDS committed projection is invalid");
  const instant = (value: Date | null | undefined) => value == null ? null : value.toISOString();
  // Only primitive copied facts escape the transaction. Custom GraphQL output
  // types have default DTO resolvers, not live Keystone relationship resolvers.
  return {
    id: item.id, quantity: Number(item.quantity), itemNameSnapshot: item.itemNameSnapshot,
    customizationsSummary: item.customizationsSummary ?? null, barStatus: item.barStatus, station: item.station,
    queuedAt: instant(item.queuedAt), startedAt: instant(item.startedAt), readyAt: instant(item.readyAt), handedOffAt: instant(item.handedOffAt),
    idempotencyKey: scope.idempotencyKey, expectedStatus: scope.expectedStatus, requestedStatus: scope.requestedStatus,
    actorId: scope.actorId, storeId: scope.storeId,
    order: { id: order.id, orderNumber: order.orderNumber, status: order.status, pickupName: order.pickupName ?? null, promisedAt: instant(order.promisedAt) },
  };
}

function itemTimestamp(status: KdsItemStatus) {
  if (status === "queued") return "queuedAt";
  if (status === "preparing") return "startedAt";
  if (status === "ready") return "readyAt";
  if (status === "handed_off") return "handedOffAt";
  return null;
}

function orderTimestamp(status: KdsOrderStatus) {
  if (status === "preparing") return "startedAt";
  if (status === "ready") return "readyAt";
  if (status === "completed") return "completedAt";
  return null;
}

export default async function updateCafeOrderItemStatus(
  _root: unknown,
  args: { orderItemId: string; status: string; expectedStatus?: string; idempotencyKey?: string },
  context: Context,
) {
  if (!permissions.canManageOrders({ session: context.session })) throw new Error("Not authorized to operate the KDS");
  if (!isKdsItemStatus(args.status)) throw new Error(`Unsupported KDS item status: ${args.status}`);
  const status = args.status;
  if (status === "voided") throw new Error("Partial item voids are not supported. Cancel an unstarted unpaid ticket or use the full refund workflow.");
  if (!args.orderItemId || !args.expectedStatus || !isKdsItemStatus(args.expectedStatus)) throw new Error("KDS item and expected status are required");
  const clientKey = normalizeIdempotencyKey(args.idempotencyKey);
  if (!clientKey) throw new Error("KDS command idempotency key is required");
  const commandKey = buildScopedIdempotencyKey(`kds:${context.session?.itemId}`, clientKey);
  const eventKey = `kds-command:${commandKey}`;
  const expectedStatus = args.expectedStatus;
  const requestFingerprint = fingerprintInput({ orderItemId: args.orderItemId, expectedStatus, status });

  return context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx as TransactionClient;
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-kds-command:${commandKey}`);
    // Current authority before any private line lookup, and again after the parent lock wait.
    const admittedActorId = await requireCurrentCoffeeKdsOperator(tx, context.session);
    let item = await tx.orderItem.findUnique({ where: { id: args.orderItemId }, select: { id: true, storeId: true, barStatus: true, station: true, orderId: true } });
    if (!item?.orderId) throw new Error("KDS order item not found");
    const locatedOrderId = item.orderId;
    await lockCoffeeOrder(tx, locatedOrderId);
    const actorId = await requireCurrentCoffeeKdsOperator(tx, context.session);
    if (actorId !== admittedActorId) throw new Error("Not authorized to operate the KDS");
    item = await tx.orderItem.findUnique({ where: { id: args.orderItemId }, select: { id: true, storeId: true, barStatus: true, station: true, orderId: true } });
    if (!item?.orderId || item.orderId !== locatedOrderId || !item.barStatus || !isKdsItemStatus(item.barStatus)) throw new Error("KDS order item is invalid");
    const order = await tx.cafeOrder.findUnique({ where: { id: item.orderId }, select: { id: true, storeId: true, status: true, total: true, discount: true, payments: { select: { status: true, amount: true, refundIdempotencyKey: true } } } });
    if (!order || !order.status) throw new Error("KDS cafe order not found");
    const storeId = await getPrimaryCoffeeStoreId(tx as never);
    assertCoffeeStoreOwnership(order.storeId, storeId, "Cafe order");
    assertCoffeeStoreOwnership(item.storeId, storeId, "KDS order item");
    if (order.status === "open") throw new Error("Cannot bump an item before the pickup request is accepted");
    if (status === "handed_off") assertCafeSettlement(order.payments || [], Number(order.total) - Number(order.discount || 0));
    if (["cancelled", "refunded"].includes(order.status)) throw new Error(`Cannot bump an item on a ${order.status} order`);
    if (!["accepted", "paid", "in_bar_queue", "preparing", "ready", "completed"].includes(order.status)) throw new Error("KDS cafe order state is invalid");

    const receipt = await tx.coffeeDomainEvent.findUnique({ where: { eventKey } });
    if (receipt) {
      const payload = receipt.payload && typeof receipt.payload === "object" ? receipt.payload as Record<string, unknown> : {};
      if (receipt.storeId !== storeId || receipt.aggregateType !== "order_item" || receipt.aggregateId !== item.id || receipt.eventType !== "kitchen_item.status_changed" || payload.orderId !== order.id || payload.actorId !== actorId || payload.requestFingerprint !== requestFingerprint) {
        throw new Error("KDS command key was reused with a different request");
      }
      return committedReceipt(tx, { itemId: item.id, orderId: order.id, storeId, actorId, idempotencyKey: clientKey, expectedStatus, requestedStatus: status });
    }
    if (TERMINAL_ORDER_STATUSES.has(order.status)) throw new Error(`Cannot bump an item on a ${order.status} order`);
    if (item.barStatus !== args.expectedStatus) throw new Error("KDS item changed; refresh before issuing a new command");
    const transition = evaluateKdsItemTransition(item.barStatus, status);
    if (transition.replay) throw new Error("KDS status replay requires the original command key");

    const now = new Date();
    const timestamp = itemTimestamp(status);
    await tx.orderItem.update({
      where: { id: item.id },
      data: { barStatus: status, ...(timestamp ? { [timestamp]: now } : {}) },
    });

    const siblings = await tx.orderItem.findMany({ where: { orderId: item.orderId }, select: { barStatus: true } });
    const statuses = siblings.map((sibling) => {
      if (!sibling.barStatus || !isKdsItemStatus(sibling.barStatus)) throw new Error("KDS sibling item state is invalid");
      return sibling.barStatus;
    });
    if (!statuses.length) throw new Error("KDS order has no items to roll up");
    const orderStatus = advanceKdsOrderStatus(order.status, rollupCafeOrderStatus(statuses));
    if (orderStatus !== order.status) {
      const timestampField = orderTimestamp(orderStatus);
      await tx.cafeOrder.update({
        where: { id: order.id },
        data: { status: orderStatus, ...(timestampField ? { [timestampField]: now } : {}) },
      });
    }
    await enqueueCoffeeDomainEvent(tx as never, {
      storeId,
      eventKey,
      eventType: "kitchen_item.status_changed",
      aggregateType: "order_item",
      aggregateId: item.id,
      occurredAt: now,
      payload: { actorId, requestFingerprint, orderItemId: item.id, orderId: order.id, station: item.station || "unassigned", previousStatus: item.barStatus, status, orderStatus },
    });
    return committedReceipt(tx, { itemId: item.id, orderId: order.id, storeId, actorId, idempotencyKey: clientKey, expectedStatus, requestedStatus: status });
  }, TX_OPTIONS);
}
