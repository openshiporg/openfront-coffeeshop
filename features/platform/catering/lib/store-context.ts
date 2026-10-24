import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { validTimeZone } from "./store-time";

export type StoreRecord = { id: string | null; timezone: string; currencyCode: string };

const STORE_SETTINGS_QUERY = `
  query PlatformRecordStore {
    storeSettings(where: { singletonKey: { equals: "primary" } }, take: 1) { id timezone currencyCode }
  }
`;
const PUBLIC_STORE_QUERY = `query PlatformRecordStoreTimezone { getCoffeeStore { timezone currencyCode } }`;

/** Primary store id (only readable with settings access), time zone and currency. */
export async function loadStoreRecord(): Promise<StoreRecord> {
  const [settings, store] = await Promise.all([
    keystoneClient<{ storeSettings: Array<{ id: string; timezone: string | null; currencyCode: string | null }> }>(STORE_SETTINGS_QUERY, {}, { cache: "no-store" }),
    keystoneClient<{ getCoffeeStore: { timezone: string; currencyCode: string } | null }>(PUBLIC_STORE_QUERY, {}, { cache: "no-store" }),
  ]);
  const primary = settings.success ? settings.data.storeSettings[0] ?? null : null;
  const fallback = store.success ? store.data.getCoffeeStore : null;
  return {
    id: primary?.id ?? null,
    timezone: validTimeZone(primary?.timezone) || validTimeZone(fallback?.timezone) || "UTC",
    currencyCode: primary?.currencyCode || fallback?.currencyCode || "USD",
  };
}

type RoleFlags = { canReadOrders?: boolean | null; canManageOrders?: boolean | null; canReadLoyalty?: boolean | null; canManageLoyalty?: boolean | null };

export async function loadRoleFlags(): Promise<RoleFlags> {
  const response = await keystoneClient<{ authenticatedItem: { role?: RoleFlags | null } | null }>(`
    query PlatformRecordRole {
      authenticatedItem { ... on User { role { canReadOrders canManageOrders canReadLoyalty canManageLoyalty } } }
    }
  `, {}, { cache: "no-store" });
  return response.success ? response.data.authenticatedItem?.role ?? {} : {};
}
