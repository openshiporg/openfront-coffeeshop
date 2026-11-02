/** A pickup request already paid online is accepted straight to paid; only unpaid ones wait for pay-at-pickup. */
export function acceptPickupLabel(paid: boolean) {
  return paid ? "Accept pickup" : "Accept unpaid pickup";
}
