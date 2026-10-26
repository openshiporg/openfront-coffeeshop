"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PillButton, PillTrack, Segmented } from "@/features/platform/components/PillTabs";
import { PlatformEmpty, PlatformTable, platformTd } from "@/features/platform/components/PlatformPage";
import { StatusDot, type StatusTone } from "@/features/platform/components/StatusTitle";
import { formatStoreDateTime } from "@/lib/date-time";
import {
  completePrepBatchAction,
  createPurchaseOrderAction,
  receivePurchaseOrderAction,
  recordStockCountAction,
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
type CountDraft = { item: Pick | null; quantity: string; notes: string; pending: Pending | null };
type ShiftDraft = { staff: Pick | null; role: string; startsLocal: string; endsLocal: string; notes: string; pending: Pending | null };
type Drafts = { purchase: PurchaseDraft; prep: PrepDraft; waste: WasteDraft; count: CountDraft; shift: ShiftDraft; transitions: Record<string, string> };
type FormKind = "purchase" | "prep" | "waste" | "count" | "shift" | "receive" | "transition";
type TaskTab = "receive" | "prep" | "waste" | "count" | "purchase" | "shift";

const EMPTY_DRAFTS: Drafts = {
  purchase: { supplier: null, item: null, quantity: "", unitCost: "", expectedDate: "", notes: "", pending: null },
  prep: { recipe: null, quantity: "", expiresLocal: "", notes: "", pending: null },
  waste: { sourceKind: "inventory", source: null, quantity: "", reason: "", notes: "", pending: null },
  count: { item: null, quantity: "", notes: "", pending: null },
  shift: { staff: null, role: "barista", startsLocal: "", endsLocal: "", notes: "", pending: null },
  transitions: {},
};

const SAVE_FAILED = "Not saved. Your entry is kept; check it and submit again. Resubmitting won't create a duplicate.";
const UNREACHABLE = "Server unreachable; result unknown. Your entry is kept; submit again. It won't create a duplicate.";
const STORAGE_FAILED = "Not sent: this browser can't keep a retry record. Allow site storage and try again.";

function restoreDrafts(raw: string | null): Drafts {
  if (!raw) return EMPTY_DRAFTS;
  try {
    const parsed = JSON.parse(raw) as Partial<Drafts>;
    return {
      purchase: { ...EMPTY_DRAFTS.purchase, ...(parsed.purchase || {}) },
      prep: { ...EMPTY_DRAFTS.prep, ...(parsed.prep || {}) },
      waste: { ...EMPTY_DRAFTS.waste, ...(parsed.waste || {}) },
      count: { ...EMPTY_DRAFTS.count, ...(parsed.count || {}) },
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

function parseQuantity(text: string, label: string, unit?: string | null, allowZero = false): { value: number } | { error: string } {
  const trimmed = text.trim();
  if (!/^\d+(\.\d{1,4})?$/.test(trimmed)) return { error: `${label}: enter a number with up to 4 decimal places.` };
  const value = Number(trimmed);
  if (!(value > 0) && !(allowZero && value === 0)) return { error: `${label} must be greater than zero.` };
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
    case "empty": return `${label}: not set`;
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
      {error ? <p role="alert" className="rounded-[6px] border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">{error}</p> : null}
      {!error && status ? <p role="status" className="text-sm text-muted-foreground">{status}</p> : null}
    </div>
  );
}

const selectClass = "h-10 w-full min-w-0 rounded-[6px] border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
const fieldClass = "h-10 rounded-[6px]";

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
  const cursor = props.urlState[props.cursorParam];
  return (
    <div className="grid min-w-0 gap-1.5 sm:col-span-2">
      <Label htmlFor={props.id}>{props.label}</Label>
      <div className="flex min-w-0 flex-col gap-2 sm:flex-row">
        <select
          id={props.id}
          value={props.selected?.id || ""}
          disabled={props.disabled || (props.page.loadError && !props.selected)}
          onChange={(event) => {
            const option = options.find((candidate) => candidate.id === event.currentTarget.value);
            if (option) props.onSelect({ id: option.id, name: describe(option), unit: option.unit });
            else if (!event.currentTarget.value) props.onSelect(null);
          }}
          className={`${selectClass} sm:flex-1`}
        >
          <option value="">Select {props.noun}</option>
          {selectedMissing && props.selected ? <option value={props.selected.id}>{props.selected.name}</option> : null}
          {options.map((option) => <option key={option.id} value={option.id}>{describe(option)}</option>)}
        </select>
        {/* Server search narrows the choices; Enter runs it. */}
        <div className="relative min-w-0 sm:w-52 sm:shrink-0">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Label htmlFor={`${props.id}-search`} className="sr-only">Find {props.noun}</Label>
          <Input
            id={`${props.id}-search`}
            type="search"
            enterKeyHint="search"
            maxLength={200}
            value={search}
            placeholder={`Find ${props.noun}`}
            onChange={(event) => setSearch(event.currentTarget.value)}
            onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); runSearch(); } }}
            className={`${fieldClass} min-w-0 pl-8`}
          />
        </div>
      </div>
      {props.page.loadError || !options.length || cursor || props.page.hasMore ? (
        <div aria-live="polite" className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
          {props.page.loadError ? (
            <p role="alert" className="mr-auto text-destructive">
              These {props.noun} choices could not be loaded.{" "}
              <Link className="underline" href={operationsHref(props.urlState, { [props.cursorParam]: null })} scroll={false}>Try again</Link>
            </p>
          ) : !options.length ? (
            <p role="status" className="mr-auto text-muted-foreground">
              {cursor ? `No more ${props.noun} choices.` : currentSearch ? `No ${props.noun} matches “${currentSearch}”.` : `No ${props.noun} choices.`}
            </p>
          ) : (
            <p className="mr-auto text-xs text-muted-foreground">{options.length} shown{props.page.hasMore ? " · more available" : ""}</p>
          )}
          {cursor ? <Link className="text-sm font-medium underline-offset-4 hover:underline" href={operationsHref(props.urlState, { [props.cursorParam]: null })} scroll={false}>First page</Link> : null}
          {props.page.hasMore && props.page.nextCursor ? <Link className="text-sm font-medium underline-offset-4 hover:underline" href={operationsHref(props.urlState, { [props.cursorParam]: props.page.nextCursor })} scroll={false}>More {props.noun} choices</Link> : null}
        </div>
      ) : null}
    </div>
  );
}

const stackRow = "max-md:mb-2 max-md:grid max-md:grid-cols-2 max-md:gap-x-3 max-md:gap-y-1 max-md:rounded-[6px] max-md:border max-md:bg-background max-md:p-3 max-md:[&>td]:border-0 max-md:[&>td]:p-0";
const stackTable = "max-md:border-0 max-md:bg-transparent max-md:[&_table]:block max-md:[&_tbody]:block max-md:[&_thead]:hidden";

const GOOD_STATUS = new Set(["active", "completed", "received", "paid", "approved", "confirmed", "in_stock"]);
const BAD_STATUS = new Set(["cancelled", "expired", "missed", "void", "voided", "refunded", "inactive", "discarded", "depleted"]);
function statusTone(status?: string | null): StatusTone {
  if (!status) return "zinc";
  if (GOOD_STATUS.has(status)) return "green";
  if (BAD_STATUS.has(status)) return "red";
  return "amber";
}

function StatusCell({ status }: { status?: string | null }) {
  if (!status) return <span className="text-muted-foreground">—</span>;
  return <span className="inline-flex items-center gap-1.5"><StatusDot tone={statusTone(status)} /><span className="capitalize">{status.replaceAll("_", " ")}</span></span>;
}

/** One block of a task view: a small heading, then its list or form. */
function TaskBlock({ id, title, meta, children }: { id: string; title: string; meta?: number; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="min-w-0 space-y-3">
      <h3 id={id} className="text-sm font-semibold">
        {title}{meta != null ? <span className="ml-1.5 font-normal tabular-nums text-muted-foreground">{meta}</span> : null}
      </h3>
      {children}
    </section>
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
  // Receiving waiting deliveries comes first when any are waiting.
  const [tab, setTab] = React.useState<TaskTab>(() => (data.receiptPurchaseOrders.items.length ? "receive" : sections.inventoryManage ? "prep" : "shift"));
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
  function dispatch<K extends "purchase" | "prep" | "waste" | "count" | "shift", I extends Record<string, unknown>>(
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

  const count = drafts.count;
  const setCount = (changes: Partial<CountDraft>) => update((current) => ({ ...current, count: { ...current.count, ...changes } }));
  function submitCount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!count.item) return setError("count", "Choose an inventory item.");
    const quantity = parseQuantity(count.quantity, "On hand", count.item.unit, true);
    if ("error" in quantity) return setError("count", quantity.error);
    dispatch("count", {
      inventoryItemId: count.item.id,
      countedQuantity: quantity.value,
      ...(count.notes.trim() ? { notes: count.notes.trim() } : {}),
    }, recordStockCountAction, "Stock count saved.");
  }
  // Live difference against the listed stock, in 0.0001 units to avoid float drift.
  const countOnFile = count.item ? data.purchaseInventoryItems.items.find((option) => option.id === count.item?.id)?.currentStock : undefined;
  const countParsed = count.item && countOnFile != null && count.quantity.trim() ? parseQuantity(count.quantity, "On hand", count.item.unit, true) : null;
  const countDelta = countParsed && "value" in countParsed ? (Math.round(countParsed.value * 10_000) - Math.round(Number(countOnFile) * 10_000)) / 10_000 : null;
  const countChange = countDelta == null || !Number.isFinite(countDelta) ? undefined
    : countDelta === 0 ? "No change"
    : `Change ${countDelta > 0 ? "+" : "−"}${Math.abs(countDelta)} ${count.item?.unit ?? ""}`.trim();

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

  const receipts = data.receiptPurchaseOrders;
  const shifts = data.activeStaffShifts;
  const tasks = [
    ...(sections.inventoryManage ? [
      { value: "receive", label: "Receive", count: receipts.items.length || undefined },
      { value: "prep", label: "Prep" },
      { value: "waste", label: "Waste" },
      { value: "count", label: "Count stock" },
      { value: "purchase", label: "Order stock" },
    ] : []),
    ...(sections.staffing ? [{ value: "shift", label: "Shifts", count: shifts.totalCount ?? undefined }] : []),
  ] as Array<{ value: TaskTab; label: string; count?: number }>;
  const activeTab: TaskTab = tasks.some((task) => task.value === tab) ? tab : tasks[0]?.value ?? "receive";

  if (!sections.inventoryManage && !sections.staffing) return null;

  const money = (cents?: number | null) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format((cents ?? 0) / 100);
  const amount = (value?: number | null) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(Number(value ?? 0));
  const primary = "min-h-10 rounded-[6px] active:scale-[0.97]";
  const quiet = "min-h-10 rounded-[6px]";
  const formClass = "grid max-w-3xl gap-3 sm:grid-cols-2";
  const pager = "text-sm font-medium underline-offset-4 hover:underline";

  return (
    <section aria-labelledby="operations-tasks" className="space-y-5">
      <h2 id="operations-tasks" className="sr-only">Tasks</h2>
      <PillTrack label="Task">
        {tasks.map((task) => (
          <PillButton key={task.value} size="md" active={activeTab === task.value} count={task.count} onClick={() => setTab(task.value)}>{task.label}</PillButton>
        ))}
      </PillTrack>
      <div className="min-w-0 space-y-6">
        {sections.inventoryManage && activeTab === "receive" ? (
          <TaskBlock id="ops-receive" title="Awaiting delivery" meta={receipts.items.length || undefined}>
            {receipts.loadError ? (
              <p role="alert" className="text-sm text-destructive">Orders awaiting delivery could not be loaded. <Link className="underline" href={operationsHref(urlState, { receiptCursor: null })}>Try again</Link></p>
            ) : <>
              {receipts.items.length ? (
                <PlatformTable label="Awaiting delivery" className={stackTable} head={[{ label: "PO" }, { label: "Item" }, { label: "Supplier" }, { label: "Expected" }, { label: <span className="sr-only">Receive</span> }]}>
                  {receipts.items.map((order) => (
                    <tr key={order.id} className={stackRow}>
                      <td className={`${platformTd} whitespace-nowrap font-medium tabular-nums`}><span className="inline-flex items-center gap-1.5"><StatusDot tone="amber" />{order.poNumber}</span></td>
                      <td className={`${platformTd} max-md:text-right [overflow-wrap:anywhere]`}>{order.inventoryItem?.name || "No item"} · <span className="tabular-nums">{order.orderedQuantity ?? 0} {order.inventoryItem?.unit || ""}</span></td>
                      <td className={`${platformTd} text-muted-foreground [overflow-wrap:anywhere]`}>{order.supplier?.name || "No supplier"}</td>
                      <td className={`${platformTd} whitespace-nowrap tabular-nums text-muted-foreground max-md:text-right`}>{order.expectedAt ? order.expectedAt.slice(0, 10) : "—"}</td>
                      <td className={`${platformTd} text-right max-md:col-span-2 max-md:pt-1`}>
                        <Button className={`${primary} max-md:w-full`} disabled={pending} onClick={() => openReceive(order)} aria-label={`Receive ${order.poNumber}`}>Receive</Button>
                      </td>
                    </tr>
                  ))}
                </PlatformTable>
              ) : <PlatformEmpty>{urlState.receiptCursor ? "No more deliveries." : "Nothing awaiting delivery."}</PlatformEmpty>}
              {urlState.receiptCursor || (receipts.hasMore && receipts.nextCursor) ? (
                <div className="flex flex-wrap gap-4">
                  {urlState.receiptCursor ? <Link className={pager} href={operationsHref(urlState, { receiptCursor: null })} scroll={false}>Oldest first</Link> : null}
                  {receipts.hasMore && receipts.nextCursor ? <Link className={pager} href={operationsHref(urlState, { receiptCursor: receipts.nextCursor })} scroll={false}>More orders</Link> : null}
                </div>
              ) : null}
            </>}
            <div aria-live="polite">{!receiving && statuses.receive ? <p role="status" className="text-sm text-muted-foreground">{statuses.receive}</p> : null}</div>
          </TaskBlock>
        ) : null}

        {sections.inventoryManage && activeTab === "prep" ? (
          <>
            <TaskBlock id="ops-prep-recent" title="Recent prep">
              {data.prepBatches.length ? (
                <PlatformTable label="Recent prep batches" className={stackTable} head={[{ label: "Batch" }, { label: "Recipe" }, { label: "Status" }, { label: "Made", className: "text-right" }, { label: "Use by" }]}>
                  {data.prepBatches.slice(0, 5).map((batch) => (
                    <tr key={batch.id} className={stackRow}>
                      <td className={`${platformTd} whitespace-nowrap tabular-nums text-muted-foreground`}>{batch.batchNumber}</td>
                      <td className={`${platformTd} font-medium max-md:text-right [overflow-wrap:anywhere]`}>{batch.recipe?.name ?? "No recipe"}</td>
                      <td className={`${platformTd} whitespace-nowrap`}><StatusCell status={batch.status} /></td>
                      <td className={`${platformTd} text-right tabular-nums`}>{amount(batch.quantityMade)}</td>
                      <td className={`${platformTd} whitespace-nowrap text-muted-foreground max-md:col-span-2 max-md:text-xs`}>{batch.expiresAt ? formatStoreDateTime(batch.expiresAt, tz) : "No expiry"}</td>
                    </tr>
                  ))}
                </PlatformTable>
              ) : <PlatformEmpty>No prep batches yet.</PlatformEmpty>}
            </TaskBlock>
            <TaskBlock id="ops-prep-form" title="Record prep">
              <form onSubmit={submitPrep} className={formClass} noValidate>
                <OptionPicker id="prep-recipe" label="Recipe" noun="recipe" page={data.prepRecipes} selected={prep.recipe} onSelect={(recipe) => setPrep({ recipe })} searchParam="recipeSearch" cursorParam="recipeCursor" urlState={urlState} />
                <Field id="prep-quantity" label={`Quantity made${prep.recipe?.unit ? ` (${prep.recipe.unit})` : ""}`}>
                  <Input id="prep-quantity" className={fieldClass} inputMode="decimal" value={prep.quantity} onChange={(event) => setPrep({ quantity: event.currentTarget.value })} required />
                </Field>
                <Field id="prep-expires" label="Use by (this device’s time)" hint={prep.expiresLocal ? localTimeMessage("Use by", prepExpiry) : "Optional"}>
                  <Input id="prep-expires" className={fieldClass} type="datetime-local" value={prep.expiresLocal} disabled={!timesAvailable} onChange={(event) => setPrep({ expiresLocal: event.currentTarget.value })} aria-describedby="prep-expires-hint" />
                </Field>
                <div className="sm:col-span-2">
                  <Field id="prep-notes" label="Notes">
                    <Input id="prep-notes" className={fieldClass} maxLength={500} value={prep.notes} onChange={(event) => setPrep({ notes: event.currentTarget.value })} />
                  </Field>
                </div>
                <FormMessage error={errors.prep ?? null} status={statuses.prep ?? null} />
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <Button type="submit" className={primary} disabled={pending}>Record prep batch</Button>
                  <Button type="button" variant="ghost" className={quiet} disabled={pending} onClick={() => { setPrep(EMPTY_DRAFTS.prep); setError("prep", null); }}>Clear</Button>
                </div>
              </form>
            </TaskBlock>
          </>
        ) : null}

        {sections.inventoryManage && activeTab === "waste" ? (
          <>
            <TaskBlock id="ops-waste-recent" title="Recent waste">
              {data.wasteLogs.length ? (
                <PlatformTable label="Recent waste" className={stackTable} head={[{ label: "Log" }, { label: "Source" }, { label: "Reason" }, { label: "Quantity", className: "text-right" }, { label: "Cost", className: "text-right" }]}>
                  {data.wasteLogs.slice(0, 5).map((log) => (
                    <tr key={log.id} className={stackRow}>
                      <td className={`${platformTd} whitespace-nowrap tabular-nums text-muted-foreground`}>{log.logNumber}</td>
                      <td className={`${platformTd} font-medium max-md:text-right [overflow-wrap:anywhere]`}>{log.inventoryItem?.name ?? log.prepBatch?.batchNumber ?? "Unknown source"}</td>
                      <td className={`${platformTd} capitalize`}>{log.reason.replaceAll("_", " ")}</td>
                      <td className={`${platformTd} text-right tabular-nums`}>{amount(log.quantity)} {log.unit}</td>
                      <td className={`${platformTd} text-right tabular-nums max-md:col-span-2`}>{money(log.costCents)}</td>
                    </tr>
                  ))}
                </PlatformTable>
              ) : <PlatformEmpty>No waste recorded.</PlatformEmpty>}
            </TaskBlock>
            <TaskBlock id="ops-waste-form" title="Record waste">
              <form onSubmit={submitWaste} className={formClass} noValidate>
                <Segmented
                  label="Waste from"
                  className="sm:col-span-2 sm:w-fit"
                  value={waste.sourceKind}
                  options={[{ value: "inventory", label: "Inventory item" }, { value: "prep", label: "Prepared batch" }]}
                  onChange={(sourceKind) => setWaste({ sourceKind, source: null })}
                />
                {waste.sourceKind === "inventory" ? (
                  <OptionPicker id="waste-item" label="Inventory item" noun="item" page={data.inventoryWasteItems} selected={waste.source} onSelect={(source) => setWaste({ source })} searchParam="inventoryWasteSearch" cursorParam="inventoryWasteCursor" urlState={urlState} describe={(option) => `${option.name} · ${option.currentStock ?? 0} ${option.unit ?? ""} in stock`} />
                ) : (
                  <OptionPicker id="waste-batch" label="Prepared batch" noun="batch" page={data.wastePrepBatches} selected={waste.source} onSelect={(source) => setWaste({ source })} searchParam="prepBatchSearch" cursorParam="prepBatchCursor" urlState={urlState} describe={(option) => `${option.name}${option.detail ? ` · ${option.detail}` : ""} · ${option.currentStock ?? 0} ${option.unit ?? ""} left`} />
                )}
                <Field id="waste-quantity" label={`Quantity${waste.source?.unit ? ` (${waste.source.unit})` : ""}`}>
                  <Input id="waste-quantity" className={fieldClass} inputMode="decimal" value={waste.quantity} onChange={(event) => setWaste({ quantity: event.currentTarget.value })} required />
                </Field>
                <Field id="waste-reason" label="Reason">
                  <select id="waste-reason" value={waste.reason} onChange={(event) => setWaste({ reason: event.currentTarget.value })} required className={selectClass}>
                    <option value="">Select reason</option>
                    {WASTE_REASON_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </Field>
                <div className="sm:col-span-2">
                  <Field id="waste-notes" label="Notes">
                    <Input id="waste-notes" className={fieldClass} maxLength={500} value={waste.notes} onChange={(event) => setWaste({ notes: event.currentTarget.value })} />
                  </Field>
                </div>
                <FormMessage error={errors.waste ?? null} status={statuses.waste ?? null} />
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <Button type="submit" className={primary} variant="destructive" disabled={pending}>Record waste</Button>
                  <Button type="button" variant="ghost" className={quiet} disabled={pending} onClick={() => { setWaste(EMPTY_DRAFTS.waste); setError("waste", null); }}>Clear</Button>
                </div>
              </form>
            </TaskBlock>
          </>
        ) : null}

        {sections.inventoryManage && activeTab === "count" ? (
          <TaskBlock id="ops-count-form" title="Count stock">
            <form onSubmit={submitCount} className={formClass} noValidate>
              <OptionPicker id="count-item" label="Inventory item" noun="item" page={data.purchaseInventoryItems} selected={count.item} onSelect={(item) => setCount({ item })} searchParam="purchaseInventorySearch" cursorParam="purchaseInventoryCursor" urlState={urlState} describe={(option) => `${option.name} · ${option.currentStock ?? 0} ${option.unit ?? ""} in stock`} />
              <Field id="count-quantity" label={`On hand${count.item?.unit ? ` (${count.item.unit})` : ""}`} hint={countChange}>
                <Input id="count-quantity" className={`${fieldClass} tabular-nums`} inputMode="decimal" value={count.quantity} onChange={(event) => setCount({ quantity: event.currentTarget.value })} aria-describedby={countChange ? "count-quantity-hint" : undefined} required />
              </Field>
              <Field id="count-notes" label="Notes">
                <Input id="count-notes" className={fieldClass} maxLength={500} value={count.notes} onChange={(event) => setCount({ notes: event.currentTarget.value })} />
              </Field>
              <FormMessage error={errors.count ?? null} status={statuses.count ?? null} />
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <Button type="submit" className={primary} disabled={pending}>Save count</Button>
                <Button type="button" variant="ghost" className={quiet} disabled={pending} onClick={() => { setCount(EMPTY_DRAFTS.count); setError("count", null); }}>Clear</Button>
              </div>
            </form>
          </TaskBlock>
        ) : null}

        {sections.inventoryManage && activeTab === "purchase" ? (
          <>
            <TaskBlock id="ops-po-recent" title="Recent purchase orders">
              {data.purchaseOrders.length ? (
                <PlatformTable label="Recent purchase orders" className={stackTable} head={[{ label: "PO" }, { label: "Supplier" }, { label: "Status" }, { label: "Expected" }, { label: "Subtotal", className: "text-right" }]}>
                  {data.purchaseOrders.slice(0, 5).map((po) => (
                    <tr key={po.id} className={stackRow}>
                      <td className={`${platformTd} whitespace-nowrap font-medium tabular-nums`}>{po.poNumber}</td>
                      <td className={`${platformTd} max-md:text-right [overflow-wrap:anywhere]`}>{po.supplier?.name ?? "No supplier"}</td>
                      <td className={`${platformTd} whitespace-nowrap`}><StatusCell status={po.status} /></td>
                      <td className={`${platformTd} whitespace-nowrap tabular-nums text-muted-foreground max-md:text-right`}>{po.expectedAt ? po.expectedAt.slice(0, 10) : "—"}</td>
                      <td className={`${platformTd} text-right tabular-nums max-md:col-span-2`}>{money(po.subtotalCents)}</td>
                    </tr>
                  ))}
                </PlatformTable>
              ) : <PlatformEmpty>No purchase orders yet.</PlatformEmpty>}
            </TaskBlock>
            <TaskBlock id="ops-po-form" title="Order stock">
              <form onSubmit={submitPurchase} className={formClass} noValidate>
                <OptionPicker id="po-supplier" label="Supplier" noun="supplier" page={data.purchaseSuppliers} selected={purchase.supplier} onSelect={(supplier) => setPurchase({ supplier })} searchParam="purchaseSupplierSearch" cursorParam="purchaseSupplierCursor" urlState={urlState} />
                <OptionPicker id="po-item" label="Inventory item" noun="item" page={data.purchaseInventoryItems} selected={purchase.item} onSelect={(item) => setPurchase({ item })} searchParam="purchaseInventorySearch" cursorParam="purchaseInventoryCursor" urlState={urlState} describe={(option) => option.unit ? `${option.name} (${option.unit})` : option.name} />
                <Field id="po-quantity" label={`Quantity${purchase.item?.unit ? ` (${purchase.item.unit})` : ""}`}>
                  <Input id="po-quantity" className={fieldClass} inputMode="decimal" value={purchase.quantity} onChange={(event) => setPurchase({ quantity: event.currentTarget.value })} required />
                </Field>
                <Field id="po-cost" label="Unit cost (USD)">
                  <Input id="po-cost" className={fieldClass} inputMode="decimal" value={purchase.unitCost} onChange={(event) => setPurchase({ unitCost: event.currentTarget.value })} required />
                </Field>
                <Field id="po-expected" label="Expected delivery date">
                  <Input id="po-expected" className={fieldClass} type="date" value={purchase.expectedDate} onChange={(event) => setPurchase({ expectedDate: event.currentTarget.value })} />
                </Field>
                <Field id="po-notes" label="Notes">
                  <Input id="po-notes" className={fieldClass} maxLength={500} value={purchase.notes} onChange={(event) => setPurchase({ notes: event.currentTarget.value })} />
                </Field>
                <FormMessage error={errors.purchase ?? null} status={statuses.purchase ?? null} />
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <Button type="submit" className={primary} disabled={pending}>Create purchase order</Button>
                  <Button type="button" variant="ghost" className={quiet} disabled={pending} onClick={() => { setPurchase(EMPTY_DRAFTS.purchase); setError("purchase", null); }}>Clear</Button>
                </div>
              </form>
            </TaskBlock>
          </>
        ) : null}

        {sections.staffing && activeTab === "shift" ? (
          <>
            <TaskBlock id="ops-shifts-today" title="On the schedule" meta={shifts.totalCount ?? undefined}>
              {shifts.loadError ? (
                <p role="alert" className="text-sm text-destructive">Shifts could not be loaded. <Link className="underline" href={operationsHref(urlState, { shiftCursor: null })}>Try again</Link></p>
              ) : <>
                {shifts.items.length ? (
                  <PlatformTable label="Shifts on the schedule" className={stackTable} head={[{ label: "Staff" }, { label: "Status" }, { label: "Role" }, { label: "Time" }, { label: <span className="sr-only">Actions</span> }]}>
                    {shifts.items.map((item) => (
                      <tr key={item.id} className={stackRow}>
                        <td className={`${platformTd} font-medium [overflow-wrap:anywhere]`}>
                          {item.staff?.name || item.staff?.email || "Unassigned"}
                          <span className="block text-xs font-normal tabular-nums text-muted-foreground">{item.shiftNumber}</span>
                        </td>
                        <td className={`${platformTd} whitespace-nowrap max-md:text-right`}>
                          <span className="inline-flex items-center gap-1.5"><StatusDot tone={item.status === "clocked_in" ? "green" : "blue"} pulse={item.status === "clocked_in"} /><span className="capitalize">{item.status.replaceAll("_", " ")}</span></span>
                        </td>
                        <td className={`${platformTd} capitalize`}>{item.role.replaceAll("_", " ")}</td>
                        <td className={`${platformTd} whitespace-nowrap tabular-nums text-muted-foreground max-md:text-right max-md:text-xs max-md:whitespace-normal`}>{item.startsAt ? formatStoreDateTime(item.startsAt, tz) : "No start time"}{item.endsAt ? ` – ${formatStoreDateTime(item.endsAt, tz)}` : ""}</td>
                        <td className={`${platformTd} text-right max-md:col-span-2 max-md:pt-1`}>
                          <span className="inline-flex flex-wrap justify-end gap-2 max-md:w-full">
                            {item.actions.map((action) => (
                              <Button key={action.status} className={`${primary} max-md:flex-1`} disabled={pending} onClick={() => transition(item.id, action.status as "clocked_in" | "completed", item.status)} aria-label={`${action.label}: ${item.staff?.name || item.shiftNumber}`}>{action.label}</Button>
                            ))}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </PlatformTable>
                ) : <PlatformEmpty>{urlState.shiftCursor ? "No more open shifts." : "No shifts scheduled or in progress."}</PlatformEmpty>}
                {urlState.shiftCursor || (shifts.hasMore && shifts.nextCursor) ? (
                  <div className="flex flex-wrap gap-4">
                    {urlState.shiftCursor ? <Link className={pager} href={operationsHref(urlState, { shiftCursor: null })} scroll={false}>Oldest first</Link> : null}
                    {shifts.hasMore && shifts.nextCursor ? <Link className={pager} href={operationsHref(urlState, { shiftCursor: shifts.nextCursor })} scroll={false}>More shifts</Link> : null}
                  </div>
                ) : null}
              </>}
              <div aria-live="polite">
                {errors.transition ? <p role="alert" className="text-sm text-destructive">{errors.transition}</p> : statuses.transition ? <p role="status" className="text-sm text-muted-foreground">{statuses.transition}</p> : null}
              </div>
            </TaskBlock>
            <TaskBlock id="ops-shift-form" title="Schedule a shift">
              <form onSubmit={submitShift} className={formClass} noValidate>
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
                  <Input id="shift-notes" className={fieldClass} maxLength={500} value={shift.notes} onChange={(event) => setShift({ notes: event.currentTarget.value })} />
                </Field>
                <Field id="shift-start" label="Starts (this device’s time)" hint={localTimeMessage("Start", shiftStart)}>
                  <Input id="shift-start" className={fieldClass} type="datetime-local" value={shift.startsLocal} disabled={!timesAvailable} onChange={(event) => setShift({ startsLocal: event.currentTarget.value })} aria-describedby="shift-start-hint" required />
                </Field>
                <Field id="shift-end" label="Ends (this device’s time)" hint={localTimeMessage("End", shiftEnd)}>
                  <Input id="shift-end" className={fieldClass} type="datetime-local" value={shift.endsLocal} disabled={!timesAvailable} onChange={(event) => setShift({ endsLocal: event.currentTarget.value })} aria-describedby="shift-end-hint" required />
                </Field>
                <FormMessage error={errors.shift ?? null} status={statuses.shift ?? null} />
                <div className="flex flex-wrap gap-2 sm:col-span-2">
                  <Button type="submit" className={primary} disabled={pending || !timesAvailable}>Schedule shift</Button>
                  <Button type="button" variant="ghost" className={quiet} disabled={pending} onClick={() => { setShift(EMPTY_DRAFTS.shift); setError("shift", null); }}>Clear</Button>
                </div>
              </form>
            </TaskBlock>
          </>
        ) : null}
      </div>

      <Dialog open={receiving !== null} onOpenChange={(open) => { if (!open && !pending) setReceiving(null); }}>
        <DialogContent className="rounded-[6px]">
          <form onSubmit={submitReceive} className="space-y-4" noValidate>
            <DialogHeader>
              <DialogTitle>Receive {receiving?.poNumber}</DialogTitle>
              <DialogDescription className="sr-only">Delivery details</DialogDescription>
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
            <Field id="receive-expiry" label="Expiry printed on the delivery (this device’s time)" hint={receiveExpiry ? localTimeMessage("Expiry", receiveExpiryResolution) : "Optional"}>
              <Input id="receive-expiry" className={fieldClass} type="datetime-local" value={receiveExpiry} disabled={!timesAvailable} onChange={(event) => setReceiveExpiry(event.currentTarget.value)} aria-describedby="receive-expiry-hint" />
            </Field>
            <div className="flex items-start gap-2">
              <Checkbox id="receive-confirm" checked={receiveConfirmed} onCheckedChange={(checked) => setReceiveConfirmed(checked === true)} />
              <Label htmlFor="receive-confirm" className="font-normal leading-snug">Full ordered quantity arrived (partial deliveries aren’t supported)</Label>
            </div>
            <FormMessage error={errors.receive ?? null} status={receiving ? statuses.receive ?? null : null} />
            <DialogFooter>
              <Button type="button" variant="outline" className="min-h-10 rounded-[6px]" disabled={pending} onClick={() => setReceiving(null)}>Cancel</Button>
              <Button type="submit" className="min-h-10 rounded-[6px] active:scale-[0.97]" disabled={pending || !receiveConfirmed}>Add to stock</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </section>
  );
}
