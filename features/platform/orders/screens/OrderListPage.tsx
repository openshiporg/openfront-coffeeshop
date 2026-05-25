import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { OrderStatusActions } from "../components/OrderStatusActions";

const ORDER_QUERY = `
  query CafeOrders {
    cafeOrders(orderBy: { createdAt: desc }, take: 50) {
      id
      orderNumber
      status
      fulfillmentType
      orderSource
      customerName
      pickupName
      promisedAt
      total
      isRush
      orderItems {
        id
        quantity
        itemNameSnapshot
        customizationsSummary
        barStatus
        station
        menuItem { name }
      }
    }
  }
`;

const statuses = [
  { label: "Paid", value: "paid" },
  { label: "Queue", value: "in_bar_queue" },
  { label: "Preparing", value: "preparing" },
  { label: "Ready", value: "ready" },
];

function money(cents = 0) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatPickupTime(value?: string | null) {
  if (!value) return "ASAP";
  return new Intl.DateTimeFormat("en", { hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

export async function OrderListPage() {
  const response = await keystoneClient<{ cafeOrders: any[] }>(ORDER_QUERY);
  const orders = response.success ? response.data?.cafeOrders ?? [] : [];

  const counts = statuses.map((status) => ({
    ...status,
    count: orders.filter((order) => order.status === status.value).length,
  }));

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-amber-700">Cafe command center</p>
          <h1 className="text-3xl font-semibold tracking-tight">Pickup order queue</h1>
          <p className="text-muted-foreground">Track online and counter orders from payment to handoff.</p>
        </div>
        <div className="rounded-2xl border bg-white px-4 py-3 text-sm shadow-sm">
          <span className="font-semibold">{orders.length}</span> active tickets
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {counts.map((status) => (
          <div key={status.value} className="rounded-2xl border bg-white p-4 shadow-sm">
            <div className="text-sm text-muted-foreground">{status.label}</div>
            <div className="mt-2 text-3xl font-semibold">{status.count}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
        {orders.map((order) => (
          <article key={order.id} className="rounded-3xl border bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-semibold">#{order.orderNumber}</h2>
                  {order.isRush && <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Rush</span>}
                </div>
                <p className="text-sm text-muted-foreground">{order.pickupName || order.customerName || "Guest"} · {order.fulfillmentType}</p>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium">{formatPickupTime(order.promisedAt)}</div>
                <div className="text-sm text-muted-foreground">{money(order.total)}</div>
              </div>
            </div>

            <div className="mt-4 rounded-2xl bg-amber-50 px-3 py-2 text-sm font-medium capitalize text-amber-900">{order.status.replaceAll("_", " ")}</div>

            <OrderStatusActions orderId={order.id} status={order.status} />

            <div className="mt-4 space-y-3">
              {order.orderItems?.map((item: any) => (
                <div key={item.id} className="rounded-2xl border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-medium">{item.quantity}× {item.itemNameSnapshot || item.menuItem?.name || "Menu item"}</div>
                      {item.customizationsSummary && <div className="mt-1 text-sm text-muted-foreground">{item.customizationsSummary}</div>}
                    </div>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs capitalize text-slate-700">{item.barStatus?.replaceAll("_", " ")}</span>
                  </div>
                </div>
              ))}
            </div>
          </article>
        ))}
      </div>

      {!orders.length && (
        <div className="rounded-3xl border border-dashed p-10 text-center text-muted-foreground">
          No active cafe orders yet. Seed onboarding or create a pickup order to populate the queue.
        </div>
      )}
    </div>
  );
}
