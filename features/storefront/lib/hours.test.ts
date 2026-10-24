import assert from "node:assert/strict";
import test from "node:test";
import { formatClock, formatPickupTime, groupPickupSlots, hoursRows, isOpenAt, openState, pickupSlots } from "./hours";

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
