import { OrderConfirmedPage } from "@/features/storefront/screens/OrderConfirmedPage";

export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string; key?: string }> }) {
  const { id, key } = await searchParams;
  return <OrderConfirmedPage id={id} secretKey={key} />;
}
