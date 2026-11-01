import Link from "next/link";
import { normalizeStoreLogoColor } from "@/features/platform/store-settings/lib/store-logo";
import type { CoffeeStorefrontStore } from "../lib/data/store";
import { storeOwnMark } from "../lib/store-mark";

/**
 * The mark the store set in Store Settings, in its saved colour. With no mark, or only
 * the platform placeholder, nothing renders and the store name stands alone.
 */
export function StoreMark({ store, className = "" }: { store: CoffeeStorefrontStore; className?: string }) {
  const svg = storeOwnMark(store.logoIcon);
  if (!svg) return null;
  return (
    <span className={`sf-mark ${className}`} aria-hidden="true">
      <span style={{ filter: `hue-rotate(${normalizeStoreLogoColor(store.logoColor)}deg)` }} dangerouslySetInnerHTML={{ __html: svg }} />
    </span>
  );
}

// The merchant's sign: the saved mark above (sidebar) or beside (phone, footer) the store name.
export function StoreBrand({ store, size = "side", sub }: { store: CoffeeStorefrontStore; size?: "side" | "bar" | "small"; sub?: string }) {
  return (
    <Link href="/" className={`sf-brand sf-brand-${size}`} aria-label={`${store.name}, menu`}>
      <StoreMark store={store} />
      <span className="sf-brand-text">
        <strong>{store.name}</strong>
        {sub ? <span className="sf-brand-sub">{sub}</span> : null}
      </span>
    </Link>
  );
}
