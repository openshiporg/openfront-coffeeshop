import { createHmac, timingSafeEqual } from "node:crypto";

import type {
  CapturePaymentInput,
  CreatePaymentInput,
  PaymentAdapterResult,
  PaymentStatusInput,
  PaymentWebhookInput,
  RefundPaymentInput,
  VerifiedPaymentWebhook,
} from "./index";

const STRIPE_API = "https://api.stripe.com/v1";
const SIGNATURE_TOLERANCE_SECONDS = 300;

type StripeObject = Record<string, unknown> & {
  id?: string;
  amount?: number;
  amount_received?: number;
  amount_total?: number;
  currency?: string;
  payment_intent?: string;
  status?: string;
  payment_status?: string;
  url?: string;
  expires_at?: number;
  metadata?: Record<string, string>;
};

type StripeEvent = {
  id?: string;
  type?: string;
  data?: { object?: StripeObject };
};

function secretKey() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("Stripe is not configured");
  return secret;
}

async function stripeRequest(path: string, body?: URLSearchParams, idempotencyKey?: string | null) {
  const response = await fetch(`${STRIPE_API}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body,
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await response.json() as StripeObject & { error?: { message?: string } };
  if (!response.ok) throw new Error(payload.error?.message || "Stripe request failed");
  return payload;
}

function adapterResult(payload: StripeObject, fallbackAmount?: number): PaymentAdapterResult {
  return {
    success: true,
    provider: "pp_stripe_stripe",
    providerPaymentId: payload.id,
    status: payload.status,
    amount: payload.amount_received ?? payload.amount ?? fallbackAmount,
    currencyCode: payload.currency,
    data: payload,
  };
}

export async function createPaymentFunction(input: CreatePaymentInput): Promise<PaymentAdapterResult> {
  const body = new URLSearchParams({
    amount: String(input.amount),
    currency: input.currencyCode.toLowerCase(),
    "automatic_payment_methods[enabled]": "true",
    "metadata[orderId]": input.orderId,
    ...(input.paymentId ? { "metadata[paymentId]": input.paymentId } : {}),
    ...(input.customerEmail ? { receipt_email: input.customerEmail } : {}),
  });
  const payload = await stripeRequest("/payment_intents", body, input.idempotencyKey);
  return adapterResult(payload, input.amount);
}

export async function capturePaymentFunction(input: CapturePaymentInput): Promise<PaymentAdapterResult> {
  const payload = await stripeRequest(`/payment_intents/${encodeURIComponent(input.providerPaymentId)}/capture`, new URLSearchParams());
  return adapterResult(payload, input.amount);
}

export async function refundPaymentFunction(input: RefundPaymentInput): Promise<PaymentAdapterResult> {
  const payload = await stripeRequest("/refunds", new URLSearchParams({
    payment_intent: input.providerPaymentId,
    ...(input.amount == null ? {} : { amount: String(input.amount) }),
    ...(input.reason ? { "metadata[reason]": input.reason } : {}),
  }), input.idempotencyKey);
  return {
    ...adapterResult(payload, input.amount),
    status: payload.status === "succeeded" ? "refunded" : payload.status,
  };
}

export async function getPaymentStatusFunction(input: PaymentStatusInput): Promise<PaymentAdapterResult> {
  // Hosted Checkout sessions (cs_…) report open / complete / expired and carry the page URL.
  if (input.providerPaymentId.startsWith("cs_")) {
    const session = await stripeRequest(`/checkout/sessions/${encodeURIComponent(input.providerPaymentId)}`);
    return { ...adapterResult(session), amount: session.amount_total, data: { ...session, checkoutUrl: typeof session.url === "string" ? session.url : null } };
  }
  return adapterResult(await stripeRequest(`/payment_intents/${encodeURIComponent(input.providerPaymentId)}`));
}

function withParam(url: string, key: string, value: string) {
  const next = new URL(url);
  next.searchParams.set(key, value);
  return next.toString();
}

/** Closes a hosted Checkout page so it can no longer be paid (the cafe took payment another way). */
export async function expireCheckoutSessionFunction(input: PaymentStatusInput): Promise<PaymentAdapterResult> {
  const session = await stripeRequest(`/checkout/sessions/${encodeURIComponent(input.providerPaymentId)}/expire`, new URLSearchParams());
  return adapterResult(session);
}

/** A Stripe-hosted Checkout page for one order: card details never touch the cafe's servers,
 *  so no publishable key or client SDK is needed. The webhook settles the payment. */
export async function generatePaymentLinkFunction(input: CreatePaymentInput): Promise<PaymentAdapterResult> {
  if (!input.returnUrl) throw new Error("A return URL is required for hosted payment");
  const body = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": input.currencyCode.toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(input.amount),
    "line_items[0][price_data][product_data][name]": input.description || "Order",
    success_url: withParam(input.returnUrl, "payment", "done"),
    cancel_url: withParam(input.returnUrl, "payment", "cancelled"),
    client_reference_id: input.orderId,
    "metadata[orderId]": input.orderId,
    "payment_intent_data[metadata][orderId]": input.orderId,
    // Sessions expire after 30 minutes (Stripe's minimum), so an abandoned page can't be paid hours later.
    expires_at: String(Math.floor(Date.now() / 1000) + 30 * 60),
    ...(input.paymentId ? { "metadata[paymentId]": input.paymentId, "payment_intent_data[metadata][paymentId]": input.paymentId } : {}),
    ...(input.customerEmail ? { customer_email: input.customerEmail } : {}),
  });
  const session = await stripeRequest("/checkout/sessions", body, input.idempotencyKey);
  return {
    success: true,
    provider: "pp_stripe_stripe",
    providerPaymentId: session.id,
    status: "pending",
    amount: session.amount_total ?? input.amount,
    currencyCode: session.currency,
    data: { checkoutUrl: typeof session.url === "string" ? session.url : null, expiresAt: session.expires_at ?? null },
  };
}

function verifyStripeSignature(rawBody: string, signatureHeader: string) {
  const parts = signatureHeader.split(",").map((part) => part.trim().split("=", 2));
  const timestamp = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp || signatures.length === 0 || !/^\d+$/.test(timestamp)) {
    throw new Error("Invalid Stripe signature header");
  }
  if (Math.abs(Date.now() / 1000 - Number(timestamp)) > SIGNATURE_TOLERANCE_SECONDS) {
    throw new Error("Stale Stripe webhook signature");
  }

  const expected = createHmac("sha256", process.env.STRIPE_WEBHOOK_SECRET || "")
    .update(`${timestamp}.${rawBody}`)
    .digest();
  if (!process.env.STRIPE_WEBHOOK_SECRET) throw new Error("Stripe webhook is not configured");

  const valid = signatures.some((signature) => {
    if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
    const provided = Buffer.from(signature, "hex");
    return provided.length === expected.length && timingSafeEqual(provided, expected);
  });
  if (!valid) throw new Error("Invalid Stripe webhook signature");
}

export function classifyStripeEvent(type: string, object: StripeObject = {}): VerifiedPaymentWebhook["status"] {
  // A completed Checkout session is only money in hand once its payment_status is "paid";
  // delayed methods settle later with async_payment_succeeded.
  if (type === "checkout.session.completed") return object.payment_status === "paid" ? "succeeded" : "ignored";
  if (type === "payment_intent.succeeded" || type === "checkout.session.async_payment_succeeded") return "succeeded";
  if (type === "payment_intent.payment_failed" || type === "payment_intent.canceled" || type === "checkout.session.async_payment_failed" || type === "checkout.session.expired") return "failed";
  return "ignored";
}

export async function handleWebhookFunction(input: PaymentWebhookInput): Promise<VerifiedPaymentWebhook> {
  verifyStripeSignature(input.rawBody, input.headers["stripe-signature"] || "");
  const event = JSON.parse(input.rawBody) as StripeEvent;
  const object = event.data?.object || {};
  const eventId = String(event.id || "").trim();
  const eventType = String(event.type || "").trim();
  const providerPaymentId = String(object.payment_intent || object.id || "").trim();
  if (!eventId || !eventType || !providerPaymentId) throw new Error("Stripe webhook identity is incomplete");

  return {
    eventId,
    eventType,
    providerPaymentId,
    paymentId: object.metadata?.paymentId || null,
    orderId: object.metadata?.orderId || null,
    status: classifyStripeEvent(eventType, object),
    amount: object.amount_received ?? object.amount_total ?? object.amount ?? null,
    currencyCode: object.currency || null,
  };
}
