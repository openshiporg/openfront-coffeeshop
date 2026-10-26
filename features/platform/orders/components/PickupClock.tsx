"use client";

import { formatStaffPickupTime } from "@/lib/date-time";
import { formatAge, TicketAge, useNow } from "@/features/platform/kds/lib/ticketAge";

/** Pickup time for a live ticket, with a countdown that gets heavier once the ticket is late. */
export function PickupClock({ promisedAt, storeTimezone, live }: { promisedAt?: string | null; storeTimezone: string | null; live: boolean }) {
  const now = useNow();
  if (!promisedAt) return <span className="font-medium">ASAP</span>;
  const promised = new Date(promisedAt).getTime();
  const label = formatStaffPickupTime(promisedAt, storeTimezone);
  if (!live || now === null || !Number.isFinite(promised)) return <span className="font-medium tabular-nums">{label}</span>;
  const late = now > promised;
  const minutes = late ? Math.floor((now - promised) / 60000) : Math.max(0, Math.ceil((promised - now) / 60000));
  // Due-in counts get heavier as the pickup time approaches; late counts are always heavy.
  const weight = late ? minutes : Math.max(0, 15 - minutes);
  return (
    <span className="flex flex-col leading-tight">
      <span className="font-medium tabular-nums">{label}</span>
      {minutes < 24 * 60 ? <TicketAge minutes={weight} late={late} label={late ? `Late ${formatAge(minutes)}` : `Due in ${formatAge(minutes)}`} className="text-xs" /> : null}
    </span>
  );
}
