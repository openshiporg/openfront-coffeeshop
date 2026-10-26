import type { StatusTone } from "@/features/platform/components/StatusTitle";

export const INVENTORY_PATH = "/dashboard/platform/inventory";
export const OPERATIONS_PATH = "/dashboard/platform/coffee-operations";
export const SUPPLIERS_PATH = "/dashboard/platform/suppliers";
export const INVENTORY_PAGE_SIZE = 30;
export const MOVEMENT_PAGE_SIZE = 25;
/** The Low tab can't be a Keystone filter (it compares two fields), so it scans at most this many in-stock items. */
export const LOW_STOCK_SCAN_CAP = 500;

export const INVENTORY_CATEGORIES = [
  { value: "coffee", label: "Coffee" },
  { value: "milk", label: "Milk" },
  { value: "syrup", label: "Syrup" },
  { value: "tea", label: "Tea" },
  { value: "bakery", label: "Bakery" },
  { value: "retail", label: "Retail" },
  { value: "packaging", label: "Packaging" },
] as const;

export const INVENTORY_UNITS = [
  { value: "each", label: "Each" },
  { value: "lb", label: "Pound" },
  { value: "oz", label: "Ounce" },
  { value: "g", label: "Gram" },
  { value: "gal", label: "Gallon" },
  { value: "l", label: "Liter" },
] as const;

export const STOCK_FILTERS = ["all", "low", "out"] as const;
export type StockFilter = (typeof STOCK_FILTERS)[number];
/** List tabs: "reorder" (low + out, the default view) plus the stock filters the loader understands. */
export const INVENTORY_TABS = ["reorder", ...STOCK_FILTERS] as const;
export type InventoryTab = (typeof INVENTORY_TABS)[number];
export type StockState = "ok" | "low" | "out";

export const STOCK_STATE: Record<StockState, { label: string; tone: StatusTone }> = {
  ok: { label: "In stock", tone: "green" },
  low: { label: "Low", tone: "amber" },
  out: { label: "Out", tone: "red" },
};

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  received: "Received", sale: "Sale", return: "Return / release", waste: "Waste", adjustment: "Adjustment", transfer: "Transfer",
};
export const LOT_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  active: { label: "Active", tone: "green" },
  consumed: { label: "Consumed", tone: "zinc" },
  expired: { label: "Expired", tone: "red" },
  quarantined: { label: "Quarantined", tone: "amber" },
};
export const PO_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  draft: { label: "Draft", tone: "zinc" },
  submitted: { label: "Submitted", tone: "blue" },
  received: { label: "Received", tone: "green" },
  cancelled: { label: "Cancelled", tone: "red" },
};
export const WASTE_REASON_LABELS: Record<string, string> = { expired: "Expired", damaged: "Damaged", overproduction: "Overproduction", quality: "Quality" };

export function categoryLabel(value?: string | null) {
  return INVENTORY_CATEGORIES.find((option) => option.value === value)?.label ?? value ?? "Uncategorized";
}

export function unitLabel(value?: string | null) {
  return value || "each";
}

export function toNumber(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function stockState(currentStock: unknown, reorderPoint: unknown): StockState {
  const stock = toNumber(currentStock);
  if (stock <= 0) return "out";
  if (stock <= toNumber(reorderPoint)) return "low";
  return "ok";
}

const quantityFormat = new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 });
export function formatQuantity(value: unknown) {
  return quantityFormat.format(toNumber(value));
}

const moneyFormat = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
export function formatCents(cents?: number | null) {
  return moneyFormat.format((cents ?? 0) / 100);
}

/** "12.5" dollars → 1250 cents. Null when the text isn't a non-negative amount with at most 2 decimals. */
export function dollarsToCents(text: string): number | null {
  const trimmed = text.trim().replace(/^\$/, "");
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) ? cents : null;
}

export function centsToDollars(cents?: number | null) {
  return ((cents ?? 0) / 100).toFixed(2);
}

/** Non-negative decimal with at most 4 places, as Keystone Decimal(18,4) accepts it. */
export function parseQuantity(text: string): string | null {
  const trimmed = text.trim();
  if (!/^\d{1,14}(\.\d{1,4})?$/.test(trimmed)) return null;
  return trimmed;
}

export type InventoryListView = { search: string; category: string; stock: InventoryTab; page: number };

export function inventoryListHref(view: InventoryListView, updates: Partial<InventoryListView> = {}) {
  const merged = { ...view, ...updates };
  const params = new URLSearchParams();
  if (merged.search) params.set("search", merged.search);
  if (merged.category) params.set("category", merged.category);
  if (merged.stock !== "reorder") params.set("stock", merged.stock);
  if (merged.page > 1) params.set("page", String(merged.page));
  const query = params.toString();
  return `${INVENTORY_PATH}${query ? `?${query}` : ""}`;
}

export function parsePage(value: string | undefined) {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 && page < 100000 ? page : 1;
}

export type InventoryItemInput = {
  id?: string | null;
  name: string;
  category: string;
  unit: string;
  reorderPoint: string;
  parLevel: string;
  costPerUnit: string;
  supplierName: string;
  sku: string;
};

export type InventoryFieldErrors = Partial<Record<keyof InventoryItemInput, string>>;

export type InventoryItemData = {
  name: string;
  category: string;
  unit: string;
  reorderPoint: string;
  parLevel: string;
  costPerUnit: number;
  supplierName: string;
  sku: string;
};

export function validateInventoryItemInput(input: InventoryItemInput): { data: InventoryItemData; errors: null } | { data: null; errors: InventoryFieldErrors } {
  const errors: InventoryFieldErrors = {};
  const name = input.name.trim();
  if (!name) errors.name = "Name is required.";
  else if (name.length > 200) errors.name = "200 characters max.";
  if (!INVENTORY_CATEGORIES.some((option) => option.value === input.category)) errors.category = "Choose a category.";
  if (!INVENTORY_UNITS.some((option) => option.value === input.unit)) errors.unit = "Choose a unit.";
  const reorderPoint = parseQuantity(input.reorderPoint || "0");
  if (reorderPoint === null) errors.reorderPoint = "Enter 0 or more, up to 4 decimals.";
  const parLevel = parseQuantity(input.parLevel || "0");
  if (parLevel === null) errors.parLevel = "Enter 0 or more, up to 4 decimals.";
  const costPerUnit = dollarsToCents(input.costPerUnit || "0");
  if (costPerUnit === null || costPerUnit > 2_147_483_647) errors.costPerUnit = "Enter a dollar amount, e.g. 12.50.";
  const supplierName = input.supplierName.trim();
  if (supplierName.length > 200) errors.supplierName = "200 characters max.";
  const sku = input.sku.trim();
  if (sku.length > 100) errors.sku = "100 characters max.";
  if (Object.keys(errors).length) return { data: null, errors };
  return {
    data: { name, category: input.category, unit: input.unit, reorderPoint: reorderPoint!, parLevel: parLevel!, costPerUnit: costPerUnit!, supplierName, sku },
    errors: null,
  };
}

export type ActionResult = { success: true; id?: string } | { success: false; error: string; fieldErrors?: Record<string, string> };
