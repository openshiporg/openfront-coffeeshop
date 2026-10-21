import type { PickupOrderRequest } from "@/features/storefront/lib/data/orders";

export const CHECKOUT_ATTEMPT_STORAGE_KEY = "openfront-coffee-checkout-attempt-v2";
const LEGACY_REQUEST_IDENTITY_STORAGE_KEY = "openfront-coffee-checkout-request-v1";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RECEIPT_KEY_PATTERN = /^[0-9a-f]{64}$/;

type SessionStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * One pickup request from this tab: its retry key, its receipt key, and the exact request body that was sent.
 * Kept in sessionStorage (this tab only) until the order is confirmed, so a reload can retry the same request.
 */
export type CheckoutAttempt = {
  version: 2;
  idempotencyKey: string;
  receiptKey: string;
  request: PickupOrderRequest;
  cartIds: string[];
  total: number;
  currencyCode: string;
  orderId?: string;
};

export class CheckoutAttemptStorageError extends Error {
  constructor() {
    super("Checkout request storage is unavailable");
    this.name = "CheckoutAttemptStorageError";
  }
}

function randomReceiptKey() {
  const bytes = new Uint8Array(32);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function isAttempt(value: unknown): value is CheckoutAttempt {
  if (!value || typeof value !== "object") return false;
  const attempt = value as Partial<CheckoutAttempt>;
  return attempt.version === 2
    && typeof attempt.idempotencyKey === "string" && UUID_PATTERN.test(attempt.idempotencyKey)
    && typeof attempt.receiptKey === "string" && RECEIPT_KEY_PATTERN.test(attempt.receiptKey)
    && Boolean(attempt.request) && typeof attempt.request === "object" && Array.isArray(attempt.request?.items)
    && Array.isArray(attempt.cartIds)
    && typeof attempt.total === "number" && typeof attempt.currencyCode === "string"
    && (attempt.orderId === undefined || typeof attempt.orderId === "string");
}

export function loadCheckoutAttempt(storage: SessionStorageLike): CheckoutAttempt | null {
  try {
    storage.removeItem(LEGACY_REQUEST_IDENTITY_STORAGE_KEY);
    const raw = storage.getItem(CHECKOUT_ATTEMPT_STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return isAttempt(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** Persists and verifies the attempt before anything is sent; throws when the tab cannot keep it. */
export function saveCheckoutAttempt(storage: SessionStorageLike, attempt: CheckoutAttempt) {
  try {
    const serialized = JSON.stringify(attempt);
    storage.setItem(CHECKOUT_ATTEMPT_STORAGE_KEY, serialized);
    if (storage.getItem(CHECKOUT_ATTEMPT_STORAGE_KEY) !== serialized) throw new Error();
  } catch {
    throw new CheckoutAttemptStorageError();
  }
}

export function createCheckoutAttempt(request: PickupOrderRequest, cartIds: string[], total: number, currencyCode: string): CheckoutAttempt {
  const idempotencyKey = window.crypto.randomUUID();
  if (!UUID_PATTERN.test(idempotencyKey)) throw new CheckoutAttemptStorageError();
  return { version: 2, idempotencyKey, receiptKey: randomReceiptKey(), request, cartIds, total, currencyCode };
}

export function clearCheckoutAttempt(storage: SessionStorageLike): boolean {
  try {
    storage.removeItem(CHECKOUT_ATTEMPT_STORAGE_KEY);
    return storage.getItem(CHECKOUT_ATTEMPT_STORAGE_KEY) === null;
  } catch {
    return false;
  }
}

export function receiptHref(orderId: string, receiptKey: string) {
  return `/order-confirmed?id=${encodeURIComponent(orderId)}&key=${encodeURIComponent(receiptKey)}`;
}
