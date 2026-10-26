import Link from "next/link";
import { Search } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/features/dashboard/components/PageContainer";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { PillLink, PillTrack } from "@/features/platform/components/PillTabs";
import { PlatformEmpty, PlatformHeader, PlatformTable, platformTd } from "@/features/platform/components/PlatformPage";
import { StatusDot } from "@/features/platform/components/StatusTitle";
import { cn } from "@/lib/utils";
import { RecipeFormSheet } from "../components/RecipeFormSheet";
import { costPerYieldCents, formatCents, formatQuantity, isPerServingUnit, marginFraction, pluralUnit, toNumber } from "../lib/recipeMath";
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
      id name status active yieldQuantity yieldUnit menuItem { id name price }
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
      <div className="space-y-4 px-4 pb-24 md:px-6">
        <div className="space-y-4">
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
              <Input id="recipe-search" type="search" name="search" defaultValue={term} placeholder="Recipe or menu item" className="h-9 rounded-[6px] pl-9" />
            </div>
            <Button type="submit" variant="outline" className="h-9 rounded-[6px]">Search</Button>
            {term ? <Button asChild variant="ghost" className="h-9 rounded-[6px]"><Link href={recipesHref({ status })}>Clear</Link></Button> : null}
          </form>
        </div>

        {!response.success ? (
          <Alert variant="destructive" role="alert">
            <AlertTitle>Recipes didn&apos;t load</AlertTitle>
            <AlertDescription>
              <p>Nothing was changed.</p><div className="mt-2"><Button asChild size="sm" variant="outline" className="rounded-[6px]"><Link href={recipesHref({ ...view, page })}>Try again</Link></Button></div>
            </AlertDescription>
          </Alert>
        ) : !recipes.length ? (
          page > 1 ? (
            <PlatformEmpty>No more recipes.</PlatformEmpty>
          ) : term ? (
            <PlatformEmpty>No recipes match &quot;{term}&quot;.</PlatformEmpty>
          ) : (
            <PlatformEmpty>{status === "all" ? "No recipes yet." : `No ${RECIPE_STATUS_LABELS[status].toLowerCase()} recipes.`}</PlatformEmpty>
          )
        ) : (
          <>
            <PlatformTable
              label="Recipes"
              head={[
                { label: "Recipe" },
                { label: "Status" },
                { label: "Yield", className: "hidden text-right sm:table-cell" },
                { label: "Lines", className: "hidden text-right md:table-cell" },
                { label: "Cost / serving", className: "text-right" },
                { label: "Menu price", className: "hidden text-right sm:table-cell" },
                { label: "Margin", className: "text-right" },
              ]}
            >
              {recipes.map((recipe) => {
                const lines = (byRecipe.get(recipe.id) ?? []).map((line) => ({ quantity: line.quantity, optional: line.optional, costPerUnit: line.inventoryItem?.costPerUnit ?? null, inventoryItemId: line.inventoryItem?.id ?? null }));
                const state = recipeStatus(recipe);
                const cost = costPerYieldCents(lines, recipe.yieldQuantity);
                const price = recipe.menuItem?.price ?? null;
                const margin = isPerServingUnit(recipe.yieldUnit) ? marginFraction(price, cost) : null;
                const yieldCount = toNumber(recipe.yieldQuantity);
                return (
                  <tr key={recipe.id} className="transition-colors hover:bg-muted/30">
                    <td className={cn(platformTd, "min-w-40")}>
                      <Link href={`/dashboard/platform/recipes/${recipe.id}`} className="font-medium underline-offset-4 hover:underline focus-visible:underline [overflow-wrap:anywhere]">{recipe.name || "Untitled recipe"}</Link>
                      <p className="truncate text-xs text-muted-foreground">{recipe.menuItem?.name || "No menu item"}</p>
                    </td>
                    <td className={cn(platformTd, "whitespace-nowrap")}><span className="inline-flex items-center gap-2"><StatusDot tone={RECIPE_STATUS_TONES[state]} />{RECIPE_STATUS_LABELS[state]}</span></td>
                    <td className={cn(platformTd, "hidden whitespace-nowrap text-right tabular-nums text-muted-foreground sm:table-cell")}>{formatQuantity(recipe.yieldQuantity, format.locale)} {pluralUnit(recipe.yieldUnit, yieldCount)}</td>
                    <td className={cn(platformTd, "hidden text-right tabular-nums text-muted-foreground md:table-cell")}>{ingredientsResponse?.success ? lines.length : "—"}</td>
                    <td className={cn(platformTd, "whitespace-nowrap text-right font-medium tabular-nums")}>
                      {formatCents(cost, format.currencyCode, format.locale)}
                      {cost !== null && recipe.yieldUnit && recipe.yieldUnit !== "serving" ? <span className="font-normal text-muted-foreground"> / {recipe.yieldUnit}</span> : null}
                    </td>
                    <td className={cn(platformTd, "hidden whitespace-nowrap text-right tabular-nums sm:table-cell")}>{formatCents(price, format.currencyCode, format.locale)}</td>
                    <td className={cn(platformTd, "whitespace-nowrap text-right tabular-nums", margin !== null && margin < 0.6 && "font-medium text-amber-700 dark:text-amber-400")}>
                      {margin === null ? <span className="text-muted-foreground">—</span> : `${Math.round(margin * 100)}%`}
                    </td>
                  </tr>
                );
              })}
            </PlatformTable>
            {pageCount > 1 ? (
              <nav aria-label="Recipe pages" className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm tabular-nums text-muted-foreground">Page {page} of {pageCount}</span>
                <div className="flex gap-2">
                  {page > 1 ? <Button asChild size="sm" variant="outline" className="rounded-[6px]"><Link href={recipesHref({ ...view, page: page - 1 })}>Previous</Link></Button> : null}
                  {page < pageCount ? <Button asChild size="sm" variant="outline" className="rounded-[6px]"><Link href={recipesHref({ ...view, page: page + 1 })}>Next</Link></Button> : null}
                </div>
              </nav>
            ) : null}
          </>
        )}
      </div>
    </PageContainer>
  );
}
