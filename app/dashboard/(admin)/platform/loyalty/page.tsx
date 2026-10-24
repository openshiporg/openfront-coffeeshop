import { LoyaltyListPage } from "@/features/platform/loyalty/screens/LoyaltyListPage";
import { parseLoyaltyListView } from "@/features/platform/loyalty/lib/loyaltyView";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <LoyaltyListPage view={parseLoyaltyListView(await searchParams)} />;
}
