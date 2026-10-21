type Lot = { id: string; quantityRemaining: unknown; status?: string | null; expiresAt?: Date | string | null };
type InventoryLotClient = {
  inventoryLot: { findMany(args: Record<string, unknown>): Promise<Lot[]>; update(args: Record<string, unknown>): Promise<unknown> };
};

/** Stock quantities are stored as DECIMAL(18,4). All writers convert to integer
 * ten-thousandths before arithmetic so counters, lots and movements use one rule.
 */
export const STOCK_SCALE = 10_000;
const MAX_STOCK_UNITS = 1_000_000 * STOCK_SCALE;

export function stockUnits(value: unknown, label = "Quantity", options: { allowZero?: boolean; unit?: string | null } = {}) {
  const parsed = typeof value === "string" ? Number(value.trim()) : Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} is invalid`);
  const scaled = Math.round(parsed * STOCK_SCALE);
  if (Math.abs(parsed * STOCK_SCALE - scaled) > 1e-6) throw new Error(`${label} supports at most 4 decimal places`);
  if (scaled < (options.allowZero ? 0 : 1)) throw new Error(`${label} must be greater than zero`);
  if (scaled > MAX_STOCK_UNITS) throw new Error(`${label} is too large`);
  if (options.unit === "each" && scaled % STOCK_SCALE !== 0) throw new Error(`${label} must be a whole number of items`);
  return scaled;
}

/** Reads a stored Decimal (string/Decimal/number) without re-validating the scale. */
export function storedStockUnits(value: unknown) {
  const parsed = Number(value == null ? 0 : String(value));
  if (!Number.isFinite(parsed)) throw new Error("Stored stock quantity is invalid");
  return Math.round(parsed * STOCK_SCALE);
}

export function stockDecimal(units: number) {
  if (!Number.isSafeInteger(units)) throw new Error("Stock quantity is out of range");
  const sign = units < 0 ? "-" : "";
  const absolute = Math.abs(units);
  return `${sign}${Math.trunc(absolute / STOCK_SCALE)}.${String(absolute % STOCK_SCALE).padStart(4, "0")}`;
}

export function stockNumber(units: number) {
  return Number(stockDecimal(units));
}

/** Integer cents for a scaled quantity at an integer per-unit cost, rounded half up. */
export function stockCostCents(units: number, unitCostCents: number) {
  const cents = Math.round(units * unitCostCents / STOCK_SCALE);
  if (!Number.isSafeInteger(cents) || cents > 2_147_483_647) throw new Error("Cost is too large to record");
  return cents;
}

/** Called under the inventory-item lock. Expired/quarantined stock remains tracked,
 * never silently reclassified as usable legacy stock. Legacy opening balances are
 * the positive difference between aggregate stock and ALL remaining tracked lots.
 */
export async function consumeActiveInventoryLots(
  tx: InventoryLotClient,
  inventoryItemId: string,
  requestedQuantity: number,
  options: { openingStock: unknown; waste?: boolean },
) {
  const requested = stockUnits(requestedQuantity, "Consumed quantity");
  const opening = storedStockUnits(options.openingStock);
  const all = await tx.inventoryLot.findMany({
    where: { inventoryItemId, quantityRemaining: { gt: 0 } },
    orderBy: [{ expiresAt: "asc" }, { receivedAt: "asc" }, { id: "asc" }],
    take: 1001,
    select: { id: true, quantityRemaining: true, status: true, expiresAt: true },
  });
  if (all.length > 1000) throw new Error("Inventory lot ledger requires consolidation before this operation");
  const now = Date.now();
  const lots = all.map((lot) => ({ ...lot, units: storedStockUnits(lot.quantityRemaining) }));
  const eligible = lots.filter((lot) => options.waste || ((lot.status || "active") === "active" && (!lot.expiresAt || new Date(lot.expiresAt).getTime() > now)));
  const tracked = lots.reduce((sum, lot) => sum + lot.units, 0);
  // Never manufacture untracked stock: lots that exceed the physical counter need reconciliation.
  if (tracked > opening) throw new Error("Inventory lot balances exceed recorded stock for this item; reconcile the stock count before continuing");
  const untracked = opening - tracked;
  const available = eligible.reduce((sum, lot) => sum + lot.units, 0) + untracked;
  if (available < requested) throw new Error("Insufficient eligible stock: expired or quarantined lots cannot be sold or prepared");
  let remaining = requested;
  const allocations: Array<{ inventoryLotId: string; quantity: number }> = [];
  for (const lot of eligible) {
    if (remaining <= 0) break;
    const consumed = Math.min(lot.units, remaining);
    const left = lot.units - consumed;
    await tx.inventoryLot.update({ where: { id: lot.id }, data: { quantityRemaining: stockDecimal(left), ...(left === 0 ? { status: "consumed" } : {}) } });
    allocations.push({ inventoryLotId: lot.id, quantity: stockNumber(consumed) });
    remaining -= consumed;
  }
  return { consumedFromLots: stockNumber(requested - remaining), untrackedQuantity: stockNumber(remaining), allocations };
}
