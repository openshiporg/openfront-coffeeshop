import { createHash } from "node:crypto";

import { isOnlinePaymentProviderCode, type VerifiedPaymentWebhook } from "../../integrations/payment";
import { executePaymentProviderAdapter } from "../utils/paymentProviderAdapter";
import { assertCoffeeStoreOwnership, enqueueCoffeeDomainEvent, getPrimaryCoffeeStoreId } from "../lib/coffeeDomainOutbox";

type Args = { providerCode: string; rawBody: string; headers: Record<string, string> };
type PaymentRow = {
  id: string;
  storeId: string;
  status: string | null;
  amount: number;
  currencyCode: string;
  provider: string;
  providerPaymentId: string | null;
  orderId: string | null;
  order: { id: string; storeId: string; status: string | null } | null;
};
type EventRow = { id: string; storeId: string; payloadHash: string; paymentId: string | null; orderId: string | null };
type TransactionClient = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  paymentEvent: {
    findUnique(args: { where: { replayKey: string }; select: Record<string, boolean> }): Promise<EventRow | null>;
    create(args: { data: Record<string, unknown>; select: { id: true } }): Promise<{ id: string }>;
  };
  payment: {
    findUnique(args: { where: { id: string }; include: { order: true } }): Promise<PaymentRow | null>;
    findFirst(args: { where: Record<string, unknown>; include: { order: true } }): Promise<PaymentRow | null>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  };
  cafeOrder: { update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown> };
  storeSetting: { findUnique(args: Record<string, unknown>): Promise<{ id: string } | null> };
};
type Context = {
  sudo(): {
    query: {
      PaymentProvider: {
        findMany(args: { where: Record<string, unknown>; take: number; query: string }): Promise<Array<{ id: string; code: string }>>;
      };
    };
  };
  prisma: {
    $transaction<T>(fn: (tx: TransactionClient) => Promise<T>, options: Record<string, unknown>): Promise<T>;
  };
};

const TERMINAL_UNSETTLED_ORDER_STATUSES = new Set(["cancelled", "refunded"]);

function replayKey(providerCode: string, eventId: string) {
  return `${providerCode}:${eventId}`;
}

function payloadHash(rawBody: string) {
  return createHash("sha256").update(rawBody).digest("hex");
}

function assertSettlementMatches(payment: PaymentRow, providerCode: string, verified: VerifiedPaymentWebhook) {
  if (payment.provider !== providerCode) throw new Error("Webhook provider does not match payment");
  if (verified.orderId && verified.orderId !== payment.orderId) throw new Error("Webhook order does not match payment");
  if (verified.amount == null || verified.amount !== payment.amount) throw new Error("Webhook amount does not match payment");
  if (!verified.currencyCode || verified.currencyCode.toUpperCase() !== payment.currencyCode.toUpperCase()) {
    throw new Error("Webhook currency does not match payment");
  }
}

async function findPayment(tx: TransactionClient, providerCode: string, verified: VerifiedPaymentWebhook) {
  if (verified.paymentId) {
    return tx.payment.findUnique({ where: { id: verified.paymentId }, include: { order: true } });
  }
  return tx.payment.findFirst({
    where: { provider: providerCode, providerPaymentId: verified.providerPaymentId },
    include: { order: true },
  });
}

/** Signed provider webhook. Settling a payment never skips admission: an open request stays open
 *  (paid) until staff accept it for capacity and stock; an accepted one becomes paid. */
export default async function handleCafePaymentWebhook(_root: unknown, args: Args, context: Context) {
  if (!isOnlinePaymentProviderCode(args.providerCode)) throw new Error("Webhook provider not found");
  if (!args.rawBody || Buffer.byteLength(args.rawBody, "utf8") > 1024 * 1024) throw new Error("Invalid webhook body");

  const [provider] = await context.sudo().query.PaymentProvider.findMany({
    where: { code: { equals: args.providerCode }, isInstalled: { equals: true } },
    take: 1,
    query: "id code",
  });
  if (!provider) throw new Error("Payment provider is not installed");

  const verified = await executePaymentProviderAdapter({
    provider,
    functionName: "handleWebhookFunction",
    args: { rawBody: args.rawBody, headers: args.headers },
  });
  if (!verified.eventId || verified.eventId.length > 255) throw new Error("Verified webhook event id is invalid");

  const key = replayKey(provider.code, verified.eventId);
  const hash = payloadHash(args.rawBody);

  return context.prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
      "coffee-payment-webhook",
      key,
    );

    const storeId = await getPrimaryCoffeeStoreId(tx as never);
    const existing = await tx.paymentEvent.findUnique({
      where: { replayKey: key },
      select: { id: true, storeId: true, payloadHash: true, paymentId: true, orderId: true },
    });
    if (existing) {
      assertCoffeeStoreOwnership(existing.storeId, storeId, "Payment event");
      if (existing.payloadHash !== hash) throw new Error("Webhook replay key is bound to different payload evidence");
      return { success: true, replayed: true, paymentId: existing.paymentId, orderId: existing.orderId };
    }

    const payment = await findPayment(tx, provider.code, verified);
    if (verified.status !== "ignored" && !payment) throw new Error("Webhook payment was not found");
    if (payment) {
      assertCoffeeStoreOwnership(payment.storeId, storeId, "Payment");
      if (payment.order) assertCoffeeStoreOwnership(payment.order.storeId, storeId, "Payment order");
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-payment:${payment.id}`);
    }

    if (verified.status === "succeeded" && payment) {
      assertSettlementMatches(payment, provider.code, verified);
      if (payment.status !== "captured") {
        // Money arrived, so it is always recorded, even on a page that expired a moment earlier;
        // a cancelled order keeps its status and the payment is flagged for a refund.
        const cancelled = Boolean(payment.order && TERMINAL_UNSETTLED_ORDER_STATUSES.has(payment.order.status || ""));
        const settledAt = new Date();
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: "captured",
            processedAt: settledAt,
            failureMessage: cancelled ? "Paid after the order was cancelled; refund it" : "",
            // Refunds go to the payment intent, not the hosted page.
            ...(verified.providerPaymentId.startsWith("pi_") ? { providerPaymentId: verified.providerPaymentId } : {}),
          },
        });
        if (payment.orderId && !cancelled) {
          const status = payment.order?.status === "accepted" ? "paid" : undefined;
          await tx.cafeOrder.update({ where: { id: payment.orderId }, data: { paidAt: settledAt, ...(status ? { status } : {}) } });
        }
      }
    } else if (verified.status === "failed" && payment && (payment.status === "pending" || payment.status === "authorized")) {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "failed", failureMessage: `Provider event ${verified.eventType}` },
      });
    }

    await tx.paymentEvent.create({
      data: {
        replayKey: key,
        storeId,
        providerCode: provider.code,
        providerEventId: verified.eventId,
        eventType: verified.eventType,
        payloadHash: hash,
        status: verified.status === "ignored" ? "ignored" : "processed",
        paymentId: payment?.id || null,
        orderId: payment?.orderId || verified.orderId || null,
        processedAt: new Date(),
      },
      select: { id: true },
    });
    await enqueueCoffeeDomainEvent(tx as never, {
      storeId,
      eventKey: `payment-webhook:${key}:v1`,
      eventType: `payment.${verified.status}`,
      aggregateType: "payment",
      aggregateId: payment?.id || verified.paymentId || verified.providerPaymentId || verified.eventId,
      payload: { providerCode: provider.code, providerEventId: verified.eventId, eventType: verified.eventType, status: verified.status, paymentId: payment?.id || null, orderId: payment?.orderId || verified.orderId || null, amount: verified.amount ?? null, currencyCode: verified.currencyCode || null },
    });

    return { success: true, replayed: false, paymentId: payment?.id || null, orderId: payment?.orderId || verified.orderId || null };
  }, { maxWait: 5000, timeout: 10000, isolationLevel: "Serializable" });
}
