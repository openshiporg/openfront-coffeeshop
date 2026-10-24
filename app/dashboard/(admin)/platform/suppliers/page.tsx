import { SupplierListPage } from "@/features/platform/suppliers/screens/SupplierListPage";
import { SUPPLIER_STATUS_FILTERS, type SupplierStatusFilter } from "@/features/platform/suppliers/lib/suppliers";
import { parsePage } from "@/features/platform/inventory/lib/inventory";

export const dynamic = "force-dynamic";

type SearchParams = { search?: string | string[]; status?: string | string[]; page?: string | string[] };

function single(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const statusParam = single(params.status);
  const status: SupplierStatusFilter = (SUPPLIER_STATUS_FILTERS as readonly string[]).includes(statusParam) ? statusParam as SupplierStatusFilter : "all";
  return <SupplierListPage view={{ search: single(params.search).trim().slice(0, 200), status, page: parsePage(single(params.page)) }} />;
}
