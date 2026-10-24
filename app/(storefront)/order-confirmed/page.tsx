import type { Metadata } from "next";
import { OrderConfirmedPage, loadOrderReceipt } from "@/features/storefront/screens/OrderConfirmedPage";
import { storefrontTitle } from "@/features/storefront/lib/data/store";

export const dynamic = "force-dynamic";

type Params = { searchParams: Promise<{ id?: string; key?: string }> };

export async function generateMetadata({ searchParams }: Params): Promise<Metadata> {
  const { id, key } = await searchParams;
  const response = await loadOrderReceipt(id, key).catch(() => null);
  const orderNumber = response?.success ? response.data.getCafeOrder?.orderNumber : null;
  return { title: await storefrontTitle(orderNumber ? `Order #${orderNumber}` : "Your order") };
}

export default async function Page({ searchParams }: Params) {
  const { id, key } = await searchParams;
  return <OrderConfirmedPage id={id} secretKey={key} />;
}
