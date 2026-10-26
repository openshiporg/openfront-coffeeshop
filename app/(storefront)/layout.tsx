import type { CSSProperties, ReactNode } from "react";

import { getStoreLogoThemeHue } from "@/features/keystone/lib/brand-colors";
import { generateStorefrontMetadata, StorefrontLayout } from "@/features/storefront/components/StorefrontLayout";
import { getCoffeeStore } from "@/features/storefront/lib/data/store";
import "../storefront-cup.css";

export const generateMetadata = generateStorefrontMetadata;

type LogoThemeStyle = CSSProperties & { "--sf-logo-hue"?: string };

// The saved logo colour themes the storefront accent tokens (app/storefront-cup.css).
export default async function StorefrontGroupLayout({ children }: Readonly<{ children: ReactNode }>) {
  let style: LogoThemeStyle = {};
  try {
    const store = await getCoffeeStore();
    if (store) style = { "--sf-logo-hue": String(getStoreLogoThemeHue(store.logoColor)) };
  } catch {
    // StorefrontLayout renders the unavailable state for a failed store load.
  }

  return (
    <div className="contents" style={style}>
      <StorefrontLayout>{children}</StorefrontLayout>
    </div>
  );
}
