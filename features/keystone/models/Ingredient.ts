import { list } from '@keystone-6/core';
import { checkbox, decimal, json, relationship, text } from '@keystone-6/core/fields';

import { permissions } from '../access';
import { requiredStoreRelationship } from './requiredRelationship';
import { trackingFields } from './trackingFields';

export const Ingredient = list({
  access: { operation: { query: permissions.canReadProducts, create: permissions.canManageProducts, update: permissions.canManageProducts, delete: permissions.canManageProducts } },
  hooks: {
    validateInput: async ({ operation, resolvedData, item, context, addValidationError }) => {
      if (operation === 'update' && resolvedData.store !== undefined) addValidationError('Ingredient store ownership is immutable');
      const quantity = resolvedData.quantity !== undefined ? resolvedData.quantity : item?.quantity;
      const parsed = Number(quantity == null ? NaN : String(quantity));
      const scaled = Math.round(parsed * 10_000);
      if (!Number.isFinite(parsed) || scaled < 1 || Math.abs(parsed * 10_000 - scaled) > 1e-6 || parsed > 1_000_000) {
        addValidationError('Ingredient quantity must be greater than zero with at most 4 decimal places');
      }
      const unit = String((resolvedData.unit !== undefined ? resolvedData.unit : item?.unit) ?? '').trim();
      if (!unit) addValidationError('Ingredient unit is required');
      const relationId = (value: unknown, current: unknown) => {
        if (value === undefined) return typeof current === 'string' ? current : null;
        const input = value as { connect?: { id?: string }; disconnect?: boolean } | null;
        if (input?.connect?.id) return input.connect.id;
        return null;
      };
      const inventoryItemId = relationId(resolvedData.inventoryItem, item?.inventoryItemId);
      const recipeId = relationId(resolvedData.recipe, item?.recipeId);
      const storeId = relationId(resolvedData.store, item?.storeId);
      const [inventory, recipe] = await Promise.all([
        inventoryItemId ? context.prisma.inventoryItem.findUnique({ where: { id: inventoryItemId }, select: { storeId: true, unit: true } }) : null,
        recipeId ? context.prisma.recipe.findUnique({ where: { id: recipeId }, select: { storeId: true } }) : null,
      ]);
      // Stock is depleted in the inventory item's own unit; no conversion is inferred.
      if (inventory && unit && inventory.unit !== unit) addValidationError(`Ingredient unit must match its inventory item's unit (${inventory.unit})`);
      if (inventory && unit === 'each' && scaled % 10_000 !== 0) addValidationError('Ingredients counted in each must use whole numbers');
      if (storeId && ((inventory && inventory.storeId !== storeId) || (recipe && recipe.storeId !== storeId))) addValidationError('Ingredient, recipe and inventory item must belong to the same store');
    },
  },
  ui: { listView: { initialColumns: ['name', 'recipe', 'inventoryItem', 'quantity'] } },
  fields: {
    name: text({ validation: { isRequired: true } }),
    store: requiredStoreRelationship('StoreSetting.ingredients'),
    inventoryItem: relationship({ ref: 'InventoryItem' }),
    recipe: relationship({ ref: 'Recipe' }),
    quantity: decimal({ defaultValue: '0' }),
    unit: text({ defaultValue: 'g' }),
    optional: checkbox({ defaultValue: false }),
    notes: text({ ui: { displayMode: 'textarea' } }),
    metadata: json(),
    ...trackingFields,
  },
});
