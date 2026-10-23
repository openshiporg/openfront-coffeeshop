import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
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
        <main className="sf-container sf-page">
          <div className="sf-empty" role="alert">
            <strong>Item unavailable</strong>
            <span>Your cart is unchanged.</span>
            <div className="mt-3 flex flex-wrap justify-center gap-3">
              <a href={`/menu/${encodeURIComponent(id)}`} className="sf-btn sf-btn-ghost">Try again</a>
              <Link href="/#menu" className="sf-btn sf-btn-ghost">Back to menu</Link>
            </div>
          </div>
        </main>
      </StorefrontShell>
    );
  }
  const item = result.item;
  // Retail goods (bagged beans) skip the drink details and barista notes.
  const retail = item.barStation === "retail_shelf";

  return (
    <StorefrontShell cartBar={false}>
      <main className="sf-container sf-page sf-has-addbar !pt-0 sm:!pt-4">
        <div className="sf-split">
          <section className="min-w-0">
            <div className="sf-item-hero">
              <StorefrontMedia item={item} className="h-full w-full" emphasize eager />
            </div>

            <div className="mt-5">
              <Link href="/#menu" className="sf-back-link">
                <ArrowLeft className="size-4" aria-hidden="true" />
                Menu{item.category?.name ? ` · ${item.category.name}` : ""}
              </Link>
              <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
                <h1 className="sf-display sf-page-title min-w-0 [overflow-wrap:anywhere]">{item.name}</h1>
                <p className="sf-mono text-xl font-semibold">{formatMoney(item.price)}</p>
              </div>
              {item.shortDescription ? <p className="sf-muted mt-3 max-w-2xl text-[var(--sf-text-lg)]">{item.shortDescription}</p> : null}

              <div className="sf-chips mt-5">
                {item.availability === "later" ? <span className="sf-chip sf-status"><span className="sf-dot sf-dot-closed" aria-hidden="true" />Order ahead</span> : null}
                {item.availability === "sold_out" ? <span className="sf-chip sf-status"><span className="sf-dot sf-dot-cancelled" aria-hidden="true" />Sold out</span> : null}
                {item.prepTimeMinutes && !retail ? <span className="sf-chip">{item.prepTimeMinutes} min prep</span> : null}
                {item.caffeineMg != null ? <span className="sf-chip">{item.caffeineMg} mg caffeine</span> : null}
                {retail ? null : item.temperatureOptions?.map((option) => <span key={option} className="sf-chip">{option}</span>)}
                {item.dietaryFlags?.map((flag) => <span key={flag} className="sf-chip">{flag.replaceAll("_", " ")}</span>)}
              </div>
              {item.dietaryFlags?.length ? (
                <p className="mt-3 text-sm text-[var(--sf-ink-faint)]">Dietary notes apply to the standard recipe. Options can change ingredients.</p>
              ) : null}
            </div>
          </section>

          <AddToCartCustomizer item={item} orderingAvailable={item.available} notes={!retail} />
        </div>
      </main>
    </StorefrontShell>
  );
}
