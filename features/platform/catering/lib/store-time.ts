// Pure store-time helpers shared by the catering and subscriptions slices.
// A datetime-local value is a wall-clock time; these read and write it in the
// STORE's time zone, never the device's.

type WallClock = { year: number; month: number; day: number; hour: number; minute: number };

const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const LOCAL_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function validTimeZone(value?: string | null): string | null {
  if (typeof value !== "string" || !value) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
    return value;
  } catch {
    return null;
  }
}

function wallClockAt(instant: number, timeZone: string): WallClock {
  const parts = new Intl.DateTimeFormat("en-US-u-ca-gregory-nu-latn", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(instant));
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value);
  return { year: value("year"), month: value("month"), day: value("day"), hour: value("hour"), minute: value("minute") };
}

function same(left: WallClock, right: WallClock) {
  return left.year === right.year && left.month === right.month && left.day === right.day && left.hour === right.hour && left.minute === right.minute;
}

export type StoreInstantResult = { ok: true; iso: string } | { ok: false; error: string };

/** "2026-10-24T09:30" read as a wall-clock time in `timeZone`. A clock-change fold takes the earlier instant. */
export function storeLocalToInstant(local: string, timeZone: string): StoreInstantResult {
  const zone = validTimeZone(timeZone);
  if (!zone) return { ok: false, error: "Store time zone is invalid." };
  const match = LOCAL_DATE_TIME.exec(local.trim());
  if (!match) return { ok: false, error: "Enter a valid date and time." };
  const requested: WallClock = { year: +match[1], month: +match[2], day: +match[3], hour: +match[4], minute: +match[5] };
  const naive = Date.UTC(requested.year, requested.month - 1, requested.day, requested.hour, requested.minute);
  if (!Number.isFinite(naive) || !same(wallClockAt(naive, "UTC"), requested)) return { ok: false, error: "Enter a valid date and time." };
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const probe = naive + hours * 3_600_000;
    const wall = wallClockAt(probe, zone);
    offsets.add(Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute) - Math.floor(probe / 60_000) * 60_000);
  }
  const matches = [...offsets].map((offset) => naive - offset).filter((candidate) => same(wallClockAt(candidate, zone), requested)).sort((a, b) => a - b);
  if (!matches.length) return { ok: false, error: "That time is skipped by a clock change in the store time zone." };
  return { ok: true, iso: new Date(matches[0]!).toISOString() };
}

/** Midnight at the start of a store-calendar date ("2026-10-24"). */
export function storeDateToInstant(date: string, timeZone: string): StoreInstantResult {
  if (!LOCAL_DATE.test(date.trim())) return { ok: false, error: "Enter a valid date." };
  const exact = storeLocalToInstant(`${date.trim()}T00:00`, timeZone);
  // Zones whose clocks skip midnight start the day at the first valid minute.
  return exact.ok ? exact : storeLocalToInstant(`${date.trim()}T01:00`, timeZone);
}

/** An instant as a datetime-local value in the store time zone. */
export function instantToStoreLocal(iso: string | null | undefined, timeZone: string): string {
  if (!iso) return "";
  const instant = Date.parse(iso);
  const zone = validTimeZone(timeZone);
  if (!Number.isFinite(instant) || !zone) return "";
  const wall = wallClockAt(instant, zone);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${wall.year}-${pad(wall.month)}-${pad(wall.day)}T${pad(wall.hour)}:${pad(wall.minute)}`;
}

/** An instant's store-calendar date ("2026-10-24"). */
export function instantToStoreDate(iso: string | null | undefined, timeZone: string): string {
  return instantToStoreLocal(iso, timeZone).slice(0, 10);
}

/** Today's store-calendar date. */
export function storeToday(timeZone: string, now = new Date()): string {
  return instantToStoreDate(now.toISOString(), timeZone);
}

/** Add whole days or calendar months to a "YYYY-MM-DD" date; month ends clamp (Jan 31 + 1 month = Feb 28/29). */
export function addToDate(date: string, amount: { days?: number; months?: number }): string {
  const match = LOCAL_DATE.exec(date.trim());
  if (!match) return "";
  let year = +match[1];
  let month = +match[2] - 1;
  let day = +match[3];
  if (amount.months) {
    const total = year * 12 + month + amount.months;
    year = Math.floor(total / 12);
    month = total % 12;
    const last = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    day = Math.min(day, last);
  }
  const result = new Date(Date.UTC(year, month, day + (amount.days || 0)));
  return result.toISOString().slice(0, 10);
}

/** PREFIX-YYMMDD-XXXXXX, dated on the store calendar. */
export function recordNumber(prefix: string, timeZone?: string | null, at = new Date()): string {
  const zone = validTimeZone(timeZone) || "UTC";
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, year: "2-digit", month: "2-digit", day: "2-digit" }).formatToParts(at);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value || "";
  const bytes = new Uint8Array(3);
  globalThis.crypto.getRandomValues(bytes);
  const suffix = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("").toUpperCase();
  return `${prefix}-${part("year")}${part("month")}${part("day")}-${suffix}`;
}

/** "12.50" → 1250. */
export function parseDollars(text: string): { ok: true; cents: number } | { ok: false; error: string } {
  const match = /^\$?(\d{1,7})(?:\.(\d{1,2}))?$/.exec(text.trim().replace(/,/g, ""));
  if (!match) return { ok: false, error: "Enter an amount like 12.50." };
  return { ok: true, cents: Number(match[1]) * 100 + Number((match[2] || "").padEnd(2, "0")) };
}

export function formatMoney(cents: number | null | undefined, currencyCode = "USD") {
  const value = (cents || 0) / 100;
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode }).format(value);
  } catch {
    return `$${value.toFixed(2)}`;
  }
}

/** Store-calendar date label ("Oct 24, 2026"). */
export function formatStoreDate(iso: string | null | undefined, timeZone?: string | null) {
  if (!iso) return "—";
  const instant = new Date(iso);
  if (!Number.isFinite(instant.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { timeZone: validTimeZone(timeZone) || "UTC", month: "short", day: "numeric", year: "numeric" }).format(instant);
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
