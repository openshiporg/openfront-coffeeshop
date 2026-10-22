import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { StorefrontShell } from "../components/StorefrontShell";
import { CustomerAccountForm } from "../components/CustomerAccountForm";
import { CustomerProfileForm } from "../components/CustomerProfileForm";
import { customerSignOut, getCustomerAccount } from "../lib/data/account";
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

function orderDate(value: string) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(date) : "";
}

async function AccountContent({ searchParams }: { searchParams: Promise<{ after?: string }> }) {
  const { after } = await searchParams;
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
          <p className="sf-muted mt-1 [overflow-wrap:anywhere]">{account.user.name}</p>
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
                      {orderDate(order.createdAt) ? ` · ${orderDate(order.createdAt)}` : ""}
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
        <CustomerProfileForm name={account.user.name} phone={account.user.phone} />
      </div>
    </main>
  );
}

export default function AccountPage(props: { searchParams: Promise<{ after?: string }> }) {
  return <StorefrontShell><AccountContent {...props} /></StorefrontShell>;
}
