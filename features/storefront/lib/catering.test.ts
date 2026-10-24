import assert from "node:assert/strict";
import test from "node:test";
import { formatCateringEventTime, storeLocalInputToInstant, toStoreLocalInput, validateCateringDraft } from "./catering";

const NY = "America/New_York";

test("store-local input converts to the right instant across DST", () => {
  assert.equal(storeLocalInputToInstant("2026-07-04T18:30", NY)?.toISOString(), "2026-07-04T22:30:00.000Z");
  assert.equal(storeLocalInputToInstant("2026-12-04T18:30", NY)?.toISOString(), "2026-12-04T23:30:00.000Z");
  assert.equal(storeLocalInputToInstant("2026-10-24T09:00", "Asia/Kolkata")?.toISOString(), "2026-10-24T03:30:00.000Z");
  assert.equal(storeLocalInputToInstant("2026-10-24T09:00", "Not/AZone")?.toISOString(), "2026-10-24T09:00:00.000Z");
});

test("spring-forward gap and malformed values are rejected", () => {
  assert.equal(storeLocalInputToInstant("2027-03-14T02:30", NY), null);
  assert.equal(storeLocalInputToInstant("2026-10-24", NY), null);
  assert.equal(storeLocalInputToInstant("2026-02-30T10:00", NY), null);
});

test("toStoreLocalInput round-trips", () => {
  const instant = new Date("2026-11-01T05:30:00.000Z");
  assert.equal(toStoreLocalInput(instant, NY), "2026-11-01T01:30");
  assert.equal(storeLocalInputToInstant(toStoreLocalInput(new Date("2026-08-01T16:00:00Z"), NY), NY)?.toISOString(), "2026-08-01T16:00:00.000Z");
});

test("validation mirrors the server rules", () => {
  const now = new Date("2026-10-23T12:00:00Z");
  const base = { customerName: "Ada", customerEmail: "ada@example.com", customerPhone: "", eventLocal: "2026-10-25T10:00", guestCount: "20", deliveryAddress: "", notes: "" };
  const ok = validateCateringDraft(base, NY, now);
  assert.deepEqual(ok.errors, {});
  assert.equal(ok.eventAt?.toISOString(), "2026-10-25T14:00:00.000Z");
  assert.equal(validateCateringDraft({ ...base, eventLocal: "2026-10-24T07:00" }, NY, now).errors.eventLocal, "Catering needs at least 24 hours' notice");
  assert.equal(validateCateringDraft({ ...base, eventLocal: "2027-12-01T10:00" }, NY, now).errors.eventLocal, "Choose a date within the next year");
  assert.equal(validateCateringDraft({ ...base, guestCount: "0" }, NY, now).errors.guestCount, "Enter at least 1 guest");
  assert.equal(validateCateringDraft({ ...base, guestCount: "1001" }, NY, now).errors.guestCount, "For more than 1000 guests, contact the cafe");
  assert.equal(validateCateringDraft({ ...base, guestCount: "2.5" }, NY, now).errors.guestCount, "Guests must be a whole number");
  assert.equal(validateCateringDraft({ ...base, customerEmail: "nope" }, NY, now).errors.customerEmail, "Enter a valid email");
});

test("event time shows the day in the store zone", () => {
  assert.equal(formatCateringEventTime("2026-10-25T14:00:00.000Z", NY), "Sun, Oct 25, 2026 · 10:00 AM EDT");
});
