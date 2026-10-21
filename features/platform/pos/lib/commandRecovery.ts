import type { PosCommand, PosRecoveryScope } from "../types";

/** Per-operator, per-store retained original command. Storage failure blocks dispatch
 * (fail closed) so a command is never sent without a recoverable key and body.
 */
function storageKey(scope: PosRecoveryScope) {
  return `coffee-pos:pending:v1:${scope.storeId}:${scope.actorId}`;
}

function isCommand(value: unknown): value is PosCommand {
  if (!value || typeof value !== "object") return false;
  const command = value as Record<string, unknown>;
  return ["sale", "open", "movement", "close"].includes(String(command.kind))
    && typeof command.key === "string" && command.key.length >= 16
    && !!command.request && typeof command.request === "object";
}

export type PendingRead = { ok: true; command: PosCommand | null } | { ok: false };

export function readPendingPosCommand(scope: PosRecoveryScope): PendingRead {
  try {
    const raw = window.sessionStorage.getItem(storageKey(scope));
    if (!raw) return { ok: true, command: null };
    const parsed: unknown = JSON.parse(raw);
    return isCommand(parsed) ? { ok: true, command: parsed } : { ok: false };
  } catch {
    return { ok: false };
  }
}

export function retainPendingPosCommand(scope: PosRecoveryScope, command: PosCommand): boolean {
  try {
    window.sessionStorage.setItem(storageKey(scope), JSON.stringify(command));
    const check = readPendingPosCommand(scope);
    return check.ok && check.command?.key === command.key;
  } catch {
    return false;
  }
}

/** Releases only the command with this key; another attempt is never cleared. */
export function releasePendingPosCommand(scope: PosRecoveryScope, key: string) {
  try {
    const current = readPendingPosCommand(scope);
    if (current.ok && current.command?.key === key) window.sessionStorage.removeItem(storageKey(scope));
  } catch {
    // Leaving the record is the safe outcome; it can be discarded explicitly.
  }
}
