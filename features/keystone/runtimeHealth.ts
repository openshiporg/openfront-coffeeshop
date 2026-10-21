import { keystoneContext } from "@/features/keystone/context";

type HealthResult = {
  status: "ok" | "unavailable";
  checks: { database: "ok" | "unavailable" };
};

const DATABASE_CHECK_TIMEOUT_MS = 5000;

export async function getRuntimeHealth(): Promise<HealthResult> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      keystoneContext.prisma.$queryRaw`SELECT 1`,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("Database check timed out")), DATABASE_CHECK_TIMEOUT_MS);
      }),
    ]);
    return { status: "ok", checks: { database: "ok" } };
  } catch {
    return { status: "unavailable", checks: { database: "unavailable" } };
  } finally {
    clearTimeout(timer);
  }
}
