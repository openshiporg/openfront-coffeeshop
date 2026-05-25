import { permissions } from "../access";

const statusTimestampMap: Record<string, string> = {
  preparing: "startedAt",
  ready: "readyAt",
  completed: "completedAt",
  cancelled: "cancelledAt",
  paid: "paidAt",
};

const itemStatusMap: Record<string, string> = {
  in_bar_queue: "queued",
  preparing: "preparing",
  ready: "ready",
  completed: "handed_off",
  cancelled: "voided",
};

export default async function updateCafeOrderStatus(
  root: any,
  args: { orderId: string; status: string },
  context: any
) {
  if (!permissions.canManageOrders({ session: context.session })) {
    throw new Error("Not authorized to update cafe order status");
  }

  const allowedStatuses = ["open", "paid", "in_bar_queue", "preparing", "ready", "completed", "cancelled", "refunded"];
  if (!allowedStatuses.includes(args.status)) {
    throw new Error(`Unsupported cafe order status: ${args.status}`);
  }

  const sudo = context.sudo();
  const now = new Date().toISOString();
  const timestampField = statusTimestampMap[args.status];

  const order = await sudo.db.CafeOrder.updateOne({
    where: { id: args.orderId },
    data: {
      status: args.status,
      ...(timestampField ? { [timestampField]: now } : {}),
    },
  });

  const itemStatus = itemStatusMap[args.status];
  if (itemStatus) {
    const orderItems = await sudo.query.OrderItem.findMany({
      where: { order: { id: { equals: args.orderId } } },
      query: "id",
    });

    const itemTimestampField =
      itemStatus === "queued"
        ? "queuedAt"
        : itemStatus === "preparing"
          ? "startedAt"
          : itemStatus === "ready"
            ? "readyAt"
            : itemStatus === "handed_off"
              ? "handedOffAt"
              : null;

    await Promise.all(
      orderItems.map((item: any) =>
        sudo.db.OrderItem.updateOne({
          where: { id: item.id },
          data: {
            barStatus: itemStatus,
            ...(itemTimestampField ? { [itemTimestampField]: now } : {}),
          },
        })
      )
    );
  }

  return sudo.query.CafeOrder.findOne({
    where: { id: order.id },
    query: "id orderNumber status startedAt readyAt completedAt cancelledAt orderItems { id barStatus }",
  });
}
