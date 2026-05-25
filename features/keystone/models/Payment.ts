import { list } from "@keystone-6/core";
import { integer, relationship, select, text, timestamp } from "@keystone-6/core/fields";

import { permissions } from "../access";
import { trackingFields } from "./trackingFields";

export const Payment = list({
  access: {
    operation: {
      query: permissions.canReadPayments,
      create: permissions.canManagePayments,
      update: permissions.canManagePayments,
      delete: permissions.canManagePayments,
    },
  },
  ui: { listView: { initialColumns: ["order", "status", "method", "amount", "processedAt"] } },
  fields: {
    status: select({
      type: "string",
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
    amount: integer({ validation: { isRequired: true }, ui: { description: "Amount in cents" } }),
    currencyCode: text({ defaultValue: "USD" }),
    provider: text({ defaultValue: "manual" }),
    providerPaymentId: text(),
    failureMessage: text(),
    processedAt: timestamp(),
    order: relationship({ ref: "CafeOrder.payments" }),
    customer: relationship({ ref: "User.payments" }),
    paymentProvider: relationship({ ref: "PaymentProvider.paymentRecords" }),
    ...trackingFields,
  },
});
