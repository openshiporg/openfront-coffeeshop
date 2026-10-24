"use server";

import { getBaseUrl } from "@/features/dashboard/lib/getBaseUrl";
import { cafeRequest } from "./cafeRequest";

const INITIATE_CAFE_PAYMENT_SESSION = `
  mutation InitiateCafePaymentSession($orderId: ID!, $secretKey: String, $paymentProvider: String!, $idempotencyKey: String, $returnUrl: String) {
    initiateCafePaymentSession(orderId: $orderId, secretKey: $secretKey, paymentProvider: $paymentProvider, idempotencyKey: $idempotencyKey, returnUrl: $returnUrl) {
      success
      paymentId
      status
      checkoutUrl
    }
  }
`;

/** Starts (or resumes) the card payment page for an order and returns where to send the customer. */
export async function startOnlinePayment(orderId: string, receiptKey: string | undefined, idempotencyKey: string) {
  const base = await getBaseUrl();
  if (!base) return { checkoutUrl: null, error: "Online payment couldn't start. Try again or pay at pickup." };
  const returnUrl = new URL("/order-confirmed", base);
  returnUrl.searchParams.set("id", orderId);
  if (receiptKey) returnUrl.searchParams.set("key", receiptKey);
  const response = await cafeRequest<{ initiateCafePaymentSession: { success: boolean; status?: string | null; checkoutUrl?: string | null } | null }>(
    INITIATE_CAFE_PAYMENT_SESSION,
    { orderId, secretKey: receiptKey || null, paymentProvider: "stripe", idempotencyKey, returnUrl: returnUrl.toString() },
  );
  if (!response.success) return { checkoutUrl: null, error: response.customerMessage || "Online payment couldn't start. Try again or pay at pickup." };
  const session = response.data.initiateCafePaymentSession;
  if (session?.status === "processing") return { checkoutUrl: null, error: null, processing: true };
  const checkoutUrl = session?.checkoutUrl && /^https:\/\/checkout\.stripe\.com\//.test(session.checkoutUrl) ? session.checkoutUrl : null;
  return { checkoutUrl, error: checkoutUrl ? null : "Online payment couldn't start. Try again or pay at pickup." };
}
