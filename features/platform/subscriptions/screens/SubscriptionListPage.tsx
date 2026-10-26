import Link from "next/link";
import { Search } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/features/dashboard/components/PageContainer";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { loadRoleFlags, loadStoreRecord } from "@/features/platform/catering/lib/store-context";
import { formatMoney, formatStoreDate, instantToStoreDate, storeToday } from "@/features/platform/catering/lib/store-time";
import { PillLink, PillTrack } from "@/features/platform/components/PillTabs";
import { PlatformEmpty, PlatformHeader, PlatformSection, PlatformTable, platformTd } from "@/features/platform/components/PlatformPage";
import { StatusDot } from "@/features/platform/components/StatusTitle";
import { cn } from "@/lib/utils";
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

const FIELDS = `
  id subscriptionNumber status planName billingInterval priceCents startsAt renewsAt cancelledAt createdAt updatedAt
  loyaltyAccount { id displayName customerEmail }
`;

const LIST_QUERY = `
  query PlatformSubscriptionList($where: SubscriptionWhereInput!, $orderBy: [SubscriptionOrderByInput!]!, $take: Int!, $skip: Int!, $search: SubscriptionWhereInput!, $onHoldWhere: SubscriptionWhereInput!, $onHoldTake: Int!) {
    subscriptions(where: $where, orderBy: $orderBy, take: $take, skip: $skip) { ${FIELDS} }
    onHold: subscriptions(where: $onHoldWhere, orderBy: [{ updatedAt: desc }], take: $onHoldTake) { ${FIELDS} }
    filtered: subscriptionsCount(where: $where)
    all: subscriptionsCount(where: $search)
    trialing: subscriptionsCount(where: { AND: [$search, { status: { equals: "trialing" } }] })
    active: subscriptionsCount(where: { AND: [$search, { status: { equals: "active" } }] })
    paused: subscriptionsCount(where: { AND: [$search, { status: { equals: "paused" } }] })
    cancelled: subscriptionsCount(where: { AND: [$search, { status: { equals: "cancelled" } }] })
  }
`;

type Counts = Record<"filtered" | "all" | "trialing" | "active" | "paused" | "cancelled", number>;
type ListResult = Counts & { subscriptions: SubscriptionRecord[]; onHold?: SubscriptionRecord[] | null };

const TABS: Array<{ value: SubscriptionFilter; label: string }> = [
  { value: "current", label: "Current" },
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

function SubscriptionTable({ label, subscriptions, timezone, currencyCode }: { label: string; subscriptions: SubscriptionRecord[]; timezone: string; currencyCode: string }) {
  const today = storeToday(timezone);
  return (
    <PlatformTable
      label={label}
      head={[
        { label: "Subscriber" },
        { label: "Status" },
        { label: "Plan", className: "hidden md:table-cell" },
        { label: "Price", className: "text-right" },
        { label: "Renews" },
      ]}
    >
      {subscriptions.map((subscription) => {
        const account = subscription.loyaltyAccount;
        const per = subscription.billingInterval ? PER_INTERVAL[subscription.billingInterval] : null;
        const renewDate = instantToStoreDate(subscription.renewsAt, timezone);
        const live = subscription.status === "active" || subscription.status === "trialing";
        const past = live && renewDate && renewDate < today;
        return (
          <tr key={subscription.id} className="transition-colors hover:bg-muted/30">
            <td className={cn(platformTd, "min-w-40 max-w-72")}>
              <Link href={`/dashboard/platform/subscriptions/${subscription.id}`} className="font-medium underline-offset-4 hover:underline focus-visible:underline [overflow-wrap:anywhere]">
                {account ? account.displayName || account.customerEmail || "Guest" : "No account"}
              </Link>
              <p className="truncate text-xs text-muted-foreground"><span className="tabular-nums">{subscription.subscriptionNumber}</span><span className="md:hidden"> · {subscription.planName || "Plan"}</span></p>
            </td>
            <td className={cn(platformTd, "whitespace-nowrap")}>
              <span className="inline-flex items-center gap-2"><StatusDot tone={SUBSCRIPTION_STATUS_TONES[subscription.status] || "zinc"} />{SUBSCRIPTION_STATUS_LABELS[subscription.status] || subscription.status}</span>
            </td>
            <td className={cn(platformTd, "hidden md:table-cell")}>
              {subscription.planName || "Plan"}
              {subscription.billingInterval ? <span className="text-muted-foreground"> · {INTERVAL_LABELS[subscription.billingInterval] || subscription.billingInterval}</span> : null}
            </td>
            <td className={cn(platformTd, "whitespace-nowrap text-right tabular-nums")}>
              {formatMoney(subscription.priceCents, currencyCode)}{per ? <span className="text-muted-foreground"> / {per}</span> : null}
            </td>
            <td className={cn(platformTd, "whitespace-nowrap tabular-nums")}>
              {subscription.status === "cancelled"
                ? <span className="text-muted-foreground">Ended {formatStoreDate(subscription.cancelledAt, timezone)}</span>
                : subscription.status === "paused"
                  ? <span className="text-muted-foreground">On hold</span>
                  : <span className={cn(past && "font-medium text-amber-700 dark:text-amber-400")}>{formatStoreDate(subscription.renewsAt, timezone)}{past ? " (passed)" : ""}</span>}
            </td>
          </tr>
        );
      })}
    </PlatformTable>
  );
}

export async function SubscriptionListPage({ search, status, page }: { search: string; status: SubscriptionFilter; page: number }) {
  const searchFilter = searchWhere(search);
  const statusFilter = status === "all" ? {} : status === "current" ? { status: { in: ["active", "trialing"] } } : { status: { equals: status } };
  const current = status === "current";
  const [response, store, role] = await Promise.all([
    keystoneClient<ListResult>(LIST_QUERY, {
      where: { AND: [searchFilter, statusFilter] },
      orderBy: current ? [{ renewsAt: "asc" }, { createdAt: "desc" }] : [{ createdAt: "desc" }],
      search: searchFilter,
      onHoldWhere: { AND: [searchFilter, { status: { equals: "paused" } }] },
      // take: 0 rather than @include(if:) — this server rejects variable-driven directives.
      onHoldTake: current && page === 1 ? 50 : 0,
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
      header={<PlatformHeader title="Subscriptions" meta={data ? (
        <span className="tabular-nums">
          {data.active + data.trialing} live
          {data.paused ? <> · <span className="font-medium text-amber-700 dark:text-amber-400">{data.paused} paused</span></> : null}
        </span>
      ) : null} actions={canManage ? <CreateSubscriptionSheet today={storeToday(store.timezone)} /> : null} />}
      breadcrumbs={[{ type: "link", label: "Dashboard", href: "/dashboard" }, { type: "page", label: "Platform" }, { type: "page", label: "Subscriptions" }]}
    >
      <div className="space-y-6 px-4 pb-24 md:px-6">
        <div className="space-y-4">
          <nav aria-label="Status" className="min-w-0 max-w-full">
            <PillTrack label="Status">
              {TABS.map((tab) => (
                <PillLink key={tab.value} href={subscriptionListHref({ search, status: tab.value })} active={tab.value === status} count={data ? (tab.value === "current" ? data.active + data.trialing + data.paused : data[tab.value]) : undefined}>
                  {tab.label}
                </PillLink>
              ))}
            </PillTrack>
          </nav>
          <form method="get" role="search" className="flex max-w-xl items-center gap-2">
            {status !== "current" ? <input type="hidden" name="status" value={status} /> : null}
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="subscription-search" className="sr-only">Search subscriptions</label>
              <Input id="subscription-search" type="search" name="search" defaultValue={search} placeholder="Number, plan, name or email" className="h-9 rounded-[6px] pl-9" />
            </div>
            <Button type="submit" variant="outline" className="h-9 rounded-[6px]">Search</Button>
            {search ? <Button asChild variant="ghost" className="h-9 rounded-[6px]"><Link href={subscriptionListHref({ status })}>Clear</Link></Button> : null}
          </form>
        </div>

        {!data ? (
          <Alert variant="destructive" role="alert" className="rounded-[6px]">
            <AlertTitle>Subscriptions didn&apos;t load</AlertTitle>
            <AlertDescription>
              <p>Nothing was changed. Renewals are not affected.</p>
              <div className="mt-2"><Button asChild size="sm" variant="outline" className="rounded-[6px]"><Link href={subscriptionListHref({ search, status, page })}>Try again</Link></Button></div>
            </AlertDescription>
          </Alert>
        ) : (
          <>
            {current && data.onHold?.length ? (
              <PlatformSection id="subscriptions-on-hold" title="Paused, billing on hold" meta={data.paused}>
                <SubscriptionTable label="Paused subscriptions" subscriptions={data.onHold} timezone={store.timezone} currencyCode={store.currencyCode} />
                {data.paused > data.onHold.length ? (
                  <Link href={subscriptionListHref({ search, status: "paused" })} className="text-sm font-medium underline underline-offset-4">All {data.paused} paused</Link>
                ) : null}
              </PlatformSection>
            ) : null}
            <PlatformSection id="subscriptions-list" title={current ? "Next renewals" : TABS.find((tab) => tab.value === status)?.label ?? "Subscriptions"}>
              {data.subscriptions.length ? (
                <SubscriptionTable label={current ? "Next renewals" : "Subscriptions"} subscriptions={data.subscriptions} timezone={store.timezone} currencyCode={store.currencyCode} />
              ) : (
                <PlatformEmpty>{search ? `No subscriptions match "${search}".` : current ? "No active or trialing subscriptions." : "No subscriptions in this view."}</PlatformEmpty>
              )}
            </PlatformSection>
          </>
        )}

        {data && pages > 1 ? (
          <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span className="tabular-nums">Page {page} of {pages}</span>
            <div className="flex gap-2">
              {page > 1 ? <Button asChild size="sm" variant="outline" className="rounded-[6px]"><Link href={subscriptionListHref({ search, status, page: page - 1 })}>Previous</Link></Button> : null}
              {page < pages ? <Button asChild size="sm" variant="outline" className="rounded-[6px]"><Link href={subscriptionListHref({ search, status, page: page + 1 })}>Next</Link></Button> : null}
            </div>
          </nav>
        ) : null}
      </div>
    </PageContainer>
  );
}
