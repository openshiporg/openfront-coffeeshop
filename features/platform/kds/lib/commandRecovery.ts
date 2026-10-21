import type { KdsOrderItem } from "../types";
import type { KdsCommand } from "./commandIdentity";

export type KdsRecoveryScope = { actorId: string; storeId: string };
export type PendingKdsCommand = { orderId: string; command: KdsCommand };
type StoragePort = { getItem(key: string): string | null; setItem(key: string, value: string): void };
type RecoveryState = { ready: boolean; pending: PendingKdsCommand[]; busy: string | null; error: string | null };
const initialState: RecoveryState = { ready: false, pending: [], busy: null, error: null };
const unknownCopy = "This update wasn't confirmed and may already be saved. Use Confirm update to finish it; don't send a new update for this item.";
const storageCopy = "This browser can't keep track of pending kitchen updates right now, so updates are paused. Allow site storage for this page, then select Recheck saved updates.";
const statuses = ["new", "queued", "preparing", "ready", "handed_off", "voided"];
const orderStatuses = ["accepted", "paid", "in_bar_queue", "preparing", "ready", "completed"];
const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === "object" && !Array.isArray(value));
const id = (value: unknown): value is string => typeof value === "string" && value.length > 0 && value.length <= 200;
const exactKeys = (value: Record<string, unknown>, keys: string[]) => Object.keys(value).sort().join(",") === [...keys].sort().join(",");

function pendingCommand(value: unknown): value is PendingKdsCommand {
  if (!object(value) || !exactKeys(value, ["orderId", "command"]) || !id(value.orderId) || !object(value.command)) return false;
  const command = value.command;
  return exactKeys(command, ["orderItemId", "status", "expectedStatus", "idempotencyKey"]) && id(command.orderItemId)
    && typeof command.status === "string" && statuses.includes(command.status)
    && typeof command.expectedStatus === "string" && statuses.includes(command.expectedStatus)
    && typeof command.idempotencyKey === "string" && /^[A-Za-z0-9._:-]{16,128}$/.test(command.idempotencyKey);
}

export function isKdsRecoveryScope(value: unknown): value is KdsRecoveryScope {
  return object(value) && exactKeys(value, ["actorId", "storeId"]) && id(value.actorId) && id(value.storeId);
}

export function verifiedKdsAcknowledgement(response: unknown, pending: PendingKdsCommand, scope: KdsRecoveryScope): boolean {
  if (!object(response) || response.success !== true || !object(response.data) || !object(response.data.updateCafeOrderItemStatus)) return false;
  const receipt = response.data.updateCafeOrderItemStatus;
  const text = (value: unknown) => value === null || typeof value === "string";
  const instant = (value: unknown) => value === null || (typeof value === "string" && Number.isFinite(Date.parse(value)));
  if (!Number.isSafeInteger(receipt.quantity) || Number(receipt.quantity) < 1 || typeof receipt.itemNameSnapshot !== "string"
    || !text(receipt.customizationsSummary) || !text(receipt.station)
    || ![receipt.queuedAt, receipt.startedAt, receipt.readyAt, receipt.handedOffAt].every(instant)
    || !object(receipt.order) || typeof receipt.order.orderNumber !== "string" || !text(receipt.order.pickupName) || !instant(receipt.order.promisedAt)) return false;
  return receipt.id === pending.command.orderItemId && receipt.idempotencyKey === pending.command.idempotencyKey
    && receipt.expectedStatus === pending.command.expectedStatus && receipt.requestedStatus === pending.command.status
    && receipt.actorId === scope.actorId && receipt.storeId === scope.storeId
    && typeof receipt.barStatus === "string" && receipt.barStatus !== "voided" && statuses.indexOf(receipt.barStatus) >= statuses.indexOf(pending.command.status)
    && object(receipt.order) && receipt.order.id === pending.orderId
    && typeof receipt.order.status === "string" && orderStatuses.includes(receipt.order.status);
}

/** Private per-tab pre-I/O intent storage, not server durability or authorization.
 * The native command always reauthorizes. No foreign/corrupt entry is overwritten
 * or deleted. Only exact scoped successful reconciliation releases an intent.
 */
export function createKdsRecovery(scope: KdsRecoveryScope, ports: {
  storage(): StoragePort;
  dispatch(command: KdsCommand): Promise<unknown>;
  newKey(): string;
  onVerified(): void;
}) {
  const key = `coffee:kds:pending:v1:${JSON.stringify([scope.actorId, scope.storeId])}`;
  const ownScope = { ...scope };
  let state: RecoveryState = initialState;
  let initialized = false;
  let inFlight = false;
  let active = true;
  const listeners = new Set<() => void>();
  const emit = (next: RecoveryState) => { state = next; for (const listener of listeners) listener(); };
  const blocked = () => { emit({ ...state, ready: false, error: storageCopy }); return false; };
  const restore = () => {
    try {
      if (!isKdsRecoveryScope(ownScope)) return blocked();
      const bytes = ports.storage().getItem(key);
      if (bytes === null) {
        if (state.pending.length) return blocked();
        emit({ ...state, ready: true, pending: [] }); return true;
      }
      if (bytes.length > 64_000) return blocked();
      const envelope: unknown = JSON.parse(bytes);
      if (!object(envelope) || !exactKeys(envelope, ["version", "scope", "pending"]) || envelope.version !== 1 || !isKdsRecoveryScope(envelope.scope)
        || envelope.scope.actorId !== ownScope.actorId || envelope.scope.storeId !== ownScope.storeId || !Array.isArray(envelope.pending)
        || !envelope.pending.every(pendingCommand)) return blocked();
      const pending = envelope.pending;
      if (state.pending.some((original) => !pending.some((entry) => JSON.stringify(entry) === JSON.stringify(original)))) return blocked();
      if (new Set(pending.map((entry) => entry.command.orderItemId)).size !== pending.length
        || new Set(pending.map((entry) => entry.command.idempotencyKey)).size !== pending.length) return blocked();
      emit({ ...state, ready: true, pending });
      return true;
    } catch { return blocked(); }
  };
  const persist = (pending: PendingKdsCommand[]) => {
    try {
      const bytes = JSON.stringify({ version: 1, scope: ownScope, pending });
      if (bytes.length > 64_000) return blocked();
      const storage = ports.storage();
      storage.setItem(key, bytes);
      if (storage.getItem(key) !== bytes) return blocked();
      emit({ ...state, ready: true, pending });
      return true;
    } catch { return blocked(); }
  };
  const retry = async (expected: PendingKdsCommand) => {
    if (inFlight || !active) return false;
    if (!restore()) return false;
    const original = state.pending.find((entry) => entry.command.orderItemId === expected.command.orderItemId);
    if (!original || JSON.stringify(original) !== JSON.stringify(expected)) return blocked();
    inFlight = true;
    emit({ ...state, busy: original.command.orderItemId, error: null });
    try {
      // Dispatch a fresh copy so an adapter cannot mutate the retained original.
      const response = await ports.dispatch({ ...original.command });
      if (!active || !verifiedKdsAcknowledgement(response, original, ownScope)) { emit({ ...state, error: unknownCopy }); return false; }
      // A changed/unreadable entry after I/O is not evidence that it can be erased.
      if (!restore()) return false;
      const retained = state.pending.find((entry) => entry.command.orderItemId === original.command.orderItemId);
      if (!retained || JSON.stringify(retained) !== JSON.stringify(original)) return blocked();
      if (!persist(state.pending.filter((entry) => entry !== retained))) return false;
      ports.onVerified();
      return true;
    } catch { emit({ ...state, error: unknownCopy }); return false; }
    finally { inFlight = false; emit({ ...state, busy: null }); }
  };
  return {
    key, restore, retry,
    getSnapshot: () => state,
    getServerSnapshot: () => initialState,
    subscribe(listener: () => void) {
      active = true;
      listeners.add(listener);
      if (!initialized) { initialized = true; restore(); }
      return () => { listeners.delete(listener); if (listeners.size === 0) active = false; };
    },
    async start(item: KdsOrderItem) {
      if (inFlight || !active || !restore()) return false;
      const original = state.pending.find((entry) => entry.command.orderItemId === item.id);
      // Original final handoff recovery has precedence over null nextAction.
      if (original) return retry(original);
      if (!item.nextAction) return false;
      try {
        const pending = { orderId: item.order.id, command: {
          orderItemId: item.id, expectedStatus: item.barStatus, status: item.nextAction.status, idempotencyKey: ports.newKey(),
        } };
        if (!pendingCommand(pending)) return blocked();
        if (!persist([...state.pending, pending])) return false;
        return retry(pending);
      } catch { return blocked(); }
    },
  };
}
