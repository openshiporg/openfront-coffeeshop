import { permissions, type Session } from "../access";
import { assertCoffeeStoreOwnership } from "../lib/coffeeDomainOutbox";
import { KDS_ITEM_TRANSITIONS, type KdsItemStatus } from "./kdsPolicy";
import { CAFE_ORDER_TRANSITIONS } from "./transitionPolicy";
import { COFFEE_PICKUP_SCHEDULE_MAX_MINUTES, assertCoffeeOrderingAvailable, coffeeFirstPickupMinutes } from "./coffeeAvailability";
import { cafeQuoteFingerprint, calculateCafeTotals } from "./coffeePricing";
import { validateCafeOrderLines, hasCafeSettlement } from "./coffeeOrderPolicy";
import { getCafeInventoryRequirements } from "./coffeeInventoryConsumption";
import { assertCafeRequirementsInStock, cafeEarliestPickupMinutes, isPublishedMenuItem } from "./cafeStorefrontPolicy";
import { cafeCustomerError } from "../lib/cafeCustomerError";
import { MENU_STOCK_ITEM_SELECT, MENU_STOCK_MODIFIER_SELECT, cafeMenuStock, type MenuStockItem } from "./cafeMenuStock";

type ListRow = Record<string, unknown> & { id: string };
type ListModel = { findMany(args: Record<string, unknown>): Promise<ListRow[]> };
type CountableListModel = ListModel & { count(args: Record<string, unknown>): Promise<number> };
type GroupedOrderStatus = { status: string | null; _count: { _all: number } };
type GroupedOrderModel = ListModel & { groupBy(args: Record<string, unknown>): Promise<GroupedOrderStatus[]> };
type Context = {
  session?: Session;
  prisma: {
    storeSetting: { findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null> };
    cafeOrder: GroupedOrderModel;
    orderItem: CountableListModel & { findFirst(args: Record<string, unknown>): Promise<ListRow | null> };
    menuCategory: ListModel;
    menuItem: ListModel;
    registerShift: ListModel;
    inventoryItem: ListModel;
    loyaltyAccount: ListModel;
    user: ListModel;
    recipe: ListModel;
    ingredient: ListModel;
    inventoryLot: ListModel;
    supplier: ListModel;
    purchaseOrder: ListModel;
    prepBatch: ListModel;
    staffShift: ListModel;
    posOrder: ListModel;
    subscription: ListModel;
    cateringOrder: ListModel;
    wasteLog: ListModel;
    payment: ListModel;
  };
};

type QuoteItem = { menuItemId: string; quantity: number; modifierIds?: string[] | null };
type MenuModifier = {
  id: string;
  menuItemId?: string | null;
  name: string;
  priceAdjustment?: number | null;
  inStock?: boolean | null;
  modifierGroup?: string | null;
  modifierGroupLabel?: string | null;
  required?: boolean | null;
  minSelections?: number | null;
  maxSelections?: number | null;
};
type MenuRecord = {
  id: string;
  storeId: string;
  name: string;
  price: number;
  available: boolean;
  prepTimeMinutes?: number | null;
  serviceWindows: string[];
  modifiers: MenuModifier[];
  category?: { active: boolean | null } | null;
  inventoryItem?: { id: string } | null;
};

function requirePermission(allowed: boolean, message: string) {
  if (!allowed) throw new Error(message);
}
type StatusAction = { status: string; label: string; tone: string };
const statusLabels: Record<string, string> = {
  accepted: "Accepted", paid: "Mark paid", in_bar_queue: "Send to queue", preparing: "Start", ready: "Mark ready", completed: "Complete", cancelled: "Cancel",
  queued: "Queue", handed_off: "Hand off", active: "Activate / resume", paused: "Pause", quoted: "Mark quoted", confirmed: "Confirm", clocked_in: "Clock in",
};
function statusActions(transitions: Readonly<Record<string, readonly string[]>>, current: string, excluded: readonly string[] = []): StatusAction[] {
  return (transitions[current] || []).filter((status) => !excluded.includes(status)).map((status) => ({ status, label: statusLabels[status] || status.replaceAll("_", " "), tone: status === "cancelled" ? "danger" : "default" }));
}
function number(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function validateModifierSelections(menuItem: MenuRecord, selected: MenuModifier[]) {
  const groups = new Map<string, MenuModifier[]>();
  for (const modifier of menuItem.modifiers) {
    const group = modifier.modifierGroup || "default";
    groups.set(group, [...(groups.get(group) || []), modifier]);
  }
  for (const [group, modifiers] of groups) {
    const selectedCount = selected.filter((modifier) => (modifier.modifierGroup || "default") === group).length;
    const minimum = Math.max(modifiers.some((modifier) => modifier.required) ? 1 : 0, ...modifiers.map((modifier) => number(modifier.minSelections)));
    const maximum = Math.max(...modifiers.map((modifier) => Math.max(1, number(modifier.maxSelections))));
    const label = modifiers[0]?.modifierGroupLabel || group;
    if (selectedCount < minimum) throw new Error(`${menuItem.name} requires at least ${minimum} ${label} selection${minimum === 1 ? "" : "s"}`);
    if (selectedCount > maximum) throw new Error(`${menuItem.name} allows at most ${maximum} ${label} selection${maximum === 1 ? "" : "s"}`);
  }
}

async function primaryStore(context: Context) {
  const store = await context.prisma.storeSetting.findUnique({ where: { singletonKey: "primary" }, select: { id: true, pickupLeadTimeMinutes: true, pickupWindowMinutes: true, pickupCapacityPerWindow: true, taxRateBasisPoints: true, timezone: true, weeklyHours: true } });
  if (!store?.id) throw new Error("Primary coffee store is not configured");
  return {
    id: String(store.id),
    pickupLeadTimeMinutes: number(store.pickupLeadTimeMinutes) || 12,
    pickupWindowMinutes: number(store.pickupWindowMinutes) || 15,
    pickupCapacityPerWindow: number(store.pickupCapacityPerWindow) || 20,
    taxRateBasisPoints: store.taxRateBasisPoints == null ? 875 : number(store.taxRateBasisPoints),
    timezone: typeof store.timezone === "string" ? store.timezone : "America/New_York",
    storeTimezone: typeof store.timezone === "string" ? store.timezone : null,
    weeklyHours: store.weeklyHours,
  };
}

const ORDER_QUEUE_ACTIVE_PAGE_SIZE = 100;
type ActiveOrderCursor = { createdAt: Date; id: string; storeId: string };

const ORDER_QUEUE_STATUS_FILTERS = ["all", "open", "accepted", "paid", "in_bar_queue", "preparing", "ready", "completed", "cancelled", "refunded"] as const;
const ORDER_QUEUE_FULFILLMENT_FILTERS = ["all", "pickup", "counter", "dine_in"] as const;
function allowlisted<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (value == null || value === "") return allowed[0];
  if (typeof value !== "string" || !(allowed as readonly string[]).includes(value)) throw new Error(`Unsupported ${label} filter`);
  return value as T;
}
/** Cursors are bound to the normalized view (search + status + fulfillment). Older cursors carry no filter and only match the unfiltered view. */
function cursorFilterMatches(cursor: Record<string, unknown>, filter: string) {
  return cursor.filter === undefined ? filter === "all|all" : cursor.filter === filter;
}

function decodeActiveOrderCursor(value: unknown, search: string, filter: string): ActiveOrderCursor | null {
  if (value == null) return null;
  if (typeof value !== "string" || !value || value.length > 2048) throw new Error("Invalid active order cursor");
  try {
    const bytes = Buffer.from(value, "base64url");
    if (!bytes.length || bytes.toString("base64url") !== value) throw new Error();
    const parsed: unknown = JSON.parse(bytes.toString("utf8"));
    if (!parsed || typeof parsed !== "object") throw new Error();
    const cursor = parsed as Record<string, unknown>;
    if ((cursor.kind !== undefined && cursor.kind !== "active") || typeof cursor.id !== "string" || !cursor.id || cursor.id.length > 255) throw new Error();
    if (typeof cursor.storeId !== "string" || !cursor.storeId || cursor.storeId.length > 255) throw new Error();
    if (typeof cursor.search !== "string" || cursor.search !== search || !cursorFilterMatches(cursor, filter)) throw new Error();
    if (typeof cursor.createdAt !== "string") throw new Error();
    const createdAt = new Date(cursor.createdAt);
    if (!Number.isFinite(createdAt.getTime()) || createdAt.toISOString() !== cursor.createdAt) throw new Error();
    return { createdAt, id: cursor.id, storeId: cursor.storeId };
  } catch {
    throw new Error("Invalid active order cursor");
  }
}

function encodeActiveOrderCursor(order: Record<string, unknown>, search: string, filter: string, storeId: string) {
  const id = typeof order.id === "string" ? order.id : "";
  const createdAt = order.createdAt instanceof Date ? order.createdAt : new Date(String(order.createdAt));
  if (!id || id.length > 255 || !Number.isFinite(createdAt.getTime())) throw new Error("Cannot create active order cursor");
  return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id, search, filter, storeId }), "utf8").toString("base64url");
}

function decodeHistoryOrderCursor(value: unknown, search: string, filter: string): ActiveOrderCursor | null {
  if (value == null) return null;
  if (typeof value !== "string" || !value || value.length > 2048) throw new Error("Invalid history order cursor");
  try {
    const bytes = Buffer.from(value, "base64url");
    if (!bytes.length || bytes.toString("base64url") !== value) throw new Error();
    const parsed: unknown = JSON.parse(bytes.toString("utf8"));
    if (!parsed || typeof parsed !== "object") throw new Error();
    const cursor = parsed as Record<string, unknown>;
    if (cursor.kind !== "history" || typeof cursor.id !== "string" || !cursor.id || cursor.id.length > 255) throw new Error();
    if (typeof cursor.storeId !== "string" || !cursor.storeId || cursor.storeId.length > 255) throw new Error();
    if (typeof cursor.search !== "string" || cursor.search !== search || !cursorFilterMatches(cursor, filter) || typeof cursor.createdAt !== "string") throw new Error();
    const createdAt = new Date(cursor.createdAt);
    if (!Number.isFinite(createdAt.getTime()) || createdAt.toISOString() !== cursor.createdAt) throw new Error();
    return { createdAt, id: cursor.id, storeId: cursor.storeId };
  } catch {
    throw new Error("Invalid history order cursor");
  }
}

function encodeHistoryOrderCursor(order: Record<string, unknown>, search: string, filter: string, storeId: string) {
  const id = typeof order.id === "string" ? order.id : "";
  const createdAt = order.createdAt instanceof Date ? order.createdAt : new Date(String(order.createdAt));
  if (!id || id.length > 255 || !Number.isFinite(createdAt.getTime())) throw new Error("Cannot create history order cursor");
  return Buffer.from(JSON.stringify({ kind: "history", createdAt: createdAt.toISOString(), id, search, filter, storeId }), "utf8").toString("base64url");
}

export async function getCoffeeOrderQueue(_root: unknown, args: { search?: string | null; status?: string | null; fulfillment?: string | null; includeCompleted?: boolean | null; activeCursor?: string | null; historyCursor?: string | null }, context: Context) {
  requirePermission(permissions.canReadOrders({ session: context.session }), "Not authorized to read the order queue");
  const search = args.search?.trim().slice(0, 200) || "";
  const statusFilter = allowlisted(args.status, ORDER_QUEUE_STATUS_FILTERS, "order status");
  const fulfillmentFilter = allowlisted(args.fulfillment, ORDER_QUEUE_FULFILLMENT_FILTERS, "fulfillment");
  const filterKey = `${statusFilter}|${fulfillmentFilter}`;
  const activeCursor = decodeActiveOrderCursor(args.activeCursor, search, filterKey);
  const historyCursor = decodeHistoryOrderCursor(args.historyCursor, search, filterKey);
  const includeHistory = args.includeCompleted !== false;
  const store = await primaryStore(context);
  if (activeCursor && activeCursor.storeId !== store.id) throw new Error("Invalid active order cursor");
  if (historyCursor && historyCursor.storeId !== store.id) throw new Error("Invalid history order cursor");
  const allActiveStatuses = ["open", "accepted", "paid", "in_bar_queue", "preparing", "ready"];
  const allHistoryStatuses = ["completed", "refunded", "cancelled"];
  // Filters apply before paging and counting, so every matching ticket stays reachable.
  const activeStatuses = statusFilter === "all" ? allActiveStatuses : allActiveStatuses.filter((status) => status === statusFilter);
  const historyStatuses = !includeHistory ? [] : statusFilter === "all" ? allHistoryStatuses : allHistoryStatuses.filter((status) => status === statusFilter);
  const matchingOrders = {
    storeId: store.id,
    ...(fulfillmentFilter !== "all" ? { fulfillmentType: fulfillmentFilter } : {}),
    ...(search ? { OR: ["orderNumber", "customerName", "customerEmail", "pickupName"].map((field) => ({ [field]: { contains: search, mode: "insensitive" } })) } : {}),
  };
  const activeCountWhere = { ...matchingOrders, status: { in: activeStatuses } };
  const historyWhere = { ...matchingOrders, status: { in: historyStatuses } };
  const historyPageWhere = {
    ...historyWhere,
    ...(historyCursor ? { AND: [{ OR: [
      { createdAt: { lt: historyCursor.createdAt } },
      { createdAt: historyCursor.createdAt, id: { lt: historyCursor.id } },
    ] }] } : {}),
  };
  // Status-tab counts use the same search and fulfillment predicate, across every status.
  const countedOrdersWhere = { ...matchingOrders, status: { in: [...allActiveStatuses, ...(includeHistory ? allHistoryStatuses : [])] } };
  const activePageWhere = {
    ...activeCountWhere,
    ...(activeCursor ? { AND: [{ OR: [
      { createdAt: { gt: activeCursor.createdAt } },
      { createdAt: activeCursor.createdAt, id: { gt: activeCursor.id } },
    ] }] } : {}),
  };
  const orderSelect = {
    id: true, orderNumber: true, status: true, fulfillmentType: true, orderSource: true, customerName: true, customerEmail: true, pickupName: true, promisedAt: true, total: true, discount: true, isRush: true, createdAt: true, loyaltyAccountId: true,
    orderItems: { select: { id: true, quantity: true, itemNameSnapshot: true, customizationsSummary: true, barStatus: true, station: true } },
    payments: { where: { status: { in: ["captured", "pending", "authorized", "refunded"] } }, select: { id: true, status: true, method: true, provider: true, amount: true, refundedAmount: true, refundIdempotencyKey: true } },
  };
  const [activeTickets, historyTickets, groupedCounts] = await Promise.all([
    activeStatuses.length
      ? context.prisma.cafeOrder.findMany({ where: activePageWhere, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: ORDER_QUEUE_ACTIVE_PAGE_SIZE + 1, select: orderSelect })
      : Promise.resolve([]),
    historyStatuses.length
      ? context.prisma.cafeOrder.findMany({ where: historyPageWhere, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: ORDER_QUEUE_ACTIVE_PAGE_SIZE + 1, select: orderSelect })
      : Promise.resolve([]),
    context.prisma.cafeOrder.groupBy({ by: ["status"], where: countedOrdersWhere, _count: { _all: true } }),
  ]);
  const countByStatus = new Map<string, number>(groupedCounts.map(({ status, _count: count }) => [String(status), count._all] as const));
  const count = (status: string) => countByStatus.get(status) || 0;
  const activeCount = allActiveStatuses.reduce((total, status) => total + count(status), 0);
  const activeItems = activeTickets.slice(0, ORDER_QUEUE_ACTIVE_PAGE_SIZE);
  const activeHasMore = activeTickets.length > ORDER_QUEUE_ACTIVE_PAGE_SIZE;
  const activeNextCursor = activeHasMore && activeItems.length ? encodeActiveOrderCursor(activeItems[activeItems.length - 1]!, search, filterKey, store.id) : null;
  const historyItems = historyTickets.slice(0, ORDER_QUEUE_ACTIVE_PAGE_SIZE);
  const historyHasMore = historyTickets.length > ORDER_QUEUE_ACTIVE_PAGE_SIZE;
  const historyNextCursor = historyHasMore && historyItems.length ? encodeHistoryOrderCursor(historyItems[historyItems.length - 1]!, search, filterKey, store.id) : null;
  const historyCount = historyStatuses.reduce((total, status) => total + count(status), 0);
  const tickets = [...activeItems, ...historyItems];
  const canManageOrders = permissions.canManageOrders({ session: context.session });
  const canManagePayments = permissions.canManagePayments({ session: context.session });
  const canManageLoyalty = permissions.canManageLoyalty({ session: context.session });
  const canSeePaymentState = canManageOrders || canManagePayments;
  return {
    summary: {
      allCount: [...allActiveStatuses, ...(includeHistory ? allHistoryStatuses : [])].reduce((total, status) => total + count(status), 0),
      activeCount,
      openCount: count("open"),
      acceptedCount: count("accepted"),
      paidCount: count("paid"),
      queuedCount: count("in_bar_queue"),
      preparingCount: count("preparing"),
      readyCount: count("ready"),
      completedCount: count("completed"),
      cancelledCount: count("cancelled"),
      refundedCount: count("refunded"),
    },
    capabilities: { canManageOrders, canManagePayments, canManageLoyalty },
    filters: { status: statusFilter, fulfillment: fulfillmentFilter },
    storeTimezone: store.storeTimezone,
    activeCount: activeStatuses.reduce((total, status) => total + count(status), 0),
    activeHasMore,
    activeNextCursor,
    historyCount,
    historyHasMore,
    historyNextCursor,
    tickets: tickets.map(({ payments, loyaltyAccountId, ...ticket }) => {
      const paymentEvidence = Array.isArray(payments) ? payments as Array<{ id?: string; status?: string | null; method?: string | null; amount?: number | null; refundedAmount?: number | null; refundIdempotencyKey?: string | null }> : [];
      const activeEvidence = paymentEvidence.filter((payment) => ["captured", "pending", "authorized"].includes(String(payment.status)));
      const unresolved = activeEvidence.some((payment) => payment.status === "pending" || payment.status === "authorized");
      const settled = hasCafeSettlement(paymentEvidence, number(ticket.total) - number(ticket.discount));
      const status = String(ticket.status);
      const paymentState = unresolved ? "pending" : activeEvidence.some((payment) => payment.status === "captured") ? "paid" : paymentEvidence.some((payment) => payment.status === "refunded") ? "refunded" : "unpaid";
      return {
        ...ticket,
        status,
        orderItems: Array.isArray(ticket.orderItems) ? ticket.orderItems : [],
        // Payment state is a workflow fact for order/payment staff; tender details stay with payment managers.
        paymentState: canSeePaymentState ? paymentState : null,
        // An unfinished online page doesn't block counter payment: recording it closes the page first.
        canRecordPayment: canManageOrders && canManagePayments && ["open", "accepted", "in_bar_queue", "preparing", "ready"].includes(status) && !activeEvidence.some((payment) => payment.status === "captured"),
        // Loyalty staff get only an eligibility bit, not payment details.
        canApplyLoyalty: canManageLoyalty && settled && !loyaltyAccountId && Boolean(ticket.customerEmail) && !["cancelled", "refunded"].includes(status),
        loyaltyApplied: canManageLoyalty ? Boolean(loyaltyAccountId) : null,
        refundablePayments: canManageOrders && canManagePayments ? activeEvidence.filter((payment) => payment.status === "captured" && !payment.refundIdempotencyKey) : [],
        actions: canManageOrders ? statusActions(CAFE_ORDER_TRANSITIONS, status, ["refunded", "paid", "ready", ...(!settled ? ["completed"] : []), ...(activeEvidence.some((payment) => payment.status === "captured") ? ["cancelled"] : [])]) : [],
      };
    }),
  };
}

const KDS_PAGE_SIZE = 100;
const KDS_ACTIVE_ITEM_STATUSES = ["new", "queued", "preparing", "ready"];
const KDS_ACTIVE_ORDER_STATUSES = ["accepted", "paid", "in_bar_queue", "preparing", "ready"];
const KDS_RELEASE_MINUTES = 45;
type KdsCursor = { queuedAt: string | null; id: string };

function decodeKdsCursor(value: string): KdsCursor {
  if (!value || value.length > 512) throw new Error("Invalid KDS page cursor");
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") throw new Error();
    const cursor = parsed as Record<string, unknown>;
    if (typeof cursor.id !== "string" || !cursor.id || cursor.id.length > 255) throw new Error();
    if (cursor.queuedAt !== null && (typeof cursor.queuedAt !== "string" || !Number.isFinite(Date.parse(cursor.queuedAt)))) throw new Error();
    return { id: cursor.id, queuedAt: cursor.queuedAt as string | null };
  } catch {
    throw new Error("Invalid KDS page cursor");
  }
}

function encodeKdsCursor(item: Record<string, unknown>): string {
  const queuedAt = item.queuedAt == null ? null : new Date(String(item.queuedAt)).toISOString();
  return Buffer.from(JSON.stringify({ id: String(item.id), queuedAt }), "utf8").toString("base64url");
}

function kdsAfterCursorWhere(cursor: KdsCursor) {
  if (cursor.queuedAt === null) return { queuedAt: null, id: { gt: cursor.id } };
  const queuedAt = new Date(cursor.queuedAt);
  return {
    OR: [
      { queuedAt: { gt: queuedAt } },
      { queuedAt, id: { gt: cursor.id } },
      { queuedAt: null },
    ],
  };
}

export async function getCoffeeKdsBoard(_root: unknown, args: { cursor?: string | null; limit?: number | null }, context: Context) {
  requirePermission(permissions.canReadOrders({ session: context.session }), "Not authorized to read the KDS");
  const limit = args.limit ?? KDS_PAGE_SIZE;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > KDS_PAGE_SIZE) throw new Error(`KDS page size must be between 1 and ${KDS_PAGE_SIZE}`);
  const cursor = args.cursor == null ? null : decodeKdsCursor(args.cursor);
  const store = await primaryStore(context);
  // Order-ahead tickets reach the make queue KDS_RELEASE_MINUTES before their pickup time;
  // a line already started stays on the board.
  const releaseBy = new Date(Date.now() + KDS_RELEASE_MINUTES * 60_000);
  const baseWhere = {
    storeId: store.id,
    barStatus: { in: KDS_ACTIVE_ITEM_STATUSES },
    order: { status: { in: KDS_ACTIVE_ORDER_STATUSES } },
  };
  const activeWhere = {
    ...baseWhere,
    OR: [{ order: { promisedAt: null } }, { order: { promisedAt: { lte: releaseBy } } }, { barStatus: { in: ["preparing", "ready"] } }],
  };
  const scheduledWhere = { ...baseWhere, barStatus: { in: ["new", "queued"] }, order: { ...baseWhere.order, promisedAt: { gt: releaseBy } } };
  const pageWhere = cursor ? { ...activeWhere, AND: [kdsAfterCursorWhere(cursor)] } : activeWhere;
  const [rows, activeCount, scheduledCount, nextScheduled] = await Promise.all([
    context.prisma.orderItem.findMany({
      where: pageWhere,
      orderBy: [{ queuedAt: { sort: "asc", nulls: "last" } }, { id: "asc" }],
      take: limit + 1,
      select: { id: true, quantity: true, itemNameSnapshot: true, customizationsSummary: true, specialInstructions: true, barStatus: true, station: true, queuedAt: true, startedAt: true, readyAt: true, order: { select: { id: true, orderNumber: true, status: true, pickupName: true, promisedAt: true, isRush: true } } },
    }),
    context.prisma.orderItem.count({ where: activeWhere }),
    context.prisma.orderItem.count({ where: scheduledWhere }),
    context.prisma.orderItem.findFirst({ where: scheduledWhere, orderBy: { order: { promisedAt: "asc" } }, select: { order: { select: { promisedAt: true } } } }),
  ]);
  const hasMore = rows.length > limit;
  // Within a page, the make queue runs by when each ticket is due: its pickup time, else when it was queued.
  type KdsRow = Record<string, unknown> & { id: string; barStatus: unknown; queuedAt?: unknown; order?: { promisedAt?: unknown } | null };
  const due = (item: KdsRow) => new Date(String(item.order?.promisedAt ?? item.queuedAt ?? 0)).getTime() || 0;
  const items = (rows as KdsRow[]).slice(0, limit).sort((a: KdsRow, b: KdsRow) => due(a) - due(b));
  const canManageOrders = permissions.canManageOrders({ session: context.session });
  const nextPromisedAt = (nextScheduled?.order as { promisedAt?: unknown } | null | undefined)?.promisedAt;
  const nextScheduledAt = nextPromisedAt ? new Date(String(nextPromisedAt)).toISOString() : null;
  return {
    activeCount,
    scheduledCount,
    nextScheduledAt,
    canManageOrders,
    storeTimezone: store.storeTimezone,
    hasMore,
    nextCursor: hasMore && items.length ? encodeKdsCursor(items[items.length - 1]!) : null,
    items: items.map((item: KdsRow) => {
      const status = String(item.barStatus) as KdsItemStatus;
      const next = KDS_ITEM_TRANSITIONS[status]?.find((candidate) => candidate !== "voided");
      return { ...item, nextAction: canManageOrders && next ? { status: next, label: statusLabels[next] || next.replaceAll("_", " "), tone: "default" } : null };
    }),
  };
}

type MenuManagerPrisma = {
  menuCategory: { findMany(args: Record<string, unknown>): Promise<ListRow[]> };
  menuItem: { findMany(args: Record<string, unknown>): Promise<ListRow[]>; count(args: Record<string, unknown>): Promise<number> };
  menuItemModifier: { count(args: Record<string, unknown>): Promise<number> };
  inventoryItem: { findMany(args: Record<string, unknown>): Promise<ListRow[]> };
};
const MENU_MANAGER_PAGE_LIMIT = 50;
const MENU_MANAGER_MODIFIER_LIMIT = 100;
const MENU_MANAGER_CATEGORY_LIMIT = 200;
const menuInventoryRefSelect = { select: { id: true, name: true, unit: true } };
const managedMenuItemSelect = {
  id: true, name: true, shortDescription: true, price: true, available: true, featured: true, popular: true, prepTimeMinutes: true, barStation: true, updatedAt: true,
  ...MENU_STOCK_ITEM_SELECT,
  category: { select: { id: true, name: true } },
  modifiers: {
    orderBy: [{ modifierGroup: "asc" }, { name: "asc" }, { id: "asc" }],
    take: MENU_MANAGER_MODIFIER_LIMIT + 1,
    select: { id: true, name: true, modifierGroup: true, modifierGroupLabel: true, priceAdjustment: true, required: true, minSelections: true, maxSelections: true, inStock: true, defaultSelected: true, updatedAt: true, inventoryAction: true, inventoryQuantity: true, inventoryItem: menuInventoryRefSelect, replacesInventoryItem: menuInventoryRefSelect, inventoryItemId: true, replacesInventoryItemId: true },
  },
};
function encodeMenuManagerCursor(row: ListRow) {
  return Buffer.from(JSON.stringify({ n: String(row.name), i: row.id }), "utf8").toString("base64url");
}
function decodeMenuManagerCursor(value: string) {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as { n?: unknown; i?: unknown };
    if (typeof parsed.n === "string" && typeof parsed.i === "string" && parsed.i) return { name: parsed.n, id: parsed.i };
  } catch {}
  throw new Error("This menu page link is no longer valid. Return to the first page.");
}
function menuRevision(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value || ""));
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

/** Bounded menu-management page: server-side search/category predicate, stable
 * name+id keyset, counts over the same predicate. Inventory mapping is private to
 * product managers and never part of the public menu projection.
 */
export async function getCoffeeMenuManager(_root: unknown, args: { search?: string | null; categoryId?: string | null; cursor?: string | null; limit?: number | null }, context: Context) {
  requirePermission(permissions.canReadProducts({ session: context.session }), "Not authorized to read menu management");
  const canManageProducts = permissions.canManageProducts({ session: context.session });
  const prisma = context.prisma as unknown as MenuManagerPrisma;
  const store = await primaryStore(context);
  const limit = Math.max(1, Math.min(MENU_MANAGER_PAGE_LIMIT, Math.floor(Number(args.limit || MENU_MANAGER_PAGE_LIMIT))));
  const search = (args.search || "").trim().replace(/\s+/g, " ").slice(0, 200);
  const contains = { contains: search, mode: "insensitive" };
  const where: Record<string, unknown> = {
    storeId: store.id,
    ...(args.categoryId === "uncategorized" ? { categoryId: null } : args.categoryId ? { categoryId: args.categoryId } : {}),
    ...(search ? { OR: [{ name: contains }, { shortDescription: contains }, { modifiers: { some: { OR: [{ name: contains }, { modifierGroupLabel: contains }] } } }] } : {}),
  };
  const cursor = args.cursor ? decodeMenuManagerCursor(args.cursor) : null;
  const pageWhere = cursor ? { AND: [where, { OR: [{ name: { gt: cursor.name } }, { name: cursor.name, id: { gt: cursor.id } }] }] } : where;
  const [categoryRows, rows, matchingCount, itemCount, hiddenCount, modifiersOutCount] = await Promise.all([
    prisma.menuCategory.findMany({ where: { storeId: store.id }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }], take: MENU_MANAGER_CATEGORY_LIMIT + 1, select: { id: true, name: true, description: true, active: true, sortOrder: true } }),
    prisma.menuItem.findMany({ where: pageWhere, orderBy: [{ name: "asc" }, { id: "asc" }], take: limit + 1, select: managedMenuItemSelect }),
    prisma.menuItem.count({ where }),
    prisma.menuItem.count({ where: { storeId: store.id } }),
    prisma.menuItem.count({ where: { storeId: store.id, available: false } }),
    prisma.menuItemModifier.count({ where: { storeId: store.id, inStock: false } }),
  ]);
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  // Same display-time stock read as the storefront, so the manager shows what customers see.
  const stock = await cafeMenuStock(context.prisma as never, store.id, items.map((item): MenuStockItem => ({
    id: item.id,
    inventoryItemId: (item.inventoryItemId as string | null) ?? null,
    modifiers: (Array.isArray(item.modifiers) ? item.modifiers : []) as MenuStockItem["modifiers"],
  })));
  return {
    canManageProducts,
    categories: categoryRows.slice(0, MENU_MANAGER_CATEGORY_LIMIT),
    categoriesHasMore: categoryRows.length > MENU_MANAGER_CATEGORY_LIMIT,
    matchingCount,
    stats: { items: itemCount, hidden: hiddenCount, modifiersOut: modifiersOutCount },
    hasMore,
    nextCursor: hasMore && items.length ? encodeMenuManagerCursor(items[items.length - 1]!) : null,
    items: items.map((item) => {
      const modifiers = (Array.isArray(item.modifiers) ? item.modifiers : []) as ListRow[];
      return {
        ...item,
        updatedAt: menuRevision(item.updatedAt),
        soldOut: stock.soldOut.has(item.id),
        modifiersHasMore: modifiers.length > MENU_MANAGER_MODIFIER_LIMIT,
        modifiers: modifiers.slice(0, MENU_MANAGER_MODIFIER_LIMIT).map((modifier) => ({
          ...modifier,
          updatedAt: menuRevision(modifier.updatedAt),
          stockOut: stock.modifiersOut.has(modifier.id),
          inventoryAction: canManageProducts ? modifier.inventoryAction || "unreviewed" : null,
          inventoryQuantity: canManageProducts ? Number(modifier.inventoryQuantity || 0) : null,
          inventoryItem: canManageProducts ? modifier.inventoryItem || null : null,
          replacesInventoryItem: canManageProducts ? modifier.replacesInventoryItem || null : null,
        })),
      };
    }),
  };
}

/** Private, store-scoped inventory picker for modifier review. Search runs before the cap. */
export async function getCoffeeMenuInventoryOptions(_root: unknown, args: { search?: string | null; limit?: number | null }, context: Context) {
  requirePermission(permissions.canManageProducts({ session: context.session }), "Not authorized to review modifier inventory");
  const prisma = context.prisma as unknown as MenuManagerPrisma;
  const store = await primaryStore(context);
  const limit = Math.max(1, Math.min(50, Math.floor(Number(args.limit || 25))));
  const search = (args.search || "").trim().slice(0, 200);
  const rows = await prisma.inventoryItem.findMany({
    where: { storeId: store.id, ...(search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { sku: { contains: search, mode: "insensitive" } }] } : {}) },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: limit + 1,
    select: { id: true, name: true, unit: true },
  });
  return { items: rows.slice(0, limit), hasMore: rows.length > limit };
}

const POS_CATALOG_PAGE_SIZE = 48;
const POS_CATALOG_CURSOR_MAX_LENGTH = 1024;
type PosCatalogCursor = { kind: "pos-catalog"; storeId: string; search: string; categoryId: string; name: string; id: string };
function decodePosCatalogCursor(value: string, storeId: string, search: string, categoryId: string): PosCatalogCursor {
  try {
    if (value.length > POS_CATALOG_CURSOR_MAX_LENGTH) throw new Error();
    const cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as PosCatalogCursor;
    if (cursor.kind !== "pos-catalog" || cursor.storeId !== storeId || cursor.search !== search || cursor.categoryId !== categoryId || typeof cursor.name !== "string" || typeof cursor.id !== "string" || !cursor.id) throw new Error();
    return cursor;
  } catch {
    throw new Error("This menu page is no longer valid; reload the register");
  }
}
const posMenuItemSelect = {
  id: true, name: true, price: true, available: true,
  ...MENU_STOCK_ITEM_SELECT,
  category: { select: { id: true, name: true } },
  modifiers: { orderBy: [{ modifierGroup: "asc" }, { name: "asc" }, { id: "asc" }], take: 100, select: { id: true, name: true, modifierGroup: true, modifierGroupLabel: true, priceAdjustment: true, required: true, minSelections: true, maxSelections: true, inStock: true, defaultSelected: true, ...MENU_STOCK_MODIFIER_SELECT } },
};

export async function getCoffeePosRegister(_root: unknown, args: { search?: string | null; categoryId?: string | null; cursor?: string | null; limit?: number | null }, context: Context) {
  requirePermission(permissions.canManageOrders({ session: context.session }) && permissions.canManagePayments({ session: context.session }), "Not authorized to operate POS");
  const store = await primaryStore(context);
  const search = (args?.search || "").trim().slice(0, 200);
  const categoryId = (args?.categoryId || "").trim().slice(0, 255);
  const limit = Math.min(100, Math.max(1, Math.floor(Number(args?.limit || POS_CATALOG_PAGE_SIZE))));
  const cursor = args?.cursor ? decodePosCatalogCursor(args.cursor, store.id, search, categoryId) : null;
  const where: Record<string, unknown> = {
    storeId: store.id,
    available: true,
    ...(search ? { name: { contains: search, mode: "insensitive" } } : {}),
    ...(categoryId ? { categoryId } : {}),
    ...(cursor ? { OR: [{ name: { gt: cursor.name } }, { name: cursor.name, id: { gt: cursor.id } }] } : {}),
  };
  const [rows, categories, shifts] = await Promise.all([
    context.prisma.menuItem.findMany({ where, orderBy: [{ name: "asc" }, { id: "asc" }], take: limit + 1, select: posMenuItemSelect }),
    context.prisma.menuCategory.findMany({ where: { storeId: store.id }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }], take: 100, select: { id: true, name: true } }),
    context.prisma.registerShift.findMany({ where: { storeId: store.id, status: "open" }, orderBy: { openedAt: "desc" }, take: 1, select: { id: true, shiftNumber: true, registerName: true, status: true, openingCashCents: true, cashSalesCents: true, cardSalesCents: true, tipsCents: true, payInsCents: true, payOutsCents: true, expectedCashCents: true, openedAt: true } }),
  ]);
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  const nextCursor = hasMore && last
    ? Buffer.from(JSON.stringify({ kind: "pos-catalog", storeId: store.id, search, categoryId, name: String(last.name), id: last.id } satisfies PosCatalogCursor), "utf8").toString("base64url")
    : null;
  // Same display-time stock read as the storefront, so the register shows sold-out tiles before a sale is rung up.
  const stock = await cafeMenuStock(context.prisma as never, store.id, page.map((item): MenuStockItem => ({
    id: item.id,
    inventoryItemId: (item.inventoryItemId as string | null) ?? null,
    modifiers: item.modifiers as MenuStockItem["modifiers"],
  })));
  const items = page.map((item) => ({
    ...item,
    inventoryItemId: undefined,
    availability: stock.soldOut.has(item.id) ? "sold_out" : "now",
    // Staff-only: the register caps a ticket at the servings stock can still make.
    maxQuantity: stock.servings.get(item.id) ?? null,
    modifiers: (item.modifiers as Array<{ id: string; inStock: boolean }>).map((modifier) => ({ ...modifier, inStock: modifier.inStock !== false && !stock.modifiersOut.has(modifier.id) })),
  }));
  return { operatorId: String(context.session?.itemId || ""), storeId: store.id, items, hasMore, nextCursor, categories, openShift: shifts[0] || null };
}

export async function quoteCafeOrder(_root: unknown, args: { items?: QuoteItem[] | null; tipCents?: number | null; requestedPickupMinutes?: number | null }, context: Context) {
  const items = validateCafeOrderLines(args.items || []);
  const isStaff = permissions.canManageOrders({ session: context.session });
  const tipCents = isStaff ? Number(args.tipCents || 0) : 0;
  if (!Number.isSafeInteger(tipCents) || tipCents < 0 || tipCents > 100_000_000) throw new Error("Tip must be a non-negative integer amount in cents");
  const store = await primaryStore(context);
  const ids = [...new Set(items.map((item) => item.menuItemId))];
  const menuItems = await context.prisma.menuItem.findMany({ where: { id: { in: ids }, storeId: store.id }, select: { id: true, storeId: true, name: true, price: true, available: true, prepTimeMinutes: true, serviceWindows: true, category: { select: { active: true } }, inventoryItem: { select: { id: true } }, modifiers: { select: { id: true, menuItemId: true, name: true, priceAdjustment: true, inStock: true, modifierGroup: true, modifierGroupLabel: true, required: true, minSelections: true, maxSelections: true } } } }) as MenuRecord[];
  const byId = new Map(menuItems.map((item) => [item.id, item]));
  const lines = items.map((item, index) => {
    const menuItem = byId.get(item.menuItemId);
    if (!menuItem) throw new Error(`Menu item not found: ${item.menuItemId}`);
    assertCoffeeStoreOwnership(menuItem.storeId, store.id, `Menu item ${menuItem.name}`);
    if (!menuItem.available) throw cafeCustomerError(`${menuItem.name} is currently unavailable`);
    if (!isStaff && !isPublishedMenuItem(menuItem)) throw cafeCustomerError(`${menuItem.name} is currently unavailable`);
    const modifierIds = [...new Set(item.modifierIds || [])];
    const selected = modifierIds.map((id) => {
      const modifier = menuItem.modifiers.find((candidate) => candidate.id === id && candidate.menuItemId === menuItem.id);
      if (!modifier) throw new Error(`Modifier ${id} is not valid for ${menuItem.name}`);
      if (modifier.inStock === false) throw cafeCustomerError(`${modifier.name} is currently unavailable`);
      return modifier;
    });
    validateModifierSelections(menuItem, selected);
    const unitPrice = menuItem.price + selected.reduce((sum, modifier) => sum + number(modifier.priceAdjustment), 0);
    if (!Number.isSafeInteger(unitPrice) || unitPrice < 0) throw new Error(`${menuItem.name} has an invalid calculated price`);
    return { index, menuItemId: menuItem.id, name: menuItem.name, quantity: item.quantity, unitPrice, modifierIds };
  });
  const taxRateBasisPoints = Number(store.taxRateBasisPoints ?? 875);
  const totals = calculateCafeTotals(lines, taxRateBasisPoints, tipCents);
  const currency = await context.prisma.storeSetting.findUnique({ where: { singletonKey: "primary" }, select: { currencyCode: true } });
  const currencyCode = String(currency?.currencyCode || "USD");
  if (!isStaff) {
    // Storefront quotes use the same recipe/stock eligibility as order creation (a check, not a reservation).
    const requirements = await getCafeInventoryRequirements(context.prisma as never, store.id, lines.map((line) => ({ menuItemId: line.menuItemId, quantity: line.quantity, modifierIds: line.modifierIds, fallbackInventoryItemId: byId.get(line.menuItemId)?.inventoryItem?.id })));
    await assertCafeRequirementsInStock(context.prisma, store.id, requirements);
  }
  const earliestPickupMinutes = cafeEarliestPickupMinutes(store.pickupLeadTimeMinutes, items.map((item) => byId.get(item.menuItemId)?.prepTimeMinutes));
  let estimatedPickupMinutes = earliestPickupMinutes;
  if (!isStaff) {
    // Online pickup is booked for an open time: now when the cafe is open, or ahead when it is closed.
    const serviceWindowSets = menuItems.map((item) => (Array.isArray(item.serviceWindows) ? item.serviceWindows : ["all_day"]));
    const requested = args.requestedPickupMinutes;
    if (requested != null) {
      if (!Number.isSafeInteger(requested) || requested > COFFEE_PICKUP_SCHEDULE_MAX_MINUTES) throw cafeCustomerError("Choose a pickup time within the next two days");
      if (requested < earliestPickupMinutes) throw cafeCustomerError("That pickup time is earlier than the cafe can prepare this order");
      const pickupAt = new Date(Date.now() + requested * 60_000);
      for (const windows of serviceWindowSets) assertCoffeeOrderingAvailable(store, pickupAt, windows);
      estimatedPickupMinutes = requested;
    } else {
      const first = coffeeFirstPickupMinutes(store, earliestPickupMinutes, serviceWindowSets);
      if (first == null) throw cafeCustomerError("Pickup isn't available in the next two days");
      estimatedPickupMinutes = first;
    }
  }
  return {
    subtotal: totals.subtotal,
    tax: totals.tax,
    tip: totals.tip,
    total: totals.total,
    currencyCode,
    quoteFingerprint: cafeQuoteFingerprint({ storeId: store.id, currencyCode, taxRateBasisPoints, lines, subtotal: totals.subtotal, tax: totals.tax, tip: totals.tip, total: totals.total }),
    estimatedPickupMinutes,
    lines: lines.map((line, index) => ({ index: line.index, menuItemId: line.menuItemId, name: line.name, quantity: line.quantity, unitPrice: line.unitPrice, lineTotal: totals.lineTotals[index] })),
  };
}

// Analytics and Operations read models are capability-sized projections in their own modules.
export { default as getCoffeeReports } from "../../platform/reports/lib/coffeeReportsQuery";
export { default as getCoffeeOperations } from "./getCoffeeOperationsSnapshot";
