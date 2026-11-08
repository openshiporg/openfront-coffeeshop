/**
 * Stripe's hosted Checkout page refuses to run inside an iframe ("redirect to Checkout at the top
 * level"), so a framed shop (the Oathkeeper Browser, an embed) can't show it in place. When framed,
 * a window is opened during the tap itself, so it isn't blocked as a popup, and the card page is
 * loaded into it once the order has its session. Not framed, the page just navigates as before.
 */
export type CardPageTarget = { go(url: string): void; cancel(): void };

function framed() {
  try {
    return window.top !== window.self;
  } catch {
    return true;
  }
}

/** Call synchronously inside the click or submit handler, before any await. */
export function prepareCardPage(): CardPageTarget {
  if (typeof window === "undefined" || !framed()) {
    return { go: (url) => window.location.assign(url), cancel: () => {} };
  }
  let opened: Window | null = null;
  try {
    // The opener is kept: Safari refuses to navigate the blank window later once it is cut.
    opened = window.open("", "_blank");
  } catch {
    opened = null;
  }
  return {
    go(url) {
      if (opened && !opened.closed) {
        try {
          opened.location.href = url;
          return;
        } catch {
          opened.close();
        }
      }
      try {
        // Popup blocked: leave the frame. Allowed for a frame that isn't sandboxed.
        window.top!.location.href = url;
      } catch {
        window.location.assign(url);
      }
    },
    cancel() {
      if (opened && !opened.closed) opened.close();
    },
  };
}
