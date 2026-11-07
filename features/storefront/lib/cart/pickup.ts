// The pickup time chosen ahead of checkout (home pickup bar, checkout picker), kept for this tab.
// `null` means "the earliest pickup". A stored time that has passed or is no longer offered is ignored.

import * as React from "react";
import { earliestPickup, pickupSlots } from "@/features/storefront/lib/hours";
import { CART_EVENT, loadCartLines } from "./storage";

export const PICKUP_STORAGE_KEY = "openfront-coffee-pickup";
export const PICKUP_EVENT = "openfront-coffee-pickup-updated";
/** Pickup windows after the earliest time, on a fixed grid so every picker offers the same slots. */
export const PICKUP_STEP_MINUTES = 15;

function store(): Storage | null {
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

export function loadPickupChoice(): number | null {
  const raw = store()?.getItem(PICKUP_STORAGE_KEY);
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) && value > Date.now() ? value : null;
}

export function savePickupChoice(value: number | null) {
  const storage = store();
  if (!storage) return;
  try {
    if (value == null) storage.removeItem(PICKUP_STORAGE_KEY);
    else storage.setItem(PICKUP_STORAGE_KEY, String(value));
  } catch {
    // Storage blocked: the choice still applies on this page.
  }
  window.dispatchEvent(new Event(PICKUP_EVENT));
}

/** The saved choice, kept in step with other pickers on the page. */
export function usePickupChoice() {
  const [choice, setChoice] = React.useState<number | null>(null);
  React.useEffect(() => {
    const sync = () => setChoice(loadPickupChoice());
    sync();
    window.addEventListener(PICKUP_EVENT, sync);
    return () => window.removeEventListener(PICKUP_EVENT, sync);
  }, []);
  return [choice, savePickupChoice] as const;
}

type Hours = { weeklyHours: unknown; timezone: string; pickupLeadTimeMinutes: number | null };

/** Pickup slots before checkout: the earliest pickup for the bag (the rule checkout quotes with),
 *  then each later window, plus the saved choice when it is still one of them. Client only. */
export function usePickupSlots(hours: Hours) {
  const [choice, setChoice] = usePickupChoice();
  const [state, setState] = React.useState<{ ready: boolean; slots: Date[] }>({ ready: false, slots: [] });

  React.useEffect(() => {
    const update = () => {
      const prepTimes = loadCartLines().map((line) => line.prepTimeMinutes ?? null);
      const now = new Date();
      const earliest = earliestPickup(hours, now, prepTimes);
      setState({ ready: true, slots: earliest ? pickupSlots(hours.weeklyHours, hours.timezone, earliest, PICKUP_STEP_MINUTES, now) : [] });
    };
    update();
    const timer = window.setInterval(update, 60_000);
    window.addEventListener(CART_EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(CART_EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, [hours]);

  const chosen = choice != null ? state.slots.find((slot, index) => index > 0 && slot.getTime() === choice) ?? null : null;
  const choose = React.useCallback(
    (time: number) => setChoice(state.slots[0]?.getTime() === time ? null : time),
    [setChoice, state.slots],
  );
  return { ready: state.ready, slots: state.slots, earliest: state.slots[0] ?? null, chosen, choose };
}
