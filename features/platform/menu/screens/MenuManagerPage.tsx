import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/features/dashboard/components/PageContainer";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { PlatformHeader } from "@/features/platform/components/PlatformPage";
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
      <PageContainer title="Menu" breadcrumbs={BREADCRUMBS} header={<PlatformHeader title="Menu" />}>
        <div role="alert" className="mx-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm md:mx-6">
          <p className="font-medium">{cursor ? "This page of results is no longer available." : "Menu unavailable."}</p>
          <Button asChild size="sm" variant="outline" className="rounded-full"><Link href={retryHref(search, categoryId)}>{cursor ? "First page" : "Try again"}</Link></Button>
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
