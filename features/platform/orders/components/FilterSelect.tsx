"use client";

import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Compact native select that submits its GET form as soon as the value changes. */
export function FilterSelect({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select
      {...props}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
      className={cn(
        "h-9 min-w-0 rounded-[6px] border border-input bg-background px-2.5 pr-8 text-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        className,
      )}
    >
      {children}
    </select>
  );
}
