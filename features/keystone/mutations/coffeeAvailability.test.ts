import assert from "node:assert/strict";
import test from "node:test";
import { assertCoffeeOrderingAvailable, coffeeFirstPickupMinutes } from "./coffeeAvailability";

const week = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((day) => ({ day, open: "08:00", close: "18:00" }));
const store = { timezone: "America/Chicago", weeklyHours: week, pickupLeadTimeMinutes: 12 };

function clock(at: Date, timeZone = "America/Chicago") {
  return new Intl.DateTimeFormat("en-US", { timeZone, weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(at);
}

function firstPickup(at: Date, settings = store) {
  const offset = coffeeFirstPickupMinutes(settings, 12, [["all_day"]], at);
  assert.notEqual(offset, null);
  return new Date(at.getTime() + offset! * 60_000);
}

test("first pickup the night before DST ends is 8:00 AM, not an hour early", () => {
  // Sat Oct 31 2026, 9:56 PM CDT; clocks fall back at 2 AM Sunday, so the night is 25 hours long.
  const at = new Date("2026-11-01T02:56:00Z");
  const pickup = firstPickup(at);
  assert.equal(clock(pickup), "Sunday 08:00");
  assert.doesNotThrow(() => assertCoffeeOrderingAvailable(store, pickup));
  assert.throws(() => assertCoffeeOrderingAvailable(store, new Date(pickup.getTime() - 60_000)));
});

test("first pickup the night before DST starts is 8:00 AM, not an hour late", () => {
  // Sat Mar 13 2027, 9:56 PM CST; clocks spring forward at 2 AM Sunday, so the night is 23 hours long.
  const at = new Date("2027-03-14T03:56:00Z");
  const pickup = firstPickup(at);
  assert.equal(clock(pickup), "Sunday 08:00");
  assert.throws(() => assertCoffeeOrderingAvailable(store, new Date(pickup.getTime() - 60_000)));
});

test("an ordinary night and an open cafe keep the lead time", () => {
  assert.equal(clock(firstPickup(new Date("2026-10-24T02:56:00Z"))), "Saturday 08:00");
  const open = new Date("2026-10-30T15:00:00Z"); // Fri 10:00 AM CDT
  assert.equal(coffeeFirstPickupMinutes(store, 12, [["all_day"]], open), 12);
});

test("service windows follow the store clock across the change", () => {
  // Morning-only items (5-11 AM) ordered after the morning closes on the fall-back Sunday wait for Monday 8:00.
  const at = new Date("2026-11-01T17:30:00Z"); // Sun 11:30 AM CST
  const offset = coffeeFirstPickupMinutes(store, 12, [["morning"]], at);
  assert.equal(clock(new Date(at.getTime() + offset! * 60_000)), "Monday 08:00");
});
