import { handlePaymentProviderWebhook } from "@/features/integrations/payment/webhook";

export async function POST(request: Request, { params }: { params: Promise<{ providerId: string }> }) {
  const { providerId } = await params;
  return handlePaymentProviderWebhook(request, providerId);
}
