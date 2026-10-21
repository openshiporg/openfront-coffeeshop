#!/usr/bin/env tsx
import "dotenv/config";

/**
 * Configuration-only local seed. It runs the same validated, create-if-missing
 * onboarding transaction as the dashboard setup dialog, so existing store
 * settings, images, inventory links and payment provider choices are never
 * overwritten, and no orders, payments, loyalty balances or consent are created.
 */

const RUNTIME_DATABASE = "runtime_coffee_shop";

type PrismaLike = {
  user: {
    findFirst(args: Record<string, unknown>): Promise<{
      id: string;
      name: string | null;
      email: string | null;
      role: Record<string, unknown> | null;
    } | null>;
  };
  $disconnect?: () => Promise<void>;
};

function targetDatabaseName(databaseUrl: string | undefined) {
  if (!databaseUrl) return null;
  try {
    const url = new URL(databaseUrl);
    if (url.protocol !== "postgres:" && url.protocol !== "postgresql:") return null;
    return decodeURIComponent(url.pathname.replace(/^\//, ""));
  } catch {
    return null;
  }
}

function limitPrismaConnectionsForSeed() {
  const url = new URL(process.env.DATABASE_URL as string);
  url.searchParams.set("connection_limit", url.searchParams.get("connection_limit") || "1");
  url.searchParams.set("pool_timeout", url.searchParams.get("pool_timeout") || "30");
  process.env.DATABASE_URL = url.toString();
}

let prisma: PrismaLike | undefined;

async function main() {
  // Exact database-name match, checked before any database client is created.
  // The connection string itself is never printed.
  if (targetDatabaseName(process.env.DATABASE_URL) !== RUNTIME_DATABASE) {
    throw new Error(`Refusing to seed: DATABASE_URL must point to the "${RUNTIME_DATABASE}" database.`);
  }

  limitPrismaConnectionsForSeed();
  const [{ keystoneContext }, { default: runCoffeeOnboarding }] = await Promise.all([
    import("../../../keystone/context"),
    import("../../../keystone/mutations/runCoffeeOnboarding"),
  ]);
  prisma = keystoneContext.prisma as unknown as PrismaLike;

  const manager = await prisma.user.findFirst({
    where: { role: { canManageOnboarding: true } },
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!manager?.role) {
    throw new Error("Create a dashboard user with a role that can manage onboarding before seeding.");
  }

  const session = {
    itemId: manager.id,
    listKey: "User",
    data: { name: manager.name ?? "", email: manager.email ?? undefined, role: manager.role },
  };
  const result = await runCoffeeOnboarding(null, { template: "full" }, { session, prisma: keystoneContext.prisma } as never);
  process.stdout.write(`${JSON.stringify({ database: RUNTIME_DATABASE, created: result }, null, 2)}\n`);
}

main()
  .catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : "Seed failed"}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma?.$disconnect?.();
  });
