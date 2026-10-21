import { permissions, type Session } from "../../../keystone/access";
import { validCoffeeTimezone } from "../../../keystone/lib/store-locale-policy";
import { addBusinessDays, isBusinessDate, storeBusinessDate, storeDayStart } from "./businessDate";

/** Analytics read model. Every total is a database aggregate over the whole selected
 * store business period; only detail lists are bounded. Each section is projected only
 * for the capability that owns its facts.
 */
type Grouped = Record<string, unknown> & { _count?: { _all?: number }; _sum?: Record<string, unknown> };
type Model = {
  findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
  count(args: Record<string, unknown>): Promise<number>;
  groupBy(args: Record<string, unknown>): Promise<Grouped[]>;
  aggregate(args: Record<string, unknown>): Promise<Grouped>;
};
type Context = {
  session?: Session;
  prisma: {
    $queryRawUnsafe<T = unknown>(query: string, ...values: unknown[]): Promise<T>;
    storeSetting: { findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null> };
    cafeOrder: Model;
    orderItem: Model;
    payment: Model;
    loyaltyAccount: Model;
  };
};

export const REPORT_PERIODS = ["today", "7d", "30d", "90d", "custom"] as const;
export type ReportPeriod = (typeof REPORT_PERIODS)[number];
const PERIOD_DAYS: Record<Exclude<ReportPeriod, "custom">, number> = { today: 1, "7d": 7, "30d": 30, "90d": 90 };
const MAX_CUSTOM_DAYS = 366;
const LOW_STOCK_PAGE_SIZE = 10;
const TOP_ITEMS = 8;
const ITEM_GROUP_LIMIT = 5000;
const ACTIVE_ORDER_STATUSES = ["accepted", "paid", "in_bar_queue", "preparing", "ready"];
const COLLECTED_PAYMENT_STATUSES = ["captured", "refunded"];

function int(value: unknown) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function resolveReportPeriod(input: { period?: unknown; startDate?: unknown; endDate?: unknown }, timeZone: string, now = new Date()) {
  const period = (REPORT_PERIODS as readonly string[]).includes(String(input.period)) ? input.period as ReportPeriod : "30d";
  const today = storeBusinessDate(timeZone, now);
  let startDate: string;
  let endDate: string;
  if (period === "custom") {
    if (!isBusinessDate(input.startDate) || !isBusinessDate(input.endDate)) throw new Error("Choose a valid start and end date");
    startDate = input.startDate;
    endDate = input.endDate;
    if (startDate > endDate) throw new Error("The start date must be on or before the end date");
    if (addBusinessDays(startDate, MAX_CUSTOM_DAYS - 1) < endDate) throw new Error(`Choose a range of ${MAX_CUSTOM_DAYS} days or fewer`);
  } else {
    endDate = today;
    startDate = addBusinessDays(today, -(PERIOD_DAYS[period] - 1));
  }
  return { period, startDate, endDate, start: storeDayStart(startDate, timeZone), end: storeDayStart(addBusinessDays(endDate, 1), timeZone) };
}

async function salesSection(context: Context, storeId: string, range: { start: Date; end: Date }) {
  const createdAt = { gte: range.start, lt: range.end };
  const completedInPeriod = { storeId, status: "completed", createdAt };
  const lineWhere = { storeId, order: { is: completedInPeriod } };
  const [byStatus, totals, fulfillment, itemGroups, stationGroups, openTickets, readyTickets] = await Promise.all([
    context.prisma.cafeOrder.groupBy({ by: ["status"], where: { storeId, createdAt }, _count: { _all: true } }),
    context.prisma.cafeOrder.aggregate({ where: completedInPeriod, _count: { _all: true }, _sum: { subtotal: true, tax: true, tip: true, discount: true, total: true } }),
    context.prisma.$queryRawUnsafe<Array<{ count: number; minutes: number | null }>>(
      `SELECT COUNT(*)::int AS "count", AVG(EXTRACT(EPOCH FROM ("completedAt" - "createdAt")) / 60)::float8 AS "minutes"
       FROM "CafeOrder"
       WHERE "store" = $1 AND "status" = 'completed' AND "completedAt" IS NOT NULL AND "completedAt" >= "createdAt"
         AND "createdAt" >= ($2::timestamptz AT TIME ZONE 'UTC') AND "createdAt" < ($3::timestamptz AT TIME ZONE 'UTC')`,
      storeId, range.start.toISOString(), range.end.toISOString(),
    ),
    // Stable product identity: group by the accepted line's menu item, never by display name.
    context.prisma.orderItem.groupBy({ by: ["menuItemId", "price", "itemNameSnapshot"], where: lineWhere, _sum: { quantity: true }, orderBy: [{ menuItemId: "asc" }, { price: "asc" }, { itemNameSnapshot: "asc" }], take: ITEM_GROUP_LIMIT + 1 }),
    context.prisma.orderItem.groupBy({ by: ["station"], where: lineWhere, _sum: { quantity: true } }),
    context.prisma.cafeOrder.count({ where: { storeId, status: { in: ACTIVE_ORDER_STATUSES } } }),
    context.prisma.cafeOrder.count({ where: { storeId, status: "ready" } }),
  ]);
  const statusCount = (status: string) => int(byStatus.find((group) => group.status === status)?._count?._all);
  const orderCount = byStatus.reduce((sum, group) => sum + int(group._count?._all), 0);
  const completedCount = statusCount("completed");
  const items = new Map<string, { key: string; menuItemId: string | null; name: string; nameQuantity: number; quantity: number; revenueCents: number }>();
  for (const group of itemGroups.slice(0, ITEM_GROUP_LIMIT)) {
    const menuItemId = typeof group.menuItemId === "string" ? group.menuItemId : null;
    const key = menuItemId ?? "unlinked";
    const quantity = int(group._sum?.quantity);
    const name = String(group.itemNameSnapshot || "");
    const current = items.get(key) || { key, menuItemId, name: menuItemId ? name : "Items without a menu link", nameQuantity: -1, quantity: 0, revenueCents: 0 };
    current.quantity += quantity;
    current.revenueCents += int(group.price) * quantity;
    // Show the most-sold historical name for a product; the grouping key stays the product id.
    if (menuItemId && quantity > current.nameQuantity && name) { current.name = name; current.nameQuantity = quantity; }
    items.set(key, current);
  }
  const fulfillmentRow = fulfillment[0];
  return {
    orderCount,
    completedCount,
    cancelledCount: statusCount("cancelled"),
    completionRatePercent: orderCount ? Math.round(completedCount / orderCount * 100) : 0,
    grossSalesCents: int(totals._sum?.subtotal),
    taxCents: int(totals._sum?.tax),
    tipCents: int(totals._sum?.tip),
    discountCents: int(totals._sum?.discount),
    averageFulfillmentMinutes: fulfillmentRow && int(fulfillmentRow.count) > 0 && fulfillmentRow.minutes != null ? Math.round(Number(fulfillmentRow.minutes)) : null,
    fulfillmentSampleCount: int(fulfillmentRow?.count),
    openTicketCount: openTickets,
    readyTicketCount: readyTickets,
    topItems: [...items.values()]
      .sort((a, b) => b.revenueCents - a.revenueCents || b.quantity - a.quantity || a.key.localeCompare(b.key))
      .slice(0, TOP_ITEMS)
      .map(({ key, menuItemId, name, quantity, revenueCents }) => ({ key, menuItemId, name: name || "Menu item", quantity, revenueCents })),
    topItemsTruncated: itemGroups.length > ITEM_GROUP_LIMIT,
    stationProduction: stationGroups
      .map((group) => ({ station: String(group.station || "unassigned"), quantity: int(group._sum?.quantity) }))
      .sort((a, b) => b.quantity - a.quantity || a.station.localeCompare(b.station)),
  };
}

/** Net collected comes from payment evidence (amount minus refunded amount), never order totals. */
async function collectionsSection(context: Context, storeId: string, range: { start: Date; end: Date }) {
  const inPeriod = { OR: [{ processedAt: { gte: range.start, lt: range.end } }, { processedAt: null, createdAt: { gte: range.start, lt: range.end } }] };
  const where = { storeId, status: { in: COLLECTED_PAYMENT_STATUSES }, ...inPeriod };
  const [groups, needsReviewCount] = await Promise.all([
    context.prisma.payment.groupBy({ by: ["currencyCode", "status"], where, _count: { _all: true }, _sum: { amount: true, refundedAmount: true } }),
    // Evidence that cannot be classified safely: refunded without an amount, captured with a refund amount, or over-refunded.
    context.prisma.payment.count({ where: { storeId, ...inPeriod, OR: [
      { status: "refunded", OR: [{ refundedAmount: null }, { refundedAmount: 0 }] },
      { status: "captured", refundedAmount: { gt: 0 } },
    ] } }),
  ]);
  const currencies = [...new Set(groups.map((group) => String(group.currencyCode || "")))];
  const paymentCount = groups.reduce((sum, group) => sum + int(group._count?._all), 0);
  if (currencies.length > 1) {
    return { currencyCode: null, currencyMismatch: true, paymentCount, grossCollectedCents: null, refundedCents: null, netCollectedCents: null, needsReviewCount };
  }
  const gross = groups.reduce((sum, group) => sum + int(group._sum?.amount), 0);
  const refunded = groups.reduce((sum, group) => sum + int(group._sum?.refundedAmount), 0);
  return {
    currencyCode: currencies[0] || null,
    currencyMismatch: false,
    paymentCount,
    grossCollectedCents: gross,
    refundedCents: refunded,
    netCollectedCents: gross - refunded,
    needsReviewCount,
  };
}

const LOW_STOCK_WHERE = `"store" = $1 AND (
  COALESCE("currentStock", 0) <= COALESCE("reorderPoint", 0)
  OR (COALESCE("parLevel", 0) > 0 AND COALESCE("currentStock", 0) < COALESCE("parLevel", 0) * 0.35)
)`;

/** Low-stock predicate runs over every store item before the page limit. */
async function lowStockSection(context: Context, storeId: string, page: number) {
  const [countRows, rows] = await Promise.all([
    context.prisma.$queryRawUnsafe<Array<{ count: number }>>(`SELECT COUNT(*)::int AS "count" FROM "InventoryItem" WHERE ${LOW_STOCK_WHERE}`, storeId),
    context.prisma.$queryRawUnsafe<Array<Record<string, unknown>>>(
      `SELECT "id", "name", "category", "unit", "supplierName",
              COALESCE("currentStock", 0)::text AS "currentStock", COALESCE("reorderPoint", 0)::text AS "reorderPoint", COALESCE("parLevel", 0)::text AS "parLevel"
       FROM "InventoryItem" WHERE ${LOW_STOCK_WHERE}
       ORDER BY COALESCE("currentStock", 0) ASC, "id" ASC LIMIT $2 OFFSET $3`,
      storeId, LOW_STOCK_PAGE_SIZE, page * LOW_STOCK_PAGE_SIZE,
    ),
  ]);
  return {
    totalCount: int(countRows[0]?.count),
    page,
    pageSize: LOW_STOCK_PAGE_SIZE,
    items: rows.map((row) => ({
      id: String(row.id),
      name: String(row.name || ""),
      category: typeof row.category === "string" ? row.category : null,
      unit: typeof row.unit === "string" ? row.unit : null,
      currentStock: Number(row.currentStock),
      reorderPoint: Number(row.reorderPoint),
      parLevel: Number(row.parLevel),
      supplierName: typeof row.supplierName === "string" && row.supplierName ? row.supplierName : null,
    })),
  };
}

async function loyaltySection(context: Context, storeId: string) {
  const [totals, topAccounts] = await Promise.all([
    context.prisma.loyaltyAccount.aggregate({ where: { storeId }, _count: { _all: true }, _sum: { visits: true, drinkCredits: true } }),
    context.prisma.loyaltyAccount.findMany({ where: { storeId }, orderBy: [{ lifetimePoints: "desc" }, { id: "asc" }], take: 6, select: { id: true, tier: true, lifetimePoints: true, drinkCredits: true, visits: true, lastVisitAt: true, customerName: true, customerEmail: true } }),
  ]);
  return {
    accountCount: int(totals._count?._all),
    totalVisits: int(totals._sum?.visits),
    outstandingDrinkCredits: int(totals._sum?.drinkCredits),
    topAccounts,
  };
}

export default async function getCoffeeReports(_root: unknown, rawArgs: unknown, context: Context) {
  const session = { session: context.session };
  const sections = {
    sales: permissions.canReadOrders(session),
    collections: permissions.canReadPayments(session),
    lowStock: permissions.canReadInventory(session),
    loyalty: permissions.canReadLoyalty(session),
  };
  if (!Object.values(sections).some(Boolean)) throw new Error("Not authorized to read cafe analytics");
  const args = rawArgs && typeof rawArgs === "object" ? rawArgs as Record<string, unknown> : {};
  const store = await context.prisma.storeSetting.findUnique({ where: { singletonKey: "primary" }, select: { id: true, timezone: true } });
  if (!store?.id) throw new Error("Primary coffee store is not configured");
  const storeId = String(store.id);
  const configured = typeof store.timezone === "string" && validCoffeeTimezone(store.timezone);
  const timeZone = configured ? String(store.timezone) : "UTC";
  const range = resolveReportPeriod(args, timeZone);
  const lowStockPage = Number.isSafeInteger(args.lowStockPage) && Number(args.lowStockPage) >= 0 && Number(args.lowStockPage) <= 10_000 ? Number(args.lowStockPage) : 0;

  const [sales, collections, lowStock, loyalty] = await Promise.all([
    sections.sales ? salesSection(context, storeId, range) : Promise.resolve(null),
    sections.collections ? collectionsSection(context, storeId, range) : Promise.resolve(null),
    sections.lowStock ? lowStockSection(context, storeId, lowStockPage) : Promise.resolve(null),
    sections.loyalty ? loyaltySection(context, storeId) : Promise.resolve(null),
  ]);
  return {
    storeTimezone: configured ? timeZone : null,
    period: { period: range.period, startDate: range.startDate, endDate: range.endDate, timezone: timeZone, timezoneConfigured: configured },
    sales,
    collections,
    lowStock,
    loyalty,
  };
}
