// The cafe's pickup-time rules, shared by the server quote, order creation and the storefront so they
// always name the same earliest pickup. Pure and dependency-free: safe to import from client components.

export type WeeklyHour = { day: string; open?: string | null; close?: string | null; closed?: boolean | null };
export type PickupQuoteSettings = {
  timezone?: string | null;
  weeklyHours?: unknown;
  pickupLeadTimeMinutes?: number | null;
};

export const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
export const SERVICE_WINDOWS: Record<string, readonly [number, number]> = {
  morning: [5 * 60, 11 * 60],
  midday: [11 * 60, 14 * 60],
  afternoon: [14 * 60, 18 * 60],
  all_day: [0, 24 * 60],
};

/** Online pickup can be booked this far ahead, so a closed cafe still takes next-morning orders. */
export const COFFEE_PICKUP_SCHEDULE_MAX_MINUTES = 48 * 60;
export const CAFE_PICKUP_PREP_BUFFER_MINUTES = 5;
export const DEFAULT_STORE_TIMEZONE = "America/New_York";

/** Earliest pickup the cafe will accept for an online request: the configured lead time or the slowest item's prep time. */
export function cafeEarliestPickupMinutes(storeLeadMinutes: number | null | undefined, prepTimes: Array<number | null | undefined>) {
  const prep = prepTimes.map((minutes) => (Number.isFinite(Number(minutes)) ? Number(minutes) : 0) + CAFE_PICKUP_PREP_BUFFER_MINUTES);
  return Math.max(5, Number(storeLeadMinutes) || 0, ...prep);
}

export function clockMinutes(value?: string | null) {
  const match = /^(\d{2}):(\d{2})$/.exec(value || "");
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
}

const zoneFormats = new Map<string, Intl.DateTimeFormat>();

/** Weekday name and minute of day at `at` on the store's clock. */
export function zonedParts(at: Date, timezone: string) {
  let format = zoneFormats.get(timezone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    zoneFormats.set(timezone, format);
  }
  const parts = format.formatToParts(at);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || "";
  return { day: value("weekday"), minuteOfDay: Number(value("hour")) * 60 + Number(value("minute")) };
}

export function normalizeWeeklyHours(value: unknown): WeeklyHour[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry as Record<string, unknown>;
    const day = String(row.day || "");
    if (!(DAY_NAMES as readonly string[]).includes(day)) return [];
    return [{ day, open: typeof row.open === "string" ? row.open : null, close: typeof row.close === "string" ? row.close : null, closed: row.closed === true }];
  });
}

export function inServiceWindows(minuteOfDay: number, serviceWindows: readonly string[]) {
  return !serviceWindows.length || serviceWindows.includes("all_day") || serviceWindows.some((window) => {
    const range = SERVICE_WINDOWS[window];
    return Boolean(range && minuteOfDay >= range[0] && minuteOfDay < range[1]);
  });
}

function openAtMinute(hours: WeeklyHour[], day: string, minuteOfDay: number, serviceWindows: readonly string[]) {
  const entry = hours.find((candidate) => candidate.day === day);
  const openMinute = clockMinutes(entry?.open);
  const closeMinute = clockMinutes(entry?.close);
  if (!entry || entry.closed || openMinute == null || closeMinute == null || minuteOfDay < openMinute || minuteOfDay >= closeMinute) return false;
  return inServiceWindows(minuteOfDay, serviceWindows);
}

/** Minutes from `at` to the first pickup the store can promise, at least `earliestMinutes` out and inside the
 *  store hours and every item's service windows; null when nothing opens within the booking horizon.
 *  The lead time counts from now, so a request placed overnight can be ready right at opening. */
export function coffeeFirstPickupMinutes(
  settings: PickupQuoteSettings,
  earliestMinutes: number,
  serviceWindowSets: ReadonlyArray<readonly string[]> = [["all_day"]],
  at = new Date(),
) {
  const timezone = settings.timezone || DEFAULT_STORE_TIMEZONE;
  const hours = normalizeWeeklyHours(settings.weeklyHours);
  // Each candidate is read on the store's clock as a real instant. Adding minutes to today's wall-clock
  // minute assumes every day is 1440 minutes long, which is an hour off across a DST change.
  for (let offset = Math.max(0, Math.ceil(earliestMinutes)); offset <= COFFEE_PICKUP_SCHEDULE_MAX_MINUTES; offset++) {
    const { day, minuteOfDay } = zonedParts(new Date(at.getTime() + offset * 60_000), timezone);
    if (serviceWindowSets.every((windows) => openAtMinute(hours, day, minuteOfDay, windows))) return offset;
  }
  return null;
}

/** The earliest pickup instant the checkout quote will offer for these items (none: the store lead alone). */
export function coffeeFirstPickupAt(
  settings: PickupQuoteSettings,
  prepTimes: Array<number | null | undefined> = [],
  serviceWindowSets: ReadonlyArray<readonly string[]> = [["all_day"]],
  at = new Date(),
) {
  const offset = coffeeFirstPickupMinutes(settings, cafeEarliestPickupMinutes(settings.pickupLeadTimeMinutes, prepTimes), serviceWindowSets, at);
  return offset == null ? null : new Date(at.getTime() + offset * 60_000);
}
