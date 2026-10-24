import Link from "next/link";
import { Search } from "lucide-react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/features/dashboard/components/PageContainer";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { loadRoleFlags, loadStoreRecord } from "@/features/platform/catering/lib/store-context";
import { formatMoney, formatStoreDate, storeToday } from "@/features/platform/catering/lib/store-time";
import { PillLink, PillTrack } from "@/features/platform/components/PillTabs";
import { PlatformEmpty, PlatformHeader } from "@/features/platform/components/PlatformPage";
import { StatusTitle } from "@/features/platform/components/StatusTitle";
import { CreateSubscriptionSheet } from "../components/CreateSubscriptionSheet";
import {
  INTERVAL_LABELS,
  PER_INTERVAL,
  SUBSCRIPTION_PAGE_SIZE,
  SUBSCRIPTION_STATUS_LABELS,
  SUBSCRIPTION_STATUS_TONES,
  subscriptionListHref,
  type SubscriptionFilter,
  type SubscriptionRecord,
} from "../lib/subscriptions";

const LIST_QUERY = `
  query PlatformSubscriptionList($where: SubscriptionWhereInput!, $take: Int!, $skip: Int!, $search: SubscriptionWhereInput!) {
    subscriptions(where: $where, orderBy: [{ createdAt: desc }], take: $take, skip: $skip) {
      id subscriptionNumber status planName billingInterval priceCents startsAt renewsAt cancelledAt createdAt updatedAt
      loyaltyAccount { id displayName customerEmail }
    }
    filtered: subscriptionsCount(where: $where)
    all: subscriptionsCount(where: $search)
    trialing: subscriptionsCount(where: { AND: [$search, { status: { equals: "trialing" } }] })
    active: subscriptionsCount(where: { AND: [$search, { status: { equals: "active" } }] })
    paused: subscriptionsCount(where: { AND: [$search, { status: { equals: "paused" } }] })
    cancelled: subscriptionsCount(where: { AND: [$search, { status: { equals: "cancelled" } }] })
  }
`;

type Counts = Record<"filtered" | "all" | "trialing" | "active" | "paused" | "cancelled", number>;
type ListResult = Counts & { subscriptions: SubscriptionRecord[] };

const TABS: Array<{ value: SubscriptionFilter; label: string }> = [
  { value: "trialing", label: "Trialing" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
];

function searchWhere(search: string) {
  if (!search) return {};
  const contains = { contains: search, mode: "insensitive" };
  return {
    OR: [
      { subscriptionNumber: contains },
      { planName: contains },
      { loyaltyAccount: { customerEmail: contains } },
      { loyaltyAccount: { customerName: contains } },
    ],
  };
}

function SubscriptionCard({ subscription, timezone, currencyCode }: { subscription: SubscriptionRecord; timezone: string; currencyCode: string }) {
  const account = subscription.loyaltyAccount;
  const interval = subscription.billingInterval ? INTERVAL_LABELS[subscription.billingInterval] || subscription.billingInterval : null;
  return (
    <Link
      href={`/dashboard/platform/subscriptions/${subscription.id}`}
      className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-xs transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <StatusTitle tone={SUBSCRIPTION_STATUS_TONES[subscription.status] || "zinc"} status={SUBSCRIPTION_STATUS_LABELS[subscription.status] || subscription.status} className="text-base font-semibold tracking-tight">
          {subscription.subscriptionNumber} · {subscription.planName || "Plan"}
        </StatusTitle>
        <span className="shrink-0 text-sm font-semibold tabular-nums">{formatMoney(subscription.priceCents, currencyCode)}{subscription.billingInterval && PER_INTERVAL[subscription.billingInterval] ? <span className="font-normal text-muted-foreground"> / {PER_INTERVAL[subscription.billingInterval]}</span> : null}</span>
      </div>
      <p className="truncate text-sm">{account ? account.displayName || account.customerEmail : "No account"}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        {account?.customerEmail && account.customerEmail !== account.displayName ? <span className="[overflow-wrap:anywhere]">{account.customerEmail}</span> : null}
        {interval ? <span>{interval}</span> : null}
        {subscription.status === "cancelled"
          ? <span>Cancelled {formatStoreDate(subscription.cancelledAt, timezone)}</span>
          : <span>Renews {formatStoreDate(subscription.renewsAt, timezone)}</span>}
      </div>
    </Link>
  );
}

export async function SubscriptionListPage({ search, status, page }: { search: string; status: SubscriptionFilter; page: number }) {
  const searchFilter = searchWhere(search);
  const statusFilter = status === "all" ? {} : { status: { equals: status } };
  const [response, store, role] = await Promise.all([
    keystoneClient<ListResult>(LIST_QUERY, {
      where: { AND: [searchFilter, statusFilter] },
      search: searchFilter,
      take: SUBSCRIPTION_PAGE_SIZE,
      skip: (page - 1) * SUBSCRIPTION_PAGE_SIZE,
    }, { cache: "no-store" }),
    loadStoreRecord(),
    loadRoleFlags(),
  ]);
  const data = response.success ? response.data : null;
  const pages = data ? Math.max(1, Math.ceil(data.filtered / SUBSCRIPTION_PAGE_SIZE)) : 1;
  const canManage = Boolean(role.canManageLoyalty);

  return (
    <PageContainer
      title="Subscriptions"
      header={<PlatformHeader title="Subscriptions" meta={data ? <span>{data.all} subscriptions</span> : null} actions={canManage ? <CreateSubscriptionSheet today={storeToday(store.timezone)} /> : null} />}
      breadcrumbs={[{ type: "link", label: "Dashboard", href: "/dashboard" }, { type: "page", label: "Platform" }, { type: "page", label: "Subscriptions" }]}
    >
      <div className="space-y-6 px-4 pb-24 md:px-6">
        <div className="space-y-3">
          <nav aria-label="Status" className="min-w-0 max-w-full">
            <PillTrack label="Status">
              {TABS.map((tab) => (
                <PillLink key={tab.value} href={subscriptionListHref({ search, status: tab.value })} active={tab.value === status} count={data ? data[tab.value] : undefined}>
                  {tab.label}
                </PillLink>
              ))}
            </PillTrack>
          </nav>
          <form method="get" role="search" className="flex max-w-xl items-center gap-2">
            {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="subscription-search" className="sr-only">Search subscriptions</label>
              <Input id="subscription-search" type="search" name="search" defaultValue={search} placeholder="Number, plan, name or email" className="h-10 rounded-full pl-9" />
            </div>
            <Button type="submit" variant="outline" className="h-10 rounded-full">Search</Button>
            {search ? <Button asChild variant="ghost" className="h-10 rounded-full"><Link href={subscriptionListHref({ status })}>Clear</Link></Button> : null}
          </form>
        </div>

        {!data ? (
          <Alert variant="destructive" role="alert"><AlertTitle>Unable to load subscriptions</AlertTitle></Alert>
        ) : data.subscriptions.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.subscriptions.map((subscription) => <SubscriptionCard key={subscription.id} subscription={subscription} timezone={store.timezone} currencyCode={store.currencyCode} />)}
          </div>
        ) : (
          <PlatformEmpty>{search ? `No subscriptions match "${search}".` : "No subscriptions."}</PlatformEmpty>
        )}

        {data && pages > 1 ? (
          <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span className="tabular-nums">Page {page} of {pages}</span>
            <div className="flex gap-2">
              {page > 1 ? <Button asChild size="sm" variant="outline" className="rounded-full"><Link href={subscriptionListHref({ search, status, page: page - 1 })}>Previous</Link></Button> : null}
              {page < pages ? <Button asChild size="sm" variant="outline" className="rounded-full"><Link href={subscriptionListHref({ search, status, page: page + 1 })}>Next</Link></Button> : null}
            </div>
          </nav>
        ) : null}
      </div>
    </PageContainer>
  );
}
