import { list } from "@keystone-6/core";
import { denyAll } from "@keystone-6/core/access";
import { integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { permissions } from "../access";
import { requiredStoreRelationship } from "./requiredRelationship";
import { trackingFields } from "./trackingFields";

/** Immutable register-session accounting, changed only by register domain mutations. */
export const RegisterShift = list({
  access: {
    operation: {
      query: ({ session }) => permissions.canReadPayments({ session }) || permissions.canReadOrders({ session }),
      create: denyAll,
      update: denyAll,
      delete: denyAll,
    },
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: { initialColumns: ["shiftNumber", "registerName", "status", "openedBy", "openedAt"] },
  },
  fields: {
    idempotencyKey: text({ isIndexed: "unique", validation: { isRequired: true }, isFilterable: false, isOrderable: false, access: { read: permissions.canManagePayments } }),
    closeIdempotencyKey: text({ isIndexed: "unique", db: { isNullable: true }, isFilterable: false, isOrderable: false, access: { read: permissions.canManagePayments } }),
    shiftNumber: text({ isIndexed: "unique", validation: { isRequired: true } }),
    store: requiredStoreRelationship("StoreSetting.registerShifts"),
    registerName: text({ validation: { isRequired: true } }),
    status: select({
      type: "string",
      options: [
        { label: "Open", value: "open" },
        { label: "Closed", value: "closed" },
      ],
      defaultValue: "open",
    }),
    openingCashCents: integer({ defaultValue: 0, validation: { min: 0 } }),
    cashSalesCents: integer({ defaultValue: 0, validation: { min: 0 } }),
    cashRefundsCents: integer({ defaultValue: 0, validation: { min: 0 } }),
    cardSalesCents: integer({ defaultValue: 0, validation: { min: 0 } }),
    cardRefundsCents: integer({ defaultValue: 0, validation: { min: 0 } }),
    tipsCents: integer({ defaultValue: 0, validation: { min: 0 } }),
    payInsCents: integer({ defaultValue: 0, validation: { min: 0 } }),
    payOutsCents: integer({ defaultValue: 0, validation: { min: 0 } }),
    expectedCashCents: integer({ defaultValue: 0 }),
    countedCashCents: integer({ db: { isNullable: true } }),
    cashVarianceCents: integer({ db: { isNullable: true } }),
    openedBy: relationship({ ref: "User" }),
    closedBy: relationship({ ref: "User" }),
    openedAt: timestamp({ defaultValue: { kind: "now" } }),
    closedAt: timestamp(),
    posOrders: relationship({ ref: "PosOrder.registerShift", many: true }),
    payments: relationship({ ref: "Payment.registerShift", many: true }),
    cashMovements: relationship({ ref: "CashMovement.registerShift", many: true }),
    ...trackingFields,
  },
});
