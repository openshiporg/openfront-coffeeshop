import type { Metadata } from "next";
import AccountPage from "@/features/storefront/screens/AccountPage";
import { storefrontTitle } from "@/features/storefront/lib/data/store";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: await storefrontTitle("Your account") };
}

export default AccountPage;
