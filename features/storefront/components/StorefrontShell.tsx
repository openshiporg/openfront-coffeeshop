import Link from "next/link";
import type { ReactNode } from "react";
import { BookOpen, ClipboardList, Clock3, Coffee, CreditCard, Gift, MapPin, ShoppingBag, Store, UserRound, UtensilsCrossed } from "lucide-react";
import { StorefrontCartLink, StorefrontDock } from "./StorefrontCartLink";
import { OrderPanel } from "./OrderPanel";
import { ScrollEdge } from "./ScrollEdge";
import { PickupNow } from "./PickupNow";
import { StoreBrand, StoreMark } from "./StoreBrand";
import { getCoffeeStoreResult, type CoffeeStorefrontStore } from "@/features/storefront/lib/data/store";
import { getStorefrontMenu } from "@/features/storefront/lib/data/menu";

export function UnconfiguredStorefront() {
  return (
    <main className="sf-container sf-unconfigured">
      <section className="sf-panel" aria-labelledby="storefront-unconfigured-title">
        <h1 id="storefront-unconfigured-title" className="sf-script sf-page-title">Store not configured</h1>
        <p className="sf-muted mt-3">This store isn’t open for online orders yet.</p>
      </section>
    </main>
  );
}

function StoreUnavailableShell({ children }: { children?: ReactNode }) {
  return (
    <div className="sf-app">
      <ScrollEdge />
      <header className="sf-topbar">
        <Link href="/" className="sf-brand sf-brand-bar"><span className="sf-brand-text"><strong>Menu</strong></span></Link>
        <div className="sf-topbar-actions">
          <Link href="/account" className="sf-icon-btn" aria-label="Your account: orders and rewards"><UserRound className="size-5" aria-hidden="true" /></Link>
          <StorefrontCartLink />
        </div>
      </header>
      <div className="sf-main">
        <div className="sf-container pt-4">
          <p className="sf-alert-error" role="status">Store details are temporarily unavailable. Your account, orders and receipts still work.</p>
        </div>
        {children}
      </div>
    </div>
  );
}

/** The shop's bagged-beans category, when it sells any: the menu's own retail shelf. */
async function beansCategory() {
  const menu = await getStorefrontMenu("", "").catch(() => null);
  if (!menu || menu.kind !== "ok") return null;
  const retail = menu.items.find((item) => item.barStation === "retail_shelf" && item.category);
  return retail?.category ?? null;
}

export async function StorefrontShell({
  children,
  store: providedStore,
  cartBar = true,
  rail = false,
  tabbar = true,
  active,
}: {
  children?: ReactNode;
  store?: CoffeeStorefrontStore | null;
  /** The docked bag bar on phones; checkout and item pages have their own bottom actions. */
  cartBar?: boolean;
  /** The desktop order rail (home and item pages). */
  rail?: boolean;
  /** The phone tab bar; the item page docks its add bar there instead. */
  tabbar?: boolean;
  active?: "menu" | "orders" | "rewards" | "beans" | "account" | "catering" | "giftcards" | "visit" | "checkout";
}) {
  let store = providedStore ?? null;
  if (providedStore === undefined) {
    const result = await getCoffeeStoreResult();
    if (result.kind === "unavailable") return <StoreUnavailableShell>{children}</StoreUnavailableShell>;
    store = result.kind === "ok" ? result.store : null;
  }
  if (!store) return <UnconfiguredStorefront />;

  const beans = await beansCategory();
  const beansHref = beans ? `/?category=${encodeURIComponent(beans.id)}#menu` : null;
  const hours = { weeklyHours: store.weeklyHours, timezone: store.timezone, pickupLeadTimeMinutes: store.pickupLeadTimeMinutes ?? null };
  const current = (key: typeof active) => (active === key ? "page" : undefined);

  return (
    <div className={`sf-app ${rail ? "has-rail" : ""} ${tabbar ? "has-tabbar" : ""}`}>
      <aside className="sf-side" aria-label="Store">
        <StoreBrand store={store} size="side" />
        <Link href="/#menu" className="sf-btn sf-btn-primary sf-side-cta">Order Online</Link>
        <nav className="sf-side-nav" aria-label="Storefront">
          <Link href="/#menu" aria-current={current("menu")}><ShoppingBag aria-hidden="true" />Order</Link>
          <Link href="/account#rewards" aria-current={current("rewards")}><Gift aria-hidden="true" />Rewards</Link>
          <Link href="/account#orders" aria-current={current("orders")}><ClipboardList aria-hidden="true" />Your Orders</Link>
          {beansHref ? <Link href={beansHref} aria-current={current("beans")}><Store aria-hidden="true" />Shop</Link> : null}
          <Link href="/catering" aria-current={current("catering")}><UtensilsCrossed aria-hidden="true" />Catering</Link>
          <Link href="/gift-cards" aria-current={current("giftcards")}><CreditCard aria-hidden="true" />Gift Cards</Link>
          <Link href="/#visit" aria-current={current("visit")}><Coffee aria-hidden="true" />Our Café</Link>
          <Link href="/account" aria-current={current("account")}><UserRound aria-hidden="true" />Account</Link>
        </nav>
        <div className="sf-side-foot">
          <p className="sf-side-label"><Clock3 aria-hidden="true" />Pickup Time</p>
          <PickupNow hours={hours} />
        </div>
      </aside>

      <ScrollEdge />
      <header className="sf-topbar">
        <StoreBrand store={store} size="bar" sub="Order Ahead · Pick Up" />
        <div className="sf-topbar-actions">
          <Link href="/account" className="sf-icon-btn sf-avatar" aria-label="Your account: orders and rewards">
            <UserRound className="size-5" aria-hidden="true" />
          </Link>
          <StorefrontCartLink />
        </div>
      </header>

      <div className="sf-main">
        {children}
        <footer className="sf-footer">
          <div className="sf-footer-inner">
            <Link href="/" className="sf-brand sf-brand-small" aria-label={`${store.name}, menu`}>
              <StoreMark store={store} />
              <span className="sf-brand-text"><strong>{store.name}</strong></span>
            </Link>
            <nav aria-label="Footer">
              <Link href="/#menu">Menu</Link>
              <Link href="/#visit">Hours & location</Link>
              <Link href="/catering">Catering</Link>
              <Link href="/gift-cards">Gift cards</Link>
              <Link href="/account">Your account</Link>
              <Link href="/checkout">Checkout</Link>
            </nav>
          </div>
        </footer>
      </div>

      {rail ? <OrderPanel hours={hours} /> : null}

      {cartBar || tabbar ? <StorefrontDock cart={cartBar}>{tabbar ? <nav className="sf-tabbar" aria-label="Sections">
        <Link href="/#menu" aria-current={current("menu")}><BookOpen aria-hidden="true" /><span>Menu</span></Link>
        <Link href="/account#orders" aria-current={current("orders")}><ClipboardList aria-hidden="true" /><span>Orders</span></Link>
        <Link href="/account#rewards" aria-current={current("rewards")}><Gift aria-hidden="true" /><span>Rewards</span></Link>
        {beansHref ? (
          <Link href={beansHref} aria-current={current("beans")}><Store aria-hidden="true" /><span>Beans</span></Link>
        ) : (
          <Link href="/#visit" aria-current={current("visit")}><MapPin aria-hidden="true" /><span>Visit</span></Link>
        )}
        <Link href="/account#profile" aria-current={current("account")}><UserRound aria-hidden="true" /><span>Profile</span></Link>
      </nav> : null}</StorefrontDock> : null}
    </div>
  );
}
