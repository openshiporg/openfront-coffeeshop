"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bean, ChevronRight, Coffee, Croissant, CupSoda, LayoutGrid, Leaf, Search, Sparkles, type LucideIcon } from "lucide-react";
import type { StorefrontMenuCategory, StorefrontMenuItem } from "@/features/storefront/lib/data/menu";
import { loadMoreStorefrontMenu } from "@/features/storefront/lib/data/menuActions";
import { formatMoney } from "@/features/storefront/lib/format";
import { StorefrontMedia } from "./StorefrontMedia";
import { MenuQuickAdd, MenuRowOptions, useMenuRowSelection } from "./MenuQuickAdd";

const UNCATEGORIZED = "uncategorized";
const UNCATEGORIZED_LABEL = "More";

function categoryIcon(name: string): LucideIcon {
  const value = name.toLowerCase();
  if (/(pastr|bake|croissant|food|bite)/.test(value)) return Croissant;
  if (/(bean|retail|bag|shop)/.test(value)) return Bean;
  if (/(cold|iced|ice)/.test(value)) return CupSoda;
  if (/(tea|matcha)/.test(value)) return Leaf;
  if (/(signature|special|season)/.test(value)) return Sparkles;
  return Coffee;
}

function MenuRow({ item, eager }: { item: StorefrontMenuItem; eager: boolean }) {
  const selection = useMenuRowSelection(item);
  return (
    <article className={`sf-row-item ${item.available ? "" : "is-unavailable"}`}>
      <Link href={`/menu/${item.id}`} className="sf-row-photo" tabIndex={-1} aria-hidden="true">
        <StorefrontMedia item={item} className="h-full w-full" sizes="(min-width: 1024px) 15rem, 8rem" eager={eager} />
      </Link>
      <div className="sf-row-body">
        <div className="sf-row-top">
          <Link href={`/menu/${item.id}`} className="sf-row-name">{item.name}</Link>
          <span className="sf-row-price sf-row-price-top" aria-live="polite">{formatMoney(selection.unitPrice)}</span>
        </div>
        {item.shortDescription ? <p className="sf-row-desc">{item.shortDescription}</p> : null}
        <div className="sf-row-foot">
          <MenuRowOptions item={item} selection={selection} />
          <div className="sf-row-buy">
            <span className="sf-row-price sf-row-price-buy" aria-live="polite">{formatMoney(selection.unitPrice)}</span>
            <MenuQuickAdd item={item} selection={selection} />
          </div>
        </div>
      </div>
    </article>
  );
}

function BeanCard({ item }: { item: StorefrontMenuItem }) {
  return (
    <article className="sf-bean">
      <Link href={`/menu/${item.id}`} className="sf-bean-photo" tabIndex={-1} aria-hidden="true">
        <StorefrontMedia item={item} className="h-full w-full" sizes="12rem" />
      </Link>
      <div className="sf-bean-body">
        <Link href={`/menu/${item.id}`} className="sf-bean-name">{item.name}</Link>
        <span className="sf-bean-price">{formatMoney(item.price)}</span>
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
  const barRef = useRef<HTMLDivElement>(null);
  const catsRef = useRef<HTMLElement>(null);

  // Tabs: fade only the edge where more tabs are hidden, keep the active one in view, and stick
  // under the phone header (its height varies with the store name).
  useEffect(() => {
    const cats = catsRef.current;
    const bar = barRef.current;
    if (!cats || !bar) return;
    const edges = () => {
      const max = cats.scrollWidth - cats.clientWidth;
      cats.toggleAttribute("data-more-start", cats.scrollLeft > 2);
      cats.toggleAttribute("data-more-end", cats.scrollLeft < max - 2);
    };
    const top = () => {
      const header = document.querySelector<HTMLElement>(".sf-topbar");
      const visible = header && getComputedStyle(header).display !== "none" ? header.getBoundingClientRect().height : 0;
      bar.style.setProperty("--sf-sticky-top", `${Math.round(visible)}px`);
    };
    const active = cats.querySelector<HTMLElement>('[aria-current="page"]');
    if (active && active.offsetLeft + active.offsetWidth > cats.clientWidth) cats.scrollLeft = active.offsetLeft - 24;
    edges();
    top();
    const onResize = () => { edges(); top(); };
    cats.addEventListener("scroll", edges, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      cats.removeEventListener("scroll", edges);
      window.removeEventListener("resize", onResize);
    };
  }, [categoryId, categories.length]);

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

  const categoryOrder = new Map(categories.map((category, index) => [category.id, index]));
  const ordered = [...items].sort((a, b) => (categoryOrder.get(a.category?.id || "") ?? 999) - (categoryOrder.get(b.category?.id || "") ?? 999));
  const filtered = Boolean(search || categoryId);
  const allView = !categoryId;
  const retail = allView ? ordered.filter((item) => item.barStation === "retail_shelf") : [];
  const counter = allView ? ordered.filter((item) => item.barStation !== "retail_shelf") : ordered;
  // All view: the café's featured and popular picks first, then everything else it makes.
  const featured = allView && !search ? counter.filter((item) => item.featured || item.popular) : counter;
  const rest = allView && !search ? counter.filter((item) => !item.featured && !item.popular) : [];
  const activeCategory = categoryId === UNCATEGORIZED ? { id: UNCATEGORIZED, name: UNCATEGORIZED_LABEL, description: null } : categories.find((category) => category.id === categoryId);
  const heading = search ? `Results for “${search}”` : activeCategory ? activeCategory.name : featured.length ? "Featured" : "Menu";
  const retailCategory = retail.find((item) => item.category)?.category;
  const retailDescription = retailCategory ? categories.find((category) => category.id === retailCategory.id)?.description : null;

  return (
    <>
      <div className="sf-menu-bar" ref={barRef}>
        <div className="sf-cats-track">
          <nav className="sf-cats" aria-label="Menu categories" ref={catsRef}>
            <Link href={filterHref(search, "")} className="sf-cat" aria-current={!categoryId ? "page" : undefined}>
              <LayoutGrid aria-hidden="true" />All
            </Link>
            {categories.map((category) => {
              const Icon = categoryIcon(category.name);
              return (
                <Link key={category.id} href={filterHref(search, category.id)} className="sf-cat" aria-current={categoryId === category.id ? "page" : undefined}>
                  <Icon aria-hidden="true" />{category.name}
                </Link>
              );
            })}
            {hasUncategorized ? (
              <Link href={filterHref(search, UNCATEGORIZED)} className="sf-cat" aria-current={categoryId === UNCATEGORIZED ? "page" : undefined}>{UNCATEGORIZED_LABEL}</Link>
            ) : null}
          </nav>
        </div>
      </div>

      <div className="sf-feature-head">
        <h2 id="menu-title" className="sf-feature-title">{heading}</h2>
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
          <Link href={filterHref("", categoryId)} className="sf-link">Clear search</Link>
        </p>
      ) : activeCategory?.description ? <p className="sf-results">{activeCategory.description}</p> : null}

      {featured.length ? (
        <div className="sf-rows-list">{featured.map((item, index) => <MenuRow key={item.id} item={item} eager={index < 4} />)}</div>
      ) : null}

      {rest.length ? (
        <>
          <h2 className="sf-feature-title sf-feature-title-sub">More from the bar</h2>
          <div className="sf-rows-list">{rest.map((item) => <MenuRow key={item.id} item={item} eager={false} />)}</div>
        </>
      ) : null}

      {retail.length ? (
        <section className="sf-beans" aria-labelledby="beans-title">
          <Link href={retailCategory ? filterHref("", retailCategory.id) : "/#menu"} className="sf-beans-head">
            <span>
              <span id="beans-title" className="sf-beans-title">{retailCategory?.name || "Beans"}</span>
              {retailDescription ? <span className="sf-beans-sub">{retailDescription}</span> : null}
            </span>
            <ChevronRight className="size-5" aria-hidden="true" />
          </Link>
          <div className="sf-beans-promo">
            <div className="sf-beans-promo-photo"><StorefrontMedia item={retail[0]} className="h-full w-full" sizes="16rem" /></div>
            <div className="sf-beans-promo-body">
              <p className="sf-beans-promo-title">Our {retailCategory?.name.replace(/^retail\s+/i, "") || "Beans"}</p>
              {retailDescription ? <p className="sf-beans-promo-sub">{retailDescription}</p> : null}
              <Link href={retailCategory ? filterHref("", retailCategory.id) : `/menu/${retail[0].id}`} className="sf-beans-promo-link">Shop now <ChevronRight className="size-4" aria-hidden="true" /></Link>
            </div>
          </div>
          <div className="sf-beans-track">{retail.map((item) => <BeanCard key={item.id} item={item} />)}</div>
        </section>
      ) : null}

      {!featured.length && !rest.length && !retail.length ? (
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
      ) : null}

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
