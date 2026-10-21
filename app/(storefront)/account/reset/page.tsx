import { StorefrontShell } from "@/features/storefront/components/StorefrontShell";
import { CustomerPasswordResetForm } from "@/features/storefront/components/CustomerPasswordResetForm";

export const dynamic = "force-dynamic";

export default async function CustomerPasswordResetPage({ searchParams }: { searchParams: Promise<{ token?: string | string[] }> }) {
  const { token } = await searchParams;
  const value = typeof token === "string" && token.length <= 512 ? token : undefined;
  return (
    <StorefrontShell>
      <main className="sf-container py-16">
        <CustomerPasswordResetForm token={value} />
      </main>
    </StorefrontShell>
  );
}
