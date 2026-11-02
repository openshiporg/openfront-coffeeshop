import { list } from "@keystone-6/core";
import { denyAll } from "@keystone-6/core/access";
import { graphql } from "@keystone-6/core";
import { integer, relationship, select, text, timestamp, virtual } from "@keystone-6/core/fields";
import type { BaseItem } from "@keystone-6/core/types";

import { permissions } from "../access";
import { requiredStoreRelationship } from "./requiredRelationship";
import { trackingFields } from "./trackingFields";

export const Payment = list({
  access: {
    operation: {
      query: permissions.canReadPayments,
      create: denyAll,
      update: denyAll,
      delete: denyAll,
    },
  },
  ui: { hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: "read" }, listView: { initialColumns: ["order", "status", "method", "displayAmount", "processedAt"] } },
  fields: {
    idempotencyKey: text({
      isIndexed: "unique",
      db: { isNullable: true },
      ui: { itemView: { fieldMode: "read" }, createView: { fieldMode: "hidden" } },
      access: { read: permissions.canManagePayments, update: () => false },
    }),
    refundIdempotencyKey: text({
      isIndexed: "unique",
      db: { isNullable: true },
      access: { read: permissions.canManagePayments, update: () => false },
      ui: { itemView: { fieldMode: "read" }, createView: { fieldMode: "hidden" } },
    }),
    refundedAmount: integer({ defaultValue: 0, validation: { min: 0 }, access: { update: () => false } }),
    refundReason: text({ access: { update: () => false } }),
    refundedAt: timestamp({ access: { update: () => false } }),
    status: select({
      type: "string",
      access: { update: () => false },
      options: [
        { label: "Pending", value: "pending" },
        { label: "Authorized", value: "authorized" },
        { label: "Captured", value: "captured" },
        { label: "Failed", value: "failed" },
        { label: "Refunded", value: "refunded" },
        { label: "Cancelled", value: "cancelled" },
      ],
      defaultValue: "pending",
    }),
    method: select({
      type: "string",
      options: [
        { label: "Card", value: "card" },
        { label: "Cash", value: "cash" },
        { label: "Gift Card", value: "gift_card" },
        { label: "Manual", value: "manual" },
      ],
      defaultValue: "card",
    }),
    amount: integer({ validation: { isRequired: true, min: 0 }, ui: { description: "Amount in cents" } }),
    currencyCode: text({ defaultValue: "USD" }),
    // The amount as staff read it ($5.39), next to the stored cents.
    displayAmount: virtual({
      label: "Amount",
      field: graphql.field({
        type: graphql.String,
        resolve(item: BaseItem) {
          const cents = typeof item.amount === "number" ? item.amount : 0;
          const currency = typeof item.currencyCode === "string" && /^[A-Z]{3}$/.test(item.currencyCode) ? item.currencyCode : "USD";
          return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
        },
      }),
    }),
    provider: text({ defaultValue: "manual" }),
    providerPaymentId: text(),
    failureMessage: text(),
    processedAt: timestamp(),
    store: requiredStoreRelationship("StoreSetting.payments"),
    order: relationship({ ref: "CafeOrder.payments" }),
    customer: relationship({ ref: "User.payments" }),
    paymentProvider: relationship({ ref: "PaymentProvider.paymentRecords" }),
    events: relationship({ ref: "PaymentEvent.payment", many: true }),
    registerShift: relationship({ ref: "RegisterShift.payments" }),
    refundRegisterShift: relationship({ ref: "RegisterShift", access: { create: denyAll, update: denyAll }, ui: { description: "Actual payout shift; original sale shift and its close remain unchanged." } }),
    ...trackingFields,
  },
});
