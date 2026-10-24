import {
  assertCustomerPaymentProvider,
  normalizePaymentProviderCode,
  type PaymentAdapterResult,
} from "../../integrations/payment";
import { permissions, type Session } from "../access";
import { executePaymentProviderAdapter } from "../utils/paymentProviderAdapter";
import { buildScopedIdempotencyKey, normalizeIdempotencyKey } from "./idempotency";
import { lockCoffeeOrder } from "./coffeeOrderPolicy";
import { cafeReceiptKeyMatches } from "./cafeStorefrontPolicy";
import { cafeCustomerError } from "../lib/cafeCustomerError";
import { onlinePaymentReady, validPaymentReturnUrl } from "../lib/onlinePayment";

type InitiateCafePaymentArgs = {
  orderId: string;
  secretKey?: string | null;
  paymentProvider: string;
  idempotencyKey?: string | null;
  returnUrl?: string | null;
};

type PaymentProviderRecord = { id: string; code: string; isInstalled?: boolean | null };
type CafePaymentRecord = {
  id: string;
  status: string;
  provider?: string | null;
  providerPaymentId?: string | null;
  amount?: number | null;
  paymentProvider?: PaymentProviderRecord | null;
  idempotencyKey?: string | null;
};
type CafePaymentOrderRecord = {
  id: string;
  store?: { id: string } | null;
  secretKey?: string | null;
  orderNumber: string;
  total?: number | null;
  discount?: number | null;
  currencyCode?: string | null;
  customerEmail?: string | null;
  customerName?: string | null;
  status: string;
  customer?: { id: string } | null;
  payments?: CafePaymentRecord[] | null;
};
type PaymentClaimTransaction = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  cafeOrder: { findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null> };
  payment: { create(args: Record<string, unknown>): Promise<Record<string, unknown>> };
};

type InitiateCafePaymentContext = {
  session?: Session;
  prisma: Parameters<typeof onlinePaymentReady>[0] & { $transaction<T>(fn: (tx: unknown) => Promise<T>, options: Record<string, unknown>): Promise<T> };
  sudo(): {
    query: {
      CafeOrder: { findOne(args: { where: { id: string }; query: string }): Promise<CafePaymentOrderRecord | null> };
      PaymentProvider: { findMany(args: { where: Record<string, unknown>; take: number; query: string }): Promise<PaymentProviderRecord[]> };
    };
    db: {
      Payment: {
        createOne(args: { data: Record<string, unknown> }): Promise<{ id: string }>;
        updateOne(args: { where: { id: string }; data: Record<string, unknown> }): Promise<{ id: string }>;
      };
    };
  };
};

const TERMINAL_ORDER_STATUSES = new Set(["paid", "completed", "cancelled", "refunded"]);
const MANAGED_PAYMENT_STATUSES = new Set(["captured", "authorized", "pending"]);

/** Starts a Stripe-hosted Checkout page for an unpaid order. The customer pays there; the signed
 *  webhook settles the payment. Staff still admit the order (capacity and stock) as for any request. */
export default async function initiateCafePaymentSession(_root: unknown, args: InitiateCafePaymentArgs, context: InitiateCafePaymentContext) {
  if (!args.orderId) throw new Error("Order id is required");
  if (!args.paymentProvider) throw new Error("Payment provider is required");

  const providerCode = normalizePaymentProviderCode(args.paymentProvider);
  if (providerCode !== "pp_stripe_stripe") throw cafeCustomerError("Online payment is by card only");
  if (!(await onlinePaymentReady(context.prisma))) throw cafeCustomerError("Online payment isn't available. Pay at pickup.");
  const returnUrl = validPaymentReturnUrl(args.returnUrl);
  if (!returnUrl) throw new Error("Payment return URL is invalid");
  const isStaff = permissions.canManagePayments({ session: context.session }) || permissions.canManageOrders({ session: context.session });
  if (!isStaff) assertCustomerPaymentProvider(providerCode);

  const sudo = context.sudo();
  const order = await sudo.query.CafeOrder.findOne({
    where: { id: args.orderId },
    query: "id secretKey orderNumber total discount currencyCode customerEmail customerName status store { id } customer { id } payments { id status provider providerPaymentId amount idempotencyKey paymentProvider { id code isInstalled } }",
  });
  if (!order) throw new Error("Order not found");
  if (!order.store?.id) throw new Error("Order store ownership is missing");

  const isOwner = context.session?.listKey === "User" && order.customer?.id === context.session.itemId;
  const hasValidSecret = cafeReceiptKeyMatches(args.secretKey, order.secretKey);
  if (!isStaff && !isOwner && !hasValidSecret) throw cafeCustomerError("This order could not be verified");
  if (TERMINAL_ORDER_STATUSES.has(order.status)) throw cafeCustomerError("This order can no longer be paid online");

  const payableAmount = Math.max(0, Number(order.total || 0) - Number(order.discount || 0));
  if (!Number.isSafeInteger(payableAmount) || payableAmount <= 0) throw cafeCustomerError("This order has nothing to pay");
  const payments = order.payments || [];
  if (payments.some((payment) => payment.status === "captured")) throw cafeCustomerError("This order is already paid");

  const clientKey = normalizeIdempotencyKey(args.idempotencyKey);
  if (!clientKey) throw new Error("Payment idempotency key is required");
  const scope = context.session?.listKey === "User" ? context.session.itemId : order.id;
  const scopedKey = buildScopedIdempotencyKey(`payment:${scope}`, clientKey);

  const [provider] = await sudo.query.PaymentProvider.findMany({
    where: { code: { equals: providerCode }, isInstalled: { equals: true } },
    take: 1,
    query: "id code isInstalled",
  });
  if (!provider) throw cafeCustomerError("Online payment isn't available. Pay at pickup.");

  // A hosted page already started for this order is reused while it is open; a finished or
  // expired one is closed out so the customer can start again.
  for (const pending of payments.filter((payment) => payment.provider === providerCode && (payment.status === "pending" || payment.status === "authorized"))) {
    const sessionId = String(pending.providerPaymentId || "");
    if (!sessionId.startsWith("cs_")) continue;
    const state = await executePaymentProviderAdapter({ provider, functionName: "getPaymentStatusFunction", args: { providerPaymentId: sessionId } });
    const checkoutUrl = typeof state.data?.checkoutUrl === "string" ? state.data.checkoutUrl : null;
    if (state.status === "open" && checkoutUrl) {
      return { success: true, paymentId: pending.id, provider: providerCode, providerPaymentId: sessionId, status: "pending", amount: pending.amount ?? payableAmount, checkoutUrl, error: null };
    }
    if (state.status === "complete") {
      return { success: true, paymentId: pending.id, provider: providerCode, providerPaymentId: sessionId, status: "processing", amount: pending.amount ?? payableAmount, checkoutUrl: null, error: null };
    }
    await sudo.db.Payment.updateOne({ where: { id: pending.id }, data: { status: "failed", failureMessage: "Hosted payment page expired" } });
  }

  const claim = await context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx as PaymentClaimTransaction;
    await lockCoffeeOrder(tx, order.id);
    const lockedOrder = await tx.cafeOrder.findUnique({
      where: { id: order.id },
      select: {
        id: true,
        storeId: true,
        status: true,
        payments: { select: { id: true, status: true, provider: true, providerPaymentId: true, amount: true, idempotencyKey: true } },
      },
    });
    if (!lockedOrder) throw new Error("Order not found");
    if (lockedOrder.storeId !== order.store?.id) throw new Error("Order store ownership changed");
    if (TERMINAL_ORDER_STATUSES.has(String(lockedOrder.status))) throw cafeCustomerError("This order can no longer be paid online");
    const lockedPayments = Array.isArray(lockedOrder.payments) ? lockedOrder.payments as CafePaymentRecord[] : [];
    if (lockedPayments.some((candidate) => candidate.status === "captured")) throw cafeCustomerError("This order is already paid");
    const keyed = lockedPayments.find((candidate) => candidate.idempotencyKey === scopedKey);
    if (keyed && keyed.status !== "failed") return { payment: keyed, reused: true };
    const created = await tx.payment.create({
      data: {
        orderId: order.id,
        storeId: order.store?.id,
        paymentProviderId: provider.id,
        // A retried key after a failed page gets a fresh row; the key stays unique per attempt.
        idempotencyKey: keyed ? `${scopedKey}:${Date.now()}` : scopedKey,
        status: "pending",
        method: "card",
        amount: payableAmount,
        currencyCode: order.currencyCode || "USD",
        provider: providerCode,
        providerPaymentId: "",
      },
      select: { id: true, status: true, provider: true, providerPaymentId: true, amount: true, idempotencyKey: true },
    });
    return { payment: created as CafePaymentRecord, reused: false };
  }, { maxWait: 5000, timeout: 10000, isolationLevel: "ReadCommitted" });
  const payment = claim.payment;
  if (claim.reused && payment.providerPaymentId) {
    const state = await executePaymentProviderAdapter({ provider, functionName: "getPaymentStatusFunction", args: { providerPaymentId: String(payment.providerPaymentId) } });
    const checkoutUrl = typeof state.data?.checkoutUrl === "string" ? state.data.checkoutUrl : null;
    return { success: Boolean(checkoutUrl) || state.status === "complete", paymentId: payment.id, provider: providerCode, providerPaymentId: payment.providerPaymentId, status: state.status === "complete" ? "processing" : "pending", amount: payment.amount ?? payableAmount, checkoutUrl, error: null };
  }

  let adapterResult: PaymentAdapterResult;
  try {
    adapterResult = await executePaymentProviderAdapter({
      provider,
      functionName: "generatePaymentLinkFunction",
      args: {
        orderId: order.id,
        paymentId: payment.id,
        // Stripe's own idempotency: a retried request returns the same hosted page.
        idempotencyKey: `${payment.id}:checkout`,
        amount: payableAmount,
        currencyCode: order.currencyCode || "USD",
        customerEmail: order.customerEmail,
        customerName: order.customerName,
        description: `Order #${order.orderNumber}`,
        returnUrl,
        metadata: { orderNumber: order.orderNumber },
      },
    });
  } catch (error) {
    adapterResult = { success: false, provider: providerCode, status: "failed", error: error instanceof Error ? error.message : "Payment provider request failed" };
  }

  await sudo.db.Payment.updateOne({
    where: { id: payment.id },
    data: {
      status: adapterResult.success ? "pending" : "failed",
      providerPaymentId: adapterResult.providerPaymentId || "",
      // Provider text stays in the ledger for staff; customers get a fixed message.
      failureMessage: adapterResult.success ? "" : String(adapterResult.error || "Payment provider request failed").slice(0, 500),
    },
  });
  if (!adapterResult.success) throw cafeCustomerError("Online payment couldn't start. Try again or pay at pickup.");
  return {
    success: true,
    paymentId: payment.id,
    provider: providerCode,
    providerPaymentId: adapterResult.providerPaymentId,
    status: "pending",
    amount: adapterResult.amount ?? payableAmount,
    checkoutUrl: typeof adapterResult.data?.checkoutUrl === "string" ? adapterResult.data.checkoutUrl : null,
    error: null,
  };
}
