import { permissions, type Session } from "../access";

type LookupArgs = {
  email?: string | null;
  orderId?: string | null;
  secretKey?: string | null;
};

type LoyaltyAccountLookupResult = {
  id: string;
  customerName?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  status?: string | null;
  tier?: string | null;
  pointsBalance: number;
  lifetimePoints?: number | null;
  drinkCredits: number;
  visits?: number | null;
  lastVisitAt?: string | null;
  nextRewardProgress?: number | null;
};

type CafeOrderLoyaltyProof = {
  id: string;
  customerEmail?: string | null;
  secretKey?: string | null;
  loyaltyAccount?: { id: string } | null;
};

type LoyaltyLookupContext = {
  session?: Session;
  prisma: {
    storeSetting: { findUnique(args: Record<string, unknown>): Promise<{ id: string } | null> };
    user: { findUnique(args: Record<string, unknown>): Promise<{ email: string | null } | null> };
  };
  sudo(): {
    query: {
      CafeOrder: {
        findOne(args: { where: { id: string }; query: string }): Promise<CafeOrderLoyaltyProof | null>;
      };
      LoyaltyAccount: {
        findOne(args: { where: { id: string }; query: string }): Promise<LoyaltyAccountLookupResult | null>;
        findMany(args: {
          where: { customerEmail: { equals: string }; store: { id: { equals: string } } };
          take: number;
          query: string;
        }): Promise<LoyaltyAccountLookupResult[]>;
      };
    };
  };
};

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() || null;
}

export default async function getCafeLoyaltyAccount(_root: unknown, args: LookupArgs, context: LoyaltyLookupContext) {
  const email = normalizeEmail(args.email);
  if (!email) return null;

  const isStaff =
    permissions.canReadLoyalty({ session: context.session }) ||
    permissions.canManageLoyalty({ session: context.session });

  if (!isStaff) {
    // A signed-in customer may read the rewards on their own account email.
    if (!args.orderId && context.session?.listKey === "User" && context.session.itemId) {
      const user = await context.prisma.user.findUnique({ where: { id: context.session.itemId }, select: { email: true } });
      if (normalizeEmail(user?.email) !== email) return null;
      const store = await context.prisma.storeSetting.findUnique({ where: { singletonKey: "primary" }, select: { id: true } });
      if (!store?.id) return null;
      const own = await context.sudo().query.LoyaltyAccount.findMany({
        where: { customerEmail: { equals: email }, store: { id: { equals: store.id } } },
        take: 1,
        query: "id customerEmail pointsBalance drinkCredits nextRewardProgress",
      });
      return own[0] || null;
    }
    if (!args.orderId || !args.secretKey) return null;

    // Proof fields only; no loyalty data is read until the order secret and email match.
    const proof = await context.sudo().query.CafeOrder.findOne({
      where: { id: args.orderId },
      query: "id customerEmail secretKey",
    });

    if (!proof || !proof.secretKey || proof.secretKey !== args.secretKey) {
      return null;
    }

    if (normalizeEmail(proof.customerEmail) !== email) {
      return null;
    }

    const linked = await context.sudo().query.CafeOrder.findOne({ where: { id: proof.id }, query: "id loyaltyAccount { id }" });
    if (!linked?.loyaltyAccount?.id) {
      return null;
    }

    return context.sudo().query.LoyaltyAccount.findOne({
      where: { id: linked.loyaltyAccount.id },
      query: "id customerEmail pointsBalance drinkCredits nextRewardProgress",
    });
  }

  const store = await context.prisma.storeSetting.findUnique({ where: { singletonKey: "primary" }, select: { id: true } });
  if (!store?.id) return null;
  const accounts = await context.sudo().query.LoyaltyAccount.findMany({
    where: { customerEmail: { equals: email }, store: { id: { equals: store.id } } },
    take: 1,
    query: "id customerName customerEmail customerPhone status tier pointsBalance lifetimePoints drinkCredits visits lastVisitAt nextRewardProgress",
  });

  return accounts[0] || null;
}
