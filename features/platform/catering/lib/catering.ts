import type { StatusTone } from "@/features/platform/components/StatusTitle";

export const CATERING_STATUSES = ["inquiry", "quoted", "confirmed", "completed", "cancelled"] as const;
export type CateringStatus = (typeof CATERING_STATUSES)[number];
export const OPEN_CATERING_STATUSES: CateringStatus[] = ["inquiry", "quoted", "confirmed"];

export const CATERING_FILTERS = ["upcoming", ...CATERING_STATUSES, "all"] as const;
export type CateringFilter = (typeof CATERING_FILTERS)[number];

export const CATERING_PAGE_SIZE = 25;

export const CATERING_STATUS_LABELS: Record<string, string> = {
  inquiry: "Inquiry", quoted: "Quoted", confirmed: "Confirmed", completed: "Completed", cancelled: "Cancelled",
};
export const CATERING_STATUS_TONES: Record<string, StatusTone> = {
  inquiry: "blue", quoted: "amber", confirmed: "emerald", completed: "zinc", cancelled: "red",
};

/** Mirrors CATERING_ORDER_TRANSITIONS; the command is the authority. */
export const CATERING_NEXT: Record<string, CateringStatus[]> = {
  inquiry: ["quoted", "cancelled"],
  quoted: ["confirmed", "cancelled"],
  confirmed: ["completed", "cancelled"],
  completed: [],
  cancelled: [],
};
export const CATERING_TRANSITION_LABELS: Record<string, string> = {
  quoted: "Send quote", confirmed: "Confirm", completed: "Complete", cancelled: "Cancel",
};

export const eventFactsEditable = (status: string) => status === "inquiry" || status === "quoted";
export const quoteEditable = (status: string) => status === "inquiry";

export type CateringOrderRecord = {
  id: string;
  cateringNumber: string;
  customerName: string | null;
  customerEmail: string | null;
  status: string;
  eventAt: string | null;
  guestCount: number | null;
  deliveryAddress: string | null;
  subtotalCents: number | null;
  notes: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type StoreContext = { timezone: string; currencyCode: string };

export type ActionResult = { success: true } | { success: false; error: string; field?: string };

export type CateringFactsInput = {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  eventAtLocal: string;
  guestCount: string;
  deliveryAddress: string;
};

export function cateringSource(metadata: Record<string, unknown> | null | undefined) {
  const source = metadata && typeof metadata.source === "string" ? metadata.source : "";
  if (source === "storefront") return "Online";
  if (source === "staff") return "Staff";
  return source ? source.charAt(0).toUpperCase() + source.slice(1) : null;
}

export function customerPhone(metadata: Record<string, unknown> | null | undefined) {
  return metadata && typeof metadata.customerPhone === "string" && metadata.customerPhone ? metadata.customerPhone : null;
}

export function cateringListHref(view: { search?: string; status?: CateringFilter; page?: number }) {
  const params = new URLSearchParams();
  if (view.search) params.set("search", view.search);
  if (view.status && view.status !== "upcoming") params.set("status", view.status);
  if (view.page && view.page > 1) params.set("page", String(view.page));
  const query = params.toString();
  return `/dashboard/platform/catering${query ? `?${query}` : ""}`;
}
