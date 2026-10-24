import assert from "node:assert/strict";
import test from "node:test";
import { consumeActiveInventoryLots, planStockCount, stockDecimal, stockUnits, trimLotsToStock } from "./inventoryLots";

function lotClient(lots: Array<{ id: string; quantityRemaining: string; status?: string }>) {
  const updates: Array<{ id: string; quantityRemaining: string }> = [];
  return {
    updates,
    tx: {
      inventoryLot: {
        findMany: async () => lots,
        update: async (args: Record<string, unknown>) => {
          const where = args.where as { id: string };
          const data = args.data as { quantityRemaining: string };
          updates.push({ id: where.id, quantityRemaining: data.quantityRemaining });
        },
      },
    },
  };
}

test("planStockCount returns the signed adjustment from the counter", () => {
  assert.deepEqual(planStockCount("12.5000", stockUnits(10, "Counted")), { previousUnits: 125_000, deltaUnits: -25_000 });
  assert.deepEqual(planStockCount("3.0000", stockUnits(5, "Counted")), { previousUnits: 30_000, deltaUnits: 20_000 });
  assert.equal(planStockCount("4.0000", stockUnits(4, "Counted")).deltaUnits, 0);
});

test("a zero count is allowed only when asked for, and each units stay whole", () => {
  assert.equal(stockUnits(0, "Counted", { allowZero: true }), 0);
  assert.throws(() => stockUnits(0, "Counted"), /greater than zero/);
  assert.throws(() => stockUnits(1.5, "Counted", { allowZero: true, unit: "each" }), /whole number/);
  assert.equal(stockDecimal(-25_000), "-2.5000");
});

test("a count shortfall draws from lots first, then untracked stock", async () => {
  const { tx, updates } = lotClient([{ id: "lot-a", quantityRemaining: "2.0000", status: "quarantined" }]);
  const result = await consumeActiveInventoryLots(tx, "item", 3, { openingStock: "5.0000", waste: true });
  assert.deepEqual(result.allocations, [{ inventoryLotId: "lot-a", quantity: 2 }]);
  assert.equal(result.untrackedQuantity, 1);
  assert.deepEqual(updates, [{ id: "lot-a", quantityRemaining: "0.0000" }]);
});

test("a count first trims lots that exceed the counter, oldest first", async () => {
  const { tx, updates } = lotClient([{ id: "old", quantityRemaining: "3.0000" }, { id: "new", quantityRemaining: "4.0000" }]);
  const trimmed = await trimLotsToStock(tx, "item", "5.0000");
  assert.deepEqual(trimmed, [{ inventoryLotId: "old", quantity: 2 }]);
  assert.deepEqual(updates, [{ id: "old", quantityRemaining: "1.0000" }]);
  const { tx: clean } = lotClient([{ id: "a", quantityRemaining: "2.0000" }]);
  assert.deepEqual(await trimLotsToStock(clean, "item", "5.0000"), []);
});
