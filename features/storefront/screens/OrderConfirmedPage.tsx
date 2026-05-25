import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock, Coffee, ReceiptText } from "lucide-react";
import { formatMoney, formatPickupTime } from "@/features/storefront/lib/format";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";

const ORDER_QUERY = `
  query ConfirmedCafeOrder($id: ID!, $secretKey: String) {
    getCafeOrder(orderId: $id, secretKey: $secretKey)
  }
`;

export async function OrderConfirmedPage({ id, secretKey }: { id?: string; secretKey?: string }) {
  const response = id
    ? await keystoneClient<{ getCafeOrder: any }>(ORDER_QUERY, { id, secretKey }, { cache: "no-store" })
    : null;
  const order = response?.success ? response.data.getCafeOrder : null;

  return (
    <main className="min-h-screen bg-[#f4ead9] px-5 py-8 text-[#201715] md:px-8 lg:px-10">
      <div className="mx-auto max-w-4xl">
        {order ? (
          <section className="overflow-hidden rounded-lg border border-[#cdb894] bg-[#fff8ed] shadow-[0_28px_90px_rgba(32,23,21,0.14)]">
            <div className="bg-[#201715] p-6 text-[#fff8ed] md:p-8">
              <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#d6a85d]">
                <CheckCircle2 className="h-4 w-4" />
                Order confirmed
              </p>
              <div className="mt-5 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                <div>
                  <h1 className="text-5xl font-black leading-none md:text-7xl">#{order.orderNumber}</h1>
                  <p className="mt-3 text-[#dacdb8]">For {order.pickupName || "Guest"} / pickup around {formatPickupTime(order.promisedAt)}</p>
                </div>
                <div className="rounded-lg border border-white/15 bg-white/10 px-6 py-5 text-center">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-[#d6a85d]">Handoff</div>
                  <div className="mt-1 text-4xl font-black">{order.handoffCode}</div>
                </div>
              </div>
            </div>

            <div className="grid gap-px bg-[#d7c7ad] md:grid-cols-3">
              <div className="bg-[#fff8ed] p-4">
                <div className="flex items-center gap-2 text-sm font-black text-[#8b5f2b]"><Clock className="h-4 w-4" /> Pickup</div>
                <div className="mt-1 text-lg font-black">{formatPickupTime(order.promisedAt)}</div>
              </div>
              <div className="bg-[#fff8ed] p-4">
                <div className="flex items-center gap-2 text-sm font-black text-[#8b5f2b]"><Coffee className="h-4 w-4" /> Status</div>
                <div className="mt-1 text-lg font-black capitalize">{order.status?.replaceAll("_", " ")}</div>
              </div>
              <div className="bg-[#fff8ed] p-4">
                <div className="flex items-center gap-2 text-sm font-black text-[#8b5f2b]"><ReceiptText className="h-4 w-4" /> Total</div>
                <div className="mt-1 text-lg font-black">{formatMoney(order.total)}</div>
              </div>
            </div>

            <div className="p-5 md:p-8">
              <h2 className="text-2xl font-black">Bar ticket</h2>
              <div className="mt-4 overflow-hidden rounded-lg border border-[#d7c7ad] bg-white">
                {order.orderItems?.map((item: any) => (
                  <div key={item.id} className="flex justify-between gap-4 border-b border-[#eadfcc] p-4 last:border-b-0">
                    <div>
                      <div className="font-black">{item.quantity}x {item.itemNameSnapshot}</div>
                      {item.customizationsSummary && <div className="mt-1 text-sm text-[#6d5e52]">{item.customizationsSummary}</div>}
                    </div>
                    <div className="font-black">{formatMoney(item.price * item.quantity)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-5 space-y-2 border-t border-[#d7c7ad] pt-4 text-sm">
                <div className="flex justify-between"><span>Subtotal</span><span>{formatMoney(order.subtotal)}</span></div>
                <div className="flex justify-between"><span>Tax</span><span>{formatMoney(order.tax)}</span></div>
                <div className="flex justify-between text-lg font-black"><span>Total</span><span>{formatMoney(order.total)}</span></div>
              </div>
            </div>
          </section>
        ) : (
          <div className="rounded-lg border border-[#cdb894] bg-[#fff8ed] p-8 text-center shadow-[0_24px_80px_rgba(32,23,21,0.12)]">
            <h1 className="text-3xl font-black">Order not found</h1>
            <p className="mt-2 text-[#6d5e52]">The confirmation link is missing an order id or the order secret did not match.</p>
          </div>
        )}
        <Link href="/" className="mt-6 inline-flex items-center gap-2 rounded-md bg-[#201715] px-5 py-3 text-sm font-black text-[#fff8ed]">
          <ArrowLeft className="h-4 w-4" />
          Back to menu
        </Link>
      </div>
    </main>
  );
}
