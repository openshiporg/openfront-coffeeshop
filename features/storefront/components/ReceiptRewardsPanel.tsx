"use client";

import * as React from "react";
import { applyCafeLoyalty, type CafeLoyaltyAccount } from "@/features/storefront/lib/data/loyalty";

const FAILED = "Rewards couldn’t be applied. Try again.";

/** "Add to rewards" on a settled receipt, or "Rewards applied" once the order is linked. */
export function ReceiptRewardsPanel({ orderId, secretKey, customerEmail, linked }: { orderId: string; secretKey?: string; customerEmail: string; linked: boolean }) {
  const [email, setEmail] = React.useState(customerEmail);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [account, setAccount] = React.useState<CafeLoyaltyAccount | null>(null);
  const errorRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = email.trim();
    if (pending) return;
    if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Enter a valid email");
      return;
    }
    setPending(true);
    setError(null);
    try {
      const result = await applyCafeLoyalty({ orderId, secretKey: secretKey || undefined, customerEmail: value });
      if (result.success && result.account) setAccount(result.account);
      else setError((!result.success && result.customerMessage) || FAILED);
    } catch {
      setError(FAILED);
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="sf-receipt-rewards" aria-labelledby="receipt-rewards-title">
      {account ? (
        <>
          <h2 id="receipt-rewards-title" className="sf-box-label sf-status">
            <span className="sf-dot sf-dot-ready" aria-hidden="true" />
            Rewards applied
          </h2>
          <p className="sf-rewards-line">
            <span className="sf-marker">{account.pointsBalance || 0}</span> of 100 points toward your next drink credit
          </p>
          <p className="sf-rewards-line">
            {account.drinkCredits ? <><span className="sf-marker">{account.drinkCredits}</span> {account.drinkCredits === 1 ? "drink credit" : "drink credits"} saved</> : "No drink credits saved yet"}
          </p>
        </>
      ) : linked ? (
        <h2 id="receipt-rewards-title" className="sf-box-label sf-status">
          <span className="sf-dot sf-dot-ready" aria-hidden="true" />
          Rewards applied
        </h2>
      ) : (
        <>
          <h2 id="receipt-rewards-title" className="sf-box-label">Rewards</h2>
          <form className="sf-form-stack" onSubmit={submit} noValidate>
            <label htmlFor="receipt-rewards-email" className="sf-form-label">
              Order email
              <input
                id="receipt-rewards-email"
                type="email"
                autoComplete="email"
                maxLength={320}
                required
                value={email}
                disabled={pending}
                onChange={(e) => { setEmail(e.target.value); setError(null); }}
                className="sf-field"
              />
            </label>
            <button type="submit" disabled={pending} className="sf-btn sf-btn-ink sf-btn-block">
              {pending ? "Adding…" : "Add to rewards"}
            </button>
          </form>
          {error ? <div ref={errorRef} tabIndex={-1} className="sf-alert-error" role="alert">{error}</div> : null}
        </>
      )}
    </section>
  );
}
