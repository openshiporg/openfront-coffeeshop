import type { StockFilter } from "./inventory";

export type NamedRef = { id: string; name?: string | null } | null;

export type InventoryListItem = {
  id: string;
  name: string | null;
  category: string | null;
  unit: string | null;
  currentStock: string | null;
  reorderPoint: string | null;
  parLevel: string | null;
  costPerUnit: number | null;
  supplierName: string | null;
  sku: string | null;
};

export type InventoryListData = {
  canManage: boolean;
  items: InventoryListItem[];
  counts: Record<StockFilter, number>;
  /** Total rows in the current tab, for paging. */
  total: number;
  supplierNames: string[];
};

export type StockMovementRow = {
  id: string;
  type: string | null;
  quantity: string | null;
  reason: string | null;
  notes: string | null;
  createdAt: string | null;
  createdBy: { id: string; name: string | null } | null;
  order: { id: string; orderNumber: string | null } | null;
  purchaseOrder: { id: string; poNumber: string | null } | null;
  inventoryLot: { id: string; lotNumber: string | null } | null;
  prepBatch: { id: string; batchNumber: string | null } | null;
  wasteLog: { id: string; logNumber: string | null } | null;
};

export type InventoryLotRow = {
  id: string;
  lotNumber: string | null;
  quantityReceived: string | null;
  quantityRemaining: string | null;
  unitCostCents: number | null;
  receivedAt: string | null;
  expiresAt: string | null;
  status: string | null;
  supplier: NamedRef;
  inventoryItem?: { id: string; name: string | null; unit: string | null } | null;
  purchaseOrder?: { id: string; poNumber: string | null } | null;
};

export type PurchaseOrderRow = {
  id: string;
  poNumber: string | null;
  status: string | null;
  orderedQuantity: string | null;
  unitCostCents: number | null;
  subtotalCents: number | null;
  orderedAt: string | null;
  expectedAt: string | null;
  receivedAt: string | null;
  notes: string | null;
  supplier: NamedRef;
  inventoryItem: { id: string; name: string | null; unit: string | null } | null;
};

export type WasteLogRow = {
  id: string;
  logNumber: string | null;
  reason: string | null;
  quantity: string | null;
  unit: string | null;
  costCents: number | null;
  loggedAt: string | null;
  notes: string | null;
  loggedBy: { id: string; name: string | null } | null;
};

export type InventoryDetailItem = InventoryListItem & {
  createdAt: string | null;
  updatedAt: string | null;
  menuItems: Array<{ id: string; name: string | null; available: boolean | null; price: number | null }>;
  menuItemsCount: number | null;
  stockMovementsCount: number | null;
  inventoryLots: InventoryLotRow[];
  inventoryLotsCount: number | null;
  purchaseOrders: PurchaseOrderRow[];
  purchaseOrdersCount: number | null;
  wasteLogs: WasteLogRow[];
  wasteLogsCount: number | null;
};

export type InventoryDetailData = {
  canManage: boolean;
  item: InventoryDetailItem | null;
  movements: StockMovementRow[];
  hasHistory: boolean;
  supplier: { id: string; name: string | null } | null;
  supplierNames: string[];
  storeTimezone: string | null;
};
