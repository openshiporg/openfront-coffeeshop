import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { GraphQLError } from "graphql";
import { maskCoffeeError } from "./graphqlErrorMask";
import { constraintRefusal } from "./constraintRefusal";
import { ProviderError } from "../../integrations/payment/providerError";

const masked = (originalError: Error) => <GraphQLError>maskCoffeeError(new GraphQLError("x", { originalError }), "Unexpected error.", false);
// Keystone's own wrapping of a Prisma failure (createSystem: KS_PRISMA_ERROR).
const ksCheck = (name: string) => new GraphQLError("Prisma error", { extensions: { code: "KS_PRISMA_ERROR", debug: { message: `new row for relation violates check constraint "${name}"` } } });
const ksUnique = (modelName: string, column: string) => Object.assign(
  new GraphQLError("Prisma error: Unique constraint failed", { extensions: { code: "KS_PRISMA_ERROR", prisma: { code: "P2002", meta: { modelName, target: [column] } } } }),
  { code: "P2002", meta: { modelName, target: [column] } },
);

test("a command's own refusal reaches staff, tagged so the dashboard shows it", () => {
  const out = masked(new Error("Shift end must be after its start"));
  assert.equal(out.message, "Shift end must be after its start");
  assert.equal(out.extensions.code, "OPERATION_REFUSED");
});

test("provider, driver and runtime text stays masked", () => {
  assert.equal(masked(new ProviderError("No such payment_intent: 'pi_3Q'")).message, "Unexpected error.");
  assert.equal(masked(new Error("Stripe request failed")).message, "Unexpected error.");
  assert.equal(masked(new TypeError("Cannot read properties of undefined (reading 'id')")).message, "Unexpected error.");
  assert.equal(masked(new Error("Invalid `prisma.payment.update()` invocation")).message, "Unexpected error.");
});

test("database rules that refuse a write are said in words", () => {
  assert.equal(masked(ksUnique("RegisterShift", "store")).message, "This single-register cafe already has an open shift; close it before opening another");
  assert.equal(masked(ksUnique("StaffShift", "staff")).message, "This person is already clocked in on another shift; clock that one out first");
  assert.equal(masked(ksCheck("GiftCard_balance_within_initial_check")).message, "A gift card balance must stay between zero and the amount loaded");
  assert.equal(masked(ksCheck("StaffShift_window_check")).message, "The end must be after the start");
  assert.equal(masked(ksCheck("Payment_refund_within_amount_check")).message, "Refund exceeds the amount paid");
  assert.equal(masked(ksCheck("OrderItem_quantity_positive_check")).message, "Amounts and quantities cannot be negative");
});

test("other unique conflicts and unknown errors are not translated", () => {
  assert.equal(constraintRefusal(ksUnique("User", "email")), null);
  assert.equal(constraintRefusal(new Error("boom")), null);
  // Keystone's own KS_PRISMA_ERROR keeps its existing handling (the dashboard names the field); it is not relabelled a refusal.
  assert.notEqual(masked(ksUnique("User", "email")).extensions.code, "OPERATION_REFUSED");
});

test("every CHECK the invariants migration adds has a sentence", () => {
  const sql = readFileSync(join(process.cwd(), "migrations/20261108230000_invariants_money_stock_windows/migration.sql"), "utf8");
  const names = [...sql.matchAll(/ADD CONSTRAINT "([A-Za-z_]+_check)"/g)].map((match) => match[1]);
  assert.ok(names.length >= 25);
  for (const name of names) assert.ok(constraintRefusal(ksCheck(name)), `${name} has no refusal text`);
});
