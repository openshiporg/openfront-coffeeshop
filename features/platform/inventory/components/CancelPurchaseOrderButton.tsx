"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cancelPurchaseOrder } from "../actions/inventory";

export function CancelPurchaseOrderButton({ purchaseOrderId, poNumber, revalidate }: { purchaseOrderId: string; poNumber: string | null; revalidate: string[] }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [pending, startTransition] = React.useTransition();
  const reasonId = React.useId();

  function confirm() {
    setError(null);
    startTransition(async () => {
      const result = await cancelPurchaseOrder(purchaseOrderId, reason, revalidate);
      if (!result.success) {
        setError(result.error);
        return;
      }
      setOpen(false);
      setReason("");
      router.refresh();
    });
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" className="rounded-[6px]" onClick={() => { setError(null); setOpen(true); }}>
        Cancel PO
      </Button>
      <Dialog open={open} onOpenChange={(next) => (pending ? undefined : setOpen(next))}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel {poNumber || "purchase order"}?</DialogTitle>
            <DialogDescription className="sr-only">Cancel purchase order</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor={reasonId}>Reason</Label>
            <Textarea id={reasonId} value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={3} />
          </div>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter className="flex-row justify-end gap-2">
            <Button type="button" variant="ghost" className="rounded-[6px]" onClick={() => setOpen(false)} disabled={pending}>Keep</Button>
            <Button type="button" variant="destructive" className="rounded-[6px]" onClick={confirm} disabled={pending}>{pending ? "Cancelling…" : "Cancel PO"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
