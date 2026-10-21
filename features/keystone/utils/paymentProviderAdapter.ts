import {
  getPaymentProviderAdapter,
  normalizePaymentProviderCode,
  type CapturePaymentInput,
  type CreatePaymentInput,
  type PaymentAdapterResult,
  type PaymentProviderCode,
  type PaymentStatusInput,
  type PaymentWebhookInput,
  type RefundPaymentInput,
  type VerifiedPaymentWebhook,
} from "../../integrations/payment";

type AdapterInputMap = {
  createPaymentFunction: CreatePaymentInput;
  capturePaymentFunction: CapturePaymentInput;
  refundPaymentFunction: RefundPaymentInput;
  getPaymentStatusFunction: PaymentStatusInput;
  generatePaymentLinkFunction: CreatePaymentInput;
  handleWebhookFunction: PaymentWebhookInput;
};
type AdapterOutputMap = {
  createPaymentFunction: PaymentAdapterResult;
  capturePaymentFunction: PaymentAdapterResult;
  refundPaymentFunction: PaymentAdapterResult;
  getPaymentStatusFunction: PaymentAdapterResult;
  generatePaymentLinkFunction: PaymentAdapterResult;
  handleWebhookFunction: VerifiedPaymentWebhook;
};
type AdapterFunctionName = keyof AdapterInputMap;
type ProviderRecord = { code: string };

export function getStaticPaymentProviderCode(provider: ProviderRecord): PaymentProviderCode {
  const code = normalizePaymentProviderCode(provider.code);
  if (code !== provider.code) throw new Error(`Payment provider record must use canonical code ${code}`);
  return code;
}

export async function executePaymentProviderAdapter<K extends AdapterFunctionName>({
  provider,
  functionName,
  args,
}: {
  provider: ProviderRecord;
  functionName: K;
  args: AdapterInputMap[K];
}): Promise<AdapterOutputMap[K]> {
  const code = getStaticPaymentProviderCode(provider);
  const adapter = await getPaymentProviderAdapter(code);
  const fn = adapter[functionName];
  if (typeof fn !== "function") throw new Error(`Payment provider ${code} does not support ${functionName}`);
  const callable = fn as (input: unknown) => Promise<unknown>;
  return await callable(args) as AdapterOutputMap[K];
}
