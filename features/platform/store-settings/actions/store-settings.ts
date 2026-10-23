'use server';

import { revalidatePath } from "next/cache";
import { ZodError } from "zod";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import {
  parseCoffeeStoreSettingsInput,
  type CoffeeStoreSettingsData,
  type CoffeeStoreSettingsInput,
} from "../lib/store-settings-input";

const STORE_SETTINGS_QUERY = `
  query CoffeePlatformStoreSettings {
    authenticatedItem {
      ... on User {
        id
        role { canManageSettings }
      }
    }
    storeSettings(
      where: { singletonKey: { equals: "primary" } }
      take: 1
    ) {
      id
      name
      tagline
      description
      address
      phone
      contactEmail
      currencyCode
      locale
      timezone
      brandColor
      logoIcon
      logoColor
      weeklyHours
      pickupLeadTimeMinutes
      pickupWindowMinutes
      pickupCapacityPerWindow
      taxRateBasisPoints
      updatedAt
    }
  }
`;

const UPDATE_STORE_SETTINGS = `
  mutation UpdateCoffeePlatformStoreSettings($id: ID!, $data: StoreSettingUpdateInput!) {
    store: updateStoreSetting(where: { id: $id }, data: $data) {
      id
      name
      tagline
      description
      address
      phone
      contactEmail
      currencyCode
      locale
      timezone
      brandColor
      logoIcon
      logoColor
      weeklyHours
      pickupLeadTimeMinutes
      pickupWindowMinutes
      pickupCapacityPerWindow
      taxRateBasisPoints
      updatedAt
    }
  }
`;

const CREATE_STORE_SETTINGS = `
  mutation CreateCoffeePlatformStoreSettings($data: StoreSettingCreateInput!) {
    store: createStoreSetting(data: $data) {
      id
      name
      tagline
      description
      address
      phone
      contactEmail
      currencyCode
      locale
      timezone
      brandColor
      logoIcon
      logoColor
      weeklyHours
      pickupLeadTimeMinutes
      pickupWindowMinutes
      pickupCapacityPerWindow
      taxRateBasisPoints
      updatedAt
    }
  }
`;

type StoreSettingsQuery = {
  authenticatedItem: { id: string; role?: { canManageSettings?: boolean | null } | null } | null;
  storeSettings: CoffeeStoreSettingsData[];
};

type StoreSettingsMutation = { store: CoffeeStoreSettingsData | null };

export type CoffeeStoreSettingsActionResult =
  | { success: true; data: CoffeeStoreSettingsData | null }
  | { success: false; error: string; conflict?: CoffeeStoreSettingsData | null };

export async function getCoffeeStoreSettingsAction(): Promise<CoffeeStoreSettingsActionResult> {
  const response = await keystoneClient<StoreSettingsQuery>(STORE_SETTINGS_QUERY, {}, { cache: "no-store" });

  if (!response.success) return { success: false, error: response.error };
  if (!response.data.authenticatedItem?.role?.canManageSettings) {
    return { success: false, error: "You do not have permission to manage store settings." };
  }

  return { success: true, data: response.data.storeSettings[0] ?? null };
}

export async function saveCoffeeStoreSettingsAction(
  input: CoffeeStoreSettingsInput,
  expectedUpdatedAt: string | null,
): Promise<CoffeeStoreSettingsActionResult> {
  let data;
  try {
    // brandColor is a retired palette; existing stored values are left untouched.
    const { brandColor: _retired, ...parsed } = parseCoffeeStoreSettingsInput(input);
    void _retired;
    // The tax rate is a Decimal field, sent as a string.
    data = { ...parsed, taxRateBasisPoints: parsed.taxRateBasisPoints.toFixed(2) };
  } catch (error) {
    if (error instanceof ZodError) {
      return { success: false, error: error.issues[0]?.message || "Store settings are invalid." };
    }
    return { success: false, error: "Store settings are invalid." };
  }

  const current = await getCoffeeStoreSettingsAction();
  if (!current.success) return current;

  // Saves are bound to the revision the editor loaded, so one editor cannot
  // silently overwrite another editor's newer settings.
  const currentRevision = current.data?.updatedAt ?? null;
  if (currentRevision !== (expectedUpdatedAt ?? null)) {
    return {
      success: false,
      error: current.data
        ? "These settings were changed by someone else since you opened them. Review the latest values and save again."
        : "The store was removed or reset since you opened this page. Reload and try again.",
      conflict: current.data,
    };
  }

  const response = current.data
    ? await keystoneClient<StoreSettingsMutation>(
        UPDATE_STORE_SETTINGS,
        { id: current.data.id, data },
        { cache: "no-store" },
      )
    : await keystoneClient<StoreSettingsMutation>(
        CREATE_STORE_SETTINGS,
        { data },
        { cache: "no-store" },
      );

  if (!response.success) return { success: false, error: response.error };
  if (!response.data.store) return { success: false, error: "Store settings were not saved." };

  revalidatePath("/", "layout");
  revalidatePath("/checkout");
  revalidatePath("/dashboard/platform/store-settings");
  revalidatePath("/dashboard/platform/pos");
  revalidatePath("/dashboard/platform/reports");

  return { success: true, data: response.data.store };
}
