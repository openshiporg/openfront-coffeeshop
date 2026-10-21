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

function formatInStoreTimeZone(instant: Date, storeTimeZone: StoreTimeZone, options: Intl.DateTimeFormatOptions) {
  const formatted = new Intl.DateTimeFormat("en-US", {
    ...options,
    timeZone: storeTimeZone.timeZone,
    timeZoneName: "short",
  }).format(instant);
  return storeTimeZone.storeZone && storeTimeZone.storeZone !== "UTC"
    ? `${formatted} (${storeTimeZone.storeZone})`
    : formatted;
}

export function formatPickupTime(value?: string | null, storeTimeZone?: string | null) {
  if (!value) return "soon";
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) return "time unavailable";
  return formatInStoreTimeZone(instant, validatedStoreTimeZone(storeTimeZone), {
    hour: "numeric",
    minute: "2-digit",
  });
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
