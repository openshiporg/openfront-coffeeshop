import { ArrowUpRight, Mail, MapPin, Phone } from "lucide-react";
import { getStorefrontMenu } from "@/features/storefront/lib/data/menu";
import type { CoffeeStorefrontStore } from "@/features/storefront/lib/data/store";
import { storeZoneAbbreviation } from "@/features/storefront/lib/format";
import { formatClock, hoursRows, openState, rowIsOpen, storeClock } from "@/features/storefront/lib/hours";
import { StorefrontShell } from "@/features/storefront/components/StorefrontShell";
import { MenuBoard } from "@/features/storefront/components/MenuBoard";

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

export default async function HomePage({ store, filters = {} }: { store: CoffeeStorefrontStore | null; filters?: HomePageFilters }) {
  if (!store) return <StorefrontShell store={null} />;

  const search = firstParam(filters.q);
  const categoryId = firstParam(filters.category);
  const menu = await getStorefrontMenu(search, categoryId);
  const items = menu.kind === "ok" ? menu.items : [];
  // Closed, but the menu still takes orders for the next opening: say so on the sign.
  const ordersAhead = items.some((item) => item.availability === "later");

  const status = openState(store.weeklyHours, store.timezone);
  const rows = hoursRows(store.weeklyHours);
  const today = storeClock(new Date(), store.timezone).day.toLowerCase();
  const zoneLabel = storeZoneAbbreviation(store.timezone);
  const phone = publicPhone(store.phone);
  const email = publicEmail(store.contactEmail);

  const band = (
    <dl className="sf-band-facts">
      <div className={`sf-band-fact sf-band-state is-${status.kind}`}>
        <dt>Now</dt>
        <dd role="status">{status.label}</dd>
      </div>
      {status.kind === "open" && store.pickupLeadTimeMinutes ? (
        <div className="sf-band-fact">
          <dt>Pickup</dt>
          <dd>Ready in about {store.pickupLeadTimeMinutes} min</dd>
        </div>
      ) : status.kind === "closed" && ordersAhead ? (
        <div className="sf-band-fact">
          <dt>Pickup</dt>
          <dd>Order now, pick up after we open</dd>
        </div>
      ) : null}
      {store.address ? (
        <div className="sf-band-fact sf-band-where">
          <dt>Where</dt>
          <dd>
            <a href={mapsHref(store.address)} target="_blank" rel="noreferrer">
              {store.address}
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </a>
          </dd>
        </div>
      ) : null}
    </dl>
  );

  return (
    <StorefrontShell store={store} band={band}>
      <main>
        <section className="sf-menu" id="menu" aria-labelledby="menu-title">
          <div className="sf-container">
            <h1 id="menu-title" className="sr-only">{store.name} menu</h1>
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
              <div>
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
          </div>
        </section>
      </main>
    </StorefrontShell>
  );
}
