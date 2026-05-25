import { Coffee, ClipboardList, CreditCard, Gift, Package, Boxes, BarChart3, type LucideIcon } from "lucide-react";

export interface PlatformNavItem {
  title: string;
  href: string;
  icon?: LucideIcon;
  group?: string;
}

export const platformNavItems: PlatformNavItem[] = [
  { title: "Order Queue", href: "/platform/orders", icon: ClipboardList, group: "cafe-operations" },
  { title: "POS", href: "/platform/pos", icon: Coffee, group: "cafe-operations" },
  { title: "Menu Manager", href: "/platform/menu", icon: Package, group: "cafe-operations" },
  { title: "Reports", href: "/platform/reports", icon: BarChart3, group: "cafe-operations" },
  { title: "Menu Items", href: "/menu-items", icon: Coffee, group: "menu" },
  { title: "Categories", href: "/menu-categories", icon: Package, group: "menu" },
  { title: "Modifiers", href: "/menu-item-modifiers", icon: Package, group: "menu" },
  { title: "Payments", href: "/payments", icon: CreditCard, group: "back-office" },
  { title: "Inventory", href: "/inventory-items", icon: Boxes, group: "back-office" },
  { title: "Loyalty", href: "/loyalty-accounts", icon: Gift, group: "back-office" },
];

export const platformStandaloneItems: PlatformNavItem[] = [];

export const platformNavGroups = [
  {
    id: "cafe-operations",
    title: "Cafe Operations",
    icon: ClipboardList,
    items: platformNavItems.filter((item) => item.group === "cafe-operations"),
  },
  {
    id: "menu",
    title: "Menu",
    icon: Package,
    items: platformNavItems.filter((item) => item.group === "menu"),
  },
  {
    id: "back-office",
    title: "Back Office",
    icon: CreditCard,
    items: platformNavItems.filter((item) => item.group === "back-office"),
  },
];

export function getPlatformNavItemsWithBasePath(basePath: string) {
  return platformNavItems.map((item) => ({
    ...item,
    href: `${basePath}${item.href}`,
  }));
}
