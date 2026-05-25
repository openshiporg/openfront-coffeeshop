export type Session = {
  itemId: string
  listKey: string
  data: {
    name: string
    email?: string
    role?: {
      id: string
      name: string
      canAccessDashboard: boolean
      canReadOrders: boolean
      canManageOrders: boolean
      canReadPayments: boolean
      canManagePayments: boolean
      canReadProducts: boolean
      canManageProducts: boolean
      canReadInventory: boolean
      canManageInventory: boolean
      canReadLoyalty: boolean
      canManageLoyalty: boolean
      canSeeOtherPeople: boolean
      canEditOtherPeople: boolean
      canManagePeople: boolean
      canManageRoles: boolean
      canManageSettings: boolean
      canManageOnboarding: boolean
    }
  }
}

type AccessArgs = { session?: Session }

export function isSignedIn({ session }: AccessArgs) {
  return Boolean(session)
}

const hasRoleFlag = (session: Session | undefined, flag: keyof NonNullable<Session['data']['role']>) =>
  Boolean(session?.data?.role?.[flag])

export const permissions = {
  canAccessDashboard: ({ session }: AccessArgs) => hasRoleFlag(session, 'canAccessDashboard'),
  canReadOrders: ({ session }: AccessArgs) => hasRoleFlag(session, 'canReadOrders') || hasRoleFlag(session, 'canManageOrders'),
  canManageOrders: ({ session }: AccessArgs) => hasRoleFlag(session, 'canManageOrders'),
  canReadPayments: ({ session }: AccessArgs) => hasRoleFlag(session, 'canReadPayments') || hasRoleFlag(session, 'canManagePayments'),
  canManagePayments: ({ session }: AccessArgs) => hasRoleFlag(session, 'canManagePayments'),
  canReadProducts: ({ session }: AccessArgs) => hasRoleFlag(session, 'canReadProducts') || hasRoleFlag(session, 'canManageProducts'),
  canManageProducts: ({ session }: AccessArgs) => hasRoleFlag(session, 'canManageProducts'),
  canReadInventory: ({ session }: AccessArgs) => hasRoleFlag(session, 'canReadInventory') || hasRoleFlag(session, 'canManageInventory'),
  canManageInventory: ({ session }: AccessArgs) => hasRoleFlag(session, 'canManageInventory'),
  canReadLoyalty: ({ session }: AccessArgs) => hasRoleFlag(session, 'canReadLoyalty') || hasRoleFlag(session, 'canManageLoyalty'),
  canManageLoyalty: ({ session }: AccessArgs) => hasRoleFlag(session, 'canManageLoyalty'),
  canManagePeople: ({ session }: AccessArgs) => hasRoleFlag(session, 'canManagePeople'),
  canManageRoles: ({ session }: AccessArgs) => hasRoleFlag(session, 'canManageRoles'),
  canManageSettings: ({ session }: AccessArgs) => hasRoleFlag(session, 'canManageSettings'),
  canManageOnboarding: ({ session }: AccessArgs) => hasRoleFlag(session, 'canManageOnboarding'),
}

export const rules = {
  canReadPeople({ session }: AccessArgs) {
    if (!session) return false
    if (session.data.role?.canSeeOtherPeople || session.data.role?.canManagePeople) return true
    return { id: { equals: session.itemId } }
  },
  canUpdatePeople({ session }: AccessArgs) {
    if (!session) return false
    if (session.data.role?.canEditOtherPeople || session.data.role?.canManagePeople) return true
    return { id: { equals: session.itemId } }
  },
}
