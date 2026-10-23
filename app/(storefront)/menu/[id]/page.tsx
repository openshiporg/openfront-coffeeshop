import type { Metadata } from "next";
import { MenuItemPage } from "@/features/storefront/screens/MenuItemPage";
import { getStorefrontMenuItem } from "@/features/storefront/lib/data/menu";
import { getCoffeeStore } from "@/features/storefront/lib/data/store";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const [result, store] = await Promise.all([getStorefrontMenuItem(id), getCoffeeStore().catch(() => null)]);
  const name = result.kind === "found" ? result.item.name : result.kind === "not-found" ? "Item not found" : "Item unavailable";
  return { title: store?.name ? `${name} · ${store.name}` : name, description: result.kind === "found" ? result.item.shortDescription || undefined : undefined };
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MenuItemPage id={id} />;
}
