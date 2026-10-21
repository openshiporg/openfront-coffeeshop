import type { CartLine } from "./types";

export const CART_STORAGE_KEY = "openfront-coffee-cart";
export const CART_EVENT = "openfront-coffee-cart-updated";

/** Same limits as the server's order-line validation (validateCafeOrderLines). */
export const CART_LIMITS = { maxLines: 50, maxLineQuantity: 50, maxTotalQuantity: 100 } as const;

function emitCartEvent() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(CART_EVENT));
}

export function cartQuantity(lines: CartLine[]) {
  return lines.reduce((sum, line) => sum + line.quantity, 0);
}

export function loadCartLines(): CartLine[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CART_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((line): line is CartLine => {
      if (!line || typeof line !== "object") return false;
      const candidate = line as Partial<CartLine>;
      return Boolean(
        typeof candidate.cartId === "string" &&
        typeof candidate.menuItemId === "string" &&
        typeof candidate.name === "string" &&
        typeof candidate.quantity === "number" &&
        Number.isSafeInteger(candidate.quantity) &&
        candidate.quantity >= 1 &&
        typeof candidate.unitPrice === "number" &&
        Array.isArray(candidate.modifierIds) &&
        Array.isArray(candidate.modifierNames),
      );
    }).map((line) => ({ ...line, quantity: Math.min(line.quantity, CART_LIMITS.maxLineQuantity) }));
  } catch {
    return [];
  }
}

/** Saves the cart; returns false when browser storage is unavailable so callers can say so. */
export function saveCartLines(lines: CartLine[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(lines));
  } catch {
    return false;
  }
  emitCartEvent();
  return true;
}

export function clearCartLines(): boolean {
  if (typeof window === "undefined") return false;
  try {
    window.localStorage.removeItem(CART_STORAGE_KEY);
  } catch {
    return false;
  }
  emitCartEvent();
  return true;
}

/** Removes only the lines that were submitted, so items added in another tab meanwhile survive. */
export function removeCartLines(cartIds: string[]): boolean {
  const submitted = new Set(cartIds);
  const remaining = loadCartLines().filter((line) => !submitted.has(line.cartId));
  return remaining.length ? saveCartLines(remaining) : clearCartLines();
}

/** Adds a line within the order limits; returns a customer-facing reason when it cannot. */
export function addCartLine(line: CartLine): string | null {
  const lines = loadCartLines();
  if (lines.length >= CART_LIMITS.maxLines) return `Your cart can hold up to ${CART_LIMITS.maxLines} different items. Check out or remove an item first.`;
  if (cartQuantity(lines) + line.quantity > CART_LIMITS.maxTotalQuantity) return `One pickup order can include up to ${CART_LIMITS.maxTotalQuantity} items. Check out or reduce a quantity first.`;
  if (!saveCartLines([...lines, line])) return "Your browser blocked saving the cart. Allow site storage and try again.";
  return null;
}
