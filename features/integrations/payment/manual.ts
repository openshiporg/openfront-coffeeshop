import { randomUUID } from "node:crypto";

import type {
  CapturePaymentInput,
  CreatePaymentInput,
  PaymentAdapterResult,
  PaymentStatusInput,
  PaymentWebhookInput,
  RefundPaymentInput,
  VerifiedPaymentWebhook,
} from "./index";

export async function createPaymentFunction(input: CreatePaymentInput): Promise<PaymentAdapterResult> {
  return {
    success: true,
    provider: "pp_system_default",
    providerPaymentId: `manual_${randomUUID()}`,
    status: "pending",
    amount: input.amount,
    currencyCode: input.currencyCode,
    data: { message: "Offline payment remains pending until an authorized operator records settlement." },
  };
}

export async function capturePaymentFunction(input: CapturePaymentInput): Promise<PaymentAdapterResult> {
  return { success: true, provider: "pp_system_default", providerPaymentId: input.providerPaymentId, status: "captured", amount: input.amount };
}

export async function refundPaymentFunction(input: RefundPaymentInput): Promise<PaymentAdapterResult> {
  return {
    success: true,
    provider: "pp_system_default",
    providerPaymentId: input.providerPaymentId,
    status: "refunded",
    amount: input.amount,
    data: { reason: input.reason || "operator_refund", boundary: "Cafe cash-ledger refund only. External card refunds require separately recorded terminal evidence." },
  };
}

export async function getPaymentStatusFunction(input: PaymentStatusInput): Promise<PaymentAdapterResult> {
  return { success: true, provider: "pp_system_default", providerPaymentId: input.providerPaymentId, status: "pending" };
}

export async function generatePaymentLinkFunction(input: CreatePaymentInput): Promise<PaymentAdapterResult> {
  return createPaymentFunction(input);
}

export async function handleWebhookFunction(input: PaymentWebhookInput): Promise<VerifiedPaymentWebhook> {
  void input;
  throw new Error("Manual/offline payments do not accept webhooks");
}
