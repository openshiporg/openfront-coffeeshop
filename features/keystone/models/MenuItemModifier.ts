import { list } from "@keystone-6/core";
import { checkbox, integer, relationship, select, text } from "@keystone-6/core/fields";

import { permissions } from "../access";
import { trackingFields } from "./trackingFields";

export const MenuItemModifier = list({
  access: {
    operation: {
      query: () => true,
      create: permissions.canManageProducts,
      update: permissions.canManageProducts,
      delete: permissions.canManageProducts,
    },
  },
  ui: {
    listView: {
      initialColumns: ["name", "modifierGroup", "priceAdjustment", "defaultSelected", "menuItem"],
    },
  },
  fields: {
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
      ],
      defaultValue: "milk",
    }),
    modifierGroupLabel: text({ ui: { description: "Customer-facing group label, e.g. Milk choice" } }),
    required: checkbox({ defaultValue: false }),
    minSelections: integer({ defaultValue: 0, validation: { min: 0 } }),
    maxSelections: integer({ defaultValue: 1, validation: { min: 1 } }),
    priceAdjustment: integer({ defaultValue: 0, ui: { description: "Cents added or removed" } }),
    defaultSelected: checkbox({ defaultValue: false }),
    inStock: checkbox({ defaultValue: true }),
    menuItem: relationship({ ref: "MenuItem.modifiers" }),
    ...trackingFields,
  },
});
