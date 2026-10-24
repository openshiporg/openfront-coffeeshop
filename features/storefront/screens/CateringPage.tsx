import { CateringForm } from "../components/CateringForm";
import { StorefrontShell } from "../components/StorefrontShell";
import { getCheckoutCustomer } from "../lib/data/account";
import { getCoffeeStoreResult } from "../lib/data/store";
import { cateringTimeZone } from "../lib/catering";
import { storeZoneAbbreviation } from "../lib/format";

export default async function CateringPage() {
  const [customer, storeResult] = await Promise.all([getCheckoutCustomer().catch(() => null), getCoffeeStoreResult()]);
  const store = storeResult.kind === "ok" ? storeResult.store : null;
  const timeZone = cateringTimeZone(store?.timezone);
  return (
    <StorefrontShell cartBar={false}>
      <main className="sf-container sf-page">
        <div className="sf-catering">
          <h1 className="sf-display sf-page-title">Catering</h1>
          <div className="mt-6">
            {store ? (
              <CateringForm customer={customer} timeZone={timeZone} zoneLabel={storeZoneAbbreviation(timeZone)} />
            ) : (
              <div className="sf-empty" role="status"><strong>Catering unavailable</strong></div>
            )}
          </div>
        </div>
      </main>
    </StorefrontShell>
  );
}
