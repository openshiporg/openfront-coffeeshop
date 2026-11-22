/**
 * The storefront order confirmation email. createCafePickupOrder calls this once, only when its
 * transaction created the order (a replay of the same request never sends it again). It never
 * throws: the order is committed and the receipt page is the record; email is a courtesy.
 */
type ConfirmedOrder = {
  id: string;
  orderNumber: string;
  customerName?: string | null;
  customerEmail?: string | null;
  pickupName?: string | null;
  promisedAt?: string | Date | null;
  subtotal: number;
  tax: number;
  tip?: number | null;
  discount?: number | null;
  total: number;
  currencyCode?: string | null;
  secretKey?: string | null;
  store?: { name?: string | null; timezone?: string | null } | null;
  orderItems?: Array<{ itemNameSnapshot?: string | null; quantity: number; price: number; customizationsSummary?: string | null }> | null;
};

export async function sendOrderConfirmation(order: ConfirmedOrder) {
  try {
    if (!order?.customerEmail || !order.secretKey) return;
    // Loaded lazily so the mail module never joins the keystone import graph at build time.
    const { mailConfigured, sendOrderConfirmationEmail, storeLink } = await import("./orderMail");
    if (!mailConfigured() || !storeLink()) return;
    const zone = order.store?.timezone || "UTC";
    const currency = order.currencyCode || "USD";
    const money = (cents: number) => new Intl.NumberFormat("en-US", { style: "currency", currency }).format((cents || 0) / 100);
    const whenLabel = order.promisedAt
      ? `Pickup around ${new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(new Date(order.promisedAt))} for ${order.pickupName || order.customerName || "you"}`
      : "We will have it ready shortly";
    await sendOrderConfirmationEmail({
      to: order.customerEmail,
      storeName: order.store?.name || "Our cafe",
      orderNumber: order.orderNumber,
      name: order.customerName || "there",
      whenLabel,
      lines: (order.orderItems || []).map((line) => ({
        title: line.itemNameSnapshot || "Item",
        detail: line.customizationsSummary || undefined,
        quantity: line.quantity,
        total: money(line.price * line.quantity),
      })),
      totals: [
        { label: "Subtotal", value: money(order.subtotal) },
        ...(order.discount ? [{ label: "Free drink (rewards)", value: `−${money(order.discount)}` }] : []),
        { label: "Tax", value: money(order.tax) },
        ...(order.tip ? [{ label: "Tip", value: money(order.tip) }] : []),
        { label: "Total", value: money(order.total) },
      ],
      link: storeLink(`/order-confirmed?id=${encodeURIComponent(order.id)}&key=${encodeURIComponent(order.secretKey)}`),
    });
  } catch (error) {
    console.error("Order confirmation email failed:", error instanceof Error ? error.message : "unknown");
  }
}
