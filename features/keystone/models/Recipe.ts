import { list } from '@keystone-6/core';
import { checkbox, decimal, json, relationship, select, text } from '@keystone-6/core/fields';

import { permissions } from '../access';
import { requiredStoreRelationship } from './requiredRelationship';
import { trackingFields } from './trackingFields';

export const Recipe = list({
  access: { operation: { query: permissions.canReadProducts, create: permissions.canManageProducts, update: permissions.canManageProducts, delete: permissions.canManageProducts } },
  hooks: {
    validateInput: async ({ operation, resolvedData, item, addValidationError }) => {
      if (operation === 'update' && resolvedData.store !== undefined) addValidationError('Recipe store ownership is immutable');
      const yieldQuantity = resolvedData.yieldQuantity !== undefined ? resolvedData.yieldQuantity : item?.yieldQuantity;
      const parsed = Number(yieldQuantity == null ? NaN : String(yieldQuantity));
      const scaled = Math.round(parsed * 10_000);
      if (!Number.isFinite(parsed) || scaled < 1 || Math.abs(parsed * 10_000 - scaled) > 1e-6 || parsed > 1_000_000) {
        addValidationError('Yield must be greater than zero with at most 4 decimal places');
      }
      const yieldUnit = String((resolvedData.yieldUnit !== undefined ? resolvedData.yieldUnit : item?.yieldUnit) ?? '').trim();
      if (!yieldUnit || yieldUnit.length > 40) addValidationError('Yield unit is required (for example serving)');
      // Prep batches freeze the yield unit they were made with; a serving or each yield is sold one per item.
    },
  },
  ui: { listView: { initialColumns: ['name', 'menuItem', 'status', 'active'] } },
  fields: {
    name: text({ validation: { isRequired: true } }),
    store: requiredStoreRelationship('StoreSetting.recipes'),
    menuItem: relationship({ ref: 'MenuItem' }),
    status: select({ type: 'string', options: [{ label: 'Draft', value: 'draft' }, { label: 'Active', value: 'active' }, { label: 'Archived', value: 'archived' }], defaultValue: 'draft' }),
    yieldQuantity: decimal({ defaultValue: '1' }),
    yieldUnit: text({ defaultValue: 'serving', ui: { description: "Use 'serving' or 'each' when a prepared batch is sold one item at a time" } }),
    prepInstructions: text({ ui: { displayMode: 'textarea' } }),
    allergenNotes: text({ ui: { displayMode: 'textarea' } }),
    active: checkbox({ defaultValue: true }),
    metadata: json(),
    ...trackingFields,
  },
});
