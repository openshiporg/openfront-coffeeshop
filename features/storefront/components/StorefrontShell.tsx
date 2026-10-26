import Link from "next/link";
import type { ReactNode } from "react";
import { UserRound } from "lucide-react";
import { StorefrontCartBar, StorefrontCartLink } from "./StorefrontCartLink";
import { StoreBrand } from "./StoreBrand";
import { getCoffeeStoreResult, type CoffeeStorefrontStore } from "@/features/storefront/lib/data/store";

export function UnconfiguredStorefront() {
  return (
    <main className="sf-container sf-unconfigured">
      <section className="sf-panel" aria-labelledby="storefront-unconfigured-title">
        <h1 id="storefront-unconfigured-title" className="sf-display sf-page-title">Store not configured</h1>
        <p className="sf-muted mt-3">This store isn’t open for online orders yet.</p>
      </section>
    </main>
  );
}

function AccountLink() {
  return (
    <Link href="/account" className="sf-icon-btn" aria-label="Your account: orders and rewards">
      <UserRound className="size-5" aria-hidden="true" />
    </Link>
  );
}

function StoreUnavailableShell({ children }: { children?: ReactNode }) {
  return (
    <>
      <header className="sf-header">
        <div className="sf-container sf-header-inner">
          <Link href="/" className="sf-wordmark"><strong>Menu</strong></Link>
          <div className="sf-header-actions">
            <AccountLink />
            <StorefrontCartLink />
          </div>
        </div>
      </header>
      <div className="sf-container pt-4">
        <p className="sf-alert-error" role="status">Store details are temporarily unavailable. Your account, orders and receipts still work.</p>
      </div>
      {children}
    </>
  );
}

export async function StorefrontShell({
  children,
  store: providedStore,
  cartBar = true,
  band,
}: {
  children?: ReactNode;
  /** Extra rows printed on the merchant band (the home page's open state, pickup time and address). */
  band?: ReactNode;
  store?: CoffeeStorefrontStore | null;
  /** The floating cart bar; checkout and item pages have their own bottom actions. */
  cartBar?: boolean;
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
      <header className={`sf-header ${band ? "sf-header-tall" : ""}`}>
        <div className="sf-container sf-header-inner">
          <StoreBrand store={store} />

          <nav className="sf-nav" aria-label="Storefront">
            <Link href="/#menu">Menu</Link>
            <Link href="/#visit">Hours & location</Link>
            <Link href="/catering">Catering</Link>
            <Link href="/account">Your account</Link>
          </nav>

          <div className="sf-header-actions">
            <AccountLink />
            <StorefrontCartLink />
          </div>
        </div>
        {band ? <div className="sf-container">{band}</div> : null}
      </header>

      {children}

      <footer className="sf-footer">
        <div className="sf-container sf-footer-inner">
          <StoreBrand store={store} size="small" />
          <nav aria-label="Footer">
            <Link href="/#menu">Menu</Link>
            <Link href="/#visit">Hours & location</Link>
            <Link href="/catering">Catering</Link>
            <Link href="/account">Your account</Link>
            <Link href="/checkout">Checkout</Link>
          </nav>
        </div>
      </footer>

      {cartBar ? <StorefrontCartBar /> : null}
    </>
  );
}
