"use server";

import { revalidatePath } from "next/cache";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { cafeRequest } from "./cafeRequest";

export type CafeCateringReceipt = {
  id: string;
  cateringNumber: string;
  status: string;
  eventAt?: string | null;
  guestCount: number;
  deliveryAddress?: string | null;
  quotedCents?: number | null;
  createdAt: string;
};

export type CateringRequestInput = {
  customerName: string;
  customerEmail: string;
  customerPhone?: string | null;
  eventAt: string;
  guestCount: number;
  deliveryAddress?: string | null;
  notes?: string | null;
  idempotencyKey: string;
};

const RECEIPT_FIELDS = "id cateringNumber status eventAt guestCount deliveryAddress quotedCents createdAt";

export async function requestCafeCatering(input: CateringRequestInput) {
  const response = await cafeRequest<{ requestCafeCatering: CafeCateringReceipt }>(`
    mutation RequestCafeCatering($customerName: String!, $customerEmail: String!, $customerPhone: String, $eventAt: String!, $guestCount: Int!, $deliveryAddress: String, $notes: String, $idempotencyKey: String!) {
      requestCafeCatering(customerName: $customerName, customerEmail: $customerEmail, customerPhone: $customerPhone, eventAt: $eventAt, guestCount: $guestCount, deliveryAddress: $deliveryAddress, notes: $notes, idempotencyKey: $idempotencyKey) { ${RECEIPT_FIELDS} }
    }
  `, {
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone || null,
    eventAt: input.eventAt,
    guestCount: input.guestCount,
    deliveryAddress: input.deliveryAddress || null,
    notes: input.notes || null,
    idempotencyKey: input.idempotencyKey,
  });
  if (!response.success) return { success: false as const, error: response.error, customerMessage: response.customerMessage };
  revalidatePath("/account");
  return { success: true as const, receipt: response.data.requestCafeCatering };
}

/** The signed-in customer's catering requests (newest event first, up to 20). Null when it can't be read. */
export async function getCustomerCatering(): Promise<CafeCateringReceipt[] | null> {
  const response = await keystoneClient<{ getCoffeeCustomerCatering: CafeCateringReceipt[] }>(
    `query CustomerCatering { getCoffeeCustomerCatering { ${RECEIPT_FIELDS} } }`, {}, { cache: "no-store" },
  );
  return response.success ? response.data.getCoffeeCustomerCatering : null;
}
