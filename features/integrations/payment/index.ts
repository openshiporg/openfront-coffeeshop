export const ONLINE_PAYMENT_PROVIDER_CODES = ["pp_stripe_stripe", "pp_paypal_paypal"] as const;
export const OFFLINE_PAYMENT_PROVIDER_CODE = "pp_system_default" as const;

export type PaymentProviderCode =
  | (typeof ONLINE_PAYMENT_PROVIDER_CODES)[number]
  | typeof OFFLINE_PAYMENT_PROVIDER_CODE;

export type PaymentAdapterData = Record<string, unknown>;

export type CreatePaymentInput = {
  orderId: string;
  paymentId?: string;
  idempotencyKey?: string | null;
  amount: number;
  currencyCode: string;
  customerEmail?: string | null;
  customerName?: string | null;
  metadata?: PaymentAdapterData;
  /** Absolute URL the hosted payment page returns to (the order receipt). */
  returnUrl?: string | null;
  /** Shown on the hosted payment page, e.g. "Order #CF-261024-1A2B3C4D". */
  description?: string | null;
};

export type CapturePaymentInput = {
  providerPaymentId: string;
  amount?: number;
};

export type RefundPaymentInput = CapturePaymentInput & {
  reason?: string;
  idempotencyKey?: string;
  currencyCode?: string;
};

export type PaymentStatusInput = {
  providerPaymentId: string;
};

export type PaymentWebhookInput = {
  rawBody: string;
  headers: Record<string, string>;
};

export type PaymentAdapterResult = {
  success: boolean;
  provider: PaymentProviderCode;
  providerPaymentId?: string | null;
  status?: string;
  amount?: number;
  currencyCode?: string;
  data?: PaymentAdapterData | null;
  error?: string | null;
};

export type VerifiedPaymentWebhook = {
  eventId: string;
  eventType: string;
  providerPaymentId: string;
  paymentId?: string | null;
  orderId?: string | null;
  status: "succeeded" | "failed" | "ignored";
  amount?: number | null;
  currencyCode?: string | null;
};

export type PaymentAdapterModule = {
  createPaymentFunction: (input: CreatePaymentInput) => Promise<PaymentAdapterResult>;
  capturePaymentFunction: (input: CapturePaymentInput) => Promise<PaymentAdapterResult>;
  refundPaymentFunction: (input: RefundPaymentInput) => Promise<PaymentAdapterResult>;
  getPaymentStatusFunction: (input: PaymentStatusInput) => Promise<PaymentAdapterResult>;
  generatePaymentLinkFunction?: (input: CreatePaymentInput) => Promise<PaymentAdapterResult>;
  handleWebhookFunction: (input: PaymentWebhookInput) => Promise<VerifiedPaymentWebhook>;
};

const paymentProviderAdapters = Object.freeze({
  pp_system_default: () => import("./manual"),
  pp_stripe_stripe: () => import("./stripe"),
  pp_paypal_paypal: () => import("./paypal"),
} satisfies Record<PaymentProviderCode, () => Promise<PaymentAdapterModule>>);

const PROVIDER_ALIASES: Readonly<Record<string, PaymentProviderCode>> = Object.freeze({
  manual: OFFLINE_PAYMENT_PROVIDER_CODE,
  cash: OFFLINE_PAYMENT_PROVIDER_CODE,
  pp_system_default: OFFLINE_PAYMENT_PROVIDER_CODE,
  stripe: "pp_stripe_stripe",
  pp_stripe_stripe: "pp_stripe_stripe",
  paypal: "pp_paypal_paypal",
  pp_paypal_paypal: "pp_paypal_paypal",
});

export function normalizePaymentProviderCode(value: string): PaymentProviderCode {
  const code = PROVIDER_ALIASES[value.trim().toLowerCase()];
  if (!code) throw new Error("Unsupported payment provider");
  return code;
}

export function isOnlinePaymentProviderCode(code: string): code is (typeof ONLINE_PAYMENT_PROVIDER_CODES)[number] {
  return (ONLINE_PAYMENT_PROVIDER_CODES as readonly string[]).includes(code);
}

export function assertCustomerPaymentProvider(code: PaymentProviderCode) {
  if (!isOnlinePaymentProviderCode(code)) {
    throw new Error("Manual/offline payments are operator-only and cannot settle public checkout");
  }
}

export function getPaymentProviderAdapter(code: PaymentProviderCode) {
  return paymentProviderAdapters[code]();
}

export { paymentProviderAdapters };
