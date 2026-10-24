import { sanitizeStoreLogoSvg } from "../../lib/sanitize-store-logo";
import { normalizeStoreLogoColor } from "../../platform/store-settings/lib/store-logo";
import { onlinePaymentReady } from "../lib/onlinePayment";

type CoffeeStoreResult = {
  name: string;
  tagline?: string | null;
  description?: string | null;
  address?: string | null;
  phone?: string | null;
  contactEmail?: string | null;
  currencyCode: string;
  locale: string;
  timezone: string;
  brandColor: string;
  logoIcon?: string | null;
  logoColor?: string | null;
  weeklyHours?: unknown;
  pickupLeadTimeMinutes?: number | null;
};

type CoffeeStoreContext = {
  prisma: { user: { count(args: Record<string, unknown>): Promise<number> } } & Parameters<typeof onlinePaymentReady>[0];
  sudo(): {
    query: {
      StoreSetting: {
        findOne(args: { where: { singletonKey: string }; query: string }): Promise<CoffeeStoreResult | null>;
      };
    };
  };
};

export default async function getCoffeeStore(
  _root: unknown,
  _args: Record<string, never>,
  context: CoffeeStoreContext,
) {
  const store = await context.sudo().query.StoreSetting.findOne({
    where: { singletonKey: "primary" },
    query: `
      name
      tagline
      description
      address
      phone
      contactEmail
      currencyCode
      locale
      timezone
      brandColor
      logoIcon
      logoColor
      weeklyHours
      pickupLeadTimeMinutes
    `,
  });
  if (!store) return null;
  // A staff sign-in address is never published as the public contact, whoever saved it there.
  const contactEmail = String(store.contactEmail || "").trim();
  const isStaffLogin = contactEmail
    ? await context.prisma.user.count({ where: { email: { equals: contactEmail, mode: "insensitive" }, roleId: { not: null } } }) > 0
    : false;
  const onlinePayment = await onlinePaymentReady(context.prisma).catch(() => false);
  return { ...store, onlinePayment, contactEmail: isStaffLogin ? "" : contactEmail, logoIcon: sanitizeStoreLogoSvg(store.logoIcon || ""), logoColor: normalizeStoreLogoColor(store.logoColor) };
}
