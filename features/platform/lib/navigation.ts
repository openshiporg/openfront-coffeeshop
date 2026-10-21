import { Coffee, ClipboardList, Package, BarChart3, Gauge, Monitor, Settings2, type LucideIcon } from "lucide-react";

export interface PlatformNavItem {
  title: string;
  href: string;
  color: string;
  description: string;
  icon: LucideIcon;
  group?: string;
}

export interface PlatformNavGroup {
  id: string;
  title: string;
  icon: LucideIcon;
  items: PlatformNavItem[];
}

// Platform navigation items, relative to the dashboard basePath, as in the family Sidebar.
export const platformNavItems: PlatformNavItem[] = [
  { title: "Orders", href: "/platform/orders", color: "blue", description: "Track and update customer orders.", icon: ClipboardList, group: "standalone" },
  { title: "Menu", href: "/platform/menu", color: "green", description: "Manage menu items, categories, and modifiers.", icon: Package, group: "standalone" },
  { title: "POS", href: "/platform/pos", color: "teal", description: "Take in-person orders and process payment.", icon: Coffee, group: "standalone" },
  { title: "Analytics", href: "/platform/reports", color: "indigo", description: "Sales and product performance from captured orders.", icon: BarChart3, group: "standalone" },
  { title: "Coffee Operations", href: "/platform/coffee-operations", color: "amber", description: "Purchasing, prep, waste, and staff shifts.", icon: Gauge, group: "standalone" },
  { title: "KDS", href: "/platform/kds", color: "orange", description: "Display system for preparing orders.", icon: Monitor, group: "standalone" },
  { title: "Store Settings", href: "/platform/store-settings", color: "slate", description: "Configure store details, hours, and branding.", icon: Settings2, group: "standalone" },
];

export const platformStandaloneItems = platformNavItems.filter((item) => item.group === "standalone");

// Coffee Shop lists every page as a standalone entry, so it has no collapsible groups.
export const platformNavGroups: PlatformNavGroup[] = [];

export function getPlatformNavItemsWithBasePath(basePath: string) {
  return platformNavItems.map((item) => ({
    ...item,
    href: `${basePath}${item.href}`,
  }));
}

export function getIconForNavItem(title: string): LucideIcon {
  return platformNavItems.find((item) => item.title === title)?.icon || Package;
}
