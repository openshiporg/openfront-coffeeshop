import assert from "node:assert/strict";
import test from "node:test";
import {
  CAFE_ORDER_TRANSITIONS, CATERING_ORDER_TRANSITIONS, LOYALTY_ACCOUNT_TRANSITIONS, PAYMENT_TRANSITIONS, POS_ORDER_TRANSITIONS,
  PURCHASE_ORDER_TRANSITIONS, SUBSCRIPTION_TRANSITIONS, canTransition, evaluateTransition,
} from "./transitionPolicy";

test("every transition target is a declared state", () => {
  for (const map of [CAFE_ORDER_TRANSITIONS, CATERING_ORDER_TRANSITIONS, LOYALTY_ACCOUNT_TRANSITIONS, PAYMENT_TRANSITIONS, POS_ORDER_TRANSITIONS, PURCHASE_ORDER_TRANSITIONS, SUBSCRIPTION_TRANSITIONS] as Record<string, readonly string[]>[]) {
    for (const targets of Object.values(map)) for (const target of targets) assert.ok(target in map, `${target} has no entry`);
  }
});

test("an order cannot be cancelled after it is fulfilled or refunded", () => {
  assert.throws(() => evaluateTransition(CAFE_ORDER_TRANSITIONS, "completed", "cancelled"));
  assert.throws(() => evaluateTransition(CAFE_ORDER_TRANSITIONS, "refunded", "cancelled"));
  assert.throws(() => evaluateTransition(CAFE_ORDER_TRANSITIONS, "ready", "open"));
});

test("a refund is reachable from every live or finished order state, but only once", () => {
  for (const state of ["open", "paid", "in_bar_queue", "preparing", "ready", "completed", "cancelled"]) assert.equal(canTransition(CAFE_ORDER_TRANSITIONS, state, "refunded"), true, state);
  assert.deepEqual(evaluateTransition(CAFE_ORDER_TRANSITIONS, "refunded", "refunded"), { replay: true });
  assert.equal(CAFE_ORDER_TRANSITIONS.refunded.length, 0);
});

test("a payment moves captured to refunded once, and refunded or cancelled never come back", () => {
  assert.equal(canTransition(PAYMENT_TRANSITIONS, "captured", "refunded"), true);
  assert.equal(canTransition(PAYMENT_TRANSITIONS, "refunded", "captured"), false);
  assert.equal(canTransition(PAYMENT_TRANSITIONS, "cancelled", "captured"), false);
  assert.equal(canTransition(PAYMENT_TRANSITIONS, "captured", "failed"), false);
  assert.equal(canTransition(PAYMENT_TRANSITIONS, "failed", "captured"), true);
});

test("purchase orders are received or cancelled only from open states", () => {
  assert.equal(canTransition(PURCHASE_ORDER_TRANSITIONS, "received", "cancelled"), false);
  assert.equal(canTransition(PURCHASE_ORDER_TRANSITIONS, "cancelled", "received"), false);
  assert.equal(canTransition(PURCHASE_ORDER_TRANSITIONS, "submitted", "received"), true);
});

test("loyalty accounts follow the dashboard's pause, close and reactivate actions", () => {
  assert.equal(canTransition(LOYALTY_ACCOUNT_TRANSITIONS, "active", "paused"), true);
  assert.equal(canTransition(LOYALTY_ACCOUNT_TRANSITIONS, "closed", "paused"), false);
  assert.equal(canTransition(LOYALTY_ACCOUNT_TRANSITIONS, "closed", "active"), true);
});

test("catering and subscriptions have no way out of their end states", () => {
  assert.equal(canTransition(CATERING_ORDER_TRANSITIONS, "completed", "cancelled"), false);
  assert.equal(canTransition(CATERING_ORDER_TRANSITIONS, "inquiry", "confirmed"), false);
  assert.equal(canTransition(SUBSCRIPTION_TRANSITIONS, "cancelled", "active"), false);
  assert.equal(canTransition(POS_ORDER_TRANSITIONS, "voided", "paid"), false);
});
