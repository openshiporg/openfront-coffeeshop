import { test } from "node:test";
import assert from "node:assert/strict";
import { deliverOrderConfirmation } from "./orderConfirmation";

const SMTP = ["SMTP_HOST", "SMTP_PORT", "SMTP_USER", "SMTP_PASSWORD", "SMTP_STORE_LINK"];
const configure = (on: boolean) => { for (const key of SMTP) { if (on) process.env[key] = key === "SMTP_STORE_LINK" ? "https://shop.test" : "x"; else delete process.env[key]; } };
function fakePrisma() {
  const events = new Map<string, any>();
  return { events, prisma: { coffeeDomainEvent: {
    create: async ({ data }: any) => { if (events.has(data.eventKey)) throw Object.assign(new Error("dup"), { code: "P2002" }); const row = { id: `e${events.size}`, ...data }; events.set(data.eventKey, row); return row; },
  } } };
}
const order = { id: "o1", storeId: "s1", orderNumber: "CF-1", customerEmail: "a@b.co", customerName: "Ann", secretKey: "k".repeat(64), total: 500, currencyCode: "USD", promisedAt: "2026-11-03T18:00:00.000Z", store: { name: "Cafe", timezone: "America/Chicago" }, orderItems: [{ itemNameSnapshot: "Latte", quantity: 2, price: 250 }] };

test("sends once on success, linking the receipt key, and records sent", async () => {
  configure(true);
  const { events, prisma } = fakePrisma();
  const sent: any[] = [];
  await deliverOrderConfirmation(prisma, order, async o => { sent.push(o); return { sent: true }; });
  assert.equal(sent.length, 1);
  assert.equal(sent[0].link, `https://shop.test/order-confirmed?id=o1&key=${"k".repeat(64)}`);
  assert.equal(events.get("order:o1:confirmation_email_result:v1").payload.status, "sent");
  assert.ok(!JSON.stringify([...events.values()]).includes("kkkk"));
});

test("the provider message id is recorded with a sent status", async () => {
  configure(true);
  const { events, prisma } = fakePrisma();
  await deliverOrderConfirmation(prisma, order, async () => ({ sent: true, messageId: "<abc@resend>", response: "250 2.0.0 Ok: queued as abc123" }));
  assert.equal(events.get("order:o1:confirmation_email_result:v1").payload.messageId, "<abc@resend>");
  assert.equal(events.get("order:o1:confirmation_email_result:v1").payload.smtpResponse, "250 2.0.0 Ok: queued as abc123");
});

test("a replay does not resend", async () => {
  configure(true);
  const { prisma } = fakePrisma();
  let count = 0;
  const send = async () => { count++; return { sent: true }; };
  await deliverOrderConfirmation(prisma, order, send);
  await deliverOrderConfirmation(prisma, order, send);
  assert.equal(count, 1);
});

test("a mail throw is recorded and never surfaces", async () => {
  configure(true);
  const { events, prisma } = fakePrisma();
  await deliverOrderConfirmation(prisma, order, async () => { throw new Error("boom"); });
  assert.equal(events.get("order:o1:confirmation_email_result:v1").payload.status, "failed");
});

test("unconfigured mail is recorded as skipped and nothing is sent", async () => {
  configure(false);
  const { events, prisma } = fakePrisma();
  let count = 0;
  await deliverOrderConfirmation(prisma, order, async () => { count++; return { sent: true }; });
  assert.equal(count, 0);
  assert.equal(events.get("order:o1:confirmation_email_result:v1").payload.status, "skipped_not_configured");
});

test("bookkeeping failure never throws", async () => {
  await deliverOrderConfirmation({ coffeeDomainEvent: { create: async () => { throw new Error("db down"); } } }, order);
});
