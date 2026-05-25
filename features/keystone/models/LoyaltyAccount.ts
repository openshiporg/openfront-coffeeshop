import { graphql, list } from "@keystone-6/core";
import { checkbox, integer, relationship, select, text, timestamp, virtual } from "@keystone-6/core/fields";

import { permissions } from "../access";
import { trackingFields } from "./trackingFields";

export const LoyaltyAccount = list({
  access: {
    operation: {
      query: permissions.canReadLoyalty,
      create: permissions.canManageLoyalty,
      update: permissions.canManageLoyalty,
      delete: permissions.canManageLoyalty,
    },
  },
  ui: { listView: { initialColumns: ["customerName", "customerEmail", "status", "pointsBalance", "drinkCredits", "tier"] } },
  fields: {
    customerName: text({ ui: { description: "Guest-facing name for loyalty lookup when no user account is attached" } }),
    customerEmail: text({ isIndexed: "unique", ui: { description: "Email used for pickup loyalty lookup" } }),
    customerPhone: text(),
    marketingOptIn: checkbox({ defaultValue: false }),
    status: select({
      type: "string",
      options: [
        { label: "Active", value: "active" },
        { label: "Paused", value: "paused" },
        { label: "Closed", value: "closed" },
      ],
      defaultValue: "active",
    }),
    tier: select({
      type: "string",
      options: [
        { label: "Regular", value: "regular" },
        { label: "Neighborhood", value: "neighborhood" },
        { label: "House Account", value: "house_account" },
      ],
      defaultValue: "regular",
    }),
    pointsBalance: integer({ defaultValue: 0 }),
    lifetimePoints: integer({ defaultValue: 0 }),
    drinkCredits: integer({ defaultValue: 0 }),
    visits: integer({ defaultValue: 0 }),
    lastVisitAt: timestamp(),
    firstVisitAt: timestamp(),
    notes: text({ ui: { displayMode: "textarea" } }),
    customer: relationship({ ref: "User.loyaltyAccount" }),
    orders: relationship({ ref: "CafeOrder.loyaltyAccount", many: true }),
    events: relationship({ ref: "LoyaltyEvent.account", many: true }),
    displayName: virtual({
      field: graphql.field({
        type: graphql.String,
        resolve(item: any) {
          return item.customerName || item.customerEmail || "Guest account";
        },
      }),
    }),
    nextRewardProgress: virtual({
      field: graphql.field({
        type: graphql.Int,
        resolve(item: any) {
          return Math.min(100, Math.floor(((item.pointsBalance || 0) % 100) / 100 * 100));
        },
      }),
    }),
    ...trackingFields,
  },
});
