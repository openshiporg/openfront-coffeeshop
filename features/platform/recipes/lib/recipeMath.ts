/** Pure helpers shared by the recipe screens, actions and tests. */

export function toNumber(value: unknown): number {
  if (value === null || value === undefined || value === "") return NaN;
  const parsed = Number(String(value));
  return Number.isFinite(parsed) ? parsed : NaN;
}

/** Mirrors the Recipe and Ingredient validateInput hooks: > 0, at most 4 decimals, at most 1,000,000. */
export function quantityError(text: string, label: string, unit?: string | null): string | null {
  const trimmed = text.trim();
  if (!trimmed) return `${label} is required`;
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return `${label} must be a number`;
  const parsed = Number(trimmed);
  const scaled = Math.round(parsed * 10_000);
  if (!Number.isFinite(parsed) || scaled < 1 || Math.abs(parsed * 10_000 - scaled) > 1e-6 || parsed > 1_000_000) {
    return `${label} must be greater than zero with at most 4 decimal places`;
  }
  if (unit === "each" && scaled % 10_000 !== 0) return `${label} in each must be a whole number`;
  return null;
}

export type CostLine = { quantity: unknown; optional?: boolean | null; costPerUnit?: number | null; inventoryItemId?: string | null; currentStock?: unknown };

/** Cost in cents of one ingredient line, or null when the inventory item has no cost. */
export function lineCostCents(line: CostLine): number | null {
  const quantity = toNumber(line.quantity);
  if (!Number.isFinite(quantity) || typeof line.costPerUnit !== "number") return null;
  return quantity * line.costPerUnit;
}

/** Cost per yield unit of the ingredients a sale consumes (optional lines are not consumed). */
export function costPerYieldCents(lines: CostLine[], yieldQuantity: unknown): number | null {
  const yieldValue = toNumber(yieldQuantity);
  const required = lines.filter((line) => !line.optional);
  if (!(yieldValue > 0) || !required.length) return null;
  let total = 0;
  for (const line of required) {
    const cost = lineCostCents(line);
    if (cost === null) return null;
    total += cost;
  }
  return Math.round(total / yieldValue);
}

/** Yield units the current stock covers: min over required ingredients (summed per inventory item). */
export function servingsFromStock(lines: CostLine[], yieldQuantity: unknown): number | null {
  const yieldValue = toNumber(yieldQuantity);
  if (!(yieldValue > 0)) return null;
  const needs = new Map<string, { perUnit: number; stock: number }>();
  for (const line of lines) {
    if (line.optional || !line.inventoryItemId) continue;
    const quantity = toNumber(line.quantity);
    if (!(quantity > 0)) continue;
    const current = needs.get(line.inventoryItemId);
    const stock = Math.max(0, toNumber(line.currentStock) || 0);
    needs.set(line.inventoryItemId, { perUnit: (current?.perUnit ?? 0) + quantity / yieldValue, stock });
  }
  if (!needs.size) return null;
  let min = Infinity;
  for (const { perUnit, stock } of needs.values()) min = Math.min(min, Math.floor(stock / perUnit + 1e-9));
  return Number.isFinite(min) ? min : null;
}

export function formatQuantity(value: unknown, locale = "en-US"): string {
  const parsed = toNumber(value);
  if (!Number.isFinite(parsed)) return "—";
  return new Intl.NumberFormat(locale, { maximumFractionDigits: 4 }).format(parsed);
}

export function formatCents(cents: number | null | undefined, currencyCode = "USD", locale = "en-US"): string {
  if (typeof cents !== "number" || !Number.isFinite(cents)) return "—";
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency: currencyCode }).format(cents / 100);
  } catch {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
  }
}

/** Pulls the operator-facing messages out of a Keystone KS_VALIDATION_FAILURE error message. */
export function validationMessages(message: string): string[] {
  return message
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).replace(/^[A-Z][A-Za-z0-9]*(\.[A-Za-z0-9]+)*: /, "").trim())
    .filter(Boolean);
}
