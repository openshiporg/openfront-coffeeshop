import { z } from "zod";
import type { KeystoneContext } from "@keystone-6/core/types";

const registration = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email().max(320),
  password: z.string().min(12).max(128),
}).strict();

// C14: family create → authenticate flow, restricted to a customer-only whitelist.
// A configured store is required so public registration cannot preempt initFirstItem.
export async function registerCoffeeCustomer(_root: unknown, args: unknown, context: KeystoneContext) {
  const input = registration.safeParse(args);
  if (!input.success || context.session) return false;
  const store = await context.prisma.storeSetting.findUnique({ where: { singletonKey: "primary" }, select: { id: true } });
  if (!store) return false;
  try {
    await context.sudo().db.User.createOne({ data: { ...input.data, onboardingStatus: "dismissed" } });
    return true;
  } catch {
    return false; // No database/identity details cross the public boundary.
  }
}

export async function getCoffeeCustomerOrders(_root: unknown, args: { after?: string | null }, context: KeystoneContext) {
  const customerId = context.session?.listKey === "User" ? context.session.itemId : null;
  if (!customerId) throw new Error("Sign in to view orders");
  // History is owned by the customer, not gated on the current public store configuration.
  let anchor;
  if (args.after) {
    if (args.after.length > 200) throw new Error("Invalid order cursor");
    anchor = await context.prisma.cafeOrder.findFirst({ where: { id: args.after, customerId }, select: { id: true, createdAt: true } });
    if (!anchor) throw new Error("Invalid order cursor");
  }
  const rows = await context.prisma.cafeOrder.findMany({
    where: {
      customerId,
      ...(anchor ? { OR: [{ createdAt: { lt: anchor.createdAt } }, { createdAt: anchor.createdAt, id: { lt: anchor.id } }] } : {}),
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 21,
    select: { id: true, orderNumber: true, status: true, total: true, currencyCode: true, createdAt: true },
  });
  return { orders: rows.slice(0, 20), nextCursor: rows.length > 20 ? rows[19].id : null };
}

const profile = z.object({
  name: z.string().trim().min(1).max(200),
  phone: z.string().trim().max(50).regex(/^[+\d\s().-]*$/).nullish(),
}).strict();

/** Signed-in customers edit their own name and phone; email and password stay on the sign-in/reset journeys. */
export async function updateCoffeeCustomerProfile(_root: unknown, args: unknown, context: KeystoneContext) {
  const customerId = context.session?.listKey === "User" ? String(context.session.itemId) : null;
  if (!customerId) throw new Error("Sign in to edit your profile");
  const input = profile.safeParse(args);
  if (!input.success) throw new Error("Enter a name and a valid phone number");
  await context.db.User.updateOne({ where: { id: customerId }, data: { name: input.data.name, phone: input.data.phone || "" } });
  return true;
}
