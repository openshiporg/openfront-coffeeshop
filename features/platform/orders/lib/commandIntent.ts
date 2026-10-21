/** One retry key per logical order command, kept in this tab's session storage so a lost
 * response or reload retries the same request instead of starting a new one. It is cleared
 * only after a verified success or when the operator explicitly changes the request.
 */
export type StoredCommandIntent<T extends Record<string, unknown> = Record<string, unknown>> = T & { idempotencyKey: string };

export function readCommandIntent<T extends Record<string, unknown>>(storageKey: string): StoredCommandIntent<T> | null {
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || typeof (parsed as { idempotencyKey?: unknown }).idempotencyKey !== "string") return null;
    return parsed as StoredCommandIntent<T>;
  } catch {
    return null;
  }
}

export function writeCommandIntent<T extends Record<string, unknown>>(storageKey: string, intent: StoredCommandIntent<T>) {
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify(intent));
  } catch {
    // Storage unavailable: the in-memory key still covers retries on this page.
  }
}

export function clearCommandIntent(storageKey: string) {
  try {
    window.sessionStorage.removeItem(storageKey);
  } catch {
    // Nothing to clear.
  }
}

export function newCommandKey() {
  return crypto.randomUUID();
}
