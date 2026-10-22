// Open/closed state from the store's saved weekly hours, in the store's own time zone.

export type HoursRow = { day: string; open: string; close: string; closed: boolean };
export type OpenState = { kind: "open" | "closed" | "unknown"; label: string };

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const WEEK_ORDER = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export function hoursRows(value: unknown): HoursRow[] {
  if (!Array.isArray(value)) return [];
  const rows = value.flatMap((entry) => entry && typeof entry === "object" && "day" in entry
    ? [{
        day: String((entry as { day: unknown }).day),
        open: String((entry as { open?: unknown }).open || ""),
        close: String((entry as { close?: unknown }).close || ""),
        closed: (entry as { closed?: unknown }).closed === true,
      }]
    : []);
  return rows.sort((a, b) => rank(a.day) - rank(b.day));
}

function rank(day: string) {
  const index = WEEK_ORDER.findIndex((name) => name.toLowerCase() === day.toLowerCase());
  return index === -1 ? WEEK_ORDER.length : index;
}

function minutes(value: string) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const mins = Number(match[2]);
  if (hours > 24 || mins > 59) return null;
  return hours * 60 + mins;
}

/** "07:00" → "7 AM", "17:30" → "5:30 PM". Unparseable values pass through. */
export function formatClock(value: string) {
  const total = minutes(value);
  if (total === null) return value;
  const hours = Math.floor(total / 60) % 24;
  const mins = total % 60;
  const suffix = hours < 12 ? "AM" : "PM";
  const display = hours % 12 === 0 ? 12 : hours % 12;
  return mins ? `${display}:${String(mins).padStart(2, "0")} ${suffix}` : `${display} ${suffix}`;
}

export function rowIsOpen(row: HoursRow) {
  return !row.closed && minutes(row.open) !== null && minutes(row.close) !== null;
}

/** Weekday name and minutes since midnight at `now` in the store's time zone. */
export function storeClock(now: Date, timeZone?: string | null) {
  let zone = "UTC";
  if (timeZone) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone }).format(now);
      zone = timeZone;
    } catch {
      // Invalid saved zone: stay on UTC rather than host-local time.
    }
  }
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value || "";
  return { day: part("weekday"), minutes: Number(part("hour")) * 60 + Number(part("minute")) };
}

export function openState(value: unknown, timeZone: string | null | undefined, now = new Date()): OpenState {
  const rows = hoursRows(value);
  if (!rows.length) return { kind: "unknown", label: "Hours not set" };
  const clock = storeClock(now, timeZone);
  const find = (day: string) => rows.find((row) => row.day.toLowerCase() === day.toLowerCase());
  const today = find(clock.day);

  if (today && rowIsOpen(today)) {
    const open = minutes(today.open)!;
    const close = minutes(today.close)!;
    if (clock.minutes >= open && clock.minutes < close) return { kind: "open", label: `Open until ${formatClock(today.close)}` };
    if (clock.minutes < open) return { kind: "closed", label: `Closed · opens ${formatClock(today.open)}` };
  }

  const start = DAYS.findIndex((day) => day.toLowerCase() === clock.day.toLowerCase());
  for (let offset = 1; offset <= 7; offset += 1) {
    const day = DAYS[(start + offset) % 7];
    const row = find(day);
    if (row && rowIsOpen(row)) {
      return { kind: "closed", label: `Closed · opens ${offset === 1 ? "tomorrow" : day.slice(0, 3)} ${formatClock(row.open)}` };
    }
  }
  return { kind: "closed", label: "Closed" };
}
