import { MenuItemPage } from "@/features/storefront/screens/MenuItemPage";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <MenuItemPage id={id} />;
}
