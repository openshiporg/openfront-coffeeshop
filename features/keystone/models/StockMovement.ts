import { list } from "@keystone-6/core";
import { decimal, relationship, select, text } from "@keystone-6/core/fields";

import { permissions } from "../access";
import { trackingFields } from "./trackingFields";

export const StockMovement = list({
  access: {
    operation: {
      query: permissions.canReadInventory,
      create: permissions.canManageInventory,
      update: permissions.canManageInventory,
      delete: permissions.canManageInventory,
    },
  },
  ui: { listView: { initialColumns: ["inventoryItem", "type", "quantity", "reason"] } },
  fields: {
    type: select({
      type: "string",
      options: [
        { label: "Received", value: "received" },
        { label: "Sale", value: "sale" },
        { label: "Waste", value: "waste" },
        { label: "Adjustment", value: "adjustment" },
        { label: "Transfer", value: "transfer" },
      ],
      defaultValue: "adjustment",
    }),
    quantity: decimal({ validation: { isRequired: true } }),
    reason: text(),
    notes: text({ ui: { displayMode: "textarea" } }),
    inventoryItem: relationship({ ref: "InventoryItem.stockMovements" }),
    createdBy: relationship({ ref: "User" }),
    ...trackingFields,
  },
});
