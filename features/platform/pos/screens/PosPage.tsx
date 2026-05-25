import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { PosRegister } from "../components/PosRegister";

const POS_MENU_QUERY = `
  query PosMenu {
    menuItems(where: { available: { equals: true } }, orderBy: { name: asc }) {
      id
      name
      price
      category { id name }
      modifiers {
        id
        name
        modifierGroup
        modifierGroupLabel
        priceAdjustment
        defaultSelected
        inStock
      }
    }
  }
`;

export async function PosPage() {
  const response = await keystoneClient<{ menuItems: any[] }>(POS_MENU_QUERY, {}, { cache: "no-store" });
  const items = response.success ? response.data.menuItems || [] : [];
  return <PosRegister items={items} />;
}
