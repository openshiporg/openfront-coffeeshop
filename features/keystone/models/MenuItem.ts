import { graphql, list } from "@keystone-6/core";
import { checkbox, integer, multiselect, relationship, select, text, virtual } from "@keystone-6/core/fields";
import { document } from "@keystone-6/fields-document";

import { permissions } from "../access";
import { trackingFields } from "./trackingFields";

export const MenuItem = list({
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
      initialColumns: ["name", "category", "price", "available", "barStation", "prepTimeMinutes"],
    },
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    description: document({ formatting: true, links: true }),
    shortDescription: text({ ui: { displayMode: "textarea" } }),
    price: integer({ validation: { isRequired: true }, ui: { description: "Base price in cents" } }),
    available: checkbox({ defaultValue: true }),
    featured: checkbox({ defaultValue: false }),
    popular: checkbox({ defaultValue: false }),
    imageUrl: text({ ui: { description: "Storefront image URL or local asset path" }, db: { isNullable: true } }),
    prepTimeMinutes: integer({ defaultValue: 5, validation: { min: 0 } }),
    caffeineMg: integer({ ui: { description: "Approximate caffeine content for drinks" } }),
    calories: integer(),
    barStation: select({
      type: "string",
      options: [
        { label: "Espresso Bar", value: "espresso_bar" },
        { label: "Cold Bar", value: "cold_bar" },
        { label: "Brew Bar", value: "brew_bar" },
        { label: "Pastry Case", value: "pastry_case" },
        { label: "Retail Shelf", value: "retail_shelf" },
      ],
      defaultValue: "espresso_bar",
    }),
    temperatureOptions: multiselect({
      type: "string",
      options: [
        { label: "Hot", value: "hot" },
        { label: "Iced", value: "iced" },
        { label: "Blended", value: "blended" },
      ],
      defaultValue: ["hot"],
    }),
    dietaryFlags: multiselect({
      type: "string",
      options: [
        { label: "Vegan", value: "vegan" },
        { label: "Vegetarian", value: "vegetarian" },
        { label: "Gluten-Free", value: "gluten_free" },
        { label: "Dairy-Free", value: "dairy_free" },
        { label: "Nut-Free", value: "nut_free" },
      ],
      defaultValue: [],
    }),
    serviceWindows: multiselect({
      type: "string",
      options: [
        { label: "Morning", value: "morning" },
        { label: "Midday", value: "midday" },
        { label: "Afternoon", value: "afternoon" },
        { label: "All Day", value: "all_day" },
      ],
      defaultValue: ["all_day"],
    }),
    displayPrice: virtual({
      field: graphql.field({
        type: graphql.String,
        resolve(item: any) {
          return `$${((item.price || 0) / 100).toFixed(2)}`;
        },
      }),
    }),
    category: relationship({ ref: "MenuCategory.menuItems" }),
    modifiers: relationship({
      ref: "MenuItemModifier.menuItem",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["name", "modifierGroup", "priceAdjustment", "defaultSelected"],
        inlineCreate: { fields: ["name", "modifierGroup", "priceAdjustment", "defaultSelected"] },
        inlineEdit: { fields: ["name", "modifierGroup", "priceAdjustment", "defaultSelected"] },
      },
    }),
    orderItems: relationship({ ref: "OrderItem.menuItem", many: true }),
    inventoryItem: relationship({ ref: "InventoryItem.menuItems" }),
    ...trackingFields,
  },
});
