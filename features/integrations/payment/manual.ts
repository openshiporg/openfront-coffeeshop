import type { CreatePaymentInput, PaymentAdapterResult } from './index';

function id(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export async function createPaymentFunction(input: CreatePaymentInput): Promise<PaymentAdapterResult> {
  return {
    success: true,
    provider: 'manual',
    providerPaymentId: id('manual'),
    status: 'pending',
    amount: input.amount,
    currencyCode: input.currencyCode,
    data: {
      paymentMode: 'manual',
      message: 'Manual payment requires operator confirmation. Replace with a configured provider for live charging.',
    },
  };
}

export async function capturePaymentFunction(input: { providerPaymentId: string; amount?: number }): Promise<PaymentAdapterResult> {
  return { success: true, provider: 'manual', providerPaymentId: input.providerPaymentId, status: 'captured', amount: input.amount };
}

export async function refundPaymentFunction(input: { providerPaymentId: string; amount?: number; reason?: string }): Promise<PaymentAdapterResult> {
  return {
    success: true,
    provider: 'manual',
    providerPaymentId: input.providerPaymentId,
    status: 'refunded',
    amount: input.amount,
    data: { reason: input.reason || 'manual_refund' },
  };
}

export async function getPaymentStatusFunction(input: { providerPaymentId: string }): Promise<PaymentAdapterResult> {
  return { success: true, provider: 'manual', providerPaymentId: input.providerPaymentId, status: 'captured' };
}

export async function generatePaymentLinkFunction(input: CreatePaymentInput): Promise<PaymentAdapterResult> {
  return {
    success: true,
    provider: 'manual',
    providerPaymentId: id('manual_link'),
    status: 'pending',
    amount: input.amount,
    currencyCode: input.currencyCode,
    data: { url: `/checkout/manual?orderId=${input.orderId}` },
  };
}

export async function handleWebhookFunction(input: { event: any; headers?: Record<string, any> }): Promise<PaymentAdapterResult> {
  return { success: true, provider: 'manual', status: 'received', data: { event: input.event } };
}
