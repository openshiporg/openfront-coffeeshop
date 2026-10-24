import { randomBytes, randomUUID } from "node:crypto";

import { permissions, type Session } from "../access";
import { assertCoffeeStoreOwnership, enqueueCoffeeDomainEvent } from "../lib/coffeeDomainOutbox";
import { buildScopedIdempotencyKey, fingerprintInput, normalizeIdempotencyKey } from "./idempotency";
import { COFFEE_PICKUP_SCHEDULE_MAX_MINUTES, assertCoffeeOrderingAvailable, coffeeFirstPickupMinutes } from "./coffeeAvailability";
import { consumeCafeInventoryRequirements, getCafeInventoryRequirements } from "./coffeeInventoryConsumption";
import { assertCafeMoneyCents, cafeQuoteFingerprint, calculateCafeTotals } from "./coffeePricing";
import { PICKUP_SETTINGS_CHANGED_MESSAGE, readLockedPickupSettings, requireCafeTenderOperator, validateCafeModifierSelections, validateCafeOrderLines } from "./coffeeOrderPolicy";
import { requireCurrentCoffeeCapability } from "./coffeeKdsAuthority";
import { assertCafeRequirementsInStock, cafeEarliestPickupMinutes, cafeMenuItemImageReference, cafeReceiptKeyMatches, isPublishedMenuItem, normalizeCafeReceiptKey } from "./cafeStorefrontPolicy";
import { cafeCustomerError } from "../lib/cafeCustomerError";

interface CafePickupOrderItemInput {
  menuItemId: string;
  quantity: number;
  modifierIds?: string[];
  specialInstructions?: string | null;
}
type ModifierSnapshot = { id: string; name: string; group: string; groupLabel: string; priceAdjustment: number };
type ModifierRecord = {
  id: string;
  name: string;
  priceAdjustment: number | null;
  inStock: boolean | null;
  modifierGroup: string | null;
  modifierGroupLabel: string | null;
  required: boolean | null;
  minSelections: number | null;
  maxSelections: number | null;
  menuItemId: string | null;
};
type InventoryRecord = { id: string; storeId: string; currentStock: unknown; unit: string | null };
type MenuItemRecord = {
  id: string;
  storeId: string;
  name: string;
  price: number;
  available: boolean;
  barStation: string | null;
  imageUrl: string | null;
  inventoryItem: InventoryRecord | null;
  modifiers: ModifierRecord[];
  menuItemImages: Array<{ imagePath: string; image_id?: string | null; image_extension?: string | null }>;
  serviceWindows: string[];
  prepTimeMinutes?: number | null;
  category?: { active: boolean | null } | null;
};
interface CreateCafePickupOrderArgs {
  customerName: string;
  customerEmail?: string | null;
  customerPhone?: string | null;
  pickupName?: string | null;
  requestedPickupMinutes?: number | null;
  specialInstructions?: string | null;
  paymentMethod?: string | null;
  orderSource?: string | null;
  fulfillmentType?: string | null;
  idempotencyKey?: string | null;
  /** Storefront: receipt credential created by the customer's browser; it is the only proof that can replay a guest request. */
  receiptKey?: string | null;
  registerShiftId?: string | null;
  tipCents?: number | null;
  /** POS: identity of the priced ticket the cashier reviewed (from quoteCafeOrder). */
  quoteFingerprint?: string | null;
  /** POS manual card: operator attests the external terminal approved this exact sale. */
  externalCardReference?: string | null;
  externalCardApproved?: boolean | null;
  cashTenderedCents?: number | null;
  items: CafePickupOrderItemInput[];
}
type CafePickupOrderResult = {
  id: string;
  requestFingerprint?: string | null;
};
type TransactionClient = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  $queryRawUnsafe<R>(query: string, ...values: unknown[]): Promise<R>;
  storeSetting: {
    findUnique(args: { where: { singletonKey: string }; select: Record<string, boolean> }): Promise<{
      id: string;
      pickupLeadTimeMinutes: number | null;
      pickupWindowMinutes: number | null;
      pickupCapacityPerWindow: number | null;
      taxRateBasisPoints: number | null;
      timezone: string | null;
      currencyCode: string;
      weeklyHours: unknown;
    } | null>;
  };
  cafeOrder: {
    findUnique(args: { where: { idempotencyKey: string }; select: { id: true; requestFingerprint: true; customerId: true; secretKey: true } }): Promise<(CafePickupOrderResult & { customerId: string | null; secretKey: string | null }) | null>;
    count(args: { where: Record<string, unknown> }): Promise<number>;
    create(args: { data: Record<string, unknown>; select: { id: true } }): Promise<{ id: string }>;
  };
  menuItem: {
    findMany(args: { where: { id: { in: string[] } }; include: Record<string, unknown> }): Promise<MenuItemRecord[]>;
  };
  recipe: { findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>> };
  menuItemModifier: { findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>> };
  inventoryItem: {
    findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    update(args: Record<string, unknown>): Promise<unknown>;
  };
  inventoryLot: {
    findMany(args: Record<string, unknown>): Promise<Array<{ id: string; quantityRemaining: unknown }>>;
    update(args: Record<string, unknown>): Promise<unknown>;
  };
  stockMovement: { create(args: { data: Record<string, unknown> }): Promise<unknown> };
  prepBatch: { findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>>; findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>; update(args: Record<string, unknown>): Promise<unknown> };
  prepBatchConsumption: { create(args: Record<string, unknown>): Promise<unknown> };
  orderItem: { create(args: { data: Record<string, unknown> }): Promise<unknown> };
  payment: {
    create(args: { data: Record<string, unknown> }): Promise<unknown>;
    findFirst(args: { where: Record<string, unknown>; select: { id: true } }): Promise<{ id: string } | null>;
  };
  paymentProvider: { findUnique(args: Record<string, unknown>): Promise<{ id: string } | null> };
  posOrder: { create(args: { data: Record<string, unknown> }): Promise<unknown> };
  registerShift: {
    findUnique(args: { where: { id: string } }): Promise<Record<string, unknown> | null>;
    update(args: { where: { id: string }; data: Record<string, unknown> }): Promise<unknown>;
  };
};
type CreateCafePickupOrderContext = {
  session?: Session;
  prisma: {
    $transaction<T>(fn: (tx: unknown) => Promise<T>, options: Record<string, unknown>): Promise<T>;
  };
  sudo(): {
    query: {
      CafeOrder: {
        findOne(args: { where: { id: string }; query: string }): Promise<CafePickupOrderResult | null>;
      };
    };
  };
};

const ORDER_RETURN_QUERY = `
  id orderNumber status handoffCode customerName pickupName promisedAt subtotal tax tip total currencyCode secretKey requestFingerprint
  orderItems { id quantity itemNameSnapshot imagePathSnapshot customizationsSummary modifierSnapshot specialInstructions price }
`;
const MAX_TRANSACTION_RETRIES = 3;

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() || "";
}
function normalizePhone(phone?: string | null) {
  return phone?.replace(/[^+\d]/g, "") || "";
}
/** CF-YYMMDD-XXXXXXXX, dated on the store's calendar so evening orders carry the day they were placed. */
export function generateOrderNumber(timezone?: string | null, at = new Date()) {
  let date: string;
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone || "America/New_York", year: "2-digit", month: "2-digit", day: "2-digit" }).formatToParts(at);
    const part = (type: string) => parts.find((entry) => entry.type === type)?.value || "";
    date = `${part("year")}${part("month")}${part("day")}`;
  } catch {
    date = at.toISOString().slice(2, 10).replace(/-/g, "");
  }
  return `CF-${date}-${randomBytes(4).toString("hex").toUpperCase()}`;
}
function transactionConflict(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && (error as { code?: string }).code === "P2034";
}
async function createOrderTransaction({
  rawTx,
  args,
  items,
  isStaff,
  scopedKey,
  requestFingerprint,
  paymentMethod,
  orderSource,
  fulfillmentType,
  session,
}: {
  rawTx: unknown;
  args: CreateCafePickupOrderArgs;
  items: CafePickupOrderItemInput[];
  isStaff: boolean;
  scopedKey: string | null;
  requestFingerprint: string | null;
  paymentMethod: string;
  orderSource: string;
  fulfillmentType: string;
  session?: Session;
}) {
  const tx = rawTx as TransactionClient;
  if (scopedKey) {
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-order:${scopedKey}`);
    const existing = await tx.cafeOrder.findUnique({
      where: { idempotencyKey: scopedKey },
      select: { id: true, requestFingerprint: true, customerId: true, secretKey: true },
    });
    if (existing) {
      if (existing.requestFingerprint !== requestFingerprint) throw new Error("Idempotency key was already used with different order data");
      // Storefront replay discloses the receipt only to its owner: the signed-in customer or the holder of the receipt key.
      if (!isStaff) {
        const ownsAsCustomer = session?.listKey === "User" && Boolean(existing.customerId) && existing.customerId === session.itemId;
        if (!ownsAsCustomer && !cafeReceiptKeyMatches(args.receiptKey, existing.secretKey)) throw new Error("This pickup request could not be confirmed");
      }
      return existing.id;
    }
  }

  const isImmediateTender = isStaff && ["cash", "manual_card"].includes(paymentMethod);
  let registerShift: Record<string, unknown> | null = null;
  if (isImmediateTender) {
    requireCafeTenderOperator(session);
    if (!args.registerShiftId) throw new Error("Immediate tender requires an open register shift");
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-register-shift:${args.registerShiftId}`);
    // Current tender authority, sealed until commit (same fence as the KDS).
    await requireCurrentCoffeeCapability(tx as never, session, ["canManageOrders"], "Not authorized to record cafe payments");
    await requireCurrentCoffeeCapability(tx as never, session, ["canManagePayments"], "Not authorized to record cafe payments");
    registerShift = await tx.registerShift.findUnique({ where: { id: args.registerShiftId } });
    if (!registerShift || registerShift.status !== "open") throw new Error("POS orders require an open register shift");
  }

  const itemIds = [...new Set(items.map((item) => item.menuItemId))].sort();
  for (const id of itemIds) {
    await tx.$executeRawUnsafe(
      "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
      "coffee-menu-item",
      id,
    );
  }

  const menuItems = await tx.menuItem.findMany({
    where: { id: { in: itemIds } },
    include: {
      inventoryItem: { select: { id: true, storeId: true, currentStock: true, unit: true } },
      modifiers: true,
      menuItemImages: { orderBy: { order: "asc" }, take: 1, select: { imagePath: true, image_id: true, image_extension: true } },
      category: { select: { active: true } },
    },
  });
  const menuItemMap = new Map(menuItems.map((item) => [item.id, item]));
  const settings = await tx.storeSetting.findUnique({
    where: { singletonKey: "primary" },
    select: { id: true, pickupLeadTimeMinutes: true, pickupWindowMinutes: true, pickupCapacityPerWindow: true, taxRateBasisPoints: true, timezone: true, currencyCode: true, weeklyHours: true },
  });
  if (!settings) throw new Error("Primary coffee store is not configured");
  const storeId = settings.id;
  if (registerShift) assertCoffeeStoreOwnership(registerShift.storeId, storeId, "Register shift");
  if (!isStaff) {
    const customerEmail = normalizeEmail(args.customerEmail);
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-public-intake:${storeId}`);
    const [recentForContact, totalOpenRequests] = await Promise.all([
      tx.cafeOrder.count({ where: { storeId, orderSource: "online", status: "open", customerEmail, createdAt: { gte: new Date(Date.now() - 60 * 60_000) } } }),
      tx.cafeOrder.count({ where: { storeId, orderSource: "online", status: "open" } }),
    ]);
    if (recentForContact >= 3) throw cafeCustomerError("This email already has the maximum number of open pickup requests");
    if (totalOpenRequests >= Math.max(50, Number(settings.pickupCapacityPerWindow || 20) * 3)) throw cafeCustomerError("Online pickup requests are temporarily paused while the cafe catches up");
  }

  const normalizedItems = items.map((item) => {
    const menuItem = menuItemMap.get(item.menuItemId);
    if (!menuItem) throw new Error(`Menu item not found: ${item.menuItemId}`);
    assertCoffeeStoreOwnership(menuItem.storeId, storeId, `Menu item ${menuItem.name}`);
    if (menuItem.inventoryItem) assertCoffeeStoreOwnership(menuItem.inventoryItem.storeId, storeId, `Inventory for ${menuItem.name}`);
    if (!menuItem.available) throw cafeCustomerError(`${menuItem.name} is currently unavailable`);
    if (!isStaff && !isPublishedMenuItem(menuItem)) throw cafeCustomerError(`${menuItem.name} is currently unavailable`);

    const selectedModifiers = (item.modifierIds || []).map((id) => {
      const modifier = menuItem.modifiers.find((candidate) => candidate.id === id);
      if (!modifier || modifier.menuItemId !== menuItem.id) throw new Error(`Modifier ${id} is not valid for ${menuItem.name}`);
      if (modifier.inStock === false) throw cafeCustomerError(`${modifier.name} is currently unavailable`);
      return modifier;
    });
    validateCafeModifierSelections(menuItem, selectedModifiers);

    const quantity = Math.max(1, Math.floor(Number(item.quantity || 1)));
    const modifierSnapshot: ModifierSnapshot[] = selectedModifiers.map((modifier) => ({
      id: modifier.id,
      name: modifier.name,
      group: modifier.modifierGroup || "default",
      groupLabel: modifier.modifierGroupLabel || modifier.modifierGroup || "Modifier",
      priceAdjustment: Number(modifier.priceAdjustment || 0),
    }));
    const unitPrice = menuItem.price + modifierSnapshot.reduce((sum, modifier) => sum + modifier.priceAdjustment, 0);
    if (!Number.isSafeInteger(unitPrice) || unitPrice < 0) throw new Error(`${menuItem.name} has an invalid calculated price`);
    assertCafeMoneyCents(unitPrice, `${menuItem.name} price`);
    return {
      menuItem,
      selectedModifiers,
      modifierSnapshot,
      quantity,
      unitPrice,
      specialInstructions: item.specialInstructions?.trim() || "",
    };
  });

  let leadMinutes = Math.max(5, Number(args.requestedPickupMinutes || settings.pickupLeadTimeMinutes || 12));
  if (!isStaff) {
    // Same earliest-pickup rule as quoteCafeOrder; a request may be later, never earlier.
    const earliest = cafeEarliestPickupMinutes(Number(settings.pickupLeadTimeMinutes) || 12, normalizedItems.map((item) => item.menuItem.prepTimeMinutes));
    const firstOpen = coffeeFirstPickupMinutes(settings, earliest, normalizedItems.map((item) => item.menuItem.serviceWindows));
    if (firstOpen == null) throw cafeCustomerError("Pickup isn't available in the next two days");
    leadMinutes = args.requestedPickupMinutes ?? firstOpen;
    if (leadMinutes < earliest) throw cafeCustomerError("The requested pickup time is earlier than the cafe can prepare this order. Review the pickup estimate and submit again.");
  }
  const promisedAt = new Date(Date.now() + leadMinutes * 60_000);
  if (!isStaff) {
    // A closed cafe takes requests for a pickup inside its hours (order ahead); the pickup time itself must be open.
    for (const item of normalizedItems) assertCoffeeOrderingAvailable(settings, promisedAt, item.menuItem.serviceWindows);
  }

  if (fulfillmentType === "pickup") {
    const windowMinutes = Math.max(5, Number(settings?.pickupWindowMinutes || 15));
    const windowMs = windowMinutes * 60_000;
    const windowStart = new Date(Math.floor(promisedAt.getTime() / windowMs) * windowMs);
    const windowEnd = new Date(windowStart.getTime() + windowMs);
    const capacityKey = windowStart.toISOString();
    await tx.$executeRawUnsafe(
      "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
      "coffee-pickup-capacity",
      capacityKey,
    );
    // Lead time, window and capacity come from the settings row held under this lock.
    const locked = await readLockedPickupSettings(tx);
    if (Math.max(5, Number(locked.pickupWindowMinutes || 15)) !== windowMinutes || (Number(locked.pickupLeadTimeMinutes) || 12) !== (Number(settings.pickupLeadTimeMinutes) || 12)) {
      throw cafeCustomerError(PICKUP_SETTINGS_CHANGED_MESSAGE);
    }
    const capacity = Math.max(1, Number(locked.pickupCapacityPerWindow || 20));
    const reservations = await tx.cafeOrder.count({
      where: {
        storeId,
        fulfillmentType: "pickup",
        promisedAt: { gte: windowStart, lt: windowEnd },
        status: { in: ["accepted", "paid", "in_bar_queue", "preparing", "ready"] },
      },
    });
    if (reservations >= capacity) throw cafeCustomerError("The requested pickup window is at capacity");
  }

  const inventoryRequirements = await getCafeInventoryRequirements(tx, storeId, normalizedItems.map((item) => ({
    menuItemId: item.menuItem.id,
    fallbackInventoryItemId: item.menuItem.inventoryItem?.id,
    quantity: item.quantity,
    modifierIds: item.modifierSnapshot.map((modifier) => modifier.id),
  })));
  if (!isStaff) await assertCafeRequirementsInStock(tx, storeId, inventoryRequirements);

  const taxRateBasisPoints = Number(settings.taxRateBasisPoints ?? 875);
  const pricedLines = normalizedItems.map((item) => ({ menuItemId: item.menuItem.id, quantity: item.quantity, modifierIds: item.modifierSnapshot.map((modifier) => modifier.id), unitPrice: item.unitPrice }));
  const { subtotal, tax, tip, total } = calculateCafeTotals(pricedLines, taxRateBasisPoints, isStaff ? Number(args.tipCents || 0) : 0);
  if (args.quoteFingerprint) {
    const current = cafeQuoteFingerprint({ storeId, currencyCode: settings.currencyCode, taxRateBasisPoints, lines: pricedLines, subtotal, tax, tip, total });
    if (current !== args.quoteFingerprint) throw cafeCustomerError("Prices or tax changed since this ticket was reviewed. Review the updated total and submit again.");
  }
  // A zero-total ticket needs no tender: no payment row, no card or cash movement.
  const tenderRequired = isImmediateTender && total > 0;
  const externalCardReference = paymentMethod === "manual_card" ? (args.externalCardReference?.trim() || "") : "";
  const now = new Date();
  const orderNumber = generateOrderNumber(settings.timezone);
  const order = await tx.cafeOrder.create({
    data: {
      orderNumber,
      fulfillmentType,
      orderSource,
      status: isImmediateTender ? "paid" : "open",
      customerName: args.customerName.trim(),
      customerEmail: normalizeEmail(args.customerEmail),
      customerPhone: normalizePhone(args.customerPhone),
      pickupName: args.pickupName?.trim() || args.customerName.trim(),
      specialInstructions: args.specialInstructions?.trim() || "",
      subtotal,
      tax,
      tip,
      total,
      paidAt: isImmediateTender ? now : null,
      promisedAt,
      currencyCode: settings.currencyCode,
      idempotencyKey: scopedKey,
      requestFingerprint,
      customerId: !isStaff && session?.listKey === "User" ? session.itemId : null,
      storeId,
      handoffCode: randomBytes(3).toString("hex").toUpperCase(),
      secretKey: !isStaff && args.receiptKey ? args.receiptKey : randomBytes(32).toString("hex"),
    },
    select: { id: true },
  });

  for (const item of normalizedItems) {
    await tx.orderItem.create({
      data: {
        storeId,
        orderId: order.id,
        menuItemId: item.menuItem.id,
        appliedModifiers: item.selectedModifiers.length ? { connect: item.selectedModifiers.map(({ id }) => ({ id })) } : undefined,
        quantity: item.quantity,
        price: item.unitPrice,
        itemNameSnapshot: item.menuItem.name,
        imagePathSnapshot: cafeMenuItemImageReference(item.menuItem) || "",
        customizationsSummary: item.modifierSnapshot.map((modifier) => modifier.name).join(", "),
        modifierSnapshot: item.modifierSnapshot,
        specialInstructions: item.specialInstructions,
        station: item.menuItem.barStation || "espresso_bar",
        barStatus: "queued",
        queuedAt: now,
      },
    });
  }

  if (isImmediateTender) {
    await consumeCafeInventoryRequirements(tx, {
      storeId,
      orderId: order.id,
      orderNumber,
      requirements: inventoryRequirements,
      createdById: session?.listKey === "User" ? session.itemId : null,
      reason: `Counter sale ${orderNumber}`,
    });
  }

  if (tenderRequired) {
    const manualProvider = await tx.paymentProvider.findUnique({ where: { code: "pp_system_default" }, select: { id: true } });
    if (!manualProvider) throw new Error("System payment provider is not configured");
    // Manual tender evidence only: cash counted at the drawer, or an operator-attested
    // external terminal approval. Neither is processor-confirmed settlement.
    const providerPaymentId = paymentMethod === "cash" ? `cash_${randomUUID()}` : `external_terminal:${externalCardReference}`;
    if (paymentMethod === "manual_card") {
      const duplicate = await tx.payment.findFirst({ where: { storeId, method: "card", providerPaymentId }, select: { id: true } });
      if (duplicate) throw new Error("This terminal approval reference is already recorded on another sale");
    }
    await tx.payment.create({
      data: {
        orderId: order.id,
        status: "captured",
        method: paymentMethod === "cash" ? "cash" : "card",
        amount: total,
        currencyCode: settings.currencyCode,
        provider: "pp_system_default",
        paymentProviderId: manualProvider.id,
        providerPaymentId,
        processedAt: now,
        storeId,
        registerShiftId: registerShift ? String(registerShift.id) : null,
      },
    });
  }

  if (registerShift) {
    const isCash = paymentMethod === "cash";
    const cashSalesCents = Number(registerShift.cashSalesCents || 0) + (isCash ? total : 0);
    const cardSalesCents = Number(registerShift.cardSalesCents || 0) + (isCash ? 0 : total);
    const tipsCents = Number(registerShift.tipsCents || 0) + tip;
    await tx.registerShift.update({
      where: { id: String(registerShift.id) },
      data: {
        cashSalesCents,
        cardSalesCents,
        tipsCents,
        expectedCashCents: Number(registerShift.openingCashCents || 0)
          + cashSalesCents
          - Number(registerShift.cashRefundsCents || 0)
          + Number(registerShift.payInsCents || 0)
          - Number(registerShift.payOutsCents || 0),
      },
    });
    if (args.cashTenderedCents != null && args.cashTenderedCents < total) throw cafeCustomerError("Cash received is less than the total");
    await tx.posOrder.create({
      data: {
        receiptNumber: `POS-${orderNumber}`,
        storeId,
        cafeOrderId: order.id,
        cashierId: session?.itemId || null,
        registerShiftId: String(registerShift.id),
        registerName: String(registerShift.registerName || "Register"),
        status: "paid",
        subtotalCents: subtotal,
        taxCents: tax,
        tipCents: tip,
        totalCents: total,
        closedAt: now,
        metadata: {
          tender: !tenderRequired
            ? { method: "none", reason: "zero_total" }
            : paymentMethod === "cash"
              ? { method: "cash", evidence: "cash_received_at_register", ...(args.cashTenderedCents != null ? { tenderedCents: args.cashTenderedCents, changeCents: args.cashTenderedCents - total } : {}) }
              : { method: "external_card", evidence: "operator_attested_terminal_approval", terminalReference: externalCardReference, attestedById: session?.itemId || null, attestedAt: now.toISOString(), providerVerified: false },
          quoteFingerprint: args.quoteFingerprint || null,
        },
      },
    });
  }
  await enqueueCoffeeDomainEvent(tx as never, {
    storeId,
    eventKey: `order:${order.id}:placed:v1`,
    eventType: "order.placed",
    aggregateType: "order",
    aggregateId: order.id,
    occurredAt: now,
    payload: {
      order: {
        id: order.id,
        orderNumber,
        source: orderSource,
        fulfillmentType,
        subtotal,
        tax,
        tip,
        total,
        paymentMethod,
        lines: normalizedItems.map((item) => ({
          menuItemId: item.menuItem.id,
          name: item.menuItem.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          modifiers: item.modifierSnapshot,
          instructions: item.specialInstructions,
        })),
      },
    },
  });
  return order.id;
}

export default async function createCafePickupOrder(
  _root: unknown,
  args: CreateCafePickupOrderArgs,
  context: CreateCafePickupOrderContext,
) {
  const items = validateCafeOrderLines(args.items || []);
  const isStaff = permissions.canManageOrders({ session: context.session });
  const paymentMethod = args.paymentMethod || "manual";
  const orderSource = args.orderSource || "online";
  const fulfillmentType = args.fulfillmentType || "pickup";
  if (!["manual", "cash", "manual_card"].includes(paymentMethod)) throw new Error("Unsupported payment method");
  if (!["online", "pos", "phone"].includes(orderSource)) throw new Error("Unsupported order source");
  if (!["pickup", "counter", "dine_in"].includes(fulfillmentType)) throw new Error("Unsupported fulfillment type");
  if (orderSource === "online" && fulfillmentType !== "pickup") throw new Error("Online orders require pickup fulfillment");
  if (["cash", "manual_card"].includes(paymentMethod)) {
    requireCafeTenderOperator(context.session);
    if (!args.registerShiftId) throw new Error("Immediate tender requires an open register shift");
  } else if (args.registerShiftId) throw new Error("A register may only be attached when recording immediate tender");
  const tipCents = Number(args.tipCents || 0);
  if (!Number.isSafeInteger(tipCents) || tipCents < 0 || tipCents > 100_000_000) throw new Error("Tip must be a non-negative integer amount in cents");
  const quoteFingerprint = args.quoteFingerprint?.trim() || "";
  if (quoteFingerprint && !/^[a-f0-9]{64}$/.test(quoteFingerprint)) throw new Error("The reviewed ticket total is invalid; review the ticket again");
  if (orderSource === "pos" && !quoteFingerprint) throw new Error("Review the ticket total before recording tender");
  // Storefront checkout always sends both: the reviewed quote (verified below) and a browser-held receipt key.
  // Without a receipt key the server issues one, and only the original response or the owning customer can see it.
  normalizeCafeReceiptKey(args.receiptKey);
  const externalCardReference = args.externalCardReference?.trim() || "";
  if (paymentMethod === "manual_card") {
    if (args.externalCardApproved !== true) throw new Error("Confirm the card terminal approved this exact amount before recording the card payment");
    if (!/^[A-Za-z0-9#._:\/-]{4,64}$/.test(externalCardReference)) throw new Error("Enter the terminal approval or reference code (4-64 letters, numbers or #._:/-)");
  } else if (externalCardReference || args.externalCardApproved) throw new Error("A terminal reference applies only to an external card payment");
  if (args.cashTenderedCents != null && (paymentMethod !== "cash" || !Number.isSafeInteger(args.cashTenderedCents) || args.cashTenderedCents < 0 || args.cashTenderedCents > 100_000_000)) {
    throw cafeCustomerError("Cash received applies only to a cash sale, as a whole number of cents");
  }
  if (!isStaff && tipCents > 0) throw new Error("Only staff may add a counter tip");
  if (!isStaff && (paymentMethod === "cash" || paymentMethod === "manual_card")) throw new Error("Immediate-tender payment methods are only available to staff");
  if (!isStaff && orderSource !== "online") throw new Error("Only staff may create non-online orders");
  if (!isStaff && fulfillmentType !== "pickup") throw new Error("Only staff may create non-pickup orders");
  if (orderSource === "pos" && !["cash", "manual_card"].includes(paymentMethod)) throw new Error("POS orders require cash or card tender");
  if (orderSource === "pos" && !args.registerShiftId) throw new Error("POS orders require an open register shift");
  if (!args.customerName?.trim()) throw new Error("Pickup name is required");
  if (args.customerName.trim().length > 200 || (args.pickupName?.trim().length || 0) > 200) throw new Error("Pickup name cannot exceed 200 characters");
  if ((args.customerEmail?.trim().length || 0) > 320) throw new Error("Customer email cannot exceed 320 characters");
  if (!isStaff && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(args.customerEmail))) throw new Error("A valid email is required for online pickup requests");
  if ((args.customerPhone?.trim().length || 0) > 50) throw new Error("Customer phone cannot exceed 50 characters");
  if ((args.specialInstructions?.trim().length || 0) > 2000) throw new Error("Order instructions cannot exceed 2000 characters");
  if (args.requestedPickupMinutes != null && (!Number.isSafeInteger(args.requestedPickupMinutes) || args.requestedPickupMinutes < 5 || args.requestedPickupMinutes > COFFEE_PICKUP_SCHEDULE_MAX_MINUTES)) {
    throw cafeCustomerError("Choose a pickup time within the next two days");
  }

  const clientKey = normalizeIdempotencyKey(args.idempotencyKey);
  // Storefront requests share one namespace so signing in or out cannot turn an uncertain request into a second order;
  // ownership on replay is proven by the receipt key or the original customer session.
  const scope = !isStaff ? "storefront" : context.session?.listKey === "User" ? context.session.itemId : "guest";
  if (!clientKey) throw new Error("Order idempotency key is required");
  const scopedKey = clientKey ? buildScopedIdempotencyKey(scope, clientKey) : null;
  const requestFingerprint = clientKey ? fingerprintInput({
    customerName: args.customerName.trim(),
    customerEmail: normalizeEmail(args.customerEmail),
    customerPhone: normalizePhone(args.customerPhone),
    pickupName: args.pickupName?.trim() || args.customerName.trim(),
    requestedPickupMinutes: args.requestedPickupMinutes ?? null,
    specialInstructions: args.specialInstructions?.trim() || "",
    paymentMethod,
    orderSource,
    fulfillmentType,
    registerShiftId: args.registerShiftId || null,
    tipCents,
    ...(quoteFingerprint ? { quoteFingerprint } : {}),
    ...(paymentMethod === "manual_card" ? { externalCardReference, externalCardApproved: true } : {}),
    ...(args.cashTenderedCents != null ? { cashTenderedCents: args.cashTenderedCents } : {}),
    items: items.map((item) => ({
      menuItemId: item.menuItemId,
      quantity: Math.max(1, Math.floor(Number(item.quantity || 1))),
      modifierIds: [...(item.modifierIds || [])].sort(),
      specialInstructions: item.specialInstructions?.trim() || "",
    })),
  }) : null;

  for (let attempt = 1; attempt <= MAX_TRANSACTION_RETRIES; attempt += 1) {
    try {
      const orderId = await context.prisma.$transaction(
        (rawTx) => createOrderTransaction({
          rawTx,
          args,
          items,
          isStaff,
          scopedKey,
          requestFingerprint,
          paymentMethod,
          orderSource,
          fulfillmentType,
          session: context.session,
        }),
        { maxWait: 5000, timeout: 10000, isolationLevel: "ReadCommitted" },
      );
      const persisted = await context.sudo().query.CafeOrder.findOne({ where: { id: orderId }, query: ORDER_RETURN_QUERY });
      if (persisted) return persisted;
      if (attempt === MAX_TRANSACTION_RETRIES) throw new Error("Pickup order transaction did not commit");
    } catch (error) {
      if (!transactionConflict(error) || attempt === MAX_TRANSACTION_RETRIES) throw error;
    }
  }

  throw new Error("Pickup order transaction retry limit exceeded");
}
