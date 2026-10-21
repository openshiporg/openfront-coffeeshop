import { list } from '@keystone-6/core';
import { denyAll } from '@keystone-6/core/access';
import { integer, json, select, text, timestamp } from '@keystone-6/core/fields';

import { permissions } from '../access';
import { requiredStoreRelationship } from './requiredRelationship';
import { trackingFields } from './trackingFields';

type ItemArgs = { item?: Record<string, unknown> | null };

// New catering records are inquiries; status changes only through updateCateringOrderStatus.
// Customer and event facts can be corrected until the order is confirmed, and the
// quoted amount is fixed once the quote has been sent.
const editableWhile = (statuses: string[]) => ({ item }: ItemArgs) => statuses.includes(String(item?.status || ''));
const eventFactsEditable = editableWhile(['inquiry', 'quoted']);
const quoteEditable = editableWhile(['inquiry']);
const fieldModeFor = (editable: (args: ItemArgs) => boolean) => ({ itemView: { fieldMode: (args: ItemArgs) => (editable(args) ? 'edit' as const : 'read' as const) } });
// Spread per field: Keystone field functions may add keys to the config object they receive.
const eventFact = { access: { update: eventFactsEditable }, ui: fieldModeFor(eventFactsEditable) };

export const CateringOrder = list({
  access: { operation: { query: permissions.canReadOrders, create: permissions.canManageOrders, update: permissions.canManageOrders, delete: denyAll } },
  ui: { listView: { initialColumns: ['cateringNumber', 'customerName', 'status', 'eventAt'] } },
  fields: {
    cateringNumber: text({ isIndexed: 'unique', validation: { isRequired: true }, access: { update: () => false }, ui: { itemView: { fieldMode: 'read' } } }),
    store: requiredStoreRelationship('StoreSetting.cateringOrders', { update: () => false }),
    customerName: text({ validation: { isRequired: true }, ...eventFact }),
    customerEmail: text({ ...eventFact }),
    status: select({ type: 'string', access: { create: () => false, update: () => false }, ui: { createView: { fieldMode: 'hidden' }, itemView: { fieldMode: 'read' } }, options: [{ label: 'Inquiry', value: 'inquiry' }, { label: 'Quoted', value: 'quoted' }, { label: 'Confirmed', value: 'confirmed' }, { label: 'Completed', value: 'completed' }, { label: 'Cancelled', value: 'cancelled' }], defaultValue: 'inquiry' }),
    eventAt: timestamp({ ...eventFact }),
    guestCount: integer({ defaultValue: 0, validation: { min: 0 }, ...eventFact }),
    deliveryAddress: text({ ...eventFact }),
    subtotalCents: integer({ defaultValue: 0, validation: { min: 0 }, access: { update: quoteEditable }, ui: fieldModeFor(quoteEditable) }),
    notes: text({ ui: { displayMode: 'textarea' } }),
    metadata: json({ ...eventFact }),
    ...trackingFields,
  },
});
