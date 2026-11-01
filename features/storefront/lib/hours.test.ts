import assert from "node:assert/strict";
import test from "node:test";
import { cafeEarliestPickupMinutes, coffeeFirstPickupMinutes } from "../../lib/pickup-quote";
import { earliestPickup, formatClock, formatPickupTime, groupPickupSlots, hoursRows, isOpenAt, openState, pickupSlots } from "./hours";

const week = [
  { day: "Sunday", open: "08:00", close: "15:00" },
  { day: "Monday", open: "07:00", close: "17:00" },
  { day: "Tuesday", open: "07:00", close: "17:30" },
  { day: "Saturday", closed: true },
];

test("hoursRows sorts Monday first and drops malformed entries", () => {
  const rows = hoursRows([...week, null, "x", { open: "1" }]);
  assert.deepEqual(rows.map((row) => row.day), ["Monday", "Tuesday", "Saturday", "Sunday"]);
  assert.equal(rows[2].closed, true);
});

test("formatClock reads 24-hour values", () => {
  assert.equal(formatClock("07:00"), "7 AM");
  assert.equal(formatClock("17:30"), "5:30 PM");
  assert.equal(formatClock("00:15"), "12:15 AM");
  assert.equal(formatClock("noon"), "noon");
});

test("openState uses the store time zone", () => {
  // Monday 2026-10-19 14:00 UTC is 09:00 in Chicago (CDT).
  const monday = new Date("2026-10-19T14:00:00Z");
  assert.deepEqual(openState(week, "America/Chicago", monday), { kind: "open", label: "Open until 5 PM" });
  // Monday 11:00 UTC is 06:00 in Chicago, before opening.
  assert.deepEqual(openState(week, "America/Chicago", new Date("2026-10-19T11:00:00Z")), { kind: "closed", label: "Closed · opens 7 AM" });
});

test("openState skips closed days to the next opening", () => {
  // Friday 2026-10-23 23:00 UTC; Friday has no row and Saturday is closed.
  assert.deepEqual(openState(week, "UTC", new Date("2026-10-23T23:00:00Z")), { kind: "closed", label: "Closed · opens Sun 8 AM" });
  // Tuesday after close: next opening is not tomorrow (Wednesday has no row).
  assert.deepEqual(openState(week, "UTC", new Date("2026-10-20T18:00:00Z")), { kind: "closed", label: "Closed · opens Sun 8 AM" });
  // Sunday after close: Monday is tomorrow.
  assert.deepEqual(openState(week, "UTC", new Date("2026-10-25T16:00:00Z")), { kind: "closed", label: "Closed · opens tomorrow 7 AM" });
});

test("openState reports unknown without hours", () => {
  assert.equal(openState(undefined, "UTC").kind, "unknown");
  assert.equal(openState(week, "Not/AZone", new Date("2026-10-19T09:00:00Z")).kind, "open");
});

test("pickupSlots keeps the earliest time and only open window starts", () => {
  // Monday 16:40 in Chicago; the store closes at 17:00.
  const earliest = new Date("2026-10-19T21:40:00Z");
  const slots = pickupSlots(week, "America/Chicago", earliest, 15, earliest);
  assert.equal(slots[0].toISOString(), earliest.toISOString());
  assert.equal(slots[1].toISOString(), "2026-10-19T21:45:00.000Z");
  // After 16:45 the next open start is Tuesday 07:00.
  assert.equal(slots[2].toISOString(), "2026-10-20T12:00:00.000Z");
  assert.equal(isOpenAt(week, "America/Chicago", new Date("2026-10-19T22:00:00Z")), false);
});

test("formatPickupTime names tomorrow in the store time zone", () => {
  const now = new Date("2026-10-19T22:30:00Z");
  assert.equal(formatPickupTime(new Date("2026-10-19T22:45:00Z"), "America/Chicago", now), "5:45 PM");
  assert.equal(formatPickupTime(new Date("2026-10-20T12:00:00Z"), "America/Chicago", now), "Tomorrow 7:00 AM");
});

test("pickupSlots runs through the end of tomorrow and groups by store day", () => {
  // Monday 16:40 in Chicago; open 07:00–17:00 on weekdays.
  const now = new Date("2026-10-19T21:40:00Z");
  const slots = pickupSlots(week, "America/Chicago", now, 15, now);
  const last = slots[slots.length - 1];
  assert.equal(last.toISOString(), "2026-10-20T22:15:00.000Z");
  const groups = groupPickupSlots(slots, "America/Chicago", now);
  assert.deepEqual(groups.map((group) => group.label), ["Today", "Tomorrow"]);
  assert.equal(groups[1].slots.length, 42);
});

// The live demo's settings: New York, 12-minute lead, Mon-Fri 7-5, Sat 8-4, Sun 8-3.
const demoStore = {
  timezone: "America/New_York",
  pickupLeadTimeMinutes: 12,
  weeklyHours: [
    ...["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"].map((day) => ({ day, open: "07:00", close: "17:00" })),
    { day: "Saturday", open: "08:00", close: "16:00" },
    { day: "Sunday", open: "08:00", close: "15:00" },
  ],
};

/** The time checkout offers first: the server quote's estimatedPickupMinutes from the same instant. */
function serverQuote(at: Date, prepTimes: Array<number | null> = []) {
  const offset = coffeeFirstPickupMinutes(demoStore, cafeEarliestPickupMinutes(demoStore.pickupLeadTimeMinutes, prepTimes), [["all_day"]], at);
  assert.notEqual(offset, null);
  return new Date(at.getTime() + offset! * 60_000);
}

function clock(at: Date | null) {
  assert.ok(at);
  return new Intl.DateTimeFormat("en-US", { timeZone: demoStore.timezone, weekday: "short", hour: "numeric", minute: "2-digit" }).format(at);
}

test("closed overnight: the storefront names the opening time checkout offers, not opening plus the lead", () => {
  const sundayEvening = new Date("2026-11-01T20:08:00Z"); // Sun 3:08 PM EST, just closed
  assert.equal(clock(earliestPickup(demoStore, sundayEvening)), "Mon 7:00 AM");
  assert.equal(earliestPickup(demoStore, sundayEvening)?.getTime(), serverQuote(sundayEvening).getTime());
});

test("open: both add the lead time to now", () => {
  const mondayMorning = new Date("2026-11-02T15:00:00Z"); // Mon 10:00 AM EST
  assert.equal(clock(earliestPickup(demoStore, mondayMorning)), "Mon 10:12 AM");
  assert.equal(earliestPickup(demoStore, mondayMorning)?.getTime(), serverQuote(mondayMorning).getTime());
});

test("a bag item that takes longer than the lead time moves both the same way", () => {
  const nearOpening = new Date("2026-11-02T11:55:00Z"); // Mon 6:55 AM EST, opens at 7
  assert.equal(clock(earliestPickup(demoStore, nearOpening, [20])), "Mon 7:20 AM");
  assert.equal(earliestPickup(demoStore, nearOpening, [20])?.getTime(), serverQuote(nearOpening, [20]).getTime());
});

test("agrees with the quote at every quarter hour across a week, including the DST change", () => {
  const start = new Date("2026-10-28T04:00:00Z").getTime();
  for (let at = start; at < start + 7 * 86_400_000; at += 15 * 60_000) {
    const now = new Date(at);
    assert.equal(earliestPickup(demoStore, now)?.getTime(), serverQuote(now).getTime(), now.toISOString());
  }
});
