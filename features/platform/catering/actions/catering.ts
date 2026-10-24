'use server';

import { revalidatePath } from "next/cache";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { cafeRequest } from "@/features/storefront/lib/data/cafeRequest";
import { CATERING_NEXT, eventFactsEditable, quoteEditable, type ActionResult, type CateringFactsInput } from "../lib/catering";
import { loadStoreRecord } from "../lib/store-context";
import { EMAIL_PATTERN, parseDollars, recordNumber, storeLocalToInstant } from "../lib/store-time";

const CREATE_CATERING = `
  mutation PlatformCreateCatering($data: CateringOrderCreateInput!) {
    createCateringOrder(data: $data) { id cateringNumber }
  }
`;
const UPDATE_CATERING = `
  mutation PlatformUpdateCatering($id: ID!, $data: CateringOrderUpdateInput!) {
    updateCateringOrder(where: { id: $id }, data: $data) { id }
  }
`;
const CATERING_STATE = `
  query PlatformCateringState($id: ID!) {
    cateringOrder(where: { id: $id }) { id status subtotalCents metadata }
  }
`;
const UPDATE_STATUS = `
  mutation PlatformCateringStatus($cateringOrderId: ID!, $status: String!) {
    updateCateringOrderStatus(cateringOrderId: $cateringOrderId, status: $status) { id status }
  }
`;

type CateringState = { id: string; status: string; subtotalCents: number | null; metadata: Record<string, unknown> | null };

function refresh(id?: string) {
  revalidatePath("/dashboard/platform/catering");
  if (id) revalidatePath(`/dashboard/platform/catering/${id}`);
}

async function readState(id: string): Promise<CateringState | null> {
  const response = await keystoneClient<{ cateringOrder: CateringState | null }>(CATERING_STATE, { id }, { cache: "no-store" });
  return response.success ? response.data.cateringOrder : null;
}

type Facts = { customerName: string; customerEmail: string; customerPhone: string; eventAt: string | null; guestCount: number; deliveryAddress: string };

function parseFacts(input: CateringFactsInput, timezone: string): { ok: true; facts: Facts } | { ok: false; error: string; field: string } {
  const customerName = input.customerName.trim();
  if (!customerName) return { ok: false, error: "Customer name is required.", field: "customerName" };
  if (customerName.length > 200) return { ok: false, error: "Customer name is too long.", field: "customerName" };
  const customerEmail = input.customerEmail.trim();
  if (customerEmail && !EMAIL_PATTERN.test(customerEmail)) return { ok: false, error: "Enter a valid email.", field: "customerEmail" };
  const customerPhone = input.customerPhone.trim().slice(0, 40);
  let eventAt: string | null = null;
  if (input.eventAtLocal.trim()) {
    const resolved = storeLocalToInstant(input.eventAtLocal, timezone);
    if (!resolved.ok) return { ok: false, error: resolved.error, field: "eventAt" };
    eventAt = resolved.iso;
  }
  const guestText = input.guestCount.trim();
  const guestCount = guestText ? Number(guestText) : 0;
  if (!/^\d{0,6}$/.test(guestText) || !Number.isInteger(guestCount) || guestCount < 0 || guestCount > 100_000) return { ok: false, error: "Guests must be a whole number.", field: "guestCount" };
  return { ok: true, facts: { customerName, customerEmail, customerPhone, eventAt, guestCount, deliveryAddress: input.deliveryAddress.trim().slice(0, 500) } };
}

export async function createCateringOrderAction(input: CateringFactsInput & { notes: string }): Promise<ActionResult & { id?: string }> {
  const store = await loadStoreRecord();
  const parsed = parseFacts(input, store.timezone);
  if (!parsed.ok) return { success: false, error: parsed.error, field: parsed.field };
  const { facts } = parsed;
  const response = await cafeRequest<{ createCateringOrder: { id: string } }>(CREATE_CATERING, {
    data: {
      cateringNumber: recordNumber("CAT", store.timezone),
      customerName: facts.customerName,
      customerEmail: facts.customerEmail,
      eventAt: facts.eventAt,
      guestCount: facts.guestCount,
      deliveryAddress: facts.deliveryAddress,
      notes: input.notes.trim().slice(0, 5000),
      metadata: { source: "staff", ...(facts.customerPhone ? { customerPhone: facts.customerPhone } : {}) },
    },
  });
  if (!response.success) return { success: false, error: response.error };
  refresh();
  return { success: true, id: response.data.createCateringOrder.id };
}

export async function updateCateringFactsAction(id: string, input: CateringFactsInput): Promise<ActionResult> {
  const [store, state] = await Promise.all([loadStoreRecord(), readState(id)]);
  if (!state) return { success: false, error: "Catering order not found." };
  if (!eventFactsEditable(state.status)) return { success: false, error: "Event details are locked once the order is confirmed." };
  const parsed = parseFacts(input, store.timezone);
  if (!parsed.ok) return { success: false, error: parsed.error, field: parsed.field };
  const { customerPhone, ...facts } = parsed.facts;
  const metadata: Record<string, unknown> = { ...(state.metadata && typeof state.metadata === "object" ? state.metadata : {}) };
  if (customerPhone) metadata.customerPhone = customerPhone;
  else delete metadata.customerPhone;
  const response = await cafeRequest(UPDATE_CATERING, { id, data: { ...facts, metadata } });
  if (!response.success) return { success: false, error: response.error };
  refresh(id);
  return { success: true };
}

export async function updateCateringQuoteAction(id: string, amount: string): Promise<ActionResult> {
  const parsed = parseDollars(amount);
  if (!parsed.ok) return { success: false, error: parsed.error, field: "subtotal" };
  const state = await readState(id);
  if (!state) return { success: false, error: "Catering order not found." };
  if (!quoteEditable(state.status)) return { success: false, error: "The quote is fixed once sent." };
  const response = await cafeRequest(UPDATE_CATERING, { id, data: { subtotalCents: parsed.cents } });
  if (!response.success) return { success: false, error: response.error };
  refresh(id);
  return { success: true };
}

export async function updateCateringNotesAction(id: string, notes: string): Promise<ActionResult> {
  if (notes.length > 5000) return { success: false, error: "Notes are too long.", field: "notes" };
  const response = await cafeRequest(UPDATE_CATERING, { id, data: { notes: notes.trim() } });
  if (!response.success) return { success: false, error: response.error };
  refresh(id);
  return { success: true };
}

export async function transitionCateringOrderAction(id: string, status: string): Promise<ActionResult> {
  const state = await readState(id);
  if (!state) return { success: false, error: "Catering order not found." };
  if (!(CATERING_NEXT[state.status] || []).includes(status as never)) return { success: false, error: "That change isn't allowed from the current status." };
  if (status === "quoted" && !((state.subtotalCents || 0) > 0)) return { success: false, error: "Set a quote amount before sending the quote." };
  const response = await cafeRequest(UPDATE_STATUS, { cateringOrderId: id, status });
  if (!response.success) return { success: false, error: response.error };
  refresh(id);
  return { success: true };
}
