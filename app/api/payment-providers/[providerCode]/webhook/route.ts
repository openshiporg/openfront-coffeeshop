import { handlePaymentProviderWebhook } from "@/features/integrations/payment/webhook";

export async function POST(request: Request, { params }: { params: Promise<{ providerCode: string }> }) {
  const { providerCode } = await params;
  return handlePaymentProviderWebhook(request, providerCode);
}
