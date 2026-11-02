/**
 * The effective record a StoreSetting write would leave behind. Keystone fills
 * resolvedData with `undefined` for every field the write did not send, so a plain
 * spread would erase stored values and fail the record policy on every partial
 * update (the Store Settings logo save was rejected this way).
 */
export function mergeStoreSettingRecord(
  item: Record<string, unknown> | null | undefined,
  resolvedData: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...(item ?? {}) };
  for (const [key, value] of Object.entries(resolvedData ?? {})) {
    if (value !== undefined) merged[key] = value;
  }
  return merged;
}
