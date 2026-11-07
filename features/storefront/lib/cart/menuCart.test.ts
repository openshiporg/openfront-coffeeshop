import { test } from "node:test";
import assert from "node:assert/strict";
import type { StorefrontMenuItem, StorefrontModifier } from "../data/menu";
import { defaultModifierIds, modifierGroups, rowModifierLayout, selectionUnitPrice, toggleModifierSelection, unmetModifierGroups } from "./menuCart";

function mod(id: string, group: string, extra: Partial<StorefrontModifier> = {}): StorefrontModifier {
  return { id, name: id, modifierGroup: group, priceAdjustment: 0, required: false, minSelections: 0, maxSelections: 1, defaultSelected: false, inStock: true, ...extra } as StorefrontModifier;
}
function item(modifiers: StorefrontModifier[], price = 550): StorefrontMenuItem {
  return { id: "i", name: "Oat Latte", price, modifiers } as unknown as StorefrontMenuItem;
}

const oatLatte = item([
  mod("shot0", "aaa-addon", { priceAdjustment: 50, inStock: false }),
  mod("16oz", "size", { required: true, minSelections: 1, priceAdjustment: 75 }),
  mod("12oz", "size", { required: true, minSelections: 1, defaultSelected: true }),
  mod("shot", "espresso", { priceAdjustment: 100 }),
]);

test("a required one-of swaps but can't be cleared; an add-on toggles", () => {
  const groups = modifierGroups(oatLatte);
  const size = groups.find((g) => g.key === "size")!;
  const espresso = groups.find((g) => g.key === "espresso")!;
  let selected = defaultModifierIds(oatLatte);
  assert.deepEqual(selected, ["12oz"]);
  selected = toggleModifierSelection(selected, "16oz", size);
  assert.deepEqual(selected, ["16oz"]);
  assert.deepEqual(toggleModifierSelection(selected, "16oz", size), ["16oz"]);
  selected = toggleModifierSelection(selected, "shot", espresso);
  assert.deepEqual(selected.sort(), ["16oz", "shot"]);
  assert.deepEqual(toggleModifierSelection(selected, "shot", espresso), ["16oz"]);
});

test("price follows the selection", () => {
  assert.equal(selectionUnitPrice(oatLatte, ["12oz"]), 550);
  assert.equal(selectionUnitPrice(oatLatte, ["16oz", "shot"]), 725);
});

test("a required choice with no default is unmet until picked", () => {
  const beans = item([mod("drip", "grind", { required: true, minSelections: 1 }), mod("whole", "grind", { required: true, minSelections: 1 })]);
  assert.deepEqual(unmetModifierGroups(beans, []).map((g) => g.key), ["grind"]);
  assert.deepEqual(unmetModifierGroups(beans, ["drip"]), []);
});

test("rows show the standard first, skip single-option required groups, and send the rest to More options", () => {
  const layout = rowModifierLayout(oatLatte);
  assert.deepEqual(layout.inline.map((g) => g.modifiers.map((m) => m.id)), [["12oz", "16oz"], ["shot"]]);
  const addOnFirst = item([mod("shot", "espresso"), mod("whole", "milk", { required: true, minSelections: 1, defaultSelected: true }), mod("oat", "milk", { required: true, minSelections: 1 })]);
  assert.deepEqual(rowModifierLayout(addOnFirst).inline.map((g) => g.key), ["milk", "espresso"]);
  assert.equal(layout.more, false);
  const busy = item([
    mod("one", "size", { required: true, minSelections: 1, defaultSelected: true }),
    mod("whole", "milk", { defaultSelected: true, required: true, minSelections: 1 }), mod("oat", "milk", { required: true, minSelections: 1 }),
    mod("shot", "espresso"), mod("vanilla", "syrup"),
  ]);
  const busyLayout = rowModifierLayout(busy);
  assert.deepEqual(busyLayout.inline.map((g) => g.key), ["milk", "espresso"]);
  assert.equal(busyLayout.more, true);
});
