import assert from "node:assert/strict";
import test from "node:test";
import { cateringNumber, planLoyaltyAdjustment, validCateringEventAt } from "./coffeeCoverageCommands";

test("loyalty adjustment rolls 100 points into a drink credit and never goes negative", () => {
  const plan = planLoyaltyAdjustment({ pointsBalance: 80, drinkCredits: 1, lifetimePoints: 480 }, 30, 0);
  assert.deepEqual(plan, { ok: true, pointsBalance: 10, drinkCredits: 2, lifetimePoints: 510, creditsDelta: 1 });
  assert.equal(planLoyaltyAdjustment({ pointsBalance: 10, drinkCredits: 0 }, -20, 0).ok, false);
  assert.equal(planLoyaltyAdjustment({ pointsBalance: 10, drinkCredits: 0 }, 0, -1).ok, false);
  const comp = planLoyaltyAdjustment({ pointsBalance: 10, drinkCredits: 0, lifetimePoints: 10 }, 0, 1);
  assert.equal(comp.ok && comp.drinkCredits, 1);
});

test("catering events need a day's notice and fall within a year", () => {
  const now = new Date("2026-10-23T12:00:00Z");
  assert.equal(validCateringEventAt("2026-10-24T08:00:00Z", now).ok, false);
  assert.equal(validCateringEventAt("2026-10-25T12:00:00Z", now).ok, true);
  assert.equal(validCateringEventAt("2027-12-01T12:00:00Z", now).ok, false);
  assert.equal(validCateringEventAt("not a date", now).ok, false);
});

test("catering numbers use the store's calendar day", () => {
  assert.match(cateringNumber("America/New_York", new Date("2026-10-24T01:30:00Z")), /^CAT-261023-[0-9A-F]{6}$/);
});
