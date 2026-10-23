import { list } from "@keystone-6/core";
import { denyAll } from "@keystone-6/core/access";
import { decimal, integer, json, relationship, select, text } from "@keystone-6/core/fields";

import { permissions } from "../access";
import { COFFEE_CURRENCY_CODE_PATTERN, validCoffeeTimezone } from "../lib/store-locale-policy";
import {
  COFFEE_BRAND_COLORS,
  DEFAULT_COFFEE_BRAND_COLOR,
} from "../lib/brand-colors";
import { trackingFields } from "./trackingFields";
import { sanitizeStoreLogoSvg } from "../../lib/sanitize-store-logo";
import { DEFAULT_STORE_LOGO_ICON, normalizeStoreLogoColor } from "../../platform/store-settings/lib/store-logo";
import { PICKUP_LIMITS, storeSettingRecordErrors } from "../lib/store-settings-input";

export const StoreSetting = list({
  access: {
    operation: {
      query: permissions.canManageSettings,
      create: permissions.canManageSettings,
      update: permissions.canManageSettings,
      delete: denyAll,
    },
  },
  hooks: {
    resolveInput: ({ operation, resolvedData }) =>
      operation === "create" ? { ...resolvedData, singletonKey: "primary" } : resolvedData,
    // Every writer (generated CRUD, settings action, nested input) is held to the
    // same effective-record policy as the Store Settings screen.
    validate: ({ operation, resolvedData, item, addValidationError }) => {
      if (operation === "delete") return;
      const merged = { ...(item ?? {}), ...(resolvedData ?? {}) } as Record<string, unknown>;
      for (const message of storeSettingRecordErrors(merged)) addValidationError(message);
    },
  },
  ui: {
    hideCreate: true,
    label: "Store settings",
    singular: "Store settings",
    // The dashboard derives GraphQL names from this plural; it must spell the list key (StoreSettings).
    plural: "Store Settings",
    listView: {
      initialColumns: ["name", "address", "contactEmail", "phone"],
    },
  },
  fields: {
    singletonKey: text({
      isIndexed: "unique",
      defaultValue: "primary",
      validation: { isRequired: true },
      access: { update: () => false },
      ui: { itemView: { fieldMode: "read" }, createView: { fieldMode: "hidden" } },
    }),
    name: text({ validation: { isRequired: true } }),
    tagline: text(),
    description: text({ ui: { displayMode: "textarea" } }),
    address: text({ validation: { isRequired: true } }),
    phone: text(),
    contactEmail: text({ validation: { isRequired: true } }),
    currencyCode: text({ defaultValue: "USD", validation: { isRequired: true, length: { min: 3, max: 3 }, match: { regex: COFFEE_CURRENCY_CODE_PATTERN, explanation: "This cafe pilot supports USD only" } } }),
    locale: text({ defaultValue: "en-US", validation: { isRequired: true, match: { regex: /^en-US$/, explanation: "This cafe supports the en-US locale only" } } }),
    timezone: text({
      defaultValue: "America/New_York",
      validation: { isRequired: true },
      hooks: {
        validate: ({ resolvedData, addValidationError }) => {
          const timezone = resolvedData?.timezone;
          if (timezone !== undefined && (typeof timezone !== "string" || !validCoffeeTimezone(timezone))) {
            addValidationError("Enter a valid IANA store timezone");
          }
        },
      },
    }),
    brandColor: select({
      type: "string",
      options: COFFEE_BRAND_COLORS.map(({ label, value }) => ({ label, value })),
      defaultValue: DEFAULT_COFFEE_BRAND_COLOR,
      validation: { isRequired: true },
      ui: { description: "Earlier palette setting kept for existing records; the storefront theme follows the logo colour", itemView: { fieldMode: "read" } },
    }),
    logoIcon: text({
      defaultValue: DEFAULT_STORE_LOGO_ICON,
      hooks: {
        resolveInput: ({ resolvedData, fieldKey }) => {
          const value = resolvedData[fieldKey];
          return value === undefined || value === null || value === "" ? value : sanitizeStoreLogoSvg(value);
        },
        validate: ({ inputData, resolvedData, fieldKey, addValidationError }) => {
          if (typeof inputData?.[fieldKey] === "string" && inputData[fieldKey].trim() && !resolvedData?.[fieldKey]) {
            addValidationError("Logo must be a valid, safe SVG document");
          }
        },
      },
    }),
    logoColor: text({
      defaultValue: "0",
      hooks: { resolveInput: ({ resolvedData, fieldKey }) => resolvedData[fieldKey] === undefined ? undefined : normalizeStoreLogoColor(resolvedData[fieldKey]) },
    }),
    weeklyHours: json({ defaultValue: [] }),
    pickupLeadTimeMinutes: integer({ defaultValue: 12, validation: { ...PICKUP_LIMITS.pickupLeadTimeMinutes } }),
    pickupWindowMinutes: integer({ defaultValue: 15, validation: { ...PICKUP_LIMITS.pickupWindowMinutes } }),
    pickupCapacityPerWindow: integer({ defaultValue: 20, validation: { ...PICKUP_LIMITS.pickupCapacityPerWindow } }),
    taxRateBasisPoints: decimal({ precision: 7, scale: 2, defaultValue: "875", validation: { isRequired: true, min: "0", max: "10000" }, ui: { description: "Store pickup sales-tax rate in basis points (887.5 = 8.875%)" } }),
    menuCategories: relationship({ ref: "MenuCategory.store", many: true, access: { create: denyAll, update: denyAll } }),
    menuItems: relationship({ ref: "MenuItem.store", many: true, access: { create: denyAll, update: denyAll } }),
    menuItemModifiers: relationship({ ref: "MenuItemModifier.store", many: true, access: { create: denyAll, update: denyAll } }),
    cafeOrders: relationship({ ref: "CafeOrder.store", many: true, access: { create: denyAll, update: denyAll } }),
    orderItems: relationship({ ref: "OrderItem.store", many: true, access: { create: denyAll, update: denyAll } }),
    posOrders: relationship({ ref: "PosOrder.store", many: true, access: { create: denyAll, update: denyAll } }),
    registerShifts: relationship({ ref: "RegisterShift.store", many: true, access: { create: denyAll, update: denyAll } }),
    cashMovements: relationship({ ref: "CashMovement.store", many: true, access: { create: denyAll, update: denyAll } }),
    payments: relationship({ ref: "Payment.store", many: true, access: { create: denyAll, update: denyAll } }),
    loyaltyAccounts: relationship({ ref: "LoyaltyAccount.store", many: true, access: { create: denyAll, update: denyAll } }),
    subscriptions: relationship({ ref: "Subscription.store", many: true, access: { create: denyAll, update: denyAll } }),
    cateringOrders: relationship({ ref: "CateringOrder.store", many: true, access: { create: denyAll, update: denyAll } }),
    paymentEvents: relationship({ ref: "PaymentEvent.store", many: true, access: { create: denyAll, update: denyAll } }),
    inventoryItems: relationship({ ref: "InventoryItem.store", many: true, access: { create: denyAll, update: denyAll } }),
    stockMovements: relationship({ ref: "StockMovement.store", many: true, access: { create: denyAll, update: denyAll } }),
    suppliers: relationship({ ref: "Supplier.store", many: true, access: { create: denyAll, update: denyAll } }),
    purchaseOrders: relationship({ ref: "PurchaseOrder.store", many: true, access: { create: denyAll, update: denyAll } }),
    inventoryLots: relationship({ ref: "InventoryLot.store", many: true, access: { create: denyAll, update: denyAll } }),
    recipes: relationship({ ref: "Recipe.store", many: true, access: { create: denyAll, update: denyAll } }),
    ingredients: relationship({ ref: "Ingredient.store", many: true, access: { create: denyAll, update: denyAll } }),
    prepBatches: relationship({ ref: "PrepBatch.store", many: true, access: { create: denyAll, update: denyAll } }),
    prepBatchConsumptions: relationship({ ref: "PrepBatchConsumption.store", many: true, access: { create: denyAll, update: denyAll } }),
    wasteLogs: relationship({ ref: "WasteLog.store", many: true, access: { create: denyAll, update: denyAll } }),
    staffShifts: relationship({ ref: "StaffShift.store", many: true, access: { create: denyAll, update: denyAll } }),
    domainEvents: relationship({ ref: "CoffeeDomainEvent.store", many: true, access: { create: denyAll, update: denyAll } }),
    outboxDeliveries: relationship({ ref: "CoffeeOutboxDelivery.store", many: true, access: { create: denyAll, update: denyAll } }),
    ...trackingFields,
  },
});
