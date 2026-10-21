import { list } from "@keystone-6/core";
import { decimal, integer, relationship, select, text } from "@keystone-6/core/fields";

import { permissions } from "../access";
import { requiredStoreRelationship } from "./requiredRelationship";
import { trackingFields } from "./trackingFields";

export const InventoryItem = list({
  access: {
    operation: {
      query: permissions.canReadInventory,
      create: permissions.canManageInventory,
      update: permissions.canManageInventory,
      delete: permissions.canManageInventory,
    },
  },
  hooks: {
    validateInput: async ({ operation, resolvedData, item, context, addValidationError }) => {
      if (operation !== "update" || !item) return;
      if (resolvedData.store !== undefined) addValidationError("Inventory item store ownership is immutable");
      // Existing quantities are recorded in the current unit; changing it would silently reinterpret them.
      if (resolvedData.unit !== undefined && resolvedData.unit !== item.unit) {
        const where = { inventoryItemId: item.id };
        const [lots, movements, purchaseOrders, ingredients] = await Promise.all([
          context.prisma.inventoryLot.count({ where }),
          context.prisma.stockMovement.count({ where }),
          context.prisma.purchaseOrder.count({ where }),
          context.prisma.ingredient.count({ where }),
        ]);
        if (Number(item.currentStock ?? 0) !== 0 || lots || movements || purchaseOrders || ingredients) {
          addValidationError("The unit can't change once this item has stock, lots, purchase orders or recipe ingredients. Create a new inventory item for the new unit.");
        }
      }
    },
  },
  ui: { listView: { initialColumns: ["name", "category", "currentStock", "unit", "reorderPoint"] } },
  fields: {
    name: text({ validation: { isRequired: true } }),
    store: requiredStoreRelationship("StoreSetting.inventoryItems"),
    category: select({
      type: "string",
      options: [
        { label: "Coffee", value: "coffee" },
        { label: "Milk", value: "milk" },
        { label: "Syrup", value: "syrup" },
        { label: "Tea", value: "tea" },
        { label: "Bakery", value: "bakery" },
        { label: "Retail", value: "retail" },
        { label: "Packaging", value: "packaging" },
      ],
      defaultValue: "coffee",
    }),
    unit: select({
      type: "string",
      options: [
        { label: "Each", value: "each" },
        { label: "Pound", value: "lb" },
        { label: "Ounce", value: "oz" },
        { label: "Gram", value: "g" },
        { label: "Gallon", value: "gal" },
        { label: "Liter", value: "l" },
      ],
      defaultValue: "each",
    }),
    // Stock changes only through receiving, prep, sales and waste, each with a stock movement.
    currentStock: decimal({ defaultValue: "0", access: { create: () => false, update: () => false }, ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } } }),
    reorderPoint: decimal({ defaultValue: "0" }),
    parLevel: decimal({ defaultValue: "0" }),
    costPerUnit: integer({ defaultValue: 0, validation: { min: 0 }, ui: { description: "Cost in cents" } }),
    supplierName: text(),
    sku: text(),
    menuItems: relationship({ ref: "MenuItem.inventoryItem", many: true }),
    stockMovements: relationship({ ref: "StockMovement.inventoryItem", many: true, access: { create: () => false, update: () => false }, ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } } }),
    inventoryLots: relationship({ ref: "InventoryLot.inventoryItem", many: true, access: { create: () => false, update: () => false }, ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } } }),
    purchaseOrders: relationship({ ref: "PurchaseOrder.inventoryItem", many: true, access: { create: () => false, update: () => false }, ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } } }),
    wasteLogs: relationship({ ref: "WasteLog.inventoryItem", many: true, access: { create: () => false, update: () => false }, ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } } }),
    ...trackingFields,
  },
});
