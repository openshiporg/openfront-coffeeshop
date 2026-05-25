import type { StorefrontMenuItem } from "../data/menu";

export type CartLine = {
  cartId: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  basePrice: number;
  modifierIds: string[];
  modifierNames: string[];
  notes?: string;
  prepTimeMinutes?: number | null;
};

export type CartMenuItem = StorefrontMenuItem;
