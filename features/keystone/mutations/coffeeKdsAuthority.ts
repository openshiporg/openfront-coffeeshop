import { permissions, type Session } from "../access";
import { getPrimaryCoffeeStoreId } from "../lib/coffeeDomainOutbox";

type AuthorityClient = {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
  user: { findUnique(args: Record<string, unknown>): Promise<{ id: string; roleId: string | null } | null> };
  role: { findUnique(args: Record<string, unknown>): Promise<Record<string, unknown> | null> };
};

type RoleFlag = keyof NonNullable<Session["data"]["role"]>;

/** Same commit-time fence as the KDS, for any operator command: lock the caller's current
 * User/Role rows inside the effect transaction and require at least one of `flags`.
 * Call it before reading private rows or replaying a stored receipt.
 */
export async function requireCurrentCoffeeCapability(tx: AuthorityClient, session: Session | undefined, flags: RoleFlag[], message = "Not authorized") {
  if (session?.listKey !== "User" || !session.itemId) throw new Error(message);
  await tx.$executeRawUnsafe('SELECT "id" FROM "User" WHERE "id" = $1 FOR SHARE', session.itemId);
  const user = await tx.user.findUnique({ where: { id: session.itemId }, select: { id: true, roleId: true } });
  if (!user?.roleId || user.id !== session.itemId) throw new Error(message);
  await tx.$executeRawUnsafe('SELECT "id" FROM "Role" WHERE "id" = $1 FOR SHARE', user.roleId);
  const role = await tx.role.findUnique({ where: { id: user.roleId }, select: Object.fromEntries(flags.map((flag) => [flag, true])) });
  if (!role || !flags.some((flag) => role[flag] === true)) throw new Error(message);
  return user.id;
}

/** Prisma commands bypass Keystone access. Seal the current user/role facts until commit,
 * including replay, rather than trusting permissions carried by an old request context.
 * This is primary-store operator authority, not a new staff-membership policy.
 */
export async function requireCurrentCoffeeKdsOperator(tx: AuthorityClient, session?: Session) {
  return requireCurrentCoffeeCapability(tx, session, ["canManageOrders"], "Not authorized to operate the KDS");
}

/** Private browser retry partition, not an authorization token. Read through
 * the same session-aware GraphQL boundary; current commands always reauthorize.
 */
export async function getCoffeeKdsRecoveryScope(_root: unknown, _args: unknown, context: {
  session?: Session;
  prisma: { $transaction<T>(fn: (tx: unknown) => Promise<T>, options: Record<string, unknown>): Promise<T> };
}) {
  if (!permissions.canManageOrders({ session: context.session })) return null;
  return context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx as AuthorityClient & { storeSetting: { findUnique(args: Record<string, unknown>): Promise<{ id: string } | null> } };
    const actorId = await requireCurrentCoffeeKdsOperator(tx, context.session);
    const storeId = await getPrimaryCoffeeStoreId(tx);
    return { actorId, storeId };
  }, { maxWait: 5000, timeout: 10000, isolationLevel: "ReadCommitted" });
}
