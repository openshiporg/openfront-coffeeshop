export type KdsItemStatus = "new" | "queued" | "preparing" | "ready" | "handed_off" | "voided";

export type KdsBoard = { activeCount: number; scheduledCount?: number; nextScheduledAt?: string | null; canManageOrders: boolean; storeTimezone: string | null; hasMore: boolean; nextCursor?: string | null; items: KdsOrderItem[] };

export type KdsOrderItem = {
  id: string;
  quantity: number;
  itemNameSnapshot: string;
  customizationsSummary?: string | null;
  specialInstructions?: string | null;
  barStatus: KdsItemStatus;
  station?: string | null;
  queuedAt?: string | null;
  startedAt?: string | null;
  readyAt?: string | null;
  nextAction?: { status: KdsItemStatus; label: string; tone?: string } | null;
  order: {
    id: string;
    orderNumber: string;
    status: string;
    pickupName?: string | null;
    promisedAt?: string | null;
    isRush?: boolean | null;
  };
};
