import { graphql, list } from "@keystone-6/core";
import { denyAll } from "@keystone-6/core/access";
import { integer, json, select, text, timestamp, virtual } from "@keystone-6/core/fields";

import { permissions } from "../access";
import { requiredStoreRelationship } from "./requiredRelationship";
import { trackingFields } from "./trackingFields";

/**
 * Stored-value gift card (Toast / Square). Sold online on Stripe's hosted page and activated only
 * once Stripe confirms the payment; taken as tender at the counter. The balance changes only through
 * commands, each appending a row to `ledger`, so every debit and credit traces to a payment.
 */
function dollars(cents: unknown) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

export const GiftCard = list({
  access: {
    operation: { query: permissions.canReadPayments, create: denyAll, update: denyAll, delete: denyAll },
  },
  ui: { hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: "read" }, listView: { initialColumns: ["code", "status", "amountLoaded", "balanceLeft", "recipientName", "expiresAt"] } },
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
    // Stored in cents for the ledger; staff read the dollar amounts below.
    initialValue: integer({ validation: { isRequired: true, min: 0 }, ui: { itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } } }),
    balance: integer({ validation: { isRequired: true, min: 0 }, ui: { itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } } }),
    amountLoaded: virtual({ label: "Amount loaded", field: graphql.field({ type: graphql.String, resolve: (item) => dollars(item.initialValue) }) }),
    balanceLeft: virtual({ label: "Balance", field: graphql.field({ type: graphql.String, resolve: (item) => dollars(item.balance) }) }),
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
