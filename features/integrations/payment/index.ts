export type PaymentProviderCode = 'manual' | 'cash' | 'stripe' | 'paypal';

export type CreatePaymentInput = {
  orderId: string;
  amount: number;
  currencyCode: string;
  customerEmail?: string | null;
  customerName?: string | null;
  metadata?: Record<string, any>;
};

export type PaymentAdapterResult = {
  success: boolean;
  provider: string;
  providerPaymentId?: string | null;
  status?: string;
  amount?: number;
  currencyCode?: string;
  data?: Record<string, any> | null;
  error?: string | null;
};

export type PaymentAdapterModule = {
  createPaymentFunction: (input: CreatePaymentInput) => Promise<PaymentAdapterResult>;
  capturePaymentFunction: (input: { providerPaymentId: string; amount?: number }) => Promise<PaymentAdapterResult>;
  refundPaymentFunction: (input: { providerPaymentId: string; amount?: number; reason?: string }) => Promise<PaymentAdapterResult>;
  getPaymentStatusFunction: (input: { providerPaymentId: string }) => Promise<PaymentAdapterResult>;
  generatePaymentLinkFunction?: (input: CreatePaymentInput) => Promise<PaymentAdapterResult>;
  handleWebhookFunction: (input: { event: any; headers?: Record<string, any> }) => Promise<PaymentAdapterResult>;
};

export const paymentProviderAdapters = {
  manual: () => import('./manual'),
  cash: () => import('./manual'),
  stripe: () => import('./stripe'),
  paypal: () => import('./paypal'),
};
