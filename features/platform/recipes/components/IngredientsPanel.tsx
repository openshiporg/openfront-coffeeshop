"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Pencil, Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { PlatformEmpty, PlatformSection } from "@/features/platform/components/PlatformPage";
import { createIngredientAction, deleteIngredientAction, searchInventoryItemsAction, updateIngredientAction } from "../actions/recipes";
import { formatCents, formatQuantity, lineCostCents, quantityError, toNumber } from "../lib/recipeMath";
import type { IngredientRow, InventoryOption, StoreFormat } from "../lib/recipeTypes";
import { SearchPicker } from "./SearchPicker";

type Draft = { item: InventoryOption | null; name: string; quantity: string; optional: boolean; notes: string };
type Errors = Partial<Record<"item" | "name" | "quantity", string>>;

function draftFrom(row?: IngredientRow | null): Draft {
  return {
    item: row?.inventoryItem ?? null,
    name: row?.name ?? "",
    quantity: row?.quantity ? String(Number(row.quantity)) : "",
    optional: Boolean(row?.optional),
    notes: row?.notes ?? "",
  };
}

function stockLabel(item: InventoryOption, locale: string) {
  return `${item.unit || "no unit"} · ${formatQuantity(item.currentStock ?? 0, locale)} on hand`;
}

export function IngredientsPanel({
  recipeId,
  ingredients,
  yieldQuantity,
  yieldUnit,
  format,
  canManage,
}: {
  recipeId: string;
  ingredients: IngredientRow[];
  yieldQuantity: string | null;
  yieldUnit: string | null;
  format: StoreFormat;
  canManage: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = React.useState<IngredientRow | "new" | null>(null);
  const [draft, setDraft] = React.useState<Draft>(() => draftFrom());
  const [errors, setErrors] = React.useState<Errors>({});
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);
  const [removing, setRemoving] = React.useState<IngredientRow | null>(null);
  const [removeError, setRemoveError] = React.useState<string | null>(null);
  const yieldValue = toNumber(yieldQuantity);
  const perUnit = yieldUnit || "unit";

  function open(row: IngredientRow | "new") {
    setDraft(draftFrom(row === "new" ? null : row));
    setErrors({});
    setServerError(null);
    setEditing(row);
  }

  function update(patch: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Errors = {};
    if (!draft.item) nextErrors.item = "Choose an inventory item";
    else if (!draft.item.unit) nextErrors.item = "This inventory item has no unit";
    if (!draft.name.trim() && !draft.item?.name) nextErrors.name = "Name is required";
    const qty = quantityError(draft.quantity, "Quantity", draft.item?.unit);
    if (qty) nextErrors.quantity = qty;
    setErrors(nextErrors);
    setServerError(null);
    if (Object.keys(nextErrors).length || !draft.item) return;
    setPending(true);
    const input = {
      recipeId,
      name: draft.name.trim() || draft.item.name || "",
      inventoryItemId: draft.item.id,
      quantity: draft.quantity.trim(),
      unit: draft.item.unit || "",
      optional: draft.optional,
      notes: draft.notes,
    };
    const response = editing && editing !== "new" ? await updateIngredientAction(editing.id, input) : await createIngredientAction(input);
    setPending(false);
    if (!response.success) return setServerError(response.error);
    setEditing(null);
    router.refresh();
  }

  async function confirmRemove() {
    if (!removing) return;
    setPending(true);
    setRemoveError(null);
    const response = await deleteIngredientAction(removing.id, recipeId);
    setPending(false);
    if (!response.success) return setRemoveError(response.error);
    setRemoving(null);
    router.refresh();
  }

  return (
    <PlatformSection
      id="recipe-ingredients-heading"
      title="Ingredients"
      meta={ingredients.length}
      actions={canManage ? (
        <Button type="button" size="sm" className="rounded-[6px]" onClick={() => open("new")}>
          <Plus className="size-4" aria-hidden="true" />Add ingredient
        </Button>
      ) : null}
    >
      {ingredients.length ? (
        <div className="overflow-hidden rounded-[6px] border bg-card">
          <div className="hidden grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] gap-3 border-b bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground md:grid">
            <span>Ingredient</span>
            <span className="text-right">Quantity</span>
            <span className="text-right">Cost</span>
            <span className="text-right">Cost / {perUnit}</span>
            <span className="text-right">On hand</span>
            <span className="w-[72px]" aria-hidden="true" />
          </div>
          <ul className="divide-y">
            {ingredients.map((row) => {
              const item = row.inventoryItem;
              const cost = lineCostCents({ quantity: row.quantity, costPerUnit: item?.costPerUnit });
              const costPerYield = cost !== null && yieldValue > 0 ? cost / yieldValue : null;
              const stock = toNumber(item?.currentStock);
              const short = !row.optional && Number.isFinite(stock) && yieldValue > 0 && stock < toNumber(row.quantity) / yieldValue;
              return (
                <li key={row.id} className="grid grid-cols-2 gap-x-3 gap-y-1 px-4 py-3 md:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] md:items-center">
                  <div className="col-span-2 min-w-0 md:col-span-1">
                    <p className="text-sm font-medium [overflow-wrap:anywhere]">
                      {row.name || item?.name || "Ingredient"}
                      {row.optional ? <span className="ml-2 text-xs font-normal text-muted-foreground">Optional</span> : null}
                    </p>
                    {item ? (
                      <Link href={`/dashboard/platform/inventory/${item.id}`} className="inline-flex max-w-full items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
                        <span className="truncate">{item.name || "Inventory item"}</span><ArrowUpRight className="size-3 shrink-0" aria-hidden="true" />
                      </Link>
                    ) : null}
                    {!item ? <p className="text-xs text-destructive">No inventory item</p> : null}
                    {row.notes ? <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{row.notes}</p> : null}
                  </div>
                  <p className="text-sm tabular-nums md:text-right"><span className="text-muted-foreground md:hidden">Qty </span>{formatQuantity(row.quantity, format.locale)} {row.unit}</p>
                  <p className="text-right text-sm tabular-nums"><span className="text-muted-foreground md:hidden">Cost </span>{formatCents(cost, format.currencyCode, format.locale)}</p>
                  <p className="text-sm tabular-nums md:text-right"><span className="text-muted-foreground md:hidden">Cost / {perUnit} </span>{formatCents(costPerYield, format.currencyCode, format.locale)}</p>
                  <p className={`text-right text-sm tabular-nums ${short ? "font-medium text-destructive" : ""}`}><span className="font-normal text-muted-foreground md:hidden">On hand </span>{item ? `${formatQuantity(item.currentStock ?? 0, format.locale)} ${item.unit ?? ""}` : "—"}</p>
                  <div className="col-span-2 flex justify-end gap-1 md:col-span-1">
                    {canManage ? (
                      <>
                        <Button type="button" size="icon" variant="ghost" className="size-8 rounded-[6px]" aria-label={`Edit ${row.name || "ingredient"}`} onClick={() => open(row)}>
                          <Pencil className="size-4" aria-hidden="true" />
                        </Button>
                        <Button type="button" size="icon" variant="ghost" className="size-8 rounded-[6px] text-destructive" aria-label={`Remove ${row.name || "ingredient"}`} onClick={() => { setRemoveError(null); setRemoving(row); }}>
                          <Trash2 className="size-4" aria-hidden="true" />
                        </Button>
                      </>
                    ) : <span className="w-[72px]" aria-hidden="true" />}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <PlatformEmpty>No ingredients.</PlatformEmpty>
      )}

      <Sheet open={editing !== null} onOpenChange={(next) => { if (!next && !pending) setEditing(null); }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <form onSubmit={submit} noValidate className="flex min-h-full flex-col gap-4">
            <SheetHeader>
              <SheetTitle>{editing === "new" ? "Add ingredient" : "Edit ingredient"}</SheetTitle>
              <SheetDescription className="sr-only">Ingredient details</SheetDescription>
            </SheetHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="ingredient-item">Inventory item</Label>
                <SearchPicker<InventoryOption>
                  id="ingredient-item"
                  selected={draft.item}
                  onSelect={(item) => update({ item, name: !draft.name.trim() || draft.name === draft.item?.name ? item?.name ?? "" : draft.name })}
                  search={searchInventoryItemsAction}
                  describe={(item) => stockLabel(item, format.locale)}
                  placeholder="Search inventory"
                  emptyLabel="No inventory items."
                  invalid={Boolean(errors.item)}
                />
                {errors.item ? <p className="text-sm text-destructive">{errors.item}</p> : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ingredient-name">Name</Label>
                <Input id="ingredient-name" value={draft.name} maxLength={200} aria-invalid={Boolean(errors.name) || undefined} onChange={(event) => update({ name: event.currentTarget.value })} />
                {errors.name ? <p className="text-sm text-destructive">{errors.name}</p> : null}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ingredient-quantity">Quantity</Label>
                  <Input id="ingredient-quantity" inputMode="decimal" value={draft.quantity} aria-invalid={Boolean(errors.quantity) || undefined} aria-describedby={errors.quantity ? "ingredient-quantity-error" : undefined} onChange={(event) => update({ quantity: event.currentTarget.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ingredient-unit">Unit</Label>
                  <Input id="ingredient-unit" value={draft.item?.unit ?? ""} readOnly aria-readonly="true" className="bg-muted/50" />
                </div>
                {errors.quantity ? <p id="ingredient-quantity-error" className="col-span-2 text-sm text-destructive">{errors.quantity}</p> : null}
              </div>
              <div className="flex items-center gap-2">
                <Checkbox id="ingredient-optional" checked={draft.optional} onCheckedChange={(checked) => update({ optional: checked === true })} />
                <Label htmlFor="ingredient-optional">Optional</Label>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ingredient-notes">Notes</Label>
                <Textarea id="ingredient-notes" rows={3} value={draft.notes} maxLength={5000} onChange={(event) => update({ notes: event.currentTarget.value })} />
              </div>
              <p role="alert" aria-live="assertive" className={serverError ? "rounded-[6px] border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" : "sr-only"}>{serverError || ""}</p>
            </div>
            <SheetFooter className="mt-auto flex-row justify-end gap-2">
              <Button type="button" variant="ghost" className="rounded-[6px]" disabled={pending} onClick={() => setEditing(null)}>Cancel</Button>
              <Button type="submit" className="rounded-[6px]" disabled={pending}>{pending ? "Saving…" : editing === "new" ? "Add ingredient" : "Save"}</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <Dialog open={removing !== null} onOpenChange={(next) => { if (!next && !pending) setRemoving(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Remove {removing?.name || "ingredient"}?</DialogTitle>
            <DialogDescription className="sr-only">Remove ingredient</DialogDescription>
          </DialogHeader>
          <p role="alert" aria-live="assertive" className={removeError ? "text-sm text-destructive" : "sr-only"}>{removeError || ""}</p>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" className="rounded-[6px]" disabled={pending} onClick={() => setRemoving(null)}>Cancel</Button>
            <Button type="button" variant="destructive" className="rounded-[6px]" disabled={pending} onClick={confirmRemove}>{pending ? "Removing…" : "Remove"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PlatformSection>
  );
}
