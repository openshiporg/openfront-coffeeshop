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

/**
 * One tap on an option, by the product page's rules: a single-choice group swaps its pick (a required one
 * can't be cleared); a multi-choice group toggles within its maximum.
 */
export function toggleModifierSelection(selected: string[], id: string, group: Pick<StorefrontModifierGroup, "minimum" | "maximum" | "modifiers">): string[] {
  const members = group.modifiers.map((modifier) => modifier.id);
  if (selected.includes(id)) {
    if (group.maximum === 1 && group.minimum >= 1) return selected;
    return selected.filter((modifierId) => modifierId !== id);
  }
  if (group.maximum === 1) return [...selected.filter((modifierId) => !members.includes(modifierId)), id];
  if (selected.filter((modifierId) => members.includes(modifierId)).length >= group.maximum) return selected;
  return [...selected, id];
}

/** Groups whose minimum the selection doesn't meet yet. */
export function unmetModifierGroups(item: StorefrontMenuItem, selected: string[]) {
  return modifierGroups(item).filter((group) => group.modifiers.filter((modifier) => selected.includes(modifier.id)).length < group.minimum);
}

/** Display unit price for a selection; the server quote stays the price of record. */
export function selectionUnitPrice(item: StorefrontMenuItem, selected: string[]) {
  return item.price + (item.modifiers || []).filter((modifier) => selected.includes(modifier.id)).reduce((sum, modifier) => sum + Number(modifier.priceAdjustment || 0), 0);
}

export const ROW_GROUP_LIMIT = 2;
export const ROW_OPTION_LIMIT = 3;

/**
 * What a menu row can offer inline: up to two groups of up to three in-stock options each.
 * Anything else (a third group, a long list) stays on the item page behind "More options".
 */
export function rowModifierLayout(item: StorefrontMenuItem) {
  const groups = modifierGroups(item);
  const inline = groups
    .map((group) => ({
      ...group,
      // The standard choice first, then by price, so a row reads "12 oz · 16 oz +$0.75".
      modifiers: group.modifiers
        .filter((modifier) => modifier.inStock)
        .sort((a, b) => Number(b.defaultSelected) - Number(a.defaultSelected) || Number(a.priceAdjustment || 0) - Number(b.priceAdjustment || 0)),
    }))
    // A required group with a single option isn't a choice (the item page still lists it).
    .filter((group) => !(group.minimum >= 1 && group.modifiers.length === 1))
    // Choices the drink needs (size, milk) lead; optional add-ons follow.
    .sort((a, b) => Number(b.minimum >= 1) - Number(a.minimum >= 1));
  const fits = inline.filter((group) => group.modifiers.length > 0 && group.modifiers.length <= ROW_OPTION_LIMIT).slice(0, ROW_GROUP_LIMIT);
  const shown = new Set(fits.map((group) => group.key));
  const more = inline.some((group) => !shown.has(group.key) && group.modifiers.length > 0);
  return { inline: fits, more };
}

/** True when the item's standard choices already satisfy every required group, so it can be added in one tap. */
export function quickAddReady(item: StorefrontMenuItem) {
  const defaults = new Set(defaultModifierIds(item));
  return modifierGroups(item).every((group) => group.modifiers.filter((modifier) => defaults.has(modifier.id)).length >= group.minimum);
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
