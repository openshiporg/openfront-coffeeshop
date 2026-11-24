"use client";

import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3 } from "lucide-react";

/**
 * The event's day and time as two rows in the storefront's own style (a month grid and a list of times),
 * in place of the browser's date-time box. Works on the café's wall-clock strings ("2026-12-04T14:30"),
 * the same value the form already validates, so no time zone maths happens here.
 */
const pad = (value: number) => String(value).padStart(2, "0");
const dayKey = (date: Date) => `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
const fromKey = (key: string) => new Date(`${key}T00:00:00Z`);
const dayLabel = (key: string) => new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(fromKey(key));
const timeLabel = (time: string) => { const [h, m] = time.split(":").map(Number); return `${h % 12 || 12}:${pad(m)} ${h < 12 ? "AM" : "PM"}`; };
const TIMES = Array.from({ length: 96 }, (_, index) => `${pad(Math.floor(index / 4))}:${pad((index % 4) * 15)}`);
const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

export function EventWhenPicker({ value, min, max, onChange, invalid = false, describedBy }: {
  value: string;
  min?: string;
  max?: string;
  onChange: (value: string) => void;
  invalid?: boolean;
  describedBy?: string;
}) {
  const [day, setDay] = React.useState(value.slice(0, 10));
  const [time, setTime] = React.useState(value.slice(11, 16));
  const [open, setOpen] = React.useState<"day" | "time" | null>(null);
  const [container, setContainer] = React.useState<HTMLElement | null>(null);
  const [month, setMonth] = React.useState("");
  const selectedTime = React.useRef<HTMLButtonElement | null>(null);
  // A cleared form (after a request is sent) clears both rows.
  React.useEffect(() => { if (!value) { setDay(""); setTime(""); } }, [value]);

  const minDay = min?.slice(0, 10) || "", maxDay = max?.slice(0, 10) || "";
  const minTime = min?.slice(11, 16) || "", maxTime = max?.slice(11, 16) || "";
  const timeAllowed = (onDay: string, at: string) => !(onDay && onDay === minDay && at < minTime) && !(onDay && onDay === maxDay && at > maxTime);
  const commit = (nextDay: string, nextTime: string) => {
    const kept = nextTime && timeAllowed(nextDay, nextTime) ? nextTime : "";
    setDay(nextDay); setTime(kept);
    onChange(nextDay && kept ? `${nextDay}T${kept}` : "");
  };

  const shownMonth = month || (day || minDay).slice(0, 7);
  const first = shownMonth ? fromKey(`${shownMonth}-01`) : null;
  const cells: Array<string | null> = [];
  if (first) {
    for (let blank = 0; blank < first.getUTCDay(); blank++) cells.push(null);
    for (const date = new Date(first); date.getUTCMonth() === first.getUTCMonth(); date.setUTCDate(date.getUTCDate() + 1)) cells.push(dayKey(date));
  }
  const step = (by: number) => { if (!first) return; const next = new Date(first); next.setUTCMonth(next.getUTCMonth() + by); setMonth(dayKey(next).slice(0, 7)); };
  const canBack = Boolean(shownMonth && minDay && shownMonth > minDay.slice(0, 7));
  const canForward = Boolean(shownMonth && maxDay && shownMonth < maxDay.slice(0, 7));
  const pop = { sideOffset: 6, collisionPadding: { top: 12, left: 12, right: 12, bottom: 96 }, align: "start" as const };

  return (
    <div ref={(node) => setContainer((node?.closest(".sf-root") as HTMLElement | null) ?? node)} className="sf-when" role="group" aria-invalid={invalid || undefined} aria-describedby={describedBy}>
      <PopoverPrimitive.Root open={open === "day"} onOpenChange={(next) => { setOpen((current) => next ? "day" : current === "day" ? null : current); if (next) setMonth(""); }}>
        <PopoverPrimitive.Trigger asChild>
          <button type="button" id="catering-event" className="sf-pickpick-row" aria-haspopup="dialog" aria-label={day ? `Event date ${dayLabel(day)}. Change date` : "Choose the event date"}>
            <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
            <span className="sf-pickpick-text"><span className={day ? "sf-pickpick-value" : "sf-when-empty"}>{day ? dayLabel(day) : "Date"}</span></span>
            <ChevronDown className="sf-pickpick-chev size-4 shrink-0" aria-hidden="true" />
          </button>
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal container={container}>
          <PopoverPrimitive.Content {...pop} className="sf-pickpick-pop sf-when-pop" aria-label="Event date">
            <div className="sf-cal-head">
              <button type="button" className="sf-cal-nav" onClick={() => step(-1)} disabled={!canBack} aria-label="Earlier month"><ChevronLeft className="size-4" aria-hidden="true" /></button>
              <p className="sf-cal-month" aria-live="polite">{first ? new Intl.DateTimeFormat("en-US", { timeZone: "UTC", month: "long", year: "numeric" }).format(first) : ""}</p>
              <button type="button" className="sf-cal-nav" onClick={() => step(1)} disabled={!canForward} aria-label="Later month"><ChevronRight className="size-4" aria-hidden="true" /></button>
            </div>
            <div className="sf-cal-grid" aria-hidden="true">{WEEKDAYS.map((letter, index) => <span key={index} className="sf-cal-weekday">{letter}</span>)}</div>
            <div className="sf-cal-grid" role="listbox" aria-label="Day">
              {cells.map((key, index) => key ? (
                <button key={key} type="button" role="option" aria-selected={key === day} aria-label={dayLabel(key)} className="sf-cal-day"
                  disabled={Boolean((minDay && key < minDay) || (maxDay && key > maxDay))}
                  onClick={() => { commit(key, time); setOpen(null); if (!(time && timeAllowed(key, time))) window.setTimeout(() => setOpen("time"), 80); }}>
                  {Number(key.slice(8))}
                </button>
              ) : <span key={`blank-${index}`} />)}
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>

      <PopoverPrimitive.Root open={open === "time"} onOpenChange={(next) => setOpen((current) => next ? "time" : current === "time" ? null : current)}>
        <PopoverPrimitive.Trigger asChild>
          <button type="button" className="sf-pickpick-row" aria-haspopup="listbox" aria-label={time ? `Event time ${timeLabel(time)}. Change time` : "Choose the event time"}>
            <Clock3 className="size-4 shrink-0" aria-hidden="true" />
            <span className="sf-pickpick-text"><span className={time ? "sf-pickpick-value" : "sf-when-empty"}>{time ? timeLabel(time) : "Time"}</span></span>
            <ChevronDown className="sf-pickpick-chev size-4 shrink-0" aria-hidden="true" />
          </button>
        </PopoverPrimitive.Trigger>
        <PopoverPrimitive.Portal container={container}>
          <PopoverPrimitive.Content {...pop} align="end" className="sf-pickpick-pop sf-when-pop"
            onOpenAutoFocus={(event) => { event.preventDefault(); requestAnimationFrame(() => { selectedTime.current?.scrollIntoView({ block: "center" }); selectedTime.current?.focus({ preventScroll: true }); }); }}>
            <div role="listbox" aria-label="Event time" className="sf-pickpick-grid sf-when-times">
              {TIMES.filter((at) => timeAllowed(day, at)).map((at) => {
                const selected = at === time || (!time && at === "12:00");
                return (
                  <button key={at} ref={selected ? selectedTime : undefined} type="button" role="option" aria-selected={at === time} className="sf-pickpick-slot" onClick={() => { commit(day, at); setOpen(null); if (!day) window.setTimeout(() => setOpen("day"), 80); }}>
                    {at === time ? <Check className="size-3.5" aria-hidden="true" /> : null}
                    {timeLabel(at)}
                  </button>
                );
              })}
            </div>
          </PopoverPrimitive.Content>
        </PopoverPrimitive.Portal>
      </PopoverPrimitive.Root>
    </div>
  );
}
