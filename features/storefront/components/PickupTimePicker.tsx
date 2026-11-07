"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { Check, ChevronDown, Clock3 } from "lucide-react";
import { groupPickupSlots } from "@/features/storefront/lib/hours";

function clock(slot: Date, timeZone: string | null | undefined) {
  try {
    return new Intl.DateTimeFormat("en-US", { timeZone: timeZone || "UTC", hour: "numeric", minute: "2-digit" }).format(slot);
  } catch {
    return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", hour: "numeric", minute: "2-digit" }).format(slot);
  }
}

/**
 * "Pickup time · Today 7:50 PM" row that opens a popover of the slots, grouped by day.
 * The popover is portalled into the row's own container so it keeps the storefront's tokens and type.
 */
export function PickupTimePicker({
  slots,
  value,
  onChange,
  timeZone,
  disabled = false,
  variant = "row",
  align = "start",
}: {
  slots: Date[];
  value: Date | null;
  onChange: (time: number) => void;
  timeZone: string | null | undefined;
  disabled?: boolean;
  /** "row": checkout's "Pickup time · Today 7:50 PM" field. "inline": the home pickup bar's "Pickup today 7:50 PM ⌄". */
  variant?: "row" | "inline";
  align?: "start" | "end";
}) {
  const [open, setOpen] = React.useState(false);
  const [container, setContainer] = React.useState<HTMLElement | null>(null);
  // Keep the list clear of the fixed phone tab bar.
  const [bottomInset, setBottomInset] = React.useState(12);
  const groups = React.useMemo(() => groupPickupSlots(slots, timeZone), [slots, timeZone]);
  const selectedRef = React.useRef<HTMLButtonElement | null>(null);
  const chosen = value || slots[0] || null;
  const chosenGroup = chosen ? groups.find((group) => group.slots.some((slot) => slot.getTime() === chosen.getTime())) : null;
  const label = chosen ? `${chosenGroup?.label ?? ""} ${clock(chosen, timeZone)}`.trim() : "Choose a time";
  const earliest = slots[0]?.getTime();
  const inlineDay = chosenGroup && /^(Today|Tomorrow)$/.test(chosenGroup.label) ? chosenGroup.label.toLowerCase() : chosenGroup?.label;
  const inlineLabel = chosen ? `${inlineDay ?? ""} ${clock(chosen, timeZone)}`.trim() : null;

  return (
    <div ref={(node) => setContainer((node?.closest(".sf-root") as HTMLElement | null) ?? node)} className="sf-pickpick">
      <PopoverPrimitive.Root
        open={open}
        onOpenChange={(next) => {
          if (next) {
            const bar = document.querySelector<HTMLElement>(".sf-dock");
            const visible = bar && getComputedStyle(bar).display !== "none" ? bar.getBoundingClientRect().height : 0;
            setBottomInset(Math.round(visible) + 12);
          }
          setOpen(next);
        }}
      >
        <PopoverPrimitive.Trigger asChild disabled={disabled || (variant === "inline" && !slots.length)}>
          {variant === "inline" ? (
            <button type="button" className="sf-pickpick-inline" aria-haspopup="listbox" aria-label={inlineLabel ? `Pickup ${inlineLabel}. Change pickup time` : "Pickup time unavailable"}>
              <Clock3 className="size-4 shrink-0" aria-hidden="true" />
              <span className="sf-pickpick-text">
                <span className="sf-pickpick-label">Pickup</span>
                <span className="sf-pickpick-value">{inlineLabel ?? "unavailable"}</span>
              </span>
              <ChevronDown className="sf-pickpick-chev size-4 shrink-0" aria-hidden="true" />
            </button>
          ) : (
            <button type="button" className="sf-pickpick-row" aria-haspopup="listbox">
              <Clock3 className="size-4 shrink-0" aria-hidden="true" />
              <span className="sf-pickpick-text">
                <span className="sf-pickpick-label">Pickup time</span>
                <span aria-hidden="true" className="sf-pickpick-dot">·</span>
                <span className="sf-pickpick-value">{label}</span>
              </span>
              <ChevronDown className="sf-pickpick-chev size-4 shrink-0" aria-hidden="true" />
            </button>
          )}
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal container={container}>
          <PopoverPrimitive.Content
            align={align}
            sideOffset={6}
            collisionPadding={{ top: 12, left: 12, right: 12, bottom: bottomInset }}
            className={`sf-pickpick-pop ${variant === "inline" ? "sf-pickpick-pop-wide" : ""}`}
            onOpenAutoFocus={(event) => {
              event.preventDefault();
              (selectedRef.current ?? undefined)?.focus();
              selectedRef.current?.scrollIntoView({ block: "center" });
            }}
          >
            <div role="listbox" aria-label="Pickup time" className="sf-pickpick-list">
              {groups.map((group) => (
                <div key={group.key} role="group" aria-label={group.label} className="sf-pickpick-group">
                  <p className="sf-pickpick-day" aria-hidden="true">{group.label}</p>
                  <div className="sf-pickpick-grid">
                    {group.slots.map((slot) => {
                      const selected = chosen?.getTime() === slot.getTime();
                      return (
                        <button
                          key={slot.getTime()}
                          ref={selected ? selectedRef : undefined}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          aria-label={`${group.label} ${clock(slot, timeZone)}${slot.getTime() === earliest ? ", earliest" : ""}`}
                          className="sf-pickpick-slot"
                          onClick={() => {
                            onChange(slot.getTime());
                            setOpen(false);
                          }}
                        >
                          {selected ? <Check className="size-3.5" aria-hidden="true" /> : null}
                          {clock(slot, timeZone)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </div>
  );
}
