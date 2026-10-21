import { CoffeeOperationsPage } from '@/features/platform/coffee-operations/screens/CoffeeOperationsPage';

export default function Page({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  return <CoffeeOperationsPage searchParams={searchParams} />;
}
