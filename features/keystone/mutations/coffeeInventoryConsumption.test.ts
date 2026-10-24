import assert from "node:assert/strict";
import test from "node:test";
import { shortStockMessage } from "./coffeeInventoryConsumption";

test("short-stock refusal names what is left", () => {
  assert.equal(shortStockMessage({ name: "Almond Croissant", unit: "each", currentStock: "19" }), "Only 19 Almond Croissant left");
  assert.equal(shortStockMessage({ name: "Whole Milk", unit: "gal", currentStock: "0.4567" }), "Only 0.45 gal of Whole Milk left");
  assert.equal(shortStockMessage({ name: "Oat Milk", unit: "gal", currentStock: "0" }), "Oat Milk is out of stock");
});
