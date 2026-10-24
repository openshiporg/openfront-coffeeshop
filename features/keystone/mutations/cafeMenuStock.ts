type Reader = { findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>> };
type StockClient = { recipe: Reader; inventoryItem: Reader; prepBatch: Reader };

export type MenuStockModifier = {
  id: string;
  defaultSelected?: boolean | null;
  inventoryAction?: string | null;
  inventoryQuantity?: unknown;
  inventoryItemId?: string | null;
  replacesInventoryItemId?: string | null;
};
export type MenuStockItem = { id: string; inventoryItemId?: string | null; modifiers: MenuStockModifier[] };

/** Prisma selections the stock read needs on a menu item and its modifiers. */
export const MENU_STOCK_ITEM_SELECT = { inventoryItemId: true } as const;
export const MENU_STOCK_MODIFIER_SELECT = { inventoryAction: true, inventoryQuantity: true, inventoryItemId: true, replacesInventoryItemId: true } as const;

function positive(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

/** Display-time read of what one serving needs against current stock, so the menu can say
 *  "Sold out" before a customer taps. Quotes and order creation still check stock themselves. */
export async function cafeMenuStock(client: StockClient, storeId: string, items: MenuStockItem[]) {
  const soldOut = new Set<string>();
  const modifiersOut = new Set<string>();
  // Whole servings the base recipe (or sold-whole item) can still make; absent when not limited by tracked stock.
  const servings = new Map<string, number>();
  if (!items.length) return { soldOut, modifiersOut, servings };
  const recipes = await client.recipe.findMany({
    where: { storeId, menuItemId: { in: items.map((item) => item.id) }, status: "active", active: true },
    select: { id: true, menuItemId: true, yieldQuantity: true, from_Ingredient_recipe: { select: { quantity: true, optional: true, inventoryItemId: true } } },
  });
  const recipeByItem = new Map(recipes.map((recipe) => [String(recipe.menuItemId), recipe]));
  const inventoryIds = new Set<string>();
  for (const item of items) {
    if (item.inventoryItemId) inventoryIds.add(item.inventoryItemId);
    for (const modifier of item.modifiers) if (modifier.inventoryItemId) inventoryIds.add(modifier.inventoryItemId);
  }
  for (const recipe of recipes) {
    for (const ingredient of (recipe.from_Ingredient_recipe || []) as Array<Record<string, unknown>>) {
      if (typeof ingredient.inventoryItemId === "string") inventoryIds.add(ingredient.inventoryItemId);
    }
  }
  const [stockRows, batches] = await Promise.all([
    inventoryIds.size ? client.inventoryItem.findMany({ where: { storeId, id: { in: [...inventoryIds] } }, select: { id: true, currentStock: true } }) : Promise.resolve([]),
    recipes.length ? client.prepBatch.findMany({ where: { storeId, recipeId: { in: recipes.map((recipe) => String(recipe.id)) }, status: "completed", quantityRemaining: { gt: 0 }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, select: { recipeId: true } }) : Promise.resolve([]),
  ]);
  const stock = new Map(stockRows.map((row) => [String(row.id), Number(row.currentStock)]));
  const prepared = new Set(batches.map((batch) => String(batch.recipeId)));
  const covers = (inventoryItemId: string, quantity: number) => (stock.get(inventoryItemId) ?? 0) >= quantity - 1e-9;

  for (const item of items) {
    const recipe = recipeByItem.get(item.id);
    const needs = new Map<string, number>();
    if (!recipe) {
      if (item.inventoryItemId) needs.set(item.inventoryItemId, 1);
    } else {
      const yieldQuantity = positive(recipe.yieldQuantity) || 1;
      for (const ingredient of (recipe.from_Ingredient_recipe || []) as Array<Record<string, unknown>>) {
        if (ingredient.optional || typeof ingredient.inventoryItemId !== "string") continue;
        needs.set(ingredient.inventoryItemId, (needs.get(ingredient.inventoryItemId) || 0) + positive(ingredient.quantity) / yieldQuantity);
      }
    }
    for (const modifier of item.modifiers) {
      if (modifier.inventoryAction === "add" && modifier.inventoryItemId && !covers(modifier.inventoryItemId, positive(modifier.inventoryQuantity))) modifiersOut.add(modifier.id);
      if (modifier.inventoryAction === "substitute" && modifier.inventoryItemId && modifier.replacesInventoryItemId) {
        const replaced = needs.get(modifier.replacesInventoryItemId);
        if (replaced !== undefined && !covers(modifier.inventoryItemId, replaced)) modifiersOut.add(modifier.id);
      }
    }
    if (recipe && prepared.has(String(recipe.id))) continue;
    let most = Infinity;
    for (const [inventoryItemId, quantity] of needs) {
      // An ingredient an option can substitute (whole for oat milk) doesn't cap the item on its own.
      if (item.modifiers.some((modifier) => modifier.inventoryAction === "substitute" && modifier.replacesInventoryItemId === inventoryItemId)) continue;
      if (quantity > 0) most = Math.min(most, Math.floor(((stock.get(inventoryItemId) ?? 0) + 1e-9) / quantity));
    }
    if (Number.isFinite(most)) servings.set(item.id, Math.max(0, most));
    for (const [inventoryItemId, quantity] of needs) {
      if (covers(inventoryItemId, quantity)) continue;
      // An in-stock substitute (oat for whole milk) keeps the item orderable.
      const substitute = item.modifiers.some((modifier) => modifier.inventoryAction === "substitute" && modifier.replacesInventoryItemId === inventoryItemId && !modifiersOut.has(modifier.id));
      if (!substitute) {
        soldOut.add(item.id);
        break;
      }
    }
  }
  return { soldOut, modifiersOut, servings };
}
