/** Store-local business dates. A business day is the store's wall-clock calendar day,
 * resolved through the store's IANA timezone, never the server or browser zone.
 */
const BUSINESS_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const formatters = new Map<string, Intl.DateTimeFormat>();

function formatter(timeZone: string) {
  let value = formatters.get(timeZone);
  if (!value) {
    value = new Intl.DateTimeFormat("en-US-u-ca-gregory-nu-latn", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(timeZone, value);
  }
  return value;
}

function wallClockEpoch(instant: number, timeZone: string) {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(new Date(instant)).map(({ type, value }) => [type, value]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
}

export function isBusinessDate(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const match = BUSINESS_DATE.exec(value);
  if (!match) return false;
  const epoch = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isFinite(epoch) && new Date(epoch).toISOString().slice(0, 10) === value;
}

/** Calendar date of `now` in the store timezone. */
export function storeBusinessDate(timeZone: string, now = new Date()) {
  return new Date(wallClockEpoch(now.getTime(), timeZone)).toISOString().slice(0, 10);
}

export function addBusinessDays(date: string, days: number) {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

/** First instant of a store-local calendar day. When midnight is skipped by a clock
 * change, this is the first instant that exists on that day.
 */
export function storeDayStart(date: string, timeZone: string) {
  if (!isBusinessDate(date)) throw new Error("Business date must be a valid YYYY-MM-DD date");
  const target = Date.parse(`${date}T00:00:00Z`);
  let guess = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    guess = target - (wallClockEpoch(guess, timeZone) - guess);
  }
  // Step forward out of a skipped midnight so the instant belongs to `date`.
  while (new Date(wallClockEpoch(guess, timeZone)).toISOString().slice(0, 10) < date) guess += 15 * 60 * 1000;
  return new Date(guess);
}
