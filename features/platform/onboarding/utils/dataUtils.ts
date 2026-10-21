type NamedItem = { name?: string };
type SeedModifier = NamedItem & { menuItemName?: string };
export type CoffeeSeedData = {
  storeInfo?: NamedItem;
  categories?: NamedItem[];
  menuItems?: NamedItem[];
  modifiers?: SeedModifier[];
  inventoryItems?: NamedItem[];
  paymentProviders?: NamedItem[];
  suppliers?: NamedItem[];
  recipes?: NamedItem[];
  ingredients?: NamedItem[];
  purchaseOrders?: Array<{ poNumber?: string }>;
  staffShifts?: Array<{ shiftNumber?: string }>;
  loyaltyAccounts?: Array<{ customerEmail?: string }>;
  cateringOrders?: Array<{ cateringNumber?: string }>;
};

type SeedTemplates = {
  minimal: CoffeeSeedData;
  full: CoffeeSeedData;
};

export function getModifierDisplayName(modifier: SeedModifier): string {
  const modifierName = modifier.name || "Unknown Modifier";
  const menuItemName = modifier.menuItemName?.trim();
  return menuItemName ? `${menuItemName} · ${modifierName}` : modifierName;
}

export function getItemsFromJsonData(jsonData: CoffeeSeedData | null | undefined, sectionType: string): string[] {
  if (!jsonData) return [];

  switch (sectionType) {
    case "storeInfo":
      return jsonData.storeInfo ? [jsonData.storeInfo.name || "Store Information"] : ["Store Information"];
    case "categories":
      return (jsonData.categories || []).map((category) => category.name || "Unknown Category");
    case "menuItems":
      return (jsonData.menuItems || []).map((item) => item.name || "Unknown Item");
    case "modifiers":
      return (jsonData.modifiers || []).map((modifier) => getModifierDisplayName(modifier));
    case "inventoryItems":
      return (jsonData.inventoryItems || []).map((item) => item.name || "Unknown Inventory Item");
    case "paymentProviders":
      return (jsonData.paymentProviders || []).map((item) => item.name || "Unknown Payment Provider");
    case "suppliers":
      return (jsonData.suppliers || []).map((item) => item.name || "Unknown Supplier");
    case "recipes":
      return (jsonData.recipes || []).map((item) => item.name || "Unknown Recipe");
    case "ingredients":
      return (jsonData.ingredients || []).map((item) => item.name || "Unknown Ingredient");
    case "purchaseOrders":
      return (jsonData.purchaseOrders || []).map((item) => item.poNumber || "Unknown Purchase Order");
    case "staffShifts":
      return (jsonData.staffShifts || []).map((item) => item.shiftNumber || "Unknown Shift");
    case "loyaltyAccounts":
      return (jsonData.loyaltyAccounts || []).map((item) => item.customerEmail || "Unknown Loyalty Account");
    case "cateringOrders":
      return (jsonData.cateringOrders || []).map((item) => item.cateringNumber || "Unknown Catering Inquiry");
    default:
      return [];
  }
}

/** Custom setup starts empty: nothing is previewed or submitted until a payload is applied. */
export function getSeedForTemplate(template: "full" | "minimal" | "custom", seedData: SeedTemplates): CoffeeSeedData {
  return template === "custom" ? {} : structuredClone(seedData[template]);
}
