import { STOCK_SCALE, consumeActiveInventoryLots } from "./inventoryLots";

type ConsumptionLine = { menuItemId: string; quantity: number; fallbackInventoryItemId?: string | null; modifierIds?: string[] };
type Reader = { findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>> };
type ConsumptionClient = {
  recipe: Reader;
  menuItemModifier: Reader;
  inventoryItem: Reader & { findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>; update(args: Record<string, unknown>): Promise<unknown> };
  inventoryLot: { findMany(args: Record<string, unknown>): Promise<Array<{ id: string; quantityRemaining: unknown }>>; update(args: Record<string, unknown>): Promise<unknown> };
  stockMovement: { create(args: Record<string, unknown>): Promise<unknown> };
  prepBatch: Reader & { findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>; update(args: Record<string, unknown>): Promise<unknown> };
  prepBatchConsumption: { create(args: Record<string, unknown>): Promise<unknown> };
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
};
export type InventoryRequirement = { kind: "inventory"; inventoryItemId: string; quantity: number } | { kind: "prep"; prepBatchId: string; quantity: number };
function positive(value: unknown) { const parsed = Number(value); return Number.isFinite(parsed) && parsed > 0 ? parsed : 0; }
function rounded(value: number) { return Math.ceil((value - 1e-9) * 10_000) / 10_000; }
const COUNTED_OUTPUT_UNITS = new Set(["serving", "each"]);
function countedOutput(unit: unknown) { return COUNTED_OUTPUT_UNITS.has(String(unit || "serving")); }
function batchOutputCounted(batch: Record<string, unknown>) {
  const metadata = batch.metadata && typeof batch.metadata === "object" ? batch.metadata as Record<string, unknown> : {};
  return typeof metadata.outputUnit !== "string" || countedOutput(metadata.outputUnit);
}

export async function getCafeInventoryRequirements(tx: ConsumptionClient, storeId: string, lines: ConsumptionLine[]): Promise<InventoryRequirement[]> {
  const menuItemIds = [...new Set(lines.map((line) => line.menuItemId))];
  const modifierIds = [...new Set(lines.flatMap((line) => line.modifierIds || []))];
  const [recipes, modifiers] = await Promise.all([
    tx.recipe.findMany({ where: { storeId, menuItemId: { in: menuItemIds }, status: "active", active: true }, select: { id: true, menuItemId: true, yieldQuantity: true, yieldUnit: true, from_Ingredient_recipe: { select: { quantity: true, unit: true, optional: true, inventoryItem: { select: { id: true, storeId: true, unit: true } } } } } }),
    modifierIds.length ? tx.menuItemModifier.findMany({ where: { storeId, id: { in: modifierIds } }, select: { id: true, menuItemId: true, name: true, inventoryAction: true, inventoryQuantity: true, replacesInventoryItemId: true, inventoryItem: { select: { id: true, storeId: true, unit: true } } } }) : Promise.resolve([]),
  ]);
  const recipesByItem = new Map<string, Record<string, unknown>>();
  for (const recipe of recipes) {
    if (recipesByItem.has(String(recipe.menuItemId))) throw new Error("Menu item has multiple active recipes; review recipe versions before selling");
    recipesByItem.set(String(recipe.menuItemId), recipe);
  }
  const modifiersById = new Map(modifiers.map((modifier) => [String(modifier.id), modifier]));
  const batches = recipes.length ? await tx.prepBatch.findMany({ where: { storeId, recipeId: { in: recipes.map((recipe) => String(recipe.id)) }, status: "completed", quantityRemaining: { gt: 0 }, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] }, orderBy: [{ completedAt: "asc" }, { id: "asc" }], select: { id: true, recipeId: true, quantityRemaining: true, metadata: true } }) : [];
  const prepRemaining = new Map(batches.map((batch) => [String(batch.id), positive(batch.quantityRemaining)]));
  const prep = new Map<string, number>();
  const inventory = new Map<string, number>();
  const add = (id: string, quantity: number) => inventory.set(id, (inventory.get(id) || 0) + quantity);
  for (const line of lines) {
    if (!positive(line.quantity)) throw new Error("Order inventory quantity is invalid");
    const selected = (line.modifierIds || []).map((id) => {
      const modifier = modifiersById.get(id);
      if (!modifier || modifier.menuItemId !== line.menuItemId || !["none", "add", "substitute"].includes(String(modifier.inventoryAction))) throw new Error("Selected modifier inventory needs review in Menu management");
      return modifier;
    });
    const adjustments = selected.filter((modifier) => modifier.inventoryAction !== "none");
    const recipe = recipesByItem.get(line.menuItemId);
    if (!recipe) {
      if (adjustments.some((modifier) => modifier.inventoryAction === "substitute")) throw new Error("Substitution requires a reviewed base recipe");
      if (line.fallbackInventoryItemId) add(line.fallbackInventoryItemId, line.quantity);
    } else {
      const yieldQuantity = positive(recipe.yieldQuantity);
      const ingredients = (recipe.from_Ingredient_recipe || []) as Array<Record<string, unknown>>;
      if (!yieldQuantity || !ingredients.length) throw new Error("Recipe requires positive yield and inventory-backed ingredients");
      for (const ingredient of ingredients) {
        if (ingredient.optional) continue;
        const source = ingredient.inventoryItem as Record<string, unknown> | null;
        if (!source?.id || source.storeId !== storeId || ingredient.unit !== source.unit || !positive(ingredient.quantity)) throw new Error("Recipe ingredient quantity, unit or store is invalid");
      }
      let direct = line.quantity;
      // Base prepared food is not compatible with arbitrary ingredient substitutions, and only
      // counted outputs (servings/items) map one batch unit to one sold item.
      if (!adjustments.length && countedOutput(recipe.yieldUnit)) for (const batch of batches.filter((candidate) => candidate.recipeId === recipe.id && batchOutputCounted(candidate))) {
        const id = String(batch.id);
        const used = Math.min(prepRemaining.get(id) || 0, direct);
        if (used > 0) { prep.set(id, (prep.get(id) || 0) + used); prepRemaining.set(id, (prepRemaining.get(id) || 0) - used); direct -= used; }
        if (direct <= 0) break;
      }
      const substitutions = adjustments.filter((modifier) => modifier.inventoryAction === "substitute");
      if (new Set(substitutions.map((modifier) => modifier.replacesInventoryItemId)).size !== substitutions.length) throw new Error("Conflicting ingredient substitutions");
      for (const modifier of substitutions) if (!ingredients.some((ingredient) => !ingredient.optional && (ingredient.inventoryItem as Record<string, unknown> | null)?.id === modifier.replacesInventoryItemId)) throw new Error("Substitution source is not a required ingredient in this recipe");
      for (const ingredient of ingredients) {
        if (ingredient.optional) continue;
        const source = ingredient.inventoryItem as Record<string, unknown>;
        const replacement = substitutions.find((modifier) => modifier.replacesInventoryItemId === source.id);
        const target = replacement ? replacement.inventoryItem as Record<string, unknown> | null : source;
        if (!target?.id || target.storeId !== storeId || target.unit !== source.unit) throw new Error("Substitution must use same-store inventory in the exact ingredient unit");
        if (direct > 0) add(String(target.id), Number(ingredient.quantity) / yieldQuantity * direct);
      }
    }
    for (const modifier of adjustments.filter((candidate) => candidate.inventoryAction === "add")) {
      const target = modifier.inventoryItem as Record<string, unknown> | null;
      if (!target?.id || target.storeId !== storeId || !positive(modifier.inventoryQuantity)) throw new Error("Add-on requires a positive inventory quantity in its base unit");
      add(String(target.id), Number(modifier.inventoryQuantity) * line.quantity);
    }
  }
  return [
    ...[...prep].map(([prepBatchId, quantity]): InventoryRequirement => ({ kind: "prep", prepBatchId, quantity: rounded(quantity) })),
    ...[...inventory].map(([inventoryItemId, quantity]): InventoryRequirement => ({ kind: "inventory", inventoryItemId, quantity: rounded(quantity) })),
  ].sort((left, right) => `${left.kind}:${left.kind === "prep" ? left.prepBatchId : left.inventoryItemId}`.localeCompare(`${right.kind}:${right.kind === "prep" ? right.prepBatchId : right.inventoryItemId}`));
}

export async function consumeCafeInventoryRequirements(tx: ConsumptionClient, input: { storeId: string; orderId: string; orderNumber: string; requirements: InventoryRequirement[]; createdById?: string | null; reason: string }) {
  for (const requirement of input.requirements) {
    if (requirement.kind === "prep") {
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-prep-batch:${requirement.prepBatchId}`);
      const batch = await tx.prepBatch.findUnique({ where: { id: requirement.prepBatchId }, select: { id: true, storeId: true, status: true, quantityRemaining: true, expiresAt: true } });
      if (!batch || batch.storeId !== input.storeId || batch.status !== "completed" || (batch.expiresAt && new Date(String(batch.expiresAt)).getTime() <= Date.now()) || positive(batch.quantityRemaining) < requirement.quantity) throw new Error("A prepared batch in this order is expired or has insufficient quantity");
      await tx.prepBatch.update({ where: { id: requirement.prepBatchId }, data: { quantityRemaining: { decrement: requirement.quantity } } });
      await tx.prepBatchConsumption.create({ data: { idempotencyKey: `${input.orderId}:${requirement.prepBatchId}`, storeId: input.storeId, orderId: input.orderId, prepBatchId: requirement.prepBatchId, quantity: requirement.quantity } });
    } else {
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-inventory:${requirement.inventoryItemId}`);
      const item = await tx.inventoryItem.findUnique({ where: { id: requirement.inventoryItemId }, select: { id: true, storeId: true, currentStock: true, unit: true, name: true } });
      if (!item || item.storeId !== input.storeId || positive(item.currentStock) < requirement.quantity) throw new Error("Insufficient inventory for this order");
      // Counted items are sold whole: same whole-number rule as receiving, prep and waste.
      if (String(item.unit || "each") === "each" && Math.round(requirement.quantity * STOCK_SCALE) % STOCK_SCALE !== 0) {
        throw new Error(`This order would use a fraction of ${String(item.name || "a counted item")}; review the recipe or add-on quantity in Menu management`);
      }
      const lots = await consumeActiveInventoryLots(tx, requirement.inventoryItemId, requirement.quantity, { openingStock: Number(item.currentStock) });
      await tx.inventoryItem.update({ where: { id: requirement.inventoryItemId }, data: { currentStock: { decrement: requirement.quantity } } });
      const allocations = [...lots.allocations, ...(lots.untrackedQuantity > 1e-8 ? [{ inventoryLotId: null, quantity: lots.untrackedQuantity }] : [])];
      for (const allocation of allocations) await tx.stockMovement.create({ data: { idempotencyKey: `order:${input.orderId}:${requirement.inventoryItemId}:${allocation.inventoryLotId || "unlotted"}`, inventoryItemId: requirement.inventoryItemId, inventoryLotId: allocation.inventoryLotId, storeId: input.storeId, orderId: input.orderId, type: "sale", quantity: -allocation.quantity, reason: input.reason, notes: "Reviewed recipe/modifier allocation; no inferred historical lot assignments", createdById: input.createdById || null } });
    }
  }
}
