import { statelessSessions } from "@keystone-6/core/session";

type CoffeeSession = { itemId: string; listKey: string };
type SessionOptions = Parameters<typeof statelessSessions<CoffeeSession>>[0];

/**
 * Keystone Auth enriches the item-id session with the current sessionData query on
 * every request. This wrapper additionally rejects a sealed cookie after its user
 * has been deleted, while role edits take effect through that fresh sessionData.
 */
export function revocableStatelessSessions(options: SessionOptions) {
  const base = statelessSessions<CoffeeSession>(options);
  return {
    ...base,
    async get({ context }: Parameters<typeof base.get>[0]) {
      const session = await base.get({ context });
      if (!session || session.listKey !== "User" || !session.itemId) return session;
      try {
        const current = await context.prisma.user.findUnique({ where: { id: session.itemId }, select: { id: true } });
        return current ? session : undefined;
      } catch {
        return undefined;
      }
    },
  };
}
