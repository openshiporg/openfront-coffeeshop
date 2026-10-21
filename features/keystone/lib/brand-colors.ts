export const COFFEE_BRAND_COLORS = [
  { value: "copper", label: "Copper roast", hue: 55, swatch: "oklch(65% 0.11 55)" },
  { value: "amber", label: "Golden amber", hue: 82, swatch: "oklch(70% 0.12 82)" },
  { value: "forest", label: "Forest green", hue: 145, swatch: "oklch(62% 0.12 145)" },
  { value: "ocean", label: "Ocean blue", hue: 235, swatch: "oklch(64% 0.12 235)" },
  { value: "violet", label: "Deep violet", hue: 300, swatch: "oklch(65% 0.12 300)" },
  { value: "rose", label: "Roasted rose", hue: 20, swatch: "oklch(65% 0.12 20)" },
] as const;

export const COFFEE_BRAND_COLOR_VALUES = COFFEE_BRAND_COLORS.map((option) => option.value) as [
  "copper",
  "amber",
  "forest",
  "ocean",
  "violet",
  "rose",
];

export type CoffeeBrandColor = (typeof COFFEE_BRAND_COLOR_VALUES)[number];

export const DEFAULT_COFFEE_BRAND_COLOR: CoffeeBrandColor = "copper";

export function isCoffeeBrandColor(value: unknown): value is CoffeeBrandColor {
  return typeof value === "string" && (COFFEE_BRAND_COLOR_VALUES as readonly string[]).includes(value);
}

export function normalizeCoffeeBrandColor(value: unknown): CoffeeBrandColor {
  return isCoffeeBrandColor(value) ? value : DEFAULT_COFFEE_BRAND_COLOR;
}

export function getCoffeeBrandHue(value: unknown): number {
  const normalized = normalizeCoffeeBrandColor(value);
  return COFFEE_BRAND_COLORS.find((option) => option.value === normalized)?.hue ?? 55;
}

/**
 * Storefront theme hue derived from the saved logo colour (Restaurant lineage):
 * the registry artwork is drawn around hue 260, and logoColor rotates it, so the
 * accent follows the rotated mark. Unknown values normalize to the default hue.
 */
export const STORE_LOGO_BASE_HUE = 260;

export function getStoreLogoThemeHue(logoColor: unknown): number {
  const numeric = Number.parseFloat(String(logoColor ?? "0"));
  const rotation = Number.isFinite(numeric) ? ((numeric % 360) + 360) % 360 : 0;
  return Math.round(STORE_LOGO_BASE_HUE + rotation) % 360;
}
