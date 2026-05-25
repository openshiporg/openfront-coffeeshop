import Link from "next/link";
import { ArrowRight, Clock, Coffee, Leaf, MapPin, ShoppingBag, Star } from "lucide-react";
import { getStorefrontMenu, type StorefrontMenuItem } from "@/features/storefront/lib/data/menu";
import { formatMoney } from "@/features/storefront/lib/format";

function MenuImage({ item, className = "" }: { item: StorefrontMenuItem; className?: string }) {
  if (item.imageUrl) {
    return (
      <img
        src={item.imageUrl}
        alt={item.name}
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }

  return (
    <div className={`relative h-full w-full overflow-hidden bg-[#241b18] ${className}`}>
      <div className="absolute inset-x-6 top-8 h-24 rounded-full bg-[#f7efe2]/90 blur-2xl" />
      <div className="absolute bottom-0 left-1/2 h-36 w-40 -translate-x-1/2 rounded-t-full border-x-[18px] border-t-[18px] border-[#f7efe2] bg-[#8f4f31]" />
      <div className="absolute bottom-14 left-[58%] h-14 w-20 rounded-r-full border-[12px] border-[#f7efe2]" />
      <div className="absolute bottom-6 left-1/2 h-6 w-52 -translate-x-1/2 rounded-full bg-black/25 blur-md" />
    </div>
  );
}

export default async function HomePage() {
  const { categories, items, error } = await getStorefrontMenu();
  const featured = items.filter((item) => item.featured || item.popular).slice(0, 4);
  const heroItem = featured[0] || items[0];
  const quickItems = (featured.length ? featured : items).slice(0, 3);

  const categorySections = categories
    .map((category) => ({
      category,
      items: items.filter((item) => item.category?.id === category.id),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <main className="min-h-screen bg-[#f4ead9] text-[#201715]">
      <section className="relative overflow-hidden bg-[#201715] text-[#fff8ed]">
        <div className="absolute inset-0 opacity-[0.12] [background-image:linear-gradient(90deg,#fff_1px,transparent_1px),linear-gradient(#fff_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="relative mx-auto grid max-w-7xl gap-10 px-5 pb-14 pt-6 md:grid-cols-[1.05fr_0.95fr] md:px-8 md:pb-20 lg:px-10">
          <header className="col-span-full flex items-center justify-between border-b border-white/15 pb-5">
            <Link href="/" className="text-lg font-black uppercase tracking-[0.18em]">
              Elm & Ember
            </Link>
            <nav className="hidden items-center gap-6 text-sm font-medium text-[#dacdb8] md:flex">
              <a href="#menu">Menu</a>
              <a href="#pickup">Pickup</a>
              <Link href="/dashboard">Operator</Link>
            </nav>
            <Link href="/checkout" className="inline-flex items-center gap-2 rounded-md bg-[#d6a85d] px-4 py-2 text-sm font-bold text-[#201715]">
              <ShoppingBag className="h-4 w-4" />
              Cart
            </Link>
          </header>

          <div className="flex min-h-[580px] flex-col justify-between gap-10">
            <div className="max-w-3xl pt-8 md:pt-14">
              <div className="mb-6 flex flex-wrap gap-3 text-xs font-bold uppercase tracking-[0.18em] text-[#d6a85d]">
                <span className="inline-flex items-center gap-2"><MapPin className="h-4 w-4" /> Corner cafe pickup</span>
                <span className="inline-flex items-center gap-2"><Clock className="h-4 w-4" /> Open morning service</span>
              </div>
              <h1 className="text-5xl font-black leading-[0.94] md:text-7xl lg:text-8xl">
                Small-batch coffee, ready when you turn the corner.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#dacdb8]">
                Order seasonal espresso, slow bar favorites, bakery case staples, and retail beans from the live cafe board.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <a href="#menu" className="inline-flex items-center justify-center gap-2 rounded-md bg-[#fff8ed] px-5 py-3 text-sm font-black text-[#201715]">
                  Order pickup
                  <ArrowRight className="h-4 w-4" />
                </a>
                {heroItem ? (
                  <Link href={`/menu/${heroItem.id}`} className="inline-flex items-center justify-center gap-2 rounded-md border border-white/20 px-5 py-3 text-sm font-bold text-[#fff8ed]">
                    View {heroItem.name}
                  </Link>
                ) : null}
              </div>
            </div>
            <div id="pickup" className="grid gap-px overflow-hidden rounded-lg border border-white/15 bg-white/15 sm:grid-cols-3">
              {[
                ["8-14 min", "typical pickup"],
                ["Live", "modifiers and availability"],
                ["Secure", "order secret confirmation"],
              ].map(([value, label]) => (
                <div key={label} className="bg-[#201715]/90 p-4">
                  <div className="text-2xl font-black text-[#fff8ed]">{value}</div>
                  <div className="mt-1 text-sm text-[#dacdb8]">{label}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="self-end">
            {heroItem ? (
              <div className="overflow-hidden rounded-lg border border-white/15 bg-[#fff8ed] text-[#201715] shadow-[0_30px_100px_rgba(0,0,0,0.35)]">
                <div className="aspect-[5/4]">
                  <MenuImage item={heroItem} />
                </div>
                <div className="grid gap-px bg-[#d8cbb8] sm:grid-cols-[1fr_12rem]">
                  <div className="bg-[#fff8ed] p-5">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-[#8b5f2b]">Featured pour</div>
                    <h2 className="mt-2 text-3xl font-black">{heroItem.name}</h2>
                    <p className="mt-2 text-sm leading-6 text-[#6d5e52]">
                      {heroItem.shortDescription || "Built to order and queued for pickup."}
                    </p>
                  </div>
                  <div className="bg-[#fff8ed] p-5 sm:text-right">
                    <div className="text-2xl font-black">{formatMoney(heroItem.price)}</div>
                    <div className="mt-2 text-sm text-[#6d5e52]">{heroItem.prepTimeMinutes || 5} min prep</div>
                    <Link href={`/menu/${heroItem.id}`} className="mt-5 inline-flex items-center gap-2 rounded-md bg-[#201715] px-4 py-2 text-sm font-bold text-[#fff8ed]">
                      Customize
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-white/25 p-8 text-[#dacdb8]">No menu items yet. Run onboarding seed or create menu items in the dashboard.</div>
            )}
          </div>
        </div>
      </section>

      {error && <div className="mx-auto max-w-7xl px-5 py-4 text-sm text-red-700 md:px-8 lg:px-10">Menu query failed: {error}</div>}

      {quickItems.length > 0 && (
        <section className="border-b border-[#d7c7ad] bg-[#fff8ed]">
          <div className="mx-auto grid max-w-7xl gap-px bg-[#d7c7ad] px-0 md:grid-cols-3">
            {quickItems.map((item) => (
              <Link key={item.id} href={`/menu/${item.id}`} className="group grid grid-cols-[6.5rem_1fr] bg-[#fff8ed] p-4 transition hover:bg-[#f4ead9]">
                <div className="aspect-square overflow-hidden rounded-md">
                  <MenuImage item={item} />
                </div>
                <div className="pl-4">
                  <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-[#8b5f2b]">
                    <Star className="h-3.5 w-3.5" />
                    House pick
                  </div>
                  <h2 className="mt-2 text-lg font-black group-hover:text-[#8b3f24]">{item.name}</h2>
                  <p className="mt-1 text-sm text-[#6d5e52]">{formatMoney(item.price)} / {item.prepTimeMinutes || 5} min</p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section id="menu" className="mx-auto max-w-7xl px-5 py-14 md:px-8 lg:px-10">
        <div className="mb-10 grid gap-6 md:grid-cols-[1fr_24rem] md:items-end">
          <div>
            <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-[#8b5f2b]">
              <Coffee className="h-4 w-4" />
              Today&apos;s board
            </p>
            <h2 className="mt-3 max-w-3xl text-4xl font-black leading-tight md:text-6xl">Espresso, bakery, and beans without the line.</h2>
          </div>
          <div className="rounded-lg border border-[#d7c7ad] bg-[#fff8ed] p-4 text-sm leading-6 text-[#6d5e52]">
            <div className="mb-2 flex items-center gap-2 font-black text-[#201715]"><Leaf className="h-4 w-4 text-[#557260]" /> Local service notes</div>
            Seasonal drinks rotate with the prep board. Unavailable modifiers are hidden before checkout and validated again server-side.
          </div>
        </div>

        <div className="space-y-14">
          {categorySections.map(({ category, items }) => (
            <section key={category.id} id={`category-${category.id}`}>
              <div className="mb-5 flex items-end justify-between gap-4 border-b border-[#cdb894] pb-4">
                <div>
                  <h3 className="text-2xl font-black">{category.name}</h3>
                  {category.description && <p className="mt-1 max-w-2xl text-sm leading-6 text-[#6d5e52]">{category.description}</p>}
                </div>
                <span className="shrink-0 text-sm font-semibold text-[#8b5f2b]">{items.length} items</span>
              </div>
              <div className="grid gap-px overflow-hidden rounded-lg border border-[#d7c7ad] bg-[#d7c7ad] md:grid-cols-2 xl:grid-cols-3">
                {items.map((item) => (
                  <Link key={item.id} href={`/menu/${item.id}`} className="group bg-[#fff8ed] p-5 transition hover:bg-white">
                    <div className="mb-5 aspect-[4/3] overflow-hidden rounded-md">
                      <MenuImage item={item} />
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h4 className="text-xl font-black group-hover:text-[#8b3f24]">{item.name}</h4>
                        <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#6d5e52]">{item.shortDescription || "Customize for pickup."}</p>
                      </div>
                      <span className="shrink-0 text-base font-black">{formatMoney(item.price)}</span>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2 text-xs font-semibold text-[#6d5e52]">
                      {item.temperatureOptions?.slice(0, 2).map((option) => <span key={option} className="rounded-md border border-[#d7c7ad] px-2 py-1 capitalize">{option}</span>)}
                      {item.caffeineMg ? <span className="rounded-md border border-[#d7c7ad] px-2 py-1">{item.caffeineMg}mg</span> : null}
                      <span className="rounded-md border border-[#d7c7ad] px-2 py-1">{item.prepTimeMinutes || 5} min</span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ))}
        </div>

        {!categorySections.length && !error ? (
          <div className="rounded-lg border border-dashed border-[#cdb894] bg-[#fff8ed] p-8 text-center text-[#6d5e52]">
            The public menu is empty. Add available items in the dashboard to publish the cafe board.
          </div>
        ) : null}
      </section>
    </main>
  );
}
