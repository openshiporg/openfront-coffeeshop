"use client";

import * as React from "react";
import { lookupCafeLoyalty, type CafeLoyaltyAccount } from "@/features/storefront/lib/data/loyalty";

type Props = {
  email: string;
  orderId?: string;
  secretKey?: string;
  onApplyEmail?: (email: string) => void;
};

export function LoyaltyLookup({ email, orderId, secretKey, onApplyEmail }: Props) {
  const [lookupEmail, setLookupEmail] = React.useState(email);
  const [pending, setPending] = React.useState(false);
  const [account, setAccount] = React.useState<CafeLoyaltyAccount | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    setLookupEmail(email);
  }, [email]);

  async function lookup() {
    if (!lookupEmail.trim()) return;
    setPending(true);
    setError(null);
    const result = await lookupCafeLoyalty(lookupEmail, orderId, secretKey);
    setPending(false);
    if (!result.success) {
      setError(result.error);
      return;
    }
    setAccount(result.account);
    onApplyEmail?.(lookupEmail);
  }

  return (
    <div className="sf-panel-inset">
      <p className="text-sm font-semibold">House rewards</p>
      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1 space-y-1 text-sm font-medium">
          Loyalty email
          <input
            value={lookupEmail}
            onChange={(event) => setLookupEmail(event.target.value)}
            className="sf-field"
            placeholder="you@example.com"
          />
        </label>
        <button
          type="button"
          onClick={lookup}
          disabled={pending || !lookupEmail.trim() || !orderId || !secretKey}
          className="sf-btn sf-btn-ghost"
        >
          {pending ? "Checking…" : "Check rewards"}
        </button>
      </div>
      {account ? (
        <div className="mt-3 border border-[var(--sf-rule)] bg-[var(--sf-paper)] p-3 text-sm">
          <p className="font-semibold">Rewards available for {account.customerEmail}</p>
          <p className="mt-1 text-[var(--sf-ink-muted)]">
            {account.pointsBalance || 0}/100 points toward the next drink · {account.drinkCredits || 0} drink credits
            available
          </p>
        </div>
      ) : (
        <p className="mt-3 text-sm leading-relaxed text-[var(--sf-ink-muted)]">
          Rewards lookup becomes available after the secure order id and key exist.
        </p>
      )}
      {error ? <p className="sf-alert-error mt-3">{error}</p> : null}
    </div>
  );
}
