import { randomBytes } from "node:crypto";
import { z } from "zod";
import { permissions, type Session } from "../access";
import { assertCoffeeStoreOwnership, enqueueCoffeeDomainEvent, getPrimaryCoffeeStoreId } from "../lib/coffeeDomainOutbox";
import { cafeCustomerError } from "../lib/cafeCustomerError";
import { requireCurrentCoffeeCapability } from "./coffeeKdsAuthority";
import { buildScopedIdempotencyKey, fingerprintInput, normalizeIdempotencyKey } from "./idempotency";

type Row = Record<string, unknown>;
type Model = {
  findUnique(args: Row): Promise<Row | null>;
  findMany(args: Row): Promise<Row[]>;
  create(args: Row): Promise<Row>;
  update(args: Row): Promise<Row>;
};
type Tx = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  cateringOrder: Model;
  loyaltyAccount: Model;
  loyaltyEvent: Model;
  purchaseOrder: Model;
  coffeeDomainEvent: Model;
  storeSetting: Model;
  user: Model;
  role: Model;
};
type Context = {
  session?: Session;
  prisma: Tx & { $transaction<T>(fn: (tx: unknown) => Promise<T>, options: Row): Promise<T> };
  sudo(): { query: Record<string, { findOne(args: { where: { id: string }; query: string }): Promise<unknown> }> };
};

const TX_OPTIONS = { maxWait: 5000, timeout: 10000, isolationLevel: "Serializable" };
const CATERING_LEAD_HOURS = 24;
const CATERING_HORIZON_DAYS = 365;

function conflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2034";
}

async function serializable<T>(context: Context, operation: (tx: Tx) => Promise<T>) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await context.prisma.$transaction((rawTx) => operation(rawTx as Tx), TX_OPTIONS);
    } catch (error) {
      if (!conflict(error) || attempt === 3) throw error;
    }
  }
  throw new Error("Transaction retry limit exceeded");
}

function requireKey(value: string | null | undefined, label: string) {
  const key = normalizeIdempotencyKey(value);
  if (!key) throw new Error(`${label} idempotency key is required`);
  return key;
}

async function replayReceipt(tx: Tx, eventKey: string, storeId: string, requestFingerprint: string, message: string) {
  const receipt = await tx.coffeeDomainEvent.findUnique({ where: { eventKey } });
  if (!receipt) return null;
  const payload = receipt.payload && typeof receipt.payload === "object" ? receipt.payload as Row : {};
  if (receipt.storeId !== storeId || payload.requestFingerprint !== requestFingerprint) throw new Error(message);
  return String(receipt.aggregateId);
}

// ---------------------------------------------------------------------------
// Catering inquiry (storefront)

const cateringInput = z.object({
  customerName: z.string().trim().min(1, "Enter your name").max(200),
  customerEmail: z.string().trim().toLowerCase().email("Enter a valid email").max(320),
  customerPhone: z.string().trim().max(50).optional().nullable(),
  eventAt: z.string().trim().min(1, "Choose the event date and time"),
  guestCount: z.number().int("Guests must be a whole number").min(1, "Enter at least 1 guest").max(1000, "For more than 1000 guests, contact the cafe"),
  deliveryAddress: z.string().trim().max(500).optional().nullable(),
  notes: z.string().trim().max(2000).optional().nullable(),
  idempotencyKey: z.string(),
});

export const CATERING_RECEIPT_FIELDS = "id cateringNumber status eventAt guestCount deliveryAddress subtotalCents createdAt";

/** CAT-YYMMDD-XXXXXX, dated on the store's calendar like order numbers. */
export function cateringNumber(timezone?: string | null, at = new Date()) {
  let date = at.toISOString().slice(2, 10).replace(/-/g, "");
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone || "America/New_York", year: "2-digit", month: "2-digit", day: "2-digit" }).formatToParts(at);
    const part = (type: string) => parts.find((entry) => entry.type === type)?.value || "";
    date = `${part("year")}${part("month")}${part("day")}`;
  } catch {
    // Invalid saved zone: keep the UTC date.
  }
  return `CAT-${date}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

/** Event time must be a real instant at least a day out and within a year. */
export function validCateringEventAt(value: string, now = new Date()) {
  const at = new Date(value);
  if (!Number.isFinite(at.getTime())) return { ok: false as const, message: "Choose the event date and time" };
  if (at.getTime() < now.getTime() + CATERING_LEAD_HOURS * 3_600_000) return { ok: false as const, message: "Catering needs at least 24 hours' notice" };
  if (at.getTime() > now.getTime() + CATERING_HORIZON_DAYS * 86_400_000) return { ok: false as const, message: "Choose a date within the next year" };
  return { ok: true as const, at };
}

function cateringReceipt(row: Row) {
  const status = String(row.status || "inquiry");
  return {
    id: String(row.id),
    cateringNumber: String(row.cateringNumber),
    status,
    eventAt: row.eventAt instanceof Date ? row.eventAt.toISOString() : row.eventAt ? String(row.eventAt) : null,
    guestCount: Number(row.guestCount || 0),
    deliveryAddress: row.deliveryAddress ? String(row.deliveryAddress) : null,
    // The amount is the customer's once it has been quoted.
    quotedCents: status === "inquiry" || status === "cancelled" ? null : Number(row.subtotalCents || 0),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt || ""),
  };
}

export async function requestCafeCatering(_root: unknown, args: Row, context: Context) {
  const parsed = cateringInput.safeParse(args);
  if (!parsed.success) throw cafeCustomerError(parsed.error.issues[0]?.message || "Check the catering details");
  const input = parsed.data;
  const clientKey = requireKey(input.idempotencyKey, "Catering request");
  const eventAt = validCateringEventAt(input.eventAt);
  if (!eventAt.ok) throw cafeCustomerError(eventAt.message);
  const scopedKey = buildScopedIdempotencyKey(`catering-request:${input.customerEmail}`, clientKey);
  const eventKey = `catering-request:${scopedKey}`;
  const request = {
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone || "",
    eventAt: eventAt.at.toISOString(),
    guestCount: input.guestCount,
    deliveryAddress: input.deliveryAddress || "",
    notes: input.notes || "",
  };
  const requestFingerprint = fingerprintInput(request);

  const id = await serializable(context, async (tx) => {
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", eventKey);
    const store = await tx.storeSetting.findUnique({ where: { singletonKey: "primary" }, select: { id: true, timezone: true } });
    if (!store) throw cafeCustomerError("Catering requests aren't available right now");
    const storeId = String(store.id);
    const replay = await replayReceipt(tx, eventKey, storeId, requestFingerprint, "This catering request was already sent with different details");
    if (replay) return replay;
    const open = await tx.cateringOrder.findMany({ where: { storeId, customerEmail: input.customerEmail, status: { in: ["inquiry", "quoted"] } }, select: { id: true }, take: 6 });
    if (open.length >= 5) throw cafeCustomerError("This email already has 5 open catering requests. The cafe will be in touch about those first.");
    const created = await tx.cateringOrder.create({
      data: {
        storeId,
        cateringNumber: cateringNumber(store.timezone ? String(store.timezone) : null),
        customerName: request.customerName,
        customerEmail: request.customerEmail,
        status: "inquiry",
        eventAt: eventAt.at,
        guestCount: request.guestCount,
        deliveryAddress: request.deliveryAddress,
        subtotalCents: 0,
        notes: request.notes,
        metadata: { source: "storefront", customerPhone: request.customerPhone, customerId: context.session?.listKey === "User" ? context.session.itemId : null },
      },
    });
    await enqueueCoffeeDomainEvent(tx as never, {
      storeId,
      eventKey,
      eventType: "catering.requested",
      aggregateType: "catering_order",
      aggregateId: String(created.id),
      payload: { requestFingerprint, cateringOrderId: String(created.id), cateringNumber: String(created.cateringNumber), eventAt: request.eventAt, guestCount: request.guestCount },
    });
    return String(created.id);
  });
  const row = await context.prisma.cateringOrder.findUnique({ where: { id } });
  if (!row) throw new Error("Catering request not found");
  return cateringReceipt(row);
}

/** The signed-in customer's catering requests, matched on their own account email. */
export async function getCoffeeCustomerCatering(_root: unknown, _args: Row, context: Context) {
  const customerId = context.session?.listKey === "User" ? context.session.itemId : null;
  if (!customerId) throw new Error("Sign in to view catering requests");
  const user = await context.prisma.user.findUnique({ where: { id: customerId }, select: { email: true } });
  const email = String(user?.email || "").trim().toLowerCase();
  if (!email) return [];
  const rows = await context.prisma.cateringOrder.findMany({ where: { customerEmail: email }, orderBy: [{ eventAt: "desc" }, { id: "desc" }], take: 20 });
  return rows.map(cateringReceipt);
}

// ---------------------------------------------------------------------------
// Loyalty adjustment (dashboard)

const LOYALTY_STATUSES = new Set(["active", "paused", "closed"]);
const LOYALTY_TIERS = new Set(["regular", "neighborhood", "house_account"]);

/** Applies a manual change the same way earning does: 100 points roll into one drink credit. */
export function planLoyaltyAdjustment(account: { pointsBalance?: unknown; drinkCredits?: unknown; lifetimePoints?: unknown }, pointsDelta: number, drinkCreditsDelta: number) {
  const points = Number(account.pointsBalance || 0) + pointsDelta;
  if (points < 0) return { ok: false as const, message: "That would take points below zero" };
  const rolled = Math.floor(points / 100);
  const credits = Number(account.drinkCredits || 0) + drinkCreditsDelta + rolled;
  if (credits < 0) return { ok: false as const, message: "That would take drink credits below zero" };
  return {
    ok: true as const,
    pointsBalance: points % 100,
    drinkCredits: credits,
    lifetimePoints: Number(account.lifetimePoints || 0) + Math.max(0, pointsDelta),
    creditsDelta: drinkCreditsDelta + rolled,
  };
}

export async function adjustCoffeeLoyaltyAccount(
  _root: unknown,
  args: { accountId: string; pointsDelta?: number | null; drinkCreditsDelta?: number | null; status?: string | null; tier?: string | null; note: string; idempotencyKey: string },
  context: Context,
) {
  if (!permissions.canManageLoyalty({ session: context.session })) throw new Error("Not authorized to manage rewards");
  const clientKey = requireKey(args.idempotencyKey, "Rewards adjustment");
  const pointsDelta = Number(args.pointsDelta || 0);
  const drinkCreditsDelta = Number(args.drinkCreditsDelta || 0);
  if (![pointsDelta, drinkCreditsDelta].every((value) => Number.isSafeInteger(value) && Math.abs(value) <= 100_000)) throw cafeCustomerError("Adjustments must be whole numbers");
  const status = args.status ? String(args.status) : null;
  const tier = args.tier ? String(args.tier) : null;
  if (status && !LOYALTY_STATUSES.has(status)) throw cafeCustomerError("Choose active, paused or closed");
  if (tier && !LOYALTY_TIERS.has(tier)) throw cafeCustomerError("Choose a listed tier");
  const note = String(args.note || "").trim().slice(0, 500);
  if (!note) throw cafeCustomerError("Enter a reason for the adjustment");
  if (!pointsDelta && !drinkCreditsDelta && !status && !tier) throw cafeCustomerError("Nothing to change");

  const id = await serializable(context, async (tx) => {
    const actorId = await requireCurrentCoffeeCapability(tx as never, context.session, ["canManageLoyalty"], "Not authorized to manage rewards");
    const eventKey = `loyalty-adjust:${buildScopedIdempotencyKey(`loyalty-adjust:${actorId}`, clientKey)}`;
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-loyalty:${args.accountId}`);
    const storeId = await getPrimaryCoffeeStoreId(tx as never);
    const requestFingerprint = fingerprintInput({ accountId: args.accountId, pointsDelta, drinkCreditsDelta, status, tier, note });
    const replay = await replayReceipt(tx, eventKey, storeId, requestFingerprint, "This adjustment was already recorded with different details. Refresh and try again.");
    if (replay) return replay;
    const account = await tx.loyaltyAccount.findUnique({ where: { id: args.accountId } });
    if (!account) throw new Error("Rewards account not found");
    assertCoffeeStoreOwnership(account.storeId, storeId, "Rewards account");
    const plan = planLoyaltyAdjustment(account, pointsDelta, drinkCreditsDelta);
    if (!plan.ok) throw cafeCustomerError(plan.message);
    await tx.loyaltyAccount.update({
      where: { id: account.id },
      data: {
        pointsBalance: plan.pointsBalance,
        drinkCredits: plan.drinkCredits,
        lifetimePoints: plan.lifetimePoints,
        ...(status ? { status } : {}),
        ...(tier ? { tier } : {}),
      },
    });
    const changes = [status && status !== account.status ? `status ${String(account.status)} → ${status}` : "", tier && tier !== account.tier ? `tier ${String(account.tier)} → ${tier}` : ""].filter(Boolean).join(", ");
    await tx.loyaltyEvent.create({
      data: {
        accountId: account.id,
        type: "manual_adjustment",
        pointsDelta,
        drinkCreditsDelta: plan.creditsDelta,
        note: changes ? `${note} (${changes})` : note,
        createdById: actorId,
      },
    });
    await enqueueCoffeeDomainEvent(tx as never, {
      storeId,
      eventKey,
      eventType: "loyalty.adjusted",
      aggregateType: "loyalty_account",
      aggregateId: String(account.id),
      payload: { requestFingerprint, accountId: String(account.id), pointsDelta, drinkCreditsDelta: plan.creditsDelta, status: status || String(account.status), tier: tier || String(account.tier) },
    });
    return String(account.id);
  });
  return context.sudo().query.LoyaltyAccount.findOne({ where: { id }, query: "id status tier pointsBalance lifetimePoints drinkCredits visits" });
}

// ---------------------------------------------------------------------------
// Purchase order cancel (dashboard)

export async function cancelCoffeePurchaseOrder(_root: unknown, args: { purchaseOrderId: string; reason?: string | null }, context: Context) {
  if (!permissions.canManageInventory({ session: context.session })) throw new Error("Not authorized to manage coffee inventory");
  const reason = String(args.reason || "").trim().slice(0, 500);
  return serializable(context, async (tx) => {
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-po:${args.purchaseOrderId}`);
    const actorId = await requireCurrentCoffeeCapability(tx as never, context.session, ["canManageInventory"], "Not authorized to manage coffee inventory");
    const storeId = await getPrimaryCoffeeStoreId(tx as never);
    const order = await tx.purchaseOrder.findUnique({ where: { id: args.purchaseOrderId } });
    if (!order) throw new Error("Purchase order not found");
    assertCoffeeStoreOwnership(order.storeId, storeId, "Purchase order");
    if (order.status === "cancelled") return order;
    if (order.status !== "submitted" && order.status !== "draft") throw cafeCustomerError(`A ${String(order.status)} purchase order can't be cancelled`);
    const notes = reason ? [String(order.notes || "").trim(), `Cancelled: ${reason}`].filter(Boolean).join("\n") : order.notes;
    const updated = await tx.purchaseOrder.update({ where: { id: order.id }, data: { status: "cancelled", notes } });
    await enqueueCoffeeDomainEvent(tx as never, {
      storeId,
      eventKey: `purchase-order:${String(order.id)}:cancelled:v1`,
      eventType: "purchase_order.cancelled",
      aggregateType: "purchase_order",
      aggregateId: String(order.id),
      payload: { purchaseOrderId: String(order.id), poNumber: String(order.poNumber), previousStatus: String(order.status), cancelledBy: actorId, reason },
    });
    return updated;
  });
}
