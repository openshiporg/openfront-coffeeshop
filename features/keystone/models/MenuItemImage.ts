import { list } from "@keystone-6/core";
import { image, integer, json, relationship, text } from "@keystone-6/core/fields";

import { permissions } from "../access";
import { trackingFields } from "./trackingFields";

export const MenuItemImage = list({
  access: {
    operation: {
      query: permissions.canReadProducts,
      create: permissions.canManageProducts,
      update: permissions.canManageProducts,
      delete: permissions.canManageProducts,
    },
  },
  ui: {
    listView: {
      initialColumns: ["image", "imagePath", "altText", "menuItems"],
    },
  },
  fields: {
    image: image({ storage: "my_images" }),
    imagePath: text({ validation: { isRequired: true } }),
    altText: text(),
    order: integer({ defaultValue: 0 }),
    menuItems: relationship({ ref: "MenuItem.menuItemImages", many: true, ui: { displayMode: "count" } }),
    metadata: json(),
    ...trackingFields,
  },
});
