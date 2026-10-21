import { permissions, type Session } from "../access";

/** Every command that changes an existing ticket takes this lock BEFORE reading it.
 * Lock order: order -> payment -> register -> loyalty -> capacity -> inventory/prep.
 * ReadCommitted is intentional: the read after waiting must see the preceding commit.
 * Prisma bypasses Keystone access/hooks, so callers must also authorize and scope.
 */
export async function lockCoffeeOrder(tx: { $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number> }, orderId: string) {
  if (!orderId) throw new Error("Order id is required");
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-order:${orderId}`);
}

export function requireCafeTenderOperator(session?: Session) {
  if (!permissions.canManageOrders({ session }) || !permissions.canManagePayments({ session })) {
    throw new Error("Not authorized to record cafe payments");
  }
}

export type SettlementEvidence = { id?: string; status?: string | null; amount?: number | null; refundIdempotencyKey?: string | null };
export function hasCafeSettlement(payments: readonly SettlementEvidence[], payableAmount: number) {
  const captured = payments.filter((payment) => payment.status === "captured");
  const unresolved = payments.some((payment) => payment.status === "pending" || payment.status === "authorized");
  // A fully discounted ticket owes nothing: it is settled when no money is in flight.
  if (payableAmount === 0) return captured.length === 0 && !unresolved;
  return Number.isSafeInteger(payableAmount) && payableAmount > 0
    && captured.length === 1
    && !unresolved
    && !captured[0].refundIdempotencyKey
    && Number(captured[0].amount) === payableAmount;
}

export function assertCafeSettlement(payments: readonly SettlementEvidence[], payableAmount: number) {
  if (!hasCafeSettlement(payments, payableAmount)) throw new Error("Record pay-at-pickup settlement before handing off this order");
}

export function assertCafeOrderItemsReadyForHandoff(items: readonly { barStatus?: string | null }[]) {
  if (!items.length || items.some((item) => !["ready", "handed_off"].includes(String(item.barStatus)))) {
    throw new Error("Every order item must be ready before the whole ticket can be completed");
  }
}

export function validateCafeOrderLines<T extends { menuItemId: string; quantity: number; modifierIds?: string[] | null; specialInstructions?: string | null }>(items: T[]): T[] {
  if (!items.length || items.length > 50) throw new Error("Order must include between 1 and 50 line items");
  for (const item of items) {
    if (!item?.menuItemId || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 50) throw new Error("Order line quantity must be an integer between 1 and 50");
    const modifiers = item.modifierIds || [];
    if (modifiers.length > 50 || new Set(modifiers).size !== modifiers.length) throw new Error("Order modifiers must be unique, with at most 50 per line");
    if ((item.specialInstructions?.trim().length || 0) > 500) throw new Error("Order line instructions cannot exceed 500 characters");
  }
  if (items.reduce((sum, item) => sum + item.quantity, 0) > 100) throw new Error("Order cannot include more than 100 total items");
  return items;
}

type SelectableModifier = {
  modifierGroup?: string | null;
  modifierGroupLabel?: string | null;
  required?: boolean | null;
  minSelections?: number | null;
  maxSelections?: number | null;
};

/** Group required/min/max rule for a line's selected options, shared by checkout and admission. */
export function validateCafeModifierSelections<T extends SelectableModifier>(menuItem: { name: string; modifiers: readonly T[] }, selectedModifiers: readonly T[]) {
  const groups = menuItem.modifiers.reduce<Record<string, T[]>>((acc, modifier) => {
    const key = modifier.modifierGroup || "default";
    (acc[key] ||= []).push(modifier);
    return acc;
  }, {});
  const selectedByGroup = selectedModifiers.reduce<Record<string, T[]>>((acc, modifier) => {
    const key = modifier.modifierGroup || "default";
    (acc[key] ||= []).push(modifier);
    return acc;
  }, {});

  for (const [group, modifiers] of Object.entries(groups)) {
    const selectedCount = selectedByGroup[group]?.length || 0;
    const required = modifiers.some((modifier) => Boolean(modifier.required));
    const minSelections = Math.max(required ? 1 : 0, ...modifiers.map((modifier) => Number(modifier.minSelections || 0)));
    const maxSelections = Math.max(...modifiers.map((modifier) => Number(modifier.maxSelections || 1)));
    const label = modifiers[0].modifierGroupLabel || modifiers[0].modifierGroup || "modifier";
    if (selectedCount < minSelections) throw new Error(`${menuItem.name} requires at least ${minSelections} ${label} selection${minSelections === 1 ? "" : "s"}`);
    if (selectedCount > maxSelections) throw new Error(`${menuItem.name} allows at most ${maxSelections} ${label} selection${maxSelections === 1 ? "" : "s"}`);
  }
}

export type LockedPickupSettings = { pickupLeadTimeMinutes: number | null; pickupWindowMinutes: number | null; pickupCapacityPerWindow: number | null };

/** Called after the pickup-window lock: holds the store's pickup settings row until commit so a
 * concurrent settings change cannot alter lead time, window or capacity under this reservation.
 */
export async function readLockedPickupSettings(tx: { $queryRawUnsafe<R>(query: string, ...values: unknown[]): Promise<R> }) {
  const rows = await tx.$queryRawUnsafe<LockedPickupSettings[]>(
    `SELECT "pickupLeadTimeMinutes", "pickupWindowMinutes", "pickupCapacityPerWindow" FROM "StoreSetting" WHERE "singletonKey" = 'primary' FOR SHARE`,
  );
  if (!rows[0]) throw new Error("Primary coffee store is not configured");
  return rows[0];
}

export const PICKUP_SETTINGS_CHANGED_MESSAGE = "Pickup settings changed while this order was being placed. Review the pickup time and submit again.";
