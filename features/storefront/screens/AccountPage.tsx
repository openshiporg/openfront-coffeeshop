import Link from "next/link";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import { MarkerTick } from "../components/MarkerTick";
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

// Points per drink credit, as applyCafeLoyalty settles them (100 points convert to one credit).
const POINTS_PER_CREDIT = 100;
const PUNCHES = 10;

async function RewardsPanel({ email }: { email: string }) {
  const result = await lookupCafeLoyalty(email).catch(() => null);
  const rewards = result?.success ? result.account : null;
  const points = rewards?.pointsBalance || 0;
  // Progress straight from the account: nextRewardProgress is the share of the next credit earned.
  const progress = Math.max(0, Math.min(100, rewards?.nextRewardProgress ?? points));
  const punched = Math.floor((progress / 100) * PUNCHES);
  const credits = rewards?.drinkCredits || 0;
  return (
    <section className="sf-panel" aria-labelledby="rewards-title">
      <h2 id="rewards-title" className="sf-display sf-panel-title">Rewards</h2>
      {!result?.success ? (
        <p className="sf-muted">Rewards can’t be loaded right now.</p>
      ) : rewards ? (
        <>
          <p className="sf-rewards-line">
            <span className="sf-marker">{points}</span> of {POINTS_PER_CREDIT} points toward your next drink credit
          </p>
          <ol className="sf-punches" aria-hidden="true">
            {Array.from({ length: PUNCHES }, (_, index) => (
              <li key={index} className={index < punched ? "is-marked" : undefined}>{index < punched ? <MarkerTick /> : null}</li>
            ))}
          </ol>
          <p className="sf-rewards-line">
            {credits ? <><span className="sf-marker">{credits}</span> {credits === 1 ? "drink credit" : "drink credits"} saved</> : "No drink credits saved yet"}
          </p>
        </>
      ) : (
        <p className="sf-muted">No rewards yet. Add an order to rewards from its receipt to start earning points.</p>
      )}
    </section>
  );
}

async function CateringPanel({ timeZone, currencyCode }: { timeZone?: string | null; currencyCode: string }) {
  const requests = await getCustomerCatering().catch(() => null);
  return (
    <section className="sf-panel" aria-labelledby="catering-title">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="catering-title" className="sf-display sf-panel-title">Catering</h2>
        <Link href="/catering" className="sf-link">
          New request
          <ArrowUpRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
      {!requests ? (
        <p className="sf-muted">Catering requests can’t be loaded right now.</p>
      ) : requests.length === 0 ? (
        <p className="sf-muted">No catering requests yet.</p>
      ) : (
        <ul className="sf-rows">
          {requests.map((request) => (
            <li key={request.id} className="sf-row">
              <span className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <span className="sf-status min-w-0">
                  <span className={`sf-dot ${cateringStatusDot(request.status)}`} aria-hidden="true" />
                  <strong className="sf-marker [overflow-wrap:anywhere]">{request.cateringNumber}</strong>
                </span>
                {request.quotedCents != null ? <span className="sf-price">{formatMoney(request.quotedCents, currencyCode)}</span> : null}
              </span>
              <span className="sf-row-sub">
                {CATERING_STATUS_LABELS[request.status] || request.status.replaceAll("_", " ")}
                {`, ${formatCateringEventTime(request.eventAt, timeZone)}, ${request.guestCount} ${request.guestCount === 1 ? "guest" : "guests"}`}
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
          <Link href={after ? `/account?after=${encodeURIComponent(after)}` : "/account"} className="sf-btn sf-btn-ghost">Try again</Link>
        </div>
      </main>
    );
  }
  if (!account) return <main className="sf-container sf-page"><CustomerAccountForm /></main>;
  return (
    <main className="sf-container sf-page">
      <div className="sf-account-head">
        <div className="min-w-0">
          <h1 className="sf-display sf-page-title">Your account</h1>
          <p className="sf-account-who"><span className="sf-marker">{account.user.name}</span>{account.user.email ? <span className="sf-muted">{account.user.email}</span> : null}</p>
        </div>
        <form action={customerSignOut}><button className="sf-btn sf-btn-ghost">Sign out</button></form>
      </div>
      <div className="sf-split">
        <section aria-labelledby="orders-title" className="min-w-0">
          <h2 id="orders-title" className="sf-display sf-panel-title">Orders</h2>
          {account.orders.length === 0 ? (
            <div className="sf-empty">
              <strong>No orders yet</strong>
              <span>Orders you place while signed in show up here with their status.</span>
              <Link href="/#menu" className="sf-btn sf-btn-ghost">Browse the menu</Link>
            </div>
          ) : (
            <ul className="sf-rows">
              {account.orders.map((order) => (
                <li key={order.id}>
                  <Link href={`/order-confirmed?id=${encodeURIComponent(order.id)}`} className="sf-order-row">
                    <span className="sf-status min-w-0">
                      <span className={`sf-dot ${statusDot(order.status)}`} aria-hidden="true" />
                      <strong className="sf-marker">#{order.orderNumber}</strong>
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <span className="sf-price">{formatMoney(order.total, order.currencyCode || "USD")}</span>
                      <ChevronRight className="size-4 text-[var(--sf-ink-faint)]" aria-hidden="true" />
                    </span>
                    <span className="sf-order-row-sub">
                      {STATUS_LABELS[order.status] || order.status.replaceAll("_", " ")}
                      {orderDate(order.createdAt, store?.timezone) ? `, ${orderDate(order.createdAt, store?.timezone)}` : ""}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {account.nextCursor || after ? (
            <div className="sf-pager">
              {after ? <Link href="/account" className="sf-btn sf-btn-ghost">Newest orders</Link> : null}
              {account.nextCursor ? <Link href={`/account?after=${encodeURIComponent(account.nextCursor)}`} className="sf-btn sf-btn-ghost">Older orders</Link> : null}
            </div>
          ) : null}
        </section>
        <div className="sf-stack">
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
