import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/features/dashboard/components/PageContainer";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { formatStoreDateTime } from "@/lib/date-time";
import { PlatformEmpty, PlatformHeader, PlatformSection } from "@/features/platform/components/PlatformPage";
import { StatusDot, StatusTitle, type StatusTone } from "@/features/platform/components/StatusTitle";
import { LoyaltyAccountActions } from "../components/LoyaltyAccountActions";
import {
  LOYALTY_DETAIL_PAGE_SIZE,
  LOYALTY_EVENT_LABELS,
  LOYALTY_STATUS_LABELS,
  LOYALTY_STATUS_TONES,
  LOYALTY_TIER_LABELS,
  formatMoney,
  formatSigned,
} from "../lib/loyaltyView";

const DETAIL_QUERY = `
  query CoffeeLoyaltyAccountDetail($id: ID!, $take: Int!, $eventsSkip: Int!, $ordersSkip: Int!) {
    authenticatedItem { ... on User { id role { canManageLoyalty } } }
    getCoffeeStore { timezone currencyCode }
    loyaltyAccount(where: { id: $id }) {
      id displayName customerName customerEmail customerPhone marketingOptIn status tier
      pointsBalance lifetimePoints drinkCredits visits lastVisitAt firstVisitAt notes createdAt
      customer { id name email phone }
      ordersCount
      orders(orderBy: [{ createdAt: desc }], take: $take, skip: $ordersSkip) { id orderNumber status total createdAt }
      eventsCount
      events(orderBy: [{ createdAt: desc }], take: $take, skip: $eventsSkip) {
        id type pointsDelta drinkCreditsDelta note createdAt
        order { id orderNumber }
        createdBy { id name }
      }
    }
    subscriptions(where: { loyaltyAccount: { id: { equals: $id } } }, orderBy: [{ createdAt: desc }], take: 50) {
      id subscriptionNumber planName status billingInterval priceCents renewsAt
    }
  }
`;

type DetailResult = {
  authenticatedItem: { id: string; role: { canManageLoyalty: boolean | null } | null } | null;
  getCoffeeStore: { timezone: string; currencyCode: string } | null;
  loyaltyAccount: {
    id: string; displayName: string | null; customerName: string | null; customerEmail: string | null; customerPhone: string | null;
    marketingOptIn: boolean | null; status: string | null; tier: string | null; pointsBalance: number | null; lifetimePoints: number | null;
    drinkCredits: number | null; visits: number | null; lastVisitAt: string | null; firstVisitAt: string | null; notes: string | null; createdAt: string | null;
    customer: { id: string; name: string | null; email: string | null; phone: string | null } | null;
    ordersCount: number | null;
    orders: Array<{ id: string; orderNumber: string | null; status: string | null; total: number | null; createdAt: string | null }> | null;
    eventsCount: number | null;
    events: Array<{
      id: string; type: string | null; pointsDelta: number | null; drinkCreditsDelta: number | null; note: string | null; createdAt: string | null;
      order: { id: string; orderNumber: string | null } | null; createdBy: { id: string; name: string | null } | null;
    }> | null;
  } | null;
  subscriptions: Array<{ id: string; subscriptionNumber: string | null; planName: string | null; status: string | null; billingInterval: string | null; priceCents: number | null; renewsAt: string | null }> | null;
};

const ORDER_STATUS_LABELS: Record<string, string> = {
  open: "Open", accepted: "Accepted", paid: "Paid", in_bar_queue: "In bar queue", preparing: "Preparing",
  ready: "Ready", completed: "Completed", cancelled: "Cancelled", refunded: "Refunded",
};
const SUBSCRIPTION_STATUS: Record<string, { label: string; tone: StatusTone }> = {
  trialing: { label: "Trialing", tone: "blue" },
  active: { label: "Active", tone: "green" },
  paused: { label: "Paused", tone: "amber" },
  cancelled: { label: "Cancelled", tone: "zinc" },
};
const INTERVAL_LABELS: Record<string, string> = { weekly: "Weekly", monthly: "Monthly" };

function detailHref(id: string, pages: { eventsPage: number; ordersPage: number }) {
  const params = new URLSearchParams();
  if (pages.eventsPage > 1) params.set("eventsPage", String(pages.eventsPage));
  if (pages.ordersPage > 1) params.set("ordersPage", String(pages.ordersPage));
  const query = params.toString();
  return `/dashboard/platform/loyalty/${id}${query ? `?${query}` : ""}`;
}

function Pager({ label, page, total, href }: { label: string; page: number; total: number; href: (page: number) => string }) {
  const pageCount = Math.max(1, Math.ceil(total / LOYALTY_DETAIL_PAGE_SIZE));
  if (pageCount <= 1) return null;
  return (
    <nav aria-label={label} className="flex items-center gap-2">
      <span className="text-sm tabular-nums text-muted-foreground">{page}/{pageCount}</span>
      {page > 1 ? <Button asChild size="sm" variant="outline" className="rounded-[6px]"><Link href={href(page - 1)} scroll={false}>Newer</Link></Button> : null}
      {page < pageCount ? <Button asChild size="sm" variant="outline" className="rounded-[6px]"><Link href={href(page + 1)} scroll={false}>Older</Link></Button> : null}
    </nav>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 bg-background px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-semibold tabular-nums [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

function deltaClass(value?: number | null) {
  const amount = Number(value || 0);
  return amount > 0 ? "text-emerald-600 dark:text-emerald-400" : amount < 0 ? "text-red-600 dark:text-red-400" : "text-muted-foreground";
}

export async function LoyaltyDetailPage({ id, eventsPage, ordersPage, adjust = false }: { id: string; eventsPage: number; ordersPage: number; adjust?: boolean }) {
  const response = await keystoneClient<DetailResult>(
    DETAIL_QUERY,
    { id, take: LOYALTY_DETAIL_PAGE_SIZE, eventsSkip: (eventsPage - 1) * LOYALTY_DETAIL_PAGE_SIZE, ordersSkip: (ordersPage - 1) * LOYALTY_DETAIL_PAGE_SIZE },
    { cache: "no-store" },
  );
  const data = response.success ? response.data : null;
  const account = data?.loyaltyAccount ?? null;
  const timezone = data?.getCoffeeStore?.timezone ?? null;
  const currency = data?.getCoffeeStore?.currencyCode || "USD";
  const canManage = Boolean(data?.authenticatedItem?.role?.canManageLoyalty);
  const title = account?.displayName || "Rewards account";
  const status = account?.status || "active";
  const breadcrumbs = [
    { type: "link" as const, label: "Dashboard", href: "/dashboard" },
    { type: "page" as const, label: "Platform" },
    { type: "link" as const, label: "Rewards", href: "/dashboard/platform/loyalty" },
    { type: "page" as const, label: title },
  ];

  if (!account) {
    return (
      <PageContainer title="Rewards account" breadcrumbs={breadcrumbs} header={<PlatformHeader title="Rewards account" />}>
        <div className="px-4 pb-24 md:px-6">
          {response.success ? <PlatformEmpty>Account not found.</PlatformEmpty> : <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-destructive/40 bg-destructive/5 p-4 text-sm"><div className="space-y-0.5"><p className="font-medium">This account didn&apos;t load</p><p className="text-muted-foreground">Nothing was changed.</p></div><Button asChild variant="outline" className="rounded-[6px]"><Link href={`/dashboard/platform/loyalty/${id}`}>Try again</Link></Button></div>}
        </div>
      </PageContainer>
    );
  }

  const header = (
    <PlatformHeader
      title={
        <span className="inline-flex min-w-0 flex-wrap items-baseline gap-x-2">
          <span className="inline-flex min-w-0 items-center gap-2"><StatusDot tone={LOYALTY_STATUS_TONES[status] || "zinc"} /><span className="[overflow-wrap:anywhere]">{title}</span></span>
          <span className="text-sm font-medium text-muted-foreground">{LOYALTY_STATUS_LABELS[status] || status}</span>
        </span>
      }
      meta={<>
        {account.customerEmail ? <span className="[overflow-wrap:anywhere]">{account.customerEmail}</span> : null}
        <span>{LOYALTY_TIER_LABELS[account.tier || "regular"] || account.tier}</span>
      </>}
      actions={
        <LoyaltyAccountActions
          canManage={canManage}
          autoOpenAdjust={adjust}
          account={{ id: account.id, displayName: title, status, tier: account.tier || "regular", pointsBalance: account.pointsBalance ?? 0, drinkCredits: account.drinkCredits ?? 0 }}
        />
      }
    />
  );

  const events = account.events ?? [];
  const orders = account.orders ?? [];
  const subscriptions = data?.subscriptions ?? [];

  return (
    <PageContainer title={title} header={header} breadcrumbs={breadcrumbs}>
      <div className="space-y-8 px-4 pb-24 md:px-6">
        <PlatformSection id="loyalty-balance-heading" title="Balance">
          <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-[6px] border bg-border text-sm sm:grid-cols-3 lg:grid-cols-6">
            <Fact label="Points">{account.pointsBalance ?? 0}/100</Fact>
            <Fact label="Drink credits">{account.drinkCredits ?? 0}</Fact>
            <Fact label="Lifetime points">{account.lifetimePoints ?? 0}</Fact>
            <Fact label="Visits">{account.visits ?? 0}</Fact>
            <Fact label="First visit">{account.firstVisitAt ? formatStoreDateTime(account.firstVisitAt, timezone) : "—"}</Fact>
            <Fact label="Last visit">{account.lastVisitAt ? formatStoreDateTime(account.lastVisitAt, timezone) : "—"}</Fact>
          </dl>
        </PlatformSection>

        <div className="grid gap-8 lg:grid-cols-2">
          <PlatformSection id="loyalty-account-heading" title="Account">
            <dl className="grid gap-x-4 gap-y-2 rounded-[6px] border border-border p-4 text-sm sm:grid-cols-[8rem_minmax(0,1fr)]">
              <dt className="text-muted-foreground">Name</dt><dd className="[overflow-wrap:anywhere]">{account.customerName || "—"}</dd>
              <dt className="text-muted-foreground">Email</dt><dd className="[overflow-wrap:anywhere]">{account.customerEmail || "—"}</dd>
              <dt className="text-muted-foreground">Phone</dt><dd>{account.customerPhone || "—"}</dd>
              <dt className="text-muted-foreground">Marketing</dt><dd>{account.marketingOptIn ? "Opted in" : "Not opted in"}</dd>
              <dt className="text-muted-foreground">Created</dt><dd>{formatStoreDateTime(account.createdAt, timezone)}</dd>
              {account.notes ? <><dt className="text-muted-foreground">Notes</dt><dd className="whitespace-pre-wrap [overflow-wrap:anywhere]">{account.notes}</dd></> : null}
            </dl>
          </PlatformSection>

          <PlatformSection id="loyalty-customer-heading" title="Customer">
            {account.customer ? (
              <dl className="grid gap-x-4 gap-y-2 rounded-[6px] border border-border p-4 text-sm sm:grid-cols-[8rem_minmax(0,1fr)]">
                <dt className="text-muted-foreground">Name</dt><dd className="[overflow-wrap:anywhere]">{account.customer.name || "—"}</dd>
                <dt className="text-muted-foreground">Email</dt><dd className="[overflow-wrap:anywhere]">{account.customer.email || "—"}</dd>
                <dt className="text-muted-foreground">Phone</dt><dd>{account.customer.phone || "—"}</dd>
              </dl>
            ) : <PlatformEmpty>No linked customer.</PlatformEmpty>}
          </PlatformSection>
        </div>

        <PlatformSection id="loyalty-subscriptions-heading" title="Subscriptions" meta={subscriptions.length}>
          {subscriptions.length ? (
            <ul className="divide-y divide-border rounded-[6px] border border-border">
              {subscriptions.map((subscription) => {
                const sub = SUBSCRIPTION_STATUS[subscription.status || ""] || { label: subscription.status || "—", tone: "zinc" as StatusTone };
                return (
                  <li key={subscription.id}>
                    <Link href={`/dashboard/platform/subscriptions/${subscription.id}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm hover:bg-muted/50">
                      <StatusTitle as="p" tone={sub.tone} status={sub.label} className="font-medium">
                        {subscription.planName || "Plan"} · {subscription.subscriptionNumber}
                      </StatusTitle>
                      <span className="inline-flex items-center gap-2 text-muted-foreground">
                        <span className="tabular-nums">{formatMoney(subscription.priceCents, currency)} {INTERVAL_LABELS[subscription.billingInterval || ""] || ""}</span>
                        {subscription.renewsAt ? <span>Renews {formatStoreDateTime(subscription.renewsAt, timezone)}</span> : null}
                        <ArrowUpRight className="size-4" aria-hidden="true" />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : <PlatformEmpty>No subscriptions.</PlatformEmpty>}
        </PlatformSection>

        <PlatformSection
          id="loyalty-orders-heading"
          title="Orders"
          meta={account.ordersCount ?? 0}
          actions={<Pager label="Order pages" page={ordersPage} total={account.ordersCount ?? 0} href={(page) => detailHref(account.id, { eventsPage, ordersPage: page })} />}
        >
          {orders.length ? (
            <ul className="divide-y divide-border rounded-[6px] border border-border">
              {orders.map((order) => (
                <li key={order.id}>
                  <Link href={`/dashboard/platform/orders?search=${encodeURIComponent(order.orderNumber || "")}`} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3 text-sm hover:bg-muted/50">
                    <span className="font-medium">#{order.orderNumber}</span>
                    <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1 text-muted-foreground">
                      <span>{ORDER_STATUS_LABELS[order.status || ""] || order.status}</span>
                      <span className="tabular-nums text-foreground">{formatMoney(order.total, currency)}</span>
                      <span>{formatStoreDateTime(order.createdAt, timezone)}</span>
                      <ArrowUpRight className="size-4" aria-hidden="true" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : <PlatformEmpty>No orders.</PlatformEmpty>}
        </PlatformSection>

        <PlatformSection
          id="loyalty-ledger-heading"
          title="Ledger"
          meta={account.eventsCount ?? 0}
          actions={<Pager label="Ledger pages" page={eventsPage} total={account.eventsCount ?? 0} href={(page) => detailHref(account.id, { eventsPage: page, ordersPage })} />}
        >
          {events.length ? (
            <ul className="divide-y divide-border rounded-[6px] border border-border">
              {events.map((event) => (
                <li key={event.id} className="space-y-1 px-4 py-3 text-sm">
                  <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
                    <span className="inline-flex items-center gap-2 font-medium">
                      <StatusDot tone={event.type === "refund_reversal" || event.type === "redeemed" ? "rose" : event.type === "manual_adjustment" ? "indigo" : "green"} />
                      {LOYALTY_EVENT_LABELS[event.type || ""] || event.type}
                    </span>
                    <span className="inline-flex items-center gap-3 tabular-nums">
                      <span className={deltaClass(event.pointsDelta)}>{formatSigned(event.pointsDelta)} pts</span>
                      <span className={deltaClass(event.drinkCreditsDelta)}>{formatSigned(event.drinkCreditsDelta)} credits</span>
                    </span>
                  </div>
                  {event.note ? <p className="whitespace-pre-wrap text-muted-foreground [overflow-wrap:anywhere]">{event.note}</p> : null}
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                    <span>{formatStoreDateTime(event.createdAt, timezone)}</span>
                    {event.createdBy?.name ? <span>{event.createdBy.name}</span> : null}
                    {event.order?.orderNumber ? (
                      <Link href={`/dashboard/platform/orders?search=${encodeURIComponent(event.order.orderNumber)}`} className="inline-flex items-center gap-1 underline-offset-2 hover:text-foreground hover:underline">
                        #{event.order.orderNumber}<ArrowUpRight className="size-3" aria-hidden="true" />
                      </Link>
                    ) : null}
                  </p>
                </li>
              ))}
            </ul>
          ) : <PlatformEmpty>No ledger entries.</PlatformEmpty>}
        </PlatformSection>
      </div>
    </PageContainer>
  );
}
