import { SubscriptionListPage } from "@/features/platform/subscriptions/screens/SubscriptionListPage";
import { SUBSCRIPTION_FILTERS, type SubscriptionFilter } from "@/features/platform/subscriptions/lib/subscriptions";

export const dynamic = "force-dynamic";

type SearchParams = { search?: string | string[]; status?: string | string[]; page?: string | string[] };

function single(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const statusParam = single(params.status);
  const status: SubscriptionFilter = (SUBSCRIPTION_FILTERS as readonly string[]).includes(statusParam) ? statusParam as SubscriptionFilter : "all";
  const page = Math.max(1, Math.min(10_000, Number.parseInt(single(params.page), 10) || 1));
  return <SubscriptionListPage search={single(params.search).trim().slice(0, 200)} status={status} page={page} />;
}
