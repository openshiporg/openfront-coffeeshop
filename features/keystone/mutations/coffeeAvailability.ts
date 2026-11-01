import { cafeCustomerError } from "../lib/cafeCustomerError";

import {
  DEFAULT_STORE_TIMEZONE,
  inServiceWindows,
  normalizeWeeklyHours,
  clockMinutes,
  zonedParts,
  type PickupQuoteSettings,
} from "../../lib/pickup-quote";

export { COFFEE_PICKUP_SCHEDULE_MAX_MINUTES, coffeeFirstPickupMinutes, normalizeWeeklyHours } from "../../lib/pickup-quote";
export type { WeeklyHour } from "../../lib/pickup-quote";
export type CoffeeAvailabilitySettings = PickupQuoteSettings;

export function getCoffeeOrderingAvailability(
  settings: CoffeeAvailabilitySettings,
  at = new Date(),
  serviceWindows: readonly string[] = ["all_day"],
) {
  const timezone = settings.timezone || DEFAULT_STORE_TIMEZONE;
  const { day, minuteOfDay } = zonedParts(at, timezone);
  const hours = normalizeWeeklyHours(settings.weeklyHours);
  const today = hours.find((entry) => entry.day === day);
  const openMinute = clockMinutes(today?.open);
  const closeMinute = clockMinutes(today?.close);
  const storeOpen = Boolean(today && !today.closed && openMinute != null && closeMinute != null && minuteOfDay >= openMinute && minuteOfDay < closeMinute);
  const itemOpen = inServiceWindows(minuteOfDay, serviceWindows);
  return {
    orderingOpen: storeOpen && itemOpen,
    storeOpen,
    itemOpen,
    timezone,
    day,
    minuteOfDay,
    today: today || null,
    pickupLeadTimeMinutes: Math.max(5, Number(settings.pickupLeadTimeMinutes || 12)),
  };
}

export function assertCoffeeOrderingAvailable(
  settings: CoffeeAvailabilitySettings,
  at = new Date(),
  serviceWindows: readonly string[] = ["all_day"],
) {
  const availability = getCoffeeOrderingAvailability(settings, at, serviceWindows);
  if (!availability.storeOpen) throw cafeCustomerError("The cafe is closed for pickup at that time");
  if (!availability.itemOpen) throw cafeCustomerError("A selected item isn't served at that time");
  return availability;
}
