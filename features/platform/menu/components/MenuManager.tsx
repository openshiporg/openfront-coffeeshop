"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Textarea } from "@/components/ui/textarea";
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
const selectClass = "h-9 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50";
const checkboxClass = "size-4 rounded border-input accent-primary";

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

  const available = data.stats.items - data.stats.hidden;
  const filtered = Boolean(filters.search || filters.categoryId);

  return (
    <div className="space-y-6 px-4 pb-8 md:px-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Menu</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {data.stats.items} items · {available} available · {data.stats.modifiersOut} options out of stock
          </p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setCreateCategoryOpen(true)}>New Category</Button>
            <Button size="sm" onClick={() => setCreateItemOpen(true)}><Plus aria-hidden="true" />New Item</Button>
          </div>
        )}
      </div>

      {!canManage && (
        <p className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">
          You can view the menu. Changes need a role that can manage products.
        </p>
      )}

      <div aria-live="polite" role="status" className="sr-only">{feedback?.tone === "status" ? feedback.message : ""}</div>
      {feedback?.tone === "error" && (
        <div role="alert" className="flex flex-col gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-foreground sm:flex-row sm:items-center sm:justify-between">
          <span>{feedback.message}</span>
          <Button variant="ghost" size="sm" onClick={() => setFeedback(null)}>Dismiss</Button>
        </div>
      )}

      <form key={`${filters.search}|${filters.categoryId}`} method="get" action={MENU_PATH} role="search" className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-[minmax(0,1fr)_14rem_auto] sm:items-end">
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor="menu-search">Search menu</Label>
          <Input id="menu-search" name="q" type="search" defaultValue={filters.search} placeholder="Item, description or option" maxLength={200} />
        </div>
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor="menu-category-filter">Category</Label>
          <select id="menu-category-filter" name="category" defaultValue={filters.categoryId} className={selectClass}>
            <option value="">All categories</option>
            <option value="uncategorized">Uncategorized</option>
            {data.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <Button type="submit" variant="outline">Search</Button>
          {filtered && <Button asChild variant="ghost"><Link href={MENU_PATH}>Clear</Link></Button>}
        </div>
      </form>
      {data.categoriesHasMore && <p className="text-xs text-muted-foreground">Only the first 200 categories are listed here.</p>}

      <p className="text-sm text-muted-foreground">
        {data.matchingCount} {filtered ? "matching" : ""} item{data.matchingCount === 1 ? "" : "s"}{filters.cursor ? " · later page" : ""}
      </p>

      {data.items.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {data.items.map((item) => (
            <MenuItemCard key={item.id} item={item} categories={data.categories} canManage={canManage} commands={commands} notify={notify} />
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {filtered ? "No menu items match this search." : canManage ? "The menu has no items yet. Use New Item to add the first one." : "The menu has no items yet."}
        </div>
      )}

      {(filters.cursor || data.hasMore) && (
        <nav aria-label="Menu pages" className="flex flex-wrap gap-2">
          {filters.cursor && <Button asChild variant="outline" size="sm"><Link href={menuHref({ search: filters.search, categoryId: filters.categoryId })}>First page</Link></Button>}
          {data.hasMore && data.nextCursor && <Button asChild variant="outline" size="sm"><Link href={menuHref({ search: filters.search, categoryId: filters.categoryId, cursor: data.nextCursor })}>Next page</Link></Button>}
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
    <div role="alert" className="flex flex-col gap-2 rounded-md border border-border bg-muted p-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <span>{subject} was changed by someone else while you were editing.</span>
      <span className="flex gap-2">
        <Button type="button" size="sm" variant="outline" onClick={onDiscard}>Use saved version</Button>
        <Button type="button" size="sm" variant="ghost" onClick={onKeep}>Keep my changes</Button>
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

  return (
    <Card className="min-w-0 gap-4 py-4">
      <CardHeader className="px-4">
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="break-words text-base">{item.name}</CardTitle>
              {!item.available && <Badge variant="destructive">Unavailable</Badge>}
              {item.featured && <Badge variant="secondary">Featured</Badge>}
              {item.popular && <Badge variant="secondary">Popular</Badge>}
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {item.category?.name || "Uncategorized"} · {stationLabel(item.barStation)} · {item.prepTimeMinutes ?? 0} min prep
            </p>
            {item.shortDescription && <p className="mt-1 break-words text-sm text-muted-foreground">{item.shortDescription}</p>}
          </div>
          {canManage
            ? <PriceEditor item={item} busy={busy} onSave={(price, base) => update("price", { price }, base, `${item.name} price saved`)} />
            : <p className="text-base font-semibold">{money(item.price)}</p>}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 px-4">
        {canManage && (
          <div className="flex flex-wrap gap-2">
            <FlagToggle label="Available" pressed={item.available} busy={busy} onToggle={() => update("available", { available: !item.available }, item.updatedAt, `${item.name} is now ${item.available ? "unavailable" : "available"}`)} />
            <FlagToggle label="Featured" pressed={item.featured} busy={busy} onToggle={() => update("featured", { featured: !item.featured }, item.updatedAt, `${item.name} featured setting saved`)} />
            <FlagToggle label="Popular" pressed={item.popular} busy={busy} onToggle={() => update("popular", { popular: !item.popular }, item.updatedAt, `${item.name} popular setting saved`)} />
            <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => setDetailsOpen(true)}>Edit details</Button>
            <Button asChild size="sm" variant="link"><Link href={`/dashboard/menu-items/${item.id}`}>Photos and full record</Link></Button>
          </div>
        )}

        <section aria-label={`${item.name} options`} className="space-y-3 rounded-md border border-border bg-muted/40 p-3">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Options</h3>
          {item.modifiers.length === 0 && <p className="text-sm text-muted-foreground">No options yet.</p>}
          {item.modifiers.map((modifier) => canManage
            ? <ModifierEditor key={modifier.id} modifier={modifier} commands={commands} notify={notify} />
            : <ModifierSummary key={modifier.id} modifier={modifier} />)}
          {item.modifiersHasMore && <p className="text-xs text-muted-foreground">This item has more than 100 options; only the first 100 are shown.</p>}
          {canManage && <NewModifierForm item={item} commands={commands} notify={notify} />}
        </section>
      </CardContent>
      {canManage && <ItemDetailsDialog open={detailsOpen} onOpenChange={setDetailsOpen} item={item} categories={categories} busy={busy} onSave={update} />}
    </Card>
  );
}

function FlagToggle({ label, pressed, busy, onToggle }: { label: string; pressed: boolean; busy: boolean; onToggle: () => void }) {
  return (
    <Button type="button" size="sm" variant={pressed ? "secondary" : "outline"} aria-pressed={pressed} disabled={busy} onClick={onToggle}>
      {label}: {pressed ? "On" : "Off"}
    </Button>
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
    <div className="grid gap-1.5 sm:justify-items-end">
      <Label htmlFor={id}>Price</Label>
      <div className="flex items-center gap-2">
        <Input id={id} inputMode="decimal" className="w-24 text-right" value={draft.value} aria-invalid={cents == null} onChange={(event) => { const next = event.target.value; draft.set(() => next); }} />
        <Button type="button" size="sm" disabled={!draft.dirty || cents == null || busy} onClick={save}>{busy ? "Saving…" : "Save"}</Button>
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={save} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>Edit {item.name}</DialogTitle>
            <DialogDescription>Name, description, category, station and prep time. Unsaved changes stay here if you close this window.</DialogDescription>
          </DialogHeader>
          {draft.conflict && <ConflictNotice subject="This item" onKeep={draft.keepMine} onDiscard={draft.discard} />}
          <div className="grid gap-1.5">
            <Label htmlFor={`${prefix}-name`}>Name</Label>
            <Input id={`${prefix}-name`} value={value.name} maxLength={200} aria-invalid={!nameValid} onChange={(event) => set("name", event.target.value)} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor={`${prefix}-description`}>Short description</Label>
            <Textarea id={`${prefix}-description`} value={value.shortDescription} maxLength={1000} onChange={(event) => set("shortDescription", event.target.value)} />
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
              <Input id={`${prefix}-prep`} inputMode="numeric" value={value.prepTimeMinutes} aria-invalid={!prepValid} aria-describedby={!prepValid ? `${prefix}-prep-error` : undefined} onChange={(event) => set("prepTimeMinutes", event.target.value)} />
              {!prepValid && <p id={`${prefix}-prep-error`} className="text-xs text-destructive">Enter whole minutes from 0 to 240.</p>}
            </div>
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            {draft.dirty && <Button type="button" variant="ghost" onClick={draft.discard}>Discard changes</Button>}
            <Button type="submit" disabled={busy || !nameValid || !prepValid || !hasChanges}>{busy ? "Saving…" : "Save"}</Button>
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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={create} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>New item</DialogTitle>
            <DialogDescription>New items are available as soon as they are saved. Add options after creating the item.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="new-item-name">Name</Label>
            <Input id="new-item-name" value={draft.name} maxLength={200} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Seasonal latte" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="grid gap-1.5">
              <Label htmlFor="new-item-price">Price</Label>
              <Input id="new-item-price" inputMode="decimal" value={draft.price} aria-invalid={draft.price !== "" && price == null} onChange={(event) => setDraft({ ...draft, price: event.target.value })} placeholder="5.75" />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="new-item-prep">Prep time (minutes)</Label>
              <Input id="new-item-prep" inputMode="numeric" value={draft.prepTimeMinutes} aria-invalid={!prepValid} onChange={(event) => setDraft({ ...draft, prepTimeMinutes: event.target.value })} />
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
            <Textarea id="new-item-description" value={draft.shortDescription} maxLength={1000} onChange={(event) => setDraft({ ...draft, shortDescription: event.target.value })} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={busy || !valid}>{busy ? "Adding…" : "Add item"}</Button>
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
      <DialogContent className="sm:max-w-md">
        <form onSubmit={create} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>New category</DialogTitle>
            <DialogDescription>Categories group items on the menu and in the register.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <Label htmlFor="new-category-name">Name</Label>
            <Input id="new-category-name" value={draft.name} maxLength={120} onChange={(event) => setDraft({ ...draft, name: event.target.value })} placeholder="Seasonal drinks" />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="new-category-description">Description (optional)</Label>
            <Textarea id="new-category-description" value={draft.description} maxLength={1000} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="new-category-sort">Sort order</Label>
            <Input id="new-category-sort" inputMode="numeric" value={draft.sortOrder} aria-invalid={!sortValid} onChange={(event) => setDraft({ ...draft, sortOrder: event.target.value })} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={busy || !valid}>{busy ? "Adding…" : "Add category"}</Button>
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
    case "none": return "Inventory: no stock used";
    case "add": return `Inventory: uses ${Number(modifier.inventoryQuantity || 0)}${unit} of ${target}`;
    case "substitute": return `Inventory: replaces ${modifier.replacesInventoryItem?.name || "the base ingredient"} with ${target}`;
    case "unreviewed": return "Inventory not reviewed — this option can't be offered until it is";
    default: return null;
  }
}

function ModifierSummary({ modifier }: { modifier: MenuModifier }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-card p-3 text-sm">
      <div className="min-w-0">
        <p className="font-medium break-words">{modifier.name} <span className="font-normal text-muted-foreground">· {modifier.modifierGroupLabel || modifier.modifierGroup}</span></p>
        <p className="text-xs text-muted-foreground">
          {modifier.required ? "Required" : "Optional"} · choose {modifier.minSelections}–{modifier.maxSelections}{modifier.defaultSelected ? " · default" : ""}
        </p>
      </div>
      <div className="flex items-center gap-2">
        <span>{money(modifier.priceAdjustment)}</span>
        <Badge variant={modifier.inStock ? "secondary" : "destructive"}>{modifier.inStock ? "In stock" : "Out of stock"}</Badge>
      </div>
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
    <div className="grid gap-3 rounded-md border border-border bg-card p-3">
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
          <Input id={`${prefix}-name`} value={draft.value.name} maxLength={200} onChange={(event) => set("name", event.target.value)} />
        </div>
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor={`${prefix}-group`}>Group</Label>
          <select id={`${prefix}-group`} className={selectClass} value={draft.value.modifierGroup} onChange={(event) => set("modifierGroup", event.target.value)}>
            {MODIFIER_GROUPS.map((group) => <option key={group.value} value={group.value}>{group.label}</option>)}
          </select>
        </div>
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor={`${prefix}-group-label`}>Group label</Label>
          <Input id={`${prefix}-group-label`} value={draft.value.modifierGroupLabel} maxLength={120} placeholder="Milk choice" onChange={(event) => set("modifierGroupLabel", event.target.value)} />
        </div>
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor={`${prefix}-price`}>Price change</Label>
          <Input id={`${prefix}-price`} inputMode="decimal" value={draft.value.price} aria-invalid={parseCents(draft.value.price, { allowNegative: true }) == null} onChange={(event) => set("price", event.target.value)} />
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
          <Input id={`${prefix}-min`} inputMode="numeric" className="w-20" value={draft.value.minSelections} onChange={(event) => set("minSelections", event.target.value)} />
        </div>
        <div className="grid gap-1">
          <Label htmlFor={`${prefix}-max`}>Maximum</Label>
          <Input id={`${prefix}-max`} inputMode="numeric" className="w-20" value={draft.value.maxSelections} onChange={(event) => set("maxSelections", event.target.value)} />
        </div>
        <label htmlFor={`${prefix}-default`} className="flex items-center gap-2">
          <input id={`${prefix}-default`} type="checkbox" className={checkboxClass} checked={draft.value.defaultSelected} onChange={(event) => set("defaultSelected", event.target.checked)} />
          Selected by default
        </label>
      </fieldset>
      {!rule && <p className="text-xs text-destructive">Check the name, price and selection limits (maximum 1–20, minimum no higher than maximum, at least 1 when required).</p>}

      <div className="grid gap-2 rounded-md border border-border p-3 text-sm">
        <p className={unreviewed ? "text-destructive" : "text-muted-foreground"}>{inventorySummary(modifier)}</p>
        {review === null
          ? <div><Button type="button" size="sm" variant="outline" disabled={busy} onClick={startReview}>{unreviewed ? "Review inventory" : "Change inventory"}</Button></div>
          : (
            <>
              <InventoryReviewFields idPrefix={prefix} review={review} onChange={setReview} current={modifier} />
              <div><Button type="button" size="sm" variant="ghost" onClick={() => setReview(null)}>Keep current inventory</Button></div>
            </>
          )}
      </div>

      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" disabled={!canSave} onClick={save}>{busy ? "Saving…" : "Save option"}</Button>
        {dirty && <Button type="button" size="sm" variant="ghost" disabled={busy} onClick={() => { draft.discard(); setReview(null); }}>Discard changes</Button>}
        <Button
          type="button"
          size="sm"
          variant={modifier.inStock ? "secondary" : "outline"}
          aria-pressed={modifier.inStock}
          disabled={busy || (!modifier.inStock && unreviewed)}
          onClick={toggleStock}
        >
          {modifier.inStock ? "In stock" : "Out of stock"}
        </Button>
      </div>
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
            className="w-32"
            value={quantity}
            aria-invalid={quantity !== "" && !quantityValid}
            onChange={(event) => {
              const next = event.target.value;
              setQuantity(next);
              const valid = /^\d+(\.\d{1,4})?$/.test(next.trim()) && Number(next) > 0;
              onChange({ ...review, quantity: valid ? Number(next) : 0 });
            }}
          />
          <p className="text-xs text-muted-foreground">In the ingredient&apos;s own unit, up to four decimal places.</p>
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
      {!reviewComplete(review) && <p className="text-xs text-muted-foreground">Finish choosing the inventory before saving.</p>}
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
          className="min-w-0 flex-1"
          value={search}
          placeholder="Search inventory"
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); void find(); } }}
        />
        <Button type="button" size="sm" variant="outline" disabled={loading} onClick={find}>{loading ? "Searching…" : "Find"}</Button>
      </div>
      <select id={id} aria-label={label} className={selectClass} value={value || ""} onChange={(event) => onChange(event.target.value || null)}>
        <option value="">{options.length ? "Choose an ingredient" : "Search to list ingredients"}</option>
        {options.map((option) => <option key={option.id} value={option.id}>{option.name}{option.unit ? ` (${option.unit})` : ""}</option>)}
      </select>
      <div aria-live="polite" className="text-xs text-muted-foreground">
        {error ? <span className="text-destructive">{error}</span> : searched && !options.length ? "No inventory matches this search." : hasMore ? "More ingredients match; refine the search to narrow the list." : ""}
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
    <div className="grid gap-3 border-t border-border pt-3">
      <p className="text-sm font-medium">Add an option</p>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor={`${prefix}-name`}>Option name</Label>
          <Input id={`${prefix}-name`} value={draft.name} maxLength={200} placeholder="Extra shot" onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
        </div>
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor={`${prefix}-group`}>Group</Label>
          <select id={`${prefix}-group`} className={selectClass} value={draft.modifierGroup} onChange={(event) => setDraft({ ...draft, modifierGroup: event.target.value })}>
            {MODIFIER_GROUPS.map((group) => <option key={group.value} value={group.value}>{group.label}</option>)}
          </select>
        </div>
        <div className="grid min-w-0 gap-1.5">
          <Label htmlFor={`${prefix}-price`}>Price change</Label>
          <Input id={`${prefix}-price`} inputMode="decimal" value={draft.price} aria-invalid={priceAdjustment == null} onChange={(event) => setDraft({ ...draft, price: event.target.value })} />
        </div>
      </div>
      <fieldset className="grid gap-2 rounded-md border border-border p-3">
        <legend className="px-1 text-sm">Inventory for this option</legend>
        <InventoryReviewFields key={formVersion} idPrefix={prefix} review={review} onChange={(next) => { setReview(next); setReviewed(true); }} />
        <label htmlFor={`${prefix}-reviewed`} className="flex items-center gap-2 text-sm">
          <input id={`${prefix}-reviewed`} type="checkbox" className={checkboxClass} checked={reviewed} onChange={(event) => setReviewed(event.target.checked)} />
          I&apos;ve confirmed how this option uses inventory
        </label>
      </fieldset>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div>
        <Button type="button" size="sm" variant="outline" disabled={busy || !valid} onClick={create}>{busy ? "Adding…" : "Add option"}</Button>
      </div>
    </div>
  );
}
