"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { MoreHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
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

  const transitions = TRANSITIONS[status] ?? TRANSITIONS.active;
  // Pause / Activate stay visible; Archive and Delete are rarer and final, so they sit last in a menu.
  const primary = transitions.filter((transition) => transition.status !== "archived");
  const archive = transitions.find((transition) => transition.status === "archived");

  return (
    <div className="flex flex-wrap items-center gap-2">
      {primary.map((transition) => (
        <Button key={transition.status} type="button" variant="outline" className="rounded-[6px] active:scale-[0.97]" disabled={pending} onClick={() => move(transition.status)}>
          {pending ? "Saving…" : transition.label}
        </Button>
      ))}
      {archive || canDelete ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="size-9 rounded-[6px] active:scale-[0.97]" disabled={pending} aria-label="More supplier actions">
              <MoreHorizontal className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="rounded-[6px]">
            {archive ? <DropdownMenuItem className="rounded-[4px]" onSelect={() => move(archive.status)}>{archive.label}</DropdownMenuItem> : null}
            {archive && canDelete ? <DropdownMenuSeparator /> : null}
            {canDelete ? (
              <DropdownMenuItem variant="destructive" className="rounded-[4px]" onSelect={() => { setDeleteError(null); setConfirmDelete(true); }}>
                Delete supplier
              </DropdownMenuItem>
            ) : null}
          </DropdownMenuContent>
        </DropdownMenu>
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
            <Button type="button" variant="ghost" className="rounded-[6px]" onClick={() => setConfirmDelete(false)} disabled={pending}>Keep</Button>
            <Button type="button" variant="destructive" className="rounded-[6px]" onClick={remove} disabled={pending}>{pending ? "Deleting…" : "Delete"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
