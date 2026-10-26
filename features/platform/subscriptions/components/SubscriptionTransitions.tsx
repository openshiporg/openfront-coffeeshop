"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { transitionSubscriptionAction } from "../actions/subscriptions";
import { SUBSCRIPTION_NEXT, transitionLabel } from "../lib/subscriptions";

export function SubscriptionTransitions({ subscriptionId, status }: { subscriptionId: string; status: string }) {
  const router = useRouter();
  const [pending, setPending] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = React.useState(false);
  const next = SUBSCRIPTION_NEXT[status] || [];
  if (!next.length) return null;

  async function run(target: string) {
    setPending(target);
    setError(null);
    const result = await transitionSubscriptionAction(subscriptionId, target);
    setPending(null);
    setConfirmCancel(false);
    if (!result.success) { setError(result.error); return; }
    router.refresh();
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-2">
        {next.filter((target) => target !== "cancelled").map((target) => (
          <Button key={target} className="rounded-[6px]" variant={target === "paused" ? "outline" : "default"} disabled={Boolean(pending)} onClick={() => run(target)}>
            {pending === target ? "Saving…" : transitionLabel(status, target)}
          </Button>
        ))}
        {next.includes("cancelled") ? (
          <Button variant="outline" className="rounded-[6px] text-destructive" disabled={Boolean(pending)} onClick={() => setConfirmCancel(true)}>Cancel subscription</Button>
        ) : null}
      </div>
      <p role="alert" aria-live="assertive" className={error ? "text-sm text-destructive" : "sr-only"}>{error || ""}</p>
      <AlertDialog open={confirmCancel} onOpenChange={setConfirmCancel}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this subscription?</AlertDialogTitle>
            <AlertDialogDescription>Cancelled subscriptions can't be resumed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={pending === "cancelled"}>Keep subscription</AlertDialogCancel>
            <AlertDialogAction
              disabled={pending === "cancelled"}
              onClick={(event) => { event.preventDefault(); void run("cancelled"); }}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              {pending === "cancelled" ? "Cancelling…" : "Cancel subscription"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
