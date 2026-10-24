import type { StatusTone } from "@/features/platform/components/StatusTitle";

export const LOYALTY_PAGE_SIZE = 25;
export const LOYALTY_DETAIL_PAGE_SIZE = 25;

export const LOYALTY_STATUS_FILTERS = ["active", "paused", "closed", "all"] as const;
export type LoyaltyStatusFilter = (typeof LOYALTY_STATUS_FILTERS)[number];
export type LoyaltyStatus = Exclude<LoyaltyStatusFilter, "all">;

export const LOYALTY_TIERS = ["regular", "neighborhood", "house_account"] as const;
export type LoyaltyTier = (typeof LOYALTY_TIERS)[number];
export type LoyaltyTierFilter = LoyaltyTier | "all";

export const LOYALTY_SORTS = ["last_visit", "lifetime_points"] as const;
export type LoyaltySort = (typeof LOYALTY_SORTS)[number];

export const LOYALTY_STATUS_LABELS: Record<string, string> = { active: "Active", paused: "Paused", closed: "Closed" };
export const LOYALTY_STATUS_TONES: Record<string, StatusTone> = { active: "green", paused: "amber", closed: "zinc" };
export const LOYALTY_TIER_LABELS: Record<string, string> = { regular: "Regular", neighborhood: "Neighborhood", house_account: "House account" };
export const LOYALTY_EVENT_LABELS: Record<string, string> = {
  earned: "Earned",
  redeemed: "Redeemed",
  manual_adjustment: "Adjustment",
  refund_reversal: "Refund reversal",
  signup: "Signup",
};
export const SORT_LABELS: Record<LoyaltySort, string> = { last_visit: "Last visit", lifetime_points: "Lifetime points" };

export type LoyaltyListView = { search: string; status: LoyaltyStatusFilter; tier: LoyaltyTierFilter; sort: LoyaltySort; page: number };

type Param = string | string[] | undefined;

function single(value: Param) {
  return typeof value === "string" ? value : "";
}

export function parsePage(value: Param) {
  const page = Number.parseInt(single(value), 10);
  return Number.isSafeInteger(page) && page > 1 ? Math.min(page, 10_000) : 1;
}

function oneOf<T extends string>(value: string, options: readonly T[], fallback: T): T {
  return (options as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function parseLoyaltyListView(params: Record<string, Param>): LoyaltyListView {
  return {
    search: single(params.search).trim().slice(0, 120),
    status: oneOf(single(params.status), LOYALTY_STATUS_FILTERS, "active"),
    tier: oneOf<LoyaltyTierFilter>(single(params.tier), [...LOYALTY_TIERS, "all"], "all"),
    sort: oneOf(single(params.sort), LOYALTY_SORTS, "last_visit"),
    page: parsePage(params.page),
  };
}

export function loyaltyListHref(view: LoyaltyListView) {
  const params = new URLSearchParams();
  if (view.search) params.set("search", view.search);
  if (view.status !== "active") params.set("status", view.status);
  if (view.tier !== "all") params.set("tier", view.tier);
  if (view.sort !== "last_visit") params.set("sort", view.sort);
  if (view.page > 1) params.set("page", String(view.page));
  const query = params.toString();
  return `/dashboard/platform/loyalty${query ? `?${query}` : ""}`;
}

/** Keystone where-input for the list (status excluded so tab counts can share it). */
export function loyaltyBaseWhere(view: Pick<LoyaltyListView, "search" | "tier">) {
  const and: Record<string, unknown>[] = [];
  if (view.search) {
    and.push({
      OR: [
        { customerName: { contains: view.search, mode: "insensitive" } },
        { customerEmail: { contains: view.search, mode: "insensitive" } },
      ],
    });
  }
  if (view.tier !== "all") and.push({ tier: { equals: view.tier } });
  return { AND: and };
}

export function loyaltyOrderBy(sort: LoyaltySort) {
  return sort === "lifetime_points"
    ? [{ lifetimePoints: "desc" }, { createdAt: "desc" }]
    : [{ lastVisitAt: "desc" }, { createdAt: "desc" }];
}

export type AdjustmentPreview = { ok: true; pointsBalance: number; drinkCredits: number } | { ok: false; message: string };

/** Mirrors the server plan: 100 points roll into one drink credit; balances can't go negative. */
export function previewLoyaltyAdjustment(account: { pointsBalance?: number | null; drinkCredits?: number | null }, pointsDelta: number, drinkCreditsDelta: number): AdjustmentPreview {
  const points = Number(account.pointsBalance || 0) + pointsDelta;
  if (points < 0) return { ok: false, message: "That would take points below zero" };
  const credits = Number(account.drinkCredits || 0) + drinkCreditsDelta + Math.floor(points / 100);
  if (credits < 0) return { ok: false, message: "That would take drink credits below zero" };
  return { ok: true, pointsBalance: points % 100, drinkCredits: credits };
}

/** "", "12", "-5", "+3" → integer; anything else → null. Empty is 0. */
export function parseSignedWhole(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  if (!/^[+-]?\d{1,6}$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return Math.abs(parsed) <= 100_000 ? parsed : null;
}

export function formatSigned(value?: number | null) {
  const amount = Number(value || 0);
  if (!amount) return "0";
  return amount > 0 ? `+${amount}` : `−${Math.abs(amount)}`;
}

export function formatMoney(cents?: number | null, currency = "USD") {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(cents || 0) / 100);
  } catch {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(Number(cents || 0) / 100);
  }
}
