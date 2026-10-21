import Link from "next/link";
import type { ReactNode } from "react";
import { StorefrontCartLink } from "./StorefrontCartLink";
import { StoreBrand } from "./StoreBrand";
import { getCoffeeStoreResult, type CoffeeStorefrontStore } from "@/features/storefront/lib/data/store";

function hoursRows(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => entry && typeof entry === "object" && "day" in entry
    ? [{ day: String((entry as { day: unknown }).day), open: String((entry as { open?: unknown }).open || ""), close: String((entry as { close?: unknown }).close || ""), closed: (entry as { closed?: unknown }).closed === true }]
    : []);
}

export function UnconfiguredStorefront() {
  return (
    <main className="sf-container grid min-h-screen place-items-center py-16">
      <section className="sf-panel max-w-xl text-center" aria-labelledby="storefront-unconfigured-title">
        <p className="sf-kicker">Storefront unavailable</p>
        <h1 id="storefront-unconfigured-title" className="sf-display mt-3 text-[var(--sf-text-display-s)]">
          Store not configured
        </h1>
        <p className="mt-4 text-[var(--sf-ink-muted)]">
          This business has not published its store identity and hours yet. Please check back after setup is complete.
        </p>
      </section>
    </main>
  );
}

function StoreUnavailableShell({ children }: { children?: ReactNode }) {
  return (
    <>
      <header className="sf-header">
        <div className="sf-container sf-header-inner">
          <Link href="/" className="sf-wordmark flex min-h-11 items-center"><strong>Menu</strong></Link>
          <nav className="flex min-w-0 flex-wrap items-center gap-4 text-sm" aria-label="Storefront">
            <Link href="/account">Account</Link>
            <Link href="/checkout">Checkout</Link>
          </nav>
          <StorefrontCartLink />
        </div>
      </header>
      <div className="sf-container pt-6">
        <p className="sf-alert-error" role="status">Store details are temporarily unavailable. Your account, order history and receipts still work.</p>
      </div>
      {children}
    </>
  );
}

export async function StorefrontShell({
  children,
  store: providedStore,
}: {
  children?: ReactNode;
  store?: CoffeeStorefrontStore | null;
}) {
  let store = providedStore ?? null;
  if (providedStore === undefined) {
    const result = await getCoffeeStoreResult();
    if (result.kind === "unavailable") return <StoreUnavailableShell>{children}</StoreUnavailableShell>;
    store = result.kind === "ok" ? result.store : null;
  }
  if (!store) return <UnconfiguredStorefront />;

  return (
    <>
      <header className="sf-header">
        <div className="sf-container sf-header-inner">
          <StoreBrand store={store} />

          <nav className="sf-nav" aria-label="Storefront">
            <Link href="/#board">Menu</Link>
            <Link href="/#visit">Visit</Link>
            <Link href="/account">Account</Link>
            <Link href="/checkout">Checkout</Link>
          </nav>

          <StorefrontCartLink />
          <details className="sf-mobile-menu">
            <summary className="min-h-11 cursor-pointer p-3">Menu</summary>
            <nav aria-label="Mobile storefront" className="sf-mobile-menu-panel">
              <StoreBrand store={store} />
              <Link href="/#board">Browse menu</Link>
              <Link href="/account">Account & orders</Link>
              <Link href="/checkout">Checkout</Link>
            </nav>
          </details>
        </div>
      </header>

      {children}

      <footer className="sf-footer" id="visit">
        <div className="sf-container">
          <StoreBrand store={store} />
          <p className="sf-kicker mt-4">Order ahead · Pay at pickup</p>

          <div className="sf-footer-grid">
            <div>
              <strong>Visit & contact</strong>
              {store.address ? <p><a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.address)}`} target="_blank" rel="noreferrer">{store.address}</a></p> : null}
              {store.phone ? <p className="mt-2"><a href={`tel:${store.phone}`}>{store.phone}</a></p> : null}
              {store.contactEmail ? <p className="mt-2"><a href={`mailto:${store.contactEmail}`}>{store.contactEmail}</a></p> : null}
            </div>
            <div>
              <strong>Hours · {store.timezone}</strong>
              {hoursRows(store.weeklyHours).map((row) => (
                <p key={row.day}>{row.day.slice(0, 3)} · {row.closed || !row.open || !row.close ? "Closed" : `${row.open}–${row.close}`}</p>
              ))}
            </div>
            <div>
              <Link href="/account" className="inline-flex min-h-11 items-center">Account & order history ↗</Link>
            </div>
          </div>
        </div>
      </footer>
    </>
  );
}
