import { graphql, list } from "@keystone-6/core";
import type { BaseItem } from "@keystone-6/core/types";
import { checkbox, integer, multiselect, relationship, select, text, virtual } from "@keystone-6/core/fields";
import { document } from "@keystone-6/fields-document";

import { permissions } from "../access";
import { requiredStoreRelationship } from "./requiredRelationship";
import { trackingFields } from "./trackingFields";

export const MenuItem = list({
  access: {
    operation: {
      query: permissions.canReadProducts,
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
    idempotencyKey: text({ isIndexed: "unique", db: { isNullable: true }, access: { read: permissions.canManageProducts, create: () => false, update: () => false }, ui: { itemView: { fieldMode: "read" }, createView: { fieldMode: "hidden" } } }),
    name: text({ validation: { isRequired: true } }),
    store: requiredStoreRelationship("StoreSetting.menuItems"),
    description: document({ formatting: true, links: true }),
    shortDescription: text({ ui: { displayMode: "textarea" } }),
    price: integer({ validation: { isRequired: true, min: 0 }, access: { update: () => false }, ui: { description: "Base price in cents" } }),
    available: checkbox({ defaultValue: true, access: { update: () => false } }),
    featured: checkbox({ defaultValue: false, access: { update: () => false } }),
    popular: checkbox({ defaultValue: false, access: { update: () => false } }),
    imageUrl: text({ ui: { description: "Legacy storefront image URL or local asset path" }, db: { isNullable: true } }),
    primaryImageUrl: virtual({
      field: graphql.field({
        type: graphql.String,
        resolve: async (item: BaseItem, _args, context) => {
          const menuItem = await context.query.MenuItem.findOne({
            where: { id: String(item.id) },
            query: "imageUrl menuItemImages(orderBy: { order: asc }, take: 1) { image { url } imagePath }",
          });

          const uploadedImageUrl = menuItem?.menuItemImages?.[0]?.image?.url;
          if (uploadedImageUrl) return uploadedImageUrl;

          const imagePath = menuItem?.menuItemImages?.[0]?.imagePath;
          if (imagePath) {
            if (/^(https?:|data:|blob:)/.test(imagePath) || imagePath.startsWith("/images/")) return imagePath;
            return imagePath.startsWith("/") ? `/images${imagePath}` : `/images/${imagePath}`;
          }

          return menuItem?.imageUrl || null;
        },
      }),
    }),
    menuItemImages: relationship({
      ref: "MenuItemImage.menuItems",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["image", "altText", "imagePath"],
        inlineCreate: { fields: ["image", "altText", "imagePath"] },
        inlineEdit: { fields: ["image", "altText", "imagePath"] },
        inlineConnect: true,
        removeMode: "disconnect",
        linkToItem: false,
      },
    }),
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
        resolve(item: BaseItem) {
          const price = typeof item.price === "number" ? item.price : 0;
          return `$${((price || 0) / 100).toFixed(2)}`;
        },
      }),
    }),
    category: relationship({ ref: "MenuCategory.menuItems" }),
    // Modifier parent and order-line history are lifecycle links: only the menu
    // commands (manageCoffeeMenu) and checkout write them, never a raw connect/disconnect.
    modifiers: relationship({
      ref: "MenuItemModifier.menuItem",
      many: true,
      access: { create: () => false, update: () => false },
      ui: {
        displayMode: "cards",
        cardFields: ["name", "modifierGroup", "priceAdjustment", "defaultSelected"],
        itemView: { fieldMode: "read" },
        createView: { fieldMode: "hidden" },
      },
    }),
    orderItems: relationship({
      ref: "OrderItem.menuItem",
      many: true,
      access: { create: () => false, update: () => false },
      ui: { itemView: { fieldMode: "read" }, createView: { fieldMode: "hidden" } },
    }),
    inventoryItem: relationship({ ref: "InventoryItem.menuItems" }),
    ...trackingFields,
  },
});
