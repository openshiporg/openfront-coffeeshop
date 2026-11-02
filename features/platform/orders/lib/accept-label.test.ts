import { test } from "node:test";
import assert from "node:assert/strict";
import { acceptPickupLabel } from "./accept-label";

test("a request paid online is not offered as an unpaid pickup", () => {
  assert.equal(acceptPickupLabel(true), "Accept pickup");
});

test("an unpaid request keeps the pay-at-pickup wording", () => {
  assert.equal(acceptPickupLabel(false), "Accept unpaid pickup");
});
