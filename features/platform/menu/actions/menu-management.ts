'use server';

import { revalidatePath } from 'next/cache';

import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import type { MenuActionResult, MenuInventoryOption, MenuInventoryReview } from '../types';

/** Every write carries the client's retained command key: a retry after a lost
 * reply reuses it and the server returns the original receipt instead of writing again.
 */

const CREATE_CATEGORY_MUTATION = `
  mutation CreateCoffeeMenuCategory($name: String!, $description: String, $sortOrder: Int, $idempotencyKey: String!) {
    createCoffeeMenuCategory(name: $name, description: $description, sortOrder: $sortOrder, idempotencyKey: $idempotencyKey) { id }
  }
`;

const CREATE_MENU_ITEM_MUTATION = `
  mutation CreateCoffeeMenuItem($name: String!, $price: Int!, $categoryId: ID, $barStation: String, $shortDescription: String, $prepTimeMinutes: Int, $idempotencyKey: String!) {
    createCoffeeMenuItem(name: $name, price: $price, categoryId: $categoryId, barStation: $barStation, shortDescription: $shortDescription, prepTimeMinutes: $prepTimeMinutes, idempotencyKey: $idempotencyKey) { id }
  }
`;

const UPDATE_MENU_ITEM_MUTATION = `
  mutation UpdateCoffeeMenuItem(
    $menuItemId: ID!
    $name: String
    $shortDescription: String
    $categoryId: ID
    $clearCategory: Boolean
    $barStation: String
    $prepTimeMinutes: Int
    $price: Int
    $available: Boolean
    $featured: Boolean
    $popular: Boolean
    $expectedUpdatedAt: String
    $idempotencyKey: String!
  ) {
    updateCoffeeMenuItem(
      menuItemId: $menuItemId
      name: $name
      shortDescription: $shortDescription
      categoryId: $categoryId
      clearCategory: $clearCategory
      barStation: $barStation
      prepTimeMinutes: $prepTimeMinutes
      price: $price
      available: $available
      featured: $featured
      popular: $popular
      expectedUpdatedAt: $expectedUpdatedAt
      idempotencyKey: $idempotencyKey
    ) { id }
  }
`;

const MODIFIER_VARIABLES = `$name: String!, $modifierGroup: String!, $modifierGroupLabel: String, $priceAdjustment: Int!, $required: Boolean, $minSelections: Int, $maxSelections: Int, $defaultSelected: Boolean, $inventoryAction: String, $inventoryItemId: ID, $replacesInventoryItemId: ID, $inventoryQuantity: Float, $idempotencyKey: String!`;
const MODIFIER_ARGS = `name: $name, modifierGroup: $modifierGroup, modifierGroupLabel: $modifierGroupLabel, priceAdjustment: $priceAdjustment, required: $required, minSelections: $minSelections, maxSelections: $maxSelections, defaultSelected: $defaultSelected, inventoryAction: $inventoryAction, inventoryItemId: $inventoryItemId, replacesInventoryItemId: $replacesInventoryItemId, inventoryQuantity: $inventoryQuantity, idempotencyKey: $idempotencyKey`;

const CREATE_MODIFIER_MUTATION = `
  mutation CreateCoffeeMenuModifier($menuItemId: ID!, ${MODIFIER_VARIABLES}) {
    createCoffeeMenuModifier(menuItemId: $menuItemId, ${MODIFIER_ARGS}) { id }
  }
`;

const UPDATE_MODIFIER_MUTATION = `
  mutation UpdateCoffeeMenuModifier($modifierId: ID!, $expectedUpdatedAt: String, ${MODIFIER_VARIABLES}) {
    updateCoffeeMenuModifier(modifierId: $modifierId, expectedUpdatedAt: $expectedUpdatedAt, ${MODIFIER_ARGS}) { id }
  }
`;

const UPDATE_MODIFIER_STOCK_MUTATION = `
  mutation UpdateCoffeeModifierStock($modifierId: ID!, $inStock: Boolean!, $expectedUpdatedAt: String, $idempotencyKey: String!) {
    updateCoffeeModifierStock(modifierId: $modifierId, inStock: $inStock, expectedUpdatedAt: $expectedUpdatedAt, idempotencyKey: $idempotencyKey) { id }
  }
`;

const INVENTORY_OPTIONS_QUERY = `
  query CoffeeMenuInventoryOptions($search: String) {
    getCoffeeMenuInventoryOptions(search: $search, limit: 25) { items { id name unit } hasMore }
  }
`;

const SAVE_FAILED = 'This change was not saved. Your entries are kept; check them and try again. If someone else changed this entry, the latest version has been loaded.';

async function send(mutation: string, variables: Record<string, unknown>): Promise<MenuActionResult> {
  try {
    const response = await keystoneClient(mutation, variables, { cache: 'no-store' });
    if (!response.success) return { success: false, error: SAVE_FAILED };
    revalidateMenuPaths();
    return { success: true };
  } catch {
    return { success: false, error: SAVE_FAILED };
  }
}

export type CreateMenuCategoryInput = { name: string; description: string; sortOrder: number; idempotencyKey: string };
export async function createMenuCategoryAction(input: CreateMenuCategoryInput) {
  return send(CREATE_CATEGORY_MUTATION, input);
}

export type CreateMenuItemInput = { name: string; price: number; categoryId: string | null; barStation: string; shortDescription: string; prepTimeMinutes: number; idempotencyKey: string };
export async function createMenuItemAction(input: CreateMenuItemInput) {
  return send(CREATE_MENU_ITEM_MUTATION, input);
}

export type UpdateMenuItemInput = {
  menuItemId: string;
  expectedUpdatedAt: string;
  idempotencyKey: string;
  name?: string;
  shortDescription?: string;
  categoryId?: string;
  clearCategory?: boolean;
  barStation?: string;
  prepTimeMinutes?: number;
  price?: number;
  available?: boolean;
  featured?: boolean;
  popular?: boolean;
};
export async function updateMenuItemAction(input: UpdateMenuItemInput) {
  return send(UPDATE_MENU_ITEM_MUTATION, input);
}

export type MenuModifierRuleInput = {
  name: string;
  modifierGroup: string;
  modifierGroupLabel: string;
  priceAdjustment: number;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  defaultSelected: boolean;
};

function inventoryVariables(review: MenuInventoryReview | null) {
  if (!review) return {};
  return {
    inventoryAction: review.action,
    inventoryItemId: review.action === 'none' ? null : review.inventoryItemId,
    replacesInventoryItemId: review.action === 'substitute' ? review.replacesInventoryItemId : null,
    inventoryQuantity: review.action === 'add' ? review.quantity : null,
  };
}

export async function createMenuModifierAction(input: { menuItemId: string; rule: MenuModifierRuleInput; inventory: MenuInventoryReview; idempotencyKey: string }) {
  return send(CREATE_MODIFIER_MUTATION, { menuItemId: input.menuItemId, ...input.rule, ...inventoryVariables(input.inventory), idempotencyKey: input.idempotencyKey });
}

/** `inventory: null` leaves the reviewed inventory mapping untouched. */
export async function updateMenuModifierAction(input: { modifierId: string; expectedUpdatedAt: string; rule: MenuModifierRuleInput; inventory: MenuInventoryReview | null; idempotencyKey: string }) {
  return send(UPDATE_MODIFIER_MUTATION, { modifierId: input.modifierId, expectedUpdatedAt: input.expectedUpdatedAt, ...input.rule, ...inventoryVariables(input.inventory), idempotencyKey: input.idempotencyKey });
}

export async function updateModifierStockAction(input: { modifierId: string; inStock: boolean; expectedUpdatedAt: string; idempotencyKey: string }) {
  return send(UPDATE_MODIFIER_STOCK_MUTATION, input);
}

export async function searchMenuInventoryAction(search: string): Promise<{ success: true; items: MenuInventoryOption[]; hasMore: boolean } | { success: false; error: string }> {
  try {
    const response = await keystoneClient<{ getCoffeeMenuInventoryOptions: { items: MenuInventoryOption[]; hasMore: boolean } }>(INVENTORY_OPTIONS_QUERY, { search: search.trim().slice(0, 200) }, { cache: 'no-store' });
    if (!response.success || !Array.isArray(response.data?.getCoffeeMenuInventoryOptions?.items)) return { success: false, error: 'Inventory could not be loaded. Try again.' };
    return { success: true, ...response.data.getCoffeeMenuInventoryOptions };
  } catch {
    return { success: false, error: 'Inventory could not be loaded. Try again.' };
  }
}

function revalidateMenuPaths() {
  revalidatePath('/');
  revalidatePath('/dashboard/platform/menu');
  revalidatePath('/dashboard/platform/pos');
  revalidatePath('/dashboard/platform/reports');
}
