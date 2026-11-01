"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown } from "lucide-react";
import { earliestPickup, isOpenAt, pickupDayLabel } from "@/features/storefront/lib/hours";
import { useCartLines } from "./StorefrontCartLink";

type Hours = { weeklyHours: unknown; timezone: string; pickupLeadTimeMinutes: number | null };

function clock(at: Date, timeZone: string) {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", minute: "2-digit" }).format(at);
  } catch {
    return new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" }).format(at);
  }
}

/** "Now" while the café is open; otherwise the first pickup after it opens. The time itself is chosen at checkout. */
export function pickupNowLabel(hours: Hours, now = new Date(), compact = false, prepTimes: Array<number | null | undefined> = []) {
  if (isOpenAt(hours.weeklyHours, hours.timezone, now)) return compact ? "Today" : "Now";
  const at = earliestPickup(hours, now, prepTimes);
  if (!at) return "Closed";
  const day = pickupDayLabel(at, hours.timezone, now);
  return compact ? day : `${day} ${clock(at, hours.timezone)}`;
}

/** `compact` shows the day only ("Today", "Tomorrow"), as the phone header does. */
export function PickupNow({ hours, className = "sf-pill sf-pill-soft sf-side-select", compact = false }: { hours: Hours; className?: string; compact?: boolean }) {
  const [label, setLabel] = React.useState<string | null>(null);
  const { lines } = useCartLines();
  const prepKey = lines.map((line) => line.prepTimeMinutes ?? "").join(",");
  React.useEffect(() => {
    const prepTimes = prepKey ? prepKey.split(",").map((value) => (value ? Number(value) : null)) : [];
    const update = () => setLabel(pickupNowLabel(hours, new Date(), compact, prepTimes));
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [hours, compact, prepKey]);

  return (
    <Link href="/checkout" className={className} aria-label={label ? `Pickup: ${label}. Choose a time at checkout` : "Choose a pickup time at checkout"}>
      <span>{label ?? "…"}</span>
      <ChevronDown className="size-4" aria-hidden="true" />
    </Link>
  );
}
