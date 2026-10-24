import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/features/dashboard/components/PageContainer";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { formatStoreDateTime } from "@/lib/date-time";
import { PlatformEmpty, PlatformHeader, PlatformSection } from "@/features/platform/components/PlatformPage";
import { StatusDot, StatusTitle } from "@/features/platform/components/StatusTitle";
import {
  MOVEMENT_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  PAYMENT_STATUS_TONES,
  POS_STATUS_LABELS,
  POS_STATUS_TONES,
  REGISTER_PAGE_SIZE,
  SHIFT_STATUS_LABELS,
  SHIFT_STATUS_TONES,
  formatMoney,
  formatSignedMoney,
} from "../lib/registerView";

const DETAIL_QUERY = `
  query CoffeeRegisterShiftDetail($id: ID!, $take: Int!, $movementsSkip: Int!, $receiptsSkip: Int!, $paymentsSkip: Int!, $refundsSkip: Int!) {
    getCoffeeStore { timezone currencyCode }
    registerShift(where: { id: $id }) {
      id shiftNumber registerName status openedAt closedAt
      openedBy { id name } closedBy { id name }
      openingCashCents cashSalesCents cashRefundsCents cardSalesCents cardRefundsCents tipsCents payInsCents payOutsCents
      expectedCashCents countedCashCents cashVarianceCents
    }
    cashMovements(where: { registerShift: { id: { equals: $id } } }, orderBy: [{ recordedAt: desc }], take: $take, skip: $movementsSkip) {
      id movementNumber type amountCents reason recordedAt recordedBy { id name }
    }
    movementsCount: cashMovementsCount(where: { registerShift: { id: { equals: $id } } })
    posOrders(where: { registerShift: { id: { equals: $id } } }, orderBy: [{ createdAt: desc }], take: $take, skip: $receiptsSkip) {
      id receiptNumber status totalCents tipCents createdAt closedAt cashier { id name } cafeOrder { id orderNumber }
    }
    receiptsCount: posOrdersCount(where: { registerShift: { id: { equals: $id } } })
    payments(where: { registerShift: { id: { equals: $id } } }, orderBy: [{ createdAt: desc }], take: $take, skip: $paymentsSkip) {
      id method status amount refundedAmount processedAt createdAt order { id orderNumber }
    }
    paymentsCount(where: { registerShift: { id: { equals: $id } } })
    refunds: payments(where: { refundRegisterShift: { id: { equals: $id } } }, orderBy: [{ refundedAt: desc }], take: $take, skip: $refundsSkip) {
      id method status amount refundedAmount refundedAt refundReason order { id orderNumber } registerShift { id shiftNumber }
    }
    refundsCount: paymentsCount(where: { refundRegisterShift: { id: { equals: $id } } })
  }
`;

type Person = { id: string; name: string | null } | null;
type OrderRef = { id: string; orderNumber: string | null } | null;
type DetailResult = {
  getCoffeeStore: { timezone: string; currencyCode: string } | null;
  registerShift: {
    id: string; shiftNumber: string | null; registerName: string | null; status: string | null; openedAt: string | null; closedAt: string | null;
    openedBy: Person; closedBy: Person;
    openingCashCents: number | null; cashSalesCents: number | null; cashRefundsCents: number | null; cardSalesCents: number | null;
    cardRefundsCents: number | null; tipsCents: number | null; payInsCents: number | null; payOutsCents: number | null;
    expectedCashCents: number | null; countedCashCents: number | null; cashVarianceCents: number | null;
  } | null;
  cashMovements: Array<{ id: string; movementNumber: string | null; type: string | null; amountCents: number | null; reason: string | null; recordedAt: string | null; recordedBy: Person }> | null;
  movementsCount: number | null;
  posOrders: Array<{ id: string; receiptNumber: string | null; status: string | null; totalCents: number | null; tipCents: number | null; createdAt: string | null; closedAt: string | null; cashier: Person; cafeOrder: OrderRef }> | null;
  receiptsCount: number | null;
  payments: Array<{ id: string; method: string | null; status: string | null; amount: number | null; refundedAmount: number | null; processedAt: string | null; createdAt: string | null; order: OrderRef }> | null;
  paymentsCount: number | null;
  refunds: Array<{ id: string; method: string | null; status: string | null; amount: number | null; refundedAmount: number | null; refundedAt: string | null; refundReason: string | null; order: OrderRef; registerShift: { id: string; shiftNumber: string | null } | null }> | null;
  refundsCount: number | null;
};

export type ShiftDetailPages = { movementsPage: number; receiptsPage: number; paymentsPage: number; refundsPage: number };

function detailHref(id: string, pages: ShiftDetailPages) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(pages)) if (value > 1) params.set(key, String(value));
  const query = params.toString();
  return `/dashboard/platform/register/${id}${query ? `?${query}` : ""}`;
}

function Pager({ label, page, total, href }: { label: string; page: number; total: number; href: (page: number) => string }) {
  const pageCount = Math.max(1, Math.ceil(total / REGISTER_PAGE_SIZE));
  if (pageCount <= 1) return null;
  return (
    <nav aria-label={label} className="flex items-center gap-2">
      <span className="text-sm tabular-nums text-muted-foreground">{page}/{pageCount}</span>
      {page > 1 ? <Button asChild size="sm" variant="outline" className="rounded-full"><Link href={href(page - 1)} scroll={false}>Newer</Link></Button> : null}
      {page < pageCount ? <Button asChild size="sm" variant="outline" className="rounded-full"><Link href={href(page + 1)} scroll={false}>Older</Link></Button> : null}
    </nav>
  );
}

function Fact({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-muted/60 px-3 py-2">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className={`font-semibold tabular-nums ${className || ""}`}>{children}</dd>
    </div>
  );
}

function OrderLink({ order }: { order: OrderRef }) {
  if (!order?.orderNumber) return null;
  return (
    <Link href={`/dashboard/platform/orders?search=${encodeURIComponent(order.orderNumber)}`} className="inline-flex shrink-0 items-center gap-1 font-medium hover:underline">
      #{order.orderNumber}<ArrowUpRight className="size-4" aria-hidden="true" />
    </Link>
  );
}

const rowClass = "flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-4 py-3 text-sm";

export async function RegisterShiftDetailPage({ id, pages }: { id: string; pages: ShiftDetailPages }) {
  const skip = (page: number) => (page - 1) * REGISTER_PAGE_SIZE;
  const response = await keystoneClient<DetailResult>(
    DETAIL_QUERY,
    {
      id,
      take: REGISTER_PAGE_SIZE,
      movementsSkip: skip(pages.movementsPage),
      receiptsSkip: skip(pages.receiptsPage),
      paymentsSkip: skip(pages.paymentsPage),
      refundsSkip: skip(pages.refundsPage),
    },
    { cache: "no-store" },
  );
  const data = response.success ? response.data : null;
  const shift = data?.registerShift ?? null;
  const timezone = data?.getCoffeeStore?.timezone ?? null;
  const currency = data?.getCoffeeStore?.currencyCode || "USD";
  const money = (cents?: number | null) => formatMoney(cents, currency);
  const title = shift ? `${shift.shiftNumber} · ${shift.registerName}` : "Shift";
  const breadcrumbs = [
    { type: "link" as const, label: "Dashboard", href: "/dashboard" },
    { type: "page" as const, label: "Platform" },
    { type: "link" as const, label: "Register", href: "/dashboard/platform/register" },
    { type: "page" as const, label: shift?.shiftNumber || "Shift" },
  ];

  if (!shift) {
    return (
      <PageContainer title="Shift" breadcrumbs={breadcrumbs} header={<PlatformHeader title="Shift" />}>
        <div className="px-4 pb-24 md:px-6">
          {response.success ? <PlatformEmpty>Shift not found.</PlatformEmpty> : <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">Unable to load this shift.</p>}
        </div>
      </PageContainer>
    );
  }

  const status = shift.status || "open";
  const href = (key: keyof ShiftDetailPages) => (page: number) => detailHref(shift.id, { ...pages, [key]: page });
  const header = (
    <PlatformHeader
      title={(
        <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-2">
          <span className="inline-flex min-w-0 items-center gap-2"><StatusDot tone={SHIFT_STATUS_TONES[status] || "zinc"} pulse={status === "open"} /><span className="[overflow-wrap:anywhere]">{title}</span></span>
          <span className="text-sm font-medium text-muted-foreground">{SHIFT_STATUS_LABELS[status] || status}</span>
        </span>
      )}
      meta={<>
        <span>Opened {formatStoreDateTime(shift.openedAt, timezone)}{shift.openedBy?.name ? ` · ${shift.openedBy.name}` : ""}</span>
        {shift.closedAt ? <span>Closed {formatStoreDateTime(shift.closedAt, timezone)}{shift.closedBy?.name ? ` · ${shift.closedBy.name}` : ""}</span> : null}
      </>}
      actions={status === "open" ? (
        <Button asChild className="min-h-10 rounded-full">
          <Link href="/dashboard/platform/pos">Open POS<ArrowUpRight className="size-4" aria-hidden="true" /></Link>
        </Button>
      ) : null}
    />
  );

  const movements = data?.cashMovements ?? [];
  const receipts = data?.posOrders ?? [];
  const payments = data?.payments ?? [];
  const refunds = data?.refunds ?? [];
  const variance = shift.cashVarianceCents;

  return (
    <PageContainer title={title} header={header} breadcrumbs={breadcrumbs}>
      <div className="space-y-8 px-4 pb-24 md:px-6">
        <PlatformSection id="shift-summary-heading" title="Summary">
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
            <Fact label="Opening float">{money(shift.openingCashCents)}</Fact>
            <Fact label="Cash sales">{money(shift.cashSalesCents)}</Fact>
            <Fact label="Cash refunds">{money(shift.cashRefundsCents)}</Fact>
            <Fact label="Card sales">{money(shift.cardSalesCents)}</Fact>
            <Fact label="Card refunds">{money(shift.cardRefundsCents)}</Fact>
            <Fact label="Tips">{money(shift.tipsCents)}</Fact>
            <Fact label="Pay-ins">{money(shift.payInsCents)}</Fact>
            <Fact label="Pay-outs and drops">{money(shift.payOutsCents)}</Fact>
            <Fact label="Expected cash">{money(shift.expectedCashCents)}</Fact>
            <Fact label="Counted cash">{shift.countedCashCents === null ? "—" : money(shift.countedCashCents)}</Fact>
            <Fact label="Variance" className={variance ? "text-red-600 dark:text-red-400" : undefined}>{variance === null ? "—" : formatSignedMoney(variance, currency)}</Fact>
          </dl>
        </PlatformSection>

        <PlatformSection id="shift-movements-heading" title="Cash movements" meta={data?.movementsCount ?? 0} actions={<Pager label="Cash movement pages" page={pages.movementsPage} total={data?.movementsCount ?? 0} href={href("movementsPage")} />}>
          {movements.length ? (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {movements.map((movement) => (
                <li key={movement.id} className={rowClass}>
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-medium">{MOVEMENT_LABELS[movement.type || ""] || movement.type} · {movement.movementNumber}</p>
                    {movement.reason ? <p className="text-muted-foreground [overflow-wrap:anywhere]">{movement.reason}</p> : null}
                    <p className="text-xs text-muted-foreground">{formatStoreDateTime(movement.recordedAt, timezone)}{movement.recordedBy?.name ? ` · ${movement.recordedBy.name}` : ""}</p>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums">{formatSignedMoney(movement.type === "pay_in" ? movement.amountCents : -Number(movement.amountCents || 0), currency)}</span>
                </li>
              ))}
            </ul>
          ) : <PlatformEmpty>No cash movements.</PlatformEmpty>}
        </PlatformSection>

        <PlatformSection id="shift-receipts-heading" title="POS receipts" meta={data?.receiptsCount ?? 0} actions={<Pager label="Receipt pages" page={pages.receiptsPage} total={data?.receiptsCount ?? 0} href={href("receiptsPage")} />}>
          {receipts.length ? (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {receipts.map((receipt) => {
                const receiptStatus = receipt.status || "open";
                return (
                  <li key={receipt.id} className={rowClass}>
                    <div className="min-w-0 space-y-0.5">
                      <StatusTitle as="p" tone={POS_STATUS_TONES[receiptStatus] || "zinc"} status={POS_STATUS_LABELS[receiptStatus] || receiptStatus} className="font-medium">
                        {receipt.receiptNumber} · <span className="tabular-nums">{money(receipt.totalCents)}</span>
                      </StatusTitle>
                      <p className="text-xs text-muted-foreground">
                        {formatStoreDateTime(receipt.closedAt || receipt.createdAt, timezone)}
                        {receipt.cashier?.name ? ` · ${receipt.cashier.name}` : ""}
                        {receipt.tipCents ? ` · Tip ${money(receipt.tipCents)}` : ""}
                      </p>
                    </div>
                    <OrderLink order={receipt.cafeOrder} />
                  </li>
                );
              })}
            </ul>
          ) : <PlatformEmpty>No receipts.</PlatformEmpty>}
        </PlatformSection>

        <PlatformSection id="shift-payments-heading" title="Payments" meta={data?.paymentsCount ?? 0} actions={<Pager label="Payment pages" page={pages.paymentsPage} total={data?.paymentsCount ?? 0} href={href("paymentsPage")} />}>
          {payments.length ? (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {payments.map((payment) => {
                const paymentStatus = payment.status || "pending";
                return (
                  <li key={payment.id} className={rowClass}>
                    <div className="min-w-0 space-y-0.5">
                      <StatusTitle as="p" tone={PAYMENT_STATUS_TONES[paymentStatus] || "zinc"} status={PAYMENT_STATUS_LABELS[paymentStatus] || paymentStatus} className="font-medium">
                        {PAYMENT_METHOD_LABELS[payment.method || ""] || payment.method} · <span className="tabular-nums">{money(payment.amount)}</span>
                      </StatusTitle>
                      <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        <span>{formatStoreDateTime(payment.processedAt || payment.createdAt, timezone)}</span>
                        {payment.refundedAmount ? <span className="text-rose-600 dark:text-rose-400">Refunded {money(payment.refundedAmount)}</span> : null}
                      </p>
                    </div>
                    <OrderLink order={payment.order} />
                  </li>
                );
              })}
            </ul>
          ) : <PlatformEmpty>No payments.</PlatformEmpty>}
        </PlatformSection>

        <PlatformSection id="shift-refunds-heading" title="Refunds paid out" meta={data?.refundsCount ?? 0} actions={<Pager label="Refund pages" page={pages.refundsPage} total={data?.refundsCount ?? 0} href={href("refundsPage")} />}>
          {refunds.length ? (
            <ul className="divide-y divide-border rounded-xl border border-border">
              {refunds.map((refund) => (
                <li key={refund.id} className={rowClass}>
                  <div className="min-w-0 space-y-0.5">
                    <p className="font-medium">
                      {PAYMENT_METHOD_LABELS[refund.method || ""] || refund.method} · <span className="tabular-nums text-rose-600 dark:text-rose-400">{formatSignedMoney(-Number(refund.refundedAmount || 0), currency)}</span>
                      <span className="text-muted-foreground"> of {money(refund.amount)}</span>
                    </p>
                    {refund.refundReason ? <p className="text-muted-foreground [overflow-wrap:anywhere]">{refund.refundReason}</p> : null}
                    <p className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                      <span>{formatStoreDateTime(refund.refundedAt, timezone)}</span>
                      {refund.registerShift && refund.registerShift.id !== shift.id ? (
                        <Link href={`/dashboard/platform/register/${refund.registerShift.id}`} className="hover:text-foreground hover:underline">Sale shift {refund.registerShift.shiftNumber}</Link>
                      ) : null}
                    </p>
                  </div>
                  <OrderLink order={refund.order} />
                </li>
              ))}
            </ul>
          ) : <PlatformEmpty>No refunds.</PlatformEmpty>}
        </PlatformSection>
      </div>
    </PageContainer>
  );
}
