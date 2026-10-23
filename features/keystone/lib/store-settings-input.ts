import { z } from "zod";
import { validCoffeeTimezone } from "./store-locale-policy";
import { sanitizeStoreLogoSvg } from "../../lib/sanitize-store-logo";
import { DEFAULT_STORE_LOGO_ICON, normalizeStoreLogoColor } from "../../platform/store-settings/lib/store-logo";

import {
  COFFEE_BRAND_COLOR_VALUES,
  DEFAULT_COFFEE_BRAND_COLOR,
} from "./brand-colors";

export const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const PICKUP_LIMITS = {
  pickupLeadTimeMinutes: { min: 5, max: 240 },
  pickupWindowMinutes: { min: 5, max: 120 },
  pickupCapacityPerWindow: { min: 1, max: 500 },
  taxRateBasisPoints: { min: 0, max: 10_000 },
} as const;

const timeValue = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM times");
const minutesOf = (value: string) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));

export const weeklyHoursSchema = z.array(
  z.object({
    day: z.enum(WEEKDAYS),
    open: timeValue.optional(),
    close: timeValue.optional(),
    closed: z.boolean().optional(),
  }).superRefine((row, context) => {
    if (row.closed) return;
    if (!row.open || !row.close) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${row.day} needs opening and closing times` });
    } else if (minutesOf(row.close) <= minutesOf(row.open)) {
      context.addIssue({ code: z.ZodIssueCode.custom, message: `${row.day} must close after it opens` });
    }
  }),
).max(7).superRefine((rows, context) => {
  if (new Set(rows.map((row) => row.day)).size !== rows.length) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: "Each weekday may appear only once" });
  }
});

const boundedInt = (key: keyof typeof PICKUP_LIMITS, label: string) =>
  z.number({ invalid_type_error: `${label} must be a whole number` })
    .int(`${label} must be a whole number`)
    .min(PICKUP_LIMITS[key].min, `${label} must be at least ${PICKUP_LIMITS[key].min}`)
    .max(PICKUP_LIMITS[key].max, `${label} must be at most ${PICKUP_LIMITS[key].max}`);

/** Basis points with up to two decimals: 887.5 is 8.875%. */
const taxBasisPoints = z.number({ invalid_type_error: "Tax rate must be a number" })
  .min(PICKUP_LIMITS.taxRateBasisPoints.min, "Tax rate can't be negative")
  .max(PICKUP_LIMITS.taxRateBasisPoints.max, "Tax rate must be at most 100%")
  .refine((value) => Math.abs(Math.round(value * 100) - value * 100) < 1e-6, "Tax rate allows at most three decimals of a percent");

export const coffeeStoreSettingsInputSchema = z.object({
  name: z.string().trim().min(1, "Store name is required").max(200),
  tagline: z.string().trim().max(300).default(""),
  description: z.string().trim().max(2000).default(""),
  address: z.string().trim().min(1, "Address is required").max(500),
  phone: z.string().trim().max(100).default(""),
  contactEmail: z.string().trim().email("Enter a valid contact email"),
  currencyCode: z.string().trim().transform((value) => value.toUpperCase()).pipe(z.literal("USD")),
  locale: z.literal("en-US"),
  timezone: z.string().trim().min(3).max(100).refine(validCoffeeTimezone, "Enter a valid IANA timezone"),
  // Retained for stored-record compatibility; the storefront theme follows logoColor.
  brandColor: z.enum(COFFEE_BRAND_COLOR_VALUES).default(DEFAULT_COFFEE_BRAND_COLOR),
  logoIcon: z.string().max(100_000).default(DEFAULT_STORE_LOGO_ICON).refine((value) => !value.trim() || Boolean(sanitizeStoreLogoSvg(value)), "Enter a valid, safe SVG document").transform((value) => sanitizeStoreLogoSvg(value)),
  logoColor: z.string().default("0").transform(normalizeStoreLogoColor),
  weeklyHours: weeklyHoursSchema,
  pickupLeadTimeMinutes: boundedInt("pickupLeadTimeMinutes", "Pickup lead time"),
  pickupWindowMinutes: boundedInt("pickupWindowMinutes", "Pickup window"),
  pickupCapacityPerWindow: boundedInt("pickupCapacityPerWindow", "Capacity per window"),
  taxRateBasisPoints: taxBasisPoints,
}).strict();

export type CoffeeStoreSettingsInput = z.input<typeof coffeeStoreSettingsInputSchema>;
export type CoffeeStoreSettingsData = z.output<typeof coffeeStoreSettingsInputSchema> & { id: string; updatedAt?: string | null };

export function parseCoffeeStoreSettingsInput(input: unknown) {
  return coffeeStoreSettingsInputSchema.parse(input);
}

/**
 * Effective-record policy shared by every StoreSetting writer (generated
 * GraphQL CRUD, the settings action and onboarding). It validates the merged
 * record so partial updates cannot leave the store in an invalid state.
 */
const effectiveRecordSchema = z.object({
  contactEmail: z.string().trim().email("Enter a valid contact email"),
  locale: z.literal("en-US", { errorMap: () => ({ message: "This cafe supports the en-US locale only" }) }),
  weeklyHours: weeklyHoursSchema,
  pickupLeadTimeMinutes: boundedInt("pickupLeadTimeMinutes", "Pickup lead time"),
  pickupWindowMinutes: boundedInt("pickupWindowMinutes", "Pickup window"),
  pickupCapacityPerWindow: boundedInt("pickupCapacityPerWindow", "Capacity per window"),
  taxRateBasisPoints: taxBasisPoints,
});

export function storeSettingRecordErrors(record: Record<string, unknown>): string[] {
  const result = effectiveRecordSchema.safeParse({
    contactEmail: record.contactEmail,
    locale: record.locale,
    weeklyHours: record.weeklyHours ?? [],
    pickupLeadTimeMinutes: record.pickupLeadTimeMinutes,
    pickupWindowMinutes: record.pickupWindowMinutes,
    pickupCapacityPerWindow: record.pickupCapacityPerWindow,
    // Decimal fields arrive as strings or Decimal objects.
    taxRateBasisPoints: record.taxRateBasisPoints == null ? record.taxRateBasisPoints : Number(String(record.taxRateBasisPoints)),
  });
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}
