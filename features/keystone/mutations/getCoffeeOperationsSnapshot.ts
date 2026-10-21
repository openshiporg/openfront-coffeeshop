import { createHash } from "node:crypto";

import { permissions, type Session } from "../access";

type Row = Record<string, unknown> & { id: string };
type ListModel = { findMany(args: Record<string, unknown>): Promise<Row[]>; count?(args: Record<string, unknown>): Promise<number> };
type Context = {
  session?: Session;
  prisma: {
    storeSetting: { findUnique(args: Record<string, unknown>): Promise<{ id: string; timezone?: unknown } | null> };
    user: ListModel;
    recipe: ListModel;
    ingredient: ListModel;
    inventoryItem: ListModel;
    inventoryLot: ListModel;
    supplier: ListModel;
    purchaseOrder: ListModel;
    prepBatch: ListModel;
    staffShift: ListModel & { count(args: Record<string, unknown>): Promise<number> };
    posOrder: ListModel;
    subscription: ListModel;
    cateringOrder: ListModel;
    wasteLog: ListModel;
  };
};

export type OperationsArgs = Partial<Record<
  | "receiptCursor"
  | "purchaseSupplierSearch" | "purchaseSupplierCursor"
  | "purchaseInventorySearch" | "purchaseInventoryCursor"
  | "inventoryWasteSearch" | "inventoryWasteCursor"
  | "prepBatchSearch" | "prepBatchCursor"
  | "recipeSearch" | "recipeCursor"
  | "staffSearch" | "staffCursor"
  | "shiftCursor",
  string | null
>>;

type Option = { id: string; name: string; detail: string | null; unit: string | null; currentStock: number | null };
type Page<T> = { items: T[]; hasMore: boolean; nextCursor: string | null; loadError: boolean };

const OPTION_PAGE_SIZE = 100;
const RECEIPT_PAGE_SIZE = 50;
const SHIFT_PAGE_SIZE = 25;
const RECENT = 8;
const CURSOR_MAX_LENGTH = 2048;
const emptyPage = <T>(loadError = false): Page<T> => ({ items: [], hasMore: false, nextCursor: null, loadError });

function text(value: unknown, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function toNumber(value: unknown) {
  const parsed = Number(value == null ? NaN : String(value));
  return Number.isFinite(parsed) ? parsed : null;
}

function encodeCursor(payload: Record<string, unknown>) {
  const cursor = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  if (cursor.length > CURSOR_MAX_LENGTH) throw new Error("Cannot continue this list");
  return cursor;
}
/** Cursors are bound to the list, store and search they were issued for. */
function decodeCursor(value: unknown, binding: { kind: string; storeId: string; search?: string }) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.length > CURSOR_MAX_LENGTH) throw new Error("Invalid list position");
  const bytes = Buffer.from(value, "base64url");
  if (!bytes.length || bytes.toString("base64url") !== value) throw new Error("Invalid list position");
  const parsed: unknown = JSON.parse(bytes.toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid list position");
  const cursor = parsed as Record<string, unknown>;
  if (cursor.kind !== binding.kind || cursor.storeId !== binding.storeId || (cursor.search ?? "") !== (binding.search ?? "")) throw new Error("Invalid list position");
  if (typeof cursor.id !== "string" || !cursor.id || cursor.id.length > 255) throw new Error("Invalid list position");
  return cursor;
}

/** Keyset page ordered by a text field then id. Filters/search are applied before the limit. */
async function namePage<T>(input: {
  model: ListModel;
  kind: string;
  storeId: string;
  where: Record<string, unknown>;
  orderField: string;
  search: string;
  searchWhere?: (search: string) => Record<string, unknown>;
  cursor: unknown;
  select: Record<string, unknown>;
  map: (row: Row) => T;
  pageSize?: number;
}): Promise<Page<T>> {
  const pageSize = input.pageSize ?? OPTION_PAGE_SIZE;
  try {
    const cursor = decodeCursor(input.cursor, { kind: input.kind, storeId: input.storeId, search: input.search });
    const and: Array<Record<string, unknown>> = [];
    if (input.search && input.searchWhere) and.push(input.searchWhere(input.search));
    if (cursor) {
      if (typeof cursor.key !== "string") throw new Error("Invalid list position");
      and.push({ OR: [{ [input.orderField]: { gt: cursor.key } }, { [input.orderField]: cursor.key, id: { gt: cursor.id } }] });
    }
    const rows = await input.model.findMany({
      where: { ...input.where, ...(and.length ? { AND: and } : {}) },
      orderBy: [{ [input.orderField]: "asc" }, { id: "asc" }],
      take: pageSize + 1,
      select: { ...input.select, id: true, [input.orderField]: true },
    });
    const page = rows.slice(0, pageSize);
    const hasMore = rows.length > pageSize;
    const last = page[page.length - 1];
    return {
      items: page.map(input.map),
      hasMore,
      nextCursor: hasMore && last ? encodeCursor({ kind: input.kind, storeId: input.storeId, search: input.search, key: String(last[input.orderField] ?? ""), id: last.id }) : null,
      loadError: false,
    };
  } catch {
    return emptyPage<T>(true);
  }
}

/** Keyset page ordered by createdAt then id (oldest first) for worklists. */
async function createdPage<T>(input: { model: ListModel; kind: string; storeId: string; where: Record<string, unknown>; cursor: unknown; select: Record<string, unknown>; map: (row: Row) => T; pageSize: number }): Promise<Page<T>> {
  try {
    const cursor = decodeCursor(input.cursor, { kind: input.kind, storeId: input.storeId });
    let after: Record<string, unknown> | null = null;
    if (cursor) {
      const createdAt = typeof cursor.createdAt === "string" ? new Date(cursor.createdAt) : null;
      if (!createdAt || !Number.isFinite(createdAt.getTime()) || createdAt.toISOString() !== cursor.createdAt) throw new Error("Invalid list position");
      after = { OR: [{ createdAt: { gt: createdAt } }, { createdAt, id: { gt: cursor.id } }] };
    }
    const rows = await input.model.findMany({
      where: { ...input.where, ...(after ? { AND: [after] } : {}) },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: input.pageSize + 1,
      select: { ...input.select, id: true, createdAt: true },
    });
    const page = rows.slice(0, input.pageSize);
    const hasMore = rows.length > input.pageSize;
    const last = page[page.length - 1];
    const lastCreated = last?.createdAt instanceof Date ? last.createdAt : last ? new Date(String(last.createdAt)) : null;
    return {
      items: page.map(input.map),
      hasMore,
      nextCursor: hasMore && last && lastCreated ? encodeCursor({ kind: input.kind, storeId: input.storeId, createdAt: lastCreated.toISOString(), id: last.id }) : null,
      loadError: false,
    };
  } catch {
    return emptyPage<T>(true);
  }
}

const contains = (field: string) => (search: string) => ({ [field]: { contains: search, mode: "insensitive" } });

function staffShiftRow(shift: Row) {
  const actions = shift.status === "scheduled"
    ? [{ status: "clocked_in", label: "Clock in", tone: "default" }]
    : shift.status === "clocked_in" ? [{ status: "completed", label: "Clock out", tone: "default" }] : [];
  return { ...shift, actions };
}
const shiftSelect = { id: true, storeId: true, shiftNumber: true, role: true, status: true, startsAt: true, endsAt: true, clockInAt: true, clockOutAt: true, staff: { select: { id: true, name: true, email: true } } };

/** Capability-sized Operations projection: each section is read only when the caller holds
 * the capability its task needs. Unauthorized sections are reported as absent, never as empty.
 */
export default async function getCoffeeOperations(_root: unknown, rawArgs: unknown, context: Context) {
  const session = { session: context.session };
  const sections = {
    inventory: permissions.canReadInventory(session),
    inventoryManage: permissions.canManageInventory(session),
    products: permissions.canReadProducts(session),
    staffing: permissions.canManageSettings(session),
    payments: permissions.canReadPayments(session),
    catering: permissions.canReadOrders(session),
    subscriptions: permissions.canReadLoyalty(session),
  };
  if (!permissions.canAccessDashboard(session) || !Object.values(sections).some(Boolean)) throw new Error("Not authorized to view Coffee Operations");
  const store = await context.prisma.storeSetting.findUnique({ where: { singletonKey: "primary" }, select: { id: true, timezone: true } });
  if (!store) throw new Error("Primary coffee store is not configured");
  const storeId = store.id;
  const where = { storeId };
  const recent = { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: RECENT };
  const args = rawArgs && typeof rawArgs === "object" ? rawArgs as OperationsArgs : {};
  const none = <T>() => Promise.resolve([] as T[]);
  const noPage = <T>() => Promise.resolve(emptyPage<T>());
  const optionMap = (row: Row): Option => ({ id: row.id, name: String(row.name ?? ""), detail: null, unit: null, currentStock: null });

  const searches = {
    purchaseSupplier: text(args.purchaseSupplierSearch),
    purchaseInventory: text(args.purchaseInventorySearch),
    inventoryWaste: text(args.inventoryWasteSearch),
    prepBatch: text(args.prepBatchSearch),
    recipe: text(args.recipeSearch),
    staff: text(args.staffSearch),
  };

  const [
    recipes, ingredients, inventoryLots, suppliers, purchaseOrders, prepBatches, wasteLogs,
    posOrders, subscriptions, cateringOrders, recentStaffShifts,
    receiptPurchaseOrders, purchaseSuppliers, purchaseInventoryItems, inventoryWasteItems, wastePrepBatches, prepRecipes,
    staffMembers, activeStaffShifts, activeStaffShiftCount,
  ] = await Promise.all([
    sections.products ? context.prisma.recipe.findMany({ where, ...recent, select: { id: true, name: true, status: true, yieldQuantity: true, yieldUnit: true, active: true, menuItem: { select: { id: true, name: true } } } }) : none<Row>(),
    sections.products ? context.prisma.ingredient.findMany({ where, ...recent, select: { id: true, name: true, quantity: true, unit: true, optional: true, recipe: { select: { id: true, name: true } }, inventoryItem: { select: { id: true, name: true } } } }) : none<Row>(),
    sections.inventory ? context.prisma.inventoryLot.findMany({ where, ...recent, select: { id: true, lotNumber: true, quantityReceived: true, quantityRemaining: true, unitCostCents: true, status: true, expiresAt: true, inventoryItem: { select: { id: true, name: true } }, supplier: { select: { id: true, name: true } } } }) : none<Row>(),
    sections.inventory ? context.prisma.supplier.findMany({ where, ...recent, select: { id: true, name: true, status: true, contactName: true, email: true, phone: true, leadTimeDays: true } }) : none<Row>(),
    sections.inventory ? context.prisma.purchaseOrder.findMany({ where, ...recent, select: { id: true, poNumber: true, status: true, subtotalCents: true, expectedAt: true, supplier: { select: { id: true, name: true } } } }) : none<Row>(),
    sections.inventory ? context.prisma.prepBatch.findMany({ where, ...recent, select: { id: true, batchNumber: true, status: true, quantityMade: true, expiresAt: true, recipe: { select: { id: true, name: true } }, preparedBy: { select: { id: true, name: true } } } }) : none<Row>(),
    sections.inventory ? context.prisma.wasteLog.findMany({ where, ...recent, select: { id: true, logNumber: true, reason: true, quantity: true, unit: true, costCents: true, inventoryItem: { select: { id: true, name: true } }, prepBatch: { select: { batchNumber: true } } } }) : none<Row>(),
    sections.payments ? context.prisma.posOrder.findMany({ where, ...recent, select: { id: true, receiptNumber: true, registerName: true, status: true, subtotalCents: true, taxCents: true, tipCents: true, totalCents: true, cashier: { select: { id: true, name: true } } } }) : none<Row>(),
    sections.subscriptions ? context.prisma.subscription.findMany({ where, ...recent, select: { id: true, subscriptionNumber: true, status: true, planName: true, billingInterval: true, priceCents: true, renewsAt: true } }) : none<Row>(),
    sections.catering ? context.prisma.cateringOrder.findMany({ where, ...recent, select: { id: true, cateringNumber: true, customerName: true, customerEmail: true, status: true, eventAt: true, guestCount: true, subtotalCents: true } }) : none<Row>(),
    sections.staffing ? context.prisma.staffShift.findMany({ where: { storeId, status: { in: ["completed", "missed"] } }, ...recent, select: shiftSelect }) : none<Row>(),

    sections.inventoryManage ? createdPage({
      model: context.prisma.purchaseOrder, kind: "receipt-purchase-orders", storeId, where: { storeId, status: "submitted" }, cursor: args.receiptCursor, pageSize: RECEIPT_PAGE_SIZE,
      select: { poNumber: true, status: true, subtotalCents: true, expectedAt: true, orderedQuantity: true, unitCostCents: true, supplier: { select: { id: true, name: true } }, inventoryItem: { select: { id: true, name: true, unit: true } } },
      map: (row) => ({ ...row, orderedQuantity: toNumber(row.orderedQuantity) }),
    }) : noPage<Row>(),
    sections.inventoryManage ? namePage({
      model: context.prisma.supplier, kind: "active-suppliers", storeId, where: { storeId, status: "active" }, orderField: "name", search: searches.purchaseSupplier, searchWhere: contains("name"), cursor: args.purchaseSupplierCursor, select: { name: true }, map: optionMap,
    }) : noPage<Option>(),
    sections.inventoryManage ? namePage({
      model: context.prisma.inventoryItem, kind: "purchase-inventory-items", storeId, where: { storeId }, orderField: "name", search: searches.purchaseInventory, searchWhere: contains("name"), cursor: args.purchaseInventoryCursor,
      select: { name: true, unit: true }, map: (row) => ({ ...optionMap(row), unit: typeof row.unit === "string" ? row.unit : null }),
    }) : noPage<Option>(),
    sections.inventoryManage ? namePage({
      model: context.prisma.inventoryItem, kind: "positive-stock-inventory", storeId, where: { storeId, currentStock: { gt: 0 } }, orderField: "name", search: searches.inventoryWaste, searchWhere: contains("name"), cursor: args.inventoryWasteCursor,
      select: { name: true, unit: true, currentStock: true }, map: (row) => ({ ...optionMap(row), unit: typeof row.unit === "string" ? row.unit : null, currentStock: toNumber(row.currentStock) }),
    }) : noPage<Option>(),
    sections.inventoryManage ? namePage({
      model: context.prisma.prepBatch, kind: "waste-prep-batches", storeId, where: { storeId, status: "completed", quantityRemaining: { gt: 0 } }, orderField: "batchNumber", search: searches.prepBatch,
      searchWhere: (search) => ({ OR: [{ batchNumber: { contains: search, mode: "insensitive" } }, { recipe: { is: { name: { contains: search, mode: "insensitive" } } } }] }),
      cursor: args.prepBatchCursor, select: { quantityRemaining: true, recipe: { select: { name: true, yieldUnit: true } } },
      map: (row) => {
        const recipe = row.recipe as Record<string, unknown> | null;
        const unit = typeof recipe?.yieldUnit === "string" ? recipe.yieldUnit : null;
        return { id: row.id, name: String(row.batchNumber ?? ""), detail: typeof recipe?.name === "string" ? recipe.name : null, unit, currentStock: toNumber(row.quantityRemaining) };
      },
    }) : noPage<Option>(),
    sections.inventoryManage ? namePage({
      model: context.prisma.recipe, kind: "prep-recipes", storeId, where: { storeId, active: true, status: "active" }, orderField: "name", search: searches.recipe, searchWhere: contains("name"), cursor: args.recipeCursor,
      select: { name: true, yieldQuantity: true, yieldUnit: true }, map: (row) => ({ ...optionMap(row), unit: typeof row.yieldUnit === "string" ? row.yieldUnit : null, detail: row.yieldQuantity == null ? null : `Yields ${String(toNumber(row.yieldQuantity) ?? "")} ${String(row.yieldUnit ?? "")}`.trim() }),
    }) : noPage<Option>(),
    // Staff are dashboard accounts in this single-cafe deployment; the scheduler holds the same authority as the command.
    sections.staffing ? namePage({
      model: context.prisma.user, kind: "staff-members", storeId, where: { role: { is: { canAccessDashboard: true } } }, orderField: "name", search: searches.staff,
      searchWhere: (search) => ({ OR: [{ name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }] }),
      cursor: args.staffCursor, select: { name: true, email: true }, map: (row) => ({ ...optionMap(row), name: String(row.name || row.email || "Staff member"), detail: typeof row.email === "string" ? row.email : null }),
    }) : noPage<Option>(),
    sections.staffing ? createdPage({
      model: context.prisma.staffShift, kind: "active-staff-shifts", storeId, where: { storeId, status: { in: ["scheduled", "clocked_in"] } }, cursor: args.shiftCursor, pageSize: SHIFT_PAGE_SIZE, select: shiftSelect, map: staffShiftRow,
    }) : noPage<Row>(),
    sections.staffing ? context.prisma.staffShift.count({ where: { storeId, status: { in: ["scheduled", "clocked_in"] } } }).catch(() => null) : Promise.resolve(null),
  ]);

  return {
    sections,
    storeTimezone: typeof store.timezone === "string" ? store.timezone : null,
    // Partitions this browser's unsaved drafts by account and store; not an authorization token.
    draftScope: createHash("sha256").update(`coffee-operations:${context.session?.itemId ?? ""}:${storeId}`).digest("hex").slice(0, 24),
    recipes,
    ingredients,
    inventoryLots,
    suppliers,
    purchaseOrders,
    prepBatches,
    wasteLogs,
    posOrders,
    subscriptions: subscriptions.map((subscription) => ({ ...subscription, actions: [] })),
    cateringOrders: cateringOrders.map((order) => ({ ...order, actions: [] })),
    recentStaffShifts: recentStaffShifts.map(staffShiftRow),
    receiptPurchaseOrders,
    purchaseSuppliers,
    purchaseInventoryItems,
    inventoryWasteItems,
    wastePrepBatches,
    prepRecipes,
    staffMembers,
    activeStaffShifts: { ...activeStaffShifts, totalCount: activeStaffShiftCount },
  };
}
