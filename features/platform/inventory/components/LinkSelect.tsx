"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { PlatformSelect } from "@/features/platform/components/PlatformSelect";
import { cn } from "@/lib/utils";

/**
 * A compact select whose options are URLs: choosing one navigates. Used where a
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
    <div className={cn("min-w-0", pending && "opacity-70", className)} aria-busy={pending || undefined}>
      <PlatformSelect
        aria-label={label}
        value={value}
        options={options.map(({ value: optionValue, label: optionLabel }) => ({ value: optionValue, label: optionLabel }))}
        onValueChange={(next) => {
          const target = options.find((option) => option.value === next);
          if (target && next !== value) startTransition(() => router.push(target.href, { scroll: false }));
        }}
        searchable={false}
        size="sm"
      />
    </div>
  );
}
