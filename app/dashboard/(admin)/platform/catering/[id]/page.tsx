import { CateringDetailPage } from "@/features/platform/catering/screens/CateringDetailPage";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <CateringDetailPage id={id} />;
}
