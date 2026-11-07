"use client";

import { ChevronRight, MapPin } from "lucide-react";
import { usePickupSlots } from "@/features/storefront/lib/cart/pickup";
import { PickupTimePicker } from "./PickupTimePicker";

type Hours = { weeklyHours: unknown; timezone: string; pickupLeadTimeMinutes: number | null };

/**
 * The menu's pickup card: where (the location opens in Maps), whether the café is open, and when
 * the order will be ready. The time is the dropdown: the same slots and picker checkout uses.
 */
export function PickupBar({
  hours,
  address,
  mapsHref,
  title,
  storeName,
  status,
}: {
  hours: Hours;
  address: string | null;
  mapsHref: string | null;
  title: string;
  storeName: string;
  status: { kind: "open" | "closed" | "unknown"; label: string };
}) {
  const { ready, slots, chosen, choose } = usePickupSlots(hours);

  return (
    <div className="sf-pickbar">
      {mapsHref ? (
        <a className="sf-pickbar-where" href={mapsHref} target="_blank" rel="noreferrer" aria-label={`${title}, ${address}. Open in Maps`}>
          <MapPin className="sf-pickbar-pin" aria-hidden="true" />
          <span className="sf-pickbar-place">
            <strong>{title}</strong>
            <span className="sf-pickbar-address"><span className="sf-pickup-store">{storeName} · </span>{address}</span>
          </span>
          <ChevronRight className="sf-pickbar-chev" aria-hidden="true" />
        </a>
      ) : (
        <div className="sf-pickbar-where">
          <MapPin className="sf-pickbar-pin" aria-hidden="true" />
          <span className="sf-pickbar-place"><strong>{title}</strong></span>
        </div>
      )}
      <p role="status" className="sf-pickbar-status">
        <span className={`sf-dot sf-dot-${status.kind === "open" ? "open" : status.kind === "closed" ? "closed" : "done"}`} aria-hidden="true" />
        {status.label}
      </p>
      <div className="sf-pickbar-when">
        {ready ? (
          <PickupTimePicker
            variant="inline"
            align="end"
            slots={slots}
            value={chosen}
            onChange={choose}
            timeZone={hours.timezone}
          />
        ) : (
          <span className="sf-pickpick-inline is-loading" aria-hidden="true">
            <span className="sf-pickpick-text"><span className="sf-pickpick-label">Pickup</span><span className="sf-pickpick-value">…</span></span>
          </span>
        )}
      </div>
    </div>
  );
}
