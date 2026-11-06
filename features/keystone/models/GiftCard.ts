import { list } from "@keystone-6/core";
import { denyAll } from "@keystone-6/core/access";
import { integer, json, select, text, timestamp } from "@keystone-6/core/fields";

import { permissions } from "../access";
import { requiredStoreRelationship } from "./requiredRelationship";
import { trackingFields } from "./trackingFields";

/**
 * Stored-value gift card (Toast / Square). Sold online on Stripe's hosted page and activated only
 * once Stripe confirms the payment; taken as tender at the counter. The balance changes only through
 * commands, each appending a row to `ledger`, so every debit and credit traces to a payment.
 */
export const GiftCard = list({
  access: {
    operation: { query: permissions.canReadPayments, create: denyAll, update: denyAll, delete: denyAll },
  },
  ui: { hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: "read" }, listView: { initialColumns: ["code", "status", "initialValue", "balance", "recipientName", "expiresAt"] } },
  fields: {
    store: requiredStoreRelationship("StoreSetting.giftCards"),
    code: text({ isIndexed: "unique", validation: { isRequired: true } }),
    status: select({
      type: "string",
      options: [
        { label: "Awaiting payment", value: "pending" },
        { label: "Active", value: "active" },
        { label: "Used up", value: "redeemed" },
        { label: "Cancelled", value: "cancelled" },
      ],
      defaultValue: "pending",
    }),
    initialValue: integer({ validation: { isRequired: true, min: 0 }, ui: { description: "Cents" } }),
    balance: integer({ validation: { isRequired: true, min: 0 }, ui: { description: "Cents" } }),
    currencyCode: text({ defaultValue: "USD" }),
    purchaserName: text(),
    purchaserEmail: text(),
    recipientName: text(),
    recipientEmail: text(),
    message: text({ ui: { displayMode: "textarea" } }),
    providerPaymentId: text({ isIndexed: true, access: { read: permissions.canManagePayments } }),
    refundedAt: timestamp(),
    expiresAt: timestamp(),
    activatedAt: timestamp(),
    emailedAt: timestamp(),
    ledger: json({ defaultValue: [] }),
    ...trackingFields,
  },
});
