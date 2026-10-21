import { permissions, type Session } from "../access";
import { assertCoffeeStoreOwnership, enqueueCoffeeDomainEvent, getPrimaryCoffeeStoreId } from "../lib/coffeeDomainOutbox";
import { hasCafeSettlement, lockCoffeeOrder, type SettlementEvidence } from "./coffeeOrderPolicy";
import { requireCurrentCoffeeCapability } from "./coffeeKdsAuthority";
import { fingerprintInput } from "./idempotency";

type ApplyCafeLoyaltyArgs = {
  orderId: string;
  secretKey?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  redeemDrinkCredit?: boolean | null;
};

type LoyaltyAccountRecord = {
  id: string;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  status?: string | null;
  tier?: string | null;
  pointsBalance?: number | null;
  lifetimePoints?: number | null;
  drinkCredits?: number | null;
  visits?: number | null;
  firstVisitAt?: Date | string | null;
  lastVisitAt?: Date | string | null;
  nextRewardProgress?: number | null;
};

type TransactionClient = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  cafeOrder: {
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    update(args: Record<string, unknown>): Promise<unknown>;
  };
  loyaltyAccount: {
    findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    create(args: Record<string, unknown>): Promise<{ id: string }>;
    update(args: Record<string, unknown>): Promise<{ id: string }>;
  };
  loyaltyEvent: { create(args: Record<string, unknown>): Promise<unknown> };
  coffeeDomainEvent: { findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null> };
};

type ApplyCafeLoyaltyContext = {
  session?: Session;
  prisma: { $transaction<T>(fn: (tx: unknown) => Promise<T>, options: Record<string, unknown>): Promise<T> };
  sudo(): {
    query: {
      LoyaltyAccount: {
        findOne(args: { where: { id: string }; query: string }): Promise<LoyaltyAccountRecord | null>;
      };
    };
  };
};

const TX_OPTIONS = { maxWait: 5000, timeout: 10000, isolationLevel: "ReadCommitted" };
const ACCOUNT_QUERY = "id customerName customerEmail status tier pointsBalance lifetimePoints drinkCredits visits lastVisitAt nextRewardProgress";
// A guest order proof only reveals the rewards earned through that order's own linked account.
const GUEST_ACCOUNT_QUERY = "id customerEmail pointsBalance drinkCredits nextRewardProgress";

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() || null;
}

function normalizePhone(phone?: string | null) {
  return phone?.replace(/[^+\d]/g, "") || null;
}

function pointsForSubtotal(subtotal?: number | null) {
  return Math.max(0, Math.floor(Number(subtotal || 0) / 100));
}

export default async function applyCafeLoyalty(
  _root: unknown,
  args: ApplyCafeLoyaltyArgs,
  context: ApplyCafeLoyaltyContext,
) {
  const isOperator = permissions.canManageLoyalty({ session: context.session });
  const email = normalizeEmail(args.customerEmail);
  if (!args.orderId) throw new Error("Order id is required");
  if (!email) throw new Error("Customer email is required to apply loyalty");
  if (args.redeemDrinkCredit) {
    throw new Error("Drink-credit redemption is unavailable until it is integrated with tender authorization");
  }

  const customerName = args.customerName?.trim() || null;
  const customerPhone = normalizePhone(args.customerPhone);
  if ((customerName?.length || 0) > 200 || (customerPhone?.length || 0) > 40) throw new Error("Customer name or phone is too long");
  const requestFingerprint = fingerprintInput({ orderId: args.orderId, customerEmail: email, customerName, customerPhone });
  const eventKey = `loyalty:${args.orderId}:earned:v1`;

  const accountId = await context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx as TransactionClient;
    await lockCoffeeOrder(tx, args.orderId);
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `loyalty-account:${email}`);
    const actorId = isOperator ? await requireCurrentCoffeeCapability(rawTx as never, context.session, ["canManageLoyalty"], "Not authorized to apply loyalty") : null;

    const order = await tx.cafeOrder.findUnique({
      where: { id: args.orderId },
      select: {
        id: true,
        secretKey: true,
        storeId: true,
        customerId: true,
        subtotal: true,
        total: true,
        discount: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        loyaltyAccountId: true,
        payments: { select: { status: true, amount: true, refundIdempotencyKey: true } },
      },
    });
    if (!order) throw new Error("Order not found");
    if (!isOperator && (!order.secretKey || !args.secretKey || args.secretKey !== order.secretKey)) {
      throw new Error("You do not have access to apply loyalty to this order");
    }
    const storeId = await getPrimaryCoffeeStoreId(tx as never);
    assertCoffeeStoreOwnership(order.storeId, storeId, "Order");
    const orderEmail = normalizeEmail(String(order.customerEmail || ""));
    if (!isOperator && (!orderEmail || email !== orderEmail)) {
      throw new Error("Loyalty email must match the paid order");
    }
    const payments = Array.isArray(order.payments) ? order.payments as SettlementEvidence[] : [];
    const payableAmount = Number(order.total || 0) - Number(order.discount || 0);
    if (payableAmount <= 0 || !hasCafeSettlement(payments, payableAmount)) throw new Error("Loyalty earnings require one full, unreversed payment settlement");
    if (order.loyaltyAccountId) {
      // Replay returns the original earning only for the same request; changed details conflict.
      const receipt = await tx.coffeeDomainEvent.findUnique({ where: { eventKey } });
      const payload = receipt?.payload && typeof receipt.payload === "object" ? receipt.payload as Record<string, unknown> : null;
      let matches: boolean;
      if (payload && typeof payload.requestFingerprint === "string") {
        matches = payload.requestFingerprint === requestFingerprint;
      } else {
        const linked = await tx.loyaltyAccount.findUnique({ where: { id: String(order.loyaltyAccountId) }, select: { customerEmail: true } });
        matches = normalizeEmail(String(linked?.customerEmail || "")) === email;
      }
      if (!matches) throw new Error("Rewards were already applied to this order with different details");
      return String(order.loyaltyAccountId);
    }

    const now = new Date();
    const earnedPoints = pointsForSubtotal(Number(order.subtotal || 0));
    const existing = await tx.loyaltyAccount.findFirst({ where: { customerEmail: email } });
    let id: string;
    let newlyEarnedCredits: number;

    if (existing) {
      assertCoffeeStoreOwnership(existing.storeId, storeId, "Loyalty account");
      // An order's self-entered email is not proof of owning an existing account. Guests need
      // the account's own signed-in customer; otherwise staff review and apply it.
      const ownerId = existing.customerId ? String(existing.customerId) : null;
      const isSignedInOwner = Boolean(ownerId) && context.session?.listKey === "User" && context.session.itemId === ownerId && String(order.customerId || "") === ownerId;
      if (!isOperator && !isSignedInOwner) {
        throw new Error("This email already has a rewards account. Sign in to that account, or ask the cafe to apply this purchase.");
      }
      // Paused or closed accounts stay that way; a purchase is not consent to reopen them.
      if ((existing.status || "active") !== "active") throw new Error("This rewards account is paused or closed, so the purchase was not applied");
      const pointsAfterEarn = Number(existing.pointsBalance || 0) + earnedPoints;
      newlyEarnedCredits = Math.floor(pointsAfterEarn / 100);
      const updated = await tx.loyaltyAccount.update({
        where: { id: existing.id },
        data: {
          pointsBalance: pointsAfterEarn % 100,
          lifetimePoints: Number(existing.lifetimePoints || 0) + earnedPoints,
          drinkCredits: Number(existing.drinkCredits || 0) + newlyEarnedCredits,
          visits: Number(existing.visits || 0) + 1,
          firstVisitAt: existing.firstVisitAt || now,
          lastVisitAt: now,
        },
        select: { id: true },
      });
      id = updated.id;
    } else {
      newlyEarnedCredits = Math.floor(earnedPoints / 100);
      const created = await tx.loyaltyAccount.create({
        data: {
          storeId,
          customerName: customerName || order.customerName || email,
          customerEmail: email,
          customerPhone: customerPhone || order.customerPhone || "",
          status: "active",
          tier: "regular",
          pointsBalance: earnedPoints % 100,
          lifetimePoints: earnedPoints,
          drinkCredits: newlyEarnedCredits,
          visits: 1,
          firstVisitAt: now,
          lastVisitAt: now,
        },
        select: { id: true },
      });
      id = created.id;
    }

    // The paid order keeps its original contact details; only the rewards link is added.
    await tx.cafeOrder.update({ where: { id: args.orderId }, data: { loyaltyAccountId: id } });
    await tx.loyaltyEvent.create({
      data: {
        accountId: id,
        orderId: args.orderId,
        type: "earned",
        pointsDelta: earnedPoints,
        drinkCreditsDelta: newlyEarnedCredits,
        note: `Earned ${earnedPoints} points on order ${args.orderId}`,
        createdById: actorId,
      },
    });
    await enqueueCoffeeDomainEvent(tx as never, {
      storeId,
      eventKey,
      eventType: "loyalty.earned",
      aggregateType: "loyalty_account",
      aggregateId: id,
      occurredAt: now,
      payload: { accountId: id, orderId: args.orderId, earnedPoints, drinkCreditsEarned: newlyEarnedCredits, appliedBy: actorId, requestFingerprint },
    });
    return id;
  }, TX_OPTIONS);

  return context.sudo().query.LoyaltyAccount.findOne({ where: { id: accountId }, query: isOperator ? ACCOUNT_QUERY : GUEST_ACCOUNT_QUERY });
}
