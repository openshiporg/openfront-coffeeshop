import type { CafeOrderQuote } from "../data/orders";
import type { StorefrontMenuItem } from "../data/menu";
import type { CartLine } from "./types";

export function requiresCustomization(item: StorefrontMenuItem) {
  return (item.modifiers || []).some(
    (modifier) => modifier.required || modifier.minSelections > 0,
  );
}

export type StorefrontModifierGroup = {
  key: string;
  label: string;
  minimum: number;
  maximum: number;
  modifiers: NonNullable<StorefrontMenuItem["modifiers"]>;
};

/** Groups modifiers by their stable group key with the same bounds the server enforces; labels are display only. */
export function modifierGroups(item: StorefrontMenuItem): StorefrontModifierGroup[] {
  const groups = new Map<string, StorefrontModifierGroup>();
  for (const modifier of item.modifiers || []) {
    const key = modifier.modifierGroup || "default";
    const group = groups.get(key) || { key, label: modifier.modifierGroupLabel || modifier.modifierGroup || "Options", minimum: 0, maximum: 1, modifiers: [] };
    group.modifiers.push(modifier);
    group.minimum = Math.max(group.minimum, modifier.required ? 1 : 0, Number(modifier.minSelections || 0));
    group.maximum = Math.max(group.maximum, Number(modifier.maxSelections || 1));
    groups.set(key, group);
  }
  return [...groups.values()];
}

export function unavailableRequiredModifierGroups(item: StorefrontMenuItem) {
  return modifierGroups(item)
    .filter((group) => group.minimum > group.modifiers.filter((modifier) => modifier.inStock).length)
    .map((group) => group.label);
}

export function defaultModifierIds(item: StorefrontMenuItem) {
  return modifierGroups(item).flatMap((group) =>
    group.modifiers.filter((modifier) => modifier.inStock && modifier.defaultSelected).slice(0, group.maximum).map((modifier) => modifier.id),
  );
}

export function buildQuotedCartLine(
  item: StorefrontMenuItem,
  quote: CafeOrderQuote,
  modifierIds: string[],
  cartId: string,
  quantity = 1,
): CartLine {
  const quotedLine = quote.lines[0];
  if (!quotedLine || quotedLine.menuItemId !== item.id || quotedLine.quantity !== quantity) {
    throw new Error("The menu quote did not match this item");
  }

  const modifierNames = (item.modifiers || [])
    .filter((modifier) => modifierIds.includes(modifier.id))
    .map((modifier) => modifier.name);

  return {
    cartId,
    menuItemId: item.id,
    name: quotedLine.name,
    imageUrl: item.primaryImageUrl || item.imageUrl,
    quantity,
    unitPrice: quotedLine.unitPrice,
    basePrice: item.price,
    modifierIds,
    modifierNames,
    prepTimeMinutes: item.prepTimeMinutes,
  };
}
