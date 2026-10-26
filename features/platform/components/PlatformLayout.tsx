import type { ReactNode } from "react";

/*
 * Flat controls for every platform screen. The shared shadcn Button (components/ui,
 * identical to E-commerce and not ours to edit) draws a bevel: gradient, 2px bottom
 * border, drop shadow and an inset ring. Inside the platform the owner's rule is flat
 * 6px controls with a filled ink primary, so the bevel is neutralised here, scoped to
 * the platform subtree. Focus rings are kept.
 */
const flatButtons = [
  "[&_[data-slot=button]]:shadow-none",
  "[&_[data-slot=button]]:inset-shadow-none",
  "[&_[data-slot=button]]:border-b",
  "[&_[data-slot=button]:not(:focus-visible)]:ring-0",
  "[&_[data-slot=button]]:rounded-[6px]",
  "[&_[data-slot=button][class*=from-primary]]:bg-none",
  "[&_[data-slot=button][class*=from-primary]]:bg-foreground",
  "[&_[data-slot=button][class*=from-primary]]:text-background",
  "[&_[data-slot=button][class*=from-primary]]:border-transparent",
  "[&_[data-slot=button][class*=from-destructive]]:bg-none",
  "[&_[data-slot=button][class*=from-destructive]]:bg-destructive",
  "[&_[data-slot=button][class*=from-destructive]]:border-transparent",
].join(" ");

// Each platform screen renders its own PageBreadcrumbs header ending in its page label.
export function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <section className={`flex min-h-0 min-w-0 flex-1 flex-col ${flatButtons}`}>
      <div className="min-h-0 min-w-0 flex-1">{children}</div>
    </section>
  );
}
