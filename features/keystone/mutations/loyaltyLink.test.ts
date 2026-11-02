import { test } from "node:test";
import assert from "node:assert/strict";
import { loyaltyLinkDecision } from "./loyaltyLink";

const user = { id: "u1", email: "QA+Rewards@Example.com ", loyaltyAccountId: null };
const emailOnly = { id: "a1", customerId: null, customerEmail: "qa+rewards@example.com" };

test("an email-only account is linked to the signed-in customer with the same email", () => {
  assert.equal(loyaltyLinkDecision({ account: emailOnly, user }), "link");
});

test("an account already linked to this customer stays linked", () => {
  assert.equal(loyaltyLinkDecision({ account: { ...emailOnly, customerId: "u1" }, user: { ...user, loyaltyAccountId: "a1" } }), "linked");
});

test("another customer's account, a different email, or a guest is never linked", () => {
  assert.equal(loyaltyLinkDecision({ account: { ...emailOnly, customerId: "u2" }, user }), "skip");
  assert.equal(loyaltyLinkDecision({ account: { ...emailOnly, customerEmail: "someone@example.com" }, user }), "skip");
  assert.equal(loyaltyLinkDecision({ account: emailOnly, user: null }), "skip");
  assert.equal(loyaltyLinkDecision({ account: emailOnly, user: { ...user, email: null } }), "skip");
  assert.equal(loyaltyLinkDecision({ account: null, user }), "skip");
});

test("a customer who already owns a rewards account is not moved to a second one", () => {
  assert.equal(loyaltyLinkDecision({ account: emailOnly, user: { ...user, loyaltyAccountId: "a9" } }), "skip");
});
