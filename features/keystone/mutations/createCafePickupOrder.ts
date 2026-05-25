interface CafePickupOrderItemInput {
  menuItemId: string;
  quantity: number;
  modifierIds?: string[];
  specialInstructions?: string | null;
}

type ModifierRecord = {
  id: string;
  name: string;
  priceAdjustment?: number | null;
  inStock?: boolean | null;
  modifierGroup?: string | null;
  modifierGroupLabel?: string | null;
  required?: boolean | null;
  minSelections?: number | null;
  maxSelections?: number | null;
  menuItem?: { id: string } | null;
};

type MenuItemRecord = {
  id: string;
  name: string;
  price: number;
  available?: boolean;
  barStation?: string | null;
  modifiers?: ModifierRecord[];
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
  items: CafePickupOrderItemInput[];
}

function generateOrderNumber(): string {
  const now = new Date();
  const date = now.toISOString().slice(2, 10).replace(/-/g, "");
  const suffix = now.getTime().toString().slice(-5);
  return `CF-${date}-${suffix}`;
}

function normalizeEmail(email?: string | null) {
  return email?.trim().toLowerCase() || null;
}

function normalizePhone(phone?: string | null) {
  return phone?.replace(/[^+\d]/g, "") || null;
}

function validateModifierSelections(menuItem: MenuItemRecord, selectedModifiers: ModifierRecord[]) {
  const groups = (menuItem.modifiers || []).reduce<Record<string, ModifierRecord[]>>((acc, modifier) => {
    const key = modifier.modifierGroup || "default";
    acc[key] = acc[key] || [];
    acc[key].push(modifier);
    return acc;
  }, {});

  const selectedByGroup = selectedModifiers.reduce<Record<string, ModifierRecord[]>>((acc, modifier) => {
    const key = modifier.modifierGroup || "default";
    acc[key] = acc[key] || [];
    acc[key].push(modifier);
    return acc;
  }, {});

  for (const [group, modifiers] of Object.entries(groups)) {
    const first = modifiers[0];
    const selectedCount = selectedByGroup[group]?.length || 0;
    const required = modifiers.some((modifier) => Boolean(modifier.required));
    const minSelections = Math.max(required ? 1 : 0, ...modifiers.map((modifier) => Number(modifier.minSelections || 0)));
    const maxSelections = Math.max(...modifiers.map((modifier) => Number(modifier.maxSelections || 1)));
    const label = first.modifierGroupLabel || first.modifierGroup || "modifier";

    if (selectedCount < minSelections) {
      throw new Error(`${menuItem.name} requires at least ${minSelections} ${label} selection${minSelections === 1 ? "" : "s"}`);
    }

    if (selectedCount > maxSelections) {
      throw new Error(`${menuItem.name} allows at most ${maxSelections} ${label} selection${maxSelections === 1 ? "" : "s"}`);
    }
  }
}

export default async function createCafePickupOrder(root: any, args: CreateCafePickupOrderArgs, context: any) {
  const items = (args.items || []).filter((item) => item?.menuItemId && (item.quantity || 0) > 0);

  if (!args.customerName?.trim()) {
    throw new Error("Pickup name is required");
  }

  if (items.length === 0) {
    throw new Error("Order must include at least one menu item");
  }

  const sudo = context.sudo();
  const itemIds = Array.from(new Set(items.map((item) => item.menuItemId)));
  const modifierIds = Array.from(new Set(items.flatMap((item) => item.modifierIds || [])));

  const [menuItems, modifiers] = await Promise.all([
    sudo.query.MenuItem.findMany({
      where: { id: { in: itemIds } },
      query: "id name price available barStation modifiers { id name priceAdjustment inStock modifierGroup modifierGroupLabel required minSelections maxSelections menuItem { id } }", 
    }),
    modifierIds.length
      ? sudo.query.MenuItemModifier.findMany({
          where: { id: { in: modifierIds } },
          query: "id name priceAdjustment inStock modifierGroup modifierGroupLabel required minSelections maxSelections menuItem { id }", 
        })
      : Promise.resolve([]),
  ]);

  const menuItemMap = new Map<string, MenuItemRecord>((menuItems as MenuItemRecord[]).map((item) => [item.id, item]));
  const modifierMap = new Map<string, ModifierRecord>((modifiers as ModifierRecord[]).map((modifier) => [modifier.id, modifier]));

  const normalizedItems = items.map((item) => {
    const menuItem = menuItemMap.get(item.menuItemId);
    if (!menuItem) throw new Error(`Menu item not found: ${item.menuItemId}`);
    if (!menuItem.available) throw new Error(`${menuItem.name} is currently unavailable`);

    const allItemModifiers = menuItem.modifiers || [];
    const allItemModifierIds = new Set(allItemModifiers.map((modifier) => modifier.id));
    const selectedModifiers = (item.modifierIds || []).map((id) => {
      const modifier = modifierMap.get(id);
      if (!modifier) throw new Error(`Modifier not found: ${id}`);
      if (!allItemModifierIds.has(modifier.id) || modifier.menuItem?.id !== menuItem.id) {
        throw new Error(`${modifier.name} is not a valid modifier for ${menuItem.name}`);
      }
      if (modifier.inStock === false) throw new Error(`${modifier.name} is currently unavailable`);
      return modifier;
    });

    validateModifierSelections(menuItem, selectedModifiers);

    const modifierTotal = selectedModifiers.reduce((sum: number, modifier) => sum + Number(modifier.priceAdjustment || 0), 0);
    const unitPrice = Number(menuItem.price || 0) + modifierTotal;
    const quantity = Math.max(1, Number(item.quantity || 1));

    return {
      menuItem,
      selectedModifiers,
      quantity,
      unitPrice,
      specialInstructions: item.specialInstructions?.trim() || "",
      customizationsSummary: selectedModifiers.map((modifier) => modifier.name).join(", "),
    };
  });

  const subtotal = normalizedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const tax = Math.round(subtotal * 0.0875);
  const total = subtotal + tax;
  const now = new Date();
  const promisedAt = new Date(now.getTime() + Math.max(5, Number(args.requestedPickupMinutes || 12)) * 60 * 1000);
  const paymentMethod = args.paymentMethod || "manual";
  const orderSource = args.orderSource || "online";
  const fulfillmentType = args.fulfillmentType || "pickup";
  const isImmediateTender = paymentMethod === "cash" || paymentMethod === "manual_card";
  const initialStatus = isImmediateTender ? "paid" : "open";

  const order = await sudo.db.CafeOrder.createOne({
    data: {
      orderNumber: generateOrderNumber(),
      fulfillmentType,
      orderSource,
      status: initialStatus,
      customerName: args.customerName.trim(),
      customerEmail: normalizeEmail(args.customerEmail),
      customerPhone: normalizePhone(args.customerPhone),
      pickupName: args.pickupName?.trim() || args.customerName.trim(),
      specialInstructions: args.specialInstructions?.trim() || "",
      subtotal,
      tax,
      total,
      paidAt: isImmediateTender ? now.toISOString() : undefined,
      promisedAt: promisedAt.toISOString(),
      currencyCode: "USD",
    },
  });

  for (const item of normalizedItems) {
    await sudo.db.OrderItem.createOne({
      data: {
        order: { connect: { id: order.id } },
        menuItem: { connect: { id: item.menuItem.id } },
        appliedModifiers: item.selectedModifiers.length
          ? { connect: item.selectedModifiers.map((modifier) => ({ id: modifier.id })) }
          : undefined,
        quantity: item.quantity,
        price: item.unitPrice,
        itemNameSnapshot: item.menuItem.name,
        customizationsSummary: item.customizationsSummary,
        specialInstructions: item.specialInstructions,
        station: item.menuItem.barStation || "espresso_bar",
        barStatus: "queued",
        queuedAt: now.toISOString(),
      },
    });
  }

  // Main payment initiation is handled through initiateCafePaymentSession so provider logic stays behind adapters.
  // Counter cash/manual-card shortcuts can still create a recorded payment here for speed of service.
  if (paymentMethod === "cash" || paymentMethod === "manual_card") {
    await sudo.db.Payment.createOne({
      data: {
        order: { connect: { id: order.id } },
        status: paymentMethod === "cash" ? "pending" : "captured",
        method: paymentMethod === "cash" ? "cash" : "card",
        amount: total,
        currencyCode: "USD",
        provider: paymentMethod === "cash" ? "counter" : "manual_card",
        providerPaymentId: `manual_${order.orderNumber}`,
        processedAt: paymentMethod === "cash" ? undefined : now.toISOString(),
      },
    });
  }

  return sudo.query.CafeOrder.findOne({
    where: { id: order.id },
    query: `
      id
      orderNumber
      status
      handoffCode
      customerName
      pickupName
      promisedAt
      subtotal
      tax
      total
      secretKey
      orderItems { id quantity itemNameSnapshot customizationsSummary price }
    `,
  });
}
