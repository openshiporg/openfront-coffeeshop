import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { AddToCartCustomizer } from "@/features/storefront/components/AddToCartCustomizer";
import { getStorefrontMenuItem } from "@/features/storefront/lib/data/menu";
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
  const lower = (value: string) => value.replaceAll("_", " ").toLowerCase();
  const temperatures = retail ? [] : (item.temperatureOptions || []).map(lower);
  const dietary = (item.dietaryFlags || []).map(lower);
  // Plain sentences from the item's own data, in place of system chips.
  const facts = [
    item.availability === "later" ? "We’re closed right now. Order ahead and pick it up after we open." : null,
    item.availability === "sold_out" ? "Sold out for now." : null,
    item.prepTimeMinutes && !retail ? `Takes about ${item.prepTimeMinutes} ${item.prepTimeMinutes === 1 ? "minute" : "minutes"} to make.` : null,
    temperatures.length ? `Served ${temperatures.join(" or ")}.` : null,
    item.caffeineMg != null ? `${item.caffeineMg} mg caffeine.` : null,
    dietary.length ? `${dietary.join(", ").replace(/^./, (c) => c.toUpperCase())} as standard. Options can change ingredients.` : null,
  ].filter((fact): fact is string => Boolean(fact));

  return (
    <StorefrontShell cartBar={false}>
      <main className="sf-container sf-page sf-has-addbar">
        <Link href="/#menu" className="sf-back-link">
          <ArrowLeft className="size-4" aria-hidden="true" />
          {item.category?.name ? `Menu: ${item.category.name}` : "Menu"}
        </Link>
        <div className="sf-item-layout">
          <section className="sf-item-intro min-w-0" aria-labelledby="item-title">
            <div className="sf-item-photo">
              <StorefrontMedia item={item} className="h-full w-full" emphasize eager sizes="(min-width: 1024px) 34rem, 100vw" />
            </div>
            <h1 id="item-title" className="sf-display sf-item-title">{item.name}</h1>
            {item.shortDescription ? <p className="sf-item-lead">{item.shortDescription}</p> : null}
            {facts.length ? (
              <ul className="sf-facts">
                {facts.map((fact) => <li key={fact}>{fact}</li>)}
              </ul>
            ) : null}
          </section>

          <AddToCartCustomizer item={item} orderingAvailable={item.available} notes={!retail} />
        </div>
      </main>
    </StorefrontShell>
  );
}
