"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Archive, CircleCheck, FilePen } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { findActiveConflictsAction, setRecipeStatusAction } from "../actions/recipes";
import type { RecipeStatus } from "../lib/recipeTypes";

type Conflict = { id: string; name: string | null };

export function RecipeStatusActions({
  recipeId,
  status,
  menuItemName,
  ingredientCount,
  canManage,
}: {
  recipeId: string;
  status: RecipeStatus;
  menuItemName: string | null;
  ingredientCount: number;
  canManage: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = React.useState<RecipeStatus | "archive-others" | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [conflicts, setConflicts] = React.useState<Conflict[] | null>(null);
  const [dialogError, setDialogError] = React.useState<string | null>(null);

  if (!canManage) return null;

  async function move(next: RecipeStatus) {
    setPending(next);
    setError(null);
    if (next === "active") {
      const check = await findActiveConflictsAction(recipeId);
      if (!check.success) { setPending(null); return setError(check.error); }
      if (check.data?.length) { setPending(null); setDialogError(null); return setConflicts(check.data); }
    }
    const response = await setRecipeStatusAction(recipeId, next);
    setPending(null);
    if (!response.success) return setError(response.error);
    router.refresh();
  }

  /** Two explicit writes: archive each other active recipe, then activate this one. */
  async function archiveOthersAndActivate() {
    if (!conflicts) return;
    setPending("archive-others");
    setDialogError(null);
    for (const conflict of conflicts) {
      const archived = await setRecipeStatusAction(conflict.id, "archived");
      if (!archived.success) {
        setPending(null);
        router.refresh();
        return setDialogError(`${conflict.name || "Other recipe"} not archived: ${archived.error}`);
      }
    }
    const activated = await setRecipeStatusAction(recipeId, "active");
    setPending(null);
    router.refresh();
    if (!activated.success) return setDialogError(`Other recipe archived. This recipe not activated: ${activated.error}`);
    setConflicts(null);
  }

  const busy = pending !== null;
  const canActivate = ingredientCount > 0;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {status !== "active" ? (
          <Button type="button" className="rounded-full" disabled={busy || !canActivate} title={canActivate ? undefined : "Add an ingredient first"} onClick={() => move("active")}>
            <CircleCheck className="size-4" aria-hidden="true" />
            {pending === "active" ? "Activating…" : "Activate"}
          </Button>
        ) : null}
        {status !== "draft" ? (
          <Button type="button" variant="outline" className="rounded-full" disabled={busy} onClick={() => move("draft")}>
            <FilePen className="size-4" aria-hidden="true" />
            {pending === "draft" ? "Moving…" : "Move to draft"}
          </Button>
        ) : null}
        {status !== "archived" ? (
          <Button type="button" variant="ghost" className="rounded-full text-destructive" disabled={busy} onClick={() => move("archived")}>
            <Archive className="size-4" aria-hidden="true" />
            {pending === "archived" ? "Archiving…" : "Archive"}
          </Button>
        ) : null}
      </div>
      <p role="alert" aria-live="assertive" className={error ? "text-sm text-destructive" : "sr-only"}>{error || ""}</p>

      <Dialog open={Boolean(conflicts)} onOpenChange={(open) => { if (!open && !busy) setConflicts(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{menuItemName ? `${menuItemName} already has an active recipe` : "Another recipe is active"}</DialogTitle>
            <DialogDescription className="sr-only">Active recipes for this menu item</DialogDescription>
          </DialogHeader>
          <ul className="divide-y rounded-md border text-sm">
            {(conflicts ?? []).map((conflict) => <li key={conflict.id} className="px-3 py-2 font-medium">{conflict.name || "Untitled"}</li>)}
          </ul>
          <p role="alert" aria-live="assertive" className={dialogError ? "text-sm text-destructive" : "sr-only"}>{dialogError || ""}</p>
          <DialogFooter className="gap-2">
            <Button type="button" variant="ghost" className="rounded-full" disabled={busy} onClick={() => setConflicts(null)}>Cancel</Button>
            <Button type="button" className="rounded-full" disabled={busy} onClick={archiveOthersAndActivate}>
              {pending === "archive-others" ? "Updating…" : conflicts && conflicts.length > 1 ? `Archive ${conflicts.length} and activate` : "Archive it and activate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
