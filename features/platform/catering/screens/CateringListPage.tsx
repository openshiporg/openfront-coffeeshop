import Link from "next/link";
import type * as React from "react";
import { Search } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/features/dashboard/components/PageContainer";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { PillLink, PillTrack } from "@/features/platform/components/PillTabs";
import { PlatformEmpty, PlatformHeader, PlatformTable, platformTd } from "@/features/platform/components/PlatformPage";
import { StatusDot } from "@/features/platform/components/StatusTitle";
import { cn } from "@/lib/utils";
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
import { addToDate, formatMoney, instantToStoreDate, storeToday, validTimeZone } from "../lib/store-time";

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

function eventDayLabel(dateKey: string, today: string) {
  if (!dateKey) return "Date not set";
  if (dateKey === today) return "Today";
  if (dateKey === addToDate(today, { days: 1 })) return "Tomorrow";
  const [year, month, day] = dateKey.split("-").map(Number);
  const label = new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(new Date(Date.UTC(year, month - 1, day)));
  return dateKey < today ? `${label} (past)` : label;
}

function eventTime(iso: string | null, timezone: string) {
  if (!iso) return "—";
  const instant = new Date(iso);
  if (!Number.isFinite(instant.getTime())) return "—";
  return new Intl.DateTimeFormat("en-US", { timeZone: validTimeZone(timezone) || "UTC", hour: "numeric", minute: "2-digit" }).format(instant);
}

/** What the order is waiting on, in the operator's words. */
function nextStep(order: CateringOrderRecord): { label: string; urgent: boolean } | null {
  if (order.status === "inquiry") return (order.subtotalCents || 0) > 0 ? { label: "Send quote", urgent: true } : { label: "Needs quote", urgent: true };
  if (order.status === "quoted") return { label: "Awaiting customer", urgent: false };
  if (order.status === "confirmed") return { label: "Prepare", urgent: false };
  return null;
}

function CateringTable({ orders, timezone, currencyCode, grouped }: { orders: CateringOrderRecord[]; timezone: string; currencyCode: string; grouped: boolean }) {
  const today = storeToday(timezone);
  let lastDay: string | null = null;
  const rows: React.ReactNode[] = [];
  for (const order of orders) {
    const dayKey = instantToStoreDate(order.eventAt, timezone);
    if (grouped && dayKey !== lastDay) {
      lastDay = dayKey;
      rows.push(
        <tr key={`day-${dayKey || "none"}`}>
          <th scope="rowgroup" colSpan={6} className="border-b bg-muted/20 px-3 py-1.5 text-left text-xs font-semibold tabular-nums text-foreground">{eventDayLabel(dayKey, today)}</th>
        </tr>,
      );
    }
    const step = nextStep(order);
    const source = cateringSource(order.metadata);
    rows.push(
      <tr key={order.id} className="transition-colors hover:bg-muted/30">
        <td className={cn(platformTd, "whitespace-nowrap tabular-nums")}>
          <span className="font-medium">{grouped ? eventTime(order.eventAt, timezone) : order.eventAt ? `${eventDayLabel(dayKey, today)} · ${eventTime(order.eventAt, timezone)}` : "Date not set"}</span>
        </td>
        <td className={cn(platformTd, "min-w-44")}>
          <Link href={`/dashboard/platform/catering/${order.id}`} className="font-medium underline-offset-4 hover:underline focus-visible:underline [overflow-wrap:anywhere]">{order.customerName || "Guest"}</Link>
          <p className="text-xs text-muted-foreground"><span className="tabular-nums">{order.cateringNumber}</span>{source ? ` · ${source}` : ""}</p>
        </td>
        <td className={cn(platformTd, "whitespace-nowrap")}>
          <span className="inline-flex items-center gap-2"><StatusDot tone={CATERING_STATUS_TONES[order.status] || "zinc"} />{CATERING_STATUS_LABELS[order.status] || order.status}</span>
          {step ? <p className={cn("text-xs", step.urgent ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>{step.label}</p> : null}
        </td>
        <td className={cn(platformTd, "whitespace-nowrap text-right tabular-nums")}>{order.guestCount || 0}</td>
        <td className={cn(platformTd, "whitespace-nowrap text-right tabular-nums")}>
          {(order.subtotalCents || 0) > 0 ? formatMoney(order.subtotalCents, currencyCode) : <span className="text-muted-foreground">No quote</span>}
        </td>
        <td className={cn(platformTd, "hidden max-w-64 text-muted-foreground lg:table-cell")}><span className="line-clamp-2 [overflow-wrap:anywhere]">{order.deliveryAddress || "Pickup"}</span></td>
      </tr>,
    );
  }
  return (
    <PlatformTable
      label="Catering orders"
      head={[
        { label: grouped ? "Time" : "Event" },
        { label: "Customer" },
        { label: "Status" },
        { label: "Guests", className: "text-right" },
        { label: "Quote", className: "text-right" },
        { label: "Delivery", className: "hidden lg:table-cell" },
      ]}
    >
      {rows}
    </PlatformTable>
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
  // Open views are sorted by event date, so they read as a date-led agenda.
  const grouped = status === "upcoming" || (OPEN_CATERING_STATUSES as string[]).includes(status);

  return (
    <PageContainer
      title="Catering"
      header={<PlatformHeader title="Catering" meta={data ? (
        <span className="tabular-nums">
          {data.confirmed} confirmed
          {data.inquiry ? <> · <span className="font-medium text-amber-700 dark:text-amber-400">{data.inquiry} {data.inquiry === 1 ? "needs" : "need"} a quote</span></> : null}
        </span>
      ) : null} actions={canManage ? <CreateCateringSheet timezone={store.timezone} /> : null} />}
      breadcrumbs={[{ type: "link", label: "Dashboard", href: "/dashboard" }, { type: "page", label: "Platform" }, { type: "page", label: "Catering" }]}
    >
      <div className="space-y-4 px-4 pb-24 md:px-6">
        <div className="space-y-4">
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
              <Input id="catering-search" type="search" name="search" defaultValue={search} placeholder="Number, name or email" className="h-9 rounded-[6px] pl-9" />
            </div>
            <Button type="submit" variant="outline" className="h-9 rounded-[6px]">Search</Button>
            {search ? <Button asChild variant="ghost" className="h-9 rounded-[6px]"><Link href={cateringListHref({ status })}>Clear</Link></Button> : null}
          </form>
        </div>

        {!data ? (
          <Alert variant="destructive" role="alert" className="rounded-[6px]">
            <AlertTitle>Catering orders didn&apos;t load</AlertTitle>
            <AlertDescription>
              <p>Nothing was changed.{canManage ? " New inquiries can still be added." : ""}</p>
              <div className="mt-2"><Button asChild size="sm" variant="outline" className="rounded-[6px]"><Link href={cateringListHref({ search, status, page })}>Try again</Link></Button></div>
            </AlertDescription>
          </Alert>
        ) : data.cateringOrders.length ? (
          <CateringTable orders={data.cateringOrders} timezone={store.timezone} currencyCode={store.currencyCode} grouped={grouped} />
        ) : (
          <PlatformEmpty>{search ? `No catering orders match "${search}".` : status === "upcoming" ? "No upcoming events." : "No catering orders in this view."}</PlatformEmpty>
        )}

        {data && pages > 1 ? (
          <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
            <span className="tabular-nums">Page {page} of {pages}</span>
            <div className="flex gap-2">
              {page > 1 ? <Button asChild size="sm" variant="outline" className="rounded-[6px]"><Link href={cateringListHref({ search, status, page: page - 1 })}>Previous</Link></Button> : null}
              {page < pages ? <Button asChild size="sm" variant="outline" className="rounded-[6px]"><Link href={cateringListHref({ search, status, page: page + 1 })}>Next</Link></Button> : null}
            </div>
          </nav>
        ) : null}
      </div>
    </PageContainer>
  );
}
