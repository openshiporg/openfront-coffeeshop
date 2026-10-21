export type CafeOrderStatus =
  | "open"
  | "accepted"
  | "paid"
  | "in_bar_queue"
  | "preparing"
  | "ready"
  | "completed"
  | "cancelled"
  | "refunded";

export type CafeOrderQueueItemSnapshot = {
  id: string;
  quantity: number;
  itemNameSnapshot?: string | null;
  customizationsSummary?: string | null;
  barStatus?: string | null;
  station?: string | null;
  menuItem?: { name: string } | null;
};

export type CafeOrderQueueItem = {
  id: string;
  orderNumber: string;
  status: CafeOrderStatus;
  fulfillmentType?: string | null;
  orderSource?: string | null;
  customerName?: string | null;
  customerEmail?: string | null;
  pickupName?: string | null;
  promisedAt?: string | null;
  total: number;
  isRush?: boolean | null;
  orderItems?: CafeOrderQueueItemSnapshot[] | null;
  paymentState?: "unpaid" | "pending" | "paid" | "refunded" | null;
  canRecordPayment: boolean;
  canApplyLoyalty: boolean;
  loyaltyApplied?: boolean | null;
  refundablePayments: Array<{ id: string; status: string; method: string; amount: number; refundedAmount?: number | null }>;
  actions: Array<{ status: string; label: string; tone?: string }>;
};

export const ORDER_STATUS_FILTERS = ["all", "open", "accepted", "paid", "in_bar_queue", "preparing", "ready", "completed", "cancelled", "refunded"] as const;
export type OrderStatusFilter = (typeof ORDER_STATUS_FILTERS)[number];
export const ORDER_FULFILLMENT_FILTERS = ["all", "pickup", "counter", "dine_in"] as const;
export type OrderFulfillmentFilter = (typeof ORDER_FULFILLMENT_FILTERS)[number];
