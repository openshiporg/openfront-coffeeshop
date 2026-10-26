"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Minus, Plus, Search, Trash2, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { PillButton, PillTrack, Segmented } from "@/features/platform/components/PillTabs";
import { PlatformEmpty } from "@/features/platform/components/PlatformPage";
import { StatusDot } from "@/features/platform/components/StatusTitle";
import {
  closeRegisterShiftAction,
  createPosOrderAction,
  loadPosCatalogAction,
  openRegisterShiftAction,
  quotePosOrderAction,
  recordRegisterCashMovementAction,
} from "../actions/create-pos-order";
import { readPendingPosCommand, releasePendingPosCommand, retainPendingPosCommand } from "../lib/commandRecovery";
import { formatMoney, parseMoneyInput, type MoneyParse } from "../lib/money";
import type {
  PosCartItem,
  PosCatalogPage,
  PosCommand,
  PosMenuItem,
  PosMenuModifier,
  PosOrderQuote,
  PosPaymentMethod,
  PosReceipt,
  PosRecoveryScope,
  PosRegisterData,
} from "../types";

const MAX_LINE_QUANTITY = 50;
const TERMINAL_REFERENCE = /^[A-Za-z0-9#._:/-]{4,64}$/;

function newKey() {
  return crypto.randomUUID();
}

function defaultModifierIds(item: PosMenuItem) {
  return (item.modifiers || []).filter((modifier) => modifier.defaultSelected && modifier.inStock !== false).map((modifier) => modifier.id);
}

function unitPrice(item: PosMenuItem, modifierIds: string[]) {
  return item.price + (item.modifiers || []).filter((modifier) => modifierIds.includes(modifier.id)).reduce((sum, modifier) => sum + Number(modifier.priceAdjustment || 0), 0);
}

type ModifierGroup = { key: string; label: string; all: PosMenuModifier[]; available: PosMenuModifier[]; min: number; max: number };

/** Same group policy the server enforces when quoting and creating the order. */
function modifierGroups(item: PosMenuItem): ModifierGroup[] {
  const groups = new Map<string, PosMenuModifier[]>();
  for (const modifier of item.modifiers || []) {
    const key = modifier.modifierGroup || "default";
    groups.set(key, [...(groups.get(key) || []), modifier]);
  }
  return [...groups].map(([key, all]) => ({
    key,
    label: all[0]?.modifierGroupLabel || (key === "default" ? "Options" : key.replaceAll("_", " ")),
    all,
    available: all.filter((modifier) => modifier.inStock !== false),
    min: Math.max(all.some((modifier) => modifier.required) ? 1 : 0, ...all.map((modifier) => Math.max(0, Number(modifier.minSelections || 0)))),
    max: Math.max(...all.map((modifier) => Math.max(1, Number(modifier.maxSelections || 1)))),
  }));
}

function selectionRule(group: ModifierGroup) {
  if (group.min === group.max) return `Choose ${group.min}`;
  if (group.min > 0) return `Choose ${group.min} to ${group.max}`;
  return group.max === 1 ? "Optional" : `Optional, up to ${group.max}`;
}

function PosModifierCustomizer({ item, onCancel, onAdd }: { item: PosMenuItem; onCancel: () => void; onAdd: (ids: string[]) => void }) {
  const groups = React.useMemo(() => modifierGroups(item), [item]);
  const [selected, setSelected] = React.useState(() => defaultModifierIds(item));
  const countIn = (group: ModifierGroup, ids = selected) => ids.filter((id) => group.all.some((option) => option.id === id)).length;

  function toggle(group: ModifierGroup, id: string) {
    setSelected((current) => {
      if (current.includes(id)) return current.filter((candidate) => candidate !== id);
      if (group.max === 1) return [...current.filter((candidate) => !group.all.some((option) => option.id === candidate)), id];
      return countIn(group, current) >= group.max ? current : [...current, id];
    });
  }
  function choose(group: ModifierGroup, id: string) {
    setSelected((current) => [...current.filter((candidate) => !group.all.some((option) => option.id === candidate)), id]);
  }

  const problems = groups.flatMap((group) => {
    const count = countIn(group);
    if (group.available.length < group.min) return [`Not enough ${group.label} options are in stock to sell this item.`];
    if (count < group.min) return [`Choose ${group.min - count} more ${group.label}.`];
    if (count > group.max) return [`Choose at most ${group.max} ${group.label}.`];
    return [];
  });

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] flex-col gap-4 overflow-hidden rounded-[6px]">
        <DialogHeader>
          <DialogTitle className="break-words pr-6">Customize {item.name}</DialogTitle>
          <DialogDescription className="tabular-nums">{formatMoney(item.price)}</DialogDescription>
        </DialogHeader>
        <div className="-mx-1 min-h-0 flex-1 space-y-5 overflow-y-auto px-1">
          {groups.map((group) => {
            const count = countIn(group);
            const legendId = `pos-group-${item.id}-${group.key}`;
            return (
              <fieldset key={group.key} className="space-y-2" aria-describedby={`${legendId}-rule`}>
                <legend id={legendId} className="text-sm font-semibold capitalize">{group.label}</legend>
                <p id={`${legendId}-rule`} className="text-xs text-muted-foreground">{selectionRule(group)}</p>
                {group.min === 1 && group.max === 1 ? (
                  <RadioGroup
                    aria-labelledby={legendId}
                    value={selected.find((id) => group.available.some((option) => option.id === id)) || ""}
                    onValueChange={(id) => choose(group, id)}
                  >
                    {group.available.map((modifier) => (
                      <div key={modifier.id} className="flex min-h-11 items-center justify-between gap-3 rounded-[6px] border border-border px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <RadioGroupItem id={`pos-mod-${modifier.id}`} value={modifier.id} />
                          <Label htmlFor={`pos-mod-${modifier.id}`} className="min-w-0 break-words">{modifier.name}</Label>
                        </div>
                        <span className="shrink-0 text-sm text-muted-foreground">{modifier.priceAdjustment ? `${modifier.priceAdjustment > 0 ? "+" : ""}${formatMoney(modifier.priceAdjustment)}` : "Included"}</span>
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  group.available.map((modifier) => {
                    const checked = selected.includes(modifier.id);
                    const atMax = !checked && group.max > 1 && count >= group.max;
                    return (
                      <div key={modifier.id} className="flex min-h-11 items-center justify-between gap-3 rounded-[6px] border border-border px-3 py-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <Checkbox id={`pos-mod-${modifier.id}`} checked={checked} disabled={atMax} onCheckedChange={() => toggle(group, modifier.id)} />
                          <Label htmlFor={`pos-mod-${modifier.id}`} className="min-w-0 break-words">{modifier.name}</Label>
                        </div>
                        <span className="shrink-0 text-sm text-muted-foreground">{modifier.priceAdjustment ? `${modifier.priceAdjustment > 0 ? "+" : ""}${formatMoney(modifier.priceAdjustment)}` : "Included"}</span>
                      </div>
                    );
                  })
                )}
                {!group.available.length && <p className="text-sm text-muted-foreground">No options in stock.</p>}
              </fieldset>
            );
          })}
        </div>
        {problems.length > 0 && <p role="status" className="text-sm text-destructive">{problems[0]}</p>}
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" className="rounded-[6px]" onClick={onCancel}>Cancel</Button>
          <Button type="button" className="rounded-[6px] active:scale-[0.97]" disabled={problems.length > 0} onClick={() => onAdd(selected)}>Add · {formatMoney(unitPrice(item, selected))}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type QuoteState =
  | { status: "idle" }
  | { status: "pricing" }
  | { status: "ready"; quote: PosOrderQuote; signature: string }
  | { status: "error" };

type Notice = { tone: "error" | "status"; text: string } | null;

function commandLabel(command: PosCommand) {
  switch (command.kind) {
    case "sale": return `Sale of ${formatMoney(command.totalCents)} (${command.request.paymentMethod === "manual_card" ? "external card" : command.totalCents === 0 ? "no charge" : "cash"})`;
    case "open": return `Opening ${command.request.registerName} with ${formatMoney(command.request.openingCashCents)}`;
    case "movement": return `${command.request.type === "pay_in" ? "Pay in" : command.request.type === "pay_out" ? "Pay out" : "Cash drop"} of ${formatMoney(command.request.amountCents)}`;
    case "close": return `Closing the shift with ${formatMoney(command.request.countedCashCents)} counted`;
  }
}

/** Exact total, then the next whole-dollar and banknote amounts above it. */
function cashQuickAmounts(totalCents: number) {
  const amounts = [totalCents];
  for (const step of [100, 500, 1000, 2000, 5000, 10000]) {
    const next = Math.ceil(totalCents / step) * step;
    const rounded = next === totalCents ? next + step : next;
    if (!amounts.includes(rounded)) amounts.push(rounded);
  }
  return amounts.sort((a, b) => a - b).slice(0, 5);
}

function moneyError(parse: MoneyParse) {
  return parse.kind === "invalid" ? parse.message : null;
}

export function PosRegister({ initial }: { initial: PosRegisterData }) {
  const router = useRouter();
  const scope: PosRecoveryScope = React.useMemo(() => ({ actorId: initial.operatorId, storeId: initial.storeId }), [initial.operatorId, initial.storeId]);
  const openShift = initial.openShift;

  // Catalogue (server-filtered, paginated)
  const [catalog, setCatalog] = React.useState<PosCatalogPage>({ items: initial.items, hasMore: initial.hasMore, nextCursor: initial.nextCursor });
  const [catalogStatus, setCatalogStatus] = React.useState<"ready" | "loading" | "error">("ready");
  const [searchInput, setSearchInput] = React.useState("");
  const [filter, setFilter] = React.useState({ search: "", categoryId: "" });

  // Ticket draft
  const [cart, setCart] = React.useState<PosCartItem[]>([]);
  const [customizing, setCustomizing] = React.useState<PosMenuItem | null>(null);
  const [customerName, setCustomerName] = React.useState("Counter guest");
  const [notes, setNotes] = React.useState("");
  const [tipInput, setTipInput] = React.useState("0.00");
  const [paymentMethod, setPaymentMethod] = React.useState<PosPaymentMethod>("cash");
  const [cardReference, setCardReference] = React.useState("");
  const [cashTendered, setCashTendered] = React.useState("");
  const [approvedFingerprint, setApprovedFingerprint] = React.useState<string | null>(null);
  const [quoteState, setQuoteState] = React.useState<QuoteState>({ status: "idle" });
  const [quoteAttempt, setQuoteAttempt] = React.useState(0);

  // Drawer forms
  const [registerName, setRegisterName] = React.useState("Front Register");
  const [editingRegister, setEditingRegister] = React.useState(false);
  const [openingCash, setOpeningCash] = React.useState("");
  const [countedCash, setCountedCash] = React.useState("");
  const [movementAmount, setMovementAmount] = React.useState("");
  const [movementReason, setMovementReason] = React.useState("");

  // Original command retained until a verified receipt or explicit discard
  const [pending, setPending] = React.useState<PosCommand | null>(null);
  const [inFlight, setInFlight] = React.useState(false);
  const [storageBlocked, setStorageBlocked] = React.useState(false);
  const [notice, setNotice] = React.useState<Notice>(null);
  const [receipts, setReceipts] = React.useState<PosReceipt[]>([]);
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const dispatching = React.useRef(false);

  // The register page links to /pos#drawer to count and close the open shift.
  React.useEffect(() => {
    if (openShift && window.location.hash === "#drawer") setDrawerOpen(true);
  }, [openShift]);

  React.useEffect(() => {
    const stored = readPendingPosCommand(scope);
    if (!stored.ok) {
      setStorageBlocked(true);
      return;
    }
    if (stored.command) {
      setPending(stored.command);
      if (stored.command.kind === "sale") setCart(stored.command.cart);
      setNotice({ tone: "error", text: "An earlier register action was not confirmed. Retry it to check; it will not be recorded twice." });
    }
  }, [scope]);

  const tipParse = parseMoneyInput(tipInput);
  const tipCents = tipParse.kind === "valid" ? tipParse.cents : tipParse.kind === "empty" ? 0 : null;
  const quoteSignature = JSON.stringify([cart.map((line) => [line.menuItemId, line.quantity, line.modifierIds]), tipCents]);
  const quote = quoteState.status === "ready" && quoteState.signature === quoteSignature ? quoteState.quote : null;
  const ticketLocked = inFlight || pending !== null;
  const writesBlocked = storageBlocked || inFlight || pending !== null;

  React.useEffect(() => {
    let active = true;
    if (!cart.length || tipCents === null) {
      setQuoteState({ status: "idle" });
      return () => { active = false; };
    }
    setQuoteState({ status: "pricing" });
    const signature = quoteSignature;
    const timer = window.setTimeout(async () => {
      try {
        const response = await quotePosOrderAction(cart, tipCents);
        if (!active) return;
        if (response.success && response.data.quoteCafeOrder) setQuoteState({ status: "ready", quote: response.data.quoteCafeOrder, signature });
        else setQuoteState({ status: "error" });
      } catch {
        if (active) setQuoteState({ status: "error" });
      }
    }, 200);
    return () => { active = false; window.clearTimeout(timer); };
    // quoteSignature captures cart pricing inputs and tip.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteSignature, quoteAttempt]);

  async function loadCatalog(next: { search: string; categoryId: string }, cursor?: string | null) {
    setCatalogStatus("loading");
    try {
      const result = await loadPosCatalogAction({ ...next, cursor: cursor || null });
      if (result.kind !== "ready") {
        if (!cursor) setCatalog({ items: [], hasMore: false, nextCursor: null });
        setCatalogStatus("error");
        return;
      }
      setFilter(next);
      setCatalog((current) => cursor
        ? { items: [...current.items, ...result.page.items.filter((item) => !current.items.some((existing) => existing.id === item.id))], hasMore: result.page.hasMore, nextCursor: result.page.nextCursor }
        : result.page);
      setCatalogStatus("ready");
    } catch {
      if (!cursor) setCatalog({ items: [], hasMore: false, nextCursor: null });
      setCatalogStatus("error");
    }
  }

  // Servings stock can still make, per menu item, as last read with the catalog.
  const stockCaps = React.useRef(new Map<string, number>());
  React.useEffect(() => {
    for (const item of catalog.items) {
      if (typeof item.maxQuantity === "number") stockCaps.current.set(item.id, item.maxQuantity);
      else stockCaps.current.delete(item.id);
    }
  }, [catalog.items]);

  /** How many more of a menu item the ticket can take; Infinity when stock doesn't limit it. */
  function roomFor(menuItemId: string, lines: PosCartItem[], excludeCartId?: string) {
    const cap = stockCaps.current.get(menuItemId);
    if (cap === undefined) return Infinity;
    return cap - lines.filter((line) => line.menuItemId === menuItemId && line.cartId !== excludeCartId).reduce((sum, line) => sum + line.quantity, 0);
  }

  function addItem(item: PosMenuItem, selectedModifierIds?: string[]) {
    if (ticketLocked) return;
    if (roomFor(item.id, cart) < 1) {
      setNotice({ tone: "error", text: `Only ${stockCaps.current.get(item.id) ?? 0} ${item.name} left` });
      setCustomizing(null);
      return;
    }
    const modifierIds = selectedModifierIds || defaultModifierIds(item);
    const modifiers = (item.modifiers || []).filter((modifier) => modifierIds.includes(modifier.id));
    setCart((current) => [
      ...current,
      { cartId: `${item.id}-${newKey()}`, menuItemId: item.id, name: item.name, quantity: 1, unitPrice: unitPrice(item, modifierIds), modifierIds, modifierNames: modifiers.map((modifier) => modifier.name) },
    ]);
    setCustomizing(null);
  }

  function updateQuantity(cartId: string, quantity: number) {
    if (ticketLocked) return;
    setCart((current) => current.map((item) => item.cartId === cartId ? { ...item, quantity: Math.min(MAX_LINE_QUANTITY, roomFor(item.menuItemId, current, cartId), Math.max(1, quantity)) } : item));
  }

  async function send(command: PosCommand): Promise<PosReceipt | { rejected: string } | null> {
    switch (command.kind) {
      case "sale": {
        const response = await createPosOrderAction({ ...command.request, idempotencyKey: command.key });
        // A domain rejection (sold out, unavailable) rolls the sale back, so it is definitely not recorded.
        if (!response.success && response.customerMessage) return { rejected: response.customerMessage };
        const order = response.success ? response.data.createCafePickupOrder : null;
        if (!order?.orderNumber || order.total !== command.totalCents) return null;
        return { kind: "sale", orderNumber: order.orderNumber, handoffCode: order.handoffCode, totalCents: order.total, tender: command.totalCents === 0 ? "none" : command.request.paymentMethod, terminalReference: command.request.externalCardReference };
      }
      case "open": {
        const response = await openRegisterShiftAction({ ...command.request, idempotencyKey: command.key });
        const shift = response.success ? response.data.openRegisterShift : null;
        if (!shift?.shiftNumber || shift.openingCashCents !== command.request.openingCashCents) return null;
        return { kind: "open", shiftNumber: shift.shiftNumber, registerName: shift.registerName, openingCashCents: shift.openingCashCents };
      }
      case "movement": {
        const response = await recordRegisterCashMovementAction({ ...command.request, idempotencyKey: command.key });
        const movement = response.success ? response.data.recordRegisterCashMovement : null;
        if (!movement?.movementNumber || movement.amountCents !== command.request.amountCents) return null;
        return { kind: "movement", movementNumber: movement.movementNumber, type: command.request.type, amountCents: movement.amountCents };
      }
      case "close": {
        const response = await closeRegisterShiftAction({ ...command.request, idempotencyKey: command.key });
        const shift = response.success ? response.data.closeRegisterShift : null;
        if (!shift?.shiftNumber || shift.status !== "closed" || shift.countedCashCents !== command.request.countedCashCents) return null;
        return { kind: "close", shiftNumber: shift.shiftNumber, expectedCashCents: shift.expectedCashCents, countedCashCents: Number(shift.countedCashCents), cashVarianceCents: Number(shift.cashVarianceCents || 0) };
      }
    }
  }

  async function dispatch(command: PosCommand) {
    if (dispatching.current || storageBlocked) return;
    dispatching.current = true;
    setNotice(null);
    if (!retainPendingPosCommand(scope, command)) {
      dispatching.current = false;
      setNotice({ tone: "error", text: "This browser could not keep a recovery copy of the action, so nothing was sent. Check that site storage is allowed and try again." });
      return;
    }
    setPending(command);
    setInFlight(true);
    try {
      const receipt = await send(command);
      if (receipt && "rejected" in receipt) {
        releasePendingPosCommand(scope, command.key);
        setPending(null);
        setApprovedFingerprint(null);
        setNotice({ tone: "error", text: `Sale not recorded. ${receipt.rejected}` });
        return;
      }
      if (!receipt) {
        let changed = false;
        if (command.kind === "sale") {
          try {
            const requote = await quotePosOrderAction(command.cart, command.request.tipCents);
            changed = requote.success && !!requote.data.quoteCafeOrder && requote.data.quoteCafeOrder.quoteFingerprint !== command.request.quoteFingerprint;
          } catch {
            changed = false;
          }
        }
        setNotice({
          tone: "error",
          text: changed
            ? "Prices or tax changed since this ticket was reviewed. Retry to check whether the original sale was recorded; if it was not, discard it and review the new total."
            : "The action was not confirmed. It may or may not have been recorded. Retry sends the same request and never records it twice. Discard only after confirming it was not recorded.",
        });
        return;
      }
      releasePendingPosCommand(scope, command.key);
      setPending(null);
      setReceipts((current) => [receipt, ...current].slice(0, 5));
      setNotice({ tone: "status", text: receiptText(receipt) });
      if (command.kind === "sale") {
        setCart([]);
        setNotes("");
        setTipInput("0.00");
        setCustomerName("Counter guest");
        setCardReference("");
        setCashTendered("");
        setApprovedFingerprint(null);
        setPaymentMethod("cash");
      } else if (command.kind === "movement") {
        setMovementAmount("");
        setMovementReason("");
      } else if (command.kind === "close") {
        setCountedCash("");
      } else {
        setOpeningCash("");
      }
      router.refresh();
    } catch {
      setNotice({ tone: "error", text: "The action was not confirmed. It may or may not have been recorded. Retry sends the same request and never records it twice." });
    } finally {
      dispatching.current = false;
      setInFlight(false);
    }
  }

  function discardPending() {
    if (!pending || inFlight) return;
    releasePendingPosCommand(scope, pending.key);
    setPending(null);
    setApprovedFingerprint(null);
    setNotice({ tone: "status", text: "Unconfirmed action discarded. Review the ticket before submitting again." });
  }

  const openingParse = parseMoneyInput(openingCash);
  const countedParse = parseMoneyInput(countedCash);
  const movementParse = parseMoneyInput(movementAmount, { allowZero: false });
  const effectiveMethod: PosPaymentMethod = quote?.total === 0 ? "cash" : paymentMethod;
  const cardReady = effectiveMethod !== "manual_card" || (TERMINAL_REFERENCE.test(cardReference.trim()) && !!quote && approvedFingerprint === quote.quoteFingerprint);
  // Cash received is recorded on the register receipt with the change due; the sale amount is the exact total. Empty means exact.
  const takesCash = effectiveMethod === "cash" && !!quote && quote.total > 0;
  const tenderedParse = parseMoneyInput(cashTendered);
  const tenderedCents = tenderedParse.kind === "valid" ? tenderedParse.cents : null;
  const changeDueCents = takesCash && quote && tenderedCents !== null ? tenderedCents - quote.total : null;
  const quickTenders = takesCash && quote ? cashQuickAmounts(quote.total) : [];
  const cashShort = takesCash && (tenderedParse.kind === "invalid" || (changeDueCents !== null && changeDueCents < 0));
  const cashReady = !takesCash || !cashShort;
  const canSubmitSale = !!openShift && !!quote && cart.length > 0 && cardReady && cashReady && !writesBlocked && customerName.trim().length > 0;

  function submitSale() {
    if (!openShift || !quote || !canSubmitSale) return;
    const isCard = effectiveMethod === "manual_card";
    void dispatch({
      kind: "sale",
      key: newKey(),
      totalCents: quote.total,
      cart,
      request: {
        customerName: customerName.trim(),
        notes: notes.trim(),
        paymentMethod: effectiveMethod,
        registerShiftId: openShift.id,
        tipCents: quote.tip,
        quoteFingerprint: quote.quoteFingerprint,
        ...(isCard ? { externalCardReference: cardReference.trim(), externalCardApproved: true } : {}),
        ...(takesCash && tenderedCents !== null ? { cashTenderedCents: tenderedCents } : {}),
        items: cart.map((line) => ({ menuItemId: line.menuItemId, quantity: line.quantity, modifierIds: line.modifierIds, notes: line.notes })),
      },
    });
  }

  function submitMovement(type: "pay_in" | "pay_out" | "cash_drop") {
    if (!openShift || movementParse.kind !== "valid" || !movementReason.trim()) return;
    void dispatch({ kind: "movement", key: newKey(), request: { registerShiftId: openShift.id, type, amountCents: movementParse.cents, reason: movementReason.trim() } });
  }

  const payoutTooLarge = !!openShift && movementParse.kind === "valid" && movementParse.cents > openShift.expectedCashCents;
  const saleLabel = !quote
    ? "Record sale"
    : quote.total === 0
      ? "Record no-charge order"
      : effectiveMethod === "manual_card"
        ? `Record external card payment · ${formatMoney(quote.total, quote.currencyCode)}`
        : `Record cash payment · ${formatMoney(quote.total, quote.currencyCode)}`;

  const lineCount = cart.reduce((sum, line) => sum + line.quantity, 0);
  const drawerPanel = openShift ? (
    <div className="space-y-6">
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[6px] border bg-border text-sm">
        {[
          ["Opening float", openShift.openingCashCents],
          ["Expected cash", openShift.expectedCashCents],
          ["Cash sales", openShift.cashSalesCents],
          ["Card sales", openShift.cardSalesCents],
          ["Tips", openShift.tipsCents],
          ["Pay in / out", openShift.payInsCents - openShift.payOutsCents],
        ].map(([label, cents]) => (
          <div key={label as string} className="bg-background px-3 py-2">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-semibold tabular-nums">{formatMoney(cents as number)}</dd>
          </div>
        ))}
      </dl>

      <section aria-labelledby="pos-movement-title" className="space-y-3">
        <h3 id="pos-movement-title" className="text-sm font-semibold">Cash movement</h3>
        <div className="grid gap-2 sm:grid-cols-[8rem_minmax(0,1fr)]">
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="pos-movement-amount">Amount</Label>
            <Input className="rounded-[6px]" id="pos-movement-amount" value={movementAmount} inputMode="decimal" placeholder="0.00" disabled={writesBlocked} aria-invalid={movementParse.kind === "invalid"} aria-describedby="pos-movement-error" onChange={(event) => setMovementAmount(event.target.value)} />
          </div>
          <div className="min-w-0 space-y-1.5">
            <Label htmlFor="pos-movement-reason">Reason</Label>
            <Input className="rounded-[6px]" id="pos-movement-reason" value={movementReason} maxLength={500} disabled={writesBlocked} onChange={(event) => setMovementReason(event.target.value)} />
          </div>
        </div>
        <p id="pos-movement-error" className="text-sm text-destructive empty:hidden">{moneyError(movementParse) || (payoutTooLarge ? `Can't exceed the ${formatMoney(openShift.expectedCashCents)} expected in the drawer.` : null)}</p>
        <div className="grid grid-cols-3 gap-2">
          {(["pay_in", "pay_out", "cash_drop"] as const).map((type) => (
            <Button
              key={type}
              type="button"
              variant="outline"
              className="min-h-10 rounded-[6px] active:scale-[0.97]"
              disabled={writesBlocked || movementParse.kind !== "valid" || !movementReason.trim() || (type !== "pay_in" && payoutTooLarge)}
              onClick={() => submitMovement(type)}
            >
              {type === "pay_in" ? "Pay in" : type === "pay_out" ? "Pay out" : "Cash drop"}
            </Button>
          ))}
        </div>
      </section>

      <form
        aria-labelledby="pos-close-title"
        className="space-y-3 border-t border-border pt-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (countedParse.kind !== "valid") return;
          void dispatch({ kind: "close", key: newKey(), request: { registerShiftId: openShift.id, countedCashCents: countedParse.cents } });
        }}
      >
        <h3 id="pos-close-title" className="text-sm font-semibold">Close shift</h3>
        <div className="flex items-end gap-2">
          <div className="min-w-0 flex-1 space-y-1.5">
            <Label htmlFor="pos-counted-cash">Counted cash</Label>
            <Input className="rounded-[6px]" id="pos-counted-cash" value={countedCash} inputMode="decimal" placeholder="0.00" disabled={writesBlocked} aria-invalid={countedParse.kind === "invalid"} aria-describedby="pos-counted-error" onChange={(event) => setCountedCash(event.target.value)} />
          </div>
          <Button type="submit" variant="destructive" className="min-h-10 rounded-[6px] active:scale-[0.97]" disabled={writesBlocked || countedParse.kind !== "valid"}>Close shift</Button>
        </div>
        <p id="pos-counted-error" className="text-sm text-destructive empty:hidden">{moneyError(countedParse)}</p>
      </form>
    </div>
  ) : null;

  const pendingPanel = pending ? (
    <div role="alert" className="space-y-2 rounded-[6px] border border-destructive/40 bg-destructive/5 p-3 text-sm">
      <p className="font-medium">Unconfirmed: {commandLabel(pending)}</p>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" className="rounded-[6px] active:scale-[0.97]" disabled={inFlight} onClick={() => void dispatch(pending)}>{inFlight ? "Checking…" : "Retry"}</Button>
        <Button type="button" size="sm" variant="outline" className="rounded-[6px]" disabled={inFlight} onClick={discardPending}>Discard</Button>
        <Button asChild size="sm" variant="ghost" className="rounded-[6px]"><Link href="/dashboard/platform/orders">Orders<ArrowUpRight aria-hidden /></Link></Button>
      </div>
    </div>
  ) : null;

  const noticePanel = (
    <div aria-live="assertive" role={notice?.tone === "error" ? "alert" : "status"}>
      {notice && <p className={`rounded-[6px] p-3 text-sm ${notice.tone === "error" ? "border border-destructive/40 bg-destructive/5 text-destructive" : "border bg-muted/40 text-foreground"}`}>{notice.text}</p>}
    </div>
  );

  const receiptsPanel = receipts.length > 0 ? (
    <div className="space-y-1.5 border-t border-border pt-3">
      <p className="text-xs font-medium text-muted-foreground">Recent</p>
      <ul className="space-y-1 text-sm">
        {receipts.map((receipt, index) => (
          <li key={index} className="break-words text-muted-foreground">
            {receipt.kind === "sale"
              ? <><Link className="font-medium text-foreground underline underline-offset-4" href={`/dashboard/platform/orders?search=${encodeURIComponent(receipt.orderNumber)}`}>#{receipt.orderNumber}</Link> · {receiptText(receipt).replace(/^Order #\S+ recorded\. /, "")}</>
              : receiptText(receipt)}
          </li>
        ))}
      </ul>
    </div>
  ) : null;

  const fieldClass = "h-10 rounded-[6px]";

  return (
    // The right gutter at lg keeps the sticky ticket's Record button out of the floating assistant's column (3rem at 0.75rem).
    <div className="min-w-0 px-4 pb-28 md:px-6 lg:pb-24 lg:pr-20">
      {storageBlocked && (
        <div role="alert" className="mb-4 rounded-[6px] border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          Site storage is blocked, so sales and drawer actions are disabled. Allow site storage and reload.
        </div>
      )}

      {openShift ? (
        <div className="mb-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b pb-3">
          <p className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm">
            <span className="inline-flex items-center gap-1.5 font-semibold"><StatusDot tone="green" />{openShift.registerName}</span>
            <span className="tabular-nums text-muted-foreground">Shift {openShift.shiftNumber}</span>
            <span className="text-muted-foreground">Expected cash <span className="font-medium tabular-nums text-foreground">{formatMoney(openShift.expectedCashCents)}</span></span>
          </p>
          <Button type="button" variant="outline" className="h-9 rounded-[6px] active:scale-[0.97]" onClick={() => setDrawerOpen(true)}>
            <Wallet aria-hidden />Drawer
          </Button>
        </div>
      ) : (
        <form
          aria-labelledby="pos-open-shift-title"
          className="mb-5 max-w-xl space-y-3 rounded-[6px] border bg-card p-4"
          onSubmit={(event) => {
            event.preventDefault();
            if (openingParse.kind !== "valid" || !registerName.trim()) return;
            void dispatch({ kind: "open", key: newKey(), request: { registerName: registerName.trim(), openingCashCents: openingParse.cents } });
          }}
        >
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h2 id="pos-open-shift-title" className="inline-flex items-center gap-2 text-base font-semibold"><StatusDot tone="zinc" />Register closed</h2>
            {editingRegister ? null : (
              <p className="text-sm text-muted-foreground">
                <span className="[overflow-wrap:anywhere]">{registerName || "No register name"}</span>
                {" · "}
                <button type="button" className="font-medium text-foreground underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => setEditingRegister(true)} disabled={writesBlocked}>Change</button>
              </p>
            )}
          </div>
          {editingRegister ? (
            <div className="space-y-1.5">
              <Label htmlFor="pos-register-name">Register name</Label>
              <Input id="pos-register-name" className={fieldClass} value={registerName} maxLength={100} autoFocus onChange={(event) => setRegisterName(event.target.value)} disabled={writesBlocked} />
            </div>
          ) : null}
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="pos-opening-cash">Opening cash</Label>
              <Input id="pos-opening-cash" className={cn(fieldClass, "text-base tabular-nums")} value={openingCash} onChange={(event) => setOpeningCash(event.target.value)} inputMode="decimal" placeholder="0.00" aria-invalid={openingParse.kind === "invalid"} aria-describedby="pos-opening-cash-error" disabled={writesBlocked} autoFocus={!editingRegister} />
            </div>
            <Button type="submit" className="h-10 rounded-[6px] px-5 active:scale-[0.97]" disabled={writesBlocked || openingParse.kind !== "valid" || !registerName.trim()}>
              {inFlight && pending?.kind === "open" ? "Opening…" : "Open shift"}
            </Button>
          </div>
          <p id="pos-opening-cash-error" className="text-sm text-destructive empty:hidden">{moneyError(openingParse)}</p>
          {!openShift && (pendingPanel || notice) ? <div className="space-y-2">{pendingPanel}{noticePanel}</div> : null}
        </form>
      )}

      <div className={cn("grid min-w-0 gap-6", openShift && "lg:grid-cols-[minmax(0,1fr)_minmax(20rem,24rem)]")}>
        <section className="min-w-0 space-y-3" aria-label="Menu">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-4">
            <form
              role="search"
              className="relative min-w-0 sm:w-64 sm:shrink-0"
              onSubmit={(event) => { event.preventDefault(); void loadCatalog({ search: searchInput.trim(), categoryId: filter.categoryId }); }}
            >
              <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
              <Label htmlFor="pos-search" className="sr-only">Search menu</Label>
              <Input id="pos-search" type="search" enterKeyHint="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search menu" maxLength={200} className="h-9 min-w-0 rounded-[6px] pl-8" aria-busy={catalogStatus === "loading"} />
            </form>
            {initial.categories.length > 0 && (
              <PillTrack label="Category" className="min-w-0 flex-1">
                {[{ id: "", name: "All" }, ...initial.categories].map((category) => (
                  <PillButton
                    key={category.id || "all"}
                    active={filter.categoryId === category.id}
                    disabled={catalogStatus === "loading"}
                    onClick={() => void loadCatalog({ search: filter.search, categoryId: category.id })}
                  >
                    {category.name}
                  </PillButton>
                ))}
              </PillTrack>
            )}
          </div>

          <div aria-live="polite" aria-busy={catalogStatus === "loading"}>
            {catalogStatus === "error" && (
              <div role="alert" className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-[6px] border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <p>Menu items couldn&apos;t load.</p>
                <Button type="button" variant="outline" size="sm" className="rounded-[6px]" onClick={() => void loadCatalog(filter, catalog.items.length ? catalog.nextCursor : null)}>Try again</Button>
              </div>
            )}
            {catalogStatus !== "error" && !catalog.items.length && (
              <PlatformEmpty>{filter.search || filter.categoryId ? "No available items match." : "No menu items for sale."}</PlatformEmpty>
            )}
            <div className={cn("grid grid-cols-2 gap-2 sm:grid-cols-3", openShift ? "xl:grid-cols-4" : "lg:grid-cols-4 xl:grid-cols-5")}>
              {catalog.items.map((item) => {
                const inTicket = cart.filter((line) => line.menuItemId === item.id).reduce((sum, line) => sum + line.quantity, 0);
                const soldOut = item.availability === "sold_out";
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={ticketLocked || !openShift || soldOut}
                    aria-label={soldOut ? `${item.name}, sold out` : undefined}
                    onClick={() => item.modifiers?.length ? setCustomizing(item) : addItem(item)}
                    className={cn(
                      "relative flex min-h-[5.5rem] min-w-0 flex-col justify-between gap-3 rounded-[6px] border bg-background p-3 text-left transition-[background-color,border-color,transform] duration-150 ease-out hover:border-foreground/40 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring active:scale-[0.97] disabled:cursor-not-allowed disabled:bg-muted/30 disabled:hover:border-border",
                      inTicket > 0 && "border-foreground",
                    )}
                  >
                    <span className="min-w-0 pr-7">
                      <span className={cn("block break-words text-[0.9375rem] font-semibold leading-snug", soldOut && "text-muted-foreground line-through")}>{item.name}</span>
                      {item.category?.name && <span className="mt-0.5 block break-words text-xs text-muted-foreground">{item.category.name}</span>}
                    </span>
                    <span className="flex items-end justify-between gap-2">
                      <span className="text-sm font-semibold tabular-nums">{formatMoney(item.price)}</span>
                      {soldOut ? <span className="rounded-[4px] bg-muted px-1.5 py-0.5 text-xs font-medium text-muted-foreground">Sold out</span>
                        : typeof item.maxQuantity === "number" && item.maxQuantity <= 10 ? <span className="text-xs font-medium tabular-nums text-amber-700 dark:text-amber-400">{item.maxQuantity} left</span>
                        : item.modifiers?.length ? <span className="text-xs text-muted-foreground">Options</span> : null}
                    </span>
                    {inTicket > 0 && <span className="absolute right-2 top-2 grid h-6 min-w-6 place-items-center rounded-[4px] bg-foreground px-1.5 text-xs font-semibold tabular-nums text-background" aria-label={`${inTicket} on ticket`}>{inTicket}</span>}
                  </button>
                );
              })}
            </div>
            {catalog.hasMore && catalogStatus !== "error" && (
              <Button type="button" variant="outline" className="mt-3 rounded-[6px]" disabled={catalogStatus === "loading"} onClick={() => void loadCatalog(filter, catalog.nextCursor)}>
                {catalogStatus === "loading" ? "Loading…" : "Load more"}
              </Button>
            )}
          </div>
        </section>

        {customizing ? <PosModifierCustomizer item={customizing} onCancel={() => setCustomizing(null)} onAdd={(modifierIds) => addItem(customizing, modifierIds)} /> : null}

        {openShift ? (
          <aside id="pos-ticket" className="min-w-0 scroll-mt-4 lg:sticky lg:top-4 lg:self-start" aria-labelledby="pos-ticket-title">
            <div className="rounded-[6px] border bg-card">
              <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
                <h2 id="pos-ticket-title" className="font-semibold">Ticket</h2>
                <span className="text-sm tabular-nums text-muted-foreground">{lineCount} {lineCount === 1 ? "item" : "items"}</span>
              </div>
              <div className="space-y-4 p-4">
                {pendingPanel}

                {cart.length ? (
                  <ul className="divide-y">
                    {cart.map((item, index) => {
                      const lineName = `${item.name}, line ${index + 1}`;
                      return (
                        <li key={item.cartId} className="flex min-w-0 items-center gap-3 py-2 first:pt-0">
                          <div className="inline-flex shrink-0 items-center rounded-[6px] border">
                            <Button type="button" variant="ghost" size="icon" className="size-9 rounded-[5px] rounded-r-none" disabled={ticketLocked || item.quantity <= 1} aria-label={`Decrease quantity of ${lineName}`} onClick={() => updateQuantity(item.cartId, item.quantity - 1)}><Minus aria-hidden /></Button>
                            <span className="w-7 text-center text-sm font-semibold tabular-nums" aria-label={`Quantity of ${lineName}`}>{item.quantity}</span>
                            <Button type="button" variant="ghost" size="icon" className="size-9 rounded-[5px] rounded-l-none" disabled={ticketLocked || item.quantity >= MAX_LINE_QUANTITY || item.quantity >= roomFor(item.menuItemId, cart, item.cartId)} aria-label={`Increase quantity of ${lineName}`} onClick={() => updateQuantity(item.cartId, item.quantity + 1)}><Plus aria-hidden /></Button>
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="break-words text-sm font-medium">{item.name}</div>
                            {item.modifierNames.length > 0 && <div className="break-words text-xs text-muted-foreground">{item.modifierNames.join(", ")}</div>}
                          </div>
                          <span className="shrink-0 text-sm font-semibold tabular-nums">{quote?.lines[index] ? formatMoney(quote.lines[index].lineTotal, quote.currencyCode) : "—"}</span>
                          <Button type="button" variant="ghost" size="icon" className="size-9 shrink-0 rounded-[6px] text-muted-foreground hover:text-destructive" disabled={ticketLocked} aria-label={`Remove ${lineName}`} onClick={() => setCart((current) => current.filter((line) => line.cartId !== item.cartId))}>
                            <Trash2 aria-hidden />
                          </Button>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="py-2 text-sm text-muted-foreground">Tap an item to start a ticket.</p>
                )}

                <div className="grid grid-cols-[minmax(0,1fr)_6.5rem] gap-2 border-t pt-4">
                  <div className="min-w-0 space-y-1.5">
                    <Label htmlFor="pos-customer-name">Name</Label>
                    <Input id="pos-customer-name" className={fieldClass} value={customerName} maxLength={200} disabled={ticketLocked} onChange={(event) => setCustomerName(event.target.value)} />
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <Label htmlFor="pos-tip">Tip</Label>
                    <Input id="pos-tip" className={cn(fieldClass, "tabular-nums")} value={tipInput} inputMode="decimal" disabled={ticketLocked} aria-invalid={tipParse.kind === "invalid"} aria-describedby="pos-tip-error" onChange={(event) => setTipInput(event.target.value)} />
                  </div>
                  <p id="pos-tip-error" className="col-span-2 text-sm text-destructive empty:hidden">{moneyError(tipParse)}</p>
                  <details className="group col-span-2" open={notes.length > 0 || undefined}>
                    <summary className="flex min-h-9 cursor-pointer list-none items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground [&::-webkit-details-marker]:hidden">
                      <Plus className="size-3.5 transition-transform duration-150 group-open:rotate-45" aria-hidden />Ticket notes{notes ? <span className="truncate font-normal">· {notes}</span> : null}
                    </summary>
                    <Label htmlFor="pos-ticket-notes" className="sr-only">Ticket notes</Label>
                    <Textarea id="pos-ticket-notes" value={notes} maxLength={2000} disabled={ticketLocked} onChange={(event) => setNotes(event.target.value)} className="mt-1 min-h-14 rounded-[6px]" />
                  </details>
                </div>

                {quote?.total !== 0 && (
                  <div className="space-y-2">
                    <p id="pos-tender-label" className="text-sm font-medium">Tender</p>
                    <Segmented<PosPaymentMethod>
                      label="Tender"
                      value={paymentMethod}
                      className="flex w-full [&>button]:h-12 [&>button]:text-base"
                      options={[{ value: "cash", label: "Cash", disabled: ticketLocked }, { value: "manual_card", label: "External card", disabled: ticketLocked }]}
                      onChange={setPaymentMethod}
                    />
                  </div>
                )}
                {takesCash && quote && (
                  <div className="space-y-2">
                    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
                      <div className="min-w-0 space-y-1.5">
                        <Label htmlFor="pos-cash-tendered">Cash received</Label>
                        <Input id="pos-cash-tendered" value={cashTendered} inputMode="decimal" placeholder={(quote.total / 100).toFixed(2)} autoComplete="off" disabled={ticketLocked} className={cn(fieldClass, "tabular-nums")} aria-invalid={cashShort} aria-describedby="pos-cash-change" onChange={(event) => setCashTendered(event.target.value)} />
                      </div>
                      <p id="pos-cash-change" aria-live="polite" className="pb-2 text-right text-sm">
                        {tenderedParse.kind === "invalid"
                          ? <span className="text-destructive">{tenderedParse.message}</span>
                          : changeDueCents !== null && changeDueCents < 0
                            ? <span className="text-destructive">Short <span className="font-semibold tabular-nums">{formatMoney(-changeDueCents, quote.currencyCode)}</span></span>
                            : <>Change <span className="font-semibold tabular-nums">{formatMoney(changeDueCents ?? 0, quote.currencyCode)}</span></>}
                      </p>
                    </div>
                    <Segmented
                      label="Cash amount"
                      size="sm"
                      className="flex w-full [&>button]:h-9 [&>button]:px-1.5 [&>button]:text-sm [&>button]:tabular-nums"
                      value={tenderedCents === null ? "" : String(tenderedCents)}
                      options={quickTenders.map((cents, index) => ({ value: String(cents), label: index === 0 ? "Exact" : formatMoney(cents, quote.currencyCode).replace(/\.00$/, ""), disabled: ticketLocked }))}
                      onChange={(value) => setCashTendered((Number(value) / 100).toFixed(2))}
                    />
                  </div>
                )}
                {effectiveMethod === "manual_card" && (
                  <div className="space-y-3 rounded-[6px] border bg-muted/30 p-3">
                    <p className="text-xs text-muted-foreground">Run the card on the terminal first. Nothing is charged from here.</p>
                    <div className="space-y-1.5">
                      <Label htmlFor="pos-card-reference">Terminal approval code</Label>
                      <Input id="pos-card-reference" value={cardReference} maxLength={64} autoComplete="off" disabled={ticketLocked} className={cn(fieldClass, "bg-background")} aria-invalid={cardReference.trim().length > 0 && !TERMINAL_REFERENCE.test(cardReference.trim())} onChange={(event) => setCardReference(event.target.value)} />
                    </div>
                    <div className="flex items-start gap-2">
                      <Checkbox
                        id="pos-card-approved"
                        checked={!!quote && approvedFingerprint === quote.quoteFingerprint}
                        disabled={ticketLocked || !quote}
                        onCheckedChange={(checked) => setApprovedFingerprint(checked === true && quote ? quote.quoteFingerprint : null)}
                      />
                      <Label htmlFor="pos-card-approved" className="leading-5">Terminal approved {quote ? formatMoney(quote.total, quote.currencyCode) : "this total"}</Label>
                    </div>
                  </div>
                )}

                <dl className="space-y-1 border-t pt-3 text-sm tabular-nums">
                  <div className="flex justify-between text-muted-foreground"><dt>Subtotal</dt><dd>{quote ? formatMoney(quote.subtotal, quote.currencyCode) : "—"}</dd></div>
                  <div className="flex justify-between text-muted-foreground"><dt>Tax</dt><dd>{quote ? formatMoney(quote.tax, quote.currencyCode) : "—"}</dd></div>
                  <div className="flex justify-between text-muted-foreground"><dt>Tip</dt><dd>{quote ? formatMoney(quote.tip, quote.currencyCode) : "—"}</dd></div>
                  <div className="flex justify-between pt-1 text-xl font-semibold tracking-tight"><dt>Total</dt><dd>{quote ? formatMoney(quote.total, quote.currencyCode) : "—"}</dd></div>
                </dl>
                <div aria-live="polite" className="text-sm text-muted-foreground empty:hidden">
                  {quoteState.status === "pricing" && "Pricing…"}
                  {quoteState.status === "error" && (
                    <span className="text-destructive">
                      Couldn&apos;t price this ticket. <button type="button" className="underline underline-offset-4" onClick={() => setQuoteAttempt((value) => value + 1)}>Try again</button>
                    </span>
                  )}
                </div>
                <Button type="button" className="min-h-12 w-full rounded-[6px] text-base active:scale-[0.98]" disabled={!canSubmitSale} aria-busy={inFlight && pending?.kind === "sale"} onClick={submitSale}>
                  {inFlight && pending?.kind === "sale" ? "Recording…" : saleLabel}
                </Button>
                {noticePanel}
                {receiptsPanel}
              </div>
            </div>
          </aside>
        ) : receipts.length > 0 ? <div className="max-w-xl">{receiptsPanel}</div> : null}
      </div>

      {openShift && cart.length > 0 && (
        <a
          href="#pos-ticket"
          className="fixed bottom-4 left-4 right-20 z-20 flex min-h-12 items-center justify-between gap-3 rounded-[6px] bg-foreground px-4 text-sm font-semibold text-background shadow-[0_6px_20px_-6px_rgb(0_0_0/0.35)] transition-transform duration-150 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 lg:hidden"
        >
          <span className="tabular-nums">Ticket · {lineCount} {lineCount === 1 ? "item" : "items"}</span>
          <span className="tabular-nums">{quote ? formatMoney(quote.total, quote.currencyCode) : "Pricing…"}</span>
        </a>
      )}

      <Sheet open={drawerOpen && !!openShift} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{openShift?.registerName ?? "Drawer"}</SheetTitle>
            <SheetDescription className="tabular-nums">{openShift?.shiftNumber}</SheetDescription>
          </SheetHeader>
          <div className="px-4 pb-6">{drawerPanel}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

function receiptText(receipt: PosReceipt) {
  switch (receipt.kind) {
    case "sale": {
      const tender = receipt.tender === "none" ? "no charge" : receipt.tender === "manual_card" ? `external card${receipt.terminalReference ? ` (ref ${receipt.terminalReference})` : ""}` : "cash";
      return `Order #${receipt.orderNumber} recorded. ${formatMoney(receipt.totalCents)} ${tender}${receipt.handoffCode ? ` · handoff ${receipt.handoffCode}` : ""}.`;
    }
    case "open": return `Shift ${receipt.shiftNumber} opened on ${receipt.registerName} with ${formatMoney(receipt.openingCashCents)}.`;
    case "movement": return `${receipt.type === "pay_in" ? "Pay in" : receipt.type === "pay_out" ? "Pay out" : "Cash drop"} ${receipt.movementNumber} recorded: ${formatMoney(receipt.amountCents)}.`;
    case "close": return `Shift ${receipt.shiftNumber} closed. Expected ${formatMoney(receipt.expectedCashCents)}, counted ${formatMoney(receipt.countedCashCents)}, variance ${formatMoney(receipt.cashVarianceCents)}.`;
  }
}
