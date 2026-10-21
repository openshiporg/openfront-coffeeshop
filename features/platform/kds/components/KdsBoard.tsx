"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { formatPickupTime } from "@/lib/date-time";

import { updateKdsItemAction } from "../actions/update-kds-item";
import { createKdsRecovery, type KdsRecoveryScope } from "../lib/commandRecovery";
import type { KdsOrderItem } from "../types";

const STATIONS = ["espresso_bar", "cold_bar", "brew_bar", "pastry_case", "retail_shelf"];
const emptyRecovery = { ready: false, pending: [], busy: null, error: null };
const noSubscription = () => () => {};
const emptySnapshot = () => emptyRecovery;

function stationLabel(station: string) {
  return station.replaceAll("_", " ");
}

export function KdsBoard({
  items,
  activeCount,
  canManageOrders,
  storeTimezone,
  cursor,
  hasMore,
  nextCursor,
  recoveryScope,
  loadUnavailable = false,
}: {
  items: KdsOrderItem[];
  activeCount: number;
  canManageOrders: boolean;
  storeTimezone: string | null;
  cursor: string | null;
  hasMore: boolean;
  nextCursor?: string | null;
  recoveryScope: KdsRecoveryScope | null;
  loadUnavailable?: boolean;
}) {
  const router = useRouter();
  const actorId = recoveryScope?.actorId;
  const storeId = recoveryScope?.storeId;
  const recovery = React.useMemo(() => actorId && storeId ? createKdsRecovery({ actorId, storeId }, {
    storage: () => window.sessionStorage,
    dispatch: updateKdsItemAction,
    newKey: () => crypto.randomUUID(),
    onVerified: () => router.refresh(),
  }) : null, [actorId, storeId, router]);
  const recoveryState = React.useSyncExternalStore(recovery?.subscribe ?? noSubscription, recovery?.getSnapshot ?? emptySnapshot, recovery?.getServerSnapshot ?? emptySnapshot);
  const pendingId = recoveryState.busy;
  const error = recoveryState.error;

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible" && pendingId === null) router.refresh();
    }, 5000);
    return () => window.clearInterval(interval);
  }, [pendingId, router]);

  const stations = [...new Set([...STATIONS, ...items.map((item) => item.station || "unassigned")])]
    .map((station) => ({ station, items: items.filter((item) => (item.station || "unassigned") === station) }))
    .filter((group) => group.items.length > 0);

  async function bump(item: KdsOrderItem) {
    if (!canManageOrders || !recovery) return;
    await recovery.start(item);
  }

  // Original-command recovery is outside the active station/page/nextAction tree.
  const recoveryPanel = recovery && (recoveryState.pending.length > 0 || !recoveryState.ready) ? (
    <section aria-labelledby="kds-pending-updates" className="space-y-3 border border-border bg-card p-4 text-sm text-card-foreground">
      <h2 id="kds-pending-updates" className="font-semibold">Updates waiting for confirmation</h2>
      <p className="text-muted-foreground">These updates were sent but not confirmed, and may already be saved. Confirming resends the same update, so it won&apos;t be applied twice.</p>
      {!recoveryState.ready && <button type="button" onClick={() => recovery.restore()} className="border border-border px-3 py-2">Recheck saved updates</button>}
      {recoveryState.pending.map((original) => (
        <div key={original.command.idempotencyKey} className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
          <span>{items.find((item) => item.id === original.command.orderItemId)?.itemNameSnapshot ?? "Kitchen item"} · {original.command.expectedStatus.replaceAll("_", " ")} → {original.command.status.replaceAll("_", " ")}</span>
          <button type="button" disabled={!canManageOrders || !recoveryState.ready || pendingId !== null} onClick={() => recovery.retry(original)} className="border border-border px-3 py-2 font-medium disabled:opacity-50">
            {pendingId === original.command.orderItemId ? "Confirming…" : "Confirm update"}
          </button>
        </div>
      ))}
    </section>
  ) : null;

  const pagination = (cursor || hasMore || (!stations.length && activeCount > 0)) ? (
    <nav aria-label="Kitchen queue pages" className="flex flex-col gap-3 border border-border bg-card p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="text-muted-foreground">Showing up to 100 items per page, oldest first.</p>
      <div className="flex flex-wrap gap-2">
        {cursor && <Link href="/dashboard/platform/kds" className="border border-border px-3 py-2 font-medium">Return to oldest items</Link>}
        {!cursor && !hasMore && activeCount > 0 && <Link href="/dashboard/platform/kds" className="border border-border px-3 py-2 font-medium">Refresh oldest items</Link>}
        {hasMore && nextCursor && <Link href={`?cursor=${encodeURIComponent(nextCursor)}`} className="bg-primary px-3 py-2 font-medium text-primary-foreground">Next 100 items</Link>}
      </div>
    </nav>
  ) : null;

  if (loadUnavailable || !stations.length) {
    return (
      <div className="space-y-4">
        {error && <p role="alert" className="border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        <div role="status" aria-live="polite" className="border border-dashed border-border p-10 text-center text-muted-foreground">
          {loadUnavailable ? "The kitchen queue couldn't load, so tickets may be missing. Refresh to try again." : activeCount === 0 ? "No items to prepare. New tickets appear here by station." : cursor ? "No active items remain on this page. The queue may have changed; return to the oldest items." : "There are active items, but none loaded on this refresh. Reload the oldest items."}
        </div>
        {recoveryPanel}
        {!loadUnavailable && pagination}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
      {recoveryPanel}
      {pagination}
      <div className="grid items-start gap-4 xl:grid-cols-2 2xl:grid-cols-3">
        {stations.map((group) => (
          <section key={group.station} aria-labelledby={`station-${group.station}`} className="border border-border bg-muted/20">
            <header className="flex items-center justify-between border-b border-border bg-primary px-4 py-3 text-primary-foreground">
              <h2 id={`station-${group.station}`} className="font-semibold capitalize">{stationLabel(group.station)}</h2>
              <span className="font-mono text-sm">{group.items.length}</span>
            </header>
            <div className="divide-y divide-border">
              {group.items.map((item) => {
                const next = canManageOrders && recoveryScope ? item.nextAction : null;
                const unresolved = recoveryState.pending.some((pending) => pending.command.orderItemId === item.id);
                return (
                  <article key={item.id} className="bg-card p-4 text-card-foreground">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-xs text-muted-foreground">#{item.order.orderNumber}</span>
                          {item.order.isRush && <span className="bg-destructive/10 px-2 py-0.5 text-xs font-semibold text-destructive">Rush</span>}
                        </div>
                        <h3 className="mt-2 flex flex-wrap items-center gap-2 text-lg font-semibold"><span className="size-2 rounded-full bg-primary" aria-hidden="true" />{item.quantity}× {item.itemNameSnapshot}<span className="text-xs font-medium capitalize text-muted-foreground">{item.barStatus.replaceAll("_", " ")}</span></h3>
                        <p className="text-sm text-muted-foreground">{item.order.pickupName || "Guest"} · due {item.order.promisedAt ? formatPickupTime(item.order.promisedAt, storeTimezone) : "ASAP"}</p>
                      </div>
                    </div>
                    {item.customizationsSummary && <p className="mt-3 border-l-2 border-primary pl-3 text-sm">{item.customizationsSummary}</p>}
                    {item.specialInstructions && <p className="mt-2 bg-muted p-2 text-sm font-medium text-foreground">Note: {item.specialInstructions}</p>}
                    {next && (
                      <button
                        type="button"
                        disabled={pendingId !== null || !recoveryState.ready}
                        onClick={() => bump(item)}
                        className="mt-4 w-full bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground disabled:opacity-50"
                      >
                        {pendingId === item.id ? "Updating…" : unresolved ? "Retry original update" : next.label}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          </section>
        ))}
      </div>
      {pagination}
    </div>
  );
}
