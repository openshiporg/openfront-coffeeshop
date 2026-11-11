import { recordCoffeeCommandReceipt } from "../lib/coffeeCommandReceipt";
import { hasCafeSettlement, lockCoffeeOrder } from "./coffeeOrderPolicy";
import { releaseAbandonedOnlinePayments } from "./onlinePaymentRelease";
import { releaseOrderReservations, type TransactionClient } from "./updateCafeOrderStatus";

/**
 * End-of-day close (Toast / Square "close out the business day"): once the store's calendar day has moved on,
 * tickets from an earlier day that were never closed are settled so the live queue only holds today's work.
 *  - paid in full        → completed (the guest paid; the ticket moves to history and stays refundable there)
 *  - unpaid, not started → cancelled, stock and prepared batches released
 *  - unpaid, bar made it → cancelled as a no-show; what the bar used stays used
 * A ticket whose online card page is still open is skipped (the page is expired first; if the guest just paid,
 * the next close completes it). Every run writes one report event the Orders page shows.
 */
export const DAY_CLOSE_EVENT = "orders.end_of_day_closed";
const ACTIVE = ["open", "accepted", "paid", "in_bar_queue", "preparing", "ready"];
/** Never close a ticket whose pickup was this recent, even across midnight. */
const MIN_AGE_MS = 3 * 3_600_000;
const MIN_INTERVAL_MS = 5 * 60_000;
const TX_OPTIONS = { maxWait: 5000, timeout: 20000, isolationLevel: "ReadCommitted" };
let lastRun = 0;

type Payment = { id?: string; status?: string | null; amount?: number | null; refundIdempotencyKey?: string | null };
type Candidate = { id: string; orderNumber: string; status: string; total: number; discount: number; promisedAt: Date | null; createdAt: Date };
type Prisma = {
  storeSetting: { findUnique(args: Record<string, unknown>): Promise<{ id: string; timezone?: string | null } | null> };
  cafeOrder: { findMany(args: Record<string, unknown>): Promise<Candidate[]> };
  $transaction<T>(fn: (tx: unknown) => Promise<T>, options: Record<string, unknown>): Promise<T>;
};
export type DayCloseOutcome = "completed" | "cancelled" | "no_show";
export type DayCloseReport = { closedAt: string; storeDay: string; completed: number; cancelled: number; noShow: number; skipped: number; orderNumbers: string[] };

export function storeDayKey(at: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** Whether a ticket belongs to an earlier store day than `now` and is old enough to close. Pure. */
export function isPastDayTicket(ticket: { promisedAt: Date | null; createdAt: Date }, now: Date, timezone: string) {
  const due = ticket.promisedAt || ticket.createdAt;
  if (now.getTime() - due.getTime() < MIN_AGE_MS) return false;
  return storeDayKey(due, timezone) < storeDayKey(now, timezone);
}

/** What closing does to one ticket. Pure. */
export function dayCloseOutcome(order: { status: string; total: number; discount: number }, payments: Payment[], itemStatuses: string[]): DayCloseOutcome | null {
  if (payments.some((payment) => payment.status === "pending" || payment.status === "authorized")) return null;
  if (hasCafeSettlement(payments, Number(order.total) - Number(order.discount || 0)) && payments.some((payment) => payment.status === "captured")) return "completed";
  if (payments.some((payment) => payment.status === "captured")) return null; // partly paid or refunded mid-way: leave for staff
  const started = itemStatuses.some((status) => ["preparing", "ready", "handed_off"].includes(status));
  return started ? "no_show" : "cancelled";
}

export function triggerEndOfDayClose(prisma: unknown) {
  const now = Date.now();
  if (now - lastRun < MIN_INTERVAL_MS || process.env.NODE_ENV === "test") return;
  lastRun = now;
  void closePastDayOrders(prisma as Prisma, new Date(now)).catch((error) => console.error("End-of-day close failed:", error));
}

export async function closePastDayOrders(prisma: Prisma, now = new Date()): Promise<DayCloseReport | null> {
  const store = await prisma.storeSetting.findUnique({ where: { singletonKey: "primary" }, select: { id: true, timezone: true } });
  if (!store) return null;
  const timezone = store.timezone || "America/New_York";
  const before = new Date(now.getTime() - MIN_AGE_MS);
  const candidates = (await prisma.cafeOrder.findMany({
    where: { storeId: store.id, status: { in: ACTIVE }, OR: [{ promisedAt: { lt: before } }, { promisedAt: null, createdAt: { lt: before } }] },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 200,
    select: { id: true, orderNumber: true, status: true, total: true, discount: true, promisedAt: true, createdAt: true },
  })).filter((ticket) => isPastDayTicket(ticket, now, timezone));
  if (!candidates.length) return null;
  const report: DayCloseReport = { closedAt: now.toISOString(), storeDay: storeDayKey(now, timezone), completed: 0, cancelled: 0, noShow: 0, skipped: 0, orderNumbers: [] };
  for (const ticket of candidates) {
    try {
      // An unfinished online card page is closed first so it can't be paid after the ticket is cancelled.
      await releaseAbandonedOnlinePayments(prisma as never, ticket.id);
      const outcome = await prisma.$transaction(async (rawTx) => {
        const tx = rawTx as TransactionClient & { cafeOrder: { findUnique(args: Record<string, unknown>): Promise<any> } };
        await lockCoffeeOrder(tx, ticket.id);
        const order = await tx.cafeOrder.findUnique({ where: { id: ticket.id }, include: { orderItems: { select: { id: true, barStatus: true } }, payments: { select: { id: true, status: true, amount: true, refundIdempotencyKey: true } } } });
        if (!order || order.storeId !== store.id || !ACTIVE.includes(String(order.status))) return null;
        const result = dayCloseOutcome(order, order.payments, order.orderItems.map((item: { barStatus: string }) => String(item.barStatus)));
        if (!result) return null;
        const status = result === "completed" ? "completed" : "cancelled";
        if (result === "cancelled") await releaseOrderReservations(tx, order, store.id, null, now);
        await tx.cafeOrder.update({ where: { id: order.id }, data: { status, ...(status === "completed" ? { completedAt: now } : { cancelledAt: now }) } });
        if (order.orderItems.length) {
          await tx.orderItem.updateMany({
            where: { orderId: order.id, barStatus: { in: ["new", "queued", "preparing", "ready"] } },
            data: status === "completed" ? { barStatus: "handed_off", handedOffAt: now } : { barStatus: "voided" },
          });
        }
        await recordCoffeeCommandReceipt(tx as never, {
          storeId: store.id,
          eventKey: `order:${order.id}:status:${status}:v1`,
          eventType: "order.status_changed",
          aggregateType: "order",
          aggregateId: order.id,
          occurredAt: now,
          payload: { orderId: order.id, orderNumber: order.orderNumber, previousStatus: order.status, status, itemStatus: status === "completed" ? "handed_off" : "voided", inventoryReleased: result === "cancelled", closedBy: "end_of_day", outcome: result },
        });
        return result;
      }, TX_OPTIONS);
      if (!outcome) { report.skipped += 1; continue; }
      if (outcome === "completed") report.completed += 1; else if (outcome === "cancelled") report.cancelled += 1; else report.noShow += 1;
      report.orderNumbers.push(ticket.orderNumber);
    } catch (error) {
      report.skipped += 1;
      console.error(`End-of-day close skipped ${ticket.orderNumber}:`, (error as Error)?.message || error);
    }
  }
  if (report.orderNumbers.length) {
    await prisma.$transaction(async (tx) => {
      await recordCoffeeCommandReceipt(tx as never, {
        storeId: store.id,
        eventKey: `store:${store.id}:end_of_day_close:${report.closedAt}:v1`,
        eventType: DAY_CLOSE_EVENT,
        aggregateType: "store",
        aggregateId: store.id,
        occurredAt: now,
        payload: report as never,
      });
    }, TX_OPTIONS);
  }
  return report;
}

/** The latest close report, for the Orders page. */
export async function latestDayClose(prisma: { coffeeCommandReceipt: { findFirst(args: Record<string, unknown>): Promise<{ payload: unknown } | null> } }, storeId: string): Promise<DayCloseReport | null> {
  const row = await prisma.coffeeCommandReceipt.findFirst({ where: { storeId, eventType: DAY_CLOSE_EVENT }, orderBy: [{ occurredAt: "desc" }], select: { payload: true } });
  const payload = row?.payload as DayCloseReport | undefined;
  return payload && typeof payload.closedAt === "string" ? payload : null;
}
