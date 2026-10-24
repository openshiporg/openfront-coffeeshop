import { RegisterListPage } from "@/features/platform/register/screens/RegisterListPage";
import { parseRegisterListState } from "@/features/platform/register/lib/registerView";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <RegisterListPage state={parseRegisterListState(await searchParams)} />;
}
