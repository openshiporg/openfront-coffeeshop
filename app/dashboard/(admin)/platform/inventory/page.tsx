import { InventoryListPage } from "@/features/platform/inventory/screens/InventoryListPage";
import { INVENTORY_CATEGORIES, parsePage, STOCK_FILTERS, type StockFilter } from "@/features/platform/inventory/lib/inventory";

export const dynamic = "force-dynamic";

type SearchParams = { search?: string | string[]; category?: string | string[]; stock?: string | string[]; page?: string | string[] };

function single(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const stockParam = single(params.stock);
  const categoryParam = single(params.category);
  const stock: StockFilter = (STOCK_FILTERS as readonly string[]).includes(stockParam) ? stockParam as StockFilter : "all";
  const category = INVENTORY_CATEGORIES.some((option) => option.value === categoryParam) ? categoryParam : "";
  return <InventoryListPage view={{ search: single(params.search).trim().slice(0, 200), category, stock, page: parsePage(single(params.page)) }} />;
}
