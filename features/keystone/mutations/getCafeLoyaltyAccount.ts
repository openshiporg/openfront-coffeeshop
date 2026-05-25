import { permissions } from "../access";

type LookupArgs = {
  email?: string | null;
  orderId?: string | null;
  secretKey?: string | null;
};

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() || null;
}

export default async function getCafeLoyaltyAccount(root: any, args: LookupArgs, context: any) {
  const email = normalizeEmail(args.email);
  if (!email) return null;

  const isStaff =
    permissions.canReadLoyalty({ session: context.session }) ||
    permissions.canManageLoyalty({ session: context.session });

  if (!isStaff) {
    if (!args.orderId || !args.secretKey) return null;

    const order = await context.sudo().query.CafeOrder.findOne({
      where: { id: args.orderId },
      query: "id customerEmail secretKey loyaltyAccount { id pointsBalance drinkCredits nextRewardProgress }",
    });

    if (!order || !order.secretKey || order.secretKey !== args.secretKey) {
      return null;
    }

    if (normalizeEmail(order.customerEmail) !== email) {
      return null;
    }

    if (!order.loyaltyAccount?.id) {
      return null;
    }

    return context.sudo().query.LoyaltyAccount.findOne({
      where: { id: order.loyaltyAccount.id },
      query: "id customerEmail pointsBalance drinkCredits nextRewardProgress",
    });
  }

  const accounts = await context.sudo().query.LoyaltyAccount.findMany({
    where: { customerEmail: { equals: email } },
    take: 1,
    query: "id customerName customerEmail customerPhone status tier pointsBalance lifetimePoints drinkCredits visits lastVisitAt nextRewardProgress",
  });

  return accounts[0] || null;
}
