// Pure helpers for the catering inquiry: store-local wall time <-> instants, and the
// client-side checks that mirror requestCafeCatering (features/keystone/mutations/coffeeCoverageCommands.ts).

export const CATERING_LEAD_HOURS = 24;
export const CATERING_HORIZON_DAYS = 365;
export const CATERING_MAX_GUESTS = 1000;

export const CATERING_STATUS_LABELS: Record<string, string> = {
  inquiry: "Requested",
  quoted: "Quoted",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

export function cateringStatusDot(status: string) {
  if (status === "confirmed") return "sf-dot-ready";
  if (status === "completed") return "sf-dot-done";
  if (status === "cancelled") return "sf-dot-cancelled";
  return "sf-dot-active";
}

/** A usable IANA zone, or UTC when the saved value is missing or invalid (never host-local time). */
export function cateringTimeZone(value?: string | null) {
  if (value) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
      return value;
    } catch {
      // fall through
    }
  }
  return "UTC";
}

function wallParts(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit",
  }).formatToParts(instant);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value || "00";
  return { year: part("year"), month: part("month"), day: part("day"), hour: part("hour"), minute: part("minute") };
}

/** "YYYY-MM-DDTHH:mm" as the wall clock shows it in the zone (the datetime-local format). */
export function toStoreLocalInput(instant: Date, timeZone: string) {
  const p = wallParts(instant, cateringTimeZone(timeZone));
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

function zoneOffsetMs(instant: number, timeZone: string) {
  const p = wallParts(new Date(instant), timeZone);
  const asUtc = Date.UTC(Number(p.year), Number(p.month) - 1, Number(p.day), Number(p.hour), Number(p.minute));
  return asUtc - Math.floor(instant / 60_000) * 60_000;
}

/** A datetime-local value read as store-local time, as an instant. Null when malformed or the
 *  wall time doesn't exist in the zone (the spring-forward gap). */
export function storeLocalInputToInstant(value: string, timeZone: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const zone = cateringTimeZone(timeZone);
  const [, y, mo, d, h, mi] = match.map(Number);
  const wall = Date.UTC(y, mo - 1, d, h, mi);
  if (!Number.isFinite(wall)) return null;
  let instant = wall - zoneOffsetMs(wall, zone);
  const corrected = wall - zoneOffsetMs(instant, zone);
  if (corrected !== instant) instant = corrected;
  const result = new Date(instant);
  return toStoreLocalInput(result, zone) === value.trim() ? result : null;
}

export type CateringDraft = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  eventLocal: string;
  guestCount: string;
  deliveryAddress: string;
  notes: string;
};

export type CateringFieldErrors = Partial<Record<keyof CateringDraft, string>>;

/** Field errors matching the server's rules, plus the event instant when valid. */
export function validateCateringDraft(draft: CateringDraft, timeZone: string, now = new Date()) {
  const errors: CateringFieldErrors = {};
  const name = draft.customerName.trim();
  if (!name) errors.customerName = "Enter your name";
  else if (name.length > 200) errors.customerName = "Up to 200 characters";
  const email = draft.customerEmail.trim();
  if (!email || email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.customerEmail = "Enter a valid email";
  if (draft.customerPhone.trim().length > 50) errors.customerPhone = "Up to 50 characters";
  let eventAt: Date | null = null;
  if (!draft.eventLocal.trim()) errors.eventLocal = "Choose the event date and time";
  else {
    eventAt = storeLocalInputToInstant(draft.eventLocal, timeZone);
    if (!eventAt) errors.eventLocal = "Choose a different time";
    else if (eventAt.getTime() < now.getTime() + CATERING_LEAD_HOURS * 3_600_000) errors.eventLocal = "Catering needs at least 24 hours' notice";
    else if (eventAt.getTime() > now.getTime() + CATERING_HORIZON_DAYS * 86_400_000) errors.eventLocal = "Choose a date within the next year";
  }
  const guests = Number(draft.guestCount);
  if (!draft.guestCount.trim() || !Number.isInteger(guests)) errors.guestCount = "Guests must be a whole number";
  else if (guests < 1) errors.guestCount = "Enter at least 1 guest";
  else if (guests > CATERING_MAX_GUESTS) errors.guestCount = "For more than 1000 guests, contact the cafe";
  if (draft.deliveryAddress.trim().length > 500) errors.deliveryAddress = "Up to 500 characters";
  if (draft.notes.trim().length > 2000) errors.notes = "Up to 2000 characters";
  return { errors, eventAt: Object.keys(errors).length ? null : eventAt, guests };
}

/** "Sat, Oct 24, 2026 · 6:00 PM EDT" in the store's zone. */
export function formatCateringEventTime(value?: string | null, timeZone?: string | null) {
  if (!value) return "—";
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return "—";
  const zone = cateringTimeZone(timeZone);
  const day = new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "short", month: "short", day: "numeric", year: "numeric" }).format(instant);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: zone, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(instant);
  return `${day} · ${time}`;
}
