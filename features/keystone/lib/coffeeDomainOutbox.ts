import { createHash, randomBytes } from "node:crypto";

import { permissions, type Session } from "../access";
import { requireCurrentCoffeeCapability } from "../mutations/coffeeKdsAuthority";

const OUTBOX_SCHEMA_VERSION = "1";
const DEFAULT_CONSUMER = "coffee-platform";
const MAX_PAYLOAD_BYTES = 256_000;
/** Same lease length as E-commerce webhook delivery (WEBHOOK_DELIVERY_LEASE_MS). */
const OUTBOX_LEASE_MS = 2 * 60_000;
const CLAIM_PAYLOAD_BUDGET_BYTES = 1_000_000;
const MAX_EVIDENCE_LINES = 40;

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };
type EventInput = {
  storeId: string;
  eventKey: string;
  eventType: string;
  aggregateType: string;
  aggregateId: string;
  payload: JsonValue;
  occurredAt?: Date;
  consumer?: string;
};
type OutboxTransaction = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  coffeeDomainEvent: {
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  coffeeOutboxDelivery: {
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
    create(args: Record<string, unknown>): Promise<Record<string, unknown>>;
  };
  storeSetting: { findUnique(args: Record<string, unknown>): Promise<{ id: string } | null> };
};
type ClaimTransaction = {
  $queryRawUnsafe<T>(query: string, ...values: unknown[]): Promise<T>;
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  user: { findUnique(args: Record<string, unknown>): Promise<{ id: string; roleId: string | null } | null> };
  role: { findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null> };
  storeSetting: { findUnique(args: Record<string, unknown>): Promise<{ id: string } | null> };
  coffeeOutboxDelivery: {
    updateMany(args: Record<string, unknown>): Promise<{ count: number }>;
    findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
    findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
  };
};
type Context = {
  session?: Session;
  prisma: { $transaction<T>(fn: (tx: unknown) => Promise<T>, options?: Record<string, unknown>): Promise<T> };
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

export async function getPrimaryCoffeeStoreId(tx: Pick<OutboxTransaction, "storeSetting">) {
  const store = await tx.storeSetting.findUnique({ where: { singletonKey: "primary" }, select: { id: true } });
  if (!store) throw new Error("Primary coffee store is not configured");
  return store.id;
}

export function assertCoffeeStoreOwnership(storeId: unknown, expectedStoreId: string, label: string) {
  if (String(storeId || "") !== expectedStoreId) throw new Error(`${label} does not belong to the active store`);
}

export async function enqueueCoffeeDomainEvent(tx: OutboxTransaction, input: EventInput) {
  const canonicalPayload = canonicalCoffeeEventJson(input.payload);
  if (Buffer.byteLength(canonicalPayload) > MAX_PAYLOAD_BYTES) throw new Error("Coffee domain event payload is too large");
  const payloadHash = coffeeEventPayloadHash(input.payload);
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-event:${input.eventKey}`);
  const consumer = input.consumer || DEFAULT_CONSUMER;
  const deliveryKey = `${consumer}:${input.eventKey}`;
  const existing = await tx.coffeeDomainEvent.findUnique({ where: { eventKey: input.eventKey } });
  if (existing) {
    if (
      existing.payloadHash !== payloadHash
      || existing.eventType !== input.eventType
      || existing.storeId !== input.storeId
      || existing.aggregateType !== input.aggregateType
      || existing.aggregateId !== input.aggregateId
      || existing.schemaVersion !== OUTBOX_SCHEMA_VERSION
    ) {
      throw new Error("Coffee event idempotency key was reused with a different snapshot");
    }
    // The event itself is immutable; a newly requested consumer gets its own delivery.
    const delivery = await tx.coffeeOutboxDelivery.findUnique({ where: { deliveryKey } });
    if (!delivery) await createDelivery(tx, { deliveryKey, consumer, eventId: String(existing.id), storeId: input.storeId });
    else if (delivery.eventId !== existing.id || delivery.storeId !== input.storeId) throw new Error("Coffee outbox delivery is bound to a different event");
    return { eventId: String(existing.id), created: false };
  }

  const event = await tx.coffeeDomainEvent.create({
    data: {
      eventKey: input.eventKey,
      eventType: input.eventType,
      schemaVersion: OUTBOX_SCHEMA_VERSION,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      payload: canonicalize(input.payload),
      payloadHash,
      occurredAt: input.occurredAt || new Date(),
      storeId: input.storeId,
    },
  });
  await createDelivery(tx, { deliveryKey, consumer, eventId: String(event.id), storeId: input.storeId });
  return { eventId: String(event.id), created: true };
}

async function createDelivery(tx: OutboxTransaction, input: { deliveryKey: string; consumer: string; eventId: string; storeId: string }) {
  await tx.coffeeOutboxDelivery.create({
    data: {
      deliveryKey: input.deliveryKey,
      consumer: input.consumer,
      status: "pending",
      attempts: 0,
      maxAttempts: 8,
      nextAttempt: new Date(),
      eventId: input.eventId,
      storeId: input.storeId,
    },
  });
}

function requireOutboxManager(context: Context) {
  if (!permissions.canManageSettings({ session: context.session })) throw new Error("Not authorized to manage coffee outbox delivery");
}

function consumerName(value: string) {
  const normalized = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9._-]{2,63}$/.test(normalized)) throw new Error("Outbox consumer is invalid");
  return normalized;
}

function lockHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

/** Per-attempt history kept with the delivery (claim, expiry, outcome) so a retry
 * never erases what an earlier attempt observed. Bounded well above maxAttempts.
 */
function appendAttemptEvidence(previous: unknown, line: string) {
  const lines = String(previous || "").split("\n").filter(Boolean);
  lines.push(line.replace(/\s+/g, " ").slice(0, 300));
  return lines.slice(-MAX_EVIDENCE_LINES).join("\n");
}

type ClaimCandidate = {
  id: string;
  status: string;
  attempts: number;
  maxAttempts: number;
  lockOwner: string;
  lastError: string | null;
  payloadBytes: number | null;
};

/** Server-side delivery claim. Not exposed through GraphQL (matching E-commerce,
 * whose webhook delivery is claimed and dispatched only by server code).
 * Claims are scoped to the primary store and consumer, enforce the retry budget for
 * stale (expired-lease) work too, and are bounded by payload bytes as well as count.
 */
export async function claimCoffeeOutboxDeliveries(
  _root: unknown,
  args: { consumer: string; limit?: number | null },
  context: Context,
) {
  requireOutboxManager(context);
  const consumer = consumerName(args.consumer);
  const limit = Math.max(1, Math.min(100, Math.floor(Number(args.limit || 25))));
  const token = randomBytes(32).toString("hex");
  const owner = lockHash(token);
  const now = new Date();
  const staleBefore = new Date(now.getTime() - OUTBOX_LEASE_MS);

  const deliveries = await context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx as ClaimTransaction;
    await requireCurrentCoffeeCapability(tx, context.session, ["canManageSettings"], "Not authorized to manage coffee outbox delivery");
    const storeId = await getPrimaryCoffeeStoreId(tx);
    const rows = await tx.$queryRawUnsafe<ClaimCandidate[]>(
      `SELECT d."id", d."status", d."attempts", d."maxAttempts", d."lockOwner", d."lastError",
              octet_length(e."payload"::text) AS "payloadBytes"
       FROM "CoffeeOutboxDelivery" d
       JOIN "CoffeeDomainEvent" e ON e."id" = d."event"
       WHERE d."consumer" = $1
         AND d."store" = $2
         AND e."store" = $2
         AND ((d."status" IN ('pending', 'retry') AND d."nextAttempt" <= $3 AND d."attempts" < d."maxAttempts")
           OR (d."status" = 'processing' AND d."lockedAt" < $4))
       ORDER BY d."createdAt" ASC
       LIMIT $5 FOR UPDATE OF d SKIP LOCKED`,
      consumer,
      storeId,
      now,
      staleBefore,
      limit,
    );
    const claimedIds: string[] = [];
    let budget = CLAIM_PAYLOAD_BUDGET_BYTES;
    for (const row of rows) {
      const attempts = Number(row.attempts || 0);
      const maxAttempts = Number(row.maxAttempts || 8);
      let evidence = row.lastError;
      if (row.status === "processing") {
        // An expired lease is not proof the earlier attempt had no effect; record it as unknown.
        evidence = appendAttemptEvidence(evidence, `#${attempts} lease expired ${now.toISOString()} without completion; outcome unknown`);
        if (attempts >= maxAttempts) {
          const exhausted = await tx.coffeeOutboxDelivery.updateMany({
            where: { id: row.id, status: "processing", lockOwner: row.lockOwner },
            data: {
              status: "dead_letter",
              lockedAt: null,
              nextAttempt: null,
              deadLetteredAt: now,
              lastError: appendAttemptEvidence(evidence, `dead_letter ${now.toISOString()}: retry budget exhausted (${attempts}/${maxAttempts})`),
            },
          });
          if (exhausted.count !== 1) throw new Error("Coffee outbox claim lost delivery rows");
          continue;
        }
      }
      const bytes = Number(row.payloadBytes || 0);
      if (claimedIds.length > 0 && bytes > budget) break;
      budget -= bytes;
      const claimed = await tx.coffeeOutboxDelivery.updateMany({
        where: { id: row.id, status: row.status, lockOwner: row.lockOwner },
        data: {
          status: "processing",
          attempts: { increment: 1 },
          lockedAt: now,
          lockOwner: owner,
          lastError: appendAttemptEvidence(evidence, `#${attempts + 1} claimed ${now.toISOString()} lease ${owner.slice(0, 12)}`),
        },
      });
      if (claimed.count !== 1) throw new Error("Coffee outbox claim lost delivery rows");
      claimedIds.push(row.id);
    }
    if (!claimedIds.length) return [];
    return tx.coffeeOutboxDelivery.findMany({
      where: { id: { in: claimedIds }, storeId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        deliveryKey: true,
        consumer: true,
        attempts: true,
        maxAttempts: true,
        lockedAt: true,
        event: { select: { id: true, eventKey: true, eventType: true, schemaVersion: true, aggregateType: true, aggregateId: true, payload: true, payloadHash: true, occurredAt: true } },
      },
    });
  }, { maxWait: 5000, timeout: 10000, isolationLevel: "ReadCommitted" });

  return { lockToken: token, leaseExpiresAt: new Date(now.getTime() + OUTBOX_LEASE_MS).toISOString(), deliveries };
}

/** Completion must match the claim's lease (owner and claim time) while the lease is
 * still live. A replay is answered only for the same lease owner and the same outcome.
 */
export async function completeCoffeeOutboxDelivery(
  _root: unknown,
  args: { deliveryId: string; lockToken: string; outcome: string; error?: string | null; acknowledgement?: string | null },
  context: Context,
) {
  requireOutboxManager(context);
  if (!/^[a-f0-9]{64}$/.test(args.lockToken)) throw new Error("Outbox lock token is invalid");
  if (!new Set(["delivered", "retry", "dead_letter"]).has(args.outcome)) throw new Error("Outbox outcome is invalid");
  const owner = lockHash(args.lockToken);
  const now = new Date();

  return context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx as ClaimTransaction;
    await requireCurrentCoffeeCapability(tx, context.session, ["canManageSettings"], "Not authorized to manage coffee outbox delivery");
    const storeId = await getPrimaryCoffeeStoreId(tx);
    const delivery = await tx.coffeeOutboxDelivery.findUnique({ where: { id: args.deliveryId } });
    if (!delivery || delivery.storeId !== storeId || delivery.lockOwner !== owner) throw new Error("Coffee outbox delivery lease was lost");
    if (delivery.status !== "processing") {
      const sameOutcome = delivery.status === args.outcome || (args.outcome === "retry" && delivery.status === "dead_letter");
      if (sameOutcome) return { id: String(delivery.id), status: String(delivery.status), replayed: true };
      throw new Error("Coffee outbox delivery lease was lost");
    }
    const lockedAt = delivery.lockedAt instanceof Date ? delivery.lockedAt : null;
    if (!lockedAt || lockedAt.getTime() + OUTBOX_LEASE_MS <= now.getTime()) throw new Error("Coffee outbox delivery lease has expired");

    const attempts = Number(delivery.attempts || 0);
    const maxAttempts = Number(delivery.maxAttempts || 8);
    const status = args.outcome === "retry" && attempts >= maxAttempts ? "dead_letter" : args.outcome;
    const nextAttempt = status === "retry" ? new Date(now.getTime() + Math.min(3600, 2 ** attempts) * 1000) : null;
    const detail = [
      args.acknowledgement ? `ack ${String(args.acknowledgement).slice(0, 120)}` : "",
      args.error ? String(args.error).slice(0, 200) : "",
    ].filter(Boolean).join("; ");
    const updated = await tx.coffeeOutboxDelivery.updateMany({
      where: { id: args.deliveryId, status: "processing", lockOwner: owner, lockedAt },
      data: {
        status,
        nextAttempt,
        lockedAt: null,
        deliveredAt: status === "delivered" ? now : null,
        deadLetteredAt: status === "dead_letter" ? now : null,
        lastError: appendAttemptEvidence(delivery.lastError, `#${attempts} ${status} ${now.toISOString()}${detail ? `: ${detail}` : ""}`),
      },
    });
    if (updated.count !== 1) throw new Error("Coffee outbox delivery lease was lost");
    return { id: args.deliveryId, status, replayed: false };
  }, { maxWait: 5000, timeout: 10000, isolationLevel: "Serializable" });
}
