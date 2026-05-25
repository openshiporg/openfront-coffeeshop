import { graphql, list } from "@keystone-6/core";
import { integer, relationship, select, text, timestamp, virtual } from "@keystone-6/core/fields";

import { permissions } from "../access";
import { trackingFields } from "./trackingFields";

export const OrderItem = list({
  access: {
    operation: {
      query: permissions.canReadOrders,
      create: permissions.canManageOrders,
      update: permissions.canManageOrders,
      delete: permissions.canManageOrders,
    },
  },
  ui: {
    listView: {
      initialColumns: ["menuItem", "quantity", "price", "barStatus", "order"],
    },
  },
  fields: {
    quantity: integer({ defaultValue: 1, validation: { min: 1, isRequired: true } }),
    price: integer({ validation: { isRequired: true }, ui: { description: "Unit price snapshot in cents" } }),
    itemNameSnapshot: text({ ui: { description: "Menu item name at time of order" } }),
    customizationsSummary: text({ ui: { displayMode: "textarea" } }),
    specialInstructions: text({ ui: { displayMode: "textarea" } }),
    barStatus: select({
      type: "string",
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
      options: [
        { label: "Espresso Bar", value: "espresso_bar" },
        { label: "Cold Bar", value: "cold_bar" },
        { label: "Brew Bar", value: "brew_bar" },
        { label: "Pastry Case", value: "pastry_case" },
        { label: "Retail Shelf", value: "retail_shelf" },
      ],
      defaultValue: "espresso_bar",
    }),
    queuedAt: timestamp(),
    startedAt: timestamp(),
    readyAt: timestamp(),
    handedOffAt: timestamp(),
    totalPrice: virtual({
      field: graphql.field({
        type: graphql.Int,
        resolve(item: any) {
          return (item.price || 0) * (item.quantity || 1);
        },
      }),
    }),
    order: relationship({ ref: "CafeOrder.orderItems" }),
    menuItem: relationship({ ref: "MenuItem.orderItems" }),
    appliedModifiers: relationship({ ref: "MenuItemModifier", many: true }),
    ...trackingFields,
  },
});
