import type { StatusTone } from "@/features/platform/components/StatusTitle";

export const REGISTER_PAGE_SIZE = 25;

export const REGISTER_VIEWS = ["shifts", "payments"] as const;
export type RegisterView = (typeof REGISTER_VIEWS)[number];
export const SHIFT_STATUS_FILTERS = ["open", "closed", "all"] as const;
export type ShiftStatusFilter = (typeof SHIFT_STATUS_FILTERS)[number];
export const RANGE_FILTERS = ["today", "7d", "30d", "all"] as const;
export type RangeFilter = (typeof RANGE_FILTERS)[number];
export const PAYMENT_METHOD_FILTERS = ["all", "cash", "card"] as const;
export type PaymentMethodFilter = (typeof PAYMENT_METHOD_FILTERS)[number];
export const PAYMENT_STATUS_FILTERS = ["all", "captured", "refunded"] as const;
export type PaymentStatusFilter = (typeof PAYMENT_STATUS_FILTERS)[number];

export const RANGE_LABELS: Record<RangeFilter, string> = { today: "Today", "7d": "7 days", "30d": "30 days", all: "All time" };
export const SHIFT_STATUS_LABELS: Record<string, string> = { open: "Open", closed: "Closed" };
export const SHIFT_STATUS_TONES: Record<string, StatusTone> = { open: "green", closed: "zinc" };
export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pending: "Pending", authorized: "Authorized", captured: "Captured", failed: "Failed", refunded: "Refunded", cancelled: "Cancelled",
};
export const PAYMENT_STATUS_TONES: Record<string, StatusTone> = {
  pending: "amber", authorized: "blue", captured: "emerald", failed: "red", refunded: "rose", cancelled: "zinc",
};
export const PAYMENT_METHOD_LABELS: Record<string, string> = { card: "Card", cash: "Cash", gift_card: "Gift card", manual: "Manual" };
export const POS_STATUS_LABELS: Record<string, string> = { open: "Open", paid: "Paid", voided: "Voided", refunded: "Refunded" };
export const POS_STATUS_TONES: Record<string, StatusTone> = { open: "blue", paid: "emerald", voided: "zinc", refunded: "rose" };
export const MOVEMENT_LABELS: Record<string, string> = { pay_in: "Pay in", pay_out: "Pay out", cash_drop: "Cash drop" };

export type RegisterListState = {
  view: RegisterView;
  status: ShiftStatusFilter;
  range: RangeFilter;
  method: PaymentMethodFilter;
  paymentStatus: PaymentStatusFilter;
  search: string;
  page: number;
};

type Param = string | string[] | undefined;

function single(value: Param) {
  return typeof value === "string" ? value : "";
}

function oneOf<T extends string>(value: string, options: readonly T[], fallback: T): T {
  return (options as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function parsePage(value: Param) {
  const page = Number.parseInt(single(value), 10);
  return Number.isSafeInteger(page) && page > 1 ? Math.min(page, 10_000) : 1;
}

export function parseRegisterListState(params: Record<string, Param>): RegisterListState {
  return {
    view: oneOf(single(params.view), REGISTER_VIEWS, "shifts"),
    status: oneOf(single(params.status), SHIFT_STATUS_FILTERS, "all"),
    range: oneOf(single(params.range), RANGE_FILTERS, "all"),
    method: oneOf(single(params.method), PAYMENT_METHOD_FILTERS, "all"),
    paymentStatus: oneOf(single(params.paymentStatus), PAYMENT_STATUS_FILTERS, "all"),
    search: single(params.search).trim().slice(0, 60),
    page: parsePage(params.page),
  };
}

export function registerListHref(state: RegisterListState) {
  const params = new URLSearchParams();
  if (state.view !== "shifts") params.set("view", state.view);
  if (state.range !== "all") params.set("range", state.range);
  if (state.view === "shifts") {
    if (state.status !== "all") params.set("status", state.status);
  } else {
    if (state.method !== "all") params.set("method", state.method);
    if (state.paymentStatus !== "all") params.set("paymentStatus", state.paymentStatus);
    if (state.search) params.set("search", state.search);
  }
  if (state.page > 1) params.set("page", String(state.page));
  const query = params.toString();
  return `/dashboard/platform/register${query ? `?${query}` : ""}`;
}

function zoneOrUtc(timeZone?: string | null) {
  if (timeZone) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date(0));
      return timeZone;
    } catch {
      // fall through
    }
  }
  return "UTC";
}

function zonedWallClock(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "numeric", second: "numeric",
  }).formatToParts(instant);
  const part = (type: string) => Number(parts.find((entry) => entry.type === type)?.value);
  return { year: part("year"), month: part("month"), day: part("day"), hour: part("hour"), minute: part("minute"), second: part("second") };
}

function zoneOffsetMs(instant: Date, timeZone: string) {
  const wall = zonedWallClock(instant, timeZone);
  const asUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  return asUtc - Math.floor(instant.getTime() / 1000) * 1000;
}

/** Midnight in the store's time zone, `daysBack` store days before `now`. */
export function storeDayStart(now: Date, timeZone: string | null | undefined, daysBack = 0) {
  const zone = zoneOrUtc(timeZone);
  const today = zonedWallClock(now, zone);
  const wallMidnight = Date.UTC(today.year, today.month - 1, today.day - daysBack);
  let instant = wallMidnight - zoneOffsetMs(new Date(wallMidnight), zone);
  instant = wallMidnight - zoneOffsetMs(new Date(instant), zone);
  return new Date(instant);
}

/** Lower bound for a range pill, or null for all time. */
export function rangeStart(range: RangeFilter, timeZone: string | null | undefined, now = new Date()) {
  if (range === "all") return null;
  return storeDayStart(now, timeZone, range === "today" ? 0 : range === "7d" ? 6 : 29);
}

export function formatMoney(cents?: number | null, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(cents || 0) / 100);
  } catch {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(cents || 0) / 100);
  }
}

export function formatSignedMoney(cents?: number | null, currency = "USD") {
  const amount = Number(cents || 0);
  if (!amount) return formatMoney(0, currency);
  return `${amount > 0 ? "+" : "−"}${formatMoney(Math.abs(amount), currency)}`;
}
