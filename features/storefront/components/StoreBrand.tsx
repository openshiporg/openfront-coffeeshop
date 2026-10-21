import Link from "next/link";
import { sanitizeStoreLogoSvg } from "@/features/lib/sanitize-store-logo";
import { normalizeStoreLogoColor } from "@/features/platform/store-settings/lib/store-logo";
import type { CoffeeStorefrontStore } from "../lib/data/store";

// One lockup for header, mobile navigation and footer (Restaurant lineage).
export function StoreBrand({ store }: { store: CoffeeStorefrontStore }) {
  const svg = sanitizeStoreLogoSvg(store.logoIcon || "");
  return (
    <Link href="/" className="sf-wordmark flex min-h-11 min-w-0 items-center gap-3" aria-label={store.name}>
      {svg ? <span className="block size-8 shrink-0 [&>svg]:block [&>svg]:size-full" style={{ filter: `hue-rotate(${normalizeStoreLogoColor(store.logoColor)}deg)` }} dangerouslySetInnerHTML={{ __html: svg }} aria-hidden="true" /> : null}
      <span className="min-w-0"><small>{store.tagline}</small><strong>{store.name}</strong></span>
    </Link>
  );
}
