import { permissions, type Session } from "../access";
import { cafeReceiptKeyMatches, resolveCafeImageUrl } from "./cafeStorefrontPolicy";

type CafeOrderLookupArgs = {
  orderId: string;
  secretKey?: string | null;
};

type CafeOrderLookupResult = {
  id: string;
  secretKey?: string | null;
  orderNumber: string;
  status: string;
  handoffCode?: string | null;
  pickupName?: string | null;
  promisedAt?: string | null;
  subtotal: number;
  tax: number;
  tip?: number | null;
  total: number;
  currencyCode?: string | null;
  specialInstructions?: string | null;
  paidAt?: string | null;
  customer?: { id: string } | null;
  orderItems?: Array<{
    id: string;
    quantity: number;
    itemNameSnapshot?: string | null;
    imagePathSnapshot?: string | null;
    customizationsSummary?: string | null;
    modifierSnapshot?: unknown;
    specialInstructions?: string | null;
    price: number;
  }> | null;
};

type CafeOrderLookupContext = {
  session?: Session;
  prisma: { cafeOrder: { findUnique(args: { where: { id: string }; select: { customerId: true; secretKey: true } }): Promise<{ customerId: string | null; secretKey: string | null } | null> } };
  sudo(): {
    query: {
      CafeOrder: {
        findOne(args: { where: { id: string }; query: string }): Promise<CafeOrderLookupResult | null>;
      };
    };
  };
};

export default async function getCafeOrder(
  _root: unknown,
  args: CafeOrderLookupArgs,
  context: CafeOrderLookupContext
) {
  if (!args.orderId) return null;

  const isStaff = permissions.canReadOrders({ session: context.session });
  const actorId = context.session?.listKey === "User" ? context.session.itemId : null;
  if (!isStaff && !actorId && !args.secretKey) return null;
  // Load only proof fields, then authorize before privileged receipt projection.
  const proof = await context.prisma.cafeOrder.findUnique({
    where: { id: args.orderId }, select: { customerId: true, secretKey: true },
  });
  if (!proof || (!isStaff && !(actorId && proof.customerId === actorId) && !cafeReceiptKeyMatches(args.secretKey, proof.secretKey))) return null;
  const order = await context.sudo().query.CafeOrder.findOne({
    where: { id: args.orderId },
    query: `
      id
      orderNumber
      status
      handoffCode
      pickupName
      promisedAt
      subtotal
      tax
      tip
      total
      currencyCode
      specialInstructions
      paidAt
      customer { id }
      orderItems { id quantity itemNameSnapshot imagePathSnapshot customizationsSummary modifierSnapshot specialInstructions price }
    `,
  });

  if (!order) return null;

  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    handoffCode: order.handoffCode,
    pickupName: order.pickupName,
    promisedAt: order.promisedAt,
    subtotal: order.subtotal,
    tax: order.tax,
    tip: order.tip || 0,
    total: order.total,
    currencyCode: order.currencyCode || "USD",
    specialInstructions: order.specialInstructions || null,
    paidAt: order.paidAt || null,
    orderItems: await Promise.all((order.orderItems || []).map(async (item) => ({
      ...item,
      imagePathSnapshot: await resolveCafeImageUrl(context, item.imagePathSnapshot),
      modifierSnapshot: Array.isArray(item.modifierSnapshot) ? item.modifierSnapshot : [],
    }))),
  };
}
