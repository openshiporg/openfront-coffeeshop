import assert from "node:assert/strict";
import test from "node:test";
import { parseRegisterListState, rangeStart, registerListHref, storeDayStart } from "./registerView";

test("store day start honours the store time zone and DST", () => {
  // 2026-10-23 03:00 UTC is still Oct 22 in New York (EDT, UTC-4).
  assert.equal(storeDayStart(new Date("2026-10-23T03:00:00Z"), "America/New_York").toISOString(), "2026-10-22T04:00:00.000Z");
  // Six store days back crosses no DST change here.
  assert.equal(storeDayStart(new Date("2026-10-23T15:00:00Z"), "America/New_York", 6).toISOString(), "2026-10-17T04:00:00.000Z");
  // Across the November fall-back, midnight is UTC-5.
  assert.equal(storeDayStart(new Date("2026-11-03T15:00:00Z"), "America/New_York", 0).toISOString(), "2026-11-03T05:00:00.000Z");
  assert.equal(storeDayStart(new Date("2026-10-23T15:00:00Z"), "Not/AZone").toISOString(), "2026-10-23T00:00:00.000Z");
  assert.equal(rangeStart("all", "UTC"), null);
});

test("list state parses and builds hrefs per view", () => {
  const shifts = parseRegisterListState({ status: "open", range: "today", method: "cash" });
  assert.equal(registerListHref(shifts), "/dashboard/platform/register?range=today&status=open");
  const payments = parseRegisterListState({ view: "payments", method: "card", paymentStatus: "refunded", search: " 1042 ", page: "2" });
  assert.equal(registerListHref(payments), "/dashboard/platform/register?view=payments&method=card&paymentStatus=refunded&search=1042&page=2");
  assert.equal(registerListHref(parseRegisterListState({})), "/dashboard/platform/register");
});
