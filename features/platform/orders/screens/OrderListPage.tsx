import Link from "next/link";
import { Search, Zap } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/features/dashboard/components/PageContainer";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { PlatformEmpty, PlatformHeader, PlatformSection, PlatformTable, platformTd } from "@/features/platform/components/PlatformPage";
import { StatusDot, type StatusTone } from "@/features/platform/components/StatusTitle";
import { FilterSelect } from "../components/FilterSelect";
import { PickupClock } from "../components/PickupClock";
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

function orderFacts(order: CafeOrderQueueItem) {
  return [
    order.fulfillmentType ? FULFILLMENT_LABELS[order.fulfillmentType] || order.fulfillmentType : null,
    order.orderSource ? SOURCE_LABELS[order.orderSource] || order.orderSource : null,
  ].filter(Boolean) as string[];
}

function OrderItemsList({ order, showBarStatus }: { order: CafeOrderQueueItem; showBarStatus: boolean }) {
  if (!order.orderItems?.length) return <span className="text-muted-foreground">No items</span>;
  return (
    <ul className="space-y-1">
      {order.orderItems.map((item) => (
        <li key={item.id} className="flex items-baseline gap-2">
          <span className="w-6 shrink-0 tabular-nums text-muted-foreground">{item.quantity}×</span>
          <span className="min-w-0 flex-1">
            <span className="font-medium [overflow-wrap:anywhere]">{item.itemNameSnapshot || "Menu item"}</span>
            {item.customizationsSummary ? <span className="block text-xs text-muted-foreground [overflow-wrap:anywhere]">{item.customizationsSummary}</span> : null}
          </span>
          {showBarStatus && item.barStatus ? <span className="shrink-0 text-xs text-muted-foreground">{BAR_STATUS_LABELS[item.barStatus] || item.barStatus}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function OrderStatusCell({ order }: { order: CafeOrderQueueItem }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <StatusDot tone={STATUS_COLORS[order.status] || "zinc"} pulse={order.status === "open"} />
      {STATUS_LABELS[order.status] || order.status}
    </span>
  );
}

function OrderActions({ order, capabilities }: { order: CafeOrderQueueItem; capabilities: OrderQueueCapabilities }) {
  const hasActions = (capabilities.canManageOrders && (order.actions.length > 0 || (order.status === "open" && order.fulfillmentType === "pickup")))
    || order.canRecordPayment || order.refundablePayments.length > 0 || (order.canApplyLoyalty && order.customerEmail);
  const pendingPayment = capabilities.canManagePayments && order.paymentState === "pending";
  if (!hasActions && !pendingPayment) return null;
  return (
    <div className="space-y-2">
      {pendingPayment ? <p role="status" className="text-sm text-muted-foreground">Payment attempt awaiting its result.</p> : null}
      {capabilities.canManageOrders && order.status === "open" && order.fulfillmentType === "pickup" ? <AcceptPickupAction orderId={order.id} /> : null}
      {capabilities.canManageOrders ? <OrderStatusActions orderId={order.id} actions={order.actions} /> : null}
      {order.canRecordPayment ? <RecordPaymentActions orderId={order.id} total={order.total} /> : null}
      {order.refundablePayments.length ? <RefundPaymentActions payments={order.refundablePayments} /> : null}
      {order.canApplyLoyalty && order.customerEmail ? <ApplyLoyaltyAction orderId={order.id} customerEmail={order.customerEmail} customerName={order.customerName} /> : null}
    </div>
  );
}

/** One live ticket as a dense row: who and what, when it is due, status, then the next action. */
function LiveOrderRow({ order, capabilities, storeTimezone }: { order: CafeOrderQueueItem; capabilities: OrderQueueCapabilities; storeTimezone: string | null }) {
  const facts = orderFacts(order);
  const payment = order.paymentState ? PAYMENT_STATE_LABELS[order.paymentState] || order.paymentState : null;
  return (
    <li
      aria-labelledby={`order-${order.id}-title`}
      className={`grid gap-x-6 gap-y-3 px-4 py-3.5 md:grid-cols-[minmax(10rem,13rem)_minmax(0,1fr)_minmax(6.5rem,8rem)] xl:grid-cols-[minmax(10rem,13rem)_minmax(0,1fr)_minmax(6.5rem,8rem)_minmax(15rem,20rem)] ${order.isRush ? "bg-red-500/[0.04]" : ""}`}
    >
      <div className="min-w-0 space-y-1">
        <h3 id={`order-${order.id}-title`} className="flex flex-wrap items-baseline gap-x-2 text-base font-semibold tabular-nums [overflow-wrap:anywhere]">
          #{order.orderNumber}
          {order.isRush ? <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 dark:text-red-400"><Zap className="size-3" aria-hidden="true" />Rush</span> : null}
        </h3>
        <p className="text-sm font-medium [overflow-wrap:anywhere]">{order.pickupName || order.customerName || "Guest"}</p>
        <p className="text-sm"><OrderStatusCell order={order} /></p>
        <p className="text-xs text-muted-foreground">{[...facts, payment, order.loyaltyApplied ? "Rewards applied" : null].filter(Boolean).join(" · ")}</p>
      </div>
      <div className="min-w-0 text-sm">
        <OrderItemsList order={order} showBarStatus />
      </div>
      <div className="flex items-start justify-between gap-3 text-sm md:flex-col md:justify-start md:gap-1">
        <PickupClock promisedAt={order.promisedAt} storeTimezone={storeTimezone} live />
        <span className="tabular-nums text-muted-foreground">{money(order.total)}</span>
      </div>
      <div className="min-w-0 md:col-span-3 xl:col-span-1">
        <OrderActions order={order} capabilities={capabilities} />
      </div>
    </li>
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
  const pageLink = "inline-flex h-8 items-center rounded-[6px] border px-3 text-sm font-medium transition-[background-color,transform] duration-150 ease-out hover:bg-muted active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

  const header = (
    <PlatformHeader
      title="Orders"
      meta={queue ? (
        <>
          <span className="inline-flex items-center gap-1.5"><StatusDot tone="green" />Live · refreshes every 10s</span>
          <span className="tabular-nums">{queue.summary.activeCount} in queue</span>
          {queue.summary.readyCount ? <span className="tabular-nums">{queue.summary.readyCount} ready for pickup</span> : null}
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
        <form method="get" role="search" aria-label="Filter orders" className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-0 flex-[1_1_16rem] sm:max-w-sm">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <label htmlFor="order-search" className="sr-only">Search orders</label>
            <Input id="order-search" type="search" name="search" defaultValue={search} placeholder="Order #, name or email" className="h-9 rounded-[6px] pl-8" />
          </div>
          <label htmlFor="order-status" className="sr-only">Status</label>
          <FilterSelect id="order-status" name="status" defaultValue={status} className="flex-1 sm:flex-none">
            {STATUS_TABS.map((tab) => (
              <option key={tab.value} value={tab.value}>{tab.value === "all" ? "All statuses" : tab.label}{queue ? ` (${tab.count(queue.summary)})` : ""}</option>
            ))}
          </FilterSelect>
          <label htmlFor="order-fulfillment" className="sr-only">Fulfillment</label>
          <FilterSelect id="order-fulfillment" name="fulfillment" defaultValue={fulfillment} className="flex-1 sm:flex-none">
            {FULFILLMENT_TABS.map((tab) => <option key={tab.value} value={tab.value}>{tab.value === "all" ? "All channels" : tab.label}</option>)}
          </FilterSelect>
          <Button type="submit" variant="outline" size="icon" className="size-9 rounded-[6px]" aria-label="Apply filters"><Search className="size-4" aria-hidden="true" /></Button>
          {search || status !== "all" || fulfillment !== "all" ? <Link href={orderQueueHref({ search: "", status: "all", fulfillment: "all" })} className="px-1 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline">Clear</Link> : null}
        </form>

        {!response.success ? (
          <Alert variant="destructive" role="alert" className="rounded-[6px]">
            <AlertTitle>Unable to load orders</AlertTitle>
            <AlertDescription>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline" className="rounded-[6px]"><Link href={orderQueueHref(view, { activeCursor, historyCursor })}>Try again</Link></Button>
                {activeCursor || historyCursor ? <Button asChild size="sm" variant="outline" className="rounded-[6px]"><Link href={orderQueueHref(view)}>First page</Link></Button> : null}
              </div>
            </AlertDescription>
          </Alert>
        ) : nothingMatches ? (
          <PlatformEmpty>{search ? `No orders match "${search}".` : "No orders in this view."}</PlatformEmpty>
        ) : queue ? (
          <>
            {showActive ? (
              <PlatformSection
                id="active-orders-heading"
                title="Live queue"
                meta={queue.activeCount}
                actions={(
                  <nav aria-label="Active order pages" className="flex flex-wrap items-center gap-2">
                    {activeCursor ? <Link className={pageLink} href={orderQueueHref(view, { historyCursor })}>Oldest first</Link> : null}
                    {queue.activeHasMore && queue.activeNextCursor ? <Link className={pageLink} href={orderQueueHref(view, { activeCursor: queue.activeNextCursor, historyCursor })}>Next 100</Link> : null}
                  </nav>
                )}
              >
                {activeTickets.length ? (
                  <ol className="divide-y rounded-[6px] border bg-background">
                    {activeTickets.map((order) => <LiveOrderRow key={order.id} order={order} capabilities={capabilities} storeTimezone={queue.storeTimezone} />)}
                  </ol>
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
                actions={(
                  <nav aria-label="Order history pages" className="flex flex-wrap items-center gap-2">
                    {historyCursor ? <Link className={pageLink} href={orderQueueHref(view, { activeCursor })}>Newest first</Link> : null}
                    {queue.historyHasMore && queue.historyNextCursor ? <Link className={pageLink} href={orderQueueHref(view, { activeCursor, historyCursor: queue.historyNextCursor })}>Next 100</Link> : null}
                  </nav>
                )}
              >
                {historyTickets.length ? (
                  <PlatformTable
                    label="Order history"
                    className="max-md:border-0 max-md:bg-transparent max-md:[&_table]:block max-md:[&_tbody]:block max-md:[&_thead]:hidden"
                    head={[
                      { label: "Order", className: "max-md:hidden" },
                      { label: "Guest", className: "max-md:hidden" },
                      { label: "Items", className: "max-md:hidden" },
                      { label: "Channel", className: "max-md:hidden" },
                      { label: "Status", className: "max-md:hidden" },
                      { label: "Total", className: "text-right max-md:hidden" },
                      { label: <span className="sr-only">Actions</span>, className: "max-md:hidden" },
                    ]}
                  >
                    {historyTickets.map((order) => (
                      <tr key={order.id} className="max-md:mb-2 max-md:grid max-md:grid-cols-2 max-md:gap-x-3 max-md:rounded-[6px] max-md:border max-md:bg-background max-md:p-3 max-md:[&>td]:border-0 max-md:[&>td]:p-0">
                        <td className={`${platformTd} font-semibold tabular-nums whitespace-nowrap max-md:col-span-1`}>#{order.orderNumber}</td>
                        <td className={`${platformTd} max-md:text-right [overflow-wrap:anywhere]`}>{order.pickupName || order.customerName || "Guest"}</td>
                        <td className={`${platformTd} min-w-[14rem] max-md:col-span-2 max-md:min-w-0 max-md:pt-2`}><OrderItemsList order={order} showBarStatus={false} /></td>
                        <td className={`${platformTd} whitespace-nowrap text-muted-foreground max-md:pt-2`}>{orderFacts(order).join(" · ") || "—"}</td>
                        <td className={`${platformTd} max-md:pt-2 max-md:text-right`}><OrderStatusCell order={order} /></td>
                        <td className={`${platformTd} text-right tabular-nums max-md:col-span-2 max-md:pt-1`}>{money(order.total)}</td>
                        <td className={`${platformTd} max-md:col-span-2 max-md:pt-2 md:w-px md:whitespace-nowrap`}><OrderActions order={order} capabilities={capabilities} /></td>
                      </tr>
                    ))}
                  </PlatformTable>
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
