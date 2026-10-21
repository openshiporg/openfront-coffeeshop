import { permissions, type Session } from "../access";
import { assertCoffeeStoreOwnership, enqueueCoffeeDomainEvent, getPrimaryCoffeeStoreId } from "../lib/coffeeDomainOutbox";
import { requireCurrentCoffeeCapability } from "./coffeeKdsAuthority";
import { SUBSCRIPTION_TRANSITIONS, evaluateTransition } from "./transitionPolicy";

type Context = {
  session?: Session;
  prisma: { $transaction<T>(fn: (tx: unknown) => Promise<T>, options: Record<string, unknown>): Promise<T> };
  sudo(): { query: { Subscription: { findOne(args: { where: { id: string }; query: string }): Promise<unknown> } } };
};
type TransactionClient = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  storeSetting: { findUnique(args: Record<string, unknown>): Promise<{ id: string } | null> };
  subscription: { findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>; update(args: Record<string, unknown>): Promise<unknown> };
  coffeeDomainEvent: { count(args: Record<string, unknown>): Promise<number> };
  user: { findUnique(args: Record<string, unknown>): Promise<{ id: string; roleId: string | null } | null> };
  role: { findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null> };
};
const TX_OPTIONS = { maxWait: 5000, timeout: 10000, isolationLevel: "Serializable" };
const query = "id subscriptionNumber status cancelledAt store { id }";

export default async function updateSubscriptionStatus(_root: unknown, args: { subscriptionId: string; status: string }, context: Context) {
  if (!permissions.canManageLoyalty({ session: context.session })) throw new Error("Not authorized to update subscription status");
  const id = await context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx as TransactionClient;
    await requireCurrentCoffeeCapability(tx, context.session, ["canManageLoyalty"], "Not authorized to update subscription status");
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-subscription:${args.subscriptionId}`);
    const existing = await tx.subscription.findUnique({ where: { id: args.subscriptionId } });
    if (!existing) throw new Error("Subscription not found");
    const storeId = await getPrimaryCoffeeStoreId(tx as never);
    assertCoffeeStoreOwnership(existing.storeId, storeId, "Subscription");
    const transition = evaluateTransition(SUBSCRIPTION_TRANSITIONS, String(existing.status), args.status);
    if (transition.replay) return String(existing.id);
    const now = new Date();
    // Pause/resume can repeat, so each accepted transition gets its own sequence in the event key.
    const sequence = await tx.coffeeDomainEvent.count({ where: { storeId, aggregateType: "subscription", aggregateId: String(existing.id), eventType: "subscription.status_changed" } }) + 1;
    await tx.subscription.update({ where: { id: existing.id }, data: { status: args.status, ...(args.status === "cancelled" ? { cancelledAt: now } : {}) } });
    await enqueueCoffeeDomainEvent(tx as never, {
      storeId,
      eventKey: `subscription:${String(existing.id)}:status:${sequence}:${String(existing.status)}:${args.status}:v2`,
      eventType: "subscription.status_changed",
      aggregateType: "subscription",
      aggregateId: String(existing.id),
      occurredAt: now,
      payload: { subscriptionId: String(existing.id), subscriptionNumber: String(existing.subscriptionNumber), sequence, previousStatus: String(existing.status), status: args.status },
    });
    return String(existing.id);
  }, TX_OPTIONS);
  return context.sudo().query.Subscription.findOne({ where: { id }, query });
}
