import { permissions, type Session } from "../access";
import { assertCoffeeStoreOwnership, enqueueCoffeeDomainEvent, getPrimaryCoffeeStoreId } from "../lib/coffeeDomainOutbox";
import { requireCurrentCoffeeCapability } from "./coffeeKdsAuthority";
import { CATERING_ORDER_TRANSITIONS, evaluateTransition } from "./transitionPolicy";

type Context = {
  session?: Session;
  prisma: { $transaction<T>(fn: (tx: unknown) => Promise<T>, options: Record<string, unknown>): Promise<T> };
  sudo(): { query: { CateringOrder: { findOne(args: { where: { id: string }; query: string }): Promise<unknown> } } };
};
type TransactionClient = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  storeSetting: { findUnique(args: Record<string, unknown>): Promise<{ id: string } | null> };
  cateringOrder: { findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>; update(args: Record<string, unknown>): Promise<unknown> };
  user: { findUnique(args: Record<string, unknown>): Promise<{ id: string; roleId: string | null } | null> };
  role: { findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null> };
};
const TX_OPTIONS = { maxWait: 5000, timeout: 10000, isolationLevel: "Serializable" };
const query = "id cateringNumber status store { id }";

export default async function updateCateringOrderStatus(_root: unknown, args: { cateringOrderId: string; status: string }, context: Context) {
  if (!permissions.canManageOrders({ session: context.session })) throw new Error("Not authorized to update catering order status");
  const id = await context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx as TransactionClient;
    await requireCurrentCoffeeCapability(tx, context.session, ["canManageOrders"], "Not authorized to update catering order status");
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-catering:${args.cateringOrderId}`);
    const existing = await tx.cateringOrder.findUnique({ where: { id: args.cateringOrderId } });
    if (!existing) throw new Error("Catering order not found");
    const storeId = await getPrimaryCoffeeStoreId(tx as never);
    assertCoffeeStoreOwnership(existing.storeId, storeId, "Catering order");
    const transition = evaluateTransition(CATERING_ORDER_TRANSITIONS, String(existing.status), args.status);
    if (transition.replay) return String(existing.id);
    await tx.cateringOrder.update({ where: { id: existing.id }, data: { status: args.status } });
    await enqueueCoffeeDomainEvent(tx as never, {
      storeId,
      eventKey: `catering:${String(existing.id)}:status:${args.status}:v1`,
      eventType: "catering.status_changed",
      aggregateType: "catering_order",
      aggregateId: String(existing.id),
      // Snapshot the terms the transition was accepted against.
      payload: {
        cateringOrderId: String(existing.id), cateringNumber: String(existing.cateringNumber), previousStatus: String(existing.status), status: args.status,
        terms: { eventAt: existing.eventAt instanceof Date ? existing.eventAt.toISOString() : null, guestCount: Number(existing.guestCount || 0), subtotalCents: Number(existing.subtotalCents || 0) },
      },
    });
    return String(existing.id);
  }, TX_OPTIONS);
  return context.sudo().query.CateringOrder.findOne({ where: { id }, query });
}
