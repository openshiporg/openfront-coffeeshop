import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { PageBreadcrumbs } from "@/features/dashboard/components/PageBreadcrumbs";
import { KdsBoard } from "../components/KdsBoard";
import type { KdsBoard as KdsBoardProjection } from "../types";
import { isKdsRecoveryScope, type KdsRecoveryScope } from "../lib/commandRecovery";

const RECOVERY_SCOPE_QUERY = `
  query CoffeeKdsRecoveryScope {
    getCoffeeKdsRecoveryScope { actorId storeId }
  }
`;

const KDS_QUERY = `
  query CoffeeKdsBoard($cursor: String, $limit: Int!) {
    getCoffeeKdsBoard(cursor: $cursor, limit: $limit) {
      activeCount canManageOrders storeTimezone hasMore nextCursor
      items {
        id quantity itemNameSnapshot customizationsSummary specialInstructions
        barStatus station queuedAt startedAt readyAt
        nextAction { status label tone }
        order { id orderNumber status pickupName promisedAt isRush }
      }
    }
  }
`;

export async function KdsPage({ searchParams }: { searchParams: Promise<{ cursor?: string | string[] }> }) {
  const params = await searchParams;
  const cursor = typeof params.cursor === "string" ? params.cursor : Array.isArray(params.cursor) ? "" : null;
  const [response, scopeResponse] = await Promise.all([
    keystoneClient<{ getCoffeeKdsBoard: KdsBoardProjection }>(KDS_QUERY, { cursor, limit: 100 }, { cache: "no-store" }),
    keystoneClient<{ getCoffeeKdsRecoveryScope: KdsRecoveryScope | null }>(RECOVERY_SCOPE_QUERY, {}, { cache: "no-store" }),
  ]);
  const board = response.success ? response.data.getCoffeeKdsBoard : null;
  const candidateScope = scopeResponse.success ? scopeResponse.data?.getCoffeeKdsRecoveryScope : null;
  const scope = isKdsRecoveryScope(candidateScope) ? candidateScope : null;

  return (
    <>
    <PageBreadcrumbs items={[{ type: "link", label: "Dashboard", href: "" }, { type: "page", label: "Platform" }, { type: "page", label: "KDS" }]} />
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-3 border-b pb-5 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">KDS</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">Prep items for open pickup orders.</p>
        </div>
        <div className="rounded-md border border-border bg-card px-4 py-2 text-sm"><span className="font-semibold">{board?.activeCount ?? "—"}</span> active prep items</div>
      </header>
      {!response.success && <p role="alert" className="border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">The kitchen display could not load. Refresh to try again.</p>}
      {board && !scope ? <p role="status" className="text-sm text-muted-foreground">View only. You don&apos;t have permission to update kitchen tickets, or your access couldn&apos;t be confirmed. Refresh once your access is restored.</p> : null}
      {(board || scope) && <KdsBoard items={board?.items ?? []} activeCount={board?.activeCount ?? 0} canManageOrders={scope !== null} storeTimezone={board?.storeTimezone ?? null} cursor={cursor} hasMore={board?.hasMore ?? false} nextCursor={board?.nextCursor} recoveryScope={scope} loadUnavailable={!board} />}
    </div>
    </>
  );
}
