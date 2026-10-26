"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Zap } from "lucide-react";
import { formatStaffPickupTime } from "@/lib/date-time";
import { PillButton, PillTrack } from "@/features/platform/components/PillTabs";
import { StatusDot, type StatusTone } from "@/features/platform/components/StatusTitle";
import { minutesSince, TicketAge, useNow, formatAge } from "../lib/ticketAge";

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

const quietButton = "inline-flex min-h-10 items-center justify-center rounded-[6px] border border-border bg-background px-4 text-sm font-medium transition-[background-color,transform] duration-150 ease-out hover:bg-muted active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50";

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
  scheduledCount = 0,
  nextScheduledAt = null,
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
  scheduledCount?: number;
  nextScheduledAt?: string | null;
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
    <section aria-labelledby="kds-pending-updates" className="space-y-3 rounded-[6px] border border-amber-500/50 bg-amber-500/5 p-4 text-sm">
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
    <nav aria-label="Kitchen queue pages" className="flex flex-wrap items-center justify-between gap-3 border-t pt-3 text-sm">
      <p className="text-muted-foreground">100 per page · oldest first</p>
      <div className="flex flex-wrap gap-2">
        {cursor && <Link href="/dashboard/platform/kds" className={quietButton}>Oldest items</Link>}
        {!cursor && !hasMore && activeCount > 0 && <Link href="/dashboard/platform/kds" className={quietButton}>Reload oldest items</Link>}
        {hasMore && nextCursor && <Link href={`?cursor=${encodeURIComponent(nextCursor)}`} className="inline-flex min-h-10 items-center rounded-[6px] bg-foreground px-4 text-sm font-medium text-background transition-[opacity,transform] duration-150 ease-out hover:opacity-90 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">Next 100</Link>}
      </div>
    </nav>
  ) : null;

  const errorBanner = error ? <p role="alert" className="rounded-[6px] border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null;

  const nextScheduled = nextScheduledAt ? formatStaffPickupTime(nextScheduledAt, storeTimezone) : null;
  const scheduledLine = scheduledCount > 0 ? (
    <p className="flex flex-wrap items-baseline gap-x-2 text-sm">
      <span className="font-medium">Next scheduled</span>
      {nextScheduled ? <span className="tabular-nums">· {nextScheduled}</span> : null}
      {scheduledCount > 1 ? <span className="tabular-nums text-muted-foreground">· {scheduledCount} scheduled</span> : null}
    </p>
  ) : null;

  if (loadUnavailable || !allStations.length) {
    const message = loadUnavailable ? "Kitchen queue unavailable. Refresh to try again." : activeCount === 0 ? "Bar is clear." : cursor ? "No active items on this page." : "Active items didn't load. Reload the oldest items.";
    return (
      <div className="space-y-4">
        {errorBanner}
        <div role="status" aria-live="polite" className="flex flex-col gap-2 rounded-[6px] border bg-background px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
          <p className={`text-base font-semibold ${loadUnavailable ? "text-destructive" : ""}`}>{message}</p>
          {!loadUnavailable ? scheduledLine : null}
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
      {scheduledLine ? <div className="border-b pb-3">{scheduledLine}</div> : null}
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
      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-[repeat(auto-fit,minmax(18rem,1fr))]">
        {stations.map((group) => (
          <section key={group.station} aria-labelledby={`station-${group.station}`} className="min-w-0">
            <header className="flex items-baseline justify-between border-b-2 border-foreground pb-2">
              <h2 id={`station-${group.station}`} className="text-sm font-semibold capitalize">{stationLabel(group.station)}</h2>
              <span className="text-sm font-semibold tabular-nums">{group.items.length}</span>
            </header>
            <ol className="mt-3 space-y-3">
              {group.items.map((item) => {
                const next = canManageOrders && recoveryScope ? item.nextAction : null;
                const unresolved = recoveryState.pending.some((pending) => pending.command.orderItemId === item.id);
                const waited = minutesSince(item.queuedAt || item.startedAt, now);
                const promised = item.order.promisedAt ? new Date(item.order.promisedAt).getTime() : null;
                const late = now !== null && promised !== null && Number.isFinite(promised) && now > promised && item.barStatus !== "ready";
                // A ticket with a pickup time counts down to it; an ASAP ticket counts up from when it was queued.
                const dueIn = now !== null && promised !== null && Number.isFinite(promised) && !late ? Math.max(0, Math.ceil((promised - now) / 60000)) : null;
                const lateBy = late && now !== null && promised !== null ? Math.floor((now - promised) / 60000) : null;
                const ageMinutes = lateBy !== null ? Math.max(15, waited ?? 0) : waited;
                const ageLabel = lateBy !== null ? `Late ${formatAge(lateBy)}` : dueIn !== null ? `Due in ${formatAge(dueIn)}` : undefined;
                return (
                  <li key={item.id}>
                    <article className={`rounded-[6px] border bg-card text-card-foreground ${item.order.isRush ? "border-red-500/60" : ""}`}>
                      <div className="flex items-start justify-between gap-3 border-b px-4 py-2.5 text-sm">
                        <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className="font-semibold tabular-nums [overflow-wrap:anywhere]">#{item.order.orderNumber}</span>
                          <span className="text-muted-foreground [overflow-wrap:anywhere]">{item.order.pickupName || "Guest"}</span>
                          {item.order.isRush && <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400"><Zap className="size-3" aria-hidden="true" />Rush</span>}
                        </span>
                        {dueIn !== null && waited !== null ? (
                          <span className="flex shrink-0 flex-col items-end leading-tight">
                            <TicketAge minutes={waited} className="text-base" />
                            <span className="text-xs tabular-nums text-muted-foreground">{ageLabel}</span>
                          </span>
                        ) : (
                          <TicketAge minutes={ageMinutes ?? (dueIn !== null ? 0 : null)} late={lateBy !== null} label={ageLabel} className="text-base" />
                        )}
                      </div>
                      <div className="px-4 pb-4 pt-3">
                        <h3 className="text-xl font-semibold leading-tight tracking-tight [overflow-wrap:anywhere]">
                          <span className="tabular-nums">{item.quantity}×</span> {item.itemNameSnapshot}
                        </h3>
                        <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                          <StatusDot tone={BAR_STATUS_TONES[item.barStatus] || "zinc"} />
                          <span className="capitalize">{item.barStatus.replaceAll("_", " ")}</span>
                          <span aria-hidden="true">·</span>
                          <span className="tabular-nums">{item.order.promisedAt ? formatStaffPickupTime(item.order.promisedAt, storeTimezone) : "ASAP"}</span>
                        </p>
                        {item.customizationsSummary && <p className="mt-3 text-base font-medium leading-snug [overflow-wrap:anywhere]">{item.customizationsSummary}</p>}
                        {item.specialInstructions && <p className="mt-2 rounded-[4px] bg-amber-500/10 px-3 py-2 text-sm font-medium text-amber-900 dark:text-amber-200 [overflow-wrap:anywhere]">{item.specialInstructions}</p>}
                        {next && (
                          <button
                            type="button"
                            disabled={pendingId !== null || !recoveryState.ready}
                            onClick={() => bump(item)}
                            aria-busy={pendingId === item.id}
                            className="mt-4 min-h-14 w-full rounded-[6px] bg-foreground px-4 text-lg font-semibold text-background transition-[opacity,transform] duration-150 ease-out hover:opacity-90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
                          >
                            {pendingId === item.id ? "Updating…" : unresolved ? "Retry original update" : next.label}
                          </button>
                        )}
                      </div>
                    </article>
                  </li>
                );
              })}
            </ol>
          </section>
        ))}
      </div>
      {pagination}
    </div>
  );
}
