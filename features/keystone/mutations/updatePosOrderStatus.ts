import { permissions, type Session } from "../access";
import { assertCoffeeStoreOwnership, enqueueCoffeeDomainEvent, getPrimaryCoffeeStoreId } from "../lib/coffeeDomainOutbox";
import { POS_ORDER_TRANSITIONS, evaluateTransition } from "./transitionPolicy";
import { requireCurrentCoffeeCapability } from "./coffeeKdsAuthority";

type Context = {
  session?: Session;
  prisma: { $transaction<T>(fn: (tx: unknown) => Promise<T>, options: Record<string, unknown>): Promise<T> };
  sudo(): { query: { PosOrder: { findOne(args: { where: { id: string }; query: string }): Promise<unknown> } } };
};
type TransactionClient = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  storeSetting: { findUnique(args: Record<string, unknown>): Promise<{ id: string } | null> };
  posOrder: { findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>; update(args: Record<string, unknown>): Promise<unknown> };
};
const TX_OPTIONS = { maxWait: 5000, timeout: 10000, isolationLevel: "Serializable" };
const query = "id receiptNumber status closedAt store { id }";

export default async function updatePosOrderStatus(_root: unknown, args: { posOrderId: string; status: string }, context: Context) {
  if (!permissions.canManageOrders({ session: context.session })) throw new Error("Not authorized to update POS order status");
  if (args.status === "paid" || args.status === "refunded") throw new Error("POS financial status is controlled by payment settlement and refunds");
  const id = await context.prisma.$transaction(async (rawTx) => {
    await requireCurrentCoffeeCapability(rawTx as never, context.session, ["canManageOrders"], "Not authorized to update POS order status");
    const tx = rawTx as TransactionClient;
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-pos-order:${args.posOrderId}`);
    const existing = await tx.posOrder.findUnique({ where: { id: args.posOrderId } });
    if (!existing) throw new Error("POS order not found");
    const storeId = await getPrimaryCoffeeStoreId(tx as never);
    assertCoffeeStoreOwnership(existing.storeId, storeId, "POS order");
    const transition = evaluateTransition(POS_ORDER_TRANSITIONS, String(existing.status), args.status);
    if (transition.replay) return String(existing.id);
    const now = new Date();
    await tx.posOrder.update({
      where: { id: existing.id },
      data: { status: args.status, ...(["paid", "voided", "refunded"].includes(args.status) ? { closedAt: existing.closedAt || now } : {}) },
    });
    await enqueueCoffeeDomainEvent(tx as never, {
      storeId,
      eventKey: `pos-order:${String(existing.id)}:status:${args.status}:v1`,
      eventType: "pos_order.status_changed",
      aggregateType: "pos_order",
      aggregateId: String(existing.id),
      occurredAt: now,
      payload: { posOrderId: String(existing.id), receiptNumber: String(existing.receiptNumber), previousStatus: String(existing.status), status: args.status },
    });
    return String(existing.id);
  }, TX_OPTIONS);
  return context.sudo().query.PosOrder.findOne({ where: { id }, query });
}
