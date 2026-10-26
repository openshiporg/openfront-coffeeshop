import type { StatusTone } from "@/features/platform/components/StatusTitle";
import { addToDate } from "@/features/platform/catering/lib/store-time";

export const SUBSCRIPTION_STATUSES = ["trialing", "active", "paused", "cancelled"] as const;
/** "current" (the default view): paused first as billing on hold, then live subscriptions by next renewal. */
export const SUBSCRIPTION_FILTERS = ["current", ...SUBSCRIPTION_STATUSES, "all"] as const;
export type SubscriptionFilter = (typeof SUBSCRIPTION_FILTERS)[number];
export const SUBSCRIPTION_PAGE_SIZE = 25;

export const BILLING_INTERVALS = ["weekly", "monthly"] as const;
export type BillingInterval = (typeof BILLING_INTERVALS)[number];
export const INTERVAL_LABELS: Record<string, string> = { weekly: "Weekly", monthly: "Monthly" };
export const PER_INTERVAL: Record<string, string> = { weekly: "week", monthly: "month" };

export const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = { trialing: "Trialing", active: "Active", paused: "Paused", cancelled: "Cancelled" };
export const SUBSCRIPTION_STATUS_TONES: Record<string, StatusTone> = { trialing: "blue", active: "emerald", paused: "amber", cancelled: "red" };

/** Mirrors SUBSCRIPTION_TRANSITIONS; the command is the authority. */
export const SUBSCRIPTION_NEXT: Record<string, string[]> = {
  trialing: ["active", "cancelled"],
  active: ["paused", "cancelled"],
  paused: ["active", "cancelled"],
  cancelled: [],
};

export function transitionLabel(from: string, to: string) {
  if (to === "active") return from === "paused" ? "Resume" : "Activate";
  if (to === "paused") return "Pause";
  if (to === "cancelled") return "Cancel subscription";
  return to;
}

export type LoyaltyAccountOption = { id: string; displayName: string | null; customerEmail: string | null };

export type SubscriptionRecord = {
  id: string;
  subscriptionNumber: string;
  status: string;
  planName: string | null;
  billingInterval: string | null;
  priceCents: number | null;
  startsAt: string | null;
  renewsAt: string | null;
  cancelledAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  loyaltyAccount: LoyaltyAccountOption | null;
};

export type SubscriptionInput = {
  loyaltyAccountId: string;
  planName: string;
  billingInterval: string;
  price: string;
  startsOn: string;
  renewsOn: string;
};

export type SubscriptionActionResult = { success: true; id?: string } | { success: false; error: string; field?: keyof SubscriptionInput };

export function defaultRenewal(startsOn: string, interval: string) {
  if (!startsOn) return "";
  return interval === "weekly" ? addToDate(startsOn, { days: 7 }) : addToDate(startsOn, { months: 1 });
}

export function subscriptionListHref(view: { search?: string; status?: SubscriptionFilter; page?: number }) {
  const params = new URLSearchParams();
  if (view.search) params.set("search", view.search);
  if (view.status && view.status !== "current") params.set("status", view.status);
  if (view.page && view.page > 1) params.set("page", String(view.page));
  const query = params.toString();
  return `/dashboard/platform/subscriptions${query ? `?${query}` : ""}`;
}
