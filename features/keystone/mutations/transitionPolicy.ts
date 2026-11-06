import { cafeCustomerError } from "../lib/cafeCustomerError";

export type TransitionMap = Readonly<Record<string, readonly string[]>>;

// "refunded" is only ever entered by refundCafePayment (settlement-controlled); the status mutation and the
// dashboard action list reject/hide it. A cancelled order can still be refunded when a hosted page was paid
// after the cancel (the webhook records the money and flags it for refund).
export const CAFE_ORDER_TRANSITIONS = {
  open: ["cancelled", "refunded"],
  accepted: ["in_bar_queue", "cancelled"],
  paid: ["in_bar_queue", "refunded"],
  in_bar_queue: ["preparing", "refunded"],
  preparing: ["ready", "refunded"],
  ready: ["completed", "refunded"],
  completed: ["refunded"],
  cancelled: ["refunded"],
  refunded: [],
} as const satisfies TransitionMap;

/** Payment rows. Only the webhook, the payment commands and the refund command write these. */
export const PAYMENT_TRANSITIONS = {
  pending: ["authorized", "captured", "failed", "cancelled"],
  authorized: ["captured", "failed", "cancelled"],
  // A hosted page that expired (failed) can still be paid a moment later: the money is recorded.
  failed: ["captured"],
  captured: ["refunded"],
  refunded: [],
  cancelled: [],
} as const satisfies TransitionMap;

export const PURCHASE_ORDER_TRANSITIONS = {
  draft: ["submitted", "cancelled"],
  submitted: ["received", "cancelled"],
  received: [],
  cancelled: [],
} as const satisfies TransitionMap;

/** Staff can reactivate a closed account (the dashboard offers it); nothing else is reachable. */
export const LOYALTY_ACCOUNT_TRANSITIONS = {
  active: ["paused", "closed"],
  paused: ["active", "closed"],
  closed: ["active"],
} as const satisfies TransitionMap;

export const CATERING_ORDER_TRANSITIONS = {
  inquiry: ["quoted", "cancelled"],
  quoted: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
} as const satisfies TransitionMap;

export const SUBSCRIPTION_TRANSITIONS = {
  trialing: ["active", "cancelled"],
  active: ["paused", "cancelled"],
  paused: ["active", "cancelled"],
  cancelled: [],
} as const satisfies TransitionMap;

export const POS_ORDER_TRANSITIONS = {
  open: ["paid", "voided"],
  paid: ["refunded"],
  voided: [],
  refunded: [],
} as const satisfies TransitionMap;

export function evaluateTransition(
  transitions: TransitionMap,
  currentStatus: string,
  nextStatus: string,
): { replay: boolean } {
  if (currentStatus === nextStatus) return { replay: true };

  const allowed = transitions[currentStatus];
  if (!allowed?.includes(nextStatus)) {
    // Staff-facing and safe to show: the record changed or the action isn't allowed from this state.
    throw cafeCustomerError(`Can't change from ${currentStatus.replaceAll("_", " ")} to ${nextStatus.replaceAll("_", " ")}. Refresh to see the current status.`);
  }

  return { replay: false };
}

export function canTransition(transitions: TransitionMap, currentStatus: string, nextStatus: string) {
  return currentStatus === nextStatus || Boolean(transitions[currentStatus]?.includes(nextStatus));
}
