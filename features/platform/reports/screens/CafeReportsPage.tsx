import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageContainer } from "@/features/dashboard/components/PageContainer";
import { PillLink, PillTrack } from "@/features/platform/components/PillTabs";
import { PlatformEmpty, PlatformHeader, PlatformSection } from "@/features/platform/components/PlatformPage";
import { StatusTitle } from "@/features/platform/components/StatusTitle";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { formatStoreDateTime } from "@/lib/date-time";
import { addBusinessDays, isBusinessDate } from "../lib/businessDate";
import { loadCoffeeReports, type ReportsProjection } from "../lib/reportResponse";

const REPORTS_QUERY = `
  query CoffeeReports($period: String, $startDate: String, $endDate: String, $lowStockPage: Int) {
    getCoffeeReports(period: $period, startDate: $startDate, endDate: $endDate, lowStockPage: $lowStockPage) {
      storeTimezone
      period { period startDate endDate timezone timezoneConfigured }
      sales {
        orderCount completedCount cancelledCount completionRatePercent
        grossSalesCents taxCents tipCents discountCents
        averageFulfillmentMinutes fulfillmentSampleCount openTicketCount readyTicketCount
        topItems { key menuItemId name quantity revenueCents }
        topItemsTruncated
        stationProduction { station quantity }
      }
      collections { currencyCode currencyMismatch paymentCount grossCollectedCents refundedCents netCollectedCents needsReviewCount }
      lowStock { totalCount page pageSize items { id name category unit currentStock reorderPoint parLevel supplierName } }
      loyalty {
        accountCount totalVisits outstandingDrinkCredits
        topAccounts { id customerName customerEmail tier lifetimePoints drinkCredits lastVisitAt }
      }
    }
  }
`;

const PERIOD_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
  { value: "90d", label: "Last 90 days" },
  { value: "custom", label: "Custom range" },
] as const;
const MAX_CUSTOM_DAYS = 366;

type SearchParams = { period?: string | string[]; startDate?: string | string[]; endDate?: string | string[]; lowStockPage?: string | string[] };
type PeriodInput = { period: string; startDate: string; endDate: string; lowStockPage: number };

function single(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function parsePeriod(params: SearchParams): { input: PeriodInput; error: string | null } {
  const requested = single(params.period);
  const period = PERIOD_OPTIONS.some((option) => option.value === requested) ? requested : "30d";
  const startDate = single(params.startDate);
  const endDate = single(params.endDate);
  const page = Number(single(params.lowStockPage) || "0");
  const lowStockPage = Number.isSafeInteger(page) && page >= 0 && page <= 10_000 ? page : 0;
  const input = { period, startDate, endDate, lowStockPage };
  if (period !== "custom") return { input, error: null };
  if (!isBusinessDate(startDate) || !isBusinessDate(endDate)) return { input, error: "Enter both a start date and an end date for a custom range." };
  if (startDate > endDate) return { input, error: "The start date must be on or before the end date." };
  if (addBusinessDays(startDate, MAX_CUSTOM_DAYS - 1) < endDate) return { input, error: `Choose a custom range of ${MAX_CUSTOM_DAYS} days or fewer.` };
  return { input, error: null };
}

function reportHref(input: PeriodInput, updates: Partial<PeriodInput>) {
  const state = { ...input, ...updates };
  const params = new URLSearchParams({ period: state.period });
  if (state.period === "custom") {
    params.set("startDate", state.startDate);
    params.set("endDate", state.endDate);
  }
  if (state.lowStockPage) params.set("lowStockPage", String(state.lowStockPage));
  return `/dashboard/platform/reports?${params.toString()}`;
}

function money(cents: number | null | undefined, currency = "USD") {
  if (cents == null) return "Unavailable";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
  } catch {
    return `${(cents / 100).toFixed(2)} ${currency}`;
  }
}

function count(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function quantity(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 4 }).format(value);
}

function pct(numerator: number, denominator: number) {
  if (!denominator) return "0%";
  return `${Math.min(100, Math.max(0, Math.round((numerator / denominator) * 100)))}%`;
}

function periodLabel(period: ReportsProjection["period"]) {
  const option = PERIOD_OPTIONS.find((candidate) => candidate.value === period.period);
  const range = period.startDate === period.endDate ? period.startDate : `${period.startDate} to ${period.endDate}`;
  return `${option && option.value !== "custom" ? `${option.label} · ` : ""}${range} · ${period.timezoneConfigured ? period.timezone : "UTC (store timezone not set)"}`;
}

function PeriodForm({ input, error }: { input: PeriodInput; error: string | null }) {
  const custom = input.period === "custom";
  return (
    <div className="space-y-3">
      <nav aria-label="Period">
        <PillTrack label="Period">
          {PERIOD_OPTIONS.map((option) => (
            <PillLink key={option.value} size="md" href={reportHref({ ...input, lowStockPage: 0 }, { period: option.value })} active={input.period === option.value}>{option.label}</PillLink>
          ))}
        </PillTrack>
      </nav>
      {custom ? (
        <form method="get" action="/dashboard/platform/reports" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="period" value="custom" />
          <div className="grid gap-1.5">
            <Label htmlFor="report-start">Start</Label>
            <Input id="report-start" name="startDate" type="date" defaultValue={input.startDate} aria-describedby={error ? "report-period-error" : undefined} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="report-end">End</Label>
            <Input id="report-end" name="endDate" type="date" defaultValue={input.endDate} aria-describedby={error ? "report-period-error" : undefined} />
          </div>
          <Button type="submit" className="rounded-full">Apply</Button>
          {error ? <p id="report-period-error" role="alert" className="basis-full text-sm text-destructive">{error}</p> : null}
        </form>
      ) : null}
    </div>
  );
}

function Figure({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="min-w-0 bg-card px-4 py-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-lg font-semibold tabular-nums tracking-tight text-foreground">{value}</dd>
      {sub ? <dd className="text-xs tabular-nums text-muted-foreground">{sub}</dd> : null}
    </div>
  );
}

function Bar({ value, max, tone = "bg-primary" }: { value: number; max: number; tone?: string }) {
  return (
    <div className="h-1.5 rounded-full bg-muted" aria-hidden="true">
      <div className={`h-1.5 rounded-full ${tone}`} style={{ width: pct(value, max) }} />
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PageContainer
      title="Analytics"
      header={<PlatformHeader title="Analytics" />}
      breadcrumbs={[{ type: "link", label: "Dashboard", href: "/dashboard" }, { type: "page", label: "Analytics" }]}
    >
      <div className="space-y-8 px-4 pb-10 md:px-6">{children}</div>
    </PageContainer>
  );
}

export async function CafeReportsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = (await searchParams) ?? {};
  const { input, error } = parsePeriod(params);
  if (error) {
    return <Shell><PeriodForm input={input} error={error} /></Shell>;
  }
  const result = await loadCoffeeReports(REPORTS_QUERY, {
    period: input.period,
    startDate: input.period === "custom" ? input.startDate : null,
    endDate: input.period === "custom" ? input.endDate : null,
    lowStockPage: input.lowStockPage,
  }, (query, variables, options) => keystoneClient<unknown>(query, variables, options));

  if (result.kind !== "ready") {
    return (
      <Shell>
        <PeriodForm input={input} error={null} />
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-medium">Analytics unavailable.</p>
          <Button asChild size="sm" variant="outline" className="rounded-full"><Link href={reportHref(input, {})}>Try again</Link></Button>
        </div>
      </Shell>
    );
  }

  const report = result.report;
  const { sales, collections, lowStock, loyalty } = report;
  const currency = collections?.currencyCode || "USD";
  const nothingVisible = !sales && !collections && !lowStock && !loyalty;
  const maxStation = Math.max(1, ...(sales?.stationProduction.map((station) => station.quantity) ?? []));
  const maxItemRevenue = Math.max(1, ...(sales?.topItems.map((item) => item.revenueCents) ?? []));
  const mismatch = Boolean(collections?.currencyMismatch);
  const headline = collections
    ? { label: "Net collected", value: mismatch ? "Unavailable" : money(collections.netCollectedCents, currency), sub: `${count(collections.paymentCount)} payments` }
    : sales ? { label: "Gross sales", value: money(sales.grossSalesCents, currency), sub: `${count(sales.completedCount)} completed orders` } : null;

  return (
    <Shell>
      <div className="space-y-2">
        <PeriodForm input={input} error={null} />
        <p role="status" className="text-xs text-muted-foreground">{periodLabel(report.period)}</p>
      </div>
      {nothingVisible ? <PlatformEmpty>No analytics sections for your role.</PlatformEmpty> : null}

      {headline ? (
        <section aria-labelledby="sales-heading" className="space-y-4">
          <h2 id="sales-heading" className="sr-only">Sales and collections</h2>
          <div>
            <p className="text-sm text-muted-foreground">{headline.label}</p>
            <p className="text-4xl font-semibold tabular-nums tracking-tight md:text-5xl">{headline.value}</p>
            <p className="mt-1 text-sm tabular-nums text-muted-foreground">{headline.sub}</p>
          </div>
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-3 xl:grid-cols-5">
            {collections ? <>
              <Figure label="Collected before refunds" value={mismatch ? "Unavailable" : money(collections.grossCollectedCents, currency)} />
              <Figure label="Refunded" value={mismatch ? "Unavailable" : money(collections.refundedCents, currency)} />
            </> : null}
            {sales ? <>
              {collections ? <Figure label="Gross sales" value={money(sales.grossSalesCents, currency)} sub={`${count(sales.completedCount)} completed`} /> : null}
              <Figure label="Tax" value={money(sales.taxCents, currency)} />
              <Figure label="Tips" value={money(sales.tipCents, currency)} />
              <Figure label="Discounts" value={money(sales.discountCents, currency)} />
              <Figure label="Orders placed" value={count(sales.orderCount)} sub={`${count(sales.cancelledCount)} cancelled`} />
              <Figure label="Completion" value={`${sales.completionRatePercent}%`} />
              <Figure label="Avg fulfillment" value={sales.averageFulfillmentMinutes == null ? "—" : `${sales.averageFulfillmentMinutes} min`} sub={sales.fulfillmentSampleCount ? `${count(sales.fulfillmentSampleCount)} orders` : undefined} />
              <Figure label="Open tickets now" value={count(sales.openTicketCount)} sub={`${count(sales.readyTicketCount)} ready`} />
            </> : null}
          </dl>
          {mismatch ? <p role="alert" className="text-sm text-destructive">Payments use more than one currency; collected totals can’t be combined.</p> : null}
          {collections && collections.needsReviewCount > 0 ? <p role="status" className="text-sm text-muted-foreground">{count(collections.needsReviewCount)} payments have refund details needing review; included as recorded.</p> : null}
        </section>
      ) : null}

      {sales ? (
        <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)]">
          <PlatformSection id="top-items-heading" title="Product mix" meta="Completed orders">
            {sales.topItems.length ? (
              <ol className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card" aria-label="Top items">
                {sales.topItems.map((item, index) => (
                  <li key={item.key} className="grid grid-cols-[1.5rem_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5 px-4 py-3">
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">{index + 1}</span>
                    <span className="min-w-0 break-words text-sm font-medium">{item.name}</span>
                    <span className="text-right text-sm font-semibold tabular-nums">{money(item.revenueCents, currency)}</span>
                    <span aria-hidden="true" />
                    <Bar value={item.revenueCents} max={maxItemRevenue} />
                    <span className="text-right text-xs tabular-nums text-muted-foreground">{count(item.quantity)} sold</span>
                  </li>
                ))}
              </ol>
            ) : <PlatformEmpty>No completed orders in this period.</PlatformEmpty>}
            {sales.topItemsTruncated ? <p role="status" className="text-xs text-muted-foreground">Rankings use the first 5,000 price variants.</p> : null}
          </PlatformSection>

          <PlatformSection id="stations-heading" title="By station" meta="Items made">
            {sales.stationProduction.length ? (
              <ul className="space-y-3 rounded-xl border border-border bg-card p-4">
                {sales.stationProduction.map((station) => (
                  <li key={station.station} className="space-y-1.5">
                    <div className="flex justify-between gap-2 text-sm">
                      <span className="font-medium capitalize">{station.station.replaceAll("_", " ")}</span>
                      <span className="tabular-nums text-muted-foreground">{count(station.quantity)}</span>
                    </div>
                    <Bar value={station.quantity} max={maxStation} />
                  </li>
                ))}
              </ul>
            ) : <PlatformEmpty>No completed items in this period.</PlatformEmpty>}
          </PlatformSection>
        </div>
      ) : null}

      {lowStock || loyalty ? (
        <div className="grid min-w-0 gap-8 xl:grid-cols-2">
          {lowStock ? (
            <PlatformSection
              id="low-stock-heading"
              title="Low stock"
              meta={lowStock.totalCount ? count(lowStock.totalCount) : undefined}
              actions={lowStock.totalCount > lowStock.pageSize || lowStock.page > 0 ? (
                <nav aria-label="Low-stock pages" className="flex items-center gap-1">
                  {lowStock.page > 0 ? <Button asChild size="sm" variant="ghost" className="rounded-full"><Link href={reportHref(input, { lowStockPage: lowStock.page - 1 })}>Previous</Link></Button> : null}
                  {(lowStock.page + 1) * lowStock.pageSize < lowStock.totalCount ? <Button asChild size="sm" variant="outline" className="rounded-full"><Link href={reportHref(input, { lowStockPage: lowStock.page + 1 })}>Next</Link></Button> : null}
                </nav>
              ) : null}
            >
              {lowStock.items.length ? (
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                  {lowStock.items.map((item) => {
                    const out = item.currentStock <= 0;
                    return (
                      <li key={item.id} className="space-y-2 px-4 py-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <StatusTitle as="p" tone={out ? "red" : "amber"} status={out ? "Out" : null} className="text-sm font-medium">{item.name}</StatusTitle>
                            <p className="pl-4 text-xs capitalize text-muted-foreground">{item.category || "Uncategorized"} · {item.supplierName || "No supplier"}</p>
                          </div>
                          <div className="shrink-0 text-right text-sm">
                            <p className="font-semibold tabular-nums">{quantity(item.currentStock)} {item.unit}</p>
                            <p className="text-xs tabular-nums text-muted-foreground">Reorder at {quantity(item.reorderPoint)}</p>
                          </div>
                        </div>
                        {item.parLevel > 0 ? <div className="pl-4"><Bar value={Math.max(0, Math.min(item.currentStock, item.parLevel))} max={item.parLevel} tone="bg-destructive" /></div> : null}
                      </li>
                    );
                  })}
                </ul>
              ) : <PlatformEmpty>{lowStock.page > 0 ? "No more low-stock items." : "Nothing low on stock."}</PlatformEmpty>}
              {lowStock.items.length && (lowStock.totalCount > lowStock.pageSize || lowStock.page > 0) ? (
                <p className="text-xs tabular-nums text-muted-foreground">{count(lowStock.page * lowStock.pageSize + 1)}–{count(lowStock.page * lowStock.pageSize + lowStock.items.length)} of {count(lowStock.totalCount)}</p>
              ) : null}
            </PlatformSection>
          ) : null}

          {loyalty ? (
            <PlatformSection id="loyalty-heading" title="Loyalty" meta="All time">
              <dl className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border">
                <Figure label="Accounts" value={count(loyalty.accountCount)} />
                <Figure label="Visits" value={count(loyalty.totalVisits)} />
                <Figure label="Unredeemed credits" value={count(loyalty.outstandingDrinkCredits)} />
              </dl>
              {loyalty.topAccounts.length ? (
                <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
                  {loyalty.topAccounts.map((account) => (
                    <li key={account.id} className="flex items-start justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <p className="break-words text-sm font-medium">{account.customerName || account.customerEmail || "Guest account"}</p>
                        <p className="text-xs text-muted-foreground"><span className="capitalize">{(account.tier || "regular").replaceAll("_", " ")}</span> · Last visit {formatStoreDateTime(account.lastVisitAt, report.storeTimezone)}</p>
                      </div>
                      <div className="shrink-0 text-right text-sm">
                        <p className="font-semibold tabular-nums">{count(account.lifetimePoints || 0)} pts</p>
                        <p className="text-xs tabular-nums text-muted-foreground">{count(account.drinkCredits || 0)} credits</p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : <PlatformEmpty>No loyalty accounts yet.</PlatformEmpty>}
            </PlatformSection>
          ) : null}
        </div>
      ) : null}
    </Shell>
  );
}
