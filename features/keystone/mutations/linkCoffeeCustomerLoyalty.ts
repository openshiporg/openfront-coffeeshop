import { recordCoffeeCommandReceipt } from "../lib/coffeeCommandReceipt";
import { loyaltyLinkDecision, normalizeLoyaltyEmail } from "./loyaltyLink";

type Tx = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  user: { findUnique(args: Record<string, unknown>): Promise<{ id: string; email: string | null; loyaltyAccount: { id: string } | null } | null> };
  storeSetting: { findUnique(args: Record<string, unknown>): Promise<{ id: string } | null> };
  loyaltyAccount: {
    findFirst(args: Record<string, unknown>): Promise<{ id: string; customerId: string | null; customerEmail: string | null } | null>;
    update(args: Record<string, unknown>): Promise<unknown>;
  };
};

type Context = {
  session?: { listKey?: string; itemId?: string | number } | null;
  prisma: { $transaction<T>(fn: (tx: unknown) => Promise<T>, options?: Record<string, unknown>): Promise<T> };
};

/**
 * Backfill on sign-in: attaches the signed-in customer to the email-only rewards account
 * that carries their sign-in email. Returns true when the account is (now) linked to them.
 */
export default async function linkCoffeeCustomerLoyalty(_root: unknown, _args: unknown, context: Context) {
  const userId = context.session?.listKey === "User" && context.session.itemId ? String(context.session.itemId) : null;
  if (!userId) return false;
  return context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, email: true, loyaltyAccount: { select: { id: true } } } });
    const email = normalizeLoyaltyEmail(user?.email);
    if (!user || !email) return false;
    // Same lock key as applyCafeLoyalty, so a link and an earning never interleave.
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `loyalty-account:${email}`);
    const store = await tx.storeSetting.findUnique({ where: { singletonKey: "primary" }, select: { id: true } });
    if (!store) return false;
    const account = await tx.loyaltyAccount.findFirst({ where: { customerEmail: email, storeId: store.id }, select: { id: true, customerId: true, customerEmail: true } });
    const decision = loyaltyLinkDecision({ account, user: { id: user.id, email: user.email, loyaltyAccountId: user.loyaltyAccount?.id || null } });
    if (decision === "linked") return true;
    if (decision !== "link" || !account) return false;
    await tx.loyaltyAccount.update({ where: { id: account.id }, data: { customerId: user.id } });
    await recordCoffeeCommandReceipt(tx as never, {
      storeId: store.id,
      eventKey: `loyalty:${account.id}:customer-linked:${user.id}`,
      eventType: "loyalty.customer_linked",
      aggregateType: "loyalty_account",
      aggregateId: account.id,
      payload: { accountId: account.id, customerId: user.id, via: "sign_in" },
    });
    return true;
  }, { maxWait: 5000, timeout: 10000, isolationLevel: "ReadCommitted" });
}
