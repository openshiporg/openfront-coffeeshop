import { list } from "@keystone-6/core";
import { denyAll } from "@keystone-6/core/access";
import { decimal, integer, json, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { permissions } from "../access";
import { requiredStoreRelationship } from "./requiredRelationship";
import { trackingFields } from "./trackingFields";

export const WasteLog = list({
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
    listView: { initialColumns: ["logNumber", "inventoryItem", "prepBatch", "reason", "costCents"] },
  },
  fields: {
    idempotencyKey: text({ isIndexed: "unique", db: { isNullable: true }, access: { read: permissions.canManageInventory } }),
    logNumber: text({ isIndexed: "unique", validation: { isRequired: true } }),
    store: requiredStoreRelationship("StoreSetting.wasteLogs"),
    inventoryItem: relationship({ ref: "InventoryItem.wasteLogs" }),
    prepBatch: relationship({ ref: "PrepBatch" }),
    reason: select({
      type: "string",
      options: [
        { label: "Expired", value: "expired" },
        { label: "Damaged", value: "damaged" },
        { label: "Overproduction", value: "overproduction" },
        { label: "Quality", value: "quality" },
      ],
      defaultValue: "expired",
    }),
    quantity: decimal({ defaultValue: "0" }),
    unit: text({ defaultValue: "each" }),
    costCents: integer({ defaultValue: 0, validation: { min: 0 } }),
    loggedBy: relationship({ ref: "User" }),
    loggedAt: timestamp({ defaultValue: { kind: "now" } }),
    notes: text({ ui: { displayMode: "textarea" } }),
    metadata: json(),
    stockMovements: relationship({ ref: "StockMovement.wasteLog", many: true }),
    ...trackingFields,
  },
});
