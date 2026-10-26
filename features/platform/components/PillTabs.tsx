import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

/*
 * Platform view tabs. The names are kept from the earlier pill kit so every
 * screen keeps compiling; they now render as flat underline tabs on one rule
 * (owner rule, 2026-10-25: no pill or rounded tabs, radii at most 6px). The row
 * scrolls sideways on narrow screens instead of wrapping. For a choice between
 * values inside a form (tender, size), use `Segmented` instead.
 */
export function PillTrack({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <div className={cn("relative max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden", className)}>
      <div role="group" aria-label={label} className="flex min-w-max items-end gap-5 border-b">
        {children}
      </div>
    </div>
  );
}

const tabClass = (active: boolean, size: "sm" | "md") =>
  cn(
    "-mb-px inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap border-b-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
    size === "md" ? "h-10" : "h-9",
    active ? "border-foreground text-foreground" : "border-transparent text-muted-foreground hover:border-border hover:text-foreground",
  );

function TabCount({ count, active }: { count?: number; active: boolean }) {
  if (typeof count !== "number") return null;
  return <span className={cn("tabular-nums text-xs", active ? "text-foreground/70" : "text-muted-foreground/80")}>{count}</span>;
}

/** URL-driven tab: stays a link and marks the current view. */
export function PillLink({ href, active, count, size = "sm", children }: { href: string; active: boolean; count?: number; size?: "sm" | "md"; children: ReactNode }) {
  return (
    <Link href={href} aria-current={active ? "page" : undefined} className={tabClass(active, size)} scroll={false}>
      {children}
      <TabCount count={count} active={active} />
    </Link>
  );
}

/** Local-state tab for in-page views. */
export function PillButton({ active, count, size = "sm", className, children, ...props }: Omit<ComponentProps<"button">, "type"> & { active: boolean; count?: number; size?: "sm" | "md" }) {
  return (
    <button type="button" aria-pressed={active} className={cn(tabClass(active, size), className)} {...props}>
      {children}
      <TabCount count={count} active={active} />
    </button>
  );
}

/** A choice between two to five values: square 6px segments on one hairline, the chosen one filled. */
export function Segmented<T extends string>({ label, value, options, onChange, size = "md", className }: {
  label: string;
  value: T;
  options: Array<{ value: T; label: ReactNode; disabled?: boolean }>;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("inline-flex max-w-full overflow-hidden rounded-[6px] border bg-background", className)}>
      {options.map((option, index) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "inline-flex flex-1 items-center justify-center gap-1.5 whitespace-nowrap px-3 font-medium transition-[background-color,color,transform] duration-150 ease-out outline-none active:scale-[0.98] focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
              size === "md" ? "h-10 text-sm" : "h-8 text-xs",
              index > 0 && "border-l",
              active ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
