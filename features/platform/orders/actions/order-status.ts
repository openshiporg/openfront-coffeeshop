'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';

const UPDATE_STATUS_MUTATION = `
  mutation UpdateCafeOrderStatus($orderId: ID!, $status: String!) {
    updateCafeOrderStatus(orderId: $orderId, status: $status) {
      id
      orderNumber
      status
      startedAt
      readyAt
      completedAt
      orderItems { id barStatus }
    }
  }
`;

export async function updateCafeOrderStatusAction(orderId: string, status: string) {
  const response = await keystoneClient(UPDATE_STATUS_MUTATION, { orderId, status }, { cache: 'no-store' });
  revalidatePath('/dashboard/platform/orders');
  revalidatePath('/dashboard/platform/pos');
  return response;
}
