import Link from "next/link";
import { notFound } from "next/navigation";

import { Alert, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { PageContainer } from "@/features/dashboard/components/PageContainer";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { PlatformHeader, PlatformSection } from "@/features/platform/components/PlatformPage";
import { StatusDot } from "@/features/platform/components/StatusTitle";
import { formatStoreDateTime } from "@/lib/date-time";
import { cn } from "@/lib/utils";
import { CateringTransitions, EditCateringFactsSheet, NotesEditor, QuoteEditor } from "../components/CateringDetailControls";
import {
  CATERING_STATUS_LABELS,
  CATERING_STATUS_TONES,
  cateringSource,
  customerPhone,
  eventFactsEditable,
  quoteEditable,
  type CateringOrderRecord,
} from "../lib/catering";
import { loadRoleFlags, loadStoreRecord } from "../lib/store-context";
import { formatMoney, instantToStoreLocal } from "../lib/store-time";

const DETAIL_QUERY = `
  query PlatformCateringDetail($id: ID!) {
    cateringOrder(where: { id: $id }) {
      id cateringNumber customerName customerEmail status eventAt guestCount deliveryAddress subtotalCents notes metadata createdAt updatedAt
    }
  }
`;

const STEPS = ["inquiry", "quoted", "confirmed", "completed"] as const;

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm [overflow-wrap:anywhere]">{children}</dd>
    </div>
  );
}

function StatusTimeline({ order, timezone }: { order: CateringOrderRecord; timezone: string }) {
  const cancelled = order.status === "cancelled";
  const reached = cancelled ? -1 : STEPS.indexOf(order.status as (typeof STEPS)[number]);
  return (
    <ol className="grid gap-3">
      {STEPS.map((step, index) => {
        const done = index <= reached;
        const current = index === reached;
        const date = index === 0 ? order.createdAt : current ? order.updatedAt : null;
        return (
          <li key={step} className="flex items-baseline gap-3">
            <StatusDot tone={done ? CATERING_STATUS_TONES[step] || "zinc" : "zinc"} className={cn(!done && "opacity-40")} />
            <span className={cn("text-sm", done ? "font-medium" : "text-muted-foreground")}>{CATERING_STATUS_LABELS[step]}</span>
            {date && (done || index === 0) ? <span className="text-xs tabular-nums text-muted-foreground">{formatStoreDateTime(date, timezone)}</span> : null}
          </li>
        );
      })}
      {cancelled ? (
        <li className="flex items-baseline gap-3">
          <StatusDot tone="red" />
          <span className="text-sm font-medium">Cancelled</span>
          {order.updatedAt ? <span className="text-xs tabular-nums text-muted-foreground">{formatStoreDateTime(order.updatedAt, timezone)}</span> : null}
        </li>
      ) : null}
    </ol>
  );
}

export async function CateringDetailPage({ id }: { id: string }) {
  const [response, store, role] = await Promise.all([
    keystoneClient<{ cateringOrder: CateringOrderRecord | null }>(DETAIL_QUERY, { id }, { cache: "no-store" }),
    loadStoreRecord(),
    loadRoleFlags(),
  ]);
  if (response.success && !response.data.cateringOrder) notFound();
  const order = response.success ? response.data.cateringOrder : null;
  const canManage = Boolean(role.canManageOrders);
  const breadcrumbs = [
    { type: "link" as const, label: "Dashboard", href: "/dashboard" },
    { type: "page" as const, label: "Platform" },
    { type: "link" as const, label: "Catering", href: "/dashboard/platform/catering" },
    { type: "page" as const, label: order?.cateringNumber || "Order" },
  ];

  if (!order) {
    return (
      <PageContainer title="Catering" breadcrumbs={breadcrumbs}>
        <div className="space-y-3 px-4 md:px-6">
          <Alert variant="destructive" role="alert"><AlertTitle>Unable to load this catering order</AlertTitle></Alert>
          <Button asChild variant="outline" size="sm" className="rounded-[6px]"><Link href={`/dashboard/platform/catering/${id}`}>Try again</Link></Button>
        </div>
      </PageContainer>
    );
  }

  const phone = customerPhone(order.metadata);
  const source = cateringSource(order.metadata);
  const subtotal = order.subtotalCents || 0;
  const factsEditable = eventFactsEditable(order.status);
  const header = (
    <PlatformHeader
      title={(
        <span className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
          <span className="inline-flex min-w-0 items-start gap-2">
            <span className="inline-flex h-[1lh] shrink-0 items-center"><StatusDot tone={CATERING_STATUS_TONES[order.status] || "zinc"} className="translate-y-0" /></span>
            <span className="min-w-0 [overflow-wrap:anywhere]">{order.cateringNumber} · {order.customerName || "Guest"}</span>
          </span>
          <span className="text-sm font-medium text-muted-foreground">{CATERING_STATUS_LABELS[order.status] || order.status}</span>
        </span>
      )}
      meta={<>{source ? <span>{source}</span> : null}{order.createdAt ? <span>Received {formatStoreDateTime(order.createdAt, store.timezone)}</span> : null}</>}
      actions={canManage ? <CateringTransitions orderId={order.id} status={order.status} subtotalCents={subtotal} /> : null}
    />
  );

  return (
    <PageContainer title={order.cateringNumber} header={header} breadcrumbs={breadcrumbs}>
      <div className="grid gap-8 px-4 pb-24 md:px-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div className="min-w-0 space-y-8">
          <PlatformSection
            id="catering-event"
            title="Event"
            actions={canManage ? (
              <EditCateringFactsSheet
                orderId={order.id}
                timezone={store.timezone}
                disabled={!factsEditable}
                initial={{
                  customerName: order.customerName || "",
                  customerEmail: order.customerEmail || "",
                  customerPhone: phone || "",
                  eventAtLocal: instantToStoreLocal(order.eventAt, store.timezone),
                  guestCount: String(order.guestCount ?? ""),
                  deliveryAddress: order.deliveryAddress || "",
                  notes: "",
                }}
              />
            ) : null}
          >
            <dl className="grid gap-4 rounded-[6px] border border-border bg-card p-4 sm:grid-cols-2">
              <Fact label="Event time">{order.eventAt ? formatStoreDateTime(order.eventAt, store.timezone) : "Not set"}</Fact>
              <Fact label="Guests">{order.guestCount || 0}</Fact>
              <Fact label="Delivery address">{order.deliveryAddress || "Not set"}</Fact>
              <Fact label="Customer">{order.customerName || "Guest"}</Fact>
              <Fact label="Email">{order.customerEmail ? <a className="underline-offset-2 hover:underline" href={`mailto:${order.customerEmail}`}>{order.customerEmail}</a> : "Not set"}</Fact>
              <Fact label="Phone">{phone ? <a className="underline-offset-2 hover:underline" href={`tel:${phone}`}>{phone}</a> : "Not set"}</Fact>
            </dl>
            {canManage && !factsEditable ? <p className="text-xs text-muted-foreground">Event details locked.</p> : null}
          </PlatformSection>

          <PlatformSection id="catering-quote-heading" title="Quote" meta={subtotal > 0 ? formatMoney(subtotal, store.currencyCode) : "Not set"}>
            {canManage ? (
              <QuoteEditor key={subtotal} orderId={order.id} subtotalCents={subtotal} editable={quoteEditable(order.status)} />
            ) : null}
          </PlatformSection>

          <PlatformSection id="catering-notes-heading" title="Notes">
            {canManage ? (
              <NotesEditor key={order.updatedAt || ""} orderId={order.id} notes={order.notes || ""} disabled={false} />
            ) : (
              <p className="whitespace-pre-wrap text-sm">{order.notes || "No notes."}</p>
            )}
          </PlatformSection>
        </div>

        <PlatformSection id="catering-status-heading" title="Status">
          <div className="rounded-[6px] border border-border bg-card p-4">
            <StatusTimeline order={order} timezone={store.timezone} />
          </div>
        </PlatformSection>
      </div>
    </PageContainer>
  );
}
