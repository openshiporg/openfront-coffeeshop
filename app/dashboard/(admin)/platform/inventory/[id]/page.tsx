import { InventoryDetailPage } from "@/features/platform/inventory/screens/InventoryDetailPage";
import { parsePage } from "@/features/platform/inventory/lib/inventory";

export const dynamic = "force-dynamic";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ movements?: string | string[] }> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <InventoryDetailPage id={id} movementPage={parsePage(typeof query.movements === "string" ? query.movements : undefined)} />;
}
