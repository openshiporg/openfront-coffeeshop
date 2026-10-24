"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { deleteSupplier, setSupplierStatus } from "../actions/suppliers";
import { SUPPLIERS_PATH } from "../lib/suppliers";

const TRANSITIONS: Record<string, Array<{ status: string; label: string }>> = {
  active: [{ status: "paused", label: "Pause" }, { status: "archived", label: "Archive" }],
  paused: [{ status: "active", label: "Activate" }, { status: "archived", label: "Archive" }],
  archived: [{ status: "active", label: "Activate" }],
};

export function SupplierStatusActions({ id, name, status, canDelete }: { id: string; name: string; status: string; canDelete: boolean }) {
  const router = useRouter();
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  function move(next: string) {
    setError(null);
    startTransition(async () => {
      const result = await setSupplierStatus(id, next);
      if (!result.success) setError(result.error);
      else router.refresh();
    });
  }

  function remove() {
    setDeleteError(null);
    startTransition(async () => {
      const result = await deleteSupplier(id);
      if (!result.success) {
        setDeleteError(result.error);
        return;
      }
      setConfirmDelete(false);
      router.push(SUPPLIERS_PATH);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {(TRANSITIONS[status] ?? TRANSITIONS.active).map((transition) => (
        <Button key={transition.status} type="button" variant="outline" className="rounded-full" disabled={pending} onClick={() => move(transition.status)}>
          {transition.label}
        </Button>
      ))}
      {canDelete ? (
        <Button type="button" variant="ghost" className="rounded-full text-destructive hover:text-destructive" disabled={pending} onClick={() => { setDeleteError(null); setConfirmDelete(true); }}>
          Delete
        </Button>
      ) : null}
      {error ? <p role="alert" className="basis-full text-sm text-destructive">{error}</p> : null}
      <Dialog open={confirmDelete} onOpenChange={(next) => (pending ? undefined : setConfirmDelete(next))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete {name}?</DialogTitle>
            <DialogDescription className="sr-only">Delete supplier</DialogDescription>
          </DialogHeader>
          {deleteError ? <p role="alert" className="text-sm text-destructive">{deleteError}</p> : null}
          <DialogFooter className="flex-row justify-end gap-2">
            <Button type="button" variant="ghost" className="rounded-full" onClick={() => setConfirmDelete(false)} disabled={pending}>Keep</Button>
            <Button type="button" variant="destructive" className="rounded-full" onClick={remove} disabled={pending}>{pending ? "Deleting…" : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
