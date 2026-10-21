import { list } from "@keystone-6/core";
import { denyAll } from "@keystone-6/core/access";
import { decimal, relationship, select, text } from "@keystone-6/core/fields";

import { permissions } from "../access";
import { requiredRelationship, requiredStoreRelationship } from "./requiredRelationship";
import { trackingFields } from "./trackingFields";

export const StockMovement = list({
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
    listView: { initialColumns: ["inventoryItem", "type", "quantity", "reason"] },
  },
  fields: {
    idempotencyKey: text({ isIndexed: "unique", db: { isNullable: true }, access: { read: permissions.canManageInventory, create: () => false, update: () => false } }),
    type: select({
      type: "string",
      options: [
        { label: "Received", value: "received" },
        { label: "Sale", value: "sale" },
        { label: "Return / release", value: "return" },
        { label: "Waste", value: "waste" },
        { label: "Adjustment", value: "adjustment" },
        { label: "Transfer", value: "transfer" },
      ],
      defaultValue: "adjustment",
    }),
    quantity: decimal({ validation: { isRequired: true } }),
    reason: text(),
    notes: text({ ui: { displayMode: "textarea" } }),
    store: requiredStoreRelationship("StoreSetting.stockMovements"),
    inventoryItem: requiredRelationship("InventoryItem.stockMovements", "inventoryItem", "InventoryItem"),
    order: relationship({ ref: "CafeOrder.stockMovements" }),
    purchaseOrder: relationship({ ref: "PurchaseOrder.stockMovements" }),
    inventoryLot: relationship({ ref: "InventoryLot.stockMovements" }),
    prepBatch: relationship({ ref: "PrepBatch.stockMovements" }),
    wasteLog: relationship({ ref: "WasteLog.stockMovements" }),
    createdBy: relationship({ ref: "User" }),
    ...trackingFields,
  },
});
