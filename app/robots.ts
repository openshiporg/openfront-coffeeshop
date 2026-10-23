import type { MetadataRoute } from "next";
import { getBaseUrl } from "@/features/dashboard/lib/getBaseUrl";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = await getBaseUrl();
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/dashboard", "/account", "/checkout", "/order-confirmed", "/api"] },
    sitemap: `${base}/sitemap.xml`,
  };
}
