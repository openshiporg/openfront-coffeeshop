import seed from '../lib/seed.json';
import { getModifierDisplayName, type CoffeeSeedData } from '../utils/dataUtils';

export type TemplateType = 'minimal' | 'full' | 'custom';

export interface CoffeeTemplate {
  name: string;
  description: string;
  displayNames: {
    storeInfo: string[];
    categories: string[];
    menuItems: string[];
    modifiers: string[];
    inventoryItems: string[];
    paymentProviders: string[];
    suppliers: string[];
    recipes: string[];
    ingredients: string[];
    purchaseOrders: string[];
    staffShifts: string[];
    loyaltyAccounts: string[];
    cateringOrders: string[];
  };
}

function displayNames(template: CoffeeSeedData): CoffeeTemplate['displayNames'] {
  return {
    storeInfo: [template.storeInfo?.name || 'Store information'],
    categories: (template.categories || []).map((item) => item.name || ''),
    menuItems: (template.menuItems || []).map((item) => item.name || ''),
    modifiers: (template.modifiers || []).map((item) => getModifierDisplayName(item)),
    inventoryItems: (template.inventoryItems || []).map((item) => item.name || ''),
    paymentProviders: (template.paymentProviders || []).map((item) => item.name || ''),
    suppliers: (template.suppliers || []).map((item) => item.name || ''),
    recipes: (template.recipes || []).map((item) => item.name || ''),
    ingredients: (template.ingredients || []).map((item) => item.name || ''),
    purchaseOrders: (template.purchaseOrders || []).map((item) => item.poNumber || ''),
    staffShifts: (template.staffShifts || []).map((item) => item.shiftNumber || ''),
    loyaltyAccounts: (template.loyaltyAccounts || []).map((item) => item.customerEmail || ''),
    cateringOrders: (template.cateringOrders || []).map((item) => item.cateringNumber || ''),
  };
}

export const STORE_TEMPLATES: Record<TemplateType, CoffeeTemplate> = {
  minimal: {
    name: 'Starter cafe',
    description: 'A small espresso bar menu with modifiers, recipes and essential inventory items. Stock starts at zero until you count it.',
    displayNames: displayNames(seed.minimal as CoffeeSeedData),
  },
  full: {
    name: 'Full neighborhood cafe',
    description: 'A fuller menu with modifiers, recipes, inventory items and an example supplier. Stock starts at zero until you count it.',
    displayNames: displayNames(seed.full as CoffeeSeedData),
  },
  custom: {
    name: 'Custom setup',
    description: 'Paste your own setup configuration, review it, then confirm.',
    displayNames: displayNames({}),
  },
};

export const TEMPLATE_DATA = seed as Record<'minimal' | 'full', CoffeeSeedData>;

export const SECTION_DEFINITIONS = [
  { id: 1, type: 'storeInfo', label: 'Store information' },
  { id: 2, type: 'categories', label: 'Menu categories' },
  { id: 3, type: 'menuItems', label: 'Menu items' },
  { id: 4, type: 'modifiers', label: 'Item modifiers' },
  { id: 5, type: 'inventoryItems', label: 'Inventory' },
  { id: 6, type: 'paymentProviders', label: 'Payment providers' },
  { id: 7, type: 'suppliers', label: 'Suppliers' },
  { id: 8, type: 'recipes', label: 'Recipes' },
  { id: 9, type: 'ingredients', label: 'Recipe ingredients' },
  { id: 10, type: 'purchaseOrders', label: 'Starter purchasing' },
  { id: 11, type: 'staffShifts', label: 'Scheduled coverage' },
  { id: 12, type: 'loyaltyAccounts', label: 'Loyalty accounts' },
  { id: 13, type: 'cateringOrders', label: 'Catering inquiries' },
] as const;
