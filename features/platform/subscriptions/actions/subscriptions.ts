'use server';

import { revalidatePath } from "next/cache";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { cafeRequest } from "@/features/storefront/lib/data/cafeRequest";
import { loadStoreRecord } from "@/features/platform/catering/lib/store-context";
import { parseDollars, recordNumber, storeDateToInstant } from "@/features/platform/catering/lib/store-time";
import { BILLING_INTERVALS, SUBSCRIPTION_NEXT, type LoyaltyAccountOption, type SubscriptionActionResult, type SubscriptionInput } from "../lib/subscriptions";

const ACCOUNT_SEARCH = `
  query PlatformSubscriptionAccounts($where: LoyaltyAccountWhereInput!) {
    loyaltyAccounts(where: $where, orderBy: [{ updatedAt: desc }], take: 20) { id displayName customerEmail }
  }
`;
const CREATE_SUBSCRIPTION = `
  mutation PlatformCreateSubscription($data: SubscriptionCreateInput!) {
    createSubscription(data: $data) { id subscriptionNumber }
  }
`;
const SUBSCRIPTION_STATE = `
  query PlatformSubscriptionState($id: ID!) { subscription(where: { id: $id }) { id status } }
`;
const UPDATE_STATUS = `
  mutation PlatformSubscriptionStatus($subscriptionId: ID!, $status: String!) {
    updateSubscriptionStatus(subscriptionId: $subscriptionId, status: $status) { id status cancelledAt }
  }
`;

export async function searchLoyaltyAccountsAction(search: string): Promise<{ success: true; accounts: LoyaltyAccountOption[] } | { success: false; error: string }> {
  const term = search.trim().slice(0, 100);
  const contains = { contains: term, mode: "insensitive" };
  const where = term ? { OR: [{ customerEmail: contains }, { customerName: contains }] } : {};
  const response = await keystoneClient<{ loyaltyAccounts: LoyaltyAccountOption[] }>(ACCOUNT_SEARCH, { where }, { cache: "no-store" });
  if (!response.success) return { success: false, error: response.error };
  return { success: true, accounts: response.data.loyaltyAccounts };
}

export async function createSubscriptionAction(input: SubscriptionInput): Promise<SubscriptionActionResult> {
  if (!input.loyaltyAccountId) return { success: false, error: "Choose a loyalty account.", field: "loyaltyAccountId" };
  const planName = input.planName.trim();
  if (!planName) return { success: false, error: "Plan name is required.", field: "planName" };
  if (planName.length > 120) return { success: false, error: "Plan name is too long.", field: "planName" };
  if (!(BILLING_INTERVALS as readonly string[]).includes(input.billingInterval)) return { success: false, error: "Choose an interval.", field: "billingInterval" };
  const price = parseDollars(input.price);
  if (!price.ok) return { success: false, error: price.error, field: "price" };
  const store = await loadStoreRecord();
  const startsAt = storeDateToInstant(input.startsOn, store.timezone);
  if (!startsAt.ok) return { success: false, error: "Enter a valid start date.", field: "startsOn" };
  const renewsAt = storeDateToInstant(input.renewsOn, store.timezone);
  if (!renewsAt.ok) return { success: false, error: "Enter a valid renewal date.", field: "renewsOn" };
  if (renewsAt.iso <= startsAt.iso) return { success: false, error: "Renewal must be after the start date.", field: "renewsOn" };

  const response = await cafeRequest<{ createSubscription: { id: string } }>(CREATE_SUBSCRIPTION, {
    data: {
      subscriptionNumber: recordNumber("SUB", store.timezone),
      loyaltyAccount: { connect: { id: input.loyaltyAccountId } },
      planName,
      billingInterval: input.billingInterval,
      priceCents: price.cents,
      startsAt: startsAt.iso,
      renewsAt: renewsAt.iso,
    },
  });
  if (!response.success) return { success: false, error: response.error };
  revalidatePath("/dashboard/platform/subscriptions");
  return { success: true, id: response.data.createSubscription.id };
}

export async function transitionSubscriptionAction(id: string, status: string): Promise<SubscriptionActionResult> {
  const state = await keystoneClient<{ subscription: { id: string; status: string } | null }>(SUBSCRIPTION_STATE, { id }, { cache: "no-store" });
  const current = state.success ? state.data.subscription : null;
  if (!current) return { success: false, error: "Subscription not found." };
  if (!(SUBSCRIPTION_NEXT[current.status] || []).includes(status)) return { success: false, error: "That change isn't allowed from the current status." };
  const response = await cafeRequest(UPDATE_STATUS, { subscriptionId: id, status });
  if (!response.success) return { success: false, error: response.error };
  revalidatePath("/dashboard/platform/subscriptions");
  revalidatePath(`/dashboard/platform/subscriptions/${id}`);
  return { success: true };
}
