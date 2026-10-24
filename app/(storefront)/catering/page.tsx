import type { Metadata } from "next";
import CateringPage from "@/features/storefront/screens/CateringPage";
import { storefrontTitle } from "@/features/storefront/lib/data/store";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: await storefrontTitle("Catering") };
}

export default CateringPage;
