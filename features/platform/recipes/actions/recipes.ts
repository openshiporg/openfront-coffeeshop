'use server';

import { revalidatePath } from "next/cache";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { quantityError } from "../lib/recipeMath";
import { recipeRequest } from "../lib/recipeRequest";
import {
  statusUpdate,
  type IngredientFormInput,
  type InventoryOption,
  type MenuItemOption,
  type RecipeActionResult,
  type RecipeFormInput,
  type RecipeStatus,
} from "../lib/recipeTypes";

const INVENTORY_FIELDS = "id name unit currentStock costPerUnit";

function revalidateRecipe(id?: string | null) {
  revalidatePath("/dashboard/platform/recipes");
  if (id) revalidatePath(`/dashboard/platform/recipes/${id}`);
}

function text(value: unknown, max = 5000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length < 200;
}

export async function searchMenuItemsAction(search: string): Promise<MenuItemOption[]> {
  const term = text(search, 100);
  const response = await keystoneClient<{ menuItems: MenuItemOption[] }>(
    `query RecipeMenuItemOptions($where: MenuItemWhereInput!) { menuItems(where: $where, orderBy: [{ name: asc }], take: 20) { id name } }`,
    { where: term ? { name: { contains: term, mode: "insensitive" } } : {} },
    { cache: "no-store" },
  );
  return response.success ? response.data.menuItems : [];
}

export async function searchInventoryItemsAction(search: string): Promise<InventoryOption[]> {
  const term = text(search, 100);
  const response = await keystoneClient<{ inventoryItems: InventoryOption[] }>(
    `query RecipeInventoryOptions($where: InventoryItemWhereInput!) { inventoryItems(where: $where, orderBy: [{ name: asc }], take: 20) { ${INVENTORY_FIELDS} } }`,
    { where: term ? { OR: [{ name: { contains: term, mode: "insensitive" } }, { sku: { contains: term, mode: "insensitive" } }] } : {} },
    { cache: "no-store" },
  );
  return response.success ? response.data.inventoryItems : [];
}

function recipeFieldErrors(input: RecipeFormInput): string | null {
  if (!text(input.name, 200)) return "Name is required";
  const yieldUnit = text(input.yieldUnit, 100);
  if (!yieldUnit) return "Yield unit is required";
  if (yieldUnit.length > 40) return "Yield unit must be 40 characters or fewer";
  return quantityError(String(input.yieldQuantity ?? ""), "Yield");
}

/** Other recipes that are active for the same menu item. Sales refuse a menu item with two. */
async function activeConflicts(recipeId: string | null, menuItemId: string | null): Promise<Array<{ id: string; name: string | null }> | null> {
  if (!menuItemId) return [];
  const where: Record<string, unknown> = { menuItem: { id: { equals: menuItemId } }, status: { equals: "active" }, active: { equals: true } };
  if (recipeId) where.NOT = [{ id: { equals: recipeId } }];
  const response = await keystoneClient<{ recipes: Array<{ id: string; name: string | null }> }>(
    `query RecipeActiveConflicts($where: RecipeWhereInput!) { recipes(where: $where, take: 20) { id name } }`,
    { where },
    { cache: "no-store" },
  );
  return response.success ? response.data.recipes : null;
}

function conflictMessage(conflicts: Array<{ name: string | null }>) {
  return `Another active recipe uses this menu item: ${conflicts.map((recipe) => recipe.name || "Untitled").join(", ")}. Archive it first.`;
}

export async function findActiveConflictsAction(recipeId: string): Promise<RecipeActionResult<Array<{ id: string; name: string | null }>>> {
  if (!validId(recipeId)) return { success: false, error: "Recipe not found" };
  const response = await keystoneClient<{ recipe: { id: string; menuItem: { id: string } | null } | null }>(
    `query RecipeMenuItem($id: ID!) { recipe(where: { id: $id }) { id menuItem { id } } }`,
    { id: recipeId },
    { cache: "no-store" },
  );
  if (!response.success) return { success: false, error: response.error };
  if (!response.data.recipe) return { success: false, error: "Recipe not found" };
  const conflicts = await activeConflicts(recipeId, response.data.recipe.menuItem?.id ?? null);
  if (!conflicts) return { success: false, error: "Unable to check other active recipes. Please try again." };
  return { success: true, data: conflicts };
}

export async function createRecipeAction(input: RecipeFormInput): Promise<RecipeActionResult<{ id: string }>> {
  const error = recipeFieldErrors(input);
  if (error) return { success: false, error };
  const data: Record<string, unknown> = {
    name: text(input.name, 200),
    status: "draft",
    active: false,
    yieldQuantity: String(input.yieldQuantity).trim(),
    yieldUnit: text(input.yieldUnit, 40),
    prepInstructions: text(input.prepInstructions),
    allergenNotes: text(input.allergenNotes),
  };
  if (validId(input.menuItemId)) data.menuItem = { connect: { id: input.menuItemId } };
  const response = await recipeRequest<{ createRecipe: { id: string } }>(
    `mutation CreatePlatformRecipe($data: RecipeCreateInput!) { createRecipe(data: $data) { id } }`,
    { data },
  );
  if (!response.success) return response;
  revalidateRecipe(response.data.createRecipe.id);
  return { success: true, data: { id: response.data.createRecipe.id } };
}

export async function updateRecipeAction(recipeId: string, input: RecipeFormInput): Promise<RecipeActionResult> {
  if (!validId(recipeId)) return { success: false, error: "Recipe not found" };
  const error = recipeFieldErrors(input);
  if (error) return { success: false, error };
  const current = await keystoneClient<{ recipe: { id: string; status: string | null; active: boolean | null; menuItem: { id: string } | null } | null }>(
    `query RecipeForUpdate($id: ID!) { recipe(where: { id: $id }) { id status active menuItem { id } } }`,
    { id: recipeId },
    { cache: "no-store" },
  );
  if (!current.success) return { success: false, error: current.error };
  if (!current.data.recipe) return { success: false, error: "Recipe not found" };
  const menuItemId = validId(input.menuItemId) ? input.menuItemId : null;
  const isActive = current.data.recipe.status === "active" && current.data.recipe.active !== false;
  if (isActive && menuItemId && menuItemId !== current.data.recipe.menuItem?.id) {
    const conflicts = await activeConflicts(recipeId, menuItemId);
    if (!conflicts) return { success: false, error: "Unable to check other active recipes. Please try again." };
    if (conflicts.length) return { success: false, error: conflictMessage(conflicts) };
  }
  const data: Record<string, unknown> = {
    name: text(input.name, 200),
    yieldQuantity: String(input.yieldQuantity).trim(),
    yieldUnit: text(input.yieldUnit, 40),
    prepInstructions: text(input.prepInstructions),
    allergenNotes: text(input.allergenNotes),
  };
  if (menuItemId) data.menuItem = { connect: { id: menuItemId } };
  else if (current.data.recipe.menuItem) data.menuItem = { disconnect: true };
  const response = await recipeRequest<{ updateRecipe: { id: string } | null }>(
    `mutation UpdatePlatformRecipe($id: ID!, $data: RecipeUpdateInput!) { updateRecipe(where: { id: $id }, data: $data) { id } }`,
    { id: recipeId, data },
  );
  if (!response.success) return response;
  revalidateRecipe(recipeId);
  return { success: true };
}

export async function setRecipeStatusAction(recipeId: string, status: RecipeStatus): Promise<RecipeActionResult> {
  if (!validId(recipeId)) return { success: false, error: "Recipe not found" };
  if (status !== "draft" && status !== "active" && status !== "archived") return { success: false, error: "Unknown status" };
  if (status === "active") {
    const current = await keystoneClient<{ recipe: { id: string; menuItem: { id: string } | null } | null; ingredientsCount: number }>(
      `query RecipeForActivate($id: ID!) { recipe(where: { id: $id }) { id menuItem { id } } ingredientsCount(where: { recipe: { id: { equals: $id } } }) }`,
      { id: recipeId },
      { cache: "no-store" },
    );
    if (!current.success) return { success: false, error: current.error };
    if (!current.data.recipe) return { success: false, error: "Recipe not found" };
    if (!current.data.ingredientsCount) return { success: false, error: "Add at least one ingredient before activating" };
    const conflicts = await activeConflicts(recipeId, current.data.recipe.menuItem?.id ?? null);
    if (!conflicts) return { success: false, error: "Unable to check other active recipes. Please try again." };
    if (conflicts.length) return { success: false, error: conflictMessage(conflicts) };
  }
  const response = await recipeRequest<{ updateRecipe: { id: string } | null }>(
    `mutation SetPlatformRecipeStatus($id: ID!, $data: RecipeUpdateInput!) { updateRecipe(where: { id: $id }, data: $data) { id } }`,
    { id: recipeId, data: statusUpdate(status) },
  );
  if (!response.success) return response;
  revalidateRecipe(recipeId);
  revalidatePath("/dashboard/platform/coffee-operations");
  return { success: true };
}

async function ingredientPayload(input: IngredientFormInput): Promise<{ data: Record<string, unknown>; item: InventoryOption } | { error: string }> {
  if (!validId(input.inventoryItemId)) return { error: "Choose an inventory item" };
  const response = await keystoneClient<{ inventoryItem: InventoryOption | null }>(
    `query IngredientInventoryItem($id: ID!) { inventoryItem(where: { id: $id }) { ${INVENTORY_FIELDS} } }`,
    { id: input.inventoryItemId },
    { cache: "no-store" },
  );
  if (!response.success) return { error: response.error };
  const item = response.data.inventoryItem;
  if (!item) return { error: "Inventory item not found" };
  if (!item.unit) return { error: "Set a unit on this inventory item first" };
  const quantity = quantityError(String(input.quantity ?? ""), "Quantity", item.unit);
  if (quantity) return { error: quantity };
  return {
    item,
    data: {
      name: text(input.name, 200) || item.name || "Ingredient",
      inventoryItem: { connect: { id: item.id } },
      quantity: String(input.quantity).trim(),
      // Stock is depleted in the inventory item's own unit, so the line always uses it.
      unit: item.unit,
      optional: Boolean(input.optional),
      notes: text(input.notes),
    },
  };
}

export async function createIngredientAction(input: IngredientFormInput): Promise<RecipeActionResult> {
  if (!validId(input.recipeId)) return { success: false, error: "Recipe not found" };
  // The store is set by the model's primary-store default; StoreSetting may not be readable for this role.
  const recipe = await keystoneClient<{ recipe: { id: string } | null }>(
    `query IngredientRecipe($id: ID!) { recipe(where: { id: $id }) { id } }`,
    { id: input.recipeId },
    { cache: "no-store" },
  );
  if (!recipe.success) return { success: false, error: recipe.error };
  if (!recipe.data.recipe) return { success: false, error: "Recipe not found" };
  const payload = await ingredientPayload(input);
  if ("error" in payload) return { success: false, error: payload.error };
  const response = await recipeRequest<{ createIngredient: { id: string } }>(
    `mutation CreatePlatformIngredient($data: IngredientCreateInput!) { createIngredient(data: $data) { id } }`,
    { data: { ...payload.data, recipe: { connect: { id: input.recipeId } } } },
  );
  if (!response.success) return response;
  revalidateRecipe(input.recipeId);
  return { success: true };
}

export async function updateIngredientAction(ingredientId: string, input: IngredientFormInput): Promise<RecipeActionResult> {
  if (!validId(ingredientId)) return { success: false, error: "Ingredient not found" };
  const payload = await ingredientPayload(input);
  if ("error" in payload) return { success: false, error: payload.error };
  const response = await recipeRequest<{ updateIngredient: { id: string } | null }>(
    `mutation UpdatePlatformIngredient($id: ID!, $data: IngredientUpdateInput!) { updateIngredient(where: { id: $id }, data: $data) { id } }`,
    { id: ingredientId, data: payload.data },
  );
  if (!response.success) return response;
  revalidateRecipe(input.recipeId);
  return { success: true };
}

export async function deleteIngredientAction(ingredientId: string, recipeId: string): Promise<RecipeActionResult> {
  if (!validId(ingredientId)) return { success: false, error: "Ingredient not found" };
  const response = await recipeRequest<{ deleteIngredient: { id: string } | null }>(
    `mutation DeletePlatformIngredient($id: ID!) { deleteIngredient(where: { id: $id }) { id } }`,
    { id: ingredientId },
  );
  if (!response.success) return response;
  revalidateRecipe(validId(recipeId) ? recipeId : null);
  return { success: true };
}
