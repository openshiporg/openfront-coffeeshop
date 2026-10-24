import assert from "node:assert/strict";
import test from "node:test";
import { loyaltyListHref, parseLoyaltyListView, parseSignedWhole, previewLoyaltyAdjustment } from "./loyaltyView";

test("list view parses defaults and round-trips through the href", () => {
  const view = parseLoyaltyListView({ status: "bogus", tier: "neighborhood", sort: "lifetime_points", page: "3", search: "  ana " });
  assert.deepEqual(view, { search: "ana", status: "active", tier: "neighborhood", sort: "lifetime_points", page: 3 });
  assert.equal(loyaltyListHref(view), "/dashboard/platform/loyalty?search=ana&tier=neighborhood&sort=lifetime_points&page=3");
  assert.equal(loyaltyListHref(parseLoyaltyListView({})), "/dashboard/platform/loyalty");
  assert.equal(parseLoyaltyListView({ page: "-2" }).page, 1);
});

test("signed whole numbers", () => {
  assert.equal(parseSignedWhole(""), 0);
  assert.equal(parseSignedWhole("+25"), 25);
  assert.equal(parseSignedWhole("-3"), -3);
  assert.equal(parseSignedWhole("1.5"), null);
  assert.equal(parseSignedWhole("200000"), null);
});

test("adjustment preview rolls 100 points into a credit and refuses negatives", () => {
  assert.deepEqual(previewLoyaltyAdjustment({ pointsBalance: 80, drinkCredits: 1 }, 30, 0), { ok: true, pointsBalance: 10, drinkCredits: 2 });
  assert.equal(previewLoyaltyAdjustment({ pointsBalance: 10, drinkCredits: 0 }, -20, 0).ok, false);
  assert.equal(previewLoyaltyAdjustment({ pointsBalance: 10, drinkCredits: 0 }, 0, -1).ok, false);
});
