import { list } from "@keystone-6/core";
import { denyAll } from "@keystone-6/core/access";
import { integer, json, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { permissions } from "../access";
import { requiredStoreRelationship } from "./requiredRelationship";
import { trackingFields } from "./trackingFields";

export const PosOrder = list({
  access: {
    operation: {
      query: permissions.canReadOrders,
      create: denyAll,
      update: denyAll,
      delete: denyAll,
    },
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: { initialColumns: ["receiptNumber", "status", "registerShift", "cashier", "totalCents"] },
  },
  fields: {
    receiptNumber: text({ isIndexed: "unique", validation: { isRequired: true } }),
    store: requiredStoreRelationship("StoreSetting.posOrders"),
    cafeOrder: relationship({ ref: "CafeOrder" }),
    cashier: relationship({ ref: "User" }),
    registerShift: relationship({ ref: "RegisterShift.posOrders" }),
    registerName: text(),
    status: select({
      type: "string",
      options: [
        { label: "Open", value: "open" },
        { label: "Paid", value: "paid" },
        { label: "Voided", value: "voided" },
        { label: "Refunded", value: "refunded" },
      ],
      defaultValue: "open",
    }),
    subtotalCents: integer({ defaultValue: 0, validation: { min: 0 } }),
    taxCents: integer({ defaultValue: 0, validation: { min: 0 } }),
    tipCents: integer({ defaultValue: 0, validation: { min: 0 } }),
    totalCents: integer({ defaultValue: 0, validation: { min: 0 } }),
    closedAt: timestamp(),
    /** Tender evidence (cash, or operator-attested external terminal reference). Not processor proof. */
    metadata: json({ access: { read: permissions.canReadPayments } }),
    ...trackingFields,
  },
});
