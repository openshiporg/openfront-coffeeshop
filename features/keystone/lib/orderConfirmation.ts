// One confirmation email per order, sent after the order transaction has committed.
// CoffeeDomainEvent is append-only (database trigger), so two rows are written, never updated:
//   order:{id}:confirmation_email:v1         the claim; its unique eventKey is the dedupe record
//   order:{id}:confirmation_email_result:v1  the outcome (sent | failed | skipped_*) in its payload
// They are written directly (no outbox delivery), so no consumer ever picks them up.

type Send = (order: any) => Promise<{ sent: boolean; error?: string; messageId?: string }>;

export function orderConfirmationConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.SMTP_STORE_LINK);
}

export async function deliverOrderConfirmation(prisma: any, order: any, send?: Send) {
  try {
    if (!order?.customerEmail) return;
    const eventKey = `order:${order.id}:confirmation_email:v1`;
    try {
      await prisma.coffeeDomainEvent.create({
        data: { eventKey, eventType: "order.confirmation_email", aggregateType: "order", aggregateId: order.id, storeId: order.storeId, payload: { status: "claimed" }, payloadHash: eventKey },
        select: { id: true },
      });
    } catch (error) {
      if ((error as { code?: string })?.code === "P2002") return; // already claimed: replay or concurrent completion
      throw error;
    }
    const resultKey = `order:${order.id}:confirmation_email_result:v1`;
    const mark = (status: string, error?: string, messageId?: string) => prisma.coffeeDomainEvent.create({
      data: { eventKey: resultKey, eventType: "order.confirmation_email_result", aggregateType: "order", aggregateId: order.id, storeId: order.storeId, payload: { status, ...(messageId ? { messageId: messageId.slice(0, 200) } : {}), ...(error ? { error: error.slice(0, 200) } : {}) }, payloadHash: `${resultKey}:${status}` },
    });
    try {
      if (!orderConfirmationConfigured()) { await mark("skipped_not_configured"); return; }
      const zone = order.store?.timezone || "UTC";
      const currency = order.currencyCode || "USD";
      const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format((cents || 0) / 100);
      const whenLabel = order.promisedAt
        ? `Pickup around ${new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(order.promisedAt))}`
        : "We will have it ready shortly";
      // Loaded lazily so the mail module never joins the keystone import graph at build time.
      const deliver = send || (await import("./orderMail")).sendOrderConfirmationEmail;
      const result = await deliver({
        to: order.customerEmail, storeName: order.store?.name || "Our cafe", orderNumber: order.orderNumber, name: order.customerName || "there", whenLabel,
        lines: (order.orderItems || []).map((line: any) => ({ title: line.itemNameSnapshot, quantity: line.quantity, total: money((line.price || 0) * (line.quantity || 1)) })),
        total: money(order.total),
        link: `${String(process.env.SMTP_STORE_LINK).replace(/\/$/, "")}/order-confirmed?id=${encodeURIComponent(order.id)}&key=${encodeURIComponent(order.secretKey)}`,
      });
      await (result.sent ? mark("sent", undefined, result.messageId) : mark("failed", result.error || "send_failed"));
    } catch (error) {
      try { await mark("failed", error instanceof Error ? error.message : "send_failed"); } catch { /* the order is committed; bookkeeping must never surface */ }
    }
  } catch (error) {
    console.error("Order confirmation email bookkeeping failed:", error instanceof Error ? error.message : "unknown");
  }
}
