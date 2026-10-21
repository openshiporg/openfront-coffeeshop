import { list } from "@keystone-6/core";
import { denyAll } from "@keystone-6/core/access";
import { integer, relationship, select, text } from "@keystone-6/core/fields";

import { permissions } from "../access";
import { trackingFields } from "./trackingFields";

export const LoyaltyEvent = list({
  access: {
    operation: {
      query: permissions.canReadLoyalty,
      create: denyAll,
      update: denyAll,
      delete: denyAll,
    },
  },
  ui: { hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: "read" }, listView: { initialColumns: ["account", "type", "pointsDelta", "drinkCreditsDelta", "order"] } },
  fields: {
    type: select({
      type: "string",
      options: [
        { label: "Earned", value: "earned" },
        { label: "Redeemed", value: "redeemed" },
        { label: "Manual Adjustment", value: "manual_adjustment" },
        { label: "Refund Reversal", value: "refund_reversal" },
        { label: "Signup", value: "signup" },
      ],
      defaultValue: "earned",
    }),
    pointsDelta: integer({ defaultValue: 0 }),
    drinkCreditsDelta: integer({ defaultValue: 0 }),
    note: text({ ui: { displayMode: "textarea" } }),
    account: relationship({ ref: "LoyaltyAccount.events" }),
    order: relationship({ ref: "CafeOrder.loyaltyEvents" }),
    createdBy: relationship({ ref: "User" }),
    ...trackingFields,
  },
});
