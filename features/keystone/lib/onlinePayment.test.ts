import assert from "node:assert/strict";
import test from "node:test";
import { stripeKeysPresent, validPaymentReturnUrl } from "./onlinePayment";
import { classifyStripeEvent } from "../../integrations/payment/stripe";

test("online payment needs both Stripe keys on the server", () => {
  assert.equal(stripeKeysPresent({ STRIPE_SECRET_KEY: "x", STRIPE_WEBHOOK_SECRET: "y" }), true);
  assert.equal(stripeKeysPresent({ STRIPE_SECRET_KEY: "x" }), false);
  assert.equal(stripeKeysPresent({ STRIPE_SECRET_KEY: " ", STRIPE_WEBHOOK_SECRET: "y" }), false);
});

test("the hosted page may only return to the receipt", () => {
  assert.equal(validPaymentReturnUrl("https://cafe.example/order-confirmed?id=1&key=abc"), "https://cafe.example/order-confirmed?id=1&key=abc");
  assert.equal(validPaymentReturnUrl("https://cafe.example/account"), null);
  assert.equal(validPaymentReturnUrl("javascript:alert(1)"), null);
  assert.equal(validPaymentReturnUrl("https://user:pw@cafe.example/order-confirmed"), null);
  assert.equal(validPaymentReturnUrl(42), null);
});

test("a completed checkout settles only once it is paid", () => {
  assert.equal(classifyStripeEvent("checkout.session.completed", { payment_status: "paid" }), "succeeded");
  assert.equal(classifyStripeEvent("checkout.session.completed", { payment_status: "unpaid" }), "ignored");
  assert.equal(classifyStripeEvent("checkout.session.async_payment_succeeded"), "succeeded");
  assert.equal(classifyStripeEvent("checkout.session.expired"), "failed");
  assert.equal(classifyStripeEvent("payment_intent.succeeded"), "succeeded");
  assert.equal(classifyStripeEvent("customer.created"), "ignored");
});
