"use server";

import { getBaseUrl } from "@/features/dashboard/lib/getBaseUrl";
import { cafeRequest } from "./cafeRequest";

export type GiftCardOptions = { online: boolean; amounts: number[]; currencyCode: string };
export type GiftCardOrder = { status: string; amount: number; currencyCode: string; recipientName?: string | null; recipientEmail?: string | null; code?: string | null; expiresAt?: string | null };
export type GiftCardPurchase = { amount: number; purchaserName: string; purchaserEmail: string; recipientName?: string; recipientEmail?: string; message?: string; idempotencyKey: string };

export async function getGiftCardOptions(): Promise<GiftCardOptions> {
  const response = await cafeRequest<{ getCafeGiftCardOptions: GiftCardOptions }>(`query { getCafeGiftCardOptions { online amounts currencyCode } }`, {});
  return response.success ? response.data.getCafeGiftCardOptions : { online: false, amounts: [], currencyCode: "USD" };
}

/** Opens Stripe's hosted page for a gift card and returns where to send the buyer. */
export async function startGiftCardCheckout(input: GiftCardPurchase) {
  const base = await getBaseUrl();
  if (!base) return { checkoutUrl: null, error: "Gift cards couldn't start. Try again." };
  const response = await cafeRequest<{ startCafeGiftCardCheckout: { checkoutUrl?: string | null } }>(`
    mutation StartGiftCard($amount: Int!, $purchaserName: String!, $purchaserEmail: String!, $recipientName: String, $recipientEmail: String, $message: String, $returnUrl: String!, $idempotencyKey: String!) {
      startCafeGiftCardCheckout(amount: $amount, purchaserName: $purchaserName, purchaserEmail: $purchaserEmail, recipientName: $recipientName, recipientEmail: $recipientEmail, message: $message, returnUrl: $returnUrl, idempotencyKey: $idempotencyKey) { checkoutUrl }
    }
  `, {
    amount: input.amount,
    purchaserName: input.purchaserName,
    purchaserEmail: input.purchaserEmail,
    recipientName: input.recipientName || null,
    recipientEmail: input.recipientEmail || null,
    message: input.message || null,
    returnUrl: new URL("/gift-cards", base).toString(),
    idempotencyKey: input.idempotencyKey,
  });
  if (!response.success) return { checkoutUrl: null, error: response.customerMessage || "Gift cards couldn't start. Try again." };
  const url = response.data.startCafeGiftCardCheckout.checkoutUrl;
  const checkoutUrl = url && /^https:\/\/checkout\.stripe\.com\//.test(url) ? url : null;
  return { checkoutUrl, error: checkoutUrl ? null : "Gift cards couldn't start. Try again." };
}

export async function confirmGiftCardOrder(giftCardId: string, token: string) {
  const response = await cafeRequest<{ confirmCafeGiftCardOrder: GiftCardOrder }>(`
    query ConfirmGiftCard($giftCardId: ID!, $token: String!) {
      confirmCafeGiftCardOrder(giftCardId: $giftCardId, token: $token) { status amount currencyCode recipientName recipientEmail code expiresAt }
    }
  `, { giftCardId, token });
  return response.success ? { order: response.data.confirmCafeGiftCardOrder, error: null } : { order: null, error: response.customerMessage || "We couldn't check this gift card yet." };
}
