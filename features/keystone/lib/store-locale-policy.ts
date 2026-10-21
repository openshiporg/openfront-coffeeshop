/** The supervised cafe pilot has a two-decimal USD/en-US ledger.
 * Other currencies/locales require an explicit reviewed expansion, not a label swap.
 */
export const COFFEE_CURRENCY_CODE_PATTERN = /^USD$/;

export function isSupportedCoffeeCurrencyCode(value: unknown): value is "USD" {
  return value === "USD";
}

export function validCoffeeTimezone(timezone: string) {
  try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date()); return Boolean(timezone); }
  catch { return false; }
}
export function assertCoffeeStoreLocale(input: { currencyCode?: unknown; locale?: unknown; timezone?: unknown }) {
  if (!isSupportedCoffeeCurrencyCode(input.currencyCode) || input.locale !== "en-US") throw new Error("This cafe pilot supports USD and en-US only");
  if (typeof input.timezone !== "string" || !validCoffeeTimezone(input.timezone)) throw new Error("Enter a valid IANA store timezone");
}
