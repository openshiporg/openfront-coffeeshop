"use client";

import * as React from "react";

import type { MenuActionResult } from "../types";

type PendingCommand = { fingerprint: string; key: string };

const STORAGE_KEY = "coffee-menu-pending-commands";
const UNKNOWN_OUTCOME = "We couldn't confirm whether this change was saved. Your entries are kept; saving again is safe and will not apply it twice.";
const ENTRY_BUSY = "Another change to this entry is still saving. Wait for it to finish.";

function readStored(): Map<string, PendingCommand> {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) as Record<string, PendingCommand> : {};
    return new Map(Object.entries(parsed).filter(([, value]) => typeof value?.key === "string" && typeof value?.fingerprint === "string"));
  } catch {
    return new Map();
  }
}

function writeStored(commands: Map<string, PendingCommand>) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(commands)));
  } catch {}
}

function newKey() {
  return `menu-${crypto.randomUUID()}`;
}

/** One retained command key per logical menu operation. The same request reuses its
 * key after a failed or unconfirmed reply (also across a reload, via sessionStorage), so
 * the server returns the original receipt instead of applying it again. A changed request
 * gets a new key; a key is dropped only after a confirmed success. Writers for one entry
 * are serialized while a save is in flight.
 */
export function useMenuCommands() {
  const pending = React.useRef<Map<string, PendingCommand> | null>(null);
  const inFlight = React.useRef(new Set<string>());
  const [busy, setBusy] = React.useState<ReadonlySet<string>>(() => new Set());

  const commands = React.useCallback(() => {
    if (!pending.current) pending.current = readStored();
    return pending.current;
  }, []);

  const run = React.useCallback(async (
    entityId: string,
    operationId: string,
    request: unknown,
    send: (idempotencyKey: string) => Promise<MenuActionResult>,
  ): Promise<MenuActionResult> => {
    if (inFlight.current.has(entityId)) return { success: false, error: ENTRY_BUSY };
    const store = commands();
    const fingerprint = JSON.stringify(request);
    const existing = store.get(operationId);
    const key = existing && existing.fingerprint === fingerprint ? existing.key : newKey();
    store.set(operationId, { fingerprint, key });
    writeStored(store);

    inFlight.current.add(entityId);
    setBusy(new Set(inFlight.current));
    let result: MenuActionResult;
    try {
      result = await send(key);
    } catch {
      result = { success: false, error: UNKNOWN_OUTCOME };
    } finally {
      inFlight.current.delete(entityId);
      setBusy(new Set(inFlight.current));
    }
    if (result.success && store.get(operationId)?.key === key) {
      store.delete(operationId);
      writeStored(store);
    }
    return result;
  }, [commands]);

  return { run, isBusy: (entityId: string) => busy.has(entityId) };
}

export type MenuCommands = ReturnType<typeof useMenuCommands>;
