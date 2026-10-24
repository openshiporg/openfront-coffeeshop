"use client";

import * as React from "react";
import { startOnlinePayment } from "@/features/storefront/lib/data/payment";

const FAILED = "Online payment couldn't start. Try again or pay at pickup.";

/** "Pay online" on an unpaid receipt, plus the state after returning from the card page. */
export function ReceiptPayOnline({ orderId, secretKey, returned }: { orderId: string; secretKey?: string; returned?: "done" | "cancelled" | null }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [processing, setProcessing] = React.useState(returned === "done");
  // One key per visit, so a double tap reuses the same card page.
  const key = React.useRef<string | null>(null);

  async function pay() {
    if (pending) return;
    setPending(true);
    setError(null);
    try {
      key.current = key.current || crypto.randomUUID();
      const result = await startOnlinePayment(orderId, secretKey, key.current);
      if (result.checkoutUrl) {
        window.location.assign(result.checkoutUrl);
        return;
      }
      if ("processing" in result && result.processing) setProcessing(true);
      else setError(result.error || FAILED);
    } catch {
      setError(FAILED);
    }
    setPending(false);
  }

  if (processing) {
    return (
      <p className="sf-status mt-3 text-sm" role="status">
        <span className="sf-dot sf-dot-active" aria-hidden="true" />
        Payment processing
      </p>
    );
  }
  return (
    <div className="mt-3 grid gap-2">
      {returned === "cancelled" ? <p className="sf-muted text-sm" role="status">Payment not completed</p> : null}
      <button type="button" className="sf-btn sf-btn-ink sf-btn-block" disabled={pending} onClick={pay}>
        {pending ? "Opening…" : "Pay online"}
      </button>
      {error ? <p className="sf-field-error" role="alert">{error}</p> : null}
    </div>
  );
}
