import type { KdsItemStatus } from "../types";

export type KdsCommand = {
  orderItemId: string;
  status: KdsItemStatus;
  expectedStatus: KdsItemStatus;
  idempotencyKey: string;
};

/** Memory-only retry identity. Refresh/readback may advance the item, but an
 * unresolved command must not silently become the next production command.
 * No cross-reload recovery or guest checkout persistence contract is implied.
 */
export function getOrCreateKdsCommand(
  pending: Map<string, KdsCommand>,
  input: Omit<KdsCommand, "idempotencyKey">,
  newKey: () => string,
): KdsCommand {
  const existing = pending.get(input.orderItemId);
  if (existing) return existing;
  const command = { ...input, idempotencyKey: newKey() };
  pending.set(input.orderItemId, command);
  return command;
}
