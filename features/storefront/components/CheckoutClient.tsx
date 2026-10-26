"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Minus, Plus, RotateCcw, Trash2 } from "lucide-react";
import { createCafePickupOrder, quoteCafePickupOrder, type CafeOrderQuote, type PickupOrderRequest } from "@/features/storefront/lib/data/orders";
import { startOnlinePayment } from "@/features/storefront/lib/data/payment";
import { formatMoney } from "@/features/storefront/lib/format";
import { formatPickupTime, groupPickupSlots, openState, pickupSlots } from "@/features/storefront/lib/hours";
import type { CheckoutCustomer } from "@/features/storefront/lib/data/account";
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
const PICKUP_STEP_MINUTES = 15;

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

type StoreHours = { weeklyHours: unknown; timezone: string };

function slotTime(slot: Date, timeZone: string | null | undefined) {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: timeZone || "UTC", hour: "numeric", minute: "2-digit" }).format(slot);
  } catch {
    return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", hour: "numeric", minute: "2-digit" }).format(slot);
  }
}

export function CheckoutClient({ customer = null, hours = null, onlinePayment = false, pickupLeadMinutes = null }: { customer?: CheckoutCustomer | null; hours?: StoreHours | null; onlinePayment?: boolean; pickupLeadMinutes?: number | null }) {
  const router = useRouter();
  const [payOnline, setPayOnline] = React.useState(false);
  const [lines, setLines] = React.useState<CartLine[]>([]);
  const [cartLoaded, setCartLoaded] = React.useState(false);
  const [customerName, setCustomerName] = React.useState(customer?.name || "");
  const [customerEmail, setCustomerEmail] = React.useState(customer?.email || "");
  const [customerPhone, setCustomerPhone] = React.useState(customer?.phone || "");
  const [notes, setNotes] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [quotePending, setQuotePending] = React.useState(false);
  const [quote, setQuote] = React.useState<CafeOrderQuote | null>(null);
  const [quotedAt, setQuotedAt] = React.useState(0);
  const [pickupChoice, setPickupChoice] = React.useState<number | null>(null);
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
          setQuotedAt(Date.now());
          setQuoteError(null);
        } else {
          setQuote(null);
          setQuoteError((!result.success && result.customerMessage) || QUOTE_FAILED_MESSAGE);
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
  // The quote gives the earliest pickup (the next opening when the cafe is closed); later windows are optional.
  const slots = React.useMemo(() => {
    if (!quote || !quotedAt) return [];
    const earliest = new Date(quotedAt + quote.estimatedPickupMinutes * 60_000);
    return hours ? pickupSlots(hours.weeklyHours, hours.timezone, earliest, PICKUP_STEP_MINUTES) : [earliest];
  }, [quote, quotedAt, hours]);
  const chosenSlot = slots.find((slot) => slot.getTime() === pickupChoice) || slots[0] || null;
  const scheduled = Boolean(chosenSlot && (chosenSlot !== slots[0] || (pickupMinutes ?? 0) > 60));

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
    if (onlinePayment && payOnline) {
      // The order exists either way; if the card page can't open, the receipt offers it again.
      void startOnlinePayment(orderId, current.receiptKey, crypto.randomUUID())
        .then((result) => {
          if (result.checkoutUrl) window.location.assign(result.checkoutUrl);
          else router.push(receiptHref(orderId, current.receiptKey));
        })
        .catch(() => router.push(receiptHref(orderId, current.receiptKey)));
      return;
    }
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
      if (!result.success && result.customerMessage) {
        // The cafe declined this request (sold out, closed, at capacity), so no order exists.
        setPending(false);
        setError(result.customerMessage);
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
      requestedPickupMinutes: chosenSlot && chosenSlot !== slots[0]
        ? Math.max(quote.estimatedPickupMinutes, Math.ceil((chosenSlot.getTime() - Date.now()) / 60_000))
        : quote.estimatedPickupMinutes,
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

  // The pickup time leads the pickup box: the quoted time once there is something to price,
  // the store's usual lead time (from settings) before that. While closed, the lead time
  // counts from opening, not from ordering. Computed only after the cart loads (client clock).
  const storeState = cartLoaded && hours ? openState(hours.weeklyHours, hours.timezone) : null;
  const opensText = storeState?.kind === "closed" ? storeState.label.replace(/^Closed · opens/, "Opens") : null;
  const emptyPickupText = opensText === "Closed"
    ? "Closed · no opening hours posted"
    : opensText
      ? pickupLeadMinutes ? `${opensText} · ready about ${pickupLeadMinutes} min after` : `${opensText} · pickup after we open`
      : pickupLeadMinutes ? `Usually ready about ${pickupLeadMinutes} min after you order` : "Add something to see a pickup time";
  const pickupText = !cartLoaded
    ? "Loading…"
    : !lines.length
      ? emptyPickupText
      : quotePending
        ? "Checking…"
        : chosenSlot && scheduled
          ? formatPickupTime(chosenSlot, hours?.timezone)
          : pickupMinutes
            ? `Ready in about ${pickupMinutes} min`
            : "Not available yet";

  return (
    <main className="sf-container sf-page">
      <Link href="/#menu" className="sf-back-link">
        <ArrowLeft className="size-4" aria-hidden="true" />
        Menu
      </Link>
      <h1 className="sf-display sf-page-title">Your order</h1>

      <div className="sf-split">
        <section className="sf-tray min-w-0" aria-labelledby="order-lines-title">
          <div className="sf-tray-section">
            {lines.length ? (
              <h2 id="order-lines-title" className="sf-box-label">
                Items{totalQuantity ? <span className="sf-marker sf-tray-count"> {totalQuantity}</span> : null}
              </h2>
            ) : null}
            {lines.map((line, index) => (
              <article key={line.cartId} className="sf-line">
                <StorefrontMedia
                  item={{ name: line.name, imageUrl: line.imageUrl, primaryImageUrl: line.imageUrl }}
                  className="sf-line-media"
                  sizes="64px"
                />
                <div className="min-w-0">
                  <div className="sf-line-top">
                    <h3 className="sf-line-name">{line.name}</h3>
                    <p className="sf-price">{quote?.lines[index] ? formatMoney(quote.lines[index].lineTotal, currency) : "—"}</p>
                  </div>
                  {line.modifierNames.length > 0 ? <p className="sf-line-mods sf-marker">{line.modifierNames.join(", ")}</p> : null}
                  {line.notes ? <p className="sf-line-note">“{line.notes}”</p> : null}
                  <div className="sf-line-actions">
                    <div className="sf-stepper sf-stepper-sm">
                      <button
                        type="button"
                        aria-label={`Decrease ${line.name}`}
                        disabled={frozen || line.quantity <= 1}
                        onClick={() => updateQuantity(line.cartId, line.quantity - 1)}
                      >
                        <Minus className="size-4" aria-hidden="true" />
                      </button>
                      <span className="sf-marker" aria-label={`Quantity ${line.quantity}`}>{line.quantity}</span>
                      <button
                        type="button"
                        aria-label={`Increase ${line.name}`}
                        disabled={frozen || line.quantity >= CART_LIMITS.maxLineQuantity || totalQuantity >= CART_LIMITS.maxTotalQuantity}
                        onClick={() => updateQuantity(line.cartId, line.quantity + 1)}
                      >
                        <Plus className="size-4" aria-hidden="true" />
                      </button>
                    </div>
                    <button
                      type="button"
                      aria-label={`Remove ${line.name}`}
                      disabled={frozen}
                      onClick={() => removeLine(line.cartId)}
                      className="sf-btn sf-btn-quiet sf-btn-danger"
                    >
                      <Trash2 className="size-4" aria-hidden="true" />
                      Remove
                    </button>
                  </div>
                </div>
              </article>
            ))}
            {totalQuantity >= CART_LIMITS.maxTotalQuantity ? (
              <p className="sf-fine">Limit {CART_LIMITS.maxTotalQuantity} items per order.</p>
            ) : null}
            {cartLoaded && !lines.length ? (
              <div className="sf-tray-empty">
                <h2 id="order-lines-title" className="sf-tray-empty-title">Nothing in your order yet</h2>
                <span>Pick a drink or pastry from the menu and it lands here.</span>
                <Link href="/#menu" className="sf-btn sf-btn-ink">Browse the menu</Link>
              </div>
            ) : null}
            {!cartLoaded ? <p className="sf-muted">Loading your order…</p> : null}
          </div>

          {lines.length ? (
            <>
              <div className="sf-tray-section sf-tray-totals">
                <dl className="sf-totals">
                  <div>
                    <dt>Subtotal</dt>
                    <dd>{quote ? formatMoney(quote.subtotal, currency) : "—"}</dd>
                  </div>
                  <div>
                    <dt>Tax</dt>
                    <dd>{quote ? formatMoney(quote.tax, currency) : "—"}</dd>
                  </div>
                  <div className="is-total">
                    <dt>Total</dt>
                    <dd>{quote ? formatMoney(quote.total, currency) : "—"}</dd>
                  </div>
                </dl>
                <p className="sf-pay-note">{onlinePayment && payOnline ? "Pay online by card" : "Pay at pickup"}</p>
              </div>
            </>
          ) : null}
        </section>

        <aside className="sf-panel sf-sticky-panel" aria-labelledby="pickup-details-title">
          <h2 id="pickup-details-title" className="sf-display sf-panel-title">Pickup</h2>
          <p className="sf-pickup-time" role="status" aria-live="polite">
            <span className={`sf-dot ${!lines.length || !cartLoaded ? "" : quotePending ? "sf-dot-active" : quote ? "sf-dot-open" : "sf-dot-closed"}`} aria-hidden="true" />
            {pickupText}
          </p>

          {attempt ? (
            <div className="sf-alert-error sf-attempt" role="region" aria-label="Unconfirmed pickup request">
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
                    <RotateCcw className="size-4" aria-hidden="true" />
                    {pending ? "Checking…" : "Retry original request"}
                  </button>
                )}
                <button type="button" className="sf-btn" disabled={pending} onClick={discardAttempt}>
                  {attempt.orderId ? "Start a new order" : "Discard and edit"}
                </button>
              </div>
              {!attempt.orderId ? (
                <p className="sf-fine">If the café may already have this request, contact them before discarding it.</p>
              ) : null}
            </div>
          ) : null}

          <form className="sf-form-stack" onSubmit={submit}>
            <fieldset disabled={frozen} className="grid gap-4">
              <label htmlFor="checkout-name" className="sf-form-label">
                Name on the cup
                <input id="checkout-name" name="name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} autoComplete="name" required maxLength={200} className="sf-field sf-field-written sf-namebox" />
              </label>
              <label htmlFor="checkout-email" className="sf-form-label">
                Email
                <input id="checkout-email" name="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} type="email" autoComplete="email" required maxLength={320} className="sf-field" />
              </label>
              <label htmlFor="checkout-phone" className="sf-form-label">
                <span>Phone <span className="sf-optional">optional</span></span>
                <input id="checkout-phone" name="phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} type="tel" inputMode="tel" autoComplete="tel" maxLength={50} className="sf-field" />
              </label>
              {slots.length > 1 ? (
                <label htmlFor="checkout-pickup" className="sf-form-label">
                  Pickup time
                  <select
                    id="checkout-pickup"
                    value={chosenSlot?.getTime() ?? ""}
                    onChange={(event) => setPickupChoice(Number(event.target.value))}
                    className="sf-field"
                  >
                    {groupPickupSlots(slots, hours?.timezone).map((group) => (
                      <optgroup key={group.key} label={group.label}>
                        {group.slots.map((slot) => (
                          <option key={slot.getTime()} value={slot.getTime()}>
                            {group.label} {slotTime(slot, hours?.timezone)}{slot === slots[0] ? " · earliest" : ""}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                </label>
              ) : null}
              {onlinePayment ? (
                <div className="sf-form-label">
                  <span id="checkout-payment-label">Payment</span>
                  <div className="sf-track sf-track-fill" role="group" aria-labelledby="checkout-payment-label">
                    <button type="button" className="sf-track-item" aria-pressed={!payOnline} disabled={frozen} onClick={() => setPayOnline(false)}>Pay at pickup</button>
                    <button type="button" className="sf-track-item" aria-pressed={payOnline} disabled={frozen} onClick={() => setPayOnline(true)}>Pay online</button>
                  </div>
                </div>
              ) : null}
              <label htmlFor="checkout-notes" className="sf-form-label">
                <span>Order notes <span className="sf-optional">optional</span></span>
                <textarea id="checkout-notes" name="notes" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} className="sf-field" />
              </label>
            </fieldset>

            {!attempt ? (
              <button
                type="submit"
                disabled={!lines.length || !quote || quotePending || pending}
                className="sf-btn sf-btn-primary sf-btn-lg sf-btn-block"
              >
                {!cartLoaded ? "Loading…" : !lines.length ? "Add an item first" : pending ? "Sending…" : quotePending ? "Pricing…" : quote ? (
                  <>
                    <span>{onlinePayment && payOnline ? "Place order and pay" : "Place pickup order"}</span>
                    <span className="sf-btn-price">{formatMoney(quote.total, currency)}</span>
                  </>
                ) : "Price unavailable"}
              </button>
            ) : null}
          </form>

          {quoteError && !attempt ? (
            <div className="sf-alert-error" role="alert">
              <p>{quoteError}</p>
              <button type="button" className="mt-1 inline-flex min-h-11 items-center font-semibold underline underline-offset-4" onClick={() => setQuoteRetry((value) => value + 1)}>Try pricing again</button>
            </div>
          ) : null}
          {error ? <div ref={errorRef} tabIndex={-1} className="sf-alert-error" role="alert">{error}</div> : null}
        </aside>
      </div>
    </main>
  );
}
