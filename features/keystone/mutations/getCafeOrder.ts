export default async function getCafeOrder(
  root: any,
  args: { orderId: string; secretKey?: string | null },
  context: any
) {
  if (!args.orderId) return null;

  const sudo = context.sudo();
  const order = await sudo.query.CafeOrder.findOne({
    where: { id: args.orderId },
    query: `
      id
      secretKey
      orderNumber
      status
      handoffCode
      pickupName
      promisedAt
      subtotal
      tax
      total
      orderItems { id quantity itemNameSnapshot customizationsSummary price }
    `,
  });

  if (!order) return null;
  if (order.secretKey && args.secretKey !== order.secretKey) return null;

  return order;
}
