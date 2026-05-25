import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

const REPORTS_QUERY = `
  query CafeReports {
    cafeOrders(orderBy: { createdAt: desc }, take: 200) {
      id
      orderNumber
      status
      fulfillmentType
      orderSource
      subtotal
      tax
      tip
      discount
      total
      createdAt
      promisedAt
      completedAt
      orderItems {
        id
        quantity
        price
        itemNameSnapshot
        station
        menuItem { id name category { id name } }
      }
    }
    inventoryItems(orderBy: { name: asc }, take: 100) {
      id
      name
      category
      unit
      currentStock
      reorderPoint
      parLevel
      costPerUnit
      supplierName
    }
    loyaltyAccounts(take: 200) {
      id
      status
      tier
      pointsBalance
      lifetimePoints
      drinkCredits
      visits
      lastVisitAt
      customer { id name email }
    }
  }
`;

type Order = {
  id: string;
  status: string;
  fulfillmentType?: string;
  orderSource?: string;
  subtotal?: number;
  tax?: number;
  tip?: number;
  discount?: number;
  total?: number;
  createdAt?: string;
  promisedAt?: string;
  completedAt?: string;
  orderItems?: Array<{
    id: string;
    quantity: number;
    price: number;
    itemNameSnapshot?: string;
    station?: string;
    menuItem?: { id: string; name: string; category?: { id: string; name: string } | null } | null;
  }>;
};

type InventoryItem = {
  id: string;
  name: string;
  category?: string;
  unit?: string;
  currentStock?: string;
  reorderPoint?: string;
  parLevel?: string;
  costPerUnit?: number;
  supplierName?: string;
};

type LoyaltyAccount = {
  id: string;
  status: string;
  tier?: string;
  pointsBalance?: number;
  lifetimePoints?: number;
  drinkCredits?: number;
  visits?: number;
  lastVisitAt?: string;
  customer?: { id: string; name?: string; email?: string } | null;
};

function money(cents = 0) {
  return `$${(Number(cents || 0) / 100).toFixed(2)}`;
}

function number(value?: number | string | null) {
  return Number(value || 0);
}

function dateLabel(value?: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value));
}

function averageMinutes(orders: Order[]) {
  const completed = orders
    .filter((order) => order.createdAt && order.completedAt)
    .map((order) => (new Date(order.completedAt!).getTime() - new Date(order.createdAt!).getTime()) / 60000)
    .filter((minutes) => Number.isFinite(minutes) && minutes >= 0);
  if (!completed.length) return 0;
  return Math.round(completed.reduce((sum, minutes) => sum + minutes, 0) / completed.length);
}

function groupBy<T>(items: T[], getKey: (item: T) => string) {
  return items.reduce<Record<string, T[]>>((groups, item) => {
    const key = getKey(item) || "Unknown";
    groups[key] = groups[key] || [];
    groups[key].push(item);
    return groups;
  }, {});
}

function pct(numerator: number, denominator: number) {
  if (!denominator) return "0%";
  return `${Math.round((numerator / denominator) * 100)}%`;
}

export async function CafeReportsPage() {
  const response = await keystoneClient<{
    cafeOrders: Order[];
    inventoryItems: InventoryItem[];
    loyaltyAccounts: LoyaltyAccount[];
  }>(REPORTS_QUERY, {}, { cache: "no-store" });

  const orders = response.success ? response.data.cafeOrders || [] : [];
  const inventoryItems = response.success ? response.data.inventoryItems || [] : [];
  const loyaltyAccounts = response.success ? response.data.loyaltyAccounts || [] : [];

  const nonCancelled = orders.filter((order) => !["cancelled", "refunded"].includes(order.status));
  const completed = orders.filter((order) => order.status === "completed");
  const active = orders.filter((order) => ["paid", "in_bar_queue", "preparing", "ready"].includes(order.status));
  const revenue = nonCancelled.reduce((sum, order) => sum + number(order.total), 0);
  const averageTicket = nonCancelled.length ? Math.round(revenue / nonCancelled.length) : 0;
  const avgFulfillment = averageMinutes(completed);

  const lineItems = orders.flatMap((order) => order.orderItems || []);
  const itemPerformance = Object.values(groupBy(lineItems, (item) => item.itemNameSnapshot || item.menuItem?.name || "Menu item"))
    .map((items) => ({
      name: items[0].itemNameSnapshot || items[0].menuItem?.name || "Menu item",
      quantity: items.reduce((sum, item) => sum + number(item.quantity), 0),
      revenue: items.reduce((sum, item) => sum + number(item.price) * number(item.quantity), 0),
    }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 8);

  const stationLoad = Object.values(groupBy(lineItems, (item) => item.station || "unassigned"))
    .map((items) => ({
      station: items[0].station || "unassigned",
      quantity: items.reduce((sum, item) => sum + number(item.quantity), 0),
    }))
    .sort((a, b) => b.quantity - a.quantity);

  const lowStock = inventoryItems
    .map((item) => ({
      ...item,
      current: number(item.currentStock),
      reorder: number(item.reorderPoint),
      par: number(item.parLevel),
    }))
    .filter((item) => item.current <= item.reorder || (item.par > 0 && item.current / item.par < 0.35))
    .sort((a, b) => a.current - b.current)
    .slice(0, 10);

  const totalVisits = loyaltyAccounts.reduce((sum, account) => sum + number(account.visits), 0);
  const outstandingCredits = loyaltyAccounts.reduce((sum, account) => sum + number(account.drinkCredits), 0);
  const topLoyalty = [...loyaltyAccounts]
    .sort((a, b) => number(b.lifetimePoints) - number(a.lifetimePoints))
    .slice(0, 6);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-amber-700">Owner toolkit</p>
          <h1 className="text-3xl font-semibold tracking-tight">Cafe reports</h1>
          <p className="text-muted-foreground">Daily health across sales, bar throughput, low stock, and loyalty.</p>
        </div>
        <div className="rounded-2xl border bg-white px-4 py-3 text-sm shadow-sm">
          Last {orders.length} orders sampled
        </div>
      </div>

      {!response.success && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Reports query failed: {response.error}
        </div>
      )}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Revenue" value={money(revenue)} note={`${nonCancelled.length} paid/non-cancelled orders`} />
        <MetricCard label="Average ticket" value={money(averageTicket)} note="Before external payment fees" />
        <MetricCard label="Active tickets" value={String(active.length)} note={`${orders.filter((order) => order.status === "ready").length} ready for pickup`} />
        <MetricCard label="Avg fulfillment" value={`${avgFulfillment}m`} note="Created to completed" />
        <MetricCard label="Completion rate" value={pct(completed.length, orders.length)} note={`${completed.length} completed`} />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.3fr_0.7fr]">
        <Panel title="Top items" description="Best sellers by gross line revenue.">
          <div className="space-y-3">
            {itemPerformance.map((item) => (
              <div key={item.name} className="grid grid-cols-[1fr_auto_auto] items-center gap-3 rounded-2xl border bg-white p-3">
                <div className="font-medium">{item.name}</div>
                <div className="text-sm text-muted-foreground">{item.quantity} sold</div>
                <div className="font-semibold">{money(item.revenue)}</div>
              </div>
            ))}
            {!itemPerformance.length && <EmptyLine text="No item sales yet." />}
          </div>
        </Panel>

        <Panel title="Station load" description="Where bar work is landing.">
          <div className="space-y-3">
            {stationLoad.map((station) => (
              <div key={station.station} className="rounded-2xl border bg-white p-3">
                <div className="mb-2 flex justify-between text-sm">
                  <span className="font-medium capitalize">{station.station.replaceAll("_", " ")}</span>
                  <span>{station.quantity} items</span>
                </div>
                <div className="h-2 rounded-full bg-stone-100">
                  <div className="h-2 rounded-full bg-amber-700" style={{ width: pct(station.quantity, Math.max(...stationLoad.map((s) => s.quantity), 1)) }} />
                </div>
              </div>
            ))}
            {!stationLoad.length && <EmptyLine text="No station activity yet." />}
          </div>
        </Panel>
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel title="Low-stock watchlist" description="Inventory at or below reorder point, or under 35% of par.">
          <div className="space-y-3">
            {lowStock.map((item) => (
              <div key={item.id} className="rounded-2xl border bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-medium">{item.name}</div>
                    <div className="mt-1 text-sm text-muted-foreground capitalize">{item.category} · {item.supplierName || "No supplier"}</div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="font-semibold">{item.current} {item.unit}</div>
                    <div className="text-muted-foreground">reorder at {item.reorder}</div>
                  </div>
                </div>
                {item.par > 0 && (
                  <div className="mt-3 h-2 rounded-full bg-stone-100">
                    <div className="h-2 rounded-full bg-red-500" style={{ width: pct(Math.min(item.current, item.par), item.par) }} />
                  </div>
                )}
              </div>
            ))}
            {!lowStock.length && <EmptyLine text="No low-stock items found." />}
          </div>
        </Panel>

        <Panel title="Loyalty pulse" description="Visits, reward liability, and top accounts.">
          <div className="mb-4 grid grid-cols-3 gap-3">
            <MiniMetric label="Accounts" value={String(loyaltyAccounts.length)} />
            <MiniMetric label="Visits" value={String(totalVisits)} />
            <MiniMetric label="Credits" value={String(outstandingCredits)} />
          </div>
          <div className="space-y-3">
            {topLoyalty.map((account) => (
              <div key={account.id} className="grid grid-cols-[1fr_auto] gap-3 rounded-2xl border bg-white p-3">
                <div>
                  <div className="font-medium">{account.customer?.name || account.customer?.email || "Guest account"}</div>
                  <div className="text-sm text-muted-foreground capitalize">{account.tier?.replaceAll("_", " ")} · last visit {dateLabel(account.lastVisitAt)}</div>
                </div>
                <div className="text-right text-sm">
                  <div className="font-semibold">{account.lifetimePoints || 0} pts</div>
                  <div className="text-muted-foreground">{account.drinkCredits || 0} credits</div>
                </div>
              </div>
            ))}
            {!topLoyalty.length && <EmptyLine text="No loyalty accounts yet." />}
          </div>
        </Panel>
      </section>
    </div>
  );
}

function MetricCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-3xl border bg-white p-5 shadow-sm">
      <div className="text-sm text-muted-foreground">{label}</div>
      <div className="mt-2 text-3xl font-semibold tracking-tight">{value}</div>
      <div className="mt-2 text-xs text-muted-foreground">{note}</div>
    </div>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-white p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold">{value}</div>
    </div>
  );
}

function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[2rem] border bg-white/60 p-5 shadow-sm">
      <div className="mb-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}

function EmptyLine({ text }: { text: string }) {
  return <div className="rounded-2xl border border-dashed p-6 text-center text-sm text-muted-foreground">{text}</div>;
}
