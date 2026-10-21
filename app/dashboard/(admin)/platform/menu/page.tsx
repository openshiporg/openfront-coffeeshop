import { MenuManagerPage } from "@/features/platform/menu/screens/MenuManagerPage";

type Param = string | string[] | undefined;
const single = (value: Param) => (typeof value === "string" ? value : "");

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: Param; category?: Param; cursor?: Param }> }) {
  const params = await searchParams;
  return <MenuManagerPage search={single(params.q).trim().slice(0, 200)} categoryId={single(params.category)} cursor={single(params.cursor) || null} />;
}
