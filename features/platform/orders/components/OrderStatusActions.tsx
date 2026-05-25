"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { updateCafeOrderStatusAction } from "../actions/order-status";

const nextActions: Record<string, Array<{ label: string; status: string; tone?: string }>> = {
  open: [{ label: "Mark paid", status: "paid" }, { label: "Cancel", status: "cancelled", tone: "danger" }],
  paid: [{ label: "Send to queue", status: "in_bar_queue" }, { label: "Start", status: "preparing" }],
  in_bar_queue: [{ label: "Start", status: "preparing" }, { label: "Ready", status: "ready" }],
  preparing: [{ label: "Ready", status: "ready" }],
  ready: [{ label: "Handed off", status: "completed" }],
};

export function OrderStatusActions({ orderId, status }: { orderId: string; status: string }) {
  const router = useRouter();
  const [pendingStatus, setPendingStatus] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const actions = nextActions[status] || [];

  if (!actions.length) return null;

  async function run(nextStatus: string) {
    setPendingStatus(nextStatus);
    setError(null);
    const response = await updateCafeOrderStatusAction(orderId, nextStatus);
    setPendingStatus(null);
    if (!response.success) {
      setError(response.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-4 space-y-2">
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => (
          <button
            key={action.status}
            type="button"
            disabled={Boolean(pendingStatus)}
            onClick={() => run(action.status)}
            className={`rounded-full px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${
              action.tone === "danger"
                ? "bg-red-50 text-red-700 hover:bg-red-100"
                : "bg-stone-950 text-white hover:bg-amber-900"
            }`}
          >
            {pendingStatus === action.status ? "Updating…" : action.label}
          </button>
        ))}
      </div>
      {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
