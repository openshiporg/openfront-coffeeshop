"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { saveInventoryItem } from "../actions/inventory";
import {
  centsToDollars,
  INVENTORY_CATEGORIES,
  INVENTORY_PATH,
  INVENTORY_UNITS,
  validateInventoryItemInput,
  type InventoryFieldErrors,
  type InventoryItemInput,
} from "../lib/inventory";
import type { InventoryListItem } from "../lib/types";

function initialDraft(item?: InventoryListItem | null): InventoryItemInput {
  return {
    id: item?.id ?? null,
    name: item?.name ?? "",
    category: item?.category ?? "coffee",
    unit: item?.unit ?? "each",
    reorderPoint: item ? String(Number(item.reorderPoint ?? 0)) : "0",
    parLevel: item ? String(Number(item.parLevel ?? 0)) : "0",
    costPerUnit: item ? centsToDollars(item.costPerUnit) : "",
    supplierName: item?.supplierName ?? "",
    sku: item?.sku ?? "",
  };
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p id={id} className="text-xs text-destructive">{message}</p> : null;
}

export function InventoryItemDrawer({
  item,
  supplierNames,
  unitLocked = false,
}: {
  item?: InventoryListItem | null;
  supplierNames: string[];
  unitLocked?: boolean;
}) {
  const router = useRouter();
  const editing = Boolean(item?.id);
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<InventoryItemInput>(() => initialDraft(item));
  const [errors, setErrors] = React.useState<InventoryFieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const formId = React.useId();
  const listId = `${formId}-suppliers`;

  function openDrawer(next: boolean) {
    if (next) {
      setDraft(initialDraft(item));
      setErrors({});
      setFormError(null);
    }
    setOpen(next);
  }

  function update<K extends keyof InventoryItemInput>(key: K, value: InventoryItemInput[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const local = validateInventoryItemInput(draft);
    if (local.errors) {
      setErrors(local.errors);
      setFormError(null);
      return;
    }
    startTransition(async () => {
      const result = await saveInventoryItem(draft, { unitLocked: editing && unitLocked });
      if (!result.success) {
        setErrors((result.fieldErrors as InventoryFieldErrors) ?? {});
        setFormError(result.error);
        return;
      }
      setOpen(false);
      if (!editing && result.id) router.push(`${INVENTORY_PATH}/${result.id}`);
      else router.refresh();
    });
  }

  const field = (key: keyof InventoryItemInput) => ({
    id: `${formId}-${key}`,
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${formId}-${key}-error` : undefined,
  });

  return (
    <>
      {editing ? (
        <Button type="button" variant="outline" className="rounded-full" onClick={() => openDrawer(true)}>
          <Pencil className="size-4" aria-hidden="true" />Edit
        </Button>
      ) : (
        <Button type="button" className="rounded-full" onClick={() => openDrawer(true)}>
          <Plus className="size-4" aria-hidden="true" />New item
        </Button>
      )}
      <Sheet open={open} onOpenChange={(next) => (pending ? undefined : openDrawer(next))}>
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-md">
          <form onSubmit={submit} noValidate className="flex flex-1 flex-col gap-5">
            <SheetHeader>
              <SheetTitle>{editing ? "Edit inventory item" : "New inventory item"}</SheetTitle>
              <SheetDescription className="sr-only">{editing ? "Edit inventory item" : "New inventory item"}</SheetDescription>
            </SheetHeader>

            <div className="space-y-1.5">
              <Label htmlFor={`${formId}-name`}>Name</Label>
              <Input {...field("name")} value={draft.name} onChange={(event) => update("name", event.target.value)} maxLength={200} required />
              <FieldError id={`${formId}-name-error`} message={errors.name} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${formId}-category`}>Category</Label>
                <Select value={draft.category} onValueChange={(value) => update("category", value)}>
                  <SelectTrigger {...field("category")}><SelectValue placeholder="Category" /></SelectTrigger>
                  <SelectContent>
                    {INVENTORY_CATEGORIES.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                <FieldError id={`${formId}-category-error`} message={errors.category} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${formId}-unit`}>Unit</Label>
                <Select value={draft.unit} onValueChange={(value) => update("unit", value)} disabled={editing && unitLocked}>
                  <SelectTrigger {...field("unit")}><SelectValue placeholder="Unit" /></SelectTrigger>
                  <SelectContent>
                    {INVENTORY_UNITS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label} ({option.value})</SelectItem>)}
                  </SelectContent>
                </Select>
                {editing && unitLocked ? <p className="text-xs text-muted-foreground">Locked: item has history</p> : null}
                <FieldError id={`${formId}-unit-error`} message={errors.unit} />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${formId}-reorderPoint`}>Reorder point ({draft.unit})</Label>
                <Input {...field("reorderPoint")} inputMode="decimal" value={draft.reorderPoint} onChange={(event) => update("reorderPoint", event.target.value)} />
                <FieldError id={`${formId}-reorderPoint-error`} message={errors.reorderPoint} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${formId}-parLevel`}>Par level ({draft.unit})</Label>
                <Input {...field("parLevel")} inputMode="decimal" value={draft.parLevel} onChange={(event) => update("parLevel", event.target.value)} />
                <FieldError id={`${formId}-parLevel-error`} message={errors.parLevel} />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${formId}-costPerUnit`}>Cost per {draft.unit} ($)</Label>
              <Input {...field("costPerUnit")} inputMode="decimal" placeholder="0.00" value={draft.costPerUnit} onChange={(event) => update("costPerUnit", event.target.value)} />
              <FieldError id={`${formId}-costPerUnit-error`} message={errors.costPerUnit} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${formId}-supplierName`}>Supplier</Label>
              <Input {...field("supplierName")} list={listId} autoComplete="off" value={draft.supplierName} onChange={(event) => update("supplierName", event.target.value)} maxLength={200} />
              <datalist id={listId}>
                {supplierNames.map((name) => <option key={name} value={name} />)}
              </datalist>
              <FieldError id={`${formId}-supplierName-error`} message={errors.supplierName} />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${formId}-sku`}>SKU</Label>
              <Input {...field("sku")} value={draft.sku} onChange={(event) => update("sku", event.target.value)} maxLength={100} />
              <FieldError id={`${formId}-sku-error`} message={errors.sku} />
            </div>

            {formError ? <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{formError}</p> : null}

            <SheetFooter className="mt-auto flex-row justify-end gap-2">
              <Button type="button" variant="ghost" className="rounded-full" onClick={() => openDrawer(false)} disabled={pending}>Cancel</Button>
              <Button type="submit" className="rounded-full" disabled={pending}>{pending ? "Saving…" : editing ? "Save" : "Create item"}</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
