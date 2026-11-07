"use client";

import { useEffect } from "react";

/** Marks the storefront root once the page has scrolled, so sticky bars can show their hairline. */
export function ScrollEdge() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".sf-app");
    if (!root) return;
    const update = () => root.toggleAttribute("data-scrolled", window.scrollY > 4);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  return null;
}
