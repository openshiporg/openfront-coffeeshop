import { CateringForm } from "../components/CateringForm";
import { StorefrontShell } from "../components/StorefrontShell";
import { getCheckoutCustomer } from "../lib/data/account";
import { getCoffeeStoreResult } from "../lib/data/store";
import { CATERING_HORIZON_DAYS, CATERING_LEAD_HOURS, CATERING_MAX_GUESTS, cateringTimeZone } from "../lib/catering";
import { storeZoneAbbreviation } from "../lib/format";

export default async function CateringPage() {
  const [customer, storeResult] = await Promise.all([getCheckoutCustomer().catch(() => null), getCoffeeStoreResult()]);
  const store = storeResult.kind === "ok" ? storeResult.store : null;
  const timeZone = cateringTimeZone(store?.timezone);
  return (
    <StorefrontShell cartBar={false}>
      <main className="sf-container sf-page">
        <h1 className="sf-display sf-page-title">Catering</h1>
        <p className="sf-page-lead">Tell us about the event and we’ll reply with a quote.</p>
        {store ? (
          <div className="sf-split">
            <div className="min-w-0">
              <CateringForm customer={customer} timeZone={timeZone} zoneLabel={storeZoneAbbreviation(timeZone)} />
            </div>
            {/* The request rules the server enforces (lib/catering mirrors them); no invented minimums or packages. */}
            <aside className="sf-panel sf-sticky-panel" aria-labelledby="catering-rules-title">
              <h2 id="catering-rules-title" className="sf-display sf-panel-title">Before you ask</h2>
              <dl className="sf-rules">
                <div>
                  <dt>Notice</dt>
                  <dd>At least {CATERING_LEAD_HOURS} hours before the event</dd>
                </div>
                <div>
                  <dt>Booking ahead</dt>
                  <dd>Up to {CATERING_HORIZON_DAYS} days out</dd>
                </div>
                <div>
                  <dt>Group size</dt>
                  <dd>Up to {CATERING_MAX_GUESTS.toLocaleString("en-US")} guests online; contact the café for more</dd>
                </div>
                <div>
                  <dt>What happens next</dt>
                  <dd>Signed in, you can follow it in your account as it moves from requested to quoted to confirmed</dd>
                </div>
                {store.address ? (
                  <div>
                    <dt>Café</dt>
                    <dd>{store.address}</dd>
                  </div>
                ) : null}
              </dl>
            </aside>
          </div>
        ) : (
          <div className="sf-empty" role="status"><strong>Catering unavailable</strong></div>
        )}
      </main>
    </StorefrontShell>
  );
}
