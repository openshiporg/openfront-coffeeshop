'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';

const UPDATE_MENU_ITEM_MUTATION = `
  mutation UpdateMenuItem($id: ID!, $data: MenuItemUpdateInput!) {
    updateMenuItem(where: { id: $id }, data: $data) {
      id
      name
      available
      featured
      popular
      price
    }
  }
`;

const UPDATE_MODIFIER_MUTATION = `
  mutation UpdateMenuItemModifier($id: ID!, $data: MenuItemModifierUpdateInput!) {
    updateMenuItemModifier(where: { id: $id }, data: $data) {
      id
      name
      inStock
      priceAdjustment
    }
  }
`;

const CREATE_MENU_ITEM_MUTATION = `
  mutation CreateMenuItem($data: MenuItemCreateInput!) {
    createMenuItem(data: $data) {
      id
      name
    }
  }
`;

export async function updateMenuItemFlagsAction(input: {
  id: string;
  available?: boolean;
  featured?: boolean;
  popular?: boolean;
}) {
  const { id, ...data } = input;
  const response = await keystoneClient(UPDATE_MENU_ITEM_MUTATION, { id, data }, { cache: 'no-store' });
  revalidateMenuPaths();
  return response;
}

export async function updateMenuItemPriceAction(id: string, price: number) {
  const response = await keystoneClient(UPDATE_MENU_ITEM_MUTATION, { id, data: { price } }, { cache: 'no-store' });
  revalidateMenuPaths();
  return response;
}

export async function updateModifierStockAction(id: string, inStock: boolean) {
  const response = await keystoneClient(UPDATE_MODIFIER_MUTATION, { id, data: { inStock } }, { cache: 'no-store' });
  revalidateMenuPaths();
  return response;
}

export async function createQuickMenuItemAction(input: {
  name: string;
  price: number;
  categoryId?: string;
  barStation?: string;
  shortDescription?: string;
}) {
  const response = await keystoneClient(
    CREATE_MENU_ITEM_MUTATION,
    {
      data: {
        name: input.name,
        price: input.price,
        shortDescription: input.shortDescription || '',
        available: true,
        prepTimeMinutes: 5,
        barStation: input.barStation || 'espresso_bar',
        temperatureOptions: ['hot'],
        serviceWindows: ['all_day'],
        category: input.categoryId ? { connect: { id: input.categoryId } } : undefined,
      },
    },
    { cache: 'no-store' }
  );
  revalidateMenuPaths();
  return response;
}

function revalidateMenuPaths() {
  revalidatePath('/');
  revalidatePath('/dashboard/platform/menu');
  revalidatePath('/dashboard/platform/pos');
  revalidatePath('/dashboard/platform/reports');
}
