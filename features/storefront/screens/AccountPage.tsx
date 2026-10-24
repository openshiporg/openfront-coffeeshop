import Link from "next/link";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { StorefrontShell } from "../components/StorefrontShell";
import { CustomerAccountForm } from "../components/CustomerAccountForm";
import { CustomerProfileForm } from "../components/CustomerProfileForm";
import { customerSignOut, getCustomerAccount } from "../lib/data/account";
import { lookupCafeLoyalty } from "../lib/data/loyalty";
import { getCustomerCatering } from "../lib/data/catering";
import { CATERING_STATUS_LABELS, cateringStatusDot, formatCateringEventTime } from "../lib/catering";
import { getCoffeeStore } from "../lib/data/store";
import { formatMoney } from "../lib/format";

const STATUS_LABELS: Record<string, string> = {
  open: "Received", accepted: "Accepted", paid: "Paid", in_bar_queue: "In queue", preparing: "Preparing",
  ready: "Ready for pickup", completed: "Picked up", cancelled: "Cancelled", refunded: "Refunded",
};

function statusDot(status: string) {
  if (status === "ready") return "sf-dot-ready";
  if (status === "completed") return "sf-dot-done";
  if (status === "cancelled" || status === "refunded") return "sf-dot-cancelled";
  return "sf-dot-active";
}

// Dated on the store's calendar, the same day the order number carries.
function orderDate(value: string, timeZone?: string | null) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "";
  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: timeZone || "America/New_York" }).format(date);
  } catch {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date);
  }
}

async function RewardsPanel({ email }: { email: string }) {
  const result = await lookupCafeLoyalty(email).catch(() => null);
  const rewards = result?.success ? result.account : null;
  return (
    <section className="sf-panel" aria-labelledby="rewards-title">
      <h2 id="rewards-title" className="sf-display text-xl">Rewards</h2>
      {!result?.success ? (
        <p className="sf-muted mt-3 text-sm">Rewards unavailable</p>
      ) : rewards ? (
        <dl className="sf-totals mt-4">
          <div>
            <dt>Points</dt>
            <dd className="sf-mono">{rewards.pointsBalance || 0} / 100</dd>
          </div>
          <div>
            <dt>Drink credits</dt>
            <dd className="sf-mono">{rewards.drinkCredits || 0}</dd>
          </div>
        </dl>
      ) : (
        <p className="sf-muted mt-3 text-sm">No rewards yet</p>
      )}
    </section>
  );
}

async function CateringPanel({ timeZone, currencyCode }: { timeZone?: string | null; currencyCode: string }) {
  const requests = await getCustomerCatering().catch(() => null);
  return (
    <section className="sf-panel" aria-labelledby="catering-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="catering-title" className="sf-display text-xl">Catering</h2>
        <Link href="/catering" className="sf-link text-sm">
          New request
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
      {!requests ? (
        <p className="sf-muted mt-3 text-sm">Catering unavailable</p>
      ) : requests.length === 0 ? (
        <p className="sf-muted mt-3 text-sm">No catering requests</p>
      ) : (
        <ul className="mt-3 grid gap-3">
          {requests.map((request) => (
            <li key={request.id} className="sf-panel-inset grid gap-1 !p-3 text-sm">
              <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className="sf-status min-w-0">
                  <span className={`sf-dot ${cateringStatusDot(request.status)}`} aria-hidden="true" />
                  <strong className="sf-mono [overflow-wrap:anywhere]">{request.cateringNumber}</strong>
                </span>
                {request.quotedCents != null ? <span className="sf-mono font-semibold">{formatMoney(request.quotedCents, currencyCode)}</span> : null}
              </span>
              <span className="sf-muted">
                {CATERING_STATUS_LABELS[request.status] || request.status.replaceAll("_", " ")}
                {` · ${formatCateringEventTime(request.eventAt, timeZone)} · ${request.guestCount} ${request.guestCount === 1 ? "guest" : "guests"}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

async function AccountContent({ searchParams }: { searchParams: Promise<{ after?: string }> }) {
  const { after } = await searchParams;
  const store = await getCoffeeStore().catch(() => null);
  let account;
  try { account = await getCustomerAccount(after); }
  catch {
    return (
      <main className="sf-container sf-page">
        <div className="sf-empty" role="alert">
          <strong>Account unavailable</strong>
          <span>Your orders are safe. Try again in a moment.</span>
          <Link href={after ? `/account?after=${encodeURIComponent(after)}` : "/account"} className="sf-btn sf-btn-ghost mt-3">Try again</Link>
        </div>
      </main>
    );
  }
  if (!account) return <main className="sf-container sf-page"><CustomerAccountForm /></main>;
  return (
    <main className="sf-container sf-page">
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div className="min-w-0">
          <h1 className="sf-display sf-page-title">Orders</h1>
          <p className="sf-muted mt-1 [overflow-wrap:anywhere]">{account.user.name}{account.user.email ? ` · ${account.user.email}` : ""}</p>
        </div>
        <form action={customerSignOut}><button className="sf-btn sf-btn-ghost">Sign out</button></form>
      </div>
      <div className="sf-split mt-6">
        <section aria-labelledby="orders-title" className="min-w-0">
          <h2 id="orders-title" className="sr-only">Order history</h2>
          {account.orders.length === 0 ? (
            <div className="sf-empty">
              <strong>No orders yet</strong>
              <Link href="/#menu" className="sf-btn sf-btn-ghost mt-3">Browse the menu</Link>
            </div>
          ) : (
            <ul className="grid gap-3">
              {account.orders.map((order) => (
                <li key={order.id}>
                  <Link href={`/order-confirmed?id=${encodeURIComponent(order.id)}`} className="sf-order-row">
                    <span className="sf-status min-w-0">
                      <span className={`sf-dot ${statusDot(order.status)}`} aria-hidden="true" />
                      <strong>#{order.orderNumber}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="sf-mono font-semibold">{formatMoney(order.total, order.currencyCode || "USD")}</span>
                      <ChevronRight className="size-4 text-[var(--sf-ink-faint)]" aria-hidden="true" />
                    </span>
                    <span className="sf-order-row-sub">
                      {STATUS_LABELS[order.status] || order.status.replaceAll("_", " ")}
                      {orderDate(order.createdAt, store?.timezone) ? ` · ${orderDate(order.createdAt, store?.timezone)}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {account.nextCursor || after ? (
            <div className="mt-6 flex flex-wrap gap-3">
              {after ? <Link href="/account" className="sf-btn sf-btn-ghost">Newest orders</Link> : null}
              {account.nextCursor ? <Link href={`/account?after=${encodeURIComponent(account.nextCursor)}`} className="sf-btn sf-btn-ghost">Older orders</Link> : null}
            </div>
          ) : null}
        </section>
        <div className="grid content-start gap-6">
          {account.user.email ? <RewardsPanel email={account.user.email} /> : null}
          <CateringPanel timeZone={store?.timezone} currencyCode={store?.currencyCode || "USD"} />
          <CustomerProfileForm name={account.user.name} phone={account.user.phone} />
        </div>
      </div>
    </main>
  );
}

export default function AccountPage(props: { searchParams: Promise<{ after?: string }> }) {
  return <StorefrontShell><AccountContent {...props} /></StorefrontShell>;
}
