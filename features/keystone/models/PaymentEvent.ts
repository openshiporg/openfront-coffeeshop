import { list } from "@keystone-6/core";
import { denyAll } from "@keystone-6/core/access";
import { relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { permissions } from "../access";
import { requiredStoreRelationship } from "./requiredRelationship";
import { trackingFields } from "./trackingFields";

/** Append-only webhook replay and settlement evidence. Only domain mutations may write it. */
export const PaymentEvent = list({
  access: {
    operation: {
      query: permissions.canReadPayments,
      create: denyAll,
      update: denyAll,
      delete: denyAll,
    },
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: { initialColumns: ["providerCode", "eventType", "status", "processedAt"] },
  },
  fields: {
    replayKey: text({ isIndexed: "unique", validation: { isRequired: true } }),
    providerCode: text({ validation: { isRequired: true } }),
    providerEventId: text({ validation: { isRequired: true } }),
    eventType: text({ validation: { isRequired: true } }),
    payloadHash: text({ validation: { isRequired: true } }),
    status: select({
      type: "string",
      options: [
        { label: "Processed", value: "processed" },
        { label: "Ignored", value: "ignored" },
      ],
      validation: { isRequired: true },
    }),
    processedAt: timestamp({ defaultValue: { kind: "now" } }),
    store: requiredStoreRelationship("StoreSetting.paymentEvents"),
    order: relationship({ ref: "CafeOrder.paymentEvents" }),
    payment: relationship({ ref: "Payment.events" }),
    ...trackingFields,
  },
});
