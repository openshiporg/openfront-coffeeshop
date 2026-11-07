import { createTransport } from "nodemailer";
import { emailButton, emailItems, emailLayout, emailMuted, emailPanel, emailParagraph, emailTotals, escapeHtml } from "./email-layout";

export type OrderConfirmationEmail = {
  to: string;
  storeName: string;
  orderNumber: string;
  name: string;
  whenLabel: string;
  lines: Array<{ title: string; quantity: number; total: string }>;
  total: string;
  link: string;
};


function transport() {
  const port = Number(process.env.SMTP_PORT);
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASSWORD || !Number.isInteger(port) || port < 1 || port > 65535) throw new Error("Email delivery is not configured");
  return createTransport({ host: process.env.SMTP_HOST, port, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD } });
}

export async function sendOrderConfirmationEmail(order: OrderConfirmationEmail): Promise<{ sent: boolean; error?: string; messageId?: string; response?: string }> {
  if (!order.to) return { sent: false, error: "no_recipient" };
  try {
    const rows = order.lines.map((line) => `<tr><td style="padding:4px 0">${escapeHtml(line.title)} × ${line.quantity}</td><td align="right" style="padding:4px 0">${escapeHtml(line.total)}</td></tr>`).join("");
    const info = await transport().sendMail({
      to: order.to,
      from: process.env.SMTP_FROM,
      subject: `Your order ${order.orderNumber} at ${order.storeName}`,
      html: emailLayout({
        storeName: order.storeName,
        preheader: `Order ${order.orderNumber}`,
        title: "We have your order",
        body: `${emailParagraph(`Thanks ${escapeHtml(order.name)}. Order <strong>${escapeHtml(order.orderNumber)}</strong> at ${escapeHtml(order.storeName)}.`)}
${emailPanel(escapeHtml(order.whenLabel))}
${emailItems(order.lines.map((line) => ({ title: line.title, quantity: line.quantity, amount: line.total })))}
${emailTotals([{ label: "Total", value: order.total }])}
${emailButton("View your order", order.link)}`,
      }),
    });
    return { sent: true, messageId: typeof (info as any)?.messageId === "string" ? (info as any).messageId : undefined, response: typeof (info as any)?.response === "string" ? (info as any).response : undefined };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : "send_failed" };
  }
}

export type OrderReadyEmail = { to: string; storeName: string; orderNumber: string; name: string; handoffCode: string; address: string; link: string };

/** "Your order is ready" (Toast/Square order-ahead): sent once when the bar marks the whole order ready. */
export async function sendOrderReadyEmail(order: OrderReadyEmail): Promise<{ sent: boolean; error?: string; messageId?: string; response?: string }> {
  if (!order.to) return { sent: false, error: "no_recipient" };
  try {
    const info = await transport().sendMail({
      to: order.to,
      from: process.env.SMTP_FROM,
      subject: `Ready for pickup: order ${order.orderNumber}`,
      html: emailLayout({
        storeName: order.storeName,
        preheader: `Order ${order.orderNumber} is ready for pickup`,
        title: `${order.name}, your order is ready`,
        body: `${emailParagraph(`Order <strong>${escapeHtml(order.orderNumber)}</strong> is waiting at the pickup counter at ${escapeHtml(order.address || order.storeName)}.`)}
${order.handoffCode ? `${emailPanel(`<span style="font-size:28px;letter-spacing:4px;font-weight:700;">${escapeHtml(order.handoffCode)}</span>`, "center")}${emailMuted("Show this pickup code at the counter.")}` : ""}
${emailButton("View your order", order.link)}`,
      }),
    });
    return { sent: true, messageId: typeof (info as any)?.messageId === "string" ? (info as any).messageId : undefined, response: typeof (info as any)?.response === "string" ? (info as any).response : undefined };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : "send_failed" };
  }
}

export type GiftCardEmail = { to: string; storeName: string; amount: string; code: string; recipientName: string; purchaserName: string; message: string; link: string };

/** The recipient's gift card: amount, code and the note from the buyer. */
export async function sendGiftCardEmail(card: GiftCardEmail): Promise<{ sent: boolean; error?: string }> {
  if (!card.to) return { sent: false, error: "no_recipient" };
  try {
    await transport().sendMail({
      to: card.to,
      from: process.env.SMTP_FROM,
      subject: `${card.purchaserName} sent you a ${card.amount} gift card for ${card.storeName}`,
      html: emailLayout({
        storeName: card.storeName,
        preheader: `${card.purchaserName} sent you a ${card.amount} gift card`,
        title: `A ${card.amount} gift card for ${card.storeName}`,
        body: `${emailParagraph(`Hi ${escapeHtml(card.recipientName)}, ${escapeHtml(card.purchaserName)} sent you a gift card.`)}
${card.message ? emailPanel(`&ldquo;${escapeHtml(card.message)}&rdquo;`) : ""}
${emailPanel(`<span style="font-family:Menlo,Consolas,monospace;font-size:24px;letter-spacing:3px;font-weight:700;">${escapeHtml(card.code)}</span>`, "center")}
${emailMuted("Show this code at the counter, or read it out when you pick up an order.")}
${emailButton("See the menu", card.link)}`,
      }),
    });
    return { sent: true };
  } catch (error) {
    return { sent: false, error: error instanceof Error ? error.message : "send_failed" };
  }
}
