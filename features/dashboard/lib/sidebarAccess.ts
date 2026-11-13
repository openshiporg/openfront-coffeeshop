/**
 * Sidebar filtering from capabilities the session already has: the role's
 * canAccessDashboard flag and Keystone's per-session list `isHidden` from admin meta.
 * Plain module: no 'use server' / 'use client', no @/ imports.
 */

type SidebarList = { path: string; isHidden?: boolean | null }
type RoleFlags = Partial<Record<
  | 'canAccessDashboard' | 'canReadOrders' | 'canManageOrders' | 'canReadPayments' | 'canManagePayments'
  | 'canReadProducts' | 'canManageProducts' | 'canReadInventory' | 'canManageInventory'
  | 'canReadLoyalty' | 'canManageLoyalty' | 'canManageSettings', boolean | null>>
type SidebarUser = { role?: RoleFlags | null } | null | undefined

/**
 * The permission each platform page needs, mirroring the check its own query makes
 * (read implies manage). The sidebar, the page route and the register all use this one
 * table, so a link never shows for a page the role cannot open.
 */
const platformPageAccess: Record<string, (r: RoleFlags) => boolean> = {
  orders: (r) => !!(r.canReadOrders || r.canManageOrders),
  kds: (r) => !!(r.canReadOrders || r.canManageOrders),
  catering: (r) => !!(r.canReadOrders || r.canManageOrders),
  menu: (r) => !!(r.canReadProducts || r.canManageProducts),
  recipes: (r) => !!(r.canReadProducts || r.canManageProducts),
  // Same check as getCoffeePosRegister: whoever runs orders may sell at the register.
  pos: (r) => !!r.canManageOrders,
  register: (r) => !!(r.canReadPayments || r.canManagePayments || r.canReadOrders || r.canManageOrders),
  'gift-cards': (r) => !!(r.canReadPayments || r.canManagePayments),
  inventory: (r) => !!(r.canReadInventory || r.canManageInventory),
  suppliers: (r) => !!(r.canReadInventory || r.canManageInventory),
  loyalty: (r) => !!(r.canReadLoyalty || r.canManageLoyalty),
  subscriptions: (r) => !!(r.canReadLoyalty || r.canManageLoyalty),
  reports: (r) => !!(r.canReadOrders || r.canManageOrders || r.canReadPayments || r.canManagePayments || r.canReadInventory || r.canManageInventory || r.canReadLoyalty || r.canManageLoyalty),
  'coffee-operations': (r) => !!(r.canReadInventory || r.canManageInventory || r.canReadProducts || r.canManageProducts || r.canManageSettings || r.canReadPayments || r.canManagePayments || r.canReadOrders || r.canManageOrders || r.canReadLoyalty || r.canManageLoyalty),
  'store-settings': (r) => !!r.canManageSettings,
}

/** True when the role may open /dashboard/platform/<slug>. Unknown slugs are left to their page. */
export function canOpenPlatformPage(role: RoleFlags | null | undefined, slug: string) {
  const rule = platformPageAccess[slug]
  if (!rule) return true
  return !!role && rule(role)
}

/** Only an explicit false hides navigation; an unknown user is left to the middleware. */
export function canUseDashboardNav(user: SidebarUser) {
  return user?.role?.canAccessDashboard !== false
}

export function visibleSidebarLists<T extends SidebarList>(lists: T[], user: SidebarUser): T[] {
  if (!canUseDashboardNav(user)) return []
  return lists.filter((list) => !list.isHidden)
}

/**
 * A platform page whose first segment is a list path follows that list's visibility;
 * pages that are not tied to one list stay visible to dashboard users.
 */
export function visiblePlatformItems<T extends { href: string }>(
  items: T[],
  lists: SidebarList[],
  user: SidebarUser
): T[] {
  if (!canUseDashboardNav(user)) return []
  const hiddenPaths = new Set(lists.filter((list) => list.isHidden).map((list) => list.path))
  return items.filter((item) => {
    const slug = item.href.split('/platform/')[1]?.split(/[/?#]/)[0]
    return !slug || (!hiddenPaths.has(slug) && canOpenPlatformPage(user?.role, slug))
  })
}
