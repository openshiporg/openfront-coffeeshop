import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/features/dashboard/components/PageContainer";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { formatStoreDateTime } from "@/lib/date-time";
import { PillLink, PillTrack } from "@/features/platform/components/PillTabs";
import { PlatformEmpty, PlatformHeader, PlatformTable, platformTd } from "@/features/platform/components/PlatformPage";
import { StatusDot } from "@/features/platform/components/StatusTitle";
import { LinkSelect } from "@/features/platform/inventory/components/LinkSelect";
import { cn } from "@/lib/utils";
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
} from "../lib/loyaltyView";

const LIST_QUERY = `
  query CoffeeLoyaltyAccounts($where: LoyaltyAccountWhereInput!, $base: LoyaltyAccountWhereInput!, $orderBy: [LoyaltyAccountOrderByInput!]!, $take: Int!, $skip: Int!) {
    authenticatedItem { ... on User { id role { canManageLoyalty } } }
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
  authenticatedItem: { id: string; role: { canManageLoyalty: boolean | null } | null } | null;
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
function AccountTable({ accounts, timezone, canAdjust }: { accounts: AccountRow[]; timezone: string | null; canAdjust: boolean }) {
  return (
    <PlatformTable
      label="Rewards accounts"
      head={[
        { label: "Guest" },
        { label: "Status" },
        { label: "Tier", className: "hidden md:table-cell" },
        { label: "Points", className: "text-right" },
        { label: "Credits", className: "text-right" },
        { label: "Visits", className: "hidden text-right sm:table-cell" },
        { label: "Last visit", className: "hidden lg:table-cell" },
        { label: <span className="sr-only">Actions</span>, className: "w-0" },
      ]}
    >
      {accounts.map((account) => {
        const status = account.status || "active";
        const href = `/dashboard/platform/loyalty/${account.id}`;
        return (
          <tr key={account.id} className="transition-colors hover:bg-muted/30">
            <td className={cn(platformTd, "min-w-40 max-w-72")}>
              <Link href={href} className="font-medium underline-offset-4 hover:underline focus-visible:underline [overflow-wrap:anywhere]">{account.displayName || "Guest account"}</Link>
              {account.customerEmail ? <p className="truncate text-xs text-muted-foreground">{account.customerEmail}</p> : null}
            </td>
            <td className={cn(platformTd, "whitespace-nowrap")}><span className="inline-flex items-center gap-2"><StatusDot tone={LOYALTY_STATUS_TONES[status] || "zinc"} />{LOYALTY_STATUS_LABELS[status] || status}</span></td>
            <td className={cn(platformTd, "hidden whitespace-nowrap md:table-cell")}>{LOYALTY_TIER_LABELS[account.tier || "regular"] || account.tier}</td>
            <td className={cn(platformTd, "whitespace-nowrap text-right tabular-nums")}>{account.pointsBalance ?? 0}<span className="text-muted-foreground">/100</span></td>
            <td className={cn(platformTd, "whitespace-nowrap text-right tabular-nums", (account.drinkCredits ?? 0) > 0 && "font-semibold")}>{account.drinkCredits ?? 0}</td>
            <td className={cn(platformTd, "hidden text-right tabular-nums sm:table-cell")}>{account.visits ?? 0}</td>
            <td className={cn(platformTd, "hidden whitespace-nowrap text-muted-foreground lg:table-cell")}>{account.lastVisitAt ? formatStoreDateTime(account.lastVisitAt, timezone) : "—"}</td>
            <td className={cn(platformTd, "whitespace-nowrap py-1.5 text-right")}>
              {canAdjust && status !== "closed" ? <Button asChild size="sm" variant="outline" className="h-8 rounded-[6px] active:scale-[0.97]"><Link href={`${href}?adjust=1`}>Adjust</Link></Button> : null}
            </td>
          </tr>
        );
      })}
    </PlatformTable>
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
      header={<PlatformHeader title="Rewards" />}
      breadcrumbs={[{ type: "link", label: "Dashboard", href: "/dashboard" }, { type: "page", label: "Platform" }, { type: "page", label: "Rewards" }]}
    >
      <div className="space-y-4 px-4 pb-24 md:px-6">
        <form method="get" role="search" className="flex max-w-2xl items-center gap-2">
          {view.status !== "active" ? <input type="hidden" name="status" value={view.status} /> : null}
          {view.tier !== "all" ? <input type="hidden" name="tier" value={view.tier} /> : null}
          {view.sort !== "last_visit" ? <input type="hidden" name="sort" value={view.sort} /> : null}
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <label htmlFor="loyalty-search" className="sr-only">Find a guest</label>
            <Input id="loyalty-search" type="search" name="search" defaultValue={view.search} placeholder="Find a guest by name or email" autoComplete="off" className="h-10 rounded-[6px] pl-9 text-base md:text-sm" />
          </div>
          <Button type="submit" className="h-10 rounded-[6px] active:scale-[0.97]">Find</Button>
          {view.search ? <Button asChild variant="ghost" className="h-10 rounded-[6px]"><Link href={loyaltyListHref({ ...view, search: "", page: 1 })}>Clear</Link></Button> : null}
        </form>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <nav aria-label="Status" className="min-w-0 max-w-full sm:flex-1">
            <PillTrack label="Status">
              {STATUS_TABS.map((tab) => (
                <PillLink key={tab.value} href={loyaltyListHref({ ...view, status: tab.value, page: 1 })} active={tab.value === view.status} count={result ? tab.count(result) : undefined}>
                  {tab.label}
                </PillLink>
              ))}
            </PillTrack>
          </nav>
          <div className="flex gap-2 pb-1">
            <LinkSelect
              label="Tier"
              value={view.tier}
              className="w-40"
              options={[
                { value: "all", label: "All tiers", href: loyaltyListHref({ ...view, tier: "all", page: 1 }) },
                ...LOYALTY_TIERS.map((tier) => ({ value: tier, label: LOYALTY_TIER_LABELS[tier], href: loyaltyListHref({ ...view, tier, page: 1 }) })),
              ]}
            />
            <LinkSelect
              label="Sort"
              value={view.sort}
              className="w-40"
              options={LOYALTY_SORTS.map((sort) => ({ value: sort, label: SORT_LABELS[sort], href: loyaltyListHref({ ...view, sort, page: 1 }) }))}
            />
          </div>
        </div>

        {!result ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <div className="space-y-0.5"><p className="font-medium">Rewards accounts didn&apos;t load</p><p className="text-muted-foreground">Nothing was changed. Points still earn at checkout.</p></div>
            <Button asChild variant="outline" className="rounded-[6px]"><Link href={loyaltyListHref(view)}>Try again</Link></Button>
          </div>
        ) : result.loyaltyAccounts.length ? (
          <>
            <AccountTable accounts={result.loyaltyAccounts} timezone={timezone} canAdjust={Boolean(result.authenticatedItem?.role?.canManageLoyalty)} />
            {pageCount > 1 ? (
              <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
                <span className="tabular-nums">Page {view.page} of {pageCount}</span>
                <div className="flex gap-2">
                  {view.page > 1 ? <Button asChild size="sm" variant="outline" className="rounded-[6px]"><Link href={loyaltyListHref({ ...view, page: view.page - 1 })}>Previous</Link></Button> : null}
                  {view.page < pageCount ? <Button asChild size="sm" variant="outline" className="rounded-[6px]"><Link href={loyaltyListHref({ ...view, page: view.page + 1 })}>Next</Link></Button> : null}
                </div>
              </nav>
            ) : null}
          </>
        ) : (
          <PlatformEmpty>{view.search ? `No guest matches "${view.search}".` : "No rewards accounts in this view."}</PlatformEmpty>
        )}
      </div>
    </PageContainer>
  );
}
