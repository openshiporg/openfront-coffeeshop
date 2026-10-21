import "dotenv/config";

import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import test, { after, before } from "node:test";
import { PrismaClient } from "@prisma/client";

import seed from "../../platform/onboarding/lib/seed.json";
import acceptCafePickupOrder from "./acceptCafePickupOrder";
import applyCafeLoyalty from "./applyCafeLoyalty";
import createCafePickupOrder from "./createCafePickupOrder";
import { claimCoffeeOutboxDeliveries, completeCoffeeOutboxDelivery } from "../lib/coffeeDomainOutbox";
import {
  completeCoffeePrepBatch,
  createCoffeePurchaseOrder,
  receiveCoffeePurchaseOrder,
  recordCoffeeWaste,
} from "./coffeeInventoryOperations";
import handleCafePaymentWebhook from "./handleCafePaymentWebhook";
import initiateCafePaymentSession from "./initiateCafePaymentSession";
import refundCafePayment from "./refundCafePayment";
import recordCafePayment from "./recordCafePayment";
import getCoffeeOperationsSnapshot from "./getCoffeeOperationsSnapshot";
import { createCoffeeMenuItem, createCoffeeMenuModifier, updateCoffeeMenuItem, updateCoffeeMenuModifier, updateCoffeeModifierStock } from "./manageCoffeeMenu";
import updateCafeOrderItemStatus from "./updateCafeOrderItemStatus";
import updateCafeOrderStatus from "./updateCafeOrderStatus";
import {
  closeRegisterShift,
  openRegisterShift,
  recordRegisterCashMovement,
} from "./registerShiftOperations";
import { scheduleCoffeeStaffShift, updateCoffeeStaffShiftStatus } from "./staffShiftOperations";
import runCoffeeOnboarding from "./runCoffeeOnboarding";

type QueryList = {
  createOne(args: { data: Record<string, unknown>; query: string }): Promise<unknown>;
  updateOne(args: { where: { id: string }; data: Record<string, unknown>; query: string }): Promise<unknown>;
  deleteOne(args: { where: { id: string }; query: string }): Promise<unknown>;
};
type IntegrationContext = {
  session?: unknown;
  prisma: Record<string, unknown> & { $disconnect(): Promise<void> };
  sudo(): IntegrationContext;
  withSession(session: unknown): IntegrationContext;
  query: {
    StockMovement: QueryList;
    WasteLog: QueryList;
    InventoryItem: QueryList;
    RegisterShift: QueryList;
    CashMovement: QueryList;
    PosOrder: QueryList;
    OrderItem: QueryList;
    Supplier: QueryList;
    StaffShift: QueryList;
    MenuItem: QueryList;
    MenuItemModifier: QueryList;
    CafeOrder: { findOne(args: { where: { id: string }; query: string }): Promise<unknown> };
  };
};

const databaseUrl = new URL(process.env.DATABASE_URL || "");
if (!databaseUrl.pathname.includes("coffee_schema_gate_verify")) {
  throw new Error(`Refusing to run schema-gate integration test against ${databaseUrl.pathname || "missing database"}`);
}

type PrismaFixture = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  role: { create(args: Record<string, unknown>): Promise<{ id: string }> };
  user: { create(args: Record<string, unknown>): Promise<{ id: string }> };
  storeSetting: { create(args: Record<string, unknown>): Promise<Record<string, unknown>>; findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>; update(args: Record<string, unknown>): Promise<unknown> };
  menuCategory: { create(args: Record<string, unknown>): Promise<Record<string, unknown>> };
  menuItem: { count(args: Record<string, unknown>): Promise<number>; findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>>; findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null> };
  menuItemModifier: { findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null> };
  menuItemImage: { findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>> };
  inventoryItem: { create(args: Record<string, unknown>): Promise<Record<string, unknown>>; findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>; update(args: Record<string, unknown>): Promise<unknown> };
  supplier: { create(args: Record<string, unknown>): Promise<{ id: string }> };
  recipe: { create(args: Record<string, unknown>): Promise<{ id: string }> };
  ingredient: { create(args: Record<string, unknown>): Promise<{ id: string }> };
  purchaseOrder: { count(args: Record<string, unknown>): Promise<number> };
  inventoryLot: { count(args: Record<string, unknown>): Promise<number>; findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null> };
  prepBatch: { count(args: Record<string, unknown>): Promise<number> };
  wasteLog: { count(args: Record<string, unknown>): Promise<number> };
  cafeOrder: { count(args: Record<string, unknown>): Promise<number>; create(args: Record<string, unknown>): Promise<Record<string, unknown>>; findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>; findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null> };
  paymentProvider: { findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>; update(args: Record<string, unknown>): Promise<Record<string, unknown>> };
  payment: { create(args: Record<string, unknown>): Promise<Record<string, unknown>>; count(args: Record<string, unknown>): Promise<number>; findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>; findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>; update(args: Record<string, unknown>): Promise<unknown> };
  paymentEvent: { count(args: Record<string, unknown>): Promise<number> };
  orderItem: { create(args: Record<string, unknown>): Promise<Record<string, unknown>>; findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>; findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>; update(args: Record<string, unknown>): Promise<unknown> };
  registerShift: { findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>; count(args: Record<string, unknown>): Promise<number> };
  cashMovement: { count(args: Record<string, unknown>): Promise<number> };
  posOrder: { findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>; count(args: Record<string, unknown>): Promise<number> };
  staffShift: { count(args: Record<string, unknown>): Promise<number>; findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null> };
  stockMovement: { count(args: Record<string, unknown>): Promise<number>; findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>; update(args: Record<string, unknown>): Promise<unknown> };
  coffeeDomainEvent: { count(args: Record<string, unknown>): Promise<number>; findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>> };
  coffeeOutboxDelivery: { count(args: Record<string, unknown>): Promise<number>; findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>> };
};

let base: IntegrationContext;
let manager: IntegrationContext;
let prisma: PrismaFixture;
let rawPrisma: PrismaClient;
let managerUserId = "";
let secondaryStoreId = "";
let loyaltyOrderId = "";
const proof: Record<string, unknown> = { database: databaseUrl.pathname.slice(1) };
const proofPath = process.env.COFFEE_SCHEMA_GATE_PROOF_PATH || "/tmp/coffee-schema-gate-proof.json";

before(async () => {
  const { keystoneContext } = await import("../context");
  base = keystoneContext as unknown as IntegrationContext;
  prisma = base.prisma as unknown as PrismaFixture;
  rawPrisma = new PrismaClient();
  const role = await prisma.role.create({ data: { name: "Schema Gate Manager", canManageInventory: true, canReadInventory: true, canManageOnboarding: true, canManageOrders: true } });
  const user = await prisma.user.create({ data: { name: "Schema Gate Manager", email: "schema-gate@example.test", password: "integration-only", roleId: role.id } });
  managerUserId = user.id;
  manager = base.withSession({
    itemId: user.id,
    listKey: "User",
    data: {
      name: "Schema Gate Manager",
      role: {
        id: role.id,
        name: "Schema Gate Manager",
        canAccessDashboard: true,
        canReadOrders: true,
        canManageOrders: true,
        canReadPayments: true,
        canManagePayments: true,
        canReadProducts: true,
        canManageProducts: true,
        canReadInventory: true,
        canManageInventory: true,
        canReadLoyalty: true,
        canManageLoyalty: true,
        canSeeOtherPeople: true,
        canEditOtherPeople: true,
        canManagePeople: true,
        canManageRoles: true,
        canManageSettings: true,
        canManageOnboarding: true,
      },
    },
  });
});

after(async () => {
  await writeFile(proofPath, `${JSON.stringify(proof, null, 2)}\n`);
  await Promise.all([base.prisma.$disconnect(), rawPrisma.$disconnect()]);
});

test("authorized onboarding is atomic, idempotent, branded, and preserves canonical imagePath media", async () => {
  const first = await runCoffeeOnboarding(null, { template: "full" }, manager as never);
  const idsBefore = await prisma.menuItem.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const mediaBefore = await prisma.menuItemImage.findMany({ orderBy: { imagePath: "asc" }, select: { id: true, imagePath: true } });
  const second = await runCoffeeOnboarding(null, { template: "full" }, manager as never);
  const idsAfter = await prisma.menuItem.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });
  const mediaAfter = await prisma.menuItemImage.findMany({ orderBy: { imagePath: "asc" }, select: { id: true, imagePath: true } });
  const store = await prisma.storeSetting.findUnique({ where: { singletonKey: "primary" } });
  const [suppliers, recipes, ingredients, purchaseOrders, shifts, loyaltyAccounts, cateringOrders, subscriptions, payments, orders, providers] = await Promise.all([
    rawPrisma.supplier.findMany({ orderBy: { name: "asc" } }),
    rawPrisma.recipe.findMany({ orderBy: { name: "asc" } }),
    rawPrisma.ingredient.findMany({ orderBy: { name: "asc" } }),
    rawPrisma.purchaseOrder.findMany({ orderBy: { poNumber: "asc" } }),
    rawPrisma.staffShift.findMany({ orderBy: { shiftNumber: "asc" } }),
    rawPrisma.loyaltyAccount.findMany({ orderBy: { customerEmail: "asc" } }),
    rawPrisma.cateringOrder.findMany({ orderBy: { cateringNumber: "asc" } }),
    rawPrisma.subscription.findMany(),
    rawPrisma.payment.findMany(),
    rawPrisma.cafeOrder.findMany(),
    rawPrisma.paymentProvider.findMany({ orderBy: { code: "asc" } }),
  ]);

  assert.deepEqual(first, second);
  assert.deepEqual(idsAfter, idsBefore);
  assert.deepEqual(mediaAfter, mediaBefore);
  assert.equal(store?.name, "Neighborhood Roast");
  assert.ok(mediaAfter.length >= 5);
  assert.ok(mediaAfter.every((entry) => String(entry.imagePath).startsWith("/images/")));
  assert.ok(suppliers.length >= 1 && recipes.length >= 3 && ingredients.length >= 6);
  assert.equal(purchaseOrders.length, 1);
  assert.equal(purchaseOrders[0].status, "submitted");
  assert.ok(purchaseOrders[0].orderedAt && purchaseOrders[0].expectedAt && purchaseOrders[0].orderedAt < purchaseOrders[0].expectedAt);
  assert.equal(shifts.length, 1);
  assert.equal(shifts[0].status, "scheduled");
  assert.ok(shifts[0].startsAt && shifts[0].endsAt && shifts[0].startsAt > new Date() && shifts[0].endsAt > shifts[0].startsAt);
  assert.equal(loyaltyAccounts.length, 1);
  assert.equal(loyaltyAccounts[0].pointsBalance, 0);
  assert.equal(loyaltyAccounts[0].visits, 0);
  assert.equal(cateringOrders.length, 1);
  assert.equal(cateringOrders[0].status, "inquiry");
  assert.equal(cateringOrders[0].subtotalCents, 0);
  assert.ok(cateringOrders[0].eventAt && cateringOrders[0].eventAt > new Date());
  assert.equal(subscriptions.length, 0);
  assert.equal(payments.length, 0);
  assert.equal(orders.length, 0);
  assert.ok(providers.filter((provider) => provider.code !== "pp_system_default").every((provider) => !provider.isInstalled));

  const alternate = structuredClone(seed.minimal);
  alternate.storeInfo = { ...alternate.storeInfo, name: "Harbor Light Coffee", tagline: "Coffee by the ferry.", description: "Independent harbor cafe.", address: "7 Ferry Way", phone: "+1 555 0100", contactEmail: "hello@harborlight.example" };
  await runCoffeeOnboarding(null, { template: "custom", data: alternate }, manager as never);
  const alternateStore = await prisma.storeSetting.findUnique({ where: { singletonKey: "primary" } });
  assert.equal(alternateStore?.name, "Neighborhood Roast", "re-onboarding cannot overwrite an already configured store identity");
  assert.equal(alternateStore?.tagline, "Seasonal coffee, pastries, and pantry staples.");
  assert.equal(alternateStore?.contactEmail, "hello@neighborhoodroast.local");
  assert.doesNotMatch(JSON.stringify(alternateStore), /Harbor Light Coffee/);
  await runCoffeeOnboarding(null, { template: "full" }, manager as never);

  const invalid = structuredClone(seed.full);
  invalid.storeInfo.name = "Must Roll Back";
  invalid.menuItems[0].categoryName = "Missing dependency";
  await assert.rejects(runCoffeeOnboarding(null, { template: "custom", data: invalid }, manager as never), /category is missing/);
  assert.equal((await prisma.storeSetting.findUnique({ where: { singletonKey: "primary" } }))?.name, "Neighborhood Roast");
  proof.onboarding = { first, second, stableMenuIds: idsAfter.length, stableMedia: mediaAfter.length, connectedOperations: { suppliers: suppliers.length, recipes: recipes.length, ingredients: ingredients.length, purchaseOrders: purchaseOrders.length, shifts: shifts.length, loyaltyAccounts: loyaltyAccounts.length, cateringInquiries: cateringOrders.length }, relativeDates: true, noFakeRevenue: true, configuredIdentityPreserved: true, rollback: true };
});

test("supplier create, update, and delete hooks enforce primary-store ownership and dependency safety", async () => {
  const primaryStore = await prisma.storeSetting.findUnique({ where: { singletonKey: "primary" } });
  assert.ok(primaryStore?.id);
  const secondaryStore = await prisma.storeSetting.create({
    data: { singletonKey: "secondary", name: "Other Tenant", tagline: "Other", address: "Elsewhere", contactEmail: "other@example.test" },
  });
  secondaryStoreId = String(secondaryStore.id);

  const created = await manager.query.Supplier.createOne({ data: { name: "Hook-only Supplier", status: "active" }, query: "id store { id }" }) as { id: string; store: { id: string } };
  assert.equal(created.store.id, primaryStore.id);
  await assert.rejects(
    manager.query.Supplier.updateOne({ where: { id: created.id }, data: { store: { connect: { id: secondaryStoreId } } }, query: "id" }),
    /ownership is immutable/,
  );
  const deleted = await manager.query.Supplier.deleteOne({ where: { id: created.id }, query: "id" });
  assert.ok(deleted);
  proof.lifecycleHooks = { createAssignedPrimaryStore: true, updateReassignmentDenied: true, deleteHookExecuted: true, secondaryStoreId };
});

test("platform menu operations use tenant-scoped domain mutations instead of raw status CRUD", async () => {
  const createArgs = { name: "Schema Gate Cortado", price: 475, barStation: "espresso_bar", shortDescription: "Domain-created menu item", idempotencyKey: "menu-item-create-0001" };
  const first = await createCoffeeMenuItem(null, createArgs, manager as never);
  const replay = await createCoffeeMenuItem(null, createArgs, manager as never);
  assert.equal(first.id, replay.id);
  await assert.rejects(manager.query.MenuItem.updateOne({ where: { id: String(first.id) }, data: { price: 1 }, query: "id" }));
  const updated = await updateCoffeeMenuItem(null, { menuItemId: String(first.id), price: 500, available: false, idempotencyKey: "menu-item-update-0001" }, manager as never);
  assert.equal(updated.price, 500);
  assert.equal(updated.available, false);
  const modifierArgs = { menuItemId: String(first.id), name: "Extra shot", modifierGroup: "espresso", modifierGroupLabel: "Espresso", priceAdjustment: 125, required: false, minSelections: 0, maxSelections: 2, defaultSelected: false, inStock: true, idempotencyKey: "menu-modifier-create-0001" };
  const createdModifier = await createCoffeeMenuModifier(null, modifierArgs, manager as never);
  const modifierReplay = await createCoffeeMenuModifier(null, modifierArgs, manager as never);
  assert.equal(createdModifier.id, modifierReplay.id);
  const updatedModifier = await updateCoffeeMenuModifier(null, { ...modifierArgs, modifierId: String(createdModifier.id), name: "Double shot", priceAdjustment: 150, idempotencyKey: "menu-modifier-update-0001" }, manager as never);
  assert.equal(updatedModifier.name, "Double shot");
  assert.equal(updatedModifier.priceAdjustment, 150);

  const modifier = await prisma.menuItemModifier.findFirst({ where: { name: "12 oz" } });
  assert.ok(modifier?.id);
  await assert.rejects(manager.query.MenuItemModifier.updateOne({ where: { id: String(modifier.id) }, data: { inStock: false }, query: "id" }));
  const stocked = await updateCoffeeModifierStock(null, { modifierId: String(modifier.id), inStock: false, idempotencyKey: "modifier-stock-0001" }, manager as never);
  assert.equal(stocked.inStock, false);

  const foreignCategory = await prisma.menuCategory.create({ data: { storeId: secondaryStoreId, name: "Foreign Tenant Menu", active: true } });
  const beforeForeign = await prisma.menuItem.count({ where: { categoryId: foreignCategory.id } });
  await assert.rejects(
    createCoffeeMenuItem(null, { ...createArgs, name: "Foreign Tenant Drink", categoryId: String(foreignCategory.id), idempotencyKey: "menu-item-cross-tenant-0001" }, manager as never),
    /does not belong to the active store/,
  );
  assert.equal(await prisma.menuItem.count({ where: { categoryId: foreignCategory.id } }), beforeForeign);
  proof.menuDomain = { menuItemId: first.id, createReplay: true, rawPriceUpdateDenied: true, controlledUpdate: true, modifierCreateReplay: true, modifierRuleUpdate: true, modifierRawUpdateDenied: true, crossTenantRollback: true };
});

test("raw stock and evidence writes remain closed even to an inventory manager", async () => {
  const inventory = await prisma.inventoryItem.findFirst({ where: { name: "Espresso Beans" }, select: { id: true } });
  assert.ok(inventory?.id);
  await assert.rejects(manager.query.StockMovement.createOne({ data: { type: "adjustment", quantity: "99", inventoryItem: { connect: { id: String(inventory.id) } } }, query: "id" }));
  await assert.rejects(manager.query.WasteLog.createOne({ data: { logNumber: "RAW-WASTE", quantity: "1" }, query: "id" }));
  await assert.rejects(manager.query.InventoryItem.updateOne({ where: { id: String(inventory.id) }, data: { currentStock: "9999" }, query: "id currentStock" }));
  await assert.rejects(manager.query.RegisterShift.createOne({ data: { shiftNumber: "RAW-SHIFT", registerName: "Raw" }, query: "id" }));
  await assert.rejects(manager.query.CashMovement.createOne({ data: { idempotencyKey: "raw-cash-move", movementNumber: "RAW-CASH", type: "pay_in", amountCents: 100, reason: "raw" }, query: "id" }));
  await assert.rejects(manager.query.PosOrder.createOne({ data: { receiptNumber: "RAW-POS" }, query: "id" }));
  proof.negativeAccess = {
    stockMovementCreate: "denied",
    wasteCreate: "denied",
    currentStockUpdate: "denied",
    registerShiftCreate: "denied",
    cashMovementCreate: "denied",
    posOrderCreate: "denied",
  };
});

test("purchase receipt, recipe prep, and waste mutations preserve stock exactly once on replay", async () => {
  const store = await prisma.storeSetting.findUnique({ where: { singletonKey: "primary" } });
  assert.ok(store?.id && secondaryStoreId);
  const inventory = await prisma.inventoryItem.findFirst({ where: { name: "Espresso Beans", storeId: store.id }, select: { id: true, currentStock: true, unit: true } });
  assert.ok(inventory?.id);
  const supplier = await prisma.supplier.create({ data: { storeId: store.id, name: "Schema Gate Roaster", status: "active" } });
  const before = Number(inventory.currentStock);

  const purchaseArgs = { supplierId: supplier.id, inventoryItemId: String(inventory.id), orderedQuantity: 20, unitCostCents: 125, idempotencyKey: "schema-gate-purchase-0001" };
  const firstPo = await createCoffeePurchaseOrder(null, purchaseArgs, manager as never);
  const secondPo = await createCoffeePurchaseOrder(null, purchaseArgs, manager as never);
  assert.equal(firstPo.id, secondPo.id);
  const firstLot = await receiveCoffeePurchaseOrder(null, { purchaseOrderId: String(firstPo.id) }, manager as never);
  const secondLot = await receiveCoffeePurchaseOrder(null, { purchaseOrderId: String(firstPo.id) }, manager as never);
  assert.equal(firstLot.id, secondLot.id);

  const recipe = await prisma.recipe.create({ data: { storeId: store.id, name: "Schema Gate Espresso Batch", status: "active", active: true, yieldQuantity: 10, yieldUnit: "each" } });
  await prisma.ingredient.create({ data: { storeId: store.id, name: "Espresso Beans", recipeId: recipe.id, inventoryItemId: String(inventory.id), quantity: 2, unit: String(inventory.unit) } });
  const prepArgs = { recipeId: recipe.id, quantityMade: 10, idempotencyKey: "schema-gate-prep-000001" };
  const firstBatch = await completeCoffeePrepBatch(null, prepArgs, manager as never);
  const secondBatch = await completeCoffeePrepBatch(null, prepArgs, manager as never);
  assert.equal(firstBatch.id, secondBatch.id);

  const wasteArgs = { inventoryItemId: String(inventory.id), quantity: 3, reason: "quality", idempotencyKey: "schema-gate-waste-00001" };
  const firstWaste = await recordCoffeeWaste(null, wasteArgs, manager as never);
  const secondWaste = await recordCoffeeWaste(null, wasteArgs, manager as never);
  assert.equal(firstWaste.id, secondWaste.id);

  const afterInventory = await prisma.inventoryItem.findFirst({ where: { id: inventory.id }, select: { currentStock: true } });
  assert.equal(Number(afterInventory?.currentStock), before + 20 - 2 - 3);
  await runCoffeeOnboarding(null, { template: "full" }, manager as never);
  const afterOnboardingReplay = await prisma.inventoryItem.findFirst({ where: { id: inventory.id }, select: { currentStock: true } });
  assert.equal(Number(afterOnboardingReplay?.currentStock), before + 20 - 2 - 3);
  assert.equal(await prisma.purchaseOrder.count({ where: { idempotencyKey: firstPo.idempotencyKey } }), 1);
  assert.equal(await prisma.inventoryLot.count({ where: { purchaseOrderId: firstPo.id } }), 1);
  const depletedLot = await prisma.inventoryLot.findUnique({ where: { id: firstLot.id } });
  assert.equal(Number(depletedLot?.quantityRemaining), 15);
  assert.equal(await prisma.prepBatch.count({ where: { idempotencyKey: firstBatch.idempotencyKey } }), 1);
  assert.equal(await prisma.wasteLog.count({ where: { idempotencyKey: firstWaste.idempotencyKey } }), 1);
  await assert.rejects(manager.query.Supplier.deleteOne({ where: { id: supplier.id }, query: "id" }), /cannot be deleted/);

  const foreignInventory = await prisma.inventoryItem.create({ data: { storeId: secondaryStoreId, name: "Foreign Tenant Beans", category: "coffee", unit: "lb", currentStock: 10 } });
  const poCountBeforeMismatch = await prisma.purchaseOrder.count({ where: { inventoryItemId: foreignInventory.id } });
  const eventCountBeforeMismatch = await prisma.coffeeDomainEvent.count({ where: { aggregateType: "purchase_order" } });
  await assert.rejects(
    createCoffeePurchaseOrder(null, { supplierId: String(supplier.id), inventoryItemId: String(foreignInventory.id), orderedQuantity: 1, unitCostCents: 100, idempotencyKey: "cross-tenant-purchase-0001" }, manager as never),
    /does not belong to the active store/,
  );
  assert.equal(await prisma.purchaseOrder.count({ where: { inventoryItemId: foreignInventory.id } }), poCountBeforeMismatch);
  assert.equal(await prisma.coffeeDomainEvent.count({ where: { aggregateType: "purchase_order" } }), eventCountBeforeMismatch);
  proof.inventoryOperations = { before, after: Number(afterInventory?.currentStock), onboardingReplayPreservedStock: true, purchaseOrderId: firstPo.id, lotId: firstLot.id, lotRemaining: 15, prepBatchId: firstBatch.id, wasteLogId: firstWaste.id, dependentSupplierDeleteDenied: true, crossTenantRollback: true };
});

test("register shifts account for cash, cards, tips, movements, POS idempotency, and close variance", async () => {
  const openArgs = {
    registerName: "Front Register",
    openingCashCents: 10000,
    idempotencyKey: "schema-gate-register-open-0001",
  };
  const firstShift = await openRegisterShift(null, openArgs, manager as never);
  const replayedShift = await openRegisterShift(null, openArgs, manager as never);
  assert.equal(firstShift.id, replayedShift.id);
  await assert.rejects(
    openRegisterShift(null, { ...openArgs, idempotencyKey: "schema-gate-register-open-0002" }, manager as never),
    /already has an open shift/,
  );

  const movementArgs = {
    registerShiftId: String(firstShift.id),
    type: "pay_in",
    amountCents: 500,
    reason: "Opening float correction",
    idempotencyKey: "schema-gate-register-move-0001",
  };
  const movement = await recordRegisterCashMovement(null, movementArgs, manager as never);
  const movementReplay = await recordRegisterCashMovement(null, movementArgs, manager as never);
  assert.equal(movement.id, movementReplay.id);

  const menuItem = await prisma.menuItem.findFirst({
    where: { name: "Almond Croissant" },
    select: { id: true, inventoryItem: { select: { id: true, currentStock: true } } },
  });
  assert.ok(menuItem?.id && menuItem.inventoryItem);
  const inventoryId = String((menuItem.inventoryItem as Record<string, unknown>).id);
  const stockBefore = Number((menuItem.inventoryItem as Record<string, unknown>).currentStock);
  const salesMovementsBefore = await prisma.stockMovement.count({ where: { inventoryItemId: inventoryId, type: "sale" } });
  const posArgs = {
    customerName: "Register Guest",
    orderSource: "pos",
    fulfillmentType: "counter",
    paymentMethod: "cash",
    registerShiftId: String(firstShift.id),
    tipCents: 200,
    idempotencyKey: "schema-gate-pos-order-000001",
    items: [{ menuItemId: String(menuItem.id), quantity: 1 }],
  };
  const [firstOrder, replayedOrder] = await Promise.all([
    createCafePickupOrder(null, posArgs, manager as never),
    createCafePickupOrder(null, posArgs, manager as never),
  ]);
  assert.equal(firstOrder?.id, replayedOrder?.id);
  const posOrder = await prisma.posOrder.findFirst({ where: { cafeOrderId: firstOrder?.id } });
  const cashPayment = await prisma.payment.findFirst({ where: { orderId: firstOrder?.id } });
  assert.ok(posOrder && cashPayment);
  assert.equal(posOrder.tipCents, 200);
  assert.equal(cashPayment.status, "captured");
  assert.equal(cashPayment.method, "cash");
  assert.equal(cashPayment.amount, posOrder.totalCents);
  assert.equal(cashPayment.registerShiftId, firstShift.id);
  assert.equal(await prisma.posOrder.count({ where: { cafeOrderId: firstOrder?.id } }), 1);
  assert.equal(await prisma.cashMovement.count({ where: { registerShiftId: firstShift.id } }), 1);
  const saleEvidence = await prisma.stockMovement.findFirst({ where: { orderId: firstOrder?.id } });
  assert.ok(saleEvidence?.id);
  await assert.rejects(rawPrisma.$executeRawUnsafe('UPDATE "Payment" SET "amount" = "amount" + 1 WHERE "id" = $1', cashPayment.id), /Payment identity and amount evidence is immutable/);
  await assert.rejects(rawPrisma.$executeRawUnsafe('UPDATE "StockMovement" SET "reason" = $2 WHERE "id" = $1', saleEvidence.id, "tampered"), /append-only/);

  const cardOrder = await createCafePickupOrder(null, {
    ...posArgs,
    customerName: "Register Card Guest",
    paymentMethod: "manual_card",
    tipCents: 100,
    idempotencyKey: "schema-gate-pos-order-card-0001",
  }, manager as never);
  const cardPosOrder = await prisma.posOrder.findFirst({ where: { cafeOrderId: cardOrder?.id } });
  const cardPayment = await prisma.payment.findFirst({ where: { orderId: cardOrder?.id } });
  assert.ok(cardPosOrder && cardPayment);
  loyaltyOrderId = String(cardOrder?.id || "");
  assert.ok(loyaltyOrderId);
  assert.equal(cardPayment.status, "captured");
  assert.equal(cardPayment.method, "card");
  assert.equal(cardPayment.amount, cardPosOrder.totalCents);
  assert.equal(cardPayment.registerShiftId, firstShift.id);

  const inventoryAfter = await prisma.inventoryItem.findFirst({ where: { id: inventoryId }, select: { currentStock: true } });
  assert.equal(Number(inventoryAfter?.currentStock), stockBefore - 2);
  assert.equal(await prisma.stockMovement.count({ where: { inventoryItemId: inventoryId, type: "sale" } }), salesMovementsBefore + 2);

  const cashOrderItem = await prisma.orderItem.findFirst({ where: { orderId: firstOrder?.id }, select: { id: true } });
  assert.ok(cashOrderItem?.id);
  await assert.rejects(manager.query.OrderItem.updateOne({ where: { id: String(cashOrderItem.id) }, data: { barStatus: "ready" }, query: "id barStatus" }));
  await updateCafeOrderItemStatus(null, { orderItemId: String(cashOrderItem.id), status: "preparing", expectedStatus: "queued", idempotencyKey: "schema-cash-kds-start-0001" }, manager as never);
  await assert.rejects(updateCafeOrderStatus(null, { orderId: String(firstOrder?.id), status: "ready" }, manager as never), /Every order item must be ready/);
  await updateCafeOrderItemStatus(null, { orderItemId: String(cashOrderItem.id), status: "ready", expectedStatus: "preparing", idempotencyKey: "schema-cash-kds-ready-0001" }, manager as never);
  const handoffCommand = { orderItemId: String(cashOrderItem.id), status: "handed_off", expectedStatus: "ready", idempotencyKey: "schema-cash-kds-handoff-0001" };
  const handedOff = await updateCafeOrderItemStatus(null, handoffCommand, manager as never) as Record<string, unknown>;
  const handedOffReplay = await updateCafeOrderItemStatus(null, handoffCommand, manager as never) as Record<string, unknown>;
  assert.equal(handedOff.id, handedOffReplay.id);
  assert.equal((await prisma.orderItem.findUnique({ where: { id: cashOrderItem.id } }))?.barStatus, "handed_off");
  assert.equal((await prisma.cafeOrder.findUnique({ where: { id: firstOrder?.id } }))?.status, "completed");
  await assert.rejects(rawPrisma.$executeRawUnsafe('UPDATE "OrderItem" SET "price" = 1 WHERE "id" = $1', cashOrderItem.id), /snapshot evidence is immutable/);

  const beforeClose = await prisma.registerShift.findUnique({ where: { id: firstShift.id } });
  assert.ok(beforeClose);
  const expectedCashCents = Number(beforeClose.expectedCashCents);
  assert.equal(expectedCashCents, 10000 + 500 + Number(posOrder.totalCents));
  assert.equal(beforeClose.cashSalesCents, posOrder.totalCents);
  assert.equal(beforeClose.cardSalesCents, cardPosOrder.totalCents);
  assert.equal(beforeClose.tipsCents, 300);
  const closeArgs = {
    registerShiftId: String(firstShift.id),
    countedCashCents: expectedCashCents + 100,
    idempotencyKey: "schema-gate-register-close-001",
  };
  const closed = await closeRegisterShift(null, closeArgs, manager as never);
  const closeReplay = await closeRegisterShift(null, closeArgs, manager as never);
  assert.equal(closed.id, closeReplay.id);
  assert.equal(closed.cashVarianceCents, 100);
  await assert.rejects(
    createCafePickupOrder(null, { ...posArgs, idempotencyKey: "schema-gate-pos-order-000002" }, manager as never),
    /open register shift/,
  );
  proof.registerShift = {
    shiftId: firstShift.id,
    cashPosOrderId: posOrder.id,
    cardPosOrderId: cardPosOrder.id,
    cashPaymentId: cashPayment.id,
    cardPaymentId: cardPayment.id,
    tipsCents: beforeClose.tipsCents,
    cashSalesCents: beforeClose.cashSalesCents,
    cardSalesCents: beforeClose.cardSalesCents,
    stockBefore,
    stockAfter: Number(inventoryAfter?.currentStock),
    saleMovements: 2,
    kdsOrderItemId: cashOrderItem.id,
    kdsOrderStatus: "completed",
    kdsReplaySafe: true,
    rawKdsStatusUpdate: "denied",
    databaseEvidenceMutationDenied: true,
    expectedCashCents,
    countedCashCents: expectedCashCents + 100,
    varianceCents: 100,
    concurrentReplayAtomic: true,
  };
});

test("paid-order loyalty earning is atomic and concurrency-safe", async () => {
  const args = {
    orderId: loyaltyOrderId,
    customerEmail: "schema-gate-loyalty@example.test",
    customerName: "Schema Gate Regular",
  };
  const [first, replay] = await Promise.all([
    applyCafeLoyalty(null, args, manager as never),
    applyCafeLoyalty(null, args, manager as never),
  ]) as Array<Record<string, unknown>>;
  assert.equal(first.id, replay.id);
  assert.equal(await rawPrisma.loyaltyEvent.count({ where: { orderId: loyaltyOrderId } }), 1);
  const account = await rawPrisma.loyaltyAccount.findUnique({ where: { id: String(first.id) } });
  assert.equal(account?.visits, 1);
  assert.ok(Number(account?.lifetimePoints || 0) > 0);
  const loyaltyOrder = await prisma.cafeOrder.findUnique({ where: { id: loyaltyOrderId } });
  await assert.rejects(
    applyCafeLoyalty(null, { orderId: loyaltyOrderId, secretKey: String(loyaltyOrder?.secretKey), customerEmail: "unrelated@example.test" }, base as never),
    /email must match/i,
  );
  proof.loyaltyConcurrency = { orderId: loyaltyOrderId, accountId: first.id, events: 1, visits: 1, unrelatedEmailDenied: true };
});

test("online and manual payment initiation remain fail-closed without certified collection", async () => {
  const store = await prisma.storeSetting.findUnique({ where: { singletonKey: "primary" } });
  assert.ok(store?.id);
  const order = await prisma.cafeOrder.create({
    data: {
      storeId: store.id,
      orderNumber: "SCHEMA-GATE-PAYMENT-CLAIM-1",
      status: "open",
      customerName: "Payment Claim Customer",
      subtotal: 1200,
      tax: 105,
      total: 1305,
      currencyCode: "USD",
      handoffCode: "PAY002",
      secretKey: "schema-gate-payment-claim-secret",
    },
  });
  const args = { orderId: String(order.id), paymentProvider: "pp_system_default", idempotencyKey: "payment-claim-concurrency-0001" };
  const attempts = await Promise.allSettled([
    initiateCafePaymentSession(null, args, manager as never),
    initiateCafePaymentSession(null, args, manager as never),
  ]);
  assert.ok(attempts.every((attempt) => attempt.status === "rejected" && /Online payment initiation is unavailable/.test(String(attempt.reason))));
  assert.equal(await prisma.payment.count({ where: { orderId: order.id } }), 0);
  assert.equal((await prisma.cafeOrder.findUnique({ where: { id: order.id } }))?.status, "open");
  proof.paymentInitiationFailClosed = { orderId: order.id, rejectedAttempts: attempts.length, paymentRecords: 0, orderRemainsOpen: true };
});

test("concurrent independent full refunds serialize register totals and replay exactly once", async () => {
  const shift = await openRegisterShift(null, { registerName: "Refund Concurrency Register", openingCashCents: 10000, idempotencyKey: "refund-concurrency-register-open-0001" }, manager as never);
  const menuItem = await prisma.menuItem.findFirst({ where: { name: "Almond Croissant" }, select: { id: true } });
  assert.ok(menuItem?.id);
  const sale = (suffix: string) => createCafePickupOrder(null, {
    customerName: `Refund Guest ${suffix}`,
    orderSource: "pos",
    fulfillmentType: "counter",
    paymentMethod: "manual_card",
    registerShiftId: String(shift.id),
    tipCents: 0,
    idempotencyKey: `refund-concurrency-sale-${suffix}-0001`,
    items: [{ menuItemId: String(menuItem.id), quantity: 1 }],
  }, manager as never);
  const orders = await Promise.all([sale("one"), sale("two")]);
  const payments = await Promise.all(orders.map((order) => prisma.payment.findFirst({ where: { orderId: order.id } })));
  assert.ok(payments.every((payment) => payment?.status === "captured" && payment.method === "card"));
  const args = payments.map((payment, index) => ({
    paymentId: String(payment?.id),
    externalRefundReference: `TERM-RF-CONC-${index + 1}`,
    reason: "schema gate concurrent register refund",
    idempotencyKey: `refund-concurrency-request-${index + 1}-0001`,
  }));
  const results = await Promise.all(args.map((refundArgs) => Promise.all([
    refundCafePayment(null, refundArgs, manager as never),
    refundCafePayment(null, refundArgs, manager as never),
  ])));
  assert.ok(results.flat().every((result) => result?.status === "refunded"));
  const persistedPayments = await Promise.all(payments.map((payment) => prisma.payment.findUnique({ where: { id: String(payment?.id) } })));
  assert.ok(persistedPayments.every((payment) => payment?.status === "refunded"));
  await assert.rejects(
    rawPrisma.payment.update({ where: { id: String(payments[0]?.id) }, data: { refundRegisterShiftId: null } }),
    /Payment refund register is immutable once assigned/,
  );
  const shiftAfter = await prisma.registerShift.findUnique({ where: { id: String(shift.id) } });
  const expectedRefunds = persistedPayments.reduce((sum, payment) => sum + Number(payment?.amount || 0), 0);
  assert.equal(Number(shiftAfter?.cardRefundsCents), expectedRefunds);
  assert.equal(Number(shiftAfter?.expectedCashCents), 10000, "external card refunds must not alter cash-on-hand");
  for (const payment of payments) {
    assert.equal(await prisma.coffeeDomainEvent.count({ where: { eventKey: `payment:${payment?.id}:refunded:v1` } }), 1);
  }
  const closed = await closeRegisterShift(null, { registerShiftId: String(shift.id), countedCashCents: 10000, idempotencyKey: "refund-concurrency-register-close-0001" }, manager as never);
  assert.equal(closed.expectedCashCents, 10000);
  proof.refundConcurrency = { paymentIds: payments.map((payment) => payment?.id), independentRefunds: 2, duplicateReplays: 2, cardRefundsCents: expectedRefunds, cashUnaffected: true, eventsPerRefund: 1 };
});

test("uncertified online webhooks leave pending payments and orders unchanged", async () => {
  const store = await prisma.storeSetting.findUnique({ where: { singletonKey: "primary" } });
  const provider = await prisma.paymentProvider.findUnique({ where: { code: "pp_stripe_stripe" } });
  assert.ok(store?.id && provider?.id);
  const order = await prisma.cafeOrder.create({
    data: {
      storeId: store.id,
      orderNumber: "SCHEMA-GATE-PAYMENT-1",
      status: "open",
      customerName: "Webhook Customer",
      subtotal: 1000,
      tax: 88,
      total: 1088,
      currencyCode: "USD",
      handoffCode: "PAY001",
      secretKey: "schema-gate-payment-secret",
    },
  });
  const payment = await prisma.payment.create({
    data: {
      storeId: store.id,
      orderId: order.id,
      paymentProviderId: provider.id,
      status: "pending",
      method: "card",
      amount: 1088,
      currencyCode: "USD",
      provider: "pp_stripe_stripe",
      providerPaymentId: "pi_schema_gate_1",
    },
  });
  const eventsBefore = await prisma.paymentEvent.count({ where: { paymentId: payment.id } });
  await assert.rejects(handleCafePaymentWebhook(null, { providerCode: "pp_stripe_stripe", rawBody: "{}", headers: {} }, base as never), /Online payment webhooks are unavailable/);
  assert.equal((await prisma.payment.findUnique({ where: { id: payment.id } }))?.status, "pending");
  assert.equal((await prisma.cafeOrder.findUnique({ where: { id: order.id } }))?.status, "open");
  assert.equal(await prisma.paymentEvent.count({ where: { paymentId: payment.id } }), eventsBefore);
  proof.paymentWebhookFailClosed = { paymentId: payment.id, orderId: order.id, status: "pending", noSettlementEvent: true };
});

test("unpaid pickup intents cannot consume capacity, inventory, or KDS work", async () => {
  const allDayHours = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => ({ day, open: "00:00", close: "23:59" }));
  await prisma.storeSetting.update({ where: { singletonKey: "primary" }, data: { weeklyHours: allDayHours, pickupWindowMinutes: 15, pickupCapacityPerWindow: 1 } });
  const menuItem = await prisma.menuItem.findFirst({ where: { name: "Almond Croissant" }, select: { id: true, inventoryItem: { select: { id: true, currentStock: true } } } });
  assert.ok(menuItem?.id && menuItem.inventoryItem);
  const beforeStock = Number((menuItem.inventoryItem as Record<string, unknown>).currentStock);
  const request = (suffix: string) => createCafePickupOrder(null, {
    customerName: `Unpaid ${suffix}`,
    customerEmail: `unpaid-${suffix}@example.test`,
    requestedPickupMinutes: 12,
    idempotencyKey: `unpaid-pickup-${suffix}-0001`,
    items: [{ menuItemId: String(menuItem.id), quantity: 1 }],
  }, base as never);
  const orders = await Promise.all([request("one"), request("two")]);
  const afterMenuItem = await prisma.menuItem.findFirst({ where: { id: menuItem.id }, select: { inventoryItem: { select: { currentStock: true } } } });
  assert.equal(Number((afterMenuItem?.inventoryItem as Record<string, unknown>).currentStock), beforeStock);
  assert.equal(await prisma.stockMovement.count({ where: { orderId: { in: orders.map((order) => order.id) }, type: "sale" } }), 0);
  const openLine = await prisma.orderItem.findFirst({ where: { orderId: orders[0].id } });
  assert.ok(openLine?.id);
  await assert.rejects(updateCafeOrderItemStatus(null, { orderItemId: String(openLine.id), status: "preparing", expectedStatus: "queued", idempotencyKey: "schema-open-kds-denied-0001" }, manager as never), /before the pickup request is accepted/);
  for (const order of orders) await updateCafeOrderStatus(null, { orderId: String(order.id), status: "cancelled" }, manager as never);
  proof.unpaidPickupIntent = { created: 2, capacityConsumed: 0, inventoryConsumed: 0, kdsDenied: true, cancelled: 2 };
});

test("staff acceptance reserves capacity and prepared inventory before KDS, settlement, loyalty, and external-refund evidence", async () => {
  const allDayHours = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => ({ day, open: "00:00", close: "23:59" }));
  await prisma.storeSetting.update({ where: { singletonKey: "primary" }, data: { weeklyHours: allDayHours, pickupWindowMinutes: 15, pickupCapacityPerWindow: 1, taxRateBasisPoints: 725 } });
  const recipe = await rawPrisma.recipe.findFirst({ where: { name: "Americano build" } });
  const menuItem = await rawPrisma.menuItem.findFirst({ where: { name: "Americano" }, include: { modifiers: true } });
  assert.ok(recipe?.id && menuItem?.id);
  const size = menuItem.modifiers.find((modifier) => modifier.modifierGroup === "size" && modifier.defaultSelected) || menuItem.modifiers.find((modifier) => modifier.modifierGroup === "size");
  assert.ok(size?.id);
  if (size.inStock === false) await updateCoffeeModifierStock(null, { modifierId: String(size.id), inStock: true, idempotencyKey: "acceptance-restore-size-stock-0001" }, manager as never);
  const prep = await completeCoffeePrepBatch(null, { recipeId: String(recipe.id), quantityMade: 3, notes: "Acceptance gate prep", idempotencyKey: "acceptance-prep-batch-0001" }, manager as never) as Record<string, unknown>;
  const prepBefore = await rawPrisma.prepBatch.findUnique({ where: { id: String(prep.id) } });
  assert.equal(Number(prepBefore?.quantityRemaining), 3);
  const request = (suffix: string) => createCafePickupOrder(null, { customerName: `Accepted ${suffix}`, customerEmail: `accepted-${suffix}@example.test`, requestedPickupMinutes: 12, idempotencyKey: `accepted-order-${suffix}-0001`, items: [{ menuItemId: String(menuItem.id), quantity: 1, modifierIds: [String(size.id)] }] }, base as never);
  const [firstRequest, secondRequest] = await Promise.all([request("one"), request("two")]);
  assert.equal(Number((firstRequest as unknown as { tax: number }).tax), Math.round(Number((firstRequest as unknown as { subtotal: number }).subtotal) * 725 / 10_000));
  const acceptArgs = { orderId: String(firstRequest.id), idempotencyKey: "accept-order-first-0001" };
  const [accepted, acceptedReplay] = await Promise.all([acceptCafePickupOrder(null, acceptArgs, manager as never), acceptCafePickupOrder(null, acceptArgs, manager as never)]) as Array<Record<string, unknown>>;
  assert.equal(accepted.id, acceptedReplay.id);
  assert.equal(accepted.status, "accepted");
  await assert.rejects(acceptCafePickupOrder(null, { orderId: String(secondRequest.id), idempotencyKey: "accept-order-second-capacity-0001" }, manager as never), /capacity/);
  assert.equal(Number((await rawPrisma.prepBatch.findUnique({ where: { id: String(prep.id) } }))?.quantityRemaining), 2);
  assert.equal(await rawPrisma.prepBatchConsumption.count({ where: { orderId: String(firstRequest.id), quantity: { gt: 0 } } }), 1);
  await updateCafeOrderStatus(null, { orderId: String(firstRequest.id), status: "cancelled" }, manager as never);
  assert.equal(Number((await rawPrisma.prepBatch.findUnique({ where: { id: String(prep.id) } }))?.quantityRemaining), 3);
  assert.equal(await rawPrisma.prepBatchConsumption.count({ where: { orderId: String(firstRequest.id), quantity: { lt: 0 } } }), 1);
  const consumptionEvidence = await rawPrisma.prepBatchConsumption.findFirst({ where: { orderId: String(firstRequest.id), quantity: { gt: 0 } } });
  assert.ok(consumptionEvidence?.id);
  await assert.rejects(rawPrisma.prepBatchConsumption.update({ where: { id: String(consumptionEvidence.id) }, data: { quantity: 9 } }), /append-only/);
  await assert.rejects(rawPrisma.prepBatchConsumption.delete({ where: { id: String(consumptionEvidence.id) } }), /append-only/);
  await assert.rejects(rawPrisma.prepBatchConsumption.create({ data: { idempotencyKey: "cross-store-prep-consumption-0001", storeId: secondaryStoreId, prepBatchId: String(prep.id), orderId: String(firstRequest.id), quantity: 1 } }), /must match/);

  await acceptCafePickupOrder(null, { orderId: String(secondRequest.id), idempotencyKey: "accept-order-second-0001" }, manager as never);
  const line = await prisma.orderItem.findFirst({ where: { orderId: String(secondRequest.id) } });
  assert.ok(line?.id);
  await updateCafeOrderItemStatus(null, { orderItemId: String(line.id), status: "preparing", expectedStatus: "queued", idempotencyKey: "schema-accepted-kds-start-0001" }, manager as never);
  await updateCafeOrderItemStatus(null, { orderItemId: String(line.id), status: "ready", expectedStatus: "preparing", idempotencyKey: "schema-accepted-kds-ready-0001" }, manager as never);
  await assert.rejects(updateCafeOrderItemStatus(null, { orderItemId: String(line.id), status: "handed_off", expectedStatus: "ready", idempotencyKey: "schema-accepted-kds-handoff-0001" }, manager as never), /Record pay-at-pickup settlement/);
  const shift = await openRegisterShift(null, { registerName: "Acceptance Register", openingCashCents: 2500, idempotencyKey: "acceptance-register-0001" }, manager as never);
  const payment = await recordCafePayment(null, { orderId: String(secondRequest.id), method: "card", idempotencyKey: "acceptance-card-payment-0001", externalCardReference: "TERM-AP-1001", externalCardApproved: true }, manager as never) as Record<string, unknown>;
  const persistedPayment = await prisma.payment.findUnique({ where: { id: String(payment.id) } });
  assert.equal(persistedPayment?.status, "captured");
  assert.equal(persistedPayment?.method, "card");
  assert.equal(String(persistedPayment?.providerPaymentId), "external_terminal:TERM-AP-1001");
  await updateCafeOrderItemStatus(null, { orderItemId: String(line.id), status: "handed_off", expectedStatus: "ready", idempotencyKey: "schema-accepted-kds-handoff-0001" }, manager as never);
  assert.equal((await prisma.cafeOrder.findUnique({ where: { id: String(secondRequest.id) } }))?.status, "completed");
  const loyalty = await applyCafeLoyalty(null, { orderId: String(secondRequest.id), customerEmail: "accepted-two@example.test", customerName: "Accepted two" }, manager as never);
  const loyaltyReplay = await applyCafeLoyalty(null, { orderId: String(secondRequest.id), customerEmail: "accepted-two@example.test", customerName: "Accepted two" }, manager as never);
  assert.equal(loyalty?.id, loyaltyReplay?.id);
  await refundCafePayment(null, { paymentId: String(payment.id), externalRefundReference: "TERM-RF-1001", idempotencyKey: "acceptance-card-refund-0001" }, manager as never);
  const refunded = await prisma.payment.findUnique({ where: { id: String(payment.id) } });
  assert.equal(refunded?.status, "refunded");
  assert.match(String(refunded?.refundReason), /TERM-RF-1001/);
  assert.equal((await prisma.registerShift.findUnique({ where: { id: String(shift.id) } }))?.cardRefundsCents, refunded?.amount);
  await closeRegisterShift(null, { registerShiftId: String(shift.id), countedCashCents: 2500, idempotencyKey: "acceptance-register-close-0001" }, manager as never);
  await prisma.storeSetting.update({ where: { singletonKey: "primary" }, data: { pickupCapacityPerWindow: 20 } });
  proof.acceptedPickup = { requestPending: true, acceptanceReplay: true, capacityRejected: true, prepConsumedAndReleased: true, prepEvidenceAppendOnlyAndTenantScoped: true, kdsBeforePayment: true, handoffBeforePaymentDenied: true, externalCardEvidence: true, loyaltyReplay: true, externalRefundReference: true };
});

test("pay-at-pickup settlement is operator-controlled and concurrency-safe", async () => {
  const registerShift = await openRegisterShift(null, { registerName: "Pickup Register", openingCashCents: 5000, idempotencyKey: "settlement-register-schema-gate-0001" }, manager as never);
  const menuItem = await prisma.menuItem.findFirst({ where: { name: "Almond Croissant" }, select: { id: true, inventoryItem: { select: { currentStock: true } } } });
  assert.ok(menuItem?.id && menuItem.inventoryItem);
  const stockBeforeSettlement = Number((menuItem.inventoryItem as Record<string, unknown>).currentStock);
  const order = await createCafePickupOrder(null, {
    customerName: "Settlement Customer",
    customerEmail: "settlement@example.test",
    requestedPickupMinutes: 12,
    idempotencyKey: "settlement-order-schema-gate-0001",
    items: [{ menuItemId: String(menuItem.id), quantity: 1, modifierIds: [] }],
  }, base as never);
  const stockAfterIntent = await prisma.menuItem.findFirst({ where: { id: menuItem.id }, select: { inventoryItem: { select: { currentStock: true } } } });
  assert.equal(Number((stockAfterIntent?.inventoryItem as Record<string, unknown>).currentStock), stockBeforeSettlement);
  const args = { orderId: String(order.id), method: "cash", idempotencyKey: "settlement-payment-schema-gate-0001" };
  const [first, replay] = await Promise.all([
    recordCafePayment(null, args, manager as never),
    recordCafePayment(null, args, manager as never),
  ]) as Array<Record<string, unknown>>;
  assert.equal(first.id, replay.id);
  assert.equal(await prisma.payment.count({ where: { orderId: order.id, status: "captured", registerShiftId: registerShift.id } }), 1);
  const settledOrder = await prisma.cafeOrder.findUnique({ where: { id: order.id } });
  assert.equal(settledOrder?.status, "paid");
  const updatedShift = await prisma.registerShift.findUnique({ where: { id: registerShift.id } });
  assert.equal(Number(updatedShift?.cashSalesCents || 0), Number(settledOrder?.total));
  assert.equal(Number(updatedShift?.expectedCashCents || 0), 5000 + Number(settledOrder?.total));
  const stockAfterSettlement = await prisma.menuItem.findFirst({ where: { id: menuItem.id }, select: { inventoryItem: { select: { currentStock: true } } } });
  assert.equal(Number((stockAfterSettlement?.inventoryItem as Record<string, unknown>).currentStock), stockBeforeSettlement - 1);
  await assert.rejects(updateCafeOrderStatus(null, { orderId: String(order.id), status: "cancelled" }, manager as never), /Cannot transition/);
  assert.equal(await prisma.coffeeDomainEvent.count({ where: { eventType: "payment.captured", aggregateId: first.id } }), 1);
  proof.payAtPickupSettlement = { orderId: order.id, paymentId: first.id, registerShiftId: registerShift.id, attempts: 1, paidCancellationDenied: true, registerReconciled: true, inventoryConsumedAtSettlement: true };
});

test("staff scheduling and clock lifecycle is controlled, idempotent, and propagated to outbox", async () => {
  await assert.rejects(manager.query.StaffShift.createOne({ data: { idempotencyKey: "raw-staff-shift", shiftNumber: "RAW-STAFF", staff: { connect: { id: managerUserId } } }, query: "id" }));
  const args = {
    staffId: managerUserId,
    role: "shift_lead",
    startsAt: "2026-07-20T12:00:00.000Z",
    endsAt: "2026-07-20T20:00:00.000Z",
    notes: "Schema gate coverage",
    idempotencyKey: "staff-shift-schedule-0001",
  };
  const first = await scheduleCoffeeStaffShift(null, args, manager as never);
  const replay = await scheduleCoffeeStaffShift(null, args, manager as never);
  assert.equal(first.id, replay.id);
  await updateCoffeeStaffShiftStatus(null, { staffShiftId: String(first.id), status: "clocked_in", idempotencyKey: "staff-shift-clock-in-0001" }, manager as never);
  const completed = await updateCoffeeStaffShiftStatus(null, { staffShiftId: String(first.id), status: "completed", idempotencyKey: "staff-shift-complete-0001" }, manager as never);
  const completedReplay = await updateCoffeeStaffShiftStatus(null, { staffShiftId: String(first.id), status: "completed", idempotencyKey: "staff-shift-complete-0002" }, manager as never);
  assert.equal(completed.id, completedReplay.id);
  assert.equal((await prisma.staffShift.findUnique({ where: { id: first.id } }))?.status, "completed");
  assert.equal(await prisma.staffShift.count({ where: { idempotencyKey: first.idempotencyKey } }), 1);
  assert.equal(await prisma.coffeeDomainEvent.count({ where: { aggregateType: "staff_shift", aggregateId: first.id } }), 3);
  proof.staffShift = { shiftId: first.id, scheduleReplay: true, completed: true, transitionReplay: true, outboxEvents: 3, rawCreateDenied: true };
});

test("controlled operations snapshot returns only the active tenant with meaningful aggregate relations", async () => {
  const snapshot = await getCoffeeOperationsSnapshot(null, {}, manager as never) as Record<string, unknown>;
  const storeId = String(snapshot.storeId);
  assert.ok(storeId);
  for (const key of ["cafeOrders", "payments", "registerShifts", "inventoryItems", "recipes", "ingredients", "inventoryLots", "suppliers", "purchaseOrders", "prepBatches", "staffShifts", "posOrders"]) {
    const rows = snapshot[key] as Array<Record<string, unknown>>;
    assert.ok(Array.isArray(rows), `${key} must be an array`);
    assert.ok(rows.every((row) => String(row.storeId) === storeId), `${key} leaked another tenant`);
  }
  const inventoryItems = snapshot.inventoryItems as Array<Record<string, unknown>>;
  assert.equal(inventoryItems.some((item) => String(item.storeId) === secondaryStoreId), false);
  const primaryOrder = await prisma.cafeOrder.findFirst({ where: { storeId }, include: { orderItems: { take: 1 } } });
  const primaryOrderItem = (primaryOrder?.orderItems as Array<Record<string, unknown>> | undefined)?.[0];
  assert.ok(primaryOrder && primaryOrderItem);
  await assert.rejects(rawPrisma.$executeRawUnsafe(
    'INSERT INTO "OrderItem" ("id", "store", "order", "menuItem", "quantity", "price", "itemNameSnapshot", "station", "barStatus", "createdAt", "updatedAt") VALUES ($1,$2,$3,$4,1,1,$5,$6,$7,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)',
    "cross-tenant-line-proof",
    secondaryStoreId,
    primaryOrder.id,
    primaryOrderItem.menuItemId,
    "Cross-tenant line",
    "espresso_bar",
    "queued",
  ), /store must match its order/);
  const cafeOrders = snapshot.cafeOrders as Array<Record<string, unknown>>;
  assert.ok(cafeOrders.some((order) => Array.isArray(order.payments) && Array.isArray(order.orderItems) && Array.isArray(order.stockMovements)));
  proof.controlledOperationsQuery = { storeId, tenantScoped: true, aggregateRelations: true, foreignTenantExcluded: true, databaseParentGuard: true };
});

test("outbox claims are tenant-scoped, concurrency-safe, and completion is replay-safe", async () => {
  const pending = await prisma.coffeeOutboxDelivery.count({ where: { consumer: "coffee-platform", status: "pending" } });
  assert.ok(pending > 0);
  const [left, right] = await Promise.all([
    claimCoffeeOutboxDeliveries(null, { consumer: "coffee-platform", limit: 100 }, manager as never),
    claimCoffeeOutboxDeliveries(null, { consumer: "coffee-platform", limit: 100 }, manager as never),
  ]) as Array<{ lockToken: string; deliveries: Array<Record<string, unknown>> }>;
  const leftIds = new Set(left.deliveries.map((delivery) => String(delivery.id)));
  const rightIds = new Set(right.deliveries.map((delivery) => String(delivery.id)));
  assert.equal([...leftIds].some((id) => rightIds.has(id)), false);
  assert.equal(leftIds.size + rightIds.size, pending);

  for (const claim of [left, right]) {
    for (const delivery of claim.deliveries) {
      const first = await completeCoffeeOutboxDelivery(null, { deliveryId: String(delivery.id), lockToken: claim.lockToken, outcome: "delivered" }, manager as never);
      const replay = await completeCoffeeOutboxDelivery(null, { deliveryId: String(delivery.id), lockToken: claim.lockToken, outcome: "delivered" }, manager as never);
      assert.equal(first.replayed, false);
      assert.equal(replay.replayed, true);
    }
  }
  assert.equal(await prisma.coffeeOutboxDelivery.count({ where: { consumer: "coffee-platform", status: "delivered" } }), pending);
  assert.equal(await prisma.coffeeOutboxDelivery.count({ where: { storeId: secondaryStoreId } }), 0);
  proof.outbox = { pending, concurrentlyClaimed: leftIds.size + rightIds.size, overlap: 0, delivered: pending, replaySafe: true, crossTenantDeliveries: 0 };
});
