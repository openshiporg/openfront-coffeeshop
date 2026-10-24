import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/features/dashboard/components/PageContainer";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { formatStoreDateTime } from "@/lib/date-time";
import { PillLink, PillTrack } from "@/features/platform/components/PillTabs";
import { PlatformEmpty, PlatformHeader } from "@/features/platform/components/PlatformPage";
import { StatusTitle } from "@/features/platform/components/StatusTitle";
import {
  LOYALTY_PAGE_SIZE,
  LOYALTY_SORTS,
  LOYALTY_STATUS_LABELS,
  LOYALTY_STATUS_TONES,
  LOYALTY_TIER_LABELS,
  LOYALTY_TIERS,
  SORT_LABELS,
  loyaltyBaseWhere,
  loyaltyListHref,
  loyaltyOrderBy,
  type LoyaltyListView,
  type LoyaltyStatusFilter,
  type LoyaltyTierFilter,
} from "../lib/loyaltyView";

const LIST_QUERY = `
  query CoffeeLoyaltyAccounts($where: LoyaltyAccountWhereInput!, $base: LoyaltyAccountWhereInput!, $orderBy: [LoyaltyAccountOrderByInput!]!, $take: Int!, $skip: Int!) {
    getCoffeeStore { timezone }
    loyaltyAccounts(where: $where, orderBy: $orderBy, take: $take, skip: $skip) {
      id displayName customerEmail status tier pointsBalance lifetimePoints drinkCredits visits lastVisitAt
    }
    filteredCount: loyaltyAccountsCount(where: $where)
    allCount: loyaltyAccountsCount(where: $base)
    activeCount: loyaltyAccountsCount(where: { AND: [$base, { status: { equals: "active" } }] })
    pausedCount: loyaltyAccountsCount(where: { AND: [$base, { status: { equals: "paused" } }] })
    closedCount: loyaltyAccountsCount(where: { AND: [$base, { status: { equals: "closed" } }] })
  }
`;

type AccountRow = {
  id: string; displayName: string | null; customerEmail: string | null; status: string | null; tier: string | null;
  pointsBalance: number | null; lifetimePoints: number | null; drinkCredits: number | null; visits: number | null; lastVisitAt: string | null;
};
type ListResult = {
  getCoffeeStore: { timezone: string } | null;
  loyaltyAccounts: AccountRow[];
  filteredCount: number; allCount: number; activeCount: number; pausedCount: number; closedCount: number;
};

const STATUS_TABS: Array<{ value: LoyaltyStatusFilter; label: string; count: (result: ListResult) => number }> = [
  { value: "active", label: "Active", count: (result) => result.activeCount },
  { value: "paused", label: "Paused", count: (result) => result.pausedCount },
  { value: "closed", label: "Closed", count: (result) => result.closedCount },
  { value: "all", label: "All", count: (result) => result.allCount },
];
const TIER_TABS: Array<{ value: LoyaltyTierFilter; label: string }> = [
  { value: "all", label: "All tiers" },
  ...LOYALTY_TIERS.map((tier) => ({ value: tier, label: LOYALTY_TIER_LABELS[tier] })),
];

function AccountCard({ account, timezone }: { account: AccountRow; timezone: string | null }) {
  const status = account.status || "active";
  const facts: Array<[string, string]> = [
    ["Points", `${account.pointsBalance ?? 0}/100`],
    ["Drink credits", String(account.drinkCredits ?? 0)],
    ["Visits", String(account.visits ?? 0)],
    ["Lifetime", String(account.lifetimePoints ?? 0)],
  ];
  return (
    <Link href={`/dashboard/platform/loyalty/${account.id}`} className="group block min-w-0 rounded-xl border border-border bg-card p-4 shadow-xs transition-colors hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-0.5">
          <StatusTitle tone={LOYALTY_STATUS_TONES[status] || "zinc"} status={LOYALTY_STATUS_LABELS[status] || status} className="text-base font-semibold tracking-tight">
            {account.displayName || "Guest account"}
          </StatusTitle>
          {account.customerEmail ? <p className="truncate text-sm text-muted-foreground">{account.customerEmail}</p> : null}
        </div>
        <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-xs font-medium">{LOYALTY_TIER_LABELS[account.tier || "regular"] || account.tier}</span>
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm sm:grid-cols-4">
        {facts.map(([label, value]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="font-medium tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 text-xs text-muted-foreground">Last visit {account.lastVisitAt ? formatStoreDateTime(account.lastVisitAt, timezone) : "—"}</p>
    </Link>
  );
}

export async function LoyaltyListPage({ view }: { view: LoyaltyListView }) {
  const base = loyaltyBaseWhere(view);
  const where = view.status === "all" ? base : { AND: [base, { status: { equals: view.status } }] };
  const response = await keystoneClient<ListResult>(
    LIST_QUERY,
    { where, base, orderBy: loyaltyOrderBy(view.sort), take: LOYALTY_PAGE_SIZE, skip: (view.page - 1) * LOYALTY_PAGE_SIZE },
    { cache: "no-store" },
  );
  const result = response.success ? response.data : null;
  const timezone = result?.getCoffeeStore?.timezone ?? null;
  const pageCount = result ? Math.max(1, Math.ceil(result.filteredCount / LOYALTY_PAGE_SIZE)) : 1;

  return (
    <PageContainer
      title="Rewards"
      header={<PlatformHeader title="Rewards" meta={result ? <span className="tabular-nums">{result.allCount} accounts</span> : null} />}
      breadcrumbs={[{ type: "link", label: "Dashboard", href: "/dashboard" }, { type: "page", label: "Platform" }, { type: "page", label: "Rewards" }]}
    >
      <div className="space-y-5 px-4 pb-24 md:px-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav aria-label="Status" className="min-w-0 max-w-full">
              <PillTrack label="Status">
                {STATUS_TABS.map((tab) => (
                  <PillLink key={tab.value} href={loyaltyListHref({ ...view, status: tab.value, page: 1 })} active={tab.value === view.status} count={result ? tab.count(result) : undefined}>
                    {tab.label}
                  </PillLink>
                ))}
              </PillTrack>
            </nav>
            <nav aria-label="Sort" className="min-w-0 max-w-full">
              <PillTrack label="Sort">
                {LOYALTY_SORTS.map((sort) => (
                  <PillLink key={sort} href={loyaltyListHref({ ...view, sort, page: 1 })} active={sort === view.sort}>{SORT_LABELS[sort]}</PillLink>
                ))}
              </PillTrack>
            </nav>
          </div>
          <nav aria-label="Tier" className="min-w-0 max-w-full">
            <PillTrack label="Tier">
              {TIER_TABS.map((tab) => (
                <PillLink key={tab.value} href={loyaltyListHref({ ...view, tier: tab.value, page: 1 })} active={tab.value === view.tier}>{tab.label}</PillLink>
              ))}
            </PillTrack>
          </nav>
          <form method="get" role="search" className="flex max-w-xl items-center gap-2">
            {view.status !== "active" ? <input type="hidden" name="status" value={view.status} /> : null}
            {view.tier !== "all" ? <input type="hidden" name="tier" value={view.tier} /> : null}
            {view.sort !== "last_visit" ? <input type="hidden" name="sort" value={view.sort} /> : null}
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="loyalty-search" className="sr-only">Search accounts</label>
              <Input id="loyalty-search" type="search" name="search" defaultValue={view.search} placeholder="Name or email" className="h-10 rounded-full pl-9" />
            </div>
            <Button type="submit" variant="outline" className="h-10 rounded-full">Search</Button>
            {view.search ? <Button asChild variant="ghost" className="h-10 rounded-full"><Link href={loyaltyListHref({ ...view, search: "", page: 1 })}>Clear</Link></Button> : null}
          </form>
        </div>

        {!result ? (
          <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">Unable to load rewards accounts.</p>
        ) : result.loyaltyAccounts.length ? (
          <>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {result.loyaltyAccounts.map((account) => <AccountCard key={account.id} account={account} timezone={timezone} />)}
            </div>
            {pageCount > 1 ? (
              <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                <span className="tabular-nums">Page {view.page} of {pageCount}</span>
                <div className="flex gap-2">
                  {view.page > 1 ? <Button asChild size="sm" variant="outline" className="rounded-full"><Link href={loyaltyListHref({ ...view, page: view.page - 1 })}>Previous</Link></Button> : null}
                  {view.page < pageCount ? <Button asChild size="sm" variant="outline" className="rounded-full"><Link href={loyaltyListHref({ ...view, page: view.page + 1 })}>Next</Link></Button> : null}
                </div>
              </nav>
            ) : null}
          </>
        ) : (
          <PlatformEmpty>{view.search ? "No matching accounts." : "No rewards accounts."}</PlatformEmpty>
        )}
      </div>
    </PageContainer>
  );
}
