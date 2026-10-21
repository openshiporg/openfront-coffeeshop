import { CafeReportsPage } from "@/features/platform/reports/screens/CafeReportsPage";

export default function Page({ searchParams }: { searchParams: Promise<{ period?: string | string[]; startDate?: string | string[]; endDate?: string | string[]; lowStockPage?: string | string[] }> }) {
  return <CafeReportsPage searchParams={searchParams} />;
}
