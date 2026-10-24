import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/features/dashboard/components/PageContainer";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { formatStoreDateTime } from "@/lib/date-time";
import { PlatformEmpty, PlatformHeader, PlatformSection } from "@/features/platform/components/PlatformPage";
import { StatusDot, StatusTitle } from "@/features/platform/components/StatusTitle";
import { IngredientsPanel } from "../components/IngredientsPanel";
import { RecipeFormSheet } from "../components/RecipeFormSheet";
import { RecipeStatusActions } from "../components/RecipeStatusActions";
import { costPerYieldCents, formatCents, formatQuantity, servingsFromStock } from "../lib/recipeMath";
import {
  PREP_BATCH_STATUS_LABELS,
  PREP_BATCH_STATUS_TONES,
  RECIPE_STATUS_LABELS,
  RECIPE_STATUS_TONES,
  recipeStatus,
  type IngredientRow,
  type PrepBatchRow,
  type RecipeDetail,
  type StoreFormat,
} from "../lib/recipeTypes";

const DETAIL_QUERY = `
  query PlatformRecipeDetail($id: ID!) {
    authenticatedItem { ... on User { id role { canManageProducts } } }
    storeSettings(where: { singletonKey: { equals: "primary" } }, take: 1) { currencyCode locale timezone }
    recipe(where: { id: $id }) {
      id name status active yieldQuantity yieldUnit prepInstructions allergenNotes updatedAt
      store { id }
      menuItem { id name }
    }
    ingredients(where: { recipe: { id: { equals: $id } } }, orderBy: [{ createdAt: asc }], take: 200) {
      id name quantity unit optional notes
      inventoryItem { id name unit currentStock costPerUnit }
    }
    prepBatches(where: { recipe: { id: { equals: $id } } }, orderBy: [{ createdAt: desc }], take: 10) {
      id batchNumber status quantityMade quantityRemaining expiresAt completedAt
    }
    prepBatchesCount(where: { recipe: { id: { equals: $id } } })
  }
`;

const OTHER_ACTIVE_QUERY = `
  query PlatformRecipeOtherActive($where: RecipeWhereInput!) {
    recipes(where: $where, take: 10) { id name }
  }
`;

type DetailData = {
  authenticatedItem: { id: string; role: { canManageProducts: boolean | null } | null } | null;
  storeSettings: Array<{ currencyCode: string | null; locale: string | null; timezone: string | null }>;
  recipe: RecipeDetail | null;
  ingredients: IngredientRow[];
  prepBatches: PrepBatchRow[];
  prepBatchesCount: number;
};

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border bg-card px-4 py-3">
      <dt className="truncate text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-lg font-semibold tabular-nums">{children}</dd>
    </div>
  );
}

export async function RecipeDetailPage({ id }: { id: string }) {
  const response = await keystoneClient<DetailData>(DETAIL_QUERY, { id }, { cache: "no-store" });
  const breadcrumbs = [
    { type: "link" as const, label: "Dashboard", href: "/dashboard" },
    { type: "page" as const, label: "Platform" },
    { type: "link" as const, label: "Recipes", href: "/dashboard/platform/recipes" },
  ];

  if (!response.success) {
    return (
      <PageContainer title="Recipe" breadcrumbs={[...breadcrumbs, { type: "page", label: "Recipe" }]}>
        <div className="px-4 md:px-6">
          <Alert variant="destructive" role="alert">
            <AlertTitle>Unable to load recipe</AlertTitle>
            <AlertDescription>
              <div className="mt-2"><Button asChild size="sm" variant="outline"><Link href={`/dashboard/platform/recipes/${id}`}>Try again</Link></Button></div>
            </AlertDescription>
          </Alert>
        </div>
      </PageContainer>
    );
  }

  const data = response.data;
  const recipe = data.recipe;
  if (!recipe) notFound();

  const store = data.storeSettings[0];
  const format: StoreFormat = { currencyCode: store?.currencyCode || "USD", locale: store?.locale || "en-US", timezone: store?.timezone ?? null };
  const canManage = Boolean(data.authenticatedItem?.role?.canManageProducts);
  const state = recipeStatus(recipe);
  const unit = recipe.yieldUnit || "unit";
  const lines = data.ingredients.map((row) => ({
    quantity: row.quantity,
    optional: row.optional,
    costPerUnit: row.inventoryItem?.costPerUnit ?? null,
    inventoryItemId: row.inventoryItem?.id ?? null,
    currentStock: row.inventoryItem?.currentStock ?? null,
  }));
  const cost = costPerYieldCents(lines, recipe.yieldQuantity);
  const servings = servingsFromStock(lines, recipe.yieldQuantity);

  const otherActive = state === "active" && recipe.menuItem
    ? await keystoneClient<{ recipes: Array<{ id: string; name: string | null }> }>(
        OTHER_ACTIVE_QUERY,
        { where: { menuItem: { id: { equals: recipe.menuItem.id } }, status: { equals: "active" }, active: { equals: true }, NOT: [{ id: { equals: recipe.id } }] } },
        { cache: "no-store" },
      )
    : null;
  const conflicts = otherActive?.success ? otherActive.data.recipes : [];

  const header = (
    <PlatformHeader
      title={(
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
          <span className="inline-flex min-w-0 items-start gap-2.5">
            <span className="inline-flex h-[1lh] shrink-0 items-center"><StatusDot tone={RECIPE_STATUS_TONES[state]} className="size-2.5 translate-y-0" /></span>
            <span className="min-w-0 [overflow-wrap:anywhere]">{recipe.name || "Untitled recipe"}</span>
          </span>
          <span className="text-sm font-medium text-muted-foreground">{RECIPE_STATUS_LABELS[state]}</span>
        </span>
      )}
      meta={(
        <>
          <span>{recipe.menuItem?.name || "No menu item"}</span>
          <span className="tabular-nums">Yield {formatQuantity(recipe.yieldQuantity, format.locale)} {recipe.yieldUnit}</span>
          {state === "active" && recipe.active === false ? <span className="text-destructive">Not selling</span> : null}
          {recipe.updatedAt ? <span>Updated {formatStoreDateTime(recipe.updatedAt, format.timezone)}</span> : null}
        </>
      )}
      actions={canManage ? <RecipeFormSheet recipe={recipe} /> : null}
    />
  );

  return (
    <PageContainer title={recipe.name || "Recipe"} header={header} breadcrumbs={[...breadcrumbs, { type: "page", label: recipe.name || "Recipe" }]}>
      <div className="space-y-8 px-4 pb-24 md:px-6">
        <RecipeStatusActions recipeId={recipe.id} status={state} menuItemName={recipe.menuItem?.name ?? null} ingredientCount={data.ingredients.length} canManage={canManage} />

        {conflicts.length ? (
          <Alert variant="destructive" role="alert">
            <AlertTitle>Multiple active recipes for {recipe.menuItem?.name}</AlertTitle>
            <AlertDescription>
              <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                {conflicts.map((other) => (
                  <li key={other.id}>
                    <Link href={`/dashboard/platform/recipes/${other.id}`} className="inline-flex items-center gap-1 underline underline-offset-2">
                      {other.name || "Untitled"}<ArrowUpRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        ) : null}

        <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Fact label={`Cost / ${unit}`}>{formatCents(cost, format.currencyCode, format.locale)}</Fact>
          <Fact label="Possible from stock">{servings === null ? "—" : `${servings.toLocaleString(format.locale)} ${unit}`}</Fact>
          <Fact label="Ingredients">{data.ingredients.length}</Fact>
          <Fact label="Prep batches">{data.prepBatchesCount}</Fact>
        </dl>

        <IngredientsPanel
          recipeId={recipe.id}
          ingredients={data.ingredients}
          yieldQuantity={recipe.yieldQuantity}
          yieldUnit={recipe.yieldUnit}
          format={format}
          canManage={canManage}
        />

        <div className="grid gap-6 md:grid-cols-2">
          <PlatformSection id="recipe-prep-heading" title="Prep instructions">
            {recipe.prepInstructions ? <p className="whitespace-pre-wrap rounded-xl border bg-card p-4 text-sm [overflow-wrap:anywhere]">{recipe.prepInstructions}</p> : <PlatformEmpty>No prep instructions.</PlatformEmpty>}
          </PlatformSection>
          <PlatformSection id="recipe-allergen-heading" title="Allergen notes">
            {recipe.allergenNotes ? <p className="whitespace-pre-wrap rounded-xl border bg-card p-4 text-sm [overflow-wrap:anywhere]">{recipe.allergenNotes}</p> : <PlatformEmpty>No allergen notes.</PlatformEmpty>}
          </PlatformSection>
        </div>

        <PlatformSection
          id="recipe-batches-heading"
          title="Prep batches"
          meta={data.prepBatchesCount}
          actions={(
            <Button asChild size="sm" variant="outline" className="rounded-full">
              <Link href="/dashboard/platform/coffee-operations">Make a batch<ArrowUpRight className="size-4" aria-hidden="true" /></Link>
            </Button>
          )}
        >
          {data.prepBatches.length ? (
            <ul className="divide-y rounded-xl border bg-card">
              {data.prepBatches.map((batch) => (
                <li key={batch.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-4 py-3">
                  <StatusTitle as="p" tone={PREP_BATCH_STATUS_TONES[batch.status ?? ""] || "zinc"} status={PREP_BATCH_STATUS_LABELS[batch.status ?? ""] || batch.status} className="text-sm font-medium">
                    <span className="font-mono">{batch.batchNumber || "Batch"}</span>
                  </StatusTitle>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm tabular-nums text-muted-foreground">
                    <span>{formatQuantity(batch.quantityRemaining, format.locale)} / {formatQuantity(batch.quantityMade, format.locale)} {recipe.yieldUnit} left</span>
                    <span>{batch.expiresAt ? `Expires ${formatStoreDateTime(batch.expiresAt, format.timezone)}` : "No expiry"}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <PlatformEmpty>No prep batches.</PlatformEmpty>
          )}
        </PlatformSection>
      </div>
    </PageContainer>
  );
}
