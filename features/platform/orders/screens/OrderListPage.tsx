import Link from "next/link";
import { CircleDashed, Coffee, Search, Ticket, Zap } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/features/dashboard/components/PageContainer";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { formatStaffPickupTime } from "@/lib/date-time";
import { PillLink, PillTrack } from "@/features/platform/components/PillTabs";
import { PlatformEmpty, PlatformHeader, PlatformSection } from "@/features/platform/components/PlatformPage";
import { StatusTitle, type StatusTone } from "@/features/platform/components/StatusTitle";
import { OrderQueueAutoRefresh } from "../components/OrderQueueAutoRefresh";
import { AcceptPickupAction, ApplyLoyaltyAction, OrderStatusActions, RecordPaymentActions, RefundPaymentActions } from "../components/OrderStatusActions";
import type { CafeOrderQueueItem, OrderFulfillmentFilter, OrderStatusFilter } from "../types";

const ORDER_QUERY = `
  query CoffeeOrderQueue($search: String, $status: String, $fulfillment: String, $activeCursor: String, $historyCursor: String) {
    getCoffeeOrderQueue(search: $search, status: $status, fulfillment: $fulfillment, activeCursor: $activeCursor, historyCursor: $historyCursor, includeCompleted: true) {
      summary { allCount activeCount openCount acceptedCount paidCount queuedCount preparingCount readyCount completedCount cancelledCount refundedCount }
      capabilities { canManageOrders canManagePayments canManageLoyalty }
      storeTimezone
      activeCount
      activeHasMore
      activeNextCursor
      historyCount
      historyHasMore
      historyNextCursor
      tickets {
        id orderNumber status fulfillmentType orderSource customerName customerEmail pickupName promisedAt total isRush
        paymentState canRecordPayment canApplyLoyalty loyaltyApplied
        actions { status label tone }
        orderItems { id quantity itemNameSnapshot customizationsSummary barStatus station }
        refundablePayments { id status method provider amount refundedAmount }
      }
    }
  }
`;

type OrderQueueCapabilities = { canManageOrders: boolean; canManagePayments: boolean; canManageLoyalty: boolean };
type OrderQueueSummary = {
  allCount: number; activeCount: number; openCount: number; acceptedCount: number; paidCount: number; queuedCount: number;
  preparingCount: number; readyCount: number; completedCount: number; cancelledCount: number; refundedCount: number;
};
type OrderQueueResult = {
  summary: OrderQueueSummary;
  capabilities: OrderQueueCapabilities;
  storeTimezone: string | null;
  activeCount: number;
  activeHasMore: boolean;
  activeNextCursor: string | null;
  historyCount: number;
  historyHasMore: boolean;
  historyNextCursor: string | null;
  tickets: CafeOrderQueueItem[];
};

type QueueView = { search: string; status: OrderStatusFilter; fulfillment: OrderFulfillmentFilter };

const ACTIVE_ORDER_STATUSES = new Set(["open", "accepted", "paid", "in_bar_queue", "preparing", "ready"]);
const HISTORY_ORDER_STATUSES = new Set(["completed", "refunded", "cancelled"]);

const STATUS_LABELS: Record<string, string> = {
  open: "Open request", accepted: "Accepted", paid: "Paid", in_bar_queue: "In bar queue", preparing: "Preparing",
  ready: "Ready", completed: "Completed", cancelled: "Cancelled", refunded: "Refunded",
};
const STATUS_COLORS: Record<string, StatusTone> = {
  open: "blue", accepted: "indigo", paid: "emerald", in_bar_queue: "amber", preparing: "orange",
  ready: "green", completed: "zinc", cancelled: "red", refunded: "rose",
};
const FULFILLMENT_LABELS: Record<string, string> = { pickup: "Pickup", counter: "Counter", dine_in: "Dine-in" };
const SOURCE_LABELS: Record<string, string> = { online: "Online", pos: "POS", kiosk: "Kiosk", phone: "Phone" };
const PAYMENT_STATE_LABELS: Record<string, string> = { unpaid: "Unpaid", pending: "Payment pending", paid: "Paid", refunded: "Refunded" };
const BAR_STATUS_LABELS: Record<string, string> = { new: "New", queued: "Queued", preparing: "Preparing", ready: "Ready", handed_off: "Handed off", voided: "Voided" };

const STATUS_TABS: Array<{ value: OrderStatusFilter; label: string; count: (summary: OrderQueueSummary) => number }> = [
  { value: "all", label: "All", count: (summary) => summary.allCount },
  { value: "open", label: "Open", count: (summary) => summary.openCount },
  { value: "accepted", label: "Accepted", count: (summary) => summary.acceptedCount },
  { value: "paid", label: "Paid", count: (summary) => summary.paidCount },
  { value: "in_bar_queue", label: "Queued", count: (summary) => summary.queuedCount },
  { value: "preparing", label: "Preparing", count: (summary) => summary.preparingCount },
  { value: "ready", label: "Ready", count: (summary) => summary.readyCount },
  { value: "completed", label: "Completed", count: (summary) => summary.completedCount },
  { value: "cancelled", label: "Cancelled", count: (summary) => summary.cancelledCount },
  { value: "refunded", label: "Refunded", count: (summary) => summary.refundedCount },
];
const FULFILLMENT_TABS: Array<{ value: OrderFulfillmentFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "pickup", label: "Pickup" },
  { value: "counter", label: "Counter" },
  { value: "dine_in", label: "Dine-in" },
];

function orderQueueHref(view: QueueView, cursors: { activeCursor?: string | null; historyCursor?: string | null } = {}) {
  const params = new URLSearchParams();
  if (view.search) params.set("search", view.search);
  if (view.status !== "all") params.set("status", view.status);
  if (view.fulfillment !== "all") params.set("fulfillment", view.fulfillment);
  if (cursors.activeCursor) params.set("activeCursor", cursors.activeCursor);
  if (cursors.historyCursor) params.set("historyCursor", cursors.historyCursor);
  const query = params.toString();
  return `/dashboard/platform/orders${query ? `?${query}` : ""}`;
}

function money(cents = 0) {
  return `$${(cents / 100).toFixed(2)}`;
}

function OrderTicketCard({ order, capabilities, storeTimezone }: { order: CafeOrderQueueItem; capabilities: OrderQueueCapabilities; storeTimezone: string | null }) {
  const fulfillment = order.fulfillmentType ? FULFILLMENT_LABELS[order.fulfillmentType] || order.fulfillmentType : null;
  const source = order.orderSource ? SOURCE_LABELS[order.orderSource] || order.orderSource : null;
  const live = ACTIVE_ORDER_STATUSES.has(order.status);
  const facts = [
    fulfillment,
    source,
    order.paymentState ? PAYMENT_STATE_LABELS[order.paymentState] || order.paymentState : null,
    order.loyaltyApplied ? "Rewards applied" : null,
  ].filter(Boolean);
  const hasActions = (capabilities.canManageOrders && (order.actions.length > 0 || (order.status === "open" && order.fulfillmentType === "pickup")))
    || order.canRecordPayment || order.refundablePayments.length > 0 || (order.canApplyLoyalty && order.customerEmail);
  // Phone widths: a right gutter keeps the fixed assistant button (bottom-right, 48px) off card actions at any scroll position.
  return (
    <article
      aria-labelledby={`order-${order.id}-title`}
      className={`flex min-w-0 flex-col overflow-hidden max-sm:mr-12 rounded-xl border bg-card shadow-xs ${order.isRush && live ? "border-red-500/40 ring-1 ring-red-500/20" : "border-border"}`}
    >
      <header className="flex items-start justify-between gap-3 px-4 pt-4">
        <div className="min-w-0 space-y-1">
          <StatusTitle
            id={`order-${order.id}-title`}
            tone={STATUS_COLORS[order.status] || "zinc"}
            pulse={order.status === "open"}
            status={STATUS_LABELS[order.status] || order.status}
            className="text-base font-semibold tracking-tight"
          >
            <span className="block truncate" title={`#${order.orderNumber}`}>#{order.orderNumber}</span>
          </StatusTitle>
          <p className="truncate text-sm font-medium">{order.pickupName || order.customerName || "Guest"}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className="text-sm font-semibold tabular-nums">{order.promisedAt ? formatStaffPickupTime(order.promisedAt, storeTimezone) : "ASAP"}</p>
          <p className="text-sm tabular-nums text-muted-foreground">{money(order.total)}</p>
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 pt-1.5 text-xs text-muted-foreground">
        {order.isRush ? <span className="inline-flex items-center gap-1 font-semibold text-red-600 dark:text-red-400"><Zap className="size-3" aria-hidden="true" />Rush</span> : null}
        {facts.map((fact, index) => (
          <span key={`${fact}-${index}`} className="inline-flex items-center gap-2">
            {index > 0 || order.isRush ? <span className="size-0.5 rounded-full bg-muted-foreground/60" aria-hidden="true" /> : null}
            {fact}
          </span>
        ))}
      </div>

      {order.orderItems?.length ? (
        <ul className="mx-4 mt-3 divide-y divide-dashed divide-border border-y border-dashed border-border">
          {order.orderItems.map((item) => (
            <li key={item.id} className="flex items-start justify-between gap-3 py-2">
              <div className="flex min-w-0 gap-2.5">
                <span className="w-6 shrink-0 font-mono text-sm tabular-nums text-muted-foreground">{item.quantity}×</span>
                <div className="min-w-0">
                  <p className="text-sm font-medium [overflow-wrap:anywhere]">{item.itemNameSnapshot || "Menu item"}</p>
                  {item.customizationsSummary ? <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">{item.customizationsSummary}</p> : null}
                </div>
              </div>
              {item.barStatus ? <span className="shrink-0 pt-0.5 text-xs text-muted-foreground">{BAR_STATUS_LABELS[item.barStatus] || item.barStatus}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {capabilities.canManagePayments && order.paymentState === "pending" ? (
        <p role="status" className="mx-4 mt-3 text-sm text-muted-foreground">Payment attempt awaiting its result.</p>
      ) : null}

      {hasActions ? (
        <div className="mt-auto space-y-2.5 p-4 pt-3">
          {capabilities.canManageOrders && order.status === "open" && order.fulfillmentType === "pickup" ? <AcceptPickupAction orderId={order.id} /> : null}
          {capabilities.canManageOrders ? <OrderStatusActions orderId={order.id} actions={order.actions} /> : null}
          {order.canRecordPayment ? <RecordPaymentActions orderId={order.id} total={order.total} /> : null}
          {order.refundablePayments.length ? <RefundPaymentActions payments={order.refundablePayments} /> : null}
          {order.canApplyLoyalty && order.customerEmail ? <ApplyLoyaltyAction orderId={order.id} customerEmail={order.customerEmail} customerName={order.customerName} /> : null}
        </div>
      ) : <div className="pb-4" />}
    </article>
  );
}

export async function OrderListPage({
  search = "",
  status = "all",
  fulfillment = "all",
  activeCursor = null,
  historyCursor = null,
}: {
  search?: string;
  status?: OrderStatusFilter;
  fulfillment?: OrderFulfillmentFilter;
  activeCursor?: string | null;
  historyCursor?: string | null;
}) {
  const view: QueueView = { search, status, fulfillment };
  const response = await keystoneClient<{ getCoffeeOrderQueue: OrderQueueResult }>(
    ORDER_QUERY,
    { search: search || null, status, fulfillment, activeCursor, historyCursor },
    { cache: "no-store" },
  );
  const queue = response.success ? response.data.getCoffeeOrderQueue : null;
  const capabilities = queue?.capabilities ?? { canManageOrders: false, canManagePayments: false, canManageLoyalty: false };
  const tickets = queue?.tickets ?? [];
  const activeTickets = tickets.filter((order) => ACTIVE_ORDER_STATUSES.has(order.status));
  const historyTickets = tickets.filter((order) => HISTORY_ORDER_STATUSES.has(order.status));
  const showActive = status === "all" || ACTIVE_ORDER_STATUSES.has(status);
  const showHistory = status === "all" || HISTORY_ORDER_STATUSES.has(status);
  const nothingMatches = Boolean(queue) && !tickets.length && !activeCursor && !historyCursor;

  const header = (
    <PlatformHeader
      title="Orders"
      meta={queue ? (
        <>
          <span className="inline-flex items-center gap-1.5"><span className="relative inline-flex size-2 rounded-full bg-green-500" aria-hidden="true" />Live · refreshes every 10s</span>
        </>
      ) : null}
    />
  );

  return (
    <PageContainer
      title="Orders"
      header={header}
      breadcrumbs={[{ type: "link", label: "Dashboard", href: "/dashboard" }, { type: "page", label: "Platform" }, { type: "page", label: "Orders" }]}
    >
      <OrderQueueAutoRefresh />
      {/* Bottom padding lets the last tickets scroll clear of the floating assistant button. */}
      <div className="space-y-8 px-4 pb-24 md:px-6">
        <div className="space-y-3">
          {/* Wraps instead of overflowing: fulfilment drops to its own row when both tracks don't fit. */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <nav aria-label="Status" className="min-w-0 max-w-full">
              <PillTrack label="Status">
                {STATUS_TABS.map((tab) => (
                  <PillLink key={tab.value} href={orderQueueHref({ ...view, status: tab.value })} active={tab.value === status} count={queue ? tab.count(queue.summary) : undefined}>
                    {tab.label}
                  </PillLink>
                ))}
              </PillTrack>
            </nav>
            <nav aria-label="Fulfillment" className="min-w-0 max-w-full">
              <PillTrack label="Fulfillment">
                {FULFILLMENT_TABS.map((tab) => (
                  <PillLink key={tab.value} href={orderQueueHref({ ...view, fulfillment: tab.value })} active={tab.value === fulfillment}>
                    {tab.label}
                  </PillLink>
                ))}
              </PillTrack>
            </nav>
          </div>
          <form method="get" role="search" className="flex max-w-xl items-center gap-2">
            {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
            {fulfillment !== "all" ? <input type="hidden" name="fulfillment" value={fulfillment} /> : null}
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
              <label htmlFor="order-search" className="sr-only">Search orders</label>
              <Input id="order-search" type="search" name="search" defaultValue={search} placeholder="Order #, name or email" className="h-10 rounded-full pl-9" />
            </div>
            <Button type="submit" variant="outline" className="h-10 rounded-full">Search</Button>
            {search ? <Button asChild variant="ghost" className="h-10 rounded-full"><Link href={orderQueueHref({ ...view, search: "" })}>Clear</Link></Button> : null}
          </form>
        </div>

        {!response.success ? (
          <Alert variant="destructive" role="alert">
            <AlertTitle>Unable to load orders</AlertTitle>
            <AlertDescription>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline"><Link href={orderQueueHref(view, { activeCursor, historyCursor })}>Try again</Link></Button>
                {activeCursor || historyCursor ? <Button asChild size="sm" variant="outline"><Link href={orderQueueHref(view)}>First page</Link></Button> : null}
              </div>
            </AlertDescription>
          </Alert>
        ) : nothingMatches ? (
          search ? (
            <EmptyState title="No matching orders" description={`Nothing matches "${search}".`} icons={[Search, CircleDashed]} />
          ) : (
            <EmptyState title="No orders" description="No orders in this view." icons={[Ticket, Coffee]} />
          )
        ) : queue ? (
          <>
            {showActive ? (
              <PlatformSection
                id="active-orders-heading"
                title="Live queue"
                meta={queue.activeCount}
                actions={(
                  <nav aria-label="Active order pages" className="flex flex-wrap items-center gap-2">
                    {activeCursor ? <Button asChild size="sm" variant="ghost" className="rounded-full"><Link href={orderQueueHref(view, { historyCursor })}>Oldest first</Link></Button> : null}
                    {queue.activeHasMore && queue.activeNextCursor ? <Button asChild size="sm" variant="outline" className="rounded-full"><Link href={orderQueueHref(view, { activeCursor: queue.activeNextCursor, historyCursor })}>Next 100</Link></Button> : null}
                  </nav>
                )}
              >
                {activeTickets.length ? (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {activeTickets.map((order) => <OrderTicketCard key={order.id} order={order} capabilities={capabilities} storeTimezone={queue.storeTimezone} />)}
                  </div>
                ) : (
                  <PlatformEmpty>{activeCursor ? "No more active orders." : "Queue is clear."}</PlatformEmpty>
                )}
              </PlatformSection>
            ) : null}

            {showHistory ? (
              <PlatformSection
                id="order-history-heading"
                title="History"
                meta={queue.historyCount}
                className={showActive ? "border-t border-border pt-8" : undefined}
                actions={(
                  <nav aria-label="Order history pages" className="flex flex-wrap items-center gap-2">
                    {historyCursor ? <Button asChild size="sm" variant="ghost" className="rounded-full"><Link href={orderQueueHref(view, { activeCursor })}>Newest first</Link></Button> : null}
                    {queue.historyHasMore && queue.historyNextCursor ? <Button asChild size="sm" variant="outline" className="rounded-full"><Link href={orderQueueHref(view, { activeCursor, historyCursor: queue.historyNextCursor })}>Next 100</Link></Button> : null}
                  </nav>
                )}
              >
                {historyTickets.length ? (
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {historyTickets.map((order) => <OrderTicketCard key={order.id} order={order} capabilities={capabilities} storeTimezone={queue.storeTimezone} />)}
                  </div>
                ) : (
                  <PlatformEmpty>{historyCursor ? "No more history." : "No completed, cancelled or refunded orders."}</PlatformEmpty>
                )}
              </PlatformSection>
            ) : null}
          </>
        ) : null}
      </div>
    </PageContainer>
  );
}
