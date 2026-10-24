"use server";

import { revalidatePath } from "next/cache";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { cafeRequest } from "@/features/storefront/lib/data/cafeRequest";
import type {
  PosCartItem,
  PosCashMovementRequest,
  PosCatalogPage,
  PosCloseShiftRequest,
  PosOpenShiftRequest,
  PosOrderQuote,
  PosOrderReceipt,
  PosRegisterData,
  PosSaleRequest,
  RegisterShiftSummary,
} from "../types";

const SHIFT_FIELDS = "id shiftNumber registerName status openingCashCents cashSalesCents cardSalesCents tipsCents payInsCents payOutsCents expectedCashCents openedAt";

const POS_REGISTER_QUERY = `
  query CoffeePosRegister($search: String, $categoryId: ID, $cursor: String) {
    getCoffeePosRegister(search: $search, categoryId: $categoryId, cursor: $cursor) {
      operatorId storeId hasMore nextCursor
      categories { id name }
      items {
        id name price availability maxQuantity category { id name }
        modifiers { id name modifierGroup modifierGroupLabel priceAdjustment defaultSelected inStock required minSelections maxSelections }
      }
      openShift { ${SHIFT_FIELDS} }
    }
  }
`;

function isPosRegisterData(value: unknown): value is PosRegisterData {
  if (!value || typeof value !== "object") return false;
  const data = value as Record<string, unknown>;
  return typeof data.operatorId === "string" && !!data.operatorId
    && typeof data.storeId === "string" && !!data.storeId
    && Array.isArray(data.items) && Array.isArray(data.categories) && typeof data.hasMore === "boolean"
    && (data.openShift === null || (typeof data.openShift === "object" && typeof (data.openShift as Record<string, unknown>).id === "string"));
}

export type PosRegisterLoad = { kind: "ready"; data: PosRegisterData } | { kind: "unavailable" };

/** Failed or malformed reads are never presented as an empty menu or a closed drawer. */
export async function loadPosRegister(input: { search?: string; categoryId?: string; cursor?: string | null } = {}): Promise<PosRegisterLoad> {
  try {
    const response = await keystoneClient<{ getCoffeePosRegister: unknown }>(POS_REGISTER_QUERY, {
      search: input.search || null,
      categoryId: input.categoryId || null,
      cursor: input.cursor || null,
    }, { cache: "no-store" });
    if (!response.success || !isPosRegisterData(response.data?.getCoffeePosRegister)) return { kind: "unavailable" };
    return { kind: "ready", data: response.data.getCoffeePosRegister };
  } catch {
    return { kind: "unavailable" };
  }
}

export async function loadPosCatalogAction(input: { search: string; categoryId: string; cursor?: string | null }): Promise<{ kind: "ready"; page: PosCatalogPage } | { kind: "unavailable" }> {
  const result = await loadPosRegister(input);
  if (result.kind !== "ready") return result;
  return { kind: "ready", page: { items: result.data.items, hasMore: result.data.hasMore, nextCursor: result.data.nextCursor } };
}

const POS_QUOTE_QUERY = `
  query QuotePosOrder($items: [CafePickupOrderItemInput!]!, $tipCents: Int) {
    quoteCafeOrder(items: $items, tipCents: $tipCents) {
      subtotal tax tip total currencyCode quoteFingerprint
      lines { index unitPrice lineTotal }
    }
  }
`;

const CREATE_POS_ORDER_MUTATION = `
  mutation CreateCafePickupOrder(
    $customerName: String!
    $specialInstructions: String
    $paymentMethod: String!
    $idempotencyKey: String!
    $registerShiftId: ID!
    $tipCents: Int!
    $quoteFingerprint: String!
    $externalCardReference: String
    $externalCardApproved: Boolean
    $cashTenderedCents: Int
    $items: [CafePickupOrderItemInput!]!
  ) {
    createCafePickupOrder(
      customerName: $customerName
      pickupName: $customerName
      specialInstructions: $specialInstructions
      paymentMethod: $paymentMethod
      orderSource: "pos"
      fulfillmentType: "counter"
      idempotencyKey: $idempotencyKey
      registerShiftId: $registerShiftId
      tipCents: $tipCents
      quoteFingerprint: $quoteFingerprint
      externalCardReference: $externalCardReference
      externalCardApproved: $externalCardApproved
      cashTenderedCents: $cashTenderedCents
      items: $items
    ) {
      id orderNumber status handoffCode total
    }
  }
`;

function lineInput(item: { menuItemId: string; quantity: number; modifierIds: string[]; notes?: string }) {
  return { menuItemId: item.menuItemId, quantity: item.quantity, modifierIds: item.modifierIds, specialInstructions: item.notes || undefined };
}

export async function quotePosOrderAction(items: PosCartItem[], tipCents: number) {
  if (!items.length) return { success: true as const, data: { quoteCafeOrder: null } };
  return keystoneClient<{ quoteCafeOrder: PosOrderQuote }>(POS_QUOTE_QUERY, { tipCents, items: items.map(lineInput) }, { cache: "no-store" });
}

export async function createPosOrderAction(input: PosSaleRequest & { idempotencyKey: string }) {
  // cafeRequest keeps a domain rejection's message (sold out, closed), which means nothing was recorded.
  const response = await cafeRequest<{ createCafePickupOrder: PosOrderReceipt }>(CREATE_POS_ORDER_MUTATION, {
    customerName: input.customerName || "Counter guest",
    specialInstructions: input.notes || undefined,
    paymentMethod: input.paymentMethod,
    idempotencyKey: input.idempotencyKey,
    registerShiftId: input.registerShiftId,
    tipCents: input.tipCents,
    quoteFingerprint: input.quoteFingerprint,
    externalCardReference: input.paymentMethod === "manual_card" ? input.externalCardReference : undefined,
    externalCardApproved: input.paymentMethod === "manual_card" ? input.externalCardApproved === true : undefined,
    cashTenderedCents: input.paymentMethod === "cash" && typeof input.cashTenderedCents === "number" ? input.cashTenderedCents : undefined,
    items: input.items.map(lineInput),
  });

  revalidatePath("/dashboard/platform/orders");
  revalidatePath("/dashboard/platform/pos");
  return response;
}

export async function openRegisterShiftAction(input: PosOpenShiftRequest & { idempotencyKey: string }) {
  const response = await keystoneClient<{ openRegisterShift: RegisterShiftSummary }>(`
    mutation OpenRegisterShift($registerName: String!, $openingCashCents: Int!, $idempotencyKey: String!) {
      openRegisterShift(registerName: $registerName, openingCashCents: $openingCashCents, idempotencyKey: $idempotencyKey) {
        ${SHIFT_FIELDS}
      }
    }
  `, input, { cache: "no-store" });
  revalidatePath("/dashboard/platform/pos");
  return response;
}

export async function recordRegisterCashMovementAction(input: PosCashMovementRequest & { idempotencyKey: string }) {
  const response = await keystoneClient<{ recordRegisterCashMovement: { id: string; movementNumber: string; type: string; amountCents: number } }>(`
    mutation RecordRegisterCashMovement($registerShiftId: ID!, $type: String!, $amountCents: Int!, $reason: String!, $idempotencyKey: String!) {
      recordRegisterCashMovement(registerShiftId: $registerShiftId, type: $type, amountCents: $amountCents, reason: $reason, idempotencyKey: $idempotencyKey) { id movementNumber type amountCents }
    }
  `, input, { cache: "no-store" });
  revalidatePath("/dashboard/platform/pos");
  return response;
}

export async function closeRegisterShiftAction(input: PosCloseShiftRequest & { idempotencyKey: string }) {
  const response = await keystoneClient<{ closeRegisterShift: RegisterShiftSummary }>(`
    mutation CloseRegisterShift($registerShiftId: ID!, $countedCashCents: Int!, $idempotencyKey: String!) {
      closeRegisterShift(registerShiftId: $registerShiftId, countedCashCents: $countedCashCents, idempotencyKey: $idempotencyKey) {
        id shiftNumber registerName status expectedCashCents countedCashCents cashVarianceCents
      }
    }
  `, input, { cache: "no-store" });
  revalidatePath("/dashboard/platform/pos");
  return response;
}
