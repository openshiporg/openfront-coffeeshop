import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/features/dashboard/components/PageContainer";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { formatStoreDateTime } from "@/lib/date-time";
import { PillLink, PillTrack } from "@/features/platform/components/PillTabs";
import { PlatformEmpty, PlatformHeader } from "@/features/platform/components/PlatformPage";
import { StatusTitle } from "@/features/platform/components/StatusTitle";
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

function ErrorNote({ children }: { children: string }) {
  return <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">{children}</p>;
}

function Pages({ state, total }: { state: RegisterListState; total: number }) {
  const pageCount = Math.max(1, Math.ceil(total / REGISTER_PAGE_SIZE));
  if (pageCount <= 1) return null;
  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center justify-between gap-2 text-sm text-muted-foreground">
      <span className="tabular-nums">Page {state.page} of {pageCount}</span>
      <div className="flex gap-2">
        {state.page > 1 ? <Button asChild size="sm" variant="outline" className="rounded-full"><Link href={registerListHref({ ...state, page: state.page - 1 })}>Previous</Link></Button> : null}
        {state.page < pageCount ? <Button asChild size="sm" variant="outline" className="rounded-full"><Link href={registerListHref({ ...state, page: state.page + 1 })}>Next</Link></Button> : null}
      </div>
    </nav>
  );
}

function ShiftCard({ shift, timezone, currency }: { shift: ShiftRow; timezone: string | null; currency: string }) {
  const status = shift.status || "open";
  const variance = shift.cashVarianceCents;
  const figures: Array<[string, string, string?]> = [
    ["Cash sales", formatMoney(shift.cashSalesCents, currency)],
    ["Card sales", formatMoney(shift.cardSalesCents, currency)],
    ["Tips", formatMoney(shift.tipsCents, currency)],
    ["Expected cash", formatMoney(shift.expectedCashCents, currency)],
    ["Counted", shift.countedCashCents === null ? "—" : formatMoney(shift.countedCashCents, currency)],
    ["Variance", variance === null ? "—" : formatSignedMoney(variance, currency), variance ? "text-red-600 dark:text-red-400" : undefined],
  ];
  return (
    <Link href={`/dashboard/platform/register/${shift.id}`} className="block min-w-0 rounded-xl border border-border bg-card p-4 shadow-xs transition-colors hover:border-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
      <StatusTitle tone={SHIFT_STATUS_TONES[status] || "zinc"} pulse={status === "open"} status={SHIFT_STATUS_LABELS[status] || status} className="text-base font-semibold tracking-tight">
        {shift.shiftNumber} · {shift.registerName}
      </StatusTitle>
      <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
        <p>Opened {formatStoreDateTime(shift.openedAt, timezone)}{shift.openedBy?.name ? ` · ${shift.openedBy.name}` : ""}</p>
        {shift.closedAt ? <p>Closed {formatStoreDateTime(shift.closedAt, timezone)}{shift.closedBy?.name ? ` · ${shift.closedBy.name}` : ""}</p> : null}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-sm sm:grid-cols-3">
        {figures.map(([label, value, className]) => (
          <div key={label} className="min-w-0">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className={`font-medium tabular-nums ${className || ""}`}>{value}</dd>
          </div>
        ))}
      </dl>
    </Link>
  );
}

function PaymentRowItem({ payment, timezone, currency }: { payment: PaymentRow; timezone: string | null; currency: string }) {
  const status = payment.status || "pending";
  return (
    <li className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 py-3 text-sm">
      <div className="min-w-0 space-y-0.5">
        <StatusTitle as="p" tone={PAYMENT_STATUS_TONES[status] || "zinc"} status={PAYMENT_STATUS_LABELS[status] || status} className="font-medium">
          {PAYMENT_METHOD_LABELS[payment.method || ""] || payment.method} · <span className="tabular-nums">{formatMoney(payment.amount, currency)}</span>
        </StatusTitle>
        <p className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          <span>{formatStoreDateTime(payment.processedAt || payment.createdAt, timezone)}</span>
          {payment.refundedAmount ? <span className="text-rose-600 dark:text-rose-400">Refunded {formatMoney(payment.refundedAmount, currency)}</span> : null}
          {payment.registerShift ? <Link href={`/dashboard/platform/register/${payment.registerShift.id}`} className="hover:text-foreground hover:underline">Shift {payment.registerShift.shiftNumber}</Link> : null}
          {payment.refundRegisterShift ? <Link href={`/dashboard/platform/register/${payment.refundRegisterShift.id}`} className="hover:text-foreground hover:underline">Refund shift {payment.refundRegisterShift.shiftNumber}</Link> : null}
        </p>
      </div>
      {payment.order?.orderNumber ? (
        <Link href={`/dashboard/platform/orders?search=${encodeURIComponent(payment.order.orderNumber)}`} className="inline-flex shrink-0 items-center gap-1 font-medium hover:underline">
          #{payment.order.orderNumber}<ArrowUpRight className="size-4" aria-hidden="true" />
        </Link>
      ) : null}
    </li>
  );
}

export async function RegisterListPage({ state }: { state: RegisterListState }) {
  const storeResponse = await keystoneClient<{ getCoffeeStore: { timezone: string; currencyCode: string } | null }>(STORE_QUERY, {}, { cache: "no-store" });
  const store = storeResponse.success ? storeResponse.data.getCoffeeStore : null;
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

  const header = (
    <PlatformHeader
      title="Register"
      actions={
        <Button asChild variant="outline" className="min-h-10 rounded-full">
          <Link href="/dashboard/platform/pos">POS<ArrowUpRight className="size-4" aria-hidden="true" /></Link>
        </Button>
      }
    />
  );

  return (
    <PageContainer
      title="Register"
      header={header}
      breadcrumbs={[{ type: "link", label: "Dashboard", href: "/dashboard" }, { type: "page", label: "Platform" }, { type: "page", label: "Register" }]}
    >
      <div className="space-y-5 px-4 pb-24 md:px-6">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav aria-label="View" className="min-w-0 max-w-full">
              <PillTrack label="View">
                <PillLink size="md" href={registerListHref({ ...state, view: "shifts", page: 1 })} active={state.view === "shifts"}>Shifts</PillLink>
                <PillLink size="md" href={registerListHref({ ...state, view: "payments", page: 1 })} active={state.view === "payments"}>Payments</PillLink>
              </PillTrack>
            </nav>
            <nav aria-label="Date range" className="min-w-0 max-w-full">
              <PillTrack label="Date range">
                {RANGE_FILTERS.map((range) => (
                  <PillLink key={range} href={registerListHref({ ...state, range, page: 1 })} active={range === state.range}>{RANGE_LABELS[range]}</PillLink>
                ))}
              </PillTrack>
            </nav>
          </div>

          {state.view === "shifts" ? (
            <nav aria-label="Shift status" className="min-w-0 max-w-full">
              <PillTrack label="Shift status">
                {SHIFT_TABS.map((tab) => (
                  <PillLink key={tab.value} href={registerListHref({ ...state, status: tab.value, page: 1 })} active={tab.value === state.status} count={shifts ? tab.count(shifts) : undefined}>{tab.label}</PillLink>
                ))}
              </PillTrack>
            </nav>
          ) : (
            <>
              <div className="flex flex-wrap items-center gap-3">
                <nav aria-label="Method" className="min-w-0 max-w-full">
                  <PillTrack label="Method">
                    {METHOD_TABS.map((tab) => (
                      <PillLink key={tab.value} href={registerListHref({ ...state, method: tab.value, page: 1 })} active={tab.value === state.method} count={payments ? tab.count(payments) : undefined}>{tab.label}</PillLink>
                    ))}
                  </PillTrack>
                </nav>
                <nav aria-label="Payment status" className="min-w-0 max-w-full">
                  <PillTrack label="Payment status">
                    {PAYMENT_STATUS_TABS.map((tab) => (
                      <PillLink key={tab.value} href={registerListHref({ ...state, paymentStatus: tab.value, page: 1 })} active={tab.value === state.paymentStatus} count={payments ? tab.count(payments) : undefined}>{tab.label}</PillLink>
                    ))}
                  </PillTrack>
                </nav>
              </div>
              <form method="get" role="search" className="flex max-w-xl items-center gap-2">
                <input type="hidden" name="view" value="payments" />
                {state.range !== "all" ? <input type="hidden" name="range" value={state.range} /> : null}
                {state.method !== "all" ? <input type="hidden" name="method" value={state.method} /> : null}
                {state.paymentStatus !== "all" ? <input type="hidden" name="paymentStatus" value={state.paymentStatus} /> : null}
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <label htmlFor="payment-search" className="sr-only">Search payments</label>
                  <Input id="payment-search" type="search" name="search" defaultValue={state.search} placeholder="Order #" className="h-10 rounded-full pl-9" />
                </div>
                <Button type="submit" variant="outline" className="h-10 rounded-full">Search</Button>
                {state.search ? <Button asChild variant="ghost" className="h-10 rounded-full"><Link href={registerListHref({ ...state, search: "", page: 1 })}>Clear</Link></Button> : null}
              </form>
            </>
          )}
        </div>

        {failed ? (
          <ErrorNote>{state.view === "shifts" ? "Unable to load shifts." : "Unable to load payments."}</ErrorNote>
        ) : shifts ? (
          shifts.registerShifts?.length ? (
            <>
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {shifts.registerShifts.map((shift) => <ShiftCard key={shift.id} shift={shift} timezone={timezone} currency={currency} />)}
              </div>
              <Pages state={state} total={shifts.filteredCount} />
            </>
          ) : <PlatformEmpty>No shifts.</PlatformEmpty>
        ) : payments ? (
          payments.payments?.length ? (
            <>
              <ul className="divide-y divide-border rounded-xl border border-border bg-card">
                {payments.payments.map((payment) => <PaymentRowItem key={payment.id} payment={payment} timezone={timezone} currency={currency} />)}
              </ul>
              <Pages state={state} total={payments.filteredCount} />
            </>
          ) : <PlatformEmpty>{state.search ? "No matching payments." : "No payments."}</PlatformEmpty>
        ) : null}
      </div>
    </PageContainer>
  );
}
