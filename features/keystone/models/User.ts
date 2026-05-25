import { list } from '@keystone-6/core'
import { allOperations, denyAll } from '@keystone-6/core/access'
import { password, relationship, select, text } from '@keystone-6/core/fields'

import { isSignedIn, permissions, rules } from '../access'
import { trackingFields } from './trackingFields'

export const User = list({
  access: {
    operation: {
      ...allOperations(isSignedIn),
      create: (args) => process.env.PUBLIC_SIGNUPS_ALLOWED === 'true' || permissions.canManagePeople(args),
      delete: permissions.canManagePeople,
    },
    filter: {
      query: rules.canReadPeople,
      update: rules.canUpdatePeople,
    },
  },
  ui: {
    hideCreate: args => !permissions.canManagePeople(args),
    hideDelete: args => !permissions.canManagePeople(args),
    listView: { initialColumns: ['name', 'email', 'role', 'phone'] },
    itemView: {
      defaultFieldMode: ({ session, item }) => {
        if (session?.data.role?.canEditOtherPeople || session?.data.role?.canManagePeople) return 'edit'
        if (session?.itemId === item?.id) return 'edit'
        return 'read'
      },
    },
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    email: text({ isFilterable: false, isOrderable: false, isIndexed: 'unique', validation: { isRequired: true } }),
    phone: text(),
    password: password({
      access: {
        read: denyAll,
        update: ({ session, item }) => permissions.canManagePeople({ session }) || session?.itemId === item.id,
      },
      validation: { isRequired: true },
    }),
    onboardingStatus: select({
      type: 'string',
      options: [
        { label: 'Not Started', value: 'not_started' },
        { label: 'In Progress', value: 'in_progress' },
        { label: 'Completed', value: 'completed' },
        { label: 'Dismissed', value: 'dismissed' },
      ],
      defaultValue: 'not_started',
    }),
    role: relationship({
      ref: 'Role.assignedTo',
      access: { create: permissions.canManagePeople, update: permissions.canManagePeople },
      ui: { itemView: { fieldMode: args => (permissions.canManagePeople(args) ? 'edit' : 'read') } },
    }),
    cafeOrders: relationship({ ref: 'CafeOrder.customer', many: true }),
    payments: relationship({ ref: 'Payment.customer', many: true }),
    loyaltyAccount: relationship({ ref: 'LoyaltyAccount.customer' }),
    ...trackingFields,
  },
});
