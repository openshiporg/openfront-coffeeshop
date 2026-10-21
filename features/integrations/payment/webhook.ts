import "server-only";

import { keystoneContext } from "@/features/keystone/context";
import handleCafePaymentWebhook from "@/features/keystone/mutations/handleCafePaymentWebhook";
import { isOnlinePaymentProviderCode, normalizePaymentProviderCode } from "@/features/integrations/payment";

const MAX_WEBHOOK_BYTES = 1024 * 1024;
const SIGNATURE_HEADERS = [
  "stripe-signature",
  "paypal-auth-algo",
  "paypal-cert-url",
  "paypal-transmission-id",
  "paypal-transmission-sig",
  "paypal-transmission-time",
] as const;

const noStore = { "Cache-Control": "no-store" };

/** Reads at most `limit` bytes; null when the declared or streamed body is larger. */
async function readBoundedText(request: Request, limit: number): Promise<string | null> {
  const declared = request.headers.get("content-length");
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > limit)) return null;
  if (!request.body) return "";
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

/**
 * Provider webhook boundary: verifies the provider code and a bounded JSON body, then
 * hands the untouched raw body and signature headers to the `handleCafePaymentWebhook`
 * domain mutation in-process (as E-commerce does), which verifies the signature.
 */
export async function handlePaymentProviderWebhook(request: Request, requestedProviderCode: string) {
  let providerCode: string;
  try {
    providerCode = normalizePaymentProviderCode(requestedProviderCode);
  } catch {
    return Response.json({ success: false, error: "Webhook endpoint not found" }, { status: 404 });
  }
  if (!isOnlinePaymentProviderCode(providerCode)) {
    return Response.json({ success: false, error: "Webhook endpoint not found" }, { status: 404 });
  }

  const rawBody = await readBoundedText(request, MAX_WEBHOOK_BYTES);
  if (!rawBody) {
    return Response.json({ success: false, error: "Invalid webhook body" }, { status: 400 });
  }
  try {
    JSON.parse(rawBody);
  } catch {
    return Response.json({ success: false, error: "Invalid webhook body" }, { status: 400 });
  }

  const headers = Object.fromEntries(
    SIGNATURE_HEADERS.flatMap((name) => {
      const value = request.headers.get(name);
      return value ? [[name, value]] : [];
    }),
  );
  try {
    const result: unknown = await handleCafePaymentWebhook(null, { providerCode, rawBody, headers }, keystoneContext as never);
    return Response.json(result ?? { success: true }, { headers: noStore });
  } catch {
    return Response.json({ success: false, error: "Webhook rejected" }, { status: 400, headers: noStore });
  }
}
