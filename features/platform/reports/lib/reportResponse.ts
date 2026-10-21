export type ReportsProjection = {
  storeTimezone: string | null;
  period: { period: string; startDate: string; endDate: string; timezone: string; timezoneConfigured: boolean };
  sales: {
    orderCount: number;
    completedCount: number;
    cancelledCount: number;
    completionRatePercent: number;
    grossSalesCents: number;
    taxCents: number;
    tipCents: number;
    discountCents: number;
    averageFulfillmentMinutes: number | null;
    fulfillmentSampleCount: number;
    openTicketCount: number;
    readyTicketCount: number;
    topItems: Array<{ key: string; menuItemId: string | null; name: string; quantity: number; revenueCents: number }>;
    topItemsTruncated: boolean;
    stationProduction: Array<{ station: string; quantity: number }>;
  } | null;
  collections: {
    currencyCode: string | null;
    currencyMismatch: boolean;
    paymentCount: number;
    grossCollectedCents: number | null;
    refundedCents: number | null;
    netCollectedCents: number | null;
    needsReviewCount: number;
  } | null;
  lowStock: {
    totalCount: number;
    page: number;
    pageSize: number;
    items: Array<{
      id: string;
      name: string;
      category: string | null;
      unit: string | null;
      currentStock: number;
      reorderPoint: number;
      parLevel: number;
      supplierName: string | null;
    }>;
  } | null;
  loyalty: {
    accountCount: number;
    totalVisits: number;
    outstandingDrinkCredits: number;
    topAccounts: Array<{
      id: string;
      customerName: string | null;
      customerEmail: string | null;
      tier: string | null;
      lifetimePoints: number | null;
      drinkCredits: number | null;
      lastVisitAt: string | null;
    }>;
  } | null;
};

export type ReportsLoadResult =
  | { kind: "ready"; report: ReportsProjection }
  | { kind: "unavailable" };

type ReportsClient = (
  query: string,
  variables: Record<string, unknown>,
  requestOptions: RequestInit,
) => Promise<unknown>;

const unavailable: ReportsLoadResult = { kind: "unavailable" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function isNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
function isInt(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value);
}
function isNullableInt(value: unknown): value is number | null {
  return value === null || isInt(value);
}
function isNullableNumber(value: unknown): value is number | null {
  return value === null || isNumber(value);
}
function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}
const every = (value: unknown, check: (entry: unknown) => boolean) => Array.isArray(value) && value.every(check);

function isPeriod(value: unknown) {
  return isRecord(value)
    && typeof value.period === "string"
    && typeof value.startDate === "string"
    && typeof value.endDate === "string"
    && typeof value.timezone === "string"
    && typeof value.timezoneConfigured === "boolean";
}

function isSales(value: unknown) {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  return ["orderCount", "completedCount", "cancelledCount", "completionRatePercent", "fulfillmentSampleCount", "openTicketCount", "readyTicketCount"].every((field) => isInt(value[field]))
    && ["grossSalesCents", "taxCents", "tipCents", "discountCents"].every((field) => isNumber(value[field]))
    && isNullableInt(value.averageFulfillmentMinutes)
    && typeof value.topItemsTruncated === "boolean"
    && every(value.topItems, (item) => isRecord(item) && typeof item.key === "string" && isNullableString(item.menuItemId) && typeof item.name === "string" && isInt(item.quantity) && isNumber(item.revenueCents))
    && every(value.stationProduction, (item) => isRecord(item) && typeof item.station === "string" && isInt(item.quantity));
}

function isCollections(value: unknown) {
  if (value === null) return true;
  return isRecord(value)
    && isNullableString(value.currencyCode)
    && typeof value.currencyMismatch === "boolean"
    && isInt(value.paymentCount)
    && isNullableNumber(value.grossCollectedCents)
    && isNullableNumber(value.refundedCents)
    && isNullableNumber(value.netCollectedCents)
    && isInt(value.needsReviewCount);
}

function isLowStock(value: unknown) {
  if (value === null) return true;
  return isRecord(value)
    && isInt(value.totalCount) && isInt(value.page) && isInt(value.pageSize)
    && every(value.items, (item) => isRecord(item)
      && typeof item.id === "string"
      && typeof item.name === "string"
      && isNullableString(item.category)
      && isNullableString(item.unit)
      && isNumber(item.currentStock)
      && isNumber(item.reorderPoint)
      && isNumber(item.parLevel)
      && isNullableString(item.supplierName));
}

function isLoyalty(value: unknown) {
  if (value === null) return true;
  return isRecord(value)
    && isInt(value.accountCount) && isInt(value.totalVisits) && isInt(value.outstandingDrinkCredits)
    && every(value.topAccounts, (account) => isRecord(account)
      && typeof account.id === "string"
      && isNullableString(account.customerName)
      && isNullableString(account.customerEmail)
      && isNullableString(account.tier)
      && isNullableInt(account.lifetimePoints)
      && isNullableInt(account.drinkCredits)
      && isNullableString(account.lastVisitAt));
}

function isReportsProjection(value: unknown): value is ReportsProjection {
  return isRecord(value)
    && isNullableString(value.storeTimezone)
    && isPeriod(value.period)
    && isSales(value.sales)
    && isCollections(value.collections)
    && isLowStock(value.lowStock)
    && isLoyalty(value.loyalty);
}

export function classifyReportsResponse(response: unknown): ReportsLoadResult {
  if (!isRecord(response) || response.success !== true || !isRecord(response.data)) return unavailable;
  const report = response.data.getCoffeeReports;
  return isReportsProjection(report) ? { kind: "ready", report } : unavailable;
}

export async function loadCoffeeReports(query: string, variables: Record<string, unknown>, client: ReportsClient): Promise<ReportsLoadResult> {
  try {
    const response = await client(query, variables, { cache: "no-store" });
    return classifyReportsResponse(response);
  } catch {
    return unavailable;
  }
}
