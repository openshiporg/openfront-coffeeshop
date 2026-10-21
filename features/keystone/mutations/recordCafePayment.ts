import { randomUUID } from "node:crypto";

import { type Session } from "../access";
import { lockCoffeeOrder, requireCafeTenderOperator } from "./coffeeOrderPolicy";
import { assertCoffeeStoreOwnership, enqueueCoffeeDomainEvent, getPrimaryCoffeeStoreId } from "../lib/coffeeDomainOutbox";
import { buildScopedIdempotencyKey, fingerprintInput, normalizeIdempotencyKey } from "./idempotency";
import { consumeCafeInventoryRequirements, getCafeInventoryRequirements } from "./coffeeInventoryConsumption";
import { admitOpenCafeOrder, lockAndReadAdmissionLines } from "./acceptCafePickupOrder";
import { requireCurrentCoffeeCapability } from "./coffeeKdsAuthority";

type Args = { orderId: string; method: string; idempotencyKey?: string | null; externalCardReference?: string | null; externalCardApproved?: boolean | null };
type TransactionClient = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  $queryRawUnsafe<R>(query: string, ...values: unknown[]): Promise<R>;
  storeSetting: { findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null> };
  orderItem: { findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>> };
  cafeOrder: {
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    count(args: Record<string, unknown>): Promise<number>;
    update(args: Record<string, unknown>): Promise<unknown>;
  };
  paymentProvider: { findUnique(args: Record<string, unknown>): Promise<{ id: string } | null> };
  payment: { create(args: Record<string, unknown>): Promise<{ id: string }>; findFirst(args: Record<string, unknown>): Promise<{ id: string } | null> };
  registerShift: {
    findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    update(args: Record<string, unknown>): Promise<unknown>;
  };
  recipe: { findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>> };
  menuItemModifier: { findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>> };
  inventoryItem: { findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>>; findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>; update(args: Record<string, unknown>): Promise<unknown> };
  inventoryLot: { findMany(args: Record<string, unknown>): Promise<Array<{ id: string; quantityRemaining: unknown }>>; update(args: Record<string, unknown>): Promise<unknown> };
  stockMovement: { create(args: Record<string, unknown>): Promise<unknown> };
  prepBatch: { findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>>; findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>; update(args: Record<string, unknown>): Promise<unknown> };
  prepBatchConsumption: { create(args: Record<string, unknown>): Promise<unknown> };
};
type Context = {
  session?: Session;
  prisma: { $transaction<T>(fn: (tx: unknown) => Promise<T>, options: Record<string, unknown>): Promise<T> };
  sudo(): { query: { Payment: { findOne(args: { where: { id: string }; query: string }): Promise<unknown> } } };
};

const TX_OPTIONS = { maxWait: 5000, timeout: 10000, isolationLevel: "ReadCommitted" };
const PAYMENT_QUERY = "id status method amount currencyCode provider providerPaymentId processedAt order { id status }";

export default async function recordCafePayment(_root: unknown, args: Args, context: Context) {
  requireCafeTenderOperator(context.session);
  if (!args.orderId) throw new Error("Order id is required");
  if (!['cash', 'card'].includes(args.method)) throw new Error("Recorded payment method must be cash or card");
  // Same operator-attested terminal evidence the POS card tender requires.
  const externalCardReference = args.externalCardReference?.trim() || "";
  if (args.method === "card") {
    if (args.externalCardApproved !== true) throw new Error("Confirm the card terminal approved this exact amount before recording the card payment");
    if (!/^[A-Za-z0-9#._:\/-]{4,64}$/.test(externalCardReference)) throw new Error("Enter the terminal approval or reference code (4-64 letters, numbers or #._:/-)");
  } else if (externalCardReference || args.externalCardApproved) throw new Error("A terminal reference applies only to an external card payment");
  const providerPaymentId = args.method === "cash" ? `cash_${randomUUID()}` : `external_terminal:${externalCardReference}`;
  const clientKey = normalizeIdempotencyKey(args.idempotencyKey);
  if (!clientKey) throw new Error("Recorded payment idempotency key is required");
  const scope = context.session?.listKey === "User" ? context.session.itemId : "operator";
  const scopedKey = buildScopedIdempotencyKey(`record-payment:${scope}`, clientKey);

  const paymentId = await context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx as TransactionClient;
    await lockCoffeeOrder(tx, args.orderId);
    // Current authority after the lock, before any replay or private read.
    await requireCurrentCoffeeCapability(rawTx as never, context.session, ["canManageOrders"], "Not authorized to record cafe payments");
    const actorId = await requireCurrentCoffeeCapability(rawTx as never, context.session, ["canManagePayments"], "Not authorized to record cafe payments");
    const order = await tx.cafeOrder.findUnique({
      where: { id: args.orderId },
      select: {
        id: true,
        storeId: true,
        orderNumber: true,
        status: true,
        total: true,
        discount: true,
        currencyCode: true,
        tip: true,
        fulfillmentType: true,
        promisedAt: true,
        payments: { select: { id: true, status: true, method: true, idempotencyKey: true, providerPaymentId: true } },
      },
    });
    if (!order) throw new Error("Cafe order not found");
    const storeId = await getPrimaryCoffeeStoreId(tx as never);
    assertCoffeeStoreOwnership(String(order.storeId), storeId, "Cafe order");
    const payments = Array.isArray(order.payments) ? order.payments as Array<Record<string, unknown>> : [];
    const replay = payments.find((payment) => payment.idempotencyKey === scopedKey);
    if (replay) {
      if (replay.status !== "captured" || replay.method !== args.method || (args.method === "card" && replay.providerPaymentId !== providerPaymentId)) throw new Error("Recorded payment idempotency key conflicts with existing evidence");
      return String(replay.id);
    }
    if (!["open", "accepted", "in_bar_queue", "preparing", "ready"].includes(String(order.status))) throw new Error(`Cannot record settlement for an order with status ${String(order.status)}`);
    if (payments.some((payment) => ["pending", "authorized", "captured"].includes(String(payment.status)))) {
      throw new Error("Order already has an active payment attempt");
    }
    const amount = Number(order.total || 0) - Number(order.discount || 0);
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Order payable amount is invalid");
    if (args.method === "card") {
      const duplicate = await tx.payment.findFirst({ where: { storeId, method: "card", providerPaymentId }, select: { id: true } });
      if (duplicate) throw new Error("This terminal approval reference is already recorded on another sale");
    }
    const provider = await tx.paymentProvider.findUnique({ where: { code: "pp_system_default" }, select: { id: true } });
    if (!provider) throw new Error("System payment provider is not configured");
    const openShifts = await tx.registerShift.findMany({ where: { storeId, status: "open" }, take: 2, orderBy: { openedAt: "asc" }, select: { id: true } });
    if (openShifts.length !== 1) throw new Error("Exactly one open register shift is required to record pay-at-pickup settlement");
    const candidateShift = openShifts[0];
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-register-shift:${String(candidateShift.id)}`);
    const registerShift = await tx.registerShift.findUnique({ where: { id: candidateShift.id } });
    if (!registerShift || registerShift.status !== "open") throw new Error("The register shift closed before settlement was recorded");
    assertCoffeeStoreOwnership(String(registerShift.storeId), storeId, "Register shift");

    // Settling an open request admits it: same current hours/item/option/capacity checks as acceptance,
    // with the order's menu items locked before its lines are read.
    const admissionLines = order.status === "open" ? await lockAndReadAdmissionLines(tx, String(order.id)) : [];
    const admittedPromisedAt = order.status === "open" ? await admitOpenCafeOrder(tx, { ...order, orderItems: admissionLines }, storeId) : null;

    if (order.status === "open") {
      const requirements = await getCafeInventoryRequirements(tx, storeId, admissionLines.map((rawLine) => {
        const line = rawLine as Record<string, unknown>;
        const menuItem = line.menuItem as Record<string, unknown> | null;
        const snapshots = Array.isArray(line.modifierSnapshot) ? line.modifierSnapshot as Array<Record<string, unknown>> : [];
        return { menuItemId: String(menuItem?.id || ""), fallbackInventoryItemId: menuItem?.inventoryItemId ? String(menuItem.inventoryItemId) : null, quantity: Number(line.quantity || 0), modifierIds: snapshots.map((snapshot) => String(snapshot.id || "")).filter(Boolean) };
      }));
      await consumeCafeInventoryRequirements(tx, { storeId, orderId: String(order.id), orderNumber: String(order.orderNumber), requirements, reason: `Pickup settlement ${String(order.orderNumber)}`, createdById: actorId });
    }
    const settledAt = new Date();
    const payment = await tx.payment.create({
      data: {
        orderId: order.id,
        storeId,
        paymentProviderId: provider.id,
        idempotencyKey: scopedKey,
        status: "captured",
        method: args.method,
        amount,
        currencyCode: String(order.currencyCode || "USD"),
        provider: "pp_system_default",
        providerPaymentId,
        processedAt: settledAt,
        registerShiftId: String(registerShift.id),
        metadata: {
          tender: args.method === "cash"
            ? { method: "cash", evidence: "cash_received_at_register" }
            : { method: "external_card", evidence: "operator_attested_terminal_approval", terminalReference: externalCardReference, attestedById: actorId, attestedAt: settledAt.toISOString(), providerVerified: false },
        },
      },
      select: { id: true },
    });
    await tx.cafeOrder.update({ where: { id: order.id }, data: { status: ["open", "accepted"].includes(String(order.status)) ? "paid" : order.status, paidAt: settledAt, ...(admittedPromisedAt ? { promisedAt: admittedPromisedAt } : {}) } });
    const isCash = args.method === "cash";
    const cashSalesCents = Number(registerShift.cashSalesCents || 0) + (isCash ? amount : 0);
    const cardSalesCents = Number(registerShift.cardSalesCents || 0) + (isCash ? 0 : amount);
    await tx.registerShift.update({
      where: { id: registerShift.id },
      data: {
        cashSalesCents,
        cardSalesCents,
        tipsCents: Number(registerShift.tipsCents || 0) + Number(order.tip || 0),
        expectedCashCents: Number(registerShift.openingCashCents || 0) + cashSalesCents - Number(registerShift.cashRefundsCents || 0) + Number(registerShift.payInsCents || 0) - Number(registerShift.payOutsCents || 0),
      },
    });
    await enqueueCoffeeDomainEvent(tx as never, {
      storeId,
      eventKey: `payment:${payment.id}:captured:v1`,
      eventType: "payment.captured",
      aggregateType: "payment",
      aggregateId: payment.id,
      occurredAt: settledAt,
      payload: { paymentId: payment.id, orderId: String(order.id), orderNumber: String(order.orderNumber), registerShiftId: String(registerShift.id), recordedBy: actorId, method: args.method, amount, currencyCode: String(order.currencyCode || "USD"), externalCardReference: externalCardReference || null, requestFingerprint: fingerprintInput({ orderId: String(order.id), actorId, method: args.method, amount, externalCardReference: externalCardReference || null, externalCardApproved: args.method === "card" }) },
    });
    return payment.id;
  }, TX_OPTIONS);

  return context.sudo().query.Payment.findOne({ where: { id: paymentId }, query: PAYMENT_QUERY });
}
