import Link from "next/link";
import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";
import { getStorefrontMenu } from "@/features/storefront/lib/data/menu";
import type { CoffeeStorefrontStore } from "@/features/storefront/lib/data/store";
import { storeZoneAbbreviation } from "@/features/storefront/lib/format";
import { formatClock, hoursRows, openState, rowIsOpen, storeClock } from "@/features/storefront/lib/hours";
import { StorefrontShell } from "@/features/storefront/components/StorefrontShell";
import { MenuBoard } from "@/features/storefront/components/MenuBoard";
import { PickupBar } from "@/features/storefront/components/PickupBar";
import { BrewIllustration } from "@/features/storefront/components/BrewIllustration";

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

/** "128 Market Street, Brooklyn, NY" → "Market Street": the street the café is on, for the pickup card. */
function streetName(address: string) {
  const first = address.split(",")[0]?.trim() || "";
  return first.replace(/^\d+[a-z]?\s+/i, "") || first;
}

export default async function HomePage({ store, filters = {} }: { store: CoffeeStorefrontStore | null; filters?: HomePageFilters }) {
  if (!store) return <StorefrontShell store={null} />;

  const search = firstParam(filters.q);
  // "?category=all" is the All chip spelled out: no filter.
  const rawCategory = firstParam(filters.category).trim();
  const categoryId = rawCategory.toLowerCase() === "all" ? "" : rawCategory;
  const menu = await getStorefrontMenu(search, categoryId);
  const items = menu.kind === "ok" ? menu.items : [];
  const status = openState(store.weeklyHours, store.timezone);
  const rows = hoursRows(store.weeklyHours);
  const today = storeClock(new Date(), store.timezone).day.toLowerCase();
  const zoneLabel = storeZoneAbbreviation(store.timezone);
  const phone = publicPhone(store.phone);
  const email = publicEmail(store.contactEmail);
  const hours = { weeklyHours: store.weeklyHours, timezone: store.timezone, pickupLeadTimeMinutes: store.pickupLeadTimeMinutes ?? null };
  const beansActive = Boolean(categoryId) && items.length > 0 && items.every((item) => item.barStation === "retail_shelf");

  // Closed: name the next opening plainly ("Opens tomorrow 8 AM"); the pickup dropdown beside it already starts there.
  const statusLine = { kind: status.kind, label: status.label.replace(/^Closed · opens/, "Opens") };

  return (
    <StorefrontShell store={store} rail active={beansActive ? "beans" : "menu"}>
      <main className="sf-home">
        <section className="sf-intro" aria-labelledby="welcome-title">
          <h1 id="welcome-title" className="sf-script sf-welcome">Welcome<span className="sf-welcome-dash" aria-hidden="true" /></h1>
          <p className="sf-intro-lead">First time? Check out our best sellers below.</p>
          <BrewIllustration className="sf-intro-art" />
          {menu.kind === "ok" && menu.categories.length ? (
            <nav className="sf-intro-menu" aria-label="Menu sections">
              <p className="sf-intro-menu-title">Menu</p>
              <ul>
                {menu.categories.map((category) => (
                  <li key={category.id}>
                    <Link href={`/?category=${encodeURIComponent(category.id)}#menu`} aria-current={categoryId === category.id ? "page" : undefined}>{category.name}</Link>
                  </li>
                ))}
              </ul>
            </nav>
          ) : null}
        </section>

        <section className="sf-menu" id="menu" aria-labelledby="menu-title">
          <PickupBar
            hours={hours}
            address={store.address || null}
            mapsHref={store.address ? mapsHref(store.address) : null}
            title={store.address ? `Pickup on ${streetName(store.address)}` : `Pickup at ${store.name}`}
            storeName={store.name}
            status={statusLine}
          />

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
              <h2 id="menu-title"><strong>Menu unavailable</strong></h2>
              <a href={search || categoryId ? `/?${new URLSearchParams({ ...(search ? { q: search } : {}), ...(categoryId ? { category: categoryId } : {}) }).toString()}#menu` : "/#menu"} className="sf-btn sf-btn-ghost mt-3">Try again</a>
            </div>
          )}
        </section>

        <section className="sf-visit" id="visit" aria-labelledby="visit-title">
          <h2 id="visit-title" className="sf-section-title">Hours & location</h2>
          <div className="sf-visit-grid">
            <div className="sf-card">
              <h3 className="sf-box-label">Hours{zoneLabel ? ` (${zoneLabel})` : ""}</h3>
              {rows.length ? (
                <table className="sf-hours">
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.day} className={row.day.toLowerCase() === today ? "is-today" : undefined} aria-current={row.day.toLowerCase() === today ? "date" : undefined}>
                        <th scope="row">{row.day}</th>
                        <td>{rowIsOpen(row) ? `${formatClock(row.open)} – ${formatClock(row.close)}` : "Closed"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : <p className="sf-muted">Hours aren’t posted yet.</p>}
            </div>
            <div className="sf-card">
              <h3 className="sf-box-label">Find us</h3>
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
        </section>
      </main>
    </StorefrontShell>
  );
}
