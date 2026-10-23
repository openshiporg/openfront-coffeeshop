import Link from "next/link";
import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";
import { getStorefrontMenu, type StorefrontMenuItem } from "@/features/storefront/lib/data/menu";
import type { CoffeeStorefrontStore } from "@/features/storefront/lib/data/store";
import { formatMoney, storeZoneAbbreviation } from "@/features/storefront/lib/format";
import { formatClock, hoursRows, openState, rowIsOpen, storeClock } from "@/features/storefront/lib/hours";
import { StorefrontShell } from "@/features/storefront/components/StorefrontShell";
import { StorefrontMedia } from "@/features/storefront/components/StorefrontMedia";
import { MenuBoard } from "@/features/storefront/components/MenuBoard";
import { MenuQuickAdd } from "@/features/storefront/components/MenuQuickAdd";

export type HomePageFilters = { q?: string | string[]; category?: string | string[] };

function firstParam(value?: string | string[]) {
  return (Array.isArray(value) ? value[0] : value)?.trim().slice(0, 100) || "";
}

function mapsHref(address: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

// Sample details (fictional 555-01xx numbers, .local or example addresses) stay off the public page.
function publicPhone(phone?: string | null) {
  return phone && !/555\D?01\d\d/.test(phone) ? phone : null;
}

function publicEmail(email?: string | null) {
  return email && !/(\.(local|example|test|invalid)$|@example\.)/i.test(email) ? email : null;
}

function PopularCard({ item }: { item: StorefrontMenuItem }) {
  return (
    <article className="sf-rail-card">
      <div className="sf-rail-figure">
        <Link href={`/menu/${item.id}`} className="sf-rail-media" aria-label={item.name}>
          <StorefrontMedia item={item} className="h-full w-full" sizes="(min-width: 1024px) 18rem, 45vw" />
        </Link>
        <MenuQuickAdd item={item} />
      </div>
      <div>
        <Link href={`/menu/${item.id}`} className="sf-rail-name">{item.name}</Link>
        <span className="sf-mono text-sm text-[var(--sf-ink-muted)]">{formatMoney(item.price)}</span>
      </div>
    </article>
  );
}

export default async function HomePage({ store, filters = {} }: { store: CoffeeStorefrontStore | null; filters?: HomePageFilters }) {
  if (!store) return <StorefrontShell store={null} />;

  const search = firstParam(filters.q);
  const categoryId = firstParam(filters.category);
  const menu = await getStorefrontMenu(search, categoryId);
  const items = menu.kind === "ok" ? menu.items : [];
  const browsing = !search && !categoryId;
  const popular = browsing ? items.filter((item) => item.available && (item.featured || item.popular)).slice(0, 5) : [];
  const spotlight = browsing ? popular[0] || items.find((item) => item.available) : undefined;
  const rail = popular.filter((item) => item.id !== spotlight?.id);

  const status = openState(store.weeklyHours, store.timezone);
  const rows = hoursRows(store.weeklyHours);
  const today = storeClock(new Date(), store.timezone).day.toLowerCase();
  const zoneLabel = storeZoneAbbreviation(store.timezone);
  const phone = publicPhone(store.phone);
  const email = publicEmail(store.contactEmail);

  return (
    <StorefrontShell store={store}>
      <main>
        <section className="sf-hero">
          <div className="sf-container sf-hero-grid">
            <div className="min-w-0">
              <h1 className="sf-display sf-hero-title">{store.name}</h1>
              {store.tagline ? <p className="sf-hero-lead">{store.tagline}</p> : null}
              <div className="sf-hero-facts">
                <span className="sf-status font-semibold" role="status">
                  <span className={`sf-dot ${status.kind === "open" ? "sf-dot-open" : status.kind === "closed" ? "sf-dot-closed" : ""}`} aria-hidden="true" />
                  {status.label}
                </span>
                {status.kind === "open" && store.pickupLeadTimeMinutes ? <span className="sf-muted">Pickup in about {store.pickupLeadTimeMinutes} min</span> : null}
                {store.address ? (
                  <a href={mapsHref(store.address)} target="_blank" rel="noreferrer" className="sf-muted">
                    {store.address}
                    <ArrowUpRight className="size-3.5 self-center" aria-hidden="true" />
                  </a>
                ) : null}
              </div>
              <div className="sf-hero-actions">
                <a href="#menu" className="sf-btn sf-btn-primary sf-btn-lg">Start an order</a>
                <Link href="/account" className="sf-btn sf-btn-ghost sf-btn-lg">Your orders</Link>
              </div>
            </div>

            {spotlight ? (
              <div className="relative">
                <Link href={`/menu/${spotlight.id}`} className="sf-hero-card" aria-label={spotlight.name}>
                  <StorefrontMedia item={spotlight} className="h-full w-full" emphasize eager />
                </Link>
                <div className="sf-hero-card-caption">
                  <div className="min-w-0">
                    <strong>{spotlight.name}</strong>
                    <span className="sf-mono text-sm text-[var(--sf-ink-muted)]">{formatMoney(spotlight.price)}</span>
                  </div>
                  <MenuQuickAdd item={spotlight} />
                </div>
              </div>
            ) : null}
          </div>
        </section>

        {rail.length > 1 ? (
          <section className="pb-6" aria-labelledby="popular-title">
            <div className="sf-container">
              <h2 id="popular-title" className="sf-display sf-section-title mb-4">Popular</h2>
              <div className="sf-rail" data-count={Math.min(rail.length, 4)}>
                {rail.map((item) => <PopularCard key={item.id} item={item} />)}
              </div>
            </div>
          </section>
        ) : null}

        <section className="sf-menu" id="menu" aria-labelledby="menu-title">
          <div className="sf-container">
            <h2 id="menu-title" className="sf-display sf-section-title">Menu</h2>
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
              <div className="sf-empty mt-6" role="alert">
                <strong>Menu unavailable</strong>
                <a href={search || categoryId ? `/?${new URLSearchParams({ ...(search ? { q: search } : {}), ...(categoryId ? { category: categoryId } : {}) }).toString()}#menu` : "/#menu"} className="sf-btn sf-btn-ghost mt-3">Try again</a>
              </div>
            )}
          </div>
        </section>

        <section className="sf-visit" id="visit" aria-labelledby="visit-title">
          <div className="sf-container">
            <h2 id="visit-title" className="sf-display sf-section-title">Hours & location</h2>
            <div className="sf-visit-grid">
              <div>
                <h3 className="sf-label mb-2">Hours{zoneLabel ? ` · ${zoneLabel}` : ""}</h3>
                {rows.length ? (
                  <table className="sf-hours">
                    <tbody>
                      {rows.map((row) => (
                        <tr key={row.day} className={row.day.toLowerCase() === today ? "is-today" : undefined} aria-current={row.day.toLowerCase() === today ? "date" : undefined}>
                          <th scope="row">{row.day}</th>
                          <td className="sf-mono">{rowIsOpen(row) ? `${formatClock(row.open)} – ${formatClock(row.close)}` : "Closed"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : <p className="sf-muted">Hours not set</p>}
              </div>
              <div>
                <h3 className="sf-label mb-2">Contact</h3>
                <div className="sf-contact-list">
                  {store.address ? (
                    <a href={mapsHref(store.address)} target="_blank" rel="noreferrer">
                      <MapPin className="size-4" aria-hidden="true" />
                      <span>{store.address}</span>
                      <ArrowUpRight className="size-3.5" aria-hidden="true" />
                    </a>
                  ) : null}
                  {phone ? (
                    <a href={`tel:${phone}`}>
                      <Phone className="size-4" aria-hidden="true" />
                      <span>{phone}</span>
                    </a>
                  ) : null}
                  {email ? (
                    <a href={`mailto:${email}`}>
                      <Mail className="size-4" aria-hidden="true" />
                      <span>{email}</span>
                    </a>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </StorefrontShell>
  );
}
