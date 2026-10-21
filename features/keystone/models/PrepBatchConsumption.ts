import { list } from "@keystone-6/core";
import { denyAll } from "@keystone-6/core/access";
import { decimal, text } from "@keystone-6/core/fields";

import { permissions } from "../access";
import { requiredRelationship, requiredStoreRelationship } from "./requiredRelationship";
import { trackingFields } from "./trackingFields";

export const PrepBatchConsumption = list({
  access: {
    operation: { query: permissions.canReadInventory, create: denyAll, update: denyAll, delete: denyAll },
  },
  ui: { hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: "read" }, listView: { initialColumns: ["prepBatch", "order", "quantity"] } },
  fields: {
    idempotencyKey: text({ isIndexed: "unique", validation: { isRequired: true }, access: { read: permissions.canManageInventory } }),
    store: requiredStoreRelationship("StoreSetting.prepBatchConsumptions"),
    prepBatch: requiredRelationship("PrepBatch.consumptions", "prepBatch", "PrepBatch"),
    order: requiredRelationship("CafeOrder.prepBatchConsumptions", "order", "CafeOrder"),
    quantity: decimal({ validation: { isRequired: true } }),
    ...trackingFields,
  },
});
