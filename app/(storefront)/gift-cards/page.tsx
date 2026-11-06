import type { Metadata } from "next";
import GiftCardsPage from "@/features/storefront/screens/GiftCardsPage";
import { storefrontTitle } from "@/features/storefront/lib/data/store";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: await storefrontTitle("Gift cards") };
}

type SearchParams = Record<string, string | string[] | undefined>;
const one = (value: string | string[] | undefined) => (typeof value === "string" ? value : undefined);

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  return <GiftCardsPage card={one(params.card)} token={one(params.token)} result={one(params.result)} />;
}
