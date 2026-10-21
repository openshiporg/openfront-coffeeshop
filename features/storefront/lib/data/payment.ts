"use server";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

type CafePaymentSession = {
  success: boolean;
  paymentId?: string | null;
  provider?: string | null;
  providerPaymentId?: string | null;
  status?: string | null;
  amount?: number | null;
  error?: string | null;
};

const INITIATE_CAFE_PAYMENT_SESSION = `
  mutation InitiateCafePaymentSession($orderId: ID!, $secretKey: String, $paymentProvider: String!) {
    initiateCafePaymentSession(orderId: $orderId, secretKey: $secretKey, paymentProvider: $paymentProvider) {
      success
      paymentId
      provider
      providerPaymentId
      status
      amount
      error
    }
  }
`;

export async function initiateCafePaymentSession(orderId: string, secretKey: string | undefined, paymentProvider: string) {
  const response = await keystoneClient<{ initiateCafePaymentSession: CafePaymentSession }>(
    INITIATE_CAFE_PAYMENT_SESSION,
    { orderId, secretKey, paymentProvider },
    { cache: "no-store" }
  );

  if (!response.success) return { success: false as const, error: response.error };
  return { success: true as const, session: response.data.initiateCafePaymentSession };
}
