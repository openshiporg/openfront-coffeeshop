export type OperationsReadResult<T> =
  | { kind: "ready"; data: T }
  | { kind: "unavailable" };

type OperationsClient = (query: string, variables: Record<string, unknown>) => Promise<unknown>;

const unavailable = { kind: "unavailable" } as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isRecordArray(value: unknown): value is Array<Record<string, unknown>> {
  return Array.isArray(value) && value.every(isRecord);
}

function isPage(value: unknown) {
  return isRecord(value)
    && isRecordArray(value.items)
    && typeof value.hasMore === "boolean"
    && isNullableString(value.nextCursor)
    && typeof value.loadError === "boolean";
}

const listFields = [
  "recipes",
  "ingredients",
  "inventoryLots",
  "suppliers",
  "purchaseOrders",
  "prepBatches",
  "wasteLogs",
  "posOrders",
  "subscriptions",
  "cateringOrders",
  "recentStaffShifts",
] as const;

const pageFields = [
  "receiptPurchaseOrders",
  "purchaseSuppliers",
  "purchaseInventoryItems",
  "inventoryWasteItems",
  "wastePrepBatches",
  "prepRecipes",
  "staffMembers",
  "activeStaffShifts",
] as const;

const sectionFields = ["inventory", "inventoryManage", "products", "staffing", "payments", "catering", "subscriptions"] as const;

function isOperationsProjection(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value) || !isRecord(value.sections)) return false;
  const sections = value.sections;
  if (!sectionFields.every((field) => typeof sections[field] === "boolean")) return false;
  if (!isNullableString(value.storeTimezone) || typeof value.draftScope !== "string") return false;
  if (!listFields.every((field) => isRecordArray(value[field]))) return false;
  // A section's load error is a valid projection state; it is rendered as an error, not as empty.
  if (!pageFields.every((field) => isPage(value[field]))) return false;
  return true;
}

export function classifyOperationsResponse<T>(response: unknown): OperationsReadResult<T> {
  if (!isRecord(response) || response.success !== true || !isRecord(response.data)) return unavailable;
  const data = response.data.getCoffeeOperations;
  return isOperationsProjection(data) ? { kind: "ready", data: data as T } : unavailable;
}

export async function loadCoffeeOperations<T>(
  query: string,
  variables: Record<string, unknown>,
  client: OperationsClient,
): Promise<OperationsReadResult<T>> {
  try {
    return classifyOperationsResponse<T>(await client(query, variables));
  } catch {
    return unavailable;
  }
}
