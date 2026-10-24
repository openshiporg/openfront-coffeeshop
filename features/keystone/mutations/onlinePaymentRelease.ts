import { cafeCustomerError } from "../lib/cafeCustomerError";

type PaymentRow = { id: string; status: string | null; provider: string | null; providerPaymentId: string | null };
type Client = {
  payment: {
    findMany(args: Record<string, unknown>): Promise<PaymentRow[]>;
    update(args: Record<string, unknown>): Promise<unknown>;
  };
};

/** Before staff take payment at the counter or cancel, any hosted card page the customer opened
 *  but didn't finish is closed and marked failed, so it can't be paid as well. A page that has
 *  just been paid stops the action until the payment is recorded. */
export async function releaseAbandonedOnlinePayments(prisma: Client, orderId: string) {
  const pending = await prisma.payment.findMany({
    where: { orderId, provider: "pp_stripe_stripe", status: { in: ["pending", "authorized"] } },
    select: { id: true, status: true, provider: true, providerPaymentId: true },
  });
  if (!pending.length) return;
  const stripe = await import("../../integrations/payment/stripe");
  for (const payment of pending) {
    const sessionId = String(payment.providerPaymentId || "");
    if (sessionId.startsWith("cs_")) {
      const state = await stripe.getPaymentStatusFunction({ providerPaymentId: sessionId });
      if (state.status === "complete") throw cafeCustomerError("The customer just paid online. Refresh in a moment.");
      if (state.status === "open") await stripe.expireCheckoutSessionFunction({ providerPaymentId: sessionId });
    }
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "failed", failureMessage: "Online payment page closed; paid another way" } });
  }
}
