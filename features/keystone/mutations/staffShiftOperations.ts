import { createHash } from "node:crypto";

import { permissions, type Session } from "../access";
import { assertCoffeeStoreOwnership, enqueueCoffeeDomainEvent, getPrimaryCoffeeStoreId } from "../lib/coffeeDomainOutbox";
import { requireCurrentCoffeeCapability } from "./coffeeKdsAuthority";
import { buildScopedIdempotencyKey, fingerprintInput, normalizeIdempotencyKey } from "./idempotency";

const STAFF_ROLES = new Set(["barista", "shift_lead", "kitchen", "manager"]);
const STAFF_TRANSITIONS: Record<string, readonly string[]> = {
  scheduled: ["clocked_in", "missed"],
  clocked_in: ["completed"],
  completed: [],
  missed: [],
};
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
type Context = {
  session?: Session;
  prisma: { $transaction<T>(fn: (tx: unknown) => Promise<T>, options: Record<string, unknown>): Promise<T> };
};
type TransactionClient = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  storeSetting: { findUnique(args: Record<string, unknown>): Promise<{ id: string } | null> };
  user: { findUnique(args: Record<string, unknown>): Promise<{ id: string; roleId: string | null; role?: { canAccessDashboard: boolean } | null } | null> };
  role: { findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null> };
  coffeeDomainEvent: { findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null> };
  staffShift: {
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
};

const TX_OPTIONS = { maxWait: 5000, timeout: 10000, isolationLevel: "Serializable" };

function requireStaffManager(context: Context) {
  if (!permissions.canManageSettings({ session: context.session }) || !context.session?.itemId) {
    throw new Error("Not authorized to manage staff shifts");
  }
  return context.session.itemId;
}

function scopedKey(context: Context, purpose: string, value: string) {
  const normalized = normalizeIdempotencyKey(value);
  if (!normalized) throw new Error(`${purpose} idempotency key is required`);
  return buildScopedIdempotencyKey(`${purpose}:${context.session?.itemId}`, normalized);
}

function shiftReference(key: string) {
  return `STAFF-${createHash("sha256").update(key).digest("hex").slice(0, 12).toUpperCase()}`;
}

function instant(value: unknown, label: string) {
  if (typeof value !== "string" || !INSTANT.test(value)) throw new Error(`${label} must be a full date and time`);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`${label} is invalid`);
  return parsed;
}

export function evaluateStaffShiftTransition(current: string, next: string) {
  if (!(current in STAFF_TRANSITIONS) || !(next in STAFF_TRANSITIONS)) throw new Error("Unsupported staff shift status");
  if (current === next) return { replay: true } as const;
  if (!STAFF_TRANSITIONS[current].includes(next)) throw new Error(`Cannot transition staff shift from ${current} to ${next}`);
  return { replay: false } as const;
}

export async function scheduleCoffeeStaffShift(
  _root: unknown,
  args: { staffId: string; role: string; startsAt: string; endsAt: string; notes?: string | null; idempotencyKey: string },
  context: Context,
) {
  requireStaffManager(context);
  if (!STAFF_ROLES.has(args.role)) throw new Error("Unsupported staff shift role");
  if (typeof args.staffId !== "string" || !args.staffId || args.staffId.length > 255) throw new Error("Staff member is required");
  const startsAt = instant(args.startsAt, "Shift start");
  const endsAt = instant(args.endsAt, "Shift end");
  if (endsAt <= startsAt) throw new Error("Shift end must be after its start");
  const notes = typeof args.notes === "string" ? args.notes.trim() : "";
  if (notes.length > 500) throw new Error("Notes must be 500 characters or fewer");
  const key = scopedKey(context, "staff-shift-schedule", args.idempotencyKey);

  return context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx as TransactionClient;
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", key);
    const actorId = await requireCurrentCoffeeCapability(tx, context.session, ["canManageSettings"], "Not authorized to manage staff shifts");
    const storeId = await getPrimaryCoffeeStoreId(tx as never);
    const requestFingerprint = fingerprintInput({ purpose: "staff-shift-schedule", storeId, actorId, staffId: args.staffId, role: args.role, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), notes });
    const replay = await tx.staffShift.findUnique({ where: { idempotencyKey: key } });
    if (replay) {
      assertCoffeeStoreOwnership(replay.storeId, storeId, "Staff shift");
      const metadata = replay.metadata && typeof replay.metadata === "object" ? replay.metadata as Record<string, unknown> : {};
      if (metadata.requestFingerprint !== requestFingerprint) throw new Error("This shift request was already submitted with different details. Refresh the page and schedule the new shift again.");
      return replay;
    }
    // This deployment is a single cafe; staff are accounts with current dashboard access, not customers.
    const staff = await tx.user.findUnique({ where: { id: args.staffId }, select: { id: true, roleId: true, role: { select: { canAccessDashboard: true } } } });
    if (!staff?.role?.canAccessDashboard) throw new Error("Staff member is not authorized for the cafe dashboard");
    const shift = await tx.staffShift.create({
      data: {
        idempotencyKey: key,
        shiftNumber: shiftReference(key),
        storeId,
        staffId: args.staffId,
        role: args.role,
        status: "scheduled",
        startsAt,
        endsAt,
        notes,
        metadata: { scheduledBy: actorId, requestFingerprint },
      },
    });
    await enqueueCoffeeDomainEvent(tx as never, {
      storeId,
      eventKey: `staff-shift:${String(shift.id)}:scheduled:v1`,
      eventType: "staff_shift.scheduled",
      aggregateType: "staff_shift",
      aggregateId: String(shift.id),
      payload: { shiftId: String(shift.id), shiftNumber: String(shift.shiftNumber), staffId: args.staffId, role: args.role, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() },
    });
    return shift;
  }, TX_OPTIONS);
}

export async function updateCoffeeStaffShiftStatus(
  _root: unknown,
  args: { staffShiftId: string; status: string; expectedStatus?: string | null; idempotencyKey: string },
  context: Context,
) {
  requireStaffManager(context);
  const commandKey = scopedKey(context, "staff-shift-transition", args.idempotencyKey);
  if (typeof args.staffShiftId !== "string" || !args.staffShiftId) throw new Error("Staff shift is required");
  if (!(args.status in STAFF_TRANSITIONS)) throw new Error("Unsupported staff shift status");
  const expectedStatus = args.expectedStatus ?? null;
  if (expectedStatus !== null && !(expectedStatus in STAFF_TRANSITIONS)) throw new Error("Unsupported expected staff shift status");
  const eventKey = `staff-shift-command:${commandKey}`;

  return context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx as TransactionClient;
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", eventKey);
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-staff-shift:${args.staffShiftId}`);
    const actorId = await requireCurrentCoffeeCapability(tx, context.session, ["canManageSettings"], "Not authorized to manage staff shifts");
    const storeId = await getPrimaryCoffeeStoreId(tx as never);
    const shift = await tx.staffShift.findUnique({ where: { id: args.staffShiftId } });
    if (!shift) throw new Error("Staff shift not found");
    assertCoffeeStoreOwnership(shift.storeId, storeId, "Staff shift");
    const requestFingerprint = fingerprintInput({ purpose: "staff-shift-transition", storeId, actorId, staffShiftId: args.staffShiftId, status: args.status, expectedStatus });

    // The command receipt is the original transition event; a retry returns it without moving state.
    const receipt = await tx.coffeeDomainEvent.findUnique({ where: { eventKey } });
    if (receipt) {
      const payload = receipt.payload && typeof receipt.payload === "object" ? receipt.payload as Record<string, unknown> : {};
      if (receipt.storeId !== storeId || receipt.aggregateType !== "staff_shift" || receipt.aggregateId !== args.staffShiftId || payload.actorId !== actorId || payload.requestFingerprint !== requestFingerprint) {
        throw new Error("This shift action key was already used for a different shift change. Refresh and try again.");
      }
      return shift;
    }

    const current = String(shift.status || "");
    if (expectedStatus !== null && current !== expectedStatus) throw new Error(`This shift is now ${current.replaceAll("_", " ")}. Refresh before changing it.`);
    const transition = evaluateStaffShiftTransition(current, args.status);
    if (transition.replay) throw new Error(`This shift is already ${current.replaceAll("_", " ")}. Refresh to see its latest status.`);
    const now = new Date();
    const updated = await tx.staffShift.update({
      where: { id: args.staffShiftId },
      data: {
        status: args.status,
        ...(args.status === "clocked_in" ? { clockInAt: now } : {}),
        ...(args.status === "completed" ? { clockOutAt: now } : {}),
      },
    });
    await enqueueCoffeeDomainEvent(tx as never, {
      storeId,
      eventKey,
      eventType: "staff_shift.status_changed",
      aggregateType: "staff_shift",
      aggregateId: args.staffShiftId,
      occurredAt: now,
      payload: { shiftId: args.staffShiftId, previousStatus: current, status: args.status, occurredAt: now.toISOString(), actorId, requestFingerprint },
    });
    return updated;
  }, TX_OPTIONS);
}
