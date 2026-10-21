export type MoneyParse = { kind: "empty" } | { kind: "invalid"; message: string } | { kind: "valid"; cents: number };

const MAX_REGISTER_CENTS = 100_000_000;

/** Strict decimal dollars to integer cents. Never coerces bad input to zero. */
export function parseMoneyInput(value: string, options: { allowZero?: boolean } = {}): MoneyParse {
  const text = value.trim().replace(/^\$/, "").replace(/,/g, "");
  if (!text) return { kind: "empty" };
  const match = /^(\d{1,9})(?:\.(\d{0,2}))?$/.exec(text) || /^()\.(\d{1,2})$/.exec(text);
  if (!match) return { kind: "invalid", message: "Enter an amount like 12.50 (no negatives, at most 2 decimals)" };
  const cents = Number(match[1] || "0") * 100 + Number((match[2] || "").padEnd(2, "0"));
  if (!Number.isSafeInteger(cents) || cents > MAX_REGISTER_CENTS) return { kind: "invalid", message: "Amount is too large" };
  if (cents === 0 && options.allowZero === false) return { kind: "invalid", message: "Amount must be greater than zero" };
  return { kind: "valid", cents };
}

export function formatMoney(cents = 0, currencyCode = "USD") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currencyCode || "USD" }).format(cents / 100);
  } catch {
    return `$${(cents / 100).toFixed(2)}`;
  }
}
