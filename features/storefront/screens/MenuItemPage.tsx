import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToCartCustomizer } from "@/features/storefront/components/AddToCartCustomizer";
import { getStorefrontMenuItem } from "@/features/storefront/lib/data/menu";
import { formatMoney } from "@/features/storefront/lib/format";
import { StorefrontShell } from "@/features/storefront/components/StorefrontShell";
import { StorefrontMedia } from "@/features/storefront/components/StorefrontMedia";

export async function MenuItemPage({ id }: { id: string }) {
  const result = await getStorefrontMenuItem(id);
  if (result.kind === "not-found") notFound();
  if (result.kind === "unavailable") {
    return (
      <StorefrontShell>
        <main className="sf-container py-16">
          <div className="sf-empty" role="alert">
            <p>This menu item is temporarily unavailable. Your cart is unchanged.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <a href={`/menu/${encodeURIComponent(id)}`} className="sf-btn sf-btn-ghost">Try again</a>
              <Link href="/#board" className="sf-btn sf-btn-ghost">Back to board</Link>
            </div>
          </div>
        </main>
      </StorefrontShell>
    );
  }
  const item = result.item;

  return (
    <StorefrontShell>
      <main className="sf-container py-8 sm:py-10">
        <div className="sf-page-head">
          <Link href="/#board" className="sf-back-link">
            ← Back to board
          </Link>
          <Link href="/checkout" className="sf-btn sf-btn-ghost">
            Pickup cart
          </Link>
        </div>

        <div className="sf-split mt-8">
          <section className="space-y-8">
            <div className="sf-spotlight-media max-h-[28rem]">
              <StorefrontMedia item={item} className="h-full min-h-[20rem] w-full" emphasize eager />
            </div>

            <div>
              <p className="sf-kicker">{item.category?.name || "Coffee bar"}</p>
              <h1 className="sf-display mt-3 text-[var(--sf-text-display-s)] leading-[0.95] [overflow-wrap:anywhere]">
                {item.name}
              </h1>
              <p className="mt-5 max-w-2xl text-[var(--sf-text-lg)] leading-relaxed text-[var(--sf-ink-muted)]">
                {item.shortDescription || "Made for pickup and routed to the bar queue once staff accept your order."}
              </p>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="sf-stat">
                  <div className="sf-stat-value">{formatMoney(item.price)}</div>
                  <div className="sf-stat-label">Base price</div>
                </div>
                <div className="sf-stat">
                  <div className="sf-stat-value">{item.prepTimeMinutes || 5} min</div>
                  <div className="sf-stat-label">Prep time</div>
                </div>
                <div className="sf-stat">
                  <div className="sf-stat-value">{item.caffeineMg ?? "—"}</div>
                  <div className="sf-stat-label">mg caffeine</div>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2 text-[var(--sf-text-xs)] text-[var(--sf-ink-faint)]">
                {item.temperatureOptions?.map((option) => (
                  <span key={option} className="border border-[var(--sf-rule)] px-2 py-1 capitalize">
                    {option}
                  </span>
                ))}
              </div>
              {item.dietaryFlags?.length ? (
                <div className="mt-4 max-w-2xl">
                  <p className="text-[var(--sf-text-xs)] font-semibold uppercase tracking-[0.14em] text-[var(--sf-ink-faint)]">Cafe notes for the standard recipe</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-[var(--sf-text-xs)] text-[var(--sf-ink-faint)]">
                    {item.dietaryFlags.map((flag) => (
                      <span key={flag} className="border border-[var(--sf-rule)] px-2 py-1 capitalize">
                        {flag.replaceAll("_", " ")}
                      </span>
                    ))}
                  </div>
                  <p className="mt-2 text-sm text-[var(--sf-ink-muted)]">
                    Options and add-ons can change ingredients. Ask the cafe before ordering if you have an allergy or dietary need.
                  </p>
                </div>
              ) : null}
            </div>
          </section>

          <AddToCartCustomizer item={item} orderingAvailable={item.available} />
        </div>
      </main>
    </StorefrontShell>
  );
}
