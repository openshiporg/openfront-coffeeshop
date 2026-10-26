import type { StatusTone } from "../../components/StatusTitle";

export const RECIPE_STATUS_FILTERS = ["all", "draft", "active", "archived"] as const;
export type RecipeStatusFilter = (typeof RECIPE_STATUS_FILTERS)[number];
export type RecipeStatus = "draft" | "active" | "archived";

export const RECIPE_PAGE_SIZE = 24;
export const YIELD_UNIT_SUGGESTIONS = ["serving", "each", "oz", "fl oz", "ml", "l", "g", "kg", "batch"] as const;

export const RECIPE_STATUS_LABELS: Record<string, string> = { draft: "Draft", active: "Active", archived: "Archived" };
export const RECIPE_STATUS_TONES: Record<string, StatusTone> = { draft: "amber", active: "green", archived: "zinc" };
export const PREP_BATCH_STATUS_LABELS: Record<string, string> = { planned: "Planned", in_progress: "In progress", completed: "Completed", discarded: "Discarded" };
export const PREP_BATCH_STATUS_TONES: Record<string, StatusTone> = { planned: "blue", in_progress: "amber", completed: "green", discarded: "zinc" };

export type RecipeActionResult<T = undefined> = { success: true; data?: T } | { success: false; error: string };

export type StoreFormat = { currencyCode: string; locale: string; timezone: string | null };

export type MenuItemOption = { id: string; name: string; price?: number | null };
export type InventoryOption = { id: string; name: string; unit: string | null; currentStock: string | null; costPerUnit: number | null };

export type IngredientRow = {
  id: string;
  name: string | null;
  quantity: string | null;
  unit: string | null;
  optional: boolean | null;
  notes: string | null;
  inventoryItem: InventoryOption | null;
};

export type RecipeSummary = {
  id: string;
  name: string | null;
  status: string | null;
  active: boolean | null;
  yieldQuantity: string | null;
  yieldUnit: string | null;
  menuItem: MenuItemOption | null;
  ingredientCount: number;
  costPerYieldCents: number | null;
};

export type RecipeDetail = {
  id: string;
  name: string | null;
  status: string | null;
  active: boolean | null;
  yieldQuantity: string | null;
  yieldUnit: string | null;
  prepInstructions: string | null;
  allergenNotes: string | null;
  updatedAt: string | null;
  store: { id: string } | null;
  menuItem: MenuItemOption | null;
};

export type PrepBatchRow = {
  id: string;
  batchNumber: string | null;
  status: string | null;
  quantityMade: string | null;
  quantityRemaining: string | null;
  expiresAt: string | null;
  completedAt: string | null;
};

export type RecipeFormInput = {
  name: string;
  menuItemId: string | null;
  yieldQuantity: string;
  yieldUnit: string;
  prepInstructions: string;
  allergenNotes: string;
};

export type IngredientFormInput = {
  recipeId: string;
  name: string;
  inventoryItemId: string;
  quantity: string;
  unit: string;
  optional: boolean;
  notes: string;
};

export function recipeStatus(recipe: { status: string | null; active: boolean | null }): RecipeStatus {
  if (recipe.status === "archived") return "archived";
  if (recipe.status === "active") return "active";
  return "draft";
}

/** Recipe status writes always keep `status` and `active` in step; sale-time consumption needs both. */
export function statusUpdate(status: RecipeStatus) {
  return { status, active: status === "active" };
}

export function recipesHref(view: { search?: string; status?: RecipeStatusFilter; page?: number }) {
  const params = new URLSearchParams();
  if (view.search) params.set("search", view.search);
  if (view.status && view.status !== "all") params.set("status", view.status);
  if (view.page && view.page > 1) params.set("page", String(view.page));
  const query = params.toString();
  return `/dashboard/platform/recipes${query ? `?${query}` : ""}`;
}
