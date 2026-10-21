"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarPlus, PackageCheck, PackagePlus, Soup, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatStoreDateTime } from "@/lib/date-time";
import {
  completePrepBatchAction,
  createPurchaseOrderAction,
  receivePurchaseOrderAction,
  recordWasteAction,
  scheduleStaffShiftAction,
  updateStaffShiftAction,
} from "../actions/operations";
import { validCoffeeTimezone } from "../../store-settings/lib/store-locale-policy";
import { getDeviceTimeZone, resolveStaffShiftLocalDateTime, type StaffShiftTimeResolution } from "../lib/staff-shift-time";
import {
  operationsHref,
  WASTE_REASON_OPTIONS,
  type CoffeeOperationsData,
  type OperationsOption,
  type OperationsParam,
  type OperationsUrlState,
  type Page,
  type ReceiptPurchaseOrder,
} from "../lib/operationsTypes";

type ActionResult = { success: boolean; error?: string };
type Pick = { id: string; name: string; unit: string | null };
type Pending = { key: string; fingerprint: string };
type PurchaseDraft = { supplier: Pick | null; item: Pick | null; quantity: string; unitCost: string; expectedDate: string; notes: string; pending: Pending | null };
type PrepDraft = { recipe: Pick | null; quantity: string; expiresLocal: string; notes: string; pending: Pending | null };
type WasteDraft = { sourceKind: "inventory" | "prep"; source: Pick | null; quantity: string; reason: string; notes: string; pending: Pending | null };
type ShiftDraft = { staff: Pick | null; role: string; startsLocal: string; endsLocal: string; notes: string; pending: Pending | null };
type Drafts = { purchase: PurchaseDraft; prep: PrepDraft; waste: WasteDraft; shift: ShiftDraft; transitions: Record<string, string> };
type FormKind = "purchase" | "prep" | "waste" | "shift" | "receive" | "transition";

const EMPTY_DRAFTS: Drafts = {
  purchase: { supplier: null, item: null, quantity: "", unitCost: "", expectedDate: "", notes: "", pending: null },
  prep: { recipe: null, quantity: "", expiresLocal: "", notes: "", pending: null },
  waste: { sourceKind: "inventory", source: null, quantity: "", reason: "", notes: "", pending: null },
  shift: { staff: null, role: "barista", startsLocal: "", endsLocal: "", notes: "", pending: null },
  transitions: {},
};

const SAVE_FAILED = "The change was not saved. Your entry is kept — check the details and submit again. Resubmitting the same details will not create a duplicate.";
const UNREACHABLE = "The server could not be reached, so the result is unknown. Your entry is kept; submit again to finish safely without creating a duplicate.";
const STORAGE_FAILED = "This browser could not keep a retry record for this change, so it was not sent. Allow site storage for this dashboard and try again.";

function restoreDrafts(raw: string | null): Drafts {
  if (!raw) return EMPTY_DRAFTS;
  try {
    const parsed = JSON.parse(raw) as Partial<Drafts>;
    return {
      purchase: { ...EMPTY_DRAFTS.purchase, ...(parsed.purchase || {}) },
      prep: { ...EMPTY_DRAFTS.prep, ...(parsed.prep || {}) },
      waste: { ...EMPTY_DRAFTS.waste, ...(parsed.waste || {}) },
      shift: { ...EMPTY_DRAFTS.shift, ...(parsed.shift || {}) },
      transitions: parsed.transitions && typeof parsed.transitions === "object" ? parsed.transitions : {},
    };
  } catch {
    return EMPTY_DRAFTS;
  }
}

/** Drafts and pending retry keys survive searches, paging and reloads, partitioned by account and store. */
function useOperationsDrafts(scope: string) {
  const storageKey = `coffee-operations-drafts:${scope}`;
  const [drafts, setDrafts] = React.useState<Drafts>(EMPTY_DRAFTS);
  const ref = React.useRef<Drafts>(EMPTY_DRAFTS);
  React.useEffect(() => {
    let restored = EMPTY_DRAFTS;
    try {
      restored = restoreDrafts(window.sessionStorage.getItem(storageKey));
    } catch {
      restored = EMPTY_DRAFTS;
    }
    ref.current = restored;
    setDrafts(restored);
  }, [storageKey]);
  const commit = React.useCallback((next: Drafts) => {
    ref.current = next;
    setDrafts(next);
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(next));
      return true;
    } catch {
      return false;
    }
  }, [storageKey]);
  const update = React.useCallback((fn: (current: Drafts) => Drafts) => commit(fn(ref.current)), [commit]);
  return { drafts, ref, commit, update };
}

function parseQuantity(text: string, label: string, unit?: string | null): { value: number } | { error: string } {
  const trimmed = text.trim();
  if (!/^\d+(\.\d{1,4})?$/.test(trimmed)) return { error: `${label}: enter a number with up to 4 decimal places.` };
  const value = Number(trimmed);
  if (!(value > 0)) return { error: `${label} must be greater than zero.` };
  if (value > 1_000_000) return { error: `${label} is too large.` };
  if (unit === "each" && !Number.isInteger(value)) return { error: `${label} must be a whole number of items.` };
  return { value };
}

function parseCents(text: string): { value: number } | { error: string } {
  const match = /^(\d{1,8})(?:\.(\d{1,2}))?$/.exec(text.trim());
  if (!match) return { error: "Unit cost: enter a dollar amount like 12.50." };
  return { value: Number(match[1]) * 100 + Number((match[2] || "").padEnd(2, "0")) };
}

function localTimeMessage(label: string, resolution: StaffShiftTimeResolution) {
  switch (resolution.status) {
    case "ready": return `${label} in store time: ${resolution.storePreview}`;
    case "empty": return `${label}: enter a date and time to preview it in store time.`;
    case "invalid-store-timezone": return "Set a valid store timezone in Store Settings before entering times.";
    case "invalid-device-timezone": return "This device's timezone could not be determined, so times cannot be entered here.";
    case "invalid-local-time": return `${label}: enter a valid date and time.`;
    case "nonexistent-local-time": return `${label}: this time is skipped by a clock change on this device. Choose another time.`;
    case "ambiguous-local-time": return `${label}: this time happens twice because clocks go back. Choose another time.`;
  }
}

function Field({ id, label, children, hint }: { id: string; label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="grid min-w-0 gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p id={`${id}-hint`} className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function FormMessage({ error, status }: { error: string | null; status: string | null }) {
  return (
    <div aria-live="polite" className="sm:col-span-2">
      {error ? <p role="alert" className="rounded-md border border-destructive/40 p-3 text-sm text-destructive">{error}</p> : null}
      {!error && status ? <p role="status" className="text-sm text-muted-foreground">{status}</p> : null}
    </div>
  );
}

const selectClass = "h-10 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground disabled:opacity-50";

/** Server-searched, keyset-paged chooser. The selected record is kept by id across searches and pages. */
function OptionPicker(props: {
  id: string;
  label: string;
  page: Page<OperationsOption>;
  selected: Pick | null;
  onSelect: (option: Pick | null) => void;
  searchParam: OperationsParam;
  cursorParam: OperationsParam;
  urlState: OperationsUrlState;
  noun: string;
  describe?: (option: OperationsOption) => string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const currentSearch = props.urlState[props.searchParam] || "";
  const [search, setSearch] = React.useState(currentSearch);
  React.useEffect(() => setSearch(currentSearch), [currentSearch]);
  const options = props.page.items;
  const selectedMissing = props.selected && !options.some((option) => option.id === props.selected?.id);
  const go = (updates: OperationsUrlState) => router.push(operationsHref(props.urlState, updates), { scroll: false });
  const runSearch = () => go({ [props.searchParam]: search.trim() || null, [props.cursorParam]: null });
  const describe = props.describe || ((option: OperationsOption) => option.name);
  return (
    <div className="grid min-w-0 gap-2 sm:col-span-2">
      <div className="grid min-w-0 gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Field id={props.id} label={props.label}>
          <select
            id={props.id}
            value={props.selected?.id || ""}
            disabled={props.disabled || (props.page.loadError && !props.selected)}
            onChange={(event) => {
              const option = options.find((candidate) => candidate.id === event.currentTarget.value);
              if (option) props.onSelect({ id: option.id, name: describe(option), unit: option.unit });
              else if (!event.currentTarget.value) props.onSelect(null);
            }}
            className={selectClass}
          >
            <option value="">Select {props.noun}</option>
            {selectedMissing && props.selected ? <option value={props.selected.id}>{props.selected.name}</option> : null}
            {options.map((option) => <option key={option.id} value={option.id}>{describe(option)}</option>)}
          </select>
        </Field>
        <Field id={`${props.id}-search`} label={`Find ${props.noun}`}>
          <div className="flex min-w-0 gap-2">
            <Input
              id={`${props.id}-search`}
              type="search"
              maxLength={200}
              value={search}
              onChange={(event) => setSearch(event.currentTarget.value)}
              onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); runSearch(); } }}
              className="min-w-0"
            />
            <Button type="button" variant="outline" onClick={runSearch}>Search</Button>
          </div>
        </Field>
      </div>
      <div aria-live="polite" className="flex flex-wrap items-center gap-2 text-sm">
        {props.page.loadError ? (
          <p role="alert" className="mr-auto text-destructive">
            These {props.noun} choices could not be loaded.{" "}
            <Link className="underline" href={operationsHref(props.urlState, { [props.cursorParam]: null })} scroll={false}>Try again</Link>
          </p>
        ) : !options.length ? (
          <p role="status" className="mr-auto text-muted-foreground">
            {props.urlState[props.cursorParam] ? `No more ${props.noun} choices.` : currentSearch ? `No ${props.noun} matches “${currentSearch}”.` : `No ${props.noun} choices are available.`}
          </p>
        ) : (
          <p className="mr-auto text-muted-foreground">{props.page.hasMore ? `Showing ${options.length}; more are available.` : `Showing ${options.length}.`}{props.selected ? " Your selection is kept while you search." : ""}</p>
        )}
        {props.urlState[props.cursorParam] ? <Button asChild size="sm" variant="ghost"><Link href={operationsHref(props.urlState, { [props.cursorParam]: null })} scroll={false}>First page</Link></Button> : null}
        {props.page.hasMore && props.page.nextCursor ? <Button asChild size="sm" variant="outline"><Link href={operationsHref(props.urlState, { [props.cursorParam]: props.page.nextCursor })} scroll={false}>More {props.noun} choices</Link></Button> : null}
      </div>
    </div>
  );
}

export function OperationsTaskPanel({ data, urlState }: { data: CoffeeOperationsData; urlState: OperationsUrlState }) {
  const router = useRouter();
  const { sections } = data;
  const [pending, startTransition] = React.useTransition();
  const [errors, setErrors] = React.useState<Partial<Record<FormKind, string | null>>>({});
  const [statuses, setStatuses] = React.useState<Partial<Record<FormKind, string | null>>>({});
  const [deviceTimeZone, setDeviceTimeZone] = React.useState<string | null>(null);
  const { drafts, ref, commit, update } = useOperationsDrafts(data.draftScope);
  const [receiving, setReceiving] = React.useState<ReceiptPurchaseOrder | null>(null);
  const [receiveExpiry, setReceiveExpiry] = React.useState("");
  const [receiveConfirmed, setReceiveConfirmed] = React.useState(false);
  React.useEffect(() => setDeviceTimeZone(getDeviceTimeZone()), []);

  const tz = data.storeTimezone;
  const timesAvailable = typeof tz === "string" && validCoffeeTimezone(tz) && typeof deviceTimeZone === "string" && validCoffeeTimezone(deviceTimeZone);
  const resolveLocal = (value: string) => resolveStaffShiftLocalDateTime(value, tz, deviceTimeZone);
  const setError = (kind: FormKind, message: string | null) => setErrors((current) => ({ ...current, [kind]: message }));
  const setStatus = (kind: FormKind, message: string | null) => setStatuses((current) => ({ ...current, [kind]: message }));

  function run(kind: FormKind, action: () => Promise<ActionResult>, onSuccess: () => void, successMessage: string) {
    setError(kind, null);
    setStatus(kind, "Saving…");
    startTransition(async () => {
      let result: ActionResult;
      try {
        result = await action();
      } catch {
        setStatus(kind, null);
        setError(kind, UNREACHABLE);
        return;
      }
      setStatus(kind, null);
      if (!result.success) {
        setError(kind, SAVE_FAILED);
        return;
      }
      onSuccess();
      setStatus(kind, successMessage);
      router.refresh();
    });
  }

  /** One key per logical request: reused for retries of the same details, replaced only when the details change. */
  function dispatch<K extends "purchase" | "prep" | "waste" | "shift", I extends Record<string, unknown>>(
    kind: K,
    input: I,
    action: (payload: I & { idempotencyKey: string }) => Promise<ActionResult>,
    successMessage: string,
  ) {
    const fingerprint = JSON.stringify(input);
    const draft = ref.current[kind];
    const key = draft.pending?.fingerprint === fingerprint ? draft.pending.key : crypto.randomUUID();
    if (!commit({ ...ref.current, [kind]: { ...draft, pending: { key, fingerprint } } })) {
      setError(kind, STORAGE_FAILED);
      return;
    }
    run(kind, () => action({ ...input, idempotencyKey: key }), () => update((current) => ({ ...current, [kind]: EMPTY_DRAFTS[kind] })), successMessage);
  }

  const purchase = drafts.purchase;
  const setPurchase = (changes: Partial<PurchaseDraft>) => update((current) => ({ ...current, purchase: { ...current.purchase, ...changes } }));
  function submitPurchase(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!purchase.supplier || !purchase.item) return setError("purchase", "Choose a supplier and an inventory item.");
    const quantity = parseQuantity(purchase.quantity, "Quantity", purchase.item.unit);
    if ("error" in quantity) return setError("purchase", quantity.error);
    const cost = parseCents(purchase.unitCost);
    if ("error" in cost) return setError("purchase", cost.error);
    dispatch("purchase", {
      supplierId: purchase.supplier.id,
      inventoryItemId: purchase.item.id,
      orderedQuantity: quantity.value,
      unitCostCents: cost.value,
      ...(purchase.expectedDate ? { expectedAt: purchase.expectedDate } : {}),
      ...(purchase.notes.trim() ? { notes: purchase.notes.trim() } : {}),
    }, createPurchaseOrderAction, "Purchase order created.");
  }

  const prep = drafts.prep;
  const setPrep = (changes: Partial<PrepDraft>) => update((current) => ({ ...current, prep: { ...current.prep, ...changes } }));
  const prepExpiry = resolveLocal(prep.expiresLocal);
  function submitPrep(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!prep.recipe) return setError("prep", "Choose a recipe.");
    const counted = prep.recipe.unit === "serving" || prep.recipe.unit === "each";
    const quantity = parseQuantity(prep.quantity, "Quantity made", counted ? "each" : null);
    if ("error" in quantity) return setError("prep", quantity.error);
    if (prep.expiresLocal && prepExpiry.status !== "ready") return setError("prep", localTimeMessage("Expiry", prepExpiry));
    dispatch("prep", {
      recipeId: prep.recipe.id,
      quantityMade: quantity.value,
      ...(prepExpiry.status === "ready" ? { expiresAt: prepExpiry.instant } : {}),
      ...(prep.notes.trim() ? { notes: prep.notes.trim() } : {}),
    }, completePrepBatchAction, "Prep batch recorded.");
  }

  const waste = drafts.waste;
  const setWaste = (changes: Partial<WasteDraft>) => update((current) => ({ ...current, waste: { ...current.waste, ...changes } }));
  function submitWaste(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!waste.source) return setError("waste", "Choose what was wasted.");
    if (!WASTE_REASON_OPTIONS.some((option) => option.value === waste.reason)) return setError("waste", "Choose a waste reason.");
    const counted = waste.sourceKind === "prep" ? waste.source.unit === "serving" || waste.source.unit === "each" || !waste.source.unit : waste.source.unit === "each";
    const quantity = parseQuantity(waste.quantity, "Quantity", counted ? "each" : null);
    if ("error" in quantity) return setError("waste", quantity.error);
    dispatch("waste", {
      ...(waste.sourceKind === "inventory" ? { inventoryItemId: waste.source.id } : { prepBatchId: waste.source.id }),
      quantity: quantity.value,
      reason: waste.reason,
      ...(waste.notes.trim() ? { notes: waste.notes.trim() } : {}),
    }, recordWasteAction, "Waste recorded.");
  }

  const shift = drafts.shift;
  const setShift = (changes: Partial<ShiftDraft>) => update((current) => ({ ...current, shift: { ...current.shift, ...changes } }));
  const shiftStart = resolveLocal(shift.startsLocal);
  const shiftEnd = resolveLocal(shift.endsLocal);
  function submitShift(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!shift.staff) return setError("shift", "Choose a staff member.");
    if (shiftStart.status !== "ready") return setError("shift", localTimeMessage("Start", shiftStart));
    if (shiftEnd.status !== "ready") return setError("shift", localTimeMessage("End", shiftEnd));
    if (new Date(shiftEnd.instant) <= new Date(shiftStart.instant)) return setError("shift", "The shift must end after it starts.");
    dispatch("shift", {
      staffId: shift.staff.id,
      role: shift.role,
      startsAt: shiftStart.instant,
      endsAt: shiftEnd.instant,
      ...(shift.notes.trim() ? { notes: shift.notes.trim() } : {}),
    }, scheduleStaffShiftAction, "Shift scheduled.");
  }

  function transition(shiftId: string, status: "clocked_in" | "completed", expectedStatus: string) {
    const slot = `${shiftId}:${expectedStatus}:${status}`;
    const key = ref.current.transitions[slot] || crypto.randomUUID();
    if (!commit({ ...ref.current, transitions: { ...ref.current.transitions, [slot]: key } })) {
      setError("transition", STORAGE_FAILED);
      return;
    }
    run("transition", () => updateStaffShiftAction({ staffShiftId: shiftId, status, expectedStatus, idempotencyKey: key }), () => update((current) => {
      const transitions = { ...current.transitions };
      delete transitions[slot];
      return { ...current, transitions };
    }), status === "clocked_in" ? "Clocked in." : "Clocked out.");
  }

  const receiveExpiryResolution = resolveLocal(receiveExpiry);
  function openReceive(order: ReceiptPurchaseOrder) {
    setReceiving(order);
    setReceiveExpiry("");
    setReceiveConfirmed(false);
    setError("receive", null);
    setStatus("receive", null);
  }
  function submitReceive(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!receiving) return;
    if (!receiveConfirmed) return setError("receive", "Confirm that the full ordered quantity arrived.");
    if (receiveExpiry && receiveExpiryResolution.status !== "ready") return setError("receive", localTimeMessage("Expiry", receiveExpiryResolution));
    const order = receiving;
    run("receive", () => receivePurchaseOrderAction(order.id, receiveExpiryResolution.status === "ready" ? receiveExpiryResolution.instant : undefined), () => setReceiving(null), `${order.poNumber} received.`);
  }

  if (!sections.inventoryManage && !sections.staffing) return null;
  const receipts = data.receiptPurchaseOrders;
  const shifts = data.activeStaffShifts;

  return (
    <section aria-labelledby="operations-tasks" className="space-y-4">
      <h2 id="operations-tasks" className="text-xl font-semibold">Today’s tasks</h2>
      <div className="grid gap-4 xl:grid-cols-2">
        {sections.inventoryManage ? (
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><PackagePlus className="size-5" aria-hidden="true" /> Order stock</CardTitle>
              <CardDescription>Place a purchase order with a supplier. Receive it below when it arrives.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitPurchase} className="grid gap-3 sm:grid-cols-2" noValidate>
                <OptionPicker id="po-supplier" label="Supplier" noun="supplier" page={data.purchaseSuppliers} selected={purchase.supplier} onSelect={(supplier) => setPurchase({ supplier })} searchParam="purchaseSupplierSearch" cursorParam="purchaseSupplierCursor" urlState={urlState} />
                <OptionPicker id="po-item" label="Inventory item" noun="item" page={data.purchaseInventoryItems} selected={purchase.item} onSelect={(item) => setPurchase({ item })} searchParam="purchaseInventorySearch" cursorParam="purchaseInventoryCursor" urlState={urlState} describe={(option) => option.unit ? `${option.name} (${option.unit})` : option.name} />
                <Field id="po-quantity" label={`Quantity${purchase.item?.unit ? ` (${purchase.item.unit})` : ""}`}>
                  <Input id="po-quantity" inputMode="decimal" value={purchase.quantity} onChange={(event) => setPurchase({ quantity: event.currentTarget.value })} required />
                </Field>
                <Field id="po-cost" label="Unit cost (USD)">
                  <Input id="po-cost" inputMode="decimal" value={purchase.unitCost} onChange={(event) => setPurchase({ unitCost: event.currentTarget.value })} required />
                </Field>
                <Field id="po-expected" label="Expected delivery date" hint="A store calendar date.">
                  <Input id="po-expected" type="date" value={purchase.expectedDate} onChange={(event) => setPurchase({ expectedDate: event.currentTarget.value })} aria-describedby="po-expected-hint" />
                </Field>
                <Field id="po-notes" label="Notes">
                  <Input id="po-notes" maxLength={500} value={purchase.notes} onChange={(event) => setPurchase({ notes: event.currentTarget.value })} />
                </Field>
                <FormMessage error={errors.purchase ?? null} status={statuses.purchase ?? null} />
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <Button type="submit" disabled={pending}>Create purchase order</Button>
                  <Button type="button" variant="ghost" disabled={pending} onClick={() => { setPurchase(EMPTY_DRAFTS.purchase); setError("purchase", null); }}>Clear</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : null}

        {sections.inventoryManage ? (
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><PackageCheck className="size-5" aria-hidden="true" /> Receive deliveries</CardTitle>
              <CardDescription>Submitted purchase orders awaiting delivery, oldest first.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {receipts.loadError ? (
                <p role="alert" className="text-sm text-destructive">Orders awaiting delivery could not be loaded. <Link className="underline" href={operationsHref(urlState, { receiptCursor: null })}>Try again</Link></p>
              ) : <>
                {receipts.items.map((order) => (
                  <div key={order.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                    <div className="min-w-0">
                      <div className="font-mono">{order.poNumber}</div>
                      <div className="break-words text-muted-foreground">{order.supplier?.name || "No supplier"} · {order.inventoryItem?.name || "No item"} · {order.orderedQuantity ?? 0} {order.inventoryItem?.unit || ""}</div>
                    </div>
                    <Button size="sm" variant="outline" disabled={pending} onClick={() => openReceive(order)} aria-label={`Receive ${order.poNumber}`}>Receive</Button>
                  </div>
                ))}
                {!receipts.items.length ? <p className="text-sm text-muted-foreground">{urlState.receiptCursor ? "No more orders awaiting delivery." : "No purchase orders are awaiting delivery."}</p> : null}
                <div className="flex flex-wrap gap-2">
                  {urlState.receiptCursor ? <Button asChild size="sm" variant="ghost"><Link href={operationsHref(urlState, { receiptCursor: null })} scroll={false}>Oldest first</Link></Button> : null}
                  {receipts.hasMore && receipts.nextCursor ? <Button asChild size="sm" variant="outline"><Link href={operationsHref(urlState, { receiptCursor: receipts.nextCursor })} scroll={false}>More orders</Link></Button> : null}
                </div>
              </>}
              <div aria-live="polite">{!receiving && statuses.receive ? <p role="status" className="text-sm text-muted-foreground">{statuses.receive}</p> : null}</div>
            </CardContent>
          </Card>
        ) : null}

        {sections.inventoryManage ? (
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Soup className="size-5" aria-hidden="true" /> Record prep</CardTitle>
              <CardDescription>Uses the recipe’s ingredients from stock and creates a prepared batch.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitPrep} className="grid gap-3 sm:grid-cols-2" noValidate>
                <OptionPicker id="prep-recipe" label="Recipe" noun="recipe" page={data.prepRecipes} selected={prep.recipe} onSelect={(recipe) => setPrep({ recipe })} searchParam="recipeSearch" cursorParam="recipeCursor" urlState={urlState} />
                <Field id="prep-quantity" label={`Quantity made${prep.recipe?.unit ? ` (${prep.recipe.unit})` : ""}`}>
                  <Input id="prep-quantity" inputMode="decimal" value={prep.quantity} onChange={(event) => setPrep({ quantity: event.currentTarget.value })} required />
                </Field>
                <Field id="prep-expires" label="Use by (this device’s time)" hint={prep.expiresLocal ? localTimeMessage("Use by", prepExpiry) : "Optional. Leave blank if no use-by time applies."}>
                  <Input id="prep-expires" type="datetime-local" value={prep.expiresLocal} disabled={!timesAvailable} onChange={(event) => setPrep({ expiresLocal: event.currentTarget.value })} aria-describedby="prep-expires-hint" />
                </Field>
                <Field id="prep-notes" label="Notes">
                  <Input id="prep-notes" maxLength={500} value={prep.notes} onChange={(event) => setPrep({ notes: event.currentTarget.value })} />
                </Field>
                <FormMessage error={errors.prep ?? null} status={statuses.prep ?? null} />
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <Button type="submit" disabled={pending}>Record prep batch</Button>
                  <Button type="button" variant="ghost" disabled={pending} onClick={() => { setPrep(EMPTY_DRAFTS.prep); setError("prep", null); }}>Clear</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : null}

        {sections.inventoryManage ? (
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Trash2 className="size-5" aria-hidden="true" /> Record waste</CardTitle>
              <CardDescription>Remove spoiled or unusable stock or prepared food.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitWaste} className="grid gap-3 sm:grid-cols-2" noValidate>
                <div className="flex flex-wrap gap-2 sm:col-span-2" role="group" aria-label="Waste from">
                  <Button type="button" size="sm" variant={waste.sourceKind === "inventory" ? "default" : "outline"} aria-pressed={waste.sourceKind === "inventory"} onClick={() => setWaste({ sourceKind: "inventory", source: null })}>Inventory item</Button>
                  <Button type="button" size="sm" variant={waste.sourceKind === "prep" ? "default" : "outline"} aria-pressed={waste.sourceKind === "prep"} onClick={() => setWaste({ sourceKind: "prep", source: null })}>Prepared batch</Button>
                </div>
                {waste.sourceKind === "inventory" ? (
                  <OptionPicker id="waste-item" label="Inventory item" noun="item" page={data.inventoryWasteItems} selected={waste.source} onSelect={(source) => setWaste({ source })} searchParam="inventoryWasteSearch" cursorParam="inventoryWasteCursor" urlState={urlState} describe={(option) => `${option.name} · ${option.currentStock ?? 0} ${option.unit ?? ""} in stock`} />
                ) : (
                  <OptionPicker id="waste-batch" label="Prepared batch" noun="batch" page={data.wastePrepBatches} selected={waste.source} onSelect={(source) => setWaste({ source })} searchParam="prepBatchSearch" cursorParam="prepBatchCursor" urlState={urlState} describe={(option) => `${option.name}${option.detail ? ` · ${option.detail}` : ""} · ${option.currentStock ?? 0} ${option.unit ?? ""} left`} />
                )}
                <Field id="waste-quantity" label={`Quantity${waste.source?.unit ? ` (${waste.source.unit})` : ""}`}>
                  <Input id="waste-quantity" inputMode="decimal" value={waste.quantity} onChange={(event) => setWaste({ quantity: event.currentTarget.value })} required />
                </Field>
                <Field id="waste-reason" label="Reason">
                  <select id="waste-reason" value={waste.reason} onChange={(event) => setWaste({ reason: event.currentTarget.value })} required className={selectClass}>
                    <option value="">Select reason</option>
                    {WASTE_REASON_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </Field>
                <div className="sm:col-span-2">
                  <Field id="waste-notes" label="Notes">
                    <Input id="waste-notes" maxLength={500} value={waste.notes} onChange={(event) => setWaste({ notes: event.currentTarget.value })} />
                  </Field>
                </div>
                <FormMessage error={errors.waste ?? null} status={statuses.waste ?? null} />
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <Button type="submit" variant="destructive" disabled={pending}>Record waste</Button>
                  <Button type="button" variant="ghost" disabled={pending} onClick={() => { setWaste(EMPTY_DRAFTS.waste); setError("waste", null); }}>Clear</Button>
                </div>
              </form>
            </CardContent>
          </Card>
        ) : null}

        {sections.staffing ? (
          <Card className="min-w-0 xl:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><CalendarPlus className="size-5" aria-hidden="true" /> Staff shifts</CardTitle>
              <CardDescription>Schedule shifts, then clock staff in and out.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6 lg:grid-cols-2">
              <form onSubmit={submitShift} className="grid content-start gap-3 sm:grid-cols-2" noValidate>
                {!timesAvailable ? <p role="alert" className="text-sm text-destructive sm:col-span-2">{typeof tz === "string" && validCoffeeTimezone(tz) ? "This device's timezone could not be determined, so shifts cannot be scheduled here." : "Set a valid store timezone in Store Settings before scheduling shifts."}</p> : null}
                <OptionPicker id="shift-staff" label="Staff member" noun="staff" page={data.staffMembers} selected={shift.staff} onSelect={(staff) => setShift({ staff })} searchParam="staffSearch" cursorParam="staffCursor" urlState={urlState} describe={(option) => option.detail && option.detail !== option.name ? `${option.name} (${option.detail})` : option.name} />
                <Field id="shift-role" label="Role">
                  <select id="shift-role" value={shift.role} onChange={(event) => setShift({ role: event.currentTarget.value })} className={selectClass}>
                    <option value="barista">Barista</option>
                    <option value="shift_lead">Shift lead</option>
                    <option value="kitchen">Kitchen</option>
                    <option value="manager">Manager</option>
                  </select>
                </Field>
                <Field id="shift-notes" label="Notes">
                  <Input id="shift-notes" maxLength={500} value={shift.notes} onChange={(event) => setShift({ notes: event.currentTarget.value })} />
                </Field>
                <Field id="shift-start" label="Starts (this device’s time)" hint={localTimeMessage("Start", shiftStart)}>
                  <Input id="shift-start" type="datetime-local" value={shift.startsLocal} disabled={!timesAvailable} onChange={(event) => setShift({ startsLocal: event.currentTarget.value })} aria-describedby="shift-start-hint" required />
                </Field>
                <Field id="shift-end" label="Ends (this device’s time)" hint={localTimeMessage("End", shiftEnd)}>
                  <Input id="shift-end" type="datetime-local" value={shift.endsLocal} disabled={!timesAvailable} onChange={(event) => setShift({ endsLocal: event.currentTarget.value })} aria-describedby="shift-end-hint" required />
                </Field>
                <FormMessage error={errors.shift ?? null} status={statuses.shift ?? null} />
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <Button type="submit" disabled={pending || !timesAvailable}>Schedule shift</Button>
                  <Button type="button" variant="ghost" disabled={pending} onClick={() => { setShift(EMPTY_DRAFTS.shift); setError("shift", null); }}>Clear</Button>
                </div>
              </form>

              <div className="min-w-0 space-y-3">
                <h3 className="text-sm font-semibold">
                  Scheduled and clocked-in shifts{shifts.totalCount != null ? ` (${shifts.totalCount})` : ""}
                </h3>
                {shifts.loadError ? (
                  <p role="alert" className="text-sm text-destructive">Shifts could not be loaded. <Link className="underline" href={operationsHref(urlState, { shiftCursor: null })}>Try again</Link></p>
                ) : <>
                  {shifts.items.map((item) => (
                    <div key={item.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3 text-sm">
                      <div className="min-w-0">
                        <div className="break-words font-medium">{item.staff?.name || item.staff?.email || "Unassigned"} <span className="font-mono text-xs text-muted-foreground">{item.shiftNumber}</span></div>
                        <div className="capitalize text-muted-foreground">{item.role.replaceAll("_", " ")} · {item.status.replaceAll("_", " ")}</div>
                        <div className="text-xs text-muted-foreground">{item.startsAt ? formatStoreDateTime(item.startsAt, tz) : "No start time"}{item.endsAt ? ` – ${formatStoreDateTime(item.endsAt, tz)}` : ""}</div>
                      </div>
                      <div className="flex gap-2">
                        {item.actions.map((action) => (
                          <Button key={action.status} size="sm" disabled={pending} onClick={() => transition(item.id, action.status as "clocked_in" | "completed", item.status)} aria-label={`${action.label}: ${item.staff?.name || item.shiftNumber}`}>{action.label}</Button>
                        ))}
                      </div>
                    </div>
                  ))}
                  {!shifts.items.length ? <p className="text-sm text-muted-foreground">{urlState.shiftCursor ? "No more open shifts." : "No shifts are scheduled or in progress."}</p> : null}
                  <div className="flex flex-wrap gap-2">
                    {urlState.shiftCursor ? <Button asChild size="sm" variant="ghost"><Link href={operationsHref(urlState, { shiftCursor: null })} scroll={false}>Oldest first</Link></Button> : null}
                    {shifts.hasMore && shifts.nextCursor ? <Button asChild size="sm" variant="outline"><Link href={operationsHref(urlState, { shiftCursor: shifts.nextCursor })} scroll={false}>More shifts</Link></Button> : null}
                  </div>
                </>}
                <div aria-live="polite">
                  {errors.transition ? <p role="alert" className="text-sm text-destructive">{errors.transition}</p> : statuses.transition ? <p role="status" className="text-sm text-muted-foreground">{statuses.transition}</p> : null}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>

      <Dialog open={receiving !== null} onOpenChange={(open) => { if (!open && !pending) setReceiving(null); }}>
        <DialogContent>
          <form onSubmit={submitReceive} className="space-y-4" noValidate>
            <DialogHeader>
              <DialogTitle>Receive {receiving?.poNumber}</DialogTitle>
              <DialogDescription>Check the delivery against this order before adding it to stock.</DialogDescription>
            </DialogHeader>
            {receiving ? (
              <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
                <dt className="text-muted-foreground">Supplier</dt><dd className="break-words">{receiving.supplier?.name || "No supplier"}</dd>
                <dt className="text-muted-foreground">Item</dt><dd className="break-words">{receiving.inventoryItem?.name || "No item"}</dd>
                <dt className="text-muted-foreground">Quantity</dt><dd className="tabular-nums">{receiving.orderedQuantity ?? 0} {receiving.inventoryItem?.unit || ""}</dd>
                <dt className="text-muted-foreground">Unit cost</dt><dd className="tabular-nums">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((receiving.unitCostCents ?? 0) / 100)}</dd>
                <dt className="text-muted-foreground">Subtotal</dt><dd className="tabular-nums">{new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((receiving.subtotalCents ?? 0) / 100)}</dd>
              </dl>
            ) : null}
            <Field id="receive-expiry" label="Expiry printed on the delivery (this device’s time)" hint={receiveExpiry ? localTimeMessage("Expiry", receiveExpiryResolution) : "Optional. Leave blank if the delivery has no expiry; it is recorded as unknown."}>
              <Input id="receive-expiry" type="datetime-local" value={receiveExpiry} disabled={!timesAvailable} onChange={(event) => setReceiveExpiry(event.currentTarget.value)} aria-describedby="receive-expiry-hint" />
            </Field>
            <div className="flex items-start gap-2">
              <Checkbox id="receive-confirm" checked={receiveConfirmed} onCheckedChange={(checked) => setReceiveConfirmed(checked === true)} />
              <Label htmlFor="receive-confirm" className="font-normal leading-snug">The full ordered quantity arrived. Partial deliveries can’t be recorded here yet.</Label>
            </div>
            <FormMessage error={errors.receive ?? null} status={receiving ? statuses.receive ?? null : null} />
            <DialogFooter>
              <Button type="button" variant="outline" disabled={pending} onClick={() => setReceiving(null)}>Cancel</Button>
              <Button type="submit" disabled={pending || !receiveConfirmed}>Add to stock</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
