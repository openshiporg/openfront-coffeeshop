import { PageBreadcrumbs } from "@/features/dashboard/components/PageBreadcrumbs";
import { getCoffeeStoreSettingsAction } from "../actions/store-settings";
import { StoreSettingsForm } from "../components/StoreSettingsForm";

export async function StoreSettingsPage() {
  const result = await getCoffeeStoreSettingsAction();

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-background">
      <PageBreadcrumbs
        items={[
          { type: "link", label: "Dashboard", href: "" },
          { type: "page", label: "Platform" },
          { type: "page", label: "Store Settings" },
        ]}
      />
      <div className="border-b border-border px-4 py-4 md:px-6">
        <h1 className="text-2xl font-semibold tracking-tight">Store Settings</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Business details, branding, pickup policy, and opening hours.</p>
      </div>
      <StoreSettingsForm
        initialSettings={result.success ? result.data : null}
        loadError={result.success ? null : result.error}
      />
    </section>
  );
}

export default StoreSettingsPage;
