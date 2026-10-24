"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { transitionCateringOrderAction, updateCateringFactsAction, updateCateringNotesAction, updateCateringQuoteAction } from "../actions/catering";
import { CATERING_NEXT, CATERING_TRANSITION_LABELS } from "../lib/catering";
import { parseDollars } from "../lib/store-time";
import { CateringFactsForm, type CateringFactsDraft } from "./CateringFactsForm";

function ErrorText({ message }: { message: string | null }) {
  return <p role="alert" aria-live="assertive" className={message ? "text-sm text-destructive" : "sr-only"}>{message || ""}</p>;
}

export function EditCateringFactsSheet({ orderId, initial, timezone, disabled }: { orderId: string; initial: CateringFactsDraft; timezone: string; disabled: boolean }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button variant="outline" size="sm" className="rounded-full" disabled={disabled} onClick={() => setOpen(true)}><Pencil aria-hidden="true" />Edit</Button>
      <SheetContent aria-describedby={undefined} className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader><SheetTitle>Edit event</SheetTitle></SheetHeader>
        <div className="mt-4">
          {open ? (
            <CateringFactsForm
              idPrefix="edit-catering"
              initial={initial}
              timezone={timezone}
              withNotes={false}
              submitLabel="Save"
              onSubmit={(draft) => updateCateringFactsAction(orderId, draft)}
              onDone={() => { setOpen(false); router.refresh(); }}
            />
          ) : null}
        </div>
      </SheetContent>
    </Sheet>
  );
}

export function QuoteEditor({ orderId, subtotalCents, editable }: { orderId: string; subtotalCents: number; editable: boolean }) {
  const router = useRouter();
  const [value, setValue] = React.useState(subtotalCents > 0 ? (subtotalCents / 100).toFixed(2) : "");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const dirty = value.trim() !== (subtotalCents > 0 ? (subtotalCents / 100).toFixed(2) : "");

  async function save(event: React.FormEvent) {
    event.preventDefault();
    const parsed = parseDollars(value);
    if (!parsed.ok) { setError(parsed.error); return; }
    setPending(true);
    setError(null);
    const result = await updateCateringQuoteAction(orderId, value);
    setPending(false);
    if (!result.success) { setError(result.error); return; }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={save} noValidate className="grid gap-1.5">
      <Label htmlFor="catering-quote">Quote amount</Label>
      <div className="flex items-center gap-2">
        <Input
          id="catering-quote"
          inputMode="decimal"
          value={value}
          placeholder="0.00"
          disabled={!editable || pending}
          aria-invalid={error ? true : undefined}
          onChange={(event) => { setValue(event.target.value); setError(null); setSaved(false); }}
          className="max-w-40 tabular-nums"
        />
        <Button type="submit" variant="outline" size="sm" className="rounded-full" disabled={!editable || pending || !dirty}>{pending ? "Saving…" : "Save"}</Button>
        {saved && !dirty ? <span role="status" className="text-xs text-muted-foreground">Saved</span> : null}
      </div>
      {!editable ? <p className="text-xs text-muted-foreground">Locked after the quote is sent.</p> : null}
      <ErrorText message={error} />
    </form>
  );
}

export function NotesEditor({ orderId, notes, disabled }: { orderId: string; notes: string; disabled: boolean }) {
  const router = useRouter();
  const [value, setValue] = React.useState(notes);
  const [error, setError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const dirty = value !== notes;

  async function save(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    const result = await updateCateringNotesAction(orderId, value);
    setPending(false);
    if (!result.success) { setError(result.error); return; }
    setSaved(true);
    router.refresh();
  }

  return (
    <form onSubmit={save} className="grid gap-2">
      <Label htmlFor="catering-notes" className="sr-only">Notes</Label>
      <Textarea id="catering-notes" rows={4} maxLength={5000} value={value} disabled={disabled || pending} onChange={(event) => { setValue(event.target.value); setSaved(false); }} />
      <div className="flex items-center gap-2">
        <Button type="submit" variant="outline" size="sm" className="rounded-full" disabled={disabled || pending || !dirty}>{pending ? "Saving…" : "Save notes"}</Button>
        {saved && !dirty ? <span role="status" className="text-xs text-muted-foreground">Saved</span> : null}
      </div>
      <ErrorText message={error} />
    </form>
  );
}

export function CateringTransitions({ orderId, status, subtotalCents }: { orderId: string; status: string; subtotalCents: number }) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const next = CATERING_NEXT[status] || [];
  if (!next.length) return null;

  async function run(target: string) {
    setPending(target);
    setError(null);
    const result = await transitionCateringOrderAction(orderId, target);
    setPending(null);
    setConfirmCancel(false);
    if (!result.success) { setError(result.error); return; }
    router.refresh();
  }

  const needsQuote = subtotalCents <= 0;
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {next.filter((target) => target !== "cancelled").map((target) => (
          <Button key={target} className="rounded-full" disabled={Boolean(pending) || (target === "quoted" && needsQuote)} onClick={() => run(target)}>
            {pending === target ? "Saving…" : CATERING_TRANSITION_LABELS[target]}
          </Button>
        ))}
        {next.includes("cancelled") ? (
          <Button variant="outline" className="rounded-full text-destructive" disabled={Boolean(pending)} onClick={() => setConfirmCancel(true)}>Cancel order</Button>
        ) : null}
      </div>
      {next.includes("quoted") && needsQuote ? <p className="text-xs text-muted-foreground">Quote amount required.</p> : null}
      <ErrorText message={error} />
      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this catering order?</AlertDialogTitle>
            <AlertDialogDescription>Cancelled orders can't be reopened.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending === "cancelled"}>Keep order</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending === "cancelled"}
              onClick={(event) => { event.preventDefault(); void run("cancelled"); }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {pending === "cancelled" ? "Cancelling…" : "Cancel order"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
