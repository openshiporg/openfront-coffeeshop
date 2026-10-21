import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

for (const path of ["components/ui/dialog.tsx", "components/ui/alert-dialog.tsx"]) {
  test(`${path} keeps fixed centering free of directional animation transforms`, async () => {
    const source = await readFile(path, "utf8");
    assert.match(source, /left-\[50%\][\s\S]*translate-x-\[-50%\]/);
    assert.match(source, /top-\[50%\][\s\S]*translate-y-\[-50%\]/);
    assert.doesNotMatch(source, /slide-(?:in-from|out-to)-(?:left|top)/);
  });
}

test("onboarding actions remain pointer, keyboard, and touch reachable without hover", async () => {
  const source = await readFile("features/platform/onboarding/components/OnboardingCards.tsx", "utf8");
  assert.match(source, />\s*Get started\s*</);
  assert.doesNotMatch(source, /max-h-0|onMouseEnter|onMouseLeave/);
});

test("onboarding dialog keeps desktop actions inside its bounded scroll layout", async () => {
  const source = await readFile("features/platform/onboarding/components/OnboardingDialog.tsx", "utf8");
  assert.match(source, /flex min-h-0 shrink-0 flex-col overflow-hidden/);
  assert.match(source, /min-h-0 flex-1 overflow-y-auto/);
  assert.match(source, /<Button type="button" onClick=\{runOnboarding\}/);
});

test("floating assistant control has a state-aware accessible name", async () => {
  const source = await readFile("features/dashboard/components/DashboardLayout.tsx", "utf8");
  assert.match(source, /aria-label=\{showChevron \? "Close assistant" : "Open assistant"\}/);
  assert.match(source, /aria-hidden="true"/);
});
