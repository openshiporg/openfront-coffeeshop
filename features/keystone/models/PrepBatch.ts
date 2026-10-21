import { list } from "@keystone-6/core";
import { denyAll } from "@keystone-6/core/access";
import { decimal, json, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { permissions } from "../access";
import { requiredStoreRelationship } from "./requiredRelationship";
import { trackingFields } from "./trackingFields";

export const PrepBatch = list({
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
    listView: { initialColumns: ["batchNumber", "recipe", "status", "preparedBy"] },
  },
  fields: {
    idempotencyKey: text({ isIndexed: "unique", db: { isNullable: true }, access: { read: permissions.canManageInventory } }),
    batchNumber: text({ isIndexed: "unique", validation: { isRequired: true } }),
    store: requiredStoreRelationship("StoreSetting.prepBatches"),
    recipe: relationship({ ref: "Recipe" }),
    status: select({
      type: "string",
      options: [
        { label: "Planned", value: "planned" },
        { label: "In Progress", value: "in_progress" },
        { label: "Completed", value: "completed" },
        { label: "Discarded", value: "discarded" },
      ],
      defaultValue: "completed",
    }),
    preparedBy: relationship({ ref: "User" }),
    quantityMade: decimal({ defaultValue: "0" }),
    quantityRemaining: decimal({ defaultValue: "0" }),
    startedAt: timestamp(),
    completedAt: timestamp(),
    expiresAt: timestamp(),
    notes: text({ ui: { displayMode: "textarea" } }),
    metadata: json(),
    stockMovements: relationship({ ref: "StockMovement.prepBatch", many: true }),
    consumptions: relationship({ ref: "PrepBatchConsumption.prepBatch", many: true }),
    ...trackingFields,
  },
});
