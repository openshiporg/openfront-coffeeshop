import { permissions } from "../access";

type ApplyCafeLoyaltyArgs = {
  orderId: string;
  secretKey?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  redeemDrinkCredit?: boolean | null;
};

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() || null;
}

function normalizePhone(phone?: string | null) {
  return phone?.replace(/[^+\d]/g, "") || null;
}

function pointsForSubtotal(subtotal?: number | null) {
  return Math.max(0, Math.floor(Number(subtotal || 0) / 100));
}

export default async function applyCafeLoyalty(root: any, args: ApplyCafeLoyaltyArgs, context: any) {
  const isOperator = permissions.canManageLoyalty({ session: context.session }) || permissions.canManageOrders({ session: context.session });
  const email = normalizeEmail(args.customerEmail);

  if (!args.orderId) throw new Error("Order id is required");
  if (!email) throw new Error("Customer email is required to apply loyalty");

  const sudo = context.sudo();
  const order = await sudo.query.CafeOrder.findOne({
    where: { id: args.orderId },
    query: "id secretKey subtotal tax tip discount total customerName customerEmail customerPhone loyaltyAccount { id } payments { id status amount }",
  });

  if (!order) throw new Error("Order not found");
  if (!isOperator) {
    if (!order.secretKey || !args.secretKey || args.secretKey !== order.secretKey) {
      throw new Error("You do not have access to apply loyalty to this order");
    }
  }
  if (order.loyaltyAccount?.id && !isOperator) {
    throw new Error("Loyalty has already been applied to this order");
  }

  const now = new Date().toISOString();
  const alreadyPaid = (order.payments || []).some((payment: any) => ["captured", "authorized"].includes(payment.status));
  if (Boolean(args.redeemDrinkCredit) && alreadyPaid && !isOperator) {
    throw new Error("Drink credits must be redeemed before payment is captured");
  }

  const nowDiscount = Number(order.discount || 0);
  const redeemDiscount = Boolean(args.redeemDrinkCredit) ? 500 : 0;
  const rewardAdjustedSubtotal = Math.max(0, Number(order.subtotal || 0) - redeemDiscount);
  const earnedPoints = pointsForSubtotal(rewardAdjustedSubtotal);
  const existingAccounts = await sudo.query.LoyaltyAccount.findMany({
    where: { customerEmail: { equals: email } },
    take: 1,
    query: "id pointsBalance lifetimePoints drinkCredits visits firstVisitAt customerName customerEmail customerPhone",
  });

  const existing = existingAccounts[0];
  const redeem = Boolean(args.redeemDrinkCredit);
  let accountId: string;
  let nextDrinkCredits = 0;

  if (existing) {
    const currentPoints = Number(existing.pointsBalance || 0);
    const currentCredits = Number(existing.drinkCredits || 0);
    if (redeem && currentCredits <= 0) throw new Error("No drink credits available to redeem");

    const pointsAfterEarn = currentPoints + earnedPoints;
    const newlyEarnedCredits = Math.floor(pointsAfterEarn / 100);
    const pointsBalance = pointsAfterEarn % 100;
    nextDrinkCredits = currentCredits + newlyEarnedCredits - (redeem ? 1 : 0);

    const updated = await sudo.db.LoyaltyAccount.updateOne({
      where: { id: existing.id },
      data: {
        customerName: args.customerName?.trim() || order.customerName || existing.customerName,
        customerPhone: normalizePhone(args.customerPhone) || order.customerPhone || existing.customerPhone,
        pointsBalance,
        lifetimePoints: Number(existing.lifetimePoints || 0) + earnedPoints,
        drinkCredits: nextDrinkCredits,
        visits: Number(existing.visits || 0) + 1,
        firstVisitAt: existing.firstVisitAt || now,
        lastVisitAt: now,
        status: "active",
      },
    });
    accountId = updated.id;
  } else {
    const newlyEarnedCredits = Math.floor(earnedPoints / 100);
    const created = await sudo.db.LoyaltyAccount.createOne({
      data: {
        customerName: args.customerName?.trim() || order.customerName || email,
        customerEmail: email,
        customerPhone: normalizePhone(args.customerPhone) || order.customerPhone || null,
        status: "active",
        tier: "regular",
        pointsBalance: earnedPoints % 100,
        lifetimePoints: earnedPoints,
        drinkCredits: newlyEarnedCredits,
        visits: 1,
        firstVisitAt: now,
        lastVisitAt: now,
      },
    });
    accountId = created.id;
    nextDrinkCredits = newlyEarnedCredits;
  }

  await sudo.db.CafeOrder.updateOne({
    where: { id: args.orderId },
    data: {
      customerEmail: email,
      customerName: args.customerName?.trim() || order.customerName,
      customerPhone: normalizePhone(args.customerPhone) || order.customerPhone,
      loyaltyAccount: { connect: { id: accountId } },
      ...(redeem ? { discount: nowDiscount + redeemDiscount, total: Math.max(0, rewardAdjustedSubtotal + Number(order.tax || 0) + Number(order.tip || 0)) } : {}),
    },
  });

  await sudo.db.LoyaltyEvent.createOne({
    data: {
      account: { connect: { id: accountId } },
      order: { connect: { id: args.orderId } },
      type: redeem ? "redeemed" : "earned",
      pointsDelta: earnedPoints,
      drinkCreditsDelta: Math.floor(((existing ? Number(existing.pointsBalance || 0) : 0) + earnedPoints) / 100) - (redeem ? 1 : 0),
      note: redeem
        ? `Redeemed one drink credit and earned ${earnedPoints} points on order ${args.orderId}`
        : `Earned ${earnedPoints} points on order ${args.orderId}`,
      createdBy: context.session?.itemId ? { connect: { id: context.session.itemId } } : undefined,
    },
  });

  return sudo.query.LoyaltyAccount.findOne({
    where: { id: accountId },
    query: "id customerName customerEmail status tier pointsBalance lifetimePoints drinkCredits visits lastVisitAt nextRewardProgress",
  });
}
