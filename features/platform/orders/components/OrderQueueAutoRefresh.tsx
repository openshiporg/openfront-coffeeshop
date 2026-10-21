"use client";

import * as React from "react";
import { useRouter } from "next/navigation";

export function OrderQueueAutoRefresh() {
  const router = useRouter();

  React.useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 10000);
    return () => window.clearInterval(interval);
  }, [router]);

  return null;
}
