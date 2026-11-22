import assert from "node:assert/strict";
import test from "node:test";

import { cafeQuoteFingerprint, calculateCafeTotals, drinkCreditDiscount } from "./coffeePricing";

const lines = [
  { menuItemId: "latte", quantity: 2, modifierIds: [], unitPrice: 525, barStation: "espresso_bar" },
  { menuItemId: "croissant", quantity: 1, modifierIds: [], unitPrice: 450, barStation: "pastry_case" },
];

test("a drink credit takes the dearest single drink off, never a pastry", () => {
  assert.equal(drinkCreditDiscount(lines), 525);
  assert.equal(drinkCreditDiscount([lines[1]]), 0);
});

test("discount comes off before tax and total keeps the CafeOrder_total_sum_check shape", () => {
  const t = calculateCafeTotals(lines, 875, 100, 525);
  assert.equal(t.subtotal, 1500);
  assert.equal(t.discount, 525);
  assert.equal(t.tax, Math.round(975 * 875 / 10_000));
  assert.equal(t.total, t.subtotal + t.tax + t.tip - t.discount);
  assert.throws(() => calculateCafeTotals(lines, 875, 0, 1501));
});

test("a free single drink owes nothing", () => {
  const t = calculateCafeTotals([lines[0]].map((line) => ({ ...line, quantity: 1 })), 875, 0, 525);
  assert.equal(t.total, 0);
});

test("fingerprint is unchanged without a discount and differs with one", () => {
  const base = { storeId: "s", currencyCode: "USD", taxRateBasisPoints: 875, lines, subtotal: 1500, tax: 131, tip: 0, total: 1631 };
  assert.equal(cafeQuoteFingerprint(base), cafeQuoteFingerprint({ ...base, discount: 0 }));
  assert.notEqual(cafeQuoteFingerprint(base), cafeQuoteFingerprint({ ...base, discount: 525 }));
});
