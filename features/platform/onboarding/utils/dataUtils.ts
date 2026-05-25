export function getModifierDisplayName(modifier: any): string {
  const modifierName = modifier?.name || 'Unknown Modifier';
  const menuItemName = modifier?.menuItemName?.trim();
  return menuItemName ? `${menuItemName} · ${modifierName}` : modifierName;
}

export function getItemsFromJsonData(jsonData: any, sectionType: string): string[] {
  if (!jsonData) return [];

  switch (sectionType) {
    case 'storeInfo':
      return jsonData.storeInfo ? [jsonData.storeInfo.name || 'Store Information'] : ['Store Information'];
    case 'categories':
      return (jsonData.categories || []).map((category: any) => category.name || 'Unknown Category');
    case 'menuItems':
      return (jsonData.menuItems || []).map((item: any) => item.name || 'Unknown Item');
    case 'modifiers':
      return (jsonData.modifiers || []).map((modifier: any) => getModifierDisplayName(modifier));
    case 'inventoryItems':
      return (jsonData.inventoryItems || []).map((item: any) => item.name || 'Unknown Inventory Item');
    case 'paymentProviders':
      return (jsonData.paymentProviders || []).map((item: any) => item.name || 'Unknown Payment Provider');
    default:
      return [];
  }
}

export function getSeedForTemplate(template: 'full' | 'minimal' | 'custom', seedData: any) {
  const source = template === 'custom' ? seedData.minimal : seedData[template];
  return JSON.parse(JSON.stringify(source));
}
