import type { CreatePaymentInput, PaymentAdapterResult } from './index';

function missingConfig(): PaymentAdapterResult | null {
  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      success: false,
      provider: 'stripe',
      status: 'configuration_error',
      error: 'STRIPE_SECRET_KEY is not configured',
    };
  }
  return null;
}

export async function createPaymentFunction(input: CreatePaymentInput): Promise<PaymentAdapterResult> {
  const configError = missingConfig();
  if (configError) return configError;

  return {
    success: true,
    provider: 'stripe',
    providerPaymentId: `stripe_pending_${input.orderId}`,
    status: 'requires_confirmation',
    amount: input.amount,
    currencyCode: input.currencyCode,
    data: {
      mode: 'payment_intent_placeholder',
      publishableKeyRequired: true,
      note: 'Stripe adapter boundary is in place; wire SDK call here when live credentials are available.',
    },
  };
}

export async function capturePaymentFunction(input: { providerPaymentId: string; amount?: number }): Promise<PaymentAdapterResult> {
  const configError = missingConfig();
  if (configError) return configError;
  return { success: true, provider: 'stripe', providerPaymentId: input.providerPaymentId, status: 'captured', amount: input.amount };
}

export async function refundPaymentFunction(input: { providerPaymentId: string; amount?: number; reason?: string }): Promise<PaymentAdapterResult> {
  const configError = missingConfig();
  if (configError) return configError;
  return { success: true, provider: 'stripe', providerPaymentId: input.providerPaymentId, status: 'refunded', amount: input.amount, data: { reason: input.reason } };
}

export async function getPaymentStatusFunction(input: { providerPaymentId: string }): Promise<PaymentAdapterResult> {
  const configError = missingConfig();
  if (configError) return configError;
  return { success: true, provider: 'stripe', providerPaymentId: input.providerPaymentId, status: 'requires_confirmation' };
}

export async function generatePaymentLinkFunction(input: CreatePaymentInput): Promise<PaymentAdapterResult> {
  const configError = missingConfig();
  if (configError) return configError;
  return { success: true, provider: 'stripe', providerPaymentId: `stripe_link_${input.orderId}`, status: 'pending', amount: input.amount, data: { provider: 'stripe_checkout' } };
}

export async function handleWebhookFunction(input: { event: any; headers?: Record<string, any> }): Promise<PaymentAdapterResult> {
  const configError = missingConfig();
  if (configError) return configError;
  return { success: true, provider: 'stripe', status: 'received', data: { eventType: input.event?.type } };
}
