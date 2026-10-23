import { fingerprintInput } from "./idempotency";

export const DEFAULT_CAFE_TAX_BASIS_POINTS = 875;
/** Order money is stored and returned as GraphQL/Postgres Int (signed 32-bit). */
export const MAX_CAFE_MONEY_CENTS = 2_147_483_647;

export function normalizeCafeTaxBasisPoints(value: unknown) {
  const basisPoints = Number(value);
  // Hundredths of a basis point are kept so rates like 8.875% (887.5) are exact.
  if (!Number.isFinite(basisPoints) || basisPoints < 0 || basisPoints > 10_000 || Math.abs(Math.round(basisPoints * 100) - basisPoints * 100) > 1e-6) {
    throw new Error("Store tax rate must be between 0 and 10000 basis points, with at most two decimals");
  }
  return basisPoints;
}

/** Rejects (never clamps) any amount the order contract cannot store exactly. */
export function assertCafeMoneyCents(value: number, label: string) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_CAFE_MONEY_CENTS) {
    throw new Error(`${label} is outside the supported order amount range`);
  }
  return value;
}

export function calculateCafeTax(subtotalCents: number, basisPoints = DEFAULT_CAFE_TAX_BASIS_POINTS) {
  if (!Number.isSafeInteger(subtotalCents) || subtotalCents < 0) throw new Error("Subtotal must be a non-negative integer amount in cents");
  return Math.round(subtotalCents * normalizeCafeTaxBasisPoints(basisPoints) / 10_000);
}

export type CafeQuoteLineEvidence = { menuItemId: string; quantity: number; modifierIds: readonly string[]; unitPrice: number };

/** Checked line/subtotal/tax/tip/total arithmetic shared by quote and order creation. */
export function calculateCafeTotals(lines: readonly CafeQuoteLineEvidence[], taxRateBasisPoints: number, tipCents: number) {
  const lineTotals = lines.map((line) => {
    assertCafeMoneyCents(line.unitPrice, "Item price");
    return assertCafeMoneyCents(line.unitPrice * line.quantity, "Line total");
  });
  const subtotal = assertCafeMoneyCents(lineTotals.reduce((sum, value) => sum + value, 0), "Order subtotal");
  const tax = assertCafeMoneyCents(calculateCafeTax(subtotal, taxRateBasisPoints), "Order tax");
  const tip = assertCafeMoneyCents(tipCents, "Tip");
  const total = assertCafeMoneyCents(subtotal + tax + tip, "Order total");
  return { lineTotals, subtotal, tax, tip, total };
}

/** Identity of the exact priced ticket an operator reviewed. Tender is rejected when the
 * effect-time recomputation differs, so a changed price or tax is never charged silently.
 */
export function cafeQuoteFingerprint(input: {
  storeId: string;
  currencyCode: string;
  taxRateBasisPoints: number;
  lines: readonly CafeQuoteLineEvidence[];
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
}) {
  return fingerprintInput({
    kind: "cafe-quote:v1",
    storeId: input.storeId,
    currencyCode: input.currencyCode,
    taxRateBasisPoints: input.taxRateBasisPoints,
    lines: input.lines.map((line) => ({ menuItemId: line.menuItemId, quantity: line.quantity, modifierIds: [...line.modifierIds].sort(), unitPrice: line.unitPrice })),
    subtotal: input.subtotal,
    tax: input.tax,
    tip: input.tip,
    total: input.total,
  });
}
