import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageContainer } from "@/features/dashboard/components/PageContainer";
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
  return `${option && option.value !== "custom" ? `${option.label} · ` : ""}${range} · ${period.timezoneConfigured ? `store time (${period.timezone})` : "UTC (store timezone not set)"}`;
}

function PeriodForm({ input, error }: { input: PeriodInput; error: string | null }) {
  return (
    <form method="get" action="/dashboard/platform/reports" className="grid gap-3 rounded-lg border bg-card p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,12rem)_minmax(0,11rem)_minmax(0,11rem)_auto] lg:items-end">
      <div className="grid gap-1.5">
        <Label htmlFor="report-period">Period</Label>
        <select id="report-period" name="period" defaultValue={input.period} className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground">
          {PERIOD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
        </select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="report-start">Start date (custom)</Label>
        <Input id="report-start" name="startDate" type="date" defaultValue={input.startDate} aria-describedby={error ? "report-period-error" : undefined} />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="report-end">End date (custom)</Label>
        <Input id="report-end" name="endDate" type="date" defaultValue={input.endDate} aria-describedby={error ? "report-period-error" : undefined} />
      </div>
      <Button type="submit">Show period</Button>
      {error ? <p id="report-period-error" role="alert" className="text-sm text-destructive sm:col-span-2 lg:col-span-4">{error}</p> : null}
    </form>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="min-w-0 rounded-lg border bg-card p-4">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-2xl font-semibold tabular-nums text-foreground">{value}</dd>
      {hint ? <dd className="mt-1 text-xs text-muted-foreground">{hint}</dd> : null}
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{text}</p>;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PageContainer
      title="Analytics"
      header={<div><h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Analytics</h1><p className="text-sm text-muted-foreground">Sales, collections, stock and loyalty for a selected store business period.</p></div>}
      breadcrumbs={[{ type: "link", label: "Dashboard", href: "/dashboard" }, { type: "page", label: "Analytics" }]}
    >
      <div className="space-y-6 px-4 pb-8 md:px-6">{children}</div>
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
        <div role="alert" className="rounded-lg border border-destructive/40 bg-card p-4 text-sm text-foreground">
          Analytics are unavailable right now. No figures are shown. <Link className="font-medium underline" href={reportHref(input, {})}>Try again</Link>
        </div>
      </Shell>
    );
  }

  const report = result.report;
  const { sales, collections, lowStock, loyalty } = report;
  const currency = collections?.currencyCode || "USD";
  const nothingVisible = !sales && !collections && !lowStock && !loyalty;
  const maxStation = Math.max(1, ...(sales?.stationProduction.map((station) => station.quantity) ?? []));

  return (
    <Shell>
      <PeriodForm input={input} error={null} />
      <p role="status" className="text-sm text-muted-foreground">{periodLabel(report.period)}</p>
      {nothingVisible ? <EmptyLine text="Your role does not include any analytics sections." /> : null}

      {sales || collections ? (
        <section aria-labelledby="sales-heading" className="space-y-3">
          <h2 id="sales-heading" className="text-lg font-semibold">Sales and collections</h2>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {collections ? <>
              <Stat label="Net collected" value={collections.currencyMismatch ? "Unavailable" : money(collections.netCollectedCents, currency)} hint="Captured payments minus refunds, by payment date" />
              <Stat label="Collected before refunds" value={collections.currencyMismatch ? "Unavailable" : money(collections.grossCollectedCents, currency)} hint={`${count(collections.paymentCount)} payments`} />
              <Stat label="Refunded" value={collections.currencyMismatch ? "Unavailable" : money(collections.refundedCents, currency)} />
            </> : null}
            {sales ? <>
              <Stat label="Gross sales" value={money(sales.grossSalesCents, currency)} hint={`Item subtotal of ${count(sales.completedCount)} completed orders`} />
              <Stat label="Tax" value={money(sales.taxCents, currency)} hint="On completed orders" />
              <Stat label="Tips" value={money(sales.tipCents, currency)} hint="On completed orders" />
              <Stat label="Discounts" value={money(sales.discountCents, currency)} hint="On completed orders" />
              <Stat label="Orders placed" value={count(sales.orderCount)} hint={`${count(sales.cancelledCount)} cancelled`} />
              <Stat label="Completion rate" value={`${sales.completionRatePercent}%`} />
              <Stat label="Average fulfillment" value={sales.averageFulfillmentMinutes == null ? "No completed orders" : `${sales.averageFulfillmentMinutes} min`} hint={sales.fulfillmentSampleCount ? `Across ${count(sales.fulfillmentSampleCount)} completed orders` : undefined} />
              <Stat label="Open tickets now" value={count(sales.openTicketCount)} hint={`${count(sales.readyTicketCount)} ready for pickup · current, not period-based`} />
            </> : null}
          </dl>
          {collections?.currencyMismatch ? <p role="alert" className="text-sm text-destructive">Payments in this period use more than one currency, so collected totals cannot be combined. Review payments before relying on these figures.</p> : null}
          {collections && collections.needsReviewCount > 0 ? <p role="status" className="text-sm text-muted-foreground">{count(collections.needsReviewCount)} payments in this period have refund details that need review; they are included as recorded.</p> : null}
        </section>
      ) : null}

      {sales ? (
        <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Top items</CardTitle>
              <CardDescription>Top {sales.topItems.length || 8} products by line sales on completed orders in this period, grouped by menu item.</CardDescription>
            </CardHeader>
            <CardContent>
              {sales.topItems.length ? (
                <div className="overflow-x-auto rounded-lg border">
                  <Table aria-label="Top items">
                    <TableHeader><TableRow><TableHead>Item</TableHead><TableHead className="text-right">Sold</TableHead><TableHead className="text-right">Line sales</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {sales.topItems.map((item) => (
                        <TableRow key={item.key}>
                          <TableCell className="min-w-0 break-words font-medium">{item.name}</TableCell>
                          <TableCell className="text-right tabular-nums">{count(item.quantity)}</TableCell>
                          <TableCell className="text-right tabular-nums">{money(item.revenueCents, currency)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : <EmptyLine text="No completed orders in this period." />}
              {sales.topItemsTruncated ? <p role="status" className="mt-2 text-xs text-muted-foreground">This period has an unusually large number of price variants; rankings use the first 5,000.</p> : null}
            </CardContent>
          </Card>

          <Card className="min-w-0">
            <CardHeader>
              <CardTitle>Items produced by station</CardTitle>
              <CardDescription>Items on completed orders in this period. For current station work, use the KDS.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {sales.stationProduction.map((station) => (
                <div key={station.station} className="rounded-lg border p-3">
                  <div className="mb-2 flex flex-wrap justify-between gap-2 text-sm">
                    <span className="font-medium capitalize">{station.station.replaceAll("_", " ")}</span>
                    <span className="tabular-nums">{count(station.quantity)} items</span>
                  </div>
                  <div className="h-2 rounded-full bg-muted" aria-hidden="true">
                    <div className="h-2 rounded-full bg-primary" style={{ width: pct(station.quantity, maxStation) }} />
                  </div>
                </div>
              ))}
              {!sales.stationProduction.length ? <EmptyLine text="No completed items in this period." /> : null}
            </CardContent>
          </Card>
        </section>
      ) : null}

      {lowStock || loyalty ? (
        <section className="grid min-w-0 gap-6 xl:grid-cols-2">
          {lowStock ? (
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Low-stock watchlist</CardTitle>
                <CardDescription>
                  {lowStock.totalCount
                    ? `${count(lowStock.totalCount)} items at or below their reorder point, or under 35% of par. Lowest stock first.`
                    : "Items at or below their reorder point, or under 35% of par."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {lowStock.items.map((item) => (
                  <div key={item.id} className="rounded-lg border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="break-words font-medium">{item.name}</div>
                        <div className="mt-1 text-sm capitalize text-muted-foreground">{item.category || "Uncategorized"} · {item.supplierName || "No supplier"}</div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="font-semibold tabular-nums">{quantity(item.currentStock)} {item.unit}</div>
                        <div className="text-muted-foreground">reorder at {quantity(item.reorderPoint)}</div>
                      </div>
                    </div>
                    {item.parLevel > 0 ? (
                      <div className="mt-3 h-2 rounded-full bg-muted" aria-hidden="true">
                        <div className="h-2 rounded-full bg-destructive" style={{ width: pct(Math.max(0, Math.min(item.currentStock, item.parLevel)), item.parLevel) }} />
                      </div>
                    ) : null}
                  </div>
                ))}
                {!lowStock.items.length ? <EmptyLine text={lowStock.page > 0 ? "No more low-stock items on this page." : "No items are low on stock."} /> : null}
                {lowStock.totalCount > lowStock.pageSize || lowStock.page > 0 ? (
                  <nav aria-label="Low-stock pages" className="flex flex-wrap items-center gap-2">
                    <p className="mr-auto text-sm text-muted-foreground">
                      {lowStock.items.length ? `Showing ${count(lowStock.page * lowStock.pageSize + 1)}–${count(lowStock.page * lowStock.pageSize + lowStock.items.length)} of ${count(lowStock.totalCount)}` : `${count(lowStock.totalCount)} total`}
                    </p>
                    {lowStock.page > 0 ? <Button asChild size="sm" variant="outline"><Link href={reportHref(input, { lowStockPage: lowStock.page - 1 })}>Previous</Link></Button> : null}
                    {(lowStock.page + 1) * lowStock.pageSize < lowStock.totalCount ? <Button asChild size="sm" variant="outline"><Link href={reportHref(input, { lowStockPage: lowStock.page + 1 })}>Next</Link></Button> : null}
                  </nav>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          {loyalty ? (
            <Card className="min-w-0">
              <CardHeader>
                <CardTitle>Loyalty</CardTitle>
                <CardDescription>Totals cover every store loyalty account. The six accounts with the most lifetime points are listed.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <Stat label="Accounts" value={count(loyalty.accountCount)} />
                  <Stat label="Visits" value={count(loyalty.totalVisits)} />
                  <Stat label="Unredeemed drink credits" value={count(loyalty.outstandingDrinkCredits)} />
                </dl>
                <div className="space-y-3">
                  {loyalty.topAccounts.map((account) => (
                    <div key={account.id} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border p-3">
                      <div className="min-w-0">
                        <div className="break-words font-medium">{account.customerName || account.customerEmail || "Guest account"}</div>
                        <div className="text-sm capitalize text-muted-foreground">{(account.tier || "regular").replaceAll("_", " ")} · last visit {formatStoreDateTime(account.lastVisitAt, report.storeTimezone)}</div>
                      </div>
                      <div className="text-right text-sm">
                        <div className="font-semibold tabular-nums">{count(account.lifetimePoints || 0)} pts</div>
                        <div className="text-muted-foreground">{count(account.drinkCredits || 0)} credits</div>
                      </div>
                    </div>
                  ))}
                  {!loyalty.topAccounts.length ? <EmptyLine text="No loyalty accounts yet." /> : null}
                </div>
              </CardContent>
            </Card>
          ) : null}
        </section>
      ) : null}
    </Shell>
  );
}
