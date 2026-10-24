import type { Metadata } from "next";
import CheckoutPage from "@/features/storefront/screens/CheckoutPage";
import { storefrontTitle } from "@/features/storefront/lib/data/store";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: await storefrontTitle("Checkout") };
}

export default CheckoutPage;
