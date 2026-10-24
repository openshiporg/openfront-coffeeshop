import { RecipeListPage } from "@/features/platform/recipes/screens/RecipeListPage";
import { RECIPE_STATUS_FILTERS, type RecipeStatusFilter } from "@/features/platform/recipes/lib/recipeTypes";

export const dynamic = "force-dynamic";

type SearchParams = { search?: string | string[]; status?: string | string[]; page?: string | string[] };

function single(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const statusParam = single(params.status);
  const status: RecipeStatusFilter = (RECIPE_STATUS_FILTERS as readonly string[]).includes(statusParam) ? statusParam as RecipeStatusFilter : "all";
  const page = Math.min(10_000, Math.max(1, Math.floor(Number(single(params.page))) || 1));
  return <RecipeListPage search={single(params.search)} status={status} page={page} />;
}
