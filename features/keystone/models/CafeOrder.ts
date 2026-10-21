import { graphql, list } from "@keystone-6/core";
import { denyAll } from "@keystone-6/core/access";
import type { BaseItem } from "@keystone-6/core/types";
import { checkbox, integer, relationship, select, text, timestamp, virtual } from "@keystone-6/core/fields";
import crypto from "crypto";

import { permissions } from "../access";
import { requiredStoreRelationship } from "./requiredRelationship";
import { trackingFields } from "./trackingFields";

export const CafeOrder = list({
  access: {
    operation: {
      query: ({ session }) => permissions.canReadOrders({ session }) || permissions.canManageOrders({ session }),
      create: denyAll,
      update: denyAll,
      delete: denyAll,
    },
  },
  ui: {
    hideCreate: true,
    hideDelete: true,
    itemView: { defaultFieldMode: "read" },
    listView: {
      initialColumns: ["orderNumber", "status", "fulfillmentType", "customerName", "promisedAt", "total"],
    },
  },
  fields: {
    orderNumber: text({ validation: { isRequired: true }, isIndexed: "unique" }),
    idempotencyKey: text({
      isIndexed: "unique",
      isFilterable: false,
      isOrderable: false,
      db: { isNullable: true },
      ui: { itemView: { fieldMode: "read" }, createView: { fieldMode: "hidden" } },
      access: { read: permissions.canManageOrders, update: () => false },
    }),
    requestFingerprint: text({
      db: { isNullable: true },
      isFilterable: false,
      isOrderable: false,
      ui: { itemView: { fieldMode: "read" }, createView: { fieldMode: "hidden" } },
      access: { read: permissions.canManageOrders, update: () => false },
    }),
    fulfillmentType: select({
      type: "string",
      options: [
        { label: "Pickup", value: "pickup" },
        { label: "Counter", value: "counter" },
        { label: "Dine-in", value: "dine_in" },
      ],
      defaultValue: "pickup",
    }),
    orderSource: select({
      type: "string",
      options: [
        { label: "Online", value: "online" },
        { label: "POS", value: "pos" },
        { label: "Kiosk", value: "kiosk" },
        { label: "Phone", value: "phone" },
      ],
      defaultValue: "online",
    }),
    status: select({
      type: "string",
      access: { update: () => false },
      options: [
        { label: "Open request", value: "open" },
        { label: "Accepted — pay at pickup", value: "accepted" },
        { label: "Paid", value: "paid" },
        { label: "In Bar Queue", value: "in_bar_queue" },
        { label: "Preparing", value: "preparing" },
        { label: "Ready for Pickup", value: "ready" },
        { label: "Completed", value: "completed" },
        { label: "Cancelled", value: "cancelled" },
        { label: "Refunded", value: "refunded" },
      ],
      defaultValue: "open",
    }),
    customerName: text(),
    customerEmail: text(),
    customerPhone: text(),
    pickupName: text({ ui: { description: "Name called at handoff counter" } }),
    specialInstructions: text({ ui: { displayMode: "textarea" } }),
    subtotal: integer({ defaultValue: 0, validation: { min: 0 } }),
    tax: integer({ defaultValue: 0, validation: { min: 0 } }),
    tip: integer({ defaultValue: 0, validation: { min: 0 } }),
    discount: integer({ defaultValue: 0, validation: { min: 0 } }),
    total: integer({ defaultValue: 0, validation: { min: 0 } }),
    currencyCode: text({ defaultValue: "USD" }),
    paidAt: timestamp(),
    promisedAt: timestamp({ ui: { description: "Quoted pickup time" } }),
    startedAt: timestamp(),
    readyAt: timestamp(),
    completedAt: timestamp(),
    cancelledAt: timestamp(),
    isRush: checkbox({ defaultValue: false }),
    handoffCode: text({
      hooks: {
        resolveInput: ({ operation, resolvedData }) => {
          if (operation === "create" && !resolvedData.handoffCode) {
            return crypto.randomBytes(3).toString("hex").toUpperCase();
          }
          return resolvedData.handoffCode;
        },
      },
    }),
    secretKey: text({
      isFilterable: false,
      isOrderable: false,
      access: { read: () => false, update: () => false },
      hooks: {
        resolveInput: ({ operation }) => operation === "create" ? crypto.randomBytes(32).toString("hex") : undefined,
      },
    }),
    store: requiredStoreRelationship("StoreSetting.cafeOrders"),
    orderAgeMinutes: virtual({
      field: graphql.field({
        type: graphql.Int,
        resolve(item: BaseItem) {
          const createdAt = item.createdAt;
          if (typeof createdAt !== "string" && !(createdAt instanceof Date)) return 0;
          return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
        },
      }),
    }),
    customer: relationship({ ref: "User.cafeOrders" }),
    orderItems: relationship({ ref: "OrderItem.order", many: true }),
    payments: relationship({ ref: "Payment.order", many: true }),
    paymentEvents: relationship({ ref: "PaymentEvent.order", many: true }),
    stockMovements: relationship({ ref: "StockMovement.order", many: true }),
    prepBatchConsumptions: relationship({ ref: "PrepBatchConsumption.order", many: true }),
    loyaltyAccount: relationship({ ref: "LoyaltyAccount.orders" }),
    loyaltyEvents: relationship({ ref: "LoyaltyEvent.order", many: true }),
    ...trackingFields,
  },
});
