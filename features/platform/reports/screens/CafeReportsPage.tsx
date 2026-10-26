import Link from "next/link";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageContainer } from "@/features/dashboard/components/PageContainer";
import { PillLink, PillTrack } from "@/features/platform/components/PillTabs";
import { PlatformEmpty, PlatformHeader, PlatformSection, PlatformTable, platformTd } from "@/features/platform/components/PlatformPage";
import { cn } from "@/lib/utils";
import { StatusDot } from "@/features/platform/components/StatusTitle";
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
  const period = PERIOD_OPTIONS.some((option) => option.value === requested) ? requested : "today";
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
            <Input id="report-start" name="startDate" type="date" className="rounded-[6px]" defaultValue={input.startDate} aria-describedby={error ? "report-period-error" : undefined} />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="report-end">End</Label>
            <Input id="report-end" name="endDate" type="date" className="rounded-[6px]" defaultValue={input.endDate} aria-describedby={error ? "report-period-error" : undefined} />
          </div>
          <Button type="submit" className="rounded-[6px] active:scale-[0.97]">Apply</Button>
          {error ? <p id="report-period-error" role="alert" className="basis-full text-sm text-destructive">{error}</p> : null}
        </form>
      ) : null}
    </div>
  );
}

type Report = ReportsProjection;

/** The comparable window: the same weekday last week for one day, otherwise the window just before. */
function comparisonWindow(period: Report["period"]) {
  const span = Math.round((Date.parse(`${period.endDate}T00:00:00Z`) - Date.parse(`${period.startDate}T00:00:00Z`)) / 86_400_000) + 1;
  if (!(span > 0) || span > MAX_CUSTOM_DAYS) return null;
  if (span === 1) {
    const day = addBusinessDays(period.startDate, -7);
    return { startDate: day, endDate: day, label: `Same day last week (${shortDate(day)}, full day)` };
  }
  const endDate = addBusinessDays(period.startDate, -1);
  const startDate = addBusinessDays(endDate, -(span - 1));
  return { startDate, endDate, label: `Previous ${span} days (${shortDate(startDate)} to ${shortDate(endDate)})` };
}

function shortDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", weekday: "short", month: "short", day: "numeric" }).format(new Date(Date.UTC(year, month - 1, day)));
}

function change(current: number | null | undefined, previous: number | null | undefined) {
  if (current == null || previous == null) return null;
  if (previous === 0) return current === 0 ? { text: "same", tone: "flat" as const } : { text: "new", tone: "up" as const };
  const delta = Math.round(((current - previous) / Math.abs(previous)) * 100);
  if (delta === 0) return { text: "same", tone: "flat" as const };
  return { text: `${delta > 0 ? "+" : "−"}${Math.abs(delta)}%`, tone: delta > 0 ? "up" as const : "down" as const };
}

function Change({ current, previous, invert = false }: { current: number | null | undefined; previous: number | null | undefined; invert?: boolean }) {
  const result = change(current, previous);
  if (!result) return <span className="text-muted-foreground">—</span>;
  const good = result.tone === "flat" ? null : (result.tone === "up") !== invert;
  return <span className={cn("tabular-nums", good === null ? "text-muted-foreground" : good ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>{result.text}</span>;
}

function averageTicket(sales: Report["sales"]) {
  if (!sales || !sales.completedCount) return null;
  return Math.round(sales.grossSalesCents / sales.completedCount);
}

function ShareBar({ value, max }: { value: number; max: number }) {
  return (
    <span className="block h-1.5 w-full min-w-12 bg-muted" aria-hidden="true">
      <span className="block h-1.5 bg-foreground/70" style={{ width: pct(value, max) }} />
    </span>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PageContainer
      title="Analytics"
      header={<PlatformHeader title="Analytics" />}
      breadcrumbs={[{ type: "link", label: "Dashboard", href: "/dashboard" }, { type: "page", label: "Analytics" }]}
    >
      <div className="space-y-8 px-4 pb-24 md:px-6">{children}</div>
    </PageContainer>
  );
}

type LedgerRow = { label: string; current: number | null; previous: number | null; format: (value: number | null) => string; invert?: boolean };

export async function CafeReportsPage({ searchParams }: { searchParams?: Promise<SearchParams> }) {
  const params = (await searchParams) ?? {};
  const { input, error } = parsePeriod(params);
  if (error) {
    return <Shell><PeriodForm input={input} error={error} /></Shell>;
  }
  const client = (query: string, variables: Record<string, unknown>, options: RequestInit) => keystoneClient<unknown>(query, variables, options);
  const result = await loadCoffeeReports(REPORTS_QUERY, {
    period: input.period,
    startDate: input.period === "custom" ? input.startDate : null,
    endDate: input.period === "custom" ? input.endDate : null,
    lowStockPage: input.lowStockPage,
  }, client);

  if (result.kind !== "ready") {
    return (
      <Shell>
        <PeriodForm input={input} error={null} />
        <div role="alert" className="flex flex-col gap-3 rounded-[6px] border border-destructive/40 bg-destructive/5 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-0.5">
            <p className="font-medium">Analytics didn&apos;t load</p>
            <p className="text-muted-foreground">Orders and payments are not affected. Orders and Inventory still open.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild className="rounded-[6px] active:scale-[0.97]"><Link href={reportHref(input, {})}>Try again</Link></Button>
            <Button asChild variant="outline" className="rounded-[6px]"><Link href="/dashboard/platform/orders">Orders</Link></Button>
          </div>
        </div>
      </Shell>
    );
  }

  const report = result.report;
  const compareWindow = comparisonWindow(report.period);
  const previousResult = compareWindow
    ? await loadCoffeeReports(REPORTS_QUERY, { period: "custom", startDate: compareWindow.startDate, endDate: compareWindow.endDate, lowStockPage: 0 }, client)
    : null;
  const previous = previousResult?.kind === "ready" ? previousResult.report : null;

  const { sales, collections, lowStock, loyalty } = report;
  const currency = collections?.currencyCode || "USD";
  const nothingVisible = !sales && !collections && !lowStock && !loyalty;
  const mismatch = Boolean(collections?.currencyMismatch || previous?.collections?.currencyMismatch);
  const moneyOrNull = (value: number | null) => (value == null ? "—" : money(value, currency));
  const countOrNull = (value: number | null) => (value == null ? "—" : count(value));
  const hasActivity = Boolean((sales && (sales.orderCount > 0 || sales.openTicketCount > 0)) || (collections && collections.paymentCount > 0));
  const previousActivity = Boolean(previous && ((previous.sales?.orderCount ?? 0) > 0 || (previous.collections?.paymentCount ?? 0) > 0));
  const periodName = input.period === "today" ? "today" : "in this period";

  const ledger: LedgerRow[] = [];
  if (collections && !mismatch) {
    ledger.push({ label: "Net collected", current: collections.netCollectedCents, previous: previous?.collections?.netCollectedCents ?? null, format: moneyOrNull });
    ledger.push({ label: "Refunded", current: collections.refundedCents, previous: previous?.collections?.refundedCents ?? null, format: moneyOrNull, invert: true });
  }
  if (sales) {
    ledger.push({ label: "Gross sales", current: sales.grossSalesCents, previous: previous?.sales?.grossSalesCents ?? null, format: moneyOrNull });
    ledger.push({ label: "Completed orders", current: sales.completedCount, previous: previous?.sales?.completedCount ?? null, format: countOrNull });
    ledger.push({ label: "Average ticket", current: averageTicket(sales), previous: averageTicket(previous?.sales ?? null), format: moneyOrNull });
    ledger.push({ label: "Cancelled", current: sales.cancelledCount, previous: previous?.sales?.cancelledCount ?? null, format: countOrNull, invert: true });
    ledger.push({ label: "Tips", current: sales.tipCents, previous: previous?.sales?.tipCents ?? null, format: moneyOrNull });
    ledger.push({ label: "Discounts", current: sales.discountCents, previous: previous?.sales?.discountCents ?? null, format: moneyOrNull, invert: true });
    ledger.push({ label: "Tax", current: sales.taxCents, previous: previous?.sales?.taxCents ?? null, format: moneyOrNull });
    ledger.push({ label: "Avg fulfillment (min)", current: sales.averageFulfillmentMinutes, previous: previous?.sales?.averageFulfillmentMinutes ?? null, format: countOrNull, invert: true });
  }
  const headline = collections && !mismatch
    ? { label: "net collected", value: collections.netCollectedCents, previous: previous?.collections?.netCollectedCents ?? null }
    : sales ? { label: "gross sales", value: sales.grossSalesCents, previous: previous?.sales?.grossSalesCents ?? null } : null;
  const totalItemRevenue = Math.max(1, ...(sales?.topItems.map((item) => item.revenueCents) ?? []));
  const totalStation = Math.max(1, ...(sales?.stationProduction.map((station) => station.quantity) ?? []));

  return (
    <Shell>
      <div className="space-y-2">
        <PeriodForm input={input} error={null} />
        <p role="status" className="text-xs text-muted-foreground">{periodLabel(report.period)}</p>
      </div>
      {nothingVisible ? <PlatformEmpty>No analytics sections for your role.</PlatformEmpty> : null}

      {headline ? (
        <section aria-labelledby="ledger-heading" className="space-y-3">
          <h2 id="ledger-heading" className="sr-only">Sales against {compareWindow ? compareWindow.label : "the previous period"}</h2>
          <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span><span className="text-2xl font-semibold tabular-nums tracking-tight text-foreground">{headline.value == null ? "Unavailable" : money(headline.value, currency)}</span> {headline.label}</span>
            {sales ? <span className="tabular-nums">{count(sales.completedCount)} completed{averageTicket(sales) != null ? ` · ${money(averageTicket(sales), currency)} avg ticket` : ""}</span> : null}
            {previous && compareWindow ? (
              <span className="tabular-nums">
                <Change current={headline.value} previous={headline.previous} /> vs {compareWindow.label.split(" (")[0].toLowerCase()} ({headline.previous == null ? "—" : money(headline.previous, currency)})
              </span>
            ) : compareWindow ? <span>Comparison unavailable</span> : null}
          </p>
          {sales && (sales.openTicketCount || sales.readyTicketCount) ? (
            <p className="text-sm tabular-nums"><Link href="/dashboard/platform/orders" className="font-medium underline decoration-border underline-offset-4 hover:decoration-foreground">{count(sales.openTicketCount)} open tickets now, {count(sales.readyTicketCount)} ready</Link></p>
          ) : null}
          {mismatch ? <p role="alert" className="text-sm text-destructive">Payments use more than one currency; collected totals can&apos;t be combined.</p> : null}
          {collections && collections.needsReviewCount > 0 ? <p role="status" className="text-sm text-muted-foreground">{count(collections.needsReviewCount)} payments have refund details needing review; included as recorded.</p> : null}

          {hasActivity || previousActivity ? (
            <PlatformTable
              label="Sales ledger"
              className="max-w-3xl"
              head={[
                { label: "" },
                { label: input.period === "today" ? "Today" : "This period", className: "text-right" },
                { label: compareWindow ? compareWindow.label.split(" (")[0] : "Previous", className: "text-right" },
                { label: "Change", className: "text-right" },
              ]}
            >
              {ledger.map((row) => (
                <tr key={row.label}>
                  <th scope="row" className={cn(platformTd, "text-left font-normal text-muted-foreground")}>{row.label}</th>
                  <td className={cn(platformTd, "whitespace-nowrap text-right font-medium tabular-nums")}>{row.format(row.current)}</td>
                  <td className={cn(platformTd, "whitespace-nowrap text-right tabular-nums text-muted-foreground")}>{previous ? row.format(row.previous) : "—"}</td>
                  <td className={cn(platformTd, "whitespace-nowrap text-right")}>{previous ? <Change current={row.current} previous={row.previous} invert={row.invert} /> : <span className="text-muted-foreground">—</span>}</td>
                </tr>
              ))}
            </PlatformTable>
          ) : (
            <PlatformEmpty>No sales {periodName}{compareWindow && previous ? `, and none on ${compareWindow.label.split(" (")[0].toLowerCase()} either` : ""}.</PlatformEmpty>
          )}
        </section>
      ) : null}

      {sales && sales.orderCount > 0 ? (
        <div className="grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,0.6fr)]">
          <PlatformSection id="top-items-heading" title="Product mix" meta="Completed orders">
            {sales.topItems.length ? (
              <PlatformTable
                label="Top items"
                head={[
                  { label: "Item" },
                  { label: "Sold", className: "text-right" },
                  { label: "Revenue", className: "text-right" },
                  { label: <span className="sr-only">Share</span>, className: "hidden w-32 sm:table-cell" },
                ]}
              >
                {sales.topItems.map((item) => (
                  <tr key={item.key}>
                    <td className={cn(platformTd, "font-medium [overflow-wrap:anywhere]")}>{item.name}</td>
                    <td className={cn(platformTd, "whitespace-nowrap text-right tabular-nums")}>{count(item.quantity)}</td>
                    <td className={cn(platformTd, "whitespace-nowrap text-right tabular-nums")}>{money(item.revenueCents, currency)}</td>
                    <td className={cn(platformTd, "hidden align-middle sm:table-cell")}><ShareBar value={item.revenueCents} max={totalItemRevenue} /></td>
                  </tr>
                ))}
              </PlatformTable>
            ) : <PlatformEmpty>No completed orders {periodName}.</PlatformEmpty>}
            {sales.topItemsTruncated ? <p role="status" className="text-xs text-muted-foreground">Rankings use the first 5,000 price variants.</p> : null}
          </PlatformSection>

          <PlatformSection id="stations-heading" title="By station" meta="Items made">
            {sales.stationProduction.length ? (
              <PlatformTable label="Items by station" head={[{ label: "Station" }, { label: "Items", className: "text-right" }, { label: <span className="sr-only">Share</span>, className: "w-24" }]}>
                {sales.stationProduction.map((station) => (
                  <tr key={station.station}>
                    <td className={cn(platformTd, "capitalize")}>{station.station.replaceAll("_", " ")}</td>
                    <td className={cn(platformTd, "text-right tabular-nums")}>{count(station.quantity)}</td>
                    <td className={cn(platformTd, "align-middle")}><ShareBar value={station.quantity} max={totalStation} /></td>
                  </tr>
                ))}
              </PlatformTable>
            ) : <PlatformEmpty>No completed items {periodName}.</PlatformEmpty>}
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
              actions={(
                <div className="flex items-center gap-1">
                  {lowStock.page > 0 ? <Button asChild size="sm" variant="ghost" className="rounded-[6px]"><Link href={reportHref(input, { lowStockPage: lowStock.page - 1 })}>Previous</Link></Button> : null}
                  {(lowStock.page + 1) * lowStock.pageSize < lowStock.totalCount ? <Button asChild size="sm" variant="outline" className="rounded-[6px]"><Link href={reportHref(input, { lowStockPage: lowStock.page + 1 })}>Next</Link></Button> : null}
                  {lowStock.totalCount ? <Button asChild size="sm" variant="outline" className="rounded-[6px]"><Link href="/dashboard/platform/inventory">Reorder</Link></Button> : null}
                </div>
              )}
            >
              {lowStock.items.length ? (
                <PlatformTable label="Low stock" head={[{ label: "Item" }, { label: "Status" }, { label: "On hand", className: "text-right" }, { label: "Reorder at", className: "hidden text-right sm:table-cell" }]}>
                  {lowStock.items.map((item) => {
                    const out = item.currentStock <= 0;
                    return (
                      <tr key={item.id}>
                        <td className={cn(platformTd, "min-w-36")}>
                          <Link href={`/dashboard/platform/inventory/${item.id}`} className="font-medium underline-offset-4 hover:underline [overflow-wrap:anywhere]">{item.name}</Link>
                          <p className="text-xs capitalize text-muted-foreground">{item.category || "Uncategorized"} · {item.supplierName || "No supplier"}</p>
                        </td>
                        <td className={cn(platformTd, "whitespace-nowrap")}><span className="inline-flex items-center gap-2"><StatusDot tone={out ? "red" : "amber"} />{out ? "Out" : "Low"}</span></td>
                        <td className={cn(platformTd, "whitespace-nowrap text-right font-medium tabular-nums")}>{quantity(item.currentStock)} <span className="font-normal text-muted-foreground">{item.unit}</span></td>
                        <td className={cn(platformTd, "hidden whitespace-nowrap text-right tabular-nums text-muted-foreground sm:table-cell")}>{quantity(item.reorderPoint)}</td>
                      </tr>
                    );
                  })}
                </PlatformTable>
              ) : <PlatformEmpty>{lowStock.page > 0 ? "No more low-stock items." : "Nothing low on stock."}</PlatformEmpty>}
              {lowStock.items.length && (lowStock.totalCount > lowStock.pageSize || lowStock.page > 0) ? (
                <p className="text-xs tabular-nums text-muted-foreground">{count(lowStock.page * lowStock.pageSize + 1)}–{count(lowStock.page * lowStock.pageSize + lowStock.items.length)} of {count(lowStock.totalCount)}</p>
              ) : null}
            </PlatformSection>
          ) : null}

          {loyalty ? (
            <PlatformSection id="loyalty-heading" title="Rewards" meta="All time">
              <p className="text-sm tabular-nums text-muted-foreground">
                <span className="font-medium text-foreground">{count(loyalty.accountCount)}</span> accounts · <span className="font-medium text-foreground">{count(loyalty.totalVisits)}</span> visits · <span className="font-medium text-foreground">{count(loyalty.outstandingDrinkCredits)}</span> unredeemed drink credits
              </p>
              {loyalty.topAccounts.length ? (
                <PlatformTable label="Top rewards accounts" head={[{ label: "Guest" }, { label: "Lifetime pts", className: "text-right" }, { label: "Credits", className: "text-right" }, { label: "Last visit", className: "hidden md:table-cell" }]}>
                  {loyalty.topAccounts.map((account) => (
                    <tr key={account.id}>
                      <td className={cn(platformTd, "min-w-36")}>
                        <Link href={`/dashboard/platform/loyalty/${account.id}`} className="font-medium underline-offset-4 hover:underline [overflow-wrap:anywhere]">{account.customerName || account.customerEmail || "Guest account"}</Link>
                        <p className="text-xs capitalize text-muted-foreground">{(account.tier || "regular").replaceAll("_", " ")}</p>
                      </td>
                      <td className={cn(platformTd, "text-right tabular-nums")}>{count(account.lifetimePoints || 0)}</td>
                      <td className={cn(platformTd, "text-right tabular-nums")}>{count(account.drinkCredits || 0)}</td>
                      <td className={cn(platformTd, "hidden whitespace-nowrap text-muted-foreground md:table-cell")}>{formatStoreDateTime(account.lastVisitAt, report.storeTimezone)}</td>
                    </tr>
                  ))}
                </PlatformTable>
              ) : <PlatformEmpty>No rewards accounts yet.</PlatformEmpty>}
            </PlatformSection>
          ) : null}
        </div>
      ) : null}
    </Shell>
  );
}
