import { type Session } from "../access";
import { assertCoffeeStoreOwnership, enqueueCoffeeDomainEvent, getPrimaryCoffeeStoreId } from "../lib/coffeeDomainOutbox";
import { buildScopedIdempotencyKey, fingerprintInput, normalizeIdempotencyKey } from "./idempotency";
import { requireCurrentCoffeeCapability } from "./coffeeKdsAuthority";
import { assertCafeSettlement, lockCoffeeOrder, requireCafeTenderOperator, type SettlementEvidence } from "./coffeeOrderPolicy";
import { executePaymentProviderAdapter } from "../utils/paymentProviderAdapter";
import { creditCafeGiftCardInTransaction, giftCardTender } from "./giftCards";
import { cafeCustomerError } from "../lib/cafeCustomerError";
import { reverseLoyaltyEarning } from "./loyaltyReversal";
import { CAFE_ORDER_TRANSITIONS, PAYMENT_TRANSITIONS, evaluateTransition } from "./transitionPolicy";

type Args = { paymentId: string; amount?: number | null; reason?: string | null; externalRefundReference?: string | null; idempotencyKey?: string | null };
type Model = { findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>; findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>>; update(args: Record<string, unknown>): Promise<unknown>; create(args: Record<string, unknown>): Promise<unknown> };
type Tx = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  storeSetting: Model; payment: Model; cafeOrder: Model; registerShift: Model; loyaltyAccount: Model; loyaltyEvent: Model;
  posOrder: { updateMany(args: Record<string, unknown>): Promise<unknown> };
  coffeeDomainEvent: { findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null> };
};
type Context = {
  session?: Session;
  sudo(): { query: { Payment: { findOne(args: { where: { id: string }; query: string }): Promise<{ id: string; status?: string | null; order?: { id: string } | null } | null> } } };
  prisma: { $transaction<T>(fn: (tx: unknown) => Promise<T>, options: Record<string, unknown>): Promise<T> };
};
const query = "id status method amount currencyCode providerPaymentId refundIdempotencyKey refundedAmount refundReason refundedAt order { id status } registerShift { id status } refundRegisterShift { id shiftNumber }";

/** Full refunds as one ledger transaction.
 * Cash and external-terminal refunds are recorded, not performed; payout belongs to the sole open
 * register shift (the original closed drawer is immutable). Online card payments are refunded through
 * the provider inside the transaction, keyed so a retry never refunds twice, and touch no drawer.
 */
export default async function refundCafePayment(_root: unknown, args: Args, context: Context) {
  requireCafeTenderOperator(context.session);
  const clientKey = normalizeIdempotencyKey(args.idempotencyKey);
  if (!clientKey) throw new Error("Refund idempotency key is required");
  const locator = await context.sudo().query.Payment.findOne({ where: { id: args.paymentId }, query: "id order { id }" });
  if (!locator?.order?.id) throw new Error("Payment order not found");
  // The refund key belongs to one operator and one payment; another operator cannot replay it.
  const key = buildScopedIdempotencyKey(`refund:${args.paymentId}:${context.session?.itemId || "operator"}`, clientKey);
  const reason = args.reason?.trim() || "operator_refund";
  const externalReference = args.externalRefundReference?.trim() || "";
  if (reason.length > 500 || externalReference.length > 200) throw new Error("Refund reason or terminal reference is too long");

  await context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    await lockCoffeeOrder(tx, locator.order!.id);
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-payment:${args.paymentId}`);
    // Current authority after the locks, before the replay check or any private read.
    await requireCurrentCoffeeCapability(rawTx as never, context.session, ["canManageOrders"], "Not authorized to record cafe payments");
    const actorId = await requireCurrentCoffeeCapability(rawTx as never, context.session, ["canManagePayments"], "Not authorized to record cafe payments");
    const payment = await tx.payment.findUnique({ where: { id: args.paymentId } });
    if (!payment) throw new Error("Payment not found");
    const storeId = await getPrimaryCoffeeStoreId(tx as never);
    assertCoffeeStoreOwnership(payment.storeId, storeId, "Payment");
    const amount = args.amount == null ? Number(payment.amount) : Number(args.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount !== Number(payment.amount)) throw new Error("Only full refunds of the captured amount are currently supported");
    // The original refund request (actor, amount, reason, terminal reference) is bound to its key.
    const requestFingerprint = fingerprintInput({ paymentId: args.paymentId, actorId, amount, currencyCode: String(payment.currencyCode || ""), reason, externalRefundReference: externalReference || null });
    if (payment.status === "refunded") {
      if (payment.refundIdempotencyKey !== key) throw new Error("Payment was already refunded by another request");
      const receipt = await tx.coffeeDomainEvent.findUnique({ where: { eventKey: `payment:${args.paymentId}:refunded:v1` } });
      const payload = receipt?.payload && typeof receipt.payload === "object" ? receipt.payload as Record<string, unknown> : null;
      const matches = payload && typeof payload.requestFingerprint === "string"
        ? payload.requestFingerprint === requestFingerprint
        : Boolean(payload) && payload!.reason === reason && (payload!.externalRefundReference ?? null) === (externalReference || null) && Number(payload!.amount) === amount;
      if (!matches) throw new Error("This refund was already recorded with a different reason or terminal reference");
      return;
    }
    if (payment.status !== "captured") throw new Error(`Cannot refund payment with status ${String(payment.status)}`);
    evaluateTransition(PAYMENT_TRANSITIONS, "captured", "refunded");
    const isOnline = payment.provider === "pp_stripe_stripe";
    if (!isOnline && payment.provider !== "pp_system_default") throw new Error("Refunds for this payment provider aren't supported");
    if (!["cash", "card", "gift_card"].includes(String(payment.method))) throw new Error("Unsupported refund tender");
    const isGiftCard = payment.method === "gift_card";
    // Hosted Checkout payments keep their page reference (cs_…); the refund goes to its payment intent.
    let refundTarget = String(payment.providerPaymentId || "");
    if (isOnline && refundTarget.startsWith("cs_")) {
      const page = await executePaymentProviderAdapter({ provider: { code: "pp_stripe_stripe" }, functionName: "getPaymentStatusFunction", args: { providerPaymentId: refundTarget } }).catch(() => null);
      const intent = (page?.data as Record<string, unknown> | undefined)?.payment_intent;
      refundTarget = typeof intent === "string" ? intent : "";
    }
    if (isOnline && !refundTarget.startsWith("pi_")) throw cafeCustomerError("This online payment hasn't finished settling. Try the refund again shortly.");
    if (!isOnline && payment.method === "card" && externalReference.length < 4) throw new Error("Record the external terminal refund reference before updating the cafe ledger");
    if (payment.refundIdempotencyKey && payment.refundIdempotencyKey !== key) throw new Error("A different refund request already owns this payment");
    const order = await tx.cafeOrder.findUnique({
      where: { id: payment.orderId },
      select: { id: true, storeId: true, status: true, total: true, discount: true, loyaltyAccountId: true, payments: { select: { id: true, status: true, amount: true, refundIdempotencyKey: true } } },
    });
    if (!order) throw new Error("Payment order not found");
    assertCoffeeStoreOwnership(order.storeId, storeId, "Payment order");
    // Same lifecycle map as every other order writer: a refunded order cannot be refunded again.
    evaluateTransition(CAFE_ORDER_TRANSITIONS, String(order.status), "refunded");
    const orderPayments = Array.isArray(order.payments) ? order.payments as SettlementEvidence[] : [];
    assertCafeSettlement(orderPayments, Number(order.total || 0) - Number(order.discount || 0));
    if (!orderPayments.some((candidate) => candidate.id === payment.id && candidate.status === "captured")) throw new Error("Refund payment does not match the order's full settlement");

    // Online refunds go back to the card through the provider; only counter refunds pay out of a drawer.
    let shiftId: string | null = null;
    let shift: Record<string, unknown> | null = null;
    if (!isOnline && !isGiftCard) {
      const shifts = await tx.registerShift.findMany({ where: { storeId, status: "open" }, take: 2, orderBy: { openedAt: "asc" }, select: { id: true } });
      if (shifts.length !== 1) throw new Error("Refunds require exactly one open payout register shift");
      shiftId = String(shifts[0].id);
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-register-shift:${shiftId}`);
      shift = await tx.registerShift.findUnique({ where: { id: shiftId } });
      if (!shift || shift.status !== "open") throw new Error("The payout register closed before the refund was recorded");
      assertCoffeeStoreOwnership(shift.storeId, storeId, "Payout register");
      const drawerCashCents = Number(shift.openingCashCents || 0) + Number(shift.cashSalesCents || 0) - Number(shift.cashRefundsCents || 0) + Number(shift.payInsCents || 0) - Number(shift.payOutsCents || 0);
      // Cash cannot leave the drawer beyond what the ledger says is in it (same rule as pay-outs).
      if (payment.method === "cash" && amount > drawerCashCents) {
        throw new Error(`Cash refund exceeds the ${(Math.max(0, drawerCashCents) / 100).toFixed(2)} expected in the payout drawer`);
      }
    }

    if (order.loyaltyAccountId) {
      const account = await tx.loyaltyAccount.findUnique({ where: { id: order.loyaltyAccountId } });
      if (!account) throw new Error("Loyalty account requires reconciliation before refund");
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `loyalty-account:${String(account.customerEmail)}`);
      const current = await tx.loyaltyAccount.findUnique({ where: { id: account.id } });
      if (!current) throw new Error("Loyalty account not found");
      assertCoffeeStoreOwnership(current.storeId, storeId, "Loyalty account");
      const earned = await tx.loyaltyEvent.findMany({ where: { orderId: order.id, accountId: current.id, type: "earned" }, take: 2 });
      if (earned.length !== 1) throw new Error("Loyalty earning evidence requires reconciliation before refund");
      const points = Number(earned[0].pointsDelta || 0);
      // Reverse exactly the original earning; inconsistent history is reconciled, never clamped away.
      const reversal = reverseLoyaltyEarning({
        pointsBalance: Number(current.pointsBalance || 0),
        drinkCredits: Number(current.drinkCredits || 0),
        lifetimePoints: Number(current.lifetimePoints || 0),
        visits: Number(current.visits || 0),
      }, points);
      if (!reversal.ok) throw new Error(reversal.error);
      await tx.loyaltyAccount.update({ where: { id: current.id }, data: reversal.next });
      await tx.loyaltyEvent.create({ data: { accountId: current.id, orderId: order.id, type: "refund_reversal", pointsDelta: -points, drinkCreditsDelta: reversal.drinkCreditsDelta, note: `Reversed ${points} points earned on this order after full refund of payment ${args.paymentId}`, createdById: actorId } });
    }
    const now = new Date();
    let providerRefundId: string | null = null;
    if (isOnline) {
      // Last step before the ledger writes: if the provider refuses, nothing is recorded; if the
      // commit fails after it succeeds, a retry with the same key returns the same provider refund.
      const result = await executePaymentProviderAdapter({
        provider: { code: "pp_stripe_stripe" },
        functionName: "refundPaymentFunction",
        args: { providerPaymentId: refundTarget, amount, reason, idempotencyKey: `refund:${key}`, currencyCode: String(payment.currencyCode || "USD") },
      }).catch(() => null);
      if (!result?.success || !["refunded", "pending"].includes(String(result.status))) throw cafeCustomerError("The card refund didn't go through. Nothing was recorded; try again.");
      providerRefundId = result.providerPaymentId ? String(result.providerPaymentId) : null;
    } else if (isGiftCard) {
      // Gift card tender goes back onto the same card; no drawer or terminal is involved.
      await creditCafeGiftCardInTransaction(tx, { code: giftCardTender.codeOf(String(payment.providerPaymentId)), amount, ref: `refund:${String(payment.id)}`, now });
    } else if (shift && shiftId) {
      const isCash = payment.method === "cash";
      const cashRefundsCents = Number(shift.cashRefundsCents || 0) + (isCash ? amount : 0);
      const cardRefundsCents = Number(shift.cardRefundsCents || 0) + (isCash ? 0 : amount);
      await tx.registerShift.update({ where: { id: shiftId }, data: { cashRefundsCents, cardRefundsCents, expectedCashCents: Math.max(0, Number(shift.openingCashCents || 0) + Number(shift.cashSalesCents || 0) - cashRefundsCents + Number(shift.payInsCents || 0) - Number(shift.payOutsCents || 0)) } });
    }
    const refundNote = isGiftCard ? `${reason}; returned to gift card` : isOnline ? `${reason}; card refund ${providerRefundId || "issued"}` : externalReference ? `${reason}; external terminal refund ${externalReference}` : reason;
    await tx.payment.update({ where: { id: payment.id }, data: { status: "refunded", refundIdempotencyKey: key, refundedAmount: amount, refundReason: refundNote, refundedAt: now, refundRegisterShiftId: shiftId, failureMessage: "" } });
    await tx.cafeOrder.update({ where: { id: order.id }, data: { status: "refunded" } });
    await tx.posOrder.updateMany({ where: { cafeOrderId: order.id, status: "paid" }, data: { status: "refunded" } });
    await enqueueCoffeeDomainEvent(tx as never, { storeId, eventKey: `payment:${args.paymentId}:refunded:v1`, eventType: "payment.refunded", aggregateType: "payment", aggregateId: args.paymentId, occurredAt: now, payload: { paymentId: args.paymentId, orderId: String(order.id), originalRegisterShiftId: String(payment.registerShiftId || "") || null, refundRegisterShiftId: shiftId, refundedBy: actorId, requestFingerprint, method: String(payment.method), amount, currencyCode: String(payment.currencyCode), reason, externalRefundReference: externalReference || null } });
  }, { maxWait: 5000, timeout: 20000, isolationLevel: "ReadCommitted" });
  return context.sudo().query.Payment.findOne({ where: { id: args.paymentId }, query });
}
