import Link from 'next/link';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageContainer } from '@/features/dashboard/components/PageContainer';
import { keystoneClient } from '@/features/dashboard/lib/keystoneClient';
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

function EmptyRow({ colSpan, text }: { colSpan: number; text: string }) {
  return <TableRow><TableCell colSpan={colSpan} className="py-8 text-center text-sm text-muted-foreground">{text}</TableCell></TableRow>;
}

function RecentCard({ title, description, href, linkLabel, children }: { title: string; description: string; href: string; linkLabel: string; children: React.ReactNode }) {
  return (
    <Card className="min-w-0">
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-3 space-y-0">
        <div className="min-w-0 space-y-1.5">
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </div>
        <Button asChild size="sm" variant="outline"><Link href={href}>{linkLabel}</Link></Button>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <PageContainer
      title="Coffee Operations"
      header={<div><h1 className="text-2xl font-semibold tracking-tight md:text-3xl">Coffee Operations</h1><p className="text-sm text-muted-foreground">Purchasing, receiving, prep, waste and staff shifts.</p></div>}
      breadcrumbs={[{ type: 'link', label: 'Dashboard', href: '/dashboard' }, { type: 'page', label: 'Coffee Operations' }]}
    >
      <div className="space-y-6 px-4 pb-8 md:px-6">{children}</div>
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
        <div role="alert" className="rounded-lg border border-destructive/40 bg-card p-4 text-sm text-foreground">
          Coffee Operations is unavailable right now. No tasks or records are shown.{' '}
          <Link className="font-medium underline" href={operationsHref({})}>Try again</Link>
        </div>
      </Shell>
    );
  }

  const data = result.data;
  const { sections } = data;
  const tz = data.storeTimezone;

  return (
    <Shell>
      <OperationsTaskPanel data={data} urlState={urlState} />

      {sections.inventory ? (
        <div className="grid gap-4 xl:grid-cols-2">
          <RecentCard title="Recent inventory lots" description="The 8 most recently received lots." href="/dashboard/inventory-lots" linkLabel="All lots">
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader><TableRow><TableHead>Lot</TableHead><TableHead>Item</TableHead><TableHead>Remaining</TableHead><TableHead>Expires</TableHead></TableRow></TableHeader>
                <TableBody>{data.inventoryLots.length ? data.inventoryLots.map((lot) => (
                  <TableRow key={lot.id}>
                    <TableCell><div className="font-mono text-xs">{lot.lotNumber}</div><Badge className="mt-1 capitalize" variant={lot.status === 'active' ? 'default' : 'secondary'}>{label(lot.status)}</Badge></TableCell>
                    <TableCell><div>{lot.inventoryItem?.name ?? 'No item'}</div><div className="text-xs text-muted-foreground">{lot.supplier?.name ?? 'No supplier'}</div></TableCell>
                    <TableCell className="tabular-nums">{quantity(lot.quantityRemaining)} / {quantity(lot.quantityReceived)}</TableCell>
                    <TableCell className="text-xs">{lot.expiresAt ? formatStoreDateTime(lot.expiresAt, tz) : 'Not recorded'}</TableCell>
                  </TableRow>
                )) : <EmptyRow colSpan={4} text="No lots received yet." />}</TableBody>
              </Table>
            </div>
          </RecentCard>

          <RecentCard title="Recent purchase orders" description="The 8 most recently created purchase orders." href="/dashboard/purchase-orders" linkLabel="All purchase orders">
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader><TableRow><TableHead>Order</TableHead><TableHead>Supplier</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Subtotal</TableHead></TableRow></TableHeader>
                <TableBody>{data.purchaseOrders.length ? data.purchaseOrders.map((po) => (
                  <TableRow key={po.id}>
                    <TableCell className="font-mono text-xs">{po.poNumber}</TableCell>
                    <TableCell>{po.supplier?.name ?? 'No supplier'}</TableCell>
                    <TableCell className="capitalize">{label(po.status)}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(po.subtotalCents)}</TableCell>
                  </TableRow>
                )) : <EmptyRow colSpan={4} text="No purchase orders yet." />}</TableBody>
              </Table>
            </div>
          </RecentCard>

          <RecentCard title="Recent prep batches" description="The 8 most recently completed batches." href="/dashboard/prep-batches" linkLabel="All prep batches">
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader><TableRow><TableHead>Batch</TableHead><TableHead>Recipe</TableHead><TableHead>Made</TableHead><TableHead>Expires</TableHead></TableRow></TableHeader>
                <TableBody>{data.prepBatches.length ? data.prepBatches.map((batch) => (
                  <TableRow key={batch.id}>
                    <TableCell><div className="font-mono text-xs">{batch.batchNumber}</div><div className="text-xs capitalize text-muted-foreground">{label(batch.status)}</div></TableCell>
                    <TableCell>{batch.recipe?.name ?? 'No recipe'}</TableCell>
                    <TableCell className="tabular-nums">{quantity(batch.quantityMade)}</TableCell>
                    <TableCell className="text-xs">{batch.expiresAt ? formatStoreDateTime(batch.expiresAt, tz) : 'Not recorded'}</TableCell>
                  </TableRow>
                )) : <EmptyRow colSpan={4} text="No prep batches yet." />}</TableBody>
              </Table>
            </div>
          </RecentCard>

          <RecentCard title="Recent waste" description="The 8 most recently recorded waste entries." href="/dashboard/waste-logs" linkLabel="All waste">
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader><TableRow><TableHead>Entry</TableHead><TableHead>Source</TableHead><TableHead>Quantity</TableHead><TableHead className="text-right">Cost</TableHead></TableRow></TableHeader>
                <TableBody>{data.wasteLogs.length ? data.wasteLogs.map((waste) => (
                  <TableRow key={waste.id}>
                    <TableCell><div className="font-mono text-xs">{waste.logNumber}</div><div className="text-xs capitalize text-muted-foreground">{label(waste.reason)}</div></TableCell>
                    <TableCell>{waste.inventoryItem?.name ?? waste.prepBatch?.batchNumber ?? 'Unknown source'}</TableCell>
                    <TableCell className="tabular-nums">{quantity(waste.quantity)} {waste.unit}</TableCell>
                    <TableCell className="text-right tabular-nums">{money(waste.costCents)}</TableCell>
                  </TableRow>
                )) : <EmptyRow colSpan={4} text="No waste recorded yet." />}</TableBody>
              </Table>
            </div>
          </RecentCard>

          <RecentCard title="Recently added suppliers" description="The 8 most recently added suppliers." href="/dashboard/suppliers" linkLabel="All suppliers">
            <div className="grid gap-3 md:grid-cols-2">
              {data.suppliers.map((supplier) => <div key={supplier.id} className="min-w-0 rounded-lg border p-4"><div className="break-words font-medium">{supplier.name}</div><p className="text-sm capitalize text-muted-foreground">{label(supplier.status)} · {supplier.contactName || 'No contact'} · {supplier.leadTimeDays ?? 0}d lead time</p><p className="mt-1 break-words text-xs text-muted-foreground">{supplier.email || supplier.phone || 'No contact details'}</p></div>)}
              {!data.suppliers.length ? <p className="text-sm text-muted-foreground">No suppliers yet.</p> : null}
            </div>
          </RecentCard>
        </div>
      ) : null}

      {sections.products ? (
        <RecentCard title="Recent recipes" description="The 8 most recently added recipes and ingredients." href="/dashboard/recipes" linkLabel="All recipes">
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader><TableRow><TableHead>Recipe</TableHead><TableHead>Status</TableHead><TableHead>Yield</TableHead><TableHead className="text-right">Details</TableHead></TableRow></TableHeader>
              <TableBody>{data.recipes.length ? data.recipes.map((recipe) => (
                <TableRow key={recipe.id}>
                  <TableCell><div className="font-medium">{recipe.name}</div><div className="text-xs text-muted-foreground">{recipe.menuItem?.name ?? 'No menu item'}</div></TableCell>
                  <TableCell><Badge className="capitalize" variant={recipe.active ? 'default' : 'secondary'}>{label(recipe.status)}</Badge></TableCell>
                  <TableCell className="tabular-nums">{quantity(recipe.yieldQuantity)} {recipe.yieldUnit ?? ''}</TableCell>
                  <TableCell className="text-right"><Button asChild size="sm" variant="ghost"><Link href={`/dashboard/recipes/${recipe.id}`}>Open</Link></Button></TableCell>
                </TableRow>
              )) : <EmptyRow colSpan={4} text="No recipes yet." />}</TableBody>
            </Table>
          </div>
          {data.ingredients.length ? (
            <ul className="mt-4 grid gap-2 md:grid-cols-2">
              {data.ingredients.map((ingredient) => <li key={ingredient.id} className="min-w-0 rounded-lg border p-3 text-sm"><span className="font-medium">{ingredient.name}</span> <span className="text-muted-foreground">· {quantity(ingredient.quantity)} {ingredient.unit} · {ingredient.recipe?.name ?? 'No recipe'}{ingredient.optional ? ' · optional' : ''}</span></li>)}
            </ul>
          ) : null}
        </RecentCard>
      ) : null}

      {sections.staffing ? (
        <RecentCard title="Recent shift history" description="The 8 most recent completed or missed shifts." href="/dashboard/staff-shifts" linkLabel="All shifts">
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader><TableRow><TableHead>Shift</TableHead><TableHead>Staff</TableHead><TableHead>Role</TableHead><TableHead>Status</TableHead></TableRow></TableHeader>
              <TableBody>{data.recentStaffShifts.length ? data.recentStaffShifts.map((item) => (
                <TableRow key={item.id}>
                  <TableCell><div className="font-mono text-xs">{item.shiftNumber}</div><div className="text-xs text-muted-foreground">{item.startsAt ? formatStoreDateTime(item.startsAt, tz) : 'No start time'}</div></TableCell>
                  <TableCell>{item.staff?.name || item.staff?.email || 'Unassigned'}</TableCell>
                  <TableCell className="capitalize">{label(item.role)}</TableCell>
                  <TableCell><Badge className="capitalize" variant={item.status === 'completed' ? 'default' : 'secondary'}>{label(item.status)}</Badge></TableCell>
                </TableRow>
              )) : <EmptyRow colSpan={4} text="No completed or missed shifts yet." />}</TableBody>
            </Table>
          </div>
        </RecentCard>
      ) : null}

      {sections.payments ? (
        <RecentCard title="Recent register sales" description="The 8 most recent register receipts." href="/dashboard/pos-orders" linkLabel="All register sales">
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader><TableRow><TableHead>Receipt</TableHead><TableHead>Register</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Total</TableHead></TableRow></TableHeader>
              <TableBody>{data.posOrders.length ? data.posOrders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell><div className="font-mono text-xs">{order.receiptNumber}</div><div className="text-xs text-muted-foreground">{order.cashier?.name ?? 'No cashier'}</div></TableCell>
                  <TableCell>{order.registerName || 'No register'}</TableCell>
                  <TableCell className="capitalize">{label(order.status)}</TableCell>
                  <TableCell className="text-right tabular-nums">{money(order.totalCents)}</TableCell>
                </TableRow>
              )) : <EmptyRow colSpan={4} text="No register sales yet." />}</TableBody>
            </Table>
          </div>
        </RecentCard>
      ) : null}

      {sections.subscriptions || sections.catering ? (
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Subscriptions and catering</CardTitle>
            <CardDescription>View only. Subscription billing and catering bookings are not taken through this dashboard yet.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            {sections.subscriptions ? <div><h3 className="mb-2 text-sm font-semibold">Recent subscriptions</h3><div className="space-y-2">{data.subscriptions.map((item) => <div key={item.id} className="rounded-lg border p-3 text-sm"><div className="font-mono text-xs">{item.subscriptionNumber}</div><div className="text-muted-foreground">{item.planName} · {label(item.billingInterval)} · {money(item.priceCents)} · <span className="capitalize">{label(item.status)}</span></div></div>)}{!data.subscriptions.length ? <p className="text-sm text-muted-foreground">No subscriptions.</p> : null}</div></div> : null}
            {sections.catering ? <div><h3 className="mb-2 text-sm font-semibold">Recent catering inquiries</h3><div className="space-y-2">{data.cateringOrders.map((item) => <div key={item.id} className="rounded-lg border p-3 text-sm"><div className="font-mono text-xs">{item.cateringNumber}</div><div className="text-muted-foreground">{item.customerName} · {item.guestCount ?? 0} guests · {money(item.subtotalCents)} · <span className="capitalize">{label(item.status)}</span></div></div>)}{!data.cateringOrders.length ? <p className="text-sm text-muted-foreground">No catering inquiries.</p> : null}</div></div> : null}
          </CardContent>
        </Card>
      ) : null}
    </Shell>
  );
}
