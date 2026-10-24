import { RecipeDetailPage } from "@/features/platform/recipes/screens/RecipeDetailPage";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RecipeDetailPage id={id} />;
}
