"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { requestCafeCatering, type CafeCateringReceipt } from "@/features/storefront/lib/data/catering";
import type { CheckoutCustomer } from "@/features/storefront/lib/data/account";
import {
  CATERING_HORIZON_DAYS,
  CATERING_LEAD_HOURS,
  CATERING_MAX_GUESTS,
  formatCateringEventTime,
  toStoreLocalInput,
  validateCateringDraft,
  type CateringDraft,
  type CateringFieldErrors,
} from "@/features/storefront/lib/catering";

const UNCONFIRMED = "Request not confirmed. Try again; it won’t be sent twice.";

function newKey() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function emptyDraft(customer: CheckoutCustomer | null): CateringDraft {
  return {
    customerName: customer?.name || "",
    customerEmail: customer?.email || "",
    customerPhone: customer?.phone || "",
    eventLocal: "",
    guestCount: "",
    deliveryAddress: "",
    notes: "",
  };
}

export function CateringForm({ customer = null, timeZone, zoneLabel }: { customer?: CheckoutCustomer | null; timeZone: string; zoneLabel: string }) {
  const [draft, setDraft] = React.useState<CateringDraft>(() => emptyDraft(customer));
  const [fieldErrors, setFieldErrors] = React.useState<CateringFieldErrors>({});
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [receipt, setReceipt] = React.useState<CafeCateringReceipt | null>(null);
  const [bounds, setBounds] = React.useState<{ min: string; max: string } | null>(null);
  const keyRef = React.useRef<string>("");
  const refusedRef = React.useRef(false);
  const errorRef = React.useRef<HTMLDivElement>(null);
  const doneRef = React.useRef<HTMLHeadingElement>(null);

  React.useEffect(() => {
    keyRef.current = newKey();
    const now = Date.now();
    setBounds({
      min: toStoreLocalInput(new Date(now + CATERING_LEAD_HOURS * 3_600_000 + 60_000), timeZone),
      max: toStoreLocalInput(new Date(now + CATERING_HORIZON_DAYS * 86_400_000), timeZone),
    });
  }, [timeZone]);

  React.useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  React.useEffect(() => {
    if (receipt) doneRef.current?.focus();
  }, [receipt]);

  function update<K extends keyof CateringDraft>(key: K, value: string) {
    // Changed details after a refusal are a new attempt.
    if (refusedRef.current) {
      refusedRef.current = false;
      keyRef.current = newKey();
    }
    setDraft((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => (current[key] ? { ...current, [key]: undefined } : current));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const checked = validateCateringDraft(draft, timeZone);
    setFieldErrors(checked.errors);
    if (!checked.eventAt) {
      setError(null);
      return;
    }
    if (!keyRef.current) keyRef.current = newKey();
    setPending(true);
    setError(null);
    try {
      const result = await requestCafeCatering({
        customerName: draft.customerName.trim(),
        customerEmail: draft.customerEmail.trim(),
        customerPhone: draft.customerPhone.trim() || null,
        eventAt: checked.eventAt.toISOString(),
        guestCount: checked.guests,
        deliveryAddress: draft.deliveryAddress.trim() || null,
        notes: draft.notes.trim() || null,
        idempotencyKey: keyRef.current,
      });
      if (result.success) {
        setReceipt(result.receipt);
        keyRef.current = newKey();
        refusedRef.current = false;
      } else if (result.customerMessage) {
        refusedRef.current = true;
        setError(result.customerMessage);
      } else {
        setError(UNCONFIRMED);
      }
    } catch {
      setError(UNCONFIRMED);
    } finally {
      setPending(false);
    }
  }

  function startOver() {
    setReceipt(null);
    setDraft(emptyDraft(customer));
    setFieldErrors({});
    setError(null);
  }

  if (receipt) {
    return (
      <section className="sf-panel" aria-labelledby="catering-done-title">
        <h2 id="catering-done-title" ref={doneRef} tabIndex={-1} className="sf-display sf-status text-2xl outline-none">
          <span className="sf-dot sf-dot-active" aria-hidden="true" />
          Request sent
        </h2>
        <dl className="sf-catering-facts mt-4">
          <div>
            <dt className="sf-label">Request</dt>
            <dd className="sf-mono font-semibold [overflow-wrap:anywhere]">{receipt.cateringNumber}</dd>
          </div>
          <div>
            <dt className="sf-label">Event</dt>
            <dd className="font-semibold">{formatCateringEventTime(receipt.eventAt, timeZone)}</dd>
          </div>
          <div>
            <dt className="sf-label">Guests</dt>
            <dd className="sf-mono font-semibold">{receipt.guestCount}</dd>
          </div>
          {receipt.deliveryAddress ? (
            <div>
              <dt className="sf-label">Delivery</dt>
              <dd className="font-semibold [overflow-wrap:anywhere]">{receipt.deliveryAddress}</dd>
            </div>
          ) : null}
        </dl>
        <div className="mt-6 flex flex-wrap gap-3">
          {customer ? (
            <Link href="/account" className="sf-btn sf-btn-ghost">
              Account
              <ArrowUpRight className="size-4" aria-hidden="true" />
            </Link>
          ) : null}
          <button type="button" className="sf-btn sf-btn-ghost" onClick={startOver}>New request</button>
        </div>
      </section>
    );
  }

  const invalid = (key: keyof CateringDraft) => (fieldErrors[key] ? { "aria-invalid": true, "aria-describedby": `catering-${key}-error` } : {});
  const fieldError = (key: keyof CateringDraft) => fieldErrors[key] ? <span id={`catering-${key}-error`} className="sf-field-error">{fieldErrors[key]}</span> : null;

  return (
    <section className="sf-panel" aria-labelledby="catering-form-title">
      <h2 id="catering-form-title" className="sf-display text-xl">Event details</h2>
      <form className="mt-5 grid gap-4" onSubmit={submit} noValidate>
        <fieldset disabled={pending} className="grid gap-4">
          <div className="sf-catering-row">
            <label htmlFor="catering-name" className="sf-form-label">
              Name
              <input id="catering-name" value={draft.customerName} onChange={(e) => update("customerName", e.target.value)} autoComplete="name" required maxLength={200} className="sf-field" {...invalid("customerName")} />
              {fieldError("customerName")}
            </label>
            <label htmlFor="catering-email" className="sf-form-label">
              Email
              <input id="catering-email" type="email" value={draft.customerEmail} onChange={(e) => update("customerEmail", e.target.value)} autoComplete="email" required maxLength={320} className="sf-field" {...invalid("customerEmail")} />
              {fieldError("customerEmail")}
            </label>
          </div>
          <label htmlFor="catering-phone" className="sf-form-label">
            <span>Phone <span className="font-normal text-[var(--sf-ink-faint)]">optional</span></span>
            <input id="catering-phone" type="tel" inputMode="tel" value={draft.customerPhone} onChange={(e) => update("customerPhone", e.target.value)} autoComplete="tel" maxLength={50} className="sf-field" {...invalid("customerPhone")} />
            {fieldError("customerPhone")}
          </label>
          <div className="sf-catering-row">
            <label htmlFor="catering-event" className="sf-form-label">
              <span>Event date and time{zoneLabel ? <span className="font-normal text-[var(--sf-ink-faint)]"> {zoneLabel}</span> : null}</span>
              <input id="catering-event" type="datetime-local" step={900} value={draft.eventLocal} min={bounds?.min} max={bounds?.max} onChange={(e) => update("eventLocal", e.target.value)} required className="sf-field" {...invalid("eventLocal")} />
              {fieldError("eventLocal")}
            </label>
            <label htmlFor="catering-guests" className="sf-form-label">
              Guests
              <input id="catering-guests" type="number" inputMode="numeric" min={1} max={CATERING_MAX_GUESTS} step={1} value={draft.guestCount} onChange={(e) => update("guestCount", e.target.value)} required className="sf-field" {...invalid("guestCount")} />
              {fieldError("guestCount")}
            </label>
          </div>
          <label htmlFor="catering-address" className="sf-form-label">
            <span>Delivery address <span className="font-normal text-[var(--sf-ink-faint)]">optional</span></span>
            <textarea id="catering-address" rows={2} value={draft.deliveryAddress} onChange={(e) => update("deliveryAddress", e.target.value)} autoComplete="street-address" maxLength={500} className="sf-field" {...invalid("deliveryAddress")} />
            {fieldError("deliveryAddress")}
          </label>
          <label htmlFor="catering-notes" className="sf-form-label">
            <span>Notes <span className="font-normal text-[var(--sf-ink-faint)]">optional</span></span>
            <textarea id="catering-notes" value={draft.notes} onChange={(e) => update("notes", e.target.value)} maxLength={2000} className="sf-field" {...invalid("notes")} />
            {fieldError("notes")}
          </label>
        </fieldset>
        <button type="submit" disabled={pending} className="sf-btn sf-btn-primary sf-btn-lg sf-btn-block mt-1">
          {pending ? "Sending…" : "Send request"}
        </button>
      </form>
      {error ? <div ref={errorRef} tabIndex={-1} className="sf-alert-error mt-3" role="alert">{error}</div> : null}
    </section>
  );
}
