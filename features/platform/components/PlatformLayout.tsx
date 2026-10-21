import type { ReactNode } from "react";

// Each platform screen renders its own PageBreadcrumbs header ending in its page label.
export function PlatformLayout({ children }: { children: ReactNode }) {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="min-h-0 min-w-0 flex-1">{children}</div>
    </section>
  );
}
