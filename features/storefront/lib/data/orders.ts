"use server";

import { cafeRequest } from "./cafeRequest";

export type PickupOrderItemInput = {
  menuItemId: string;
  quantity: number;
  modifierIds?: string[];
  specialInstructions?: string;
};

export type PickupOrderRequest = {
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  pickupName?: string;
  requestedPickupMinutes?: number;
  specialInstructions?: string;
  paymentMethod?: string;
  tipCents?: number;
  redeemDrinkCredit?: boolean;
  quoteFingerprint: string;
  items: PickupOrderItemInput[];
};

export type PickupOrderInput = PickupOrderRequest & {
  idempotencyKey: string;
  receiptKey: string;
};

export type CafeModifierSnapshot = {
  id: string;
  name: string;
  group: string;
  groupLabel: string;
  priceAdjustment: number;
};

export type CafeOrderItemSnapshot = {
  id: string;
  quantity: number;
  itemNameSnapshot?: string | null;
  imagePathSnapshot?: string | null;
  customizationsSummary?: string | null;
  modifierSnapshot?: CafeModifierSnapshot[] | null;
  specialInstructions?: string | null;
  price: number;
};

export type CafePickupOrder = {
  id: string;
  orderNumber: string;
  status: string;
  handoffCode?: string | null;
  pickupName?: string | null;
  promisedAt?: string | null;
  subtotal: number;
  tax: number;
  tip?: number;
  discount?: number;
  total: number;
  currencyCode: string;
  secretKey?: string | null;
  specialInstructions?: string | null;
  paidAt?: string | null;
  customerEmail?: string | null;
  rewardsLinked?: boolean;
  rewardsEligible?: boolean;
  orderItems?: CafeOrderItemSnapshot[];
};

export type CafeOrderQuote = {
  subtotal: number;
  tax: number;
  tip: number;
  discount: number;
  /** The signed-in customer's free drinks, and what one would take off this ticket. */
  drinkCredits: number;
  drinkCreditValue: number;
  total: number;
  currencyCode: string;
  quoteFingerprint: string;
  estimatedPickupMinutes: number;
  lines: Array<{ index: number; menuItemId: string; name: string; quantity: number; unitPrice: number; lineTotal: number }>;
};

const QUOTE_CAFE_ORDER_QUERY = `
  query QuoteCafeOrder($items: [CafePickupOrderItemInput!]!, $tipCents: Int, $requestedPickupMinutes: Int, $redeemDrinkCredit: Boolean) {
    quoteCafeOrder(items: $items, tipCents: $tipCents, requestedPickupMinutes: $requestedPickupMinutes, redeemDrinkCredit: $redeemDrinkCredit) {
      subtotal tax tip discount drinkCredits drinkCreditValue total currencyCode quoteFingerprint estimatedPickupMinutes
      lines { index menuItemId name quantity unitPrice lineTotal }
    }
  }
`;

const CREATE_PICKUP_ORDER_MUTATION = `
  mutation CreateCafePickupOrder(
    $idempotencyKey: String!
    $receiptKey: String!
    $quoteFingerprint: String!
    $customerName: String!
    $customerEmail: String
    $customerPhone: String
    $pickupName: String
    $requestedPickupMinutes: Int
    $specialInstructions: String
    $paymentMethod: String
    $tipCents: Int
    $redeemDrinkCredit: Boolean
    $items: [CafePickupOrderItemInput!]!
  ) {
    createCafePickupOrder(
      idempotencyKey: $idempotencyKey
      receiptKey: $receiptKey
      quoteFingerprint: $quoteFingerprint
      customerName: $customerName
      customerEmail: $customerEmail
      customerPhone: $customerPhone
      pickupName: $pickupName
      requestedPickupMinutes: $requestedPickupMinutes
      specialInstructions: $specialInstructions
      paymentMethod: $paymentMethod
      tipCents: $tipCents
      redeemDrinkCredit: $redeemDrinkCredit
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
      tip
      total
      currencyCode
      secretKey
      orderItems {
        id
        quantity
        itemNameSnapshot
        imagePathSnapshot
        customizationsSummary
        modifierSnapshot { id name group groupLabel priceAdjustment }
        specialInstructions
        price
      }
    }
  }
`;

export async function quoteCafePickupOrder(items: PickupOrderItemInput[], options: { requestedPickupMinutes?: number; tipCents?: number; redeemDrinkCredit?: boolean } = {}) {
  if (!items.length) return { success: true as const, quote: null };
  const response = await cafeRequest<{ quoteCafeOrder: CafeOrderQuote }>(QUOTE_CAFE_ORDER_QUERY, { items, tipCents: options.tipCents ?? 0, requestedPickupMinutes: options.requestedPickupMinutes ?? null, redeemDrinkCredit: options.redeemDrinkCredit || null });
  if (!response.success) return { success: false as const, error: response.error, customerMessage: response.customerMessage };
  return { success: true as const, quote: response.data.quoteCafeOrder };
}

export async function createCafePickupOrder(input: PickupOrderInput) {
  const response = await cafeRequest<{ createCafePickupOrder: CafePickupOrder }>(CREATE_PICKUP_ORDER_MUTATION, input);

  if (!response.success) {
    return { success: false as const, error: response.error, customerMessage: response.customerMessage };
  }

  return { success: true as const, order: response.data.createCafePickupOrder };
}
