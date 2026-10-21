import { createHash } from "node:crypto";

import { permissions, type Session } from "../access";
import { assertCoffeeStoreOwnership, enqueueCoffeeDomainEvent, getPrimaryCoffeeStoreId } from "../lib/coffeeDomainOutbox";
import { buildScopedIdempotencyKey, normalizeIdempotencyKey } from "./idempotency";
import { requireCurrentCoffeeCapability } from "./coffeeKdsAuthority";
import { assertCafeMoneyCents } from "./coffeePricing";

type Context = {
  session?: Session;
  prisma: { $transaction<T>(fn: (tx: unknown) => Promise<T>, options: Record<string, unknown>): Promise<T> };
};
type TransactionClient = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  registerShift: {
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  cashMovement: {
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  storeSetting: { findUnique(args: Record<string, unknown>): Promise<{ id: string } | null> };
};

const TX_OPTIONS = { maxWait: 5000, timeout: 10000, isolationLevel: "ReadCommitted" };
const MOVEMENT_TYPES = new Set(["pay_in", "pay_out", "cash_drop"]);

function requireRegisterOperator(context: Context) {
  const canOperate = permissions.canManageOrders({ session: context.session }) && permissions.canManagePayments({ session: context.session });
  if (!canOperate || !context.session?.itemId) throw new Error("Not authorized to operate register shifts");
  return context.session.itemId;
}
/** Current operator authority inside the effect transaction, before any private read or replay. */
async function requireCurrentRegisterOperator(tx: unknown, context: Context) {
  await requireCurrentCoffeeCapability(tx as never, context.session, ["canManageOrders"], "Not authorized to operate register shifts");
  await requireCurrentCoffeeCapability(tx as never, context.session, ["canManagePayments"], "Not authorized to operate register shifts");
}
function cents(value: unknown, label: string, allowZero = true) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < (allowZero ? 0 : 1) || parsed > 100_000_000) {
    throw new Error(`${label} must be a valid integer amount in cents`);
  }
  return parsed;
}
function scopedKey(context: Context, purpose: string, value: string | null | undefined) {
  const normalized = normalizeIdempotencyKey(value);
  if (!normalized) throw new Error(`${purpose} idempotency key is required`);
  return buildScopedIdempotencyKey(`${purpose}:${context.session?.itemId}`, normalized);
}
function reference(prefix: string, value: string) {
  return `${prefix}-${createHash("sha256").update(value).digest("hex").slice(0, 12).toUpperCase()}`;
}
function expectedCash(shift: Record<string, unknown>) {
  return Number(shift.openingCashCents || 0)
    + Number(shift.cashSalesCents || 0)
    - Number(shift.cashRefundsCents || 0)
    + Number(shift.payInsCents || 0)
    - Number(shift.payOutsCents || 0);
}

export async function openRegisterShift(
  _root: unknown,
  args: { registerName: string; openingCashCents: number; idempotencyKey: string },
  context: Context,
) {
  const userId = requireRegisterOperator(context);
  const registerName = args.registerName?.trim();
  if (!registerName || registerName.length > 100) throw new Error("Register name is required");
  const openingCashCents = cents(args.openingCashCents, "Opening cash");
  const key = scopedKey(context, "register-open", args.idempotencyKey);

  return context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx as TransactionClient;
    await requireCurrentRegisterOperator(tx, context);
    const storeId = await getPrimaryCoffeeStoreId(tx as never);
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-register-open:${storeId}`);
    const replay = await tx.registerShift.findUnique({ where: { idempotencyKey: key } });
    if (replay) {
      if (replay.registerName !== registerName || Number(replay.openingCashCents) !== openingCashCents) throw new Error("Register idempotency key conflicts with different opening data");
      return replay;
    }
    const alreadyOpen = await tx.registerShift.findFirst({
      where: { storeId, status: "open" },
    });
    if (alreadyOpen) throw new Error("This single-register cafe already has an open shift; close it before opening another");

    const shift = await tx.registerShift.create({
      data: {
        idempotencyKey: key,
        storeId,
        shiftNumber: reference("REG", key),
        registerName,
        status: "open",
        openingCashCents,
        expectedCashCents: openingCashCents,
        openedById: userId,
        openedAt: new Date(),
      },
    });
    await enqueueCoffeeDomainEvent(tx as never, {
      storeId,
      eventKey: `register-shift:${String(shift.id)}:opened:v1`,
      eventType: "register_shift.opened",
      aggregateType: "register_shift",
      aggregateId: String(shift.id),
      payload: { shiftId: String(shift.id), shiftNumber: String(shift.shiftNumber), registerName, openingCashCents },
    });
    return shift;
  }, TX_OPTIONS);
}

export async function recordRegisterCashMovement(
  _root: unknown,
  args: { registerShiftId: string; type: string; amountCents: number; reason: string; idempotencyKey: string },
  context: Context,
) {
  const userId = requireRegisterOperator(context);
  if (!MOVEMENT_TYPES.has(args.type)) throw new Error("Invalid register cash movement type");
  const amountCents = cents(args.amountCents, "Cash movement", false);
  const reason = args.reason?.trim();
  if (!reason || reason.length > 500) throw new Error("Cash movement reason is required");
  const key = scopedKey(context, "register-movement", args.idempotencyKey);

  return context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx as TransactionClient;
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-register-shift:${args.registerShiftId}`);
    await requireCurrentRegisterOperator(tx, context);
    const replay = await tx.cashMovement.findUnique({ where: { idempotencyKey: key } });
    if (replay) {
      if (replay.registerShiftId !== args.registerShiftId || replay.type !== args.type || Number(replay.amountCents) !== amountCents || replay.reason !== reason) throw new Error("Cash movement idempotency key conflicts with different data");
      return replay;
    }
    const shift = await tx.registerShift.findUnique({ where: { id: args.registerShiftId } });
    if (!shift) throw new Error("Register shift not found");
    const storeId = await getPrimaryCoffeeStoreId(tx as never);
    assertCoffeeStoreOwnership(shift.storeId, storeId, "Register shift");
    if (shift.status !== "open") throw new Error("Cash movements require an open register shift");

    const isPayIn = args.type === "pay_in";
    // Cash cannot leave the drawer beyond what the ledger says is in it; a physical
    // shortfall is recorded at close as counted-cash variance, not as an impossible payout.
    const availableCashCents = expectedCash(shift);
    if (!isPayIn && amountCents > availableCashCents) {
      throw new Error(`${args.type === "cash_drop" ? "Cash drop" : "Pay out"} exceeds the ${(Math.max(0, availableCashCents) / 100).toFixed(2)} expected in the drawer`);
    }
    const payInsCents = assertCafeMoneyCents(Number(shift.payInsCents || 0) + (isPayIn ? amountCents : 0), "Shift pay-ins");
    const payOutsCents = assertCafeMoneyCents(Number(shift.payOutsCents || 0) + (isPayIn ? 0 : amountCents), "Shift pay-outs");
    await tx.registerShift.update({
      where: { id: args.registerShiftId },
      data: {
        payInsCents,
        payOutsCents,
        expectedCashCents: Number(shift.openingCashCents || 0)
          + Number(shift.cashSalesCents || 0)
          - Number(shift.cashRefundsCents || 0)
          + payInsCents
          - payOutsCents,
      },
    });
    const movement = await tx.cashMovement.create({
      data: {
        idempotencyKey: key,
        storeId,
        movementNumber: reference("CASH", key),
        registerShiftId: args.registerShiftId,
        type: args.type,
        amountCents,
        reason,
        recordedById: userId,
        recordedAt: new Date(),
      },
    });
    await enqueueCoffeeDomainEvent(tx as never, {
      storeId,
      eventKey: `cash-movement:${String(movement.id)}:recorded:v1`,
      eventType: "register_cash.recorded",
      aggregateType: "register_shift",
      aggregateId: args.registerShiftId,
      payload: { movementId: String(movement.id), shiftId: args.registerShiftId, type: args.type, amountCents, reason },
    });
    return movement;
  }, TX_OPTIONS);
}

export async function closeRegisterShift(
  _root: unknown,
  args: { registerShiftId: string; countedCashCents: number; idempotencyKey: string },
  context: Context,
) {
  const userId = requireRegisterOperator(context);
  const countedCashCents = cents(args.countedCashCents, "Counted cash");
  const key = scopedKey(context, "register-close", args.idempotencyKey);

  return context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx as TransactionClient;
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-register-shift:${args.registerShiftId}`);
    await requireCurrentRegisterOperator(tx, context);
    const shift = await tx.registerShift.findUnique({ where: { id: args.registerShiftId } });
    if (!shift) throw new Error("Register shift not found");
    const storeId = await getPrimaryCoffeeStoreId(tx as never);
    assertCoffeeStoreOwnership(shift.storeId, storeId, "Register shift");
    if (shift.status === "closed") {
      if (shift.closeIdempotencyKey !== key || Number(shift.countedCashCents) !== countedCashCents) throw new Error("Register shift was already closed with different evidence");
      return shift;
    }

    const expectedCashCents = expectedCash(shift);
    const closed = await tx.registerShift.update({
      where: { id: args.registerShiftId },
      data: {
        closeIdempotencyKey: key,
        status: "closed",
        expectedCashCents,
        countedCashCents,
        cashVarianceCents: countedCashCents - expectedCashCents,
        closedById: userId,
        closedAt: new Date(),
      },
    });
    await enqueueCoffeeDomainEvent(tx as never, {
      storeId,
      eventKey: `register-shift:${args.registerShiftId}:closed:v1`,
      eventType: "register_shift.closed",
      aggregateType: "register_shift",
      aggregateId: args.registerShiftId,
      payload: { shiftId: args.registerShiftId, expectedCashCents, countedCashCents, varianceCents: countedCashCents - expectedCashCents },
    });
    return closed;
  }, TX_OPTIONS);
}
