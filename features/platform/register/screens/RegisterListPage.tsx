import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/features/dashboard/components/PageContainer";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { formatStoreDateTime } from "@/lib/date-time";
import { PillLink, PillTrack } from "@/features/platform/components/PillTabs";
import { PlatformEmpty, PlatformHeader, PlatformTable, platformTd } from "@/features/platform/components/PlatformPage";
import { StatusDot } from "@/features/platform/components/StatusTitle";
import { FilterSelect } from "@/features/platform/orders/components/FilterSelect";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_TONES,
  RANGE_FILTERS,
  RANGE_LABELS,
  REGISTER_PAGE_SIZE,
  SHIFT_STATUS_LABELS,
  SHIFT_STATUS_TONES,
  formatMoney,
  formatSignedMoney,
  rangeStart,
  registerListHref,
  type PaymentMethodFilter,
  type PaymentStatusFilter,
  type RegisterListState,
  type ShiftStatusFilter,
} from "../lib/registerView";

const STORE_QUERY = `query CoffeeRegisterStore { getCoffeeStore { timezone currencyCode } }`;

const SHIFTS_QUERY = `
  query CoffeeRegisterShifts($where: RegisterShiftWhereInput!, $base: RegisterShiftWhereInput!, $take: Int!, $skip: Int!) {
    registerShifts(where: $where, orderBy: [{ openedAt: desc }], take: $take, skip: $skip) {
      id shiftNumber registerName status openedAt closedAt
      openedBy { id name } closedBy { id name }
      cashSalesCents cardSalesCents tipsCents expectedCashCents countedCashCents cashVarianceCents
    }
    filteredCount: registerShiftsCount(where: $where)
    allCount: registerShiftsCount(where: $base)
    openCount: registerShiftsCount(where: { AND: [$base, { status: { equals: "open" } }] })
    closedCount: registerShiftsCount(where: { AND: [$base, { status: { equals: "closed" } }] })
  }
`;

const PAYMENTS_QUERY = `
  query CoffeeRegisterPayments($where: PaymentWhereInput!, $methodBase: PaymentWhereInput!, $statusBase: PaymentWhereInput!, $take: Int!, $skip: Int!) {
    payments(where: $where, orderBy: [{ createdAt: desc }], take: $take, skip: $skip) {
      id method status amount refundedAmount processedAt refundedAt createdAt
      order { id orderNumber }
      registerShift { id shiftNumber }
      refundRegisterShift { id shiftNumber }
    }
    filteredCount: paymentsCount(where: $where)
    methodAll: paymentsCount(where: $methodBase)
    methodCash: paymentsCount(where: { AND: [$methodBase, { method: { equals: "cash" } }] })
    methodCard: paymentsCount(where: { AND: [$methodBase, { method: { equals: "card" } }] })
    statusAll: paymentsCount(where: $statusBase)
    statusCaptured: paymentsCount(where: { AND: [$statusBase, { status: { equals: "captured" } }] })
    statusRefunded: paymentsCount(where: { AND: [$statusBase, { status: { equals: "refunded" } }] })
  }
`;

type ShiftRow = {
  id: string; shiftNumber: string | null; registerName: string | null; status: string | null; openedAt: string | null; closedAt: string | null;
  openedBy: { id: string; name: string | null } | null; closedBy: { id: string; name: string | null } | null;
  cashSalesCents: number | null; cardSalesCents: number | null; tipsCents: number | null; expectedCashCents: number | null;
  countedCashCents: number | null; cashVarianceCents: number | null;
};
type ShiftsResult = { registerShifts: ShiftRow[] | null; filteredCount: number; allCount: number; openCount: number; closedCount: number };

type PaymentRow = {
  id: string; method: string | null; status: string | null; amount: number | null; refundedAmount: number | null;
  processedAt: string | null; refundedAt: string | null; createdAt: string | null;
  order: { id: string; orderNumber: string | null } | null;
  registerShift: { id: string; shiftNumber: string | null } | null;
  refundRegisterShift: { id: string; shiftNumber: string | null } | null;
};
type PaymentsResult = {
  payments: PaymentRow[] | null; filteredCount: number;
  methodAll: number; methodCash: number; methodCard: number; statusAll: number; statusCaptured: number; statusRefunded: number;
};

const SHIFT_TABS: Array<{ value: ShiftStatusFilter; label: string; count: (result: ShiftsResult) => number }> = [
  { value: "open", label: "Open", count: (result) => result.openCount },
  { value: "closed", label: "Closed", count: (result) => result.closedCount },
  { value: "all", label: "All", count: (result) => result.allCount },
];
const METHOD_TABS: Array<{ value: PaymentMethodFilter; label: string; count: (result: PaymentsResult) => number }> = [
  { value: "cash", label: "Cash", count: (result) => result.methodCash },
  { value: "card", label: "Card", count: (result) => result.methodCard },
  { value: "all", label: "All", count: (result) => result.methodAll },
];
const PAYMENT_STATUS_TABS: Array<{ value: PaymentStatusFilter; label: string; count: (result: PaymentsResult) => number }> = [
  { value: "all", label: "Any status", count: (result) => result.statusAll },
  { value: "captured", label: "Captured", count: (result) => result.statusCaptured },
  { value: "refunded", label: "Refunded", count: (result) => result.statusRefunded },
];

function and(...parts: Array<Record<string, unknown> | null>) {
  return { AND: parts.filter((part): part is Record<string, unknown> => part !== null) };
}

const CURRENT_QUERY = `
  query CoffeeRegisterCurrent {
    open: registerShifts(where: { status: { equals: "open" } }, orderBy: [{ openedAt: desc }], take: 1) {
      id shiftNumber registerName status openedAt openedBy { id name }
      openingCashCents cashSalesCents cardSalesCents tipsCents expectedCashCents
    }
    lastClosed: registerShifts(where: { status: { equals: "closed" } }, orderBy: [{ openedAt: desc }], take: 1) {
      id shiftNumber registerName closedAt closedBy { id name } expectedCashCents countedCashCents cashVarianceCents
    }
  }
`;
type CurrentResult = {
  open: Array<{ id: string; shiftNumber: string | null; registerName: string | null; openedAt: string | null; openedBy: { id: string; name: string | null } | null; openingCashCents: number | null; cashSalesCents: number | null; cardSalesCents: number | null; tipsCents: number | null; expectedCashCents: number | null }> | null;
  lastClosed: Array<{ id: string; shiftNumber: string | null; registerName: string | null; closedAt: string | null; closedBy: { id: string; name: string | null } | null; expectedCashCents: number | null; countedCashCents: number | null; cashVarianceCents: number | null }> | null;
};

const linkButton = "inline-flex h-9 items-center justify-center gap-1.5 rounded-[6px] px-3.5 text-sm font-medium transition-[background-color,opacity,transform] duration-150 ease-out active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";
const primaryLink = `${linkButton} bg-foreground text-background hover:opacity-90`;
const outlineLink = `${linkButton} border bg-background hover:bg-muted`;

function varianceClass(cents: number | null | undefined) {
  return cents ? "font-semibold text-red-600 dark:text-red-400" : "";
}

function ErrorNote({ children }: { children: string }) {
  return <p role="alert" className="rounded-[6px] border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{children}</p>;
}

function Pages({ state, total }: { state: RegisterListState; total: number }) {
  const pageCount = Math.max(1, Math.ceil(total / REGISTER_PAGE_SIZE));
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <span className="tabular-nums">Page {state.page} of {pageCount}</span>
      <div className="flex gap-2">
        {state.page > 1 ? <Link className={outlineLink} href={registerListHref({ ...state, page: state.page - 1 })}>Previous</Link> : null}
        {state.page < pageCount ? <Link className={outlineLink} href={registerListHref({ ...state, page: state.page + 1 })}>Next</Link> : null}
      </div>
    </nav>
  );
}

function CurrentShift({ current, failed, timezone, currency }: { current: CurrentResult | null; failed: boolean; timezone: string | null; currency: string }) {
  if (failed || !current) return <ErrorNote>Current shift unavailable.</ErrorNote>;
  const open = current.open?.[0] ?? null;
  const last = current.lastClosed?.[0] ?? null;
  const figure = (label: string, value: string, className = "") => (
    <div className="min-w-0 bg-background px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`font-semibold tabular-nums ${className}`}>{value}</dd>
    </div>
  );
  return (
    <section aria-labelledby="current-shift-heading" className="overflow-hidden rounded-[6px] border bg-card">
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <h2 id="current-shift-heading" className="flex flex-wrap items-center gap-x-2 text-base font-semibold">
            <StatusDot tone={open ? "green" : "zinc"} />
            {open ? <>Shift open<span className="font-normal text-muted-foreground [overflow-wrap:anywhere]">· {open.registerName} · {open.shiftNumber}</span></> : "Register closed"}
          </h2>
          <p className="text-sm text-muted-foreground">
            {open
              ? <>Opened {formatStoreDateTime(open.openedAt, timezone)}{open.openedBy?.name ? ` · ${open.openedBy.name}` : ""}</>
              : last ? <>Last closed {formatStoreDateTime(last.closedAt, timezone)}{last.closedBy?.name ? ` · ${last.closedBy.name}` : ""}</> : "No shifts yet"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {open ? (
            <>
              <Link href="/dashboard/platform/pos#drawer" className={primaryLink}>Close shift</Link>
              <Link href={`/dashboard/platform/register/${open.id}`} className={outlineLink}>Shift detail</Link>
            </>
          ) : (
            <Link href="/dashboard/platform/pos" className={primaryLink}>Open shift</Link>
          )}
        </div>
      </div>
      {open ? (
        <dl className="grid grid-cols-2 gap-px border-t bg-border text-sm sm:grid-cols-4">
          {figure("Expected cash", formatMoney(open.expectedCashCents, currency))}
          {figure("Opening float", formatMoney(open.openingCashCents, currency))}
          {figure("Cash sales", formatMoney(open.cashSalesCents, currency))}
          {figure("Card sales", formatMoney(open.cardSalesCents, currency))}
        </dl>
      ) : last ? (
        <dl className="grid grid-cols-3 gap-px border-t bg-border text-sm">
          {figure("Expected", formatMoney(last.expectedCashCents, currency))}
          {figure("Counted", last.countedCashCents === null ? "—" : formatMoney(last.countedCashCents, currency))}
          {figure("Variance", last.cashVarianceCents === null ? "—" : formatSignedMoney(last.cashVarianceCents, currency), varianceClass(last.cashVarianceCents))}
        </dl>
      ) : null}
    </section>
  );
}

const stackRow = "max-md:mb-2 max-md:grid max-md:grid-cols-2 max-md:gap-x-3 max-md:gap-y-1 max-md:rounded-[6px] max-md:border max-md:bg-background max-md:p-3 max-md:[&>td]:border-0 max-md:[&>td]:p-0";
const stackTable = "max-md:border-0 max-md:bg-transparent max-md:[&_table]:block max-md:[&_tbody]:block max-md:[&_thead]:hidden";

function ShiftsTable({ rows, timezone, currency }: { rows: ShiftRow[]; timezone: string | null; currency: string }) {
  return (
    <PlatformTable
      label="Register shifts"
      className={stackTable}
      head={[
        { label: "Shift" }, { label: "Status" }, { label: "Opened" }, { label: "Closed" },
        { label: "Cash sales", className: "text-right" }, { label: "Card sales", className: "text-right" },
        { label: "Expected", className: "text-right" }, { label: "Counted", className: "text-right" }, { label: "Variance", className: "text-right" },
      ]}
    >
      {rows.map((shift) => {
        const status = shift.status || "open";
        return (
          <tr key={shift.id} className={`${stackRow} md:hover:bg-muted/30`}>
            <td className={`${platformTd} min-w-[10rem]`}>
              <Link href={`/dashboard/platform/register/${shift.id}`} className="font-semibold tabular-nums underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{shift.shiftNumber}</Link>
              <span className="block text-xs text-muted-foreground [overflow-wrap:anywhere]">{shift.registerName}</span>
            </td>
            <td className={`${platformTd} whitespace-nowrap max-md:text-right`}>
              <span className="inline-flex items-center gap-1.5"><StatusDot tone={SHIFT_STATUS_TONES[status] || "zinc"} pulse={status === "open"} />{SHIFT_STATUS_LABELS[status] || status}</span>
            </td>
            <td className={`${platformTd} whitespace-nowrap text-muted-foreground max-md:col-span-2 max-md:whitespace-normal max-md:text-xs`}>
              <span className="md:hidden">Opened </span>{formatStoreDateTime(shift.openedAt, timezone)}
              {shift.openedBy?.name ? <span className="block text-xs">{shift.openedBy.name}</span> : null}
            </td>
            <td className={`${platformTd} whitespace-nowrap text-muted-foreground max-md:col-span-2 max-md:whitespace-normal max-md:text-xs`}>
              {shift.closedAt ? <><span className="md:hidden">Closed </span>{formatStoreDateTime(shift.closedAt, timezone)}{shift.closedBy?.name ? <span className="block text-xs">{shift.closedBy.name}</span> : null}</> : <span className="max-md:hidden">—</span>}
            </td>
            <td className={`${platformTd} text-right tabular-nums max-md:text-left`}><span className="text-xs text-muted-foreground md:hidden">Cash </span>{formatMoney(shift.cashSalesCents, currency)}</td>
            <td className={`${platformTd} text-right tabular-nums`}><span className="text-xs text-muted-foreground md:hidden">Card </span>{formatMoney(shift.cardSalesCents, currency)}</td>
            <td className={`${platformTd} text-right tabular-nums max-md:text-left`}><span className="text-xs text-muted-foreground md:hidden">Expected </span>{formatMoney(shift.expectedCashCents, currency)}</td>
            <td className={`${platformTd} text-right tabular-nums`}><span className="text-xs text-muted-foreground md:hidden">Counted </span>{shift.countedCashCents === null ? "—" : formatMoney(shift.countedCashCents, currency)}</td>
            <td className={`${platformTd} text-right tabular-nums max-md:col-span-2 ${varianceClass(shift.cashVarianceCents)}`}><span className="text-xs font-normal text-muted-foreground md:hidden">Variance </span>{shift.cashVarianceCents === null ? "—" : formatSignedMoney(shift.cashVarianceCents, currency)}</td>
          </tr>
        );
      })}
    </PlatformTable>
  );
}

function PaymentsTable({ rows, timezone, currency }: { rows: PaymentRow[]; timezone: string | null; currency: string }) {
  return (
    <PlatformTable
      label="Payments"
      className={stackTable}
      head={[{ label: "Time" }, { label: "Order" }, { label: "Method" }, { label: "Status" }, { label: "Amount", className: "text-right" }, { label: "Refunded", className: "text-right" }, { label: "Shift" }]}
    >
      {rows.map((payment) => {
        const status = payment.status || "pending";
        return (
          <tr key={payment.id} className={stackRow}>
            <td className={`${platformTd} whitespace-nowrap text-muted-foreground max-md:col-span-2 max-md:text-xs`}>{formatStoreDateTime(payment.processedAt || payment.createdAt, timezone)}</td>
            <td className={`${platformTd} whitespace-nowrap`}>
              {payment.order?.orderNumber ? (
                <Link href={`/dashboard/platform/orders?search=${encodeURIComponent(payment.order.orderNumber)}`} className="inline-flex items-center gap-1 font-semibold tabular-nums underline-offset-4 hover:underline">
                  #{payment.order.orderNumber}<ArrowUpRight className="size-3.5" aria-hidden="true" />
                </Link>
              ) : "—"}
            </td>
            <td className={`${platformTd} max-md:text-right`}>{PAYMENT_METHOD_LABELS[payment.method || ""] || payment.method}</td>
            <td className={`${platformTd} whitespace-nowrap`}>
              <span className="inline-flex items-center gap-1.5"><StatusDot tone={PAYMENT_STATUS_TONES[status] || "zinc"} />{PAYMENT_STATUS_LABELS[status] || status}</span>
            </td>
            <td className={`${platformTd} text-right font-medium tabular-nums`}>{formatMoney(payment.amount, currency)}</td>
            <td className={`${platformTd} text-right tabular-nums max-md:col-span-2 ${payment.refundedAmount ? "text-rose-600 dark:text-rose-400" : "text-muted-foreground max-md:hidden"}`}>
              {payment.refundedAmount ? <><span className="md:hidden">Refunded </span>{formatMoney(payment.refundedAmount, currency)}</> : "—"}
            </td>
            <td className={`${platformTd} whitespace-nowrap text-sm max-md:col-span-2`}>
              {payment.registerShift ? <Link href={`/dashboard/platform/register/${payment.registerShift.id}`} className="tabular-nums underline-offset-4 hover:underline">{payment.registerShift.shiftNumber}</Link> : <span className="text-muted-foreground">—</span>}
              {payment.refundRegisterShift ? <Link href={`/dashboard/platform/register/${payment.refundRegisterShift.id}`} className="block text-xs text-muted-foreground underline-offset-4 hover:underline">Refund {payment.refundRegisterShift.shiftNumber}</Link> : null}
            </td>
          </tr>
        );
      })}
    </PlatformTable>
  );
}

export async function RegisterListPage({ state }: { state: RegisterListState }) {
  const [storeResponse, currentResponse] = await Promise.all([
    keystoneClient<{ getCoffeeStore: { timezone: string; currencyCode: string } | null }>(STORE_QUERY, {}, { cache: "no-store" }),
    keystoneClient<CurrentResult>(CURRENT_QUERY, {}, { cache: "no-store" }),
  ]);
  const store = storeResponse.success ? storeResponse.data.getCoffeeStore : null;
  const current = currentResponse.success ? currentResponse.data : null;
  const timezone = store?.timezone ?? null;
  const currency = store?.currencyCode || "USD";
  const since = rangeStart(state.range, timezone);
  const skip = (state.page - 1) * REGISTER_PAGE_SIZE;

  let shifts: ShiftsResult | null = null;
  let payments: PaymentsResult | null = null;
  let failed = false;
  if (state.view === "shifts") {
    const base = and(since ? { openedAt: { gte: since.toISOString() } } : null);
    const where = state.status === "all" ? base : and(base, { status: { equals: state.status } });
    const response = await keystoneClient<ShiftsResult>(SHIFTS_QUERY, { where, base, take: REGISTER_PAGE_SIZE, skip }, { cache: "no-store" });
    if (response.success) shifts = response.data; else failed = true;
  } else {
    const range = since ? { createdAt: { gte: since.toISOString() } } : null;
    const search = state.search ? { order: { orderNumber: { contains: state.search, mode: "insensitive" } } } : null;
    const method = state.method !== "all" ? { method: { equals: state.method } } : null;
    const status = state.paymentStatus !== "all" ? { status: { equals: state.paymentStatus } } : null;
    const response = await keystoneClient<PaymentsResult>(
      PAYMENTS_QUERY,
      { where: and(range, search, method, status), methodBase: and(range, search, status), statusBase: and(range, search, method), take: REGISTER_PAGE_SIZE, skip },
      { cache: "no-store" },
    );
    if (response.success) payments = response.data; else failed = true;
  }

  const openShift = current?.open?.[0] ?? null;
  const header = (
    <PlatformHeader
      title="Register"
      meta={current ? <span className="inline-flex items-center gap-1.5"><StatusDot tone={openShift ? "green" : "zinc"} />{openShift ? "Shift open" : "Closed"}</span> : null}
      actions={<Link href="/dashboard/platform/pos" className={outlineLink}>POS<ArrowUpRight className="size-4" aria-hidden="true" /></Link>}
    />
  );

  return (
    <PageContainer
      title="Register"
      header={header}
      breadcrumbs={[{ type: "link", label: "Dashboard", href: "/dashboard" }, { type: "page", label: "Platform" }, { type: "page", label: "Register" }]}
    >
      <div className="space-y-6 px-4 pb-24 md:px-6">
        <CurrentShift current={current} failed={!currentResponse.success} timezone={timezone} currency={currency} />

        <div className="space-y-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <nav aria-label="View" className="min-w-0 max-w-full">
              <PillTrack label="View">
                <PillLink size="md" href={registerListHref({ ...state, view: "shifts", page: 1 })} active={state.view === "shifts"}>Shifts</PillLink>
                <PillLink size="md" href={registerListHref({ ...state, view: "payments", page: 1 })} active={state.view === "payments"}>Payments</PillLink>
              </PillTrack>
            </nav>
            <form method="get" role="search" aria-label={state.view === "shifts" ? "Filter shifts" : "Filter payments"} className="relative flex flex-wrap items-center gap-2 [overflow-x:clip] [overflow-clip-margin:4px]">
              {state.view === "payments" ? <input type="hidden" name="view" value="payments" /> : null}
              {state.view === "payments" ? (
                <div className="relative min-w-0 flex-[1_1_10rem] sm:w-44 sm:flex-none">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <label htmlFor="payment-search" className="sr-only">Search payments</label>
                  <Input id="payment-search" type="search" name="search" defaultValue={state.search} placeholder="Order #" className="h-9 rounded-[6px] pl-8" />
                </div>
              ) : null}
              <label htmlFor="register-range" className="sr-only">Date range</label>
              <FilterSelect id="register-range" name="range" defaultValue={state.range}>
                {RANGE_FILTERS.map((range) => <option key={range} value={range}>{RANGE_LABELS[range]}</option>)}
              </FilterSelect>
              {state.view === "shifts" ? (
                <>
                  <label htmlFor="register-status" className="sr-only">Shift status</label>
                  <FilterSelect id="register-status" name="status" defaultValue={state.status}>
                    {SHIFT_TABS.map((tab) => <option key={tab.value} value={tab.value}>{tab.value === "all" ? "All shifts" : tab.label}{shifts ? ` (${tab.count(shifts)})` : ""}</option>)}
                  </FilterSelect>
                </>
              ) : (
                <>
                  <label htmlFor="register-method" className="sr-only">Method</label>
                  <FilterSelect id="register-method" name="method" defaultValue={state.method}>
                    {METHOD_TABS.map((tab) => <option key={tab.value} value={tab.value}>{tab.value === "all" ? "All methods" : tab.label}{payments ? ` (${tab.count(payments)})` : ""}</option>)}
                  </FilterSelect>
                  <label htmlFor="register-payment-status" className="sr-only">Payment status</label>
                  <FilterSelect id="register-payment-status" name="paymentStatus" defaultValue={state.paymentStatus}>
                    {PAYMENT_STATUS_TABS.map((tab) => <option key={tab.value} value={tab.value}>{tab.label}{payments ? ` (${tab.count(payments)})` : ""}</option>)}
                  </FilterSelect>
                </>
              )}
              <Button type="submit" variant="outline" size="icon" className="size-9 rounded-[6px]" aria-label="Apply filters"><Search className="size-4" aria-hidden="true" /></Button>
              {state.search ? <Link href={registerListHref({ ...state, search: "", page: 1 })} className="px-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Clear</Link> : null}
            </form>
          </div>
        </div>

        {failed ? (
          <ErrorNote>{state.view === "shifts" ? "Unable to load shifts." : "Unable to load payments."}</ErrorNote>
        ) : shifts ? (
          shifts.registerShifts?.length ? (
            <>
              <ShiftsTable rows={shifts.registerShifts} timezone={timezone} currency={currency} />
              <Pages state={state} total={shifts.filteredCount} />
            </>
          ) : <PlatformEmpty>No shifts.</PlatformEmpty>
        ) : payments ? (
          payments.payments?.length ? (
            <>
              <PaymentsTable rows={payments.payments} timezone={timezone} currency={currency} />
              <Pages state={state} total={payments.filteredCount} />
            </>
          ) : <PlatformEmpty>{state.search ? "No matching payments." : "No payments."}</PlatformEmpty>
        ) : null}
      </div>
    </PageContainer>
  );
}
