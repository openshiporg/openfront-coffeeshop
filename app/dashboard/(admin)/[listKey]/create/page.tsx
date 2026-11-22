import { notFound } from "next/navigation";
import { CreatePage } from "@/features/dashboard/screens/CreatePage";
import { getListByPath } from "@/features/dashboard/actions/getListByPath";

// Coffee-shop guard (upstream candidate, see state/backlog/openfront.md): a role whose
// list config hides Create (`ui.hideCreate`, evaluated per session) gets a 404, not a form
// the server would refuse on save. The shared CreatePage stays identical to E-commerce.
export default async function GuardedCreatePage(props: { params: Promise<{ listKey: string }> }) {
  const { listKey } = await props.params;
  const list = await getListByPath(listKey);
  if (list?.hideCreate) notFound();
  return CreatePage(props);
}
