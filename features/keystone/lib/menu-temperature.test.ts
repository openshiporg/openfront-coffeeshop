import { test } from "node:test";
import assert from "node:assert/strict";
import seed from "../../platform/onboarding/lib/seed.json";
import { parseOnboardingData } from "../../platform/onboarding/lib/onboardingSchema";
import { defaultTemperatureOptions } from "./menu-temperature";

test("cold bar defaults to iced, pastry and retail to none, bars to hot", () => {
  assert.deepEqual(defaultTemperatureOptions("cold_bar"), ["iced"]);
  assert.deepEqual(defaultTemperatureOptions("pastry_case"), []);
  assert.deepEqual(defaultTemperatureOptions("retail_shelf"), []);
  assert.deepEqual(defaultTemperatureOptions("espresso_bar"), ["hot"]);
  assert.deepEqual(defaultTemperatureOptions(undefined), ["hot"]);
});

test("seed menu items state temperatures that match their station and copy", () => {
  for (const template of ["minimal", "full"] as const) {
    const parsed = parseOnboardingData((seed as Record<string, unknown>)[template]);
    assert.ok(parsed.success, `${template} seed parses`);
    for (const item of parsed.data.menuItems) {
      assert.ok(Array.isArray(item.temperatureOptions), `${template}/${item.name} states its temperatures`);
      if (item.barStation === "cold_bar") assert.ok(!item.temperatureOptions!.includes("hot"), `${item.name} is not served hot`);
      if (/cold brew|iced/i.test(item.name)) assert.deepEqual(item.temperatureOptions, ["iced"], item.name);
      if (item.barStation === "pastry_case" || item.barStation === "retail_shelf") assert.deepEqual(item.temperatureOptions, [], item.name);
    }
  }
});
