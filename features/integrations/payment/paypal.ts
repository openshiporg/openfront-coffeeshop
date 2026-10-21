import type {
  CapturePaymentInput,
  CreatePaymentInput,
  PaymentAdapterResult,
  PaymentStatusInput,
  PaymentWebhookInput,
  RefundPaymentInput,
  VerifiedPaymentWebhook,
} from "./index";

const PAYPAL_SANDBOX_API = "https://api-m.sandbox.paypal.com";
const PAYPAL_LIVE_API = "https://api-m.paypal.com";

type PayPalRecord = Record<string, unknown> & {
  id?: string;
  status?: string;
  custom_id?: string;
  invoice_id?: string;
  amount?: { value?: string; currency_code?: string };
  purchase_units?: Array<Record<string, unknown> & {
    custom_id?: string;
    invoice_id?: string;
    amount?: { value?: string; currency_code?: string };
  }>;
  supplementary_data?: { related_ids?: { order_id?: string } };
  links?: Array<{ rel?: string; href?: string }>;
};

type PayPalEvent = {
  id?: string;
  event_type?: string;
  resource?: PayPalRecord;
};

function apiBase() {
  return process.env.PAYPAL_ENVIRONMENT === "live" ? PAYPAL_LIVE_API : PAYPAL_SANDBOX_API;
}

function credentials() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("PayPal is not configured");
  return { clientId, clientSecret };
}

async function accessToken() {
  const { clientId, clientSecret } = credentials();
  const response = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await response.json() as { access_token?: string; error_description?: string };
  if (!response.ok || !payload.access_token) throw new Error(payload.error_description || "PayPal authentication failed");
  return payload.access_token;
}

async function paypalRequest(path: string, method = "GET", body?: unknown, idempotencyKey?: string | null) {
  const response = await fetch(`${apiBase()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
      ...(idempotencyKey ? { "PayPal-Request-Id": idempotencyKey } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await response.json() as PayPalRecord & { message?: string };
  if (!response.ok) throw new Error(payload.message || "PayPal request failed");
  return payload;
}

function formatAmount(amount: number) {
  return (amount / 100).toFixed(2);
}

function parseAmount(value?: string) {
  if (!value) return null;
  const amount = Math.round(Number(value) * 100);
  return Number.isSafeInteger(amount) ? amount : null;
}

function adapterResult(payload: PayPalRecord, fallbackAmount?: number): PaymentAdapterResult {
  return {
    success: true,
    provider: "pp_paypal_paypal",
    providerPaymentId: payload.id,
    status: payload.status?.toLowerCase(),
    amount: parseAmount(payload.amount?.value) ?? fallbackAmount,
    currencyCode: payload.amount?.currency_code,
    data: payload,
  };
}

export async function createPaymentFunction(input: CreatePaymentInput): Promise<PaymentAdapterResult> {
  const payload = await paypalRequest("/v2/checkout/orders", "POST", {
    intent: "CAPTURE",
    purchase_units: [{
      custom_id: input.orderId,
      invoice_id: input.paymentId,
      amount: {
        currency_code: input.currencyCode.toUpperCase(),
        value: formatAmount(input.amount),
      },
    }],
  }, input.idempotencyKey);
  return {
    ...adapterResult(payload, input.amount),
    data: {
      ...payload,
      checkoutUrl: payload.links?.find((link) => link.rel === "approve")?.href || null,
    },
  };
}

export async function capturePaymentFunction(input: CapturePaymentInput): Promise<PaymentAdapterResult> {
  const payload = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(input.providerPaymentId)}/capture`, "POST", {});
  return adapterResult(payload, input.amount);
}

export async function refundPaymentFunction(input: RefundPaymentInput): Promise<PaymentAdapterResult> {
  const payload = await paypalRequest(`/v2/payments/captures/${encodeURIComponent(input.providerPaymentId)}/refund`, "POST", {
    ...(input.amount == null ? {} : { amount: { value: formatAmount(input.amount), currency_code: (input.currencyCode || "USD").toUpperCase() } }),
    note_to_payer: input.reason,
  }, input.idempotencyKey);
  return { ...adapterResult(payload, input.amount), status: payload.status === "COMPLETED" ? "refunded" : payload.status?.toLowerCase() };
}

export async function getPaymentStatusFunction(input: PaymentStatusInput): Promise<PaymentAdapterResult> {
  return adapterResult(await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(input.providerPaymentId)}`));
}

export async function generatePaymentLinkFunction(input: CreatePaymentInput): Promise<PaymentAdapterResult> {
  return createPaymentFunction(input);
}

function classify(type: string): VerifiedPaymentWebhook["status"] {
  if (type === "PAYMENT.CAPTURE.COMPLETED") return "succeeded";
  if (type === "PAYMENT.CAPTURE.DENIED" || type === "PAYMENT.CAPTURE.DECLINED" || type === "CHECKOUT.PAYMENT-APPROVAL.REVERSED") return "failed";
  return "ignored";
}

export async function handleWebhookFunction(input: PaymentWebhookInput): Promise<VerifiedPaymentWebhook> {
  const event = JSON.parse(input.rawBody) as PayPalEvent;
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) throw new Error("PayPal webhook is not configured");

  const requiredHeaders = [
    "paypal-auth-algo",
    "paypal-cert-url",
    "paypal-transmission-id",
    "paypal-transmission-sig",
    "paypal-transmission-time",
  ] as const;
  if (requiredHeaders.some((header) => !input.headers[header])) throw new Error("PayPal signature headers are incomplete");

  const verification = await paypalRequest("/v1/notifications/verify-webhook-signature", "POST", {
    auth_algo: input.headers["paypal-auth-algo"],
    cert_url: input.headers["paypal-cert-url"],
    transmission_id: input.headers["paypal-transmission-id"],
    transmission_sig: input.headers["paypal-transmission-sig"],
    transmission_time: input.headers["paypal-transmission-time"],
    webhook_id: webhookId,
    webhook_event: event,
  });
  if (verification.verification_status !== "SUCCESS") throw new Error("Invalid PayPal webhook signature");

  const resource = event.resource || {};
  const unit = resource.purchase_units?.[0];
  const eventId = String(event.id || "").trim();
  const eventType = String(event.event_type || "").trim();
  const providerPaymentId = String(resource.supplementary_data?.related_ids?.order_id || resource.id || "").trim();
  if (!eventId || !eventType || !providerPaymentId) throw new Error("PayPal webhook identity is incomplete");

  return {
    eventId,
    eventType,
    providerPaymentId,
    paymentId: resource.invoice_id || unit?.invoice_id || null,
    orderId: resource.custom_id || unit?.custom_id || null,
    status: classify(eventType),
    amount: parseAmount(resource.amount?.value || unit?.amount?.value),
    currencyCode: resource.amount?.currency_code || unit?.amount?.currency_code || null,
  };
}
