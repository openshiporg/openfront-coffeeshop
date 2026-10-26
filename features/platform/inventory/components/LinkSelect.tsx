"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * A compact native select whose options are URLs: choosing one navigates. Used where a
 * long row of filter tabs would otherwise wrap (category, tier, sort). Square 6px corners.
 */
export function LinkSelect({
  label,
  value,
  options,
  className,
}: {
  label: string;
  value: string;
  options: Array<{ value: string; label: string; href: string }>;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <label className={cn("relative inline-flex min-w-0 items-center", className)}>
      <span className="sr-only">{label}</span>
      <select
        value={value}
        aria-busy={pending || undefined}
        onChange={(event) => {
          const next = options.find((option) => option.value === event.target.value);
          if (next) startTransition(() => router.push(next.href, { scroll: false }));
        }}
        className={cn(
          "h-9 w-full min-w-0 appearance-none rounded-[6px] border border-input bg-background pl-3 pr-8 text-sm outline-none transition-colors hover:bg-muted/50 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50",
          pending && "text-muted-foreground",
        )}
      >
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <ChevronDown className="pointer-events-none absolute right-2.5 size-4 text-muted-foreground" aria-hidden="true" />
    </label>
  );
}
