"use server";

import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

export type CafeLoyaltyAccount = {
  id: string;
  customerName?: string | null;
  customerEmail: string;
  customerPhone?: string | null;
  status?: string | null;
  tier?: string | null;
  pointsBalance: number;
  lifetimePoints?: number | null;
  drinkCredits: number;
  visits?: number | null;
  lastVisitAt?: string | null;
  nextRewardProgress?: number | null;
};

const LOOKUP_LOYALTY_QUERY = `
  query LookupCafeLoyalty($email: String!, $orderId: ID, $secretKey: String) {
    getCafeLoyaltyAccount(email: $email, orderId: $orderId, secretKey: $secretKey) {
      id customerName customerEmail customerPhone status tier pointsBalance lifetimePoints drinkCredits visits lastVisitAt nextRewardProgress
    }
  }
`;

const APPLY_LOYALTY_MUTATION = `
  mutation ApplyCafeLoyalty(
    $orderId: ID!
    $secretKey: String
    $customerEmail: String!
    $customerName: String
    $customerPhone: String
    $redeemDrinkCredit: Boolean
  ) {
    applyCafeLoyalty(
      orderId: $orderId
      secretKey: $secretKey
      customerEmail: $customerEmail
      customerName: $customerName
      customerPhone: $customerPhone
      redeemDrinkCredit: $redeemDrinkCredit
    ) {
      id
      customerName
      customerEmail
      status
      tier
      pointsBalance
      lifetimePoints
      drinkCredits
      visits
      nextRewardProgress
    }
  }
`;

export async function lookupCafeLoyalty(email: string, orderId?: string, secretKey?: string) {
  const response = await keystoneClient<{ getCafeLoyaltyAccount: CafeLoyaltyAccount | null }>(
    LOOKUP_LOYALTY_QUERY,
    { email, orderId, secretKey },
    { cache: "no-store" }
  );
  if (!response.success) return { success: false as const, error: response.error };
  return { success: true as const, account: response.data.getCafeLoyaltyAccount };
}

export async function applyCafeLoyalty(input: {
  orderId: string;
  secretKey?: string;
  customerEmail: string;
  customerName?: string;
  customerPhone?: string;
  redeemDrinkCredit?: boolean;
}) {
  const response = await keystoneClient<{ applyCafeLoyalty: CafeLoyaltyAccount }>(APPLY_LOYALTY_MUTATION, input, { cache: "no-store" });
  if (!response.success) return { success: false as const, error: response.error };
  return { success: true as const, account: response.data.applyCafeLoyalty };
}
