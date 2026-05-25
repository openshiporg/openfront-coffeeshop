import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { MenuManager } from "../components/MenuManager";

const MENU_MANAGER_QUERY = `
  query MenuManagerData {
    menuCategories(orderBy: { sortOrder: asc }) {
      id
      name
      description
    }
    menuItems(orderBy: { name: asc }) {
      id
      name
      shortDescription
      price
      available
      featured
      popular
      prepTimeMinutes
      barStation
      category { id name }
      modifiers {
        id
        name
        modifierGroup
        modifierGroupLabel
        priceAdjustment
        inStock
        defaultSelected
      }
    }
  }
`;

export async function MenuManagerPage() {
  const response = await keystoneClient<{ menuCategories: any[]; menuItems: any[] }>(MENU_MANAGER_QUERY, {}, { cache: "no-store" });
  return <MenuManager categories={response.success ? response.data.menuCategories || [] : []} items={response.success ? response.data.menuItems || [] : []} />;
}
