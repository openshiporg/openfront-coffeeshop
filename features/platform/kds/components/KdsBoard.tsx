"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";
import { formatStaffPickupTime } from "@/lib/date-time";
import { PillButton, PillTrack } from "@/features/platform/components/PillTabs";
import { StatusDot, type StatusTone } from "@/features/platform/components/StatusTitle";

import { updateKdsItemAction } from "../actions/update-kds-item";
import { createKdsRecovery, type KdsRecoveryScope } from "../lib/commandRecovery";
import type { KdsOrderItem } from "../types";

const STATIONS = ["espresso_bar", "cold_bar", "brew_bar", "pastry_case", "retail_shelf"];
const emptyRecovery = { ready: false, pending: [], busy: null, error: null };
const noSubscription = () => () => {};
const emptySnapshot = () => emptyRecovery;

const BAR_STATUS_TONES: Record<string, StatusTone> = { new: "blue", queued: "amber", preparing: "orange", ready: "green", handed_off: "zinc", voided: "red" };

function stationLabel(station: string) {
  return station.replaceAll("_", " ");
}

// Minutes since an instant, ticking on the client only so server and client markup match.
function useNow() {
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(interval);
  }, []);
  return now;
}

function minutesSince(value: string | null | undefined, now: number | null) {
  if (!value || now === null) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? Math.max(0, Math.floor((now - time) / 60000)) : null;
}

const quietButton = "inline-flex min-h-10 items-center justify-center rounded-full border border-border bg-background px-4 text-sm font-medium hover:bg-muted disabled:opacity-50";

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

  const now = useNow();
  const [stationFilter, setStationFilter] = React.useState<string | null>(null);
  const allStations = [...new Set([...STATIONS, ...items.map((item) => item.station || "unassigned")])]
    .map((station) => ({ station, items: items.filter((item) => (item.station || "unassigned") === station) }))
    .filter((group) => group.items.length > 0);
  const stations = stationFilter && allStations.some((group) => group.station === stationFilter)
    ? allStations.filter((group) => group.station === stationFilter)
    : allStations;

  async function bump(item: KdsOrderItem) {
    if (!canManageOrders || !recovery) return;
    await recovery.start(item);
  }

  // Original-command recovery is outside the active station/page/nextAction tree.
  const recoveryPanel = recovery && (recoveryState.pending.length > 0 || !recoveryState.ready) ? (
    <section aria-labelledby="kds-pending-updates" className="space-y-3 rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
      <h2 id="kds-pending-updates" className="font-semibold">Unconfirmed updates</h2>
      <p className="text-muted-foreground">Confirming resends the same update; it won&apos;t apply twice.</p>
      {!recoveryState.ready && <button type="button" onClick={() => recovery.restore()} className={quietButton}>Recheck saved updates</button>}
      {recoveryState.pending.map((original) => (
        <div key={original.command.idempotencyKey} className="flex flex-wrap items-center justify-between gap-3 border-t border-amber-500/20 pt-3">
          <span className="min-w-0 [overflow-wrap:anywhere]">{items.find((item) => item.id === original.command.orderItemId)?.itemNameSnapshot ?? "Kitchen item"} · <span className="capitalize">{original.command.expectedStatus.replaceAll("_", " ")}</span> to <span className="capitalize">{original.command.status.replaceAll("_", " ")}</span></span>
          <button type="button" disabled={!canManageOrders || !recoveryState.ready || pendingId !== null} onClick={() => recovery.retry(original)} className={quietButton}>
            {pendingId === original.command.orderItemId ? "Confirming…" : "Confirm update"}
          </button>
        </div>
      ))}
    </section>
  ) : null;

  const pagination = (cursor || hasMore || (!allStations.length && activeCount > 0)) ? (
    <nav aria-label="Kitchen queue pages" className="flex flex-wrap items-center justify-between gap-3 text-sm">
      <p className="text-muted-foreground">100 per page · oldest first</p>
      <div className="flex flex-wrap gap-2">
        {cursor && <Link href="/dashboard/platform/kds" className={quietButton}>Oldest items</Link>}
        {!cursor && !hasMore && activeCount > 0 && <Link href="/dashboard/platform/kds" className={quietButton}>Reload oldest items</Link>}
        {hasMore && nextCursor && <Link href={`?cursor=${encodeURIComponent(nextCursor)}`} className="inline-flex min-h-10 items-center rounded-full bg-primary px-4 font-medium text-primary-foreground">Next 100</Link>}
      </div>
    </nav>
  ) : null;

  const errorBanner = error ? <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null;

  if (loadUnavailable || !allStations.length) {
    return (
      <div className="space-y-4">
        {errorBanner}
        <div role="status" aria-live="polite" className="rounded-2xl border border-dashed border-border px-6 py-16 text-center text-muted-foreground">
          {loadUnavailable ? "Kitchen queue unavailable. Refresh to try again." : activeCount === 0 ? "No items to prepare." : cursor ? "No active items on this page." : "Active items didn't load. Reload the oldest items."}
        </div>
        {recoveryPanel}
        {!loadUnavailable && pagination}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {errorBanner}
      {recoveryPanel}
      {allStations.length > 1 ? (
        <PillTrack label="Station">
          <PillButton size="md" active={stations.length === allStations.length} count={items.length} onClick={() => setStationFilter(null)}>All</PillButton>
          {allStations.map((group) => (
            <PillButton key={group.station} size="md" className="capitalize" active={stationFilter === group.station} count={group.items.length} onClick={() => setStationFilter(group.station)}>
              {stationLabel(group.station)}
            </PillButton>
          ))}
        </PillTrack>
      ) : null}
      <div className="grid items-start gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {stations.map((group) => (
          <section key={group.station} aria-labelledby={`station-${group.station}`} className="overflow-hidden rounded-2xl bg-muted/60 ring-1 ring-inset ring-foreground/5">
            <header className="flex items-center justify-between px-4 py-3">
              <h2 id={`station-${group.station}`} className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">{stationLabel(group.station)}</h2>
              <span className="rounded-full bg-background px-2.5 py-0.5 font-mono text-sm font-semibold tabular-nums shadow-sm ring-1 ring-foreground/10">{group.items.length}</span>
            </header>
            <div className="space-y-2 px-2 pb-2">
              {group.items.map((item) => {
                const next = canManageOrders && recoveryScope ? item.nextAction : null;
                const unresolved = recoveryState.pending.some((pending) => pending.command.orderItemId === item.id);
                const waited = minutesSince(item.queuedAt || item.startedAt, now);
                const promised = item.order.promisedAt ? new Date(item.order.promisedAt).getTime() : null;
                const late = now !== null && promised !== null && Number.isFinite(promised) && now > promised && item.barStatus !== "ready";
                // A ticket with a pickup time counts down to it; an ASAP ticket counts up from when it was queued.
                const dueIn = now !== null && promised !== null && Number.isFinite(promised) && !late ? Math.max(0, Math.ceil((promised - now) / 60000)) : null;
                const lateBy = late && now !== null && promised !== null ? Math.floor((now - promised) / 60000) : null;
                return (
                  <article key={item.id} className={`rounded-xl bg-card p-4 text-card-foreground shadow-sm ring-1 ${item.order.isRush ? "ring-red-500/40" : "ring-foreground/10"}`}>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2">
                        <span className="min-w-0 truncate font-mono font-semibold" title={`#${item.order.orderNumber}`}>#{item.order.orderNumber}</span>
                        {item.order.isRush && <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400"><Zap className="size-3" aria-hidden="true" />Rush</span>}
                      </span>
                      <span className={`shrink-0 font-mono tabular-nums ${late ? "font-semibold text-red-600 dark:text-red-400" : "text-muted-foreground"}`}>
                        {lateBy !== null ? `Late · ${lateBy}m` : dueIn !== null ? `Due in ${dueIn}m` : waited !== null ? `${waited}m` : ""}
                      </span>
                    </div>
                    <h3 className="mt-2 flex items-start gap-2.5 text-xl font-semibold leading-tight tracking-tight">
                      <span className="inline-flex h-[1lh] shrink-0 items-center"><StatusDot tone={BAR_STATUS_TONES[item.barStatus] || "zinc"} className="translate-y-0" /></span>
                      <span className="min-w-0 [overflow-wrap:anywhere]"><span className="font-mono">{item.quantity}×</span> {item.itemNameSnapshot}</span>
                    </h3>
                    <p className="mt-1 pl-[1.125rem] text-sm text-muted-foreground"><span className="capitalize">{item.barStatus.replaceAll("_", " ")}</span> · {item.order.pickupName || "Guest"} · {item.order.promisedAt ? formatStaffPickupTime(item.order.promisedAt, storeTimezone) : "ASAP"}</p>
                    {item.customizationsSummary && <p className="mt-3 text-base font-medium leading-snug [overflow-wrap:anywhere]">{item.customizationsSummary}</p>}
                    {item.specialInstructions && <p className="mt-2 rounded-lg bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-900 dark:text-amber-200 [overflow-wrap:anywhere]">{item.specialInstructions}</p>}
                    {next && (
                      <button
                        type="button"
                        disabled={pendingId !== null || !recoveryState.ready}
                        onClick={() => bump(item)}
                        className="mt-4 min-h-12 w-full rounded-full bg-primary px-4 text-base font-semibold text-primary-foreground shadow-sm transition-transform active:scale-[0.98] disabled:opacity-50"
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
