import { createTransport } from "nodemailer";
import { emailButton, emailItems, emailLayout, emailMuted, emailPanel, emailParagraph, emailTotals, escapeHtml } from "./email-layout";

/**
 * Transactional email, sent inline right after the command that earns it has committed: the order
 * confirmation and the gift card code. No outbox, queue, retry worker or cron (see AGENTS.md). The
 * caller decides "once" from its own record (a newly created order, GiftCard.emailedAt).
 */

export type MailResult = { sent: boolean; messageId?: string; error?: string };

export function mailConfigured() {
  const port = Number(process.env.SMTP_PORT);
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD && process.env.SMTP_FROM && Number.isInteger(port) && port > 0 && port < 65536);
}

export function storeLink(path = "") {
  return `${String(process.env.SMTP_STORE_LINK || "").replace(/\/$/, "")}${path}`;
}

async function send(to: string, subject: string, html: string, kind: string): Promise<MailResult> {
  if (!to) return { sent: false, error: "no_recipient" };
  if (!mailConfigured()) return { sent: false, error: "not_configured" };
  try {
    const transport = createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT), auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
    const info = await transport.sendMail({ to, from: process.env.SMTP_FROM, subject, html });
    const messageId = typeof (info as { messageId?: unknown }).messageId === "string" ? String((info as { messageId: string }).messageId) : undefined;
    // The provider's message id, so a delivery can be traced (no address or code logged).
    console.log(`${kind} email sent: ${messageId || "no message id"}`);
    return { sent: true, messageId };
  } catch (error) {
    console.error(`${kind} email failed:`, error instanceof Error ? error.message : "unknown");
    return { sent: false, error: "send_failed" };
  }
}

export type OrderConfirmationEmail = {
  to: string;
  storeName: string;
  orderNumber: string;
  name: string;
  whenLabel: string;
  lines: Array<{ title: string; detail?: string; quantity: number; total: string }>;
  totals: Array<{ label: string; value: string }>;
  link: string;
};

export function sendOrderConfirmationEmail(order: OrderConfirmationEmail) {
  return send(order.to, `Your order ${order.orderNumber} at ${order.storeName}`, emailLayout({
    storeName: order.storeName,
    preheader: `Order ${order.orderNumber}`,
    title: "We have your order",
    body: `${emailParagraph(`Thanks ${escapeHtml(order.name)}. Order <strong>${escapeHtml(order.orderNumber)}</strong> at ${escapeHtml(order.storeName)}.`)}
${emailPanel(escapeHtml(order.whenLabel))}
${emailItems(order.lines.map((line) => ({ title: line.title, detail: line.detail, quantity: line.quantity, amount: line.total })))}
${emailTotals(order.totals)}
${emailButton("View your order", order.link)}`,
  }), "order confirmation");
}

export type GiftCardEmail = { to: string; storeName: string; amount: string; code: string; recipientName: string; purchaserName: string; message: string; forSelf: boolean; expires: string; link: string };

export function sendGiftCardEmail(card: GiftCardEmail) {
  const subject = card.forSelf ? `Your ${card.amount} gift card for ${card.storeName}` : `${card.purchaserName} sent you a ${card.amount} gift card for ${card.storeName}`;
  return send(card.to, subject, emailLayout({
    storeName: card.storeName,
    preheader: subject,
    title: `A ${card.amount} gift card for ${card.storeName}`,
    body: `${emailParagraph(card.forSelf ? `Hi ${escapeHtml(card.recipientName)}, here is your gift card code.` : `Hi ${escapeHtml(card.recipientName)}, ${escapeHtml(card.purchaserName)} sent you a gift card.`)}
${card.message ? emailPanel(`&ldquo;${escapeHtml(card.message)}&rdquo;`) : ""}
${emailPanel(`<span style="font-family:Menlo,Consolas,monospace;font-size:24px;letter-spacing:3px;font-weight:700;">${escapeHtml(card.code)}</span>`, "center")}
${emailMuted(`Show this code at the counter, or read it out when you pick up an order. Good until ${escapeHtml(card.expires)}.`)}
${emailButton("See the menu", card.link)}`,
  }), "gift card");
}
