import { createHash } from "node:crypto";

const RECEIPT_SCHEMA_VERSION = "1";
const MAX_PAYLOAD_BYTES = 256_000;

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type ReceiptInput = {
  storeId: string;
  eventKey: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: JsonValue;
  occurredAt?: Date;
};
type ReceiptTransaction = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  coffeeCommandReceipt: {
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  storeSetting: { findUnique(args: Record<string, unknown>): Promise<{ id: string } | null> };
};

function canonicalize(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export function canonicalCoffeeEventJson(payload: JsonValue) {
  return JSON.stringify(canonicalize(payload));
}

export function coffeeEventPayloadHash(payload: JsonValue) {
  return createHash("sha256").update(canonicalCoffeeEventJson(payload)).digest("hex");
}

export async function getPrimaryCoffeeStoreId(tx: Pick<ReceiptTransaction, "storeSetting">) {
  const store = await tx.storeSetting.findUnique({ where: { singletonKey: "primary" }, select: { id: true } });
  if (!store) throw new Error("Primary coffee store is not configured");
  return store.id;
}

export function assertCoffeeStoreOwnership(storeId: unknown, expectedStoreId: string, label: string) {
  if (String(storeId || "") !== expectedStoreId) throw new Error(`${label} does not belong to the active store`);
}

/** Idempotency ledger: one immutable receipt per command key, written in the same transaction as its effect.
 * Replays read it back; nothing is delivered from it (external events go through Commerce webhooks only).
 */
export async function recordCoffeeCommandReceipt(tx: ReceiptTransaction, input: ReceiptInput) {
  const canonicalPayload = canonicalCoffeeEventJson(input.payload);
  if (Buffer.byteLength(canonicalPayload) > MAX_PAYLOAD_BYTES) throw new Error("Coffee command receipt payload is too large");
  const payloadHash = coffeeEventPayloadHash(input.payload);
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-event:${input.eventKey}`);
  const existing = await tx.coffeeCommandReceipt.findUnique({ where: { eventKey: input.eventKey } });
  if (existing) {
    if (
      existing.payloadHash !== payloadHash
      || existing.eventType !== input.eventType
      || existing.storeId !== input.storeId
      || existing.aggregateType !== input.aggregateType
      || existing.aggregateId !== input.aggregateId
      || existing.schemaVersion !== RECEIPT_SCHEMA_VERSION
    ) {
      throw new Error("Coffee event idempotency key was reused with a different snapshot");
    }
    return { eventId: String(existing.id), created: false };
  }
  const receipt = await tx.coffeeCommandReceipt.create({
    data: {
      eventKey: input.eventKey,
      eventType: input.eventType,
      schemaVersion: RECEIPT_SCHEMA_VERSION,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      payload: canonicalize(input.payload),
      payloadHash,
      occurredAt: input.occurredAt || new Date(),
      storeId: input.storeId,
    },
  });
  return { eventId: String(receipt.id), created: true };
}
