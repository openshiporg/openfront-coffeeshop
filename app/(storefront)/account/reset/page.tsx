import type { Metadata } from "next";
import { StorefrontShell } from "@/features/storefront/components/StorefrontShell";
import { CustomerPasswordResetForm } from "@/features/storefront/components/CustomerPasswordResetForm";

import { storefrontTitle } from "@/features/storefront/lib/data/store";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  return { title: await storefrontTitle("Reset password") };
}

export default async function CustomerPasswordResetPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  const value = typeof token === "string" && token.length <= 512 ? token : undefined;
  return (
    <StorefrontShell>
      <main className="sf-container sf-page">
        <CustomerPasswordResetForm token={value} />
      </main>
    </StorefrontShell>
  );
}
