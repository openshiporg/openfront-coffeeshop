export function formatMoney(cents = 0, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

/** Signed price adjustment for a modifier: "+$0.75", "−$0.50", or "Included" for zero. */
export function formatModifierAdjustment(cents?: number | null, currency = "USD") {
  const amount = Number(cents || 0);
  if (!amount) return "Included";
  return `${amount > 0 ? "+" : "−"}${formatMoney(Math.abs(amount), currency)}`;
}

export { formatPickupTime } from "@/lib/date-time";
