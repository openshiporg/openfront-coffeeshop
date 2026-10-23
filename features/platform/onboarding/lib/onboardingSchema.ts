import { z } from "zod";

import { validCoffeeTimezone } from "../../../keystone/lib/store-locale-policy";
import { PICKUP_LIMITS, weeklyHoursSchema } from "../../../keystone/lib/store-settings-input";
import { COFFEE_BRAND_COLOR_VALUES, DEFAULT_COFFEE_BRAND_COLOR } from "../../../keystone/lib/brand-colors";
import { sanitizeStoreLogoSvg } from "../../../lib/sanitize-store-logo";
import { DEFAULT_STORE_LOGO_COLOR, DEFAULT_STORE_LOGO_ICON, normalizeStoreLogoColor } from "../../store-settings/lib/store-logo";

/**
 * One browser-safe onboarding contract shared by the setup preview and the
 * runCoffeeOnboarding mutation, so a payload that previews as valid is the
 * payload the server accepts. Select values mirror the Keystone model options.
 */

export const BAR_STATIONS = ["espresso_bar", "cold_bar", "brew_bar", "pastry_case", "retail_shelf"] as const;
export const MODIFIER_GROUPS = ["size", "milk", "espresso", "syrup", "sweetness", "temperature", "ice", "topping", "bakery_prep", "grind"] as const;
export const INVENTORY_UNITS = ["each", "lb", "oz", "g", "gal", "l"] as const;
export const INVENTORY_CATEGORIES = ["coffee", "milk", "syrup", "tea", "bakery", "retail", "packaging"] as const;
export const SUPPLIER_STATUSES = ["active", "paused", "archived"] as const;
export const RECIPE_STATUSES = ["draft", "active", "archived"] as const;
export const STAFF_ROLES = ["barista", "shift_lead", "kitchen", "manager"] as const;
export const LOYALTY_STATUSES = ["active", "paused", "closed"] as const;
export const LOYALTY_TIERS = ["regular", "neighborhood", "house_account"] as const;

const MAX_QUANTITY = 1_000_000_000;

/** Non-negative decimal string that fits the Decimal(18, 4) inventory columns. */
const decimalString = (label: string, { positive = false } = {}) =>
  z.string().trim().regex(/^\d{1,10}(\.\d{1,4})?$/, `${label} must be a number with up to 4 decimal places`).refine((value) => {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric <= MAX_QUANTITY && (!positive || numeric > 0);
  }, positive ? `${label} must be greater than 0` : `${label} is too large`);

const int = (min: number, max: number) => z.number().int().min(min).max(max);
const text = (max: number) => z.string().trim().max(max);
const name = z.string().trim().min(1).max(200);

export const storeInfoSchema = z.object({
  name,
  tagline: text(300).default(""),
  description: text(2000).default(""),
  address: z.string().trim().min(1, "Store address is required").max(500),
  phone: text(100).default(""),
  contactEmail: z.string().trim().email("Enter a valid store contact email"),
  currencyCode: z.literal("USD").default("USD"),
  locale: z.literal("en-US").default("en-US"),
  timezone: z.string().trim().max(100).refine(validCoffeeTimezone, "Invalid store timezone").default("America/New_York"),
  brandColor: z.enum(COFFEE_BRAND_COLOR_VALUES).default(DEFAULT_COFFEE_BRAND_COLOR),
  logoIcon: z.string().max(100_000).default(DEFAULT_STORE_LOGO_ICON)
    .refine((value) => Boolean(sanitizeStoreLogoSvg(value)), "Store logo must be a valid, safe SVG document")
    .transform((value) => sanitizeStoreLogoSvg(value)),
  logoColor: z.union([z.string(), z.number()]).default(DEFAULT_STORE_LOGO_COLOR).transform(normalizeStoreLogoColor),
  weeklyHours: weeklyHoursSchema.default([]),
  pickupLeadTimeMinutes: int(PICKUP_LIMITS.pickupLeadTimeMinutes.min, PICKUP_LIMITS.pickupLeadTimeMinutes.max).default(12),
  pickupWindowMinutes: int(PICKUP_LIMITS.pickupWindowMinutes.min, PICKUP_LIMITS.pickupWindowMinutes.max).default(15),
  pickupCapacityPerWindow: int(PICKUP_LIMITS.pickupCapacityPerWindow.min, PICKUP_LIMITS.pickupCapacityPerWindow.max).default(20),
  // The merchant's own sales-tax rate; setup never assumes one.
  taxRateBasisPoints: z.number().min(PICKUP_LIMITS.taxRateBasisPoints.min).max(PICKUP_LIMITS.taxRateBasisPoints.max)
    .refine((value) => Math.abs(Math.round(value * 100) - value * 100) < 1e-6, "Tax rate allows at most two decimals of a basis point"),
}).strict();

const categorySchema = z.object({ name, description: text(2000).default(""), sortOrder: int(0, 10_000).default(0) }).strict();
const menuItemSchema = z.object({
  name,
  shortDescription: text(1000).default(""),
  price: int(0, 1_000_000),
  prepTimeMinutes: int(0, 240).default(5),
  barStation: z.enum(BAR_STATIONS).default("espresso_bar"),
  featured: z.boolean().default(false),
  popular: z.boolean().default(false),
  imageUrl: z.string().trim().max(1000).regex(/^\/[^/\\]/, "Menu images must be a site path such as /images/latte.jpg").optional(),
  categoryName: name,
  caffeineMg: int(0, 2_000).optional(),
  calories: int(0, 5_000).optional(),
}).strict();
const modifierSchema = z.object({
  inventoryAction: z.enum(["none", "add", "substitute", "unreviewed"]).default("unreviewed"),
  inventoryItemName: name.optional(),
  replacesInventoryItemName: name.optional(),
  inventoryQuantity: z.number().nonnegative().max(MAX_QUANTITY).default(0),
  menuItemName: name,
  name,
  modifierGroup: z.enum(MODIFIER_GROUPS).default("milk"),
  modifierGroupLabel: text(200).default("Modifier"),
  priceAdjustment: int(-100_000, 100_000).default(0),
  defaultSelected: z.boolean().default(false),
  required: z.boolean().default(false),
  minSelections: int(0, 20).default(0),
  maxSelections: int(1, 20).default(1),
}).strict().refine((modifier) => modifier.minSelections <= modifier.maxSelections, "Modifier minimum selections cannot exceed the maximum");
const inventorySchema = z.object({
  name,
  sku: text(100).default(""),
  unit: z.enum(INVENTORY_UNITS).default("each"),
  category: z.enum(INVENTORY_CATEGORIES).optional(),
  supplierName: text(200).optional(),
  quantityOnHand: decimalString("Quantity on hand").optional(),
  currentStock: decimalString("Current stock").optional(),
  parLevel: decimalString("Par level").default("0"),
  reorderPoint: decimalString("Reorder point").default("0"),
  costPerUnit: int(0, 100_000_000).default(0),
  active: z.boolean().optional(),
}).strict();
const providerSchema = z.object({ name, code: z.string().trim().min(1).max(100), isInstalled: z.boolean().default(false) }).strict();
const supplierSchema = z.object({
  name,
  status: z.enum(SUPPLIER_STATUSES).default("active"),
  contactName: text(200).default(""),
  email: z.union([z.literal(""), z.string().trim().email("Enter a valid supplier email")]).default(""),
  phone: text(100).default(""),
  leadTimeDays: int(0, 365).default(0),
  notes: text(2000).default(""),
}).strict();
const recipeSchema = z.object({
  name,
  menuItemName: name,
  status: z.enum(RECIPE_STATUSES).default("active"),
  yieldQuantity: decimalString("Recipe yield", { positive: true }).default("1"),
  yieldUnit: text(50).default("serving"),
  prepInstructions: text(4000).default(""),
  allergenNotes: text(2000).default(""),
}).strict();
const ingredientSchema = z.object({
  recipeName: name,
  name,
  inventoryItemName: name,
  quantity: decimalString("Ingredient quantity", { positive: true }),
  unit: z.enum(INVENTORY_UNITS),
  optional: z.boolean().default(false),
  notes: text(2000).default(""),
}).strict();
const purchaseOrderSchema = z.object({
  poNumber: z.string().trim().min(1).max(100),
  supplierName: name,
  inventoryItemName: name,
  orderedQuantity: decimalString("Ordered quantity", { positive: true }),
  unitCostCents: int(0, 100_000_000),
  status: z.literal("submitted"),
  orderedOffsetDays: int(-365, 0),
  expectedOffsetDays: int(0, 365),
  notes: text(2000).default(""),
}).strict().refine((order) => Number(order.orderedQuantity) * order.unitCostCents <= Number.MAX_SAFE_INTEGER, "Purchase order total is too large");
const staffShiftSchema = z.object({
  shiftNumber: z.string().trim().min(1).max(100),
  role: z.enum(STAFF_ROLES),
  status: z.literal("scheduled"),
  startsOffsetHours: int(0, 24 * 60),
  durationHours: z.number().positive().max(24),
  notes: text(2000).default(""),
}).strict();
const loyaltyAccountSchema = z.object({
  customerName: name,
  customerEmail: z.string().trim().email(),
  customerPhone: text(100).default(""),
  status: z.enum(LOYALTY_STATUSES).default("active"),
  tier: z.enum(LOYALTY_TIERS).default("regular"),
  pointsBalance: z.literal(0).default(0),
  lifetimePoints: z.literal(0).default(0),
  drinkCredits: z.literal(0).default(0),
  visits: z.literal(0).default(0),
}).strict();
const cateringOrderSchema = z.object({
  cateringNumber: z.string().trim().min(1).max(100),
  customerName: name,
  customerEmail: z.string().trim().email(),
  status: z.literal("inquiry"),
  eventOffsetDays: int(1, 730),
  guestCount: int(1, 10_000),
  deliveryAddress: text(500).default(""),
  subtotalCents: z.literal(0),
  notes: text(2000).default(""),
}).strict();

export const onboardingSchema = z.object({
  storeInfo: storeInfoSchema,
  categories: z.array(categorySchema).max(100),
  menuItems: z.array(menuItemSchema).max(500),
  modifiers: z.array(modifierSchema).max(2000),
  inventoryItems: z.array(inventorySchema).max(1000),
  paymentProviders: z.array(providerSchema).max(10),
  suppliers: z.array(supplierSchema).max(100).default([]),
  recipes: z.array(recipeSchema).max(500).default([]),
  ingredients: z.array(ingredientSchema).max(2000).default([]),
  purchaseOrders: z.array(purchaseOrderSchema).max(100).default([]),
  staffShifts: z.array(staffShiftSchema).max(100).default([]),
  loyaltyAccounts: z.array(loyaltyAccountSchema).max(100).default([]),
  cateringOrders: z.array(cateringOrderSchema).max(100).default([]),
}).strict();

export type OnboardingData = z.infer<typeof onboardingSchema>;

function duplicates(values: string[]) {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) (seen.has(value) ? repeated : seen).add(value);
  return [...repeated];
}

/** Uniqueness and cross-reference checks that every reference resolves to exactly one record. */
export function onboardingDataErrors(data: OnboardingData): string[] {
  const errors: string[] = [];
  const unique = (label: string, values: string[]) => {
    for (const value of duplicates(values)) errors.push(`${label} "${value}" appears more than once`);
  };
  unique("Category", data.categories.map((entry) => entry.name));
  unique("Menu item", data.menuItems.map((entry) => entry.name));
  unique("Modifier", data.modifiers.map((entry) => `${entry.menuItemName} · ${entry.name}`));
  unique("Inventory item", data.inventoryItems.map((entry) => entry.name));
  unique("Payment provider", data.paymentProviders.map((entry) => entry.code.toLowerCase()));
  unique("Supplier", data.suppliers.map((entry) => entry.name));
  unique("Recipe", data.recipes.map((entry) => entry.name));
  unique("Ingredient", data.ingredients.map((entry) => `${entry.recipeName} · ${entry.name}`));
  unique("Purchase order", data.purchaseOrders.map((entry) => entry.poNumber));
  unique("Staff shift", data.staffShifts.map((entry) => entry.shiftNumber));
  unique("Loyalty account", data.loyaltyAccounts.map((entry) => entry.customerEmail.toLowerCase()));
  unique("Catering inquiry", data.cateringOrders.map((entry) => entry.cateringNumber));

  const categories = new Set(data.categories.map((entry) => entry.name));
  const menuItems = new Set(data.menuItems.map((entry) => entry.name));
  const stock = new Map(data.inventoryItems.map((entry) => [entry.name, entry]));
  const recipes = new Map(data.recipes.map((entry) => [entry.name, entry]));
  const suppliers = new Set(data.suppliers.map((entry) => entry.name));

  for (const item of data.menuItems) if (!categories.has(item.categoryName)) errors.push(`Onboarding category is missing for ${item.name}`);
  for (const modifier of data.modifiers) {
    if (!menuItems.has(modifier.menuItemName)) errors.push(`Onboarding menu item is missing for modifier ${modifier.name}`);
    if (modifier.inventoryAction === "none" || modifier.inventoryAction === "unreviewed") continue;
    const target = stock.get(modifier.inventoryItemName || "");
    if (!target) { errors.push(`Missing inventory for modifier ${modifier.name}`); continue; }
    if (modifier.inventoryAction === "add" && !(modifier.inventoryQuantity > 0)) errors.push(`Invalid add-on quantity for ${modifier.name}`);
    if (modifier.inventoryAction === "substitute") {
      const base = stock.get(modifier.replacesInventoryItemName || "");
      const baseInRecipe = Boolean(base) && data.ingredients.some((ingredient) => ingredient.inventoryItemName === base?.name && !ingredient.optional && recipes.get(ingredient.recipeName)?.menuItemName === modifier.menuItemName);
      if (!base || base.name === target.name || base.unit !== target.unit || !baseInRecipe) errors.push(`Invalid base recipe substitution for ${modifier.name}`);
    }
  }
  const activeRecipes = data.recipes.filter((recipe) => recipe.status === "active");
  for (const menuItem of duplicates(activeRecipes.map((recipe) => recipe.menuItemName))) errors.push(`${menuItem} can have only one active recipe`);
  for (const recipe of data.recipes) if (!menuItems.has(recipe.menuItemName)) errors.push(`Onboarding menu item is missing for recipe ${recipe.name}`);
  for (const ingredient of data.ingredients) {
    const item = stock.get(ingredient.inventoryItemName);
    if (!item || !recipes.has(ingredient.recipeName) || item.unit !== ingredient.unit) errors.push(`Invalid inventory unit, quantity or recipe for ${ingredient.name}`);
  }
  for (const order of data.purchaseOrders) {
    if (!suppliers.has(order.supplierName) || !stock.has(order.inventoryItemName)) errors.push(`Onboarding dependency is missing for purchase order ${order.poNumber}`);
  }
  return errors;
}

export type OnboardingParseResult = { success: true; data: OnboardingData } | { success: false; errors: string[] };

/** Full validation used by both the preview and the server. */
export function parseOnboardingData(input: unknown): OnboardingParseResult {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.issues.slice(0, 20).map((issue) => (issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message)),
    };
  }
  const errors = onboardingDataErrors(parsed.data);
  return errors.length ? { success: false, errors } : { success: true, data: parsed.data };
}
