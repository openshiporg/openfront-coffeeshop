import { permissions, type Session } from "../access";
import { PICKUP_SETTINGS_CHANGED_MESSAGE, lockCoffeeOrder, readLockedPickupSettings, validateCafeModifierSelections } from "./coffeeOrderPolicy";
import { lockCoffeeMenuItem } from "./manageCoffeeMenu";
import { assertCoffeeStoreOwnership, enqueueCoffeeDomainEvent, getPrimaryCoffeeStoreId } from "../lib/coffeeDomainOutbox";
import { assertCoffeeOrderingAvailable, coffeeFirstPickupMinutes } from "./coffeeAvailability";
import { consumeCafeInventoryRequirements, getCafeInventoryRequirements } from "./coffeeInventoryConsumption";
import { buildScopedIdempotencyKey, fingerprintInput, normalizeIdempotencyKey } from "./idempotency";
import { requireCurrentCoffeeCapability } from "./coffeeKdsAuthority";
import { cafeCustomerError } from "../lib/cafeCustomerError";

type Args = { orderId: string; idempotencyKey?: string | null };
type Context = {
  session?: Session;
  prisma: { $transaction<T>(fn: (tx: unknown) => Promise<T>, options: Record<string, unknown>): Promise<T> };
  sudo(): { query: { CafeOrder: { findOne(args: { where: { id: string }; query: string }): Promise<unknown> } } };
};

type Tx = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  $queryRawUnsafe<R>(query: string, ...values: unknown[]): Promise<R>;
  storeSetting: { findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null> };
  cafeOrder: { findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>; count(args: Record<string, unknown>): Promise<number>; update(args: Record<string, unknown>): Promise<unknown> };
  orderItem: { findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>> };
  recipe: { findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>> };
  menuItemModifier: { findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>> };
  inventoryItem: { findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>>; findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>; update(args: Record<string, unknown>): Promise<unknown> };
  inventoryLot: { findMany(args: Record<string, unknown>): Promise<Array<{ id: string; quantityRemaining: unknown }>>; update(args: Record<string, unknown>): Promise<unknown> };
  stockMovement: { create(args: Record<string, unknown>): Promise<unknown> };
  prepBatch: { findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>>; findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>; update(args: Record<string, unknown>): Promise<unknown> };
  prepBatchConsumption: { create(args: Record<string, unknown>): Promise<unknown> };
  coffeeDomainEvent: { findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null> };
};

const ORDER_QUERY = "id orderNumber status fulfillmentType pickupName promisedAt total orderItems { id quantity itemNameSnapshot modifierSnapshot menuItem { id } }";

type AcceptanceMenuItem = {
  id?: unknown;
  name?: unknown;
  available?: unknown;
  inventoryItemId?: unknown;
  serviceWindows?: unknown;
  modifiers?: unknown;
};
type AcceptanceLine = { menuItem?: AcceptanceMenuItem | null; modifierSnapshot?: unknown; quantity?: unknown };

const OPTIONS_CHANGED_MESSAGE = "The options on this order changed since it was placed; ask the customer to review it.";

type CurrentModifier = {
  id?: unknown;
  name?: unknown;
  inStock?: unknown;
  modifierGroup?: string | null;
  modifierGroupLabel?: string | null;
  priceAdjustment?: unknown;
  required?: boolean | null;
  minSelections?: number | null;
  maxSelections?: number | null;
};

function modifierSnapshotIds(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => entry && typeof entry === "object" && "id" in entry ? [String((entry as { id: unknown }).id)] : []);
}

export function assertCafePickupAcceptanceAvailability(
  settings: Record<string, unknown>,
  lines: AcceptanceLine[],
  at: Date,
  promisedAt: Date,
) {
  for (const line of lines) {
    const item = line.menuItem;
    const itemName = String(item?.name || "Menu item");
    if (!item?.id || item.available !== true) throw cafeCustomerError(`${itemName} is currently unavailable`);
    const serviceWindows = Array.isArray(item.serviceWindows) ? item.serviceWindows.map(String) : ["all_day"];
    assertCoffeeOrderingAvailable(settings, at, serviceWindows);
    assertCoffeeOrderingAvailable(settings, promisedAt, serviceWindows);

    const currentModifiers = Array.isArray(item.modifiers) ? item.modifiers as CurrentModifier[] : [];
    const snapshots = Array.isArray(line.modifierSnapshot) ? line.modifierSnapshot as Array<Record<string, unknown>> : [];
    const selected: CurrentModifier[] = [];
    for (const snapshot of snapshots) {
      const modifier = currentModifiers.find((candidate) => String(candidate.id) === String(snapshot?.id ?? ""));
      if (!modifier || modifier.inStock !== true) {
        throw cafeCustomerError(`${String(modifier?.name || "A selected option")} is currently unavailable`);
      }
      // The order was priced and described from this snapshot; admit it only if the option still matches.
      if (
        String(modifier.name ?? "") !== String(snapshot.name ?? "")
        || (modifier.modifierGroup || "default") !== String(snapshot.group ?? "")
        || Number(modifier.priceAdjustment || 0) !== Number(snapshot.priceAdjustment || 0)
      ) throw new Error(OPTIONS_CHANGED_MESSAGE);
      selected.push(modifier);
    }
    try {
      validateCafeModifierSelections({ name: itemName, modifiers: currentModifiers }, selected);
    } catch {
      throw new Error(OPTIONS_CHANGED_MESSAGE);
    }
  }
}

/** Line selection every admission path (acceptance, settlement of an open request) reads. */
export const ADMISSION_ORDER_ITEMS_SELECT = { select: { quantity: true, modifierSnapshot: true, menuItem: { select: { id: true, name: true, available: true, inventoryItemId: true, serviceWindows: true, modifiers: { select: { id: true, name: true, inStock: true, modifierGroup: true, modifierGroupLabel: true, priceAdjustment: true, required: true, minSelections: true, maxSelections: true, inventoryAction: true } } } } } } as const;

/** Locks every menu item on the order (sorted, same lock identity checkout and menu edits use),
 * then reads the order lines and their current options under those locks.
 */
export async function lockAndReadAdmissionLines(tx: Pick<Tx, "$executeRawUnsafe" | "orderItem">, orderId: string) {
  const refs = await tx.orderItem.findMany({ where: { orderId }, select: { menuItemId: true } });
  const menuItemIds = [...new Set(refs.map((ref) => ref.menuItemId).filter((id): id is string => typeof id === "string" && id.length > 0))].sort();
  for (const menuItemId of menuItemIds) await lockCoffeeMenuItem(tx, menuItemId);
  return tx.orderItem.findMany({ where: { orderId }, orderBy: { createdAt: "asc" }, ...ADMISSION_ORDER_ITEMS_SELECT });
}

type AdmissionTx = Pick<Tx, "$executeRawUnsafe" | "$queryRawUnsafe" | "storeSetting" | "cafeOrder">;

/** One current admission check for an open request, shared by acceptance and pay-at-pickup settlement:
 * store hours, item/option availability and service windows, and pickup-window capacity under its lock.
 * Returns the pickup time the order is admitted for (a past request time is moved to the next lead time).
 */
export async function admitOpenCafeOrder(tx: AdmissionTx, order: Record<string, unknown>, storeId: string) {
  const settings = await tx.storeSetting.findUnique({ where: { id: storeId }, select: { pickupLeadTimeMinutes: true, pickupWindowMinutes: true, pickupCapacityPerWindow: true, timezone: true, weeklyHours: true } });
  if (!settings) throw new Error("Pickup capacity settings are invalid");
  const now = new Date();
  const orderLines = (Array.isArray(order.orderItems) ? order.orderItems : []) as AcceptanceLine[];
  if (order.fulfillmentType !== "pickup") {
    assertCoffeeOrderingAvailable(settings, now);
    assertCafePickupAcceptanceAvailability(settings, orderLines, now, now);
    return null;
  }
  const requestedPromisedAt = new Date(String(order.promisedAt || ""));
  // An order-ahead request is admitted against its pickup time, so staff can accept it while the cafe is closed.
  // A request whose time has passed moves to the first pickup the cafe can still promise.
  let promisedAt = requestedPromisedAt;
  if (!Number.isFinite(requestedPromisedAt.getTime()) || requestedPromisedAt.getTime() <= now.getTime()) {
    const serviceWindowSets = orderLines.map((line) => Array.isArray(line.menuItem?.serviceWindows) ? line.menuItem.serviceWindows.map(String) : ["all_day"]);
    const offset = coffeeFirstPickupMinutes(settings, Math.max(5, Number(settings.pickupLeadTimeMinutes || 12)), serviceWindowSets, now);
    if (offset == null) throw cafeCustomerError("The cafe is closed for pickup at that time");
    promisedAt = new Date(now.getTime() + offset * 60_000);
  }
  assertCoffeeOrderingAvailable(settings, promisedAt);
  const windowMinutes = Math.max(5, Number(settings.pickupWindowMinutes || 15));
  const windowMs = windowMinutes * 60_000;
  const windowStart = new Date(Math.floor(promisedAt.getTime() / windowMs) * windowMs);
  const windowEnd = new Date(windowStart.getTime() + windowMs);
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "coffee-pickup-capacity", windowStart.toISOString());
  // Window, capacity (and the lead time, when it set the pickup time) come from the settings row held under this lock.
  const locked = await readLockedPickupSettings(tx);
  if (Math.max(5, Number(locked.pickupWindowMinutes || 15)) !== windowMinutes) throw new Error(PICKUP_SETTINGS_CHANGED_MESSAGE);
  if (promisedAt !== requestedPromisedAt && Math.max(5, Number(locked.pickupLeadTimeMinutes || 12)) !== Math.max(5, Number(settings.pickupLeadTimeMinutes || 12))) throw new Error(PICKUP_SETTINGS_CHANGED_MESSAGE);
  const reservations = await tx.cafeOrder.count({ where: { storeId, id: { not: order.id }, fulfillmentType: "pickup", promisedAt: { gte: windowStart, lt: windowEnd }, status: { in: ["accepted", "paid", "in_bar_queue", "preparing", "ready"] } } });
  if (reservations >= Math.max(1, Number(locked.pickupCapacityPerWindow || 20))) throw cafeCustomerError("The requested pickup window is at capacity");
  assertCafePickupAcceptanceAvailability(settings, orderLines, promisedAt, promisedAt);
  return promisedAt;
}

export default async function acceptCafePickupOrder(_root: unknown, args: Args, context: Context) {
  if (!permissions.canManageOrders({ session: context.session })) throw new Error("Not authorized to accept cafe orders");
  const clientKey = normalizeIdempotencyKey(args.idempotencyKey);
  if (!clientKey) throw new Error("Order acceptance idempotency key is required");
  if (!args.orderId) throw new Error("Order id is required");
  const operatorId = context.session?.itemId || "operator";
  const scopedKey = buildScopedIdempotencyKey(`accept-order:${operatorId}`, clientKey);
  // One acceptance receipt per caller key, independent of the target order, so the same key cannot accept a second order.
  const eventKey = `order-acceptance:${scopedKey}`;
  const requestFingerprint = fingerprintInput({ orderId: args.orderId });

  const orderId = await context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx as Tx;
    await lockCoffeeOrder(tx, args.orderId);
    const actorId = await requireCurrentCoffeeCapability(rawTx as never, context.session, ["canManageOrders"], "Not authorized to accept cafe orders");
    const order = await tx.cafeOrder.findUnique({
      where: { id: args.orderId },
      select: {
        id: true,
        storeId: true,
        orderNumber: true,
        status: true,
        fulfillmentType: true,
        promisedAt: true,
        paidAt: true,
      },
    });
    if (!order) throw new Error("Cafe order not found");
    const storeId = await getPrimaryCoffeeStoreId(tx as never);
    assertCoffeeStoreOwnership(String(order.storeId), storeId, "Cafe order");
    const receipt = await tx.coffeeDomainEvent.findUnique({ where: { eventKey } });
    if (receipt) {
      const payload = receipt.payload && typeof receipt.payload === "object" ? receipt.payload as Record<string, unknown> : {};
      if (receipt.storeId !== storeId || receipt.aggregateId !== String(order.id) || payload.acceptedBy !== actorId || payload.requestFingerprint !== requestFingerprint) {
        throw new Error("This acceptance request key was already used for a different order");
      }
      return String(order.id);
    }
    if (["accepted", "paid", "in_bar_queue", "preparing", "ready", "completed"].includes(String(order.status))) throw cafeCustomerError("This pickup request was already accepted. Refresh to see its current status.");
    if (order.status !== "open") throw new Error(`Only an open unpaid pickup request can be accepted; current status is ${String(order.status)}`);
    if (order.fulfillmentType !== "pickup") throw new Error("Only pickup requests use the acceptance workflow");

    const orderLines = await lockAndReadAdmissionLines(tx, String(order.id)) as AcceptanceLine[];
    const promisedAt = await admitOpenCafeOrder(tx, { ...order, orderItems: orderLines }, storeId);
    const lines = orderLines.map((line) => {
      const menuItem = line.menuItem;
      return { menuItemId: String(menuItem?.id || ""), fallbackInventoryItemId: menuItem?.inventoryItemId ? String(menuItem.inventoryItemId) : null, quantity: Number(line.quantity || 0), modifierIds: modifierSnapshotIds(line.modifierSnapshot) };
    });
    const requirements = await getCafeInventoryRequirements(tx, storeId, lines);
    await consumeCafeInventoryRequirements(tx, { storeId, orderId: String(order.id), orderNumber: String(order.orderNumber), requirements, createdById: actorId, reason: `Accepted pickup ${String(order.orderNumber)}` });
    // A request already paid online is admitted straight to paid; otherwise it waits for pay-at-pickup.
    const paidOnline = order.paidAt != null;
    await tx.cafeOrder.update({ where: { id: order.id }, data: { status: paidOnline ? "paid" : "accepted", promisedAt } });
    const inventoryRequirementEvidence: Array<Record<string, string | number>> = [];
    for (const requirement of requirements) {
      if (requirement.kind === "prep") inventoryRequirementEvidence.push({ kind: requirement.kind, prepBatchId: requirement.prepBatchId, quantity: requirement.quantity });
      else inventoryRequirementEvidence.push({ kind: requirement.kind, inventoryItemId: requirement.inventoryItemId, quantity: requirement.quantity });
    }
    await enqueueCoffeeDomainEvent(tx as never, {
      storeId,
      eventKey,
      eventType: "order.accepted",
      aggregateType: "cafe_order",
      aggregateId: String(order.id),
      payload: { orderId: String(order.id), orderNumber: String(order.orderNumber), acceptedBy: actorId, requestFingerprint, inventoryRequirements: inventoryRequirementEvidence },
    });
    return String(order.id);
  }, { maxWait: 5000, timeout: 10000, isolationLevel: "ReadCommitted" });

  return context.sudo().query.CafeOrder.findOne({ where: { id: orderId }, query: ORDER_QUERY });
}
