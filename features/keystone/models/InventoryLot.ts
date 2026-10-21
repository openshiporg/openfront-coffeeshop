import { list } from "@keystone-6/core";
import { denyAll } from "@keystone-6/core/access";
import { decimal, integer, json, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { permissions } from "../access";
import { requiredStoreRelationship } from "./requiredRelationship";
import { trackingFields } from "./trackingFields";

export const InventoryLot = list({
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
    listView: { initialColumns: ["lotNumber", "inventoryItem", "supplier", "status"] },
  },
  fields: {
    lotNumber: text({ isIndexed: "unique", validation: { isRequired: true } }),
    store: requiredStoreRelationship("StoreSetting.inventoryLots"),
    inventoryItem: relationship({ ref: "InventoryItem.inventoryLots" }),
    supplier: relationship({ ref: "Supplier" }),
    purchaseOrder: relationship({ ref: "PurchaseOrder.inventoryLots" }),
    quantityReceived: decimal({ defaultValue: "0" }),
    quantityRemaining: decimal({ defaultValue: "0" }),
    unitCostCents: integer({ defaultValue: 0, validation: { min: 0 } }),
    receivedAt: timestamp(),
    expiresAt: timestamp(),
    status: select({
      type: "string",
      options: [
        { label: "Active", value: "active" },
        { label: "Consumed", value: "consumed" },
        { label: "Expired", value: "expired" },
        { label: "Quarantined", value: "quarantined" },
      ],
      defaultValue: "active",
    }),
    metadata: json(),
    stockMovements: relationship({ ref: "StockMovement.inventoryLot", many: true }),
    ...trackingFields,
  },
});
