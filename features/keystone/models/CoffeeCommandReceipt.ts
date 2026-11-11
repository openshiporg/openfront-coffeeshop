import { list } from "@keystone-6/core";
import { denyAll } from "@keystone-6/core/access";
import { json, text, timestamp } from "@keystone-6/core/fields";

import { requiredStoreRelationship } from "./requiredRelationship";
import { trackingFields } from "./trackingFields";

/** Immutable, tenant-owned command receipt (idempotency ledger) written in the same transaction as its aggregate. */
export const CoffeeCommandReceipt = list({
  access: { operation: { query: denyAll, create: denyAll, update: denyAll, delete: denyAll } },
  ui: { isHidden: true },
  fields: {
    eventKey: text({ isIndexed: "unique", validation: { isRequired: true } }),
    eventType: text({ isIndexed: true, validation: { isRequired: true } }),
    schemaVersion: text({ defaultValue: "1", validation: { isRequired: true } }),
    aggregateType: text({ isIndexed: true, validation: { isRequired: true } }),
    aggregateId: text({ isIndexed: true, validation: { isRequired: true } }),
    payload: json(),
    payloadHash: text({ validation: { isRequired: true } }),
    occurredAt: timestamp({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
    store: requiredStoreRelationship("StoreSetting.commandReceipts"),
    ...trackingFields,
  },
});
