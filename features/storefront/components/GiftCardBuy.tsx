"use client";

import * as React from "react";
import { startGiftCardCheckout } from "@/features/storefront/lib/data/giftCards";
import { prepareCardPage } from "@/features/storefront/lib/checkout/cardPage";
import { formatMoney } from "@/features/storefront/lib/format";

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}-gift`;
}

/** Amount, who it's for, a note, then Stripe's hosted page. The card activates once Stripe confirms. */
export function GiftCardBuy({ amounts, currencyCode, customer }: { amounts: number[]; currencyCode: string; customer?: { name?: string | null; email?: string | null } | null }) {
  const [amount, setAmount] = React.useState(amounts[1] ?? amounts[0] ?? 0);
  const [forSomeoneElse, setForSomeoneElse] = React.useState(true);
  const [purchaserName, setPurchaserName] = React.useState(customer?.name || "");
  const [purchaserEmail, setPurchaserEmail] = React.useState(customer?.email || "");
  const [recipientName, setRecipientName] = React.useState("");
  const [recipientEmail, setRecipientEmail] = React.useState("");
  const [message, setMessage] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const keyRef = React.useRef("");
  const errorRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => { keyRef.current = newKey(); }, []);
  React.useEffect(() => { if (error) errorRef.current?.focus(); }, [error]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const card = prepareCardPage();
    setPending(true);
    setError(null);
    const result = await startGiftCardCheckout({
      amount,
      purchaserName: purchaserName.trim(),
      purchaserEmail: purchaserEmail.trim(),
      ...(forSomeoneElse ? { recipientName: recipientName.trim(), recipientEmail: recipientEmail.trim(), message: message.trim() } : {}),
      idempotencyKey: keyRef.current,
    }).catch(() => ({ checkoutUrl: null, error: "Gift cards couldn't start. Try again." }));
    if (result.checkoutUrl) {
      card.go(result.checkoutUrl);
      if (window.top === window.self) return;
    } else {
      card.cancel();
    }
    keyRef.current = newKey();
    setPending(false);
    setError(result.error);
  }

  return (
    <form className="sf-form-stack" onSubmit={submit}>
      <fieldset disabled={pending} className="grid gap-4">
        <div className="sf-form-label">
          <span id="gift-amount-label">Amount</span>
          <div className="sf-track sf-track-fill" role="group" aria-labelledby="gift-amount-label">
            {amounts.map((value) => (
              <button key={value} type="button" className="sf-track-item" aria-pressed={amount === value} onClick={() => setAmount(value)}>
                {formatMoney(value, currencyCode).replace(/\.00$/, "")}
              </button>
            ))}
          </div>
        </div>
        <div className="sf-form-label">
          <span id="gift-for-label">Who is it for</span>
          <div className="sf-track sf-track-fill" role="group" aria-labelledby="gift-for-label">
            <button type="button" className="sf-track-item" aria-pressed={forSomeoneElse} onClick={() => setForSomeoneElse(true)}>Someone else</button>
            <button type="button" className="sf-track-item" aria-pressed={!forSomeoneElse} onClick={() => setForSomeoneElse(false)}>Me</button>
          </div>
        </div>
        {forSomeoneElse ? (
          <>
            <label htmlFor="gift-recipient-name" className="sf-form-label">
              Their name
              <input id="gift-recipient-name" value={recipientName} onChange={(e) => setRecipientName(e.target.value)} required maxLength={120} autoComplete="off" className="sf-field" />
            </label>
            <label htmlFor="gift-recipient-email" className="sf-form-label">
              Their email
              <input id="gift-recipient-email" type="email" value={recipientEmail} onChange={(e) => setRecipientEmail(e.target.value)} required maxLength={320} autoComplete="off" className="sf-field" />
            </label>
            <label htmlFor="gift-message" className="sf-form-label">
              <span>Note <span className="sf-optional">optional</span></span>
              <textarea id="gift-message" value={message} onChange={(e) => setMessage(e.target.value)} maxLength={300} className="sf-field" />
            </label>
          </>
        ) : null}
        <label htmlFor="gift-purchaser-name" className="sf-form-label">
          Your name
          <input id="gift-purchaser-name" value={purchaserName} onChange={(e) => setPurchaserName(e.target.value)} required maxLength={120} autoComplete="name" className="sf-field" />
        </label>
        <label htmlFor="gift-purchaser-email" className="sf-form-label">
          Your email
          <input id="gift-purchaser-email" type="email" value={purchaserEmail} onChange={(e) => setPurchaserEmail(e.target.value)} required maxLength={320} autoComplete="email" className="sf-field" />
        </label>
      </fieldset>
      <button type="submit" disabled={pending || !amount} className="sf-btn sf-btn-primary sf-btn-lg sf-btn-block">
        <span>{pending ? "Opening secure payment…" : "Buy gift card"}</span>
        <span className="sf-btn-price">{formatMoney(amount, currencyCode)}</span>
      </button>
      <p className="sf-fine">You pay on Stripe’s secure page. {forSomeoneElse ? "We email the code to them as soon as the payment clears." : "We email you the code as soon as the payment clears."}</p>
      {error ? <div ref={errorRef} tabIndex={-1} className="sf-alert-error" role="alert">{error}</div> : null}
    </form>
  );
}
