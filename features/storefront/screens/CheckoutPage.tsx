import { CheckoutClient } from "../components/CheckoutClient";
import { StorefrontShell } from "../components/StorefrontShell";
import { getCheckoutCustomer } from "../lib/data/account";
import { getCoffeeStore } from "../lib/data/store";

export default async function CheckoutPage() {
  const [customer, store] = await Promise.all([getCheckoutCustomer().catch(() => null), getCoffeeStore().catch(() => null)]);
  return (
    <StorefrontShell cartBar={false}>
      <CheckoutClient customer={customer} hours={store ? { weeklyHours: store.weeklyHours, timezone: store.timezone } : null} onlinePayment={store?.onlinePayment === true} pickupLeadMinutes={store?.pickupLeadTimeMinutes ?? null} />
    </StorefrontShell>
  );
}
