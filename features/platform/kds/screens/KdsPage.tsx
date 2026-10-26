import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { PageBreadcrumbs } from "@/features/dashboard/components/PageBreadcrumbs";
import { PlatformHeader } from "@/features/platform/components/PlatformPage";
import { StatusDot } from "@/features/platform/components/StatusTitle";
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
      activeCount scheduledCount nextScheduledAt canManageOrders storeTimezone hasMore nextCursor
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
    <div className="space-y-5 p-4 pb-24 md:p-6 md:pb-24">
      <PlatformHeader
        title="KDS"
        meta={board ? (
          <>
            <span className="inline-flex items-center gap-1.5"><StatusDot tone="green" />Live</span>
            <span className="tabular-nums">{board.activeCount} to make</span>
            {!scope ? <span>View only</span> : null}
          </>
        ) : null}
      />
      {!response.success && <p role="alert" className="rounded-[6px] border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">Kitchen display unavailable. Refresh to try again.</p>}
      {(board || scope) && <KdsBoard items={board?.items ?? []} activeCount={board?.activeCount ?? 0} canManageOrders={scope !== null} storeTimezone={board?.storeTimezone ?? null} cursor={cursor} hasMore={board?.hasMore ?? false} nextCursor={board?.nextCursor} recoveryScope={scope} loadUnavailable={!board} scheduledCount={board?.scheduledCount ?? 0} nextScheduledAt={board?.nextScheduledAt ?? null} />}
    </div>
    </>
  );
}
