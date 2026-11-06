'use server';

import { revalidatePath } from 'next/cache';
import { cafeRequest } from '@/features/storefront/lib/data/cafeRequest';

export async function refundGiftCardAction(giftCardId: string, reason: string) {
  const response = await cafeRequest(`
    mutation RefundCafeGiftCard($giftCardId: ID!, $reason: String) {
      refundCafeGiftCard(giftCardId: $giftCardId, reason: $reason) { id status balance }
    }
  `, { giftCardId, reason });
  revalidatePath('/dashboard/platform/gift-cards');
  return response;
}
