import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Clock, Coffee, Flame, Leaf } from "lucide-react";
import { AddToCartCustomizer } from "@/features/storefront/components/AddToCartCustomizer";
import { getStorefrontMenuItem } from "@/features/storefront/lib/data/menu";
import { formatMoney } from "@/features/storefront/lib/format";

export async function MenuItemPage({ id }: { id: string }) {
  const item = await getStorefrontMenuItem(id);
  if (!item || !item.available) notFound();

  return (
    <main className="min-h-screen bg-[#f4ead9] px-5 py-6 text-[#201715] md:px-8 lg:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-6 flex items-center justify-between border-b border-[#cdb894] pb-5">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-black uppercase tracking-[0.14em] text-[#8b5f2b]">
            <ArrowLeft className="h-4 w-4" />
            Menu
          </Link>
          <Link href="/checkout" className="rounded-md bg-[#201715] px-4 py-2 text-sm font-bold text-[#fff8ed]">
            Pickup cart
          </Link>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_26rem] xl:grid-cols-[minmax(0,1fr)_30rem]">
          <section className="overflow-hidden rounded-lg border border-[#cdb894] bg-[#fff8ed]">
            <div className="grid lg:grid-cols-[1.05fr_0.95fr]">
              <div className="relative min-h-[360px] overflow-hidden bg-[#201715]">
                {item.imageUrl ? (
                  <img src={item.imageUrl} alt={item.name} className="h-full min-h-[360px] w-full object-cover" />
                ) : (
                  <div className="relative h-full min-h-[360px] bg-[#201715]">
                    <div className="absolute inset-x-10 top-10 h-32 rounded-full bg-[#fff8ed]/90 blur-3xl" />
                    <div className="absolute bottom-0 left-1/2 h-56 w-64 -translate-x-1/2 rounded-t-full border-x-[26px] border-t-[26px] border-[#f7efe2] bg-[#8f4f31]" />
                    <div className="absolute bottom-24 left-[58%] h-24 w-32 rounded-r-full border-[18px] border-[#f7efe2]" />
                    <div className="absolute bottom-8 left-1/2 h-10 w-80 -translate-x-1/2 rounded-full bg-black/30 blur-lg" />
                  </div>
                )}
                <div className="absolute left-5 top-5 rounded-md bg-[#fff8ed] px-3 py-2 text-xs font-black uppercase tracking-[0.16em] text-[#8b5f2b]">
                  {item.category?.name || "Coffee bar"}
                </div>
              </div>
              <div className="flex flex-col justify-between p-6 md:p-8">
                <div>
                  <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#8b5f2b]">
                    <Coffee className="h-4 w-4" />
                    Built to order
                  </p>
                  <h1 className="mt-4 text-5xl font-black leading-none md:text-6xl">{item.name}</h1>
                  <p className="mt-5 text-lg leading-8 text-[#6d5e52]">{item.shortDescription || "Made for pickup and routed to the bar queue after payment."}</p>
                </div>
                <div className="mt-8 grid gap-px overflow-hidden rounded-lg border border-[#d7c7ad] bg-[#d7c7ad] sm:grid-cols-3">
                  <div className="bg-[#fff8ed] p-4">
                    <div className="text-2xl font-black">{formatMoney(item.price)}</div>
                    <div className="text-sm text-[#6d5e52]">base</div>
                  </div>
                  <div className="bg-[#fff8ed] p-4">
                    <div className="flex items-center gap-2 text-2xl font-black"><Clock className="h-5 w-5 text-[#557260]" />{item.prepTimeMinutes || 5}</div>
                    <div className="text-sm text-[#6d5e52]">minutes</div>
                  </div>
                  <div className="bg-[#fff8ed] p-4">
                    <div className="flex items-center gap-2 text-2xl font-black"><Flame className="h-5 w-5 text-[#8b3f24]" />{item.caffeineMg || "0"}</div>
                    <div className="text-sm text-[#6d5e52]">mg caffeine</div>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-[#6d5e52]">
                  {item.temperatureOptions?.map((option) => <span key={option} className="rounded-md border border-[#d7c7ad] px-2 py-1 capitalize">{option}</span>)}
                  {item.dietaryFlags?.map((flag) => <span key={flag} className="inline-flex items-center gap-1 rounded-md border border-[#d7c7ad] px-2 py-1 capitalize"><Leaf className="h-3 w-3 text-[#557260]" />{flag.replaceAll("_", " ")}</span>)}
                </div>
              </div>
            </div>
          </section>
          <AddToCartCustomizer item={item} />
        </div>
      </div>
    </main>
  );
}
