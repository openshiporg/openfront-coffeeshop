import { coffeeFirstPickupMinutes, getCoffeeOrderingAvailability } from "./coffeeAvailability";
import { MENU_STOCK_ITEM_SELECT, MENU_STOCK_MODIFIER_SELECT, cafeMenuStock, type MenuStockItem } from "./cafeMenuStock";
import { PUBLISHED_MENU_ITEM_WHERE, cafeEarliestPickupMinutes, cafeMenuItemImageReference, resolveCafeImageUrl } from "./cafeStorefrontPolicy";

type Context = {
  prisma: {
    storeSetting: { findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null> };
    menuCategory: { findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>> };
    menuItem: {
      findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>>;
      findFirst(args: Record<string, unknown>): Promise<Record<string, unknown> | null>;
      count(args: Record<string, unknown>): Promise<number>;
    };
    recipe: { findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>> };
    inventoryItem: { findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>> };
    prepBatch: { findMany(args: Record<string, unknown>): Promise<Array<Record<string, unknown>>> };
  };
};

type MenuArgs = { menuItemId?: string | null; search?: string | null; categoryId?: string | null; after?: string | null };

export const STOREFRONT_MENU_PAGE_SIZE = 48;
const MAX_CATEGORIES = 100;
const UNCATEGORIZED = "uncategorized";

const itemSelect = {
  id: true,
  name: true,
  shortDescription: true,
  price: true,
  available: true,
  featured: true,
  popular: true,
  imageUrl: true,
  prepTimeMinutes: true,
  caffeineMg: true,
  barStation: true,
  temperatureOptions: true,
  dietaryFlags: true,
  serviceWindows: true,
  ...MENU_STOCK_ITEM_SELECT,
  category: { select: { id: true, name: true, active: true } },
  modifiers: {
    orderBy: [{ modifierGroup: "asc" }, { name: "asc" }, { id: "asc" }],
    select: {
      id: true,
      name: true,
      modifierGroup: true,
      modifierGroupLabel: true,
      priceAdjustment: true,
      required: true,
      minSelections: true,
      maxSelections: true,
      defaultSelected: true,
      inStock: true,
      ...MENU_STOCK_MODIFIER_SELECT,
    },
  },
  menuItemImages: { orderBy: { order: "asc" }, take: 1, select: { imagePath: true, image_id: true, image_extension: true } },
};

type MenuStock = Awaited<ReturnType<typeof cafeMenuStock>>;

/** "now": orderable for pickup today; "later": the cafe is closed, so pickup is booked for its next open
 *  time; "sold_out": stock can't cover a serving; "unavailable": nothing opens within the booking horizon. */
function itemAvailability(item: Record<string, unknown>, store: Record<string, unknown>, stock: MenuStock) {
  if (!item.available) return "unavailable";
  if (stock.soldOut.has(String(item.id))) return "sold_out";
  const windows = Array.isArray(item.serviceWindows) ? item.serviceWindows as string[] : ["all_day"];
  if (getCoffeeOrderingAvailability(store, new Date(), windows).orderingOpen) return "now";
  const earliest = cafeEarliestPickupMinutes(Number(store.pickupLeadTimeMinutes) || 12, [item.prepTimeMinutes as number | null]);
  return coffeeFirstPickupMinutes(store, earliest, [windows]) == null ? "unavailable" : "later";
}

async function readMenuStock(context: Context, storeId: string, rows: Array<Record<string, unknown>>) {
  return cafeMenuStock(context.prisma, storeId, rows.map((row): MenuStockItem => ({
    id: String(row.id),
    inventoryItemId: (row.inventoryItemId as string | null) ?? null,
    modifiers: (Array.isArray(row.modifiers) ? row.modifiers : []) as MenuStockItem["modifiers"],
  })));
}

async function storefrontItem(context: Context, item: Record<string, unknown> | null, store: Record<string, unknown>, stock: MenuStock) {
  if (!item) return null;
  const category = item.category as { id: string; name: string } | null;
  const availability = itemAvailability(item, store, stock);
  const modifiers = (Array.isArray(item.modifiers) ? item.modifiers : []) as Array<Record<string, unknown>>;
  return {
    ...item,
    available: availability === "now" || availability === "later",
    availability,
    serviceWindows: undefined,
    inventoryItemId: undefined,
    category: category ? { id: category.id, name: category.name } : null,
    temperatureOptions: Array.isArray(item.temperatureOptions) ? item.temperatureOptions : [],
    dietaryFlags: Array.isArray(item.dietaryFlags) ? item.dietaryFlags : [],
    modifiers: modifiers.map((modifier) => ({ ...modifier, inStock: Boolean(modifier.inStock) && !stock.modifiersOut.has(String(modifier.id)) })),
    primaryImageUrl: await resolveCafeImageUrl(context, cafeMenuItemImageReference(item as Parameters<typeof cafeMenuItemImageReference>[0])),
    menuItemImages: undefined,
  };
}

type MenuCursor = { storeId: string; search: string; categoryId: string; name: string; id: string };

function encodeCursor(cursor: MenuCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

function decodeCursor(value: string, expected: Omit<MenuCursor, "name" | "id">): MenuCursor {
  try {
    if (value.length > 1024) throw new Error();
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<MenuCursor>;
    if (typeof parsed.name !== "string" || typeof parsed.id !== "string" || !parsed.id) throw new Error();
    if (parsed.storeId !== expected.storeId || parsed.search !== expected.search || parsed.categoryId !== expected.categoryId) throw new Error();
    return parsed as MenuCursor;
  } catch {
    throw new Error("This menu page link is out of date. Reload the menu.");
  }
}

export default async function getCoffeeMenu(_root: unknown, args: MenuArgs, context: Context) {
  const store = await context.prisma.storeSetting.findUnique({ where: { singletonKey: "primary" }, select: { id: true, timezone: true, weeklyHours: true, pickupLeadTimeMinutes: true } });
  if (!store) return args.menuItemId ? { item: null } : { categories: [], items: [], nextCursor: null, hasUncategorized: false };
  const storeId = String(store.id);
  if (args.menuItemId) {
    const item = await context.prisma.menuItem.findFirst({
      where: { id: args.menuItemId, storeId, ...PUBLISHED_MENU_ITEM_WHERE },
      select: itemSelect,
    });
    return { item: await storefrontItem(context, item, store, await readMenuStock(context, storeId, item ? [item] : [])) };
  }

  const search = (args.search || "").trim().slice(0, 100);
  const categoryId = (args.categoryId || "").trim().slice(0, 255);
  const filters: Array<Record<string, unknown>> = [{ storeId }, PUBLISHED_MENU_ITEM_WHERE];
  if (categoryId === UNCATEGORIZED) filters.push({ categoryId: null });
  else if (categoryId) filters.push({ categoryId });
  if (search) {
    filters.push({ OR: [
      { name: { contains: search, mode: "insensitive" } },
      { shortDescription: { contains: search, mode: "insensitive" } },
      { category: { name: { contains: search, mode: "insensitive" } } },
    ] });
  }
  if (args.after) {
    const cursor = decodeCursor(args.after, { storeId, search, categoryId });
    filters.push({ OR: [{ name: { gt: cursor.name } }, { name: cursor.name, id: { gt: cursor.id } }] });
  }

  const [categories, rows, uncategorizedCount] = await Promise.all([
    context.prisma.menuCategory.findMany({
      where: { storeId, active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
      take: MAX_CATEGORIES,
      select: { id: true, name: true, description: true, active: true, sortOrder: true },
    }),
    context.prisma.menuItem.findMany({
      where: { AND: filters },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: STOREFRONT_MENU_PAGE_SIZE + 1,
      select: itemSelect,
    }),
    context.prisma.menuItem.count({ where: { storeId, available: true, categoryId: null } }),
  ]);
  const page = rows.slice(0, STOREFRONT_MENU_PAGE_SIZE);
  const last = page[page.length - 1];
  const stock = await readMenuStock(context, storeId, page);
  return {
    categories,
    items: await Promise.all(page.map((item) => storefrontItem(context, item, store, stock))),
    nextCursor: rows.length > STOREFRONT_MENU_PAGE_SIZE && last ? encodeCursor({ storeId, search, categoryId, name: String(last.name), id: String(last.id) }) : null,
    hasUncategorized: uncategorizedCount > 0,
  };
}
