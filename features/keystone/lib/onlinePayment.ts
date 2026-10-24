/** Online card payment is offered only when the merchant has installed the Stripe provider
 *  and the server holds its keys. Presence only; the values are never read out here. */
export function stripeKeysPresent(env: Record<string, string | undefined> = process.env) {
  return Boolean(env.STRIPE_SECRET_KEY?.trim() && env.STRIPE_WEBHOOK_SECRET?.trim());
}

type ProviderReader = { paymentProvider: { findUnique(args: Record<string, unknown>): Promise<{ isInstalled?: boolean | null } | null> } };

export async function onlinePaymentReady(prisma: ProviderReader) {
  if (!stripeKeysPresent()) return false;
  const provider = await prisma.paymentProvider.findUnique({ where: { code: "pp_stripe_stripe" }, select: { isInstalled: true } });
  return provider?.isInstalled === true;
}

/** The hosted page may only return to this site's receipt page. */
export function validPaymentReturnUrl(value: unknown) {
  if (typeof value !== "string" || value.length > 2000) return null;
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.pathname !== "/order-confirmed" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}
