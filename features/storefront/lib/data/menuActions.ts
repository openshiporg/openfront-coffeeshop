"use server";

import { fetchStorefrontMenuPage, type StorefrontMenuFilters } from "./menu";

/** Next page of the public menu for "Load more"; the cursor is bound to the same search and category. */
export async function loadMoreStorefrontMenu(filters: StorefrontMenuFilters) {
  return fetchStorefrontMenuPage(filters);
}
