'use server';

import { revalidatePath } from 'next/cache';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';

const APPLY_LOYALTY_MUTATION = `
  mutation ApplyCafeLoyalty(
    $orderId: ID!
    $customerEmail: String!
    $customerName: String
    $customerPhone: String
    $redeemDrinkCredit: Boolean
  ) {
    applyCafeLoyalty(
      orderId: $orderId
      customerEmail: $customerEmail
      customerName: $customerName
      customerPhone: $customerPhone
      redeemDrinkCredit: $redeemDrinkCredit
    ) {
      id
      customerName
      customerEmail
      pointsBalance
      lifetimePoints
      drinkCredits
      visits
    }
  }
`;

export async function applyCafeLoyaltyAction(input: {
  orderId: string;
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  redeemDrinkCredit?: boolean;
}) {
  const response = await keystoneClient(APPLY_LOYALTY_MUTATION, input, { cache: 'no-store' });
  revalidatePath('/dashboard/platform/orders');
  revalidatePath('/dashboard/platform/reports');
  revalidatePath('/dashboard/loyalty-accounts');
  return response;
}
