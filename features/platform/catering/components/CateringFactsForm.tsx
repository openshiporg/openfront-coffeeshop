"use client";

import * as React from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatStoreDateTime, storeZoneAbbreviation } from "@/lib/date-time";
import type { ActionResult, CateringFactsInput } from "../lib/catering";
import { EMAIL_PATTERN, storeLocalToInstant } from "../lib/store-time";

export type CateringFactsDraft = CateringFactsInput & { notes: string };

type Errors = Partial<Record<keyof CateringFactsDraft | "form", string>>;

function validate(draft: CateringFactsDraft, timezone: string): Errors {
  const errors: Errors = {};
  if (!draft.customerName.trim()) errors.customerName = "Customer name is required.";
  if (draft.customerEmail.trim() && !EMAIL_PATTERN.test(draft.customerEmail.trim())) errors.customerEmail = "Enter a valid email.";
  if (draft.eventAtLocal) {
    const resolved = storeLocalToInstant(draft.eventAtLocal, timezone);
    if (!resolved.ok) errors.eventAtLocal = resolved.error;
  }
  if (draft.guestCount.trim() && !/^\d{1,6}$/.test(draft.guestCount.trim())) errors.guestCount = "Guests must be a whole number.";
  return errors;
}

const SERVER_FIELD: Record<string, keyof CateringFactsDraft> = {
  customerName: "customerName", customerEmail: "customerEmail", eventAt: "eventAtLocal", guestCount: "guestCount", notes: "notes",
};

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p id={id} role="alert" className="text-xs text-destructive">{message}</p> : null;
}

/** Customer and event facts, shared by the create and edit drawers. */
export function CateringFactsForm({
  idPrefix,
  initial,
  timezone,
  withNotes,
  submitLabel,
  onSubmit,
  onDone,
}: {
  idPrefix: string;
  initial: CateringFactsDraft;
  timezone: string;
  withNotes: boolean;
  submitLabel: string;
  onSubmit: (draft: CateringFactsDraft) => Promise<ActionResult>;
  onDone: () => void;
}) {
  const [draft, setDraft] = React.useState(initial);
  const [errors, setErrors] = React.useState<Errors>({});
  const [pending, setPending] = React.useState(false);
  const set = (key: keyof CateringFactsDraft) => (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = event.target.value;
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined, form: undefined }));
  };
  const resolved = draft.eventAtLocal ? storeLocalToInstant(draft.eventAtLocal, timezone) : null;
  const zone = storeZoneAbbreviation(timezone);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found = validate(draft, timezone);
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    setPending(true);
    const result = await onSubmit(draft);
    setPending(false);
    if (!result.success) {
      const field = result.field ? SERVER_FIELD[result.field] : undefined;
      setErrors(field ? { [field]: result.error } : { form: result.error });
      return;
    }
    onDone();
  }

  const field = (key: keyof CateringFactsDraft) => ({
    id: `${idPrefix}-${key}`,
    value: draft[key],
    onChange: set(key),
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${idPrefix}-${key}-error` : undefined,
  });

  return (
    <form onSubmit={submit} noValidate className="grid gap-4">
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-customerName`}>Customer name</Label>
        <Input {...field("customerName")} autoComplete="off" maxLength={200} required />
        <FieldError id={`${idPrefix}-customerName-error`} message={errors.customerName} />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-customerEmail`}>Email</Label>
          <Input {...field("customerEmail")} type="email" autoComplete="off" />
          <FieldError id={`${idPrefix}-customerEmail-error`} message={errors.customerEmail} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-customerPhone`}>Phone</Label>
          <Input {...field("customerPhone")} type="tel" autoComplete="off" maxLength={40} />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-eventAtLocal`}>Event time{zone ? ` (${zone})` : ""}</Label>
          <Input {...field("eventAtLocal")} type="datetime-local" />
          {resolved?.ok ? <p className="text-xs text-muted-foreground">{formatStoreDateTime(resolved.iso, timezone)}</p> : null}
          <FieldError id={`${idPrefix}-eventAtLocal-error`} message={errors.eventAtLocal} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-guestCount`}>Guests</Label>
          <Input {...field("guestCount")} inputMode="numeric" />
          <FieldError id={`${idPrefix}-guestCount-error`} message={errors.guestCount} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor={`${idPrefix}-deliveryAddress`}>Delivery address</Label>
        <Textarea {...field("deliveryAddress")} rows={2} maxLength={500} />
      </div>
      {withNotes ? (
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-notes`}>Notes</Label>
          <Textarea {...field("notes")} rows={3} maxLength={5000} />
          <FieldError id={`${idPrefix}-notes-error`} message={errors.notes} />
        </div>
      ) : null}
      {errors.form ? <p role="alert" className="rounded-[6px] border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{errors.form}</p> : null}
      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={pending}>{pending ? "Saving…" : submitLabel}</Button>
      </div>
    </form>
  );
}
