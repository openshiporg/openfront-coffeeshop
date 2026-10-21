import { NextResponse } from "next/server";
import { getRuntimeHealth } from "@/features/keystone/runtimeHealth";

export const dynamic = "force-dynamic";

export async function GET() {
  const health = await getRuntimeHealth();
  return NextResponse.json(health, {
    status: health.status === "ok" ? 200 : 503,
    headers: { "cache-control": "no-store" },
  });
}
