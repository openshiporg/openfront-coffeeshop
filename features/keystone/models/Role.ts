import { list } from '@keystone-6/core'
import { allOperations } from '@keystone-6/core/access'
import { checkbox, relationship, text } from '@keystone-6/core/fields'

import { isSignedIn, permissions } from '../access'
import { trackingFields } from './trackingFields'

export const Role = list({
  access: {
    operation: {
      ...allOperations(permissions.canManageRoles),
      query: isSignedIn,
    },
  },
  ui: {
    hideCreate: args => !permissions.canManageRoles(args),
    hideDelete: args => !permissions.canManageRoles(args),
    listView: { initialColumns: ['name', 'assignedTo'] },
    itemView: { defaultFieldMode: args => (permissions.canManageRoles(args) ? 'edit' : 'read') },
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    canAccessDashboard: checkbox({ defaultValue: false }),
    canReadOrders: checkbox({ defaultValue: false }),
    canManageOrders: checkbox({ defaultValue: false }),
    canReadPayments: checkbox({ defaultValue: false }),
    canManagePayments: checkbox({ defaultValue: false }),
    canReadProducts: checkbox({ defaultValue: false }),
    canManageProducts: checkbox({ defaultValue: false }),
    canReadInventory: checkbox({ defaultValue: false }),
    canManageInventory: checkbox({ defaultValue: false }),
    canReadLoyalty: checkbox({ defaultValue: false }),
    canManageLoyalty: checkbox({ defaultValue: false }),
    canSeeOtherPeople: checkbox({ defaultValue: false }),
    canEditOtherPeople: checkbox({ defaultValue: false }),
    canManagePeople: checkbox({ defaultValue: false }),
    canManageRoles: checkbox({ defaultValue: false }),
    canManageSettings: checkbox({ defaultValue: false }),
    canManageOnboarding: checkbox({ defaultValue: true }),
    assignedTo: relationship({
      ref: 'User.role',
      many: true,
      ui: { itemView: { fieldMode: 'read' } },
    }),
    ...trackingFields,
  },
});
