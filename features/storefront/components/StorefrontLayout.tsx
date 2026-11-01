import type { CSSProperties, ReactNode } from "react";
import type { Metadata } from "next";
import { Instrument_Serif, Jost } from "next/font/google";

import { getStoreLogoThemeHue } from "@/features/keystone/lib/brand-colors";
import { UnconfiguredStorefront } from "@/features/storefront/components/StorefrontShell";
import { getCoffeeStore, getCoffeeStoreResult } from "@/features/storefront/lib/data/store";

// One storefront font/brand frame for every storefront route (the (storefront)
// group layout and the root `/` home). Dashboard typography stays on the root
// layout's Geist variables; these fonts are scoped to `.sf-root`.
// Rigel: a light geometric sans for reading and labels, and an italic display
// serif for the few large greeting lines (welcome, order, page titles).
const sfBody = Jost({
  variable: "--font-sf-body",
  subsets: ["latin"],
});

const sfScript = Instrument_Serif({
  variable: "--font-sf-script",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

type StorefrontBrandStyle = CSSProperties & { "--sf-brand-hue": string };

export async function generateStorefrontMetadata(): Promise<Metadata> {
  try {
    const store = await getCoffeeStore();
    if (!store) {
      return { title: "Store not configured", description: "This storefront is not available yet." };
    }
    return { title: store.name, description: store.description || store.tagline || undefined };
  } catch {
    return { title: "Storefront unavailable", description: "This storefront is temporarily unavailable." };
  }
}

export async function StorefrontFrame({
  children,
  requireStore = true,
}: Readonly<{
  children: ReactNode;
  /** When true (group layout), an unconfigured store renders the shared fallback instead of children. */
  requireStore?: boolean;
}>) {
  // A failed store load still renders children: account history and receipts don't depend on public settings.
  const result = await getCoffeeStoreResult();
  const store = result.kind === "ok" ? result.store : null;
  const style: StorefrontBrandStyle = {
    "--sf-brand-hue": store ? String(getStoreLogoThemeHue(store.logoColor)) : "45",
  };

  return (
    <div className={`sf-root ${sfBody.variable} ${sfScript.variable}`} style={style}>
      {result.kind !== "unconfigured" || !requireStore ? children : <UnconfiguredStorefront />}
    </div>
  );
}

/** (storefront) route-group layout: children-only props, as Next layout typing requires. */
export function StorefrontLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <StorefrontFrame>{children}</StorefrontFrame>;
}

export default StorefrontLayout;
