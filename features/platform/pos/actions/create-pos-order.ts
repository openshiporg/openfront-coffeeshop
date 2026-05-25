'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import type { PosCartItem } from '../components/PosRegister';

const CREATE_POS_ORDER_MUTATION = `
  mutation CreateCafePickupOrder(
    $customerName: String!
    $pickupName: String
    $specialInstructions: String
    $paymentMethod: String
    $orderSource: String
    $fulfillmentType: String
    $items: [CafePickupOrderItemInput!]!
  ) {
    createCafePickupOrder(
      customerName: $customerName
      pickupName: $pickupName
      specialInstructions: $specialInstructions
      paymentMethod: $paymentMethod
      orderSource: $orderSource
      fulfillmentType: $fulfillmentType
      items: $items
    ) {
      id
      orderNumber
      status
      handoffCode
      total
    }
  }
`;

export async function createPosOrderAction(input: {
  customerName: string;
  notes?: string;
  paymentMethod: 'cash' | 'manual_card';
  items: PosCartItem[];
}) {
  const response = await keystoneClient<{ createCafePickupOrder: any }>(
    CREATE_POS_ORDER_MUTATION,
    {
      customerName: input.customerName || 'Counter guest',
      pickupName: input.customerName || 'Counter guest',
      specialInstructions: input.notes || undefined,
      paymentMethod: input.paymentMethod,
      orderSource: 'pos',
      fulfillmentType: 'counter',
      items: input.items.map((item) => ({
        menuItemId: item.menuItemId,
        quantity: item.quantity,
        modifierIds: item.modifierIds,
        specialInstructions: item.notes || undefined,
      })),
    },
    { cache: 'no-store' }
  );

  revalidatePath('/dashboard/platform/orders');
  revalidatePath('/dashboard/platform/pos');
  return response;
}
