import { CateringListPage } from "@/features/platform/catering/screens/CateringListPage";
import { CATERING_FILTERS, type CateringFilter } from "@/features/platform/catering/lib/catering";

export const dynamic = "force-dynamic";

type SearchParams = { search?: string | string[]; status?: string | string[]; page?: string | string[] };

function single(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const statusParam = single(params.status);
  const status: CateringFilter = (CATERING_FILTERS as readonly string[]).includes(statusParam) ? statusParam as CateringFilter : "upcoming";
  const page = Math.max(1, Math.min(10_000, Number.parseInt(single(params.page), 10) || 1));
  return <CateringListPage search={single(params.search).trim().slice(0, 200)} status={status} page={page} />;
}
