// Store Settings save path: the E-commerce logo block's values through the
// action's parser (sanitizeStoreLogoSvg -> normalizeStoreLogoColor) to the mutation data.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { LOGO_ICONS } from "./icon-registry";
import { parseCoffeeStoreSettingsInput } from "../../../keystone/lib/store-settings-input";

const base = {
  name: "Store", tagline: "", description: "", address: "1 Main St", phone: "", contactEmail: "owner@example.com",
  currencyCode: "USD", locale: "en-US", timezone: "America/New_York",
  weeklyHours: [{ day: "Monday", open: "07:00", close: "17:00" }],
  pickupLeadTimeMinutes: 10, pickupWindowMinutes: 15, pickupCapacityPerWindow: 10, taxRateBasisPoints: 0,
};
const parse = (logoIcon: string, logoColor: string) => parseCoffeeStoreSettingsInput({ ...base, logoIcon, logoColor } as never);

test("the action parses the input before the mutation and revalidates after", () => {
  const action = readFileSync(join(__dirname, "../actions/store-settings.ts"), "utf8");
  assert.ok(action.indexOf("parseCoffeeStoreSettingsInput(input)") < action.indexOf("UPDATE_STORE_SETTINGS,\n"));
  assert.ok(action.indexOf("UPDATE_STORE_SETTINGS,\n") < action.indexOf('revalidatePath("/", "layout")'));
});

test("a preset icon and hue reach the mutation unchanged", () => {
  const icon = LOGO_ICONS.find((entry) => entry.id === "acme-corp")!.lightSvg;
  const out = parse(icon, "120");
  assert.equal(out.logoIcon, icon);
  assert.equal(out.logoColor, "120");
});

test("every preset survives the sanitizer", () => {
  for (const icon of LOGO_ICONS) assert.equal(parse(icon.lightSvg, "0").logoIcon, icon.lightSvg, icon.id);
});

test("a pasted custom SVG is kept, trimmed", () => {
  const svg = '<svg fill="none" height="100%" viewBox="0 0 48 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m48 11h-17z" fill="#087443"/></svg>';
  assert.equal(parse(`\n${svg} `, "0").logoIcon, svg);
});

test("the hue is normalized to 0-359", () => {
  const icon = LOGO_ICONS[0].lightSvg;
  assert.equal(parse(icon, "-90").logoColor, "270");
  assert.equal(parse(icon, "400").logoColor, "40");
  assert.equal(parse(icon, "red").logoColor, "0");
});

test("an unsafe SVG rejects the save", () => {
  assert.throws(() => parse('<svg onload="alert(1)"></svg>', "0"));
});
