import { list } from '@keystone-6/core';
import { denyAll } from '@keystone-6/core/access';
import { json, relationship, select, text, timestamp } from '@keystone-6/core/fields';

import { permissions } from '../access';
import { requiredStoreRelationship } from './requiredRelationship';
import { trackingFields } from './trackingFields';

export const StaffShift = list({
  access: { operation: { query: permissions.canManageSettings, create: denyAll, update: denyAll, delete: denyAll } },
  ui: { hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: 'read' }, listView: { initialColumns: ['shiftNumber', 'staff', 'role', 'status'] } },
  fields: {
    idempotencyKey: text({ isIndexed: 'unique', validation: { isRequired: true }, access: { read: permissions.canManageSettings } }),
    shiftNumber: text({ isIndexed: 'unique', validation: { isRequired: true } }),
    store: requiredStoreRelationship('StoreSetting.staffShifts'),
    staff: relationship({ ref: 'User' }),
    role: select({ type: 'string', options: [{ label: 'Barista', value: 'barista' }, { label: 'Shift Lead', value: 'shift_lead' }, { label: 'Kitchen', value: 'kitchen' }, { label: 'Manager', value: 'manager' }], defaultValue: 'barista' }),
    status: select({ type: 'string', access: { update: () => false }, options: [{ label: 'Scheduled', value: 'scheduled' }, { label: 'Clocked In', value: 'clocked_in' }, { label: 'Completed', value: 'completed' }, { label: 'Missed', value: 'missed' }], defaultValue: 'scheduled' }),
    startsAt: timestamp(),
    endsAt: timestamp(),
    clockInAt: timestamp(),
    clockOutAt: timestamp(),
    notes: text({ ui: { displayMode: 'textarea' } }),
    metadata: json(),
    ...trackingFields,
  },
});
