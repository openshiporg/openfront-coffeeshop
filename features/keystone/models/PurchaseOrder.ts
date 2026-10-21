import { list } from "@keystone-6/core";
import { denyAll } from "@keystone-6/core/access";
import { decimal, integer, json, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { permissions } from "../access";
import { requiredStoreRelationship } from "./requiredRelationship";
import { trackingFields } from "./trackingFields";

export const PurchaseOrder = list({
  access: {
    operation: {
      query: permissions.canReadInventory,
      create: denyAll,
      update: denyAll,
      delete: denyAll,
    },
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: { initialColumns: ["poNumber", "supplier", "inventoryItem", "status", "expectedAt"] },
  },
  fields: {
    idempotencyKey: text({ isIndexed: "unique", db: { isNullable: true }, access: { read: permissions.canManageInventory } }),
    poNumber: text({ isIndexed: "unique", validation: { isRequired: true } }),
    store: requiredStoreRelationship("StoreSetting.purchaseOrders"),
    supplier: relationship({ ref: "Supplier" }),
    inventoryItem: relationship({ ref: "InventoryItem.purchaseOrders" }),
    orderedQuantity: decimal({ defaultValue: "0" }),
    unitCostCents: integer({ defaultValue: 0, validation: { min: 0 } }),
    status: select({
      type: "string",
      options: [
        { label: "Draft", value: "draft" },
        { label: "Submitted", value: "submitted" },
        { label: "Received", value: "received" },
        { label: "Cancelled", value: "cancelled" },
      ],
      defaultValue: "submitted",
    }),
    orderedAt: timestamp(),
    expectedAt: timestamp(),
    receivedAt: timestamp(),
    subtotalCents: integer({ defaultValue: 0, validation: { min: 0 } }),
    notes: text({ ui: { displayMode: "textarea" } }),
    metadata: json(),
    inventoryLots: relationship({ ref: "InventoryLot.purchaseOrder", many: true }),
    stockMovements: relationship({ ref: "StockMovement.purchaseOrder", many: true }),
    ...trackingFields,
  },
});
