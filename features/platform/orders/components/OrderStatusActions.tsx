"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptCafePickupOrderAction, applyOrderLoyaltyAction, recordCafePaymentAction, refundCafePaymentAction, updateCafeOrderStatusAction } from "../actions/order-status";
import { clearCommandIntent, newCommandKey, readCommandIntent, writeCommandIntent } from "../lib/commandIntent";

type StatusAction = { label: string; status: string; tone?: string };

function money(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function ActionError({ message }: { message: string | null }) {
  return (
    <p role="alert" aria-live="assertive" className={message ? "text-sm text-destructive" : "sr-only"}>
      {message || ""}
    </p>
  );
}

export function OrderStatusActions({ orderId, actions }: { orderId: string; actions: StatusAction[] }) {
  const router = useRouter();
  const [pendingStatus, setPendingStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  if (!actions.length) return null;

  async function run(nextStatus: string) {
    setPendingStatus(nextStatus);
    setError(null);
    const response = await updateCafeOrderStatusAction(orderId, nextStatus);
    setPendingStatus(null);
    if (!response.success) {
      setError(response.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <Button
            key={action.status}
            type="button"
            variant={action.tone === "danger" ? "ghost" : "default"}
            className={action.tone === "danger" ? "min-h-10 rounded-full text-destructive" : "min-h-10 flex-1 rounded-full sm:flex-none"}
            disabled={Boolean(pendingStatus)}
            onClick={() => run(action.status)}
          >
            {pendingStatus === action.status ? "Updating…" : action.label}
          </Button>
        ))}
      </div>
      <ActionError message={error} />
    </div>
  );
}

export function AcceptPickupAction({ orderId }: { orderId: string }) {
  const router = useRouter();
  const storageKey = `coffee-accept-order:${orderId}`;
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  async function accept() {
    setPending(true);
    setError(null);
    // Retries (including after reload) reuse the original key until the acceptance is confirmed.
    const intent = readCommandIntent(storageKey) ?? { idempotencyKey: newCommandKey() };
    writeCommandIntent(storageKey, intent);
    const response = await acceptCafePickupOrderAction(orderId, intent.idempotencyKey);
    setPending(false);
    if (!response.success) return setError(response.error);
    clearCommandIntent(storageKey);
    router.refresh();
  }
  return (
    <div className="space-y-2">
      <Button type="button" className="min-h-10 w-full rounded-full sm:w-auto" disabled={pending} onClick={accept}>{pending ? "Accepting…" : "Accept unpaid pickup"}</Button>
      <ActionError message={error} />
    </div>
  );
}

type PaymentIntent = { method: "cash" | "card"; externalCardReference?: string };
const TERMINAL_REFERENCE_PATTERN = /^[A-Za-z0-9#._:\/-]{4,64}$/;

export function RecordPaymentActions({ orderId, total }: { orderId: string; total: number }) {
  const router = useRouter();
  const storageKey = `coffee-record-payment:${orderId}`;
  const [pendingMethod, setPendingMethod] = React.useState<"cash" | "card" | null>(null);
  const [confirmCard, setConfirmCard] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [unresolved, setUnresolved] = React.useState<PaymentIntent | null>(null);
  const [terminalReference, setTerminalReference] = React.useState("");
  const [terminalApproved, setTerminalApproved] = React.useState(false);
  const referenceId = `terminal-reference-${orderId}`;
  const approvedId = `terminal-approved-${orderId}`;
  const referenceValid = TERMINAL_REFERENCE_PATTERN.test(terminalReference.trim());

  React.useEffect(() => {
    const stored = readCommandIntent<PaymentIntent>(storageKey);
    setUnresolved(stored && (stored.method === "cash" || stored.method === "card") ? { method: stored.method, externalCardReference: stored.externalCardReference } : null);
    if (stored?.method === "card" && typeof stored.externalCardReference === "string") setTerminalReference(stored.externalCardReference);
  }, [storageKey]);

  async function record(method: "cash" | "card") {
    const externalCardReference = terminalReference.trim();
    if (method === "card" && (!terminalApproved || !TERMINAL_REFERENCE_PATTERN.test(externalCardReference))) return;
    setConfirmCard(false);
    setPendingMethod(method);
    setError(null);
    // One key per order payment: an unconfirmed attempt is retried with the same key, so a
    // committed payment is returned rather than recorded twice. A different tender or terminal
    // reference on that key is rejected.
    const stored = readCommandIntent<PaymentIntent>(storageKey);
    const intent: PaymentIntent & { idempotencyKey: string } = {
      idempotencyKey: stored?.idempotencyKey || newCommandKey(),
      method,
      ...(method === "card" ? { externalCardReference } : {}),
    };
    writeCommandIntent(storageKey, intent);
    const response = await recordCafePaymentAction(
      orderId,
      method,
      intent.idempotencyKey,
      method === "card" ? { externalCardReference, externalCardApproved: true } : undefined,
    );
    setPendingMethod(null);
    if (!response.success) {
      setUnresolved({ method, ...(method === "card" ? { externalCardReference } : {}) });
      setError(response.error);
      return;
    }
    setTerminalReference("");
    setTerminalApproved(false);
    clearCommandIntent(storageKey);
    setUnresolved(null);
    router.refresh();
  }

  return (
    <div className="space-y-2 rounded-lg bg-muted/50 p-2.5">
      <p className="px-0.5 text-xs font-medium text-muted-foreground">Take payment · <span className="tabular-nums text-foreground">{money(total)}</span></p>
      {unresolved ? (
        <p role="status" className="text-sm text-muted-foreground">
          {unresolved.method === "cash" ? "Cash" : "Card"} payment not confirmed. Retry it before choosing another tender.
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" className="min-h-10 rounded-full bg-background" disabled={pendingMethod !== null} onClick={() => record("cash")}>
          {pendingMethod === "cash" ? "Recording…" : unresolved?.method === "cash" ? "Retry cash payment" : "Record cash"}
        </Button>
        <Button type="button" variant="outline" className="min-h-10 rounded-full bg-background" disabled={pendingMethod !== null} onClick={() => { setTerminalApproved(false); setConfirmCard(true); }}>
          {pendingMethod === "card" ? "Recording…" : unresolved?.method === "card" ? "Retry card payment" : "Record card"}
        </Button>
      </div>
      <ActionError message={error} />
      <Dialog open={confirmCard} onOpenChange={setConfirmCard}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record external card payment</DialogTitle>
            <DialogDescription>
              Records {money(total)} approved on the external terminal. It does not charge the card.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor={referenceId}>Terminal approval code</Label>
              <Input
                id={referenceId}
                value={terminalReference}
                onChange={(event) => setTerminalReference(event.target.value)}
                autoComplete="off"
                maxLength={64}
                aria-invalid={terminalReference.trim() !== "" && !referenceValid}
                aria-describedby={`${referenceId}-hint`}
              />
              <p id={`${referenceId}-hint`} className="text-xs text-muted-foreground">4–64 characters: letters, numbers, # . _ : / -</p>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id={approvedId} checked={terminalApproved} onCheckedChange={(checked) => setTerminalApproved(checked === true)} />
              <Label htmlFor={approvedId}>The terminal approved {money(total)}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setConfirmCard(false)}>Cancel</Button>
            <Button type="button" disabled={!terminalApproved || !referenceValid} onClick={() => record("card")}>Record card payment</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ApplyLoyaltyAction({ orderId, customerEmail, customerName }: { orderId: string; customerEmail: string; customerName?: string | null }) {
  const router = useRouter();
  const [pending, setPending] = React.useState(false);
  const [message, setMessage] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  async function apply() {
    setPending(true);
    setMessage(null);
    setError(null);
    const response = await applyOrderLoyaltyAction(orderId, customerEmail, customerName);
    setPending(false);
    if (!response.success) return setError(response.error);
    setMessage(`Rewards applied · ${response.data.applyCafeLoyalty.pointsBalance} points`);
    router.refresh();
  }
  return (
    <div className="space-y-2">
      <Button type="button" size="sm" variant="ghost" className="rounded-full" disabled={pending} onClick={apply}>{pending ? "Applying…" : "Apply purchase to rewards"}</Button>
      <p role="status" aria-live="polite" className={message ? "text-sm text-muted-foreground" : "sr-only"}>{message || ""}</p>
      <ActionError message={error} />
    </div>
  );
}

type RefundablePayment = { id: string; method: string; provider?: string | null; amount: number };
type RefundIntent = { externalRefundReference: string };

export function RefundPaymentActions({ payments }: { payments: RefundablePayment[] }) {
  const router = useRouter();
  const [target, setTarget] = React.useState<RefundablePayment | null>(null);
  const [reference, setReference] = React.useState("");
  const [storedIntent, setStoredIntent] = React.useState<RefundIntent | null>(null);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  if (!payments.length) return null;

  const storageKeyFor = (paymentId: string) => `coffee-refund-intent:${paymentId}`;

  function open(payment: RefundablePayment) {
    const stored = readCommandIntent<RefundIntent>(storageKeyFor(payment.id));
    setStoredIntent(stored ? { externalRefundReference: String(stored.externalRefundReference || "") } : null);
    setReference(stored ? String(stored.externalRefundReference || "") : "");
    setError(null);
    setTarget(payment);
  }

  function editReference() {
    // An explicit change to the request starts a new refund request with a new key.
    if (target) clearCommandIntent(storageKeyFor(target.id));
    setStoredIntent(null);
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!target) return;
    // Online card payments refund through the processor; only external-terminal cards need a reference.
    const isCard = target.method === "card" && target.provider !== "pp_stripe_stripe";
    const externalRefundReference = isCard ? reference.trim() : "";
    if (isCard && externalRefundReference.length < 4) {
      setError("Enter the refund receipt or reference from the external terminal.");
      return;
    }
    const storageKey = storageKeyFor(target.id);
    // The original request (key + terminal reference) is kept until the ledger confirms it,
    // so a lost response is retried as the same refund without refunding on the terminal again.
    const stored = readCommandIntent<RefundIntent>(storageKey);
    const intent = stored && stored.externalRefundReference === externalRefundReference
      ? stored
      : { idempotencyKey: newCommandKey(), externalRefundReference };
    writeCommandIntent(storageKey, intent);
    setStoredIntent({ externalRefundReference });
    setPending(true);
    setError(null);
    const response = await refundCafePaymentAction(target.id, intent.idempotencyKey, externalRefundReference || undefined);
    setPending(false);
    if (!response.success) {
      setError(response.error);
      return;
    }
    clearCommandIntent(storageKey);
    setTarget(null);
    router.refresh();
  }

  const isOnline = target?.provider === "pp_stripe_stripe";
  const isCard = target?.method === "card" && !isOnline;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {payments.map((payment) => (
          <Button key={payment.id} type="button" size="sm" variant="ghost" className="rounded-full text-destructive" onClick={() => open(payment)}>
            {`${payment.provider === "pp_stripe_stripe" ? "Refund to card" : payment.method === "card" ? "Record external card refund" : "Refund cash"} · ${money(payment.amount)}`}
          </Button>
        ))}
      </div>
      <Dialog open={Boolean(target)} onOpenChange={(next) => { if (!next && !pending) setTarget(null); }}>
        <DialogContent>
          <form onSubmit={submit} className="space-y-4">
            <DialogHeader>
              <DialogTitle>{isOnline ? "Refund to card" : isCard ? "Record external card refund" : "Refund cash"}</DialogTitle>
              <DialogDescription>
                {isOnline
                  ? `Full refund of ${target ? money(target.amount) : ""} to the card paid online. This cannot be undone.`
                  : isCard
                  ? `Refund ${target ? money(target.amount) : ""} on the external terminal first. Recording here does not move card funds.`
                  : `Full cash refund of ${target ? money(target.amount) : ""} from the open register. This cannot be undone.`}
              </DialogDescription>
            </DialogHeader>
            {storedIntent ? (
              <p role="status" className="text-sm text-muted-foreground">
                Previous attempt not confirmed. Retry with the same details; don’t refund on the terminal again.
              </p>
            ) : null}
            {isCard ? (
              <div className="space-y-1.5">
                <Label htmlFor="refund-terminal-reference">Terminal refund reference</Label>
                <Input
                  id="refund-terminal-reference"
                  value={reference}
                  onChange={(event) => setReference(event.target.value)}
                  readOnly={Boolean(storedIntent)}
                  maxLength={200}
                  autoComplete="off"
                  required
                />
                {storedIntent ? <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={editReference}>Change reference</Button> : null}
              </div>
            ) : null}
            <ActionError message={error} />
            <DialogFooter>
              <Button type="button" variant="outline" disabled={pending} onClick={() => setTarget(null)}>Cancel</Button>
              <Button type="submit" variant="destructive" disabled={pending}>
                {pending ? "Recording…" : storedIntent ? "Retry refund" : isOnline ? "Refund to card" : isCard ? "Record refund" : "Refund cash"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
