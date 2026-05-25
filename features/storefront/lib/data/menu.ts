"use server";

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
  featured: boolean;
  popular: boolean;
  imageUrl?: string | null;
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

const MENU_QUERY = `
  query StorefrontMenu {
    menuCategories(where: { active: { equals: true } }, orderBy: { sortOrder: asc }) {
      id
      name
      description
      active
      sortOrder
    }
    menuItems(where: { available: { equals: true } }, orderBy: { name: asc }) {
      id
      name
      shortDescription
      price
      available
      featured
      popular
      imageUrl
      prepTimeMinutes
      caffeineMg
      barStation
      temperatureOptions
      dietaryFlags
      category { id name }
      modifiers {
        id
        name
        modifierGroup
        modifierGroupLabel
        priceAdjustment
        required
        minSelections
        maxSelections
        defaultSelected
        inStock
      }
    }
  }
`;

const MENU_ITEM_QUERY = `
  query StorefrontMenuItem($id: ID!) {
    menuItem(where: { id: $id }) {
      id
      name
      shortDescription
      price
      available
      featured
      popular
      imageUrl
      prepTimeMinutes
      caffeineMg
      barStation
      temperatureOptions
      dietaryFlags
      category { id name }
      modifiers {
        id
        name
        modifierGroup
        modifierGroupLabel
        priceAdjustment
        required
        minSelections
        maxSelections
        defaultSelected
        inStock
      }
    }
  }
`;

export const getStorefrontMenu = cache(async function getStorefrontMenu() {
  const response = await keystoneClient<{ menuCategories: StorefrontMenuCategory[]; menuItems: StorefrontMenuItem[] }>(
    MENU_QUERY,
    {},
    { cache: "no-store" }
  );

  if (!response.success) {
    return { categories: [], items: [], error: response.error };
  }

  return {
    categories: response.data.menuCategories || [],
    items: response.data.menuItems || [],
    error: null,
  };
});

export const getStorefrontMenuItem = cache(async function getStorefrontMenuItem(id: string) {
  const response = await keystoneClient<{ menuItem: StorefrontMenuItem | null }>(
    MENU_ITEM_QUERY,
    { id },
    { cache: "no-store" }
  );

  if (!response.success) return null;
  return response.data.menuItem;
});
