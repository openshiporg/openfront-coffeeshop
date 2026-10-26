"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, ChevronDown, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { PillLink, PillTrack, Segmented } from "@/features/platform/components/PillTabs";
import { PlatformEmpty, PlatformHeader, platformTh } from "@/features/platform/components/PlatformPage";
import { StatusDot, StatusTitle } from "@/features/platform/components/StatusTitle";
import {
  createMenuCategoryAction,
  createMenuItemAction,
  createMenuModifierAction,
  searchMenuInventoryAction,
  updateMenuItemAction,
  updateMenuModifierAction,
  updateModifierStockAction,
  type MenuModifierRuleInput,
  type UpdateMenuItemInput,
} from "../actions/menu-management";
import { useMenuCommands, type MenuCommands } from "../lib/useMenuCommands";
import { parseMoneyInput } from "../../pos/lib/money";
import {
  BAR_STATIONS,
  MODIFIER_GROUPS,
  type MenuActionResult,
  type MenuInventoryAction,
  type MenuInventoryOption,
  type MenuInventoryReview,
  type MenuManagerCategory,
  type MenuManagerData,
  type MenuManagerFilters,
  type MenuManagerItem,
  type MenuModifier,
} from "../types";

const MENU_PATH = "/dashboard/platform/menu";
const selectClass = "h-9 w-full min-w-0 rounded-[6px] border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50";
const checkboxClass = "size-4 rounded-[4px] border-input accent-primary";

type Feedback = { tone: "error" | "status"; message: string } | null;
type Notify = (feedback: Feedback) => void;

function money(cents: number) {
  const sign = cents < 0 ? "-" : "";
  return `${sign}$${(Math.abs(cents) / 100).toFixed(2)}`;
}

/** Dollars text → integer cents, or null when it is not a valid amount. */
function parseCents(value: string, { allowNegative = false } = {}) {
  // Shared strict money parser; blank, malformed or (unless allowed) negative text is never 0.
  const trimmed = value.trim();
  const negative = allowNegative && trimmed.startsWith("-");
  const parsed = parseMoneyInput(negative ? trimmed.slice(1) : trimmed);
  if (parsed.kind !== "valid") return null;
  return negative && parsed.cents ? -parsed.cents : parsed.cents;
}

function stationLabel(value?: string | null) {
  return BAR_STATIONS.find((station) => station.value === value)?.label || "No station";
}

function menuHref(filters: { search?: string; categoryId?: string; cursor?: string | null }) {
  const params = new URLSearchParams();
  if (filters.search) params.set("q", filters.search);
  if (filters.categoryId) params.set("category", filters.categoryId);
  if (filters.cursor) params.set("cursor", filters.cursor);
  const query = params.toString();
  return `${MENU_PATH}${query ? `?${query}` : ""}`;
}

/** Clean drafts follow the latest saved data; dirty drafts are kept across refreshes
 * and flag a conflict when the saved revision moved underneath them.
 */
function useDraft<T>(source: T, revision: string) {
  const [state, setState] = React.useState<{ value: T; base: string } | null>(null);
  return {
    value: state ? state.value : source,
    dirty: state !== null,
    conflict: state !== null && state.base !== revision,
    base: state ? state.base : revision,
    set(updater: (value: T) => T) {
      setState((current) => ({ value: updater(current ? current.value : source), base: current ? current.base : revision }));
    },
    discard() {
      setState(null);
    },
    keepMine() {
      setState((current) => (current ? { ...current, base: revision } : current));
    },
    /** Clear only if nothing was typed after this submission. */
    settle(submitted: T) {
      setState((current) => (current && current.value === submitted ? null : current));
    },
  };
}

export function MenuManager({ data, filters }: { data: MenuManagerData; filters: MenuManagerFilters }) {
  const router = useRouter();
  const commands = useMenuCommands();
  const [feedback, setFeedback] = React.useState<Feedback>(null);
  const [createItemOpen, setCreateItemOpen] = React.useState(false);
  const [createCategoryOpen, setCreateCategoryOpen] = React.useState(false);
  const canManage = data.canManageProducts;

  const notify = React.useCallback<Notify>((next) => {
    setFeedback(next);
    router.refresh();
  }, [router]);

  const filtered = Boolean(filters.search || filters.categoryId);
  const categoryHref = (categoryId: string) => menuHref({ search: filters.search, categoryId });

  return (
    <div className="space-y-5 px-4 pb-24 md:px-6">
      <PlatformHeader
        title="Menu"
        meta={(
          <>
            <span className="tabular-nums">{data.stats.items} items</span>
            {data.stats.hidden > 0 ? <span className="inline-flex items-center gap-1.5 tabular-nums"><StatusDot tone="zinc" />{data.stats.hidden} unavailable</span> : null}
            {data.stats.modifiersOut > 0 ? <span className="inline-flex items-center gap-1.5 tabular-nums"><StatusDot tone="amber" />{data.stats.modifiersOut} options out</span> : null}
            {!canManage ? <span>View only</span> : null}
          </>
        )}
        actions={canManage ? (
          <>
            <Button variant="outline" className="rounded-[6px] active:scale-[0.97]" onClick={() => setCreateCategoryOpen(true)}>New category</Button>
            <Button className="rounded-[6px] active:scale-[0.97]" onClick={() => setCreateItemOpen(true)}><Plus aria-hidden="true" />New item</Button>
          </>
        ) : null}
      />

      <div aria-live="polite" role="status" className="sr-only">{feedback?.tone === "status" ? feedback.message : ""}</div>
      {feedback?.tone === "error" && (
        <div role="alert" className="flex flex-col gap-2 rounded-[6px] border border-destructive/40 bg-destructive/5 p-3 text-sm text-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>{feedback.message}</span>
          <Button variant="ghost" size="sm" className="rounded-[6px]" onClick={() => setFeedback(null)}>Dismiss</Button>
        </div>
      )}

      <div className="space-y-3">
        <form key={`${filters.search}|${filters.categoryId}`} method="get" action={MENU_PATH} role="search" className="flex max-w-md items-center gap-2">
          {filters.categoryId ? <input type="hidden" name="category" value={filters.categoryId} /> : null}
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Label htmlFor="menu-search" className="sr-only">Search menu</Label>
            <Input id="menu-search" name="q" type="search" enterKeyHint="search" defaultValue={filters.search} placeholder="Item, description or option" maxLength={200} className="h-9 rounded-[6px] pl-8" />
          </div>
          {filtered && <Link href={MENU_PATH} className="px-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Clear</Link>}
        </form>
        <nav aria-label="Category">
          <PillTrack label="Category">
            <PillLink href={categoryHref("")} active={!filters.categoryId}>All</PillLink>
            {data.categories.map((category) => (
              <PillLink key={category.id} href={categoryHref(category.id)} active={filters.categoryId === category.id}>{category.name}</PillLink>
            ))}
            <PillLink href={categoryHref("uncategorized")} active={filters.categoryId === "uncategorized"}>Uncategorized</PillLink>
          </PillTrack>
        </nav>
        {data.categoriesHasMore && <p className="text-xs text-muted-foreground">First 200 categories shown.</p>}
      </div>

      <div className="space-y-2">
        <p className="text-sm tabular-nums text-muted-foreground">
          {data.matchingCount} {filtered ? "matching " : ""}item{data.matchingCount === 1 ? "" : "s"}{filters.cursor ? " · later page" : ""}
        </p>
        {data.items.length ? (
          <div className="relative min-w-0 overflow-x-auto rounded-[6px] border bg-background max-md:border-0 max-md:bg-transparent">
            <table className="w-full border-collapse text-sm max-md:block" aria-label="Menu items">
              <thead className="max-md:hidden">
                <tr>
                  <th scope="col" className={platformTh}>Item</th>
                  <th scope="col" className={`${platformTh} text-right`}>Price</th>
                  <th scope="col" className={platformTh}>Available</th>
                  <th scope="col" className={platformTh}>Options</th>
                  <th scope="col" className={platformTh}><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              {data.items.map((item) => (
                <MenuItemCard key={item.id} item={item} categories={data.categories} canManage={canManage} commands={commands} notify={notify} />
              ))}
            </table>
          </div>
        ) : (
          <PlatformEmpty>{filtered ? "No menu items match." : "No menu items yet."}</PlatformEmpty>
        )}
      </div>

      {(filters.cursor || data.hasMore) && (
        <nav aria-label="Menu pages" className="flex flex-wrap gap-2">
          {filters.cursor && <Button asChild variant="ghost" size="sm" className="rounded-[6px]"><Link href={menuHref({ search: filters.search, categoryId: filters.categoryId })}>First page</Link></Button>}
          {data.hasMore && data.nextCursor && <Button asChild variant="outline" size="sm" className="rounded-[6px]"><Link href={menuHref({ search: filters.search, categoryId: filters.categoryId, cursor: data.nextCursor })}>Next page</Link></Button>}
        </nav>
      )}

      {canManage && (
        <>
          <CreateItemDialog open={createItemOpen} onOpenChange={setCreateItemOpen} categories={data.categories} commands={commands} notify={notify} />
          <CreateCategoryDialog open={createCategoryOpen} onOpenChange={setCreateCategoryOpen} commands={commands} notify={notify} />
        </>
      )}
    </div>
  );
}

/** Always reloads the latest saved menu. Forms that show their own error pass `local`
 * so the failure is announced once, next to the fields.
 */
function reportResult(notify: Notify, result: MenuActionResult, success: string, local = false) {
  notify(result.success ? { tone: "status", message: success } : local ? null : { tone: "error", message: result.error });
}

function ConflictNotice({ subject, onKeep, onDiscard }: { subject: string; onKeep: () => void; onDiscard: () => void }) {
  return (
    <div role="alert" className="flex flex-col gap-2 rounded-[6px] border border-amber-500/40 bg-amber-500/5 p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <span>{subject} changed while you were editing.</span>
      <span className="flex gap-2">
        <Button type="button" size="sm" variant="outline" className="rounded-[6px]" onClick={onDiscard}>Use saved</Button>
        <Button type="button" size="sm" variant="ghost" className="rounded-[6px]" onClick={onKeep}>Keep mine</Button>
      </span>
    </div>
  );
}

type ItemChanges = Omit<UpdateMenuItemInput, "menuItemId" | "expectedUpdatedAt" | "idempotencyKey">;

function MenuItemCard({ item, categories, canManage, commands, notify }: { item: MenuManagerItem; categories: MenuManagerCategory[]; canManage: boolean; commands: MenuCommands; notify: Notify }) {
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const busy = commands.isBusy(item.id);

  async function update(operation: string, changes: ItemChanges, expectedUpdatedAt: string, success: string, local = false) {
    const request = { menuItemId: item.id, expectedUpdatedAt, ...changes };
    const result = await commands.run(item.id, `item:${item.id}:${operation}`, request, (idempotencyKey) => updateMenuItemAction({ ...request, idempotencyKey }));
    reportResult(notify, result, success, local);
    return result;
  }

  const [optionsOpen, setOptionsOpen] = React.useState(false);
  const outCount = item.modifiers.filter((modifier) => !modifier.inStock || modifier.stockOut).length;
  const optionsId = `menu-item-${item.id}-options`;

  const tone = !item.available ? "zinc" : item.soldOut ? "red" : "green";
  const td = "border-b px-3 py-2 align-middle max-md:border-0 max-md:p-0";
  return (
    <tbody className="max-md:mb-2 max-md:block max-md:rounded-[6px] max-md:border max-md:bg-background">
      <tr className={`max-md:grid max-md:grid-cols-[minmax(0,1fr)_auto] max-md:items-center max-md:gap-x-3 max-md:gap-y-2 max-md:p-3 ${!item.available ? "bg-muted/30" : ""}`}>
        <td className={`${td} min-w-[14rem] max-md:col-span-2 max-md:min-w-0`}>
          <span className="flex min-w-0 items-start gap-2">
            <span className="inline-flex h-[1lh] shrink-0 items-center"><StatusDot tone={tone} /></span>
            <span className="min-w-0">
              <span className={`block font-medium [overflow-wrap:anywhere] ${!item.available ? "text-muted-foreground" : ""}`}>
                {item.name}
                {!item.available ? <span className="ml-2 text-xs font-medium text-muted-foreground">Unavailable</span> : item.soldOut ? <span className="ml-2 text-xs font-medium text-red-600 dark:text-red-400">Out of stock</span> : <span className="ml-2 text-xs font-medium text-muted-foreground">Selling</span>}
              </span>
              <span className="block text-xs text-muted-foreground">
                {item.category?.name || "Uncategorized"} · {stationLabel(item.barStation)} · <span className="tabular-nums">{item.prepTimeMinutes ?? 0} min</span>
                {item.featured ? " · Featured" : ""}{item.popular ? " · Popular" : ""}
              </span>
            </span>
          </span>
        </td>
        <td className={`${td} text-right max-md:text-left`}>
          {canManage
            ? <PriceEditor item={item} busy={busy} onSave={(price, base) => update("price", { price }, base, `${item.name} price saved`)} />
            : <p className="font-semibold tabular-nums">{money(item.price)}</p>}
        </td>
        <td className={`${td} max-md:justify-self-end`}>
          {canManage ? (
            <label className="flex min-h-9 shrink-0 items-center gap-2 text-sm font-medium">
              <Switch checked={item.available} disabled={busy} onCheckedChange={() => update("available", { available: !item.available }, item.updatedAt, `${item.name} is now ${item.available ? "unavailable" : "available"}`)} />
              <span className="sr-only">Available</span>
              <span aria-hidden="true" className="w-7 text-muted-foreground">{item.available ? "On" : "Off"}</span>
            </label>
          ) : <span className="text-muted-foreground">{item.available ? "On" : "Off"}</span>}
        </td>
        <td className={`${td} whitespace-nowrap`}>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="-ml-2 h-9 rounded-[6px] max-md:ml-0 max-md:px-2"
            aria-expanded={optionsOpen}
            aria-controls={optionsId}
            onClick={() => setOptionsOpen((open) => !open)}
          >
            <ChevronDown aria-hidden="true" className={`transition-transform duration-150 ${optionsOpen ? "rotate-180" : ""}`} />
            <span className="tabular-nums">{item.modifiers.length}</span>
            <span className="sr-only">options</span>
            {outCount > 0 ? <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400"><StatusDot tone="amber" />{outCount} out</span> : null}
          </Button>
        </td>
        <td className={`${td} whitespace-nowrap text-right max-md:justify-self-end`}>
          {canManage ? (
            <span className="inline-flex items-center gap-1">
              <Button type="button" size="sm" variant="ghost" className="h-9 rounded-[6px]" disabled={busy} onClick={() => setDetailsOpen(true)}>Edit</Button>
              <Button asChild size="icon" variant="ghost" className="size-9 rounded-[6px] text-muted-foreground"><Link href={`/dashboard/menu-items/${item.id}`} aria-label={`Full record for ${item.name}`} title="Full record"><ArrowUpRight aria-hidden="true" /></Link></Button>
              {/* Portaled dialog; mounted here so its draft survives the options row opening and closing. */}
              <ItemDetailsDialog open={detailsOpen} onOpenChange={setDetailsOpen} item={item} categories={categories} busy={busy} onSave={update} />
            </span>
          ) : null}
        </td>
      </tr>
      {optionsOpen && (
        <tr className="max-md:block">
          <td colSpan={5} className="border-b bg-muted/30 p-0 max-md:block max-md:rounded-b-[6px] max-md:border-0 max-md:border-t">
            <section id={optionsId} aria-label={`${item.name} options`} className="space-y-2 p-3 sm:px-4">
              {canManage && (
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1 pb-1">
                  {/* Independent on/off flags, so each gets its own switch rather than a segmented choice. */}
                  <label className="flex min-h-9 items-center gap-2 text-sm font-medium">
                    <Switch checked={item.featured} disabled={busy} onCheckedChange={() => update("featured", { featured: !item.featured }, item.updatedAt, `${item.name} featured setting saved`)} />
                    Featured
                  </label>
                  <label className="flex min-h-9 items-center gap-2 text-sm font-medium">
                    <Switch checked={item.popular} disabled={busy} onCheckedChange={() => update("popular", { popular: !item.popular }, item.updatedAt, `${item.name} popular setting saved`)} />
                    Popular
                  </label>
                </div>
              )}
              {item.modifiers.length === 0 && <p className="px-1 text-sm text-muted-foreground">No options.</p>}
              {item.modifiers.map((modifier) => canManage
                ? <ModifierEditor key={modifier.id} modifier={modifier} commands={commands} notify={notify} />
                : <ModifierSummary key={modifier.id} modifier={modifier} />)}
              {item.modifiersHasMore && <p className="px-1 text-xs text-muted-foreground">First 100 options shown.</p>}
              {canManage && <NewModifierForm item={item} commands={commands} notify={notify} />}
            </section>
          </td>
        </tr>
      )}
    </tbody>
  );
}

function PriceEditor({ item, busy, onSave }: { item: MenuManagerItem; busy: boolean; onSave: (price: number, expectedUpdatedAt: string) => Promise<MenuActionResult> }) {
  const draft = useDraft((item.price / 100).toFixed(2), item.updatedAt);
  const cents = parseCents(draft.value);
  const id = `menu-item-price-${item.id}`;
  async function save() {
    if (cents == null) return;
    const submitted = draft.value;
    const result = await onSave(cents, draft.base);
    if (result.success) draft.settle(submitted);
  }
  return (
    <div className="grid gap-1 sm:justify-items-end">
      <Label htmlFor={id} className="sr-only">Price</Label>
      <div className="flex items-center gap-1.5">
        <div className="relative">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground" aria-hidden="true">$</span>
          <Input id={id} inputMode="decimal" className="h-9 w-24 rounded-[6px] pl-5 text-right font-medium tabular-nums" value={draft.value} aria-invalid={cents == null} onChange={(event) => { const next = event.target.value; draft.set(() => next); }} />
        </div>
        {draft.dirty && <Button type="button" size="sm" className="h-9 rounded-[6px] active:scale-[0.97]" disabled={cents == null || busy} onClick={save}>{busy ? "Saving…" : "Save"}</Button>}
      </div>
      {cents == null && <p className="text-xs text-destructive">Enter a price like 4.50</p>}
      {draft.conflict && <ConflictNotice subject="This price" onKeep={draft.keepMine} onDiscard={draft.discard} />}
    </div>
  );
}

type ItemDetails = { name: string; shortDescription: string; categoryId: string; barStation: string; prepTimeMinutes: string };

function itemDetails(item: MenuManagerItem): ItemDetails {
  return { name: item.name, shortDescription: item.shortDescription || "", categoryId: item.category?.id || "", barStation: item.barStation || "espresso_bar", prepTimeMinutes: String(item.prepTimeMinutes ?? 5) };
}

function ItemDetailsDialog({ open, onOpenChange, item, categories, busy, onSave }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: MenuManagerItem;
  categories: MenuManagerCategory[];
  busy: boolean;
  onSave: (operation: string, changes: ItemChanges, expectedUpdatedAt: string, success: string, local?: boolean) => Promise<MenuActionResult>;
}) {
  const saved = itemDetails(item);
  const draft = useDraft(saved, item.updatedAt);
  const [error, setError] = React.useState<string | null>(null);
  const value = draft.value;
  const prep = Number(value.prepTimeMinutes);
  const prepValid = /^\d+$/.test(value.prepTimeMinutes.trim()) && prep <= 240;
  const nameValid = value.name.trim().length > 0;
  const prefix = `menu-item-${item.id}`;

  const changes: ItemChanges = {};
  if (value.name.trim() !== saved.name) changes.name = value.name.trim();
  if (value.shortDescription.trim() !== saved.shortDescription) changes.shortDescription = value.shortDescription.trim();
  if (value.categoryId !== saved.categoryId) {
    if (value.categoryId) changes.categoryId = value.categoryId;
    else changes.clearCategory = true;
  }
  if (value.barStation !== saved.barStation) changes.barStation = value.barStation;
  if (prepValid && prep !== Number(saved.prepTimeMinutes)) changes.prepTimeMinutes = prep;
  const hasChanges = Object.keys(changes).length > 0;

  function set<K extends keyof ItemDetails>(key: K, next: ItemDetails[K]) {
    draft.set((current) => ({ ...current, [key]: next }));
  }

  async function save(event: React.FormEvent) {
    event.preventDefault();
    if (!nameValid || !prepValid || !hasChanges) return;
    setError(null);
    const submitted = draft.value;
    const result = await onSave("details", changes, draft.base, `${changes.name || item.name} details saved`, true);
    if (result.success) {
      draft.settle(submitted);
      onOpenChange(false);
    } else setError(result.error);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[6px] max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={save} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Edit {item.name}</DialogTitle>
            <DialogDescription className="sr-only">Item details</DialogDescription>
          </DialogHeader>
          {draft.conflict && <ConflictNotice subject="This item" onKeep={draft.keepMine} onDiscard={draft.discard} />}
          <div className="grid gap-1.5">
            <Label htmlFor={`${prefix}-name`}>Name</Label>
            <Input className="rounded-[6px]" id={`${prefix}-name`} value={value.name} maxLength={200} aria-invalid={!nameValid} onChange={(event) => set("name", event.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${prefix}-description`}>Short description</Label>
            <Textarea className="rounded-[6px]" id={`${prefix}-description`} value={value.shortDescription} maxLength={1000} onChange={(event) => set("shortDescription", event.target.value)} />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor={`${prefix}-category`}>Category</Label>
              <select id={`${prefix}-category`} className={selectClass} value={value.categoryId} onChange={(event) => set("categoryId", event.target.value)}>
                <option value="">Uncategorized</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
                {value.categoryId && !categories.some((category) => category.id === value.categoryId) && <option value={value.categoryId}>{item.category?.name || "Current category"}</option>}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${prefix}-station`}>Station</Label>
              <select id={`${prefix}-station`} className={selectClass} value={value.barStation} onChange={(event) => set("barStation", event.target.value)}>
                {BAR_STATIONS.map((station) => <option key={station.value} value={station.value}>{station.label}</option>)}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor={`${prefix}-prep`}>Prep time (minutes)</Label>
              <Input className="rounded-[6px]" id={`${prefix}-prep`} inputMode="numeric" value={value.prepTimeMinutes} aria-invalid={!prepValid} aria-describedby={!prepValid ? `${prefix}-prep-error` : undefined} onChange={(event) => set("prepTimeMinutes", event.target.value)} />
              {!prepValid && <p id={`${prefix}-prep-error`} className="text-xs text-destructive">Enter whole minutes from 0 to 240.</p>}
            </div>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            {draft.dirty && <Button type="button" variant="ghost" className="rounded-[6px]" onClick={draft.discard}>Discard changes</Button>}
            <Button type="submit" className="rounded-[6px]" disabled={busy || !nameValid || !prepValid || !hasChanges}>{busy ? "Saving…" : "Save"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

type NewItemDraft = { name: string; price: string; categoryId: string; barStation: string; prepTimeMinutes: string; shortDescription: string };

function CreateItemDialog({ open, onOpenChange, categories, commands, notify }: { open: boolean; onOpenChange: (open: boolean) => void; categories: MenuManagerCategory[]; commands: MenuCommands; notify: Notify }) {
  const empty: NewItemDraft = { name: "", price: "", categoryId: "", barStation: "espresso_bar", prepTimeMinutes: "5", shortDescription: "" };
  const [draft, setDraft] = React.useState<NewItemDraft>(empty);
  const [error, setError] = React.useState<string | null>(null);
  const busy = commands.isBusy("new-item");
  const price = parseCents(draft.price);
  const prep = Number(draft.prepTimeMinutes);
  const prepValid = /^\d+$/.test(draft.prepTimeMinutes.trim()) && prep <= 240;
  const valid = draft.name.trim().length > 0 && price != null && prepValid;

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!valid || price == null) return;
    setError(null);
    const submitted = draft;
    const request = { name: draft.name.trim(), price, categoryId: draft.categoryId || null, barStation: draft.barStation, shortDescription: draft.shortDescription.trim(), prepTimeMinutes: prep };
    const result = await commands.run("new-item", "create-item", request, (idempotencyKey) => createMenuItemAction({ ...request, idempotencyKey }));
    if (result.success) {
      setDraft((current) => (current === submitted ? empty : current));
      onOpenChange(false);
      notify({ tone: "status", message: `${request.name} added to the menu` });
    } else {
      setError(result.error);
      notify(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[6px] max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={create} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>New item</DialogTitle>
            <DialogDescription className="sr-only">New menu item</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="new-item-name">Name</Label>
            <Input className="rounded-[6px]" id="new-item-name" value={draft.name} maxLength={200} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Seasonal latte" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="new-item-price">Price</Label>
              <Input className="rounded-[6px]" id="new-item-price" inputMode="decimal" value={draft.price} aria-invalid={draft.price !== "" && price == null} onChange={(event) => setDraft({ ...draft, price: event.target.value })} placeholder="5.75" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-item-prep">Prep time (minutes)</Label>
              <Input className="rounded-[6px]" id="new-item-prep" inputMode="numeric" value={draft.prepTimeMinutes} aria-invalid={!prepValid} onChange={(event) => setDraft({ ...draft, prepTimeMinutes: event.target.value })} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-item-category">Category</Label>
              <select id="new-item-category" className={selectClass} value={draft.categoryId} onChange={(event) => setDraft({ ...draft, categoryId: event.target.value })}>
                <option value="">Uncategorized</option>
                {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
              </select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-item-station">Station</Label>
              <select id="new-item-station" className={selectClass} value={draft.barStation} onChange={(event) => setDraft({ ...draft, barStation: event.target.value })}>
                {BAR_STATIONS.map((station) => <option key={station.value} value={station.value}>{station.label}</option>)}
              </select>
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="new-item-description">Short description (optional)</Label>
            <Textarea className="rounded-[6px]" id="new-item-description" value={draft.shortDescription} maxLength={1000} onChange={(event) => setDraft({ ...draft, shortDescription: event.target.value })} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" className="rounded-[6px]" disabled={busy || !valid}>{busy ? "Adding…" : "Add item"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CreateCategoryDialog({ open, onOpenChange, commands, notify }: { open: boolean; onOpenChange: (open: boolean) => void; commands: MenuCommands; notify: Notify }) {
  const empty = { name: "", description: "", sortOrder: "0" };
  const [draft, setDraft] = React.useState(empty);
  const [error, setError] = React.useState<string | null>(null);
  const busy = commands.isBusy("new-category");
  const sortValid = /^-?\d+$/.test(draft.sortOrder.trim());
  const valid = draft.name.trim().length > 0 && sortValid;

  async function create(event: React.FormEvent) {
    event.preventDefault();
    if (!valid) return;
    setError(null);
    const submitted = draft;
    const request = { name: draft.name.trim(), description: draft.description.trim(), sortOrder: Number(draft.sortOrder) };
    const result = await commands.run("new-category", "create-category", request, (idempotencyKey) => createMenuCategoryAction({ ...request, idempotencyKey }));
    if (result.success) {
      setDraft((current) => (current === submitted ? empty : current));
      onOpenChange(false);
      notify({ tone: "status", message: `${request.name} category added` });
    } else {
      setError(result.error);
      notify(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-[6px] sm:max-w-md">
        <form onSubmit={create} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>New category</DialogTitle>
            <DialogDescription className="sr-only">New menu category</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="new-category-name">Name</Label>
            <Input className="rounded-[6px]" id="new-category-name" value={draft.name} maxLength={120} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Seasonal drinks" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="new-category-description">Description (optional)</Label>
            <Textarea className="rounded-[6px]" id="new-category-description" value={draft.description} maxLength={1000} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="new-category-sort">Sort order</Label>
            <Input className="rounded-[6px]" id="new-category-sort" inputMode="numeric" value={draft.sortOrder} aria-invalid={!sortValid} onChange={(event) => setDraft({ ...draft, sortOrder: event.target.value })} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" className="rounded-[6px]" disabled={busy || !valid}>{busy ? "Adding…" : "Add category"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function inventorySummary(modifier: MenuModifier) {
  const target = modifier.inventoryItem?.name || "an inventory item";
  const unit = modifier.inventoryItem?.unit ? ` ${modifier.inventoryItem.unit}` : "";
  switch (modifier.inventoryAction) {
    case "none": return "No stock used";
    case "add": return `Uses ${Number(modifier.inventoryQuantity || 0)}${unit} of ${target}`;
    case "substitute": return `Replaces ${modifier.replacesInventoryItem?.name || "the base ingredient"} with ${target}`;
    case "unreviewed": return "Inventory not reviewed. Can't be offered until reviewed.";
    default: return null;
  }
}

function ModifierSummary({ modifier }: { modifier: MenuModifier }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-2 rounded-[6px] border bg-background px-3 py-2.5 text-sm">
      <div className="min-w-0">
        <StatusTitle as="p" tone={modifier.inStock && !modifier.stockOut ? "green" : "red"} status={!modifier.inStock ? "Out of stock" : modifier.stockOut ? "No inventory" : null} className="font-medium">
          {modifier.name}
        </StatusTitle>
        <p className="pl-4 text-xs text-muted-foreground">
          {modifier.modifierGroupLabel || modifier.modifierGroup} · {modifier.required ? "Required" : "Optional"} · {modifier.minSelections}–{modifier.maxSelections}{modifier.defaultSelected ? " · Default" : ""}
        </p>
      </div>
      <span className="tabular-nums">{money(modifier.priceAdjustment)}</span>
    </div>
  );
}

type RuleDraft = { name: string; modifierGroup: string; modifierGroupLabel: string; price: string; required: boolean; minSelections: string; maxSelections: string; defaultSelected: boolean };

function ruleDraft(modifier: MenuModifier): RuleDraft {
  return {
    name: modifier.name,
    modifierGroup: modifier.modifierGroup,
    modifierGroupLabel: modifier.modifierGroupLabel || "",
    price: (modifier.priceAdjustment / 100).toFixed(2),
    required: modifier.required,
    minSelections: String(modifier.minSelections),
    maxSelections: String(modifier.maxSelections),
    defaultSelected: modifier.defaultSelected,
  };
}

function parseRule(draft: RuleDraft): MenuModifierRuleInput | null {
  const priceAdjustment = parseCents(draft.price, { allowNegative: true });
  const minSelections = Number(draft.minSelections);
  const maxSelections = Number(draft.maxSelections);
  if (!draft.name.trim() || priceAdjustment == null || !/^\d+$/.test(draft.minSelections) || !/^\d+$/.test(draft.maxSelections)) return null;
  if (maxSelections < 1 || maxSelections > 20 || minSelections > maxSelections || (draft.required && minSelections < 1)) return null;
  return { name: draft.name.trim(), modifierGroup: draft.modifierGroup, modifierGroupLabel: draft.modifierGroupLabel.trim(), priceAdjustment, required: draft.required, minSelections, maxSelections, defaultSelected: draft.defaultSelected };
}

function storedReview(modifier: MenuModifier): MenuInventoryReview {
  const action = (["none", "add", "substitute"] as const).find((candidate) => candidate === modifier.inventoryAction) || "none";
  return { action, inventoryItemId: modifier.inventoryItem?.id || null, replacesInventoryItemId: modifier.replacesInventoryItem?.id || null, quantity: Number(modifier.inventoryQuantity || 0) };
}

function reviewComplete(review: MenuInventoryReview) {
  if (review.action === "none") return true;
  if (!review.inventoryItemId) return false;
  if (review.action === "add") return review.quantity > 0;
  return Boolean(review.replacesInventoryItemId) && review.replacesInventoryItemId !== review.inventoryItemId;
}

function ModifierEditor({ modifier, commands, notify }: { modifier: MenuModifier; commands: MenuCommands; notify: Notify }) {
  const draft = useDraft(ruleDraft(modifier), modifier.updatedAt);
  const [review, setReview] = React.useState<MenuInventoryReview | null>(null);
  const [reviewBase, setReviewBase] = React.useState(modifier.updatedAt);
  const [error, setError] = React.useState<string | null>(null);
  const busy = commands.isBusy(modifier.id);
  const rule = parseRule(draft.value);
  const prefix = `modifier-${modifier.id}`;
  const unreviewed = modifier.inventoryAction === "unreviewed";
  const dirty = draft.dirty || review !== null;
  const reviewConflict = review !== null && reviewBase !== modifier.updatedAt;
  const canSave = Boolean(rule) && dirty && (review === null || reviewComplete(review)) && !busy;
  const [editing, setEditing] = React.useState(false);
  const expanded = editing || dirty || draft.conflict || reviewConflict || unreviewed;

  function set<K extends keyof RuleDraft>(key: K, next: RuleDraft[K]) {
    draft.set((current) => ({ ...current, [key]: next }));
  }

  function startReview() {
    setReview(storedReview(modifier));
    setReviewBase(modifier.updatedAt);
  }

  async function save() {
    if (!rule || !canSave) return;
    setError(null);
    const submittedRule = draft.value;
    const submittedReview = review;
    const expectedUpdatedAt = draft.dirty ? draft.base : reviewBase;
    const request = { modifierId: modifier.id, expectedUpdatedAt, rule, inventory: review };
    const result = await commands.run(modifier.id, `modifier:${modifier.id}:rule`, request, (idempotencyKey) => updateMenuModifierAction({ ...request, idempotencyKey }));
    if (result.success) {
      draft.settle(submittedRule);
      setReview((current) => (current === submittedReview ? null : current));
    } else setError(result.error);
    reportResult(notify, result, `${rule.name} saved`, true);
  }

  async function toggleStock() {
    setError(null);
    const request = { modifierId: modifier.id, inStock: !modifier.inStock, expectedUpdatedAt: modifier.updatedAt };
    const result = await commands.run(modifier.id, `modifier:${modifier.id}:stock`, request, (idempotencyKey) => updateModifierStockAction({ ...request, idempotencyKey }));
    if (!result.success) setError(result.error);
    reportResult(notify, result, `${modifier.name} is now ${modifier.inStock ? "out of stock" : "in stock"}`, true);
  }

  return (
    <div className="grid gap-3 rounded-[6px] border bg-background p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <StatusTitle as="p" tone={modifier.inStock && !modifier.stockOut ? "green" : "red"} status={!modifier.inStock ? "Out of stock" : modifier.stockOut ? "No inventory" : null} className="text-sm font-medium">
            {modifier.name}
          </StatusTitle>
          <p className="pl-4 text-xs text-muted-foreground">
            {modifier.modifierGroupLabel || modifier.modifierGroup} · <span className="tabular-nums">{money(modifier.priceAdjustment)}</span>
            {unreviewed ? <span className="text-destructive"> · Inventory not reviewed</span> : null}
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Segmented
            label={`${modifier.name} stock`}
            size="sm"
            value={modifier.inStock ? "in" : "out"}
            options={[
              { value: "in", label: "In stock", disabled: busy || (!modifier.inStock && unreviewed) },
              { value: "out", label: "Out", disabled: busy },
            ]}
            onChange={(next) => { if ((next === "in") !== modifier.inStock) void toggleStock(); }}
          />
          {!dirty && !draft.conflict && !reviewConflict && !unreviewed && (
            <Button type="button" size="sm" variant="ghost" className="rounded-[6px]" aria-expanded={editing} onClick={() => setEditing((open) => !open)}>
              {editing ? "Close" : "Edit"}
            </Button>
          )}
        </div>
      </div>
      {expanded && (
        <>
      {(draft.conflict || reviewConflict) && (
        <ConflictNotice
          subject={`${modifier.name}`}
          onKeep={() => { draft.keepMine(); setReviewBase(modifier.updatedAt); }}
          onDiscard={() => { draft.discard(); setReview(null); }}
        />
      )}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor={`${prefix}-name`}>Option name</Label>
          <Input className="rounded-[6px]" id={`${prefix}-name`} value={draft.value.name} maxLength={200} onChange={(event) => set("name", event.target.value)} />
        </div>
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor={`${prefix}-group`}>Group</Label>
          <select id={`${prefix}-group`} className={selectClass} value={draft.value.modifierGroup} onChange={(event) => set("modifierGroup", event.target.value)}>
            {MODIFIER_GROUPS.map((group) => <option key={group.value} value={group.value}>{group.label}</option>)}
          </select>
        </div>
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor={`${prefix}-group-label`}>Group label</Label>
          <Input className="rounded-[6px]" id={`${prefix}-group-label`} value={draft.value.modifierGroupLabel} maxLength={120} placeholder="Milk choice" onChange={(event) => set("modifierGroupLabel", event.target.value)} />
        </div>
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor={`${prefix}-price`}>Price change</Label>
          <Input className="rounded-[6px]" id={`${prefix}-price`} inputMode="decimal" value={draft.value.price} aria-invalid={parseCents(draft.value.price, { allowNegative: true }) == null} onChange={(event) => set("price", event.target.value)} />
        </div>
      </div>
      <fieldset className="flex flex-wrap items-end gap-4 text-sm">
        <legend className="sr-only">Selection rules for {modifier.name}</legend>
        <label htmlFor={`${prefix}-required`} className="flex items-center gap-2">
          <input id={`${prefix}-required`} type="checkbox" className={checkboxClass} checked={draft.value.required} onChange={(event) => { const required = event.target.checked; draft.set((current) => ({ ...current, required, minSelections: required && Number(current.minSelections) < 1 ? "1" : current.minSelections })); }} />
          Required
        </label>
        <div className="grid gap-1">
          <Label htmlFor={`${prefix}-min`}>Minimum</Label>
          <Input id={`${prefix}-min`} inputMode="numeric" className="rounded-[6px] w-20" value={draft.value.minSelections} onChange={(event) => set("minSelections", event.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`${prefix}-max`}>Maximum</Label>
          <Input id={`${prefix}-max`} inputMode="numeric" className="rounded-[6px] w-20" value={draft.value.maxSelections} onChange={(event) => set("maxSelections", event.target.value)} />
        </div>
        <label htmlFor={`${prefix}-default`} className="flex items-center gap-2">
          <input id={`${prefix}-default`} type="checkbox" className={checkboxClass} checked={draft.value.defaultSelected} onChange={(event) => set("defaultSelected", event.target.checked)} />
          Selected by default
        </label>
      </fieldset>
      {!rule && <p className="text-xs text-destructive">Check name, price and limits: maximum 1–20, minimum ≤ maximum, at least 1 when required.</p>}

      <div className="grid gap-2 rounded-[6px] border border-border p-3 text-sm">
        <p className={unreviewed ? "text-destructive" : "text-muted-foreground"}>{inventorySummary(modifier)}</p>
        {review === null
          ? <div><Button type="button" size="sm" variant="outline" className="rounded-[6px]" disabled={busy} onClick={startReview}>{unreviewed ? "Review inventory" : "Change inventory"}</Button></div>
          : (
            <>
              <InventoryReviewFields idPrefix={prefix} review={review} onChange={setReview} current={modifier} />
              <div><Button type="button" size="sm" variant="ghost" className="rounded-[6px]" onClick={() => setReview(null)}>Keep current inventory</Button></div>
            </>
          )}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" className="rounded-[6px]" disabled={!canSave} onClick={save}>{busy ? "Saving…" : "Save option"}</Button>
        {dirty && <Button type="button" size="sm" variant="ghost" className="rounded-[6px]" disabled={busy} onClick={() => { draft.discard(); setReview(null); }}>Discard changes</Button>}
      </div>
        </>
      )}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    </div>
  );
}

function InventoryReviewFields({ idPrefix, review, onChange, current }: { idPrefix: string; review: MenuInventoryReview; onChange: (review: MenuInventoryReview) => void; current?: MenuModifier }) {
  const [quantity, setQuantity] = React.useState(review.quantity ? String(review.quantity) : "");
  const quantityValid = /^\d+(\.\d{1,4})?$/.test(quantity.trim()) && Number(quantity) > 0;
  return (
    <div className="grid gap-3">
      <RadioGroup
        aria-label="How this option affects inventory"
        value={review.action}
        onValueChange={(value) => onChange({ ...review, action: value as MenuInventoryAction })}
        className="grid gap-2 sm:grid-cols-3"
      >
        {([
          ["none", "Uses no stock"],
          ["add", "Adds an ingredient"],
          ["substitute", "Replaces an ingredient"],
        ] as const).map(([value, label]) => (
          <div key={value} className="flex items-center gap-2">
            <RadioGroupItem id={`${idPrefix}-inventory-${value}`} value={value} />
            <Label htmlFor={`${idPrefix}-inventory-${value}`} className="font-normal">{label}</Label>
          </div>
        ))}
      </RadioGroup>
      {review.action !== "none" && (
        <InventoryPicker
          id={`${idPrefix}-inventory-target`}
          label={review.action === "add" ? "Ingredient used" : "Replacement ingredient"}
          value={review.inventoryItemId}
          initial={current?.inventoryItem || null}
          onChange={(inventoryItemId) => onChange({ ...review, inventoryItemId })}
        />
      )}
      {review.action === "add" && (
        <div className="grid gap-1.5">
          <Label htmlFor={`${idPrefix}-inventory-quantity`}>Quantity per serving</Label>
          <Input
            id={`${idPrefix}-inventory-quantity`}
            inputMode="decimal"
            className="rounded-[6px] w-32"
            value={quantity}
            aria-invalid={quantity !== "" && !quantityValid}
            onChange={(event) => {
              const next = event.target.value;
              setQuantity(next);
              const valid = /^\d+(\.\d{1,4})?$/.test(next.trim()) && Number(next) > 0;
              onChange({ ...review, quantity: valid ? Number(next) : 0 });
            }}
          />
          <p className="text-xs text-muted-foreground">Ingredient&apos;s unit, up to 4 decimals</p>
        </div>
      )}
      {review.action === "substitute" && (
        <InventoryPicker
          id={`${idPrefix}-inventory-base`}
          label="Base ingredient it replaces (same unit)"
          value={review.replacesInventoryItemId}
          initial={current?.replacesInventoryItem || null}
          onChange={(replacesInventoryItemId) => onChange({ ...review, replacesInventoryItemId })}
        />
      )}
      {!reviewComplete(review) && <p className="text-xs text-muted-foreground">Inventory incomplete</p>}
    </div>
  );
}

function InventoryPicker({ id, label, value, initial, onChange }: { id: string; label: string; value: string | null; initial: MenuInventoryOption | null; onChange: (id: string | null) => void }) {
  const [search, setSearch] = React.useState("");
  const [options, setOptions] = React.useState<MenuInventoryOption[]>(initial ? [initial] : []);
  const [hasMore, setHasMore] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [searched, setSearched] = React.useState(false);

  async function find() {
    setLoading(true);
    setError(null);
    try {
      const result = await searchMenuInventoryAction(search);
      if (!result.success) {
        setError(result.error);
        return;
      }
      const selected = options.find((option) => option.id === value);
      setOptions(selected && !result.items.some((item) => item.id === selected.id) ? [selected, ...result.items] : result.items);
      setHasMore(result.hasMore);
      setSearched(true);
    } catch {
      setError("Inventory could not be loaded. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-1.5">
      <Label htmlFor={`${id}-search`}>{label}</Label>
      <div className="flex flex-wrap gap-2">
        <Input
          id={`${id}-search`}
          type="search"
          className="rounded-[6px] min-w-0 flex-1"
          value={search}
          placeholder="Search inventory"
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void find(); } }}
        />
        <Button type="button" size="sm" variant="outline" className="h-9 rounded-[6px]" disabled={loading} onClick={find}>{loading ? "Searching…" : "Find"}</Button>
      </div>
      <select id={id} aria-label={label} className={selectClass} value={value || ""} onChange={(event) => onChange(event.target.value || null)}>
        <option value="">{options.length ? "Choose an ingredient" : "Search to list ingredients"}</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.name}{option.unit ? ` (${option.unit})` : ""}</option>)}
      </select>
      <div aria-live="polite" className="text-xs text-muted-foreground">
        {error ? <span className="text-destructive">{error}</span> : searched && !options.length ? "No matching inventory." : hasMore ? "More match. Refine the search." : ""}
      </div>
    </div>
  );
}

function NewModifierForm({ item, commands, notify }: { item: MenuManagerItem; commands: MenuCommands; notify: Notify }) {
  const empty = { name: "", modifierGroup: "espresso", price: "0.00" };
  const [draft, setDraft] = React.useState(empty);
  const [review, setReview] = React.useState<MenuInventoryReview>({ action: "none", inventoryItemId: null, replacesInventoryItemId: null, quantity: 0 });
  const [reviewed, setReviewed] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [formVersion, setFormVersion] = React.useState(0);
  const entity = `new-modifier-${item.id}`;
  const busy = commands.isBusy(entity);
  const prefix = `new-modifier-${item.id}`;
  const priceAdjustment = parseCents(draft.price, { allowNegative: true });
  const valid = Boolean(draft.name.trim()) && priceAdjustment != null && reviewed && reviewComplete(review);

  async function create() {
    if (!valid || priceAdjustment == null) return;
    setError(null);
    const submitted = draft;
    const group = MODIFIER_GROUPS.find((candidate) => candidate.value === draft.modifierGroup);
    const rule: MenuModifierRuleInput = { name: draft.name.trim(), modifierGroup: draft.modifierGroup, modifierGroupLabel: group?.label || draft.modifierGroup, priceAdjustment, required: false, minSelections: 0, maxSelections: 1, defaultSelected: false };
    const request = { menuItemId: item.id, rule, inventory: review };
    const result = await commands.run(entity, `create-modifier:${item.id}`, request, (idempotencyKey) => createMenuModifierAction({ ...request, idempotencyKey }));
    if (result.success) {
      setDraft((current) => (current === submitted ? empty : current));
      setReview({ action: "none", inventoryItemId: null, replacesInventoryItemId: null, quantity: 0 });
      setReviewed(false);
      setFormVersion((version) => version + 1);
    } else setError(result.error);
    reportResult(notify, result, `${rule.name} added to ${item.name}`, true);
  }

  return (
    <div className="grid gap-3 rounded-[6px] border border-dashed border-border p-3">
      <p className="text-sm font-medium">New option</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor={`${prefix}-name`}>Option name</Label>
          <Input className="rounded-[6px]" id={`${prefix}-name`} value={draft.name} maxLength={200} placeholder="Extra shot" onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        </div>
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor={`${prefix}-group`}>Group</Label>
          <select id={`${prefix}-group`} className={selectClass} value={draft.modifierGroup} onChange={(event) => setDraft({ ...draft, modifierGroup: event.target.value })}>
            {MODIFIER_GROUPS.map((group) => <option key={group.value} value={group.value}>{group.label}</option>)}
          </select>
        </div>
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor={`${prefix}-price`}>Price change</Label>
          <Input className="rounded-[6px]" id={`${prefix}-price`} inputMode="decimal" value={draft.price} aria-invalid={priceAdjustment == null} onChange={(event) => setDraft({ ...draft, price: event.target.value })} />
        </div>
      </div>
      <fieldset className="grid gap-2 rounded-[6px] border border-border p-3">
        <legend className="px-1 text-sm">Inventory</legend>
        <InventoryReviewFields key={formVersion} idPrefix={prefix} review={review} onChange={(next) => { setReview(next); setReviewed(true); }} />
        <label htmlFor={`${prefix}-reviewed`} className="flex items-center gap-2 text-sm">
          <input id={`${prefix}-reviewed`} type="checkbox" className={checkboxClass} checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />
          Inventory confirmed
        </label>
      </fieldset>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div>
        <Button type="button" size="sm" variant="outline" className="rounded-[6px]" disabled={busy || !valid} onClick={create}>{busy ? "Adding…" : "Add option"}</Button>
      </div>
    </div>
  );
}
