import assert from "node:assert/strict";
import { test } from "node:test";

import { addToDate, instantToStoreLocal, parseDollars, recordNumber, storeDateToInstant, storeLocalToInstant } from "./store-time";

test("datetime-local is read in the store time zone", () => {
  assert.deepEqual(storeLocalToInstant("2026-10-24T09:30", "America/New_York"), { ok: true, iso: "2026-10-24T13:30:00.000Z" });
  assert.deepEqual(storeLocalToInstant("2026-01-15T09:30", "America/New_York"), { ok: true, iso: "2026-01-15T14:30:00.000Z" });
  assert.deepEqual(storeLocalToInstant("2026-10-24T09:30", "Asia/Kolkata"), { ok: true, iso: "2026-10-24T04:00:00.000Z" });
  assert.deepEqual(storeLocalToInstant("2026-10-24T09:30", "UTC"), { ok: true, iso: "2026-10-24T09:30:00.000Z" });
});

test("clock changes: gap refuses, fold takes the earlier instant", () => {
  assert.equal(storeLocalToInstant("2026-03-08T02:30", "America/New_York").ok, false);
  assert.deepEqual(storeLocalToInstant("2026-11-01T01:30", "America/New_York"), { ok: true, iso: "2026-11-01T05:30:00.000Z" });
});

test("invalid input refuses", () => {
  assert.equal(storeLocalToInstant("2026-02-30T10:00", "UTC").ok, false);
  assert.equal(storeLocalToInstant("nope", "UTC").ok, false);
  assert.equal(storeLocalToInstant("2026-10-24T09:30", "Not/AZone").ok, false);
});

test("round-trips to datetime-local in store time", () => {
  assert.equal(instantToStoreLocal("2026-10-24T13:30:00.000Z", "America/New_York"), "2026-10-24T09:30");
  assert.deepEqual(storeDateToInstant("2026-10-24", "America/Los_Angeles"), { ok: true, iso: "2026-10-24T07:00:00.000Z" });
});

test("interval math clamps month ends", () => {
  assert.equal(addToDate("2026-01-31", { months: 1 }), "2026-02-28");
  assert.equal(addToDate("2026-12-15", { months: 1 }), "2027-01-15");
  assert.equal(addToDate("2026-10-28", { days: 7 }), "2026-11-04");
});

test("dollars and record numbers", () => {
  assert.deepEqual(parseDollars("12.5"), { ok: true, cents: 1250 });
  assert.deepEqual(parseDollars("$1,200"), { ok: true, cents: 120000 });
  assert.equal(parseDollars("1.234").ok, false);
  assert.match(recordNumber("CAT", "America/New_York", new Date("2026-10-24T02:00:00Z")), /^CAT-261023-[0-9A-F]{6}$/);
});
