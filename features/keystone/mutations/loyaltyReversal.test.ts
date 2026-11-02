import { test } from "node:test";
import assert from "node:assert/strict";
import { reverseLoyaltyEarning } from "./loyaltyReversal";
import { hasCafeSettlement } from "./coffeeOrderPolicy";

test("a full refund takes back exactly the points the order earned", () => {
  const result = reverseLoyaltyEarning({ pointsBalance: 40, drinkCredits: 0, lifetimePoints: 40, visits: 1 }, 4);
  assert.deepEqual(result, { ok: true, next: { pointsBalance: 36, drinkCredits: 0, lifetimePoints: 36, visits: 0 }, drinkCreditsDelta: 0 });
});

test("reversal that crosses a drink credit gives the credit back as points", () => {
  // 98 points + 5 earned rolled over to 1 credit + 3 points; the refund returns to 98 points.
  const result = reverseLoyaltyEarning({ pointsBalance: 3, drinkCredits: 1, lifetimePoints: 103, visits: 4 }, 5);
  assert.deepEqual(result, { ok: true, next: { pointsBalance: 98, drinkCredits: 0, lifetimePoints: 98, visits: 3 }, drinkCreditsDelta: -1 });
});

test("spent rewards and impossible history go to reconciliation instead of clamping", () => {
  assert.deepEqual(reverseLoyaltyEarning({ pointsBalance: 2, drinkCredits: 0, lifetimePoints: 120, visits: 5 }, 5), { ok: false, error: "Spent loyalty rewards require a manual refund reconciliation" });
  assert.equal(reverseLoyaltyEarning({ pointsBalance: 10, drinkCredits: 0, lifetimePoints: 3, visits: 1 }, 5).ok, false);
  assert.equal(reverseLoyaltyEarning({ pointsBalance: 10, drinkCredits: 0, lifetimePoints: 10, visits: 0 }, 5).ok, false);
  assert.equal(reverseLoyaltyEarning({ pointsBalance: 10, drinkCredits: 0, lifetimePoints: 10, visits: 1 }, -1).ok, false);
});

test("a refunded payment no longer counts as settled, so it cannot earn points afterwards", () => {
  const paid = { status: "captured", amount: 463, refundIdempotencyKey: null };
  assert.equal(hasCafeSettlement([paid], 463), true);
  assert.equal(hasCafeSettlement([{ ...paid, refundIdempotencyKey: "refund-1" }], 463), false);
  assert.equal(hasCafeSettlement([{ ...paid, status: "refunded", refundIdempotencyKey: "refund-1" }], 463), false);
});
