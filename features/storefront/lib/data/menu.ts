import { cache } from "react";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

export type StorefrontModifier = {
  id: string;
  name: string;
  modifierGroup: string;
  modifierGroupLabel?: string | null;
  priceAdjustment: number;
  required: boolean;
  minSelections: number;
  maxSelections: number;
  defaultSelected: boolean;
  inStock: boolean;
};

export type StorefrontMenuItem = {
  id: string;
  name: string;
  shortDescription?: string | null;
  price: number;
  available: boolean;
  /** now: order for pickup today · later: closed, pickup booked for the next opening · sold_out · unavailable */
  availability?: "now" | "later" | "sold_out" | "unavailable" | null;
  featured: boolean;
  popular: boolean;
  imageUrl?: string | null;
  primaryImageUrl?: string | null;
  prepTimeMinutes?: number | null;
  caffeineMg?: number | null;
  barStation?: string | null;
  temperatureOptions?: string[];
  dietaryFlags?: string[];
  category?: { id: string; name: string } | null;
  modifiers?: StorefrontModifier[];
};

export type StorefrontMenuCategory = {
  id: string;
  name: string;
  description?: string | null;
  active: boolean;
  sortOrder: number;
};

const MENU_ITEM_FIELDS = `
  id name shortDescription price available availability featured popular imageUrl primaryImageUrl
  prepTimeMinutes caffeineMg barStation temperatureOptions dietaryFlags
  category { id name }
  modifiers { id name modifierGroup modifierGroupLabel priceAdjustment required minSelections maxSelections defaultSelected inStock }
`;

export type StorefrontMenuFilters = { search?: string; categoryId?: string; after?: string | null };

export type StorefrontMenuPage =
  | { kind: "ok"; categories: StorefrontMenuCategory[]; items: StorefrontMenuItem[]; nextCursor: string | null; hasUncategorized: boolean }
  | { kind: "unavailable" };

export type StorefrontMenuItemResult =
  | { kind: "found"; item: StorefrontMenuItem }
  | { kind: "not-found" }
  | { kind: "unavailable" };

const MENU_QUERY = `
  query StorefrontMenu($search: String, $categoryId: ID, $after: String) {
    getCoffeeMenu(search: $search, categoryId: $categoryId, after: $after) {
      categories { id name description active sortOrder }
      items { ${MENU_ITEM_FIELDS} }
      nextCursor
      hasUncategorized
    }
  }
`;

const MENU_ITEM_QUERY = `
  query StorefrontMenuItem($id: ID!) {
    getCoffeeMenu(menuItemId: $id) {
      item { ${MENU_ITEM_FIELDS} }
    }
  }
`;

type MenuResponse = { getCoffeeMenu: { categories?: StorefrontMenuCategory[]; items?: StorefrontMenuItem[]; nextCursor?: string | null; hasUncategorized?: boolean | null } | null };

export async function fetchStorefrontMenuPage(filters: StorefrontMenuFilters = {}): Promise<StorefrontMenuPage> {
  const response = await keystoneClient<MenuResponse>(
    MENU_QUERY,
    { search: filters.search?.trim().slice(0, 100) || null, categoryId: filters.categoryId || null, after: filters.after || null },
    { cache: "no-store" },
  );
  const menu = response.success ? response.data.getCoffeeMenu : null;
  if (!menu || !Array.isArray(menu.items) || !Array.isArray(menu.categories)) return { kind: "unavailable" };
  return { kind: "ok", categories: menu.categories, items: menu.items, nextCursor: menu.nextCursor || null, hasUncategorized: Boolean(menu.hasUncategorized) };
}

export const getStorefrontMenu = cache(async function getStorefrontMenu(search = "", categoryId = "") {
  return fetchStorefrontMenuPage({ search, categoryId });
});

export const getStorefrontMenuItem = cache(async function getStorefrontMenuItem(id: string): Promise<StorefrontMenuItemResult> {
  const response = await keystoneClient<{ getCoffeeMenu: { item: StorefrontMenuItem | null } | null }>(
    MENU_ITEM_QUERY,
    { id },
    { cache: "no-store" }
  );

  if (!response.success || !response.data.getCoffeeMenu || !Object.hasOwn(response.data.getCoffeeMenu, "item")) return { kind: "unavailable" };
  const item = response.data.getCoffeeMenu.item;
  return item ? { kind: "found", item } : { kind: "not-found" };
});
