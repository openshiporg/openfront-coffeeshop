import { cafeCustomerError } from "../lib/cafeCustomerError";

export type TransitionMap = Readonly<Record<string, readonly string[]>>;

export const CAFE_ORDER_TRANSITIONS = {
  open: ["cancelled"],
  accepted: ["in_bar_queue", "cancelled"],
  paid: ["in_bar_queue"],
  in_bar_queue: ["preparing"],
  preparing: ["ready"],
  ready: ["completed"],
  completed: [],
  cancelled: [],
  refunded: [],
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
