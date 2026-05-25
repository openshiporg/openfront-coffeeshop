import { list } from "@keystone-6/core";
import { checkbox, integer, relationship, text } from "@keystone-6/core/fields";

import { permissions } from "../access";
import { trackingFields } from "./trackingFields";

export const MenuCategory = list({
  access: {
    operation: {
      query: () => true,
      create: permissions.canManageProducts,
      update: permissions.canManageProducts,
      delete: permissions.canManageProducts,
    },
  },
  ui: {
    listView: {
      initialColumns: ["name", "active", "sortOrder", "menuItems"],
    },
  },
  fields: {
    name: text({ validation: { isRequired: true } }),
    description: text({ ui: { displayMode: "textarea" } }),
    active: checkbox({ defaultValue: true }),
    sortOrder: integer({ defaultValue: 0 }),
    menuItems: relationship({ ref: "MenuItem.category", many: true }),
    ...trackingFields,
  },
});
