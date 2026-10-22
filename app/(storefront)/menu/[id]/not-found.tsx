import Link from "next/link";
import { StorefrontShell } from "@/features/storefront/components/StorefrontShell";

export default function MenuItemNotFound() {
  return (
    <StorefrontShell>
      <main className="sf-container sf-page">
        <div className="sf-empty">
          <strong>Item not on the menu</strong>
          <Link href="/#menu" className="sf-btn sf-btn-ghost mt-3">Back to menu</Link>
        </div>
      </main>
    </StorefrontShell>
  );
}
