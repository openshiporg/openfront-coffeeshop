'use server';

import { revalidatePath } from "next/cache";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { cafeRequest } from "@/features/storefront/lib/data/cafeRequest";
import {
  INVENTORY_PAGE_SIZE,
  INVENTORY_PATH,
  LOW_STOCK_SCAN_CAP,
  MOVEMENT_PAGE_SIZE,
  stockState,
  validateInventoryItemInput,
  type ActionResult,
  type InventoryItemInput,
  type InventoryListView,
} from "../lib/inventory";
import { platformRequest } from "../lib/platformRequest";
import type { InventoryDetailData, InventoryDetailItem, InventoryListData, InventoryListItem, StockMovementRow } from "../lib/types";

const ITEM_FIELDS = "id name category unit currentStock reorderPoint parLevel costPerUnit supplierName sku";

const INVENTORY_LIST_QUERY = `
  query CoffeeInventoryList($where: InventoryItemWhereInput!, $outWhere: InventoryItemWhereInput!, $inStockWhere: InventoryItemWhereInput!, $rowsWhere: InventoryItemWhereInput!, $take: Int!, $skip: Int!, $scanTake: Int!, $includeRows: Boolean!) {
    authenticatedItem { ... on User { id role { canManageInventory } } }
    allCount: inventoryItemsCount(where: $where)
    outCount: inventoryItemsCount(where: $outWhere)
    rows: inventoryItems(where: $rowsWhere, orderBy: [{ name: asc }], take: $take, skip: $skip) @include(if: $includeRows) { ${ITEM_FIELDS} }
    inStock: inventoryItems(where: $inStockWhere, orderBy: [{ name: asc }], take: $scanTake) { ${ITEM_FIELDS} }
    suppliers(where: { status: { equals: "active" } }, orderBy: [{ name: asc }], take: 200) { name }
  }
`;

type ListQueryResult = {
  authenticatedItem: { id: string; role: { canManageInventory: boolean | null } | null } | null;
  allCount: number | null;
  outCount: number | null;
  rows?: InventoryListItem[] | null;
  inStock: InventoryListItem[] | null;
  suppliers: Array<{ name: string | null }> | null;
};

function baseWhere(search: string, category: string) {
  const and: Record<string, unknown>[] = [];
  if (search) and.push({ OR: [{ name: { contains: search, mode: "insensitive" } }, { sku: { contains: search, mode: "insensitive" } }] });
  if (category) and.push({ category: { equals: category } });
  return { AND: and };
}

function supplierNameList(rows: Array<{ name: string | null }> | null | undefined) {
  return [...new Set((rows ?? []).map((row) => row.name?.trim() || "").filter(Boolean))];
}

export async function loadInventoryList(view: InventoryListView): Promise<{ success: true; data: InventoryListData } | { success: false; error: string }> {
  const where = baseWhere(view.search, view.category);
  const skip = (view.page - 1) * INVENTORY_PAGE_SIZE;
  const outWhere = { AND: [where, { currentStock: { lte: "0" } }] };
  const response = await keystoneClient<ListQueryResult>(
    INVENTORY_LIST_QUERY,
    {
      where,
      outWhere,
      rowsWhere: view.stock === "out" ? outWhere : where,
      inStockWhere: { AND: [where, { currentStock: { gt: "0" } }] },
      take: INVENTORY_PAGE_SIZE,
      skip,
      scanTake: LOW_STOCK_SCAN_CAP,
      includeRows: view.stock !== "low",
    },
    { cache: "no-store" },
  );
  if (!response.success) return { success: false, error: response.error };
  const data = response.data;
  // Low compares two fields, which Keystone filters can't do: filter the capped in-stock scan here.
  const low = (data.inStock ?? []).filter((item) => stockState(item.currentStock, item.reorderPoint) === "low");
  const counts = { all: data.allCount ?? 0, out: data.outCount ?? 0, low: low.length };
  let items: InventoryListItem[];
  let total: number;
  if (view.stock === "low") {
    items = low.slice(skip, skip + INVENTORY_PAGE_SIZE);
    total = low.length;
  } else {
    items = data.rows ?? [];
    total = view.stock === "out" ? counts.out : counts.all;
  }
  return {
    success: true,
    data: {
      canManage: Boolean(data.authenticatedItem?.role?.canManageInventory),
      items,
      counts,
      total,
      supplierNames: supplierNameList(data.suppliers),
    },
  };
}

const INVENTORY_DETAIL_QUERY = `
  query CoffeeInventoryDetail($id: ID!, $take: Int!, $skip: Int!) {
    authenticatedItem { ... on User { id role { canManageInventory } } }
    getCoffeeStore { timezone }
    suppliers(where: { status: { equals: "active" } }, orderBy: [{ name: asc }], take: 200) { name }
    inventoryItem(where: { id: $id }) {
      ${ITEM_FIELDS}
      createdAt
      updatedAt
      menuItems(orderBy: [{ name: asc }], take: 50) { id name available price }
      menuItemsCount
      stockMovementsCount
      inventoryLots(orderBy: [{ receivedAt: desc }], take: 50) {
        id lotNumber quantityReceived quantityRemaining unitCostCents receivedAt expiresAt status
        supplier { id name }
        purchaseOrder { id poNumber }
      }
      inventoryLotsCount
      purchaseOrders(orderBy: [{ createdAt: desc }], take: 50) {
        id poNumber status orderedQuantity unitCostCents subtotalCents orderedAt expectedAt receivedAt notes
        supplier { id name }
        inventoryItem { id name unit }
      }
      purchaseOrdersCount
      wasteLogs(orderBy: [{ loggedAt: desc }], take: 25) { id logNumber reason quantity unit costCents loggedAt notes loggedBy { id name } }
      wasteLogsCount
    }
    stockMovements(where: { inventoryItem: { id: { equals: $id } } }, orderBy: [{ createdAt: desc }], take: $take, skip: $skip) {
      id type quantity reason notes createdAt
      createdBy { id name }
      order { id orderNumber }
      purchaseOrder { id poNumber }
      inventoryLot { id lotNumber }
      prepBatch { id batchNumber }
      wasteLog { id logNumber }
    }
  }
`;

const SUPPLIER_BY_NAME_QUERY = `
  query CoffeeInventorySupplierByName($name: String!) {
    suppliers(where: { name: { equals: $name, mode: insensitive } }, take: 1) { id name }
  }
`;

type DetailQueryResult = {
  authenticatedItem: { id: string; role: { canManageInventory: boolean | null } | null } | null;
  getCoffeeStore: { timezone: string | null } | null;
  suppliers: Array<{ name: string | null }> | null;
  inventoryItem: InventoryDetailItem | null;
  stockMovements: StockMovementRow[] | null;
};

export async function loadInventoryDetail(id: string, movementPage: number): Promise<{ success: true; data: InventoryDetailData } | { success: false; error: string }> {
  const response = await keystoneClient<DetailQueryResult>(
    INVENTORY_DETAIL_QUERY,
    { id, take: MOVEMENT_PAGE_SIZE, skip: (movementPage - 1) * MOVEMENT_PAGE_SIZE },
    { cache: "no-store" },
  );
  if (!response.success) return { success: false, error: response.error };
  const { inventoryItem: item } = response.data;
  let supplier: InventoryDetailData["supplier"] = null;
  const supplierName = item?.supplierName?.trim();
  if (supplierName) {
    const match = await keystoneClient<{ suppliers: Array<{ id: string; name: string | null }> | null }>(SUPPLIER_BY_NAME_QUERY, { name: supplierName }, { cache: "no-store" });
    supplier = match.success ? match.data.suppliers?.[0] ?? null : null;
  }
  const hasHistory = Boolean(item) && (
    Number(item!.currentStock ?? 0) !== 0 || Boolean(item!.stockMovementsCount) || Boolean(item!.inventoryLotsCount) || Boolean(item!.purchaseOrdersCount)
  );
  return {
    success: true,
    data: {
      canManage: Boolean(response.data.authenticatedItem?.role?.canManageInventory),
      item,
      movements: response.data.stockMovements ?? [],
      hasHistory,
      supplier,
      supplierNames: supplierNameList(response.data.suppliers),
      storeTimezone: response.data.getCoffeeStore?.timezone ?? null,
    },
  };
}

const CREATE_INVENTORY_ITEM = `
  mutation CreateCoffeeInventoryItem($data: InventoryItemCreateInput!) {
    createInventoryItem(data: $data) { id }
  }
`;

const UPDATE_INVENTORY_ITEM = `
  mutation UpdateCoffeeInventoryItem($id: ID!, $data: InventoryItemUpdateInput!) {
    updateInventoryItem(where: { id: $id }, data: $data) { id }
  }
`;

export async function saveInventoryItem(input: InventoryItemInput, options: { unitLocked?: boolean } = {}): Promise<ActionResult> {
  const parsed = validateInventoryItemInput(input);
  if (!parsed.data) return { success: false, error: "Check the highlighted fields.", fieldErrors: parsed.errors as Record<string, string> };
  if (input.id) {
    // The unit is sent only when the drawer allowed changing it; the server still refuses a change once the item has history.
    const data: Partial<typeof parsed.data> = { ...parsed.data };
    if (options.unitLocked) delete data.unit;
    const result = await platformRequest<{ updateInventoryItem: { id: string } | null }>(UPDATE_INVENTORY_ITEM, { id: input.id, data });
    if (!result.success) return { success: false, error: result.error };
    revalidatePath(INVENTORY_PATH);
    revalidatePath(`${INVENTORY_PATH}/${input.id}`);
    return { success: true, id: input.id };
  }
  // The store relationship defaults to the primary store on create.
  const result = await platformRequest<{ createInventoryItem: { id: string } | null }>(CREATE_INVENTORY_ITEM, { data: parsed.data });
  if (!result.success) return { success: false, error: result.error };
  revalidatePath(INVENTORY_PATH);
  return { success: true, id: result.data.createInventoryItem?.id };
}

const CANCEL_PURCHASE_ORDER = `
  mutation CancelCoffeePurchaseOrder($purchaseOrderId: ID!, $reason: String) {
    cancelCoffeePurchaseOrder(purchaseOrderId: $purchaseOrderId, reason: $reason) { id status }
  }
`;

export async function cancelPurchaseOrder(purchaseOrderId: string, reason: string, revalidate: string[] = []): Promise<ActionResult> {
  if (!purchaseOrderId) return { success: false, error: "Purchase order not found." };
  const result = await cafeRequest<{ cancelCoffeePurchaseOrder: { id: string; status: string } }>(CANCEL_PURCHASE_ORDER, {
    purchaseOrderId,
    reason: reason.trim().slice(0, 500) || null,
  });
  if (!result.success) return { success: false, error: result.error };
  for (const path of revalidate) {
    if (path.startsWith("/dashboard/platform/inventory") || path.startsWith("/dashboard/platform/suppliers")) revalidatePath(path);
  }
  revalidatePath("/dashboard/platform/coffee-operations");
  return { success: true, id: result.data.cancelCoffeePurchaseOrder.id };
}
