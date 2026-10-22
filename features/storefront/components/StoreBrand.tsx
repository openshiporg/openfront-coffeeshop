import Link from "next/link";
import { sanitizeStoreLogoSvg } from "@/features/lib/sanitize-store-logo";
import { normalizeStoreLogoColor } from "@/features/platform/store-settings/lib/store-logo";
import type { CoffeeStorefrontStore } from "../lib/data/store";

// One lockup for header and footer (Restaurant lineage).
export function StoreBrand({ store }: { store: CoffeeStorefrontStore }) {
  const svg = sanitizeStoreLogoSvg(store.logoIcon || "");
  return (
    <Link href="/" className="sf-wordmark flex min-h-11 min-w-0 items-center gap-2.5" aria-label={store.name}>
      {svg ? <span className="block size-9 shrink-0 [&>svg]:block [&>svg]:size-full" style={{ filter: `hue-rotate(${normalizeStoreLogoColor(store.logoColor)}deg)` }} dangerouslySetInnerHTML={{ __html: svg }} aria-hidden="true" /> : null}
      <span className="min-w-0">
        <strong>{store.name}</strong>
        {store.tagline ? <small>{store.tagline}</small> : null}
      </span>
    </Link>
  );
}
