import assert from "node:assert/strict";
import test from "node:test";
import { costPerYieldCents, quantityError, servingsFromStock, validationMessages } from "./recipeMath";

test("cost per yield unit sums required lines and divides by yield", () => {
  const lines = [
    { quantity: "18", costPerUnit: 2, inventoryItemId: "beans" },
    { quantity: "200", costPerUnit: 1, inventoryItemId: "milk" },
    { quantity: "10", costPerUnit: 100, optional: true, inventoryItemId: "syrup" },
  ];
  assert.equal(costPerYieldCents(lines, "2"), 118);
  assert.equal(costPerYieldCents([{ quantity: "1", costPerUnit: null }], "1"), null);
  assert.equal(costPerYieldCents([], "1"), null);
});

test("servings from stock takes the minimum over required ingredients", () => {
  const lines = [
    { quantity: "18", inventoryItemId: "beans", currentStock: "100" },
    { quantity: "200", inventoryItemId: "milk", currentStock: "1000" },
    { quantity: "5", inventoryItemId: "syrup", currentStock: "0", optional: true },
  ];
  assert.equal(servingsFromStock(lines, "1"), 5);
  assert.equal(servingsFromStock(lines, "2"), 10);
  assert.equal(servingsFromStock([{ quantity: "1", inventoryItemId: "a", currentStock: "-3" }], "1"), 0);
  // Duplicate lines for one inventory item add up.
  assert.equal(servingsFromStock([{ quantity: "5", inventoryItemId: "a", currentStock: "20" }, { quantity: "5", inventoryItemId: "a", currentStock: "20" }], "1"), 2);
});

test("quantity validation mirrors the Keystone hooks", () => {
  assert.equal(quantityError("1", "Yield"), null);
  assert.equal(quantityError("0.0001", "Yield"), null);
  assert.ok(quantityError("0", "Yield"));
  assert.ok(quantityError("1.00001", "Yield"));
  assert.ok(quantityError("abc", "Yield"));
  assert.ok(quantityError("1.5", "Quantity", "each"));
  assert.equal(quantityError("2", "Quantity", "each"), null);
});

test("validation messages drop the Keystone list prefix", () => {
  const message = "You provided invalid data for this operation.\n  - Ingredient: Ingredient unit must match its inventory item's unit (g)\n  - Ingredient.name: Name must not be empty";
  assert.deepEqual(validationMessages(message), ["Ingredient unit must match its inventory item's unit (g)", "Name must not be empty"]);
});
