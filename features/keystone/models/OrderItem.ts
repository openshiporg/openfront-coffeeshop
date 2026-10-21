import { graphql, list } from "@keystone-6/core";
import { denyAll } from "@keystone-6/core/access";
import type { BaseItem } from "@keystone-6/core/types";
import { integer, json, relationship, select, text, timestamp, virtual } from "@keystone-6/core/fields";

import { permissions } from "../access";
import { requiredStoreRelationship } from "./requiredRelationship";
import { trackingFields } from "./trackingFields";

export const OrderItem = list({
  access: {
    operation: {
      query: permissions.canReadOrders,
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
      initialColumns: ["menuItem", "quantity", "price", "barStatus", "order"],
    },
  },
  fields: {
    store: requiredStoreRelationship("StoreSetting.orderItems"),
    quantity: integer({ defaultValue: 1, validation: { min: 1, isRequired: true } }),
    price: integer({
      validation: { isRequired: true, min: 0 },
      ui: { description: "Unit price snapshot in cents", itemView: { fieldMode: "read" } },
      access: { update: () => false },
    }),
    itemNameSnapshot: text({
      ui: { description: "Menu item name at time of order", itemView: { fieldMode: "read" } },
      access: { update: () => false },
    }),
    imagePathSnapshot: text({
      ui: { description: "Primary menu image path at time of order", itemView: { fieldMode: "read" } },
      access: { update: () => false },
    }),
    customizationsSummary: text({
      ui: { displayMode: "textarea", itemView: { fieldMode: "read" } },
      access: { update: () => false },
    }),
    modifierSnapshot: json({
      defaultValue: [],
      ui: { description: "Selected modifier names, groups, and price adjustments at time of order", itemView: { fieldMode: "read" } },
      access: { update: () => false },
    }),
    specialInstructions: text({
      ui: { displayMode: "textarea", itemView: { fieldMode: "read" } },
      access: { update: () => false },
    }),
    barStatus: select({
      type: "string",
      access: { update: () => false },
      options: [
        { label: "New", value: "new" },
        { label: "Queued", value: "queued" },
        { label: "Preparing", value: "preparing" },
        { label: "Ready", value: "ready" },
        { label: "Handed Off", value: "handed_off" },
        { label: "Voided", value: "voided" },
      ],
      defaultValue: "new",
    }),
    station: select({
      type: "string",
      access: { update: () => false },
      options: [
        { label: "Espresso Bar", value: "espresso_bar" },
        { label: "Cold Bar", value: "cold_bar" },
        { label: "Brew Bar", value: "brew_bar" },
        { label: "Pastry Case", value: "pastry_case" },
        { label: "Retail Shelf", value: "retail_shelf" },
      ],
      defaultValue: "espresso_bar",
    }),
    queuedAt: timestamp({ access: { update: () => false } }),
    startedAt: timestamp({ access: { update: () => false } }),
    readyAt: timestamp({ access: { update: () => false } }),
    handedOffAt: timestamp({ access: { update: () => false } }),
    totalPrice: virtual({
      field: graphql.field({
        type: graphql.Int,
        resolve(item: BaseItem) {
          const price = typeof item.price === "number" ? item.price : 0;
          const quantity = typeof item.quantity === "number" ? item.quantity : 1;
          return (price || 0) * (quantity || 1);
        },
      }),
    }),
    order: relationship({ ref: "CafeOrder.orderItems" }),
    menuItem: relationship({ ref: "MenuItem.orderItems" }),
    appliedModifiers: relationship({ ref: "MenuItemModifier", many: true }),
    ...trackingFields,
  },
});
