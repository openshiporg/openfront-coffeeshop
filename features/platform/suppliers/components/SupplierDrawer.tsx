"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { PillButton, PillTrack } from "@/features/platform/components/PillTabs";
import { saveSupplier } from "../actions/suppliers";
import {
  SUPPLIER_STATUS,
  SUPPLIER_STATUSES,
  SUPPLIERS_PATH,
  validateSupplierInput,
  type SupplierFieldErrors,
  type SupplierInput,
  type SupplierRow,
} from "../lib/suppliers";

function initialDraft(supplier?: SupplierRow | null): SupplierInput {
  return {
    id: supplier?.id ?? null,
    name: supplier?.name ?? "",
    status: supplier?.status ?? "active",
    contactName: supplier?.contactName ?? "",
    email: supplier?.email ?? "",
    phone: supplier?.phone ?? "",
    website: supplier?.website ?? "",
    leadTimeDays: String(supplier?.leadTimeDays ?? 0),
    notes: supplier?.notes ?? "",
  };
}

export function SupplierDrawer({ supplier }: { supplier?: SupplierRow | null }) {
  const router = useRouter();
  const editing = Boolean(supplier?.id);
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<SupplierInput>(() => initialDraft(supplier));
  const [errors, setErrors] = React.useState<SupplierFieldErrors>({});
  const [formError, setFormError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const formId = React.useId();

  function openDrawer(next: boolean) {
    if (next) {
      setDraft(initialDraft(supplier));
      setErrors({});
      setFormError(null);
    }
    setOpen(next);
  }

  function update<K extends keyof SupplierInput>(key: K, value: SupplierInput[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
    setErrors((current) => ({ ...current, [key]: undefined }));
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const local = validateSupplierInput(draft);
    if (local.errors) {
      setErrors(local.errors);
      setFormError(null);
      return;
    }
    startTransition(async () => {
      const result = await saveSupplier(draft);
      if (!result.success) {
        setErrors((result.fieldErrors as SupplierFieldErrors) ?? {});
        setFormError(result.error);
        return;
      }
      setOpen(false);
      if (!editing && result.id) router.push(`${SUPPLIERS_PATH}/${result.id}`);
      else router.refresh();
    });
  }

  const field = (key: keyof SupplierInput) => ({
    id: `${formId}-${key}`,
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${formId}-${key}-error` : undefined,
  });
  const error = (key: keyof SupplierInput) => (errors[key] ? <p id={`${formId}-${key}-error`} className="text-xs text-destructive">{errors[key]}</p> : null);

  return (
    <>
      {editing ? (
        <Button type="button" variant="outline" className="rounded-full" onClick={() => openDrawer(true)}>
          <Pencil className="size-4" aria-hidden="true" />Edit
        </Button>
      ) : (
        <Button type="button" className="rounded-full" onClick={() => openDrawer(true)}>
          <Plus className="size-4" aria-hidden="true" />New supplier
        </Button>
      )}
      <Sheet open={open} onOpenChange={(next) => (pending ? undefined : openDrawer(next))}>
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-md">
          <form onSubmit={submit} noValidate className="flex flex-1 flex-col gap-5">
            <SheetHeader>
              <SheetTitle>{editing ? "Edit supplier" : "New supplier"}</SheetTitle>
              <SheetDescription className="sr-only">{editing ? "Edit supplier" : "New supplier"}</SheetDescription>
            </SheetHeader>

            <div className="space-y-1.5">
              <Label htmlFor={`${formId}-name`}>Name</Label>
              <Input {...field("name")} value={draft.name} onChange={(event) => update("name", event.target.value)} maxLength={200} required />
              {error("name")}
            </div>

            <div className="space-y-1.5">
              <span id={`${formId}-status`} className="text-sm font-medium">Status</span>
              <PillTrack label="Status">
                {SUPPLIER_STATUSES.map((status) => (
                  <PillButton key={status} active={draft.status === status} onClick={() => update("status", status)}>
                    {SUPPLIER_STATUS[status].label}
                  </PillButton>
                ))}
              </PillTrack>
              {error("status")}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${formId}-contactName`}>Contact</Label>
              <Input {...field("contactName")} value={draft.contactName} onChange={(event) => update("contactName", event.target.value)} maxLength={200} autoComplete="off" />
              {error("contactName")}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`${formId}-email`}>Email</Label>
                <Input {...field("email")} type="email" inputMode="email" value={draft.email} onChange={(event) => update("email", event.target.value)} autoComplete="off" />
                {error("email")}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${formId}-phone`}>Phone</Label>
                <Input {...field("phone")} type="tel" value={draft.phone} onChange={(event) => update("phone", event.target.value)} autoComplete="off" />
                {error("phone")}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <div className="space-y-1.5">
                <Label htmlFor={`${formId}-website`}>Website</Label>
                <Input {...field("website")} type="url" inputMode="url" placeholder="https://" value={draft.website} onChange={(event) => update("website", event.target.value)} autoComplete="off" />
                {error("website")}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`${formId}-leadTimeDays`}>Lead time (days)</Label>
                <Input {...field("leadTimeDays")} inputMode="numeric" value={draft.leadTimeDays} onChange={(event) => update("leadTimeDays", event.target.value)} />
                {error("leadTimeDays")}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor={`${formId}-notes`}>Notes</Label>
              <Textarea {...field("notes")} rows={4} value={draft.notes} onChange={(event) => update("notes", event.target.value)} maxLength={5000} />
              {error("notes")}
            </div>

            {formError ? <p role="alert" className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-sm text-destructive">{formError}</p> : null}

            <SheetFooter className="mt-auto flex-row justify-end gap-2">
              <Button type="button" variant="ghost" className="rounded-full" onClick={() => openDrawer(false)} disabled={pending}>Cancel</Button>
              <Button type="submit" className="rounded-full" disabled={pending}>{pending ? "Saving…" : editing ? "Save" : "Create supplier"}</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
