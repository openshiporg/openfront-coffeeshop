import type { CafePickupOrder } from "./data/orders";

export type OrderConfirmationResult =
  | { kind: "found"; order: CafePickupOrder }
  | { kind: "not-found" }
  | { kind: "unavailable" }
  | { kind: "incomplete-link" };

export type CustomerOrderStatusCopy = {
  label: string;
  message: string;
  showPickupEstimate: boolean;
};

const CUSTOMER_ORDER_STATUS_COPY: Readonly<Record<string, CustomerOrderStatusCopy>> = {
  open: {
    label: "Pickup request received",
    message: "The cafe has received this request; it is waiting for acceptance.",
    showPickupEstimate: true,
  },
  accepted: {
    label: "Accepted",
    message: "The cafe accepted this pickup request. Acceptance does not indicate payment.",
    showPickupEstimate: true,
  },
  paid: {
    label: "Paid",
    message: "This order is marked Paid in the cafe order record.",
    showPickupEstimate: true,
  },
  in_bar_queue: {
    label: "In bar queue",
    message: "This order is waiting in the bar queue.",
    showPickupEstimate: true,
  },
  preparing: {
    label: "Preparing",
    message: "The cafe has marked this order as being prepared.",
    showPickupEstimate: true,
  },
  ready: {
    label: "Ready for pickup",
    message: "The cafe has marked this order ready for pickup.",
    showPickupEstimate: true,
  },
  completed: {
    label: "Completed",
    message: "This order is marked completed.",
    showPickupEstimate: false,
  },
  cancelled: {
    label: "Cancelled",
    message: "This order is marked cancelled. Contact the cafe if you need help.",
    showPickupEstimate: false,
  },
  refunded: {
    label: "Refunded",
    message: "This order is marked refunded. This page cannot verify when or how any funds were returned.",
    showPickupEstimate: false,
  },
};

export const UNKNOWN_CUSTOMER_ORDER_STATUS: CustomerOrderStatusCopy = {
  label: "Status unavailable",
  message: "This order has an unrecognized status. Its current fulfillment cannot be verified here; contact the cafe before relying on pickup timing.",
  showPickupEstimate: false,
};

export function getCustomerOrderStatusCopy(status: string): CustomerOrderStatusCopy {
  return CUSTOMER_ORDER_STATUS_COPY[status] || UNKNOWN_CUSTOMER_ORDER_STATUS;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isOrderItem(value: unknown): boolean {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || !Number.isSafeInteger(value.quantity) || !Number.isFinite(value.price)) return false;
  if (!isNullableString(value.itemNameSnapshot) || !isNullableString(value.imagePathSnapshot) || !isNullableString(value.customizationsSummary) || !isNullableString(value.specialInstructions)) return false;
  if (!Array.isArray(value.modifierSnapshot)) return false;
  return value.modifierSnapshot.every((modifier) =>
    isRecord(modifier) &&
    typeof modifier.id === "string" &&
    typeof modifier.name === "string" &&
    typeof modifier.group === "string" &&
    typeof modifier.groupLabel === "string" &&
    Number.isFinite(modifier.priceAdjustment),
  );
}

function isCafePickupOrder(value: unknown): value is CafePickupOrder {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || !value.id || typeof value.orderNumber !== "string" || !value.orderNumber) return false;
  if (typeof value.status !== "string" || !value.status.trim()) return false;
  if (!Number.isFinite(value.subtotal) || !Number.isFinite(value.tax) || !Number.isFinite(value.total)) return false;
  if (value.tip !== undefined && value.tip !== null && !Number.isFinite(value.tip)) return false;
  if (!isNullableString(value.handoffCode) || !isNullableString(value.pickupName) || !isNullableString(value.promisedAt)) return false;
  if (typeof value.currencyCode !== "string" || !/^[A-Z]{3}$/.test(value.currencyCode)) return false;
  return Array.isArray(value.orderItems) && value.orderItems.every(isOrderItem);
}

export function resolveOrderConfirmation(orderId: string | undefined, response: unknown): OrderConfirmationResult {
  if (!orderId?.trim()) return { kind: "incomplete-link" };
  if (!isRecord(response) || response.success !== true || !isRecord(response.data)) return { kind: "unavailable" };
  if (!Object.hasOwn(response.data, "getCafeOrder")) return { kind: "unavailable" };
  if (response.data.getCafeOrder === null) return { kind: "not-found" };
  if (!isCafePickupOrder(response.data.getCafeOrder)) return { kind: "unavailable" };
  return { kind: "found", order: response.data.getCafeOrder };
}

export function getOrderConfirmationFailureCopy(kind: Exclude<OrderConfirmationResult["kind"], "found">) {
  switch (kind) {
    case "incomplete-link":
      return {
        title: "Confirmation link incomplete",
        message: "This link is missing its order ID, so no order was checked. Check the original link or contact the cafe.",
      };
    case "not-found":
      return {
        title: "Order not verified",
        message: "We couldn’t verify an order with these link details. Check the link or contact the cafe.",
      };
    case "unavailable":
      return {
        title: "Order status unavailable",
        message: "We couldn’t load this order right now. Try again in a moment, or contact the cafe.",
      };
  }
}
