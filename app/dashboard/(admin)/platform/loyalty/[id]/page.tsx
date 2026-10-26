import { LoyaltyDetailPage } from "@/features/platform/loyalty/screens/LoyaltyDetailPage";
import { parsePage } from "@/features/platform/loyalty/lib/loyaltyView";

export const dynamic = "force-dynamic";

type SearchParams = { eventsPage?: string | string[]; ordersPage?: string | string[]; adjust?: string | string[] };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <LoyaltyDetailPage id={id} eventsPage={parsePage(query.eventsPage)} ordersPage={parsePage(query.ordersPage)} adjust={query.adjust === "1"} />;
}
