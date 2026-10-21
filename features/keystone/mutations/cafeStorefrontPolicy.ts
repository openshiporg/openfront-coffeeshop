import { timingSafeEqual } from "node:crypto";

import { fingerprintInput } from "./idempotency";
import type { InventoryRequirement } from "./coffeeInventoryConsumption";

/** Shared storefront rules so the quote, menu and order creation agree. */

export const CAFE_PICKUP_PREP_BUFFER_MINUTES = 5;

/** Earliest pickup the cafe will accept for an online request: the configured lead time or the slowest item's prep time. */
export function cafeEarliestPickupMinutes(storeLeadMinutes: number, prepTimes: Array<number | null | undefined>) {
  const prep = prepTimes.map((minutes) => (Number.isFinite(Number(minutes)) ? Number(minutes) : 0) + CAFE_PICKUP_PREP_BUFFER_MINUTES);
  return Math.max(5, Number(storeLeadMinutes) || 0, ...prep);
}

export type CafeQuoteTerms = {
  currencyCode: string;
  subtotal: number;
  tax: number;
  total: number;
  estimatedPickupMinutes: number;
  lines: Array<{ menuItemId: string; quantity: number; modifierIds: string[]; unitPrice: number }>;
};

/** Opaque token for the exact commercial terms a customer reviewed; order creation recomputes and compares it. */
export function cafeQuoteToken(terms: CafeQuoteTerms) {
  return fingerprintInput({
    currencyCode: terms.currencyCode,
    subtotal: terms.subtotal,
    tax: terms.tax,
    total: terms.total,
    estimatedPickupMinutes: terms.estimatedPickupMinutes,
    lines: terms.lines.map((line) => ({ menuItemId: line.menuItemId, quantity: line.quantity, modifierIds: [...line.modifierIds].sort(), unitPrice: line.unitPrice })),
  });
}

/** A menu item is published when it is available and either uncategorized or in an active category. */
export function isPublishedMenuItem(item: { available?: boolean | null; category?: { active?: boolean | null } | null }) {
  return Boolean(item.available) && (!item.category || item.category.active !== false);
}

export const PUBLISHED_MENU_ITEM_WHERE = {
  available: true,
  OR: [{ categoryId: null }, { category: { active: true } }],
};

type StockReader = {
  inventoryItem: { findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>> };
};

/** Read-only check that current stock covers the requirements. It is not a reservation; acceptance re-checks under locks. */
export async function assertCafeRequirementsInStock(client: StockReader, storeId: string, requirements: InventoryRequirement[]) {
  const inventory = requirements.filter((requirement): requirement is Extract<InventoryRequirement, { kind: "inventory" }> => requirement.kind === "inventory");
  if (!inventory.length) return;
  const rows = await client.inventoryItem.findMany({ where: { storeId, id: { in: inventory.map((requirement) => requirement.inventoryItemId) } }, select: { id: true, currentStock: true } });
  const stock = new Map(rows.map((row) => [String(row.id), Number(row.currentStock)]));
  for (const requirement of inventory) {
    const available = stock.get(requirement.inventoryItemId);
    if (available === undefined || !Number.isFinite(available) || available < requirement.quantity) throw new Error("Part of this order is sold out right now");
  }
}

const RECEIPT_KEY_PATTERN = /^[0-9a-f]{64}$/;

/** Receipt keys are 32 random bytes as lowercase hex, created by the customer's browser for one pickup request. */
export function normalizeCafeReceiptKey(value?: string | null) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !RECEIPT_KEY_PATTERN.test(value)) throw new Error("Receipt key is invalid");
  return value;
}

export function cafeReceiptKeyMatches(presented?: string | null, stored?: string | null) {
  if (!presented || !stored || presented.length !== stored.length) return false;
  return timingSafeEqual(Buffer.from(presented), Buffer.from(stored));
}

const IMAGE_REFERENCE_PREFIX = "keystone-image:my_images/";
const IMAGE_EXTENSIONS = ["jpg", "png", "webp", "gif"] as const;
type ImageExtension = (typeof IMAGE_EXTENSIONS)[number];
type ImagesContext = { images(storage: string): { getUrl(id: string, extension: ImageExtension): Promise<string> } };

/** Stable reference to an uploaded Keystone image (signed URLs expire, so snapshots keep the id, not the URL). */
export function cafeUploadedImageReference(image?: { image_id?: string | null; image_extension?: string | null } | null) {
  if (!image?.image_id || !IMAGE_EXTENSIONS.includes(image.image_extension as ImageExtension)) return null;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(image.image_id)) return null;
  return `${IMAGE_REFERENCE_PREFIX}${image.image_id}.${image.image_extension}`;
}

function legacyImagePath(imagePath?: string | null) {
  if (!imagePath) return null;
  if (/^(https?:|data:|blob:)/.test(imagePath) || imagePath.startsWith("/images/")) return imagePath;
  return imagePath.startsWith("/") ? `/images${imagePath}` : `/images/${imagePath}`;
}

/** Resolve a menu image or order snapshot reference to a displayable URL; missing or unreadable images fall back to null. */
export async function resolveCafeImageUrl(context: unknown, reference?: string | null) {
  if (!reference) return null;
  if (!reference.startsWith(IMAGE_REFERENCE_PREFIX)) return legacyImagePath(reference);
  const [id, extension] = reference.slice(IMAGE_REFERENCE_PREFIX.length).split(".");
  if (!id || !IMAGE_EXTENSIONS.includes(extension as ImageExtension)) return null;
  try {
    return await (context as ImagesContext).images("my_images").getUrl(id, extension as ImageExtension);
  } catch {
    return null;
  }
}

/** The primary image reference for a menu item: uploaded image first, then the legacy path, then the legacy URL. */
export function cafeMenuItemImageReference(item: { imageUrl?: string | null; menuItemImages?: Array<{ imagePath?: string | null; image_id?: string | null; image_extension?: string | null }> | null }) {
  const primary = item.menuItemImages?.[0];
  return cafeUploadedImageReference(primary) || primary?.imagePath || item.imageUrl || null;
}
