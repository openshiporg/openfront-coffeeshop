"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { adjustLoyaltyAccountAction } from "../actions/loyalty";
import {
  LOYALTY_STATUS_LABELS,
  LOYALTY_TIER_LABELS,
  LOYALTY_TIERS,
  parseSignedWhole,
  previewLoyaltyAdjustment,
  type LoyaltyStatus,
} from "../lib/loyaltyView";

type Account = { id: string; displayName: string; status: string; tier: string; pointsBalance: number; drinkCredits: number };
type Change = { kind: "status"; status: LoyaltyStatus } | { kind: "tier"; tier: string };

const STATUS_ACTIONS: Record<string, Array<{ status: LoyaltyStatus; label: string; destructive?: boolean }>> = {
  active: [{ status: "paused", label: "Pause" }, { status: "closed", label: "Close", destructive: true }],
  paused: [{ status: "active", label: "Reactivate" }, { status: "closed", label: "Close", destructive: true }],
  closed: [{ status: "active", label: "Reactivate" }],
};

function newKey() {
  return crypto.randomUUID();
}

function FieldError({ id, message }: { id: string; message?: string | null }) {
  return <p id={id} className="text-sm text-destructive empty:hidden">{message || ""}</p>;
}

function NoteField({ id, value, onChange, error, disabled }: { id: string; value: string; onChange: (value: string) => void; error?: string | null; disabled?: boolean }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>Note</Label>
      <Textarea id={id} value={value} maxLength={500} rows={3} disabled={disabled} aria-invalid={Boolean(error)} aria-describedby={`${id}-error`} onChange={(event) => onChange(event.target.value)} />
      <FieldError id={`${id}-error`} message={error} />
    </div>
  );
}

export function LoyaltyAccountActions({ account, canManage, autoOpenAdjust = false }: { account: Account; canManage: boolean; autoOpenAdjust?: boolean }) {
  const router = useRouter();

  // Adjust drawer
  const [adjustOpen, setAdjustOpen] = React.useState(false);
  const [points, setPoints] = React.useState("");
  const [credits, setCredits] = React.useState("");
  const [adjustNote, setAdjustNote] = React.useState("");
  const [adjustKey, setAdjustKey] = React.useState<string | null>(null);
  const [adjustTried, setAdjustTried] = React.useState(false);
  const [adjustError, setAdjustError] = React.useState<string | null>(null);
  const [adjustPending, setAdjustPending] = React.useState(false);

  // Status / tier confirm
  const [change, setChange] = React.useState<Change | null>(null);
  const [changeNote, setChangeNote] = React.useState("");
  const [changeKey, setChangeKey] = React.useState<string | null>(null);
  const [changeTried, setChangeTried] = React.useState(false);
  const [changeError, setChangeError] = React.useState<string | null>(null);
  const [changePending, setChangePending] = React.useState(false);

  // Opened from the Rewards list "Adjust" link: go straight to the adjustment form once.
  const autoOpened = React.useRef(false);
  React.useEffect(() => {
    if (!autoOpenAdjust || !canManage || autoOpened.current) return;
    autoOpened.current = true;
    openAdjust();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpenAdjust, canManage]);

  if (!canManage) return null;

  const pointsDelta = parseSignedWhole(points);
  const creditsDelta = parseSignedWhole(credits);
  const preview = pointsDelta !== null && creditsDelta !== null ? previewLoyaltyAdjustment(account, pointsDelta, creditsDelta) : null;
  const adjustFieldErrors = {
    points: pointsDelta === null ? "Enter a whole number" : null,
    credits: creditsDelta === null ? "Enter a whole number" : null,
    note: adjustNote.trim() ? null : "Enter a reason",
    total: pointsDelta === 0 && creditsDelta === 0 ? "Enter points or drink credits" : preview && !preview.ok ? preview.message : null,
  };
  const adjustValid = !adjustFieldErrors.points && !adjustFieldErrors.credits && !adjustFieldErrors.note && !adjustFieldErrors.total;

  function openAdjust() {
    setPoints("");
    setCredits("");
    setAdjustNote("");
    setAdjustTried(false);
    setAdjustError(null);
    setAdjustKey(newKey());
    setAdjustOpen(true);
  }

  async function submitAdjust(event: React.FormEvent) {
    event.preventDefault();
    setAdjustTried(true);
    if (!adjustValid || !adjustKey || adjustPending) return;
    setAdjustPending(true);
    setAdjustError(null);
    try {
      const result = await adjustLoyaltyAccountAction({ accountId: account.id, pointsDelta, drinkCreditsDelta: creditsDelta, note: adjustNote.trim(), idempotencyKey: adjustKey });
      if (result.success) {
        setAdjustOpen(false);
        router.refresh();
      } else {
        setAdjustError(result.error);
        // A domain refusal recorded nothing, so the corrected entry gets a fresh key.
        if (result.refused) setAdjustKey(newKey());
      }
    } catch {
      setAdjustError("Server unreachable. Submit again.");
    } finally {
      setAdjustPending(false);
    }
  }

  function openChange(next: Change) {
    setChange(next);
    setChangeNote("");
    setChangeTried(false);
    setChangeError(null);
    setChangeKey(newKey());
  }

  async function submitChange(event: React.FormEvent) {
    event.preventDefault();
    setChangeTried(true);
    if (!change || !changeKey || changePending || !changeNote.trim()) return;
    setChangePending(true);
    setChangeError(null);
    try {
      const result = await adjustLoyaltyAccountAction({
        accountId: account.id,
        status: change.kind === "status" ? change.status : null,
        tier: change.kind === "tier" ? change.tier : null,
        note: changeNote.trim(),
        idempotencyKey: changeKey,
      });
      if (result.success) {
        setChange(null);
        router.refresh();
      } else {
        setChangeError(result.error);
        if (result.refused) setChangeKey(newKey());
      }
    } catch {
      setChangeError("Server unreachable. Submit again.");
    } finally {
      setChangePending(false);
    }
  }

  const changeTitle = change?.kind === "status"
    ? `${STATUS_ACTIONS[account.status]?.find((action) => action.status === change.status)?.label || LOYALTY_STATUS_LABELS[change.status]} account`
    : change?.kind === "tier" ? `Change tier to ${LOYALTY_TIER_LABELS[change.tier] || change.tier}` : "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" className="min-h-10 rounded-[6px] active:scale-[0.97]" onClick={openAdjust}>Adjust</Button>
      {(STATUS_ACTIONS[account.status] || []).map((action) => (
        <Button
          key={action.status}
          type="button"
          variant="outline"
          className={`min-h-10 rounded-[6px] active:scale-[0.97] ${action.destructive ? "text-destructive hover:text-destructive" : ""}`}
          onClick={() => openChange({ kind: "status", status: action.status })}
        >
          {action.label}
        </Button>
      ))}
      <div className="min-w-[10rem]">
        <Label htmlFor="loyalty-tier" className="sr-only">Tier</Label>
        <Select value={account.tier} onValueChange={(tier) => { if (tier !== account.tier) openChange({ kind: "tier", tier }); }}>
          <SelectTrigger id="loyalty-tier" className="min-h-10 rounded-[6px] active:scale-[0.97]">
            <SelectValue placeholder="Tier" />
          </SelectTrigger>
          <SelectContent>
            {LOYALTY_TIERS.map((tier) => <SelectItem key={tier} value={tier}>{LOYALTY_TIER_LABELS[tier]}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Sheet open={adjustOpen} onOpenChange={(open) => { if (!adjustPending) setAdjustOpen(open); }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Adjust rewards</SheetTitle>
            <SheetDescription>{account.displayName}</SheetDescription>
          </SheetHeader>
          <form id="loyalty-adjust-form" className="space-y-4 px-4" onSubmit={submitAdjust} noValidate>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="loyalty-adjust-points">Points</Label>
                <Input id="loyalty-adjust-points" inputMode="numeric" placeholder="+0" value={points} disabled={adjustPending} aria-invalid={adjustTried && Boolean(adjustFieldErrors.points)} aria-describedby="loyalty-adjust-points-error" onChange={(event) => setPoints(event.target.value)} />
                <FieldError id="loyalty-adjust-points-error" message={adjustTried ? adjustFieldErrors.points : null} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="loyalty-adjust-credits">Drink credits</Label>
                <Input id="loyalty-adjust-credits" inputMode="numeric" placeholder="+0" value={credits} disabled={adjustPending} aria-invalid={adjustTried && Boolean(adjustFieldErrors.credits)} aria-describedby="loyalty-adjust-credits-error" onChange={(event) => setCredits(event.target.value)} />
                <FieldError id="loyalty-adjust-credits-error" message={adjustTried ? adjustFieldErrors.credits : null} />
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-[6px] bg-muted/60 px-3 py-2">
                <dt className="text-xs text-muted-foreground">Points after</dt>
                <dd className="font-semibold tabular-nums">{preview?.ok ? `${preview.pointsBalance}/100` : "—"}</dd>
              </div>
              <div className="rounded-[6px] bg-muted/60 px-3 py-2">
                <dt className="text-xs text-muted-foreground">Drink credits after</dt>
                <dd className="font-semibold tabular-nums">{preview?.ok ? preview.drinkCredits : "—"}</dd>
              </div>
            </dl>
            <FieldError id="loyalty-adjust-total-error" message={adjustTried || (preview && !preview.ok) ? adjustFieldErrors.total : null} />
            <NoteField id="loyalty-adjust-note" value={adjustNote} onChange={setAdjustNote} error={adjustTried ? adjustFieldErrors.note : null} disabled={adjustPending} />
            <p role="alert" aria-live="assertive" className="text-sm text-destructive empty:hidden">{adjustError || ""}</p>
          </form>
          <SheetFooter>
            <Button type="submit" form="loyalty-adjust-form" className="min-h-10 rounded-[6px] active:scale-[0.97]" disabled={adjustPending}>{adjustPending ? "Saving…" : "Save adjustment"}</Button>
            <Button type="button" variant="outline" className="min-h-10 rounded-[6px] active:scale-[0.97]" disabled={adjustPending} onClick={() => setAdjustOpen(false)}>Cancel</Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog open={change !== null} onOpenChange={(open) => { if (!open && !changePending) setChange(null); }}>
        <DialogContent>
          <form onSubmit={submitChange} noValidate className="space-y-4">
            <DialogHeader>
              <DialogTitle>{changeTitle}</DialogTitle>
              <DialogDescription>{account.displayName}</DialogDescription>
            </DialogHeader>
            <NoteField id="loyalty-change-note" value={changeNote} onChange={setChangeNote} error={changeTried && !changeNote.trim() ? "Enter a reason" : null} disabled={changePending} />
            <p role="alert" aria-live="assertive" className="text-sm text-destructive empty:hidden">{changeError || ""}</p>
            <DialogFooter>
              <Button type="button" variant="outline" className="rounded-[6px]" disabled={changePending} onClick={() => setChange(null)}>Cancel</Button>
              <Button type="submit" className="rounded-[6px]" variant={change?.kind === "status" && change.status === "closed" ? "destructive" : "default"} disabled={changePending}>
                {changePending ? "Saving…" : "Confirm"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
