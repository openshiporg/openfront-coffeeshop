import Link from "next/link";
import { sanitizeStoreLogoSvg } from "@/features/lib/sanitize-store-logo";
import { normalizeStoreLogoColor } from "@/features/platform/store-settings/lib/store-logo";
import type { CoffeeStorefrontStore } from "../lib/data/store";

// The merchant's sign: the saved mark (in its saved colour, on a white label so
// it reads on the band whatever the hue) and the name set large in print type.
export function StoreBrand({ store, size = "band" }: { store: CoffeeStorefrontStore; size?: "band" | "small" }) {
  const svg = sanitizeStoreLogoSvg(store.logoIcon || "");
  return (
    <Link href="/" className={`sf-wordmark ${size === "small" ? "sf-wordmark-sm" : ""}`} aria-label={`${store.name}, menu`}>
      {svg ? (
        <span className="sf-wordmark-mark" aria-hidden="true">
          <span style={{ filter: `hue-rotate(${normalizeStoreLogoColor(store.logoColor)}deg)` }} dangerouslySetInnerHTML={{ __html: svg }} />
        </span>
      ) : null}
      <strong>{store.name}</strong>
    </Link>
  );
}
