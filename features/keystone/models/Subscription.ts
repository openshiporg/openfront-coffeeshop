import { list } from '@keystone-6/core';
import { denyAll } from '@keystone-6/core/access';
import { integer, json, relationship, select, text, timestamp } from '@keystone-6/core/fields';

import { permissions } from '../access';
import { requiredStoreRelationship } from './requiredRelationship';
import { trackingFields } from './trackingFields';

// Plan terms are fixed once the subscription exists; lifecycle status changes only
// through updateSubscriptionStatus, and every new subscription starts as a trial.
const fixedAfterCreate = { update: () => false };
const readOnlyInItemView = { itemView: { fieldMode: 'read' as const } };
const commandOnly = { create: () => false, update: () => false };
const commandOnlyUi = { createView: { fieldMode: 'hidden' as const }, itemView: { fieldMode: 'read' as const } };

export const Subscription = list({
  access: { operation: { query: permissions.canReadLoyalty, create: permissions.canManageLoyalty, update: permissions.canManageLoyalty, delete: denyAll } },
  ui: { listView: { initialColumns: ['subscriptionNumber', 'loyaltyAccount', 'status', 'planName'] } },
  fields: {
    subscriptionNumber: text({ isIndexed: 'unique', validation: { isRequired: true }, access: fixedAfterCreate, ui: readOnlyInItemView }),
    store: requiredStoreRelationship('StoreSetting.subscriptions', fixedAfterCreate),
    loyaltyAccount: relationship({ ref: 'LoyaltyAccount', access: fixedAfterCreate, ui: readOnlyInItemView }),
    status: select({ type: 'string', access: commandOnly, ui: commandOnlyUi, options: [{ label: 'Trialing', value: 'trialing' }, { label: 'Active', value: 'active' }, { label: 'Paused', value: 'paused' }, { label: 'Cancelled', value: 'cancelled' }], defaultValue: 'trialing' }),
    planName: text({ validation: { isRequired: true }, access: fixedAfterCreate, ui: readOnlyInItemView }),
    billingInterval: select({ type: 'string', access: fixedAfterCreate, ui: readOnlyInItemView, options: [{ label: 'Weekly', value: 'weekly' }, { label: 'Monthly', value: 'monthly' }], defaultValue: 'monthly' }),
    priceCents: integer({ defaultValue: 0, validation: { min: 0 }, access: fixedAfterCreate, ui: readOnlyInItemView }),
    startsAt: timestamp({ access: fixedAfterCreate, ui: readOnlyInItemView }),
    renewsAt: timestamp({ access: fixedAfterCreate, ui: readOnlyInItemView }),
    cancelledAt: timestamp({ access: commandOnly, ui: commandOnlyUi }),
    metadata: json({ access: fixedAfterCreate, ui: readOnlyInItemView }),
    ...trackingFields,
  },
});
