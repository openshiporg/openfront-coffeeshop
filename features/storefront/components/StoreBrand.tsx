import Link from "next/link";
import { sanitizeStoreLogoSvg } from "@/features/lib/sanitize-store-logo";
import { normalizeStoreLogoColor } from "@/features/platform/store-settings/lib/store-logo";
import type { CoffeeStorefrontStore } from "../lib/data/store";

/** The saved mark from Store Settings, in its saved colour. Never a drawn-in logo. */
export function StoreMark({ store, className = "" }: { store: CoffeeStorefrontStore; className?: string }) {
  const svg = sanitizeStoreLogoSvg(store.logoIcon || "");
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
