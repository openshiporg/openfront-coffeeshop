import type { Metadata } from "next";
import Link from "next/link";
import { StorefrontLayout } from "@/features/storefront/components/StorefrontLayout";
import { StorefrontShell } from "@/features/storefront/components/StorefrontShell";
import { getCoffeeStore } from "@/features/storefront/lib/data/store";
import "./storefront-cup.css";

export async function generateMetadata(): Promise<Metadata> {
  const store = await getCoffeeStore().catch(() => null);
  return { title: store?.name ? `Page not found · ${store.name}` : "Page not found" };
}

export default function NotFound() {
  return (
    <StorefrontLayout>
      <StorefrontShell>
        <main className="sf-container sf-page">
          <div className="sf-empty">
            <strong>Page not found</strong>
            <Link href="/#menu" className="sf-btn sf-btn-ghost mt-3">Back to menu</Link>
          </div>
        </main>
      </StorefrontShell>
    </StorefrontLayout>
  );
}
