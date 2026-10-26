import { PageBreadcrumbs } from "@/features/dashboard/components/PageBreadcrumbs";
import { PlatformHeader } from "@/features/platform/components/PlatformPage";
import { getCoffeeStoreSettingsAction } from "../actions/store-settings";
import { getOnlinePaymentSetting } from "../actions/online-payment";
import { OnlinePaymentSetting } from "../components/OnlinePaymentSetting";
import { StoreSettingsForm } from "../components/StoreSettingsForm";

export async function StoreSettingsPage() {
  const [result, onlinePayment] = await Promise.all([getCoffeeStoreSettingsAction(), getOnlinePaymentSetting().catch(() => null)]);

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
        <PlatformHeader title="Store Settings" />
      </div>
      <StoreSettingsForm
        initialSettings={result.success ? result.data : null}
        loadError={result.success ? null : result.error}
      />
      {onlinePayment ? (
        <div className="px-4 pb-8 md:px-6">
          <OnlinePaymentSetting {...onlinePayment} />
        </div>
      ) : null}
    </section>
  );
}

export default StoreSettingsPage;
