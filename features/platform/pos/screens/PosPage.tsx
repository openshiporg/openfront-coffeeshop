import Link from "next/link";

import { Button } from "@/components/ui/button";
import { PageContainer } from "@/features/dashboard/components/PageContainer";
import { PlatformHeader } from "@/features/platform/components/PlatformPage";
import { loadPosRegister } from "../actions/create-pos-order";
import { PosRegister } from "../components/PosRegister";

const breadcrumbs = [{ type: "link" as const, label: "Dashboard", href: "/dashboard" }, { type: "page" as const, label: "POS" }];
const header = <PlatformHeader title="POS" />;

export async function PosPage() {
  const result = await loadPosRegister();
  if (result.kind !== "ready") {
    return (
      <PageContainer title="POS" header={header} breadcrumbs={breadcrumbs}>
        <div className="px-4 pb-8 md:px-6">
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-[6px] border border-destructive/40 bg-destructive/5 p-4 text-sm">
            <p className="font-medium">Register unavailable. Nothing was changed.</p>
            <Button asChild variant="outline" className="rounded-[6px]"><Link href="/dashboard/platform/pos" prefetch={false}>Try again</Link></Button>
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
