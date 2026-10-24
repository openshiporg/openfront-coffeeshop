"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { PillButton, PillTrack } from "@/features/platform/components/PillTabs";
import { parseDollars } from "@/features/platform/catering/lib/store-time";
import { cn } from "@/lib/utils";
import { createSubscriptionAction, searchLoyaltyAccountsAction } from "../actions/subscriptions";
import { BILLING_INTERVALS, INTERVAL_LABELS, defaultRenewal, type LoyaltyAccountOption, type SubscriptionInput } from "../lib/subscriptions";

type Errors = Partial<Record<keyof SubscriptionInput | "form", string>>;

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p id={id} role="alert" className="text-xs text-destructive">{message}</p> : null;
}

function AccountPicker({ selected, onSelect, error }: { selected: LoyaltyAccountOption | null; onSelect: (account: LoyaltyAccountOption | null) => void; error?: string }) {
  const [term, setTerm] = React.useState("");
  const [accounts, setAccounts] = React.useState<LoyaltyAccountOption[]>([]);
  const [state, setState] = React.useState<"idle" | "loading" | "error">("idle");
  const request = React.useRef(0);

  React.useEffect(() => {
    const id = ++request.current;
    setState("loading");
    const timer = window.setTimeout(async () => {
      const result = await searchLoyaltyAccountsAction(term);
      if (id !== request.current) return;
      if (!result.success) { setState("error"); setAccounts([]); return; }
      setAccounts(result.accounts);
      setState("idle");
    }, term ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [term]);

  return (
    <div className="grid gap-1.5">
      <Label htmlFor="new-subscription-account">Loyalty account</Label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
        <Input
          id="new-subscription-account"
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          placeholder="Name or email"
          className="pl-9"
          aria-invalid={error ? true : undefined}
          aria-controls="new-subscription-account-options"
        />
      </div>
      <ul id="new-subscription-account-options" role="listbox" aria-label="Loyalty accounts" className="max-h-56 divide-y divide-border overflow-y-auto rounded-md border border-border">
        {accounts.map((account) => {
          const active = selected?.id === account.id;
          return (
            <li key={account.id} role="option" aria-selected={active}>
              <button
                type="button"
                onClick={() => onSelect(active ? null : account)}
                className={cn("flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-muted/60 focus-visible:bg-muted/60 focus-visible:outline-none", active && "bg-muted")}
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">{account.displayName || "Guest account"}</span>
                  {account.customerEmail && account.customerEmail !== account.displayName ? <span className="block truncate text-xs text-muted-foreground">{account.customerEmail}</span> : null}
                </span>
                {active ? <Check className="size-4 shrink-0" aria-hidden="true" /> : null}
              </button>
            </li>
          );
        })}
        {!accounts.length ? (
          <li className="px-3 py-3 text-sm text-muted-foreground">{state === "loading" ? "Searching…" : state === "error" ? "Unable to load accounts." : "No accounts."}</li>
        ) : null}
      </ul>
      {selected ? <p className="text-xs text-muted-foreground">Selected: {selected.displayName || selected.customerEmail}</p> : null}
      <FieldError id="new-subscription-account-error" message={error} />
    </div>
  );
}

export function CreateSubscriptionSheet({ today }: { today: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [account, setAccount] = React.useState<LoyaltyAccountOption | null>(null);
  const [draft, setDraft] = React.useState({ planName: "", billingInterval: "monthly", price: "", startsOn: today, renewsOn: defaultRenewal(today, "monthly") });
  const [renewalTouched, setRenewalTouched] = React.useState(false);
  const [errors, setErrors] = React.useState<Errors>({});
  const [pending, setPending] = React.useState(false);

  function update(patch: Partial<typeof draft>, touchedRenewal = renewalTouched) {
    setDraft((current) => {
      const next = { ...current, ...patch };
      if (!touchedRenewal && (patch.startsOn !== undefined || patch.billingInterval !== undefined)) next.renewsOn = defaultRenewal(next.startsOn, next.billingInterval);
      return next;
    });
    setErrors((current) => ({ ...current, ...Object.fromEntries(Object.keys(patch).map((key) => [key, undefined])), form: undefined }));
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const found: Errors = {};
    if (!account) found.loyaltyAccountId = "Choose a loyalty account.";
    if (!draft.planName.trim()) found.planName = "Plan name is required.";
    const price = parseDollars(draft.price);
    if (!price.ok) found.price = price.error;
    if (!draft.startsOn) found.startsOn = "Start date is required.";
    if (!draft.renewsOn) found.renewsOn = "Renewal date is required.";
    else if (draft.startsOn && draft.renewsOn <= draft.startsOn) found.renewsOn = "Renewal must be after the start date.";
    setErrors(found);
    if (Object.values(found).some(Boolean)) return;
    setPending(true);
    const result = await createSubscriptionAction({ loyaltyAccountId: account!.id, ...draft });
    setPending(false);
    if (!result.success) {
      setErrors(result.field ? { [result.field]: result.error } : { form: result.error });
      return;
    }
    setOpen(false);
    setAccount(null);
    setRenewalTouched(false);
    setDraft({ planName: "", billingInterval: "monthly", price: "", startsOn: today, renewsOn: defaultRenewal(today, "monthly") });
    if (result.id) router.push(`/dashboard/platform/subscriptions/${result.id}`);
    else router.refresh();
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)} className="rounded-full"><Plus aria-hidden="true" />New subscription</Button>
      <SheetContent aria-describedby={undefined} className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader><SheetTitle>New subscription</SheetTitle></SheetHeader>
        <form onSubmit={submit} noValidate className="mt-4 grid gap-4">
          <AccountPicker selected={account} onSelect={(next) => { setAccount(next); setErrors((current) => ({ ...current, loyaltyAccountId: undefined })); }} error={errors.loyaltyAccountId} />
          <div className="grid gap-1.5">
            <Label htmlFor="new-subscription-plan">Plan name</Label>
            <Input id="new-subscription-plan" value={draft.planName} maxLength={120} onChange={(event) => update({ planName: event.target.value })} aria-invalid={errors.planName ? true : undefined} />
            <FieldError id="new-subscription-plan-error" message={errors.planName} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <span className="text-sm font-medium">Interval</span>
              <PillTrack label="Billing interval">
                {BILLING_INTERVALS.map((interval) => (
                  <PillButton key={interval} active={draft.billingInterval === interval} onClick={() => update({ billingInterval: interval })}>{INTERVAL_LABELS[interval]}</PillButton>
                ))}
              </PillTrack>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-subscription-price">Price</Label>
              <Input id="new-subscription-price" inputMode="decimal" placeholder="0.00" value={draft.price} onChange={(event) => update({ price: event.target.value })} aria-invalid={errors.price ? true : undefined} />
              <FieldError id="new-subscription-price-error" message={errors.price} />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="new-subscription-starts">Starts</Label>
              <Input id="new-subscription-starts" type="date" value={draft.startsOn} onChange={(event) => update({ startsOn: event.target.value })} aria-invalid={errors.startsOn ? true : undefined} />
              <FieldError id="new-subscription-starts-error" message={errors.startsOn} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-subscription-renews">Renews</Label>
              <Input
                id="new-subscription-renews"
                type="date"
                value={draft.renewsOn}
                onChange={(event) => { setRenewalTouched(true); update({ renewsOn: event.target.value }, true); }}
                aria-invalid={errors.renewsOn ? true : undefined}
              />
              <FieldError id="new-subscription-renews-error" message={errors.renewsOn} />
            </div>
          </div>
          {errors.form ? <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{errors.form}</p> : null}
          <div className="flex justify-end">
            <Button type="submit" disabled={pending}>{pending ? "Creating…" : "Create subscription"}</Button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
