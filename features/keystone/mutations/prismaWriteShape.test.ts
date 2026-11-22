import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

// Every `tx.<model>.create/update({ data: { metadata` in a command must target a model that has a metadata
// column. A missing column is a PrismaClientValidationError on live, as Payment's was for counter
// gift card, cash and card settlement.
const root = path.resolve(__dirname, "../../..");
const schema = readFileSync(path.join(root, "schema.prisma"), "utf8");
const withMetadata = new Set(
  [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)].filter((m) => /^\s+metadata\s/m.test(m[2])).map((m) => m[1][0].toLowerCase() + m[1].slice(1)),
);

test("command writes only set metadata on models that have the column", () => {
  const dir = path.join(root, "features/keystone/mutations");
  const offenders: string[] = [];
  for (const file of readdirSync(dir).filter((f) => f.endsWith(".ts") && !f.includes(".test.") && !f.includes(".integration."))) {
    const lines = readFileSync(path.join(dir, file), "utf8").split("\n");
    let model = "";
    lines.forEach((line, index) => {
      const call = line.match(/\b(?:tx|prisma)\.(\w+)\.(?:create|update|upsert)\(/);
      if (call) model = call[1];
      else if (/\w\(\{\s*$|\w\(\s*$/.test(line)) model = ""; // a non-Prisma call (Stripe, adapters) opened
      if (/^\s+metadata: \{/.test(line) && model && !withMetadata.has(model)) offenders.push(`${file}:${index + 1} ${model}`);
    });
  }
  assert.deepEqual(offenders, []);
});
