import Link from "next/link";
import { StorefrontFrame } from "@/features/storefront/components/StorefrontLayout";
import { StorefrontShell } from "@/features/storefront/components/StorefrontShell";
import { getCoffeeStoreResult } from "@/features/storefront/lib/data/store";
import HomePage, { type HomePageFilters } from "@/features/storefront/screens/HomePage";

/** Root `/` lives outside the (storefront) group, so it applies the shared storefront frame itself. */
export default async function RootHomePage({ searchParams }: { searchParams?: Promise<HomePageFilters> }) {
  const [result, filters] = await Promise.all([getCoffeeStoreResult(), searchParams ?? Promise.resolve({})]);
  return (
    <StorefrontFrame requireStore={false}>
      {result.kind === "unavailable" ? (
        <StorefrontShell>
          <main className="sf-container py-16">
            <div className="sf-empty" role="alert">
              <p>The menu is temporarily unavailable.</p>
              <Link href="/" className="sf-btn sf-btn-ghost mt-4">Try again</Link>
            </div>
          </main>
        </StorefrontShell>
      ) : (
        <HomePage store={result.kind === "ok" ? result.store : null} filters={filters} />
      )}
    </StorefrontFrame>
  );
}
