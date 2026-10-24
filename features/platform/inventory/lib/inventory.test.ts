import { test } from "node:test";
import assert from "node:assert/strict";

import { dollarsToCents, parseQuantity, stockState, validateInventoryItemInput } from "./inventory";
import { normalizeWebsite, validateSupplierInput } from "../../suppliers/lib/suppliers";

test("stock state: out at or below zero, low at or below reorder point", () => {
  assert.equal(stockState("0", "5"), "out");
  assert.equal(stockState("-1", "0"), "out");
  assert.equal(stockState("5.0000", "5"), "low");
  assert.equal(stockState("5.5", "5"), "ok");
  assert.equal(stockState("1", "0"), "ok");
});

test("money and quantity parsing", () => {
  assert.equal(dollarsToCents("12.5"), 1250);
  assert.equal(dollarsToCents("$0.07"), 7);
  assert.equal(dollarsToCents("1.234"), null);
  assert.equal(dollarsToCents("-1"), null);
  assert.equal(parseQuantity("2.1234"), "2.1234");
  assert.equal(parseQuantity("2.12345"), null);
});

test("inventory item validation", () => {
  const base = { name: "Oat milk", category: "milk", unit: "gal", reorderPoint: "2", parLevel: "6", costPerUnit: "4.25", supplierName: " Pacific ", sku: "" };
  const ok = validateInventoryItemInput(base);
  assert.deepEqual(ok.data, { name: "Oat milk", category: "milk", unit: "gal", reorderPoint: "2", parLevel: "6", costPerUnit: 425, supplierName: "Pacific", sku: "" });
  const bad = validateInventoryItemInput({ ...base, name: " ", unit: "kg", costPerUnit: "abc" });
  assert.ok(bad.errors?.name && bad.errors.unit && bad.errors.costPerUnit);
});

test("supplier validation", () => {
  const base = { name: "Roaster", status: "active", contactName: "", email: "a@b.co", phone: "+1 (555) 010-2000", website: "roaster.com", leadTimeDays: "3", notes: "" };
  assert.equal(validateSupplierInput(base).data?.website, "https://roaster.com");
  const bad = validateSupplierInput({ ...base, email: "nope", website: "javascript:alert(1)", leadTimeDays: "-1", status: "gone" });
  assert.ok(bad.errors?.email && bad.errors.website && bad.errors.leadTimeDays && bad.errors.status);
  assert.equal(normalizeWebsite("ftp://x.com"), null);
});
