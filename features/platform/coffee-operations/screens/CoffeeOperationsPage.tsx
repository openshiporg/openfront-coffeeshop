import Link from 'next/link';

import { ArrowUpRight } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
import { PlatformHeader, PlatformSection } from '@/features/platform/components/PlatformPage';
import { StatusTitle, type StatusTone } from '@/features/platform/components/StatusTitle';
import { formatStoreDateTime } from '@/lib/date-time';
import { loadCoffeeOperations } from '../lib/operationsResponse';
import { OPERATIONS_PARAMS, operationsHref, readOperationsUrlState, type CoffeeOperationsData } from '../lib/operationsTypes';
import { OperationsTaskPanel } from '../components/OperationsTaskPanel';

const page = 'items { id name detail unit currentStock } hasMore nextCursor loadError';
const shift = 'id shiftNumber role status startsAt endsAt clockInAt clockOutAt staff { id name email } actions { status label tone }';
const coffeeOperationsQuery = `
  query CoffeeOperationsPage(${OPERATIONS_PARAMS.map((key) => `$${key}: String`).join(', ')}) {
    getCoffeeOperations(${OPERATIONS_PARAMS.map((key) => `${key}: $${key}`).join(', ')}) {
      sections { inventory inventoryManage products staffing payments catering subscriptions }
      storeTimezone
      draftScope
      recipes { id name status yieldQuantity yieldUnit active menuItem { id name } }
      ingredients { id name quantity unit optional recipe { id name } inventoryItem { id name } }
      inventoryLots { id lotNumber quantityReceived quantityRemaining unitCostCents status expiresAt inventoryItem { id name } supplier { id name } }
      suppliers { id name status contactName email phone leadTimeDays }
      purchaseOrders { id poNumber status subtotalCents expectedAt supplier { id name } }
      prepBatches { id batchNumber status quantityMade expiresAt recipe { id name } preparedBy { id name } }
      wasteLogs { id logNumber reason quantity unit costCents inventoryItem { id name } prepBatch { batchNumber } }
      posOrders { id receiptNumber registerName status totalCents cashier { id name } }
      subscriptions { id subscriptionNumber status planName billingInterval priceCents }
      cateringOrders { id cateringNumber customerName status guestCount subtotalCents }
      recentStaffShifts { ${shift} }
      receiptPurchaseOrders { items { id poNumber status subtotalCents expectedAt orderedQuantity unitCostCents supplier { id name } inventoryItem { id name unit } } hasMore nextCursor loadError }
      purchaseSuppliers { ${page} }
      purchaseInventoryItems { ${page} }
      inventoryWasteItems { ${page} }
      wastePrepBatches { ${page} }
      prepRecipes { ${page} }
      staffMembers { ${page} }
      activeStaffShifts { items { ${shift} } hasMore nextCursor loadError totalCount }
    }
  }
`;

function money(cents?: number | null) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((cents ?? 0) / 100);
}

function quantity(value?: number | null) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 4 }).format(Number(value ?? 0));
}

function label(value?: string | null) {
  return (value || '').replaceAll('_', ' ');
}

const GOOD = new Set(['active', 'completed', 'received', 'paid', 'approved', 'confirmed', 'in_stock']);
const BAD = new Set(['cancelled', 'expired', 'missed', 'void', 'voided', 'refunded', 'inactive', 'discarded', 'depleted']);

function tone(status?: string | null): StatusTone {
  if (!status) return 'zinc';
  if (GOOD.has(status)) return 'green';
  if (BAD.has(status)) return 'red';
  return 'amber';
}

type RecordRow = { id: string; title: string; status?: string | null; detail: React.ReactNode; value?: React.ReactNode };

/** Recent records as stacked rows: identifier and status on the title line, details below. */
function RecordList({ id, title, href, rows, empty }: { id: string; title: string; href: string; rows: RecordRow[]; empty: string }) {
  return (
    <section aria-labelledby={id} className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
      <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-2.5">
        <h3 id={id} className="text-sm font-semibold">{title}</h3>
        <Button asChild size="sm" variant="ghost" className="-mr-2 rounded-full text-muted-foreground"><Link href={href}>All<ArrowUpRight aria-hidden="true" /></Link></Button>
      </header>
      {rows.length ? (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id} className="flex min-w-0 items-start justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <StatusTitle as="p" tone={tone(row.status)} status={row.status ? <span className="capitalize">{label(row.status)}</span> : null} className="text-sm font-medium">
                  {row.title}
                </StatusTitle>
                <div className="break-words pl-4 text-xs text-muted-foreground">{row.detail}</div>
              </div>
              {row.value != null ? <div className="shrink-0 text-right text-sm tabular-nums">{row.value}</div> : null}
            </li>
          ))}
        </ul>
      ) : <p className="px-4 py-6 text-center text-sm text-muted-foreground">{empty}</p>}
    </section>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PageContainer
      title="Coffee Operations"
      header={<PlatformHeader title="Coffee Operations" />}
      breadcrumbs={[{ type: 'link', label: 'Dashboard', href: '/dashboard' }, { type: 'page', label: 'Coffee Operations' }]}
    >
      <div className="space-y-8 px-4 pb-10 md:px-6">{children}</div>
    </PageContainer>
  );
}

export async function CoffeeOperationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const urlState = readOperationsUrlState(await searchParams);
  const variables = Object.fromEntries(OPERATIONS_PARAMS.map((key) => [key, urlState[key] ?? null]));
  const result = await loadCoffeeOperations<CoffeeOperationsData>(
    coffeeOperationsQuery,
    variables,
    (query, input) => keystoneClient<unknown>(query, input, { cache: 'no-store' }),
  );
  if (result.kind !== 'ready') {
    return (
      <Shell>
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <p className="font-medium">Coffee Operations unavailable.</p>
          <Button asChild size="sm" variant="outline" className="rounded-full"><Link href={operationsHref({})}>Try again</Link></Button>
        </div>
      </Shell>
    );
  }

  const data = result.data;
  const { sections } = data;
  const tz = data.storeTimezone;
  const hasRecords = sections.inventory || sections.products || sections.staffing || sections.payments || sections.subscriptions || sections.catering;

  return (
    <Shell>
      <OperationsTaskPanel data={data} urlState={urlState} />

      {hasRecords ? (
        <PlatformSection id="operations-records" title="Recent records" className="border-t border-border pt-8">
          <div className="grid items-start gap-4 lg:grid-cols-2">
            {sections.inventory ? (
              <>
                <RecordList
                  id="ops-lots"
                  title="Inventory lots"
                  href="/dashboard/inventory-lots"
                  empty="No lots received."
                  rows={data.inventoryLots.map((lot) => ({
                    id: lot.id,
                    title: lot.inventoryItem?.name ?? 'No item',
                    status: lot.status,
                    detail: <><span className="font-mono">{lot.lotNumber}</span> · {lot.supplier?.name ?? 'No supplier'} · {lot.expiresAt ? `Expires ${formatStoreDateTime(lot.expiresAt, tz)}` : 'No expiry'}</>,
                    value: <>{quantity(lot.quantityRemaining)}<span className="text-muted-foreground"> / {quantity(lot.quantityReceived)}</span></>,
                  }))}
                />
                <RecordList
                  id="ops-pos"
                  title="Purchase orders"
                  href="/dashboard/purchase-orders"
                  empty="No purchase orders."
                  rows={data.purchaseOrders.map((po) => ({
                    id: po.id,
                    title: po.poNumber,
                    status: po.status,
                    detail: po.supplier?.name ?? 'No supplier',
                    value: money(po.subtotalCents),
                  }))}
                />
                <RecordList
                  id="ops-prep"
                  title="Prep batches"
                  href="/dashboard/prep-batches"
                  empty="No prep batches."
                  rows={data.prepBatches.map((batch) => ({
                    id: batch.id,
                    title: batch.recipe?.name ?? 'No recipe',
                    status: batch.status,
                    detail: <><span className="font-mono">{batch.batchNumber}</span> · {batch.expiresAt ? `Expires ${formatStoreDateTime(batch.expiresAt, tz)}` : 'No expiry'}</>,
                    value: quantity(batch.quantityMade),
                  }))}
                />
                <RecordList
                  id="ops-waste"
                  title="Waste"
                  href="/dashboard/waste-logs"
                  empty="No waste recorded."
                  rows={data.wasteLogs.map((waste) => ({
                    id: waste.id,
                    title: waste.inventoryItem?.name ?? waste.prepBatch?.batchNumber ?? 'Unknown source',
                    detail: <><span className="font-mono">{waste.logNumber}</span> · <span className="capitalize">{label(waste.reason)}</span> · {quantity(waste.quantity)} {waste.unit}</>,
                    value: money(waste.costCents),
                  }))}
                />
                <RecordList
                  id="ops-suppliers"
                  title="Suppliers"
                  href="/dashboard/suppliers"
                  empty="No suppliers."
                  rows={data.suppliers.map((supplier) => ({
                    id: supplier.id,
                    title: supplier.name,
                    status: supplier.status,
                    detail: <>{supplier.contactName || 'No contact'} · {supplier.email || supplier.phone || 'No contact details'}</>,
                    value: <span className="text-muted-foreground">{supplier.leadTimeDays ?? 0}d lead</span>,
                  }))}
                />
              </>
            ) : null}

            {sections.products ? (
              <div className="space-y-3">
                <RecordList
                  id="ops-recipes"
                  title="Recipes"
                  href="/dashboard/recipes"
                  empty="No recipes."
                  rows={data.recipes.map((recipe) => ({
                    id: recipe.id,
                    title: recipe.name,
                    status: recipe.active ? recipe.status : recipe.status || 'inactive',
                    detail: <>{recipe.menuItem?.name ?? 'No menu item'} · Yields {quantity(recipe.yieldQuantity)} {recipe.yieldUnit ?? ''}</>,
                    value: <Link href={`/dashboard/recipes/${recipe.id}`} className="inline-flex items-center gap-0.5 text-sm font-medium underline-offset-4 hover:underline">Open<ArrowUpRight className="size-3.5" aria-hidden="true" /></Link>,
                  }))}
                />
                {data.ingredients.length ? (
                  <ul className="flex flex-wrap gap-1.5" aria-label="Recent ingredients">
                    {data.ingredients.map((ingredient) => (
                      <li key={ingredient.id} className="rounded-full bg-muted px-3 py-1 text-xs">
                        <span className="font-medium">{ingredient.name}</span>
                        <span className="text-muted-foreground"> · {quantity(ingredient.quantity)} {ingredient.unit} · {ingredient.recipe?.name ?? 'No recipe'}{ingredient.optional ? ' · optional' : ''}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}

            {sections.staffing ? (
              <RecordList
                id="ops-shifts"
                title="Shift history"
                href="/dashboard/staff-shifts"
                empty="No completed or missed shifts."
                rows={data.recentStaffShifts.map((item) => ({
                  id: item.id,
                  title: item.staff?.name || item.staff?.email || 'Unassigned',
                  status: item.status,
                  detail: <><span className="font-mono">{item.shiftNumber}</span> · <span className="capitalize">{label(item.role)}</span> · {item.startsAt ? formatStoreDateTime(item.startsAt, tz) : 'No start time'}</>,
                }))}
              />
            ) : null}

            {sections.payments ? (
              <RecordList
                id="ops-register"
                title="Register sales"
                href="/dashboard/pos-orders"
                empty="No register sales."
                rows={data.posOrders.map((order) => ({
                  id: order.id,
                  title: order.receiptNumber,
                  status: order.status,
                  detail: <>{order.registerName || 'No register'} · {order.cashier?.name ?? 'No cashier'}</>,
                  value: money(order.totalCents),
                }))}
              />
            ) : null}

            {sections.subscriptions ? (
              <RecordList
                id="ops-subscriptions"
                title="Subscriptions · view only"
                href="/dashboard/subscriptions"
                empty="No subscriptions."
                rows={data.subscriptions.map((item) => ({
                  id: item.id,
                  title: item.planName || item.subscriptionNumber,
                  status: item.status,
                  detail: <><span className="font-mono">{item.subscriptionNumber}</span> · <span className="capitalize">{label(item.billingInterval)}</span></>,
                  value: money(item.priceCents),
                }))}
              />
            ) : null}

            {sections.catering ? (
              <RecordList
                id="ops-catering"
                title="Catering · view only"
                href="/dashboard/catering-orders"
                empty="No catering inquiries."
                rows={data.cateringOrders.map((item) => ({
                  id: item.id,
                  title: item.customerName || item.cateringNumber,
                  status: item.status,
                  detail: <><span className="font-mono">{item.cateringNumber}</span> · {item.guestCount ?? 0} guests</>,
                  value: money(item.subtotalCents),
                }))}
              />
            ) : null}
          </div>
        </PlatformSection>
      ) : null}
    </Shell>
  );
}
