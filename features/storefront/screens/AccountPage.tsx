import Link from "next/link";
import { StorefrontShell } from "../components/StorefrontShell";
import { CustomerAccountForm } from "../components/CustomerAccountForm";
import { CustomerProfileForm } from "../components/CustomerProfileForm";
import { customerSignOut, getCustomerAccount } from "../lib/data/account";
import { formatMoney } from "../lib/format";

async function AccountContent({ searchParams }: { searchParams: Promise<{ after?: string }> }) {
  const { after } = await searchParams;
  let account;
  try { account = await getCustomerAccount(after); }
  catch {
    return (
      <main className="sf-container py-16">
        <h1 className="sf-display text-3xl">Orders unavailable</h1>
        <p className="mt-3 text-[var(--sf-ink-muted)]" role="alert">Your account couldn’t be loaded right now. Your orders are safe; try again in a moment.</p>
        <Link href={after ? `/account?after=${encodeURIComponent(after)}` : "/account"} className="sf-btn mt-6 min-h-11">Try again</Link>
      </main>
    );
  }
  if (!account) return <main className="sf-container py-16"><CustomerAccountForm /></main>;
  return (
    <main className="sf-container py-12">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="sf-display text-3xl [overflow-wrap:anywhere]">{account.user.name}’s orders</h1>
        <form action={customerSignOut}><button className="sf-btn min-h-11">Sign out</button></form>
      </div>
      <div className="sf-split mt-8">
        <section aria-labelledby="orders-title">
          <h2 id="orders-title" className="sr-only">Orders</h2>
          <div className="grid gap-4">
            {account.orders.length === 0 ? <p>No orders yet.</p> : account.orders.map((order) => (
              <Link key={order.id} href={`/order-confirmed?id=${encodeURIComponent(order.id)}`} className="sf-panel block min-h-11">
                <div className="flex flex-wrap items-center justify-between gap-3"><strong className="[overflow-wrap:anywhere]">{order.orderNumber}</strong><span className="inline-flex items-center gap-2"><span className="size-2 rounded-full bg-current" aria-hidden="true" />{order.status.replaceAll("_", " ")}</span></div>
                <p className="mt-2">{formatMoney(order.total, order.currencyCode || "USD")} · View receipt ↗</p>
              </Link>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            {account.nextCursor ? <Link href={`/account?after=${encodeURIComponent(account.nextCursor)}`} className="sf-btn mt-6 min-h-11">Older orders</Link> : null}
            {after ? <Link href="/account" className="sf-btn mt-6 min-h-11">Newest orders</Link> : null}
          </div>
        </section>
        <CustomerProfileForm name={account.user.name} phone={account.user.phone} />
      </div>
    </main>
  );
}

export default function AccountPage(props: { searchParams: Promise<{ after?: string }> }) {
  return <StorefrontShell><AccountContent {...props} /></StorefrontShell>;
}
