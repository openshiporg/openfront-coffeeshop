import Link from "next/link";
import { ArrowRight, MapPin } from "lucide-react";
import { getStorefrontMenu } from "@/features/storefront/lib/data/menu";
import type { CoffeeStorefrontStore } from "@/features/storefront/lib/data/store";
import { formatMoney } from "@/features/storefront/lib/format";
import { StorefrontShell } from "@/features/storefront/components/StorefrontShell";
import { StorefrontMedia } from "@/features/storefront/components/StorefrontMedia";
import { MenuBoard } from "@/features/storefront/components/MenuBoard";
import { MenuQuickAdd } from "@/features/storefront/components/MenuQuickAdd";

export type HomePageFilters = { q?: string | string[]; category?: string | string[] };

function firstParam(value?: string | string[]) {
  return (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 100) || "";
}

export default async function HomePage({ store, filters = {} }: { store: CoffeeStorefrontStore | null; filters?: HomePageFilters }) {
  if (!store) return <StorefrontShell store={null} />;

  const search = firstParam(filters.q);
  const categoryId = firstParam(filters.category);
  const menu = await getStorefrontMenu(search, categoryId);
  const items = menu.kind === "ok" ? menu.items : [];
  const featured = items.filter((item) => item.featured || item.popular);
  const spotlight = search || categoryId ? undefined : featured[0] || items[0];

  return (
    <StorefrontShell store={store}>
      <section className="sf-masthead">
        <div className="sf-container">
          <p className="sf-kicker">{store.name}</p>
          <h1 className="sf-display">{store.tagline}</h1>
          <p className="sf-masthead-lead">Order ahead · Pay at pickup</p>
          <div className="sf-meta-row">
            <span>
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              {store.address}
            </span>
            {store.phone ? <span>{store.phone}</span> : null}
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <a href="#board" className="sf-btn sf-btn-primary">
              View the board
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </a>
            {spotlight ? (
              <Link href={`/menu/${spotlight.id}`} className="sf-btn sf-btn-ghost">
                Order {spotlight.name}
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {spotlight ? (
        <section className="border-b border-[var(--sf-rule)] py-[var(--sf-space-2xl)]">
          <div className="sf-container sf-spotlight">
            <Link href={`/menu/${spotlight.id}`} className="sf-spotlight-media" aria-label={`View ${spotlight.name}`}>
              <StorefrontMedia item={spotlight} className="h-full w-full" emphasize eager />
            </Link>
            <div className="sf-spotlight-copy">
              <p className="sf-kicker">On the bar</p>
              <h2 className="sf-display"><Link href={`/menu/${spotlight.id}`}>{spotlight.name}</Link></h2>
              <p>{spotlight.shortDescription || "Built to order and queued for pickup."}</p>
              <p className="sf-spotlight-price">{formatMoney(spotlight.price)}</p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link href={`/menu/${spotlight.id}`} className="sf-btn sf-btn-ghost">
                  View & customize
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
                <MenuQuickAdd item={spotlight} />
              </div>
            </div>
          </div>
        </section>
      ) : null}


      <section className="sf-ledger" id="board">
        <div className="sf-container">
          <div className="sf-ledger-head">
            <p className="sf-kicker">Today&apos;s board</p>
            <h2 className="sf-display">Menu</h2>
          </div>

          {menu.kind === "ok" ? (
            <MenuBoard
              categories={menu.categories}
              items={menu.items}
              nextCursor={menu.nextCursor}
              hasUncategorized={menu.hasUncategorized}
              search={search}
              categoryId={categoryId}
            />
          ) : (
            <div className="sf-empty" role="alert">
              <p>The menu is temporarily unavailable.</p>
              <a href={search || categoryId ? `/?${new URLSearchParams({ ...(search ? { q: search } : {}), ...(categoryId ? { category: categoryId } : {}) }).toString()}#board` : "/#board"} className="sf-btn sf-btn-ghost mt-4">Try again</a>
            </div>
          )}
        </div>
      </section>
    </StorefrontShell>
  );
}
