export const OPERATIONS_PATH = "/dashboard/platform/coffee-operations";

/** URL state for every selector and worklist page. Drafts are kept separately per account/store. */
export const OPERATIONS_PARAMS = [
  "receiptCursor",
  "purchaseSupplierSearch",
  "purchaseSupplierCursor",
  "purchaseInventorySearch",
  "purchaseInventoryCursor",
  "inventoryWasteSearch",
  "inventoryWasteCursor",
  "prepBatchSearch",
  "prepBatchCursor",
  "recipeSearch",
  "recipeCursor",
  "staffSearch",
  "staffCursor",
  "shiftCursor",
] as const;
export type OperationsParam = (typeof OPERATIONS_PARAMS)[number];
export type OperationsUrlState = Partial<Record<OperationsParam, string | null>>;

export function readOperationsUrlState(params: Record<string, string | string[] | undefined>): OperationsUrlState {
  const state: OperationsUrlState = {};
  for (const key of OPERATIONS_PARAMS) {
    const value = params[key];
    if (typeof value === "string" && value) state[key] = key.endsWith("Search") ? value.trim().slice(0, 200) : value.slice(0, 2048);
  }
  return state;
}

export function operationsHref(state: OperationsUrlState, updates: OperationsUrlState = {}) {
  const merged = { ...state, ...updates };
  const params = new URLSearchParams();
  for (const key of OPERATIONS_PARAMS) {
    const value = merged[key];
    if (value) params.set(key, value);
  }
  const query = params.toString();
  return `${OPERATIONS_PATH}${query ? `?${query}` : ""}`;
}

export type NamedRef = { id?: string | null; name?: string | null } | null;
export type OperationsOption = { id: string; name: string; detail: string | null; unit: string | null; currentStock: number | null };
export type Page<T> = { items: T[]; hasMore: boolean; nextCursor: string | null; loadError: boolean };
export type StatusAction = { status: string; label: string; tone: string };
export type StaffShift = { id: string; shiftNumber: string; role: string; status: string; startsAt?: string | null; endsAt?: string | null; clockInAt?: string | null; clockOutAt?: string | null; staff?: { id?: string | null; name?: string | null; email?: string | null } | null; actions: StatusAction[] };
export type ReceiptPurchaseOrder = { id: string; poNumber: string; status: string; subtotalCents?: number | null; expectedAt?: string | null; orderedQuantity?: number | null; unitCostCents?: number | null; supplier?: NamedRef; inventoryItem?: { id?: string | null; name?: string | null; unit?: string | null } | null };

export type OperationsSections = { inventory: boolean; inventoryManage: boolean; products: boolean; staffing: boolean; payments: boolean; catering: boolean; subscriptions: boolean };

export type CoffeeOperationsData = {
  sections: OperationsSections;
  storeTimezone: string | null;
  draftScope: string;
  recipes: Array<{ id: string; name: string; status: string; yieldQuantity?: number | null; yieldUnit?: string | null; active: boolean; menuItem?: NamedRef }>;
  ingredients: Array<{ id: string; name: string; quantity?: number | null; unit?: string | null; optional: boolean; recipe?: NamedRef; inventoryItem?: NamedRef }>;
  inventoryLots: Array<{ id: string; lotNumber: string; quantityReceived?: number | null; quantityRemaining?: number | null; unitCostCents?: number | null; status: string; expiresAt?: string | null; inventoryItem?: NamedRef; supplier?: NamedRef }>;
  suppliers: Array<{ id: string; name: string; status: string; contactName?: string | null; email?: string | null; phone?: string | null; leadTimeDays?: number | null }>;
  purchaseOrders: Array<{ id: string; poNumber: string; status: string; subtotalCents?: number | null; expectedAt?: string | null; supplier?: NamedRef }>;
  prepBatches: Array<{ id: string; batchNumber: string; status: string; quantityMade?: number | null; recipe?: NamedRef; preparedBy?: NamedRef; expiresAt?: string | null }>;
  wasteLogs: Array<{ id: string; logNumber: string; reason: string; quantity?: number | null; unit?: string | null; costCents?: number | null; inventoryItem?: NamedRef; prepBatch?: { batchNumber: string } | null }>;
  posOrders: Array<{ id: string; receiptNumber: string; registerName?: string | null; status: string; totalCents?: number | null; cashier?: NamedRef }>;
  subscriptions: Array<{ id: string; subscriptionNumber: string; status: string; planName: string; billingInterval: string; priceCents?: number | null }>;
  cateringOrders: Array<{ id: string; cateringNumber: string; customerName: string; status: string; guestCount?: number | null; subtotalCents?: number | null }>;
  recentStaffShifts: StaffShift[];
  receiptPurchaseOrders: Page<ReceiptPurchaseOrder>;
  purchaseSuppliers: Page<OperationsOption>;
  purchaseInventoryItems: Page<OperationsOption>;
  inventoryWasteItems: Page<OperationsOption>;
  wastePrepBatches: Page<OperationsOption>;
  prepRecipes: Page<OperationsOption>;
  staffMembers: Page<OperationsOption>;
  activeStaffShifts: Page<StaffShift> & { totalCount: number | null };
};

export const WASTE_REASON_OPTIONS = [
  { value: "expired", label: "Expired" },
  { value: "damaged", label: "Damaged" },
  { value: "overproduction", label: "Overproduction" },
  { value: "quality", label: "Quality issue" },
] as const;
