"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** Current time on the client only, so server and client markup match; ticks every 15s. */
export function useNow(intervalMs = 15000) {
  const [now, setNow] = React.useState<number | null>(null);
  React.useEffect(() => {
    setNow(Date.now());
    const interval = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(interval);
  }, [intervalMs]);
  return now;
}

export function minutesSince(value: string | null | undefined, now: number | null) {
  if (!value || now === null) return null;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? Math.max(0, Math.floor((now - time) / 60000)) : null;
}

export function formatAge(minutes: number) {
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${String(minutes % 60).padStart(2, "0")}m`;
}

/**
 * The signature move: a ticket's age gets heavier as it gets old.
 * Under 5 minutes it is quiet, 5–9 it is ink, 10–14 it is bold amber, 15+ it is heavy red.
 */
export function ageWeight(minutes: number, late = false) {
  if (late || minutes >= 15) return "font-bold text-red-600 dark:text-red-400";
  if (minutes >= 10) return "font-semibold text-amber-700 dark:text-amber-400";
  if (minutes >= 5) return "font-medium text-foreground";
  return "font-normal text-muted-foreground";
}

export function TicketAge({ minutes, late = false, label, className }: { minutes: number | null; late?: boolean; label?: string; className?: string }) {
  if (minutes === null) return null;
  return (
    <span className={cn("shrink-0 tabular-nums transition-colors", ageWeight(minutes, late), className)} title={label ?? `Waiting ${formatAge(minutes)}`}>
      {label ?? formatAge(minutes)}
    </span>
  );
}
