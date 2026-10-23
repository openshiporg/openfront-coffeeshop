import type { MetadataRoute } from "next";
import { getBaseUrl } from "@/features/dashboard/lib/getBaseUrl";
import { getStorefrontMenu } from "@/features/storefront/lib/data/menu";

export const dynamic = "force-dynamic";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = await getBaseUrl();
  const menu = await getStorefrontMenu().catch(() => null);
  const items = menu?.kind === "ok" ? menu.items : [];
  return [{ url: `${base}/` }, ...items.map((item) => ({ url: `${base}/menu/${item.id}` }))];
}
