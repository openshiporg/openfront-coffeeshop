import { cafeCustomerError } from "../lib/cafeCustomerError";

export type WeeklyHour = { day: string; open?: string | null; close?: string | null; closed?: boolean | null };
export type CoffeeAvailabilitySettings = {
  timezone?: string | null;
  weeklyHours?: unknown;
  pickupLeadTimeMinutes?: number | null;
};

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const SERVICE_WINDOWS: Record<string, readonly [number, number]> = {
  morning: [5 * 60, 11 * 60],
  midday: [11 * 60, 14 * 60],
  afternoon: [14 * 60, 18 * 60],
  all_day: [0, 24 * 60],
};

function minutes(value?: string | null) {
  const match = /^(\d{2}):(\d{2})$/.exec(value || "");
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
}

function zonedParts(at: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(at);
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

export function getCoffeeOrderingAvailability(
  settings: CoffeeAvailabilitySettings,
  at = new Date(),
  serviceWindows: readonly string[] = ["all_day"],
) {
  const timezone = settings.timezone || "America/New_York";
  const { day, minuteOfDay } = zonedParts(at, timezone);
  const hours = normalizeWeeklyHours(settings.weeklyHours);
  const today = hours.find((entry) => entry.day === day);
  const openMinute = minutes(today?.open);
  const closeMinute = minutes(today?.close);
  const storeOpen = Boolean(today && !today.closed && openMinute != null && closeMinute != null && minuteOfDay >= openMinute && minuteOfDay < closeMinute);
  const itemOpen = !serviceWindows.length || serviceWindows.includes("all_day") || serviceWindows.some((window) => {
    const range = SERVICE_WINDOWS[window];
    return Boolean(range && minuteOfDay >= range[0] && minuteOfDay < range[1]);
  });
  return {
    orderingOpen: storeOpen && itemOpen,
    storeOpen,
    itemOpen,
    timezone,
    day,
    minuteOfDay,
    today: today || null,
    pickupLeadTimeMinutes: Math.max(5, Number(settings.pickupLeadTimeMinutes || 12)),
  };
}

/** Online pickup can be booked this far ahead, so a closed cafe still takes next-morning orders. */
export const COFFEE_PICKUP_SCHEDULE_MAX_MINUTES = 48 * 60;

function openAtMinute(hours: WeeklyHour[], day: string, minuteOfDay: number, serviceWindows: readonly string[]) {
  const entry = hours.find((candidate) => candidate.day === day);
  const openMinute = minutes(entry?.open);
  const closeMinute = minutes(entry?.close);
  if (!entry || entry.closed || openMinute == null || closeMinute == null || minuteOfDay < openMinute || minuteOfDay >= closeMinute) return false;
  return !serviceWindows.length || serviceWindows.includes("all_day") || serviceWindows.some((window) => {
    const range = SERVICE_WINDOWS[window];
    return Boolean(range && minuteOfDay >= range[0] && minuteOfDay < range[1]);
  });
}

/** Minutes from `at` to the first pickup the store can promise, at least `earliestMinutes` out and inside the
 *  store hours and every item's service windows; null when nothing opens within the booking horizon. */
export function coffeeFirstPickupMinutes(
  settings: CoffeeAvailabilitySettings,
  earliestMinutes: number,
  serviceWindowSets: ReadonlyArray<readonly string[]> = [["all_day"]],
  at = new Date(),
) {
  const { day, minuteOfDay } = zonedParts(at, settings.timezone || "America/New_York");
  const hours = normalizeWeeklyHours(settings.weeklyHours);
  const dayIndex = (DAY_NAMES as readonly string[]).indexOf(day);
  if (dayIndex === -1) return null;
  for (let offset = Math.max(0, Math.ceil(earliestMinutes)); offset <= COFFEE_PICKUP_SCHEDULE_MAX_MINUTES; offset++) {
    const total = minuteOfDay + offset;
    const candidateDay = DAY_NAMES[(dayIndex + Math.floor(total / 1440)) % 7];
    if (serviceWindowSets.every((windows) => openAtMinute(hours, candidateDay, total % 1440, windows))) return offset;
  }
  return null;
}

export function assertCoffeeOrderingAvailable(
  settings: CoffeeAvailabilitySettings,
  at = new Date(),
  serviceWindows: readonly string[] = ["all_day"],
) {
  const availability = getCoffeeOrderingAvailability(settings, at, serviceWindows);
  if (!availability.storeOpen) throw cafeCustomerError("The cafe is closed for pickup at that time");
  if (!availability.itemOpen) throw cafeCustomerError("A selected item isn't served at that time");
  return availability;
}
