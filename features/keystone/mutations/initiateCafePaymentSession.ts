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

type InitiateCafePaymentArgs = {
  orderId: string;
  secretKey?: string | null;
  paymentProvider: string;
  idempotencyKey?: string | null;
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
  prisma: { $transaction<T>(fn: (tx: unknown) => Promise<T>, options: Record<string, unknown>): Promise<T> };
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

export default async function initiateCafePaymentSession(
  _root: unknown,
  args: InitiateCafePaymentArgs,
  context: InitiateCafePaymentContext,
) {
  // No customer collection/uncertain-state recovery is certified in this release.
  // An installed adapter alone must never enable live online charges.
  throw new Error("Online payment initiation is unavailable; request pickup and pay at the cafe");
}

async function disabledInitiateCafePaymentSession(_root: unknown, args: InitiateCafePaymentArgs, context: InitiateCafePaymentContext) {
  if (!args.orderId) throw new Error("Order id is required");
  if (!args.paymentProvider) throw new Error("Payment provider is required");

  const providerCode = normalizePaymentProviderCode(args.paymentProvider);
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
  if (!isStaff && !isOwner && !hasValidSecret) throw new Error("You do not have access to initiate payment for this order");
  if (TERMINAL_ORDER_STATUSES.has(order.status)) throw new Error(`Cannot initiate payment for an order with status ${order.status}`);

  const clientKey = normalizeIdempotencyKey(args.idempotencyKey);
  if (!clientKey) throw new Error("Payment idempotency key is required");
  const scope = context.session?.listKey === "User" ? context.session.itemId : order.id;
  const scopedKey = buildScopedIdempotencyKey(`payment:${scope}`, clientKey);
  const keyedPayment = scopedKey ? (order.payments || []).find((payment) => payment.idempotencyKey === scopedKey) : null;
  if (keyedPayment) {
    if (keyedPayment.provider !== providerCode) throw new Error("Idempotency key was already used with a different payment provider");
    return {
      success: keyedPayment.status !== "failed",
      paymentId: keyedPayment.id,
      provider: keyedPayment.provider,
      providerPaymentId: keyedPayment.providerPaymentId,
      status: keyedPayment.status,
      amount: keyedPayment.amount ?? Number(order.total || 0),
      data: { reusedIdempotencyKey: true },
      error: null,
    };
  }

  const existingManagedPayment = (order.payments || []).find((payment) => MANAGED_PAYMENT_STATUSES.has(payment.status));
  if (existingManagedPayment) {
    if (existingManagedPayment.provider !== providerCode) throw new Error("Order already has an active payment with a different provider");
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

  const [provider] = await sudo.query.PaymentProvider.findMany({
    where: { code: { equals: providerCode }, isInstalled: { equals: true } },
    take: 1,
    query: "id code isInstalled",
  });
  if (!provider) throw new Error(`Payment provider ${providerCode} is not installed`);

  const payableAmount = Math.max(0, Number(order.total || 0) - Number(order.discount || 0));
  if (!Number.isSafeInteger(payableAmount) || payableAmount <= 0) throw new Error("Order total must be a positive integer amount");

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
    if (TERMINAL_ORDER_STATUSES.has(String(lockedOrder.status))) throw new Error(`Cannot initiate payment for an order with status ${lockedOrder.status}`);
    const payments = Array.isArray(lockedOrder.payments) ? lockedOrder.payments as CafePaymentRecord[] : [];
    const keyed = payments.find((candidate) => candidate.idempotencyKey === scopedKey);
    if (keyed) {
      if (keyed.provider !== providerCode) throw new Error("Idempotency key was already used with a different payment provider");
      return { payment: keyed, reused: true };
    }
    const active = payments.find((candidate) => MANAGED_PAYMENT_STATUSES.has(candidate.status));
    if (active) {
      if (active.provider !== providerCode) throw new Error("Order already has an active payment with a different provider");
      return { payment: active, reused: true };
    }
    const created = await tx.payment.create({
      data: {
        orderId: order.id,
        storeId: order.store?.id,
        paymentProviderId: provider.id,
        idempotencyKey: scopedKey,
        status: "pending",
        method: providerCode === "pp_system_default" ? "manual" : "card",
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
  if (claim.reused) {
    return {
      success: payment.status !== "failed",
      paymentId: payment.id,
      provider: payment.provider,
      providerPaymentId: payment.providerPaymentId,
      status: payment.status,
      amount: payment.amount ?? payableAmount,
      data: { reusedExistingPayment: true },
      error: null,
    };
  }

  let adapterResult: PaymentAdapterResult;
  try {
    adapterResult = await executePaymentProviderAdapter({
      provider,
      functionName: "createPaymentFunction",
      args: {
        orderId: order.id,
        paymentId: payment.id,
        idempotencyKey: scopedKey,
        amount: payableAmount,
        currencyCode: order.currencyCode || "USD",
        customerEmail: order.customerEmail,
        customerName: order.customerName,
        metadata: { orderNumber: order.orderNumber },
      },
    });
  } catch (error) {
    adapterResult = {
      success: false,
      provider: providerCode,
      status: "failed",
      error: error instanceof Error ? error.message : "Payment provider request failed",
    };
  }

  const paymentStatus = adapterResult.success ? "pending" : "failed";
  await sudo.db.Payment.updateOne({
    where: { id: payment.id },
    data: {
      status: paymentStatus,
      providerPaymentId: adapterResult.providerPaymentId || "",
      failureMessage: adapterResult.error || "",
    },
  });

  return {
    success: adapterResult.success,
    paymentId: payment.id,
    provider: providerCode,
    providerPaymentId: adapterResult.providerPaymentId,
    status: adapterResult.status || paymentStatus,
    amount: adapterResult.amount ?? payableAmount,
    data: adapterResult.data || null,
    error: adapterResult.error || null,
  };
}
