import { list } from "@keystone-6/core";
import { denyAll } from "@keystone-6/core/access";
import { checkbox, json, relationship, text } from "@keystone-6/core/fields";

import { permissions } from "../access";
import { trackingFields } from "./trackingFields";

/** Non-secret provider enablement. Executable adapters and all secrets live in the static server registry/env. */
export const PaymentProvider = list({
  access: {
    operation: {
      query: ({ session }) =>
        permissions.canReadPayments({ session }) ||
        permissions.canManagePayments({ session }),
      create: permissions.canManagePayments,
      update: permissions.canManagePayments,
      delete: permissions.canManagePayments,
    },
  },
  ui: { listView: { initialColumns: ["name", "code", "isInstalled"] } },
  fields: {
    name: text({ validation: { isRequired: true } }),
    code: text({
      isIndexed: "unique",
      validation: {
        isRequired: true,
        match: {
          regex: /^pp_[a-zA-Z0-9-_]+$/,
          explanation: 'Payment provider code must start with "pp_" followed by alphanumeric characters, hyphens or underscores',
        },
      },
      ui: { description: "Must match a server-owned static payment adapter code" },
    }),
    isInstalled: checkbox({ defaultValue: false }),
    metadata: json({
      defaultValue: {},
      ui: { description: "Non-secret display/configuration metadata only. Credentials are read from environment variables." },
    }),
    // Payments are linked from the payment side; the inverse is not a second writer of payment evidence.
    paymentRecords: relationship({ ref: "Payment.paymentProvider", many: true, access: { create: denyAll, update: denyAll }, ui: { itemView: { fieldMode: "read" } } }),
    ...trackingFields,
  },
});
