import { RegisterShiftDetailPage } from "@/features/platform/register/screens/RegisterShiftDetailPage";
import { parsePage } from "@/features/platform/register/lib/registerView";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return (
    <RegisterShiftDetailPage
      id={id}
      pages={{
        movementsPage: parsePage(query.movementsPage),
        receiptsPage: parsePage(query.receiptsPage),
        paymentsPage: parsePage(query.paymentsPage),
        refundsPage: parsePage(query.refundsPage),
      }}
    />
  );
}
