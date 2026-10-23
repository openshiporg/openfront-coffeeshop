import assert from "node:assert/strict";
import test from "node:test";
import { formatStaffPickupTime } from "../../../lib/date-time";
import { formatPickupTime, storeZoneAbbreviation } from "./format";

// Friday Oct 23, 6:48 PM in New York.
const now = new Date("2026-10-23T22:48:00Z");

test("pickup times name the day when it isn't today in the store time zone", () => {
  assert.equal(formatPickupTime("2026-10-23T23:15:00Z", "America/New_York", now), "7:15 PM EDT");
  assert.equal(formatPickupTime("2026-10-24T12:15:00Z", "America/New_York", now), "Tomorrow 8:15 AM EDT");
  assert.equal(formatPickupTime("2026-10-25T12:15:00Z", "America/New_York", now), "Sun, Oct 25 · 8:15 AM EDT");
  // 8 PM Friday in Los Angeles is already Saturday in UTC: the store's day decides.
  assert.equal(formatStaffPickupTime("2026-10-24T03:00:00Z", "America/Los_Angeles", now), "8:00 PM PDT");
  assert.equal(formatStaffPickupTime("2026-10-24T12:15:00Z", "America/New_York", now), "Tomorrow 8:15 AM EDT");
});

test("pickup times never show the IANA zone id", () => {
  assert.doesNotMatch(formatPickupTime("2026-10-24T12:15:00Z", "America/New_York", now), /America\//);
  assert.equal(formatPickupTime(null, "America/New_York", now), "soon");
  assert.equal(formatPickupTime("2026-10-23T23:15:00Z", "Not/AZone", now), "11:15 PM UTC");
});

test("storeZoneAbbreviation gives the short zone or nothing", () => {
  assert.equal(storeZoneAbbreviation("America/New_York", now), "EDT");
  assert.equal(storeZoneAbbreviation("Not/AZone", now), "");
  assert.equal(storeZoneAbbreviation(null, now), "");
});
