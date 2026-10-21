import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/features/dashboard/components/PageContainer";
import { loadPosRegister } from "../actions/create-pos-order";
import { PosRegister } from "../components/PosRegister";

const breadcrumbs = [{ type: "link" as const, label: "Dashboard", href: "/dashboard" }, { type: "page" as const, label: "POS" }];
const header = <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">POS</h1>;

export async function PosPage() {
  const result = await loadPosRegister();
  if (result.kind !== "ready") {
    return (
      <PageContainer title="POS" header={header} breadcrumbs={breadcrumbs}>
        <div className="px-4 pb-8 md:px-6">
          <div role="alert" className="rounded-lg border border-border bg-card p-4 text-sm text-card-foreground">
            <p className="font-medium">The register is unavailable right now.</p>
            <p className="mt-1 text-muted-foreground">The menu and drawer status could not be loaded, so no sales or drawer actions are offered. Nothing has been changed.</p>
            <Button asChild variant="outline" className="mt-3"><Link href="/dashboard/platform/pos" prefetch={false}>Try again</Link></Button>
          </div>
        </div>
      </PageContainer>
    );
  }
  return (
    <PageContainer title="POS" header={header} breadcrumbs={breadcrumbs}>
      <PosRegister initial={result.data} />
    </PageContainer>
  );
}
