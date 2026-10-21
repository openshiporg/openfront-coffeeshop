export const KDS_ITEM_STATUSES = ["new", "queued", "preparing", "ready", "handed_off", "voided"] as const;

export type KdsItemStatus = (typeof KDS_ITEM_STATUSES)[number];
export type KdsOrderStatus = "in_bar_queue" | "preparing" | "ready" | "completed";

export const KDS_ITEM_TRANSITIONS: Record<KdsItemStatus, readonly KdsItemStatus[]> = {
  new: ["queued", "voided"],
  queued: ["preparing", "voided"],
  preparing: ["ready", "voided"],
  ready: ["handed_off", "voided"],
  handed_off: [],
  voided: [],
};

export function isKdsItemStatus(value: string): value is KdsItemStatus {
  return (KDS_ITEM_STATUSES as readonly string[]).includes(value);
}

export function evaluateKdsItemTransition(current: KdsItemStatus, next: KdsItemStatus) {
  if (current === next) return { replay: true } as const;
  if (!KDS_ITEM_TRANSITIONS[current].includes(next)) throw new Error(`Cannot transition KDS item from ${current} to ${next}`);
  return { replay: false } as const;
}

export function rollupCafeOrderStatus(statuses: readonly KdsItemStatus[]): KdsOrderStatus {
  const active = statuses.filter((status) => status !== "voided");
  if (active.length === 0) return "in_bar_queue";
  if (active.every((status) => status === "handed_off")) return "completed";
  if (active.every((status) => status === "ready" || status === "handed_off")) return "ready";
  if (active.some((status) => status === "preparing")) return "preparing";
  return "in_bar_queue";
}

export function advanceKdsOrderStatus(current: string, derived: KdsOrderStatus): KdsOrderStatus {
  const rank: Record<string, number> = { open: 0, accepted: 0, paid: 0, in_bar_queue: 1, preparing: 2, ready: 3, completed: 4 };
  return (rank[current] || 0) > rank[derived] ? current as KdsOrderStatus : derived;
}
