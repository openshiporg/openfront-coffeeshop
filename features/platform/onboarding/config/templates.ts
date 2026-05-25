import seed from '../lib/seed.json';
import { getModifierDisplayName } from '../utils/dataUtils';

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
  };
}

export const STORE_TEMPLATES: Record<TemplateType, CoffeeTemplate> = {
  minimal: {
    name: 'Starter cafe',
    description: 'A small espresso bar menu with a few drinks, modifiers, essential inventory, and default payment providers.',
    displayNames: {
      storeInfo: [seed.minimal.storeInfo.name],
      categories: seed.minimal.categories.map((item: any) => item.name),
      menuItems: seed.minimal.menuItems.map((item: any) => item.name),
      modifiers: seed.minimal.modifiers.map((item: any) => getModifierDisplayName(item)),
      inventoryItems: seed.minimal.inventoryItems.map((item: any) => item.name),
      paymentProviders: seed.minimal.paymentProviders.map((item: any) => item.name),
    },
  },
  full: {
    name: 'Full neighborhood cafe',
    description: 'A realistic coffee shop menu with drinks, pastries, retail beans, modifiers, inventory par levels, and default payment providers.',
    displayNames: {
      storeInfo: [seed.full.storeInfo.name],
      categories: seed.full.categories.map((item: any) => item.name),
      menuItems: seed.full.menuItems.map((item: any) => item.name),
      modifiers: seed.full.modifiers.map((item: any) => getModifierDisplayName(item)),
      inventoryItems: seed.full.inventoryItems.map((item: any) => item.name),
      paymentProviders: seed.full.paymentProviders.map((item: any) => item.name),
    },
  },
  custom: {
    name: 'Custom setup',
    description: 'Use your own JSON template while keeping the family onboarding flow.',
    displayNames: {
      storeInfo: [seed.minimal.storeInfo.name],
      categories: seed.minimal.categories.map((item: any) => item.name),
      menuItems: seed.minimal.menuItems.map((item: any) => item.name),
      modifiers: seed.minimal.modifiers.map((item: any) => getModifierDisplayName(item)),
      inventoryItems: seed.minimal.inventoryItems.map((item: any) => item.name),
      paymentProviders: seed.minimal.paymentProviders.map((item: any) => item.name),
    },
  },
};

export const TEMPLATE_DATA = seed as Record<'minimal' | 'full', any>;

export const SECTION_DEFINITIONS = [
  { id: 1, type: 'storeInfo', label: 'Store information' },
  { id: 2, type: 'categories', label: 'Menu categories' },
  { id: 3, type: 'menuItems', label: 'Menu items' },
  { id: 4, type: 'modifiers', label: 'Item modifiers' },
  { id: 5, type: 'inventoryItems', label: 'Inventory' },
  { id: 6, type: 'paymentProviders', label: 'Payment providers' },
] as const;
