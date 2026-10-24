'use server';

import { revalidatePath } from "next/cache";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import type { ActionResult } from "@/features/platform/inventory/lib/inventory";
import { platformRequest } from "@/features/platform/inventory/lib/platformRequest";
import type { InventoryListItem, InventoryLotRow, PurchaseOrderRow } from "@/features/platform/inventory/lib/types";
import {
  SUPPLIER_PAGE_SIZE,
  SUPPLIER_PO_PAGE_SIZE,
  SUPPLIER_STATUSES,
  SUPPLIERS_PATH,
  validateSupplierInput,
  type PoStatusFilter,
  type SupplierInput,
  type SupplierListView,
  type SupplierRow,
  type SupplierDetailPayload,
  type SupplierStatusFilter,
} from "../lib/suppliers";

const SUPPLIER_FIELDS = "id name status contactName email phone website leadTimeDays notes createdAt updatedAt";

const SUPPLIER_LIST_QUERY = `
  query CoffeeSupplierList($where: SupplierWhereInput!, $rowsWhere: SupplierWhereInput!, $take: Int!, $skip: Int!) {
    authenticatedItem { ... on User { id role { canManageInventory } } }
    all: suppliersCount(where: $where)
    active: suppliersCount(where: { AND: [$where, { status: { equals: "active" } }] })
    paused: suppliersCount(where: { AND: [$where, { status: { equals: "paused" } }] })
    archived: suppliersCount(where: { AND: [$where, { status: { equals: "archived" } }] })
    suppliers(where: $rowsWhere, orderBy: [{ name: asc }], take: $take, skip: $skip) { ${SUPPLIER_FIELDS} }
  }
`;

type SupplierListResult = {
  authenticatedItem: { id: string; role: { canManageInventory: boolean | null } | null } | null;
  all: number | null;
  active: number | null;
  paused: number | null;
  archived: number | null;
  suppliers: SupplierRow[] | null;
};

export async function loadSupplierList(view: SupplierListView): Promise<
  | { success: true; data: { canManage: boolean; suppliers: SupplierRow[]; counts: Record<SupplierStatusFilter, number> } }
  | { success: false; error: string }
> {
  const search = view.search;
  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { contactName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};
  const rowsWhere = view.status === "all" ? where : { AND: [where, { status: { equals: view.status } }] };
  const response = await keystoneClient<SupplierListResult>(
    SUPPLIER_LIST_QUERY,
    { where, rowsWhere, take: SUPPLIER_PAGE_SIZE, skip: (view.page - 1) * SUPPLIER_PAGE_SIZE },
    { cache: "no-store" },
  );
  if (!response.success) return { success: false, error: response.error };
  const data = response.data;
  return {
    success: true,
    data: {
      canManage: Boolean(data.authenticatedItem?.role?.canManageInventory),
      suppliers: data.suppliers ?? [],
      counts: { all: data.all ?? 0, active: data.active ?? 0, paused: data.paused ?? 0, archived: data.archived ?? 0 },
    },
  };
}

const PO_FIELDS = `
  id poNumber status orderedQuantity unitCostCents subtotalCents orderedAt expectedAt receivedAt notes
  supplier { id name }
  inventoryItem { id name unit }
`;

const SUPPLIER_DETAIL_QUERY = `
  query CoffeeSupplierDetail($id: ID!, $poWhere: PurchaseOrderWhereInput!, $poTake: Int!, $poSkip: Int!) {
    authenticatedItem { ... on User { id role { canManageInventory } } }
    getCoffeeStore { timezone }
    supplier(where: { id: $id }) { ${SUPPLIER_FIELDS} }
    poAll: purchaseOrdersCount(where: { supplier: { id: { equals: $id } } })
    poSubmitted: purchaseOrdersCount(where: { supplier: { id: { equals: $id } }, status: { equals: "submitted" } })
    poReceived: purchaseOrdersCount(where: { supplier: { id: { equals: $id } }, status: { equals: "received" } })
    poCancelled: purchaseOrdersCount(where: { supplier: { id: { equals: $id } }, status: { equals: "cancelled" } })
    poDraft: purchaseOrdersCount(where: { supplier: { id: { equals: $id } }, status: { equals: "draft" } })
    purchaseOrders(where: $poWhere, orderBy: [{ createdAt: desc }], take: $poTake, skip: $poSkip) { ${PO_FIELDS} }
    lotsCount: inventoryLotsCount(where: { supplier: { id: { equals: $id } } })
    inventoryLots(where: { supplier: { id: { equals: $id } } }, orderBy: [{ receivedAt: desc }], take: 50) {
      id lotNumber quantityReceived quantityRemaining unitCostCents receivedAt expiresAt status
      supplier { id name }
      inventoryItem { id name unit }
      purchaseOrder { id poNumber }
    }
  }
`;

const SUPPLIER_ITEMS_QUERY = `
  query CoffeeSupplierItems($name: String!) {
    inventoryItemsCount(where: { supplierName: { equals: $name, mode: insensitive } })
    inventoryItems(where: { supplierName: { equals: $name, mode: insensitive } }, orderBy: [{ name: asc }], take: 50) {
      id name category unit currentStock reorderPoint parLevel costPerUnit supplierName sku
    }
  }
`;

type SupplierDetailResult = {
  authenticatedItem: { id: string; role: { canManageInventory: boolean | null } | null } | null;
  getCoffeeStore: { timezone: string | null } | null;
  supplier: SupplierRow | null;
  poAll: number | null;
  poSubmitted: number | null;
  poReceived: number | null;
  poCancelled: number | null;
  poDraft: number | null;
  purchaseOrders: PurchaseOrderRow[] | null;
  lotsCount: number | null;
  inventoryLots: InventoryLotRow[] | null;
};

export async function loadSupplierDetail(id: string, po: PoStatusFilter, poPage: number): Promise<{ success: true; data: SupplierDetailPayload } | { success: false; error: string }> {
  const poWhere = po === "all" ? { supplier: { id: { equals: id } } } : { supplier: { id: { equals: id } }, status: { equals: po } };
  const response = await keystoneClient<SupplierDetailResult>(
    SUPPLIER_DETAIL_QUERY,
    { id, poWhere, poTake: SUPPLIER_PO_PAGE_SIZE, poSkip: (poPage - 1) * SUPPLIER_PO_PAGE_SIZE },
    { cache: "no-store" },
  );
  if (!response.success) return { success: false, error: response.error };
  const data = response.data;
  let items: InventoryListItem[] = [];
  let itemsCount = 0;
  const name = data.supplier?.name?.trim();
  if (name) {
    const itemsResponse = await keystoneClient<{ inventoryItemsCount: number | null; inventoryItems: InventoryListItem[] | null }>(SUPPLIER_ITEMS_QUERY, { name }, { cache: "no-store" });
    if (itemsResponse.success) {
      items = itemsResponse.data.inventoryItems ?? [];
      itemsCount = itemsResponse.data.inventoryItemsCount ?? items.length;
    }
  }
  return {
    success: true,
    data: {
      canManage: Boolean(data.authenticatedItem?.role?.canManageInventory),
      storeTimezone: data.getCoffeeStore?.timezone ?? null,
      supplier: data.supplier,
      poCounts: { all: data.poAll ?? 0, submitted: data.poSubmitted ?? 0, received: data.poReceived ?? 0, cancelled: data.poCancelled ?? 0, draft: data.poDraft ?? 0 },
      purchaseOrders: data.purchaseOrders ?? [],
      lots: data.inventoryLots ?? [],
      lotsCount: data.lotsCount ?? 0,
      items,
      itemsCount,
    },
  };
}

const CREATE_SUPPLIER = `
  mutation CreateCoffeeSupplier($data: SupplierCreateInput!) {
    createSupplier(data: $data) { id }
  }
`;

const UPDATE_SUPPLIER = `
  mutation UpdateCoffeeSupplier($id: ID!, $data: SupplierUpdateInput!) {
    updateSupplier(where: { id: $id }, data: $data) { id status }
  }
`;

const DELETE_SUPPLIER = `
  mutation DeleteCoffeeSupplier($id: ID!) {
    deleteSupplier(where: { id: $id }) { id }
  }
`;

function revalidateSupplier(id?: string | null) {
  revalidatePath(SUPPLIERS_PATH);
  if (id) revalidatePath(`${SUPPLIERS_PATH}/${id}`);
  revalidatePath("/dashboard/platform/inventory");
}

export async function saveSupplier(input: SupplierInput): Promise<ActionResult> {
  const parsed = validateSupplierInput(input);
  if (!parsed.data) return { success: false, error: "Check the highlighted fields.", fieldErrors: parsed.errors as Record<string, string> };
  if (input.id) {
    const result = await platformRequest<{ updateSupplier: { id: string } | null }>(UPDATE_SUPPLIER, { id: input.id, data: parsed.data });
    if (!result.success) return { success: false, error: result.error };
    revalidateSupplier(input.id);
    return { success: true, id: input.id };
  }
  const result = await platformRequest<{ createSupplier: { id: string } | null }>(CREATE_SUPPLIER, { data: parsed.data });
  if (!result.success) return { success: false, error: result.error };
  revalidateSupplier(result.data.createSupplier?.id);
  return { success: true, id: result.data.createSupplier?.id };
}

export async function setSupplierStatus(id: string, status: string): Promise<ActionResult> {
  if (!(SUPPLIER_STATUSES as readonly string[]).includes(status)) return { success: false, error: "Unknown status." };
  const result = await platformRequest<{ updateSupplier: { id: string } | null }>(UPDATE_SUPPLIER, { id, data: { status } });
  if (!result.success) return { success: false, error: result.error };
  revalidateSupplier(id);
  return { success: true, id };
}

export async function deleteSupplier(id: string): Promise<ActionResult> {
  const result = await platformRequest<{ deleteSupplier: { id: string } | null }>(DELETE_SUPPLIER, { id });
  if (!result.success) return { success: false, error: result.error };
  revalidatePath(SUPPLIERS_PATH);
  return { success: true };
}
