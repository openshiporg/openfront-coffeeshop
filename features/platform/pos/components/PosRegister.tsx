"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Minus, Plus, Search, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
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
      <DialogContent className="flex max-h-[90vh] w-[calc(100%-2rem)] flex-col gap-4 overflow-hidden">
        <DialogHeader>
          <DialogTitle className="break-words pr-6">Customize {item.name}</DialogTitle>
          <DialogDescription>Choose options for this line.</DialogDescription>
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
                      <div key={modifier.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
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
                      <div key={modifier.id} className="flex items-center justify-between gap-3 rounded-md border border-border p-3">
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
          <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
          <Button type="button" disabled={problems.length > 0} onClick={() => onAdd(selected)}>Add · {formatMoney(unitPrice(item, selected))}</Button>
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
  const [approvedFingerprint, setApprovedFingerprint] = React.useState<string | null>(null);
  const [quoteState, setQuoteState] = React.useState<QuoteState>({ status: "idle" });
  const [quoteAttempt, setQuoteAttempt] = React.useState(0);

  // Drawer forms
  const [registerName, setRegisterName] = React.useState("Front Register");
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
  const dispatching = React.useRef(false);

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

  function addItem(item: PosMenuItem, selectedModifierIds?: string[]) {
    if (ticketLocked) return;
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
    setCart((current) => current.map((item) => item.cartId === cartId ? { ...item, quantity: Math.min(MAX_LINE_QUANTITY, Math.max(1, quantity)) } : item));
  }

  async function send(command: PosCommand): Promise<PosReceipt | null> {
    switch (command.kind) {
      case "sale": {
        const response = await createPosOrderAction({ ...command.request, idempotencyKey: command.key });
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
  const canSubmitSale = !!openShift && !!quote && cart.length > 0 && cardReady && !writesBlocked && customerName.trim().length > 0;

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

  return (
    <div className="grid min-w-0 gap-6 px-4 pb-8 md:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,24rem)]">
      <section className="min-w-0 space-y-6" aria-label="Menu">
        {storageBlocked && (
          <div role="alert" className="rounded-lg border border-destructive/40 bg-card p-4 text-sm text-destructive">
            This browser cannot keep a safe recovery copy of register actions, so sales and drawer actions are disabled. Allow site storage for this page and reload.
          </div>
        )}

        {openShift ? (
          <Card>
            <CardContent className="grid gap-4 pt-6 sm:grid-cols-2 xl:grid-cols-4">
              <div className="min-w-0"><p className="text-xs text-muted-foreground">Open shift</p><p className="break-words font-semibold">{openShift.registerName}</p><p className="font-mono text-xs text-muted-foreground">{openShift.shiftNumber}</p></div>
              <div><p className="text-xs text-muted-foreground">Expected cash</p><p className="text-xl font-semibold">{formatMoney(openShift.expectedCashCents)}</p></div>
              <div><p className="text-xs text-muted-foreground">Cash / card sales</p><p className="font-semibold">{formatMoney(openShift.cashSalesCents)} / {formatMoney(openShift.cardSalesCents)}</p></div>
              <div><p className="text-xs text-muted-foreground">Tips</p><p className="text-xl font-semibold">{formatMoney(openShift.tipsCents)}</p></div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader><CardTitle className="text-lg">Open a register shift</CardTitle></CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">Count the opening float before the first sale.</p>
              <form
                className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,10rem)_auto] sm:items-end"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (openingParse.kind !== "valid" || !registerName.trim()) return;
                  void dispatch({ kind: "open", key: newKey(), request: { registerName: registerName.trim(), openingCashCents: openingParse.cents } });
                }}
              >
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="pos-register-name">Register name</Label>
                  <Input id="pos-register-name" value={registerName} maxLength={100} onChange={(event) => setRegisterName(event.target.value)} disabled={writesBlocked} />
                </div>
                <div className="min-w-0 space-y-1.5">
                  <Label htmlFor="pos-opening-cash">Opening cash</Label>
                  <Input id="pos-opening-cash" value={openingCash} onChange={(event) => setOpeningCash(event.target.value)} inputMode="decimal" placeholder="0.00" aria-invalid={openingParse.kind === "invalid"} aria-describedby="pos-opening-cash-error" disabled={writesBlocked} />
                </div>
                <Button type="submit" disabled={writesBlocked || openingParse.kind !== "valid" || !registerName.trim()}>Open shift</Button>
                <p id="pos-opening-cash-error" className="text-sm text-destructive sm:col-span-3">{moneyError(openingParse)}</p>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3">
          <form
            role="search"
            className="flex min-w-0 gap-2"
            onSubmit={(event) => { event.preventDefault(); void loadCatalog({ search: searchInput.trim(), categoryId: filter.categoryId }); }}
          >
            <Label htmlFor="pos-search" className="sr-only">Search menu</Label>
            <Input id="pos-search" type="search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search menu" maxLength={200} className="min-w-0" />
            <Button type="submit" variant="outline" disabled={catalogStatus === "loading"}><Search aria-hidden />Search</Button>
          </form>
          {initial.categories.length > 0 && (
            <div className="flex flex-wrap gap-2" role="group" aria-label="Category">
              {[{ id: "", name: "All" }, ...initial.categories].map((category) => (
                <Button
                  key={category.id || "all"}
                  type="button"
                  size="sm"
                  variant={filter.categoryId === category.id ? "default" : "outline"}
                  aria-pressed={filter.categoryId === category.id}
                  disabled={catalogStatus === "loading"}
                  onClick={() => void loadCatalog({ search: filter.search, categoryId: category.id })}
                >
                  {category.name}
                </Button>
              ))}
            </div>
          )}
        </div>

        <div aria-live="polite" aria-busy={catalogStatus === "loading"}>
          {catalogStatus === "error" && (
            <div role="alert" className="mb-3 rounded-lg border border-border bg-card p-4 text-sm">
              <p>Menu items could not be loaded.</p>
              <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => void loadCatalog(filter, catalog.items.length ? catalog.nextCursor : null)}>Try again</Button>
            </div>
          )}
          {catalogStatus !== "error" && !catalog.items.length && (
            <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{filter.search || filter.categoryId ? "No available items match." : "No menu items are available for sale."}</p>
          )}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {catalog.items.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={ticketLocked || !openShift}
                onClick={() => item.modifiers?.length ? setCustomizing(item) : addItem(item)}
                className="min-w-0 rounded-lg border border-border bg-card p-4 text-left text-card-foreground shadow-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
              >
                <div className="flex min-w-0 justify-between gap-3">
                  <div className="min-w-0">
                    <div className="break-words font-semibold">{item.name}</div>
                    {item.category?.name && <div className="mt-1 break-words text-xs text-muted-foreground">{item.category.name}</div>}
                  </div>
                  <div className="shrink-0 font-semibold">{formatMoney(item.price)}</div>
                </div>
              </button>
            ))}
          </div>
          {catalog.hasMore && catalogStatus !== "error" && (
            <Button type="button" variant="outline" className="mt-3" disabled={catalogStatus === "loading"} onClick={() => void loadCatalog(filter, catalog.nextCursor)}>
              {catalogStatus === "loading" ? "Loading…" : "Load more"}
            </Button>
          )}
        </div>
      </section>

      {customizing ? <PosModifierCustomizer item={customizing} onCancel={() => setCustomizing(null)} onAdd={(modifierIds) => addItem(customizing, modifierIds)} /> : null}

      <aside className="min-w-0 lg:sticky lg:top-6 lg:self-start" aria-label="Current ticket">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-lg">Current ticket</CardTitle>
            <Badge variant="secondary">{cart.length} {cart.length === 1 ? "line" : "lines"}</Badge>
          </CardHeader>
          <CardContent className="space-y-4">
            {pending && (
              <div role="alert" className="space-y-2 rounded-lg border border-destructive/40 p-3 text-sm">
                <p className="font-medium">Unconfirmed: {commandLabel(pending)}</p>
                <div className="flex flex-wrap gap-2">
                  <Button type="button" size="sm" disabled={inFlight} onClick={() => void dispatch(pending)}>{inFlight ? "Checking…" : "Retry"}</Button>
                  <Button type="button" size="sm" variant="outline" disabled={inFlight} onClick={discardPending}>Discard</Button>
                  <Button asChild size="sm" variant="ghost"><Link href="/dashboard/platform/orders">Check orders</Link></Button>
                </div>
              </div>
            )}

            <ul className="space-y-3">
              {cart.map((item, index) => {
                const lineName = `${item.name}, line ${index + 1}`;
                return (
                  <li key={item.cartId} className="min-w-0 rounded-md border border-border p-3">
                    <div className="flex min-w-0 justify-between gap-3">
                      <div className="min-w-0">
                        <div className="break-words font-medium">{item.name}</div>
                        {item.modifierNames.length > 0 && <div className="mt-1 break-words text-xs text-muted-foreground">{item.modifierNames.join(", ")}</div>}
                      </div>
                      <Button type="button" variant="ghost" size="icon" disabled={ticketLocked} aria-label={`Remove ${lineName}`} onClick={() => setCart((current) => current.filter((line) => line.cartId !== item.cartId))}>
                        <Trash2 aria-hidden />
                      </Button>
                    </div>
                    <div className="mt-2 flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="outline" size="icon" disabled={ticketLocked || item.quantity <= 1} aria-label={`Decrease quantity of ${lineName}`} onClick={() => updateQuantity(item.cartId, item.quantity - 1)}><Minus aria-hidden /></Button>
                        <span className="w-8 text-center text-sm font-semibold" aria-label={`Quantity of ${lineName}`}>{item.quantity}</span>
                        <Button type="button" variant="outline" size="icon" disabled={ticketLocked || item.quantity >= MAX_LINE_QUANTITY} aria-label={`Increase quantity of ${lineName}`} onClick={() => updateQuantity(item.cartId, item.quantity + 1)}><Plus aria-hidden /></Button>
                      </div>
                      <span className="shrink-0 font-semibold">{quote?.lines[index] ? formatMoney(quote.lines[index].lineTotal, quote.currencyCode) : "—"}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
            {!cart.length && <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{openShift ? "Select a menu item to start a ticket." : "Open a shift to start selling."}</p>}

            <div className="space-y-3 border-t border-border pt-4">
              <div className="space-y-1.5">
                <Label htmlFor="pos-customer-name">Name</Label>
                <Input id="pos-customer-name" value={customerName} maxLength={200} disabled={ticketLocked} onChange={(event) => setCustomerName(event.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pos-ticket-notes">Ticket notes</Label>
                <Textarea id="pos-ticket-notes" value={notes} maxLength={2000} disabled={ticketLocked} onChange={(event) => setNotes(event.target.value)} className="min-h-16" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pos-tip">Tip</Label>
                <Input id="pos-tip" value={tipInput} inputMode="decimal" disabled={ticketLocked} aria-invalid={tipParse.kind === "invalid"} aria-describedby="pos-tip-error" onChange={(event) => setTipInput(event.target.value)} />
                <p id="pos-tip-error" className="text-sm text-destructive">{moneyError(tipParse)}</p>
              </div>

              {quote?.total !== 0 && (
                <fieldset className="space-y-2">
                  <legend className="text-sm font-medium">Tender</legend>
                  <RadioGroup value={paymentMethod} onValueChange={(value) => setPaymentMethod(value as PosPaymentMethod)} disabled={ticketLocked} className="gap-2">
                    <div className="flex items-center gap-2"><RadioGroupItem id="pos-tender-cash" value="cash" /><Label htmlFor="pos-tender-cash">Cash</Label></div>
                    <div className="flex items-center gap-2"><RadioGroupItem id="pos-tender-card" value="manual_card" /><Label htmlFor="pos-tender-card">Record external card payment</Label></div>
                  </RadioGroup>
                </fieldset>
              )}
              {effectiveMethod === "manual_card" && (
                <div className="space-y-3 rounded-md border border-border p-3">
                  <p className="text-xs text-muted-foreground">Run the card on the separate card terminal first. This records the terminal&apos;s approval; no card is charged from here.</p>
                  <div className="space-y-1.5">
                    <Label htmlFor="pos-card-reference">Terminal approval code or reference</Label>
                    <Input id="pos-card-reference" value={cardReference} maxLength={64} autoComplete="off" disabled={ticketLocked} aria-invalid={cardReference.trim().length > 0 && !TERMINAL_REFERENCE.test(cardReference.trim())} onChange={(event) => setCardReference(event.target.value)} />
                  </div>
                  <div className="flex items-start gap-2">
                    <Checkbox
                      id="pos-card-approved"
                      checked={!!quote && approvedFingerprint === quote.quoteFingerprint}
                      disabled={ticketLocked || !quote}
                      onCheckedChange={(checked) => setApprovedFingerprint(checked === true && quote ? quote.quoteFingerprint : null)}
                    />
                    <Label htmlFor="pos-card-approved" className="leading-5">The card terminal approved {quote ? formatMoney(quote.total, quote.currencyCode) : "this total"} for this sale</Label>
                  </div>
                </div>
              )}

              <dl className="space-y-1 text-sm">
                <div className="flex justify-between"><dt>Subtotal</dt><dd>{quote ? formatMoney(quote.subtotal, quote.currencyCode) : "—"}</dd></div>
                <div className="flex justify-between"><dt>Tax</dt><dd>{quote ? formatMoney(quote.tax, quote.currencyCode) : "—"}</dd></div>
                <div className="flex justify-between"><dt>Tip</dt><dd>{quote ? formatMoney(quote.tip, quote.currencyCode) : "—"}</dd></div>
                <div className="flex justify-between text-lg font-bold"><dt>Total</dt><dd>{quote ? formatMoney(quote.total, quote.currencyCode) : "—"}</dd></div>
              </dl>
              <div aria-live="polite" className="text-sm text-muted-foreground">
                {quoteState.status === "pricing" && "Pricing ticket…"}
                {quoteState.status === "error" && (
                  <span className="text-destructive">
                    This ticket could not be priced. <button type="button" className="underline" onClick={() => setQuoteAttempt((value) => value + 1)}>Try again</button>
                  </span>
                )}
              </div>
              <Button type="button" className="w-full" disabled={!canSubmitSale} onClick={submitSale}>
                {inFlight && pending?.kind === "sale" ? "Recording…" : saleLabel}
              </Button>
              <div aria-live="assertive" role={notice?.tone === "error" ? "alert" : "status"}>
                {notice && <p className={`rounded-md border p-3 text-sm ${notice.tone === "error" ? "border-destructive/40 text-destructive" : "border-border text-foreground"}`}>{notice.text}</p>}
              </div>
              {receipts.length > 0 && (
                <div className="space-y-1">
                  <p className="text-sm font-semibold">Recent receipts</p>
                  <ul className="space-y-1 text-sm">
                    {receipts.map((receipt, index) => (
                      <li key={index} className="break-words text-muted-foreground">
                        {receipt.kind === "sale"
                          ? <><Link className="underline" href={`/dashboard/platform/orders?search=${encodeURIComponent(receipt.orderNumber)}`}>#{receipt.orderNumber}</Link> · {receiptText(receipt).replace(/^Order #\S+ recorded\. /, "")}</>
                          : receiptText(receipt)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {openShift && (
              <div className="space-y-3 border-t border-border pt-4">
                <p className="text-sm font-semibold">Cash drawer</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="min-w-0 space-y-1.5">
                    <Label htmlFor="pos-movement-amount">Amount</Label>
                    <Input id="pos-movement-amount" value={movementAmount} inputMode="decimal" placeholder="0.00" disabled={writesBlocked} aria-invalid={movementParse.kind === "invalid"} aria-describedby="pos-movement-error" onChange={(event) => setMovementAmount(event.target.value)} />
                  </div>
                  <div className="min-w-0 space-y-1.5">
                    <Label htmlFor="pos-movement-reason">Reason</Label>
                    <Input id="pos-movement-reason" value={movementReason} maxLength={500} disabled={writesBlocked} onChange={(event) => setMovementReason(event.target.value)} />
                  </div>
                </div>
                <p id="pos-movement-error" className="text-sm text-destructive">{moneyError(movementParse) || (payoutTooLarge ? `Pay outs and cash drops cannot exceed the ${formatMoney(openShift.expectedCashCents)} expected in the drawer.` : null)}</p>
                <div className="grid grid-cols-3 gap-2">
                  {(["pay_in", "pay_out", "cash_drop"] as const).map((type) => (
                    <Button
                      key={type}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={writesBlocked || movementParse.kind !== "valid" || !movementReason.trim() || (type !== "pay_in" && payoutTooLarge)}
                      onClick={() => submitMovement(type)}
                    >
                      {type === "pay_in" ? "Pay in" : type === "pay_out" ? "Pay out" : "Cash drop"}
                    </Button>
                  ))}
                </div>
                <form
                  className="grid gap-2 pt-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end"
                  onSubmit={(event) => {
                    event.preventDefault();
                    if (countedParse.kind !== "valid") return;
                    void dispatch({ kind: "close", key: newKey(), request: { registerShiftId: openShift.id, countedCashCents: countedParse.cents } });
                  }}
                >
                  <div className="min-w-0 space-y-1.5">
                    <Label htmlFor="pos-counted-cash">Counted closing cash</Label>
                    <Input id="pos-counted-cash" value={countedCash} inputMode="decimal" placeholder="0.00" disabled={writesBlocked} aria-invalid={countedParse.kind === "invalid"} aria-describedby="pos-counted-error" onChange={(event) => setCountedCash(event.target.value)} />
                  </div>
                  <Button type="submit" variant="destructive" disabled={writesBlocked || countedParse.kind !== "valid"}>Close shift</Button>
                  <p id="pos-counted-error" className="text-sm text-destructive sm:col-span-2">{moneyError(countedParse)}</p>
                </form>
              </div>
            )}
          </CardContent>
        </Card>
      </aside>
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
