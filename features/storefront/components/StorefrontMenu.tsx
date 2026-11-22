"use client";

import * as React from "react";
import Link from "next/link";
import * as Dialog from "@radix-ui/react-dialog";
import { Menu, X, type LucideIcon } from "lucide-react";

export type StorefrontMenuLink = { href: string; label: string; icon: LucideIcon; current?: boolean };

/**
 * The phone's menu: every storefront page in one full-height sheet. It is portalled into the
 * storefront root so it keeps the store's own colours and type.
 */
export function StorefrontMenu({ storeName, status, links }: { storeName: string; status?: string | null; links: StorefrontMenuLink[] }) {
  const [open, setOpen] = React.useState(false);
  const [container, setContainer] = React.useState<HTMLElement | null>(null);
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          type="button"
          className="sf-icon-btn"
          aria-label="Menu"
          ref={(node) => setContainer((node?.closest(".sf-root") as HTMLElement | null) ?? null)}
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal container={container}>
        <Dialog.Overlay className="sf-sheet-scrim" />
        <Dialog.Content
          className="sf-sheet"
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            // Focus the sheet itself, so a tap does not draw a ring around the close button.
            event.preventDefault();
            (event.currentTarget as HTMLElement).focus();
          }}
        >
          <div className="sf-sheet-head">
            <div className="sf-sheet-title">
              <Dialog.Title asChild><strong>{storeName}</strong></Dialog.Title>
              {status ? <span>{status}</span> : null}
            </div>
            <Dialog.Close asChild>
              <button type="button" className="sf-icon-btn" aria-label="Close menu"><X className="size-5" aria-hidden="true" /></button>
            </Dialog.Close>
          </div>
          <nav className="sf-sheet-nav" aria-label="Storefront">
            {links.map(({ href, label, icon: Icon, current }) => (
              <Link key={href} href={href} aria-current={current ? "page" : undefined} onClick={() => setOpen(false)}>
                <Icon aria-hidden="true" />{label}
              </Link>
            ))}
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
