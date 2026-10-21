import { cache } from "react";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

export type CoffeeStorefrontStore = {
  name: string;
  tagline?: string | null;
  description?: string | null;
  address?: string | null;
  phone?: string | null;
  contactEmail?: string | null;
  currencyCode: string;
  locale: string;
  timezone: string;
  brandColor: string;
  logoIcon?: string | null;
  logoColor?: string | null;
  weeklyHours?: unknown;
  pickupLeadTimeMinutes?: number | null;
};

const STORE_QUERY = `
  query CoffeeStorefrontSettings {
    getCoffeeStore {
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
    }
  }
`;

export const getCoffeeStore = cache(async function getCoffeeStore(): Promise<CoffeeStorefrontStore | null> {
  const response = await keystoneClient<{ getCoffeeStore: CoffeeStorefrontStore | null }>(
    STORE_QUERY,
    {},
    { cache: "no-store" },
  );

  if (!response.success) throw new Error(response.error);
  return response.data.getCoffeeStore ?? null;
});

export type CoffeeStoreResult =
  | { kind: "ok"; store: CoffeeStorefrontStore }
  | { kind: "unconfigured" }
  | { kind: "unavailable" };

/** Like getCoffeeStore, but a failed load is a state, so private pages (account, receipts) can still render. */
export const getCoffeeStoreResult = cache(async function getCoffeeStoreResult(): Promise<CoffeeStoreResult> {
  try {
    const store = await getCoffeeStore();
    return store ? { kind: "ok", store } : { kind: "unconfigured" };
  } catch {
    return { kind: "unavailable" };
  }
});
