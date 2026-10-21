"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Minus, Plus, RotateCcw, Send, Trash2 } from "lucide-react";
import { createCafePickupOrder, quoteCafePickupOrder, type CafeOrderQuote, type PickupOrderRequest } from "@/features/storefront/lib/data/orders";
import { formatMoney } from "@/features/storefront/lib/format";
import { CART_EVENT, CART_LIMITS, CART_STORAGE_KEY, cartQuantity, loadCartLines, removeCartLines, saveCartLines } from "@/features/storefront/lib/cart/storage";
import type { CartLine } from "@/features/storefront/lib/cart/types";
import {
  clearCheckoutAttempt,
  createCheckoutAttempt,
  loadCheckoutAttempt,
  receiptHref,
  saveCheckoutAttempt,
  type CheckoutAttempt,
} from "@/features/storefront/lib/checkout/requestIdentity";
import { StorefrontMedia } from "./StorefrontMedia";

const UNCONFIRMED_MESSAGE = "We couldn’t confirm this pickup request. Retrying sends the same request, so it can’t create a second order.";
const QUOTE_FAILED_MESSAGE = "We couldn’t price this cart right now. Some items may be unavailable or sold out. Try again, or remove an item.";

function sessionStore(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function quoteItems(lines: CartLine[]) {
  return lines.map((line) => ({ menuItemId: line.menuItemId, quantity: line.quantity, modifierIds: line.modifierIds, specialInstructions: line.notes || undefined }));
}

export function CheckoutClient() {
  const router = useRouter();
  const [lines, setLines] = React.useState<CartLine[]>([]);
  const [cartLoaded, setCartLoaded] = React.useState(false);
  const [customerName, setCustomerName] = React.useState("");
  const [customerEmail, setCustomerEmail] = React.useState("");
  const [customerPhone, setCustomerPhone] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [quotePending, setQuotePending] = React.useState(false);
  const [quote, setQuote] = React.useState<CafeOrderQuote | null>(null);
  const [quoteError, setQuoteError] = React.useState<string | null>(null);
  const [quoteRetry, setQuoteRetry] = React.useState(0);
  const [error, setError] = React.useState<string | null>(null);
  const [attempt, setAttempt] = React.useState<CheckoutAttempt | null>(null);
  const errorRef = React.useRef<HTMLDivElement>(null);
  const quoteRequest = React.useRef(0);

  React.useEffect(() => {
    setLines(loadCartLines());
    const storage = sessionStore();
    const saved = storage ? loadCheckoutAttempt(storage) : null;
    if (saved) {
      setAttempt(saved);
      setCustomerName(saved.request.customerName);
      setCustomerEmail(saved.request.customerEmail || "");
      setCustomerPhone(saved.request.customerPhone || "");
      setNotes(saved.request.specialInstructions || "");
    }
    setCartLoaded(true);
    // Keep this tab in step with cart changes made elsewhere.
    const sync = (event: Event) => {
      if (event instanceof StorageEvent && event.key !== null && event.key !== CART_STORAGE_KEY) return;
      setLines(loadCartLines());
    };
    window.addEventListener("storage", sync);
    window.addEventListener(CART_EVENT, sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener(CART_EVENT, sync);
    };
  }, []);

  React.useEffect(() => {
    if (!lines.length) {
      setQuote(null);
      setQuoteError(null);
      setQuotePending(false);
      return;
    }
    const requestId = ++quoteRequest.current;
    setQuotePending(true);
    const timer = window.setTimeout(async () => {
      try {
        const result = await quoteCafePickupOrder(quoteItems(lines));
        if (requestId !== quoteRequest.current) return;
        if (result.success && result.quote) {
          setQuote(result.quote);
          setQuoteError(null);
        } else {
          setQuote(null);
          setQuoteError(QUOTE_FAILED_MESSAGE);
        }
      } catch {
        if (requestId !== quoteRequest.current) return;
        setQuote(null);
        setQuoteError(QUOTE_FAILED_MESSAGE);
      } finally {
        if (requestId === quoteRequest.current) setQuotePending(false);
      }
    }, 150);
    return () => window.clearTimeout(timer);
  }, [lines, quoteRetry]);

  React.useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  const frozen = Boolean(attempt) || pending;
  const totalQuantity = cartQuantity(lines);
  const currency = quote?.currencyCode || "USD";
  const pickupMinutes = quote?.estimatedPickupMinutes ?? null;

  function updateQuantity(cartId: string, quantity: number) {
    if (frozen) return;
    const next = lines.map((line) => (line.cartId === cartId ? { ...line, quantity: Math.min(CART_LIMITS.maxLineQuantity, Math.max(1, quantity)) } : line));
    if (cartQuantity(next) > CART_LIMITS.maxTotalQuantity) return;
    setLines(next);
    if (!saveCartLines(next)) setError("Your browser blocked saving the cart. Allow site storage and try again.");
  }

  function removeLine(cartId: string) {
    if (frozen) return;
    const next = lines.filter((line) => line.cartId !== cartId);
    setLines(next);
    if (!saveCartLines(next)) setError("Your browser blocked saving the cart. Allow site storage and try again.");
  }

  function finishSuccess(current: CheckoutAttempt, orderId: string) {
    const storage = sessionStore();
    // Record the receipt before any cleanup, so an interrupted cleanup still leaves a way back to it.
    if (storage) {
      try { saveCheckoutAttempt(storage, { ...current, orderId }); } catch { /* the receipt link below still carries the proof */ }
    }
    removeCartLines(current.cartIds);
    if (storage) clearCheckoutAttempt(storage);
    router.push(receiptHref(orderId, current.receiptKey));
  }

  async function send(current: CheckoutAttempt) {
    setPending(true);
    setError(null);
    try {
      const result = await createCafePickupOrder({ ...current.request, idempotencyKey: current.idempotencyKey, receiptKey: current.receiptKey });
      if (result.success && result.order?.id) {
        finishSuccess(current, result.order.id);
        return;
      }
    } catch {
      // Transport failure: the request may or may not have reached the cafe.
    }
    setPending(false);
    // If the current price/tax/pickup terms moved, retrying the old request cannot succeed.
    try {
      const fresh = await quoteCafePickupOrder(current.request.items);
      if (fresh.success && fresh.quote && fresh.quote.quoteFingerprint !== current.request.quoteFingerprint) {
        setError("Prices, tax or availability changed since you reviewed this ticket. If the cafe hasn’t contacted you, discard this request and review the updated total.");
        return;
      }
    } catch {
      // Keep the general message below.
    }
    setError(UNCONFIRMED_MESSAGE);
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (frozen || !lines.length || !quote || quotePending) return;
    const storage = sessionStore();
    const request: PickupOrderRequest = {
      customerName: customerName.trim(),
      customerEmail: customerEmail.trim(),
      customerPhone: customerPhone.trim() || undefined,
      pickupName: customerName.trim(),
      requestedPickupMinutes: quote.estimatedPickupMinutes,
      specialInstructions: notes.trim() || undefined,
      paymentMethod: "manual",
      quoteFingerprint: quote.quoteFingerprint,
      items: quoteItems(lines),
    };
    let next: CheckoutAttempt;
    try {
      if (!storage) throw new Error();
      next = createCheckoutAttempt(request, lines.map((line) => line.cartId), quote.total, quote.currencyCode);
      saveCheckoutAttempt(storage, next);
    } catch {
      setError("This tab can’t keep your pickup request safe while it sends. Allow site storage for this page, then try again.");
      return;
    }
    setAttempt(next);
    await send(next);
  }

  function discardAttempt() {
    const storage = sessionStore();
    if (storage && !clearCheckoutAttempt(storage)) {
      setError("This tab couldn’t clear the previous request. Close the tab and open checkout again.");
      return;
    }
    setAttempt(null);
    setError(null);
    setQuoteRetry((value) => value + 1);
  }

  const statusText = !cartLoaded
    ? "Loading cart…"
    : !lines.length
      ? "Cart empty"
      : quotePending
        ? "Pricing current menu…"
        : pickupMinutes
          ? `Pickup estimate · ${pickupMinutes} min`
          : "Price unavailable";

  return (
    <main className="sf-container py-8 sm:py-10">
      <div className="sf-page-head">
        <Link href="/#board" className="sf-back-link">
          ← Keep shopping
        </Link>
        <p className="text-sm text-[var(--sf-ink-muted)]" role="status" aria-live="polite">{statusText}</p>
      </div>

      <div className="sf-split mt-8">
        <section>
          <p className="sf-kicker">Pickup checkout</p>
          <h1 className="sf-display mt-3 text-[var(--sf-text-display-s)] leading-[0.92] [overflow-wrap:anywhere]">
            Review your ticket.
          </h1>
          <p className="mt-4 max-w-xl text-[var(--sf-ink-muted)] leading-relaxed">
            Confirm drinks and contact details. The cafe will accept the request before it enters the bar queue.
          </p>

          <div className="mt-8">
            {lines.map((line, index) => (
              <article key={line.cartId} className="border-t border-[var(--sf-rule)] py-5 first:border-t-0 first:pt-0">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex min-w-0 gap-4">
                    <StorefrontMedia
                      item={{ name: line.name, imageUrl: line.imageUrl, primaryImageUrl: line.imageUrl }}
                      className="h-20 w-20 shrink-0 border border-[var(--sf-rule)]"
                      imageClassName="object-cover"
                    />
                    <div className="min-w-0">
                      <h2 className="text-lg font-semibold [overflow-wrap:anywhere]">{line.name}</h2>
                      {line.modifierNames.length > 0 ? (
                        <p className="mt-1 text-sm text-[var(--sf-ink-muted)]">{line.modifierNames.join(", ")}</p>
                      ) : null}
                      {line.notes ? <p className="mt-2 text-sm text-[var(--sf-accent)] [overflow-wrap:anywhere]">Note: {line.notes}</p> : null}
                    </div>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-lg font-semibold sf-ticket">{quote?.lines[index] ? formatMoney(quote.lines[index].lineTotal, currency) : "—"}</p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 sm:justify-end">
                      <button
                        type="button"
                        aria-label={`Decrease ${line.name}`}
                        disabled={frozen || line.quantity <= 1}
                        onClick={() => updateQuantity(line.cartId, line.quantity - 1)}
                        className="grid h-11 w-11 place-items-center border border-[var(--sf-rule)] bg-[var(--sf-paper-inset)] disabled:opacity-50"
                      >
                        <Minus className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <span className="w-7 text-center font-semibold sf-ticket" aria-label={`Quantity ${line.quantity}`}>{line.quantity}</span>
                      <button
                        type="button"
                        aria-label={`Increase ${line.name}`}
                        disabled={frozen || line.quantity >= CART_LIMITS.maxLineQuantity || totalQuantity >= CART_LIMITS.maxTotalQuantity}
                        onClick={() => updateQuantity(line.cartId, line.quantity + 1)}
                        className="grid h-11 w-11 place-items-center border border-[var(--sf-rule)] bg-[var(--sf-paper-inset)] disabled:opacity-50"
                      >
                        <Plus className="h-4 w-4" aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${line.name}`}
                        disabled={frozen}
                        onClick={() => removeLine(line.cartId)}
                        className="sf-btn sf-btn-ghost ml-1 !min-h-11 !px-3 !text-[var(--sf-danger-ink)] disabled:opacity-50"
                      >
                        <Trash2 className="h-4 w-4" aria-hidden="true" />
                        Remove
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            ))}
            {totalQuantity >= CART_LIMITS.maxTotalQuantity ? (
              <p className="mt-2 text-sm text-[var(--sf-ink-muted)]">One pickup order can include up to {CART_LIMITS.maxTotalQuantity} items.</p>
            ) : null}
            {cartLoaded && !lines.length ? (
              <div className="sf-empty">
                <p>Your pickup cart is empty.</p>
                <Link href="/#board" className="sf-btn sf-btn-ghost mt-4">Browse the menu</Link>
              </div>
            ) : null}
          </div>
        </section>

        <aside className="sf-panel sf-sticky-panel" aria-labelledby="pickup-details-title">
          <h2 id="pickup-details-title" className="sf-display text-2xl">Pickup details</h2>
          <p className="mt-2 text-sm text-[var(--sf-ink-muted)]">Pickup contact details and the current price. Pay at pickup.</p>

          {attempt ? (
            <div className="sf-alert-error mt-5 space-y-3" role="region" aria-label="Unconfirmed pickup request">
              <p>
                {attempt.orderId
                  ? "Your last pickup request was sent."
                  : `A pickup request from this tab (${formatMoney(attempt.total, attempt.currencyCode)}) hasn’t been confirmed yet. Its details are locked so a retry can’t create a second order.`}
              </p>
              <div className="flex flex-wrap gap-2">
                {attempt.orderId ? (
                  <Link href={receiptHref(attempt.orderId, attempt.receiptKey)} className="sf-btn sf-btn-ink">Open receipt</Link>
                ) : (
                  <button type="button" className="sf-btn sf-btn-ink" disabled={pending} onClick={() => void send(attempt)}>
                    <RotateCcw className="h-4 w-4" aria-hidden="true" />
                    {pending ? "Checking…" : "Retry original request"}
                  </button>
                )}
                <button type="button" className="sf-btn sf-btn-ghost" disabled={pending} onClick={discardAttempt}>
                  {attempt.orderId ? "Start a new order" : "Discard and edit"}
                </button>
              </div>
              {!attempt.orderId ? (
                <p className="text-xs">If the cafe may already have this request, contact them before discarding it and sending another.</p>
              ) : null}
            </div>
          ) : null}

          <form className="mt-5 space-y-3" onSubmit={submit}>
            <fieldset disabled={frozen} className="space-y-3">
              <label htmlFor="checkout-name" className="grid gap-1 text-sm font-medium">
                Pickup name
                <input id="checkout-name" name="name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} autoComplete="name" required maxLength={200} className="sf-field" />
              </label>
              <label htmlFor="checkout-email" className="grid gap-1 text-sm font-medium">
                Email
                <input id="checkout-email" name="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} type="email" autoComplete="email" required maxLength={320} className="sf-field" aria-describedby="checkout-email-help" />
                <span id="checkout-email-help" className="text-xs font-normal text-[var(--sf-ink-muted)]">Used to identify this pickup request.</span>
              </label>
              <label htmlFor="checkout-phone" className="grid gap-1 text-sm font-medium">
                Phone (optional)
                <input id="checkout-phone" name="phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" maxLength={50} className="sf-field" />
              </label>
              <label htmlFor="checkout-notes" className="grid gap-1 text-sm font-medium">
                Order notes (optional)
                <textarea id="checkout-notes" name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} className="sf-field" />
              </label>
            </fieldset>

            <hr className="sf-rule my-5" />

            <dl className="space-y-2 text-sm text-[var(--sf-ink-muted)] sf-ticket">
              <div className="flex justify-between gap-3">
                <dt>Subtotal</dt>
                <dd>{quote ? formatMoney(quote.subtotal, currency) : "—"}</dd>
              </div>
              <div className="flex justify-between gap-3">
                <dt>Tax</dt>
                <dd>{quote ? formatMoney(quote.tax, currency) : "—"}</dd>
              </div>
              <div className="flex justify-between gap-3 text-lg font-semibold text-[var(--sf-ink)]">
                <dt>Total</dt>
                <dd>{quote ? formatMoney(quote.total, currency) : "—"}</dd>
              </div>
            </dl>

            {!attempt ? (
              <button
                type="submit"
                disabled={!lines.length || !quote || quotePending || pending}
                className="sf-btn sf-btn-ink mt-5 w-full"
              >
                <Send className="h-4 w-4" aria-hidden="true" />
                {!cartLoaded ? "Loading cart…" : !lines.length ? "Add an item first" : pending ? "Sending request…" : quotePending ? "Pricing…" : quote ? `Request pickup order · ${formatMoney(quote.total, currency)}` : "Price unavailable"}
              </button>
            ) : null}
          </form>

          {quoteError && !attempt ? (
            <div className="sf-alert-error mt-3" role="alert">
              <p>{quoteError}</p>
              <button type="button" className="mt-2 font-semibold underline underline-offset-4" onClick={() => setQuoteRetry((value) => value + 1)}>Try pricing again</button>
            </div>
          ) : null}
          {error ? <div ref={errorRef} tabIndex={-1} className="sf-alert-error mt-3" role="alert">{error}</div> : null}
        </aside>
      </div>
    </main>
  );
}
