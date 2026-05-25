"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __glob = (map) => (path) => {
  var fn = map[path];
  if (fn) return fn();
  throw new Error("Module not found in bundle: " + path);
};
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// features/integrations/payment/manual.ts
var manual_exports = {};
__export(manual_exports, {
  capturePaymentFunction: () => capturePaymentFunction,
  createPaymentFunction: () => createPaymentFunction,
  generatePaymentLinkFunction: () => generatePaymentLinkFunction,
  getPaymentStatusFunction: () => getPaymentStatusFunction,
  handleWebhookFunction: () => handleWebhookFunction,
  refundPaymentFunction: () => refundPaymentFunction
});
function id(prefix) {
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
async function createPaymentFunction(input) {
  return {
    success: true,
    provider: "manual",
    providerPaymentId: id("manual"),
    status: "pending",
    amount: input.amount,
    currencyCode: input.currencyCode,
    data: {
      paymentMode: "manual",
      message: "Manual payment requires operator confirmation. Replace with a configured provider for live charging."
    }
  };
}
async function capturePaymentFunction(input) {
  return { success: true, provider: "manual", providerPaymentId: input.providerPaymentId, status: "captured", amount: input.amount };
}
async function refundPaymentFunction(input) {
  return {
    success: true,
    provider: "manual",
    providerPaymentId: input.providerPaymentId,
    status: "refunded",
    amount: input.amount,
    data: { reason: input.reason || "manual_refund" }
  };
}
async function getPaymentStatusFunction(input) {
  return { success: true, provider: "manual", providerPaymentId: input.providerPaymentId, status: "captured" };
}
async function generatePaymentLinkFunction(input) {
  return {
    success: true,
    provider: "manual",
    providerPaymentId: id("manual_link"),
    status: "pending",
    amount: input.amount,
    currencyCode: input.currencyCode,
    data: { url: `/checkout/manual?orderId=${input.orderId}` }
  };
}
async function handleWebhookFunction(input) {
  return { success: true, provider: "manual", status: "received", data: { event: input.event } };
}
var init_manual = __esm({
  "features/integrations/payment/manual.ts"() {
    "use strict";
  }
});

// features/integrations/payment/stripe.ts
var stripe_exports = {};
__export(stripe_exports, {
  capturePaymentFunction: () => capturePaymentFunction2,
  createPaymentFunction: () => createPaymentFunction2,
  generatePaymentLinkFunction: () => generatePaymentLinkFunction2,
  getPaymentStatusFunction: () => getPaymentStatusFunction2,
  handleWebhookFunction: () => handleWebhookFunction2,
  refundPaymentFunction: () => refundPaymentFunction2
});
function missingConfig() {
  if (!process.env.STRIPE_SECRET_KEY) {
    return {
      success: false,
      provider: "stripe",
      status: "configuration_error",
      error: "STRIPE_SECRET_KEY is not configured"
    };
  }
  return null;
}
async function createPaymentFunction2(input) {
  const configError = missingConfig();
  if (configError) return configError;
  return {
    success: true,
    provider: "stripe",
    providerPaymentId: `stripe_pending_${input.orderId}`,
    status: "requires_confirmation",
    amount: input.amount,
    currencyCode: input.currencyCode,
    data: {
      mode: "payment_intent_placeholder",
      publishableKeyRequired: true,
      note: "Stripe adapter boundary is in place; wire SDK call here when live credentials are available."
    }
  };
}
async function capturePaymentFunction2(input) {
  const configError = missingConfig();
  if (configError) return configError;
  return { success: true, provider: "stripe", providerPaymentId: input.providerPaymentId, status: "captured", amount: input.amount };
}
async function refundPaymentFunction2(input) {
  const configError = missingConfig();
  if (configError) return configError;
  return { success: true, provider: "stripe", providerPaymentId: input.providerPaymentId, status: "refunded", amount: input.amount, data: { reason: input.reason } };
}
async function getPaymentStatusFunction2(input) {
  const configError = missingConfig();
  if (configError) return configError;
  return { success: true, provider: "stripe", providerPaymentId: input.providerPaymentId, status: "requires_confirmation" };
}
async function generatePaymentLinkFunction2(input) {
  const configError = missingConfig();
  if (configError) return configError;
  return { success: true, provider: "stripe", providerPaymentId: `stripe_link_${input.orderId}`, status: "pending", amount: input.amount, data: { provider: "stripe_checkout" } };
}
async function handleWebhookFunction2(input) {
  const configError = missingConfig();
  if (configError) return configError;
  return { success: true, provider: "stripe", status: "received", data: { eventType: input.event?.type } };
}
var init_stripe = __esm({
  "features/integrations/payment/stripe.ts"() {
    "use strict";
  }
});

// features/integrations/payment/paypal.ts
var paypal_exports = {};
__export(paypal_exports, {
  capturePaymentFunction: () => capturePaymentFunction3,
  createPaymentFunction: () => createPaymentFunction3,
  generatePaymentLinkFunction: () => generatePaymentLinkFunction3,
  getPaymentStatusFunction: () => getPaymentStatusFunction3,
  handleWebhookFunction: () => handleWebhookFunction3,
  refundPaymentFunction: () => refundPaymentFunction3
});
function missingConfig2() {
  if (!process.env.PAYPAL_CLIENT_ID || !process.env.PAYPAL_CLIENT_SECRET) {
    return {
      success: false,
      provider: "paypal",
      status: "configuration_error",
      error: "PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are not configured"
    };
  }
  return null;
}
async function createPaymentFunction3(input) {
  const configError = missingConfig2();
  if (configError) return configError;
  return {
    success: true,
    provider: "paypal",
    providerPaymentId: `paypal_pending_${input.orderId}`,
    status: "created",
    amount: input.amount,
    currencyCode: input.currencyCode,
    data: { mode: "order_placeholder", note: "PayPal adapter boundary is in place for live SDK wiring." }
  };
}
async function capturePaymentFunction3(input) {
  const configError = missingConfig2();
  if (configError) return configError;
  return { success: true, provider: "paypal", providerPaymentId: input.providerPaymentId, status: "captured", amount: input.amount };
}
async function refundPaymentFunction3(input) {
  const configError = missingConfig2();
  if (configError) return configError;
  return { success: true, provider: "paypal", providerPaymentId: input.providerPaymentId, status: "refunded", amount: input.amount, data: { reason: input.reason } };
}
async function getPaymentStatusFunction3(input) {
  const configError = missingConfig2();
  if (configError) return configError;
  return { success: true, provider: "paypal", providerPaymentId: input.providerPaymentId, status: "created" };
}
async function generatePaymentLinkFunction3(input) {
  const configError = missingConfig2();
  if (configError) return configError;
  return { success: true, provider: "paypal", providerPaymentId: `paypal_link_${input.orderId}`, status: "pending", amount: input.amount, data: { provider: "paypal_checkout" } };
}
async function handleWebhookFunction3(input) {
  const configError = missingConfig2();
  if (configError) return configError;
  return { success: true, provider: "paypal", status: "received", data: { eventType: input.event?.event_type } };
}
var init_paypal = __esm({
  "features/integrations/payment/paypal.ts"() {
    "use strict";
  }
});

// features/integrations/payment/index.ts
var payment_exports = {};
__export(payment_exports, {
  paymentProviderAdapters: () => paymentProviderAdapters
});
var paymentProviderAdapters;
var init_payment = __esm({
  "features/integrations/payment/index.ts"() {
    "use strict";
    paymentProviderAdapters = {
      manual: () => Promise.resolve().then(() => (init_manual(), manual_exports)),
      cash: () => Promise.resolve().then(() => (init_manual(), manual_exports)),
      stripe: () => Promise.resolve().then(() => (init_stripe(), stripe_exports)),
      paypal: () => Promise.resolve().then(() => (init_paypal(), paypal_exports))
    };
  }
});

// keystone.ts
var keystone_exports = {};
__export(keystone_exports, {
  default: () => keystone_default2
});
module.exports = __toCommonJS(keystone_exports);

// features/keystone/index.ts
var import_auth = require("@keystone-6/auth");
var import_core14 = require("@keystone-6/core");
var import_config = require("dotenv/config");

// features/keystone/models/User.ts
var import_core = require("@keystone-6/core");
var import_access = require("@keystone-6/core/access");
var import_fields2 = require("@keystone-6/core/fields");

// features/keystone/access.ts
function isSignedIn({ session }) {
  return Boolean(session);
}
var hasRoleFlag = (session, flag) => Boolean(session?.data?.role?.[flag]);
var permissions = {
  canAccessDashboard: ({ session }) => hasRoleFlag(session, "canAccessDashboard"),
  canReadOrders: ({ session }) => hasRoleFlag(session, "canReadOrders") || hasRoleFlag(session, "canManageOrders"),
  canManageOrders: ({ session }) => hasRoleFlag(session, "canManageOrders"),
  canReadPayments: ({ session }) => hasRoleFlag(session, "canReadPayments") || hasRoleFlag(session, "canManagePayments"),
  canManagePayments: ({ session }) => hasRoleFlag(session, "canManagePayments"),
  canReadProducts: ({ session }) => hasRoleFlag(session, "canReadProducts") || hasRoleFlag(session, "canManageProducts"),
  canManageProducts: ({ session }) => hasRoleFlag(session, "canManageProducts"),
  canReadInventory: ({ session }) => hasRoleFlag(session, "canReadInventory") || hasRoleFlag(session, "canManageInventory"),
  canManageInventory: ({ session }) => hasRoleFlag(session, "canManageInventory"),
  canReadLoyalty: ({ session }) => hasRoleFlag(session, "canReadLoyalty") || hasRoleFlag(session, "canManageLoyalty"),
  canManageLoyalty: ({ session }) => hasRoleFlag(session, "canManageLoyalty"),
  canManagePeople: ({ session }) => hasRoleFlag(session, "canManagePeople"),
  canManageRoles: ({ session }) => hasRoleFlag(session, "canManageRoles"),
  canManageSettings: ({ session }) => hasRoleFlag(session, "canManageSettings"),
  canManageOnboarding: ({ session }) => hasRoleFlag(session, "canManageOnboarding")
};
var rules = {
  canReadPeople({ session }) {
    if (!session) return false;
    if (session.data.role?.canSeeOtherPeople || session.data.role?.canManagePeople) return true;
    return { id: { equals: session.itemId } };
  },
  canUpdatePeople({ session }) {
    if (!session) return false;
    if (session.data.role?.canEditOtherPeople || session.data.role?.canManagePeople) return true;
    return { id: { equals: session.itemId } };
  }
};

// features/keystone/models/trackingFields.ts
var import_fields = require("@keystone-6/core/fields");
var trackingFields = {
  createdAt: (0, import_fields.timestamp)({
    access: { read: () => true, create: () => false, update: () => false },
    validation: { isRequired: true },
    defaultValue: { kind: "now" },
    ui: {
      createView: { fieldMode: "hidden" },
      itemView: { fieldMode: "read" }
    }
  }),
  updatedAt: (0, import_fields.timestamp)({
    access: { read: () => true, create: () => false, update: () => false },
    db: { updatedAt: true },
    validation: { isRequired: true },
    defaultValue: { kind: "now" },
    ui: {
      createView: { fieldMode: "hidden" },
      itemView: { fieldMode: "read" }
    }
  })
};

// features/keystone/models/User.ts
var User = (0, import_core.list)({
  access: {
    operation: {
      ...(0, import_access.allOperations)(isSignedIn),
      create: (args) => process.env.PUBLIC_SIGNUPS_ALLOWED === "true" || permissions.canManagePeople(args),
      delete: permissions.canManagePeople
    },
    filter: {
      query: rules.canReadPeople,
      update: rules.canUpdatePeople
    }
  },
  ui: {
    hideCreate: (args) => !permissions.canManagePeople(args),
    hideDelete: (args) => !permissions.canManagePeople(args),
    listView: { initialColumns: ["name", "email", "role", "phone"] },
    itemView: {
      defaultFieldMode: ({ session, item }) => {
        if (session?.data.role?.canEditOtherPeople || session?.data.role?.canManagePeople) return "edit";
        if (session?.itemId === item?.id) return "edit";
        return "read";
      }
    }
  },
  fields: {
    name: (0, import_fields2.text)({ validation: { isRequired: true } }),
    email: (0, import_fields2.text)({ isFilterable: false, isOrderable: false, isIndexed: "unique", validation: { isRequired: true } }),
    phone: (0, import_fields2.text)(),
    password: (0, import_fields2.password)({
      access: {
        read: import_access.denyAll,
        update: ({ session, item }) => permissions.canManagePeople({ session }) || session?.itemId === item.id
      },
      validation: { isRequired: true }
    }),
    onboardingStatus: (0, import_fields2.select)({
      type: "string",
      options: [
        { label: "Not Started", value: "not_started" },
        { label: "In Progress", value: "in_progress" },
        { label: "Completed", value: "completed" },
        { label: "Dismissed", value: "dismissed" }
      ],
      defaultValue: "not_started"
    }),
    role: (0, import_fields2.relationship)({
      ref: "Role.assignedTo",
      access: { create: permissions.canManagePeople, update: permissions.canManagePeople },
      ui: { itemView: { fieldMode: (args) => permissions.canManagePeople(args) ? "edit" : "read" } }
    }),
    cafeOrders: (0, import_fields2.relationship)({ ref: "CafeOrder.customer", many: true }),
    payments: (0, import_fields2.relationship)({ ref: "Payment.customer", many: true }),
    loyaltyAccount: (0, import_fields2.relationship)({ ref: "LoyaltyAccount.customer" }),
    ...trackingFields
  }
});

// features/keystone/models/Role.ts
var import_core2 = require("@keystone-6/core");
var import_access3 = require("@keystone-6/core/access");
var import_fields3 = require("@keystone-6/core/fields");
var Role = (0, import_core2.list)({
  access: {
    operation: {
      ...(0, import_access3.allOperations)(permissions.canManageRoles),
      query: isSignedIn
    }
  },
  ui: {
    hideCreate: (args) => !permissions.canManageRoles(args),
    hideDelete: (args) => !permissions.canManageRoles(args),
    listView: { initialColumns: ["name", "assignedTo"] },
    itemView: { defaultFieldMode: (args) => permissions.canManageRoles(args) ? "edit" : "read" }
  },
  fields: {
    name: (0, import_fields3.text)({ validation: { isRequired: true } }),
    canAccessDashboard: (0, import_fields3.checkbox)({ defaultValue: false }),
    canReadOrders: (0, import_fields3.checkbox)({ defaultValue: false }),
    canManageOrders: (0, import_fields3.checkbox)({ defaultValue: false }),
    canReadPayments: (0, import_fields3.checkbox)({ defaultValue: false }),
    canManagePayments: (0, import_fields3.checkbox)({ defaultValue: false }),
    canReadProducts: (0, import_fields3.checkbox)({ defaultValue: false }),
    canManageProducts: (0, import_fields3.checkbox)({ defaultValue: false }),
    canReadInventory: (0, import_fields3.checkbox)({ defaultValue: false }),
    canManageInventory: (0, import_fields3.checkbox)({ defaultValue: false }),
    canReadLoyalty: (0, import_fields3.checkbox)({ defaultValue: false }),
    canManageLoyalty: (0, import_fields3.checkbox)({ defaultValue: false }),
    canSeeOtherPeople: (0, import_fields3.checkbox)({ defaultValue: false }),
    canEditOtherPeople: (0, import_fields3.checkbox)({ defaultValue: false }),
    canManagePeople: (0, import_fields3.checkbox)({ defaultValue: false }),
    canManageRoles: (0, import_fields3.checkbox)({ defaultValue: false }),
    canManageSettings: (0, import_fields3.checkbox)({ defaultValue: false }),
    canManageOnboarding: (0, import_fields3.checkbox)({ defaultValue: true }),
    assignedTo: (0, import_fields3.relationship)({
      ref: "User.role",
      many: true,
      ui: { itemView: { fieldMode: "read" } }
    }),
    ...trackingFields
  }
});

// features/keystone/models/MenuCategory.ts
var import_core3 = require("@keystone-6/core");
var import_fields4 = require("@keystone-6/core/fields");
var MenuCategory = (0, import_core3.list)({
  access: {
    operation: {
      query: () => true,
      create: permissions.canManageProducts,
      update: permissions.canManageProducts,
      delete: permissions.canManageProducts
    }
  },
  ui: {
    listView: {
      initialColumns: ["name", "active", "sortOrder", "menuItems"]
    }
  },
  fields: {
    name: (0, import_fields4.text)({ validation: { isRequired: true } }),
    description: (0, import_fields4.text)({ ui: { displayMode: "textarea" } }),
    active: (0, import_fields4.checkbox)({ defaultValue: true }),
    sortOrder: (0, import_fields4.integer)({ defaultValue: 0 }),
    menuItems: (0, import_fields4.relationship)({ ref: "MenuItem.category", many: true }),
    ...trackingFields
  }
});

// features/keystone/models/MenuItem.ts
var import_core4 = require("@keystone-6/core");
var import_fields5 = require("@keystone-6/core/fields");
var import_fields_document = require("@keystone-6/fields-document");
var MenuItem = (0, import_core4.list)({
  access: {
    operation: {
      query: () => true,
      create: permissions.canManageProducts,
      update: permissions.canManageProducts,
      delete: permissions.canManageProducts
    }
  },
  ui: {
    listView: {
      initialColumns: ["name", "category", "price", "available", "barStation", "prepTimeMinutes"]
    }
  },
  fields: {
    name: (0, import_fields5.text)({ validation: { isRequired: true } }),
    description: (0, import_fields_document.document)({ formatting: true, links: true }),
    shortDescription: (0, import_fields5.text)({ ui: { displayMode: "textarea" } }),
    price: (0, import_fields5.integer)({ validation: { isRequired: true }, ui: { description: "Base price in cents" } }),
    available: (0, import_fields5.checkbox)({ defaultValue: true }),
    featured: (0, import_fields5.checkbox)({ defaultValue: false }),
    popular: (0, import_fields5.checkbox)({ defaultValue: false }),
    imageUrl: (0, import_fields5.text)({ ui: { description: "Storefront image URL or local asset path" }, db: { isNullable: true } }),
    prepTimeMinutes: (0, import_fields5.integer)({ defaultValue: 5, validation: { min: 0 } }),
    caffeineMg: (0, import_fields5.integer)({ ui: { description: "Approximate caffeine content for drinks" } }),
    calories: (0, import_fields5.integer)(),
    barStation: (0, import_fields5.select)({
      type: "string",
      options: [
        { label: "Espresso Bar", value: "espresso_bar" },
        { label: "Cold Bar", value: "cold_bar" },
        { label: "Brew Bar", value: "brew_bar" },
        { label: "Pastry Case", value: "pastry_case" },
        { label: "Retail Shelf", value: "retail_shelf" }
      ],
      defaultValue: "espresso_bar"
    }),
    temperatureOptions: (0, import_fields5.multiselect)({
      type: "string",
      options: [
        { label: "Hot", value: "hot" },
        { label: "Iced", value: "iced" },
        { label: "Blended", value: "blended" }
      ],
      defaultValue: ["hot"]
    }),
    dietaryFlags: (0, import_fields5.multiselect)({
      type: "string",
      options: [
        { label: "Vegan", value: "vegan" },
        { label: "Vegetarian", value: "vegetarian" },
        { label: "Gluten-Free", value: "gluten_free" },
        { label: "Dairy-Free", value: "dairy_free" },
        { label: "Nut-Free", value: "nut_free" }
      ],
      defaultValue: []
    }),
    serviceWindows: (0, import_fields5.multiselect)({
      type: "string",
      options: [
        { label: "Morning", value: "morning" },
        { label: "Midday", value: "midday" },
        { label: "Afternoon", value: "afternoon" },
        { label: "All Day", value: "all_day" }
      ],
      defaultValue: ["all_day"]
    }),
    displayPrice: (0, import_fields5.virtual)({
      field: import_core4.graphql.field({
        type: import_core4.graphql.String,
        resolve(item) {
          return `$${((item.price || 0) / 100).toFixed(2)}`;
        }
      })
    }),
    category: (0, import_fields5.relationship)({ ref: "MenuCategory.menuItems" }),
    modifiers: (0, import_fields5.relationship)({
      ref: "MenuItemModifier.menuItem",
      many: true,
      ui: {
        displayMode: "cards",
        cardFields: ["name", "modifierGroup", "priceAdjustment", "defaultSelected"],
        inlineCreate: { fields: ["name", "modifierGroup", "priceAdjustment", "defaultSelected"] },
        inlineEdit: { fields: ["name", "modifierGroup", "priceAdjustment", "defaultSelected"] }
      }
    }),
    orderItems: (0, import_fields5.relationship)({ ref: "OrderItem.menuItem", many: true }),
    inventoryItem: (0, import_fields5.relationship)({ ref: "InventoryItem.menuItems" }),
    ...trackingFields
  }
});

// features/keystone/models/MenuItemModifier.ts
var import_core5 = require("@keystone-6/core");
var import_fields6 = require("@keystone-6/core/fields");
var MenuItemModifier = (0, import_core5.list)({
  access: {
    operation: {
      query: () => true,
      create: permissions.canManageProducts,
      update: permissions.canManageProducts,
      delete: permissions.canManageProducts
    }
  },
  ui: {
    listView: {
      initialColumns: ["name", "modifierGroup", "priceAdjustment", "defaultSelected", "menuItem"]
    }
  },
  fields: {
    name: (0, import_fields6.text)({ validation: { isRequired: true } }),
    modifierGroup: (0, import_fields6.select)({
      type: "string",
      options: [
        { label: "Size", value: "size" },
        { label: "Milk", value: "milk" },
        { label: "Espresso", value: "espresso" },
        { label: "Syrup", value: "syrup" },
        { label: "Sweetness", value: "sweetness" },
        { label: "Temperature", value: "temperature" },
        { label: "Ice", value: "ice" },
        { label: "Topping", value: "topping" },
        { label: "Bakery Prep", value: "bakery_prep" }
      ],
      defaultValue: "milk"
    }),
    modifierGroupLabel: (0, import_fields6.text)({ ui: { description: "Customer-facing group label, e.g. Milk choice" } }),
    required: (0, import_fields6.checkbox)({ defaultValue: false }),
    minSelections: (0, import_fields6.integer)({ defaultValue: 0, validation: { min: 0 } }),
    maxSelections: (0, import_fields6.integer)({ defaultValue: 1, validation: { min: 1 } }),
    priceAdjustment: (0, import_fields6.integer)({ defaultValue: 0, ui: { description: "Cents added or removed" } }),
    defaultSelected: (0, import_fields6.checkbox)({ defaultValue: false }),
    inStock: (0, import_fields6.checkbox)({ defaultValue: true }),
    menuItem: (0, import_fields6.relationship)({ ref: "MenuItem.modifiers" }),
    ...trackingFields
  }
});

// features/keystone/models/CafeOrder.ts
var import_core6 = require("@keystone-6/core");
var import_fields7 = require("@keystone-6/core/fields");
var import_crypto = __toESM(require("crypto"));
var CafeOrder = (0, import_core6.list)({
  access: {
    operation: {
      query: ({ session }) => permissions.canReadOrders({ session }) || permissions.canManageOrders({ session }),
      create: permissions.canManageOrders,
      update: permissions.canManageOrders,
      delete: permissions.canManageOrders
    }
  },
  ui: {
    listView: {
      initialColumns: ["orderNumber", "status", "fulfillmentType", "customerName", "promisedAt", "total"]
    }
  },
  fields: {
    orderNumber: (0, import_fields7.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
    fulfillmentType: (0, import_fields7.select)({
      type: "string",
      options: [
        { label: "Pickup", value: "pickup" },
        { label: "Counter", value: "counter" },
        { label: "Dine-in", value: "dine_in" }
      ],
      defaultValue: "pickup"
    }),
    orderSource: (0, import_fields7.select)({
      type: "string",
      options: [
        { label: "Online", value: "online" },
        { label: "POS", value: "pos" },
        { label: "Kiosk", value: "kiosk" },
        { label: "Phone", value: "phone" }
      ],
      defaultValue: "online"
    }),
    status: (0, import_fields7.select)({
      type: "string",
      options: [
        { label: "Open", value: "open" },
        { label: "Paid", value: "paid" },
        { label: "In Bar Queue", value: "in_bar_queue" },
        { label: "Preparing", value: "preparing" },
        { label: "Ready for Pickup", value: "ready" },
        { label: "Completed", value: "completed" },
        { label: "Cancelled", value: "cancelled" },
        { label: "Refunded", value: "refunded" }
      ],
      defaultValue: "open"
    }),
    customerName: (0, import_fields7.text)(),
    customerEmail: (0, import_fields7.text)(),
    customerPhone: (0, import_fields7.text)(),
    pickupName: (0, import_fields7.text)({ ui: { description: "Name called at handoff counter" } }),
    specialInstructions: (0, import_fields7.text)({ ui: { displayMode: "textarea" } }),
    subtotal: (0, import_fields7.integer)({ defaultValue: 0 }),
    tax: (0, import_fields7.integer)({ defaultValue: 0 }),
    tip: (0, import_fields7.integer)({ defaultValue: 0 }),
    discount: (0, import_fields7.integer)({ defaultValue: 0 }),
    total: (0, import_fields7.integer)({ defaultValue: 0 }),
    currencyCode: (0, import_fields7.text)({ defaultValue: "USD" }),
    paidAt: (0, import_fields7.timestamp)(),
    promisedAt: (0, import_fields7.timestamp)({ ui: { description: "Quoted pickup time" } }),
    startedAt: (0, import_fields7.timestamp)(),
    readyAt: (0, import_fields7.timestamp)(),
    completedAt: (0, import_fields7.timestamp)(),
    cancelledAt: (0, import_fields7.timestamp)(),
    isRush: (0, import_fields7.checkbox)({ defaultValue: false }),
    handoffCode: (0, import_fields7.text)({
      hooks: {
        resolveInput: ({ operation, resolvedData }) => {
          if (operation === "create" && !resolvedData.handoffCode) {
            return import_crypto.default.randomBytes(3).toString("hex").toUpperCase();
          }
          return resolvedData.handoffCode;
        }
      }
    }),
    secretKey: (0, import_fields7.text)({
      hooks: {
        resolveInput: ({ operation }) => operation === "create" ? import_crypto.default.randomBytes(32).toString("hex") : void 0
      }
    }),
    orderAgeMinutes: (0, import_fields7.virtual)({
      field: import_core6.graphql.field({
        type: import_core6.graphql.Int,
        resolve(item) {
          if (!item.createdAt) return 0;
          return Math.max(0, Math.floor((Date.now() - new Date(item.createdAt).getTime()) / 6e4));
        }
      })
    }),
    customer: (0, import_fields7.relationship)({ ref: "User.cafeOrders" }),
    orderItems: (0, import_fields7.relationship)({ ref: "OrderItem.order", many: true }),
    payments: (0, import_fields7.relationship)({ ref: "Payment.order", many: true }),
    loyaltyAccount: (0, import_fields7.relationship)({ ref: "LoyaltyAccount.orders" }),
    loyaltyEvents: (0, import_fields7.relationship)({ ref: "LoyaltyEvent.order", many: true }),
    ...trackingFields
  }
});

// features/keystone/models/OrderItem.ts
var import_core7 = require("@keystone-6/core");
var import_fields8 = require("@keystone-6/core/fields");
var OrderItem = (0, import_core7.list)({
  access: {
    operation: {
      query: permissions.canReadOrders,
      create: permissions.canManageOrders,
      update: permissions.canManageOrders,
      delete: permissions.canManageOrders
    }
  },
  ui: {
    listView: {
      initialColumns: ["menuItem", "quantity", "price", "barStatus", "order"]
    }
  },
  fields: {
    quantity: (0, import_fields8.integer)({ defaultValue: 1, validation: { min: 1, isRequired: true } }),
    price: (0, import_fields8.integer)({ validation: { isRequired: true }, ui: { description: "Unit price snapshot in cents" } }),
    itemNameSnapshot: (0, import_fields8.text)({ ui: { description: "Menu item name at time of order" } }),
    customizationsSummary: (0, import_fields8.text)({ ui: { displayMode: "textarea" } }),
    specialInstructions: (0, import_fields8.text)({ ui: { displayMode: "textarea" } }),
    barStatus: (0, import_fields8.select)({
      type: "string",
      options: [
        { label: "New", value: "new" },
        { label: "Queued", value: "queued" },
        { label: "Preparing", value: "preparing" },
        { label: "Ready", value: "ready" },
        { label: "Handed Off", value: "handed_off" },
        { label: "Voided", value: "voided" }
      ],
      defaultValue: "new"
    }),
    station: (0, import_fields8.select)({
      type: "string",
      options: [
        { label: "Espresso Bar", value: "espresso_bar" },
        { label: "Cold Bar", value: "cold_bar" },
        { label: "Brew Bar", value: "brew_bar" },
        { label: "Pastry Case", value: "pastry_case" },
        { label: "Retail Shelf", value: "retail_shelf" }
      ],
      defaultValue: "espresso_bar"
    }),
    queuedAt: (0, import_fields8.timestamp)(),
    startedAt: (0, import_fields8.timestamp)(),
    readyAt: (0, import_fields8.timestamp)(),
    handedOffAt: (0, import_fields8.timestamp)(),
    totalPrice: (0, import_fields8.virtual)({
      field: import_core7.graphql.field({
        type: import_core7.graphql.Int,
        resolve(item) {
          return (item.price || 0) * (item.quantity || 1);
        }
      })
    }),
    order: (0, import_fields8.relationship)({ ref: "CafeOrder.orderItems" }),
    menuItem: (0, import_fields8.relationship)({ ref: "MenuItem.orderItems" }),
    appliedModifiers: (0, import_fields8.relationship)({ ref: "MenuItemModifier", many: true }),
    ...trackingFields
  }
});

// features/keystone/models/Payment.ts
var import_core8 = require("@keystone-6/core");
var import_fields9 = require("@keystone-6/core/fields");
var Payment = (0, import_core8.list)({
  access: {
    operation: {
      query: permissions.canReadPayments,
      create: permissions.canManagePayments,
      update: permissions.canManagePayments,
      delete: permissions.canManagePayments
    }
  },
  ui: { listView: { initialColumns: ["order", "status", "method", "amount", "processedAt"] } },
  fields: {
    status: (0, import_fields9.select)({
      type: "string",
      options: [
        { label: "Pending", value: "pending" },
        { label: "Authorized", value: "authorized" },
        { label: "Captured", value: "captured" },
        { label: "Failed", value: "failed" },
        { label: "Refunded", value: "refunded" },
        { label: "Cancelled", value: "cancelled" }
      ],
      defaultValue: "pending"
    }),
    method: (0, import_fields9.select)({
      type: "string",
      options: [
        { label: "Card", value: "card" },
        { label: "Cash", value: "cash" },
        { label: "Gift Card", value: "gift_card" },
        { label: "Manual", value: "manual" }
      ],
      defaultValue: "card"
    }),
    amount: (0, import_fields9.integer)({ validation: { isRequired: true }, ui: { description: "Amount in cents" } }),
    currencyCode: (0, import_fields9.text)({ defaultValue: "USD" }),
    provider: (0, import_fields9.text)({ defaultValue: "manual" }),
    providerPaymentId: (0, import_fields9.text)(),
    failureMessage: (0, import_fields9.text)(),
    processedAt: (0, import_fields9.timestamp)(),
    order: (0, import_fields9.relationship)({ ref: "CafeOrder.payments" }),
    customer: (0, import_fields9.relationship)({ ref: "User.payments" }),
    paymentProvider: (0, import_fields9.relationship)({ ref: "PaymentProvider.paymentRecords" }),
    ...trackingFields
  }
});

// features/keystone/models/PaymentProvider.ts
var import_core9 = require("@keystone-6/core");
var import_fields10 = require("@keystone-6/core/fields");
var PaymentProvider = (0, import_core9.list)({
  access: {
    operation: {
      query: ({ session }) => permissions.canReadPayments({ session }) || permissions.canManagePayments({ session }),
      create: permissions.canManagePayments,
      update: permissions.canManagePayments,
      delete: permissions.canManagePayments
    }
  },
  ui: {
    listView: {
      initialColumns: ["name", "code", "isInstalled"]
    }
  },
  fields: {
    name: (0, import_fields10.text)({
      validation: { isRequired: true }
    }),
    code: (0, import_fields10.text)({
      isIndexed: "unique",
      validation: {
        isRequired: true,
        match: {
          regex: /^pp_[a-zA-Z0-9-_]+$/,
          explanation: 'Payment provider code must start with "pp_" followed by alphanumeric characters, hyphens or underscores'
        }
      }
    }),
    isInstalled: (0, import_fields10.checkbox)({
      defaultValue: true
    }),
    credentials: (0, import_fields10.json)({
      defaultValue: {}
    }),
    metadata: (0, import_fields10.json)({
      defaultValue: {}
    }),
    createPaymentFunction: (0, import_fields10.text)({
      validation: { isRequired: true },
      ui: {
        description: "Name of the adapter function to create payments"
      }
    }),
    capturePaymentFunction: (0, import_fields10.text)({
      validation: { isRequired: true },
      ui: {
        description: "Name of the adapter function to capture payments"
      }
    }),
    refundPaymentFunction: (0, import_fields10.text)({
      validation: { isRequired: true },
      ui: {
        description: "Name of the adapter function to refund payments"
      }
    }),
    getPaymentStatusFunction: (0, import_fields10.text)({
      validation: { isRequired: true },
      ui: {
        description: "Name of the adapter function to check payment status"
      }
    }),
    generatePaymentLinkFunction: (0, import_fields10.text)({
      validation: { isRequired: true },
      ui: {
        description: "Name of the adapter function to generate payment links"
      }
    }),
    handleWebhookFunction: (0, import_fields10.text)({
      validation: { isRequired: true },
      ui: {
        description: "Name of the adapter function to handle provider webhooks"
      }
    }),
    paymentRecords: (0, import_fields10.relationship)({
      ref: "Payment.paymentProvider",
      many: true
    }),
    ...trackingFields
  }
});

// features/keystone/models/InventoryItem.ts
var import_core10 = require("@keystone-6/core");
var import_fields11 = require("@keystone-6/core/fields");
var InventoryItem = (0, import_core10.list)({
  access: {
    operation: {
      query: permissions.canReadInventory,
      create: permissions.canManageInventory,
      update: permissions.canManageInventory,
      delete: permissions.canManageInventory
    }
  },
  ui: { listView: { initialColumns: ["name", "category", "currentStock", "unit", "reorderPoint"] } },
  fields: {
    name: (0, import_fields11.text)({ validation: { isRequired: true } }),
    category: (0, import_fields11.select)({
      type: "string",
      options: [
        { label: "Coffee", value: "coffee" },
        { label: "Milk", value: "milk" },
        { label: "Syrup", value: "syrup" },
        { label: "Tea", value: "tea" },
        { label: "Bakery", value: "bakery" },
        { label: "Retail", value: "retail" },
        { label: "Packaging", value: "packaging" }
      ],
      defaultValue: "coffee"
    }),
    unit: (0, import_fields11.select)({
      type: "string",
      options: [
        { label: "Each", value: "each" },
        { label: "Pound", value: "lb" },
        { label: "Ounce", value: "oz" },
        { label: "Gram", value: "g" },
        { label: "Gallon", value: "gal" },
        { label: "Liter", value: "l" }
      ],
      defaultValue: "each"
    }),
    currentStock: (0, import_fields11.decimal)({ defaultValue: "0" }),
    reorderPoint: (0, import_fields11.decimal)({ defaultValue: "0" }),
    parLevel: (0, import_fields11.decimal)({ defaultValue: "0" }),
    costPerUnit: (0, import_fields11.integer)({ defaultValue: 0, ui: { description: "Cost in cents" } }),
    supplierName: (0, import_fields11.text)(),
    sku: (0, import_fields11.text)(),
    menuItems: (0, import_fields11.relationship)({ ref: "MenuItem.inventoryItem", many: true }),
    stockMovements: (0, import_fields11.relationship)({ ref: "StockMovement.inventoryItem", many: true }),
    ...trackingFields
  }
});

// features/keystone/models/StockMovement.ts
var import_core11 = require("@keystone-6/core");
var import_fields12 = require("@keystone-6/core/fields");
var StockMovement = (0, import_core11.list)({
  access: {
    operation: {
      query: permissions.canReadInventory,
      create: permissions.canManageInventory,
      update: permissions.canManageInventory,
      delete: permissions.canManageInventory
    }
  },
  ui: { listView: { initialColumns: ["inventoryItem", "type", "quantity", "reason"] } },
  fields: {
    type: (0, import_fields12.select)({
      type: "string",
      options: [
        { label: "Received", value: "received" },
        { label: "Sale", value: "sale" },
        { label: "Waste", value: "waste" },
        { label: "Adjustment", value: "adjustment" },
        { label: "Transfer", value: "transfer" }
      ],
      defaultValue: "adjustment"
    }),
    quantity: (0, import_fields12.decimal)({ validation: { isRequired: true } }),
    reason: (0, import_fields12.text)(),
    notes: (0, import_fields12.text)({ ui: { displayMode: "textarea" } }),
    inventoryItem: (0, import_fields12.relationship)({ ref: "InventoryItem.stockMovements" }),
    createdBy: (0, import_fields12.relationship)({ ref: "User" }),
    ...trackingFields
  }
});

// features/keystone/models/LoyaltyAccount.ts
var import_core12 = require("@keystone-6/core");
var import_fields13 = require("@keystone-6/core/fields");
var LoyaltyAccount = (0, import_core12.list)({
  access: {
    operation: {
      query: permissions.canReadLoyalty,
      create: permissions.canManageLoyalty,
      update: permissions.canManageLoyalty,
      delete: permissions.canManageLoyalty
    }
  },
  ui: { listView: { initialColumns: ["customerName", "customerEmail", "status", "pointsBalance", "drinkCredits", "tier"] } },
  fields: {
    customerName: (0, import_fields13.text)({ ui: { description: "Guest-facing name for loyalty lookup when no user account is attached" } }),
    customerEmail: (0, import_fields13.text)({ isIndexed: "unique", ui: { description: "Email used for pickup loyalty lookup" } }),
    customerPhone: (0, import_fields13.text)(),
    marketingOptIn: (0, import_fields13.checkbox)({ defaultValue: false }),
    status: (0, import_fields13.select)({
      type: "string",
      options: [
        { label: "Active", value: "active" },
        { label: "Paused", value: "paused" },
        { label: "Closed", value: "closed" }
      ],
      defaultValue: "active"
    }),
    tier: (0, import_fields13.select)({
      type: "string",
      options: [
        { label: "Regular", value: "regular" },
        { label: "Neighborhood", value: "neighborhood" },
        { label: "House Account", value: "house_account" }
      ],
      defaultValue: "regular"
    }),
    pointsBalance: (0, import_fields13.integer)({ defaultValue: 0 }),
    lifetimePoints: (0, import_fields13.integer)({ defaultValue: 0 }),
    drinkCredits: (0, import_fields13.integer)({ defaultValue: 0 }),
    visits: (0, import_fields13.integer)({ defaultValue: 0 }),
    lastVisitAt: (0, import_fields13.timestamp)(),
    firstVisitAt: (0, import_fields13.timestamp)(),
    notes: (0, import_fields13.text)({ ui: { displayMode: "textarea" } }),
    customer: (0, import_fields13.relationship)({ ref: "User.loyaltyAccount" }),
    orders: (0, import_fields13.relationship)({ ref: "CafeOrder.loyaltyAccount", many: true }),
    events: (0, import_fields13.relationship)({ ref: "LoyaltyEvent.account", many: true }),
    displayName: (0, import_fields13.virtual)({
      field: import_core12.graphql.field({
        type: import_core12.graphql.String,
        resolve(item) {
          return item.customerName || item.customerEmail || "Guest account";
        }
      })
    }),
    nextRewardProgress: (0, import_fields13.virtual)({
      field: import_core12.graphql.field({
        type: import_core12.graphql.Int,
        resolve(item) {
          return Math.min(100, Math.floor((item.pointsBalance || 0) % 100 / 100 * 100));
        }
      })
    }),
    ...trackingFields
  }
});

// features/keystone/models/LoyaltyEvent.ts
var import_core13 = require("@keystone-6/core");
var import_fields14 = require("@keystone-6/core/fields");
var LoyaltyEvent = (0, import_core13.list)({
  access: {
    operation: {
      query: permissions.canReadLoyalty,
      create: permissions.canManageLoyalty,
      update: permissions.canManageLoyalty,
      delete: permissions.canManageLoyalty
    }
  },
  ui: { listView: { initialColumns: ["account", "type", "pointsDelta", "drinkCreditsDelta", "order"] } },
  fields: {
    type: (0, import_fields14.select)({
      type: "string",
      options: [
        { label: "Earned", value: "earned" },
        { label: "Redeemed", value: "redeemed" },
        { label: "Manual Adjustment", value: "manual_adjustment" },
        { label: "Signup", value: "signup" }
      ],
      defaultValue: "earned"
    }),
    pointsDelta: (0, import_fields14.integer)({ defaultValue: 0 }),
    drinkCreditsDelta: (0, import_fields14.integer)({ defaultValue: 0 }),
    note: (0, import_fields14.text)({ ui: { displayMode: "textarea" } }),
    account: (0, import_fields14.relationship)({ ref: "LoyaltyAccount.events" }),
    order: (0, import_fields14.relationship)({ ref: "CafeOrder.loyaltyEvents" }),
    createdBy: (0, import_fields14.relationship)({ ref: "User" }),
    ...trackingFields
  }
});

// features/keystone/models/index.ts
var models = {
  User,
  Role,
  MenuCategory,
  MenuItem,
  MenuItemModifier,
  CafeOrder,
  OrderItem,
  Payment,
  PaymentProvider,
  InventoryItem,
  StockMovement,
  LoyaltyAccount,
  LoyaltyEvent
};

// features/keystone/index.ts
var import_session = require("@keystone-6/core/session");

// features/keystone/mutations/index.ts
var import_schema = require("@graphql-tools/schema");

// features/keystone/mutations/redirectToInit.ts
async function redirectToInit(root, args, context) {
  const userCount = await context.sudo().query.User.count({});
  if (userCount === 0) {
    return true;
  }
  return false;
}
var redirectToInit_default = redirectToInit;

// features/keystone/mutations/createCafePickupOrder.ts
function generateOrderNumber() {
  const now = /* @__PURE__ */ new Date();
  const date = now.toISOString().slice(2, 10).replace(/-/g, "");
  const suffix = now.getTime().toString().slice(-5);
  return `CF-${date}-${suffix}`;
}
function normalizeEmail(email) {
  return email?.trim().toLowerCase() || null;
}
function normalizePhone(phone) {
  return phone?.replace(/[^+\d]/g, "") || null;
}
function validateModifierSelections(menuItem, selectedModifiers) {
  const groups = (menuItem.modifiers || []).reduce((acc, modifier) => {
    const key = modifier.modifierGroup || "default";
    acc[key] = acc[key] || [];
    acc[key].push(modifier);
    return acc;
  }, {});
  const selectedByGroup = selectedModifiers.reduce((acc, modifier) => {
    const key = modifier.modifierGroup || "default";
    acc[key] = acc[key] || [];
    acc[key].push(modifier);
    return acc;
  }, {});
  for (const [group, modifiers] of Object.entries(groups)) {
    const first = modifiers[0];
    const selectedCount = selectedByGroup[group]?.length || 0;
    const required = modifiers.some((modifier) => Boolean(modifier.required));
    const minSelections = Math.max(required ? 1 : 0, ...modifiers.map((modifier) => Number(modifier.minSelections || 0)));
    const maxSelections = Math.max(...modifiers.map((modifier) => Number(modifier.maxSelections || 1)));
    const label = first.modifierGroupLabel || first.modifierGroup || "modifier";
    if (selectedCount < minSelections) {
      throw new Error(`${menuItem.name} requires at least ${minSelections} ${label} selection${minSelections === 1 ? "" : "s"}`);
    }
    if (selectedCount > maxSelections) {
      throw new Error(`${menuItem.name} allows at most ${maxSelections} ${label} selection${maxSelections === 1 ? "" : "s"}`);
    }
  }
}
async function createCafePickupOrder(root, args, context) {
  const items = (args.items || []).filter((item) => item?.menuItemId && (item.quantity || 0) > 0);
  if (!args.customerName?.trim()) {
    throw new Error("Pickup name is required");
  }
  if (items.length === 0) {
    throw new Error("Order must include at least one menu item");
  }
  const sudo = context.sudo();
  const itemIds = Array.from(new Set(items.map((item) => item.menuItemId)));
  const modifierIds = Array.from(new Set(items.flatMap((item) => item.modifierIds || [])));
  const [menuItems, modifiers] = await Promise.all([
    sudo.query.MenuItem.findMany({
      where: { id: { in: itemIds } },
      query: "id name price available barStation modifiers { id name priceAdjustment inStock modifierGroup modifierGroupLabel required minSelections maxSelections menuItem { id } }"
    }),
    modifierIds.length ? sudo.query.MenuItemModifier.findMany({
      where: { id: { in: modifierIds } },
      query: "id name priceAdjustment inStock modifierGroup modifierGroupLabel required minSelections maxSelections menuItem { id }"
    }) : Promise.resolve([])
  ]);
  const menuItemMap = new Map(menuItems.map((item) => [item.id, item]));
  const modifierMap = new Map(modifiers.map((modifier) => [modifier.id, modifier]));
  const normalizedItems = items.map((item) => {
    const menuItem = menuItemMap.get(item.menuItemId);
    if (!menuItem) throw new Error(`Menu item not found: ${item.menuItemId}`);
    if (!menuItem.available) throw new Error(`${menuItem.name} is currently unavailable`);
    const allItemModifiers = menuItem.modifiers || [];
    const allItemModifierIds = new Set(allItemModifiers.map((modifier) => modifier.id));
    const selectedModifiers = (item.modifierIds || []).map((id2) => {
      const modifier = modifierMap.get(id2);
      if (!modifier) throw new Error(`Modifier not found: ${id2}`);
      if (!allItemModifierIds.has(modifier.id) || modifier.menuItem?.id !== menuItem.id) {
        throw new Error(`${modifier.name} is not a valid modifier for ${menuItem.name}`);
      }
      if (modifier.inStock === false) throw new Error(`${modifier.name} is currently unavailable`);
      return modifier;
    });
    validateModifierSelections(menuItem, selectedModifiers);
    const modifierTotal = selectedModifiers.reduce((sum, modifier) => sum + Number(modifier.priceAdjustment || 0), 0);
    const unitPrice = Number(menuItem.price || 0) + modifierTotal;
    const quantity = Math.max(1, Number(item.quantity || 1));
    return {
      menuItem,
      selectedModifiers,
      quantity,
      unitPrice,
      specialInstructions: item.specialInstructions?.trim() || "",
      customizationsSummary: selectedModifiers.map((modifier) => modifier.name).join(", ")
    };
  });
  const subtotal = normalizedItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  const tax = Math.round(subtotal * 0.0875);
  const total = subtotal + tax;
  const now = /* @__PURE__ */ new Date();
  const promisedAt = new Date(now.getTime() + Math.max(5, Number(args.requestedPickupMinutes || 12)) * 60 * 1e3);
  const paymentMethod = args.paymentMethod || "manual";
  const orderSource = args.orderSource || "online";
  const fulfillmentType = args.fulfillmentType || "pickup";
  const isImmediateTender = paymentMethod === "cash" || paymentMethod === "manual_card";
  const initialStatus = isImmediateTender ? "paid" : "open";
  const order = await sudo.db.CafeOrder.createOne({
    data: {
      orderNumber: generateOrderNumber(),
      fulfillmentType,
      orderSource,
      status: initialStatus,
      customerName: args.customerName.trim(),
      customerEmail: normalizeEmail(args.customerEmail),
      customerPhone: normalizePhone(args.customerPhone),
      pickupName: args.pickupName?.trim() || args.customerName.trim(),
      specialInstructions: args.specialInstructions?.trim() || "",
      subtotal,
      tax,
      total,
      paidAt: isImmediateTender ? now.toISOString() : void 0,
      promisedAt: promisedAt.toISOString(),
      currencyCode: "USD"
    }
  });
  for (const item of normalizedItems) {
    await sudo.db.OrderItem.createOne({
      data: {
        order: { connect: { id: order.id } },
        menuItem: { connect: { id: item.menuItem.id } },
        appliedModifiers: item.selectedModifiers.length ? { connect: item.selectedModifiers.map((modifier) => ({ id: modifier.id })) } : void 0,
        quantity: item.quantity,
        price: item.unitPrice,
        itemNameSnapshot: item.menuItem.name,
        customizationsSummary: item.customizationsSummary,
        specialInstructions: item.specialInstructions,
        station: item.menuItem.barStation || "espresso_bar",
        barStatus: "queued",
        queuedAt: now.toISOString()
      }
    });
  }
  if (paymentMethod === "cash" || paymentMethod === "manual_card") {
    await sudo.db.Payment.createOne({
      data: {
        order: { connect: { id: order.id } },
        status: paymentMethod === "cash" ? "pending" : "captured",
        method: paymentMethod === "cash" ? "cash" : "card",
        amount: total,
        currencyCode: "USD",
        provider: paymentMethod === "cash" ? "counter" : "manual_card",
        providerPaymentId: `manual_${order.orderNumber}`,
        processedAt: paymentMethod === "cash" ? void 0 : now.toISOString()
      }
    });
  }
  return sudo.query.CafeOrder.findOne({
    where: { id: order.id },
    query: `
      id
      orderNumber
      status
      handoffCode
      customerName
      pickupName
      promisedAt
      subtotal
      tax
      total
      secretKey
      orderItems { id quantity itemNameSnapshot customizationsSummary price }
    `
  });
}

// features/keystone/mutations/updateCafeOrderStatus.ts
var statusTimestampMap = {
  preparing: "startedAt",
  ready: "readyAt",
  completed: "completedAt",
  cancelled: "cancelledAt",
  paid: "paidAt"
};
var itemStatusMap = {
  in_bar_queue: "queued",
  preparing: "preparing",
  ready: "ready",
  completed: "handed_off",
  cancelled: "voided"
};
async function updateCafeOrderStatus(root, args, context) {
  if (!permissions.canManageOrders({ session: context.session })) {
    throw new Error("Not authorized to update cafe order status");
  }
  const allowedStatuses = ["open", "paid", "in_bar_queue", "preparing", "ready", "completed", "cancelled", "refunded"];
  if (!allowedStatuses.includes(args.status)) {
    throw new Error(`Unsupported cafe order status: ${args.status}`);
  }
  const sudo = context.sudo();
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const timestampField = statusTimestampMap[args.status];
  const order = await sudo.db.CafeOrder.updateOne({
    where: { id: args.orderId },
    data: {
      status: args.status,
      ...timestampField ? { [timestampField]: now } : {}
    }
  });
  const itemStatus = itemStatusMap[args.status];
  if (itemStatus) {
    const orderItems = await sudo.query.OrderItem.findMany({
      where: { order: { id: { equals: args.orderId } } },
      query: "id"
    });
    const itemTimestampField = itemStatus === "queued" ? "queuedAt" : itemStatus === "preparing" ? "startedAt" : itemStatus === "ready" ? "readyAt" : itemStatus === "handed_off" ? "handedOffAt" : null;
    await Promise.all(
      orderItems.map(
        (item) => sudo.db.OrderItem.updateOne({
          where: { id: item.id },
          data: {
            barStatus: itemStatus,
            ...itemTimestampField ? { [itemTimestampField]: now } : {}
          }
        })
      )
    );
  }
  return sudo.query.CafeOrder.findOne({
    where: { id: order.id },
    query: "id orderNumber status startedAt readyAt completedAt cancelledAt orderItems { id barStatus }"
  });
}

// features/keystone/mutations/getCafeOrder.ts
async function getCafeOrder(root, args, context) {
  if (!args.orderId) return null;
  const sudo = context.sudo();
  const order = await sudo.query.CafeOrder.findOne({
    where: { id: args.orderId },
    query: `
      id
      secretKey
      orderNumber
      status
      handoffCode
      pickupName
      promisedAt
      subtotal
      tax
      total
      orderItems { id quantity itemNameSnapshot customizationsSummary price }
    `
  });
  if (!order) return null;
  if (order.secretKey && args.secretKey !== order.secretKey) return null;
  return order;
}

// features/keystone/mutations/getCafeLoyaltyAccount.ts
function normalizeEmail2(email) {
  return email?.trim().toLowerCase() || null;
}
async function getCafeLoyaltyAccount(root, args, context) {
  const email = normalizeEmail2(args.email);
  if (!email) return null;
  const isStaff = permissions.canReadLoyalty({ session: context.session }) || permissions.canManageLoyalty({ session: context.session });
  if (!isStaff) {
    if (!args.orderId || !args.secretKey) return null;
    const order = await context.sudo().query.CafeOrder.findOne({
      where: { id: args.orderId },
      query: "id customerEmail secretKey loyaltyAccount { id pointsBalance drinkCredits nextRewardProgress }"
    });
    if (!order || !order.secretKey || order.secretKey !== args.secretKey) {
      return null;
    }
    if (normalizeEmail2(order.customerEmail) !== email) {
      return null;
    }
    if (!order.loyaltyAccount?.id) {
      return null;
    }
    return context.sudo().query.LoyaltyAccount.findOne({
      where: { id: order.loyaltyAccount.id },
      query: "id customerEmail pointsBalance drinkCredits nextRewardProgress"
    });
  }
  const accounts = await context.sudo().query.LoyaltyAccount.findMany({
    where: { customerEmail: { equals: email } },
    take: 1,
    query: "id customerName customerEmail customerPhone status tier pointsBalance lifetimePoints drinkCredits visits lastVisitAt nextRewardProgress"
  });
  return accounts[0] || null;
}

// features/keystone/mutations/applyCafeLoyalty.ts
function normalizeEmail3(email) {
  return email?.trim().toLowerCase() || null;
}
function normalizePhone2(phone) {
  return phone?.replace(/[^+\d]/g, "") || null;
}
function pointsForSubtotal(subtotal) {
  return Math.max(0, Math.floor(Number(subtotal || 0) / 100));
}
async function applyCafeLoyalty(root, args, context) {
  const isOperator = permissions.canManageLoyalty({ session: context.session }) || permissions.canManageOrders({ session: context.session });
  const email = normalizeEmail3(args.customerEmail);
  if (!args.orderId) throw new Error("Order id is required");
  if (!email) throw new Error("Customer email is required to apply loyalty");
  const sudo = context.sudo();
  const order = await sudo.query.CafeOrder.findOne({
    where: { id: args.orderId },
    query: "id secretKey subtotal tax tip discount total customerName customerEmail customerPhone loyaltyAccount { id } payments { id status amount }"
  });
  if (!order) throw new Error("Order not found");
  if (!isOperator) {
    if (!order.secretKey || !args.secretKey || args.secretKey !== order.secretKey) {
      throw new Error("You do not have access to apply loyalty to this order");
    }
  }
  if (order.loyaltyAccount?.id && !isOperator) {
    throw new Error("Loyalty has already been applied to this order");
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const alreadyPaid = (order.payments || []).some((payment) => ["captured", "authorized"].includes(payment.status));
  if (Boolean(args.redeemDrinkCredit) && alreadyPaid && !isOperator) {
    throw new Error("Drink credits must be redeemed before payment is captured");
  }
  const nowDiscount = Number(order.discount || 0);
  const redeemDiscount = Boolean(args.redeemDrinkCredit) ? 500 : 0;
  const rewardAdjustedSubtotal = Math.max(0, Number(order.subtotal || 0) - redeemDiscount);
  const earnedPoints = pointsForSubtotal(rewardAdjustedSubtotal);
  const existingAccounts = await sudo.query.LoyaltyAccount.findMany({
    where: { customerEmail: { equals: email } },
    take: 1,
    query: "id pointsBalance lifetimePoints drinkCredits visits firstVisitAt customerName customerEmail customerPhone"
  });
  const existing = existingAccounts[0];
  const redeem = Boolean(args.redeemDrinkCredit);
  let accountId;
  let nextDrinkCredits = 0;
  if (existing) {
    const currentPoints = Number(existing.pointsBalance || 0);
    const currentCredits = Number(existing.drinkCredits || 0);
    if (redeem && currentCredits <= 0) throw new Error("No drink credits available to redeem");
    const pointsAfterEarn = currentPoints + earnedPoints;
    const newlyEarnedCredits = Math.floor(pointsAfterEarn / 100);
    const pointsBalance = pointsAfterEarn % 100;
    nextDrinkCredits = currentCredits + newlyEarnedCredits - (redeem ? 1 : 0);
    const updated = await sudo.db.LoyaltyAccount.updateOne({
      where: { id: existing.id },
      data: {
        customerName: args.customerName?.trim() || order.customerName || existing.customerName,
        customerPhone: normalizePhone2(args.customerPhone) || order.customerPhone || existing.customerPhone,
        pointsBalance,
        lifetimePoints: Number(existing.lifetimePoints || 0) + earnedPoints,
        drinkCredits: nextDrinkCredits,
        visits: Number(existing.visits || 0) + 1,
        firstVisitAt: existing.firstVisitAt || now,
        lastVisitAt: now,
        status: "active"
      }
    });
    accountId = updated.id;
  } else {
    const newlyEarnedCredits = Math.floor(earnedPoints / 100);
    const created = await sudo.db.LoyaltyAccount.createOne({
      data: {
        customerName: args.customerName?.trim() || order.customerName || email,
        customerEmail: email,
        customerPhone: normalizePhone2(args.customerPhone) || order.customerPhone || null,
        status: "active",
        tier: "regular",
        pointsBalance: earnedPoints % 100,
        lifetimePoints: earnedPoints,
        drinkCredits: newlyEarnedCredits,
        visits: 1,
        firstVisitAt: now,
        lastVisitAt: now
      }
    });
    accountId = created.id;
    nextDrinkCredits = newlyEarnedCredits;
  }
  await sudo.db.CafeOrder.updateOne({
    where: { id: args.orderId },
    data: {
      customerEmail: email,
      customerName: args.customerName?.trim() || order.customerName,
      customerPhone: normalizePhone2(args.customerPhone) || order.customerPhone,
      loyaltyAccount: { connect: { id: accountId } },
      ...redeem ? { discount: nowDiscount + redeemDiscount, total: Math.max(0, rewardAdjustedSubtotal + Number(order.tax || 0) + Number(order.tip || 0)) } : {}
    }
  });
  await sudo.db.LoyaltyEvent.createOne({
    data: {
      account: { connect: { id: accountId } },
      order: { connect: { id: args.orderId } },
      type: redeem ? "redeemed" : "earned",
      pointsDelta: earnedPoints,
      drinkCreditsDelta: Math.floor(((existing ? Number(existing.pointsBalance || 0) : 0) + earnedPoints) / 100) - (redeem ? 1 : 0),
      note: redeem ? `Redeemed one drink credit and earned ${earnedPoints} points on order ${args.orderId}` : `Earned ${earnedPoints} points on order ${args.orderId}`,
      createdBy: context.session?.itemId ? { connect: { id: context.session.itemId } } : void 0
    }
  });
  return sudo.query.LoyaltyAccount.findOne({
    where: { id: accountId },
    query: "id customerName customerEmail status tier pointsBalance lifetimePoints drinkCredits visits lastVisitAt nextRewardProgress"
  });
}

// import("../../integrations/payment/**/*.ts") in features/keystone/utils/paymentProviderAdapter.ts
var globImport_integrations_payment_ts = __glob({
  "../../integrations/payment/index.ts": () => Promise.resolve().then(() => (init_payment(), payment_exports)),
  "../../integrations/payment/manual.ts": () => Promise.resolve().then(() => (init_manual(), manual_exports)),
  "../../integrations/payment/paypal.ts": () => Promise.resolve().then(() => (init_paypal(), paypal_exports)),
  "../../integrations/payment/stripe.ts": () => Promise.resolve().then(() => (init_stripe(), stripe_exports))
});

// features/keystone/utils/paymentProviderAdapter.ts
async function executePaymentProviderAdapter({
  provider,
  functionName,
  args
}) {
  const functionPath = provider[functionName];
  if (!functionPath) {
    return {
      success: false,
      provider: provider.code,
      status: "adapter_error",
      error: `Payment provider ${provider.code} does not define ${functionName}`
    };
  }
  if (functionPath.startsWith("http")) {
    const response = await fetch(functionPath, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider, ...args })
    });
    if (!response.ok) {
      return {
        success: false,
        provider: provider.code,
        status: "adapter_error",
        error: `HTTP request failed: ${response.statusText}`
      };
    }
    return response.json();
  }
  try {
    const adapter = await globImport_integrations_payment_ts(`../../integrations/payment/${functionPath}.ts`);
    const fn = adapter[functionName];
    if (typeof fn !== "function") {
      return {
        success: false,
        provider: provider.code,
        status: "adapter_error",
        error: `Function ${functionName} not found in adapter ${functionPath}`
      };
    }
    return await fn(args);
  } catch (error) {
    return {
      success: false,
      provider: provider.code,
      status: "adapter_error",
      error: error instanceof Error ? error.message : "Unknown payment adapter error"
    };
  }
}

// features/keystone/mutations/initiateCafePaymentSession.ts
var TERMINAL_ORDER_STATUSES = /* @__PURE__ */ new Set(["paid", "completed", "cancelled", "refunded"]);
var MANAGED_PAYMENT_STATUSES = /* @__PURE__ */ new Set(["captured", "authorized", "pending"]);
async function initiateCafePaymentSession(root, args, context) {
  if (!args.orderId) throw new Error("Order id is required");
  if (!args.paymentProvider) throw new Error("Payment provider is required");
  const isStaff = permissions.canManagePayments({ session: context.session }) || permissions.canManageOrders({ session: context.session });
  if (!isStaff && args.paymentProvider === "manual") {
    throw new Error("Manual payment initiation is only available to staff");
  }
  const sudo = context.sudo();
  const order = await sudo.query.CafeOrder.findOne({
    where: { id: args.orderId },
    query: "id secretKey orderNumber total discount currencyCode customerEmail customerName status payments { id status provider providerPaymentId amount paymentProvider { id code isInstalled createPaymentFunction capturePaymentFunction refundPaymentFunction getPaymentStatusFunction generatePaymentLinkFunction handleWebhookFunction credentials metadata } }"
  });
  if (!order) throw new Error("Order not found");
  if (!isStaff && order.secretKey && args.secretKey !== order.secretKey) {
    throw new Error("You do not have access to initiate payment for this order");
  }
  if (TERMINAL_ORDER_STATUSES.has(order.status)) {
    throw new Error(`Cannot initiate payment for an order with status ${order.status}`);
  }
  const existingManagedPayment = (order.payments || []).find((payment2) => MANAGED_PAYMENT_STATUSES.has(payment2.status));
  if (existingManagedPayment) {
    return {
      success: true,
      paymentId: existingManagedPayment.id,
      provider: existingManagedPayment.provider,
      providerPaymentId: existingManagedPayment.providerPaymentId,
      status: existingManagedPayment.status,
      amount: existingManagedPayment.amount ?? Number(order.total || 0),
      data: { reusedExistingPayment: true },
      error: null
    };
  }
  const configuredProviders = await sudo.query.PaymentProvider.findMany({
    where: {
      isInstalled: { equals: true },
      OR: [
        { code: { equals: args.paymentProvider } },
        { createPaymentFunction: { equals: args.paymentProvider } }
      ]
    },
    take: 1,
    query: "id code name isInstalled createPaymentFunction capturePaymentFunction refundPaymentFunction getPaymentStatusFunction generatePaymentLinkFunction handleWebhookFunction credentials metadata"
  });
  const provider = configuredProviders[0];
  if (!provider) {
    throw new Error(`Payment provider ${args.paymentProvider} is not installed`);
  }
  if (!isStaff && provider.code === "pp_system_default") {
    throw new Error("Manual payment initiation is only available to staff");
  }
  const payableAmount = Math.max(0, Number(order.total || 0) - Number(order.discount || 0));
  if (payableAmount <= 0) {
    throw new Error("Order total must be greater than zero");
  }
  const adapterResult = await executePaymentProviderAdapter({
    provider,
    functionName: "createPaymentFunction",
    args: {
      orderId: order.id,
      amount: payableAmount,
      currencyCode: order.currencyCode || "USD",
      customerEmail: order.customerEmail,
      customerName: order.customerName,
      metadata: { orderNumber: order.orderNumber }
    }
  });
  const normalizedProvider = provider.code;
  const paymentStatus = adapterResult.success && adapterResult.status === "captured" ? "captured" : adapterResult.success ? "pending" : "failed";
  const payment = await sudo.db.Payment.createOne({
    data: {
      order: { connect: { id: order.id } },
      status: paymentStatus,
      method: normalizedProvider === "pp_system_default" ? "cash" : "card",
      amount: payableAmount,
      currencyCode: order.currencyCode || "USD",
      provider: normalizedProvider,
      providerPaymentId: adapterResult.providerPaymentId || null,
      failureMessage: adapterResult.error || null,
      processedAt: paymentStatus === "captured" && isStaff ? (/* @__PURE__ */ new Date()).toISOString() : void 0,
      paymentProvider: { connect: { id: provider.id } }
    }
  });
  if (paymentStatus === "captured" && isStaff) {
    await sudo.db.CafeOrder.updateOne({
      where: { id: order.id },
      data: { status: "paid", paidAt: (/* @__PURE__ */ new Date()).toISOString() }
    });
  }
  return {
    success: adapterResult.success,
    paymentId: payment.id,
    provider: normalizedProvider,
    providerPaymentId: adapterResult.providerPaymentId,
    status: adapterResult.status || paymentStatus,
    amount: adapterResult.amount || payableAmount,
    data: adapterResult.data || null,
    error: adapterResult.error || null
  };
}

// features/keystone/mutations/index.ts
var graphql5 = String.raw;
function extendGraphqlSchema(baseSchema) {
  return (0, import_schema.mergeSchemas)({
    schemas: [baseSchema],
    typeDefs: graphql5`
      type Query {
        redirectToInit: Boolean
        getCafeOrder(orderId: ID!, secretKey: String): JSON
        getCafeLoyaltyAccount(email: String!, orderId: ID, secretKey: String): JSON
      }

      type Mutation {
        createCafePickupOrder(
          customerName: String!
          customerEmail: String
          customerPhone: String
          pickupName: String
          requestedPickupMinutes: Int
          specialInstructions: String
          paymentMethod: String
          orderSource: String
          fulfillmentType: String
          items: [CafePickupOrderItemInput!]!
        ): CafeOrder

        updateCafeOrderStatus(
          orderId: ID!
          status: String!
        ): CafeOrder

        applyCafeLoyalty(
          orderId: ID!
          secretKey: String
          customerEmail: String!
          customerName: String
          customerPhone: String
          redeemDrinkCredit: Boolean
        ): LoyaltyAccount

        initiateCafePaymentSession(
          orderId: ID!
          secretKey: String
          paymentProvider: String!
        ): CafePaymentSessionResult
      }

      type CafePaymentSessionResult {
        success: Boolean!
        paymentId: ID
        provider: String
        providerPaymentId: String
        status: String
        amount: Int
        data: JSON
        error: String
      }

      input CafePickupOrderItemInput {
        menuItemId: ID!
        quantity: Int!
        modifierIds: [ID!]
        specialInstructions: String
      }
    `,
    resolvers: {
      Query: {
        redirectToInit: redirectToInit_default,
        getCafeOrder,
        getCafeLoyaltyAccount
      },
      Mutation: {
        createCafePickupOrder,
        updateCafeOrderStatus,
        applyCafeLoyalty,
        initiateCafePaymentSession
      }
    }
  });
}

// features/keystone/lib/mail.ts
var import_nodemailer = require("nodemailer");
function getBaseUrlForEmails() {
  if (process.env.SMTP_STORE_LINK) {
    return process.env.SMTP_STORE_LINK;
  }
  console.warn("SMTP_STORE_LINK not set. Please add SMTP_STORE_LINK to your environment variables for email links to work properly.");
  return "";
}
var transport = (0, import_nodemailer.createTransport)({
  // @ts-ignore
  host: process.env.SMTP_HOST,
  port: process.env.SMTP_PORT,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASSWORD
  }
});
function passwordResetEmail({ url }) {
  const backgroundColor = "#f9f9f9";
  const textColor = "#444444";
  const mainBackgroundColor = "#ffffff";
  const buttonBackgroundColor = "#346df1";
  const buttonBorderColor = "#346df1";
  const buttonTextColor = "#ffffff";
  return `
    <body style="background: ${backgroundColor};">
      <table width="100%" border="0" cellspacing="20" cellpadding="0" style="background: ${mainBackgroundColor}; max-width: 600px; margin: auto; border-radius: 10px;">
        <tr>
          <td align="center" style="padding: 10px 0px 0px 0px; font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
            Please click below to reset your password
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 20px 0;">
            <table border="0" cellspacing="0" cellpadding="0">
              <tr>
                <td align="center" style="border-radius: 5px;" bgcolor="${buttonBackgroundColor}"><a href="${url}" target="_blank" style="font-size: 18px; font-family: Helvetica, Arial, sans-serif; color: ${buttonTextColor}; text-decoration: none; border-radius: 5px; padding: 10px 20px; border: 1px solid ${buttonBorderColor}; display: inline-block; font-weight: bold;">Reset Password</a></td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding: 0px 0px 10px 0px; font-size: 16px; line-height: 22px; font-family: Helvetica, Arial, sans-serif; color: ${textColor};">
            If you did not request this email you can safely ignore it.
          </td>
        </tr>
      </table>
    </body>
  `;
}
async function sendPasswordResetEmail(resetToken, to, baseUrl) {
  const frontendUrl = baseUrl || getBaseUrlForEmails();
  const info = await transport.sendMail({
    to,
    from: process.env.SMTP_FROM,
    subject: "Your password reset token!",
    html: passwordResetEmail({
      url: `${frontendUrl}/dashboard/reset?token=${resetToken}`
    })
  });
  if (process.env.MAIL_USER?.includes("ethereal.email")) {
    console.log(`\u{1F4E7} Message Sent!  Preview it at ${(0, import_nodemailer.getTestMessageUrl)(info)}`);
  }
}

// features/keystone/index.ts
var databaseURL = process.env.DATABASE_URL || "file:./keystone.db";
var sessionConfig = {
  maxAge: 60 * 60 * 24 * 360,
  // How long they stay signed in?
  secret: process.env.SESSION_SECRET || "this secret should only be used in testing"
};
var {
  S3_BUCKET_NAME: bucketName = "keystone-test",
  S3_REGION: region = "ap-southeast-2",
  S3_ACCESS_KEY_ID: accessKeyId = "keystone",
  S3_SECRET_ACCESS_KEY: secretAccessKey = "keystone",
  S3_ENDPOINT: endpoint = "https://sfo3.digitaloceanspaces.com"
} = process.env;
var { withAuth } = (0, import_auth.createAuth)({
  listKey: "User",
  identityField: "email",
  secretField: "password",
  initFirstItem: {
    fields: ["name", "email", "password"],
    itemData: {
      onboardingStatus: "not_started",
      role: {
        create: {
          name: "Admin",
          canAccessDashboard: true,
          canReadOrders: true,
          canManageOrders: true,
          canReadPayments: true,
          canManagePayments: true,
          canReadProducts: true,
          canManageProducts: true,
          canReadInventory: true,
          canManageInventory: true,
          canReadLoyalty: true,
          canManageLoyalty: true,
          canSeeOtherPeople: true,
          canEditOtherPeople: true,
          canManagePeople: true,
          canManageRoles: true,
          canManageSettings: true,
          canManageOnboarding: true
        }
      }
    }
  },
  passwordResetLink: {
    async sendToken(args) {
      await sendPasswordResetEmail(args.token, args.identity);
    }
  },
  sessionData: `
    name
    email
    onboardingStatus
    role {
      id
      name
      canAccessDashboard
      canReadOrders
      canManageOrders
      canReadPayments
      canManagePayments
      canReadProducts
      canManageProducts
      canReadInventory
      canManageInventory
      canReadLoyalty
      canManageLoyalty
      canSeeOtherPeople
      canEditOtherPeople
      canManagePeople
      canManageRoles
      canManageSettings
      canManageOnboarding
    }
  `
});
var keystone_default = withAuth(
  (0, import_core14.config)({
    db: {
      provider: "postgresql",
      url: databaseURL
    },
    lists: models,
    storage: {
      my_images: {
        kind: "s3",
        type: "image",
        bucketName,
        region,
        accessKeyId,
        secretAccessKey,
        endpoint,
        signed: { expiry: 5e3 },
        forcePathStyle: true
      }
    },
    ui: {
      isAccessAllowed: ({ session }) => session?.data.role?.canAccessDashboard ?? false
    },
    session: (0, import_session.statelessSessions)(sessionConfig),
    graphql: {
      extendGraphqlSchema
    }
  })
);

// keystone.ts
var keystone_default2 = keystone_default;
//# sourceMappingURL=config.js.map
