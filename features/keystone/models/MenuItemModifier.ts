import { list } from "@keystone-6/core";
import { denyAll } from "@keystone-6/core/access";

import { permissions } from "../access";
import { checkbox, decimal, integer, relationship, select, text } from "@keystone-6/core/fields";

import { requiredStoreRelationship } from "./requiredRelationship";
import { trackingFields } from "./trackingFields";

export const MenuItemModifier = list({
  access: {
    operation: {
      query: permissions.canReadProducts,
      create: denyAll,
      update: denyAll,
      delete: denyAll,
    },
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: {
      initialColumns: ["name", "modifierGroup", "priceAdjustment", "defaultSelected", "menuItem"],
    },
  },
  fields: {
    idempotencyKey: text({ isIndexed: "unique", db: { isNullable: true }, access: { read: permissions.canManageProducts, create: () => false, update: () => false } }),
    store: requiredStoreRelationship("StoreSetting.menuItemModifiers"),
    name: text({ validation: { isRequired: true } }),
    modifierGroup: select({
      type: "string",
      options: [
        { label: "Size", value: "size" },
        { label: "Milk", value: "milk" },
        { label: "Espresso", value: "espresso" },
        { label: "Syrup", value: "syrup" },
        { label: "Sweetness", value: "sweetness" },
        { label: "Temperature", value: "temperature" },
        { label: "Ice", value: "ice" },
        { label: "Topping", value: "topping" },
        { label: "Bakery Prep", value: "bakery_prep" },
        { label: "Grind", value: "grind" },
      ],
      defaultValue: "milk",
    }),
    modifierGroupLabel: text({ ui: { description: "Customer-facing group label, e.g. Milk choice" } }),
    required: checkbox({ defaultValue: false }),
    minSelections: integer({ defaultValue: 0, validation: { min: 0 } }),
    maxSelections: integer({ defaultValue: 1, validation: { min: 1 } }),
    priceAdjustment: integer({ defaultValue: 0, ui: { description: "Cents added or removed" } }),
    defaultSelected: checkbox({ defaultValue: false }),
    inStock: checkbox({ defaultValue: true, access: { update: () => false } }),
    menuItem: relationship({ ref: "MenuItem.modifiers", access: { create: () => false, update: () => false } }),
    inventoryAction: select({ type: "string", options: ["unreviewed", "none", "add", "substitute"], defaultValue: "unreviewed" }),
    inventoryItem: relationship({ ref: "InventoryItem", ui: { description: "Stable inventory consumed by this option, never matched by name." } }),
    replacesInventoryItem: relationship({ ref: "InventoryItem", ui: { description: "For substitution: exact base recipe inventory to replace, in the same unit." } }),
    inventoryQuantity: decimal({ precision: 18, scale: 4, defaultValue: "0", validation: { min: "0" }, ui: { description: "Add-on quantity per serving in the linked inventory item's unit." } }),
    ...trackingFields,
  },
});
