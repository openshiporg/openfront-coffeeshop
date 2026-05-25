type AdapterFunctionName =
  | "createPaymentFunction"
  | "capturePaymentFunction"
  | "refundPaymentFunction"
  | "getPaymentStatusFunction"
  | "generatePaymentLinkFunction"
  | "handleWebhookFunction";

type ProviderRecord = {
  code: string;
  createPaymentFunction?: string | null;
  capturePaymentFunction?: string | null;
  refundPaymentFunction?: string | null;
  getPaymentStatusFunction?: string | null;
  generatePaymentLinkFunction?: string | null;
  handleWebhookFunction?: string | null;
};

export async function executePaymentProviderAdapter({
  provider,
  functionName,
  args,
}: {
  provider: ProviderRecord;
  functionName: AdapterFunctionName;
  args: any;
}) {
  const functionPath = provider[functionName];

  if (!functionPath) {
    return {
      success: false,
      provider: provider.code,
      status: "adapter_error",
      error: `Payment provider ${provider.code} does not define ${functionName}`,
    };
  }

  if (functionPath.startsWith("http")) {
    const response = await fetch(functionPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, ...args }),
    });

    if (!response.ok) {
      return {
        success: false,
        provider: provider.code,
        status: "adapter_error",
        error: `HTTP request failed: ${response.statusText}`,
      };
    }

    return response.json();
  }

  try {
    const adapter = await import(`../../integrations/payment/${functionPath}.ts`);
    const fn = adapter[functionName];

    if (typeof fn !== "function") {
      return {
        success: false,
        provider: provider.code,
        status: "adapter_error",
        error: `Function ${functionName} not found in adapter ${functionPath}`,
      };
    }

    return await fn(args);
  } catch (error) {
    return {
      success: false,
      provider: provider.code,
      status: "adapter_error",
      error: error instanceof Error ? error.message : "Unknown payment adapter error",
    };
  }
}
