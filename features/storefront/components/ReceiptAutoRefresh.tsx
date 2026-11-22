"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Re-reads the receipt every few seconds while the order is still moving (payment landing,
 * the café accepting, the drink becoming ready). Pauses while the tab is hidden.
 */
export function ReceiptAutoRefresh({ every = 3000 }: { every?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") router.refresh(); };
    const timer = window.setInterval(tick, every);
    return () => window.clearInterval(timer);
  }, [router, every]);
  return null;
}
