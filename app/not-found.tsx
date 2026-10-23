import Link from "next/link";
import { StorefrontLayout } from "@/features/storefront/components/StorefrontLayout";
import { StorefrontShell } from "@/features/storefront/components/StorefrontShell";
import "./storefront.css";

export default function NotFound() {
  return (
    <StorefrontLayout>
      <title>Page not found</title>
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
