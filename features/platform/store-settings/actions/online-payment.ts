'use server';

import { revalidatePath } from "next/cache";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { stripeKeysPresent } from "@/features/keystone/lib/onlinePayment";

const ONLINE_PAYMENT_QUERY = `
  query CoffeeOnlinePaymentSetting {
    authenticatedItem { ... on User { role { canManagePayments } } }
    paymentProviders(where: { code: { equals: "pp_stripe_stripe" } }, take: 1) { id isInstalled }
  }
`;

const SET_INSTALLED = `
  mutation SetCoffeeOnlinePayment($id: ID!, $isInstalled: Boolean!) {
    updatePaymentProvider(where: { id: $id }, data: { isInstalled: $isInstalled }) { id isInstalled }
  }
`;

type OnlinePaymentState = { providerId: string | null; enabled: boolean; keysPresent: boolean; canManage: boolean };

/** Card payments on the storefront: the merchant's switch, and whether the server holds the Stripe keys. */
export async function getOnlinePaymentSetting(): Promise<OnlinePaymentState | null> {
  const response = await keystoneClient<{ authenticatedItem: { role?: { canManagePayments?: boolean } | null } | null; paymentProviders: Array<{ id: string; isInstalled: boolean }> }>(ONLINE_PAYMENT_QUERY, {}, { cache: "no-store" });
  if (!response.success) return null;
  const provider = response.data.paymentProviders[0];
  const canManage = response.data.authenticatedItem?.role?.canManagePayments === true;
  // Roles that can't see payment providers don't get the section at all.
  if (!provider && !canManage) return null;
  return {
    providerId: provider?.id ?? null,
    enabled: provider?.isInstalled === true,
    keysPresent: stripeKeysPresent(),
    canManage,
  };
}

export async function setOnlinePaymentEnabled(providerId: string, enabled: boolean) {
  const response = await keystoneClient<{ updatePaymentProvider: { id: string; isInstalled: boolean } | null }>(SET_INSTALLED, { id: providerId, isInstalled: enabled }, { cache: "no-store" });
  revalidatePath("/dashboard/platform/store-settings");
  revalidatePath("/checkout");
  return response.success ? { success: true as const } : { success: false as const, error: response.error };
}
