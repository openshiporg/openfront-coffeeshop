import Link from "next/link";
import { CircleDashed, Coffee, Search, Ticket } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageContainer } from "@/features/dashboard/components/PageContainer";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { formatPickupTime } from "@/lib/date-time";
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
        refundablePayments { id status method amount refundedAmount }
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
const STATUS_COLORS: Record<string, "blue" | "indigo" | "emerald" | "amber" | "orange" | "green" | "zinc" | "red" | "rose"> = {
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
  return (
    <Card className="p-4">
      <article aria-labelledby={`order-${order.id}-title`} className="space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 id={`order-${order.id}-title`} className="text-base font-semibold">#{order.orderNumber}</h3>
              <Badge color={STATUS_COLORS[order.status] || "zinc"}>{STATUS_LABELS[order.status] || order.status}</Badge>
              {order.isRush ? <Badge color="red">Rush</Badge> : null}
            </div>
            <p className="truncate text-sm text-muted-foreground">{order.pickupName || order.customerName || "Guest"}</p>
            <div className="flex flex-wrap gap-1.5">
              {fulfillment ? <Badge variant="outline">{fulfillment}</Badge> : null}
              {source ? <Badge variant="outline">{source}</Badge> : null}
              {order.paymentState ? <Badge variant="secondary">{PAYMENT_STATE_LABELS[order.paymentState] || order.paymentState}</Badge> : null}
              {order.loyaltyApplied ? <Badge variant="secondary">Rewards applied</Badge> : null}
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-sm font-medium">{order.promisedAt ? formatPickupTime(order.promisedAt, storeTimezone) : "ASAP"}</div>
            <div className="text-sm text-muted-foreground">{money(order.total)}</div>
          </div>
        </div>

        {order.orderItems?.length ? (
          <ul className="divide-y divide-border rounded-md border border-border">
            {order.orderItems.map((item) => (
              <li key={item.id} className="flex items-start justify-between gap-3 p-3">
                <div className="min-w-0">
                  <div className="text-sm font-medium">{item.quantity}× {item.itemNameSnapshot || "Menu item"}</div>
                  {item.customizationsSummary ? <div className="mt-1 text-sm text-muted-foreground">{item.customizationsSummary}</div> : null}
                </div>
                {item.barStatus ? <Badge variant="secondary" className="shrink-0">{BAR_STATUS_LABELS[item.barStatus] || item.barStatus}</Badge> : null}
              </li>
            ))}
          </ul>
        ) : null}

        {capabilities.canManagePayments && order.paymentState === "pending" ? (
          <p role="status" className="text-sm text-muted-foreground">A payment attempt is awaiting its result. A new payment cannot be recorded until it resolves.</p>
        ) : null}

        {capabilities.canManageOrders ? <OrderStatusActions orderId={order.id} actions={order.actions} /> : null}
        {capabilities.canManageOrders && order.status === "open" && order.fulfillmentType === "pickup" ? <AcceptPickupAction orderId={order.id} /> : null}
        {order.canRecordPayment ? <RecordPaymentActions orderId={order.id} total={order.total} /> : null}
        {order.refundablePayments.length ? <RefundPaymentActions payments={order.refundablePayments} /> : null}
        {order.canApplyLoyalty && order.customerEmail ? <ApplyLoyaltyAction orderId={order.id} customerEmail={order.customerEmail} customerName={order.customerName} /> : null}
      </article>
    </Card>
  );
}

function FilterLinks<T extends string>({ label, options, current, hrefFor }: { label: string; options: Array<{ value: T; label: string; count?: number }>; current: T; hrefFor: (value: T) => string }) {
  return (
    <nav aria-label={label} className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
      {options.map((option) => {
        const active = option.value === current;
        return (
          <Button key={option.value} asChild size="sm" variant={active ? "default" : "outline"} className="h-8 rounded-full">
            <Link href={hrefFor(option.value)} aria-current={active ? "page" : undefined}>
              {option.label}
              {typeof option.count === "number" ? <span className={active ? "text-primary-foreground/80" : "text-muted-foreground"}>{option.count}</span> : null}
            </Link>
          </Button>
        );
      })}
    </nav>
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
    <div className="space-y-3">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Orders</h1>
        <p className="text-sm text-muted-foreground">Online pickup, counter, and dine-in tickets for this store.</p>
      </div>
      {queue ? (
        <div className="flex flex-wrap gap-2 text-xs">
          <span className="rounded-full border border-border bg-background px-2.5 py-1">Active: {queue.summary.activeCount}</span>
          <span className="rounded-full border border-border bg-background px-2.5 py-1">Ready: {queue.summary.readyCount}</span>
          <span className="rounded-full border border-border bg-background px-2.5 py-1">Completed: {queue.summary.completedCount}</span>
        </div>
      ) : null}
    </div>
  );

  return (
    <PageContainer
      title="Orders"
      header={header}
      breadcrumbs={[{ type: "link", label: "Dashboard", href: "/dashboard" }, { type: "page", label: "Platform" }, { type: "page", label: "Orders" }]}
    >
      <OrderQueueAutoRefresh />
      <div className="space-y-6 px-4 pb-8 md:px-6">
        <div className="space-y-3 border-b border-border pb-4">
          <FilterLinks
            label="Fulfillment"
            options={FULFILLMENT_TABS}
            current={fulfillment}
            hrefFor={(value) => orderQueueHref({ ...view, fulfillment: value })}
          />
          <FilterLinks
            label="Status"
            options={STATUS_TABS.map((tab) => ({ value: tab.value, label: tab.label, count: queue ? tab.count(queue.summary) : undefined }))}
            current={status}
            hrefFor={(value) => orderQueueHref({ ...view, status: value })}
          />
          <form method="get" role="search" className="flex max-w-xl flex-col gap-2 sm:flex-row sm:items-end">
            {status !== "all" ? <input type="hidden" name="status" value={status} /> : null}
            {fulfillment !== "all" ? <input type="hidden" name="fulfillment" value={fulfillment} /> : null}
            <div className="min-w-0 flex-1 space-y-1.5">
              <Label htmlFor="order-search">Search orders</Label>
              <Input id="order-search" type="search" name="search" defaultValue={search} placeholder="Order number, pickup name, or email" />
            </div>
            <div className="flex gap-2">
              <Button type="submit">Search</Button>
              {search ? <Button asChild variant="outline"><Link href={orderQueueHref({ ...view, search: "" })}>Clear</Link></Button> : null}
            </div>
          </form>
        </div>

        {!response.success ? (
          <Alert variant="destructive" role="alert">
            <AlertTitle>Unable to load orders</AlertTitle>
            <AlertDescription>
              <p>Order tickets and counts could not be loaded. Try again.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline"><Link href={orderQueueHref(view, { activeCursor, historyCursor })}>Try again</Link></Button>
                {activeCursor || historyCursor ? <Button asChild size="sm" variant="outline"><Link href={orderQueueHref(view)}>Return to the first page</Link></Button> : null}
              </div>
            </AlertDescription>
          </Alert>
        ) : nothingMatches ? (
          search ? (
            <EmptyState title="No matching orders" description={`No orders match "${search}" in this view.`} icons={[Search, CircleDashed]} />
          ) : (
            <EmptyState title="No orders in this view" description="New online, counter, and POS orders appear here as they arrive." icons={[Ticket, Coffee]} />
          )
        ) : queue ? (
          <>
            {showActive ? (
              <section aria-labelledby="active-orders-heading" className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 id="active-orders-heading" className="text-lg font-semibold">Active orders</h2>
                    <p className="text-sm text-muted-foreground">{queue.activeCount} matching; oldest first.</p>
                  </div>
                  <nav aria-label="Active order pages" className="flex flex-wrap items-center gap-2">
                    {activeCursor ? <Button asChild size="sm" variant="outline"><Link href={orderQueueHref(view, { historyCursor })}>Return to oldest active orders</Link></Button> : null}
                    {queue.activeHasMore && queue.activeNextCursor ? <Button asChild size="sm"><Link href={orderQueueHref(view, { activeCursor: queue.activeNextCursor, historyCursor })}>Next 100 active orders</Link></Button> : null}
                  </nav>
                </div>
                {activeTickets.length ? (
                  <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                    {activeTickets.map((order) => <OrderTicketCard key={order.id} order={order} capabilities={capabilities} storeTimezone={queue.storeTimezone} />)}
                  </div>
                ) : (
                  <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    {activeCursor ? "No more matching active orders." : "No active orders match this view."}
                  </p>
                )}
              </section>
            ) : null}

            {showHistory ? (
              <section aria-labelledby="order-history-heading" className={showActive ? "space-y-4 border-t border-border pt-6" : "space-y-4"}>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <h2 id="order-history-heading" className="text-lg font-semibold">Order history</h2>
                    <p className="text-sm text-muted-foreground">{queue.historyCount} matching; newest first.</p>
                  </div>
                  <nav aria-label="Order history pages" className="flex flex-wrap items-center gap-2">
                    {historyCursor ? <Button asChild size="sm" variant="outline"><Link href={orderQueueHref(view, { activeCursor })}>Return to newest history</Link></Button> : null}
                    {queue.historyHasMore && queue.historyNextCursor ? <Button asChild size="sm"><Link href={orderQueueHref(view, { activeCursor, historyCursor: queue.historyNextCursor })}>Next 100 older orders</Link></Button> : null}
                  </nav>
                </div>
                {historyTickets.length ? (
                  <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
                    {historyTickets.map((order) => <OrderTicketCard key={order.id} order={order} capabilities={capabilities} storeTimezone={queue.storeTimezone} />)}
                  </div>
                ) : (
                  <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
                    {historyCursor ? "No more matching history orders." : "No completed, cancelled, or refunded orders match this view."}
                  </p>
                )}
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </PageContainer>
  );
}
