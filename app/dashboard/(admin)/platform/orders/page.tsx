import { OrderListPage } from "@/features/platform/orders/screens/OrderListPage";
import { ORDER_FULFILLMENT_FILTERS, ORDER_STATUS_FILTERS, type OrderFulfillmentFilter, type OrderStatusFilter } from "@/features/platform/orders/types";

type SearchParams = { search?: string | string[]; status?: string | string[]; fulfillment?: string | string[]; activeCursor?: string | string[]; historyCursor?: string | string[] };

function single(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const statusParam = single(params.status);
  const fulfillmentParam = single(params.fulfillment);
  const status: OrderStatusFilter = (ORDER_STATUS_FILTERS as readonly string[]).includes(statusParam) ? statusParam as OrderStatusFilter : "all";
  const fulfillment: OrderFulfillmentFilter = (ORDER_FULFILLMENT_FILTERS as readonly string[]).includes(fulfillmentParam) ? fulfillmentParam as OrderFulfillmentFilter : "all";
  return (
    <OrderListPage
      search={single(params.search)}
      status={status}
      fulfillment={fulfillment}
      activeCursor={single(params.activeCursor) || null}
      historyCursor={single(params.historyCursor) || null}
    />
  );
}
