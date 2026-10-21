import { list } from "@keystone-6/core";
import { denyAll } from "@keystone-6/core/access";
import { integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { permissions } from "../access";
import { requiredStoreRelationship } from "./requiredRelationship";
import { trackingFields } from "./trackingFields";

/** Append-only register cash evidence. */
export const CashMovement = list({
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
    listView: { initialColumns: ["movementNumber", "registerShift", "type", "amountCents", "recordedAt"] },
  },
  fields: {
    idempotencyKey: text({ isIndexed: "unique", validation: { isRequired: true }, isFilterable: false, isOrderable: false, access: { read: permissions.canManagePayments } }),
    movementNumber: text({ isIndexed: "unique", validation: { isRequired: true } }),
    store: requiredStoreRelationship("StoreSetting.cashMovements"),
    type: select({
      type: "string",
      options: [
        { label: "Pay in", value: "pay_in" },
        { label: "Pay out", value: "pay_out" },
        { label: "Cash drop", value: "cash_drop" },
      ],
      validation: { isRequired: true },
    }),
    amountCents: integer({ validation: { isRequired: true, min: 1 } }),
    reason: text({ validation: { isRequired: true } }),
    registerShift: relationship({ ref: "RegisterShift.cashMovements" }),
    recordedBy: relationship({ ref: "User" }),
    recordedAt: timestamp({ defaultValue: { kind: "now" } }),
    ...trackingFields,
  },
});
