import { formatStoreDateTime } from "../../../../lib/date-time";
import { validCoffeeTimezone } from "../../store-settings/lib/store-locale-policy";

type WallClock = { year: number; month: number; day: number; hour: number; minute: number; second: number };

export type StaffShiftTimeResolution =
  | { status: "ready"; instant: string; deviceTimeZone: string; storePreview: string }
  | { status: "empty" | "invalid-store-timezone" | "invalid-device-timezone" | "invalid-local-time" | "nonexistent-local-time" | "ambiguous-local-time" };

const LOCAL_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const formatters = new Map<string, Intl.DateTimeFormat>();

export function getDeviceTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

function wallClockAt(instant: number, timeZone: string): WallClock {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US-u-ca-gregory-nu-latn", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(timeZone, formatter);
  }
  const values = Object.fromEntries(formatter.formatToParts(new Date(instant)).map(({ type, value }) => [type, value]));
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
    hour: Number(values.hour),
    minute: Number(values.minute),
    second: Number(values.second),
  };
}

function wallClockEpoch(value: WallClock) {
  return Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute, value.second);
}

function sameWallClock(left: WallClock, right: WallClock) {
  return left.year === right.year
    && left.month === right.month
    && left.day === right.day
    && left.hour === right.hour
    && left.minute === right.minute
    && left.second === right.second;
}

export function resolveStaffShiftLocalDateTime(
  localDateTime: string,
  storeTimeZone: string | null | undefined,
  deviceTimeZone: string | null | undefined,
): StaffShiftTimeResolution {
  if (typeof storeTimeZone !== "string" || !validCoffeeTimezone(storeTimeZone)) return { status: "invalid-store-timezone" };
  if (typeof deviceTimeZone !== "string" || !validCoffeeTimezone(deviceTimeZone)) return { status: "invalid-device-timezone" };
  if (!localDateTime) return { status: "empty" };

  const match = LOCAL_DATE_TIME.exec(localDateTime);
  if (!match) return { status: "invalid-local-time" };
  const requested: WallClock = {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hour: Number(match[4]),
    minute: Number(match[5]),
    second: 0,
  };
  if (requested.year < 1000 || requested.month < 1 || requested.month > 12 || requested.day < 1 || requested.day > 31 || requested.hour > 23 || requested.minute > 59) {
    return { status: "invalid-local-time" };
  }

  const naiveUtc = Date.parse(`${localDateTime}:00Z`);
  if (!Number.isFinite(naiveUtc) || !sameWallClock(wallClockAt(naiveUtc, "UTC"), requested)) return { status: "invalid-local-time" };

  // Sample both sides of nearby offset transitions. Matching offsets yield every
  // instant represented by this wall time: zero for a DST gap, two for a fold.
  const offsets = new Set<number>();
  for (let hours = -36; hours <= 36; hours += 6) {
    const probe = naiveUtc + hours * 60 * 60 * 1000;
    offsets.add(wallClockEpoch(wallClockAt(probe, deviceTimeZone)) - probe);
  }
  const matches = [...offsets]
    .map((offset) => naiveUtc - offset)
    .filter((candidate) => sameWallClock(wallClockAt(candidate, deviceTimeZone), requested));

  if (matches.length === 0) return { status: "nonexistent-local-time" };
  if (matches.length > 1) return { status: "ambiguous-local-time" };

  const instant = new Date(matches[0]!).toISOString();
  return {
    status: "ready",
    instant,
    deviceTimeZone,
    storePreview: formatStoreDateTime(instant, storeTimeZone),
  };
}
