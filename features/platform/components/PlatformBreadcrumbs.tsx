import React from "react";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AssistantHeaderButton } from "@/features/dashboard/components/AssistantHeaderButton";
import { basePath } from "@/features/dashboard/lib/config";

type Crumb = { type: "link" | "page"; label: string; href?: string };

/**
 * Platform header for screens that don't use PageContainer (KDS, Store Settings).
 * It matches PageContainer's trail: phones keep the last two crumbs, so the header is never blank.
 * The shared dashboard PageBreadcrumbs stays untouched (it hides the whole trail below md).
 */
export function PlatformBreadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-2 border-b bg-background">
      <div className="flex min-w-0 items-center gap-2 px-4">
        <SidebarTrigger className="-ml-1" />
        <Separator orientation="vertical" className="mr-2 h-4" />
        <Breadcrumb>
          <BreadcrumbList>
            {items.map((item, index) => {
              const phoneHidden = index < items.length - 2 ? "max-sm:hidden" : undefined;
              return (
                <React.Fragment key={index}>
                  <BreadcrumbItem className={phoneHidden}>
                    {item.type === "link" ? (
                      <BreadcrumbLink asChild>
                        <Link className="text-foreground" href={`${basePath}${item.href || ""}`}>{item.label}</Link>
                      </BreadcrumbLink>
                    ) : (
                      <BreadcrumbPage>{item.label}</BreadcrumbPage>
                    )}
                  </BreadcrumbItem>
                  {index < items.length - 1 ? <BreadcrumbSeparator className={phoneHidden} /> : null}
                </React.Fragment>
              );
            })}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <AssistantHeaderButton className="mr-4 shrink-0" />
    </header>
  );
}
