// A database rule (CHECK or partial unique index) that refused a write is a business refusal, not a
// crash: say which rule in words staff can act on. Anything else returns null and keeps its masking.
//
// Keystone rethrows Prisma failures as a GraphQLError (KS_PRISMA_ERROR). A unique conflict carries
// code P2002 and meta { modelName, target }; a CHECK failure has no Prisma code, and its text sits in
// the message or extensions.debug.message.

const UNIQUE_REFUSALS: Record<string, string> = {
  "RegisterShift:store": "This single-register cafe already has an open shift; close it before opening another",
  "StaffShift:staff": "This person is already clocked in on another shift; clock that one out first",
};

const CHECK_REFUSALS: Array<[RegExp, string]> = [
  [/^Payment_refund_within_amount_check$/, "Refund exceeds the amount paid"],
  [/^GiftCard_balance_within_initial_check$/, "A gift card balance must stay between zero and the amount loaded"],
  [/^InventoryItem_stock_nonnegative_check$/, "Not enough stock: on hand cannot go below zero"],
  [/^InventoryLot_remaining_within_received_check$/, "A lot cannot hold more than was received"],
  [/^PrepBatch_remaining_within_made_check$/, "A prep batch cannot hold more than was made"],
  [/^RegisterShift_bounds_check$/, "Register cash cannot go below zero"],
  [/^LoyaltyAccount_bounds_check$/, "Loyalty points and drink credits cannot go below zero"],
  [/^CafeOrder_total_sum_check$/, "Order total must equal subtotal plus tax and tip, less discount"],
  [/^StoreSetting_pickup_bounds_check$/, "Pickup lead time, window and capacity are outside the allowed range"],
  [/_window_check$/, "The end must be after the start"],
  [/_(bounds|positive|nonnegative|selection)_check$|_quantity_positive_check$|_yield_positive_check$|_amount_positive_check$/, "Amounts and quantities cannot be negative"],
];

function constraintName(error: unknown): { kind: "unique" | "check"; name: string } | null {
  const e = error as { code?: string; meta?: Record<string, unknown>; message?: string; extensions?: Record<string, any> } | null;
  if (!e || typeof e !== "object") return null;
  const prisma = (e.extensions?.prisma ?? {}) as { code?: string; meta?: Record<string, unknown> };
  const code = e.code ?? prisma.code;
  const meta = e.meta ?? prisma.meta;
  if (code === "P2002") {
    const target = meta?.target;
    const columns = Array.isArray(target) ? target.join(",") : String(target ?? "");
    return { kind: "unique", name: `${String(meta?.modelName ?? "")}:${columns}` };
  }
  const text = [e.message ?? "", String(e.extensions?.debug?.message ?? ""), JSON.stringify(meta ?? {})].join(" ");
  const check = text.match(/check constraint \\?"([A-Za-z0-9_]+_check)\\?"/);
  return check ? { kind: "check", name: check[1] } : null;
}

/** A readable refusal for a known database rule, or null when the error is something else. */
export function constraintRefusal(error: unknown): string | null {
  const found = constraintName(error);
  if (!found) return null;
  if (found.kind === "unique") return UNIQUE_REFUSALS[found.name] ?? null;
  for (const [pattern, message] of CHECK_REFUSALS) if (pattern.test(found.name)) return message;
  return null;
}
