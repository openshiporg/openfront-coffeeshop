import { permissions } from "../access";
import { executePaymentProviderAdapter } from "../utils/paymentProviderAdapter";

type InitiateCafePaymentArgs = {
  orderId: string;
  secretKey?: string | null;
  paymentProvider: string;
};

const TERMINAL_ORDER_STATUSES = new Set(["paid", "completed", "cancelled", "refunded"]);
const MANAGED_PAYMENT_STATUSES = new Set(["captured", "authorized", "pending"]);

export default async function initiateCafePaymentSession(root: any, args: InitiateCafePaymentArgs, context: any) {
  if (!args.orderId) throw new Error("Order id is required");
  if (!args.paymentProvider) throw new Error("Payment provider is required");

  const isStaff = permissions.canManagePayments({ session: context.session }) || permissions.canManageOrders({ session: context.session });
  if (!isStaff && args.paymentProvider === "manual") {
    throw new Error("Manual payment initiation is only available to staff");
  }

  const sudo = context.sudo();
  const order = await sudo.query.CafeOrder.findOne({
    where: { id: args.orderId },
    query: "id secretKey orderNumber total discount currencyCode customerEmail customerName status payments { id status provider providerPaymentId amount paymentProvider { id code isInstalled createPaymentFunction capturePaymentFunction refundPaymentFunction getPaymentStatusFunction generatePaymentLinkFunction handleWebhookFunction credentials metadata } }",
  });

  if (!order) throw new Error("Order not found");
  if (!isStaff && order.secretKey && args.secretKey !== order.secretKey) {
    throw new Error("You do not have access to initiate payment for this order");
  }
  if (TERMINAL_ORDER_STATUSES.has(order.status)) {
    throw new Error(`Cannot initiate payment for an order with status ${order.status}`);
  }

  const existingManagedPayment = (order.payments || []).find((payment: any) => MANAGED_PAYMENT_STATUSES.has(payment.status));
  if (existingManagedPayment) {
    return {
      success: true,
      paymentId: existingManagedPayment.id,
      provider: existingManagedPayment.provider,
      providerPaymentId: existingManagedPayment.providerPaymentId,
      status: existingManagedPayment.status,
      amount: existingManagedPayment.amount ?? Number(order.total || 0),
      data: { reusedExistingPayment: true },
      error: null,
    };
  }

  const configuredProviders = await sudo.query.PaymentProvider.findMany({
    where: {
      isInstalled: { equals: true },
      OR: [
        { code: { equals: args.paymentProvider } },
        { createPaymentFunction: { equals: args.paymentProvider } },
      ],
    },
    take: 1,
    query: "id code name isInstalled createPaymentFunction capturePaymentFunction refundPaymentFunction getPaymentStatusFunction generatePaymentLinkFunction handleWebhookFunction credentials metadata",
  });

  const provider = configuredProviders[0];
  if (!provider) {
    throw new Error(`Payment provider ${args.paymentProvider} is not installed`);
  }

  if (!isStaff && provider.code === "pp_system_default") {
    throw new Error("Manual payment initiation is only available to staff");
  }

  const payableAmount = Math.max(0, Number(order.total || 0) - Number(order.discount || 0));
  if (payableAmount <= 0) {
    throw new Error("Order total must be greater than zero");
  }

  const adapterResult = await executePaymentProviderAdapter({
    provider,
    functionName: "createPaymentFunction",
    args: {
      orderId: order.id,
      amount: payableAmount,
      currencyCode: order.currencyCode || "USD",
      customerEmail: order.customerEmail,
      customerName: order.customerName,
      metadata: { orderNumber: order.orderNumber },
    },
  });

  const normalizedProvider = provider.code;
  const paymentStatus = adapterResult.success && adapterResult.status === "captured"
    ? "captured"
    : adapterResult.success
      ? "pending"
      : "failed";

  const payment = await sudo.db.Payment.createOne({
    data: {
      order: { connect: { id: order.id } },
      status: paymentStatus,
      method: normalizedProvider === "pp_system_default" ? "cash" : "card",
      amount: payableAmount,
      currencyCode: order.currencyCode || "USD",
      provider: normalizedProvider,
      providerPaymentId: adapterResult.providerPaymentId || null,
      failureMessage: adapterResult.error || null,
      processedAt: paymentStatus === "captured" && isStaff ? new Date().toISOString() : undefined,
      paymentProvider: { connect: { id: provider.id } },
    },
  });

  if (paymentStatus === "captured" && isStaff) {
    await sudo.db.CafeOrder.updateOne({
      where: { id: order.id },
      data: { status: "paid", paidAt: new Date().toISOString() },
    });
  }

  return {
    success: adapterResult.success,
    paymentId: payment.id,
    provider: normalizedProvider,
    providerPaymentId: adapterResult.providerPaymentId,
    status: adapterResult.status || paymentStatus,
    amount: adapterResult.amount || payableAmount,
    data: adapterResult.data || null,
    error: adapterResult.error || null,
  };
}
