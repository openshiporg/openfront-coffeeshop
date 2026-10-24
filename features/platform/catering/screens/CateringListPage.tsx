import Link from "next/link";
import { Search } from "lucide-react";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/features/dashboard/components/PageContainer";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { PillLink, PillTrack } from "@/features/platform/components/PillTabs";
import { PlatformEmpty, PlatformHeader } from "@/features/platform/components/PlatformPage";
import { StatusTitle } from "@/features/platform/components/StatusTitle";
import { formatStoreDateTime } from "@/lib/date-time";
import { CreateCateringSheet } from "../components/CreateCateringSheet";
import {
  CATERING_PAGE_SIZE,
  CATERING_STATUS_LABELS,
  CATERING_STATUS_TONES,
  OPEN_CATERING_STATUSES,
  cateringListHref,
  cateringSource,
  type CateringFilter,
  type CateringOrderRecord,
} from "../lib/catering";
import { loadRoleFlags, loadStoreRecord } from "../lib/store-context";
import { formatMoney } from "../lib/store-time";

const LIST_QUERY = `
  query PlatformCateringList($where: CateringOrderWhereInput!, $orderBy: [CateringOrderOrderByInput!]!, $take: Int!, $skip: Int!, $search: CateringOrderWhereInput!) {
    cateringOrders(where: $where, orderBy: $orderBy, take: $take, skip: $skip) {
      id cateringNumber customerName customerEmail status eventAt guestCount deliveryAddress subtotalCents notes metadata createdAt updatedAt
    }
    filtered: cateringOrdersCount(where: $where)
    all: cateringOrdersCount(where: $search)
    inquiry: cateringOrdersCount(where: { AND: [$search, { status: { equals: "inquiry" } }] })
    quoted: cateringOrdersCount(where: { AND: [$search, { status: { equals: "quoted" } }] })
    confirmed: cateringOrdersCount(where: { AND: [$search, { status: { equals: "confirmed" } }] })
    completed: cateringOrdersCount(where: { AND: [$search, { status: { equals: "completed" } }] })
    cancelled: cateringOrdersCount(where: { AND: [$search, { status: { equals: "cancelled" } }] })
  }
`;

type Counts = Record<"filtered" | "all" | "inquiry" | "quoted" | "confirmed" | "completed" | "cancelled", number>;
type ListResult = Counts & { cateringOrders: CateringOrderRecord[] };

const TABS: Array<{ value: CateringFilter; label: string; count: (counts: Counts) => number }> = [
  { value: "upcoming", label: "Upcoming", count: (c) => c.inquiry + c.quoted + c.confirmed },
  { value: "inquiry", label: "Inquiry", count: (c) => c.inquiry },
  { value: "quoted", label: "Quoted", count: (c) => c.quoted },
  { value: "confirmed", label: "Confirmed", count: (c) => c.confirmed },
  { value: "completed", label: "Completed", count: (c) => c.completed },
  { value: "cancelled", label: "Cancelled", count: (c) => c.cancelled },
  { value: "all", label: "All", count: (c) => c.all },
];

function searchWhere(search: string) {
  if (!search) return {};
  const contains = { contains: search, mode: "insensitive" };
  return { OR: [{ cateringNumber: contains }, { customerName: contains }, { customerEmail: contains }] };
}

function viewQuery(status: CateringFilter) {
  if (status === "upcoming") return { status: { status: { in: OPEN_CATERING_STATUSES } }, orderBy: [{ eventAt: "asc" }, { createdAt: "asc" }] };
  if (status === "all") return { status: {}, orderBy: [{ createdAt: "desc" }] };
  const open = (OPEN_CATERING_STATUSES as string[]).includes(status);
  return { status: { status: { equals: status } }, orderBy: open ? [{ eventAt: "asc" }, { createdAt: "asc" }] : [{ eventAt: "desc" }, { createdAt: "desc" }] };
}

function CateringCard({ order, timezone, currencyCode }: { order: CateringOrderRecord; timezone: string; currencyCode: string }) {
  const source = cateringSource(order.metadata);
  return (
    <Link
      href={`/dashboard/platform/catering/${order.id}`}
      className="flex min-w-0 flex-col gap-2 rounded-xl border border-border bg-card p-4 shadow-xs transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <StatusTitle tone={CATERING_STATUS_TONES[order.status] || "zinc"} status={CATERING_STATUS_LABELS[order.status] || order.status} className="text-base font-semibold tracking-tight">
          {order.cateringNumber} · {order.customerName || "Guest"}
        </StatusTitle>
        <span className="shrink-0 text-sm font-semibold tabular-nums">{(order.subtotalCents || 0) > 0 ? formatMoney(order.subtotalCents, currencyCode) : "No quote"}</span>
      </div>
      <p className="text-sm tabular-nums">{order.eventAt ? formatStoreDateTime(order.eventAt, timezone) : "Event date not set"}</p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
        <span>{order.guestCount || 0} guests</span>
        {source ? <span>{source}</span> : null}
        {order.customerEmail ? <span className="[overflow-wrap:anywhere]">{order.customerEmail}</span> : null}
      </div>
      {order.deliveryAddress ? <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{order.deliveryAddress}</p> : null}
    </Link>
  );
}

export async function CateringListPage({ search, status, page }: { search: string; status: CateringFilter; page: number }) {
  const view = viewQuery(status);
  const searchFilter = searchWhere(search);
  const [response, store, role] = await Promise.all([
    keystoneClient<ListResult>(LIST_QUERY, {
      where: { AND: [searchFilter, view.status] },
      search: searchFilter,
      orderBy: view.orderBy,
      take: CATERING_PAGE_SIZE,
      skip: (page - 1) * CATERING_PAGE_SIZE,
    }, { cache: "no-store" }),
    loadStoreRecord(),
    loadRoleFlags(),
  ]);
  const data = response.success ? response.data : null;
  const pages = data ? Math.max(1, Math.ceil(data.filtered / CATERING_PAGE_SIZE)) : 1;
  const canManage = Boolean(role.canManageOrders);

  return (
    <PageContainer
      title="Catering"
      header={<PlatformHeader title="Catering" meta={data ? <span>{data.all} orders</span> : null} actions={canManage ? <CreateCateringSheet timezone={store.timezone} /> : null} />}
      breadcrumbs={[{ type: "link", label: "Dashboard", href: "/dashboard" }, { type: "page", label: "Platform" }, { type: "page", label: "Catering" }]}
    >
      <div className="space-y-6 px-4 pb-24 md:px-6">
        <div className="space-y-3">
          <nav aria-label="Status" className="min-w-0 max-w-full">
            <PillTrack label="Status">
              {TABS.map((tab) => (
                <PillLink key={tab.value} href={cateringListHref({ search, status: tab.value })} active={tab.value === status} count={data ? tab.count(data) : undefined}>
                  {tab.label}
                </PillLink>
              ))}
            </PillTrack>
          </nav>
          <form method="get" role="search" className="flex max-w-xl items-center gap-2">
            {status !== "upcoming" ? <input type="hidden" name="status" value={status} /> : null}
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="catering-search" className="sr-only">Search catering</label>
              <Input id="catering-search" type="search" name="search" defaultValue={search} placeholder="Number, name or email" className="h-10 rounded-full pl-9" />
            </div>
            <Button type="submit" variant="outline" className="h-10 rounded-full">Search</Button>
            {search ? <Button asChild variant="ghost" className="h-10 rounded-full"><Link href={cateringListHref({ status })}>Clear</Link></Button> : null}
          </form>
        </div>

        {!data ? (
          <Alert variant="destructive" role="alert"><AlertTitle>Unable to load catering orders</AlertTitle></Alert>
        ) : data.cateringOrders.length ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.cateringOrders.map((order) => <CateringCard key={order.id} order={order} timezone={store.timezone} currencyCode={store.currencyCode} />)}
          </div>
        ) : (
          <PlatformEmpty>{search ? `No catering orders match "${search}".` : "No catering orders."}</PlatformEmpty>
        )}

        {data && pages > 1 ? (
          <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span className="tabular-nums">Page {page} of {pages}</span>
            <div className="flex gap-2">
              {page > 1 ? <Button asChild size="sm" variant="outline" className="rounded-full"><Link href={cateringListHref({ search, status, page: page - 1 })}>Previous</Link></Button> : null}
              {page < pages ? <Button asChild size="sm" variant="outline" className="rounded-full"><Link href={cateringListHref({ search, status, page: page + 1 })}>Next</Link></Button> : null}
            </div>
          </nav>
        ) : null}
      </div>
    </PageContainer>
  );
}
