import { list } from "@keystone-6/core";
import { decimal, integer, relationship, select, text } from "@keystone-6/core/fields";

import { permissions } from "../access";
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
  ui: { listView: { initialColumns: ["name", "category", "currentStock", "unit", "reorderPoint"] } },
  fields: {
    name: text({ validation: { isRequired: true } }),
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
    currentStock: decimal({ defaultValue: "0" }),
    reorderPoint: decimal({ defaultValue: "0" }),
    parLevel: decimal({ defaultValue: "0" }),
    costPerUnit: integer({ defaultValue: 0, ui: { description: "Cost in cents" } }),
    supplierName: text(),
    sku: text(),
    menuItems: relationship({ ref: "MenuItem.inventoryItem", many: true }),
    stockMovements: relationship({ ref: "StockMovement.inventoryItem", many: true }),
    ...trackingFields,
  },
});
