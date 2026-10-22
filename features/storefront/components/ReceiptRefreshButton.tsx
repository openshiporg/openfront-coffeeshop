"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { RotateCcw } from "lucide-react";

/** Re-reads this same receipt (same order id and receipt link); it never sends a new order or payment. */
export function ReceiptRefreshButton({ label = "Refresh status" }: { label?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button type="button" className="sf-btn" disabled={pending} onClick={() => startTransition(() => router.refresh())}>
      <RotateCcw className="size-4" aria-hidden="true" />
      {pending ? "Refreshing…" : label}
    </button>
  );
}
