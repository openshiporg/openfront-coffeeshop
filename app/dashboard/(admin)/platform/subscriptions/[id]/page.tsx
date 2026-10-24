import { SubscriptionDetailPage } from "@/features/platform/subscriptions/screens/SubscriptionDetailPage";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <SubscriptionDetailPage id={id} />;
}
