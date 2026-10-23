import { normalizePaymentProviderCode } from "../../integrations/payment";
import { fingerprintInput } from "./idempotency";
import seedTemplates from "../../platform/onboarding/lib/seed.json";
import { parseOnboardingData, type OnboardingData } from "../../platform/onboarding/lib/onboardingSchema";
import { permissions, type Session } from "../access";
import { enqueueCoffeeDomainEvent } from "../lib/coffeeDomainOutbox";
import { requireCurrentCoffeeCapability } from "./coffeeKdsAuthority";

type Args = { template: "minimal" | "full" | "custom"; data?: unknown };
type Counts = { storeSettings: number; categories: number; menuItems: number; modifiers: number; inventoryItems: number; paymentProviders: number; suppliers: number; recipes: number; ingredients: number; purchaseOrders: number; staffShifts: number; loyaltyAccounts: number; cateringOrders: number };
type TransactionClient = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  storeSetting: {
    findUnique(args: Record<string, unknown>): Promise<{ id: string; logoIcon: string | null; logoColor: string | null } | null>;
    create(args: Record<string, unknown>): Promise<{ id: string }>;
    update(args: Record<string, unknown>): Promise<{ id: string }>;
  };
  menuCategory: { findFirst(args: Record<string, unknown>): Promise<{ id: string } | null>; create(args: Record<string, unknown>): Promise<{ id: string }>; update(args: Record<string, unknown>): Promise<{ id: string }> };
  inventoryItem: { findFirst(args: Record<string, unknown>): Promise<{ id: string } | null>; create(args: Record<string, unknown>): Promise<{ id: string }>; update(args: Record<string, unknown>): Promise<{ id: string }> };
  menuItem: { findFirst(args: Record<string, unknown>): Promise<{ id: string } | null>; create(args: Record<string, unknown>): Promise<{ id: string }>; update(args: Record<string, unknown>): Promise<{ id: string }> };
  menuItemImage: { findFirst(args: Record<string, unknown>): Promise<{ id: string } | null>; create(args: Record<string, unknown>): Promise<{ id: string }>; update(args: Record<string, unknown>): Promise<{ id: string }> };
  menuItemModifier: { findFirst(args: Record<string, unknown>): Promise<{ id: string } | null>; create(args: Record<string, unknown>): Promise<{ id: string }>; update(args: Record<string, unknown>): Promise<{ id: string }> };
  paymentProvider: { findUnique(args: Record<string, unknown>): Promise<{ id: string } | null>; create(args: Record<string, unknown>): Promise<{ id: string }>; update(args: Record<string, unknown>): Promise<{ id: string }> };
  supplier: { findFirst(args: Record<string, unknown>): Promise<{ id: string } | null>; create(args: Record<string, unknown>): Promise<{ id: string }>; update(args: Record<string, unknown>): Promise<{ id: string }> };
  recipe: { findFirst(args: Record<string, unknown>): Promise<{ id: string } | null>; create(args: Record<string, unknown>): Promise<{ id: string }>; update(args: Record<string, unknown>): Promise<{ id: string }> };
  ingredient: { findFirst(args: Record<string, unknown>): Promise<{ id: string } | null>; create(args: Record<string, unknown>): Promise<{ id: string }>; update(args: Record<string, unknown>): Promise<{ id: string }> };
  purchaseOrder: { findUnique(args: Record<string, unknown>): Promise<{ id: string } | null>; create(args: Record<string, unknown>): Promise<{ id: string }> };
  staffShift: { findUnique(args: Record<string, unknown>): Promise<{ id: string } | null>; create(args: Record<string, unknown>): Promise<{ id: string }> };
  loyaltyAccount: { findFirst(args: Record<string, unknown>): Promise<{ id: string } | null>; create(args: Record<string, unknown>): Promise<{ id: string }> };
  cateringOrder: { findUnique(args: Record<string, unknown>): Promise<{ id: string } | null>; create(args: Record<string, unknown>): Promise<{ id: string }> };
  stockMovement: { create(args: Record<string, unknown>): Promise<{ id: string }> };
  user: { findUnique(args: Record<string, unknown>): Promise<{ email: string | null } | null>; update(args: Record<string, unknown>): Promise<{ id: string }> };
};
type Context = {
  session?: Session;
  prisma: { $transaction<T>(fn: (tx: unknown) => Promise<T>, options: Record<string, unknown>): Promise<T> };
};

const INVENTORY_BY_MENU_ITEM: Record<string, string> = {
  "Almond Croissant": "Almond Croissant",
  "House Blend Beans": "House Blend Beans",
};

function categoryForInventory(name: string) {
  const value = name.toLowerCase();
  if (value.includes("milk")) return "milk";
  if (value.includes("syrup")) return "syrup";
  if (value.includes("croissant") || value.includes("dough")) return "bakery";
  return "coffee";
}
function selectedData(args: Args): OnboardingData {
  const source = args.template === "custom" ? args.data : seedTemplates[args.template];
  const result = parseOnboardingData(source);
  if (!result.success) throw new Error(`Setup data is invalid: ${result.errors.join("; ")}`);
  for (const provider of result.data.paymentProviders) normalizePaymentProviderCode(provider.code);
  return result.data;
}
function bump(counts: Counts, key: keyof Counts) {
  counts[key] += 1;
}
function offsetDate(now: Date, input: { days?: number; hours?: number }) {
  return new Date(now.getTime() + (Number(input.days || 0) * 24 + Number(input.hours || 0)) * 60 * 60 * 1000);
}

async function upsertNamed(
  list: { findFirst(args: Record<string, unknown>): Promise<{ id: string } | null>; create(args: Record<string, unknown>): Promise<{ id: string }>; update(args: Record<string, unknown>): Promise<{ id: string }> },
  storeId: string,
  name: string,
  data: Record<string, unknown>,
) {
  const existing = await list.findFirst({ where: { name, storeId }, select: { id: true } });
  // Onboarding is create-if-missing, never a way to overwrite live definitions.
  if (existing) return { ...existing, created: false };
  return { ...(await list.create({ data, select: { id: true } })), created: true };
}

async function runInTransaction(rawTx: unknown, data: OnboardingData, userId: string, session: Session | undefined, template: Args["template"]) {
  await requireCurrentCoffeeCapability(rawTx as never, session, ["canManageOnboarding"], "You do not have permission to run coffee shop onboarding");
  const tx = rawTx as TransactionClient;
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", "coffee-onboarding");
  const counts: Counts = { storeSettings: 0, categories: 0, menuItems: 0, modifiers: 0, inventoryItems: 0, paymentProviders: 0, suppliers: 0, recipes: 0, ingredients: 0, purchaseOrders: 0, staffShifts: 0, loyaltyAccounts: 0, cateringOrders: 0 };

  // Counts report records this run created; existing records are kept as they are.
  const existingStore = await tx.storeSetting.findUnique({ where: { singletonKey: "primary" }, select: { id: true, logoIcon: true, logoColor: true } });
  let storeId: string;
  if (existingStore) {
    storeId = existingStore.id;
    // Repair only branding that is missing; a merchant's existing logo choice is never replaced.
    const repair: Record<string, unknown> = {};
    if (!existingStore.logoIcon?.trim()) repair.logoIcon = data.storeInfo.logoIcon;
    if (existingStore.logoColor == null || existingStore.logoColor === "") repair.logoColor = data.storeInfo.logoColor;
    if (Object.keys(repair).length) await tx.storeSetting.update({ where: { id: storeId }, data: repair, select: { id: true } });
  } else {
    // Template stores publish the operator's own address, never the sample one.
    const operator = template === "custom" ? null : await tx.user.findUnique({ where: { id: userId }, select: { email: true } });
    const storeInfo = operator?.email ? { ...data.storeInfo, contactEmail: operator.email } : data.storeInfo;
    storeId = (await tx.storeSetting.create({ data: { singletonKey: "primary", ...storeInfo }, select: { id: true } })).id;
    bump(counts, "storeSettings");
  }

  const categoryIds = new Map<string, string>();
  for (const category of data.categories) {
    const record = await upsertNamed(tx.menuCategory, storeId, category.name, { ...category, storeId, active: true });
    categoryIds.set(category.name, record.id);
    if (record.created) bump(counts, "categories");
  }

  const inventoryIds = new Map<string, string>();
  for (const inventory of data.inventoryItems) {
    const existing = await tx.inventoryItem.findFirst({ where: { name: inventory.name, storeId }, select: { id: true } });
    const inventoryData = {
      name: inventory.name,
      storeId,
      sku: inventory.sku,
      category: inventory.category || categoryForInventory(inventory.name),
      supplierName: inventory.supplierName || null,
      unit: inventory.unit,
      parLevel: inventory.parLevel,
      reorderPoint: inventory.reorderPoint,
      costPerUnit: inventory.costPerUnit,
    };
    const openingStock = inventory.currentStock || inventory.quantityOnHand || "0";
    const record = existing
      ? existing
      : await tx.inventoryItem.create({
          data: { ...inventoryData, currentStock: openingStock },
          select: { id: true },
        });
    if (!existing && Number(openingStock) > 0) {
      // The opening balance is a ledger entry like any other stock change.
      await tx.stockMovement.create({
        data: { storeId, inventoryItemId: record.id, type: "adjustment", quantity: openingStock, reason: "Opening stock", createdById: userId },
        select: { id: true },
      });
    }
    inventoryIds.set(inventory.name, record.id);
    if (!existing) bump(counts, "inventoryItems");
  }

  const menuItemIds = new Map<string, string>();
  for (const item of data.menuItems) {
    const categoryId = categoryIds.get(item.categoryName);
    if (!categoryId) throw new Error(`Onboarding category is missing for ${item.name}`);
    const inventoryId = inventoryIds.get(INVENTORY_BY_MENU_ITEM[item.name]);
    const record = await upsertNamed(tx.menuItem, storeId, item.name, {
      name: item.name,
      storeId,
      shortDescription: item.shortDescription,
      price: item.price,
      prepTimeMinutes: item.prepTimeMinutes,
      barStation: item.barStation,
      // Pastries and retail goods aren't served at a temperature.
      ...(item.barStation === "retail_shelf" || item.barStation === "pastry_case" ? { temperatureOptions: [] } : {}),
      featured: item.featured,
      popular: item.popular,
      imageUrl: item.imageUrl || null,
      caffeineMg: item.caffeineMg,
      calories: item.calories,
      available: true,
      categoryId,
      inventoryItemId: inventoryId || null,
    });
    menuItemIds.set(item.name, record.id);
    if (item.imageUrl && record.created) {
      const image = await tx.menuItemImage.findFirst({ where: { menuItems: { some: { id: record.id } } }, select: { id: true } });
      const imageData = { imagePath: item.imageUrl, altText: item.name, order: 0 };
      if (!image) await tx.menuItemImage.create({ data: { ...imageData, menuItems: { connect: { id: record.id } } }, select: { id: true } });
    }
    if (record.created) bump(counts, "menuItems");
  }

  for (const modifier of data.modifiers) {
    const menuItemId = menuItemIds.get(modifier.menuItemName);
    if (!menuItemId) throw new Error(`Onboarding menu item is missing for modifier ${modifier.name}`);
    const existing = await tx.menuItemModifier.findFirst({ where: { name: modifier.name, menuItemId }, select: { id: true } });
    const modifierData = {
      storeId,
      inventoryAction: modifier.inventoryAction,
      inventoryItemId: modifier.inventoryItemName ? inventoryIds.get(modifier.inventoryItemName) : null,
      replacesInventoryItemId: modifier.replacesInventoryItemName ? inventoryIds.get(modifier.replacesInventoryItemName) : null,
      inventoryQuantity: modifier.inventoryQuantity,
      name: modifier.name,
      modifierGroup: modifier.modifierGroup,
      modifierGroupLabel: modifier.modifierGroupLabel,
      priceAdjustment: modifier.priceAdjustment,
      defaultSelected: modifier.defaultSelected,
      required: modifier.required,
      minSelections: modifier.minSelections,
      maxSelections: modifier.maxSelections,
      menuItemId,
      inStock: true,
    };
    if (!existing) {
      await tx.menuItemModifier.create({ data: modifierData, select: { id: true } });
      bump(counts, "modifiers");
    }
  }

  const supplierIds = new Map<string, string>();
  for (const supplier of data.suppliers) {
    const record = await upsertNamed(tx.supplier, storeId, supplier.name, { ...supplier, storeId });
    supplierIds.set(supplier.name, record.id);
    if (record.created) bump(counts, "suppliers");
  }

  const recipeIds = new Map<string, string>();
  for (const recipe of data.recipes) {
    const { menuItemName, ...recipeData } = recipe;
    const menuItemId = menuItemIds.get(menuItemName);
    if (!menuItemId) throw new Error(`Onboarding menu item is missing for recipe ${recipe.name}`);
    const record = await upsertNamed(tx.recipe, storeId, recipe.name, { ...recipeData, menuItemId, storeId, active: true });
    recipeIds.set(recipe.name, record.id);
    if (record.created) bump(counts, "recipes");
  }
  for (const ingredient of data.ingredients) {
    const recipeId = recipeIds.get(ingredient.recipeName);
    const inventoryItemId = inventoryIds.get(ingredient.inventoryItemName);
    if (!recipeId || !inventoryItemId) throw new Error(`Onboarding dependency is missing for ingredient ${ingredient.name}`);
    const existing = await tx.ingredient.findFirst({ where: { recipeId, inventoryItemId, name: ingredient.name, storeId }, select: { id: true } });
    const ingredientData = { storeId, recipeId, inventoryItemId, name: ingredient.name, quantity: ingredient.quantity, unit: ingredient.unit, optional: ingredient.optional, notes: ingredient.notes };
    if (!existing) {
      await tx.ingredient.create({ data: ingredientData, select: { id: true } });
      bump(counts, "ingredients");
    }
  }

  const now = new Date();
  for (const purchaseOrder of data.purchaseOrders) {
    const supplierId = supplierIds.get(purchaseOrder.supplierName);
    const inventoryItemId = inventoryIds.get(purchaseOrder.inventoryItemName);
    if (!supplierId || !inventoryItemId) throw new Error(`Onboarding dependency is missing for purchase order ${purchaseOrder.poNumber}`);
    const existing = await tx.purchaseOrder.findUnique({ where: { poNumber: purchaseOrder.poNumber }, select: { id: true } });
    if (existing) continue;
    await tx.purchaseOrder.create({ data: { storeId, supplierId, inventoryItemId, poNumber: purchaseOrder.poNumber, orderedQuantity: purchaseOrder.orderedQuantity, unitCostCents: purchaseOrder.unitCostCents, subtotalCents: Math.round(Number(purchaseOrder.orderedQuantity) * purchaseOrder.unitCostCents), status: purchaseOrder.status, orderedAt: offsetDate(now, { days: purchaseOrder.orderedOffsetDays }), expectedAt: offsetDate(now, { days: purchaseOrder.expectedOffsetDays }), notes: purchaseOrder.notes, idempotencyKey: `onboarding:${purchaseOrder.poNumber}` }, select: { id: true } });
    bump(counts, "purchaseOrders");
  }
  for (const shift of data.staffShifts) {
    const existing = await tx.staffShift.findUnique({ where: { shiftNumber: shift.shiftNumber }, select: { id: true } });
    if (!existing) {
      const startsAt = offsetDate(now, { hours: shift.startsOffsetHours });
      await tx.staffShift.create({ data: { storeId, staffId: userId, idempotencyKey: `onboarding:${shift.shiftNumber}`, shiftNumber: shift.shiftNumber, role: shift.role, status: shift.status, startsAt, endsAt: offsetDate(startsAt, { hours: shift.durationHours }), notes: shift.notes }, select: { id: true } });
      bump(counts, "staffShifts");
    }
  }
  for (const account of data.loyaltyAccounts) {
    const email = account.customerEmail.toLowerCase();
    const existing = await tx.loyaltyAccount.findFirst({ where: { storeId, customerEmail: email }, select: { id: true } });
    if (!existing) {
      await tx.loyaltyAccount.create({ data: { ...account, customerEmail: email, storeId }, select: { id: true } });
      bump(counts, "loyaltyAccounts");
    }
  }
  for (const catering of data.cateringOrders) {
    const existing = await tx.cateringOrder.findUnique({ where: { cateringNumber: catering.cateringNumber }, select: { id: true } });
    if (!existing) {
      await tx.cateringOrder.create({ data: { storeId, cateringNumber: catering.cateringNumber, customerName: catering.customerName, customerEmail: catering.customerEmail.toLowerCase(), status: catering.status, eventAt: offsetDate(now, { days: catering.eventOffsetDays }), guestCount: catering.guestCount, deliveryAddress: catering.deliveryAddress, subtotalCents: 0, notes: catering.notes }, select: { id: true } });
      bump(counts, "cateringOrders");
    }
  }

  for (const providerInput of data.paymentProviders) {
    const code = normalizePaymentProviderCode(providerInput.code);
    const providerData = { name: providerInput.name, code, metadata: { configuredBy: "onboarding" } };
    const existing = await tx.paymentProvider.findUnique({ where: { code }, select: { id: true } });
    if (!existing) {
      await tx.paymentProvider.create({ data: { ...providerData, isInstalled: code === "pp_system_default" }, select: { id: true } });
      bump(counts, "paymentProviders");
    }
  }

  await tx.user.update({ where: { id: userId }, data: { onboardingStatus: "completed" }, select: { id: true } });
  await enqueueCoffeeDomainEvent(tx as never, {
    storeId,
    eventKey: `store:${storeId}:onboarding:${fingerprintInput(data).slice(0, 24)}:completed:v1`,
    eventType: "store.onboarding_completed",
    aggregateType: "store",
    aggregateId: storeId,
    payload: { storeId, templateCounts: counts },
  });
  return counts;
}

export default async function runCoffeeOnboarding(_root: unknown, args: Args, context: Context) {
  const userId = context.session?.itemId;
  if (!userId || !permissions.canManageOnboarding({ session: context.session })) {
    throw new Error("You do not have permission to run coffee shop onboarding");
  }
  if (!new Set(["minimal", "full", "custom"]).has(args.template)) throw new Error("Invalid onboarding template");
  const data = selectedData(args);
  const counts = await context.prisma.$transaction(
    (tx) => runInTransaction(tx, data, userId, context.session, args.template),
    // Bounded below the GraphQL execution deadline so a timed-out request rolls back
    // instead of committing after the response was already sent.
    { maxWait: 2000, timeout: 7000, isolationLevel: "Serializable" },
  );
  return { status: "completed", ...counts };
}
