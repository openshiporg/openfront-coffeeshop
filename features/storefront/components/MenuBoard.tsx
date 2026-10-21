"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import type { StorefrontMenuCategory, StorefrontMenuItem } from "@/features/storefront/lib/data/menu";
import { loadMoreStorefrontMenu } from "@/features/storefront/lib/data/menuActions";
import { formatMoney } from "@/features/storefront/lib/format";
import { StorefrontMedia } from "./StorefrontMedia";
import { MenuQuickAdd } from "./MenuQuickAdd";

const UNCATEGORIZED = "uncategorized";

function MenuRow({ item }: { item: StorefrontMenuItem }) {
  return (
    <article className="sf-menu-row">
      <Link href={`/menu/${item.id}`} className="sf-menu-row-media-link" aria-label={`View ${item.name}`}>
        <StorefrontMedia item={item} className="sf-menu-row-media" />
      </Link>
      <div className="min-w-0">
        <div className="sf-menu-row-top">
          <Link href={`/menu/${item.id}`} className="sf-menu-row-name [overflow-wrap:anywhere]">{item.name}</Link>
          <span className="sf-menu-row-dots" aria-hidden="true" />
          <span className="sf-menu-row-price">{formatMoney(item.price)}</span>
        </div>
        <p className="sf-menu-row-desc">{item.shortDescription || "Built to order for pickup."}</p>
        <div className="sf-menu-row-footer">
          <div className="sf-menu-row-tags">
            {item.category?.name ? <span>{item.category.name}</span> : null}
            <span>{item.prepTimeMinutes || 5} min</span>
            {item.temperatureOptions?.slice(0, 2).map((option) => <span key={option} className="capitalize">{option}</span>)}
            {item.popular ? <span>Popular</span> : null}
          </div>
          <MenuQuickAdd item={item} />
        </div>
      </div>
    </article>
  );
}

function filterHref(search: string, categoryId: string) {
  const params = new URLSearchParams();
  if (search) params.set("q", search);
  if (categoryId) params.set("category", categoryId);
  const query = params.toString();
  return `/${query ? `?${query}` : ""}#board`;
}

export function MenuBoard({
  categories,
  items: initialItems,
  nextCursor: initialCursor,
  hasUncategorized,
  search,
  categoryId,
}: {
  categories: StorefrontMenuCategory[];
  items: StorefrontMenuItem[];
  nextCursor: string | null;
  hasUncategorized: boolean;
  search: string;
  categoryId: string;
}) {
  const [items, setItems] = useState(initialItems);
  const [cursor, setCursor] = useState(initialCursor);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const filterKey = useRef(`${search}\u0000${categoryId}`);

  useEffect(() => {
    filterKey.current = `${search}\u0000${categoryId}`;
    setItems(initialItems);
    setCursor(initialCursor);
    setLoadError(false);
  }, [initialItems, initialCursor, search, categoryId]);

  async function loadMore() {
    if (!cursor || loading) return;
    const key = filterKey.current;
    setLoading(true);
    setLoadError(false);
    try {
      const page = await loadMoreStorefrontMenu({ search, categoryId, after: cursor });
      if (key !== filterKey.current) return;
      if (page.kind !== "ok") {
        setLoadError(true);
        return;
      }
      setItems((current) => [...current, ...page.items.filter((item) => !current.some((existing) => existing.id === item.id))]);
      setCursor(page.nextCursor);
    } catch {
      if (key === filterKey.current) setLoadError(true);
    } finally {
      if (key === filterKey.current) setLoading(false);
    }
  }

  const knownCategories = new Set(categories.map((category) => category.id));
  const sections = [
    ...categories.map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description,
      items: items.filter((item) => item.category?.id === category.id),
    })),
    {
      id: UNCATEGORIZED,
      name: "More from the bar",
      description: null,
      items: items.filter((item) => !item.category || !knownCategories.has(item.category.id)),
    },
  ].filter((section) => section.items.length > 0);
  const filtered = Boolean(search || categoryId);

  return (
    <>
      <div className="sf-menu-tools" aria-label="Menu filters" role="search">
        <form className="sf-menu-search" action="/" method="get">
          <Search className="h-4 w-4" aria-hidden="true" />
          <label htmlFor="menu-search" className="sr-only">Search the menu</label>
          <input id="menu-search" name="q" type="search" defaultValue={search} maxLength={100} placeholder="Search drinks, pastries, beans…" />
          {categoryId ? <input type="hidden" name="category" value={categoryId} /> : null}
          <button type="submit" className="sr-only">Search</button>
        </form>
        <nav className="sf-category-filters" aria-label="Filter by category">
          <Link href={filterHref(search, "")} className={!categoryId ? "is-active" : ""} aria-current={!categoryId ? "page" : undefined}>All</Link>
          {categories.map((category) => (
            <Link key={category.id} href={filterHref(search, category.id)} className={categoryId === category.id ? "is-active" : ""} aria-current={categoryId === category.id ? "page" : undefined}>{category.name}</Link>
          ))}
          {hasUncategorized ? (
            <Link href={filterHref(search, UNCATEGORIZED)} className={categoryId === UNCATEGORIZED ? "is-active" : ""} aria-current={categoryId === UNCATEGORIZED ? "page" : undefined}>More from the bar</Link>
          ) : null}
        </nav>
      </div>

      {sections.length > 0 ? sections.map((section) => (
        <section key={section.id} className="sf-category" aria-labelledby={`menu-section-${section.id}`}>
          <div className="sf-category-head">
            <div><h3 id={`menu-section-${section.id}`} className="sf-display">{section.name}</h3>{section.description ? <p>{section.description}</p> : null}</div>
            <span className="text-sm text-[var(--sf-ink-faint)]">{section.items.length} {section.items.length === 1 ? "item" : "items"}{cursor ? " shown" : ""}</span>
          </div>
          <div>{section.items.map((item) => <MenuRow key={item.id} item={item} />)}</div>
        </section>
      )) : (
        <div className="sf-empty">
          {filtered ? (
            <>
              <p>No menu items match those filters.</p>
              <Link href="/#board" className="sf-btn sf-btn-ghost mt-4">Clear filters</Link>
            </>
          ) : (
            <p>No menu items are available right now.</p>
          )}
        </div>
      )}

      {cursor ? (
        <div className="mt-8 flex flex-col items-center gap-3" aria-live="polite">
          <button type="button" className="sf-btn sf-btn-ghost" onClick={loadMore} disabled={loading}>
            {loading ? "Loading…" : "Load more"}
          </button>
          {loadError ? <p className="sf-alert-error" role="alert">More menu items couldn’t be loaded. Try again.</p> : null}
        </div>
      ) : null}
    </>
  );
}
