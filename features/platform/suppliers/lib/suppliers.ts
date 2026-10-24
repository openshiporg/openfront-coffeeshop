import type { StatusTone } from "@/features/platform/components/StatusTitle";
import type { InventoryListItem, InventoryLotRow, PurchaseOrderRow } from "@/features/platform/inventory/lib/types";

export const SUPPLIERS_PATH = "/dashboard/platform/suppliers";
export const SUPPLIER_PAGE_SIZE = 30;
export const SUPPLIER_PO_PAGE_SIZE = 25;

export const SUPPLIER_STATUSES = ["active", "paused", "archived"] as const;
export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number];
export const SUPPLIER_STATUS_FILTERS = ["all", ...SUPPLIER_STATUSES] as const;
export type SupplierStatusFilter = (typeof SUPPLIER_STATUS_FILTERS)[number];

export const SUPPLIER_STATUS: Record<SupplierStatus, { label: string; tone: StatusTone }> = {
  active: { label: "Active", tone: "green" },
  paused: { label: "Paused", tone: "amber" },
  archived: { label: "Archived", tone: "zinc" },
};

export function supplierStatus(value?: string | null) {
  return SUPPLIER_STATUS[(value as SupplierStatus) || "active"] ?? { label: value || "Unknown", tone: "zinc" as StatusTone };
}

export const PO_STATUS_FILTERS = ["all", "submitted", "received", "cancelled", "draft"] as const;
export type PoStatusFilter = (typeof PO_STATUS_FILTERS)[number];

export type SupplierListView = { search: string; status: SupplierStatusFilter; page: number };

export function supplierListHref(view: SupplierListView, updates: Partial<SupplierListView> = {}) {
  const merged = { ...view, ...updates };
  const params = new URLSearchParams();
  if (merged.search) params.set("search", merged.search);
  if (merged.status !== "all") params.set("status", merged.status);
  if (merged.page > 1) params.set("page", String(merged.page));
  const query = params.toString();
  return `${SUPPLIERS_PATH}${query ? `?${query}` : ""}`;
}

export type SupplierDetailView = { po: PoStatusFilter; poPage: number };

export function supplierDetailHref(id: string, view: SupplierDetailView, updates: Partial<SupplierDetailView> = {}) {
  const merged = { ...view, ...updates };
  const params = new URLSearchParams();
  if (merged.po !== "all") params.set("po", merged.po);
  if (merged.poPage > 1) params.set("poPage", String(merged.poPage));
  const query = params.toString();
  return `${SUPPLIERS_PATH}/${id}${query ? `?${query}` : ""}`;
}

export type SupplierInput = {
  id?: string | null;
  name: string;
  status: string;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  leadTimeDays: string;
  notes: string;
};

export type SupplierFieldErrors = Partial<Record<keyof SupplierInput, string>>;

export type SupplierData = {
  name: string;
  status: SupplierStatus;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  leadTimeDays: number;
  notes: string;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Adds https:// when the scheme is missing; null when it still isn't an http(s) URL with a host. */
export function normalizeWebsite(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed) return "";
  const candidate = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const url = new URL(candidate);
    if ((url.protocol !== "https:" && url.protocol !== "http:") || !url.hostname.includes(".")) return null;
    return candidate;
  } catch {
    return null;
  }
}

export function validateSupplierInput(input: SupplierInput): { data: SupplierData; errors: null } | { data: null; errors: SupplierFieldErrors } {
  const errors: SupplierFieldErrors = {};
  const name = input.name.trim();
  if (!name) errors.name = "Name is required.";
  else if (name.length > 200) errors.name = "200 characters max.";
  if (!(SUPPLIER_STATUSES as readonly string[]).includes(input.status)) errors.status = "Choose a status.";
  const contactName = input.contactName.trim();
  if (contactName.length > 200) errors.contactName = "200 characters max.";
  const email = input.email.trim();
  if (email && (!EMAIL_PATTERN.test(email) || email.length > 254)) errors.email = "Enter a valid email.";
  const phone = input.phone.trim();
  if (phone.length > 50) errors.phone = "50 characters max.";
  else if (phone && !/^\+?[0-9().\-\s]{3,}(\s*(x|ext\.?)\s*\d+)?$/i.test(phone)) errors.phone = "Enter a valid phone number.";
  const website = normalizeWebsite(input.website);
  if (website === null || website.length > 500) errors.website = "Enter a valid URL.";
  const leadText = input.leadTimeDays.trim() || "0";
  const leadTimeDays = /^\d{1,4}$/.test(leadText) ? Number(leadText) : NaN;
  if (!Number.isInteger(leadTimeDays) || leadTimeDays < 0) errors.leadTimeDays = "Whole days, 0 or more.";
  const notes = input.notes.trim();
  if (notes.length > 5000) errors.notes = "5000 characters max.";
  if (Object.keys(errors).length) return { data: null, errors };
  return {
    data: { name, status: input.status as SupplierStatus, contactName, email, phone, website: website!, leadTimeDays, notes },
    errors: null,
  };
}

export type SupplierRow = {
  id: string;
  name: string | null;
  status: string | null;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  leadTimeDays: number | null;
  notes: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

export type SupplierDetailPayload = {
  canManage: boolean;
  storeTimezone: string | null;
  supplier: SupplierRow | null;
  poCounts: Record<PoStatusFilter, number>;
  purchaseOrders: PurchaseOrderRow[];
  lots: InventoryLotRow[];
  lotsCount: number;
  items: InventoryListItem[];
  itemsCount: number;
};

