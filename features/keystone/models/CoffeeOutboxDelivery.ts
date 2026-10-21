import { list } from "@keystone-6/core";
import { denyAll } from "@keystone-6/core/access";
import { integer, select, text, timestamp } from "@keystone-6/core/fields";

import { requiredRelationship, requiredStoreRelationship } from "./requiredRelationship";
import { trackingFields } from "./trackingFields";

/** Replay-safe delivery state. Identity and attempt counters are changed only by outbox operations. */
export const CoffeeOutboxDelivery = list({
  access: { operation: { query: denyAll, create: denyAll, update: denyAll, delete: denyAll } },
  ui: { isHidden: true },
  fields: {
    deliveryKey: text({ isIndexed: "unique", validation: { isRequired: true } }),
    consumer: text({ isIndexed: true, validation: { isRequired: true } }),
    status: select({
      type: "string",
      isIndexed: true,
      options: [
        { label: "Pending", value: "pending" },
        { label: "Processing", value: "processing" },
        { label: "Retry", value: "retry" },
        { label: "Delivered", value: "delivered" },
        { label: "Dead letter", value: "dead_letter" },
      ],
      defaultValue: "pending",
      validation: { isRequired: true },
    }),
    attempts: integer({ defaultValue: 0, validation: { min: 0, isRequired: true } }),
    maxAttempts: integer({ defaultValue: 8, validation: { min: 1, isRequired: true } }),
    nextAttempt: timestamp({ defaultValue: { kind: "now" }, isIndexed: true }),
    lockedAt: timestamp(),
    lockOwner: text({ defaultValue: "" }),
    deliveredAt: timestamp(),
    deadLetteredAt: timestamp(),
    lastError: text({ ui: { displayMode: "textarea" } }),
    event: requiredRelationship("CoffeeDomainEvent.deliveries", "event", "CoffeeDomainEvent"),
    store: requiredStoreRelationship("StoreSetting.outboxDeliveries"),
    ...trackingFields,
  },
});
