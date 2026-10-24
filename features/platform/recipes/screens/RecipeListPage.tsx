import Link from "next/link";
import { BookOpen, CircleDashed, Search } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/features/dashboard/components/PageContainer";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { PillLink, PillTrack } from "@/features/platform/components/PillTabs";
import { PlatformEmpty, PlatformHeader } from "@/features/platform/components/PlatformPage";
import { StatusTitle } from "@/features/platform/components/StatusTitle";
import { RecipeFormSheet } from "../components/RecipeFormSheet";
import { costPerYieldCents, formatCents, formatQuantity } from "../lib/recipeMath";
import {
  RECIPE_PAGE_SIZE,
  RECIPE_STATUS_LABELS,
  RECIPE_STATUS_TONES,
  recipeStatus,
  recipesHref,
  type MenuItemOption,
  type RecipeStatusFilter,
  type StoreFormat,
} from "../lib/recipeTypes";

const LIST_QUERY = `
  query PlatformRecipeList($where: RecipeWhereInput!, $all: RecipeWhereInput!, $draft: RecipeWhereInput!, $active: RecipeWhereInput!, $archived: RecipeWhereInput!, $take: Int!, $skip: Int!) {
    authenticatedItem { ... on User { id role { canManageProducts } } }
    storeSettings(where: { singletonKey: { equals: "primary" } }, take: 1) { currencyCode locale timezone }
    recipes(where: $where, orderBy: [{ updatedAt: desc }], take: $take, skip: $skip) {
      id name status active yieldQuantity yieldUnit menuItem { id name }
    }
    filteredCount: recipesCount(where: $where)
    allCount: recipesCount(where: $all)
    draftCount: recipesCount(where: $draft)
    activeCount: recipesCount(where: $active)
    archivedCount: recipesCount(where: $archived)
  }
`;

const INGREDIENTS_QUERY = `
  query PlatformRecipeListIngredients($ids: [ID!]!) {
    ingredients(where: { recipe: { id: { in: $ids } } }, take: 2000) {
      id quantity optional recipe { id } inventoryItem { id costPerUnit }
    }
  }
`;

type ListRecipe = { id: string; name: string | null; status: string | null; active: boolean | null; yieldQuantity: string | null; yieldUnit: string | null; menuItem: MenuItemOption | null };
type ListData = {
  authenticatedItem: { id: string; role: { canManageProducts: boolean | null } | null } | null;
  storeSettings: Array<{ currencyCode: string | null; locale: string | null; timezone: string | null }>;
  recipes: ListRecipe[];
  filteredCount: number;
  allCount: number;
  draftCount: number;
  activeCount: number;
  archivedCount: number;
};
type ListIngredient = { id: string; quantity: string | null; optional: boolean | null; recipe: { id: string } | null; inventoryItem: { id: string; costPerUnit: number | null } | null };

const TABS: Array<{ value: RecipeStatusFilter; label: string; count: (data: ListData) => number }> = [
  { value: "all", label: "All", count: (data) => data.allCount },
  { value: "draft", label: "Draft", count: (data) => data.draftCount },
  { value: "active", label: "Active", count: (data) => data.activeCount },
  { value: "archived", label: "Archived", count: (data) => data.archivedCount },
];

function statusWhere(status: RecipeStatusFilter) {
  if (status === "all") return null;
  if (status === "draft") return { OR: [{ status: { equals: "draft" } }, { status: { equals: null } }] };
  return { status: { equals: status } };
}

export async function RecipeListPage({ search = "", status = "all", page = 1 }: { search?: string; status?: RecipeStatusFilter; page?: number }) {
  const term = search.trim().slice(0, 100);
  const base = term ? { OR: [{ name: { contains: term, mode: "insensitive" } }, { menuItem: { name: { contains: term, mode: "insensitive" } } }] } : {};
  const scoped = (value: RecipeStatusFilter) => {
    const filter = statusWhere(value);
    return filter ? { AND: [base, filter] } : base;
  };
  const response = await keystoneClient<ListData>(
    LIST_QUERY,
    {
      where: scoped(status),
      all: base,
      draft: scoped("draft"),
      active: scoped("active"),
      archived: scoped("archived"),
      take: RECIPE_PAGE_SIZE,
      skip: (page - 1) * RECIPE_PAGE_SIZE,
    },
    { cache: "no-store" },
  );
  const data = response.success ? response.data : null;
  const recipes = data?.recipes ?? [];
  const ingredientsResponse = recipes.length
    ? await keystoneClient<{ ingredients: ListIngredient[] }>(INGREDIENTS_QUERY, { ids: recipes.map((recipe) => recipe.id) }, { cache: "no-store" })
    : null;
  const ingredients = ingredientsResponse?.success ? ingredientsResponse.data.ingredients : [];
  const byRecipe = new Map<string, ListIngredient[]>();
  for (const ingredient of ingredients) {
    const id = ingredient.recipe?.id;
    if (!id) continue;
    byRecipe.set(id, [...(byRecipe.get(id) ?? []), ingredient]);
  }
  const store = data?.storeSettings[0];
  const format: StoreFormat = { currencyCode: store?.currencyCode || "USD", locale: store?.locale || "en-US", timezone: store?.timezone ?? null };
  const canManage = Boolean(data?.authenticatedItem?.role?.canManageProducts);
  const pageCount = data ? Math.max(1, Math.ceil(data.filteredCount / RECIPE_PAGE_SIZE)) : 1;
  const view = { search: term, status };

  const header = (
    <PlatformHeader
      title="Recipes"
      meta={data ? <span className="tabular-nums">{data.activeCount} active</span> : null}
      actions={canManage ? <RecipeFormSheet /> : null}
    />
  );

  return (
    <PageContainer
      title="Recipes"
      header={header}
      breadcrumbs={[{ type: "link", label: "Dashboard", href: "/dashboard" }, { type: "page", label: "Platform" }, { type: "page", label: "Recipes" }]}
    >
      <div className="space-y-6 px-4 pb-24 md:px-6">
        <div className="space-y-3">
          <nav aria-label="Status" className="min-w-0 max-w-full">
            <PillTrack label="Status">
              {TABS.map((tab) => (
                <PillLink key={tab.value} href={recipesHref({ ...view, status: tab.value })} active={tab.value === status} count={data ? tab.count(data) : undefined}>
                  {tab.label}
                </PillLink>
              ))}
            </PillTrack>
          </nav>
          <form method="get" role="search" className="flex max-w-xl items-center gap-2">
            {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="recipe-search" className="sr-only">Search recipes</label>
              <Input id="recipe-search" type="search" name="search" defaultValue={term} placeholder="Recipe or menu item" className="h-10 rounded-full pl-9" />
            </div>
            <Button type="submit" variant="outline" className="h-10 rounded-full">Search</Button>
            {term ? <Button asChild variant="ghost" className="h-10 rounded-full"><Link href={recipesHref({ status })}>Clear</Link></Button> : null}
          </form>
        </div>

        {!response.success ? (
          <Alert variant="destructive" role="alert">
            <AlertTitle>Unable to load recipes</AlertTitle>
            <AlertDescription>
              <div className="mt-2"><Button asChild size="sm" variant="outline"><Link href={recipesHref({ ...view, page })}>Try again</Link></Button></div>
            </AlertDescription>
          </Alert>
        ) : !recipes.length ? (
          page > 1 ? (
            <PlatformEmpty>No more recipes.</PlatformEmpty>
          ) : term ? (
            <EmptyState title="No matching recipes" description={`Nothing matches "${term}".`} icons={[Search, CircleDashed]} />
          ) : (
            <EmptyState title="No recipes" description="No recipes in this view." icons={[BookOpen, CircleDashed]} />
          )
        ) : (
          <>
            <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {recipes.map((recipe) => {
                const lines = (byRecipe.get(recipe.id) ?? []).map((line) => ({ quantity: line.quantity, optional: line.optional, costPerUnit: line.inventoryItem?.costPerUnit ?? null, inventoryItemId: line.inventoryItem?.id ?? null }));
                const state = recipeStatus(recipe);
                const cost = costPerYieldCents(lines, recipe.yieldQuantity);
                return (
                  <li key={recipe.id}>
                    <Link href={`/dashboard/platform/recipes/${recipe.id}`} className="block h-full rounded-xl border bg-card p-4 shadow-xs transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                      <StatusTitle tone={RECIPE_STATUS_TONES[state]} status={RECIPE_STATUS_LABELS[state]} className="text-base font-semibold tracking-tight">
                        {recipe.name || "Untitled recipe"}
                      </StatusTitle>
                      <p className="mt-1 truncate text-sm text-muted-foreground">{recipe.menuItem?.name || "No menu item"}</p>
                      <dl className="mt-3 grid grid-cols-3 gap-2 text-sm">
                        <div className="min-w-0">
                          <dt className="text-xs text-muted-foreground">Yield</dt>
                          <dd className="truncate tabular-nums">{formatQuantity(recipe.yieldQuantity, format.locale)} {recipe.yieldUnit}</dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="text-xs text-muted-foreground">Ingredients</dt>
                          <dd className="tabular-nums">{ingredientsResponse?.success ? lines.length : "—"}</dd>
                        </div>
                        <div className="min-w-0">
                          <dt className="truncate text-xs text-muted-foreground">Cost / {recipe.yieldUnit || "unit"}</dt>
                          <dd className="tabular-nums">{formatCents(cost, format.currencyCode, format.locale)}</dd>
                        </div>
                      </dl>
                    </Link>
                  </li>
                );
              })}
            </ul>
            {pageCount > 1 ? (
              <nav aria-label="Recipe pages" className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm tabular-nums text-muted-foreground">Page {page} of {pageCount}</span>
                <div className="flex gap-2">
                  {page > 1 ? <Button asChild size="sm" variant="outline" className="rounded-full"><Link href={recipesHref({ ...view, page: page - 1 })}>Previous</Link></Button> : null}
                  {page < pageCount ? <Button asChild size="sm" variant="outline" className="rounded-full"><Link href={recipesHref({ ...view, page: page + 1 })}>Next</Link></Button> : null}
                </div>
              </nav>
            ) : null}
          </>
        )}
      </div>
    </PageContainer>
  );
}
