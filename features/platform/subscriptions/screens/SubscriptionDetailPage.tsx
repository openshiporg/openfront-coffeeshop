import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight } from "lucide-react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/features/dashboard/components/PageContainer";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { loadRoleFlags, loadStoreRecord } from "@/features/platform/catering/lib/store-context";
import { formatMoney, formatStoreDate } from "@/features/platform/catering/lib/store-time";
import { PlatformHeader, PlatformSection } from "@/features/platform/components/PlatformPage";
import { StatusDot } from "@/features/platform/components/StatusTitle";
import { formatStoreDateTime } from "@/lib/date-time";
import { SubscriptionTransitions } from "../components/SubscriptionTransitions";
import { INTERVAL_LABELS, SUBSCRIPTION_STATUS_LABELS, SUBSCRIPTION_STATUS_TONES, type SubscriptionRecord } from "../lib/subscriptions";

const DETAIL_QUERY = `
  query PlatformSubscriptionDetail($id: ID!) {
    subscription(where: { id: $id }) {
      id subscriptionNumber status planName billingInterval priceCents startsAt renewsAt cancelledAt createdAt updatedAt
      loyaltyAccount { id displayName customerEmail }
    }
  }
`;

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm tabular-nums [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

export async function SubscriptionDetailPage({ id }: { id: string }) {
  const [response, store, role] = await Promise.all([
    keystoneClient<{ subscription: SubscriptionRecord | null }>(DETAIL_QUERY, { id }, { cache: "no-store" }),
    loadStoreRecord(),
    loadRoleFlags(),
  ]);
  if (response.success && !response.data.subscription) notFound();
  const subscription = response.success ? response.data.subscription : null;
  const breadcrumbs = [
    { type: "link" as const, label: "Dashboard", href: "/dashboard" },
    { type: "page" as const, label: "Platform" },
    { type: "link" as const, label: "Subscriptions", href: "/dashboard/platform/subscriptions" },
    { type: "page" as const, label: subscription?.subscriptionNumber || "Subscription" },
  ];

  if (!subscription) {
    return (
      <PageContainer title="Subscriptions" breadcrumbs={breadcrumbs}>
        <div className="space-y-3 px-4 md:px-6">
          <Alert variant="destructive" role="alert"><AlertTitle>Unable to load this subscription</AlertTitle></Alert>
          <Button asChild variant="outline" size="sm" className="rounded-[6px]"><Link href={`/dashboard/platform/subscriptions/${id}`}>Try again</Link></Button>
        </div>
      </PageContainer>
    );
  }

  const account = subscription.loyaltyAccount;
  const tone = SUBSCRIPTION_STATUS_TONES[subscription.status] || "zinc";
  const header = (
    <PlatformHeader
      title={(
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="inline-flex min-w-0 items-start gap-2">
            <span className="inline-flex h-[1lh] shrink-0 items-center"><StatusDot tone={tone} className="translate-y-0" /></span>
            <span className="min-w-0 [overflow-wrap:anywhere]">{subscription.subscriptionNumber} · {subscription.planName || "Plan"}</span>
          </span>
          <span className="text-sm font-medium text-muted-foreground">{SUBSCRIPTION_STATUS_LABELS[subscription.status] || subscription.status}</span>
        </span>
      )}
      meta={subscription.createdAt ? <span>Created {formatStoreDateTime(subscription.createdAt, store.timezone)}</span> : null}
      actions={role.canManageLoyalty ? <SubscriptionTransitions subscriptionId={subscription.id} status={subscription.status} /> : null}
    />
  );

  return (
    <PageContainer title={subscription.subscriptionNumber} header={header} breadcrumbs={breadcrumbs}>
      <div className="grid gap-8 px-4 pb-24 md:px-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <PlatformSection id="subscription-terms" title="Terms">
          <dl className="grid gap-4 rounded-[6px] border border-border bg-card p-4 sm:grid-cols-2">
            <Fact label="Plan">{subscription.planName || "—"}</Fact>
            <Fact label="Price">{formatMoney(subscription.priceCents, store.currencyCode)}</Fact>
            <Fact label="Interval">{subscription.billingInterval ? INTERVAL_LABELS[subscription.billingInterval] || subscription.billingInterval : "—"}</Fact>
            <Fact label="Starts">{formatStoreDate(subscription.startsAt, store.timezone)}</Fact>
            <Fact label="Renews">{formatStoreDate(subscription.renewsAt, store.timezone)}</Fact>
            {subscription.cancelledAt ? <Fact label="Cancelled">{formatStoreDateTime(subscription.cancelledAt, store.timezone)}</Fact> : null}
            <Fact label="Last status change">{formatStoreDateTime(subscription.updatedAt, store.timezone)}</Fact>
          </dl>
        </PlatformSection>

        <PlatformSection id="subscription-account" title="Loyalty account">
          {account ? (
            <Link
              href={`/dashboard/platform/loyalty/${account.id}`}
              className="flex items-start justify-between gap-3 rounded-[6px] border border-border bg-card p-4 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{account.displayName || "Guest account"}</span>
                {account.customerEmail && account.customerEmail !== account.displayName ? <span className="block truncate text-xs text-muted-foreground">{account.customerEmail}</span> : null}
              </span>
              <ArrowUpRight className="size-4 shrink-0 text-muted-foreground" aria-label="Open loyalty account" />
            </Link>
          ) : (
            <p className="rounded-[6px] border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">No account.</p>
          )}
        </PlatformSection>
      </div>
    </PageContainer>
  );
}
