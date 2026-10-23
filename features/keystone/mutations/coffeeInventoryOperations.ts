import { createHash } from "node:crypto";

import { permissions, type Session } from "../access";
import { assertCoffeeStoreOwnership, enqueueCoffeeDomainEvent } from "../lib/coffeeDomainOutbox";
import { validCoffeeTimezone } from "../lib/store-locale-policy";
import { isBusinessDate, storeDayStart } from "../../platform/reports/lib/businessDate";
import { requireCurrentCoffeeCapability } from "./coffeeKdsAuthority";
import { buildScopedIdempotencyKey, fingerprintInput, normalizeIdempotencyKey } from "./idempotency";
import { consumeActiveInventoryLots, planStockCount, stockCostCents, stockDecimal, stockNumber, stockUnits, storedStockUnits, STOCK_SCALE } from "./inventoryLots";

type Context = {
  session?: Session;
  prisma: { $transaction<T>(fn: (tx: unknown) => Promise<T>, options: Record<string, unknown>): Promise<T> };
};
type TransactionClient = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  user: { findUnique(args: Record<string, unknown>): Promise<{ id: string; roleId: string | null } | null> };
  role: { findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null> };
  purchaseOrder: {
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  supplier: { findUnique(args: Record<string, unknown>): Promise<{ id: string; storeId: string; status: string | null } | null> };
  inventoryItem: {
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  inventoryLot: {
    findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    findMany(args: Record<string, unknown>): Promise<Array<{ id: string; quantityRemaining: unknown }>>;
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    update(args: Record<string, unknown>): Promise<unknown>;
  };
  stockMovement: { create(args: Record<string, unknown>): Promise<Record<string, unknown>> };
  recipe: { findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null> };
  prepBatch: {
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
    update(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  wasteLog: {
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  storeSetting: { findUnique(args: Record<string, unknown>): Promise<{ id: string; timezone?: unknown } | null> };
  coffeeDomainEvent: { findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null> };
};

const TX_OPTIONS = { maxWait: 5000, timeout: 10000, isolationLevel: "Serializable" };
const MAX_RETRIES = 3;
const MAX_INT = 2_147_483_647;
export const WASTE_REASONS = ["expired", "damaged", "overproduction", "quality"] as const;
const WASTE_REASON_SET = new Set<string>(WASTE_REASONS);
/** Output units that a sale can draw one-for-one from a prepared batch. */
const COUNTED_OUTPUT_UNITS = new Set(["serving", "each"]);
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;

function conflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2034";
}
async function serializable<T>(context: Context, operation: (tx: TransactionClient) => Promise<T>) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await context.prisma.$transaction((rawTx) => operation(rawTx as TransactionClient), TX_OPTIONS);
    } catch (error) {
      if (!conflict(error) || attempt === MAX_RETRIES) throw error;
    }
  }
  throw new Error("Inventory transaction retry limit exceeded");
}
function requireInventoryManager(context: Context) {
  if (!permissions.canManageInventory({ session: context.session })) throw new Error("Not authorized to manage coffee inventory");
  return context.session?.itemId || "";
}
/** Commit-time authority and store scope, checked before any private row or receipt is read. */
async function currentInventoryScope(tx: TransactionClient, context: Context) {
  const actorId = await requireCurrentCoffeeCapability(tx, context.session, ["canManageInventory"], "Not authorized to manage coffee inventory");
  const store = await tx.storeSetting.findUnique({ where: { singletonKey: "primary" }, select: { id: true, timezone: true } });
  if (!store) throw new Error("Primary coffee store is not configured");
  const timeZone = typeof store.timezone === "string" && validCoffeeTimezone(store.timezone) ? store.timezone : null;
  return { actorId, storeId: store.id, timeZone };
}
function scopedKey(context: Context, purpose: string, key: string | null | undefined) {
  const normalized = normalizeIdempotencyKey(key);
  if (!normalized) throw new Error(`${purpose} idempotency key is required`);
  return buildScopedIdempotencyKey(`${purpose}:${context.session?.itemId}`, normalized);
}
function reference(prefix: string, key: string) {
  return `${prefix}-${createHash("sha256").update(key).digest("hex").slice(0, 12).toUpperCase()}`;
}
function notesText(value: unknown) {
  const notes = typeof value === "string" ? value.trim() : "";
  if (notes.length > 500) throw new Error("Notes must be 500 characters or fewer");
  return notes;
}
function requiredId(value: unknown, label: string) {
  if (typeof value !== "string" || !value.trim() || value.length > 255) throw new Error(`${label} is required`);
  return value.trim();
}
/** Exact instant from the client (already resolved from a local wall time). */
function optionalInstant(value: unknown, label: string) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !INSTANT.test(value)) throw new Error(`${label} must be a full date and time`);
  const instant = new Date(value);
  if (!Number.isFinite(instant.getTime())) throw new Error(`${label} is not a valid date and time`);
  return instant;
}
function storedFingerprint(row: Record<string, unknown>) {
  const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? row.metadata as Record<string, unknown> : {};
  return typeof metadata.requestFingerprint === "string" ? metadata.requestFingerprint : null;
}
/** Same key + same normalized request returns the original receipt; anything else is rejected. */
function assertSameRequest(existing: Record<string, unknown>, storeId: string, requestFingerprint: string, label: string) {
  assertCoffeeStoreOwnership(existing.storeId, storeId, label);
  if (storedFingerprint(existing) !== requestFingerprint) {
    throw new Error(`This ${label.toLowerCase()} request was already submitted with different details. Refresh the page and submit the new details again.`);
  }
}
function allocationUnits(lots: { allocations: Array<{ inventoryLotId: string; quantity: number }>; untrackedQuantity: number }) {
  return [
    ...lots.allocations.map((allocation) => ({ inventoryLotId: allocation.inventoryLotId as string | null, units: stockUnits(allocation.quantity, "Allocated quantity") })),
    ...(lots.untrackedQuantity > 0 ? [{ inventoryLotId: null, units: stockUnits(lots.untrackedQuantity, "Allocated quantity") }] : []),
  ];
}

export async function createCoffeePurchaseOrder(
  _root: unknown,
  args: { supplierId: string; inventoryItemId: string; orderedQuantity: number; unitCostCents: number; expectedAt?: string | null; notes?: string | null; idempotencyKey: string },
  context: Context,
) {
  requireInventoryManager(context);
  const key = scopedKey(context, "coffee-purchase-order", args.idempotencyKey);
  const supplierId = requiredId(args.supplierId, "Supplier");
  const inventoryItemId = requiredId(args.inventoryItemId, "Inventory item");
  const quantityUnits = stockUnits(args.orderedQuantity, "Ordered quantity");
  const unitCostCents = Number(args.unitCostCents);
  if (!Number.isSafeInteger(unitCostCents) || unitCostCents < 0 || unitCostCents > MAX_INT) throw new Error("Unit cost must be a non-negative amount in cents");
  const subtotalCents = stockCostCents(quantityUnits, unitCostCents);
  const expectedDate = args.expectedAt ? String(args.expectedAt) : null;
  if (expectedDate && !isBusinessDate(expectedDate)) throw new Error("Expected date must be a valid calendar date");
  const notes = notesText(args.notes);

  return serializable(context, async (tx) => {
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", key);
    const { actorId, storeId, timeZone } = await currentInventoryScope(tx, context);
    const requestFingerprint = fingerprintInput({ purpose: "purchase-order", storeId, actorId, supplierId, inventoryItemId, quantityUnits, unitCostCents, expectedDate, notes });
    const existing = await tx.purchaseOrder.findUnique({ where: { idempotencyKey: key } });
    if (existing) {
      assertSameRequest(existing, storeId, requestFingerprint, "Purchase order");
      return existing;
    }

    const [supplier, inventoryItem] = await Promise.all([
      tx.supplier.findUnique({ where: { id: supplierId }, select: { id: true, storeId: true, status: true } }),
      tx.inventoryItem.findUnique({ where: { id: inventoryItemId }, select: { id: true, storeId: true, unit: true } }),
    ]);
    if (!supplier || supplier.status !== "active") throw new Error("Purchase order supplier is not active");
    if (!inventoryItem) throw new Error("Purchase order inventory item was not found");
    assertCoffeeStoreOwnership(supplier.storeId, storeId, "Supplier");
    assertCoffeeStoreOwnership(inventoryItem.storeId, storeId, "Inventory item");
    const unit = String(inventoryItem.unit || "each");
    stockUnits(stockNumber(quantityUnits), "Ordered quantity", { unit });
    if (expectedDate && !timeZone) throw new Error("Set a valid store timezone before entering an expected date");
    // Date-only arrival is a store business date: keep the date and its store-local start.
    const expectedAt = expectedDate && timeZone ? storeDayStart(expectedDate, timeZone) : null;

    const order = await tx.purchaseOrder.create({
      data: {
        idempotencyKey: key,
        storeId,
        poNumber: reference("PO", key),
        supplierId,
        inventoryItemId,
        orderedQuantity: stockDecimal(quantityUnits),
        unitCostCents,
        status: "submitted",
        orderedAt: new Date(),
        expectedAt,
        subtotalCents,
        notes,
        metadata: { requestFingerprint, createdById: actorId, unit, expectedDate },
      },
    });
    await enqueueCoffeeDomainEvent(tx as never, {
      storeId,
      eventKey: `purchase-order:${String(order.id)}:submitted:v1`,
      eventType: "purchase_order.submitted",
      aggregateType: "purchase_order",
      aggregateId: String(order.id),
      payload: { purchaseOrderId: String(order.id), poNumber: String(order.poNumber), supplierId, inventoryItemId, quantity: stockNumber(quantityUnits), unit, unitCostCents, subtotalCents },
    });
    return order;
  });
}

export async function receiveCoffeePurchaseOrder(
  _root: unknown,
  args: { purchaseOrderId: string; expiresAt?: string | null },
  context: Context,
) {
  requireInventoryManager(context);
  const purchaseOrderId = requiredId(args.purchaseOrderId, "Purchase order");
  const expiresAt = optionalInstant(args.expiresAt, "Lot expiry");
  return serializable(context, async (tx) => {
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-po:${purchaseOrderId}`);
    const { actorId, storeId } = await currentInventoryScope(tx, context);
    const order = await tx.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: { inventoryItem: true, supplier: true },
    });
    if (!order) throw new Error("Purchase order not found");
    assertCoffeeStoreOwnership(order.storeId, storeId, "Purchase order");
    const inventoryItem = order.inventoryItem as Record<string, unknown> | null;
    assertCoffeeStoreOwnership(inventoryItem?.storeId, storeId, "Purchase order inventory item");
    assertCoffeeStoreOwnership((order.supplier as Record<string, unknown> | null)?.storeId, storeId, "Purchase order supplier");
    const existingLot = await tx.inventoryLot.findFirst({ where: { purchaseOrderId } });
    if (order.status === "received" && existingLot) {
      const recordedExpiry = existingLot.expiresAt ? new Date(existingLot.expiresAt as string | Date).getTime() : null;
      if (recordedExpiry !== (expiresAt ? expiresAt.getTime() : null)) throw new Error("This purchase order was already received with a different expiry. Refresh to see the recorded lot.");
      return existingLot;
    }
    if (order.status !== "submitted" || existingLot) throw new Error(`Cannot receive purchase order with status ${String(order.status)}`);

    const inventoryItemId = String(order.inventoryItemId || "");
    if (!inventoryItemId) throw new Error("Purchase order has no inventory item");
    const quantityUnits = storedStockUnits(order.orderedQuantity);
    if (quantityUnits <= 0) throw new Error("Purchase order quantity is invalid");
    const now = new Date();
    // Do not certify food safety: an unknown expiry stays unknown; a past expiry is not usable stock.
    if (expiresAt && expiresAt.getTime() <= now.getTime()) throw new Error("Lot expiry must be after the receipt time. Record expired goods as waste instead of receiving them as usable stock.");
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-inventory:${inventoryItemId}`);
    const unit = String(inventoryItem?.unit || "each");
    const orderedUnit = (order.metadata as Record<string, unknown> | null)?.unit;
    if (typeof orderedUnit === "string" && orderedUnit !== unit) throw new Error("The inventory item's unit changed after this purchase order was placed; review the order before receiving it");

    const lot = await tx.inventoryLot.create({
      data: {
        lotNumber: reference("LOT", String(order.idempotencyKey || order.id)),
        storeId,
        purchaseOrderId: String(order.id),
        inventoryItemId,
        supplierId: order.supplierId || null,
        quantityReceived: stockDecimal(quantityUnits),
        quantityRemaining: stockDecimal(quantityUnits),
        unitCostCents: Number(order.unitCostCents || 0),
        receivedAt: now,
        expiresAt,
        status: "active",
        metadata: { unit, receivedById: actorId, fullReceiptConfirmed: true, expiryRecorded: Boolean(expiresAt) },
      },
    });
    await tx.inventoryItem.update({ where: { id: inventoryItemId }, data: { currentStock: { increment: stockDecimal(quantityUnits) } } });
    const movement = await tx.stockMovement.create({
      data: { storeId, inventoryItemId, purchaseOrderId: String(order.id), inventoryLotId: String(lot.id), type: "received", quantity: stockDecimal(quantityUnits), reason: `Received ${String(order.poNumber)}`, createdById: actorId },
    });
    await tx.purchaseOrder.update({ where: { id: String(order.id) }, data: { status: "received", receivedAt: now } });
    await enqueueCoffeeDomainEvent(tx as never, {
      storeId,
      eventKey: `purchase-order:${String(order.id)}:received:v1`,
      eventType: "purchase_order.received",
      aggregateType: "purchase_order",
      aggregateId: String(order.id),
      occurredAt: now,
      payload: { purchaseOrderId: String(order.id), lotId: String(lot.id), stockMovementId: String(movement.id), inventoryItemId, quantity: stockNumber(quantityUnits), unit, expiresAt: expiresAt ? expiresAt.toISOString() : null },
    });
    return lot;
  });
}

export async function completeCoffeePrepBatch(
  _root: unknown,
  args: { recipeId: string; quantityMade: number; expiresAt?: string | null; notes?: string | null; idempotencyKey: string },
  context: Context,
) {
  requireInventoryManager(context);
  const key = scopedKey(context, "coffee-prep-batch", args.idempotencyKey);
  const recipeId = requiredId(args.recipeId, "Recipe");
  const madeUnits = stockUnits(args.quantityMade, "Quantity made");
  const expiresAt = optionalInstant(args.expiresAt, "Prep expiry");
  const notes = notesText(args.notes);

  return serializable(context, async (tx) => {
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", key);
    const { actorId, storeId } = await currentInventoryScope(tx, context);
    const requestFingerprint = fingerprintInput({ purpose: "prep-batch", storeId, actorId, recipeId, madeUnits, expiresAt: expiresAt ? expiresAt.toISOString() : null, notes });
    const existing = await tx.prepBatch.findUnique({ where: { idempotencyKey: key } });
    if (existing) {
      assertSameRequest(existing, storeId, requestFingerprint, "Prep batch");
      return existing;
    }
    const now = new Date();
    if (expiresAt && expiresAt.getTime() <= now.getTime()) throw new Error("Prep expiry must be after the time the batch is completed");

    const recipe = await tx.recipe.findUnique({
      where: { id: recipeId },
      include: { from_Ingredient_recipe: { include: { inventoryItem: true } } },
    });
    if (!recipe || recipe.active !== true || recipe.status !== "active") throw new Error("Recipe is not active");
    assertCoffeeStoreOwnership(recipe.storeId, storeId, "Recipe");
    const yieldUnits = stockUnits(recipe.yieldQuantity, "Recipe yield");
    const outputUnit = String(recipe.yieldUnit || "").trim();
    if (!outputUnit) throw new Error("Recipe yield unit is required before prep");
    // Counted outputs (servings/items) are sold one per unit, so batches must be whole.
    if (COUNTED_OUTPUT_UNITS.has(outputUnit)) stockUnits(stockNumber(madeUnits), "Quantity made", { unit: "each" });
    const ingredients = Array.isArray(recipe.from_Ingredient_recipe) ? recipe.from_Ingredient_recipe as Array<Record<string, unknown>> : [];
    if (ingredients.length === 0) throw new Error("Recipe has no ingredients");

    const requiredByInventory = new Map<string, { id: string; units: number; unit: string; name: string }>();
    const snapshot: Array<Record<string, unknown>> = [];
    for (const ingredient of ingredients) {
      if (ingredient.optional) continue;
      assertCoffeeStoreOwnership(ingredient.storeId, storeId, `Ingredient ${String(ingredient.name)}`);
      const inventory = ingredient.inventoryItem as Record<string, unknown> | null;
      if (!inventory) throw new Error(`Ingredient ${String(ingredient.name)} has no inventory item`);
      assertCoffeeStoreOwnership(inventory.storeId, storeId, `Inventory for ${String(ingredient.name)}`);
      const unit = String(inventory.unit || "each");
      if (String(ingredient.unit) !== unit) throw new Error(`Ingredient ${String(ingredient.name)} unit does not match inventory`);
      const ingredientUnits = stockUnits(ingredient.quantity, `Ingredient ${String(ingredient.name)} quantity`);
      // One explicit rule: scaled integer product, rounded half up to the 0.0001 stock quantum.
      const product = BigInt(ingredientUnits) * BigInt(madeUnits);
      const divisor = BigInt(yieldUnits);
      const two = BigInt(2);
      const units = Number((product * two + divisor) / (divisor * two));
      if (units <= 0) throw new Error(`Prep quantity for ${String(ingredient.name)} is below the 0.0001 ${unit} stock resolution; increase the batch size`);
      if (unit === "each" && units % STOCK_SCALE !== 0) throw new Error(`Prep would use a fraction of an item for ${String(ingredient.name)}; adjust the batch size`);
      const id = String(inventory.id);
      const existingRequirement = requiredByInventory.get(id);
      requiredByInventory.set(id, {
        id,
        unit,
        units: (existingRequirement?.units || 0) + units,
        name: existingRequirement ? `${existingRequirement.name}, ${String(ingredient.name)}` : String(ingredient.name),
      });
      snapshot.push({ ingredientId: String(ingredient.id), inventoryItemId: id, quantity: stockDecimal(ingredientUnits), unit });
    }
    const required = [...requiredByInventory.values()].sort((a, b) => a.id.localeCompare(b.id));
    if (required.length === 0) throw new Error("Recipe has no inventory-backed ingredients");

    for (const item of required) {
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-inventory:${item.id}`);
      const inventory = await tx.inventoryItem.findUnique({ where: { id: item.id }, select: { currentStock: true } });
      if (!inventory || storedStockUnits(inventory.currentStock) < item.units) throw new Error(`Insufficient inventory for ${item.name}`);
    }

    const batch = await tx.prepBatch.create({
      data: {
        idempotencyKey: key,
        storeId,
        batchNumber: reference("BATCH", key),
        recipeId,
        status: "completed",
        preparedById: actorId,
        quantityMade: stockDecimal(madeUnits),
        quantityRemaining: stockDecimal(madeUnits),
        startedAt: now,
        completedAt: now,
        expiresAt,
        notes,
        // Frozen production facts: later recipe edits never change what this batch consumed or yields.
        metadata: {
          requestFingerprint,
          outputUnit,
          recipeSnapshot: { recipeId, name: String(recipe.name || ""), yieldQuantity: stockDecimal(yieldUnits), yieldUnit: outputUnit, ingredients: snapshot },
          consumption: required.map((item) => ({ inventoryItemId: item.id, quantity: stockDecimal(item.units), unit: item.unit })),
        },
      },
    });
    for (const item of required) {
      const stock = await tx.inventoryItem.findUnique({ where: { id: item.id }, select: { currentStock: true } });
      const lots = await consumeActiveInventoryLots(tx, item.id, stockNumber(item.units), { openingStock: stock?.currentStock ?? 0 });
      await tx.inventoryItem.update({ where: { id: item.id }, data: { currentStock: { decrement: stockDecimal(item.units) } } });
      for (const allocation of allocationUnits(lots)) await tx.stockMovement.create({
        data: { storeId, inventoryItemId: item.id, inventoryLotId: allocation.inventoryLotId, prepBatchId: String(batch.id), type: "sale", quantity: stockDecimal(-allocation.units), reason: `Prep batch ${String(batch.batchNumber)}`, createdById: actorId },
      });
    }
    await enqueueCoffeeDomainEvent(tx as never, {
      storeId,
      eventKey: `prep-batch:${String(batch.id)}:completed:v1`,
      eventType: "prep_batch.completed",
      aggregateType: "prep_batch",
      aggregateId: String(batch.id),
      payload: { prepBatchId: String(batch.id), batchNumber: String(batch.batchNumber), recipeId, quantityMade: stockNumber(madeUnits), outputUnit, ingredients: required.map((item) => ({ inventoryItemId: item.id, quantity: stockNumber(item.units), unit: item.unit })) },
    });
    return batch;
  });
}

export async function recordCoffeeWaste(
  _root: unknown,
  args: { inventoryItemId?: string | null; prepBatchId?: string | null; quantity: number; reason: string; notes?: string | null; idempotencyKey: string },
  context: Context,
) {
  requireInventoryManager(context);
  const key = scopedKey(context, "coffee-waste", args.idempotencyKey);
  const quantityUnits = stockUnits(args.quantity, "Waste quantity");
  const inventoryItemId = args.inventoryItemId ? requiredId(args.inventoryItemId, "Inventory item") : null;
  const prepBatchId = args.prepBatchId ? requiredId(args.prepBatchId, "Prep batch") : null;
  if (Boolean(inventoryItemId) === Boolean(prepBatchId)) throw new Error("Waste must reference exactly one inventory item or prep batch");
  if (!WASTE_REASON_SET.has(args.reason)) throw new Error("Choose a waste reason: expired, damaged, overproduction or quality");
  const notes = notesText(args.notes);

  return serializable(context, async (tx) => {
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", key);
    const { actorId, storeId } = await currentInventoryScope(tx, context);
    const requestFingerprint = fingerprintInput({ purpose: "waste", storeId, actorId, inventoryItemId, prepBatchId, quantityUnits, reason: args.reason, notes });
    const existing = await tx.wasteLog.findUnique({ where: { idempotencyKey: key } });
    if (existing) {
      assertSameRequest(existing, storeId, requestFingerprint, "Waste log");
      return existing;
    }

    let unit = "each";
    let costCents = 0;
    let allocations: Array<{ inventoryLotId: string | null; units: number }> = [];
    if (inventoryItemId) {
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-inventory:${inventoryItemId}`);
      const inventory = await tx.inventoryItem.findUnique({ where: { id: inventoryItemId }, select: { storeId: true, currentStock: true, unit: true, costPerUnit: true } });
      if (!inventory) throw new Error("Inventory item not found");
      assertCoffeeStoreOwnership(inventory.storeId, storeId, "Inventory item");
      unit = String(inventory.unit || "each");
      stockUnits(stockNumber(quantityUnits), "Waste quantity", { unit });
      if (storedStockUnits(inventory.currentStock) < quantityUnits) throw new Error("Insufficient inventory to record waste");
      costCents = stockCostCents(quantityUnits, Number(inventory.costPerUnit || 0));
      const lots = await consumeActiveInventoryLots(tx, inventoryItemId, stockNumber(quantityUnits), { openingStock: inventory.currentStock, waste: true });
      allocations = allocationUnits(lots);
      await tx.inventoryItem.update({ where: { id: inventoryItemId }, data: { currentStock: { decrement: stockDecimal(quantityUnits) } } });
    } else if (prepBatchId) {
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-prep-batch:${prepBatchId}`);
      const batch = await tx.prepBatch.findUnique({ where: { id: prepBatchId }, include: { recipe: { select: { yieldUnit: true } } } });
      if (!batch) throw new Error("Prep batch not found");
      assertCoffeeStoreOwnership(batch.storeId, storeId, "Prep batch");
      const metadata = batch.metadata && typeof batch.metadata === "object" ? batch.metadata as Record<string, unknown> : {};
      unit = typeof metadata.outputUnit === "string" && metadata.outputUnit
        ? metadata.outputUnit
        : String((batch.recipe as Record<string, unknown> | null)?.yieldUnit || "serving");
      if (COUNTED_OUTPUT_UNITS.has(unit)) stockUnits(stockNumber(quantityUnits), "Waste quantity", { unit: "each" });
      const remaining = storedStockUnits(batch.quantityRemaining) - quantityUnits;
      if (remaining < 0) throw new Error("Insufficient prepared quantity to record waste");
      await tx.prepBatch.update({ where: { id: prepBatchId }, data: { quantityRemaining: stockDecimal(remaining), ...(remaining === 0 ? { status: "discarded" } : {}) } });
    }

    const waste = await tx.wasteLog.create({
      data: {
        idempotencyKey: key,
        storeId,
        logNumber: reference("WASTE", key),
        inventoryItemId,
        prepBatchId,
        reason: args.reason,
        quantity: stockDecimal(quantityUnits),
        unit,
        costCents,
        loggedById: actorId,
        loggedAt: new Date(),
        notes,
        metadata: { requestFingerprint },
      },
    });
    let stockMovementId: string | null = null;
    if (inventoryItemId) for (const allocation of allocations) {
      const movement = await tx.stockMovement.create({
        data: { storeId, inventoryItemId, inventoryLotId: allocation.inventoryLotId, wasteLogId: String(waste.id), type: "waste", quantity: stockDecimal(-allocation.units), reason: args.reason, notes, createdById: actorId },
      });
      stockMovementId = String(movement.id);
    }
    await enqueueCoffeeDomainEvent(tx as never, {
      storeId,
      eventKey: `waste:${String(waste.id)}:recorded:v1`,
      eventType: "waste.recorded",
      aggregateType: "waste",
      aggregateId: String(waste.id),
      payload: { wasteId: String(waste.id), inventoryItemId, prepBatchId, stockMovementId, quantity: stockNumber(quantityUnits), unit, reason: args.reason, costCents },
    });
    return waste;
  });
}

/** Set on hand from a physical count. A shortfall is drawn from lots like waste;
 * a surplus is recorded as untracked stock. The domain event is the request receipt.
 */
export async function recordCoffeeStockCount(
  _root: unknown,
  args: { inventoryItemId: string; countedQuantity: number; notes?: string | null; idempotencyKey: string },
  context: Context,
) {
  requireInventoryManager(context);
  const key = scopedKey(context, "coffee-stock-count", args.idempotencyKey);
  const inventoryItemId = requiredId(args.inventoryItemId, "Inventory item");
  const countedUnits = stockUnits(args.countedQuantity, "Counted quantity", { allowZero: true });
  const notes = notesText(args.notes);
  const eventKey = `stock-count:${createHash("sha256").update(key).digest("hex")}`;

  return serializable(context, async (tx) => {
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", key);
    const { actorId, storeId } = await currentInventoryScope(tx, context);
    const requestFingerprint = fingerprintInput({ purpose: "stock-count", storeId, actorId, inventoryItemId, countedUnits, notes });
    const receipt = await tx.coffeeDomainEvent.findUnique({ where: { eventKey } });
    if (receipt) {
      const payload = receipt.payload && typeof receipt.payload === "object" ? receipt.payload as Record<string, unknown> : {};
      if (receipt.storeId !== storeId || receipt.aggregateId !== inventoryItemId || payload.requestFingerprint !== requestFingerprint) {
        throw new Error("This stock count request was already submitted with different details. Refresh the page and submit the new details again.");
      }
      const recorded = await tx.inventoryItem.findUnique({ where: { id: inventoryItemId } });
      if (!recorded) throw new Error("Inventory item not found");
      return recorded;
    }

    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-inventory:${inventoryItemId}`);
    const inventory = await tx.inventoryItem.findUnique({ where: { id: inventoryItemId }, select: { storeId: true, currentStock: true, unit: true } });
    if (!inventory) throw new Error("Inventory item not found");
    assertCoffeeStoreOwnership(inventory.storeId, storeId, "Inventory item");
    const unit = String(inventory.unit || "each");
    stockUnits(stockNumber(countedUnits), "Counted quantity", { allowZero: true, unit });
    const { previousUnits, deltaUnits } = planStockCount(inventory.currentStock, countedUnits);

    const reason = "Stock count";
    const movementIds: string[] = [];
    if (deltaUnits !== 0) {
      const allocations = deltaUnits < 0
        ? allocationUnits(await consumeActiveInventoryLots(tx, inventoryItemId, stockNumber(-deltaUnits), { openingStock: inventory.currentStock, waste: true })).map((allocation) => ({ ...allocation, units: -allocation.units }))
        : [{ inventoryLotId: null, units: deltaUnits }];
      for (const [index, allocation] of allocations.entries()) {
        const movement = await tx.stockMovement.create({
          data: { idempotencyKey: index === 0 ? key : `${key}:${index}`, storeId, inventoryItemId, inventoryLotId: allocation.inventoryLotId, type: "adjustment", quantity: stockDecimal(allocation.units), reason, notes, createdById: actorId },
        });
        movementIds.push(String(movement.id));
      }
      await tx.inventoryItem.update({ where: { id: inventoryItemId }, data: { currentStock: stockDecimal(countedUnits) } });
    }
    await enqueueCoffeeDomainEvent(tx as never, {
      storeId,
      eventKey,
      eventType: "inventory.counted",
      aggregateType: "inventory_item",
      aggregateId: inventoryItemId,
      payload: { requestFingerprint, inventoryItemId, stockMovementIds: movementIds, previousQuantity: stockNumber(previousUnits), countedQuantity: stockNumber(countedUnits), adjustment: stockNumber(deltaUnits), unit, countedById: actorId },
    });
    const updated = await tx.inventoryItem.findUnique({ where: { id: inventoryItemId } });
    if (!updated) throw new Error("Inventory item not found");
    return updated;
  });
}
