/**
 * Temperatures a menu item is served at when none are given: cold-bar drinks are iced,
 * pastries and retail goods have no serving temperature, everything else is hot.
 * Shared by onboarding and the platform "new item" command so a cold brew is never "Served hot".
 */
export const MENU_TEMPERATURES = ["hot", "iced", "blended"] as const;
export type MenuTemperature = (typeof MENU_TEMPERATURES)[number];

export function defaultTemperatureOptions(barStation: string | null | undefined): MenuTemperature[] {
  if (barStation === "cold_bar") return ["iced"];
  if (barStation === "pastry_case" || barStation === "retail_shelf") return [];
  return ["hot"];
}
