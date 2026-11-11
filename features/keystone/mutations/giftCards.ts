import { createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

import { permissions, type Session } from "../access";
import { cafeCustomerError } from "../lib/cafeCustomerError";
import { recordCoffeeCommandReceipt, getPrimaryCoffeeStoreId } from "../lib/coffeeCommandReceipt";
import { onlinePaymentReady } from "../lib/onlinePayment";
import { requireCurrentCoffeeCapability } from "./coffeeKdsAuthority";

/**
 * Online gift cards (Toast / Square): pick an amount, pay on Stripe's hosted page, and the card is
 * activated only after Stripe confirms the payment (return-page read-back or the signed webhook,
 * whichever comes first). The code is emailed to the recipient once and shown to the buyer. At the
 * counter a code is taken as tender; every debit and credit is appended to the card's ledger.
 */

type Prisma = any;
type Context = { session?: Session; prisma: Prisma; sudo(): { prisma: Prisma } };
type LedgerRow = { at: string; type: "purchase" | "redeem" | "refund" | "cancel"; amount: number; balance: number; ref: string };

export const GIFT_CARD_AMOUNTS = [1500, 2500, 5000, 7500, 10000];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const usd = (cents: number) => `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;

function newCode() {
  return randomBytes(6).toString("hex").toUpperCase().match(/.{4}/g)!.join("-");
}
export function normalizeGiftCode(code: string) {
  const raw = String(code || "").toUpperCase().replace(/[^0-9A-F]/g, "");
  return raw.length === 12 ? raw.match(/.{4}/g)!.join("-") : "";
}
function orderToken(giftCardId: string) {
  const secret = process.env.SESSION_SECRET || "";
  if (secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters long");
  return createHmac("sha256", secret).update(`coffee-gift:${giftCardId}`).digest("hex");
}
function tokenOk(giftCardId: string, token?: string | null) {
  if (!giftCardId || !token || token.length !== 64) return false;
  const a = Buffer.from(orderToken(giftCardId));
  const b = Buffer.from(token);
  return a.length === b.length && timingSafeEqual(a, b);
}
function giftReturnBase(value: unknown) {
  if (typeof value !== "string" || value.length > 2000) return null;
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.pathname !== "/gift-cards" || url.username || url.password) return null;
    url.search = "";
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}
const ledgerOf = (value: unknown) => (Array.isArray(value) ? value as LedgerRow[] : []);

export async function getCafeGiftCardOptions(_root: unknown, _args: unknown, context: Context) {
  const prisma = context.sudo().prisma;
  const store = await prisma.storeSetting.findUnique({ where: { singletonKey: "primary" }, select: { currencyCode: true } });
  return { online: await onlinePaymentReady(prisma), amounts: GIFT_CARD_AMOUNTS, currencyCode: String(store?.currencyCode || "USD") };
}

export async function startCafeGiftCardCheckout(
  _root: unknown,
  args: { amount: number; purchaserName: string; purchaserEmail: string; recipientName?: string | null; recipientEmail?: string | null; message?: string | null; returnUrl: string; idempotencyKey: string },
  context: Context,
) {
  if (!GIFT_CARD_AMOUNTS.includes(args.amount)) throw cafeCustomerError("Choose one of the gift card amounts.");
  const purchaserName = String(args.purchaserName || "").trim();
  const purchaserEmail = String(args.purchaserEmail || "").trim().toLowerCase();
  const recipientEmail = String(args.recipientEmail || "").trim().toLowerCase() || purchaserEmail;
  const recipientName = String(args.recipientName || "").trim() || purchaserName;
  const message = String(args.message || "").trim();
  if (!purchaserName || purchaserName.length > 120 || recipientName.length > 120) throw cafeCustomerError("Enter your name.");
  if (!EMAIL.test(purchaserEmail) || !EMAIL.test(recipientEmail) || recipientEmail.length > 320) throw cafeCustomerError("Enter a valid email address.");
  if (message.length > 300) throw cafeCustomerError("Keep the message under 300 characters.");
  const key = String(args.idempotencyKey || "");
  if (!/^[A-Za-z0-9-]{16,100}$/.test(key)) throw new Error("Gift card idempotency key is required");
  const base = giftReturnBase(args.returnUrl);
  if (!base) throw new Error("Gift card return URL is invalid");
  const prisma = context.sudo().prisma;
  if (!(await onlinePaymentReady(prisma))) throw cafeCustomerError("Online gift cards aren't available right now. Ask at the counter.");
  const store = await prisma.storeSetting.findUnique({ where: { singletonKey: "primary" }, select: { id: true, name: true, currencyCode: true } });
  if (!store) throw cafeCustomerError("Gift cards aren't available right now.");

  const expiresAt = new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 5);
  const card = await prisma.giftCard.create({ data: {
    storeId: store.id, code: newCode(), status: "pending", initialValue: args.amount, balance: 0, currencyCode: String(store.currencyCode || "USD"),
    purchaserName, purchaserEmail, recipientName, recipientEmail, message, expiresAt, ledger: [],
  } });
  const back = new URL(base);
  back.searchParams.set("card", card.id);
  back.searchParams.set("token", orderToken(card.id));
  const cancel = new URL(back);
  cancel.searchParams.set("result", "cancelled");
  try {
    const stripe = await import("../../integrations/payment/stripe");
    const session = await stripe.createHostedCheckout({
      amount: args.amount, currencyCode: card.currencyCode, name: `${store.name || "Cafe"} gift card · ${usd(args.amount)}`,
      successUrl: back.toString(), cancelUrl: cancel.toString(), idempotencyKey: `gift-card:${key}`, customerEmail: purchaserEmail,
      metadata: { purpose: "gift_card", giftCardId: card.id },
    });
    if (!session.id || !session.url) throw new Error("Stripe did not open a checkout");
    await prisma.giftCard.update({ where: { id: card.id }, data: { providerPaymentId: session.id } });
    return { success: true, checkoutUrl: session.url };
  } catch (error) {
    console.error("Gift card checkout could not be opened:", error instanceof Error ? error.message : "unknown");
    await prisma.giftCard.update({ where: { id: card.id }, data: { status: "cancelled" } });
    throw cafeCustomerError("Online gift cards aren't available right now. Ask at the counter.");
  }
}

/** Reads the hosted checkout back from Stripe and activates the card once paid. Safe to repeat. */
export async function settleCafeGiftCard(prisma: Prisma, giftCardId: string) {
  const card = await prisma.giftCard.findUnique({ where: { id: giftCardId } });
  if (!card) throw cafeCustomerError("Gift card order not found.");
  if (card.status === "pending" && String(card.providerPaymentId || "").startsWith("cs_")) {
    const stripe = await import("../../integrations/payment/stripe");
    const remote = await stripe.readHostedCheckout(card.providerPaymentId);
    if (remote.state === "expired") {
      await prisma.giftCard.updateMany({ where: { id: card.id, status: "pending" }, data: { status: "cancelled" } });
    } else if (remote.state === "paid") {
      if (remote.amount !== card.initialValue || remote.currency.toUpperCase() !== String(card.currencyCode).toUpperCase()) throw cafeCustomerError("The amount paid doesn't match the gift card. Contact the café.");
      const now = new Date();
      await prisma.$transaction(async (tx: Prisma) => {
        const ledger: LedgerRow[] = [{ at: now.toISOString(), type: "purchase", amount: card.initialValue, balance: card.initialValue, ref: remote.paymentIntent || card.providerPaymentId }];
        const claimed = await tx.giftCard.updateMany({ where: { id: card.id, status: "pending" }, data: { status: "active", balance: card.initialValue, activatedAt: now, ledger } });
        if (!claimed.count) return;
        await recordCoffeeCommandReceipt(tx as never, {
          storeId: card.storeId, eventKey: `gift-card:${card.id}:sold:v1`, eventType: "gift_card.sold", aggregateType: "gift_card", aggregateId: card.id, occurredAt: now,
          payload: { giftCardId: card.id, amount: card.initialValue, currencyCode: card.currencyCode, providerPaymentId: card.providerPaymentId },
        });
      });
    }
  }
  return prisma.giftCard.findUnique({ where: { id: card.id } });
}

export async function confirmCafeGiftCardOrder(_root: unknown, args: { giftCardId: string; token: string }, context: Context) {
  if (!tokenOk(args.giftCardId, args.token)) throw cafeCustomerError("We couldn't find that gift card order.");
  const card = await settleCafeGiftCard(context.sudo().prisma, args.giftCardId);
  const live = card.status === "active" || card.status === "redeemed";
  return {
    status: card.status, amount: card.initialValue, currencyCode: card.currencyCode, recipientName: card.recipientName, recipientEmail: card.recipientEmail,
    code: live ? card.code : null, expiresAt: card.expiresAt ? new Date(card.expiresAt).toISOString() : null,
  };
}

/** Signed webhook for a gift card purchase: settle by reading the session back, never by trusting the body alone. */
export async function settleCafeGiftCardFromWebhook(prisma: Prisma, giftCardId: string) {
  try {
    await settleCafeGiftCard(prisma, giftCardId);
  } catch (error) {
    console.error("Gift card webhook settlement failed:", error instanceof Error ? error.message : "unknown");
  }
}

/** Activates any purchases still waiting (missed webhook, closed tab), for the staff gift card list. */
async function settleWaiting(prisma: Prisma) {
  const waiting = await prisma.giftCard.findMany({ where: { status: "pending", providerPaymentId: { startsWith: "cs_" }, createdAt: { gte: new Date(Date.now() - 2 * 86_400_000) } }, select: { id: true }, take: 20 });
  for (const card of waiting) await settleCafeGiftCard(prisma, card.id).catch(() => undefined);
}

function cardView(card: Record<string, any>, canManage: boolean) {
  const ledger = ledgerOf(card.ledger);
  return {
    id: card.id, code: card.code, status: card.status, initialValue: card.initialValue, balance: card.balance, currencyCode: card.currencyCode,
    purchaserName: card.purchaserName || null, recipientName: card.recipientName || null, recipientEmail: canManage ? card.recipientEmail || null : null,
    activatedAt: card.activatedAt ? new Date(card.activatedAt).toISOString() : null, expiresAt: card.expiresAt ? new Date(card.expiresAt).toISOString() : null,
    // A purchase is refundable to the buyer's card only while none of it has been spent.
    canRefund: canManage && card.status === "active" && card.balance === card.initialValue && !ledger.some((row) => row.type === "redeem"),
  };
}

export async function getCafeGiftCards(_root: unknown, args: { search?: string | null }, context: Context) {
  if (!permissions.canReadPayments({ session: context.session })) throw new Error("Not authorized to read gift cards");
  await settleWaiting(context.sudo().prisma);
  const search = String(args.search || "").trim().slice(0, 120);
  const code = normalizeGiftCode(search);
  const where = {
    status: { in: ["active", "redeemed", "cancelled"] },
    ...(search ? { OR: [...(code ? [{ code }] : []), { recipientName: { contains: search, mode: "insensitive" } }, { purchaserName: { contains: search, mode: "insensitive" } }, { recipientEmail: { contains: search, mode: "insensitive" } }] } : {}),
  };
  const [cards, outstanding] = await Promise.all([
    context.prisma.giftCard.findMany({ where, orderBy: [{ activatedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }], take: 100 }),
    context.prisma.giftCard.aggregate({ where: { status: "active" }, _sum: { balance: true }, _count: { _all: true } }),
  ]);
  const canManage = permissions.canManagePayments({ session: context.session });
  return { outstandingCents: Number(outstanding._sum.balance || 0), activeCount: outstanding._count._all, cards: cards.map((card: Record<string, any>) => cardView(card, canManage)) };
}

/** Counter look-up: balance for a code. */
export async function lookupCafeGiftCard(_root: unknown, args: { code: string }, context: Context) {
  if (!permissions.canManagePayments({ session: context.session })) throw new Error("Not authorized to look up gift cards");
  const code = normalizeGiftCode(args.code);
  if (!code) throw cafeCustomerError("Enter the 12-character gift card code.");
  let card = await context.prisma.giftCard.findUnique({ where: { code } });
  if (card?.status === "pending") card = await settleCafeGiftCard(context.sudo().prisma, card.id);
  if (!card || card.status === "pending") throw cafeCustomerError("No gift card with that code.");
  return cardView(card, true);
}

/** Debits a gift card inside a tender transaction. Throws when the card can't cover `amount`. */
export async function redeemCafeGiftCardInTransaction(tx: Prisma, input: { storeId: string; code: string; amount: number; ref: string; now: Date }) {
  const code = normalizeGiftCode(input.code);
  if (!code) throw cafeCustomerError("Enter the 12-character gift card code.");
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "coffee-gift-card", code);
  const card = await tx.giftCard.findUnique({ where: { code } });
  if (!card || card.storeId !== input.storeId || card.status !== "active") throw cafeCustomerError("That gift card isn't active.");
  if (card.expiresAt && new Date(card.expiresAt) < input.now) throw cafeCustomerError("That gift card has expired.");
  if (card.balance < input.amount) throw cafeCustomerError(`That gift card has ${usd(card.balance)} left. Take this order by cash or card instead.`);
  const balance = card.balance - input.amount;
  const ledger = [...ledgerOf(card.ledger), { at: input.now.toISOString(), type: "redeem" as const, amount: input.amount, balance, ref: input.ref }];
  await tx.giftCard.update({ where: { id: card.id }, data: { balance, status: balance === 0 ? "redeemed" : "active", ledger } });
  return { id: card.id, code: card.code, balance };
}

/** Credits a refunded gift card tender back to the same card. */
export async function creditCafeGiftCardInTransaction(tx: Prisma, input: { code: string; amount: number; ref: string; now: Date }) {
  const code = normalizeGiftCode(input.code);
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "coffee-gift-card", code);
  const card = await tx.giftCard.findUnique({ where: { code } });
  if (!card) throw new Error("The gift card for this payment was not found");
  const balance = card.balance + input.amount;
  const ledger = [...ledgerOf(card.ledger), { at: input.now.toISOString(), type: "refund" as const, amount: input.amount, balance, ref: input.ref }];
  await tx.giftCard.update({ where: { id: card.id }, data: { balance, status: card.status === "redeemed" ? "active" : card.status, ledger } });
}

/** Refunds an unspent gift card purchase to the buyer's card through Stripe and cancels the card. */
export async function refundCafeGiftCard(_root: unknown, args: { giftCardId: string; reason?: string | null }, context: Context) {
  if (!permissions.canManagePayments({ session: context.session })) throw new Error("Not authorized to refund gift cards");
  const prisma = context.prisma;
  const result = await prisma.$transaction(async (tx: Prisma) => {
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "coffee-gift-card-id", args.giftCardId);
    const actorId = await requireCurrentCoffeeCapability(tx as never, context.session, ["canManagePayments"], "Not authorized to refund gift cards");
    const card = await tx.giftCard.findUnique({ where: { id: args.giftCardId } });
    if (!card) throw new Error("Gift card not found");
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "coffee-gift-card", card.code);
    const storeId = await getPrimaryCoffeeStoreId(tx as never);
    if (card.storeId !== storeId) throw new Error("Gift card not found");
    if (card.status === "cancelled" && card.refundedAt) return { card, replay: true };
    if (!cardView(card, true).canRefund) throw cafeCustomerError("Only an unused gift card can be refunded to the buyer's card.");
    const stripe = await import("../../integrations/payment/stripe");
    const remote = await stripe.readHostedCheckout(String(card.providerPaymentId || ""));
    if (!remote.paymentIntent) throw cafeCustomerError("This purchase hasn't finished settling. Try again shortly.");
    const refund = await stripe.refundPaymentFunction({ providerPaymentId: remote.paymentIntent, amount: card.initialValue, reason: String(args.reason || "Gift card refund").slice(0, 200), idempotencyKey: `gift-card-refund:${card.id}`, currencyCode: card.currencyCode } as never);
    if (!refund?.success || !["refunded", "pending"].includes(String(refund.status))) throw cafeCustomerError("The card refund didn't go through. Nothing was changed.");
    const now = new Date();
    const ledger = [...ledgerOf(card.ledger), { at: now.toISOString(), type: "cancel" as const, amount: card.balance, balance: 0, ref: String(refund.providerPaymentId || "refund") }];
    const updated = await tx.giftCard.update({ where: { id: card.id }, data: { status: "cancelled", balance: 0, refundedAt: now, ledger } });
    await recordCoffeeCommandReceipt(tx as never, {
      storeId, eventKey: `gift-card:${card.id}:refunded:v1`, eventType: "gift_card.refunded", aggregateType: "gift_card", aggregateId: card.id, occurredAt: now,
      payload: { giftCardId: card.id, amount: card.initialValue, refundedBy: actorId, providerRefundId: String(refund.providerPaymentId || "") || null },
    });
    return { card: updated, replay: false };
  }, { maxWait: 5000, timeout: 20000, isolationLevel: "ReadCommitted" });
  return cardView(result.card, true);
}

export const giftCardTender = {
  providerPaymentId: (code: string) => `gift_card:${normalizeGiftCode(code)}:${randomUUID()}`,
  codeOf: (providerPaymentId: string) => String(providerPaymentId || "").split(":")[1] || "",
};
