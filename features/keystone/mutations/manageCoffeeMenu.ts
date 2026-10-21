import { permissions, type Session } from "../access";
import { assertCoffeeStoreOwnership, enqueueCoffeeDomainEvent, getPrimaryCoffeeStoreId } from "../lib/coffeeDomainOutbox";
import { requireCurrentCoffeeCapability } from "./coffeeKdsAuthority";
import { buildScopedIdempotencyKey, fingerprintInput, normalizeIdempotencyKey } from "./idempotency";

type Context = {
  session?: Session;
  prisma: { $transaction<T>(fn: (tx: unknown) => Promise<T>, options: Record<string, unknown>): Promise<T> };
};
type Row = Record<string, unknown>;
type Model = {
  findUnique(args: Record<string, unknown>): Promise<Row | null>;
  create(args: Record<string, unknown>): Promise<Row>;
  update(args: Record<string, unknown>): Promise<Row>;
};
type TransactionClient = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  storeSetting: { findUnique(args: Record<string, unknown>): Promise<{ id: string } | null> };
  coffeeDomainEvent: { findUnique(args: Record<string, unknown>): Promise<Row | null> };
  menuCategory: Model;
  inventoryItem: { findUnique(args: Record<string, unknown>): Promise<Row | null> };
  menuItem: Model;
  menuItemModifier: Model;
};

const TX_OPTIONS = { maxWait: 5000, timeout: 10000, isolationLevel: "Serializable" };
const STATIONS = new Set(["espresso_bar", "cold_bar", "brew_bar", "pastry_case", "retail_shelf"]);
const MODIFIER_GROUPS = new Set(["size", "milk", "espresso", "syrup", "sweetness", "temperature", "ice", "topping", "bakery_prep"]);
const STALE_MESSAGE = "This menu entry changed since you opened it. Reload to see the latest version before saving.";
const REUSED_KEY_MESSAGE = "This menu change was already submitted with different details. Reload and try again.";

function requireMenuManager(context: Context) {
  if (!permissions.canManageProducts({ session: context.session }) || !context.session?.itemId) throw new Error("Not authorized to manage the coffee menu");
}

function scopedKey(context: Context, purpose: string, value: string) {
  const normalized = normalizeIdempotencyKey(value);
  if (!normalized) throw new Error(`${purpose} idempotency key is required`);
  return buildScopedIdempotencyKey(`${purpose}:${context.session?.itemId}`, normalized);
}

/** Same PostgreSQL advisory-lock identity checkout takes per menu item
 * (createCafePickupOrder: two-int hashtext('coffee-menu-item'), hashtext(id)).
 * Every menu-item and modifier writer locks the parent menu item with it.
 */
export async function lockCoffeeMenuItem(tx: Pick<TransactionClient, "$executeRawUnsafe">, menuItemId: string) {
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "coffee-menu-item", menuItemId);
}

/** Serializes concurrent use of one command key, then fences current authority
 * before any private row or stored receipt is read.
 */
async function beginMenuCommand(tx: TransactionClient, context: Context, key: string) {
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-menu-command:${key}`);
  const actorId = await requireCurrentCoffeeCapability(tx as never, context.session, ["canManageProducts"], "Not authorized to manage the coffee menu");
  const storeId = await getPrimaryCoffeeStoreId(tx as never);
  return { actorId, storeId };
}

/** The command receipt is the CoffeeDomainEvent written with the original effect.
 * Same key + same request → original target, no second write. Same key + different
 * request → conflict before anything is changed.
 */
async function findMenuReceipt(tx: TransactionClient, key: string, expected: { storeId: string; actorId: string; eventType: string; aggregateType: string; requestFingerprint: string }) {
  const receipt = await tx.coffeeDomainEvent.findUnique({ where: { eventKey: `menu-command:${key}` } });
  if (!receipt) return null;
  const payload = receipt.payload && typeof receipt.payload === "object" ? receipt.payload as Record<string, unknown> : {};
  if (
    receipt.storeId !== expected.storeId ||
    receipt.eventType !== expected.eventType ||
    receipt.aggregateType !== expected.aggregateType ||
    payload.actorId !== expected.actorId ||
    payload.requestFingerprint !== expected.requestFingerprint
  ) throw new Error(REUSED_KEY_MESSAGE);
  return String(receipt.aggregateId);
}

function revision(value: unknown) {
  const date = value instanceof Date ? value : new Date(String(value || ""));
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}

function assertExpectedRevision(row: Row, expectedUpdatedAt?: string | null) {
  if (expectedUpdatedAt == null) return;
  if (revision(row.updatedAt) !== revision(expectedUpdatedAt)) throw new Error(STALE_MESSAGE);
}

function price(value: unknown) {
  const cents = Number(value);
  if (!Number.isSafeInteger(cents) || cents < 0 || cents > 10_000_000) throw new Error("Menu price must be a non-negative integer amount in cents");
  return cents;
}

function itemName(value: string) {
  const name = value.trim();
  if (!name || name.length > 200) throw new Error("Menu item name is required");
  return name;
}

function shortDescription(value: string) {
  const text = value.trim();
  if (text.length > 1000) throw new Error("Short description must be 1000 characters or fewer");
  return text;
}

function prepTime(value: unknown) {
  const minutes = Number(value);
  if (!Number.isSafeInteger(minutes) || minutes < 0 || minutes > 240) throw new Error("Prep time must be a whole number of minutes between 0 and 240");
  return minutes;
}

function station(value: string) {
  if (!STATIONS.has(value)) throw new Error("Menu item station is invalid");
  return value;
}

async function scopedCategory(tx: TransactionClient, storeId: string, categoryId: string) {
  const category = await tx.menuCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw new Error("Menu category was not found");
  assertCoffeeStoreOwnership(category.storeId, storeId, "Menu category");
  return String(category.id);
}

export async function createCoffeeMenuCategory(
  _root: unknown,
  args: { name: string; description?: string | null; sortOrder?: number | null; idempotencyKey: string },
  context: Context,
) {
  requireMenuManager(context);
  const name = args.name.trim();
  if (!name || name.length > 120) throw new Error("Category name is required");
  const description = (args.description || "").trim();
  if (description.length > 1000) throw new Error("Category description must be 1000 characters or fewer");
  const sortOrder = Number(args.sortOrder ?? 0);
  if (!Number.isSafeInteger(sortOrder) || Math.abs(sortOrder) > 100_000) throw new Error("Category sort order must be a whole number");
  const key = scopedKey(context, "menu-category-create", args.idempotencyKey);
  const requestFingerprint = fingerprintInput({ name, description, sortOrder });

  return context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx as TransactionClient;
    const { actorId, storeId } = await beginMenuCommand(tx, context, key);
    const replayId = await findMenuReceipt(tx, key, { storeId, actorId, eventType: "menu_category.created", aggregateType: "menu_category", requestFingerprint });
    if (replayId) {
      const replay = await tx.menuCategory.findUnique({ where: { id: replayId } });
      if (!replay) throw new Error("Menu category was not found");
      assertCoffeeStoreOwnership(replay.storeId, storeId, "Menu category");
      return replay;
    }
    const category = await tx.menuCategory.create({ data: { storeId, name, description, sortOrder, active: true } });
    await enqueueCoffeeDomainEvent(tx as never, {
      storeId,
      eventKey: `menu-command:${key}`,
      eventType: "menu_category.created",
      aggregateType: "menu_category",
      aggregateId: String(category.id),
      payload: { actorId, requestFingerprint, menuCategoryId: String(category.id), name, description, sortOrder },
    });
    return category;
  }, TX_OPTIONS);
}

export async function createCoffeeMenuItem(
  _root: unknown,
  args: { name: string; price: number; categoryId?: string | null; barStation?: string | null; shortDescription?: string | null; prepTimeMinutes?: number | null; idempotencyKey: string },
  context: Context,
) {
  requireMenuManager(context);
  const intent = {
    name: itemName(args.name),
    price: price(args.price),
    categoryId: args.categoryId || null,
    station: station(args.barStation || "espresso_bar"),
    shortDescription: shortDescription(args.shortDescription || ""),
    prepTimeMinutes: prepTime(args.prepTimeMinutes ?? 5),
  };
  const key = scopedKey(context, "menu-item-create", args.idempotencyKey);
  const requestFingerprint = fingerprintInput(intent);

  return context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx as TransactionClient;
    const { actorId, storeId } = await beginMenuCommand(tx, context, key);
    const replayId = await findMenuReceipt(tx, key, { storeId, actorId, eventType: "menu_item.created", aggregateType: "menu_item", requestFingerprint });
    if (replayId) {
      const replay = await tx.menuItem.findUnique({ where: { id: replayId } });
      if (!replay) throw new Error("Menu item was not found");
      assertCoffeeStoreOwnership(replay.storeId, storeId, "Menu item");
      return replay;
    }
    if (await tx.menuItem.findUnique({ where: { idempotencyKey: key } })) throw new Error(REUSED_KEY_MESSAGE);
    if (intent.categoryId) await scopedCategory(tx, storeId, intent.categoryId);
    const item = await tx.menuItem.create({
      data: {
        idempotencyKey: key,
        storeId,
        name: intent.name,
        price: intent.price,
        shortDescription: intent.shortDescription,
        available: true,
        prepTimeMinutes: intent.prepTimeMinutes,
        barStation: intent.station,
        temperatureOptions: ["hot"],
        serviceWindows: ["all_day"],
        categoryId: intent.categoryId,
      },
    });
    await enqueueCoffeeDomainEvent(tx as never, {
      storeId,
      eventKey: `menu-command:${key}`,
      eventType: "menu_item.created",
      aggregateType: "menu_item",
      aggregateId: String(item.id),
      payload: { actorId, requestFingerprint, menuItemId: String(item.id), ...intent },
    });
    return item;
  }, TX_OPTIONS);
}

export async function updateCoffeeMenuItem(
  _root: unknown,
  args: {
    menuItemId: string;
    name?: string | null;
    shortDescription?: string | null;
    categoryId?: string | null;
    clearCategory?: boolean | null;
    barStation?: string | null;
    prepTimeMinutes?: number | null;
    price?: number | null;
    available?: boolean | null;
    featured?: boolean | null;
    popular?: boolean | null;
    expectedUpdatedAt?: string | null;
    idempotencyKey: string;
  },
  context: Context,
) {
  requireMenuManager(context);
  const key = scopedKey(context, "menu-item-update", args.idempotencyKey);
  const changes: Record<string, string | number | boolean | null> = {};
  if (args.name != null) changes.name = itemName(args.name);
  if (args.shortDescription != null) changes.shortDescription = shortDescription(args.shortDescription);
  if (args.clearCategory) changes.categoryId = null;
  else if (args.categoryId) changes.categoryId = args.categoryId;
  if (args.barStation != null) changes.barStation = station(args.barStation);
  if (args.prepTimeMinutes != null) changes.prepTimeMinutes = prepTime(args.prepTimeMinutes);
  if (args.price != null) changes.price = price(args.price);
  if (args.available != null) changes.available = args.available;
  if (args.featured != null) changes.featured = args.featured;
  if (args.popular != null) changes.popular = args.popular;
  if (!Object.keys(changes).length) throw new Error("No menu item changes were provided");
  const expectedUpdatedAt = args.expectedUpdatedAt ? revision(args.expectedUpdatedAt) : null;
  if (args.expectedUpdatedAt && !expectedUpdatedAt) throw new Error(STALE_MESSAGE);
  const requestFingerprint = fingerprintInput({ menuItemId: args.menuItemId, changes, expectedUpdatedAt });

  return context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx as TransactionClient;
    const { actorId, storeId } = await beginMenuCommand(tx, context, key);
    await lockCoffeeMenuItem(tx, args.menuItemId);
    const item = await tx.menuItem.findUnique({ where: { id: args.menuItemId } });
    if (!item) throw new Error("Menu item was not found");
    assertCoffeeStoreOwnership(item.storeId, storeId, "Menu item");
    if (await findMenuReceipt(tx, key, { storeId, actorId, eventType: "menu_item.updated", aggregateType: "menu_item", requestFingerprint })) return item;
    assertExpectedRevision(item, expectedUpdatedAt);
    if (typeof changes.categoryId === "string") await scopedCategory(tx, storeId, changes.categoryId);
    const updated = await tx.menuItem.update({ where: { id: args.menuItemId }, data: changes });
    await enqueueCoffeeDomainEvent(tx as never, {
      storeId,
      eventKey: `menu-command:${key}`,
      eventType: "menu_item.updated",
      aggregateType: "menu_item",
      aggregateId: args.menuItemId,
      payload: { actorId, requestFingerprint, menuItemId: args.menuItemId, changes, previousRevision: revision(item.updatedAt) },
    });
    return updated;
  }, TX_OPTIONS);
}

type ModifierInventoryInput = { inventoryAction?: string | null; inventoryItemId?: string | null; replacesInventoryItemId?: string | null; inventoryQuantity?: number | null };
type ModifierInventory = { inventoryAction: string; inventoryItemId: string | null; replacesInventoryItemId: string | null; inventoryQuantity: number };

function normalizedInventory(args: ModifierInventoryInput): ModifierInventory {
  const inventoryAction = args.inventoryAction || "unreviewed";
  if (!["unreviewed", "none", "add", "substitute"].includes(inventoryAction)) throw new Error("Unsupported modifier inventory action");
  if (["none", "unreviewed"].includes(inventoryAction)) return { inventoryAction, inventoryItemId: null, replacesInventoryItemId: null, inventoryQuantity: 0 };
  if (!args.inventoryItemId) throw new Error("Select the inventory consumed by this modifier");
  const quantity = Number(args.inventoryQuantity || 0);
  if (inventoryAction === "add" && (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1_000_000 || Math.abs(quantity * 10_000 - Math.round(quantity * 10_000)) > 1e-7)) throw new Error("Add-on quantity must be positive with at most four decimal places");
  if (inventoryAction === "substitute" && !args.replacesInventoryItemId) throw new Error("Select the base ingredient this modifier replaces");
  return {
    inventoryAction,
    inventoryItemId: args.inventoryItemId,
    replacesInventoryItemId: inventoryAction === "substitute" ? args.replacesInventoryItemId || null : null,
    inventoryQuantity: inventoryAction === "add" ? quantity : 0,
  };
}

async function validateInventory(tx: TransactionClient, storeId: string, inventory: ModifierInventory) {
  if (!inventory.inventoryItemId) return;
  const target = await tx.inventoryItem.findUnique({ where: { id: inventory.inventoryItemId } });
  if (!target) throw new Error("Select the inventory consumed by this modifier");
  assertCoffeeStoreOwnership(target.storeId, storeId, "Modifier inventory");
  if (inventory.inventoryAction === "substitute") {
    const source = inventory.replacesInventoryItemId ? await tx.inventoryItem.findUnique({ where: { id: inventory.replacesInventoryItemId } }) : null;
    if (!source || source.id === target.id || source.unit !== target.unit) throw new Error("Substitution needs a different base ingredient in the same unit");
    assertCoffeeStoreOwnership(source.storeId, storeId, "Modifier base inventory");
  }
}

function storedInventory(modifier: Row): ModifierInventory {
  return {
    inventoryAction: String(modifier.inventoryAction || "unreviewed"),
    inventoryItemId: modifier.inventoryItemId ? String(modifier.inventoryItemId) : null,
    replacesInventoryItemId: modifier.replacesInventoryItemId ? String(modifier.replacesInventoryItemId) : null,
    inventoryQuantity: Number(modifier.inventoryQuantity || 0),
  };
}

function modifierPrice(value: unknown) {
  const cents = Number(value);
  if (!Number.isSafeInteger(cents) || cents < -10_000_000 || cents > 10_000_000) throw new Error("Modifier adjustment must be an integer amount in cents");
  return cents;
}

type ModifierRuleInput = { name: string; modifierGroup: string; modifierGroupLabel?: string | null; priceAdjustment: number; required?: boolean | null; minSelections?: number | null; maxSelections?: number | null; defaultSelected?: boolean | null };

function modifierRule(args: ModifierRuleInput) {
  const name = args.name.trim();
  const modifierGroup = args.modifierGroup.trim();
  if (!name || name.length > 200 || !MODIFIER_GROUPS.has(modifierGroup)) throw new Error("Modifier name and a supported cafe modifier group are required");
  const minSelections = Math.max(args.required ? 1 : 0, Number(args.minSelections || 0));
  const maxSelections = Number(args.maxSelections ?? 1);
  if (!Number.isSafeInteger(minSelections) || !Number.isSafeInteger(maxSelections) || minSelections < 0 || maxSelections < 1 || maxSelections > 20 || minSelections > maxSelections) throw new Error("Modifier selection bounds are invalid");
  return { name, modifierGroup, modifierGroupLabel: args.modifierGroupLabel?.trim() || modifierGroup.replaceAll("_", " "), priceAdjustment: modifierPrice(args.priceAdjustment), required: Boolean(args.required), minSelections, maxSelections, defaultSelected: Boolean(args.defaultSelected) };
}

export async function createCoffeeMenuModifier(
  _root: unknown,
  args: ModifierInventoryInput & ModifierRuleInput & { menuItemId: string; inStock?: boolean | null; idempotencyKey: string },
  context: Context,
) {
  requireMenuManager(context);
  const key = scopedKey(context, "menu-modifier-create", args.idempotencyKey);
  const rule = modifierRule(args);
  const inventory = normalizedInventory(args);
  // An option with no reviewed inventory effect stays closed until a manager reviews it.
  const inStock = args.inStock !== false && inventory.inventoryAction !== "unreviewed";
  const requestFingerprint = fingerprintInput({ menuItemId: args.menuItemId, rule, inventory, inStock });
  return context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx as TransactionClient;
    const { actorId, storeId } = await beginMenuCommand(tx, context, key);
    await lockCoffeeMenuItem(tx, args.menuItemId);
    const item = await tx.menuItem.findUnique({ where: { id: args.menuItemId } });
    if (!item) throw new Error("Menu item was not found");
    assertCoffeeStoreOwnership(item.storeId, storeId, "Menu item");
    const replayId = await findMenuReceipt(tx, key, { storeId, actorId, eventType: "menu_modifier.created", aggregateType: "menu_modifier", requestFingerprint });
    if (replayId) {
      const replay = await tx.menuItemModifier.findUnique({ where: { id: replayId } });
      if (!replay || replay.menuItemId !== args.menuItemId) throw new Error(REUSED_KEY_MESSAGE);
      return replay;
    }
    if (await tx.menuItemModifier.findUnique({ where: { idempotencyKey: key } })) throw new Error(REUSED_KEY_MESSAGE);
    await validateInventory(tx, storeId, inventory);
    const modifier = await tx.menuItemModifier.create({ data: { ...rule, ...inventory, inStock, storeId, menuItemId: args.menuItemId, idempotencyKey: key } });
    await enqueueCoffeeDomainEvent(tx as never, {
      storeId,
      eventKey: `menu-command:${key}`,
      eventType: "menu_modifier.created",
      aggregateType: "menu_modifier",
      aggregateId: String(modifier.id),
      payload: { actorId, requestFingerprint, modifierId: String(modifier.id), menuItemId: args.menuItemId, ...rule, ...inventory, inStock },
    });
    return modifier;
  }, TX_OPTIONS);
}

/** Rule and inventory edit. Stock is its own command (updateCoffeeModifierStock), so a
 * stale editor can never reopen or close an option; omitted inventory fields keep the
 * reviewed mapping, and the parent menu item is immutable here.
 */
export async function updateCoffeeMenuModifier(
  _root: unknown,
  args: ModifierInventoryInput & ModifierRuleInput & { modifierId: string; inStock?: boolean | null; expectedUpdatedAt?: string | null; idempotencyKey: string },
  context: Context,
) {
  requireMenuManager(context);
  const key = scopedKey(context, "menu-modifier-update", args.idempotencyKey);
  const requested = modifierRule(args);
  const requestedInventory = args.inventoryAction != null ? normalizedInventory(args) : null;
  const expectedUpdatedAt = args.expectedUpdatedAt ? revision(args.expectedUpdatedAt) : null;
  if (args.expectedUpdatedAt && !expectedUpdatedAt) throw new Error(STALE_MESSAGE);
  const ruleFieldsProvided = { required: args.required != null, minSelections: args.minSelections != null, maxSelections: args.maxSelections != null, defaultSelected: args.defaultSelected != null };
  const requestFingerprint = fingerprintInput({ modifierId: args.modifierId, rule: requested, ruleFieldsProvided, inventory: requestedInventory, expectedUpdatedAt });
  return context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx as TransactionClient;
    const { actorId, storeId } = await beginMenuCommand(tx, context, key);
    const located = await tx.menuItemModifier.findUnique({ where: { id: args.modifierId } });
    if (!located?.menuItemId) throw new Error("Menu modifier was not found");
    const menuItemId = String(located.menuItemId);
    await lockCoffeeMenuItem(tx, menuItemId);
    const modifier = await tx.menuItemModifier.findUnique({ where: { id: args.modifierId }, include: { menuItem: true } });
    if (!modifier || !modifier.menuItem || modifier.menuItemId !== menuItemId) throw new Error("Menu modifier was not found");
    assertCoffeeStoreOwnership((modifier.menuItem as Row).storeId, storeId, "Menu modifier item");
    assertCoffeeStoreOwnership(modifier.storeId, storeId, "Menu modifier");
    if (await findMenuReceipt(tx, key, { storeId, actorId, eventType: "menu_modifier.updated", aggregateType: "menu_modifier", requestFingerprint })) return modifier;
    assertExpectedRevision(modifier, expectedUpdatedAt);
    const rule = modifierRule({
      ...args,
      required: ruleFieldsProvided.required ? args.required : Boolean(modifier.required),
      minSelections: ruleFieldsProvided.minSelections ? args.minSelections : Number(modifier.minSelections || 0),
      maxSelections: ruleFieldsProvided.maxSelections ? args.maxSelections : Number(modifier.maxSelections ?? 1),
      defaultSelected: ruleFieldsProvided.defaultSelected ? args.defaultSelected : Boolean(modifier.defaultSelected),
    });
    const inventory = requestedInventory || storedInventory(modifier);
    if (requestedInventory) await validateInventory(tx, storeId, requestedInventory);
    const data: Record<string, unknown> = { ...rule, ...(requestedInventory || {}) };
    // Moving an option back to unreviewed closes it; consumption refuses unreviewed options.
    if (inventory.inventoryAction === "unreviewed" && modifier.inStock) data.inStock = false;
    const updated = await tx.menuItemModifier.update({ where: { id: args.modifierId }, data });
    await enqueueCoffeeDomainEvent(tx as never, {
      storeId,
      eventKey: `menu-command:${key}`,
      eventType: "menu_modifier.updated",
      aggregateType: "menu_modifier",
      aggregateId: args.modifierId,
      payload: { actorId, requestFingerprint, modifierId: args.modifierId, menuItemId, ...rule, ...inventory, previousRevision: revision(modifier.updatedAt) },
    });
    return updated;
  }, TX_OPTIONS);
}

export async function updateCoffeeModifierStock(
  _root: unknown,
  args: { modifierId: string; inStock: boolean; expectedUpdatedAt?: string | null; idempotencyKey: string },
  context: Context,
) {
  requireMenuManager(context);
  const key = scopedKey(context, "menu-modifier-stock", args.idempotencyKey);
  const expectedUpdatedAt = args.expectedUpdatedAt ? revision(args.expectedUpdatedAt) : null;
  if (args.expectedUpdatedAt && !expectedUpdatedAt) throw new Error(STALE_MESSAGE);
  const requestFingerprint = fingerprintInput({ modifierId: args.modifierId, inStock: args.inStock, expectedUpdatedAt });
  return context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx as TransactionClient;
    const { actorId, storeId } = await beginMenuCommand(tx, context, key);
    const located = await tx.menuItemModifier.findUnique({ where: { id: args.modifierId } });
    if (!located?.menuItemId) throw new Error("Menu modifier was not found");
    const menuItemId = String(located.menuItemId);
    await lockCoffeeMenuItem(tx, menuItemId);
    const modifier = await tx.menuItemModifier.findUnique({ where: { id: args.modifierId }, include: { menuItem: true } });
    if (!modifier || !modifier.menuItem || modifier.menuItemId !== menuItemId) throw new Error("Menu modifier was not found");
    assertCoffeeStoreOwnership((modifier.menuItem as Row).storeId, storeId, "Menu modifier item");
    if (await findMenuReceipt(tx, key, { storeId, actorId, eventType: "menu_modifier.stock_changed", aggregateType: "menu_modifier", requestFingerprint })) return modifier;
    assertExpectedRevision(modifier, expectedUpdatedAt);
    if (args.inStock && String(modifier.inventoryAction || "unreviewed") === "unreviewed") throw new Error("Choose how this option affects inventory before offering it");
    const updated = await tx.menuItemModifier.update({ where: { id: args.modifierId }, data: { inStock: args.inStock } });
    await enqueueCoffeeDomainEvent(tx as never, {
      storeId,
      eventKey: `menu-command:${key}`,
      eventType: "menu_modifier.stock_changed",
      aggregateType: "menu_modifier",
      aggregateId: args.modifierId,
      payload: { actorId, requestFingerprint, modifierId: args.modifierId, menuItemId, inStock: args.inStock, previousRevision: revision(modifier.updatedAt) },
    });
    return updated;
  }, TX_OPTIONS);
}
