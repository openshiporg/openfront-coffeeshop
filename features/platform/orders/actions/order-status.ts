'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { cafeRequest } from '@/features/storefront/lib/data/cafeRequest';

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
  const response = await cafeRequest(UPDATE_STATUS_MUTATION, { orderId, status });
  revalidatePath('/dashboard/platform/orders');
  revalidatePath('/dashboard/platform/pos');
  return response;
}

export async function acceptCafePickupOrderAction(orderId: string, idempotencyKey: string) {
  const response = await cafeRequest(`
    mutation AcceptCafePickupOrder($orderId: ID!, $idempotencyKey: String!) {
      acceptCafePickupOrder(orderId: $orderId, idempotencyKey: $idempotencyKey) { id orderNumber status }
    }
  `, { orderId, idempotencyKey });
  revalidatePath('/dashboard/platform/orders');
  revalidatePath('/dashboard/platform/kds');
  return response;
}

export async function recordCafePaymentAction(
  orderId: string,
  method: 'cash' | 'card',
  idempotencyKey: string,
  card?: { externalCardReference: string; externalCardApproved: boolean },
) {
  const response = await cafeRequest(`
    mutation RecordCafePayment($orderId: ID!, $method: String!, $idempotencyKey: String!, $externalCardReference: String, $externalCardApproved: Boolean) {
      recordCafePayment(orderId: $orderId, method: $method, idempotencyKey: $idempotencyKey, externalCardReference: $externalCardReference, externalCardApproved: $externalCardApproved) {
        id status method amount order { id status }
      }
    }
  `, {
    orderId,
    method,
    idempotencyKey,
    externalCardReference: method === 'card' ? card?.externalCardReference ?? null : null,
    externalCardApproved: method === 'card' ? card?.externalCardApproved ?? null : null,
  });
  revalidatePath('/dashboard/platform/orders');
  revalidatePath('/dashboard/platform/kds');
  revalidatePath('/dashboard/platform/reports');
  return response;
}

export async function applyOrderLoyaltyAction(orderId: string, customerEmail: string, customerName?: string | null) {
  const response = await keystoneClient(`
    mutation ApplyCafeLoyalty($orderId: ID!, $customerEmail: String!, $customerName: String) {
      applyCafeLoyalty(orderId: $orderId, customerEmail: $customerEmail, customerName: $customerName, redeemDrinkCredit: false) { id pointsBalance visits tier }
    }
  `, { orderId, customerEmail, customerName: customerName || null }, { cache: 'no-store' });
  revalidatePath('/dashboard/platform/orders');
  revalidatePath('/dashboard/platform/reports');
  return response;
}

export async function refundCafePaymentAction(paymentId: string, idempotencyKey: string, externalRefundReference?: string) {
  const response = await keystoneClient(`
    mutation RefundCafePayment($paymentId: ID!, $idempotencyKey: String!, $externalRefundReference: String) {
      refundCafePayment(paymentId: $paymentId, idempotencyKey: $idempotencyKey, externalRefundReference: $externalRefundReference) {
        id status amount refundedAmount refundedAt order { id status }
      }
    }
  `, { paymentId, idempotencyKey, externalRefundReference: externalRefundReference || null }, { cache: 'no-store' });
  revalidatePath('/dashboard/platform/orders');
  revalidatePath('/dashboard/platform/pos');
  revalidatePath('/dashboard/platform/reports');
  return response;
}
