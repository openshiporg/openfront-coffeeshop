import { GiftCardListPage } from "@/features/platform/gift-cards/screens/GiftCardListPage";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  return <GiftCardListPage search={typeof params.search === "string" ? params.search.slice(0, 120) : ""} />;
}
