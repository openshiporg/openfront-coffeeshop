import { SupplierDetailPage } from "@/features/platform/suppliers/screens/SupplierDetailPage";
import { PO_STATUS_FILTERS, type PoStatusFilter } from "@/features/platform/suppliers/lib/suppliers";
import { parsePage } from "@/features/platform/inventory/lib/inventory";

export const dynamic = "force-dynamic";

type SearchParams = { po?: string | string[]; poPage?: string | string[] };

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  const poParam = typeof query.po === "string" ? query.po : "";
  const po: PoStatusFilter = (PO_STATUS_FILTERS as readonly string[]).includes(poParam) ? poParam as PoStatusFilter : "all";
  return <SupplierDetailPage id={id} view={{ po, poPage: parsePage(typeof query.poPage === "string" ? query.poPage : undefined) }} />;
}
