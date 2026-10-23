export type PosPaymentMethod = "cash" | "manual_card";

export type PosMenuModifier = {
  id: string;
  name: string;
  modifierGroup?: string | null;
  modifierGroupLabel?: string | null;
  priceAdjustment: number;
  defaultSelected?: boolean | null;
  inStock?: boolean | null;
  required?: boolean | null;
  minSelections?: number | null;
  maxSelections?: number | null;
};

export type PosMenuItem = {
  id: string;
  name: string;
  price: number;
  availability?: string | null;
  category?: { id: string | null; name: string | null } | null;
  modifiers?: PosMenuModifier[] | null;
};

export type PosCatalogPage = {
  items: PosMenuItem[];
  hasMore: boolean;
  nextCursor: string | null;
};

export type PosCategory = { id: string; name: string };

export type PosCartItem = {
  cartId: string;
  menuItemId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  modifierIds: string[];
  modifierNames: string[];
  notes?: string;
};

export type RegisterShiftSummary = {
  id: string;
  shiftNumber: string;
  registerName: string;
  status: "open" | "closed";
  openingCashCents: number;
  cashSalesCents: number;
  cardSalesCents: number;
  tipsCents: number;
  payInsCents: number;
  payOutsCents: number;
  expectedCashCents: number;
  countedCashCents?: number | null;
  cashVarianceCents?: number | null;
  openedAt?: string | null;
};

export type PosRecoveryScope = { actorId: string; storeId: string };

export type PosRegisterData = PosCatalogPage & {
  operatorId: string;
  storeId: string;
  categories: PosCategory[];
  openShift: RegisterShiftSummary | null;
};

export type PosOrderReceipt = {
  id: string;
  orderNumber: string;
  status: string;
  handoffCode?: string | null;
  total: number;
};

export type PosOrderQuote = {
  subtotal: number;
  tax: number;
  tip: number;
  total: number;
  currencyCode: string;
  quoteFingerprint: string;
  lines: Array<{ index: number; unitPrice: number; lineTotal: number }>;
};

export type PosSaleRequest = {
  customerName: string;
  notes: string;
  paymentMethod: PosPaymentMethod;
  registerShiftId: string;
  tipCents: number;
  quoteFingerprint: string;
  externalCardReference?: string;
  externalCardApproved?: boolean;
  items: Array<{ menuItemId: string; quantity: number; modifierIds: string[]; notes?: string }>;
};
export type PosOpenShiftRequest = { registerName: string; openingCashCents: number };
export type PosCashMovementRequest = { registerShiftId: string; type: "pay_in" | "pay_out" | "cash_drop"; amountCents: number; reason: string };
export type PosCloseShiftRequest = { registerShiftId: string; countedCashCents: number };

/** One original register command, retained with its key before dispatch. */
export type PosCommand =
  | { kind: "sale"; key: string; request: PosSaleRequest; totalCents: number; cart: PosCartItem[] }
  | { kind: "open"; key: string; request: PosOpenShiftRequest }
  | { kind: "movement"; key: string; request: PosCashMovementRequest }
  | { kind: "close"; key: string; request: PosCloseShiftRequest };

export type PosReceipt =
  | { kind: "sale"; orderNumber: string; handoffCode?: string | null; totalCents: number; tender: PosPaymentMethod | "none"; terminalReference?: string }
  | { kind: "open"; shiftNumber: string; registerName: string; openingCashCents: number }
  | { kind: "movement"; movementNumber: string; type: PosCashMovementRequest["type"]; amountCents: number }
  | { kind: "close"; shiftNumber: string; expectedCashCents: number; countedCashCents: number; cashVarianceCents: number };
