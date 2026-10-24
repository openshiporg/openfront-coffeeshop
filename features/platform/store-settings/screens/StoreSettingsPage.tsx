import { PageBreadcrumbs } from "@/features/dashboard/components/PageBreadcrumbs";
import { PlatformHeader } from "@/features/platform/components/PlatformPage";
import { StatusDot } from "@/features/platform/components/StatusTitle";
import { getCoffeeStoreSettingsAction } from "../actions/store-settings";
import { StoreSettingsForm } from "../components/StoreSettingsForm";

export async function StoreSettingsPage() {
  const result = await getCoffeeStoreSettingsAction();
  const contactMissing = result.success && Boolean(result.data) && !String(result.data?.contactEmail || "").trim();

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
        <PlatformHeader
          title="Store Settings"
          meta={contactMissing ? <span className="inline-flex items-center gap-2"><StatusDot tone="amber" />Contact email missing</span> : undefined}
        />
      </div>
      <StoreSettingsForm
        initialSettings={result.success ? result.data : null}
        loadError={result.success ? null : result.error}
      />
    </section>
  );
}

export default StoreSettingsPage;
