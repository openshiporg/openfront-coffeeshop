"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { refundGiftCardAction } from "../actions/gift-cards";

/** Refunds an unused gift card to the buyer's card on Stripe and cancels the code. */
export function RefundGiftCardButton({ giftCardId, code, amountLabel }: { giftCardId: string; code: string; amountLabel: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  async function refund() {
    setPending(true);
    setError(null);
    const response = await refundGiftCardAction(giftCardId, "Gift card refunded by staff");
    setPending(false);
    if (!response.success) return setError(response.error);
    setOpen(false);
    router.refresh();
  }
  return (
    <>
      <Button type="button" size="sm" variant="ghost" className="h-8 rounded-[6px] text-destructive hover:text-destructive" onClick={() => { setError(null); setOpen(true); }}>Refund</Button>
      <Dialog open={open} onOpenChange={(next) => { if (!pending) setOpen(next); }}>
        <DialogContent className="rounded-[6px]">
          <DialogHeader>
            <DialogTitle>Refund gift card {code}</DialogTitle>
            <DialogDescription>Returns {amountLabel} to the card it was bought with and cancels the code. This cannot be undone.</DialogDescription>
          </DialogHeader>
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
          <DialogFooter>
            <Button type="button" variant="outline" className="rounded-[6px]" disabled={pending} onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" variant="destructive" className="rounded-[6px]" disabled={pending} onClick={refund}>{pending ? "Refunding…" : `Refund ${amountLabel}`}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
