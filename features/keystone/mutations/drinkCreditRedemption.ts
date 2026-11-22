/**
 * Drink-credit redemption at checkout. 100 points become one drink credit (applyCafeLoyalty); a credit
 * takes one drink off a storefront order (drinkCreditDiscount), as CafeOrder.discount, before tax.
 *
 * - Only the signed-in customer who owns the rewards account redeems (account linked to the user, or
 *   an unowned account on the user's own sign-in email). Order proof alone never spends a credit.
 * - The credit is spent in the order's own transaction, under the account lock, with a "redeemed"
 *   LoyaltyEvent on the order. The order's loyaltyAccount link is left to the paid-order earning.
 * - Cancelling, closing out or fully refunding the order gives the credit back once (restoreDrinkCredit).
 */
import { cafeCustomerError } from "../lib/cafeCustomerError";
import { normalizeLoyaltyEmail } from "./loyaltyLink";

type Tx = Record<string, any> & { $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number> };
type Session = { listKey?: string; itemId?: string } | null | undefined;

const RESTORED_NOTE = "Drink credit restored";

/** The signed-in customer's own active rewards account, or null. Read-only; for quotes and checkout. */
export async function ownRewardsAccount(prisma: Record<string, any>, session: Session, storeId: string) {
  if (session?.listKey !== "User" || !session.itemId) return null;
  const user = await prisma.user.findUnique({ where: { id: session.itemId }, select: { id: true, email: true, loyaltyAccount: { select: { id: true } } } });
  if (!user) return null;
  const email = normalizeLoyaltyEmail(user.email);
  const account = user.loyaltyAccount?.id
    ? await prisma.loyaltyAccount.findUnique({ where: { id: user.loyaltyAccount.id } })
    : email ? await prisma.loyaltyAccount.findFirst({ where: { customerEmail: email, customerId: null } }) : null;
  if (!account || String(account.storeId || "") !== storeId) return null;
  return account as { id: string; customerEmail: string; status: string | null; drinkCredits: number | null; pointsBalance: number | null };
}

export function redeemableAccount(account: Awaited<ReturnType<typeof ownRewardsAccount>>) {
  if (!account) throw cafeCustomerError("Sign in to the account that holds your rewards to use a free drink");
  if ((account.status || "active") !== "active") throw cafeCustomerError("This rewards account is paused or closed");
  if (Number(account.drinkCredits || 0) < 1) throw cafeCustomerError("You don't have a free drink to use yet");
  return account;
}

/** Spends one credit for this order inside its transaction. Re-reads the account under its lock. */
export async function redeemDrinkCreditInTx(tx: Tx, input: { session: Session; storeId: string; orderId: string; orderNumber: string; discount: number }) {
  const found = redeemableAccount(await ownRewardsAccount(tx, input.session, input.storeId));
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `loyalty-account:${String(found.customerEmail)}`);
  const account = redeemableAccount(await ownRewardsAccount(tx, input.session, input.storeId));
  const spent = await tx.loyaltyAccount.updateMany({ where: { id: account.id, drinkCredits: { gte: 1 } }, data: { drinkCredits: { decrement: 1 } } });
  if (spent.count !== 1) throw cafeCustomerError("You don't have a free drink to use yet");
  await tx.loyaltyEvent.create({
    data: { accountId: account.id, orderId: input.orderId, type: "redeemed", pointsDelta: 0, drinkCreditsDelta: -1, note: `Free drink (${input.discount} cents) on order ${input.orderNumber}` },
  });
  return account.id;
}

/** Gives a redeemed credit back when the order is cancelled or fully refunded. Idempotent per order. */
export async function restoreDrinkCreditInTx(tx: Tx, order: { id: string; orderNumber: string }, why: string) {
  const redeemed = await tx.loyaltyEvent.findMany({ where: { orderId: order.id, type: "redeemed" }, take: 2, select: { id: true, accountId: true, drinkCreditsDelta: true } });
  if (!redeemed.length) return false;
  const restored = await tx.loyaltyEvent.findFirst({ where: { orderId: order.id, type: "refund_reversal", note: { startsWith: RESTORED_NOTE } }, select: { id: true } });
  if (restored) return false;
  const accountId = String(redeemed[0].accountId);
  const account = await tx.loyaltyAccount.findUnique({ where: { id: accountId }, select: { id: true, customerEmail: true } });
  if (!account) throw new Error("The rewards account behind this order's free drink requires reconciliation");
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `loyalty-account:${String(account.customerEmail)}`);
  const credits = redeemed.reduce((sum: number, event: { drinkCreditsDelta: number | null }) => sum - Number(event.drinkCreditsDelta || 0), 0);
  await tx.loyaltyAccount.update({ where: { id: accountId }, data: { drinkCredits: { increment: credits } } });
  await tx.loyaltyEvent.create({
    data: { accountId, orderId: order.id, type: "refund_reversal", pointsDelta: 0, drinkCreditsDelta: credits, note: `${RESTORED_NOTE}: order ${order.orderNumber} ${why}` },
  });
  return true;
}
