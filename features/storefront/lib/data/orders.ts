"use server";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

export type PickupOrderItemInput = {
  menuItemId: string;
  quantity: number;
  modifierIds?: string[];
  specialInstructions?: string;
};

export type PickupOrderInput = {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  pickupName?: string;
  requestedPickupMinutes?: number;
  specialInstructions?: string;
  paymentMethod?: string;
  items: PickupOrderItemInput[];
};

const CREATE_PICKUP_ORDER_MUTATION = `
  mutation CreateCafePickupOrder(
    $customerName: String!
    $customerEmail: String
    $customerPhone: String
    $pickupName: String
    $requestedPickupMinutes: Int
    $specialInstructions: String
    $paymentMethod: String
    $items: [CafePickupOrderItemInput!]!
  ) {
    createCafePickupOrder(
      customerName: $customerName
      customerEmail: $customerEmail
      customerPhone: $customerPhone
      pickupName: $pickupName
      requestedPickupMinutes: $requestedPickupMinutes
      specialInstructions: $specialInstructions
      paymentMethod: $paymentMethod
      items: $items
    ) {
      id
      orderNumber
      status
      handoffCode
      pickupName
      promisedAt
      subtotal
      tax
      total
      secretKey
      orderItems {
        id
        quantity
        itemNameSnapshot
        customizationsSummary
        price
      }
    }
  }
`;

export async function createCafePickupOrder(input: PickupOrderInput) {
  const response = await keystoneClient<{ createCafePickupOrder: any }>(CREATE_PICKUP_ORDER_MUTATION, input, { cache: "no-store" });

  if (!response.success) {
    return { success: false as const, error: response.error };
  }

  return { success: true as const, order: response.data.createCafePickupOrder };
}
