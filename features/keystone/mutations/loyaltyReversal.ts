/**
 * Balance after a full refund takes back the points an order earned. Points and saved drink
 * credits (100 points each) are pooled, the earning is removed, and the pool is split again.
 * Inconsistent or already-spent history is never clamped: it returns an error for reconciliation.
 */
export type LoyaltyBalance = { pointsBalance: number; drinkCredits: number; lifetimePoints: number; visits: number };

export function reverseLoyaltyEarning(current: LoyaltyBalance, earnedPoints: number):
  | { ok: true; next: LoyaltyBalance; drinkCreditsDelta: number }
  | { ok: false; error: string } {
  const points = Number(earnedPoints);
  const lifetimePoints = Number(current.lifetimePoints || 0);
  const visits = Number(current.visits || 0);
  if (!Number.isSafeInteger(points) || points < 0 || lifetimePoints < points || visits < 1) {
    return { ok: false, error: "Loyalty history requires reconciliation before refund" };
  }
  const drinkCredits = Number(current.drinkCredits || 0);
  const remaining = Number(current.pointsBalance || 0) + drinkCredits * 100 - points;
  if (remaining < 0) return { ok: false, error: "Spent loyalty rewards require a manual refund reconciliation" };
  const credits = Math.floor(remaining / 100);
  return {
    ok: true,
    next: { pointsBalance: remaining % 100, drinkCredits: credits, lifetimePoints: lifetimePoints - points, visits: visits - 1 },
    drinkCreditsDelta: credits - drinkCredits,
  };
}
