'use server';

import { revalidatePath } from "next/cache";
import { cafeRequest } from "@/features/storefront/lib/data/cafeRequest";

const ADJUST_LOYALTY_ACCOUNT = `
  mutation AdjustCoffeeLoyaltyAccount($accountId: ID!, $pointsDelta: Int, $drinkCreditsDelta: Int, $status: String, $tier: String, $note: String!, $idempotencyKey: String!) {
    adjustCoffeeLoyaltyAccount(accountId: $accountId, pointsDelta: $pointsDelta, drinkCreditsDelta: $drinkCreditsDelta, status: $status, tier: $tier, note: $note, idempotencyKey: $idempotencyKey) {
      id status tier pointsBalance lifetimePoints drinkCredits visits
    }
  }
`;

export async function adjustLoyaltyAccountAction(input: {
  accountId: string;
  pointsDelta?: number | null;
  drinkCreditsDelta?: number | null;
  status?: string | null;
  tier?: string | null;
  note: string;
  idempotencyKey: string;
}): Promise<{ success: true } | { success: false; error: string; refused: boolean }> {
  const response = await cafeRequest<{ adjustCoffeeLoyaltyAccount: { id: string } | null }>(ADJUST_LOYALTY_ACCOUNT, {
    accountId: input.accountId,
    pointsDelta: input.pointsDelta || null,
    drinkCreditsDelta: input.drinkCreditsDelta || null,
    status: input.status || null,
    tier: input.tier || null,
    note: input.note,
    idempotencyKey: input.idempotencyKey,
  });
  if (!response.success) return { success: false, error: response.error, refused: Boolean(response.customerMessage) };
  revalidatePath("/dashboard/platform/loyalty");
  revalidatePath(`/dashboard/platform/loyalty/${input.accountId}`);
  revalidatePath("/dashboard/platform/reports");
  return { success: true };
}
