import test from "node:test";
import assert from "node:assert/strict";
import { dayCloseOutcome, isPastDayTicket, storeDayKey } from "./endOfDayClose";

const tz = "America/New_York";

test("store day follows the store's calendar, not UTC", () => {
  assert.equal(storeDayKey(new Date("2026-11-06T03:00:00Z"), tz), "2026-11-05");
});

test("only earlier-day tickets at least three hours past pickup close", () => {
  const now = new Date("2026-11-06T14:00:00Z"); // 9am in New York
  assert.equal(isPastDayTicket({ promisedAt: new Date("2026-11-05T22:00:00Z"), createdAt: new Date() }, now, tz), true);
  assert.equal(isPastDayTicket({ promisedAt: new Date("2026-11-06T12:30:00Z"), createdAt: new Date() }, now, tz), false);
  // 11:30pm pickup, checked at 12:30am: a new day but too recent
  assert.equal(isPastDayTicket({ promisedAt: new Date("2026-11-07T04:30:00Z"), createdAt: new Date() }, new Date("2026-11-07T05:30:00Z"), tz), false);
});

test("paid tickets complete, unpaid ones cancel, no-shows are told apart, money in flight waits", () => {
  const order = { status: "in_bar_queue", total: 650, discount: 0 };
  assert.equal(dayCloseOutcome(order, [{ status: "captured", amount: 650 }], ["queued"]), "completed");
  assert.equal(dayCloseOutcome(order, [], ["queued"]), "cancelled");
  assert.equal(dayCloseOutcome(order, [], ["ready"]), "no_show");
  assert.equal(dayCloseOutcome(order, [{ status: "pending", amount: 650 }], ["queued"]), null);
  assert.equal(dayCloseOutcome(order, [{ status: "captured", amount: 300 }], ["queued"]), null);
});
