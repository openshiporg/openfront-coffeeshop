/**
 * When a signed-in customer may be attached to a rewards account (LoyaltyAccount.customer).
 * Rewards are keyed by email; the user link is added when the user's own sign-in email is
 * the account email, the account has no other owner, and the user has no other account.
 * Email lookup stays the fallback for accounts that are never linked.
 */
export type LoyaltyLinkDecision = "link" | "linked" | "skip";

export function normalizeLoyaltyEmail(email?: string | null) {
  return email?.trim().toLowerCase() || null;
}

export function loyaltyLinkDecision(input: {
  account: { id: string; customerId?: string | null; customerEmail?: string | null } | null;
  user: { id: string; email?: string | null; loyaltyAccountId?: string | null } | null;
}): LoyaltyLinkDecision {
  const { account, user } = input;
  if (!account || !user?.id) return "skip";
  if (account.customerId) return account.customerId === user.id ? "linked" : "skip";
  const email = normalizeLoyaltyEmail(user.email);
  if (!email || email !== normalizeLoyaltyEmail(account.customerEmail)) return "skip";
  // One account per user (customerId is unique); never move a user off their existing account.
  if (user.loyaltyAccountId && user.loyaltyAccountId !== account.id) return "skip";
  return "link";
}
