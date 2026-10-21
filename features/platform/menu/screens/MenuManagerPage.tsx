import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/features/dashboard/components/PageContainer";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { MenuManager } from "../components/MenuManager";
import type { MenuManagerData, MenuManagerFilters } from "../types";

const MENU_MANAGER_QUERY = `
  query CoffeeMenuManager($search: String, $categoryId: ID, $cursor: String) {
    getCoffeeMenuManager(search: $search, categoryId: $categoryId, cursor: $cursor, limit: 50) {
      canManageProducts
      categories { id name description active sortOrder }
      categoriesHasMore
      matchingCount
      stats { items hidden modifiersOut }
      hasMore
      nextCursor
      items {
        id name shortDescription price available featured popular prepTimeMinutes barStation updatedAt
        category { id name }
        modifiersHasMore
        modifiers {
          id name modifierGroup modifierGroupLabel priceAdjustment required minSelections maxSelections defaultSelected inStock updatedAt
          inventoryAction inventoryQuantity
          inventoryItem { id name unit }
          replacesInventoryItem { id name unit }
        }
      }
    }
  }
`;

const BREADCRUMBS = [
  { type: "link" as const, label: "Dashboard", href: "/dashboard" },
  { type: "page" as const, label: "Menu" },
];

function retryHref(search: string, categoryId: string) {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (categoryId) params.set("category", categoryId);
  const query = params.toString();
  return `/dashboard/platform/menu${query ? `?${query}` : ""}`;
}

function isMenuManagerData(value: unknown): value is MenuManagerData {
  const data = value as Partial<MenuManagerData> | null;
  return Boolean(
    data &&
    typeof data.canManageProducts === "boolean" &&
    Array.isArray(data.categories) &&
    Array.isArray(data.items) &&
    typeof data.matchingCount === "number" &&
    data.stats && typeof data.stats.items === "number" &&
    data.items.every((item) => item && typeof item.id === "string" && typeof item.updatedAt === "string" && Array.isArray(item.modifiers) &&
      item.modifiers.every((modifier) => typeof modifier.required === "boolean" && typeof modifier.minSelections === "number" && typeof modifier.maxSelections === "number" && typeof modifier.updatedAt === "string")),
  );
}

export async function MenuManagerPage({ search, categoryId, cursor }: { search: string; categoryId: string; cursor: string | null }) {
  const filters: MenuManagerFilters = { search, categoryId, cursor };
  const response = await keystoneClient<{ getCoffeeMenuManager: unknown }>(
    MENU_MANAGER_QUERY,
    { search: search || null, categoryId: categoryId || null, cursor },
    { cache: "no-store" },
  );
  const data = response.success ? response.data?.getCoffeeMenuManager : null;

  if (!isMenuManagerData(data)) {
    return (
      <PageContainer title="Menu" breadcrumbs={BREADCRUMBS} header={<h1 className="text-2xl font-semibold tracking-tight">Menu</h1>}>
        <div role="alert" className="mx-4 rounded-lg border border-border bg-card p-4 text-sm text-foreground md:mx-6">
          <p className="font-medium">The menu could not be loaded.</p>
          <p className="mt-1 text-muted-foreground">
            {cursor ? "This page of results is no longer available." : "No menu items are shown and no changes can be made until it loads."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button asChild size="sm"><Link href={retryHref(search, categoryId)}>{cursor ? "Back to the first page" : "Try again"}</Link></Button>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer title="Menu" breadcrumbs={BREADCRUMBS} header={null}>
      <MenuManager data={data} filters={filters} />
    </PageContainer>
  );
}
