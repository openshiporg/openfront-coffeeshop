import Link from "next/link";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageContainer } from "@/features/dashboard/components/PageContainer";
import { keystoneClient } from "@/features/dashboard/lib/keystoneClient";
import { PlatformEmpty, PlatformHeader, PlatformTable, platformTd } from "@/features/platform/components/PlatformPage";
import { StatusDot, type StatusTone } from "@/features/platform/components/StatusTitle";
import { cn } from "@/lib/utils";
import { RefundGiftCardButton } from "../components/RefundGiftCardButton";

const QUERY = `
  query CafeGiftCards($search: String) {
    getCafeGiftCards(search: $search) {
      outstandingCents activeCount
      cards { id code status initialValue balance currencyCode purchaserName recipientName recipientEmail activatedAt expiresAt canRefund }
    }
  }
`;

type GiftCardRow = { id: string; code: string; status: string; initialValue: number; balance: number; currencyCode: string; purchaserName?: string | null; recipientName?: string | null; recipientEmail?: string | null; activatedAt?: string | null; expiresAt?: string | null; canRefund: boolean };
type Result = { getCafeGiftCards: { outstandingCents: number; activeCount: number; cards: GiftCardRow[] } };

const STATUS: Record<string, { label: string; tone: StatusTone }> = {
  active: { label: "Active", tone: "green" },
  redeemed: { label: "Used up", tone: "zinc" },
  cancelled: { label: "Refunded", tone: "red" },
};
const money = (cents: number, currency = "USD") => new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents / 100);
const day = (value?: string | null) => (value ? new Date(value).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—");

export async function GiftCardListPage({ search = "" }: { search?: string }) {
  const response = await keystoneClient<Result>(QUERY, { search: search || null }, { cache: "no-store" });
  const data = response.success ? response.data.getCafeGiftCards : null;
  return (
    <PageContainer
      title="Gift cards"
      header={<PlatformHeader title="Gift cards" meta={data ? <><span className="tabular-nums">{data.activeCount} active</span><span className="tabular-nums">{money(data.outstandingCents)} outstanding</span></> : null} />}
      breadcrumbs={[{ type: "link", label: "Dashboard", href: "/dashboard" }, { type: "page", label: "Platform" }, { type: "page", label: "Gift cards" }]}
    >
      <div className="space-y-4 px-4 pb-24 md:px-6">
        <p className="max-w-2xl text-sm text-muted-foreground">Sold on the storefront at /gift-cards and paid on Stripe. Take one as payment from an order’s “Gift card” button.</p>
        <form method="get" role="search" className="flex max-w-2xl items-center gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <label htmlFor="gift-search" className="sr-only">Find a gift card</label>
            <Input id="gift-search" type="search" name="search" defaultValue={search} placeholder="Code, name or email" autoComplete="off" className="h-10 rounded-[6px] pl-9 text-base md:text-sm" />
          </div>
          <Button type="submit" className="h-10 rounded-[6px] active:scale-[0.97]">Find</Button>
          {search ? <Button asChild variant="ghost" className="h-10 rounded-[6px]"><Link href="/dashboard/platform/gift-cards">Clear</Link></Button> : null}
        </form>
        {!data ? (
          <p role="alert" className="text-sm text-destructive">Unable to load gift cards.</p>
        ) : !data.cards.length ? (
          <PlatformEmpty>{search ? `No gift cards match "${search}".` : "No gift cards sold yet. They appear here as soon as a purchase clears."}</PlatformEmpty>
        ) : (
          <PlatformTable
            label="Gift cards"
            head={[
              { label: "Code" },
              { label: "For" },
              { label: "Status" },
              { label: "Balance", className: "text-right" },
              { label: "Sold", className: "hidden md:table-cell" },
              { label: "Expires", className: "hidden lg:table-cell" },
              { label: <span className="sr-only">Actions</span>, className: "w-0" },
            ]}
          >
            {data.cards.map((card) => {
              const status = STATUS[card.status] || { label: card.status, tone: "zinc" as StatusTone };
              return (
                <tr key={card.id} className="transition-colors hover:bg-muted/30">
                  <td className={cn(platformTd, "whitespace-nowrap font-mono")}>{card.code}</td>
                  <td className={cn(platformTd, "min-w-32 max-w-64")}>
                    <span className="font-medium [overflow-wrap:anywhere]">{card.recipientName || "Guest"}</span>
                    {card.purchaserName && card.purchaserName !== card.recipientName ? <p className="truncate text-xs text-muted-foreground">from {card.purchaserName}</p> : null}
                  </td>
                  <td className={cn(platformTd, "whitespace-nowrap")}><span className="inline-flex items-center gap-2"><StatusDot tone={status.tone} />{status.label}</span></td>
                  <td className={cn(platformTd, "whitespace-nowrap text-right tabular-nums")}>{money(card.balance, card.currencyCode)}<span className="text-muted-foreground"> / {money(card.initialValue, card.currencyCode)}</span></td>
                  <td className={cn(platformTd, "hidden whitespace-nowrap text-muted-foreground md:table-cell")}>{day(card.activatedAt)}</td>
                  <td className={cn(platformTd, "hidden whitespace-nowrap text-muted-foreground lg:table-cell")}>{day(card.expiresAt)}</td>
                  <td className={cn(platformTd, "whitespace-nowrap py-1.5 text-right")}>
                    {card.canRefund ? <RefundGiftCardButton giftCardId={card.id} code={card.code} amountLabel={money(card.initialValue, card.currencyCode)} /> : null}
                  </td>
                </tr>
              );
            })}
          </PlatformTable>
        )}
      </div>
    </PageContainer>
  );
}
