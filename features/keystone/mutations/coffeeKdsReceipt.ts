import type { KdsItemStatus } from "./kdsPolicy";

/** Plain custom GraphQL DTO, captured under command/aggregate/current-actor locks.
 * Never a Keystone OrderItem/CafeOrder object with live relationship resolvers.
 */
export type CoffeeKdsCommandReceipt = {
  id: string;
  quantity: number;
  itemNameSnapshot: string;
  customizationsSummary: string | null;
  barStatus: KdsItemStatus;
  station: string | null;
  queuedAt: string | null;
  startedAt: string | null;
  readyAt: string | null;
  handedOffAt: string | null;
  idempotencyKey: string;
  expectedStatus: string;
  requestedStatus: string;
  actorId: string;
  storeId: string;
  order: { id: string; orderNumber: string; status: string; pickupName: string | null; promisedAt: string | null };
};
