type StoreTimeZone = { timeZone: string; storeZone: string | null };

function validatedStoreTimeZone(value?: string | null): StoreTimeZone {
  if (typeof value === "string" && value.length > 0) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date(0));
      return { timeZone: value, storeZone: value };
    } catch {
      // Persisted values can bypass the settings form; never fall back to host-local time.
    }
  }
  return { timeZone: "UTC", storeZone: null };
}

function formatInStoreTimeZone(instant: Date, storeTimeZone: StoreTimeZone, options: Intl.DateTimeFormatOptions, zoneName = true) {
  const formatted = new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: storeTimeZone.timeZone,
    timeZoneName: "short",
  }).format(instant);
  return zoneName && storeTimeZone.storeZone && storeTimeZone.storeZone !== "UTC"
    ? `${formatted} (${storeTimeZone.storeZone})`
    : formatted;
}

/** Short zone name at `instant` in the store's time zone ("EDT"), or "" for UTC fallback. */
export function storeZoneAbbreviation(storeTimeZone?: string | null, instant = new Date()) {
  const zone = validatedStoreTimeZone(storeTimeZone);
  if (!zone.storeZone) return "";
  return new Intl.DateTimeFormat("en-US", { timeZone: zone.timeZone, timeZoneName: "short" })
    .formatToParts(instant)
    .find((part) => part.type === "timeZoneName")?.value || "";
}

function storeDayNumber(instant: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone, year: "numeric", month: "numeric", day: "numeric" }).formatToParts(instant);
  const part = (type: string) => Number(parts.find((entry) => entry.type === type)?.value);
  return Date.UTC(part("year"), part("month") - 1, part("day")) / 86_400_000;
}

/** "5:45 PM EDT" today, "Tomorrow 8:15 AM EDT", otherwise "Sat, Oct 24 · 8:15 AM EDT" (store time zone, no IANA name). */
function formatPickupInstant(value: string | null | undefined, storeTimeZone: string | null | undefined, now: Date) {
  if (!value) return "soon";
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return "time unavailable";
  const zone = validatedStoreTimeZone(storeTimeZone);
  const time = formatInStoreTimeZone(instant, zone, { hour: "numeric", minute: "2-digit" }, false);
  const offset = storeDayNumber(instant, zone.timeZone) - storeDayNumber(now, zone.timeZone);
  if (offset === 0) return time;
  if (offset === 1) return `Tomorrow ${time}`;
  const day = new Intl.DateTimeFormat("en-US", { timeZone: zone.timeZone, weekday: "short", month: "short", day: "numeric" }).format(instant);
  return `${day} · ${time}`;
}

export function formatPickupTime(value?: string | null, storeTimeZone?: string | null, now = new Date()) {
  return formatPickupInstant(value, storeTimeZone, now);
}

/** Compact staff-screen variant: short zone only, with a day when the pickup isn't today in the store time zone. */
export function formatStaffPickupTime(value?: string | null, storeTimeZone?: string | null, now = new Date()) {
  return formatPickupInstant(value, storeTimeZone, now);
}

export function formatStoreDateTime(value?: string | null, storeTimeZone?: string | null) {
  if (!value) return "—";
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return "time unavailable";
  return formatInStoreTimeZone(instant, validatedStoreTimeZone(storeTimeZone), {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
