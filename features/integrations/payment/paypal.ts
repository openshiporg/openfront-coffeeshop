import type { CreatePaymentInput, PaymentAdapterResult } from './index';

function missingConfig(): PaymentAdapterResult | null {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    return {
      success: false,
      provider: 'paypal',
      status: 'configuration_error',
      error: 'PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are not configured',
    };
  }
  return null;
}

export async function createPaymentFunction(input: CreatePaymentInput): Promise<PaymentAdapterResult> {
  const configError = missingConfig();
  if (configError) return configError;
  return {
    success: true,
    provider: 'paypal',
    providerPaymentId: `paypal_pending_${input.orderId}`,
    status: 'created',
    amount: input.amount,
    currencyCode: input.currencyCode,
    data: { mode: 'order_placeholder', note: 'PayPal adapter boundary is in place for live SDK wiring.' },
  };
}

export async function capturePaymentFunction(input: { providerPaymentId: string; amount?: number }): Promise<PaymentAdapterResult> {
  const configError = missingConfig();
  if (configError) return configError;
  return { success: true, provider: 'paypal', providerPaymentId: input.providerPaymentId, status: 'captured', amount: input.amount };
}

export async function refundPaymentFunction(input: { providerPaymentId: string; amount?: number; reason?: string }): Promise<PaymentAdapterResult> {
  const configError = missingConfig();
  if (configError) return configError;
  return { success: true, provider: 'paypal', providerPaymentId: input.providerPaymentId, status: 'refunded', amount: input.amount, data: { reason: input.reason } };
}

export async function getPaymentStatusFunction(input: { providerPaymentId: string }): Promise<PaymentAdapterResult> {
  const configError = missingConfig();
  if (configError) return configError;
  return { success: true, provider: 'paypal', providerPaymentId: input.providerPaymentId, status: 'created' };
}

export async function generatePaymentLinkFunction(input: CreatePaymentInput): Promise<PaymentAdapterResult> {
  const configError = missingConfig();
  if (configError) return configError;
  return { success: true, provider: 'paypal', providerPaymentId: `paypal_link_${input.orderId}`, status: 'pending', amount: input.amount, data: { provider: 'paypal_checkout' } };
}

export async function handleWebhookFunction(input: { event: any; headers?: Record<string, any> }): Promise<PaymentAdapterResult> {
  const configError = missingConfig();
  if (configError) return configError;
  return { success: true, provider: 'paypal', status: 'received', data: { eventType: input.event?.event_type } };
}
