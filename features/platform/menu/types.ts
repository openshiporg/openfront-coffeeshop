export type MenuActionResult = { success: true } | { success: false; error: string };

export type MenuInventoryOption = { id: string; name: string; unit?: string | null };

export type MenuInventoryAction = "none" | "add" | "substitute";

export type MenuInventoryReview = {
  action: MenuInventoryAction;
  inventoryItemId: string | null;
  replacesInventoryItemId: string | null;
  quantity: number;
};

export type MenuModifier = {
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
  updatedAt: string;
  /** Private to product managers; null for read-only staff. */
  inventoryAction?: string | null;
  inventoryQuantity?: number | null;
  inventoryItem?: MenuInventoryOption | null;
  replacesInventoryItem?: MenuInventoryOption | null;
};

export type MenuManagerItem = {
  id: string;
  name: string;
  shortDescription?: string | null;
  price: number;
  available: boolean;
  featured: boolean;
  popular: boolean;
  prepTimeMinutes?: number | null;
  barStation?: string | null;
  updatedAt: string;
  category?: { id: string; name: string } | null;
  modifiers: MenuModifier[];
  modifiersHasMore: boolean;
};

export type MenuManagerCategory = { id: string; name: string; description?: string | null; active?: boolean | null; sortOrder?: number | null };

export type MenuManagerData = {
  canManageProducts: boolean;
  categories: MenuManagerCategory[];
  categoriesHasMore: boolean;
  matchingCount: number;
  stats: { items: number; hidden: number; modifiersOut: number };
  hasMore: boolean;
  nextCursor: string | null;
  items: MenuManagerItem[];
};

export type MenuManagerFilters = { search: string; categoryId: string; cursor: string | null };

export const BAR_STATIONS = [
  { value: "espresso_bar", label: "Espresso Bar" },
  { value: "cold_bar", label: "Cold Bar" },
  { value: "brew_bar", label: "Brew Bar" },
  { value: "pastry_case", label: "Pastry Case" },
  { value: "retail_shelf", label: "Retail Shelf" },
] as const;

export const MODIFIER_GROUPS = [
  { value: "size", label: "Size" },
  { value: "milk", label: "Milk" },
  { value: "espresso", label: "Espresso" },
  { value: "syrup", label: "Syrup" },
  { value: "sweetness", label: "Sweetness" },
  { value: "temperature", label: "Temperature" },
  { value: "ice", label: "Ice" },
  { value: "topping", label: "Topping" },
  { value: "bakery_prep", label: "Bakery prep" },
] as const;
