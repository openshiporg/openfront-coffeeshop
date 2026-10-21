import { list } from '@keystone-6/core';
import { integer, json, select, text } from '@keystone-6/core/fields';

import { permissions } from '../access';
import { requiredStoreRelationship } from './requiredRelationship';
import { trackingFields } from './trackingFields';

export const Supplier = list({
  access: { operation: { query: permissions.canReadInventory, create: permissions.canManageInventory, update: permissions.canManageInventory, delete: permissions.canManageInventory } },
  hooks: {
    resolveInput: async ({ operation, resolvedData, context }) => {
      if (operation !== 'create' || resolvedData.store) return resolvedData;
      const store = await context.sudo().query.StoreSetting.findOne({
        where: { singletonKey: 'primary' },
        query: 'id',
      });
      if (!store) throw new Error('Primary store is required before creating suppliers');
      return { ...resolvedData, store: { connect: { id: store.id } } };
    },
    validateInput: async ({ operation, resolvedData, addValidationError }) => {
      if (operation === 'update' && resolvedData.store !== undefined) {
        addValidationError('Supplier store ownership is immutable');
      }
    },
    validateDelete: async ({ item, context, addValidationError }) => {
      const [purchaseOrders, inventoryLots] = await Promise.all([
        context.sudo().query.PurchaseOrder.findMany({ where: { supplier: { id: { equals: item.id } } }, take: 1, query: 'id' }),
        context.sudo().query.InventoryLot.findMany({ where: { supplier: { id: { equals: item.id } } }, take: 1, query: 'id' }),
      ]);
      if (purchaseOrders.length || inventoryLots.length) {
        addValidationError('Supplier with purchasing or lot evidence cannot be deleted');
      }
    },
  },
  ui: { listView: { initialColumns: ['name', 'status', 'contactName'] } },
  fields: {
    name: text({ validation: { isRequired: true } }),
    store: requiredStoreRelationship('StoreSetting.suppliers'),
    status: select({ type: 'string', options: [{ label: 'Active', value: 'active' }, { label: 'Paused', value: 'paused' }, { label: 'Archived', value: 'archived' }], defaultValue: 'active' }),
    contactName: text(),
    email: text(),
    phone: text(),
    website: text(),
    leadTimeDays: integer({ defaultValue: 0, validation: { min: 0 } }),
    notes: text({ ui: { displayMode: 'textarea' } }),
    metadata: json(),
    ...trackingFields,
  },
});
