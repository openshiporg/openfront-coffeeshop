import { CheckoutClient } from "../components/CheckoutClient";
import { StorefrontShell } from "../components/StorefrontShell";

export default function CheckoutPage() {
  return (
    <StorefrontShell>
      <CheckoutClient />
    </StorefrontShell>
  );
}
