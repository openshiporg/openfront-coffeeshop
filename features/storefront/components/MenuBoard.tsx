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
const UNCATEGORIZED_LABEL = "More";

// One cup on the menu: the merchant's printed band, the photo, the printed name and
// price, and the quick-add box the barista's marker ticks.
// On the All view every cup shares one grid, so the category prints on the cup's band.
function MenuCup({ item, eager, band }: { item: StorefrontMenuItem; eager: boolean; band?: string }) {
  return (
    <article className={`sf-cup ${item.available ? "" : "is-unavailable"} ${band ? "has-band-print" : ""}`}>
      {band ? <p className="sf-cup-band">{band}</p> : null}
      <Link href={`/menu/${item.id}`} className="sf-cup-photo" tabIndex={-1} aria-hidden="true">
        <StorefrontMedia item={item} className="h-full w-full" sizes="(min-width: 1024px) 18rem, (min-width: 640px) 30vw, 50vw" eager={eager} />
      </Link>
      <div className="sf-cup-print">
        <Link href={`/menu/${item.id}`} className="sf-cup-name">{item.name}</Link>
        {item.shortDescription ? <p className="sf-cup-desc">{item.shortDescription}</p> : null}
        <div className="sf-cup-foot">
          <span className="sf-cup-price">{formatMoney(item.price)}</span>
          {item.popular ? <span className="sf-cup-tag">Popular</span> : null}
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
  return `/${query ? `?${query}` : ""}#menu`;
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
      name: UNCATEGORIZED_LABEL,
      description: null,
      items: items.filter((item) => !item.category || !knownCategories.has(item.category.id)),
    },
  ].filter((section) => section.items.length > 0);
  const filtered = Boolean(search || categoryId);
  // All view: one grid of cups, in menu order, so the first screen opens on cups, not headings.
  const allView = !categoryId;
  const cups = sections.flatMap((section) => section.items.map((item) => ({ item, band: section.name })));

  return (
    <>
      <div className="sf-menu-bar">
        <nav className="sf-track" aria-label="Menu categories">
          <Link href={filterHref(search, "")} className="sf-track-item" aria-current={!categoryId ? "page" : undefined}>All</Link>
          {categories.map((category) => (
            <Link key={category.id} href={filterHref(search, category.id)} className="sf-track-item" aria-current={categoryId === category.id ? "page" : undefined}>{category.name}</Link>
          ))}
          {hasUncategorized ? (
            <Link href={filterHref(search, UNCATEGORIZED)} className="sf-track-item" aria-current={categoryId === UNCATEGORIZED ? "page" : undefined}>{UNCATEGORIZED_LABEL}</Link>
          ) : null}
        </nav>
        <form className="sf-search" action="/#menu" method="get" role="search">
          <Search className="size-4" aria-hidden="true" />
          <label htmlFor="menu-search" className="sr-only">Search the menu</label>
          <input id="menu-search" name="q" type="search" defaultValue={search} maxLength={100} placeholder="Search menu" />
          {categoryId ? <input type="hidden" name="category" value={categoryId} /> : null}
          <button type="submit" className="sr-only">Search</button>
        </form>
      </div>

      {search ? (
        <p className="sf-results" role="status">
          <span>Results for “{search}”</span>
          <Link href={filterHref("", categoryId)} className="sf-link">Clear search</Link>
        </p>
      ) : null}

      {sections.length > 0 && allView ? (
        <div className="sf-cup-grid sf-cup-grid-all">
          {cups.map(({ item, band }, index) => <MenuCup key={item.id} item={item} eager={index < 4} band={band} />)}
        </div>
      ) : sections.length > 0 ? <div className="sf-menu-sections">{sections.map((section, sectionIndex) => (
        <section key={section.id} className="sf-menu-section" aria-labelledby={`menu-section-${section.id}`}>
          <div className="sf-menu-section-head">
            <div className="min-w-0">
              <h3 id={`menu-section-${section.id}`} className="sf-display">{section.name}</h3>
              {section.description ? <p>{section.description}</p> : null}
            </div>
          </div>
          <div className="sf-cup-grid">{section.items.map((item) => <MenuCup key={item.id} item={item} eager={sectionIndex === 0} />)}</div>
        </section>
      ))}</div> : (
        <div className="sf-empty">
          {filtered ? (
            <>
              <strong>No matches</strong>
              <Link href="/#menu" className="sf-btn sf-btn-ghost mt-3">Clear filters</Link>
            </>
          ) : (
            <strong>No menu items available</strong>
          )}
        </div>
      )}

      {cursor ? (
        <div className="sf-more" aria-live="polite">
          <button type="button" className="sf-btn" onClick={loadMore} disabled={loading}>
            {loading ? "Loading…" : "Load more"}
          </button>
          {loadError ? <p className="sf-alert-error" role="alert">More menu items couldn’t be loaded. Try again.</p> : null}
        </div>
      ) : null}
    </>
  );
}
