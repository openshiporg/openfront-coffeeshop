"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name2 in all)
    __defProp(target, name2, { get: all[name2], enumerable: true });
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

// features/keystone/models/requiredRelationship.ts
function requiredRelationship(ref, fieldName, targetModel, access, hooks) {
  const escapedField = fieldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedModel = targetModel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (0, import_fields.relationship)({
    ref,
    ...access ? { access } : {},
    ...hooks ? { hooks } : {},
    db: {
      extendPrismaSchema(field) {
        return field.replace(new RegExp(`(\\b${escapedField}\\s+${escapedModel})\\?`), "$1").replace(new RegExp(`(\\b${escapedField}Id\\s+String)\\?`), "$1");
      }
    }
  });
}
function requiredStoreRelationship(ref, access) {
  return requiredRelationship(ref, "store", "StoreSetting", access, {
    resolveInput: async ({ operation, resolvedData, fieldKey, context }) => {
      const value = resolvedData[fieldKey];
      if (operation !== "create" || value !== void 0 && value !== null) return value;
      const store = await context.sudo().prisma.storeSetting.findUnique({ where: { singletonKey: "primary" }, select: { id: true } });
      if (!store) throw new Error("Primary store is required before creating store records");
      return { connect: { id: store.id } };
    }
  });
}
var import_fields;
var init_requiredRelationship = __esm({
  "features/keystone/models/requiredRelationship.ts"() {
    "use strict";
    import_fields = require("@keystone-6/core/fields");
  }
});

// features/keystone/models/trackingFields.ts
var import_fields2, trackingFields;
var init_trackingFields = __esm({
  "features/keystone/models/trackingFields.ts"() {
    "use strict";
    import_fields2 = require("@keystone-6/core/fields");
    trackingFields = {
      createdAt: (0, import_fields2.timestamp)({
        access: { read: () => true, create: () => false, update: () => false },
        validation: { isRequired: true },
        defaultValue: { kind: "now" },
        ui: {
          createView: { fieldMode: "hidden" },
          itemView: { fieldMode: "read" }
        }
      }),
      updatedAt: (0, import_fields2.timestamp)({
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
  }
});

// features/keystone/models/CoffeeCommandReceipt.ts
var import_core, import_access, import_fields3, CoffeeCommandReceipt;
var init_CoffeeCommandReceipt = __esm({
  "features/keystone/models/CoffeeCommandReceipt.ts"() {
    "use strict";
    import_core = require("@keystone-6/core");
    import_access = require("@keystone-6/core/access");
    import_fields3 = require("@keystone-6/core/fields");
    init_requiredRelationship();
    init_trackingFields();
    CoffeeCommandReceipt = (0, import_core.list)({
      access: { operation: { query: import_access.denyAll, create: import_access.denyAll, update: import_access.denyAll, delete: import_access.denyAll } },
      ui: { isHidden: true },
      fields: {
        eventKey: (0, import_fields3.text)({ isIndexed: "unique", validation: { isRequired: true } }),
        eventType: (0, import_fields3.text)({ isIndexed: true, validation: { isRequired: true } }),
        schemaVersion: (0, import_fields3.text)({ defaultValue: "1", validation: { isRequired: true } }),
        aggregateType: (0, import_fields3.text)({ isIndexed: true, validation: { isRequired: true } }),
        aggregateId: (0, import_fields3.text)({ isIndexed: true, validation: { isRequired: true } }),
        payload: (0, import_fields3.json)(),
        payloadHash: (0, import_fields3.text)({ validation: { isRequired: true } }),
        occurredAt: (0, import_fields3.timestamp)({ defaultValue: { kind: "now" }, validation: { isRequired: true } }),
        store: requiredStoreRelationship("StoreSetting.commandReceipts"),
        ...trackingFields
      }
    });
  }
});

// features/keystone/access.ts
function isSignedIn({ session }) {
  return Boolean(session);
}
var hasRoleFlag, permissions, rules;
var init_access = __esm({
  "features/keystone/access.ts"() {
    "use strict";
    hasRoleFlag = (session, flag) => Boolean(session?.data?.role?.[flag]);
    permissions = {
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
    rules = {
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
  }
});

// features/keystone/models/WasteLog.ts
var import_core2, import_access2, import_fields4, WasteLog;
var init_WasteLog = __esm({
  "features/keystone/models/WasteLog.ts"() {
    "use strict";
    import_core2 = require("@keystone-6/core");
    import_access2 = require("@keystone-6/core/access");
    import_fields4 = require("@keystone-6/core/fields");
    init_access();
    init_requiredRelationship();
    init_trackingFields();
    WasteLog = (0, import_core2.list)({
      access: {
        operation: {
          query: permissions.canReadInventory,
          create: import_access2.denyAll,
          update: import_access2.denyAll,
          delete: import_access2.denyAll
        }
      },
      ui: {
        hideCreate: true,
        hideDelete: true,
        itemView: { defaultFieldMode: "read" },
        listView: { initialColumns: ["logNumber", "inventoryItem", "prepBatch", "reason", "costCents"] }
      },
      fields: {
        idempotencyKey: (0, import_fields4.text)({ isIndexed: "unique", db: { isNullable: true }, access: { read: permissions.canManageInventory } }),
        logNumber: (0, import_fields4.text)({ isIndexed: "unique", validation: { isRequired: true } }),
        store: requiredStoreRelationship("StoreSetting.wasteLogs"),
        inventoryItem: (0, import_fields4.relationship)({ ref: "InventoryItem.wasteLogs" }),
        prepBatch: (0, import_fields4.relationship)({ ref: "PrepBatch" }),
        reason: (0, import_fields4.select)({
          type: "string",
          options: [
            { label: "Expired", value: "expired" },
            { label: "Damaged", value: "damaged" },
            { label: "Overproduction", value: "overproduction" },
            { label: "Quality", value: "quality" }
          ],
          defaultValue: "expired"
        }),
        quantity: (0, import_fields4.decimal)({ defaultValue: "0" }),
        unit: (0, import_fields4.text)({ defaultValue: "each" }),
        costCents: (0, import_fields4.integer)({ defaultValue: 0, validation: { min: 0 } }),
        loggedBy: (0, import_fields4.relationship)({ ref: "User" }),
        loggedAt: (0, import_fields4.timestamp)({ defaultValue: { kind: "now" } }),
        notes: (0, import_fields4.text)({ ui: { displayMode: "textarea" } }),
        metadata: (0, import_fields4.json)(),
        stockMovements: (0, import_fields4.relationship)({ ref: "StockMovement.wasteLog", many: true }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/CateringOrder.ts
var import_core3, import_access4, import_fields5, editableWhile, eventFactsEditable, quoteEditable, fieldModeFor, eventFact, CateringOrder;
var init_CateringOrder = __esm({
  "features/keystone/models/CateringOrder.ts"() {
    "use strict";
    import_core3 = require("@keystone-6/core");
    import_access4 = require("@keystone-6/core/access");
    import_fields5 = require("@keystone-6/core/fields");
    init_access();
    init_requiredRelationship();
    init_trackingFields();
    editableWhile = (statuses) => ({ item }) => statuses.includes(String(item?.status || ""));
    eventFactsEditable = editableWhile(["inquiry", "quoted"]);
    quoteEditable = editableWhile(["inquiry"]);
    fieldModeFor = (editable) => ({ itemView: { fieldMode: (args) => editable(args) ? "edit" : "read" } });
    eventFact = { access: { update: eventFactsEditable }, ui: fieldModeFor(eventFactsEditable) };
    CateringOrder = (0, import_core3.list)({
      access: { operation: { query: permissions.canReadOrders, create: permissions.canManageOrders, update: permissions.canManageOrders, delete: import_access4.denyAll } },
      ui: { listView: { initialColumns: ["cateringNumber", "customerName", "status", "eventAt"] } },
      fields: {
        cateringNumber: (0, import_fields5.text)({ isIndexed: "unique", validation: { isRequired: true }, access: { update: () => false }, ui: { itemView: { fieldMode: "read" } } }),
        store: requiredStoreRelationship("StoreSetting.cateringOrders", { update: () => false }),
        customerName: (0, import_fields5.text)({ validation: { isRequired: true }, ...eventFact }),
        customerEmail: (0, import_fields5.text)({ ...eventFact }),
        status: (0, import_fields5.select)({ type: "string", access: { create: () => false, update: () => false }, ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } }, options: [{ label: "Inquiry", value: "inquiry" }, { label: "Quoted", value: "quoted" }, { label: "Confirmed", value: "confirmed" }, { label: "Completed", value: "completed" }, { label: "Cancelled", value: "cancelled" }], defaultValue: "inquiry" }),
        eventAt: (0, import_fields5.timestamp)({ ...eventFact }),
        guestCount: (0, import_fields5.integer)({ defaultValue: 0, validation: { min: 0 }, ...eventFact }),
        deliveryAddress: (0, import_fields5.text)({ ...eventFact }),
        subtotalCents: (0, import_fields5.integer)({ defaultValue: 0, validation: { min: 0 }, access: { update: quoteEditable }, ui: fieldModeFor(quoteEditable) }),
        notes: (0, import_fields5.text)({ ui: { displayMode: "textarea" } }),
        metadata: (0, import_fields5.json)({ ...eventFact }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/Subscription.ts
var import_core4, import_access6, import_fields6, fixedAfterCreate, readOnlyInItemView, commandOnly, commandOnlyUi, Subscription;
var init_Subscription = __esm({
  "features/keystone/models/Subscription.ts"() {
    "use strict";
    import_core4 = require("@keystone-6/core");
    import_access6 = require("@keystone-6/core/access");
    import_fields6 = require("@keystone-6/core/fields");
    init_access();
    init_requiredRelationship();
    init_trackingFields();
    fixedAfterCreate = { update: () => false };
    readOnlyInItemView = { itemView: { fieldMode: "read" } };
    commandOnly = { create: () => false, update: () => false };
    commandOnlyUi = { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } };
    Subscription = (0, import_core4.list)({
      access: { operation: { query: permissions.canReadLoyalty, create: permissions.canManageLoyalty, update: permissions.canManageLoyalty, delete: import_access6.denyAll } },
      ui: { listView: { initialColumns: ["subscriptionNumber", "loyaltyAccount", "status", "planName"] } },
      fields: {
        subscriptionNumber: (0, import_fields6.text)({ isIndexed: "unique", validation: { isRequired: true }, access: fixedAfterCreate, ui: readOnlyInItemView }),
        store: requiredStoreRelationship("StoreSetting.subscriptions", fixedAfterCreate),
        loyaltyAccount: (0, import_fields6.relationship)({ ref: "LoyaltyAccount", access: fixedAfterCreate, ui: readOnlyInItemView }),
        status: (0, import_fields6.select)({ type: "string", access: commandOnly, ui: commandOnlyUi, options: [{ label: "Trialing", value: "trialing" }, { label: "Active", value: "active" }, { label: "Paused", value: "paused" }, { label: "Cancelled", value: "cancelled" }], defaultValue: "trialing" }),
        planName: (0, import_fields6.text)({ validation: { isRequired: true }, access: fixedAfterCreate, ui: readOnlyInItemView }),
        billingInterval: (0, import_fields6.select)({ type: "string", access: fixedAfterCreate, ui: readOnlyInItemView, options: [{ label: "Weekly", value: "weekly" }, { label: "Monthly", value: "monthly" }], defaultValue: "monthly" }),
        priceCents: (0, import_fields6.integer)({ defaultValue: 0, validation: { min: 0 }, access: fixedAfterCreate, ui: readOnlyInItemView }),
        startsAt: (0, import_fields6.timestamp)({ access: fixedAfterCreate, ui: readOnlyInItemView }),
        renewsAt: (0, import_fields6.timestamp)({ access: fixedAfterCreate, ui: readOnlyInItemView }),
        cancelledAt: (0, import_fields6.timestamp)({ access: commandOnly, ui: commandOnlyUi }),
        metadata: (0, import_fields6.json)({ access: fixedAfterCreate, ui: readOnlyInItemView }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/PosOrder.ts
var import_core5, import_access8, import_fields7, PosOrder;
var init_PosOrder = __esm({
  "features/keystone/models/PosOrder.ts"() {
    "use strict";
    import_core5 = require("@keystone-6/core");
    import_access8 = require("@keystone-6/core/access");
    import_fields7 = require("@keystone-6/core/fields");
    init_access();
    init_requiredRelationship();
    init_trackingFields();
    PosOrder = (0, import_core5.list)({
      access: {
        operation: {
          query: permissions.canReadOrders,
          create: import_access8.denyAll,
          update: import_access8.denyAll,
          delete: import_access8.denyAll
        }
      },
      ui: {
        hideCreate: true,
        hideDelete: true,
        itemView: { defaultFieldMode: "read" },
        listView: { initialColumns: ["receiptNumber", "status", "registerShift", "cashier", "totalCents"] }
      },
      fields: {
        receiptNumber: (0, import_fields7.text)({ isIndexed: "unique", validation: { isRequired: true } }),
        store: requiredStoreRelationship("StoreSetting.posOrders"),
        cafeOrder: (0, import_fields7.relationship)({ ref: "CafeOrder" }),
        cashier: (0, import_fields7.relationship)({ ref: "User" }),
        registerShift: (0, import_fields7.relationship)({ ref: "RegisterShift.posOrders" }),
        registerName: (0, import_fields7.text)(),
        status: (0, import_fields7.select)({
          type: "string",
          options: [
            { label: "Open", value: "open" },
            { label: "Paid", value: "paid" },
            { label: "Voided", value: "voided" },
            { label: "Refunded", value: "refunded" }
          ],
          defaultValue: "open"
        }),
        subtotalCents: (0, import_fields7.integer)({ defaultValue: 0, validation: { min: 0 } }),
        taxCents: (0, import_fields7.integer)({ defaultValue: 0, validation: { min: 0 } }),
        tipCents: (0, import_fields7.integer)({ defaultValue: 0, validation: { min: 0 } }),
        totalCents: (0, import_fields7.integer)({ defaultValue: 0, validation: { min: 0 } }),
        closedAt: (0, import_fields7.timestamp)(),
        /** Tender evidence (cash, or operator-attested external terminal reference). Not processor proof. */
        metadata: (0, import_fields7.json)({ access: { read: permissions.canReadPayments } }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/RegisterShift.ts
var import_core6, import_access10, import_fields8, RegisterShift;
var init_RegisterShift = __esm({
  "features/keystone/models/RegisterShift.ts"() {
    "use strict";
    import_core6 = require("@keystone-6/core");
    import_access10 = require("@keystone-6/core/access");
    import_fields8 = require("@keystone-6/core/fields");
    init_access();
    init_requiredRelationship();
    init_trackingFields();
    RegisterShift = (0, import_core6.list)({
      access: {
        operation: {
          query: ({ session }) => permissions.canReadPayments({ session }) || permissions.canReadOrders({ session }),
          create: import_access10.denyAll,
          update: import_access10.denyAll,
          delete: import_access10.denyAll
        }
      },
      ui: {
        hideCreate: true,
        hideDelete: true,
        itemView: { defaultFieldMode: "read" },
        listView: { initialColumns: ["shiftNumber", "registerName", "status", "openedBy", "openedAt"] }
      },
      fields: {
        idempotencyKey: (0, import_fields8.text)({ isIndexed: "unique", validation: { isRequired: true }, isFilterable: false, isOrderable: false, access: { read: permissions.canManagePayments } }),
        closeIdempotencyKey: (0, import_fields8.text)({ isIndexed: "unique", db: { isNullable: true }, isFilterable: false, isOrderable: false, access: { read: permissions.canManagePayments } }),
        shiftNumber: (0, import_fields8.text)({ isIndexed: "unique", validation: { isRequired: true } }),
        store: requiredStoreRelationship("StoreSetting.registerShifts"),
        registerName: (0, import_fields8.text)({ validation: { isRequired: true } }),
        status: (0, import_fields8.select)({
          type: "string",
          options: [
            { label: "Open", value: "open" },
            { label: "Closed", value: "closed" }
          ],
          defaultValue: "open"
        }),
        openingCashCents: (0, import_fields8.integer)({ defaultValue: 0, validation: { min: 0 } }),
        cashSalesCents: (0, import_fields8.integer)({ defaultValue: 0, validation: { min: 0 } }),
        cashRefundsCents: (0, import_fields8.integer)({ defaultValue: 0, validation: { min: 0 } }),
        cardSalesCents: (0, import_fields8.integer)({ defaultValue: 0, validation: { min: 0 } }),
        cardRefundsCents: (0, import_fields8.integer)({ defaultValue: 0, validation: { min: 0 } }),
        tipsCents: (0, import_fields8.integer)({ defaultValue: 0, validation: { min: 0 } }),
        payInsCents: (0, import_fields8.integer)({ defaultValue: 0, validation: { min: 0 } }),
        payOutsCents: (0, import_fields8.integer)({ defaultValue: 0, validation: { min: 0 } }),
        expectedCashCents: (0, import_fields8.integer)({ defaultValue: 0 }),
        countedCashCents: (0, import_fields8.integer)({ db: { isNullable: true } }),
        cashVarianceCents: (0, import_fields8.integer)({ db: { isNullable: true } }),
        openedBy: (0, import_fields8.relationship)({ ref: "User" }),
        closedBy: (0, import_fields8.relationship)({ ref: "User" }),
        openedAt: (0, import_fields8.timestamp)({ defaultValue: { kind: "now" } }),
        closedAt: (0, import_fields8.timestamp)(),
        posOrders: (0, import_fields8.relationship)({ ref: "PosOrder.registerShift", many: true }),
        payments: (0, import_fields8.relationship)({ ref: "Payment.registerShift", many: true }),
        cashMovements: (0, import_fields8.relationship)({ ref: "CashMovement.registerShift", many: true }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/CashMovement.ts
var import_core7, import_access12, import_fields9, CashMovement;
var init_CashMovement = __esm({
  "features/keystone/models/CashMovement.ts"() {
    "use strict";
    import_core7 = require("@keystone-6/core");
    import_access12 = require("@keystone-6/core/access");
    import_fields9 = require("@keystone-6/core/fields");
    init_access();
    init_requiredRelationship();
    init_trackingFields();
    CashMovement = (0, import_core7.list)({
      access: {
        operation: {
          query: permissions.canReadPayments,
          create: import_access12.denyAll,
          update: import_access12.denyAll,
          delete: import_access12.denyAll
        }
      },
      ui: {
        hideCreate: true,
        hideDelete: true,
        itemView: { defaultFieldMode: "read" },
        listView: { initialColumns: ["movementNumber", "registerShift", "type", "amountCents", "recordedAt"] }
      },
      fields: {
        idempotencyKey: (0, import_fields9.text)({ isIndexed: "unique", validation: { isRequired: true }, isFilterable: false, isOrderable: false, access: { read: permissions.canManagePayments } }),
        movementNumber: (0, import_fields9.text)({ isIndexed: "unique", validation: { isRequired: true } }),
        store: requiredStoreRelationship("StoreSetting.cashMovements"),
        type: (0, import_fields9.select)({
          type: "string",
          options: [
            { label: "Pay in", value: "pay_in" },
            { label: "Pay out", value: "pay_out" },
            { label: "Cash drop", value: "cash_drop" }
          ],
          validation: { isRequired: true }
        }),
        amountCents: (0, import_fields9.integer)({ validation: { isRequired: true, min: 1 } }),
        reason: (0, import_fields9.text)({ validation: { isRequired: true } }),
        registerShift: (0, import_fields9.relationship)({ ref: "RegisterShift.cashMovements" }),
        recordedBy: (0, import_fields9.relationship)({ ref: "User" }),
        recordedAt: (0, import_fields9.timestamp)({ defaultValue: { kind: "now" } }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/StaffShift.ts
var import_core8, import_access14, import_fields10, StaffShift;
var init_StaffShift = __esm({
  "features/keystone/models/StaffShift.ts"() {
    "use strict";
    import_core8 = require("@keystone-6/core");
    import_access14 = require("@keystone-6/core/access");
    import_fields10 = require("@keystone-6/core/fields");
    init_access();
    init_requiredRelationship();
    init_trackingFields();
    StaffShift = (0, import_core8.list)({
      access: { operation: { query: permissions.canManageSettings, create: import_access14.denyAll, update: import_access14.denyAll, delete: import_access14.denyAll } },
      ui: { hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: "read" }, listView: { initialColumns: ["shiftNumber", "staff", "role", "status"] } },
      fields: {
        idempotencyKey: (0, import_fields10.text)({ isIndexed: "unique", validation: { isRequired: true }, access: { read: permissions.canManageSettings } }),
        shiftNumber: (0, import_fields10.text)({ isIndexed: "unique", validation: { isRequired: true } }),
        store: requiredStoreRelationship("StoreSetting.staffShifts"),
        staff: (0, import_fields10.relationship)({ ref: "User" }),
        role: (0, import_fields10.select)({ type: "string", options: [{ label: "Barista", value: "barista" }, { label: "Shift Lead", value: "shift_lead" }, { label: "Kitchen", value: "kitchen" }, { label: "Manager", value: "manager" }], defaultValue: "barista" }),
        status: (0, import_fields10.select)({ type: "string", access: { update: () => false }, options: [{ label: "Scheduled", value: "scheduled" }, { label: "Clocked In", value: "clocked_in" }, { label: "Completed", value: "completed" }, { label: "Missed", value: "missed" }], defaultValue: "scheduled" }),
        startsAt: (0, import_fields10.timestamp)(),
        endsAt: (0, import_fields10.timestamp)(),
        clockInAt: (0, import_fields10.timestamp)(),
        clockOutAt: (0, import_fields10.timestamp)(),
        notes: (0, import_fields10.text)({ ui: { displayMode: "textarea" } }),
        metadata: (0, import_fields10.json)(),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/PrepBatch.ts
var import_core9, import_access16, import_fields11, PrepBatch;
var init_PrepBatch = __esm({
  "features/keystone/models/PrepBatch.ts"() {
    "use strict";
    import_core9 = require("@keystone-6/core");
    import_access16 = require("@keystone-6/core/access");
    import_fields11 = require("@keystone-6/core/fields");
    init_access();
    init_requiredRelationship();
    init_trackingFields();
    PrepBatch = (0, import_core9.list)({
      access: {
        operation: {
          query: permissions.canReadInventory,
          create: import_access16.denyAll,
          update: import_access16.denyAll,
          delete: import_access16.denyAll
        }
      },
      ui: {
        hideCreate: true,
        hideDelete: true,
        itemView: { defaultFieldMode: "read" },
        listView: { initialColumns: ["batchNumber", "recipe", "status", "preparedBy"] }
      },
      fields: {
        idempotencyKey: (0, import_fields11.text)({ isIndexed: "unique", db: { isNullable: true }, access: { read: permissions.canManageInventory } }),
        batchNumber: (0, import_fields11.text)({ isIndexed: "unique", validation: { isRequired: true } }),
        store: requiredStoreRelationship("StoreSetting.prepBatches"),
        recipe: (0, import_fields11.relationship)({ ref: "Recipe" }),
        status: (0, import_fields11.select)({
          type: "string",
          options: [
            { label: "Planned", value: "planned" },
            { label: "In Progress", value: "in_progress" },
            { label: "Completed", value: "completed" },
            { label: "Discarded", value: "discarded" }
          ],
          defaultValue: "completed"
        }),
        preparedBy: (0, import_fields11.relationship)({ ref: "User" }),
        quantityMade: (0, import_fields11.decimal)({ defaultValue: "0" }),
        quantityRemaining: (0, import_fields11.decimal)({ defaultValue: "0" }),
        startedAt: (0, import_fields11.timestamp)(),
        completedAt: (0, import_fields11.timestamp)(),
        expiresAt: (0, import_fields11.timestamp)(),
        notes: (0, import_fields11.text)({ ui: { displayMode: "textarea" } }),
        metadata: (0, import_fields11.json)(),
        stockMovements: (0, import_fields11.relationship)({ ref: "StockMovement.prepBatch", many: true }),
        consumptions: (0, import_fields11.relationship)({ ref: "PrepBatchConsumption.prepBatch", many: true }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/PrepBatchConsumption.ts
var import_core10, import_access18, import_fields12, PrepBatchConsumption;
var init_PrepBatchConsumption = __esm({
  "features/keystone/models/PrepBatchConsumption.ts"() {
    "use strict";
    import_core10 = require("@keystone-6/core");
    import_access18 = require("@keystone-6/core/access");
    import_fields12 = require("@keystone-6/core/fields");
    init_access();
    init_requiredRelationship();
    init_trackingFields();
    PrepBatchConsumption = (0, import_core10.list)({
      access: {
        operation: { query: permissions.canReadInventory, create: import_access18.denyAll, update: import_access18.denyAll, delete: import_access18.denyAll }
      },
      ui: { hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: "read" }, listView: { initialColumns: ["prepBatch", "order", "quantity"] } },
      fields: {
        idempotencyKey: (0, import_fields12.text)({ isIndexed: "unique", validation: { isRequired: true }, access: { read: permissions.canManageInventory } }),
        store: requiredStoreRelationship("StoreSetting.prepBatchConsumptions"),
        prepBatch: requiredRelationship("PrepBatch.consumptions", "prepBatch", "PrepBatch"),
        order: requiredRelationship("CafeOrder.prepBatchConsumptions", "order", "CafeOrder"),
        quantity: (0, import_fields12.decimal)({ validation: { isRequired: true } }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/PurchaseOrder.ts
var import_core11, import_access20, import_fields13, PurchaseOrder;
var init_PurchaseOrder = __esm({
  "features/keystone/models/PurchaseOrder.ts"() {
    "use strict";
    import_core11 = require("@keystone-6/core");
    import_access20 = require("@keystone-6/core/access");
    import_fields13 = require("@keystone-6/core/fields");
    init_access();
    init_requiredRelationship();
    init_trackingFields();
    PurchaseOrder = (0, import_core11.list)({
      access: {
        operation: {
          query: permissions.canReadInventory,
          create: import_access20.denyAll,
          update: import_access20.denyAll,
          delete: import_access20.denyAll
        }
      },
      ui: {
        hideCreate: true,
        hideDelete: true,
        itemView: { defaultFieldMode: "read" },
        listView: { initialColumns: ["poNumber", "supplier", "inventoryItem", "status", "expectedAt"] }
      },
      fields: {
        idempotencyKey: (0, import_fields13.text)({ isIndexed: "unique", db: { isNullable: true }, access: { read: permissions.canManageInventory } }),
        poNumber: (0, import_fields13.text)({ isIndexed: "unique", validation: { isRequired: true } }),
        store: requiredStoreRelationship("StoreSetting.purchaseOrders"),
        supplier: (0, import_fields13.relationship)({ ref: "Supplier" }),
        inventoryItem: (0, import_fields13.relationship)({ ref: "InventoryItem.purchaseOrders" }),
        orderedQuantity: (0, import_fields13.decimal)({ defaultValue: "0" }),
        unitCostCents: (0, import_fields13.integer)({ defaultValue: 0, validation: { min: 0 } }),
        status: (0, import_fields13.select)({
          type: "string",
          options: [
            { label: "Draft", value: "draft" },
            { label: "Submitted", value: "submitted" },
            { label: "Received", value: "received" },
            { label: "Cancelled", value: "cancelled" }
          ],
          defaultValue: "submitted"
        }),
        orderedAt: (0, import_fields13.timestamp)(),
        expectedAt: (0, import_fields13.timestamp)(),
        receivedAt: (0, import_fields13.timestamp)(),
        subtotalCents: (0, import_fields13.integer)({ defaultValue: 0, validation: { min: 0 } }),
        notes: (0, import_fields13.text)({ ui: { displayMode: "textarea" } }),
        metadata: (0, import_fields13.json)(),
        inventoryLots: (0, import_fields13.relationship)({ ref: "InventoryLot.purchaseOrder", many: true }),
        stockMovements: (0, import_fields13.relationship)({ ref: "StockMovement.purchaseOrder", many: true }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/Supplier.ts
var import_core12, import_fields14, Supplier;
var init_Supplier = __esm({
  "features/keystone/models/Supplier.ts"() {
    "use strict";
    import_core12 = require("@keystone-6/core");
    import_fields14 = require("@keystone-6/core/fields");
    init_access();
    init_requiredRelationship();
    init_trackingFields();
    Supplier = (0, import_core12.list)({
      access: { operation: { query: permissions.canReadInventory, create: permissions.canManageInventory, update: permissions.canManageInventory, delete: permissions.canManageInventory } },
      hooks: {
        resolveInput: async ({ operation, resolvedData, context }) => {
          if (operation !== "create" || resolvedData.store) return resolvedData;
          const store = await context.sudo().query.StoreSetting.findOne({
            where: { singletonKey: "primary" },
            query: "id"
          });
          if (!store) throw new Error("Primary store is required before creating suppliers");
          return { ...resolvedData, store: { connect: { id: store.id } } };
        },
        validateInput: async ({ operation, resolvedData, addValidationError }) => {
          if (operation === "update" && resolvedData.store !== void 0) {
            addValidationError("Supplier store ownership is immutable");
          }
        },
        validateDelete: async ({ item, context, addValidationError }) => {
          const [purchaseOrders, inventoryLots] = await Promise.all([
            context.sudo().query.PurchaseOrder.findMany({ where: { supplier: { id: { equals: item.id } } }, take: 1, query: "id" }),
            context.sudo().query.InventoryLot.findMany({ where: { supplier: { id: { equals: item.id } } }, take: 1, query: "id" })
          ]);
          if (purchaseOrders.length || inventoryLots.length) {
            addValidationError("Supplier with purchasing or lot evidence cannot be deleted");
          }
        }
      },
      ui: { listView: { initialColumns: ["name", "status", "contactName"] } },
      fields: {
        name: (0, import_fields14.text)({ validation: { isRequired: true } }),
        store: requiredStoreRelationship("StoreSetting.suppliers"),
        status: (0, import_fields14.select)({ type: "string", options: [{ label: "Active", value: "active" }, { label: "Paused", value: "paused" }, { label: "Archived", value: "archived" }], defaultValue: "active" }),
        contactName: (0, import_fields14.text)(),
        email: (0, import_fields14.text)(),
        phone: (0, import_fields14.text)(),
        website: (0, import_fields14.text)(),
        leadTimeDays: (0, import_fields14.integer)({ defaultValue: 0, validation: { min: 0 } }),
        notes: (0, import_fields14.text)({ ui: { displayMode: "textarea" } }),
        metadata: (0, import_fields14.json)(),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/InventoryLot.ts
var import_core13, import_access23, import_fields15, InventoryLot;
var init_InventoryLot = __esm({
  "features/keystone/models/InventoryLot.ts"() {
    "use strict";
    import_core13 = require("@keystone-6/core");
    import_access23 = require("@keystone-6/core/access");
    import_fields15 = require("@keystone-6/core/fields");
    init_access();
    init_requiredRelationship();
    init_trackingFields();
    InventoryLot = (0, import_core13.list)({
      access: {
        operation: {
          query: permissions.canReadInventory,
          create: import_access23.denyAll,
          update: import_access23.denyAll,
          delete: import_access23.denyAll
        }
      },
      ui: {
        hideCreate: true,
        hideDelete: true,
        itemView: { defaultFieldMode: "read" },
        listView: { initialColumns: ["lotNumber", "inventoryItem", "supplier", "status"] }
      },
      fields: {
        lotNumber: (0, import_fields15.text)({ isIndexed: "unique", validation: { isRequired: true } }),
        store: requiredStoreRelationship("StoreSetting.inventoryLots"),
        inventoryItem: (0, import_fields15.relationship)({ ref: "InventoryItem.inventoryLots" }),
        supplier: (0, import_fields15.relationship)({ ref: "Supplier" }),
        purchaseOrder: (0, import_fields15.relationship)({ ref: "PurchaseOrder.inventoryLots" }),
        quantityReceived: (0, import_fields15.decimal)({ defaultValue: "0" }),
        quantityRemaining: (0, import_fields15.decimal)({ defaultValue: "0" }),
        unitCostCents: (0, import_fields15.integer)({ defaultValue: 0, validation: { min: 0 } }),
        receivedAt: (0, import_fields15.timestamp)(),
        expiresAt: (0, import_fields15.timestamp)(),
        status: (0, import_fields15.select)({
          type: "string",
          options: [
            { label: "Active", value: "active" },
            { label: "Consumed", value: "consumed" },
            { label: "Expired", value: "expired" },
            { label: "Quarantined", value: "quarantined" }
          ],
          defaultValue: "active"
        }),
        metadata: (0, import_fields15.json)(),
        stockMovements: (0, import_fields15.relationship)({ ref: "StockMovement.inventoryLot", many: true }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/Ingredient.ts
var import_core14, import_fields16, Ingredient;
var init_Ingredient = __esm({
  "features/keystone/models/Ingredient.ts"() {
    "use strict";
    import_core14 = require("@keystone-6/core");
    import_fields16 = require("@keystone-6/core/fields");
    init_access();
    init_requiredRelationship();
    init_trackingFields();
    Ingredient = (0, import_core14.list)({
      access: { operation: { query: permissions.canReadProducts, create: permissions.canManageProducts, update: permissions.canManageProducts, delete: permissions.canManageProducts } },
      hooks: {
        validateInput: async ({ operation, resolvedData, item, context, addValidationError }) => {
          if (operation === "update" && resolvedData.store !== void 0) addValidationError("Ingredient store ownership is immutable");
          const quantity = resolvedData.quantity !== void 0 ? resolvedData.quantity : item?.quantity;
          const parsed = Number(quantity == null ? NaN : String(quantity));
          const scaled = Math.round(parsed * 1e4);
          if (!Number.isFinite(parsed) || scaled < 1 || Math.abs(parsed * 1e4 - scaled) > 1e-6 || parsed > 1e6) {
            addValidationError("Ingredient quantity must be greater than zero with at most 4 decimal places");
          }
          const unit = String((resolvedData.unit !== void 0 ? resolvedData.unit : item?.unit) ?? "").trim();
          if (!unit) addValidationError("Ingredient unit is required");
          const relationId = (value, current) => {
            if (value === void 0) return typeof current === "string" ? current : null;
            const input = value;
            if (input?.connect?.id) return input.connect.id;
            return null;
          };
          const inventoryItemId = relationId(resolvedData.inventoryItem, item?.inventoryItemId);
          const recipeId = relationId(resolvedData.recipe, item?.recipeId);
          const storeId = relationId(resolvedData.store, item?.storeId);
          const [inventory, recipe] = await Promise.all([
            inventoryItemId ? context.prisma.inventoryItem.findUnique({ where: { id: inventoryItemId }, select: { storeId: true, unit: true } }) : null,
            recipeId ? context.prisma.recipe.findUnique({ where: { id: recipeId }, select: { storeId: true } }) : null
          ]);
          if (inventory && unit && inventory.unit !== unit) addValidationError(`Ingredient unit must match its inventory item's unit (${inventory.unit})`);
          if (inventory && unit === "each" && scaled % 1e4 !== 0) addValidationError("Ingredients counted in each must use whole numbers");
          if (storeId && (inventory && inventory.storeId !== storeId || recipe && recipe.storeId !== storeId)) addValidationError("Ingredient, recipe and inventory item must belong to the same store");
        }
      },
      ui: { listView: { initialColumns: ["name", "recipe", "inventoryItem", "quantity"] } },
      fields: {
        name: (0, import_fields16.text)({ validation: { isRequired: true } }),
        store: requiredStoreRelationship("StoreSetting.ingredients"),
        inventoryItem: (0, import_fields16.relationship)({ ref: "InventoryItem" }),
        recipe: (0, import_fields16.relationship)({ ref: "Recipe" }),
        quantity: (0, import_fields16.decimal)({ defaultValue: "0" }),
        unit: (0, import_fields16.text)({ defaultValue: "g" }),
        optional: (0, import_fields16.checkbox)({ defaultValue: false }),
        notes: (0, import_fields16.text)({ ui: { displayMode: "textarea" } }),
        metadata: (0, import_fields16.json)(),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/Recipe.ts
var import_core15, import_fields17, Recipe;
var init_Recipe = __esm({
  "features/keystone/models/Recipe.ts"() {
    "use strict";
    import_core15 = require("@keystone-6/core");
    import_fields17 = require("@keystone-6/core/fields");
    init_access();
    init_requiredRelationship();
    init_trackingFields();
    Recipe = (0, import_core15.list)({
      access: { operation: { query: permissions.canReadProducts, create: permissions.canManageProducts, update: permissions.canManageProducts, delete: permissions.canManageProducts } },
      hooks: {
        validateInput: async ({ operation, resolvedData, item, addValidationError }) => {
          if (operation === "update" && resolvedData.store !== void 0) addValidationError("Recipe store ownership is immutable");
          const yieldQuantity = resolvedData.yieldQuantity !== void 0 ? resolvedData.yieldQuantity : item?.yieldQuantity;
          const parsed = Number(yieldQuantity == null ? NaN : String(yieldQuantity));
          const scaled = Math.round(parsed * 1e4);
          if (!Number.isFinite(parsed) || scaled < 1 || Math.abs(parsed * 1e4 - scaled) > 1e-6 || parsed > 1e6) {
            addValidationError("Yield must be greater than zero with at most 4 decimal places");
          }
          const yieldUnit = String((resolvedData.yieldUnit !== void 0 ? resolvedData.yieldUnit : item?.yieldUnit) ?? "").trim();
          if (!yieldUnit || yieldUnit.length > 40) addValidationError("Yield unit is required (for example serving)");
        }
      },
      ui: { listView: { initialColumns: ["name", "menuItem", "status", "active"] } },
      fields: {
        name: (0, import_fields17.text)({ validation: { isRequired: true } }),
        store: requiredStoreRelationship("StoreSetting.recipes"),
        menuItem: (0, import_fields17.relationship)({ ref: "MenuItem" }),
        status: (0, import_fields17.select)({ type: "string", options: [{ label: "Draft", value: "draft" }, { label: "Active", value: "active" }, { label: "Archived", value: "archived" }], defaultValue: "draft" }),
        yieldQuantity: (0, import_fields17.decimal)({ defaultValue: "1" }),
        yieldUnit: (0, import_fields17.text)({ defaultValue: "serving", ui: { description: "Use 'serving' or 'each' when a prepared batch is sold one item at a time" } }),
        prepInstructions: (0, import_fields17.text)({ ui: { displayMode: "textarea" } }),
        allergenNotes: (0, import_fields17.text)({ ui: { displayMode: "textarea" } }),
        active: (0, import_fields17.checkbox)({ defaultValue: true }),
        metadata: (0, import_fields17.json)(),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/User.ts
var import_core16, import_access27, import_fields18, User;
var init_User = __esm({
  "features/keystone/models/User.ts"() {
    "use strict";
    import_core16 = require("@keystone-6/core");
    import_access27 = require("@keystone-6/core/access");
    import_fields18 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    User = (0, import_core16.list)({
      access: {
        operation: {
          ...(0, import_access27.allOperations)(isSignedIn),
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
        name: (0, import_fields18.text)({ validation: { isRequired: true } }),
        email: (0, import_fields18.text)({ isFilterable: false, isOrderable: false, isIndexed: "unique", validation: { isRequired: true } }),
        phone: (0, import_fields18.text)(),
        password: (0, import_fields18.password)({
          access: {
            read: import_access27.denyAll,
            update: ({ session, item }) => permissions.canManagePeople({ session }) || session?.itemId === item.id
          },
          validation: { isRequired: true }
        }),
        onboardingStatus: (0, import_fields18.select)({
          type: "string",
          options: [
            { label: "Not Started", value: "not_started" },
            { label: "In Progress", value: "in_progress" },
            { label: "Completed", value: "completed" },
            { label: "Dismissed", value: "dismissed" }
          ],
          defaultValue: "not_started"
        }),
        role: (0, import_fields18.relationship)({
          ref: "Role.assignedTo",
          access: { create: permissions.canManageRoles, update: permissions.canManageRoles },
          ui: { itemView: { fieldMode: (args) => permissions.canManageRoles(args) ? "edit" : "read" } }
        }),
        cafeOrders: (0, import_fields18.relationship)({ ref: "CafeOrder.customer", many: true, access: { create: import_access27.denyAll, update: import_access27.denyAll } }),
        payments: (0, import_fields18.relationship)({ ref: "Payment.customer", many: true, access: { create: import_access27.denyAll, update: import_access27.denyAll } }),
        loyaltyAccount: (0, import_fields18.relationship)({ ref: "LoyaltyAccount.customer", access: { create: import_access27.denyAll, update: import_access27.denyAll } }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/Role.ts
var import_core17, import_access29, import_fields19, Role;
var init_Role = __esm({
  "features/keystone/models/Role.ts"() {
    "use strict";
    import_core17 = require("@keystone-6/core");
    import_access29 = require("@keystone-6/core/access");
    import_fields19 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    Role = (0, import_core17.list)({
      access: {
        operation: {
          ...(0, import_access29.allOperations)(permissions.canManageRoles),
          query: isSignedIn
        },
        filter: {
          query: ({ session }) => {
            if (!session) return false;
            if (permissions.canManageRoles({ session })) return true;
            return { assignedTo: { some: { id: { equals: session.itemId } } } };
          }
        }
      },
      ui: {
        // As in E-commerce: only role managers see Roles in navigation.
        isHidden: (args) => !permissions.canManageRoles(args),
        hideCreate: (args) => !permissions.canManageRoles(args),
        hideDelete: (args) => !permissions.canManageRoles(args),
        listView: { initialColumns: ["name", "assignedTo"] },
        itemView: { defaultFieldMode: (args) => permissions.canManageRoles(args) ? "edit" : "read" }
      },
      fields: {
        name: (0, import_fields19.text)({ validation: { isRequired: true } }),
        canAccessDashboard: (0, import_fields19.checkbox)({ defaultValue: false }),
        canReadOrders: (0, import_fields19.checkbox)({ defaultValue: false }),
        canManageOrders: (0, import_fields19.checkbox)({ defaultValue: false }),
        canReadPayments: (0, import_fields19.checkbox)({ defaultValue: false }),
        canManagePayments: (0, import_fields19.checkbox)({ defaultValue: false }),
        canReadProducts: (0, import_fields19.checkbox)({ defaultValue: false }),
        canManageProducts: (0, import_fields19.checkbox)({ defaultValue: false }),
        canReadInventory: (0, import_fields19.checkbox)({ defaultValue: false }),
        canManageInventory: (0, import_fields19.checkbox)({ defaultValue: false }),
        canReadLoyalty: (0, import_fields19.checkbox)({ defaultValue: false }),
        canManageLoyalty: (0, import_fields19.checkbox)({ defaultValue: false }),
        canSeeOtherPeople: (0, import_fields19.checkbox)({ defaultValue: false }),
        canEditOtherPeople: (0, import_fields19.checkbox)({ defaultValue: false }),
        canManagePeople: (0, import_fields19.checkbox)({ defaultValue: false }),
        canManageRoles: (0, import_fields19.checkbox)({ defaultValue: false }),
        canManageSettings: (0, import_fields19.checkbox)({ defaultValue: false }),
        canManageOnboarding: (0, import_fields19.checkbox)({ defaultValue: false }),
        assignedTo: (0, import_fields19.relationship)({
          ref: "User.role",
          many: true,
          ui: { displayMode: "count", itemView: { fieldMode: "read" } }
        }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/MenuCategory.ts
var import_core18, import_fields20, MenuCategory;
var init_MenuCategory = __esm({
  "features/keystone/models/MenuCategory.ts"() {
    "use strict";
    import_core18 = require("@keystone-6/core");
    import_fields20 = require("@keystone-6/core/fields");
    init_access();
    init_requiredRelationship();
    init_trackingFields();
    MenuCategory = (0, import_core18.list)({
      access: {
        operation: {
          query: permissions.canReadProducts,
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
        name: (0, import_fields20.text)({ validation: { isRequired: true } }),
        store: requiredStoreRelationship("StoreSetting.menuCategories"),
        description: (0, import_fields20.text)({ ui: { displayMode: "textarea" } }),
        active: (0, import_fields20.checkbox)({ defaultValue: true }),
        sortOrder: (0, import_fields20.integer)({ defaultValue: 0 }),
        menuItems: (0, import_fields20.relationship)({ ref: "MenuItem.category", many: true, ui: { displayMode: "count" } }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/lib/store-setting-merge.ts
function mergeStoreSettingRecord(item, resolvedData) {
  const merged = { ...item ?? {} };
  for (const [key, value] of Object.entries(resolvedData ?? {})) {
    if (value !== void 0) merged[key] = value;
  }
  return merged;
}
var init_store_setting_merge = __esm({
  "features/keystone/lib/store-setting-merge.ts"() {
    "use strict";
  }
});

// features/keystone/lib/store-locale-policy.ts
function validCoffeeTimezone(timezone) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(/* @__PURE__ */ new Date());
    return Boolean(timezone);
  } catch {
    return false;
  }
}
var COFFEE_CURRENCY_CODE_PATTERN;
var init_store_locale_policy = __esm({
  "features/keystone/lib/store-locale-policy.ts"() {
    "use strict";
    COFFEE_CURRENCY_CODE_PATTERN = /^USD$/;
  }
});

// features/keystone/lib/brand-colors.ts
var COFFEE_BRAND_COLORS, COFFEE_BRAND_COLOR_VALUES, DEFAULT_COFFEE_BRAND_COLOR;
var init_brand_colors = __esm({
  "features/keystone/lib/brand-colors.ts"() {
    "use strict";
    COFFEE_BRAND_COLORS = [
      { value: "copper", label: "Copper roast", hue: 55, swatch: "oklch(65% 0.11 55)" },
      { value: "amber", label: "Golden amber", hue: 82, swatch: "oklch(70% 0.12 82)" },
      { value: "forest", label: "Forest green", hue: 145, swatch: "oklch(62% 0.12 145)" },
      { value: "ocean", label: "Ocean blue", hue: 235, swatch: "oklch(64% 0.12 235)" },
      { value: "violet", label: "Deep violet", hue: 300, swatch: "oklch(65% 0.12 300)" },
      { value: "rose", label: "Roasted rose", hue: 20, swatch: "oklch(65% 0.12 20)" }
    ];
    COFFEE_BRAND_COLOR_VALUES = COFFEE_BRAND_COLORS.map((option) => option.value);
    DEFAULT_COFFEE_BRAND_COLOR = "copper";
  }
});

// features/keystone/utils/storeLogo.ts
function sanitizeStoreLogoSvg(svg) {
  const source = svg.trim();
  if (!source.startsWith("<svg") || !source.endsWith("</svg>") || source.length > 1e5) {
    return "";
  }
  if (/<!|<\?|\b(?:javascript|data|vbscript):|\bon[a-z]+\s*=|\b(?:href|src|style)\s*=/i.test(source)) {
    return "";
  }
  let tagCount = 0;
  let match;
  TAG_PATTERN.lastIndex = 0;
  while (match = TAG_PATTERN.exec(source)) {
    tagCount += 1;
    const element = match[1].toLowerCase();
    if (!ALLOWED_ELEMENTS.has(element)) return "";
    if (match[0].startsWith("</")) continue;
    const attributes = match[2];
    let consumed = "";
    ATTRIBUTE_PATTERN.lastIndex = 0;
    let attributeMatch;
    while (attributeMatch = ATTRIBUTE_PATTERN.exec(attributes)) {
      consumed += attributeMatch[0];
      const attribute = attributeMatch[1].toLowerCase();
      const value = attributeMatch[2].slice(1, -1);
      if (!ALLOWED_ATTRIBUTES.has(attribute)) return "";
      if (attribute === "id" && !/^[A-Za-z_][\w:.-]*$/.test(value)) return "";
      if (/url\(/i.test(value) && !/^url\(#[A-Za-z_][\w:.-]*\)$/.test(value)) return "";
    }
    const remainder = attributes.replace(consumed, "").replace(/\//g, "").trim();
    if (remainder) return "";
  }
  TAG_PATTERN.lastIndex = 0;
  if (tagCount === 0 || source.replace(TAG_PATTERN, "").trim()) return "";
  return source;
}
var ALLOWED_ELEMENTS, ALLOWED_ATTRIBUTES, ATTRIBUTE_PATTERN, TAG_PATTERN;
var init_storeLogo = __esm({
  "features/keystone/utils/storeLogo.ts"() {
    "use strict";
    ALLOWED_ELEMENTS = /* @__PURE__ */ new Set([
      "svg",
      "g",
      "path",
      "defs",
      "lineargradient",
      "radialgradient",
      "stop",
      "clippath",
      "rect",
      "circle",
      "ellipse",
      "line",
      "polyline",
      "polygon",
      "title",
      "desc"
    ]);
    ALLOWED_ATTRIBUTES = /* @__PURE__ */ new Set([
      "xmlns",
      "fill",
      "fill-rule",
      "clip-rule",
      "height",
      "width",
      "viewbox",
      "d",
      "clip-path",
      "id",
      "x1",
      "x2",
      "y1",
      "y2",
      "gradientunits",
      "gradienttransform",
      "offset",
      "stop-color",
      "stop-opacity",
      "opacity",
      "cx",
      "cy",
      "r",
      "rx",
      "ry",
      "x",
      "y",
      "transform",
      "stroke",
      "stroke-width",
      "stroke-linecap",
      "stroke-linejoin",
      "points",
      "role",
      "aria-hidden",
      "aria-label",
      "preserveaspectratio"
    ]);
    ATTRIBUTE_PATTERN = /\s+([A-Za-z_:][\w:.-]*)\s*=\s*("[^"]*"|'[^']*')/g;
    TAG_PATTERN = /<\/?\s*([A-Za-z][\w:-]*)([^<>]*)>/g;
  }
});

// features/lib/sanitize-store-logo.ts
var init_sanitize_store_logo = __esm({
  "features/lib/sanitize-store-logo.ts"() {
    "use strict";
    init_storeLogo();
  }
});

// features/platform/store-settings/lib/store-logo.ts
function normalizeStoreLogoColor(value) {
  const numeric = Number.parseFloat(String(value ?? DEFAULT_STORE_LOGO_COLOR));
  if (!Number.isFinite(numeric)) return DEFAULT_STORE_LOGO_COLOR;
  return String((numeric % 360 + 360) % 360);
}
var DEFAULT_STORE_LOGO_ICON, DEFAULT_STORE_LOGO_COLOR;
var init_store_logo = __esm({
  "features/platform/store-settings/lib/store-logo.ts"() {
    "use strict";
    DEFAULT_STORE_LOGO_ICON = '<svg fill="none" height="100%" viewBox="0 0 40 48" width="100%" xmlns="http://www.w3.org/2000/svg"><path d="m29.5411 6.41772c2.6913 5.27688 4.209 11.25228 4.209 17.58218s-1.5177 12.3054-4.2091 17.5823c6.2304-3.3881 10.4593-9.9914 10.4593-17.5823s-4.2289-14.19404-10.4592-17.58218z" fill="#6172f3"/><path d="m20.5481 5.99826c-.9047-1.28153-2.4457-1.9717-3.9913-1.70349-9.40496 1.63214-16.5568 9.83343-16.5568 19.70503 0 9.8717 7.1518 18.0729 16.5567 19.7051 1.5456.2682 3.0867-.4219 3.9913-1.7035 3.5923-5.0889 5.7025-11.2988 5.7025-18.0016 0-6.7027-2.1101-12.9126-5.7024-18.00154z" fill="#444ce7"/></svg>';
    DEFAULT_STORE_LOGO_COLOR = "160";
  }
});

// features/keystone/lib/store-settings-input.ts
function storeSettingRecordErrors(record) {
  const result = effectiveRecordSchema.safeParse({
    contactEmail: record.contactEmail,
    locale: record.locale,
    weeklyHours: record.weeklyHours ?? [],
    pickupLeadTimeMinutes: record.pickupLeadTimeMinutes,
    pickupWindowMinutes: record.pickupWindowMinutes,
    pickupCapacityPerWindow: record.pickupCapacityPerWindow,
    // Decimal fields arrive as strings or Decimal objects.
    taxRateBasisPoints: record.taxRateBasisPoints == null ? record.taxRateBasisPoints : Number(String(record.taxRateBasisPoints))
  });
  return result.success ? [] : result.error.issues.map((issue) => issue.message);
}
var import_zod, WEEKDAYS, PICKUP_LIMITS, timeValue, minutesOf, weeklyHoursSchema, boundedInt, taxBasisPoints, coffeeStoreSettingsInputSchema, effectiveRecordSchema;
var init_store_settings_input = __esm({
  "features/keystone/lib/store-settings-input.ts"() {
    "use strict";
    import_zod = require("zod");
    init_store_locale_policy();
    init_sanitize_store_logo();
    init_store_logo();
    init_brand_colors();
    WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
    PICKUP_LIMITS = {
      pickupLeadTimeMinutes: { min: 5, max: 240 },
      pickupWindowMinutes: { min: 5, max: 120 },
      pickupCapacityPerWindow: { min: 1, max: 500 },
      taxRateBasisPoints: { min: 0, max: 1e4 }
    };
    timeValue = import_zod.z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use 24-hour HH:MM times");
    minutesOf = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3, 5));
    weeklyHoursSchema = import_zod.z.array(
      import_zod.z.object({
        day: import_zod.z.enum(WEEKDAYS),
        open: timeValue.optional(),
        close: timeValue.optional(),
        closed: import_zod.z.boolean().optional()
      }).superRefine((row, context) => {
        if (row.closed) return;
        if (!row.open || !row.close) {
          context.addIssue({ code: import_zod.z.ZodIssueCode.custom, message: `${row.day} needs opening and closing times` });
        } else if (minutesOf(row.close) <= minutesOf(row.open)) {
          context.addIssue({ code: import_zod.z.ZodIssueCode.custom, message: `${row.day} must close after it opens` });
        }
      })
    ).max(7).superRefine((rows, context) => {
      if (new Set(rows.map((row) => row.day)).size !== rows.length) {
        context.addIssue({ code: import_zod.z.ZodIssueCode.custom, message: "Each weekday may appear only once" });
      }
    });
    boundedInt = (key, label) => import_zod.z.number({ invalid_type_error: `${label} must be a whole number` }).int(`${label} must be a whole number`).min(PICKUP_LIMITS[key].min, `${label} must be at least ${PICKUP_LIMITS[key].min}`).max(PICKUP_LIMITS[key].max, `${label} must be at most ${PICKUP_LIMITS[key].max}`);
    taxBasisPoints = import_zod.z.number({ invalid_type_error: "Tax rate must be a number" }).min(PICKUP_LIMITS.taxRateBasisPoints.min, "Tax rate can't be negative").max(PICKUP_LIMITS.taxRateBasisPoints.max, "Tax rate must be at most 100%").refine((value) => Math.abs(Math.round(value * 100) - value * 100) < 1e-6, "Tax rate allows at most three decimals of a percent");
    coffeeStoreSettingsInputSchema = import_zod.z.object({
      name: import_zod.z.string().trim().min(1, "Store name is required").max(200),
      tagline: import_zod.z.string().trim().max(300).default(""),
      description: import_zod.z.string().trim().max(2e3).default(""),
      address: import_zod.z.string().trim().min(1, "Address is required").max(500),
      phone: import_zod.z.string().trim().max(100).default(""),
      contactEmail: import_zod.z.string().trim().email("Enter a valid contact email"),
      currencyCode: import_zod.z.string().trim().transform((value) => value.toUpperCase()).pipe(import_zod.z.literal("USD")),
      locale: import_zod.z.literal("en-US"),
      timezone: import_zod.z.string().trim().min(3).max(100).refine(validCoffeeTimezone, "Enter a valid IANA timezone"),
      // Retained for stored-record compatibility; the storefront theme follows logoColor.
      brandColor: import_zod.z.enum(COFFEE_BRAND_COLOR_VALUES).default(DEFAULT_COFFEE_BRAND_COLOR),
      logoIcon: import_zod.z.string().max(1e5).default(DEFAULT_STORE_LOGO_ICON).refine((value) => !value.trim() || Boolean(sanitizeStoreLogoSvg(value)), "Enter a valid, safe SVG document").transform((value) => sanitizeStoreLogoSvg(value)),
      logoColor: import_zod.z.string().default("0").transform(normalizeStoreLogoColor),
      weeklyHours: weeklyHoursSchema,
      pickupLeadTimeMinutes: boundedInt("pickupLeadTimeMinutes", "Pickup lead time"),
      pickupWindowMinutes: boundedInt("pickupWindowMinutes", "Pickup window"),
      pickupCapacityPerWindow: boundedInt("pickupCapacityPerWindow", "Capacity per window"),
      taxRateBasisPoints: taxBasisPoints
    }).strict();
    effectiveRecordSchema = import_zod.z.object({
      contactEmail: import_zod.z.string().trim().email("Enter a valid contact email"),
      locale: import_zod.z.literal("en-US", { errorMap: () => ({ message: "This cafe supports the en-US locale only" }) }),
      weeklyHours: weeklyHoursSchema,
      pickupLeadTimeMinutes: boundedInt("pickupLeadTimeMinutes", "Pickup lead time"),
      pickupWindowMinutes: boundedInt("pickupWindowMinutes", "Pickup window"),
      pickupCapacityPerWindow: boundedInt("pickupCapacityPerWindow", "Capacity per window"),
      taxRateBasisPoints: taxBasisPoints
    });
  }
});

// features/keystone/models/StoreSettings.ts
var import_core19, import_access32, import_fields21, StoreSetting;
var init_StoreSettings = __esm({
  "features/keystone/models/StoreSettings.ts"() {
    "use strict";
    import_core19 = require("@keystone-6/core");
    import_access32 = require("@keystone-6/core/access");
    import_fields21 = require("@keystone-6/core/fields");
    init_access();
    init_store_setting_merge();
    init_store_locale_policy();
    init_brand_colors();
    init_trackingFields();
    init_sanitize_store_logo();
    init_store_logo();
    init_store_settings_input();
    StoreSetting = (0, import_core19.list)({
      access: {
        operation: {
          query: permissions.canManageSettings,
          create: permissions.canManageSettings,
          update: permissions.canManageSettings,
          delete: import_access32.denyAll
        }
      },
      hooks: {
        resolveInput: ({ operation, resolvedData }) => operation === "create" ? { ...resolvedData, singletonKey: "primary" } : resolvedData,
        // Every writer (generated CRUD, settings action, nested input) is held to the
        // same effective-record policy as the Store Settings screen.
        validate: ({ operation, resolvedData, item, addValidationError }) => {
          if (operation === "delete") return;
          const merged = mergeStoreSettingRecord(item, resolvedData);
          for (const message of storeSettingRecordErrors(merged)) addValidationError(message);
        }
      },
      ui: {
        hideCreate: true,
        label: "Store settings",
        singular: "Store settings",
        // The dashboard derives GraphQL names from this plural; it must spell the list key (StoreSettings).
        plural: "Store Settings",
        listView: {
          initialColumns: ["name", "address", "contactEmail", "phone"]
        }
      },
      fields: {
        singletonKey: (0, import_fields21.text)({
          isIndexed: "unique",
          defaultValue: "primary",
          validation: { isRequired: true },
          access: { update: () => false },
          ui: { itemView: { fieldMode: "read" }, createView: { fieldMode: "hidden" } }
        }),
        name: (0, import_fields21.text)({ validation: { isRequired: true } }),
        tagline: (0, import_fields21.text)(),
        description: (0, import_fields21.text)({ ui: { displayMode: "textarea" } }),
        address: (0, import_fields21.text)({ validation: { isRequired: true } }),
        phone: (0, import_fields21.text)(),
        contactEmail: (0, import_fields21.text)({ validation: { isRequired: true } }),
        currencyCode: (0, import_fields21.text)({ defaultValue: "USD", validation: { isRequired: true, length: { min: 3, max: 3 }, match: { regex: COFFEE_CURRENCY_CODE_PATTERN, explanation: "This cafe pilot supports USD only" } } }),
        locale: (0, import_fields21.text)({ defaultValue: "en-US", validation: { isRequired: true, match: { regex: /^en-US$/, explanation: "This cafe supports the en-US locale only" } } }),
        timezone: (0, import_fields21.text)({
          defaultValue: "America/New_York",
          validation: { isRequired: true },
          hooks: {
            validate: ({ resolvedData, addValidationError }) => {
              const timezone = resolvedData?.timezone;
              if (timezone !== void 0 && (typeof timezone !== "string" || !validCoffeeTimezone(timezone))) {
                addValidationError("Enter a valid IANA store timezone");
              }
            }
          }
        }),
        brandColor: (0, import_fields21.select)({
          type: "string",
          options: COFFEE_BRAND_COLORS.map(({ label, value }) => ({ label, value })),
          defaultValue: DEFAULT_COFFEE_BRAND_COLOR,
          validation: { isRequired: true },
          ui: { description: "Earlier palette setting kept for existing records; the storefront theme follows the logo colour", itemView: { fieldMode: "read" } }
        }),
        logoIcon: (0, import_fields21.text)({
          defaultValue: DEFAULT_STORE_LOGO_ICON,
          hooks: {
            resolveInput: ({ resolvedData, fieldKey }) => {
              const value = resolvedData[fieldKey];
              return value === void 0 || value === null || value === "" ? value : sanitizeStoreLogoSvg(value);
            },
            validate: ({ inputData, resolvedData, fieldKey, addValidationError }) => {
              if (typeof inputData?.[fieldKey] === "string" && inputData[fieldKey].trim() && !resolvedData?.[fieldKey]) {
                addValidationError("Logo must be a valid, safe SVG document");
              }
            }
          }
        }),
        logoColor: (0, import_fields21.text)({
          defaultValue: DEFAULT_STORE_LOGO_COLOR,
          hooks: { resolveInput: ({ resolvedData, fieldKey }) => resolvedData[fieldKey] === void 0 ? void 0 : normalizeStoreLogoColor(resolvedData[fieldKey]) }
        }),
        weeklyHours: (0, import_fields21.json)({ defaultValue: [] }),
        pickupLeadTimeMinutes: (0, import_fields21.integer)({ defaultValue: 12, validation: { ...PICKUP_LIMITS.pickupLeadTimeMinutes } }),
        pickupWindowMinutes: (0, import_fields21.integer)({ defaultValue: 15, validation: { ...PICKUP_LIMITS.pickupWindowMinutes } }),
        pickupCapacityPerWindow: (0, import_fields21.integer)({ defaultValue: 20, validation: { ...PICKUP_LIMITS.pickupCapacityPerWindow } }),
        taxRateBasisPoints: (0, import_fields21.decimal)({ precision: 7, scale: 2, defaultValue: "875", validation: { isRequired: true, min: "0", max: "10000" }, ui: { description: "Store pickup sales-tax rate in basis points (887.5 = 8.875%)" } }),
        menuCategories: (0, import_fields21.relationship)({ ref: "MenuCategory.store", many: true, access: { create: import_access32.denyAll, update: import_access32.denyAll } }),
        menuItems: (0, import_fields21.relationship)({ ref: "MenuItem.store", many: true, access: { create: import_access32.denyAll, update: import_access32.denyAll } }),
        menuItemModifiers: (0, import_fields21.relationship)({ ref: "MenuItemModifier.store", many: true, access: { create: import_access32.denyAll, update: import_access32.denyAll } }),
        cafeOrders: (0, import_fields21.relationship)({ ref: "CafeOrder.store", many: true, access: { create: import_access32.denyAll, update: import_access32.denyAll } }),
        orderItems: (0, import_fields21.relationship)({ ref: "OrderItem.store", many: true, access: { create: import_access32.denyAll, update: import_access32.denyAll } }),
        posOrders: (0, import_fields21.relationship)({ ref: "PosOrder.store", many: true, access: { create: import_access32.denyAll, update: import_access32.denyAll } }),
        registerShifts: (0, import_fields21.relationship)({ ref: "RegisterShift.store", many: true, access: { create: import_access32.denyAll, update: import_access32.denyAll } }),
        cashMovements: (0, import_fields21.relationship)({ ref: "CashMovement.store", many: true, access: { create: import_access32.denyAll, update: import_access32.denyAll } }),
        payments: (0, import_fields21.relationship)({ ref: "Payment.store", many: true, access: { create: import_access32.denyAll, update: import_access32.denyAll } }),
        loyaltyAccounts: (0, import_fields21.relationship)({ ref: "LoyaltyAccount.store", many: true, access: { create: import_access32.denyAll, update: import_access32.denyAll } }),
        giftCards: (0, import_fields21.relationship)({ ref: "GiftCard.store", many: true, access: { create: import_access32.denyAll, update: import_access32.denyAll } }),
        subscriptions: (0, import_fields21.relationship)({ ref: "Subscription.store", many: true, access: { create: import_access32.denyAll, update: import_access32.denyAll } }),
        cateringOrders: (0, import_fields21.relationship)({ ref: "CateringOrder.store", many: true, access: { create: import_access32.denyAll, update: import_access32.denyAll } }),
        paymentEvents: (0, import_fields21.relationship)({ ref: "PaymentEvent.store", many: true, access: { create: import_access32.denyAll, update: import_access32.denyAll } }),
        inventoryItems: (0, import_fields21.relationship)({ ref: "InventoryItem.store", many: true, access: { create: import_access32.denyAll, update: import_access32.denyAll } }),
        stockMovements: (0, import_fields21.relationship)({ ref: "StockMovement.store", many: true, access: { create: import_access32.denyAll, update: import_access32.denyAll } }),
        suppliers: (0, import_fields21.relationship)({ ref: "Supplier.store", many: true, access: { create: import_access32.denyAll, update: import_access32.denyAll } }),
        purchaseOrders: (0, import_fields21.relationship)({ ref: "PurchaseOrder.store", many: true, access: { create: import_access32.denyAll, update: import_access32.denyAll } }),
        inventoryLots: (0, import_fields21.relationship)({ ref: "InventoryLot.store", many: true, access: { create: import_access32.denyAll, update: import_access32.denyAll } }),
        recipes: (0, import_fields21.relationship)({ ref: "Recipe.store", many: true, access: { create: import_access32.denyAll, update: import_access32.denyAll } }),
        ingredients: (0, import_fields21.relationship)({ ref: "Ingredient.store", many: true, access: { create: import_access32.denyAll, update: import_access32.denyAll } }),
        prepBatches: (0, import_fields21.relationship)({ ref: "PrepBatch.store", many: true, access: { create: import_access32.denyAll, update: import_access32.denyAll } }),
        prepBatchConsumptions: (0, import_fields21.relationship)({ ref: "PrepBatchConsumption.store", many: true, access: { create: import_access32.denyAll, update: import_access32.denyAll } }),
        wasteLogs: (0, import_fields21.relationship)({ ref: "WasteLog.store", many: true, access: { create: import_access32.denyAll, update: import_access32.denyAll } }),
        staffShifts: (0, import_fields21.relationship)({ ref: "StaffShift.store", many: true, access: { create: import_access32.denyAll, update: import_access32.denyAll } }),
        commandReceipts: (0, import_fields21.relationship)({ ref: "CoffeeCommandReceipt.store", many: true, access: { create: import_access32.denyAll, update: import_access32.denyAll } }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/MenuItem.ts
var import_core20, import_fields22, import_fields_document, MenuItem;
var init_MenuItem = __esm({
  "features/keystone/models/MenuItem.ts"() {
    "use strict";
    import_core20 = require("@keystone-6/core");
    import_fields22 = require("@keystone-6/core/fields");
    import_fields_document = require("@keystone-6/fields-document");
    init_access();
    init_requiredRelationship();
    init_trackingFields();
    MenuItem = (0, import_core20.list)({
      access: {
        operation: {
          query: permissions.canReadProducts,
          create: permissions.canManageProducts,
          update: permissions.canManageProducts,
          delete: permissions.canManageProducts
        }
      },
      ui: {
        listView: {
          initialColumns: ["name", "category", "displayPrice", "available", "barStation", "prepTimeMinutes"]
        }
      },
      fields: {
        idempotencyKey: (0, import_fields22.text)({ isIndexed: "unique", db: { isNullable: true }, access: { read: permissions.canManageProducts, create: () => false, update: () => false }, ui: { itemView: { fieldMode: "read" }, createView: { fieldMode: "hidden" } } }),
        name: (0, import_fields22.text)({ validation: { isRequired: true } }),
        store: requiredStoreRelationship("StoreSetting.menuItems"),
        description: (0, import_fields_document.document)({ formatting: true, links: true }),
        shortDescription: (0, import_fields22.text)({ ui: { displayMode: "textarea" } }),
        price: (0, import_fields22.integer)({ validation: { isRequired: true, min: 0 }, access: { update: () => false }, label: "Price (cents)", ui: { description: "In cents: 495 = $4.95. Platform Menu takes dollars." } }),
        available: (0, import_fields22.checkbox)({ defaultValue: true, access: { update: () => false } }),
        featured: (0, import_fields22.checkbox)({ defaultValue: false, access: { update: () => false } }),
        popular: (0, import_fields22.checkbox)({ defaultValue: false, access: { update: () => false } }),
        imageUrl: (0, import_fields22.text)({ ui: { description: "Legacy storefront image URL or local asset path" }, db: { isNullable: true } }),
        primaryImageUrl: (0, import_fields22.virtual)({
          field: import_core20.graphql.field({
            type: import_core20.graphql.String,
            resolve: async (item, _args, context) => {
              const menuItem = await context.query.MenuItem.findOne({
                where: { id: String(item.id) },
                query: "imageUrl menuItemImages(orderBy: { order: asc }, take: 1) { image { url } imagePath }"
              });
              const uploadedImageUrl = menuItem?.menuItemImages?.[0]?.image?.url;
              if (uploadedImageUrl) return uploadedImageUrl;
              const imagePath = menuItem?.menuItemImages?.[0]?.imagePath;
              if (imagePath) {
                if (/^(https?:|data:|blob:)/.test(imagePath) || imagePath.startsWith("/images/")) return imagePath;
                return imagePath.startsWith("/") ? `/images${imagePath}` : `/images/${imagePath}`;
              }
              return menuItem?.imageUrl || null;
            }
          })
        }),
        menuItemImages: (0, import_fields22.relationship)({
          ref: "MenuItemImage.menuItems",
          many: true,
          ui: {
            displayMode: "cards",
            cardFields: ["image", "altText", "imagePath"],
            inlineCreate: { fields: ["image", "altText", "imagePath"] },
            inlineEdit: { fields: ["image", "altText", "imagePath"] },
            inlineConnect: true,
            removeMode: "disconnect",
            linkToItem: false
          }
        }),
        prepTimeMinutes: (0, import_fields22.integer)({ defaultValue: 5, validation: { min: 0 } }),
        caffeineMg: (0, import_fields22.integer)({ ui: { description: "Approximate caffeine content for drinks" } }),
        calories: (0, import_fields22.integer)(),
        barStation: (0, import_fields22.select)({
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
        temperatureOptions: (0, import_fields22.multiselect)({
          type: "string",
          options: [
            { label: "Hot", value: "hot" },
            { label: "Iced", value: "iced" },
            { label: "Blended", value: "blended" }
          ],
          defaultValue: ["hot"]
        }),
        dietaryFlags: (0, import_fields22.multiselect)({
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
        serviceWindows: (0, import_fields22.multiselect)({
          type: "string",
          options: [
            { label: "Morning", value: "morning" },
            { label: "Midday", value: "midday" },
            { label: "Afternoon", value: "afternoon" },
            { label: "All Day", value: "all_day" }
          ],
          defaultValue: ["all_day"]
        }),
        displayPrice: (0, import_fields22.virtual)({
          label: "Price",
          field: import_core20.graphql.field({
            type: import_core20.graphql.String,
            resolve(item) {
              const price2 = typeof item.price === "number" ? item.price : 0;
              return `$${((price2 || 0) / 100).toFixed(2)}`;
            }
          })
        }),
        category: (0, import_fields22.relationship)({ ref: "MenuCategory.menuItems" }),
        // Modifier parent and order-line history are lifecycle links: only the menu
        // commands (manageCoffeeMenu) and checkout write them, never a raw connect/disconnect.
        modifiers: (0, import_fields22.relationship)({
          ref: "MenuItemModifier.menuItem",
          many: true,
          access: { create: () => false, update: () => false },
          ui: {
            displayMode: "cards",
            cardFields: ["name", "modifierGroup", "priceAdjustment", "defaultSelected"],
            itemView: { fieldMode: "read" },
            createView: { fieldMode: "hidden" }
          }
        }),
        orderItems: (0, import_fields22.relationship)({
          ref: "OrderItem.menuItem",
          many: true,
          access: { create: () => false, update: () => false },
          ui: { itemView: { fieldMode: "read" }, createView: { fieldMode: "hidden" } }
        }),
        inventoryItem: (0, import_fields22.relationship)({ ref: "InventoryItem.menuItems" }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/MenuItemImage.ts
var import_core21, import_fields23, MenuItemImage;
var init_MenuItemImage = __esm({
  "features/keystone/models/MenuItemImage.ts"() {
    "use strict";
    import_core21 = require("@keystone-6/core");
    import_fields23 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    MenuItemImage = (0, import_core21.list)({
      access: {
        operation: {
          query: permissions.canReadProducts,
          create: permissions.canManageProducts,
          update: permissions.canManageProducts,
          delete: permissions.canManageProducts
        }
      },
      ui: {
        listView: {
          initialColumns: ["image", "imagePath", "altText", "menuItems"]
        }
      },
      fields: {
        image: (0, import_fields23.image)({ storage: "my_images" }),
        imagePath: (0, import_fields23.text)({ validation: { isRequired: true } }),
        altText: (0, import_fields23.text)(),
        order: (0, import_fields23.integer)({ defaultValue: 0 }),
        menuItems: (0, import_fields23.relationship)({ ref: "MenuItem.menuItemImages", many: true, ui: { displayMode: "count" } }),
        metadata: (0, import_fields23.json)(),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/MenuItemModifier.ts
var import_core22, import_access36, import_fields24, MenuItemModifier;
var init_MenuItemModifier = __esm({
  "features/keystone/models/MenuItemModifier.ts"() {
    "use strict";
    import_core22 = require("@keystone-6/core");
    import_access36 = require("@keystone-6/core/access");
    init_access();
    import_fields24 = require("@keystone-6/core/fields");
    init_requiredRelationship();
    init_trackingFields();
    MenuItemModifier = (0, import_core22.list)({
      access: {
        operation: {
          query: permissions.canReadProducts,
          create: import_access36.denyAll,
          update: import_access36.denyAll,
          delete: import_access36.denyAll
        }
      },
      ui: {
        hideCreate: true,
        hideDelete: true,
        itemView: { defaultFieldMode: "read" },
        listView: {
          initialColumns: ["name", "modifierGroup", "priceAdjustment", "defaultSelected", "menuItem"]
        }
      },
      fields: {
        idempotencyKey: (0, import_fields24.text)({ isIndexed: "unique", db: { isNullable: true }, access: { read: permissions.canManageProducts, create: () => false, update: () => false } }),
        store: requiredStoreRelationship("StoreSetting.menuItemModifiers"),
        name: (0, import_fields24.text)({ validation: { isRequired: true } }),
        modifierGroup: (0, import_fields24.select)({
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
            { label: "Bakery Prep", value: "bakery_prep" },
            { label: "Grind", value: "grind" }
          ],
          defaultValue: "milk"
        }),
        modifierGroupLabel: (0, import_fields24.text)({ ui: { description: "Customer-facing group label, e.g. Milk choice" } }),
        required: (0, import_fields24.checkbox)({ defaultValue: false }),
        minSelections: (0, import_fields24.integer)({ defaultValue: 0, validation: { min: 0 } }),
        maxSelections: (0, import_fields24.integer)({ defaultValue: 1, validation: { min: 1 } }),
        priceAdjustment: (0, import_fields24.integer)({ defaultValue: 0, ui: { description: "Cents added or removed" } }),
        defaultSelected: (0, import_fields24.checkbox)({ defaultValue: false }),
        inStock: (0, import_fields24.checkbox)({ defaultValue: true, access: { update: () => false } }),
        menuItem: (0, import_fields24.relationship)({ ref: "MenuItem.modifiers", access: { create: () => false, update: () => false } }),
        inventoryAction: (0, import_fields24.select)({ type: "string", options: ["unreviewed", "none", "add", "substitute"], defaultValue: "unreviewed" }),
        inventoryItem: (0, import_fields24.relationship)({ ref: "InventoryItem", ui: { description: "Stable inventory consumed by this option, never matched by name." } }),
        replacesInventoryItem: (0, import_fields24.relationship)({ ref: "InventoryItem", ui: { description: "For substitution: exact base recipe inventory to replace, in the same unit." } }),
        inventoryQuantity: (0, import_fields24.decimal)({ precision: 18, scale: 4, defaultValue: "0", validation: { min: "0" }, ui: { description: "Add-on quantity per serving in the linked inventory item's unit." } }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/CafeOrder.ts
var import_core23, import_access38, import_fields25, import_crypto, CafeOrder;
var init_CafeOrder = __esm({
  "features/keystone/models/CafeOrder.ts"() {
    "use strict";
    import_core23 = require("@keystone-6/core");
    import_access38 = require("@keystone-6/core/access");
    import_fields25 = require("@keystone-6/core/fields");
    import_crypto = __toESM(require("crypto"));
    init_access();
    init_requiredRelationship();
    init_trackingFields();
    CafeOrder = (0, import_core23.list)({
      access: {
        operation: {
          query: ({ session }) => permissions.canReadOrders({ session }) || permissions.canManageOrders({ session }),
          create: import_access38.denyAll,
          update: import_access38.denyAll,
          delete: import_access38.denyAll
        }
      },
      ui: {
        // Orders are known by their number everywhere staff see them (relationship columns, pickers).
        labelField: "orderNumber",
        hideCreate: true,
        hideDelete: true,
        itemView: { defaultFieldMode: "read" },
        listView: {
          initialColumns: ["orderNumber", "status", "fulfillmentType", "customerName", "promisedAt", "displayTotal"]
        }
      },
      fields: {
        orderNumber: (0, import_fields25.text)({ validation: { isRequired: true }, isIndexed: "unique" }),
        idempotencyKey: (0, import_fields25.text)({
          isIndexed: "unique",
          isFilterable: false,
          isOrderable: false,
          db: { isNullable: true },
          ui: { itemView: { fieldMode: "read" }, createView: { fieldMode: "hidden" } },
          access: { read: permissions.canManageOrders, update: () => false }
        }),
        requestFingerprint: (0, import_fields25.text)({
          db: { isNullable: true },
          isFilterable: false,
          isOrderable: false,
          ui: { itemView: { fieldMode: "read" }, createView: { fieldMode: "hidden" } },
          access: { read: permissions.canManageOrders, update: () => false }
        }),
        fulfillmentType: (0, import_fields25.select)({
          type: "string",
          options: [
            { label: "Pickup", value: "pickup" },
            { label: "Counter", value: "counter" },
            { label: "Dine-in", value: "dine_in" }
          ],
          defaultValue: "pickup"
        }),
        orderSource: (0, import_fields25.select)({
          type: "string",
          options: [
            { label: "Online", value: "online" },
            { label: "POS", value: "pos" },
            { label: "Kiosk", value: "kiosk" },
            { label: "Phone", value: "phone" }
          ],
          defaultValue: "online"
        }),
        status: (0, import_fields25.select)({
          type: "string",
          access: { update: () => false },
          options: [
            { label: "Open request", value: "open" },
            { label: "Accepted \u2014 pay at pickup", value: "accepted" },
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
        customerName: (0, import_fields25.text)(),
        customerEmail: (0, import_fields25.text)(),
        customerPhone: (0, import_fields25.text)(),
        pickupName: (0, import_fields25.text)({ ui: { description: "Name called at handoff counter" } }),
        specialInstructions: (0, import_fields25.text)({ ui: { displayMode: "textarea" } }),
        subtotal: (0, import_fields25.integer)({ defaultValue: 0, validation: { min: 0 } }),
        tax: (0, import_fields25.integer)({ defaultValue: 0, validation: { min: 0 } }),
        tip: (0, import_fields25.integer)({ defaultValue: 0, validation: { min: 0 } }),
        discount: (0, import_fields25.integer)({ defaultValue: 0, validation: { min: 0 } }),
        total: (0, import_fields25.integer)({ defaultValue: 0, validation: { min: 0 }, ui: { description: "Total in cents" } }),
        // The total as staff read it ($4.63), for the list column next to the stored cents.
        displayTotal: (0, import_fields25.virtual)({
          label: "Total",
          field: import_core23.graphql.field({
            type: import_core23.graphql.String,
            resolve(item) {
              const cents2 = typeof item.total === "number" ? item.total : 0;
              const currency = typeof item.currencyCode === "string" && /^[A-Z]{3}$/.test(item.currencyCode) ? item.currencyCode : "USD";
              return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents2 / 100);
            }
          })
        }),
        currencyCode: (0, import_fields25.text)({ defaultValue: "USD" }),
        paidAt: (0, import_fields25.timestamp)(),
        promisedAt: (0, import_fields25.timestamp)({ ui: { description: "Quoted pickup time" } }),
        startedAt: (0, import_fields25.timestamp)(),
        readyAt: (0, import_fields25.timestamp)(),
        completedAt: (0, import_fields25.timestamp)(),
        cancelledAt: (0, import_fields25.timestamp)(),
        isRush: (0, import_fields25.checkbox)({ defaultValue: false }),
        handoffCode: (0, import_fields25.text)({
          hooks: {
            resolveInput: ({ operation, resolvedData }) => {
              if (operation === "create" && !resolvedData.handoffCode) {
                return import_crypto.default.randomBytes(3).toString("hex").toUpperCase();
              }
              return resolvedData.handoffCode;
            }
          }
        }),
        secretKey: (0, import_fields25.text)({
          isFilterable: false,
          isOrderable: false,
          access: { read: () => false, update: () => false },
          hooks: {
            resolveInput: ({ operation }) => operation === "create" ? import_crypto.default.randomBytes(32).toString("hex") : void 0
          }
        }),
        store: requiredStoreRelationship("StoreSetting.cafeOrders"),
        orderAgeMinutes: (0, import_fields25.virtual)({
          field: import_core23.graphql.field({
            type: import_core23.graphql.Int,
            resolve(item) {
              const createdAt = item.createdAt;
              if (typeof createdAt !== "string" && !(createdAt instanceof Date)) return 0;
              return Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 6e4));
            }
          })
        }),
        customer: (0, import_fields25.relationship)({ ref: "User.cafeOrders" }),
        orderItems: (0, import_fields25.relationship)({ ref: "OrderItem.order", many: true }),
        payments: (0, import_fields25.relationship)({ ref: "Payment.order", many: true }),
        paymentEvents: (0, import_fields25.relationship)({ ref: "PaymentEvent.order", many: true }),
        stockMovements: (0, import_fields25.relationship)({ ref: "StockMovement.order", many: true }),
        prepBatchConsumptions: (0, import_fields25.relationship)({ ref: "PrepBatchConsumption.order", many: true }),
        loyaltyAccount: (0, import_fields25.relationship)({ ref: "LoyaltyAccount.orders" }),
        loyaltyEvents: (0, import_fields25.relationship)({ ref: "LoyaltyEvent.order", many: true }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/OrderItem.ts
var import_core24, import_access40, import_fields26, OrderItem;
var init_OrderItem = __esm({
  "features/keystone/models/OrderItem.ts"() {
    "use strict";
    import_core24 = require("@keystone-6/core");
    import_access40 = require("@keystone-6/core/access");
    import_fields26 = require("@keystone-6/core/fields");
    init_access();
    init_requiredRelationship();
    init_trackingFields();
    OrderItem = (0, import_core24.list)({
      access: {
        operation: {
          query: permissions.canReadOrders,
          create: import_access40.denyAll,
          update: import_access40.denyAll,
          delete: import_access40.denyAll
        }
      },
      ui: {
        hideCreate: true,
        hideDelete: true,
        itemView: { defaultFieldMode: "read" },
        listView: {
          initialColumns: ["menuItem", "quantity", "price", "barStatus", "order"]
        }
      },
      fields: {
        store: requiredStoreRelationship("StoreSetting.orderItems"),
        quantity: (0, import_fields26.integer)({ defaultValue: 1, validation: { min: 1, isRequired: true } }),
        price: (0, import_fields26.integer)({
          validation: { isRequired: true, min: 0 },
          ui: { description: "Unit price snapshot in cents", itemView: { fieldMode: "read" } },
          access: { update: () => false }
        }),
        itemNameSnapshot: (0, import_fields26.text)({
          ui: { description: "Menu item name at time of order", itemView: { fieldMode: "read" } },
          access: { update: () => false }
        }),
        imagePathSnapshot: (0, import_fields26.text)({
          ui: { description: "Primary menu image path at time of order", itemView: { fieldMode: "read" } },
          access: { update: () => false }
        }),
        customizationsSummary: (0, import_fields26.text)({
          ui: { displayMode: "textarea", itemView: { fieldMode: "read" } },
          access: { update: () => false }
        }),
        modifierSnapshot: (0, import_fields26.json)({
          defaultValue: [],
          ui: { description: "Selected modifier names, groups, and price adjustments at time of order", itemView: { fieldMode: "read" } },
          access: { update: () => false }
        }),
        specialInstructions: (0, import_fields26.text)({
          ui: { displayMode: "textarea", itemView: { fieldMode: "read" } },
          access: { update: () => false }
        }),
        barStatus: (0, import_fields26.select)({
          type: "string",
          access: { update: () => false },
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
        station: (0, import_fields26.select)({
          type: "string",
          access: { update: () => false },
          options: [
            { label: "Espresso Bar", value: "espresso_bar" },
            { label: "Cold Bar", value: "cold_bar" },
            { label: "Brew Bar", value: "brew_bar" },
            { label: "Pastry Case", value: "pastry_case" },
            { label: "Retail Shelf", value: "retail_shelf" }
          ],
          defaultValue: "espresso_bar"
        }),
        queuedAt: (0, import_fields26.timestamp)({ access: { update: () => false } }),
        startedAt: (0, import_fields26.timestamp)({ access: { update: () => false } }),
        readyAt: (0, import_fields26.timestamp)({ access: { update: () => false } }),
        handedOffAt: (0, import_fields26.timestamp)({ access: { update: () => false } }),
        totalPrice: (0, import_fields26.virtual)({
          field: import_core24.graphql.field({
            type: import_core24.graphql.Int,
            resolve(item) {
              const price2 = typeof item.price === "number" ? item.price : 0;
              const quantity = typeof item.quantity === "number" ? item.quantity : 1;
              return (price2 || 0) * (quantity || 1);
            }
          })
        }),
        order: (0, import_fields26.relationship)({ ref: "CafeOrder.orderItems" }),
        menuItem: (0, import_fields26.relationship)({ ref: "MenuItem.orderItems" }),
        appliedModifiers: (0, import_fields26.relationship)({ ref: "MenuItemModifier", many: true }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/Payment.ts
var import_core25, import_access42, import_core26, import_fields27, Payment;
var init_Payment = __esm({
  "features/keystone/models/Payment.ts"() {
    "use strict";
    import_core25 = require("@keystone-6/core");
    import_access42 = require("@keystone-6/core/access");
    import_core26 = require("@keystone-6/core");
    import_fields27 = require("@keystone-6/core/fields");
    init_access();
    init_requiredRelationship();
    init_trackingFields();
    Payment = (0, import_core25.list)({
      access: {
        operation: {
          query: permissions.canReadPayments,
          create: import_access42.denyAll,
          update: import_access42.denyAll,
          delete: import_access42.denyAll
        }
      },
      ui: { hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: "read" }, listView: { initialColumns: ["order", "status", "method", "displayAmount", "processedAt"] } },
      fields: {
        idempotencyKey: (0, import_fields27.text)({
          isIndexed: "unique",
          db: { isNullable: true },
          ui: { itemView: { fieldMode: "read" }, createView: { fieldMode: "hidden" } },
          access: { read: permissions.canManagePayments, update: () => false }
        }),
        refundIdempotencyKey: (0, import_fields27.text)({
          isIndexed: "unique",
          db: { isNullable: true },
          access: { read: permissions.canManagePayments, update: () => false },
          ui: { itemView: { fieldMode: "read" }, createView: { fieldMode: "hidden" } }
        }),
        refundedAmount: (0, import_fields27.integer)({ defaultValue: 0, validation: { min: 0 }, access: { update: () => false } }),
        refundReason: (0, import_fields27.text)({ access: { update: () => false } }),
        refundedAt: (0, import_fields27.timestamp)({ access: { update: () => false } }),
        status: (0, import_fields27.select)({
          type: "string",
          access: { update: () => false },
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
        method: (0, import_fields27.select)({
          type: "string",
          options: [
            { label: "Card", value: "card" },
            { label: "Cash", value: "cash" },
            { label: "Gift Card", value: "gift_card" },
            { label: "Manual", value: "manual" }
          ],
          defaultValue: "card"
        }),
        amount: (0, import_fields27.integer)({ validation: { isRequired: true, min: 0 }, ui: { description: "Amount in cents" } }),
        currencyCode: (0, import_fields27.text)({ defaultValue: "USD" }),
        // The amount as staff read it ($5.39), next to the stored cents.
        displayAmount: (0, import_fields27.virtual)({
          label: "Amount",
          field: import_core26.graphql.field({
            type: import_core26.graphql.String,
            resolve(item) {
              const cents2 = typeof item.amount === "number" ? item.amount : 0;
              const currency = typeof item.currencyCode === "string" && /^[A-Z]{3}$/.test(item.currencyCode) ? item.currencyCode : "USD";
              return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(cents2 / 100);
            }
          })
        }),
        provider: (0, import_fields27.text)({ defaultValue: "manual" }),
        providerPaymentId: (0, import_fields27.text)(),
        failureMessage: (0, import_fields27.text)(),
        processedAt: (0, import_fields27.timestamp)(),
        store: requiredStoreRelationship("StoreSetting.payments"),
        order: (0, import_fields27.relationship)({ ref: "CafeOrder.payments" }),
        customer: (0, import_fields27.relationship)({ ref: "User.payments" }),
        paymentProvider: (0, import_fields27.relationship)({ ref: "PaymentProvider.paymentRecords" }),
        events: (0, import_fields27.relationship)({ ref: "PaymentEvent.payment", many: true }),
        registerShift: (0, import_fields27.relationship)({ ref: "RegisterShift.payments" }),
        refundRegisterShift: (0, import_fields27.relationship)({ ref: "RegisterShift", access: { create: import_access42.denyAll, update: import_access42.denyAll }, ui: { description: "Actual payout shift; original sale shift and its close remain unchanged." } }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/PaymentEvent.ts
var import_core27, import_access44, import_fields28, PaymentEvent;
var init_PaymentEvent = __esm({
  "features/keystone/models/PaymentEvent.ts"() {
    "use strict";
    import_core27 = require("@keystone-6/core");
    import_access44 = require("@keystone-6/core/access");
    import_fields28 = require("@keystone-6/core/fields");
    init_access();
    init_requiredRelationship();
    init_trackingFields();
    PaymentEvent = (0, import_core27.list)({
      access: {
        operation: {
          query: permissions.canReadPayments,
          create: import_access44.denyAll,
          update: import_access44.denyAll,
          delete: import_access44.denyAll
        }
      },
      ui: {
        hideCreate: true,
        hideDelete: true,
        itemView: { defaultFieldMode: "read" },
        listView: { initialColumns: ["providerCode", "eventType", "status", "processedAt"] }
      },
      fields: {
        replayKey: (0, import_fields28.text)({ isIndexed: "unique", validation: { isRequired: true } }),
        providerCode: (0, import_fields28.text)({ validation: { isRequired: true } }),
        providerEventId: (0, import_fields28.text)({ validation: { isRequired: true } }),
        eventType: (0, import_fields28.text)({ validation: { isRequired: true } }),
        payloadHash: (0, import_fields28.text)({ validation: { isRequired: true } }),
        status: (0, import_fields28.select)({
          type: "string",
          options: [
            { label: "Processed", value: "processed" },
            { label: "Ignored", value: "ignored" }
          ],
          validation: { isRequired: true }
        }),
        processedAt: (0, import_fields28.timestamp)({ defaultValue: { kind: "now" } }),
        store: requiredStoreRelationship("StoreSetting.paymentEvents"),
        order: (0, import_fields28.relationship)({ ref: "CafeOrder.paymentEvents" }),
        payment: (0, import_fields28.relationship)({ ref: "Payment.events" }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/PaymentProvider.ts
var import_core28, import_access46, import_fields29, PaymentProvider;
var init_PaymentProvider = __esm({
  "features/keystone/models/PaymentProvider.ts"() {
    "use strict";
    import_core28 = require("@keystone-6/core");
    import_access46 = require("@keystone-6/core/access");
    import_fields29 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    PaymentProvider = (0, import_core28.list)({
      access: {
        operation: {
          query: ({ session }) => permissions.canReadPayments({ session }) || permissions.canManagePayments({ session }),
          create: permissions.canManagePayments,
          update: permissions.canManagePayments,
          delete: permissions.canManagePayments
        }
      },
      ui: { listView: { initialColumns: ["name", "code", "isInstalled"] } },
      fields: {
        name: (0, import_fields29.text)({ validation: { isRequired: true } }),
        code: (0, import_fields29.text)({
          isIndexed: "unique",
          validation: {
            isRequired: true,
            match: {
              regex: /^pp_[a-zA-Z0-9-_]+$/,
              explanation: 'Payment provider code must start with "pp_" followed by alphanumeric characters, hyphens or underscores'
            }
          },
          ui: { description: "Must match a server-owned static payment adapter code" }
        }),
        isInstalled: (0, import_fields29.checkbox)({ defaultValue: false }),
        metadata: (0, import_fields29.json)({
          defaultValue: {},
          ui: { description: "Non-secret display/configuration metadata only. Credentials are read from environment variables." }
        }),
        // Payments are linked from the payment side; the inverse is not a second writer of payment evidence.
        paymentRecords: (0, import_fields29.relationship)({ ref: "Payment.paymentProvider", many: true, access: { create: import_access46.denyAll, update: import_access46.denyAll }, ui: { itemView: { fieldMode: "read" } } }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/InventoryItem.ts
var import_core29, import_fields30, InventoryItem;
var init_InventoryItem = __esm({
  "features/keystone/models/InventoryItem.ts"() {
    "use strict";
    import_core29 = require("@keystone-6/core");
    import_fields30 = require("@keystone-6/core/fields");
    init_access();
    init_requiredRelationship();
    init_trackingFields();
    InventoryItem = (0, import_core29.list)({
      access: {
        operation: {
          query: permissions.canReadInventory,
          create: permissions.canManageInventory,
          update: permissions.canManageInventory,
          delete: permissions.canManageInventory
        }
      },
      hooks: {
        validateInput: async ({ operation, resolvedData, item, context, addValidationError }) => {
          if (operation !== "update" || !item) return;
          if (resolvedData.store !== void 0) addValidationError("Inventory item store ownership is immutable");
          if (resolvedData.unit !== void 0 && resolvedData.unit !== item.unit) {
            const where = { inventoryItemId: item.id };
            const [lots, movements, purchaseOrders, ingredients] = await Promise.all([
              context.prisma.inventoryLot.count({ where }),
              context.prisma.stockMovement.count({ where }),
              context.prisma.purchaseOrder.count({ where }),
              context.prisma.ingredient.count({ where })
            ]);
            if (Number(item.currentStock ?? 0) !== 0 || lots || movements || purchaseOrders || ingredients) {
              addValidationError("The unit can't change once this item has stock, lots, purchase orders or recipe ingredients. Create a new inventory item for the new unit.");
            }
          }
        }
      },
      ui: { listView: { initialColumns: ["name", "category", "currentStock", "unit", "reorderPoint"] } },
      fields: {
        name: (0, import_fields30.text)({ validation: { isRequired: true } }),
        store: requiredStoreRelationship("StoreSetting.inventoryItems"),
        category: (0, import_fields30.select)({
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
        unit: (0, import_fields30.select)({
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
        // Stock changes only through receiving, prep, sales and waste, each with a stock movement.
        currentStock: (0, import_fields30.decimal)({ defaultValue: "0", access: { create: () => false, update: () => false }, ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } } }),
        reorderPoint: (0, import_fields30.decimal)({ defaultValue: "0" }),
        parLevel: (0, import_fields30.decimal)({ defaultValue: "0" }),
        costPerUnit: (0, import_fields30.integer)({ defaultValue: 0, validation: { min: 0 }, ui: { description: "Cost in cents" } }),
        supplierName: (0, import_fields30.text)(),
        sku: (0, import_fields30.text)(),
        menuItems: (0, import_fields30.relationship)({ ref: "MenuItem.inventoryItem", many: true }),
        stockMovements: (0, import_fields30.relationship)({ ref: "StockMovement.inventoryItem", many: true, access: { create: () => false, update: () => false }, ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } } }),
        inventoryLots: (0, import_fields30.relationship)({ ref: "InventoryLot.inventoryItem", many: true, access: { create: () => false, update: () => false }, ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } } }),
        purchaseOrders: (0, import_fields30.relationship)({ ref: "PurchaseOrder.inventoryItem", many: true, access: { create: () => false, update: () => false }, ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } } }),
        wasteLogs: (0, import_fields30.relationship)({ ref: "WasteLog.inventoryItem", many: true, access: { create: () => false, update: () => false }, ui: { createView: { fieldMode: "hidden" }, itemView: { fieldMode: "read" } } }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/StockMovement.ts
var import_core30, import_access49, import_fields31, StockMovement;
var init_StockMovement = __esm({
  "features/keystone/models/StockMovement.ts"() {
    "use strict";
    import_core30 = require("@keystone-6/core");
    import_access49 = require("@keystone-6/core/access");
    import_fields31 = require("@keystone-6/core/fields");
    init_access();
    init_requiredRelationship();
    init_trackingFields();
    StockMovement = (0, import_core30.list)({
      access: {
        operation: {
          query: permissions.canReadInventory,
          create: import_access49.denyAll,
          update: import_access49.denyAll,
          delete: import_access49.denyAll
        }
      },
      ui: {
        hideCreate: true,
        hideDelete: true,
        itemView: { defaultFieldMode: "read" },
        listView: { initialColumns: ["inventoryItem", "type", "quantity", "reason"] }
      },
      fields: {
        idempotencyKey: (0, import_fields31.text)({ isIndexed: "unique", db: { isNullable: true }, access: { read: permissions.canManageInventory, create: () => false, update: () => false } }),
        type: (0, import_fields31.select)({
          type: "string",
          options: [
            { label: "Received", value: "received" },
            { label: "Sale", value: "sale" },
            { label: "Return / release", value: "return" },
            { label: "Waste", value: "waste" },
            { label: "Adjustment", value: "adjustment" },
            { label: "Transfer", value: "transfer" }
          ],
          defaultValue: "adjustment"
        }),
        quantity: (0, import_fields31.decimal)({ validation: { isRequired: true } }),
        reason: (0, import_fields31.text)(),
        notes: (0, import_fields31.text)({ ui: { displayMode: "textarea" } }),
        store: requiredStoreRelationship("StoreSetting.stockMovements"),
        inventoryItem: requiredRelationship("InventoryItem.stockMovements", "inventoryItem", "InventoryItem"),
        order: (0, import_fields31.relationship)({ ref: "CafeOrder.stockMovements" }),
        purchaseOrder: (0, import_fields31.relationship)({ ref: "PurchaseOrder.stockMovements" }),
        inventoryLot: (0, import_fields31.relationship)({ ref: "InventoryLot.stockMovements" }),
        prepBatch: (0, import_fields31.relationship)({ ref: "PrepBatch.stockMovements" }),
        wasteLog: (0, import_fields31.relationship)({ ref: "WasteLog.stockMovements" }),
        createdBy: (0, import_fields31.relationship)({ ref: "User" }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/LoyaltyAccount.ts
var import_core31, import_access51, import_fields32, LoyaltyAccount;
var init_LoyaltyAccount = __esm({
  "features/keystone/models/LoyaltyAccount.ts"() {
    "use strict";
    import_core31 = require("@keystone-6/core");
    import_access51 = require("@keystone-6/core/access");
    import_fields32 = require("@keystone-6/core/fields");
    init_access();
    init_requiredRelationship();
    init_trackingFields();
    LoyaltyAccount = (0, import_core31.list)({
      access: {
        operation: {
          query: permissions.canReadLoyalty,
          create: import_access51.denyAll,
          update: import_access51.denyAll,
          delete: import_access51.denyAll
        }
      },
      ui: { hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: "read" }, listView: { initialColumns: ["customerName", "customerEmail", "status", "pointsBalance", "drinkCredits", "tier"] } },
      fields: {
        store: requiredStoreRelationship("StoreSetting.loyaltyAccounts"),
        customerName: (0, import_fields32.text)({ ui: { description: "Guest-facing name for loyalty lookup when no user account is attached" } }),
        customerEmail: (0, import_fields32.text)({ isIndexed: "unique", ui: { description: "Email used for pickup loyalty lookup" } }),
        customerPhone: (0, import_fields32.text)(),
        marketingOptIn: (0, import_fields32.checkbox)({ defaultValue: false }),
        status: (0, import_fields32.select)({
          type: "string",
          options: [
            { label: "Active", value: "active" },
            { label: "Paused", value: "paused" },
            { label: "Closed", value: "closed" }
          ],
          defaultValue: "active"
        }),
        tier: (0, import_fields32.select)({
          type: "string",
          options: [
            { label: "Regular", value: "regular" },
            { label: "Neighborhood", value: "neighborhood" },
            { label: "House Account", value: "house_account" }
          ],
          defaultValue: "regular"
        }),
        pointsBalance: (0, import_fields32.integer)({ defaultValue: 0 }),
        lifetimePoints: (0, import_fields32.integer)({ defaultValue: 0 }),
        drinkCredits: (0, import_fields32.integer)({ defaultValue: 0 }),
        visits: (0, import_fields32.integer)({ defaultValue: 0 }),
        lastVisitAt: (0, import_fields32.timestamp)(),
        firstVisitAt: (0, import_fields32.timestamp)(),
        notes: (0, import_fields32.text)({ ui: { displayMode: "textarea" } }),
        customer: (0, import_fields32.relationship)({ ref: "User.loyaltyAccount" }),
        orders: (0, import_fields32.relationship)({ ref: "CafeOrder.loyaltyAccount", many: true }),
        events: (0, import_fields32.relationship)({ ref: "LoyaltyEvent.account", many: true }),
        displayName: (0, import_fields32.virtual)({
          field: import_core31.graphql.field({
            type: import_core31.graphql.String,
            resolve(item) {
              return typeof item.customerName === "string" && item.customerName ? item.customerName : typeof item.customerEmail === "string" && item.customerEmail ? item.customerEmail : "Guest account";
            }
          })
        }),
        nextRewardProgress: (0, import_fields32.virtual)({
          field: import_core31.graphql.field({
            type: import_core31.graphql.Int,
            resolve(item) {
              const pointsBalance = typeof item.pointsBalance === "number" ? item.pointsBalance : 0;
              return Math.min(100, Math.floor((pointsBalance || 0) % 100 / 100 * 100));
            }
          })
        }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/LoyaltyEvent.ts
var import_core32, import_access53, import_fields33, LoyaltyEvent;
var init_LoyaltyEvent = __esm({
  "features/keystone/models/LoyaltyEvent.ts"() {
    "use strict";
    import_core32 = require("@keystone-6/core");
    import_access53 = require("@keystone-6/core/access");
    import_fields33 = require("@keystone-6/core/fields");
    init_access();
    init_trackingFields();
    LoyaltyEvent = (0, import_core32.list)({
      access: {
        operation: {
          query: permissions.canReadLoyalty,
          create: import_access53.denyAll,
          update: import_access53.denyAll,
          delete: import_access53.denyAll
        }
      },
      ui: { hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: "read" }, listView: { initialColumns: ["account", "type", "pointsDelta", "drinkCreditsDelta", "order"] } },
      fields: {
        type: (0, import_fields33.select)({
          type: "string",
          options: [
            { label: "Earned", value: "earned" },
            { label: "Redeemed", value: "redeemed" },
            { label: "Manual Adjustment", value: "manual_adjustment" },
            { label: "Refund Reversal", value: "refund_reversal" },
            { label: "Signup", value: "signup" }
          ],
          defaultValue: "earned"
        }),
        pointsDelta: (0, import_fields33.integer)({ defaultValue: 0 }),
        drinkCreditsDelta: (0, import_fields33.integer)({ defaultValue: 0 }),
        note: (0, import_fields33.text)({ ui: { displayMode: "textarea" } }),
        account: (0, import_fields33.relationship)({ ref: "LoyaltyAccount.events" }),
        order: (0, import_fields33.relationship)({ ref: "CafeOrder.loyaltyEvents" }),
        createdBy: (0, import_fields33.relationship)({ ref: "User" }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/GiftCard.ts
function dollars(cents2) {
  return `$${(Number(cents2 || 0) / 100).toFixed(2)}`;
}
var import_core33, import_access55, import_fields34, GiftCard;
var init_GiftCard = __esm({
  "features/keystone/models/GiftCard.ts"() {
    "use strict";
    import_core33 = require("@keystone-6/core");
    import_access55 = require("@keystone-6/core/access");
    import_fields34 = require("@keystone-6/core/fields");
    init_access();
    init_requiredRelationship();
    init_trackingFields();
    GiftCard = (0, import_core33.list)({
      access: {
        operation: { query: permissions.canReadPayments, create: import_access55.denyAll, update: import_access55.denyAll, delete: import_access55.denyAll }
      },
      ui: { hideCreate: true, hideDelete: true, itemView: { defaultFieldMode: "read" }, listView: { initialColumns: ["code", "status", "amountLoaded", "balanceLeft", "recipientName", "expiresAt"] } },
      fields: {
        store: requiredStoreRelationship("StoreSetting.giftCards"),
        code: (0, import_fields34.text)({ isIndexed: "unique", validation: { isRequired: true } }),
        status: (0, import_fields34.select)({
          type: "string",
          options: [
            { label: "Awaiting payment", value: "pending" },
            { label: "Active", value: "active" },
            { label: "Used up", value: "redeemed" },
            { label: "Cancelled", value: "cancelled" }
          ],
          defaultValue: "pending"
        }),
        // Stored in cents for the ledger; staff read the dollar amounts below.
        initialValue: (0, import_fields34.integer)({ validation: { isRequired: true, min: 0 }, ui: { itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } } }),
        balance: (0, import_fields34.integer)({ validation: { isRequired: true, min: 0 }, ui: { itemView: { fieldMode: "hidden" }, listView: { fieldMode: "hidden" } } }),
        amountLoaded: (0, import_fields34.virtual)({ label: "Amount loaded", field: import_core33.graphql.field({ type: import_core33.graphql.String, resolve: (item) => dollars(item.initialValue) }) }),
        balanceLeft: (0, import_fields34.virtual)({ label: "Balance", field: import_core33.graphql.field({ type: import_core33.graphql.String, resolve: (item) => dollars(item.balance) }) }),
        currencyCode: (0, import_fields34.text)({ defaultValue: "USD" }),
        purchaserName: (0, import_fields34.text)(),
        purchaserEmail: (0, import_fields34.text)(),
        recipientName: (0, import_fields34.text)(),
        recipientEmail: (0, import_fields34.text)(),
        message: (0, import_fields34.text)({ ui: { displayMode: "textarea" } }),
        providerPaymentId: (0, import_fields34.text)({ isIndexed: true, access: { read: permissions.canManagePayments } }),
        refundedAt: (0, import_fields34.timestamp)(),
        expiresAt: (0, import_fields34.timestamp)(),
        activatedAt: (0, import_fields34.timestamp)(),
        emailedAt: (0, import_fields34.timestamp)(),
        ledger: (0, import_fields34.json)({ defaultValue: [] }),
        ...trackingFields
      }
    });
  }
});

// features/keystone/models/index.ts
function hiddenWithoutReadAccess(lists) {
  for (const [listKey, config2] of Object.entries(lists)) {
    const access = config2.access;
    const operation = access?.operation;
    const query5 = typeof operation === "function" ? operation : operation?.query;
    if (!query5 || config2.ui?.isHidden !== void 0) continue;
    config2.ui = { ...config2.ui, isHidden: async ({ session, context }) => !await query5({ session, context, listKey, operation: "query" }) };
  }
  return lists;
}
var models;
var init_models = __esm({
  "features/keystone/models/index.ts"() {
    "use strict";
    init_CoffeeCommandReceipt();
    init_WasteLog();
    init_CateringOrder();
    init_Subscription();
    init_PosOrder();
    init_RegisterShift();
    init_CashMovement();
    init_StaffShift();
    init_PrepBatch();
    init_PrepBatchConsumption();
    init_PurchaseOrder();
    init_Supplier();
    init_InventoryLot();
    init_Ingredient();
    init_Recipe();
    init_User();
    init_Role();
    init_MenuCategory();
    init_StoreSettings();
    init_MenuItem();
    init_MenuItemImage();
    init_MenuItemModifier();
    init_CafeOrder();
    init_OrderItem();
    init_Payment();
    init_PaymentEvent();
    init_PaymentProvider();
    init_InventoryItem();
    init_StockMovement();
    init_LoyaltyAccount();
    init_LoyaltyEvent();
    init_GiftCard();
    models = hiddenWithoutReadAccess({
      User,
      Role,
      StoreSetting,
      MenuCategory,
      MenuItem,
      MenuItemImage,
      MenuItemModifier,
      CafeOrder,
      OrderItem,
      Payment,
      PaymentEvent,
      PaymentProvider,
      InventoryItem,
      StockMovement,
      LoyaltyAccount,
      LoyaltyEvent,
      GiftCard,
      CoffeeCommandReceipt,
      WasteLog,
      CateringOrder,
      Subscription,
      PosOrder,
      RegisterShift,
      CashMovement,
      StaffShift,
      PrepBatch,
      PrepBatchConsumption,
      PurchaseOrder,
      Supplier,
      InventoryLot,
      Ingredient,
      Recipe
    });
  }
});

// features/keystone/revocableSession.ts
function revocableStatelessSessions(options) {
  const base = (0, import_session.statelessSessions)(options);
  return {
    ...base,
    async get({ context }) {
      const session = await base.get({ context });
      if (!session || session.listKey !== "User" || !session.itemId) return session;
      try {
        const current = await context.prisma.user.findUnique({ where: { id: session.itemId }, select: { id: true } });
        return current ? session : void 0;
      } catch {
        return void 0;
      }
    }
  };
}
var import_session;
var init_revocableSession = __esm({
  "features/keystone/revocableSession.ts"() {
    "use strict";
    import_session = require("@keystone-6/core/session");
  }
});

// features/keystone/mutations/coffeeCustomerAccount.ts
async function registerCoffeeCustomer(_root, args, context) {
  const input = registration.safeParse(args);
  if (!input.success || context.session) return false;
  const store = await context.prisma.storeSetting.findUnique({ where: { singletonKey: "primary" }, select: { id: true } });
  if (!store) return false;
  try {
    await context.sudo().db.User.createOne({ data: { ...input.data, onboardingStatus: "dismissed" } });
    return true;
  } catch {
    return false;
  }
}
async function getCoffeeCustomerOrders(_root, args, context) {
  const customerId = context.session?.listKey === "User" ? context.session.itemId : null;
  if (!customerId) throw new Error("Sign in to view orders");
  let anchor;
  if (args.after) {
    if (args.after.length > 200) throw new Error("Invalid order cursor");
    anchor = await context.prisma.cafeOrder.findFirst({ where: { id: args.after, customerId }, select: { id: true, createdAt: true } });
    if (!anchor) throw new Error("Invalid order cursor");
  }
  const rows = await context.prisma.cafeOrder.findMany({
    where: {
      customerId,
      ...anchor ? { OR: [{ createdAt: { lt: anchor.createdAt } }, { createdAt: anchor.createdAt, id: { lt: anchor.id } }] } : {}
    },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 21,
    select: { id: true, orderNumber: true, status: true, total: true, currencyCode: true, createdAt: true }
  });
  return { orders: rows.slice(0, 20), nextCursor: rows.length > 20 ? rows[19].id : null };
}
async function updateCoffeeCustomerProfile(_root, args, context) {
  const customerId = context.session?.listKey === "User" ? String(context.session.itemId) : null;
  if (!customerId) throw new Error("Sign in to edit your profile");
  const input = profile.safeParse(args);
  if (!input.success) throw new Error("Enter a name and a valid phone number");
  await context.db.User.updateOne({ where: { id: customerId }, data: { name: input.data.name, phone: input.data.phone || "" } });
  return true;
}
var import_zod2, registration, profile;
var init_coffeeCustomerAccount = __esm({
  "features/keystone/mutations/coffeeCustomerAccount.ts"() {
    "use strict";
    import_zod2 = require("zod");
    registration = import_zod2.z.object({
      name: import_zod2.z.string().trim().min(1).max(200),
      email: import_zod2.z.string().trim().toLowerCase().email().max(320),
      password: import_zod2.z.string().min(12).max(128)
    }).strict();
    profile = import_zod2.z.object({
      name: import_zod2.z.string().trim().min(1).max(200),
      phone: import_zod2.z.string().trim().max(50).regex(/^[+\d\s().-]*$/).nullish()
    }).strict();
  }
});

// features/keystone/mutations/coffeeBoundarySchema.ts
var coffeeBoundaryTypeDefs;
var init_coffeeBoundarySchema = __esm({
  "features/keystone/mutations/coffeeBoundarySchema.ts"() {
    "use strict";
    coffeeBoundaryTypeDefs = String.raw`
  type CoffeeNamedRef { id: ID name: String }
  type CoffeeStatusAction { status: String! label: String! tone: String! }

  type CoffeeMenuCategoryProjection {
    id: ID!
    name: String!
    description: String
    active: Boolean
    sortOrder: Int
  }
  type CoffeeMenuModifierProjection {
    id: ID!
    name: String!
    modifierGroup: String
    modifierGroupLabel: String
    priceAdjustment: Int!
    required: Boolean
    minSelections: Int
    maxSelections: Int
    defaultSelected: Boolean
    inStock: Boolean!
  }
  type CoffeeMenuItemProjection {
    id: ID!
    name: String!
    shortDescription: String
    price: Int!
    available: Boolean!
    maxQuantity: Int
    availability: String
    featured: Boolean
    popular: Boolean
    imageUrl: String
    primaryImageUrl: String
    prepTimeMinutes: Int
    caffeineMg: Int
    barStation: String
    temperatureOptions: [String!]!
    dietaryFlags: [String!]!
    category: CoffeeNamedRef
    modifiers: [CoffeeMenuModifierProjection!]!
  }
  type CoffeeMenuProjection {
    categories: [CoffeeMenuCategoryProjection!]!
    items: [CoffeeMenuItemProjection!]!
    item: CoffeeMenuItemProjection
    nextCursor: String
    hasUncategorized: Boolean
  }
  type CoffeeMenuInventoryOption { id: ID! name: String! unit: String }
  type CoffeeMenuInventoryOptions { items: [CoffeeMenuInventoryOption!]! hasMore: Boolean! }
  type CoffeeManagedMenuModifier {
    id: ID!
    name: String!
    modifierGroup: String!
    modifierGroupLabel: String
    priceAdjustment: Int!
    required: Boolean!
    minSelections: Int!
    maxSelections: Int!
    defaultSelected: Boolean!
    inStock: Boolean!
    stockOut: Boolean
    updatedAt: String!
    inventoryAction: String
    inventoryQuantity: Float
    inventoryItem: CoffeeMenuInventoryOption
    replacesInventoryItem: CoffeeMenuInventoryOption
  }
  type CoffeeManagedMenuItem {
    id: ID!
    name: String!
    shortDescription: String
    price: Int!
    available: Boolean!
    featured: Boolean!
    popular: Boolean!
    prepTimeMinutes: Int
    barStation: String
    updatedAt: String!
    category: CoffeeNamedRef
    soldOut: Boolean
    modifiers: [CoffeeManagedMenuModifier!]!
    modifiersHasMore: Boolean!
  }
  type CoffeeManagedMenuStats { items: Int! hidden: Int! modifiersOut: Int! }
  type CoffeeManagedMenuProjection {
    canManageProducts: Boolean!
    categories: [CoffeeMenuCategoryProjection!]!
    categoriesHasMore: Boolean!
    matchingCount: Int!
    stats: CoffeeManagedMenuStats!
    hasMore: Boolean!
    nextCursor: String
    items: [CoffeeManagedMenuItem!]!
  }

  type CafeModifierSnapshotProjection {
    id: ID!
    name: String!
    group: String!
    groupLabel: String!
    priceAdjustment: Int!
  }
  type CafeOrderItemProjection {
    id: ID!
    quantity: Int!
    itemNameSnapshot: String
    imagePathSnapshot: String
    customizationsSummary: String
    modifierSnapshot: [CafeModifierSnapshotProjection!]!
    specialInstructions: String
    price: Int!
    barStatus: String
    station: String
  }
  type CafeOrderProjection {
    id: ID!
    orderNumber: String!
    status: String!
    handoffCode: String
    pickupName: String
    promisedAt: String
    subtotal: Int!
    tax: Int!
    tip: Int
    total: Int!
    currencyCode: String!
    specialInstructions: String
    paidAt: String
    customerEmail: String
    rewardsLinked: Boolean!
    rewardsEligible: Boolean!
    orderItems: [CafeOrderItemProjection!]!
  }
  type CafeCateringReceipt {
    id: ID!
    cateringNumber: String!
    status: String!
    eventAt: String
    guestCount: Int!
    deliveryAddress: String
    quotedCents: Int
    createdAt: String!
  }

  type CafeOrderReceipt {
    id: ID!
    orderNumber: String!
    status: String!
    handoffCode: String
    pickupName: String
    promisedAt: String
    subtotal: Int!
    tax: Int!
    tip: Int
    total: Int!
    currencyCode: String!
    secretKey: String!
    orderItems: [CafeOrderItemProjection!]!
  }
  type CafeLoyaltyProjection {
    id: ID!
    customerName: String
    customerEmail: String
    customerPhone: String
    status: String
    tier: String
    pointsBalance: Int!
    lifetimePoints: Int
    drinkCredits: Int!
    visits: Int
    lastVisitAt: String
    nextRewardProgress: Int
  }

  type CoffeeOrderQueueSummary {
    allCount: Int!
    activeCount: Int!
    openCount: Int!
    acceptedCount: Int!
    paidCount: Int!
    queuedCount: Int!
    preparingCount: Int!
    readyCount: Int!
    completedCount: Int!
    cancelledCount: Int!
    refundedCount: Int!
  }
  type CoffeeOrderQueueFilters {
    status: String!
    fulfillment: String!
  }
  type CoffeeRefundablePaymentProjection {
    id: ID!
    status: String!
    method: String!
    provider: String
    amount: Int!
    refundedAmount: Int
  }

  type CoffeeOrderQueueCapabilities {
    canManageOrders: Boolean!
    canManagePayments: Boolean!
    canManageLoyalty: Boolean!
  }
  type CoffeeOrderQueueTicket {
    id: ID!
    orderNumber: String!
    status: String!
    fulfillmentType: String
    orderSource: String
    customerName: String
    customerEmail: String
    pickupName: String
    promisedAt: DateTime
    total: Int!
    isRush: Boolean
    orderItems: [CafeOrderItemProjection!]!
    paymentState: String
    canRecordPayment: Boolean!
    isStale: Boolean!
    canApplyLoyalty: Boolean!
    loyaltyApplied: Boolean
    refundablePayments: [CoffeeRefundablePaymentProjection!]!
    actions: [CoffeeStatusAction!]!
  }
  type CoffeeDayCloseReport {
    closedAt: String!
    storeDay: String!
    completed: Int!
    cancelled: Int!
    noShow: Int!
    skipped: Int!
    orderNumbers: [String!]!
  }
  type CoffeeOrderQueueProjection {
    summary: CoffeeOrderQueueSummary!
    capabilities: CoffeeOrderQueueCapabilities!
    filters: CoffeeOrderQueueFilters!
    storeTimezone: String
    activeCount: Int!
    activeHasMore: Boolean!
    activeNextCursor: String
    staleCount: Int!
    lastDayClose: CoffeeDayCloseReport
    historyCount: Int!
    historyHasMore: Boolean!
    historyNextCursor: String
    tickets: [CoffeeOrderQueueTicket!]!
  }
  type CoffeeKdsOrderRef {
    id: ID!
    orderNumber: String!
    status: String!
    pickupName: String
    promisedAt: DateTime
    isRush: Boolean
  }
  type CoffeeKdsItemProjection {
    id: ID!
    quantity: Int!
    itemNameSnapshot: String
    customizationsSummary: String
    specialInstructions: String
    barStatus: String!
    station: String
    queuedAt: DateTime
    startedAt: DateTime
    readyAt: DateTime
    order: CoffeeKdsOrderRef!
    nextAction: CoffeeStatusAction
  }
  type CoffeeKdsProjection {
    activeCount: Int!
    scheduledCount: Int!
    nextScheduledAt: String
    canManageOrders: Boolean!
    storeTimezone: String
    hasMore: Boolean!
    nextCursor: String
    items: [CoffeeKdsItemProjection!]!
  }

  type CoffeeRegisterShiftProjection {
    id: ID!
    shiftNumber: String!
    registerName: String
    status: String!
    openingCashCents: Int
    cashSalesCents: Int
    cardSalesCents: Int
    tipsCents: Int
    payInsCents: Int
    payOutsCents: Int
    expectedCashCents: Int
    openedAt: DateTime
  }
  type CoffeePosProjection {
    operatorId: ID!
    storeId: ID!
    items: [CoffeeMenuItemProjection!]!
    hasMore: Boolean!
    nextCursor: String
    categories: [CoffeeNamedRef!]!
    openShift: CoffeeRegisterShiftProjection
  }
  type CafeOrderQuoteLine {
    index: Int!
    menuItemId: ID!
    name: String!
    quantity: Int!
    unitPrice: Int!
    lineTotal: Int!
  }
  type CafeOrderQuote {
    subtotal: Int!
    tax: Int!
    tip: Int!
    total: Int!
    currencyCode: String!
    quoteFingerprint: String!
    estimatedPickupMinutes: Int!
    lines: [CafeOrderQuoteLine!]!
  }

  type CoffeeReportPeriod { period: String! startDate: String! endDate: String! timezone: String! timezoneConfigured: Boolean! }
  type CoffeeItemPerformance { key: String! menuItemId: ID name: String! quantity: Int! revenueCents: Float! }
  type CoffeeStationLoad { station: String! quantity: Int! }
  type CoffeeSalesReport {
    orderCount: Int!
    completedCount: Int!
    cancelledCount: Int!
    completionRatePercent: Int!
    grossSalesCents: Float!
    taxCents: Float!
    tipCents: Float!
    discountCents: Float!
    averageFulfillmentMinutes: Int
    fulfillmentSampleCount: Int!
    openTicketCount: Int!
    readyTicketCount: Int!
    topItems: [CoffeeItemPerformance!]!
    topItemsTruncated: Boolean!
    stationProduction: [CoffeeStationLoad!]!
  }
  type CoffeeCollectionsReport {
    currencyCode: String
    currencyMismatch: Boolean!
    paymentCount: Int!
    grossCollectedCents: Float
    refundedCents: Float
    netCollectedCents: Float
    needsReviewCount: Int!
  }
  type CoffeeLowStockItem {
    id: ID!
    name: String!
    category: String
    unit: String
    currentStock: Float!
    reorderPoint: Float!
    parLevel: Float!
    supplierName: String
  }
  type CoffeeLowStockReport { totalCount: Int! page: Int! pageSize: Int! items: [CoffeeLowStockItem!]! }
  type CoffeeLoyaltyReportAccount {
    id: ID!
    customerName: String
    customerEmail: String
    tier: String
    lifetimePoints: Int
    drinkCredits: Int
    lastVisitAt: DateTime
  }
  type CoffeeLoyaltyReport {
    accountCount: Int!
    totalVisits: Int!
    outstandingDrinkCredits: Int!
    topAccounts: [CoffeeLoyaltyReportAccount!]!
  }
  type CoffeeReportsProjection {
    storeTimezone: String
    period: CoffeeReportPeriod!
    sales: CoffeeSalesReport
    collections: CoffeeCollectionsReport
    lowStock: CoffeeLowStockReport
    loyalty: CoffeeLoyaltyReport
  }

  type CoffeeRecipeProjection { id: ID! name: String! status: String! yieldQuantity: Float yieldUnit: String active: Boolean! menuItem: CoffeeNamedRef }
  type CoffeeIngredientProjection { id: ID! name: String! quantity: Float unit: String optional: Boolean! recipe: CoffeeNamedRef inventoryItem: CoffeeNamedRef }
  type CoffeeInventoryLotProjection { id: ID! lotNumber: String! quantityReceived: Float quantityRemaining: Float unitCostCents: Int status: String! expiresAt: DateTime inventoryItem: CoffeeNamedRef supplier: CoffeeNamedRef }
  type CoffeeSupplierProjection { id: ID! name: String! status: String! contactName: String email: String phone: String leadTimeDays: Int }
  type CoffeePurchaseOrderProjection { id: ID! poNumber: String! status: String! subtotalCents: Int expectedAt: DateTime supplier: CoffeeNamedRef }
  type CoffeeInventoryUnitRef { id: ID name: String unit: String }
  type CoffeeReceiptPurchaseOrder { id: ID! poNumber: String! status: String! subtotalCents: Int expectedAt: DateTime orderedQuantity: Float unitCostCents: Int supplier: CoffeeNamedRef inventoryItem: CoffeeInventoryUnitRef }
  type CoffeeReceiptPurchaseOrderPage { items: [CoffeeReceiptPurchaseOrder!]! hasMore: Boolean! nextCursor: String loadError: Boolean! }
  type CoffeeOperationsOption { id: ID! name: String! detail: String unit: String currentStock: Float }
  type CoffeeOperationsOptionPage { items: [CoffeeOperationsOption!]! hasMore: Boolean! nextCursor: String loadError: Boolean! }
  type CoffeePrepBatchProjection { id: ID! batchNumber: String! status: String! quantityMade: Float recipe: CoffeeNamedRef preparedBy: CoffeeNamedRef expiresAt: DateTime }
  type CoffeeStaffRef { id: ID name: String email: String }
  type CoffeeStaffShiftProjection { id: ID! shiftNumber: String! role: String! status: String! startsAt: DateTime endsAt: DateTime clockInAt: DateTime clockOutAt: DateTime staff: CoffeeStaffRef actions: [CoffeeStatusAction!]! }
  type CoffeeStaffShiftPage { items: [CoffeeStaffShiftProjection!]! hasMore: Boolean! nextCursor: String loadError: Boolean! totalCount: Int }
  type CoffeePosOrderProjection { id: ID! receiptNumber: String! registerName: String status: String! subtotalCents: Int taxCents: Int tipCents: Int totalCents: Int cashier: CoffeeNamedRef }
  type CoffeeSubscriptionProjection { id: ID! subscriptionNumber: String! status: String! planName: String! billingInterval: String! priceCents: Int renewsAt: DateTime actions: [CoffeeStatusAction!]! }
  type CoffeeCateringProjection { id: ID! cateringNumber: String! customerName: String! customerEmail: String status: String! eventAt: DateTime guestCount: Int subtotalCents: Int actions: [CoffeeStatusAction!]! }
  type CoffeeWasteProjection { id: ID! logNumber: String! reason: String! quantity: Float unit: String costCents: Int inventoryItem: CoffeeNamedRef prepBatch: CoffeePrepBatchRef }
  type CoffeePrepBatchRef { batchNumber: String! }
  type CoffeeOperationsSections { inventory: Boolean! inventoryManage: Boolean! products: Boolean! staffing: Boolean! payments: Boolean! catering: Boolean! subscriptions: Boolean! }
  type CoffeeOperationsProjection {
    sections: CoffeeOperationsSections!
    storeTimezone: String
    draftScope: String!
    recipes: [CoffeeRecipeProjection!]!
    ingredients: [CoffeeIngredientProjection!]!
    inventoryLots: [CoffeeInventoryLotProjection!]!
    suppliers: [CoffeeSupplierProjection!]!
    purchaseOrders: [CoffeePurchaseOrderProjection!]!
    prepBatches: [CoffeePrepBatchProjection!]!
    wasteLogs: [CoffeeWasteProjection!]!
    posOrders: [CoffeePosOrderProjection!]!
    subscriptions: [CoffeeSubscriptionProjection!]!
    cateringOrders: [CoffeeCateringProjection!]!
    recentStaffShifts: [CoffeeStaffShiftProjection!]!
    receiptPurchaseOrders: CoffeeReceiptPurchaseOrderPage!
    purchaseSuppliers: CoffeeOperationsOptionPage!
    purchaseInventoryItems: CoffeeOperationsOptionPage!
    inventoryWasteItems: CoffeeOperationsOptionPage!
    wastePrepBatches: CoffeeOperationsOptionPage!
    prepRecipes: CoffeeOperationsOptionPage!
    staffMembers: CoffeeOperationsOptionPage!
    activeStaffShifts: CoffeeStaffShiftPage!
  }

  extend type Query {
    getCoffeeOrderQueue(search: String, status: String, fulfillment: String, includeCompleted: Boolean = true, activeCursor: String, historyCursor: String): CoffeeOrderQueueProjection!
    getCoffeeKdsBoard(cursor: String, limit: Int = 100): CoffeeKdsProjection!
    getCoffeeMenuManager(search: String, categoryId: ID, cursor: String, limit: Int = 50): CoffeeManagedMenuProjection!
    getCoffeeMenuInventoryOptions(search: String, limit: Int = 25): CoffeeMenuInventoryOptions!
    getCoffeePosRegister(search: String, categoryId: ID, cursor: String, limit: Int = 48): CoffeePosProjection!
    quoteCafeOrder(items: [CafePickupOrderItemInput!]!, tipCents: Int, requestedPickupMinutes: Int): CafeOrderQuote!
    getCoffeeReports(period: String, startDate: String, endDate: String, lowStockPage: Int): CoffeeReportsProjection!
    getCoffeeOperations(receiptCursor: String, purchaseSupplierSearch: String, purchaseSupplierCursor: String, purchaseInventorySearch: String, purchaseInventoryCursor: String, inventoryWasteSearch: String, inventoryWasteCursor: String, prepBatchSearch: String, prepBatchCursor: String, recipeSearch: String, recipeCursor: String, staffSearch: String, staffCursor: String, shiftCursor: String): CoffeeOperationsProjection!
  }
`;
  }
});

// features/keystone/lib/coffeeCommandReceipt.ts
function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}
function canonicalCoffeeEventJson(payload) {
  return JSON.stringify(canonicalize(payload));
}
function coffeeEventPayloadHash(payload) {
  return (0, import_node_crypto.createHash)("sha256").update(canonicalCoffeeEventJson(payload)).digest("hex");
}
async function getPrimaryCoffeeStoreId(tx) {
  const store = await tx.storeSetting.findUnique({ where: { singletonKey: "primary" }, select: { id: true } });
  if (!store) throw new Error("Primary coffee store is not configured");
  return store.id;
}
function assertCoffeeStoreOwnership(storeId, expectedStoreId, label) {
  if (String(storeId || "") !== expectedStoreId) throw new Error(`${label} does not belong to the active store`);
}
async function recordCoffeeCommandReceipt(tx, input) {
  const canonicalPayload = canonicalCoffeeEventJson(input.payload);
  if (Buffer.byteLength(canonicalPayload) > MAX_PAYLOAD_BYTES) throw new Error("Coffee command receipt payload is too large");
  const payloadHash2 = coffeeEventPayloadHash(input.payload);
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-event:${input.eventKey}`);
  const existing = await tx.coffeeCommandReceipt.findUnique({ where: { eventKey: input.eventKey } });
  if (existing) {
    if (existing.payloadHash !== payloadHash2 || existing.eventType !== input.eventType || existing.storeId !== input.storeId || existing.aggregateType !== input.aggregateType || existing.aggregateId !== input.aggregateId || existing.schemaVersion !== RECEIPT_SCHEMA_VERSION) {
      throw new Error("Coffee event idempotency key was reused with a different snapshot");
    }
    return { eventId: String(existing.id), created: false };
  }
  const receipt = await tx.coffeeCommandReceipt.create({
    data: {
      eventKey: input.eventKey,
      eventType: input.eventType,
      schemaVersion: RECEIPT_SCHEMA_VERSION,
      aggregateType: input.aggregateType,
      aggregateId: input.aggregateId,
      payload: canonicalize(input.payload),
      payloadHash: payloadHash2,
      occurredAt: input.occurredAt || /* @__PURE__ */ new Date(),
      storeId: input.storeId
    }
  });
  return { eventId: String(receipt.id), created: true };
}
var import_node_crypto, RECEIPT_SCHEMA_VERSION, MAX_PAYLOAD_BYTES;
var init_coffeeCommandReceipt = __esm({
  "features/keystone/lib/coffeeCommandReceipt.ts"() {
    "use strict";
    import_node_crypto = require("node:crypto");
    RECEIPT_SCHEMA_VERSION = "1";
    MAX_PAYLOAD_BYTES = 256e3;
  }
});

// features/keystone/mutations/coffeeOrderPolicy.ts
async function lockCoffeeOrder(tx, orderId) {
  if (!orderId) throw new Error("Order id is required");
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-order:${orderId}`);
}
function requireCafeTenderOperator(session) {
  if (!permissions.canManageOrders({ session }) || !permissions.canManagePayments({ session })) {
    throw new Error("Not authorized to record cafe payments");
  }
}
function requireCafeRegisterOperator(session) {
  if (!permissions.canManageOrders({ session })) throw new Error("Not authorized to operate the register");
}
function hasCafeSettlement(payments, payableAmount) {
  const captured = payments.filter((payment) => payment.status === "captured");
  const unresolved = payments.some((payment) => payment.status === "pending" || payment.status === "authorized");
  if (payableAmount === 0) return captured.length === 0 && !unresolved;
  return Number.isSafeInteger(payableAmount) && payableAmount > 0 && captured.length === 1 && !unresolved && !captured[0].refundIdempotencyKey && Number(captured[0].amount) === payableAmount;
}
function assertCafeSettlement(payments, payableAmount) {
  if (!hasCafeSettlement(payments, payableAmount)) throw new Error("Record pay-at-pickup settlement before handing off this order");
}
function assertCafeOrderItemsReadyForHandoff(items) {
  if (!items.length || items.some((item) => !["ready", "handed_off"].includes(String(item.barStatus)))) {
    throw new Error("Every order item must be ready before the whole ticket can be completed");
  }
}
function validateCafeOrderLines(items) {
  if (!items.length || items.length > 50) throw new Error("Order must include between 1 and 50 line items");
  for (const item of items) {
    if (!item?.menuItemId || !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 50) throw new Error("Order line quantity must be an integer between 1 and 50");
    const modifiers = item.modifierIds || [];
    if (modifiers.length > 50 || new Set(modifiers).size !== modifiers.length) throw new Error("Order modifiers must be unique, with at most 50 per line");
    if ((item.specialInstructions?.trim().length || 0) > 500) throw new Error("Order line instructions cannot exceed 500 characters");
  }
  if (items.reduce((sum, item) => sum + item.quantity, 0) > 100) throw new Error("Order cannot include more than 100 total items");
  return items;
}
function validateCafeModifierSelections(menuItem, selectedModifiers) {
  const groups = menuItem.modifiers.reduce((acc, modifier) => {
    const key = modifier.modifierGroup || "default";
    (acc[key] ||= []).push(modifier);
    return acc;
  }, {});
  const selectedByGroup = selectedModifiers.reduce((acc, modifier) => {
    const key = modifier.modifierGroup || "default";
    (acc[key] ||= []).push(modifier);
    return acc;
  }, {});
  for (const [group, modifiers] of Object.entries(groups)) {
    const selectedCount = selectedByGroup[group]?.length || 0;
    const required = modifiers.some((modifier) => Boolean(modifier.required));
    const minSelections = Math.max(required ? 1 : 0, ...modifiers.map((modifier) => Number(modifier.minSelections || 0)));
    const maxSelections = Math.max(...modifiers.map((modifier) => Number(modifier.maxSelections || 1)));
    const label = modifiers[0].modifierGroupLabel || modifiers[0].modifierGroup || "modifier";
    if (selectedCount < minSelections) throw new Error(`${menuItem.name} requires at least ${minSelections} ${label} selection${minSelections === 1 ? "" : "s"}`);
    if (selectedCount > maxSelections) throw new Error(`${menuItem.name} allows at most ${maxSelections} ${label} selection${maxSelections === 1 ? "" : "s"}`);
  }
}
async function readLockedPickupSettings(tx) {
  const rows = await tx.$queryRawUnsafe(
    `SELECT "pickupLeadTimeMinutes", "pickupWindowMinutes", "pickupCapacityPerWindow" FROM "StoreSetting" WHERE "singletonKey" = 'primary' FOR SHARE`
  );
  if (!rows[0]) throw new Error("Primary coffee store is not configured");
  return rows[0];
}
var PICKUP_SETTINGS_CHANGED_MESSAGE;
var init_coffeeOrderPolicy = __esm({
  "features/keystone/mutations/coffeeOrderPolicy.ts"() {
    "use strict";
    init_access();
    PICKUP_SETTINGS_CHANGED_MESSAGE = "Pickup settings changed while this order was being placed. Review the pickup time and submit again.";
  }
});

// features/keystone/lib/cafeCustomerError.ts
function cafeCustomerError(message) {
  return new import_graphql.GraphQLError(message, { extensions: { code: CAFE_CUSTOMER_ERROR_CODE } });
}
var import_graphql, CAFE_CUSTOMER_ERROR_CODE;
var init_cafeCustomerError = __esm({
  "features/keystone/lib/cafeCustomerError.ts"() {
    "use strict";
    import_graphql = require("graphql");
    CAFE_CUSTOMER_ERROR_CODE = "CAFE_CUSTOMER_ERROR";
  }
});

// features/integrations/payment/providerError.ts
var ProviderError;
var init_providerError = __esm({
  "features/integrations/payment/providerError.ts"() {
    "use strict";
    ProviderError = class extends Error {
      constructor(message) {
        super(message);
        this.name = "ProviderError";
      }
    };
  }
});

// features/integrations/payment/stripe.ts
var stripe_exports = {};
__export(stripe_exports, {
  capturePaymentFunction: () => capturePaymentFunction,
  classifyStripeEvent: () => classifyStripeEvent,
  createHostedCheckout: () => createHostedCheckout,
  createPaymentFunction: () => createPaymentFunction,
  expireCheckoutSessionFunction: () => expireCheckoutSessionFunction,
  generatePaymentLinkFunction: () => generatePaymentLinkFunction,
  getPaymentStatusFunction: () => getPaymentStatusFunction,
  handleWebhookFunction: () => handleWebhookFunction,
  readHostedCheckout: () => readHostedCheckout,
  refundPaymentFunction: () => refundPaymentFunction
});
function secretKey() {
  const secret = process.env.STRIPE_SECRET_KEY;
  if (!secret) throw new Error("Stripe is not configured");
  return secret;
}
async function stripeRequest(path, body, idempotencyKey) {
  const response = await fetch(`${STRIPE_API}${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${secretKey()}`,
      ...body ? { "Content-Type": "application/x-www-form-urlencoded" } : {},
      ...idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}
    },
    body,
    signal: AbortSignal.timeout(1e4)
  });
  const payload = await response.json();
  if (!response.ok) throw new ProviderError(payload.error?.message || "Stripe request failed");
  return payload;
}
function adapterResult(payload, fallbackAmount) {
  return {
    success: true,
    provider: "pp_stripe_stripe",
    providerPaymentId: payload.id,
    status: payload.status,
    amount: payload.amount_received ?? payload.amount ?? fallbackAmount,
    currencyCode: payload.currency,
    data: payload
  };
}
async function createPaymentFunction(input) {
  const body = new URLSearchParams({
    amount: String(input.amount),
    currency: input.currencyCode.toLowerCase(),
    "automatic_payment_methods[enabled]": "true",
    "metadata[orderId]": input.orderId,
    ...input.paymentId ? { "metadata[paymentId]": input.paymentId } : {},
    ...input.customerEmail ? { receipt_email: input.customerEmail } : {}
  });
  const payload = await stripeRequest("/payment_intents", body, input.idempotencyKey);
  return adapterResult(payload, input.amount);
}
async function capturePaymentFunction(input) {
  const payload = await stripeRequest(`/payment_intents/${encodeURIComponent(input.providerPaymentId)}/capture`, new URLSearchParams());
  return adapterResult(payload, input.amount);
}
async function refundPaymentFunction(input) {
  const payload = await stripeRequest("/refunds", new URLSearchParams({
    payment_intent: input.providerPaymentId,
    ...input.amount == null ? {} : { amount: String(input.amount) },
    ...input.reason ? { "metadata[reason]": input.reason } : {}
  }), input.idempotencyKey);
  return {
    ...adapterResult(payload, input.amount),
    status: payload.status === "succeeded" ? "refunded" : payload.status
  };
}
async function getPaymentStatusFunction(input) {
  if (input.providerPaymentId.startsWith("cs_")) {
    const session = await stripeRequest(`/checkout/sessions/${encodeURIComponent(input.providerPaymentId)}`);
    return { ...adapterResult(session), amount: session.amount_total, data: { ...session, checkoutUrl: typeof session.url === "string" ? session.url : null } };
  }
  return adapterResult(await stripeRequest(`/payment_intents/${encodeURIComponent(input.providerPaymentId)}`));
}
function withParam(url, key, value) {
  const next = new URL(url);
  next.searchParams.set(key, value);
  return next.toString();
}
async function expireCheckoutSessionFunction(input) {
  const session = await stripeRequest(`/checkout/sessions/${encodeURIComponent(input.providerPaymentId)}/expire`, new URLSearchParams());
  return adapterResult(session);
}
async function generatePaymentLinkFunction(input) {
  if (!input.returnUrl) throw new Error("A return URL is required for hosted payment");
  const body = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": input.currencyCode.toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(input.amount),
    "line_items[0][price_data][product_data][name]": input.description || "Order",
    success_url: withParam(input.returnUrl, "payment", "done"),
    cancel_url: withParam(input.returnUrl, "payment", "cancelled"),
    client_reference_id: input.orderId,
    "metadata[orderId]": input.orderId,
    "payment_intent_data[metadata][orderId]": input.orderId,
    // Sessions expire after 30 minutes (Stripe's minimum), so an abandoned page can't be paid hours later.
    expires_at: String(Math.floor(Date.now() / 1e3) + 30 * 60),
    ...input.paymentId ? { "metadata[paymentId]": input.paymentId, "payment_intent_data[metadata][paymentId]": input.paymentId } : {},
    ...input.customerEmail ? { customer_email: input.customerEmail } : {}
  });
  const session = await stripeRequest("/checkout/sessions", body, input.idempotencyKey);
  return {
    success: true,
    provider: "pp_stripe_stripe",
    providerPaymentId: session.id,
    status: "pending",
    amount: session.amount_total ?? input.amount,
    currencyCode: session.currency,
    data: { checkoutUrl: typeof session.url === "string" ? session.url : null, expiresAt: session.expires_at ?? null }
  };
}
async function createHostedCheckout(input) {
  const body = new URLSearchParams({
    mode: "payment",
    "line_items[0][quantity]": "1",
    "line_items[0][price_data][currency]": input.currencyCode.toLowerCase(),
    "line_items[0][price_data][unit_amount]": String(input.amount),
    "line_items[0][price_data][product_data][name]": input.name,
    success_url: input.successUrl,
    cancel_url: input.cancelUrl,
    expires_at: String(Math.floor(Date.now() / 1e3) + 30 * 60),
    ...input.customerEmail ? { customer_email: input.customerEmail } : {}
  });
  for (const [key, value] of Object.entries(input.metadata)) {
    body.set(`metadata[${key}]`, value);
    body.set(`payment_intent_data[metadata][${key}]`, value);
  }
  const session = await stripeRequest("/checkout/sessions", body, input.idempotencyKey);
  return { id: String(session.id || ""), url: typeof session.url === "string" ? session.url : null };
}
async function readHostedCheckout(sessionId) {
  const session = await stripeRequest(`/checkout/sessions/${encodeURIComponent(sessionId)}`);
  const state = session.payment_status === "paid" ? "paid" : session.status === "expired" ? "expired" : "open";
  return { state, amount: Number(session.amount_total ?? 0), currency: String(session.currency || ""), paymentIntent: typeof session.payment_intent === "string" ? session.payment_intent : null };
}
function verifyStripeSignature(rawBody, signatureHeader) {
  const parts = signatureHeader.split(",").map((part) => part.trim().split("=", 2));
  const timestamp19 = parts.find(([key]) => key === "t")?.[1];
  const signatures = parts.filter(([key]) => key === "v1").map(([, value]) => value);
  if (!timestamp19 || signatures.length === 0 || !/^\d+$/.test(timestamp19)) {
    throw new Error("Invalid Stripe signature header");
  }
  if (Math.abs(Date.now() / 1e3 - Number(timestamp19)) > SIGNATURE_TOLERANCE_SECONDS) {
    throw new Error("Stale Stripe webhook signature");
  }
  const expected = (0, import_node_crypto2.createHmac)("sha256", process.env.STRIPE_WEBHOOK_SECRET || "").update(`${timestamp19}.${rawBody}`).digest();
  if (!process.env.STRIPE_WEBHOOK_SECRET) throw new Error("Stripe webhook is not configured");
  const valid = signatures.some((signature) => {
    if (!/^[a-f0-9]{64}$/i.test(signature)) return false;
    const provided = Buffer.from(signature, "hex");
    return provided.length === expected.length && (0, import_node_crypto2.timingSafeEqual)(provided, expected);
  });
  if (!valid) throw new Error("Invalid Stripe webhook signature");
}
function classifyStripeEvent(type, object = {}) {
  if (type === "checkout.session.completed") return object.payment_status === "paid" ? "succeeded" : "ignored";
  if (type === "payment_intent.succeeded" || type === "checkout.session.async_payment_succeeded") return "succeeded";
  if (type === "payment_intent.payment_failed" || type === "payment_intent.canceled" || type === "checkout.session.async_payment_failed" || type === "checkout.session.expired") return "failed";
  return "ignored";
}
async function handleWebhookFunction(input) {
  verifyStripeSignature(input.rawBody, input.headers["stripe-signature"] || "");
  const event = JSON.parse(input.rawBody);
  const object = event.data?.object || {};
  const eventId = String(event.id || "").trim();
  const eventType = String(event.type || "").trim();
  const providerPaymentId = String(object.payment_intent || object.id || "").trim();
  if (!eventId || !eventType || !providerPaymentId) throw new Error("Stripe webhook identity is incomplete");
  return {
    eventId,
    eventType,
    providerPaymentId,
    paymentId: object.metadata?.paymentId || null,
    giftCardId: object.metadata?.purpose === "gift_card" ? object.metadata?.giftCardId || null : null,
    orderId: object.metadata?.orderId || null,
    status: classifyStripeEvent(eventType, object),
    amount: object.amount_received ?? object.amount_total ?? object.amount ?? null,
    currencyCode: object.currency || null
  };
}
var import_node_crypto2, STRIPE_API, SIGNATURE_TOLERANCE_SECONDS;
var init_stripe = __esm({
  "features/integrations/payment/stripe.ts"() {
    "use strict";
    import_node_crypto2 = require("node:crypto");
    init_providerError();
    STRIPE_API = "https://api.stripe.com/v1";
    SIGNATURE_TOLERANCE_SECONDS = 300;
  }
});

// features/keystone/mutations/onlinePaymentRelease.ts
async function releaseAbandonedOnlinePayments(prisma, orderId) {
  const pending = await prisma.payment.findMany({
    where: { orderId, provider: "pp_stripe_stripe", status: { in: ["pending", "authorized"] } },
    select: { id: true, status: true, provider: true, providerPaymentId: true }
  });
  if (!pending.length) return;
  const stripe = await Promise.resolve().then(() => (init_stripe(), stripe_exports));
  for (const payment of pending) {
    const sessionId = String(payment.providerPaymentId || "");
    if (sessionId.startsWith("cs_")) {
      const state = await stripe.getPaymentStatusFunction({ providerPaymentId: sessionId });
      if (state.status === "complete") throw cafeCustomerError("The customer just paid online. Refresh in a moment.");
      if (state.status === "open") await stripe.expireCheckoutSessionFunction({ providerPaymentId: sessionId });
    }
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "failed", failureMessage: "Online payment page closed; paid another way" } });
  }
}
var init_onlinePaymentRelease = __esm({
  "features/keystone/mutations/onlinePaymentRelease.ts"() {
    "use strict";
    init_cafeCustomerError();
  }
});

// features/keystone/mutations/transitionPolicy.ts
function evaluateTransition(transitions, currentStatus, nextStatus) {
  if (currentStatus === nextStatus) return { replay: true };
  const allowed = transitions[currentStatus];
  if (!allowed?.includes(nextStatus)) {
    throw cafeCustomerError(`Can't change from ${currentStatus.replaceAll("_", " ")} to ${nextStatus.replaceAll("_", " ")}. Refresh to see the current status.`);
  }
  return { replay: false };
}
function canTransition(transitions, currentStatus, nextStatus) {
  return currentStatus === nextStatus || Boolean(transitions[currentStatus]?.includes(nextStatus));
}
var CAFE_ORDER_TRANSITIONS, PAYMENT_TRANSITIONS, PURCHASE_ORDER_TRANSITIONS, LOYALTY_ACCOUNT_TRANSITIONS, CATERING_ORDER_TRANSITIONS, SUBSCRIPTION_TRANSITIONS, POS_ORDER_TRANSITIONS;
var init_transitionPolicy = __esm({
  "features/keystone/mutations/transitionPolicy.ts"() {
    "use strict";
    init_cafeCustomerError();
    CAFE_ORDER_TRANSITIONS = {
      open: ["cancelled", "refunded"],
      accepted: ["in_bar_queue", "cancelled"],
      paid: ["in_bar_queue", "refunded"],
      in_bar_queue: ["preparing", "refunded"],
      preparing: ["ready", "refunded"],
      ready: ["completed", "refunded"],
      completed: ["refunded"],
      cancelled: ["refunded"],
      refunded: []
    };
    PAYMENT_TRANSITIONS = {
      pending: ["authorized", "captured", "failed", "cancelled"],
      authorized: ["captured", "failed", "cancelled"],
      // A hosted page that expired (failed) can still be paid a moment later: the money is recorded.
      failed: ["captured"],
      captured: ["refunded"],
      refunded: [],
      cancelled: []
    };
    PURCHASE_ORDER_TRANSITIONS = {
      draft: ["submitted", "cancelled"],
      submitted: ["received", "cancelled"],
      received: [],
      cancelled: []
    };
    LOYALTY_ACCOUNT_TRANSITIONS = {
      active: ["paused", "closed"],
      paused: ["active", "closed"],
      closed: ["active"]
    };
    CATERING_ORDER_TRANSITIONS = {
      inquiry: ["quoted", "cancelled"],
      quoted: ["confirmed", "cancelled"],
      confirmed: ["completed", "cancelled"],
      completed: [],
      cancelled: []
    };
    SUBSCRIPTION_TRANSITIONS = {
      trialing: ["active", "cancelled"],
      active: ["paused", "cancelled"],
      paused: ["active", "cancelled"],
      cancelled: []
    };
    POS_ORDER_TRANSITIONS = {
      open: ["paid", "voided"],
      paid: ["refunded"],
      voided: [],
      refunded: []
    };
  }
});

// features/keystone/mutations/coffeeKdsAuthority.ts
async function requireCurrentCoffeeCapability(tx, session, flags, message = "Not authorized") {
  if (session?.listKey !== "User" || !session.itemId) throw new Error(message);
  await tx.$executeRawUnsafe('SELECT "id" FROM "User" WHERE "id" = $1 FOR SHARE', session.itemId);
  const user = await tx.user.findUnique({ where: { id: session.itemId }, select: { id: true, roleId: true } });
  if (!user?.roleId || user.id !== session.itemId) throw new Error(message);
  await tx.$executeRawUnsafe('SELECT "id" FROM "Role" WHERE "id" = $1 FOR SHARE', user.roleId);
  const role = await tx.role.findUnique({ where: { id: user.roleId }, select: Object.fromEntries(flags.map((flag) => [flag, true])) });
  if (!role || !flags.some((flag) => role[flag] === true)) throw new Error(message);
  return user.id;
}
async function requireCurrentCoffeeKdsOperator(tx, session) {
  return requireCurrentCoffeeCapability(tx, session, ["canManageOrders"], "Not authorized to operate the KDS");
}
async function getCoffeeKdsRecoveryScope(_root, _args, context) {
  if (!permissions.canManageOrders({ session: context.session })) return null;
  return context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx;
    const actorId = await requireCurrentCoffeeKdsOperator(tx, context.session);
    const storeId = await getPrimaryCoffeeStoreId(tx);
    return { actorId, storeId };
  }, { maxWait: 5e3, timeout: 1e4, isolationLevel: "ReadCommitted" });
}
var init_coffeeKdsAuthority = __esm({
  "features/keystone/mutations/coffeeKdsAuthority.ts"() {
    "use strict";
    init_access();
    init_coffeeCommandReceipt();
  }
});

// features/keystone/mutations/updateCafeOrderStatus.ts
async function releaseOrderReservations(tx, order, storeId, actorId, now) {
  const reservations = await tx.stockMovement.findMany({
    where: { orderId: order.id, type: "sale" },
    orderBy: { id: "asc" },
    select: { inventoryItemId: true, inventoryLotId: true, quantity: true }
  });
  const inventoryTotals = /* @__PURE__ */ new Map();
  for (const inventoryItemId of [...new Set(reservations.map((reservation) => reservation.inventoryItemId))].sort()) {
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-inventory:${inventoryItemId}`);
  }
  for (const reservation of reservations) {
    const quantity = Math.abs(Number(reservation.quantity));
    if (!Number.isFinite(quantity) || quantity <= 0) throw new Error("Order inventory reservation evidence is invalid");
    inventoryTotals.set(reservation.inventoryItemId, (inventoryTotals.get(reservation.inventoryItemId) || 0) + quantity);
    let lotDisposition = "unlotted stock";
    if (reservation.inventoryLotId) {
      const lot = await tx.inventoryLot.findUnique({ where: { id: reservation.inventoryLotId }, select: { quantityRemaining: true, status: true, expiresAt: true } });
      if (!lot) throw new Error("Reserved inventory lot was not found");
      const currentStatus = lot.status || "active";
      const expired = Boolean(lot.expiresAt) && new Date(String(lot.expiresAt)).getTime() <= now.getTime();
      const nextStatus = currentStatus === "consumed" ? expired ? "expired" : "active" : currentStatus === "active" && expired ? "expired" : currentStatus;
      await tx.inventoryLot.update({
        where: { id: reservation.inventoryLotId },
        data: { quantityRemaining: Number(lot.quantityRemaining || 0) + quantity, ...nextStatus !== currentStatus ? { status: nextStatus } : {} }
      });
      lotDisposition = `lot status ${nextStatus}`;
    }
    await tx.stockMovement.create({
      data: {
        inventoryItemId: reservation.inventoryItemId,
        inventoryLotId: reservation.inventoryLotId || null,
        storeId,
        orderId: order.id,
        type: "return",
        quantity,
        reason: `Cancelled pickup order ${order.orderNumber}`,
        notes: `Released unprepared order reservation; ${lotDisposition}`,
        createdById: actorId
      }
    });
  }
  for (const [inventoryItemId, quantity] of [...inventoryTotals].sort(([left], [right]) => left.localeCompare(right))) {
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-inventory:${inventoryItemId}`);
    await tx.inventoryItem.update({ where: { id: inventoryItemId }, data: { currentStock: { increment: quantity } } });
  }
  const prepConsumptions = await tx.prepBatchConsumption.findMany({ where: { orderId: order.id, quantity: { gt: 0 } }, orderBy: { id: "asc" }, select: { id: true, prepBatchId: true, quantity: true } });
  for (const consumption of prepConsumptions) {
    const quantity = Number(consumption.quantity);
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-prep-batch:${consumption.prepBatchId}`);
    const batch = await tx.prepBatch.findUnique({ where: { id: consumption.prepBatchId }, select: { id: true, storeId: true, quantityRemaining: true } });
    if (!batch || String(batch.storeId) !== storeId || !Number.isFinite(quantity) || quantity <= 0) throw new Error("Prepared batch reservation evidence is invalid");
    await tx.prepBatch.update({ where: { id: consumption.prepBatchId }, data: { quantityRemaining: { increment: quantity } } });
    await tx.prepBatchConsumption.create({ data: { idempotencyKey: `cancel:${order.id}:${consumption.id}`, storeId, orderId: order.id, prepBatchId: consumption.prepBatchId, quantity: -quantity } });
  }
}
function isCafeOrderStatus(status) {
  return allowedStatuses.includes(status);
}
async function updateCafeOrderStatus(_root, args, context) {
  if (!permissions.canManageOrders({ session: context.session })) throw new Error("Not authorized to update cafe order status");
  if (!isCafeOrderStatus(args.status)) throw new Error(`Unsupported cafe order status: ${args.status}`);
  if (args.status === "paid" || args.status === "refunded") {
    throw new Error(`Cafe order ${args.status} status is controlled by payment settlement`);
  }
  const status = args.status;
  if (status === "cancelled") await releaseAbandonedOnlinePayments(context.prisma, args.orderId);
  const orderId = await context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx;
    await lockCoffeeOrder(tx, args.orderId);
    const actorId = await requireCurrentCoffeeCapability(rawTx, context.session, ["canManageOrders"], "Not authorized to update cafe order status");
    const existing = await tx.cafeOrder.findUnique({ where: { id: args.orderId }, include: { orderItems: { select: { id: true, barStatus: true } }, payments: { select: { status: true, amount: true, refundIdempotencyKey: true } } } });
    if (!existing) throw new Error("Cafe order not found");
    const storeId = await getPrimaryCoffeeStoreId(tx);
    assertCoffeeStoreOwnership(existing.storeId, storeId, "Cafe order");
    const transition = evaluateTransition(CAFE_ORDER_TRANSITIONS, existing.status, status);
    if (transition.replay) return existing.id;
    if (status === "ready" || status === "completed") assertCafeOrderItemsReadyForHandoff(existing.orderItems);
    if (status === "completed") assertCafeSettlement(existing.payments, Number(existing.total) - Number(existing.discount || 0));
    if (status === "cancelled" && existing.payments.some((payment) => ["pending", "authorized", "captured"].includes(String(payment.status)))) throw new Error("Resolve the payment attempt or refund before cancelling this order");
    const now = /* @__PURE__ */ new Date();
    if (status === "cancelled") await releaseOrderReservations(tx, existing, storeId, actorId, now);
    const timestampField = statusTimestampMap[status];
    await tx.cafeOrder.update({
      where: { id: existing.id },
      data: { status, ...timestampField ? { [timestampField]: now } : {} }
    });
    const itemStatus = itemStatusMap[status];
    if (itemStatus && existing.orderItems.length) {
      const itemTimestamp2 = itemTimestampMap[itemStatus];
      const updated = await tx.orderItem.updateMany({
        where: { orderId: existing.id, barStatus: { in: itemStatus === "preparing" ? ["new", "queued"] : itemStatus === "ready" ? ["new", "queued", "preparing"] : itemStatus === "queued" ? ["new"] : ["new", "queued", "preparing", "ready"] } },
        data: { barStatus: itemStatus, ...itemTimestamp2 ? { [itemTimestamp2]: now } : {} }
      });
      if (updated.count > existing.orderItems.length) throw new Error("Cafe order item status propagation was invalid");
    }
    await recordCoffeeCommandReceipt(tx, {
      storeId,
      eventKey: `order:${existing.id}:status:${status}:v1`,
      eventType: "order.status_changed",
      aggregateType: "order",
      aggregateId: existing.id,
      occurredAt: now,
      payload: { orderId: existing.id, orderNumber: existing.orderNumber, previousStatus: existing.status, status, itemStatus: itemStatus || null, inventoryReleased: status === "cancelled" }
    });
    return existing.id;
  }, TX_OPTIONS);
  return context.sudo().query.CafeOrder.findOne({ where: { id: orderId }, query: ORDER_QUERY });
}
var allowedStatuses, TX_OPTIONS, ORDER_QUERY, statusTimestampMap, itemStatusMap, itemTimestampMap;
var init_updateCafeOrderStatus = __esm({
  "features/keystone/mutations/updateCafeOrderStatus.ts"() {
    "use strict";
    init_access();
    init_coffeeCommandReceipt();
    init_transitionPolicy();
    init_coffeeKdsAuthority();
    init_coffeeOrderPolicy();
    init_onlinePaymentRelease();
    allowedStatuses = ["open", "accepted", "paid", "in_bar_queue", "preparing", "ready", "completed", "cancelled", "refunded"];
    TX_OPTIONS = { maxWait: 5e3, timeout: 1e4, isolationLevel: "ReadCommitted" };
    ORDER_QUERY = "id orderNumber status startedAt readyAt completedAt cancelledAt orderItems { id barStatus }";
    statusTimestampMap = {
      preparing: "startedAt",
      ready: "readyAt",
      completed: "completedAt",
      cancelled: "cancelledAt",
      paid: "paidAt"
    };
    itemStatusMap = {
      in_bar_queue: "queued",
      preparing: "preparing",
      ready: "ready",
      completed: "handed_off",
      cancelled: "voided"
    };
    itemTimestampMap = {
      queued: "queuedAt",
      preparing: "startedAt",
      ready: "readyAt",
      handed_off: "handedOffAt"
    };
  }
});

// features/keystone/mutations/endOfDayClose.ts
function storeDayKey(at, timezone) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(at);
  const part = (type) => parts.find((entry) => entry.type === type)?.value || "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function isPastDayTicket(ticket, now, timezone) {
  const due = ticket.promisedAt || ticket.createdAt;
  if (now.getTime() - due.getTime() < MIN_AGE_MS) return false;
  return storeDayKey(due, timezone) < storeDayKey(now, timezone);
}
function dayCloseOutcome(order, payments, itemStatuses) {
  if (payments.some((payment) => payment.status === "pending" || payment.status === "authorized")) return null;
  if (hasCafeSettlement(payments, Number(order.total) - Number(order.discount || 0)) && payments.some((payment) => payment.status === "captured")) return "completed";
  if (payments.some((payment) => payment.status === "captured")) return null;
  const started = itemStatuses.some((status) => ["preparing", "ready", "handed_off"].includes(status));
  return started ? "no_show" : "cancelled";
}
function triggerEndOfDayClose(prisma) {
  const now = Date.now();
  if (now - lastRun < MIN_INTERVAL_MS || process.env.NODE_ENV === "test") return;
  lastRun = now;
  void closePastDayOrders(prisma, new Date(now)).catch((error) => console.error("End-of-day close failed:", error));
}
async function closePastDayOrders(prisma, now = /* @__PURE__ */ new Date()) {
  const store = await prisma.storeSetting.findUnique({ where: { singletonKey: "primary" }, select: { id: true, timezone: true } });
  if (!store) return null;
  const timezone = store.timezone || "America/New_York";
  const before = new Date(now.getTime() - MIN_AGE_MS);
  const candidates = (await prisma.cafeOrder.findMany({
    where: { storeId: store.id, status: { in: ACTIVE }, OR: [{ promisedAt: { lt: before } }, { promisedAt: null, createdAt: { lt: before } }] },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    take: 200,
    select: { id: true, orderNumber: true, status: true, total: true, discount: true, promisedAt: true, createdAt: true }
  })).filter((ticket) => isPastDayTicket(ticket, now, timezone));
  if (!candidates.length) return null;
  const report = { closedAt: now.toISOString(), storeDay: storeDayKey(now, timezone), completed: 0, cancelled: 0, noShow: 0, skipped: 0, orderNumbers: [] };
  for (const ticket of candidates) {
    try {
      await releaseAbandonedOnlinePayments(prisma, ticket.id);
      const outcome = await prisma.$transaction(async (rawTx) => {
        const tx = rawTx;
        await lockCoffeeOrder(tx, ticket.id);
        const order = await tx.cafeOrder.findUnique({ where: { id: ticket.id }, include: { orderItems: { select: { id: true, barStatus: true } }, payments: { select: { id: true, status: true, amount: true, refundIdempotencyKey: true } } } });
        if (!order || order.storeId !== store.id || !ACTIVE.includes(String(order.status))) return null;
        const result = dayCloseOutcome(order, order.payments, order.orderItems.map((item) => String(item.barStatus)));
        if (!result) return null;
        const status = result === "completed" ? "completed" : "cancelled";
        if (result === "cancelled") await releaseOrderReservations(tx, order, store.id, null, now);
        await tx.cafeOrder.update({ where: { id: order.id }, data: { status, ...status === "completed" ? { completedAt: now } : { cancelledAt: now } } });
        if (order.orderItems.length) {
          await tx.orderItem.updateMany({
            where: { orderId: order.id, barStatus: { in: ["new", "queued", "preparing", "ready"] } },
            data: status === "completed" ? { barStatus: "handed_off", handedOffAt: now } : { barStatus: "voided" }
          });
        }
        await recordCoffeeCommandReceipt(tx, {
          storeId: store.id,
          eventKey: `order:${order.id}:status:${status}:v1`,
          eventType: "order.status_changed",
          aggregateType: "order",
          aggregateId: order.id,
          occurredAt: now,
          payload: { orderId: order.id, orderNumber: order.orderNumber, previousStatus: order.status, status, itemStatus: status === "completed" ? "handed_off" : "voided", inventoryReleased: result === "cancelled", closedBy: "end_of_day", outcome: result }
        });
        return result;
      }, TX_OPTIONS2);
      if (!outcome) {
        report.skipped += 1;
        continue;
      }
      if (outcome === "completed") report.completed += 1;
      else if (outcome === "cancelled") report.cancelled += 1;
      else report.noShow += 1;
      report.orderNumbers.push(ticket.orderNumber);
    } catch (error) {
      report.skipped += 1;
      console.error(`End-of-day close skipped ${ticket.orderNumber}:`, error?.message || error);
    }
  }
  if (report.orderNumbers.length) {
    await prisma.$transaction(async (tx) => {
      await recordCoffeeCommandReceipt(tx, {
        storeId: store.id,
        eventKey: `store:${store.id}:end_of_day_close:${report.closedAt}:v1`,
        eventType: DAY_CLOSE_EVENT,
        aggregateType: "store",
        aggregateId: store.id,
        occurredAt: now,
        payload: report
      });
    }, TX_OPTIONS2);
  }
  return report;
}
async function latestDayClose(prisma, storeId) {
  const row = await prisma.coffeeCommandReceipt.findFirst({ where: { storeId, eventType: DAY_CLOSE_EVENT }, orderBy: [{ occurredAt: "desc" }], select: { payload: true } });
  const payload = row?.payload;
  return payload && typeof payload.closedAt === "string" ? payload : null;
}
var DAY_CLOSE_EVENT, ACTIVE, MIN_AGE_MS, MIN_INTERVAL_MS, TX_OPTIONS2, lastRun;
var init_endOfDayClose = __esm({
  "features/keystone/mutations/endOfDayClose.ts"() {
    "use strict";
    init_coffeeCommandReceipt();
    init_coffeeOrderPolicy();
    init_onlinePaymentRelease();
    init_updateCafeOrderStatus();
    DAY_CLOSE_EVENT = "orders.end_of_day_closed";
    ACTIVE = ["open", "accepted", "paid", "in_bar_queue", "preparing", "ready"];
    MIN_AGE_MS = 3 * 36e5;
    MIN_INTERVAL_MS = 5 * 6e4;
    TX_OPTIONS2 = { maxWait: 5e3, timeout: 2e4, isolationLevel: "ReadCommitted" };
    lastRun = 0;
  }
});

// features/keystone/mutations/kdsPolicy.ts
function isKdsItemStatus(value) {
  return KDS_ITEM_STATUSES.includes(value);
}
function evaluateKdsItemTransition(current, next) {
  if (current === next) return { replay: true };
  if (!KDS_ITEM_TRANSITIONS[current].includes(next)) throw new Error(`Cannot transition KDS item from ${current} to ${next}`);
  return { replay: false };
}
function rollupCafeOrderStatus(statuses) {
  const active = statuses.filter((status) => status !== "voided");
  if (active.length === 0) return "in_bar_queue";
  if (active.every((status) => status === "handed_off")) return "completed";
  if (active.every((status) => status === "ready" || status === "handed_off")) return "ready";
  if (active.some((status) => status === "preparing")) return "preparing";
  return "in_bar_queue";
}
function advanceKdsOrderStatus(current, derived) {
  const rank = { open: 0, accepted: 0, paid: 0, in_bar_queue: 1, preparing: 2, ready: 3, completed: 4 };
  return (rank[current] || 0) > rank[derived] ? current : derived;
}
var KDS_ITEM_STATUSES, KDS_ITEM_TRANSITIONS;
var init_kdsPolicy = __esm({
  "features/keystone/mutations/kdsPolicy.ts"() {
    "use strict";
    KDS_ITEM_STATUSES = ["new", "queued", "preparing", "ready", "handed_off", "voided"];
    KDS_ITEM_TRANSITIONS = {
      new: ["queued", "voided"],
      queued: ["preparing", "voided"],
      preparing: ["ready", "voided"],
      ready: ["handed_off", "voided"],
      handed_off: [],
      voided: []
    };
  }
});

// features/lib/pickup-quote.ts
function cafeEarliestPickupMinutes(storeLeadMinutes, prepTimes) {
  const prep = prepTimes.map((minutes) => (Number.isFinite(Number(minutes)) ? Number(minutes) : 0) + CAFE_PICKUP_PREP_BUFFER_MINUTES);
  return Math.max(5, Number(storeLeadMinutes) || 0, ...prep);
}
function clockMinutes(value) {
  const match = /^(\d{2}):(\d{2})$/.exec(value || "");
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? hour * 60 + minute : null;
}
function zonedParts(at, timezone) {
  let format = zoneFormats.get(timezone);
  if (!format) {
    format = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
    zoneFormats.set(timezone, format);
  }
  const parts = format.formatToParts(at);
  const value = (type) => parts.find((part) => part.type === type)?.value || "";
  return { day: value("weekday"), minuteOfDay: Number(value("hour")) * 60 + Number(value("minute")) };
}
function normalizeWeeklyHours(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const row = entry;
    const day = String(row.day || "");
    if (!DAY_NAMES.includes(day)) return [];
    return [{ day, open: typeof row.open === "string" ? row.open : null, close: typeof row.close === "string" ? row.close : null, closed: row.closed === true }];
  });
}
function inServiceWindows(minuteOfDay, serviceWindows) {
  return !serviceWindows.length || serviceWindows.includes("all_day") || serviceWindows.some((window) => {
    const range = SERVICE_WINDOWS[window];
    return Boolean(range && minuteOfDay >= range[0] && minuteOfDay < range[1]);
  });
}
function openAtMinute(hours, day, minuteOfDay, serviceWindows) {
  const entry = hours.find((candidate) => candidate.day === day);
  const openMinute = clockMinutes(entry?.open);
  const closeMinute = clockMinutes(entry?.close);
  if (!entry || entry.closed || openMinute == null || closeMinute == null || minuteOfDay < openMinute || minuteOfDay >= closeMinute) return false;
  return inServiceWindows(minuteOfDay, serviceWindows);
}
function coffeeFirstPickupMinutes(settings, earliestMinutes, serviceWindowSets = [["all_day"]], at = /* @__PURE__ */ new Date()) {
  const timezone = settings.timezone || DEFAULT_STORE_TIMEZONE;
  const hours = normalizeWeeklyHours(settings.weeklyHours);
  for (let offset = Math.max(0, Math.ceil(earliestMinutes)); offset <= COFFEE_PICKUP_SCHEDULE_MAX_MINUTES; offset++) {
    const { day, minuteOfDay } = zonedParts(new Date(at.getTime() + offset * 6e4), timezone);
    if (serviceWindowSets.every((windows) => openAtMinute(hours, day, minuteOfDay, windows))) return offset;
  }
  return null;
}
var DAY_NAMES, SERVICE_WINDOWS, COFFEE_PICKUP_SCHEDULE_MAX_MINUTES, CAFE_PICKUP_PREP_BUFFER_MINUTES, DEFAULT_STORE_TIMEZONE, zoneFormats;
var init_pickup_quote = __esm({
  "features/lib/pickup-quote.ts"() {
    "use strict";
    DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    SERVICE_WINDOWS = {
      morning: [5 * 60, 11 * 60],
      midday: [11 * 60, 14 * 60],
      afternoon: [14 * 60, 18 * 60],
      all_day: [0, 24 * 60]
    };
    COFFEE_PICKUP_SCHEDULE_MAX_MINUTES = 48 * 60;
    CAFE_PICKUP_PREP_BUFFER_MINUTES = 5;
    DEFAULT_STORE_TIMEZONE = "America/New_York";
    zoneFormats = /* @__PURE__ */ new Map();
  }
});

// features/keystone/mutations/coffeeAvailability.ts
function getCoffeeOrderingAvailability(settings, at = /* @__PURE__ */ new Date(), serviceWindows = ["all_day"]) {
  const timezone = settings.timezone || DEFAULT_STORE_TIMEZONE;
  const { day, minuteOfDay } = zonedParts(at, timezone);
  const hours = normalizeWeeklyHours(settings.weeklyHours);
  const today = hours.find((entry) => entry.day === day);
  const openMinute = clockMinutes(today?.open);
  const closeMinute = clockMinutes(today?.close);
  const storeOpen = Boolean(today && !today.closed && openMinute != null && closeMinute != null && minuteOfDay >= openMinute && minuteOfDay < closeMinute);
  const itemOpen = inServiceWindows(minuteOfDay, serviceWindows);
  return {
    orderingOpen: storeOpen && itemOpen,
    storeOpen,
    itemOpen,
    timezone,
    day,
    minuteOfDay,
    today: today || null,
    pickupLeadTimeMinutes: Math.max(5, Number(settings.pickupLeadTimeMinutes || 12))
  };
}
function assertCoffeeOrderingAvailable(settings, at = /* @__PURE__ */ new Date(), serviceWindows = ["all_day"]) {
  const availability = getCoffeeOrderingAvailability(settings, at, serviceWindows);
  if (!availability.storeOpen) throw cafeCustomerError("The cafe is closed for pickup at that time");
  if (!availability.itemOpen) throw cafeCustomerError("A selected item isn't served at that time");
  return availability;
}
var init_coffeeAvailability = __esm({
  "features/keystone/mutations/coffeeAvailability.ts"() {
    "use strict";
    init_cafeCustomerError();
    init_pickup_quote();
    init_pickup_quote();
  }
});

// features/keystone/mutations/idempotency.ts
function stableSerialize(value) {
  if (Array.isArray(value)) return `[${value.map(stableSerialize).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, entry]) => `${JSON.stringify(key)}:${stableSerialize(entry)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}
function normalizeIdempotencyKey(value) {
  const key = value?.trim();
  if (!key) return null;
  if (key.length < 16) throw new Error("Idempotency key must be at least 16 characters");
  if (key.length > 128) throw new Error("Idempotency key must be at most 128 characters");
  if (!/^[A-Za-z0-9._:-]+$/.test(key)) {
    throw new Error("Idempotency key contains unsupported characters");
  }
  return key;
}
function buildScopedIdempotencyKey(scope, key) {
  return (0, import_node_crypto3.createHash)("sha256").update(`${scope}:${key}`).digest("hex");
}
function fingerprintInput(input) {
  return (0, import_node_crypto3.createHash)("sha256").update(stableSerialize(input)).digest("hex");
}
var import_node_crypto3;
var init_idempotency = __esm({
  "features/keystone/mutations/idempotency.ts"() {
    "use strict";
    import_node_crypto3 = require("node:crypto");
  }
});

// features/keystone/mutations/coffeePricing.ts
function normalizeCafeTaxBasisPoints(value) {
  const basisPoints = Number(value);
  if (!Number.isFinite(basisPoints) || basisPoints < 0 || basisPoints > 1e4 || Math.abs(Math.round(basisPoints * 100) - basisPoints * 100) > 1e-6) {
    throw new Error("Store tax rate must be between 0 and 10000 basis points, with at most two decimals");
  }
  return basisPoints;
}
function assertCafeMoneyCents(value, label) {
  if (!Number.isSafeInteger(value) || value < 0 || value > MAX_CAFE_MONEY_CENTS) {
    throw new Error(`${label} is outside the supported order amount range`);
  }
  return value;
}
function calculateCafeTax(subtotalCents, basisPoints = DEFAULT_CAFE_TAX_BASIS_POINTS) {
  if (!Number.isSafeInteger(subtotalCents) || subtotalCents < 0) throw new Error("Subtotal must be a non-negative integer amount in cents");
  return Math.round(subtotalCents * normalizeCafeTaxBasisPoints(basisPoints) / 1e4);
}
function calculateCafeTotals(lines, taxRateBasisPoints, tipCents) {
  const lineTotals = lines.map((line) => {
    assertCafeMoneyCents(line.unitPrice, "Item price");
    return assertCafeMoneyCents(line.unitPrice * line.quantity, "Line total");
  });
  const subtotal = assertCafeMoneyCents(lineTotals.reduce((sum, value) => sum + value, 0), "Order subtotal");
  const tax = assertCafeMoneyCents(calculateCafeTax(subtotal, taxRateBasisPoints), "Order tax");
  const tip = assertCafeMoneyCents(tipCents, "Tip");
  const total = assertCafeMoneyCents(subtotal + tax + tip, "Order total");
  return { lineTotals, subtotal, tax, tip, total };
}
function cafeQuoteFingerprint(input) {
  return fingerprintInput({
    kind: "cafe-quote:v1",
    storeId: input.storeId,
    currencyCode: input.currencyCode,
    taxRateBasisPoints: input.taxRateBasisPoints,
    lines: input.lines.map((line) => ({ menuItemId: line.menuItemId, quantity: line.quantity, modifierIds: [...line.modifierIds].sort(), unitPrice: line.unitPrice })),
    subtotal: input.subtotal,
    tax: input.tax,
    tip: input.tip,
    total: input.total
  });
}
var DEFAULT_CAFE_TAX_BASIS_POINTS, MAX_CAFE_MONEY_CENTS;
var init_coffeePricing = __esm({
  "features/keystone/mutations/coffeePricing.ts"() {
    "use strict";
    init_idempotency();
    DEFAULT_CAFE_TAX_BASIS_POINTS = 875;
    MAX_CAFE_MONEY_CENTS = 2147483647;
  }
});

// features/keystone/mutations/inventoryLots.ts
function stockUnits(value, label = "Quantity", options = {}) {
  const parsed = typeof value === "string" ? Number(value.trim()) : Number(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} is invalid`);
  const scaled = Math.round(parsed * STOCK_SCALE);
  if (Math.abs(parsed * STOCK_SCALE - scaled) > 1e-6) throw new Error(`${label} supports at most 4 decimal places`);
  if (scaled < (options.allowZero ? 0 : 1)) throw new Error(`${label} must be greater than zero`);
  if (scaled > MAX_STOCK_UNITS) throw new Error(`${label} is too large`);
  if (options.unit === "each" && scaled % STOCK_SCALE !== 0) throw new Error(`${label} must be a whole number of items`);
  return scaled;
}
function storedStockUnits(value) {
  const parsed = Number(value == null ? 0 : String(value));
  if (!Number.isFinite(parsed)) throw new Error("Stored stock quantity is invalid");
  return Math.round(parsed * STOCK_SCALE);
}
function stockDecimal(units) {
  if (!Number.isSafeInteger(units)) throw new Error("Stock quantity is out of range");
  const sign = units < 0 ? "-" : "";
  const absolute = Math.abs(units);
  return `${sign}${Math.trunc(absolute / STOCK_SCALE)}.${String(absolute % STOCK_SCALE).padStart(4, "0")}`;
}
function stockNumber(units) {
  return Number(stockDecimal(units));
}
function planStockCount(currentStock, countedUnits) {
  const previousUnits = storedStockUnits(currentStock);
  return { previousUnits, deltaUnits: countedUnits - previousUnits };
}
function stockCostCents(units, unitCostCents) {
  const cents2 = Math.round(units * unitCostCents / STOCK_SCALE);
  if (!Number.isSafeInteger(cents2) || cents2 > 2147483647) throw new Error("Cost is too large to record");
  return cents2;
}
async function consumeActiveInventoryLots(tx, inventoryItemId, requestedQuantity, options) {
  const requested = stockUnits(requestedQuantity, "Consumed quantity");
  const opening = storedStockUnits(options.openingStock);
  const all = await tx.inventoryLot.findMany({
    where: { inventoryItemId, quantityRemaining: { gt: 0 } },
    orderBy: [{ expiresAt: "asc" }, { receivedAt: "asc" }, { id: "asc" }],
    take: 1001,
    select: { id: true, quantityRemaining: true, status: true, expiresAt: true }
  });
  if (all.length > 1e3) throw new Error("Inventory lot ledger requires consolidation before this operation");
  const now = Date.now();
  const lots = all.map((lot) => ({ ...lot, units: storedStockUnits(lot.quantityRemaining) }));
  const eligible = lots.filter((lot) => options.waste || (lot.status || "active") === "active" && (!lot.expiresAt || new Date(lot.expiresAt).getTime() > now));
  const tracked = lots.reduce((sum, lot) => sum + lot.units, 0);
  if (tracked > opening) throw new Error("Inventory lot balances exceed recorded stock for this item; reconcile the stock count before continuing");
  const untracked = opening - tracked;
  const available = eligible.reduce((sum, lot) => sum + lot.units, 0) + untracked;
  if (available < requested) throw new Error("Insufficient eligible stock: expired or quarantined lots cannot be sold or prepared");
  let remaining = requested;
  const allocations = [];
  for (const lot of eligible) {
    if (remaining <= 0) break;
    const consumed = Math.min(lot.units, remaining);
    const left = lot.units - consumed;
    await tx.inventoryLot.update({ where: { id: lot.id }, data: { quantityRemaining: stockDecimal(left), ...left === 0 ? { status: "consumed" } : {} } });
    allocations.push({ inventoryLotId: lot.id, quantity: stockNumber(consumed) });
    remaining -= consumed;
  }
  return { consumedFromLots: stockNumber(requested - remaining), untrackedQuantity: stockNumber(remaining), allocations };
}
async function trimLotsToStock(tx, inventoryItemId, openingStock) {
  const opening = storedStockUnits(openingStock);
  const lots = (await tx.inventoryLot.findMany({
    where: { inventoryItemId, quantityRemaining: { gt: 0 } },
    orderBy: [{ expiresAt: "asc" }, { receivedAt: "asc" }, { id: "asc" }],
    take: 1001,
    select: { id: true, quantityRemaining: true }
  })).map((lot) => ({ id: lot.id, units: storedStockUnits(lot.quantityRemaining) }));
  let excess = lots.reduce((sum, lot) => sum + lot.units, 0) - opening;
  const trimmed = [];
  for (const lot of lots) {
    if (excess <= 0) break;
    const cut = Math.min(lot.units, excess);
    const left = lot.units - cut;
    await tx.inventoryLot.update({ where: { id: lot.id }, data: { quantityRemaining: stockDecimal(left), ...left === 0 ? { status: "consumed" } : {} } });
    trimmed.push({ inventoryLotId: lot.id, quantity: stockNumber(cut) });
    excess -= cut;
  }
  return trimmed;
}
var STOCK_SCALE, MAX_STOCK_UNITS;
var init_inventoryLots = __esm({
  "features/keystone/mutations/inventoryLots.ts"() {
    "use strict";
    STOCK_SCALE = 1e4;
    MAX_STOCK_UNITS = 1e6 * STOCK_SCALE;
  }
});

// features/keystone/mutations/coffeeInventoryConsumption.ts
function positive(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
function rounded(value) {
  return Math.ceil((value - 1e-9) * 1e4) / 1e4;
}
function countedOutput(unit) {
  return COUNTED_OUTPUT_UNITS.has(String(unit || "serving"));
}
function batchOutputCounted(batch) {
  const metadata = batch.metadata && typeof batch.metadata === "object" ? batch.metadata : {};
  return typeof metadata.outputUnit !== "string" || countedOutput(metadata.outputUnit);
}
async function getCafeInventoryRequirements(tx, storeId, lines) {
  const menuItemIds = [...new Set(lines.map((line) => line.menuItemId))];
  const modifierIds = [...new Set(lines.flatMap((line) => line.modifierIds || []))];
  const [recipes, modifiers] = await Promise.all([
    tx.recipe.findMany({ where: { storeId, menuItemId: { in: menuItemIds }, status: "active", active: true }, select: { id: true, menuItemId: true, yieldQuantity: true, yieldUnit: true, from_Ingredient_recipe: { select: { quantity: true, unit: true, optional: true, inventoryItem: { select: { id: true, storeId: true, unit: true } } } } } }),
    modifierIds.length ? tx.menuItemModifier.findMany({ where: { storeId, id: { in: modifierIds } }, select: { id: true, menuItemId: true, name: true, inventoryAction: true, inventoryQuantity: true, replacesInventoryItemId: true, inventoryItem: { select: { id: true, storeId: true, unit: true } } } }) : Promise.resolve([])
  ]);
  const recipesByItem = /* @__PURE__ */ new Map();
  for (const recipe of recipes) {
    if (recipesByItem.has(String(recipe.menuItemId))) throw new Error("Menu item has multiple active recipes; review recipe versions before selling");
    recipesByItem.set(String(recipe.menuItemId), recipe);
  }
  const modifiersById = new Map(modifiers.map((modifier) => [String(modifier.id), modifier]));
  const batches = recipes.length ? await tx.prepBatch.findMany({ where: { storeId, recipeId: { in: recipes.map((recipe) => String(recipe.id)) }, status: "completed", quantityRemaining: { gt: 0 }, OR: [{ expiresAt: null }, { expiresAt: { gt: /* @__PURE__ */ new Date() } }] }, orderBy: [{ completedAt: "asc" }, { id: "asc" }], select: { id: true, recipeId: true, quantityRemaining: true, metadata: true } }) : [];
  const prepRemaining = new Map(batches.map((batch) => [String(batch.id), positive(batch.quantityRemaining)]));
  const prep = /* @__PURE__ */ new Map();
  const inventory = /* @__PURE__ */ new Map();
  const add = (id, quantity) => inventory.set(id, (inventory.get(id) || 0) + quantity);
  for (const line of lines) {
    if (!positive(line.quantity)) throw new Error("Order inventory quantity is invalid");
    const selected = (line.modifierIds || []).map((id) => {
      const modifier = modifiersById.get(id);
      if (!modifier || modifier.menuItemId !== line.menuItemId || !["none", "add", "substitute"].includes(String(modifier.inventoryAction))) throw new Error("Selected modifier inventory needs review in Menu management");
      return modifier;
    });
    const adjustments = selected.filter((modifier) => modifier.inventoryAction !== "none");
    const recipe = recipesByItem.get(line.menuItemId);
    if (!recipe) {
      if (adjustments.some((modifier) => modifier.inventoryAction === "substitute")) throw new Error("Substitution requires a reviewed base recipe");
      if (line.fallbackInventoryItemId) add(line.fallbackInventoryItemId, line.quantity);
    } else {
      const yieldQuantity = positive(recipe.yieldQuantity);
      const ingredients = recipe.from_Ingredient_recipe || [];
      if (!yieldQuantity || !ingredients.length) throw new Error("Recipe requires positive yield and inventory-backed ingredients");
      for (const ingredient of ingredients) {
        if (ingredient.optional) continue;
        const source = ingredient.inventoryItem;
        if (!source?.id || source.storeId !== storeId || ingredient.unit !== source.unit || !positive(ingredient.quantity)) throw new Error("Recipe ingredient quantity, unit or store is invalid");
      }
      let direct = line.quantity;
      if (!adjustments.length && countedOutput(recipe.yieldUnit)) for (const batch of batches.filter((candidate) => candidate.recipeId === recipe.id && batchOutputCounted(candidate))) {
        const id = String(batch.id);
        const used = Math.min(prepRemaining.get(id) || 0, direct);
        if (used > 0) {
          prep.set(id, (prep.get(id) || 0) + used);
          prepRemaining.set(id, (prepRemaining.get(id) || 0) - used);
          direct -= used;
        }
        if (direct <= 0) break;
      }
      const substitutions = adjustments.filter((modifier) => modifier.inventoryAction === "substitute");
      if (new Set(substitutions.map((modifier) => modifier.replacesInventoryItemId)).size !== substitutions.length) throw new Error("Conflicting ingredient substitutions");
      for (const modifier of substitutions) if (!ingredients.some((ingredient) => !ingredient.optional && ingredient.inventoryItem?.id === modifier.replacesInventoryItemId)) throw new Error("Substitution source is not a required ingredient in this recipe");
      for (const ingredient of ingredients) {
        if (ingredient.optional) continue;
        const source = ingredient.inventoryItem;
        const replacement = substitutions.find((modifier) => modifier.replacesInventoryItemId === source.id);
        const target = replacement ? replacement.inventoryItem : source;
        if (!target?.id || target.storeId !== storeId || target.unit !== source.unit) throw new Error("Substitution must use same-store inventory in the exact ingredient unit");
        if (direct > 0) add(String(target.id), Number(ingredient.quantity) / yieldQuantity * direct);
      }
    }
    for (const modifier of adjustments.filter((candidate) => candidate.inventoryAction === "add")) {
      const target = modifier.inventoryItem;
      if (!target?.id || target.storeId !== storeId || !positive(modifier.inventoryQuantity)) throw new Error("Add-on requires a positive inventory quantity in its base unit");
      add(String(target.id), Number(modifier.inventoryQuantity) * line.quantity);
    }
  }
  return [
    ...[...prep].map(([prepBatchId, quantity]) => ({ kind: "prep", prepBatchId, quantity: rounded(quantity) })),
    ...[...inventory].map(([inventoryItemId, quantity]) => ({ kind: "inventory", inventoryItemId, quantity: rounded(quantity) }))
  ].sort((left, right) => `${left.kind}:${left.kind === "prep" ? left.prepBatchId : left.inventoryItemId}`.localeCompare(`${right.kind}:${right.kind === "prep" ? right.prepBatchId : right.inventoryItemId}`));
}
async function consumeCafeInventoryRequirements(tx, input) {
  for (const requirement of input.requirements) {
    if (requirement.kind === "prep") {
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-prep-batch:${requirement.prepBatchId}`);
      const batch = await tx.prepBatch.findUnique({ where: { id: requirement.prepBatchId }, select: { id: true, storeId: true, status: true, quantityRemaining: true, expiresAt: true } });
      if (!batch || batch.storeId !== input.storeId) throw new Error("A prepared batch in this order is expired or has insufficient quantity");
      if (batch.status !== "completed" || batch.expiresAt && new Date(String(batch.expiresAt)).getTime() <= Date.now() || positive(batch.quantityRemaining) < requirement.quantity) throw cafeCustomerError("A prepared batch in this order is expired or used up");
      await tx.prepBatch.update({ where: { id: requirement.prepBatchId }, data: { quantityRemaining: { decrement: requirement.quantity } } });
      await tx.prepBatchConsumption.create({ data: { idempotencyKey: `${input.orderId}:${requirement.prepBatchId}`, storeId: input.storeId, orderId: input.orderId, prepBatchId: requirement.prepBatchId, quantity: requirement.quantity } });
    } else {
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-inventory:${requirement.inventoryItemId}`);
      const item = await tx.inventoryItem.findUnique({ where: { id: requirement.inventoryItemId }, select: { id: true, storeId: true, currentStock: true, unit: true, name: true } });
      if (!item || item.storeId !== input.storeId) throw new Error("Insufficient inventory for this order");
      if (positive(item.currentStock) < requirement.quantity) throw cafeCustomerError(shortStockMessage(item));
      if (String(item.unit || "each") === "each" && Math.round(requirement.quantity * STOCK_SCALE) % STOCK_SCALE !== 0) {
        throw new Error(`This order would use a fraction of ${String(item.name || "a counted item")}; review the recipe or add-on quantity in Menu management`);
      }
      const lots = await consumeActiveInventoryLots(tx, requirement.inventoryItemId, requirement.quantity, { openingStock: Number(item.currentStock) });
      await tx.inventoryItem.update({ where: { id: requirement.inventoryItemId }, data: { currentStock: { decrement: requirement.quantity } } });
      const allocations = [...lots.allocations, ...lots.untrackedQuantity > 1e-8 ? [{ inventoryLotId: null, quantity: lots.untrackedQuantity }] : []];
      for (const allocation of allocations) await tx.stockMovement.create({ data: { idempotencyKey: `order:${input.orderId}:${requirement.inventoryItemId}:${allocation.inventoryLotId || "unlotted"}`, inventoryItemId: requirement.inventoryItemId, inventoryLotId: allocation.inventoryLotId, storeId: input.storeId, orderId: input.orderId, type: "sale", quantity: -allocation.quantity, reason: input.reason, notes: "Reviewed recipe/modifier allocation; no inferred historical lot assignments", createdById: input.createdById || null } });
    }
  }
}
function shortStockMessage(item) {
  const name2 = String(item.name || "stock");
  const onHand = Math.max(0, Math.floor(Number(item.currentStock || 0) * 100) / 100);
  const unit = String(item.unit || "each");
  if (onHand <= 0) return `${name2} is out of stock`;
  return unit === "each" ? `Only ${onHand} ${name2} left` : `Only ${onHand} ${unit} of ${name2} left`;
}
var COUNTED_OUTPUT_UNITS;
var init_coffeeInventoryConsumption = __esm({
  "features/keystone/mutations/coffeeInventoryConsumption.ts"() {
    "use strict";
    init_inventoryLots();
    init_cafeCustomerError();
    COUNTED_OUTPUT_UNITS = /* @__PURE__ */ new Set(["serving", "each"]);
  }
});

// features/keystone/mutations/cafeStorefrontPolicy.ts
function isPublishedMenuItem(item) {
  return Boolean(item.available) && (!item.category || item.category.active !== false);
}
async function assertCafeRequirementsInStock(client, storeId, requirements) {
  const inventory = requirements.filter((requirement) => requirement.kind === "inventory");
  if (!inventory.length) return;
  const rows = await client.inventoryItem.findMany({ where: { storeId, id: { in: inventory.map((requirement) => requirement.inventoryItemId) } }, select: { id: true, currentStock: true } });
  const stock = new Map(rows.map((row) => [String(row.id), Number(row.currentStock)]));
  for (const requirement of inventory) {
    const available = stock.get(requirement.inventoryItemId);
    if (available === void 0 || !Number.isFinite(available) || available < requirement.quantity) throw cafeCustomerError("Part of this order is sold out right now");
  }
}
function normalizeCafeReceiptKey(value) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !RECEIPT_KEY_PATTERN.test(value)) throw new Error("Receipt key is invalid");
  return value;
}
function cafeReceiptKeyMatches(presented, stored) {
  if (!presented || !stored || presented.length !== stored.length) return false;
  return (0, import_node_crypto4.timingSafeEqual)(Buffer.from(presented), Buffer.from(stored));
}
function cafeUploadedImageReference(image2) {
  if (!image2?.image_id || !IMAGE_EXTENSIONS.includes(image2.image_extension)) return null;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(image2.image_id)) return null;
  return `${IMAGE_REFERENCE_PREFIX}${image2.image_id}.${image2.image_extension}`;
}
function legacyImagePath(imagePath) {
  if (!imagePath) return null;
  if (/^(https?:|data:|blob:)/.test(imagePath) || imagePath.startsWith("/images/")) return imagePath;
  return imagePath.startsWith("/") ? `/images${imagePath}` : `/images/${imagePath}`;
}
async function resolveCafeImageUrl(context, reference3) {
  if (!reference3) return null;
  if (!reference3.startsWith(IMAGE_REFERENCE_PREFIX)) return legacyImagePath(reference3);
  const [id, extension] = reference3.slice(IMAGE_REFERENCE_PREFIX.length).split(".");
  if (!id || !IMAGE_EXTENSIONS.includes(extension)) return null;
  try {
    return await context.images("my_images").getUrl(id, extension);
  } catch {
    return null;
  }
}
function cafeMenuItemImageReference(item) {
  const primary = item.menuItemImages?.[0];
  return cafeUploadedImageReference(primary) || primary?.imagePath || item.imageUrl || null;
}
var import_node_crypto4, PUBLISHED_MENU_ITEM_WHERE, RECEIPT_KEY_PATTERN, IMAGE_REFERENCE_PREFIX, IMAGE_EXTENSIONS;
var init_cafeStorefrontPolicy = __esm({
  "features/keystone/mutations/cafeStorefrontPolicy.ts"() {
    "use strict";
    import_node_crypto4 = require("node:crypto");
    init_idempotency();
    init_cafeCustomerError();
    init_pickup_quote();
    PUBLISHED_MENU_ITEM_WHERE = {
      available: true,
      OR: [{ categoryId: null }, { category: { active: true } }]
    };
    RECEIPT_KEY_PATTERN = /^[0-9a-f]{64}$/;
    IMAGE_REFERENCE_PREFIX = "keystone-image:my_images/";
    IMAGE_EXTENSIONS = ["jpg", "png", "webp", "gif"];
  }
});

// features/keystone/mutations/cafeMenuStock.ts
function positive2(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}
async function cafeMenuStock(client, storeId, items) {
  const soldOut = /* @__PURE__ */ new Set();
  const modifiersOut = /* @__PURE__ */ new Set();
  const servings = /* @__PURE__ */ new Map();
  if (!items.length) return { soldOut, modifiersOut, servings };
  const recipes = await client.recipe.findMany({
    where: { storeId, menuItemId: { in: items.map((item) => item.id) }, status: "active", active: true },
    select: { id: true, menuItemId: true, yieldQuantity: true, from_Ingredient_recipe: { select: { quantity: true, optional: true, inventoryItemId: true } } }
  });
  const recipeByItem = new Map(recipes.map((recipe) => [String(recipe.menuItemId), recipe]));
  const inventoryIds = /* @__PURE__ */ new Set();
  for (const item of items) {
    if (item.inventoryItemId) inventoryIds.add(item.inventoryItemId);
    for (const modifier of item.modifiers) if (modifier.inventoryItemId) inventoryIds.add(modifier.inventoryItemId);
  }
  for (const recipe of recipes) {
    for (const ingredient of recipe.from_Ingredient_recipe || []) {
      if (typeof ingredient.inventoryItemId === "string") inventoryIds.add(ingredient.inventoryItemId);
    }
  }
  const [stockRows, batches] = await Promise.all([
    inventoryIds.size ? client.inventoryItem.findMany({ where: { storeId, id: { in: [...inventoryIds] } }, select: { id: true, currentStock: true } }) : Promise.resolve([]),
    recipes.length ? client.prepBatch.findMany({ where: { storeId, recipeId: { in: recipes.map((recipe) => String(recipe.id)) }, status: "completed", quantityRemaining: { gt: 0 }, OR: [{ expiresAt: null }, { expiresAt: { gt: /* @__PURE__ */ new Date() } }] }, select: { recipeId: true } }) : Promise.resolve([])
  ]);
  const stock = new Map(stockRows.map((row) => [String(row.id), Number(row.currentStock)]));
  const prepared = new Set(batches.map((batch) => String(batch.recipeId)));
  const covers = (inventoryItemId, quantity) => (stock.get(inventoryItemId) ?? 0) >= quantity - 1e-9;
  for (const item of items) {
    const recipe = recipeByItem.get(item.id);
    const needs = /* @__PURE__ */ new Map();
    if (!recipe) {
      if (item.inventoryItemId) needs.set(item.inventoryItemId, 1);
    } else {
      const yieldQuantity = positive2(recipe.yieldQuantity) || 1;
      for (const ingredient of recipe.from_Ingredient_recipe || []) {
        if (ingredient.optional || typeof ingredient.inventoryItemId !== "string") continue;
        needs.set(ingredient.inventoryItemId, (needs.get(ingredient.inventoryItemId) || 0) + positive2(ingredient.quantity) / yieldQuantity);
      }
    }
    for (const modifier of item.modifiers) {
      if (modifier.inventoryAction === "add" && modifier.inventoryItemId && !covers(modifier.inventoryItemId, positive2(modifier.inventoryQuantity))) modifiersOut.add(modifier.id);
      if (modifier.inventoryAction === "substitute" && modifier.inventoryItemId && modifier.replacesInventoryItemId) {
        const replaced = needs.get(modifier.replacesInventoryItemId);
        if (replaced !== void 0 && !covers(modifier.inventoryItemId, replaced)) modifiersOut.add(modifier.id);
      }
    }
    if (recipe && prepared.has(String(recipe.id))) continue;
    let most = Infinity;
    for (const [inventoryItemId, quantity] of needs) {
      if (item.modifiers.some((modifier) => modifier.inventoryAction === "substitute" && modifier.replacesInventoryItemId === inventoryItemId)) continue;
      if (quantity > 0) most = Math.min(most, Math.floor(((stock.get(inventoryItemId) ?? 0) + 1e-9) / quantity));
    }
    if (Number.isFinite(most)) servings.set(item.id, Math.max(0, most));
    for (const [inventoryItemId, quantity] of needs) {
      if (covers(inventoryItemId, quantity)) continue;
      const substitute = item.modifiers.some((modifier) => modifier.inventoryAction === "substitute" && modifier.replacesInventoryItemId === inventoryItemId && !modifiersOut.has(modifier.id));
      if (!substitute) {
        soldOut.add(item.id);
        break;
      }
    }
  }
  return { soldOut, modifiersOut, servings };
}
var MENU_STOCK_ITEM_SELECT, MENU_STOCK_MODIFIER_SELECT;
var init_cafeMenuStock = __esm({
  "features/keystone/mutations/cafeMenuStock.ts"() {
    "use strict";
    MENU_STOCK_ITEM_SELECT = { inventoryItemId: true };
    MENU_STOCK_MODIFIER_SELECT = { inventoryAction: true, inventoryQuantity: true, inventoryItemId: true, replacesInventoryItemId: true };
  }
});

// features/platform/reports/lib/businessDate.ts
function formatter(timeZone) {
  let value = formatters.get(timeZone);
  if (!value) {
    value = new Intl.DateTimeFormat("en-US-u-ca-gregory-nu-latn", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hourCycle: "h23"
    });
    formatters.set(timeZone, value);
  }
  return value;
}
function wallClockEpoch(instant2, timeZone) {
  const parts = Object.fromEntries(formatter(timeZone).formatToParts(new Date(instant2)).map(({ type, value }) => [type, value]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
}
function isBusinessDate(value) {
  if (typeof value !== "string") return false;
  const match = BUSINESS_DATE.exec(value);
  if (!match) return false;
  const epoch = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isFinite(epoch) && new Date(epoch).toISOString().slice(0, 10) === value;
}
function storeBusinessDate(timeZone, now = /* @__PURE__ */ new Date()) {
  return new Date(wallClockEpoch(now.getTime(), timeZone)).toISOString().slice(0, 10);
}
function addBusinessDays(date, days) {
  const next = /* @__PURE__ */ new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}
function storeDayStart(date, timeZone) {
  if (!isBusinessDate(date)) throw new Error("Business date must be a valid YYYY-MM-DD date");
  const target = Date.parse(`${date}T00:00:00Z`);
  let guess = target;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    guess = target - (wallClockEpoch(guess, timeZone) - guess);
  }
  while (new Date(wallClockEpoch(guess, timeZone)).toISOString().slice(0, 10) < date) guess += 15 * 60 * 1e3;
  return new Date(guess);
}
var BUSINESS_DATE, formatters;
var init_businessDate = __esm({
  "features/platform/reports/lib/businessDate.ts"() {
    "use strict";
    BUSINESS_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
    formatters = /* @__PURE__ */ new Map();
  }
});

// features/platform/reports/lib/coffeeReportsQuery.ts
function int(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}
function resolveReportPeriod(input, timeZone, now = /* @__PURE__ */ new Date()) {
  const period = REPORT_PERIODS.includes(String(input.period)) ? input.period : "30d";
  const today = storeBusinessDate(timeZone, now);
  let startDate;
  let endDate;
  if (period === "custom") {
    if (!isBusinessDate(input.startDate) || !isBusinessDate(input.endDate)) throw new Error("Choose a valid start and end date");
    startDate = input.startDate;
    endDate = input.endDate;
    if (startDate > endDate) throw new Error("The start date must be on or before the end date");
    if (addBusinessDays(startDate, MAX_CUSTOM_DAYS - 1) < endDate) throw new Error(`Choose a range of ${MAX_CUSTOM_DAYS} days or fewer`);
  } else {
    endDate = today;
    startDate = addBusinessDays(today, -(PERIOD_DAYS[period] - 1));
  }
  return { period, startDate, endDate, start: storeDayStart(startDate, timeZone), end: storeDayStart(addBusinessDays(endDate, 1), timeZone) };
}
async function salesSection(context, storeId, range) {
  const createdAt = { gte: range.start, lt: range.end };
  const completedInPeriod = { storeId, status: "completed", createdAt };
  const lineWhere = { storeId, order: { is: completedInPeriod } };
  const [byStatus, totals, fulfillment, itemGroups, stationGroups, openTickets, readyTickets] = await Promise.all([
    context.prisma.cafeOrder.groupBy({ by: ["status"], where: { storeId, createdAt }, _count: { _all: true } }),
    context.prisma.cafeOrder.aggregate({ where: completedInPeriod, _count: { _all: true }, _sum: { subtotal: true, tax: true, tip: true, discount: true, total: true } }),
    context.prisma.$queryRawUnsafe(
      `SELECT COUNT(*)::int AS "count", AVG(EXTRACT(EPOCH FROM ("completedAt" - "createdAt")) / 60)::float8 AS "minutes"
       FROM "CafeOrder"
       WHERE "store" = $1 AND "status" = 'completed' AND "completedAt" IS NOT NULL AND "completedAt" >= "createdAt"
         AND "createdAt" >= ($2::timestamptz AT TIME ZONE 'UTC') AND "createdAt" < ($3::timestamptz AT TIME ZONE 'UTC')`,
      storeId,
      range.start.toISOString(),
      range.end.toISOString()
    ),
    // Stable product identity: group by the accepted line's menu item, never by display name.
    context.prisma.orderItem.groupBy({ by: ["menuItemId", "price", "itemNameSnapshot"], where: lineWhere, _sum: { quantity: true }, orderBy: [{ menuItemId: "asc" }, { price: "asc" }, { itemNameSnapshot: "asc" }], take: ITEM_GROUP_LIMIT + 1 }),
    context.prisma.orderItem.groupBy({ by: ["station"], where: lineWhere, _sum: { quantity: true } }),
    context.prisma.cafeOrder.count({ where: { storeId, status: { in: ACTIVE_ORDER_STATUSES } } }),
    context.prisma.cafeOrder.count({ where: { storeId, status: "ready" } })
  ]);
  const statusCount = (status) => int(byStatus.find((group) => group.status === status)?._count?._all);
  const orderCount = byStatus.reduce((sum, group) => sum + int(group._count?._all), 0);
  const completedCount = statusCount("completed");
  const items = /* @__PURE__ */ new Map();
  for (const group of itemGroups.slice(0, ITEM_GROUP_LIMIT)) {
    const menuItemId = typeof group.menuItemId === "string" ? group.menuItemId : null;
    const key = menuItemId ?? "unlinked";
    const quantity = int(group._sum?.quantity);
    const name2 = String(group.itemNameSnapshot || "");
    const current = items.get(key) || { key, menuItemId, name: menuItemId ? name2 : "Items without a menu link", nameQuantity: -1, quantity: 0, revenueCents: 0 };
    current.quantity += quantity;
    current.revenueCents += int(group.price) * quantity;
    if (menuItemId && quantity > current.nameQuantity && name2) {
      current.name = name2;
      current.nameQuantity = quantity;
    }
    items.set(key, current);
  }
  const fulfillmentRow = fulfillment[0];
  return {
    orderCount,
    completedCount,
    cancelledCount: statusCount("cancelled"),
    completionRatePercent: orderCount ? Math.round(completedCount / orderCount * 100) : 0,
    grossSalesCents: int(totals._sum?.subtotal),
    taxCents: int(totals._sum?.tax),
    tipCents: int(totals._sum?.tip),
    discountCents: int(totals._sum?.discount),
    averageFulfillmentMinutes: fulfillmentRow && int(fulfillmentRow.count) > 0 && fulfillmentRow.minutes != null ? Math.round(Number(fulfillmentRow.minutes)) : null,
    fulfillmentSampleCount: int(fulfillmentRow?.count),
    openTicketCount: openTickets,
    readyTicketCount: readyTickets,
    topItems: [...items.values()].sort((a, b) => b.revenueCents - a.revenueCents || b.quantity - a.quantity || a.key.localeCompare(b.key)).slice(0, TOP_ITEMS).map(({ key, menuItemId, name: name2, quantity, revenueCents }) => ({ key, menuItemId, name: name2 || "Menu item", quantity, revenueCents })),
    topItemsTruncated: itemGroups.length > ITEM_GROUP_LIMIT,
    stationProduction: stationGroups.map((group) => ({ station: String(group.station || "unassigned"), quantity: int(group._sum?.quantity) })).sort((a, b) => b.quantity - a.quantity || a.station.localeCompare(b.station))
  };
}
async function collectionsSection(context, storeId, range) {
  const inPeriod = { OR: [{ processedAt: { gte: range.start, lt: range.end } }, { processedAt: null, createdAt: { gte: range.start, lt: range.end } }] };
  const where = { storeId, status: { in: COLLECTED_PAYMENT_STATUSES }, ...inPeriod };
  const [groups, needsReviewCount] = await Promise.all([
    context.prisma.payment.groupBy({ by: ["currencyCode", "status"], where, _count: { _all: true }, _sum: { amount: true, refundedAmount: true } }),
    // Evidence that cannot be classified safely: refunded without an amount, captured with a refund amount, or over-refunded.
    context.prisma.payment.count({ where: { storeId, ...inPeriod, OR: [
      { status: "refunded", OR: [{ refundedAmount: null }, { refundedAmount: 0 }] },
      { status: "captured", refundedAmount: { gt: 0 } }
    ] } })
  ]);
  const currencies = [...new Set(groups.map((group) => String(group.currencyCode || "")))];
  const paymentCount = groups.reduce((sum, group) => sum + int(group._count?._all), 0);
  if (currencies.length > 1) {
    return { currencyCode: null, currencyMismatch: true, paymentCount, grossCollectedCents: null, refundedCents: null, netCollectedCents: null, needsReviewCount };
  }
  const gross = groups.reduce((sum, group) => sum + int(group._sum?.amount), 0);
  const refunded = groups.reduce((sum, group) => sum + int(group._sum?.refundedAmount), 0);
  return {
    currencyCode: currencies[0] || null,
    currencyMismatch: false,
    paymentCount,
    grossCollectedCents: gross,
    refundedCents: refunded,
    netCollectedCents: gross - refunded,
    needsReviewCount
  };
}
async function lowStockSection(context, storeId, page) {
  const [countRows, rows] = await Promise.all([
    context.prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS "count" FROM "InventoryItem" WHERE ${LOW_STOCK_WHERE}`, storeId),
    context.prisma.$queryRawUnsafe(
      `SELECT "id", "name", "category", "unit", "supplierName",
              COALESCE("currentStock", 0)::text AS "currentStock", COALESCE("reorderPoint", 0)::text AS "reorderPoint", COALESCE("parLevel", 0)::text AS "parLevel"
       FROM "InventoryItem" WHERE ${LOW_STOCK_WHERE}
       ORDER BY COALESCE("currentStock", 0) ASC, "id" ASC LIMIT $2 OFFSET $3`,
      storeId,
      LOW_STOCK_PAGE_SIZE,
      page * LOW_STOCK_PAGE_SIZE
    )
  ]);
  return {
    totalCount: int(countRows[0]?.count),
    page,
    pageSize: LOW_STOCK_PAGE_SIZE,
    items: rows.map((row) => ({
      id: String(row.id),
      name: String(row.name || ""),
      category: typeof row.category === "string" ? row.category : null,
      unit: typeof row.unit === "string" ? row.unit : null,
      currentStock: Number(row.currentStock),
      reorderPoint: Number(row.reorderPoint),
      parLevel: Number(row.parLevel),
      supplierName: typeof row.supplierName === "string" && row.supplierName ? row.supplierName : null
    }))
  };
}
async function loyaltySection(context, storeId) {
  const [totals, topAccounts] = await Promise.all([
    context.prisma.loyaltyAccount.aggregate({ where: { storeId }, _count: { _all: true }, _sum: { visits: true, drinkCredits: true } }),
    context.prisma.loyaltyAccount.findMany({ where: { storeId }, orderBy: [{ lifetimePoints: "desc" }, { id: "asc" }], take: 6, select: { id: true, tier: true, lifetimePoints: true, drinkCredits: true, visits: true, lastVisitAt: true, customerName: true, customerEmail: true } })
  ]);
  return {
    accountCount: int(totals._count?._all),
    totalVisits: int(totals._sum?.visits),
    outstandingDrinkCredits: int(totals._sum?.drinkCredits),
    topAccounts
  };
}
async function getCoffeeReports(_root, rawArgs, context) {
  const session = { session: context.session };
  const sections = {
    sales: permissions.canReadOrders(session),
    collections: permissions.canReadPayments(session),
    lowStock: permissions.canReadInventory(session),
    loyalty: permissions.canReadLoyalty(session)
  };
  if (!Object.values(sections).some(Boolean)) throw new Error("Not authorized to read cafe analytics");
  const args = rawArgs && typeof rawArgs === "object" ? rawArgs : {};
  const store = await context.prisma.storeSetting.findUnique({ where: { singletonKey: "primary" }, select: { id: true, timezone: true } });
  if (!store?.id) throw new Error("Primary coffee store is not configured");
  const storeId = String(store.id);
  const configured = typeof store.timezone === "string" && validCoffeeTimezone(store.timezone);
  const timeZone = configured ? String(store.timezone) : "UTC";
  const range = resolveReportPeriod(args, timeZone);
  const lowStockPage = Number.isSafeInteger(args.lowStockPage) && Number(args.lowStockPage) >= 0 && Number(args.lowStockPage) <= 1e4 ? Number(args.lowStockPage) : 0;
  const [sales, collections, lowStock, loyalty] = await Promise.all([
    sections.sales ? salesSection(context, storeId, range) : Promise.resolve(null),
    sections.collections ? collectionsSection(context, storeId, range) : Promise.resolve(null),
    sections.lowStock ? lowStockSection(context, storeId, lowStockPage) : Promise.resolve(null),
    sections.loyalty ? loyaltySection(context, storeId) : Promise.resolve(null)
  ]);
  return {
    storeTimezone: configured ? timeZone : null,
    period: { period: range.period, startDate: range.startDate, endDate: range.endDate, timezone: timeZone, timezoneConfigured: configured },
    sales,
    collections,
    lowStock,
    loyalty
  };
}
var REPORT_PERIODS, PERIOD_DAYS, MAX_CUSTOM_DAYS, LOW_STOCK_PAGE_SIZE, TOP_ITEMS, ITEM_GROUP_LIMIT, ACTIVE_ORDER_STATUSES, COLLECTED_PAYMENT_STATUSES, LOW_STOCK_WHERE;
var init_coffeeReportsQuery = __esm({
  "features/platform/reports/lib/coffeeReportsQuery.ts"() {
    "use strict";
    init_access();
    init_store_locale_policy();
    init_businessDate();
    REPORT_PERIODS = ["today", "7d", "30d", "90d", "custom"];
    PERIOD_DAYS = { today: 1, "7d": 7, "30d": 30, "90d": 90 };
    MAX_CUSTOM_DAYS = 366;
    LOW_STOCK_PAGE_SIZE = 10;
    TOP_ITEMS = 8;
    ITEM_GROUP_LIMIT = 5e3;
    ACTIVE_ORDER_STATUSES = ["accepted", "paid", "in_bar_queue", "preparing", "ready"];
    COLLECTED_PAYMENT_STATUSES = ["captured", "refunded"];
    LOW_STOCK_WHERE = `"store" = $1 AND (
  COALESCE("currentStock", 0) <= COALESCE("reorderPoint", 0)
  OR (COALESCE("parLevel", 0) > 0 AND COALESCE("currentStock", 0) < COALESCE("parLevel", 0) * 0.35)
)`;
  }
});

// features/keystone/mutations/getCoffeeOperationsSnapshot.ts
function text33(value, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
function toNumber(value) {
  const parsed = Number(value == null ? NaN : String(value));
  return Number.isFinite(parsed) ? parsed : null;
}
function encodeCursor(payload) {
  const cursor = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  if (cursor.length > CURSOR_MAX_LENGTH) throw new Error("Cannot continue this list");
  return cursor;
}
function decodeCursor(value, binding) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || value.length > CURSOR_MAX_LENGTH) throw new Error("Invalid list position");
  const bytes = Buffer.from(value, "base64url");
  if (!bytes.length || bytes.toString("base64url") !== value) throw new Error("Invalid list position");
  const parsed = JSON.parse(bytes.toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Invalid list position");
  const cursor = parsed;
  if (cursor.kind !== binding.kind || cursor.storeId !== binding.storeId || (cursor.search ?? "") !== (binding.search ?? "")) throw new Error("Invalid list position");
  if (typeof cursor.id !== "string" || !cursor.id || cursor.id.length > 255) throw new Error("Invalid list position");
  return cursor;
}
async function namePage(input) {
  const pageSize = input.pageSize ?? OPTION_PAGE_SIZE;
  try {
    const cursor = decodeCursor(input.cursor, { kind: input.kind, storeId: input.storeId, search: input.search });
    const and = [];
    if (input.search && input.searchWhere) and.push(input.searchWhere(input.search));
    if (cursor) {
      if (typeof cursor.key !== "string") throw new Error("Invalid list position");
      and.push({ OR: [{ [input.orderField]: { gt: cursor.key } }, { [input.orderField]: cursor.key, id: { gt: cursor.id } }] });
    }
    const rows = await input.model.findMany({
      where: { ...input.where, ...and.length ? { AND: and } : {} },
      orderBy: [{ [input.orderField]: "asc" }, { id: "asc" }],
      take: pageSize + 1,
      select: { ...input.select, id: true, [input.orderField]: true }
    });
    const page = rows.slice(0, pageSize);
    const hasMore = rows.length > pageSize;
    const last = page[page.length - 1];
    return {
      items: page.map(input.map),
      hasMore,
      nextCursor: hasMore && last ? encodeCursor({ kind: input.kind, storeId: input.storeId, search: input.search, key: String(last[input.orderField] ?? ""), id: last.id }) : null,
      loadError: false
    };
  } catch {
    return emptyPage(true);
  }
}
async function createdPage(input) {
  try {
    const cursor = decodeCursor(input.cursor, { kind: input.kind, storeId: input.storeId });
    let after = null;
    if (cursor) {
      const createdAt = typeof cursor.createdAt === "string" ? new Date(cursor.createdAt) : null;
      if (!createdAt || !Number.isFinite(createdAt.getTime()) || createdAt.toISOString() !== cursor.createdAt) throw new Error("Invalid list position");
      after = { OR: [{ createdAt: { gt: createdAt } }, { createdAt, id: { gt: cursor.id } }] };
    }
    const rows = await input.model.findMany({
      where: { ...input.where, ...after ? { AND: [after] } : {} },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: input.pageSize + 1,
      select: { ...input.select, id: true, createdAt: true }
    });
    const page = rows.slice(0, input.pageSize);
    const hasMore = rows.length > input.pageSize;
    const last = page[page.length - 1];
    const lastCreated = last?.createdAt instanceof Date ? last.createdAt : last ? new Date(String(last.createdAt)) : null;
    return {
      items: page.map(input.map),
      hasMore,
      nextCursor: hasMore && last && lastCreated ? encodeCursor({ kind: input.kind, storeId: input.storeId, createdAt: lastCreated.toISOString(), id: last.id }) : null,
      loadError: false
    };
  } catch {
    return emptyPage(true);
  }
}
function staffShiftRow(shift) {
  const actions = shift.status === "scheduled" ? [{ status: "clocked_in", label: "Clock in", tone: "default" }] : shift.status === "clocked_in" ? [{ status: "completed", label: "Clock out", tone: "default" }] : [];
  return { ...shift, actions };
}
async function getCoffeeOperations(_root, rawArgs, context) {
  const session = { session: context.session };
  const sections = {
    inventory: permissions.canReadInventory(session),
    inventoryManage: permissions.canManageInventory(session),
    products: permissions.canReadProducts(session),
    staffing: permissions.canManageSettings(session),
    payments: permissions.canReadPayments(session),
    catering: permissions.canReadOrders(session),
    subscriptions: permissions.canReadLoyalty(session)
  };
  if (!permissions.canAccessDashboard(session) || !Object.values(sections).some(Boolean)) throw new Error("Not authorized to view Coffee Operations");
  const store = await context.prisma.storeSetting.findUnique({ where: { singletonKey: "primary" }, select: { id: true, timezone: true } });
  if (!store) throw new Error("Primary coffee store is not configured");
  const storeId = store.id;
  const where = { storeId };
  const recent = { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: RECENT };
  const args = rawArgs && typeof rawArgs === "object" ? rawArgs : {};
  const none = () => Promise.resolve([]);
  const noPage = () => Promise.resolve(emptyPage());
  const optionMap = (row) => ({ id: row.id, name: String(row.name ?? ""), detail: null, unit: null, currentStock: null });
  const searches = {
    purchaseSupplier: text33(args.purchaseSupplierSearch),
    purchaseInventory: text33(args.purchaseInventorySearch),
    inventoryWaste: text33(args.inventoryWasteSearch),
    prepBatch: text33(args.prepBatchSearch),
    recipe: text33(args.recipeSearch),
    staff: text33(args.staffSearch)
  };
  const [
    recipes,
    ingredients,
    inventoryLots,
    suppliers,
    purchaseOrders,
    prepBatches,
    wasteLogs,
    posOrders,
    subscriptions,
    cateringOrders,
    recentStaffShifts,
    receiptPurchaseOrders,
    purchaseSuppliers,
    purchaseInventoryItems,
    inventoryWasteItems,
    wastePrepBatches,
    prepRecipes,
    staffMembers,
    activeStaffShifts,
    activeStaffShiftCount
  ] = await Promise.all([
    sections.products ? context.prisma.recipe.findMany({ where, ...recent, select: { id: true, name: true, status: true, yieldQuantity: true, yieldUnit: true, active: true, menuItem: { select: { id: true, name: true } } } }) : none(),
    sections.products ? context.prisma.ingredient.findMany({ where, ...recent, select: { id: true, name: true, quantity: true, unit: true, optional: true, recipe: { select: { id: true, name: true } }, inventoryItem: { select: { id: true, name: true } } } }) : none(),
    sections.inventory ? context.prisma.inventoryLot.findMany({ where, ...recent, select: { id: true, lotNumber: true, quantityReceived: true, quantityRemaining: true, unitCostCents: true, status: true, expiresAt: true, inventoryItem: { select: { id: true, name: true } }, supplier: { select: { id: true, name: true } } } }) : none(),
    sections.inventory ? context.prisma.supplier.findMany({ where, ...recent, select: { id: true, name: true, status: true, contactName: true, email: true, phone: true, leadTimeDays: true } }) : none(),
    sections.inventory ? context.prisma.purchaseOrder.findMany({ where, ...recent, select: { id: true, poNumber: true, status: true, subtotalCents: true, expectedAt: true, supplier: { select: { id: true, name: true } } } }) : none(),
    sections.inventory ? context.prisma.prepBatch.findMany({ where, ...recent, select: { id: true, batchNumber: true, status: true, quantityMade: true, expiresAt: true, recipe: { select: { id: true, name: true } }, preparedBy: { select: { id: true, name: true } } } }) : none(),
    sections.inventory ? context.prisma.wasteLog.findMany({ where, ...recent, select: { id: true, logNumber: true, reason: true, quantity: true, unit: true, costCents: true, inventoryItem: { select: { id: true, name: true } }, prepBatch: { select: { batchNumber: true } } } }) : none(),
    sections.payments ? context.prisma.posOrder.findMany({ where, ...recent, select: { id: true, receiptNumber: true, registerName: true, status: true, subtotalCents: true, taxCents: true, tipCents: true, totalCents: true, cashier: { select: { id: true, name: true } } } }) : none(),
    sections.subscriptions ? context.prisma.subscription.findMany({ where, ...recent, select: { id: true, subscriptionNumber: true, status: true, planName: true, billingInterval: true, priceCents: true, renewsAt: true } }) : none(),
    sections.catering ? context.prisma.cateringOrder.findMany({ where, ...recent, select: { id: true, cateringNumber: true, customerName: true, customerEmail: true, status: true, eventAt: true, guestCount: true, subtotalCents: true } }) : none(),
    sections.staffing ? context.prisma.staffShift.findMany({ where: { storeId, status: { in: ["completed", "missed"] } }, ...recent, select: shiftSelect }) : none(),
    sections.inventoryManage ? createdPage({
      model: context.prisma.purchaseOrder,
      kind: "receipt-purchase-orders",
      storeId,
      where: { storeId, status: "submitted" },
      cursor: args.receiptCursor,
      pageSize: RECEIPT_PAGE_SIZE,
      select: { poNumber: true, status: true, subtotalCents: true, expectedAt: true, orderedQuantity: true, unitCostCents: true, supplier: { select: { id: true, name: true } }, inventoryItem: { select: { id: true, name: true, unit: true } } },
      map: (row) => ({ ...row, orderedQuantity: toNumber(row.orderedQuantity) })
    }) : noPage(),
    sections.inventoryManage ? namePage({
      model: context.prisma.supplier,
      kind: "active-suppliers",
      storeId,
      where: { storeId, status: "active" },
      orderField: "name",
      search: searches.purchaseSupplier,
      searchWhere: contains("name"),
      cursor: args.purchaseSupplierCursor,
      select: { name: true },
      map: optionMap
    }) : noPage(),
    sections.inventoryManage ? namePage({
      model: context.prisma.inventoryItem,
      kind: "purchase-inventory-items",
      storeId,
      where: { storeId },
      orderField: "name",
      search: searches.purchaseInventory,
      searchWhere: contains("name"),
      cursor: args.purchaseInventoryCursor,
      // Every item, including those at 0, so Count stock can bring a sold-out item back.
      select: { name: true, unit: true, currentStock: true },
      map: (row) => ({ ...optionMap(row), unit: typeof row.unit === "string" ? row.unit : null, currentStock: toNumber(row.currentStock) })
    }) : noPage(),
    sections.inventoryManage ? namePage({
      model: context.prisma.inventoryItem,
      kind: "positive-stock-inventory",
      storeId,
      where: { storeId, currentStock: { gt: 0 } },
      orderField: "name",
      search: searches.inventoryWaste,
      searchWhere: contains("name"),
      cursor: args.inventoryWasteCursor,
      select: { name: true, unit: true, currentStock: true },
      map: (row) => ({ ...optionMap(row), unit: typeof row.unit === "string" ? row.unit : null, currentStock: toNumber(row.currentStock) })
    }) : noPage(),
    sections.inventoryManage ? namePage({
      model: context.prisma.prepBatch,
      kind: "waste-prep-batches",
      storeId,
      where: { storeId, status: "completed", quantityRemaining: { gt: 0 } },
      orderField: "batchNumber",
      search: searches.prepBatch,
      searchWhere: (search) => ({ OR: [{ batchNumber: { contains: search, mode: "insensitive" } }, { recipe: { is: { name: { contains: search, mode: "insensitive" } } } }] }),
      cursor: args.prepBatchCursor,
      select: { quantityRemaining: true, recipe: { select: { name: true, yieldUnit: true } } },
      map: (row) => {
        const recipe = row.recipe;
        const unit = typeof recipe?.yieldUnit === "string" ? recipe.yieldUnit : null;
        return { id: row.id, name: String(row.batchNumber ?? ""), detail: typeof recipe?.name === "string" ? recipe.name : null, unit, currentStock: toNumber(row.quantityRemaining) };
      }
    }) : noPage(),
    sections.inventoryManage ? namePage({
      model: context.prisma.recipe,
      kind: "prep-recipes",
      storeId,
      where: { storeId, active: true, status: "active" },
      orderField: "name",
      search: searches.recipe,
      searchWhere: contains("name"),
      cursor: args.recipeCursor,
      select: { name: true, yieldQuantity: true, yieldUnit: true },
      map: (row) => ({ ...optionMap(row), unit: typeof row.yieldUnit === "string" ? row.yieldUnit : null, detail: row.yieldQuantity == null ? null : `Yields ${String(toNumber(row.yieldQuantity) ?? "")} ${String(row.yieldUnit ?? "")}`.trim() })
    }) : noPage(),
    // Staff are dashboard accounts in this single-cafe deployment; the scheduler holds the same authority as the command.
    sections.staffing ? namePage({
      model: context.prisma.user,
      kind: "staff-members",
      storeId,
      where: { role: { is: { canAccessDashboard: true } } },
      orderField: "name",
      search: searches.staff,
      searchWhere: (search) => ({ OR: [{ name: { contains: search, mode: "insensitive" } }, { email: { contains: search, mode: "insensitive" } }] }),
      cursor: args.staffCursor,
      select: { name: true, email: true },
      map: (row) => ({ ...optionMap(row), name: String(row.name || row.email || "Staff member"), detail: typeof row.email === "string" ? row.email : null })
    }) : noPage(),
    sections.staffing ? createdPage({
      model: context.prisma.staffShift,
      kind: "active-staff-shifts",
      storeId,
      where: { storeId, status: { in: ["scheduled", "clocked_in"] } },
      cursor: args.shiftCursor,
      pageSize: SHIFT_PAGE_SIZE,
      select: shiftSelect,
      map: staffShiftRow
    }) : noPage(),
    sections.staffing ? context.prisma.staffShift.count({ where: { storeId, status: { in: ["scheduled", "clocked_in"] } } }).catch(() => null) : Promise.resolve(null)
  ]);
  return {
    sections,
    storeTimezone: typeof store.timezone === "string" ? store.timezone : null,
    // Partitions this browser's unsaved drafts by account and store; not an authorization token.
    draftScope: (0, import_node_crypto5.createHash)("sha256").update(`coffee-operations:${context.session?.itemId ?? ""}:${storeId}`).digest("hex").slice(0, 24),
    recipes,
    ingredients,
    inventoryLots,
    suppliers,
    purchaseOrders,
    prepBatches,
    wasteLogs,
    posOrders,
    subscriptions: subscriptions.map((subscription) => ({ ...subscription, actions: [] })),
    cateringOrders: cateringOrders.map((order) => ({ ...order, actions: [] })),
    recentStaffShifts: recentStaffShifts.map(staffShiftRow),
    receiptPurchaseOrders,
    purchaseSuppliers,
    purchaseInventoryItems,
    inventoryWasteItems,
    wastePrepBatches,
    prepRecipes,
    staffMembers,
    activeStaffShifts: { ...activeStaffShifts, totalCount: activeStaffShiftCount }
  };
}
var import_node_crypto5, OPTION_PAGE_SIZE, RECEIPT_PAGE_SIZE, SHIFT_PAGE_SIZE, RECENT, CURSOR_MAX_LENGTH, emptyPage, contains, shiftSelect;
var init_getCoffeeOperationsSnapshot = __esm({
  "features/keystone/mutations/getCoffeeOperationsSnapshot.ts"() {
    "use strict";
    import_node_crypto5 = require("node:crypto");
    init_access();
    OPTION_PAGE_SIZE = 100;
    RECEIPT_PAGE_SIZE = 50;
    SHIFT_PAGE_SIZE = 25;
    RECENT = 8;
    CURSOR_MAX_LENGTH = 2048;
    emptyPage = (loadError = false) => ({ items: [], hasMore: false, nextCursor: null, loadError });
    contains = (field) => (search) => ({ [field]: { contains: search, mode: "insensitive" } });
    shiftSelect = { id: true, storeId: true, shiftNumber: true, role: true, status: true, startsAt: true, endsAt: true, clockInAt: true, clockOutAt: true, staff: { select: { id: true, name: true, email: true } } };
  }
});

// features/keystone/mutations/coffeeBoundaryQueries.ts
function requirePermission(allowed, message) {
  if (!allowed) throw new Error(message);
}
function statusActions(transitions, current, excluded = []) {
  return (transitions[current] || []).filter((status) => !excluded.includes(status)).map((status) => ({ status, label: statusLabels[status] || status.replaceAll("_", " "), tone: status === "cancelled" ? "danger" : "default" }));
}
function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
function validateModifierSelections(menuItem, selected) {
  const groups = /* @__PURE__ */ new Map();
  for (const modifier of menuItem.modifiers) {
    const group = modifier.modifierGroup || "default";
    groups.set(group, [...groups.get(group) || [], modifier]);
  }
  for (const [group, modifiers] of groups) {
    const selectedCount = selected.filter((modifier) => (modifier.modifierGroup || "default") === group).length;
    const minimum = Math.max(modifiers.some((modifier) => modifier.required) ? 1 : 0, ...modifiers.map((modifier) => number(modifier.minSelections)));
    const maximum = Math.max(...modifiers.map((modifier) => Math.max(1, number(modifier.maxSelections))));
    const label = modifiers[0]?.modifierGroupLabel || group;
    if (selectedCount < minimum) throw new Error(`${menuItem.name} requires at least ${minimum} ${label} selection${minimum === 1 ? "" : "s"}`);
    if (selectedCount > maximum) throw new Error(`${menuItem.name} allows at most ${maximum} ${label} selection${maximum === 1 ? "" : "s"}`);
  }
}
async function primaryStore(context) {
  const store = await context.prisma.storeSetting.findUnique({ where: { singletonKey: "primary" }, select: { id: true, pickupLeadTimeMinutes: true, pickupWindowMinutes: true, pickupCapacityPerWindow: true, taxRateBasisPoints: true, timezone: true, weeklyHours: true } });
  if (!store?.id) throw new Error("Primary coffee store is not configured");
  return {
    id: String(store.id),
    pickupLeadTimeMinutes: number(store.pickupLeadTimeMinutes) || 12,
    pickupWindowMinutes: number(store.pickupWindowMinutes) || 15,
    pickupCapacityPerWindow: number(store.pickupCapacityPerWindow) || 20,
    taxRateBasisPoints: store.taxRateBasisPoints == null ? 875 : number(store.taxRateBasisPoints),
    timezone: typeof store.timezone === "string" ? store.timezone : "America/New_York",
    storeTimezone: typeof store.timezone === "string" ? store.timezone : null,
    weeklyHours: store.weeklyHours
  };
}
function staleCutoff() {
  return new Date(Date.now() - STALE_TICKET_HOURS * 36e5);
}
function currentTicketWhere(cutoff) {
  return { OR: [{ promisedAt: { gte: cutoff } }, { promisedAt: null, createdAt: { gte: cutoff } }] };
}
function staleTicketWhere(cutoff) {
  return { OR: [{ promisedAt: { lt: cutoff } }, { promisedAt: null, createdAt: { lt: cutoff } }] };
}
function allowlisted(value, allowed, label) {
  if (value == null || value === "") return allowed[0];
  if (typeof value !== "string" || !allowed.includes(value)) throw new Error(`Unsupported ${label} filter`);
  return value;
}
function cursorFilterMatches(cursor, filter) {
  return cursor.filter === void 0 ? filter === "all|all" : cursor.filter === filter;
}
function decodeActiveOrderCursor(value, search, filter) {
  if (value == null) return null;
  if (typeof value !== "string" || !value || value.length > 2048) throw new Error("Invalid active order cursor");
  try {
    const bytes = Buffer.from(value, "base64url");
    if (!bytes.length || bytes.toString("base64url") !== value) throw new Error();
    const parsed = JSON.parse(bytes.toString("utf8"));
    if (!parsed || typeof parsed !== "object") throw new Error();
    const cursor = parsed;
    if (cursor.kind !== void 0 && cursor.kind !== "active" || typeof cursor.id !== "string" || !cursor.id || cursor.id.length > 255) throw new Error();
    if (typeof cursor.storeId !== "string" || !cursor.storeId || cursor.storeId.length > 255) throw new Error();
    if (typeof cursor.search !== "string" || cursor.search !== search || !cursorFilterMatches(cursor, filter)) throw new Error();
    if (typeof cursor.createdAt !== "string") throw new Error();
    const createdAt = new Date(cursor.createdAt);
    if (!Number.isFinite(createdAt.getTime()) || createdAt.toISOString() !== cursor.createdAt) throw new Error();
    return { createdAt, id: cursor.id, storeId: cursor.storeId };
  } catch {
    throw new Error("Invalid active order cursor");
  }
}
function encodeActiveOrderCursor(order, search, filter, storeId) {
  const id = typeof order.id === "string" ? order.id : "";
  const createdAt = order.createdAt instanceof Date ? order.createdAt : new Date(String(order.createdAt));
  if (!id || id.length > 255 || !Number.isFinite(createdAt.getTime())) throw new Error("Cannot create active order cursor");
  return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id, search, filter, storeId }), "utf8").toString("base64url");
}
function decodeHistoryOrderCursor(value, search, filter) {
  if (value == null) return null;
  if (typeof value !== "string" || !value || value.length > 2048) throw new Error("Invalid history order cursor");
  try {
    const bytes = Buffer.from(value, "base64url");
    if (!bytes.length || bytes.toString("base64url") !== value) throw new Error();
    const parsed = JSON.parse(bytes.toString("utf8"));
    if (!parsed || typeof parsed !== "object") throw new Error();
    const cursor = parsed;
    if (cursor.kind !== "history" || typeof cursor.id !== "string" || !cursor.id || cursor.id.length > 255) throw new Error();
    if (typeof cursor.storeId !== "string" || !cursor.storeId || cursor.storeId.length > 255) throw new Error();
    if (typeof cursor.search !== "string" || cursor.search !== search || !cursorFilterMatches(cursor, filter) || typeof cursor.createdAt !== "string") throw new Error();
    const createdAt = new Date(cursor.createdAt);
    if (!Number.isFinite(createdAt.getTime()) || createdAt.toISOString() !== cursor.createdAt) throw new Error();
    return { createdAt, id: cursor.id, storeId: cursor.storeId };
  } catch {
    throw new Error("Invalid history order cursor");
  }
}
function encodeHistoryOrderCursor(order, search, filter, storeId) {
  const id = typeof order.id === "string" ? order.id : "";
  const createdAt = order.createdAt instanceof Date ? order.createdAt : new Date(String(order.createdAt));
  if (!id || id.length > 255 || !Number.isFinite(createdAt.getTime())) throw new Error("Cannot create history order cursor");
  return Buffer.from(JSON.stringify({ kind: "history", createdAt: createdAt.toISOString(), id, search, filter, storeId }), "utf8").toString("base64url");
}
async function getCoffeeOrderQueue(_root, args, context) {
  requirePermission(permissions.canReadOrders({ session: context.session }), "Not authorized to read the order queue");
  const search = args.search?.trim().slice(0, 200) || "";
  const statusFilter = allowlisted(args.status, ORDER_QUEUE_STATUS_FILTERS, "order status");
  const fulfillmentFilter = allowlisted(args.fulfillment, ORDER_QUEUE_FULFILLMENT_FILTERS, "fulfillment");
  const filterKey = `${statusFilter}|${fulfillmentFilter}`;
  const activeCursor = decodeActiveOrderCursor(args.activeCursor, search, filterKey);
  const historyCursor = decodeHistoryOrderCursor(args.historyCursor, search, filterKey);
  const includeHistory = args.includeCompleted !== false;
  triggerEndOfDayClose(context.prisma);
  const store = await primaryStore(context);
  if (activeCursor && activeCursor.storeId !== store.id) throw new Error("Invalid active order cursor");
  if (historyCursor && historyCursor.storeId !== store.id) throw new Error("Invalid history order cursor");
  const allActiveStatuses = ["open", "accepted", "paid", "in_bar_queue", "preparing", "ready"];
  const allHistoryStatuses = ["completed", "refunded", "cancelled"];
  const activeStatuses = statusFilter === "all" ? allActiveStatuses : allActiveStatuses.filter((status) => status === statusFilter);
  const historyStatuses = !includeHistory ? [] : statusFilter === "all" ? allHistoryStatuses : allHistoryStatuses.filter((status) => status === statusFilter);
  const matchingOrders = {
    storeId: store.id,
    ...fulfillmentFilter !== "all" ? { fulfillmentType: fulfillmentFilter } : {},
    ...search ? { OR: ["orderNumber", "customerName", "customerEmail", "pickupName"].map((field) => ({ [field]: { contains: search, mode: "insensitive" } })) } : {}
  };
  const cutoff = staleCutoff();
  const activeCountWhere = { ...matchingOrders, status: { in: activeStatuses }, AND: [currentTicketWhere(cutoff)] };
  const staleWhere = { ...matchingOrders, status: { in: activeStatuses }, AND: [staleTicketWhere(cutoff)] };
  const historyWhere = { ...matchingOrders, status: { in: historyStatuses } };
  const historyPageWhere = {
    ...historyWhere,
    ...historyCursor ? { AND: [{ OR: [
      { createdAt: { lt: historyCursor.createdAt } },
      { createdAt: historyCursor.createdAt, id: { lt: historyCursor.id } }
    ] }] } : {}
  };
  const countedOrdersWhere = { ...matchingOrders, status: { in: [...allActiveStatuses, ...includeHistory ? allHistoryStatuses : []] } };
  const activePageWhere = {
    ...activeCountWhere,
    ...activeCursor ? { AND: [currentTicketWhere(cutoff), { OR: [
      { createdAt: { gt: activeCursor.createdAt } },
      { createdAt: activeCursor.createdAt, id: { gt: activeCursor.id } }
    ] }] } : {}
  };
  const orderSelect = {
    id: true,
    orderNumber: true,
    status: true,
    fulfillmentType: true,
    orderSource: true,
    customerName: true,
    customerEmail: true,
    pickupName: true,
    promisedAt: true,
    total: true,
    discount: true,
    isRush: true,
    createdAt: true,
    loyaltyAccountId: true,
    orderItems: { select: { id: true, quantity: true, itemNameSnapshot: true, customizationsSummary: true, barStatus: true, station: true } },
    payments: { where: { status: { in: ["captured", "pending", "authorized", "refunded"] } }, select: { id: true, status: true, method: true, provider: true, amount: true, refundedAmount: true, refundIdempotencyKey: true } }
  };
  const [activeTickets, historyTickets, groupedCounts, staleTickets, staleCount, liveCount] = await Promise.all([
    activeStatuses.length ? context.prisma.cafeOrder.findMany({ where: activePageWhere, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: ORDER_QUEUE_ACTIVE_PAGE_SIZE + 1, select: orderSelect }) : Promise.resolve([]),
    historyStatuses.length ? context.prisma.cafeOrder.findMany({ where: historyPageWhere, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: ORDER_QUEUE_ACTIVE_PAGE_SIZE + 1, select: orderSelect }) : Promise.resolve([]),
    context.prisma.cafeOrder.groupBy({ by: ["status"], where: countedOrdersWhere, _count: { _all: true } }),
    // Past pickups never collected or closed: shown apart so staff can close them out, oldest first.
    activeStatuses.length && !activeCursor ? context.prisma.cafeOrder.findMany({ where: staleWhere, orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: ORDER_QUEUE_ACTIVE_PAGE_SIZE, select: orderSelect }) : Promise.resolve([]),
    activeStatuses.length ? context.prisma.cafeOrder.count({ where: staleWhere }) : Promise.resolve(0),
    activeStatuses.length ? context.prisma.cafeOrder.count({ where: activeCountWhere }) : Promise.resolve(0)
  ]);
  const countByStatus = new Map(groupedCounts.map(({ status, _count: count2 }) => [String(status), count2._all]));
  const count = (status) => countByStatus.get(status) || 0;
  const activeCount = allActiveStatuses.reduce((total, status) => total + count(status), 0);
  const activeItems = activeTickets.slice(0, ORDER_QUEUE_ACTIVE_PAGE_SIZE);
  const activeHasMore = activeTickets.length > ORDER_QUEUE_ACTIVE_PAGE_SIZE;
  const activeNextCursor = activeHasMore && activeItems.length ? encodeActiveOrderCursor(activeItems[activeItems.length - 1], search, filterKey, store.id) : null;
  const historyItems = historyTickets.slice(0, ORDER_QUEUE_ACTIVE_PAGE_SIZE);
  const historyHasMore = historyTickets.length > ORDER_QUEUE_ACTIVE_PAGE_SIZE;
  const historyNextCursor = historyHasMore && historyItems.length ? encodeHistoryOrderCursor(historyItems[historyItems.length - 1], search, filterKey, store.id) : null;
  const historyCount = historyStatuses.reduce((total, status) => total + count(status), 0);
  const staleIds = new Set(staleTickets.map((ticket) => ticket.id));
  const tickets = [...activeItems, ...staleTickets, ...historyItems];
  const canManageOrders = permissions.canManageOrders({ session: context.session });
  const canManagePayments = permissions.canManagePayments({ session: context.session });
  const canManageLoyalty = permissions.canManageLoyalty({ session: context.session });
  const canSeePaymentState = canManageOrders || canManagePayments;
  return {
    summary: {
      allCount: [...allActiveStatuses, ...includeHistory ? allHistoryStatuses : []].reduce((total, status) => total + count(status), 0),
      activeCount,
      openCount: count("open"),
      acceptedCount: count("accepted"),
      paidCount: count("paid"),
      queuedCount: count("in_bar_queue"),
      preparingCount: count("preparing"),
      readyCount: count("ready"),
      completedCount: count("completed"),
      cancelledCount: count("cancelled"),
      refundedCount: count("refunded")
    },
    capabilities: { canManageOrders, canManagePayments, canManageLoyalty },
    filters: { status: statusFilter, fulfillment: fulfillmentFilter },
    storeTimezone: store.storeTimezone,
    activeCount: liveCount,
    staleCount,
    lastDayClose: activeCursor ? null : await latestDayClose(context.prisma, store.id).catch(() => null),
    activeHasMore,
    activeNextCursor,
    historyCount,
    historyHasMore,
    historyNextCursor,
    tickets: tickets.map(({ payments, loyaltyAccountId, ...ticket }) => {
      const paymentEvidence = Array.isArray(payments) ? payments : [];
      const activeEvidence = paymentEvidence.filter((payment) => ["captured", "pending", "authorized"].includes(String(payment.status)));
      const unresolved = activeEvidence.some((payment) => payment.status === "pending" || payment.status === "authorized");
      const settled = hasCafeSettlement(paymentEvidence, number(ticket.total) - number(ticket.discount));
      const status = String(ticket.status);
      const paymentState = unresolved ? "pending" : activeEvidence.some((payment) => payment.status === "captured") ? "paid" : paymentEvidence.some((payment) => payment.status === "refunded") ? "refunded" : "unpaid";
      return {
        ...ticket,
        status,
        isStale: staleIds.has(String(ticket.id)),
        orderItems: Array.isArray(ticket.orderItems) ? ticket.orderItems : [],
        // Payment state is a workflow fact for order/payment staff; tender details stay with payment managers.
        paymentState: canSeePaymentState ? paymentState : null,
        // An unfinished online page doesn't block counter payment: recording it closes the page first.
        canRecordPayment: canManageOrders && canManagePayments && ["open", "accepted", "in_bar_queue", "preparing", "ready"].includes(status) && !activeEvidence.some((payment) => payment.status === "captured"),
        // Loyalty staff get only an eligibility bit, not payment details.
        canApplyLoyalty: canManageLoyalty && settled && !loyaltyAccountId && Boolean(ticket.customerEmail) && !["cancelled", "refunded"].includes(status),
        loyaltyApplied: canManageLoyalty ? Boolean(loyaltyAccountId) : null,
        refundablePayments: canManageOrders && canManagePayments ? activeEvidence.filter((payment) => payment.status === "captured" && !payment.refundIdempotencyKey) : [],
        actions: canManageOrders ? statusActions(CAFE_ORDER_TRANSITIONS, status, ["refunded", "paid", "ready", ...!settled ? ["completed"] : [], ...activeEvidence.some((payment) => payment.status === "captured") ? ["cancelled"] : []]) : []
      };
    })
  };
}
function decodeKdsCursor(value) {
  if (!value || value.length > 512) throw new Error("Invalid KDS page cursor");
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (!parsed || typeof parsed !== "object") throw new Error();
    const cursor = parsed;
    if (typeof cursor.id !== "string" || !cursor.id || cursor.id.length > 255) throw new Error();
    if (cursor.queuedAt !== null && (typeof cursor.queuedAt !== "string" || !Number.isFinite(Date.parse(cursor.queuedAt)))) throw new Error();
    return { id: cursor.id, queuedAt: cursor.queuedAt };
  } catch {
    throw new Error("Invalid KDS page cursor");
  }
}
function encodeKdsCursor(item) {
  const queuedAt = item.queuedAt == null ? null : new Date(String(item.queuedAt)).toISOString();
  return Buffer.from(JSON.stringify({ id: String(item.id), queuedAt }), "utf8").toString("base64url");
}
function kdsAfterCursorWhere(cursor) {
  if (cursor.queuedAt === null) return { queuedAt: null, id: { gt: cursor.id } };
  const queuedAt = new Date(cursor.queuedAt);
  return {
    OR: [
      { queuedAt: { gt: queuedAt } },
      { queuedAt, id: { gt: cursor.id } },
      { queuedAt: null }
    ]
  };
}
async function getCoffeeKdsBoard(_root, args, context) {
  requirePermission(permissions.canReadOrders({ session: context.session }), "Not authorized to read the KDS");
  const limit = args.limit ?? KDS_PAGE_SIZE;
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > KDS_PAGE_SIZE) throw new Error(`KDS page size must be between 1 and ${KDS_PAGE_SIZE}`);
  const cursor = args.cursor == null ? null : decodeKdsCursor(args.cursor);
  triggerEndOfDayClose(context.prisma);
  const store = await primaryStore(context);
  const releaseBy = new Date(Date.now() + KDS_RELEASE_MINUTES * 6e4);
  const baseWhere = {
    storeId: store.id,
    barStatus: { in: KDS_ACTIVE_ITEM_STATUSES },
    // Past pickups leave the make line; they are closed out from Orders.
    order: { status: { in: KDS_ACTIVE_ORDER_STATUSES }, ...currentTicketWhere(staleCutoff()) }
  };
  const activeWhere = {
    ...baseWhere,
    OR: [{ order: { promisedAt: null } }, { order: { promisedAt: { lte: releaseBy } } }, { barStatus: { in: ["preparing", "ready"] } }]
  };
  const scheduledWhere = { ...baseWhere, barStatus: { in: ["new", "queued"] }, order: { ...baseWhere.order, promisedAt: { gt: releaseBy } } };
  const pageWhere = cursor ? { ...activeWhere, AND: [kdsAfterCursorWhere(cursor)] } : activeWhere;
  const [rows, activeCount, scheduledCount, nextScheduled] = await Promise.all([
    context.prisma.orderItem.findMany({
      where: pageWhere,
      orderBy: [{ queuedAt: { sort: "asc", nulls: "last" } }, { id: "asc" }],
      take: limit + 1,
      select: { id: true, quantity: true, itemNameSnapshot: true, customizationsSummary: true, specialInstructions: true, barStatus: true, station: true, queuedAt: true, startedAt: true, readyAt: true, order: { select: { id: true, orderNumber: true, status: true, pickupName: true, promisedAt: true, isRush: true } } }
    }),
    context.prisma.orderItem.count({ where: activeWhere }),
    context.prisma.orderItem.count({ where: scheduledWhere }),
    context.prisma.orderItem.findFirst({ where: scheduledWhere, orderBy: { order: { promisedAt: "asc" } }, select: { order: { select: { promisedAt: true } } } })
  ]);
  const hasMore = rows.length > limit;
  const due = (item) => new Date(String(item.order?.promisedAt ?? item.queuedAt ?? 0)).getTime() || 0;
  const items = rows.slice(0, limit).sort((a, b) => due(a) - due(b));
  const canManageOrders = permissions.canManageOrders({ session: context.session });
  const nextPromisedAt = nextScheduled?.order?.promisedAt;
  const nextScheduledAt = nextPromisedAt ? new Date(String(nextPromisedAt)).toISOString() : null;
  return {
    activeCount,
    scheduledCount,
    nextScheduledAt,
    canManageOrders,
    storeTimezone: store.storeTimezone,
    hasMore,
    nextCursor: hasMore && items.length ? encodeKdsCursor(items[items.length - 1]) : null,
    items: items.map((item) => {
      const status = String(item.barStatus);
      const next = KDS_ITEM_TRANSITIONS[status]?.find((candidate) => candidate !== "voided");
      return { ...item, nextAction: canManageOrders && next ? { status: next, label: statusLabels[next] || next.replaceAll("_", " "), tone: "default" } : null };
    })
  };
}
function encodeMenuManagerCursor(row) {
  return Buffer.from(JSON.stringify({ n: String(row.name), i: row.id }), "utf8").toString("base64url");
}
function decodeMenuManagerCursor(value) {
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (typeof parsed.n === "string" && typeof parsed.i === "string" && parsed.i) return { name: parsed.n, id: parsed.i };
  } catch {
  }
  throw new Error("This menu page link is no longer valid. Return to the first page.");
}
function menuRevision(value) {
  const date = value instanceof Date ? value : new Date(String(value || ""));
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}
async function getCoffeeMenuManager(_root, args, context) {
  requirePermission(permissions.canReadProducts({ session: context.session }), "Not authorized to read menu management");
  const canManageProducts = permissions.canManageProducts({ session: context.session });
  const prisma = context.prisma;
  const store = await primaryStore(context);
  const limit = Math.max(1, Math.min(MENU_MANAGER_PAGE_LIMIT, Math.floor(Number(args.limit || MENU_MANAGER_PAGE_LIMIT))));
  const search = (args.search || "").trim().replace(/\s+/g, " ").slice(0, 200);
  const contains2 = { contains: search, mode: "insensitive" };
  const where = {
    storeId: store.id,
    ...args.categoryId === "uncategorized" ? { categoryId: null } : args.categoryId ? { categoryId: args.categoryId } : {},
    ...search ? { OR: [{ name: contains2 }, { shortDescription: contains2 }, { modifiers: { some: { OR: [{ name: contains2 }, { modifierGroupLabel: contains2 }] } } }] } : {}
  };
  const cursor = args.cursor ? decodeMenuManagerCursor(args.cursor) : null;
  const pageWhere = cursor ? { AND: [where, { OR: [{ name: { gt: cursor.name } }, { name: cursor.name, id: { gt: cursor.id } }] }] } : where;
  const [categoryRows, rows, matchingCount, itemCount, hiddenCount, modifiersOutCount] = await Promise.all([
    prisma.menuCategory.findMany({ where: { storeId: store.id }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }], take: MENU_MANAGER_CATEGORY_LIMIT + 1, select: { id: true, name: true, description: true, active: true, sortOrder: true } }),
    prisma.menuItem.findMany({ where: pageWhere, orderBy: [{ name: "asc" }, { id: "asc" }], take: limit + 1, select: managedMenuItemSelect }),
    prisma.menuItem.count({ where }),
    prisma.menuItem.count({ where: { storeId: store.id } }),
    prisma.menuItem.count({ where: { storeId: store.id, available: false } }),
    prisma.menuItemModifier.count({ where: { storeId: store.id, inStock: false } })
  ]);
  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit);
  const stock = await cafeMenuStock(context.prisma, store.id, items.map((item) => ({
    id: item.id,
    inventoryItemId: item.inventoryItemId ?? null,
    modifiers: Array.isArray(item.modifiers) ? item.modifiers : []
  })));
  return {
    canManageProducts,
    categories: categoryRows.slice(0, MENU_MANAGER_CATEGORY_LIMIT),
    categoriesHasMore: categoryRows.length > MENU_MANAGER_CATEGORY_LIMIT,
    matchingCount,
    stats: { items: itemCount, hidden: hiddenCount, modifiersOut: modifiersOutCount },
    hasMore,
    nextCursor: hasMore && items.length ? encodeMenuManagerCursor(items[items.length - 1]) : null,
    items: items.map((item) => {
      const modifiers = Array.isArray(item.modifiers) ? item.modifiers : [];
      return {
        ...item,
        updatedAt: menuRevision(item.updatedAt),
        soldOut: stock.soldOut.has(item.id),
        modifiersHasMore: modifiers.length > MENU_MANAGER_MODIFIER_LIMIT,
        modifiers: modifiers.slice(0, MENU_MANAGER_MODIFIER_LIMIT).map((modifier) => ({
          ...modifier,
          updatedAt: menuRevision(modifier.updatedAt),
          stockOut: stock.modifiersOut.has(modifier.id),
          inventoryAction: canManageProducts ? modifier.inventoryAction || "unreviewed" : null,
          inventoryQuantity: canManageProducts ? Number(modifier.inventoryQuantity || 0) : null,
          inventoryItem: canManageProducts ? modifier.inventoryItem || null : null,
          replacesInventoryItem: canManageProducts ? modifier.replacesInventoryItem || null : null
        }))
      };
    })
  };
}
async function getCoffeeMenuInventoryOptions(_root, args, context) {
  requirePermission(permissions.canManageProducts({ session: context.session }), "Not authorized to review modifier inventory");
  const prisma = context.prisma;
  const store = await primaryStore(context);
  const limit = Math.max(1, Math.min(50, Math.floor(Number(args.limit || 25))));
  const search = (args.search || "").trim().slice(0, 200);
  const rows = await prisma.inventoryItem.findMany({
    where: { storeId: store.id, ...search ? { OR: [{ name: { contains: search, mode: "insensitive" } }, { sku: { contains: search, mode: "insensitive" } }] } : {} },
    orderBy: [{ name: "asc" }, { id: "asc" }],
    take: limit + 1,
    select: { id: true, name: true, unit: true }
  });
  return { items: rows.slice(0, limit), hasMore: rows.length > limit };
}
function decodePosCatalogCursor(value, storeId, search, categoryId) {
  try {
    if (value.length > POS_CATALOG_CURSOR_MAX_LENGTH) throw new Error();
    const cursor = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (cursor.kind !== "pos-catalog" || cursor.storeId !== storeId || cursor.search !== search || cursor.categoryId !== categoryId || typeof cursor.name !== "string" || typeof cursor.id !== "string" || !cursor.id) throw new Error();
    return cursor;
  } catch {
    throw new Error("This menu page is no longer valid; reload the register");
  }
}
async function getCoffeePosRegister(_root, args, context) {
  requirePermission(permissions.canManageOrders({ session: context.session }), "Not authorized to operate POS");
  const store = await primaryStore(context);
  const search = (args?.search || "").trim().slice(0, 200);
  const categoryId = (args?.categoryId || "").trim().slice(0, 255);
  const limit = Math.min(100, Math.max(1, Math.floor(Number(args?.limit || POS_CATALOG_PAGE_SIZE))));
  const cursor = args?.cursor ? decodePosCatalogCursor(args.cursor, store.id, search, categoryId) : null;
  const where = {
    storeId: store.id,
    available: true,
    ...search ? { name: { contains: search, mode: "insensitive" } } : {},
    ...categoryId ? { categoryId } : {},
    ...cursor ? { OR: [{ name: { gt: cursor.name } }, { name: cursor.name, id: { gt: cursor.id } }] } : {}
  };
  const [rows, categories, shifts] = await Promise.all([
    context.prisma.menuItem.findMany({ where, orderBy: [{ name: "asc" }, { id: "asc" }], take: limit + 1, select: posMenuItemSelect }),
    context.prisma.menuCategory.findMany({ where: { storeId: store.id }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }], take: 100, select: { id: true, name: true } }),
    context.prisma.registerShift.findMany({ where: { storeId: store.id, status: "open" }, orderBy: { openedAt: "desc" }, take: 1, select: { id: true, shiftNumber: true, registerName: true, status: true, openingCashCents: true, cashSalesCents: true, cardSalesCents: true, tipsCents: true, payInsCents: true, payOutsCents: true, expectedCashCents: true, openedAt: true } })
  ]);
  const hasMore = rows.length > limit;
  const page = rows.slice(0, limit);
  const last = page[page.length - 1];
  const nextCursor = hasMore && last ? Buffer.from(JSON.stringify({ kind: "pos-catalog", storeId: store.id, search, categoryId, name: String(last.name), id: last.id }), "utf8").toString("base64url") : null;
  const stock = await cafeMenuStock(context.prisma, store.id, page.map((item) => ({
    id: item.id,
    inventoryItemId: item.inventoryItemId ?? null,
    modifiers: item.modifiers
  })));
  const items = page.map((item) => ({
    ...item,
    inventoryItemId: void 0,
    availability: stock.soldOut.has(item.id) ? "sold_out" : "now",
    // Staff-only: the register caps a ticket at the servings stock can still make.
    maxQuantity: stock.servings.get(item.id) ?? null,
    modifiers: item.modifiers.map((modifier) => ({ ...modifier, inStock: modifier.inStock !== false && !stock.modifiersOut.has(modifier.id) }))
  }));
  return { operatorId: String(context.session?.itemId || ""), storeId: store.id, items, hasMore, nextCursor, categories, openShift: shifts[0] || null };
}
async function quoteCafeOrder(_root, args, context) {
  const items = validateCafeOrderLines(args.items || []);
  const isStaff = permissions.canManageOrders({ session: context.session });
  const tipCents = Number(args.tipCents || 0);
  if (!Number.isSafeInteger(tipCents) || tipCents < 0 || tipCents > 1e8) throw new Error("Tip must be a non-negative integer amount in cents");
  const store = await primaryStore(context);
  const ids = [...new Set(items.map((item) => item.menuItemId))];
  const menuItems = await context.prisma.menuItem.findMany({ where: { id: { in: ids }, storeId: store.id }, select: { id: true, storeId: true, name: true, price: true, available: true, prepTimeMinutes: true, serviceWindows: true, category: { select: { active: true } }, inventoryItem: { select: { id: true } }, modifiers: { select: { id: true, menuItemId: true, name: true, priceAdjustment: true, inStock: true, modifierGroup: true, modifierGroupLabel: true, required: true, minSelections: true, maxSelections: true } } } });
  const byId = new Map(menuItems.map((item) => [item.id, item]));
  const lines = items.map((item, index) => {
    const menuItem = byId.get(item.menuItemId);
    if (!menuItem) throw new Error(`Menu item not found: ${item.menuItemId}`);
    assertCoffeeStoreOwnership(menuItem.storeId, store.id, `Menu item ${menuItem.name}`);
    if (!menuItem.available) throw cafeCustomerError(`${menuItem.name} is currently unavailable`);
    if (!isStaff && !isPublishedMenuItem(menuItem)) throw cafeCustomerError(`${menuItem.name} is currently unavailable`);
    const modifierIds = [...new Set(item.modifierIds || [])];
    const selected = modifierIds.map((id) => {
      const modifier = menuItem.modifiers.find((candidate) => candidate.id === id && candidate.menuItemId === menuItem.id);
      if (!modifier) throw new Error(`Modifier ${id} is not valid for ${menuItem.name}`);
      if (modifier.inStock === false) throw cafeCustomerError(`${modifier.name} is currently unavailable`);
      return modifier;
    });
    validateModifierSelections(menuItem, selected);
    const unitPrice = menuItem.price + selected.reduce((sum, modifier) => sum + number(modifier.priceAdjustment), 0);
    if (!Number.isSafeInteger(unitPrice) || unitPrice < 0) throw new Error(`${menuItem.name} has an invalid calculated price`);
    return { index, menuItemId: menuItem.id, name: menuItem.name, quantity: item.quantity, unitPrice, modifierIds };
  });
  const taxRateBasisPoints = Number(store.taxRateBasisPoints ?? 875);
  const lineSubtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  if (!isStaff && tipCents > lineSubtotal) throw cafeCustomerError("The tip can't be more than the order itself");
  const totals = calculateCafeTotals(lines, taxRateBasisPoints, tipCents);
  const currency = await context.prisma.storeSetting.findUnique({ where: { singletonKey: "primary" }, select: { currencyCode: true } });
  const currencyCode = String(currency?.currencyCode || "USD");
  if (!isStaff) {
    const requirements = await getCafeInventoryRequirements(context.prisma, store.id, lines.map((line) => ({ menuItemId: line.menuItemId, quantity: line.quantity, modifierIds: line.modifierIds, fallbackInventoryItemId: byId.get(line.menuItemId)?.inventoryItem?.id })));
    await assertCafeRequirementsInStock(context.prisma, store.id, requirements);
  }
  const earliestPickupMinutes = cafeEarliestPickupMinutes(store.pickupLeadTimeMinutes, items.map((item) => byId.get(item.menuItemId)?.prepTimeMinutes));
  let estimatedPickupMinutes = earliestPickupMinutes;
  if (!isStaff) {
    const serviceWindowSets = menuItems.map((item) => Array.isArray(item.serviceWindows) ? item.serviceWindows : ["all_day"]);
    const requested = args.requestedPickupMinutes;
    if (requested != null) {
      if (!Number.isSafeInteger(requested) || requested > COFFEE_PICKUP_SCHEDULE_MAX_MINUTES) throw cafeCustomerError("Choose a pickup time within the next two days");
      if (requested < earliestPickupMinutes) throw cafeCustomerError("That pickup time is earlier than the cafe can prepare this order");
      const pickupAt = new Date(Date.now() + requested * 6e4);
      for (const windows of serviceWindowSets) assertCoffeeOrderingAvailable(store, pickupAt, windows);
      estimatedPickupMinutes = requested;
    } else {
      const first = coffeeFirstPickupMinutes(store, earliestPickupMinutes, serviceWindowSets);
      if (first == null) throw cafeCustomerError("Pickup isn't available in the next two days");
      estimatedPickupMinutes = first;
    }
  }
  return {
    subtotal: totals.subtotal,
    tax: totals.tax,
    tip: totals.tip,
    total: totals.total,
    currencyCode,
    quoteFingerprint: cafeQuoteFingerprint({ storeId: store.id, currencyCode, taxRateBasisPoints, lines, subtotal: totals.subtotal, tax: totals.tax, tip: totals.tip, total: totals.total }),
    estimatedPickupMinutes,
    lines: lines.map((line, index) => ({ index: line.index, menuItemId: line.menuItemId, name: line.name, quantity: line.quantity, unitPrice: line.unitPrice, lineTotal: totals.lineTotals[index] }))
  };
}
var statusLabels, ORDER_QUEUE_ACTIVE_PAGE_SIZE, STALE_TICKET_HOURS, ORDER_QUEUE_STATUS_FILTERS, ORDER_QUEUE_FULFILLMENT_FILTERS, KDS_PAGE_SIZE, KDS_ACTIVE_ITEM_STATUSES, KDS_ACTIVE_ORDER_STATUSES, KDS_RELEASE_MINUTES, MENU_MANAGER_PAGE_LIMIT, MENU_MANAGER_MODIFIER_LIMIT, MENU_MANAGER_CATEGORY_LIMIT, menuInventoryRefSelect, managedMenuItemSelect, POS_CATALOG_PAGE_SIZE, POS_CATALOG_CURSOR_MAX_LENGTH, posMenuItemSelect;
var init_coffeeBoundaryQueries = __esm({
  "features/keystone/mutations/coffeeBoundaryQueries.ts"() {
    "use strict";
    init_endOfDayClose();
    init_access();
    init_coffeeCommandReceipt();
    init_kdsPolicy();
    init_transitionPolicy();
    init_coffeeAvailability();
    init_coffeePricing();
    init_coffeeOrderPolicy();
    init_coffeeInventoryConsumption();
    init_cafeStorefrontPolicy();
    init_cafeCustomerError();
    init_cafeMenuStock();
    init_coffeeReportsQuery();
    init_getCoffeeOperationsSnapshot();
    statusLabels = {
      accepted: "Accepted",
      paid: "Mark paid",
      in_bar_queue: "Send to queue",
      preparing: "Start",
      ready: "Mark ready",
      completed: "Complete",
      cancelled: "Cancel",
      queued: "Queue",
      handed_off: "Hand off",
      active: "Activate / resume",
      paused: "Pause",
      quoted: "Mark quoted",
      confirmed: "Confirm",
      clocked_in: "Clock in"
    };
    ORDER_QUEUE_ACTIVE_PAGE_SIZE = 100;
    STALE_TICKET_HOURS = 12;
    ORDER_QUEUE_STATUS_FILTERS = ["all", "open", "accepted", "paid", "in_bar_queue", "preparing", "ready", "completed", "cancelled", "refunded"];
    ORDER_QUEUE_FULFILLMENT_FILTERS = ["all", "pickup", "counter", "dine_in"];
    KDS_PAGE_SIZE = 100;
    KDS_ACTIVE_ITEM_STATUSES = ["new", "queued", "preparing", "ready"];
    KDS_ACTIVE_ORDER_STATUSES = ["accepted", "paid", "in_bar_queue", "preparing", "ready"];
    KDS_RELEASE_MINUTES = 45;
    MENU_MANAGER_PAGE_LIMIT = 50;
    MENU_MANAGER_MODIFIER_LIMIT = 100;
    MENU_MANAGER_CATEGORY_LIMIT = 200;
    menuInventoryRefSelect = { select: { id: true, name: true, unit: true } };
    managedMenuItemSelect = {
      id: true,
      name: true,
      shortDescription: true,
      price: true,
      available: true,
      featured: true,
      popular: true,
      prepTimeMinutes: true,
      barStation: true,
      updatedAt: true,
      ...MENU_STOCK_ITEM_SELECT,
      category: { select: { id: true, name: true } },
      modifiers: {
        orderBy: [{ modifierGroup: "asc" }, { name: "asc" }, { id: "asc" }],
        take: MENU_MANAGER_MODIFIER_LIMIT + 1,
        select: { id: true, name: true, modifierGroup: true, modifierGroupLabel: true, priceAdjustment: true, required: true, minSelections: true, maxSelections: true, inStock: true, defaultSelected: true, updatedAt: true, inventoryAction: true, inventoryQuantity: true, inventoryItem: menuInventoryRefSelect, replacesInventoryItem: menuInventoryRefSelect, inventoryItemId: true, replacesInventoryItemId: true }
      }
    };
    POS_CATALOG_PAGE_SIZE = 48;
    POS_CATALOG_CURSOR_MAX_LENGTH = 1024;
    posMenuItemSelect = {
      id: true,
      name: true,
      price: true,
      available: true,
      ...MENU_STOCK_ITEM_SELECT,
      category: { select: { id: true, name: true } },
      modifiers: { orderBy: [{ modifierGroup: "asc" }, { name: "asc" }, { id: "asc" }], take: 100, select: { id: true, name: true, modifierGroup: true, modifierGroupLabel: true, priceAdjustment: true, required: true, minSelections: true, maxSelections: true, inStock: true, defaultSelected: true, ...MENU_STOCK_MODIFIER_SELECT } }
    };
  }
});

// features/keystone/mutations/redirectToInit.ts
async function redirectToInit(_root, _args, context) {
  const userCount = await context.sudo().query.User.count({});
  return userCount === 0;
}
var redirectToInit_default;
var init_redirectToInit = __esm({
  "features/keystone/mutations/redirectToInit.ts"() {
    "use strict";
    redirectToInit_default = redirectToInit;
  }
});

// features/keystone/mutations/createCafePickupOrder.ts
function normalizeEmail(email) {
  return email?.trim().toLowerCase() || "";
}
function normalizePhone(phone) {
  return phone?.replace(/[^+\d]/g, "") || "";
}
function generateOrderNumber(timezone, at = /* @__PURE__ */ new Date()) {
  let date;
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone || "America/New_York", year: "2-digit", month: "2-digit", day: "2-digit" }).formatToParts(at);
    const part = (type) => parts.find((entry) => entry.type === type)?.value || "";
    date = `${part("year")}${part("month")}${part("day")}`;
  } catch {
    date = at.toISOString().slice(2, 10).replace(/-/g, "");
  }
  return `CF-${date}-${(0, import_node_crypto6.randomBytes)(4).toString("hex").toUpperCase()}`;
}
function transactionConflict(error) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2034";
}
async function createOrderTransaction({
  rawTx,
  args,
  items,
  isStaff,
  scopedKey: scopedKey5,
  requestFingerprint,
  paymentMethod,
  orderSource,
  fulfillmentType,
  session
}) {
  const tx = rawTx;
  if (scopedKey5) {
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-order:${scopedKey5}`);
    const existing = await tx.cafeOrder.findUnique({
      where: { idempotencyKey: scopedKey5 },
      select: { id: true, requestFingerprint: true, customerId: true, secretKey: true }
    });
    if (existing) {
      if (existing.requestFingerprint !== requestFingerprint) throw new Error("Idempotency key was already used with different order data");
      if (!isStaff) {
        const ownsAsCustomer = session?.listKey === "User" && Boolean(existing.customerId) && existing.customerId === session.itemId;
        if (!ownsAsCustomer && !cafeReceiptKeyMatches(args.receiptKey, existing.secretKey)) throw new Error("This pickup request could not be confirmed");
      }
      return existing.id;
    }
  }
  const isImmediateTender = isStaff && ["cash", "manual_card"].includes(paymentMethod);
  let registerShift = null;
  if (isImmediateTender) {
    requireCafeRegisterOperator(session);
    if (!args.registerShiftId) throw new Error("Immediate tender requires an open register shift");
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-register-shift:${args.registerShiftId}`);
    await requireCurrentCoffeeCapability(tx, session, ["canManageOrders"], "Not authorized to operate the register");
    registerShift = await tx.registerShift.findUnique({ where: { id: args.registerShiftId } });
    if (!registerShift || registerShift.status !== "open") throw new Error("POS orders require an open register shift");
  }
  const itemIds = [...new Set(items.map((item) => item.menuItemId))].sort();
  for (const id of itemIds) {
    await tx.$executeRawUnsafe(
      "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
      "coffee-menu-item",
      id
    );
  }
  const menuItems = await tx.menuItem.findMany({
    where: { id: { in: itemIds } },
    include: {
      inventoryItem: { select: { id: true, storeId: true, currentStock: true, unit: true } },
      modifiers: true,
      menuItemImages: { orderBy: { order: "asc" }, take: 1, select: { imagePath: true, image_id: true, image_extension: true } },
      category: { select: { active: true } }
    }
  });
  const menuItemMap = new Map(menuItems.map((item) => [item.id, item]));
  const settings = await tx.storeSetting.findUnique({
    where: { singletonKey: "primary" },
    select: { id: true, pickupLeadTimeMinutes: true, pickupWindowMinutes: true, pickupCapacityPerWindow: true, taxRateBasisPoints: true, timezone: true, currencyCode: true, weeklyHours: true }
  });
  if (!settings) throw new Error("Primary coffee store is not configured");
  const storeId = settings.id;
  if (registerShift) assertCoffeeStoreOwnership(registerShift.storeId, storeId, "Register shift");
  if (!isStaff) {
    const customerEmail = normalizeEmail(args.customerEmail);
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-public-intake:${storeId}`);
    const stillLive = { OR: [{ payments: { none: {} } }, { payments: { some: { status: { notIn: ["failed", "cancelled"] } } } }] };
    const [recentForContact, totalOpenRequests] = await Promise.all([
      tx.cafeOrder.count({ where: { storeId, orderSource: "online", status: "open", ...stillLive, customerEmail, createdAt: { gte: new Date(Date.now() - 60 * 6e4) } } }),
      tx.cafeOrder.count({ where: { storeId, orderSource: "online", status: "open", ...stillLive } })
    ]);
    if (recentForContact >= 3) throw cafeCustomerError("This email already has the maximum number of open pickup requests");
    if (totalOpenRequests >= Math.max(50, Number(settings.pickupCapacityPerWindow || 20) * 3)) throw cafeCustomerError("Online pickup requests are temporarily paused while the cafe catches up");
  }
  const normalizedItems = items.map((item) => {
    const menuItem = menuItemMap.get(item.menuItemId);
    if (!menuItem) throw new Error(`Menu item not found: ${item.menuItemId}`);
    assertCoffeeStoreOwnership(menuItem.storeId, storeId, `Menu item ${menuItem.name}`);
    if (menuItem.inventoryItem) assertCoffeeStoreOwnership(menuItem.inventoryItem.storeId, storeId, `Inventory for ${menuItem.name}`);
    if (!menuItem.available) throw cafeCustomerError(`${menuItem.name} is currently unavailable`);
    if (!isStaff && !isPublishedMenuItem(menuItem)) throw cafeCustomerError(`${menuItem.name} is currently unavailable`);
    const selectedModifiers = (item.modifierIds || []).map((id) => {
      const modifier = menuItem.modifiers.find((candidate) => candidate.id === id);
      if (!modifier || modifier.menuItemId !== menuItem.id) throw new Error(`Modifier ${id} is not valid for ${menuItem.name}`);
      if (modifier.inStock === false) throw cafeCustomerError(`${modifier.name} is currently unavailable`);
      return modifier;
    });
    validateCafeModifierSelections(menuItem, selectedModifiers);
    const quantity = Math.max(1, Math.floor(Number(item.quantity || 1)));
    const modifierSnapshot = selectedModifiers.map((modifier) => ({
      id: modifier.id,
      name: modifier.name,
      group: modifier.modifierGroup || "default",
      groupLabel: modifier.modifierGroupLabel || modifier.modifierGroup || "Modifier",
      priceAdjustment: Number(modifier.priceAdjustment || 0)
    }));
    const unitPrice = menuItem.price + modifierSnapshot.reduce((sum, modifier) => sum + modifier.priceAdjustment, 0);
    if (!Number.isSafeInteger(unitPrice) || unitPrice < 0) throw new Error(`${menuItem.name} has an invalid calculated price`);
    assertCafeMoneyCents(unitPrice, `${menuItem.name} price`);
    return {
      menuItem,
      selectedModifiers,
      modifierSnapshot,
      quantity,
      unitPrice,
      specialInstructions: item.specialInstructions?.trim() || ""
    };
  });
  let leadMinutes = Math.max(5, Number(args.requestedPickupMinutes || settings.pickupLeadTimeMinutes || 12));
  if (!isStaff) {
    const earliest = cafeEarliestPickupMinutes(Number(settings.pickupLeadTimeMinutes) || 12, normalizedItems.map((item) => item.menuItem.prepTimeMinutes));
    const firstOpen = coffeeFirstPickupMinutes(settings, earliest, normalizedItems.map((item) => item.menuItem.serviceWindows));
    if (firstOpen == null) throw cafeCustomerError("Pickup isn't available in the next two days");
    leadMinutes = args.requestedPickupMinutes ?? firstOpen;
    if (leadMinutes < earliest) throw cafeCustomerError("The requested pickup time is earlier than the cafe can prepare this order. Review the pickup estimate and submit again.");
  }
  const rawPromisedAt = Date.now() + leadMinutes * 6e4;
  const promisedAt = new Date(!isStaff && args.requestedPickupMinutes != null ? Math.floor(rawPromisedAt / 6e4) * 6e4 : rawPromisedAt);
  if (!isStaff) {
    for (const item of normalizedItems) assertCoffeeOrderingAvailable(settings, promisedAt, item.menuItem.serviceWindows);
  }
  if (fulfillmentType === "pickup") {
    const windowMinutes = Math.max(5, Number(settings?.pickupWindowMinutes || 15));
    const windowMs = windowMinutes * 6e4;
    const windowStart = new Date(Math.floor(promisedAt.getTime() / windowMs) * windowMs);
    const windowEnd = new Date(windowStart.getTime() + windowMs);
    const capacityKey = windowStart.toISOString();
    await tx.$executeRawUnsafe(
      "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
      "coffee-pickup-capacity",
      capacityKey
    );
    const locked = await readLockedPickupSettings(tx);
    if (Math.max(5, Number(locked.pickupWindowMinutes || 15)) !== windowMinutes || (Number(locked.pickupLeadTimeMinutes) || 12) !== (Number(settings.pickupLeadTimeMinutes) || 12)) {
      throw cafeCustomerError(PICKUP_SETTINGS_CHANGED_MESSAGE);
    }
    const capacity = Math.max(1, Number(locked.pickupCapacityPerWindow || 20));
    const reservations = await tx.cafeOrder.count({
      where: {
        storeId,
        fulfillmentType: "pickup",
        promisedAt: { gte: windowStart, lt: windowEnd },
        status: { in: ["accepted", "paid", "in_bar_queue", "preparing", "ready"] }
      }
    });
    if (reservations >= capacity) throw cafeCustomerError("The requested pickup window is at capacity");
  }
  const inventoryRequirements = await getCafeInventoryRequirements(tx, storeId, normalizedItems.map((item) => ({
    menuItemId: item.menuItem.id,
    fallbackInventoryItemId: item.menuItem.inventoryItem?.id,
    quantity: item.quantity,
    modifierIds: item.modifierSnapshot.map((modifier) => modifier.id)
  })));
  if (!isStaff) await assertCafeRequirementsInStock(tx, storeId, inventoryRequirements);
  const taxRateBasisPoints = Number(settings.taxRateBasisPoints ?? 875);
  const pricedLines = normalizedItems.map((item) => ({ menuItemId: item.menuItem.id, quantity: item.quantity, modifierIds: item.modifierSnapshot.map((modifier) => modifier.id), unitPrice: item.unitPrice }));
  const { subtotal, tax, tip, total } = calculateCafeTotals(pricedLines, taxRateBasisPoints, Number(args.tipCents || 0));
  if (!isStaff && tip > subtotal) throw cafeCustomerError("The tip can't be more than the order itself");
  if (args.quoteFingerprint) {
    const current = cafeQuoteFingerprint({ storeId, currencyCode: settings.currencyCode, taxRateBasisPoints, lines: pricedLines, subtotal, tax, tip, total });
    if (current !== args.quoteFingerprint) throw cafeCustomerError("Prices or tax changed since this ticket was reviewed. Review the updated total and submit again.");
  }
  const tenderRequired = isImmediateTender && total > 0;
  const externalCardReference = paymentMethod === "manual_card" ? args.externalCardReference?.trim() || "" : "";
  const now = /* @__PURE__ */ new Date();
  const orderNumber = generateOrderNumber(settings.timezone);
  const order = await tx.cafeOrder.create({
    data: {
      orderNumber,
      fulfillmentType,
      orderSource,
      status: isImmediateTender ? "paid" : "open",
      customerName: args.customerName.trim(),
      customerEmail: normalizeEmail(args.customerEmail),
      customerPhone: normalizePhone(args.customerPhone),
      pickupName: args.pickupName?.trim() || args.customerName.trim(),
      specialInstructions: args.specialInstructions?.trim() || "",
      subtotal,
      tax,
      tip,
      total,
      paidAt: isImmediateTender ? now : null,
      promisedAt,
      currencyCode: settings.currencyCode,
      idempotencyKey: scopedKey5,
      requestFingerprint,
      customerId: !isStaff && session?.listKey === "User" ? session.itemId : null,
      storeId,
      handoffCode: (0, import_node_crypto6.randomBytes)(3).toString("hex").toUpperCase(),
      secretKey: !isStaff && args.receiptKey ? args.receiptKey : (0, import_node_crypto6.randomBytes)(32).toString("hex")
    },
    select: { id: true }
  });
  for (const item of normalizedItems) {
    await tx.orderItem.create({
      data: {
        storeId,
        orderId: order.id,
        menuItemId: item.menuItem.id,
        appliedModifiers: item.selectedModifiers.length ? { connect: item.selectedModifiers.map(({ id }) => ({ id })) } : void 0,
        quantity: item.quantity,
        price: item.unitPrice,
        itemNameSnapshot: item.menuItem.name,
        imagePathSnapshot: cafeMenuItemImageReference(item.menuItem) || "",
        customizationsSummary: item.modifierSnapshot.map((modifier) => modifier.name).join(", "),
        modifierSnapshot: item.modifierSnapshot,
        specialInstructions: item.specialInstructions,
        station: item.menuItem.barStation || "espresso_bar",
        barStatus: "queued",
        queuedAt: now
      }
    });
  }
  if (isImmediateTender) {
    await consumeCafeInventoryRequirements(tx, {
      storeId,
      orderId: order.id,
      orderNumber,
      requirements: inventoryRequirements,
      createdById: session?.listKey === "User" ? session.itemId : null,
      reason: `Counter sale ${orderNumber}`
    });
  }
  if (tenderRequired) {
    const manualProvider = await tx.paymentProvider.findUnique({ where: { code: "pp_system_default" }, select: { id: true } });
    if (!manualProvider) throw new Error("System payment provider is not configured");
    const providerPaymentId = paymentMethod === "cash" ? `cash_${(0, import_node_crypto6.randomUUID)()}` : `external_terminal:${externalCardReference}`;
    if (paymentMethod === "manual_card") {
      const duplicate = await tx.payment.findFirst({ where: { storeId, method: "card", providerPaymentId }, select: { id: true } });
      if (duplicate) throw new Error("This terminal approval reference is already recorded on another sale");
    }
    await tx.payment.create({
      data: {
        orderId: order.id,
        status: "captured",
        method: paymentMethod === "cash" ? "cash" : "card",
        amount: total,
        currencyCode: settings.currencyCode,
        provider: "pp_system_default",
        paymentProviderId: manualProvider.id,
        providerPaymentId,
        processedAt: now,
        storeId,
        registerShiftId: registerShift ? String(registerShift.id) : null
      }
    });
  }
  if (registerShift) {
    const isCash = paymentMethod === "cash";
    const cashSalesCents = Number(registerShift.cashSalesCents || 0) + (isCash ? total : 0);
    const cardSalesCents = Number(registerShift.cardSalesCents || 0) + (isCash ? 0 : total);
    const tipsCents = Number(registerShift.tipsCents || 0) + tip;
    await tx.registerShift.update({
      where: { id: String(registerShift.id) },
      data: {
        cashSalesCents,
        cardSalesCents,
        tipsCents,
        expectedCashCents: Number(registerShift.openingCashCents || 0) + cashSalesCents - Number(registerShift.cashRefundsCents || 0) + Number(registerShift.payInsCents || 0) - Number(registerShift.payOutsCents || 0)
      }
    });
    if (args.cashTenderedCents != null && args.cashTenderedCents < total) throw cafeCustomerError("Cash received is less than the total");
    await tx.posOrder.create({
      data: {
        receiptNumber: `POS-${orderNumber}`,
        storeId,
        cafeOrderId: order.id,
        cashierId: session?.itemId || null,
        registerShiftId: String(registerShift.id),
        registerName: String(registerShift.registerName || "Register"),
        status: "paid",
        subtotalCents: subtotal,
        taxCents: tax,
        tipCents: tip,
        totalCents: total,
        closedAt: now,
        metadata: {
          tender: !tenderRequired ? { method: "none", reason: "zero_total" } : paymentMethod === "cash" ? { method: "cash", evidence: "cash_received_at_register", ...args.cashTenderedCents != null ? { tenderedCents: args.cashTenderedCents, changeCents: args.cashTenderedCents - total } : {} } : { method: "external_card", evidence: "operator_attested_terminal_approval", terminalReference: externalCardReference, attestedById: session?.itemId || null, attestedAt: now.toISOString(), providerVerified: false },
          quoteFingerprint: args.quoteFingerprint || null
        }
      }
    });
  }
  await recordCoffeeCommandReceipt(tx, {
    storeId,
    eventKey: `order:${order.id}:placed:v1`,
    eventType: "order.placed",
    aggregateType: "order",
    aggregateId: order.id,
    occurredAt: now,
    payload: {
      order: {
        id: order.id,
        orderNumber,
        source: orderSource,
        fulfillmentType,
        subtotal,
        tax,
        tip,
        total,
        paymentMethod,
        lines: normalizedItems.map((item) => ({
          menuItemId: item.menuItem.id,
          name: item.menuItem.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          modifiers: item.modifierSnapshot,
          instructions: item.specialInstructions
        }))
      }
    }
  });
  return order.id;
}
async function createCafePickupOrder(_root, args, context) {
  const items = validateCafeOrderLines(args.items || []);
  const isStaff = permissions.canManageOrders({ session: context.session });
  const paymentMethod = args.paymentMethod || "manual";
  const orderSource = args.orderSource || "online";
  const fulfillmentType = args.fulfillmentType || "pickup";
  if (!["manual", "cash", "manual_card"].includes(paymentMethod)) throw new Error("Unsupported payment method");
  if (!["online", "pos", "phone"].includes(orderSource)) throw new Error("Unsupported order source");
  if (!["pickup", "counter", "dine_in"].includes(fulfillmentType)) throw new Error("Unsupported fulfillment type");
  if (orderSource === "online" && fulfillmentType !== "pickup") throw new Error("Online orders require pickup fulfillment");
  if (["cash", "manual_card"].includes(paymentMethod)) {
    requireCafeRegisterOperator(context.session);
    if (!args.registerShiftId) throw new Error("Immediate tender requires an open register shift");
  } else if (args.registerShiftId) throw new Error("A register may only be attached when recording immediate tender");
  const tipCents = Number(args.tipCents || 0);
  if (!Number.isSafeInteger(tipCents) || tipCents < 0 || tipCents > 1e8) throw new Error("Tip must be a non-negative integer amount in cents");
  const quoteFingerprint = args.quoteFingerprint?.trim() || "";
  if (quoteFingerprint && !/^[a-f0-9]{64}$/.test(quoteFingerprint)) throw new Error("The reviewed ticket total is invalid; review the ticket again");
  if (orderSource === "pos" && !quoteFingerprint) throw new Error("Review the ticket total before recording tender");
  normalizeCafeReceiptKey(args.receiptKey);
  const externalCardReference = args.externalCardReference?.trim() || "";
  if (paymentMethod === "manual_card") {
    if (args.externalCardApproved !== true) throw new Error("Confirm the card terminal approved this exact amount before recording the card payment");
    if (!/^[A-Za-z0-9#._:\/-]{4,64}$/.test(externalCardReference)) throw new Error("Enter the terminal approval or reference code (4-64 letters, numbers or #._:/-)");
  } else if (externalCardReference || args.externalCardApproved) throw new Error("A terminal reference applies only to an external card payment");
  if (args.cashTenderedCents != null && (paymentMethod !== "cash" || !Number.isSafeInteger(args.cashTenderedCents) || args.cashTenderedCents < 0 || args.cashTenderedCents > 1e8)) {
    throw cafeCustomerError("Cash received applies only to a cash sale, as a whole number of cents");
  }
  if (!isStaff && (paymentMethod === "cash" || paymentMethod === "manual_card")) throw new Error("Immediate-tender payment methods are only available to staff");
  if (!isStaff && orderSource !== "online") throw new Error("Only staff may create non-online orders");
  if (!isStaff && fulfillmentType !== "pickup") throw new Error("Only staff may create non-pickup orders");
  if (orderSource === "pos" && !["cash", "manual_card"].includes(paymentMethod)) throw new Error("POS orders require cash or card tender");
  if (orderSource === "pos" && !args.registerShiftId) throw new Error("POS orders require an open register shift");
  if (!args.customerName?.trim()) throw new Error("Pickup name is required");
  if (args.customerName.trim().length > 200 || (args.pickupName?.trim().length || 0) > 200) throw new Error("Pickup name cannot exceed 200 characters");
  if ((args.customerEmail?.trim().length || 0) > 320) throw new Error("Customer email cannot exceed 320 characters");
  if (!isStaff && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizeEmail(args.customerEmail))) throw new Error("A valid email is required for online pickup requests");
  if ((args.customerPhone?.trim().length || 0) > 50) throw new Error("Customer phone cannot exceed 50 characters");
  if ((args.specialInstructions?.trim().length || 0) > 2e3) throw new Error("Order instructions cannot exceed 2000 characters");
  if (args.requestedPickupMinutes != null && (!Number.isSafeInteger(args.requestedPickupMinutes) || args.requestedPickupMinutes < 5 || args.requestedPickupMinutes > COFFEE_PICKUP_SCHEDULE_MAX_MINUTES)) {
    throw cafeCustomerError("Choose a pickup time within the next two days");
  }
  const clientKey = normalizeIdempotencyKey(args.idempotencyKey);
  const scope = !isStaff ? "storefront" : context.session?.listKey === "User" ? context.session.itemId : "guest";
  if (!clientKey) throw new Error("Order idempotency key is required");
  const scopedKey5 = clientKey ? buildScopedIdempotencyKey(scope, clientKey) : null;
  const requestFingerprint = clientKey ? fingerprintInput({
    customerName: args.customerName.trim(),
    customerEmail: normalizeEmail(args.customerEmail),
    customerPhone: normalizePhone(args.customerPhone),
    pickupName: args.pickupName?.trim() || args.customerName.trim(),
    requestedPickupMinutes: args.requestedPickupMinutes ?? null,
    specialInstructions: args.specialInstructions?.trim() || "",
    paymentMethod,
    orderSource,
    fulfillmentType,
    registerShiftId: args.registerShiftId || null,
    tipCents,
    ...quoteFingerprint ? { quoteFingerprint } : {},
    ...paymentMethod === "manual_card" ? { externalCardReference, externalCardApproved: true } : {},
    ...args.cashTenderedCents != null ? { cashTenderedCents: args.cashTenderedCents } : {},
    items: items.map((item) => ({
      menuItemId: item.menuItemId,
      quantity: Math.max(1, Math.floor(Number(item.quantity || 1))),
      modifierIds: [...item.modifierIds || []].sort(),
      specialInstructions: item.specialInstructions?.trim() || ""
    }))
  }) : null;
  for (let attempt = 1; attempt <= MAX_TRANSACTION_RETRIES; attempt += 1) {
    try {
      const orderId = await context.prisma.$transaction(
        (rawTx) => createOrderTransaction({
          rawTx,
          args,
          items,
          isStaff,
          scopedKey: scopedKey5,
          requestFingerprint,
          paymentMethod,
          orderSource,
          fulfillmentType,
          session: context.session
        }),
        { maxWait: 5e3, timeout: 1e4, isolationLevel: "ReadCommitted" }
      );
      const persisted = await context.sudo().query.CafeOrder.findOne({ where: { id: orderId }, query: ORDER_RETURN_QUERY });
      if (persisted) {
        return persisted;
      }
      if (attempt === MAX_TRANSACTION_RETRIES) throw new Error("Pickup order transaction did not commit");
    } catch (error) {
      if (!transactionConflict(error) || attempt === MAX_TRANSACTION_RETRIES) throw error;
    }
  }
  throw new Error("Pickup order transaction retry limit exceeded");
}
var import_node_crypto6, ORDER_RETURN_QUERY, MAX_TRANSACTION_RETRIES;
var init_createCafePickupOrder = __esm({
  "features/keystone/mutations/createCafePickupOrder.ts"() {
    "use strict";
    import_node_crypto6 = require("node:crypto");
    init_access();
    init_coffeeCommandReceipt();
    init_idempotency();
    init_coffeeAvailability();
    init_coffeeInventoryConsumption();
    init_coffeePricing();
    init_coffeeOrderPolicy();
    init_coffeeKdsAuthority();
    init_cafeStorefrontPolicy();
    init_cafeCustomerError();
    ORDER_RETURN_QUERY = `
  id orderNumber status handoffCode customerName pickupName promisedAt subtotal tax tip total currencyCode secretKey requestFingerprint
  orderItems { id quantity itemNameSnapshot imagePathSnapshot customizationsSummary modifierSnapshot specialInstructions price }
`;
    MAX_TRANSACTION_RETRIES = 3;
  }
});

// features/keystone/mutations/updateCafeOrderItemStatus.ts
async function committedReceipt(tx, scope) {
  const item = await tx.orderItem.findUnique({ where: { id: scope.itemId }, select: { id: true, storeId: true, orderId: true, quantity: true, itemNameSnapshot: true, customizationsSummary: true, barStatus: true, station: true, queuedAt: true, startedAt: true, readyAt: true, handedOffAt: true } });
  const order = await tx.cafeOrder.findUnique({ where: { id: scope.orderId }, select: { id: true, storeId: true, orderNumber: true, status: true, pickupName: true, promisedAt: true } });
  if (!item || !order || item.id !== scope.itemId || item.orderId !== scope.orderId || order.id !== scope.orderId || item.storeId !== scope.storeId || order.storeId !== scope.storeId) throw new Error("KDS committed projection scope changed");
  if (!item.barStatus || !isKdsItemStatus(item.barStatus) || !Number.isSafeInteger(item.quantity) || Number(item.quantity) < 1 || typeof item.itemNameSnapshot !== "string" || typeof order.orderNumber !== "string" || !order.status) throw new Error("KDS committed projection is invalid");
  const instant2 = (value) => value == null ? null : value.toISOString();
  return {
    id: item.id,
    quantity: Number(item.quantity),
    itemNameSnapshot: item.itemNameSnapshot,
    customizationsSummary: item.customizationsSummary ?? null,
    barStatus: item.barStatus,
    station: item.station,
    queuedAt: instant2(item.queuedAt),
    startedAt: instant2(item.startedAt),
    readyAt: instant2(item.readyAt),
    handedOffAt: instant2(item.handedOffAt),
    idempotencyKey: scope.idempotencyKey,
    expectedStatus: scope.expectedStatus,
    requestedStatus: scope.requestedStatus,
    actorId: scope.actorId,
    storeId: scope.storeId,
    order: { id: order.id, orderNumber: order.orderNumber, status: order.status, pickupName: order.pickupName ?? null, promisedAt: instant2(order.promisedAt) }
  };
}
function itemTimestamp(status) {
  if (status === "queued") return "queuedAt";
  if (status === "preparing") return "startedAt";
  if (status === "ready") return "readyAt";
  if (status === "handed_off") return "handedOffAt";
  return null;
}
function orderTimestamp(status) {
  if (status === "preparing") return "startedAt";
  if (status === "ready") return "readyAt";
  if (status === "completed") return "completedAt";
  return null;
}
async function updateCafeOrderItemStatus(_root, args, context) {
  if (!permissions.canManageOrders({ session: context.session })) throw new Error("Not authorized to operate the KDS");
  if (!isKdsItemStatus(args.status)) throw new Error(`Unsupported KDS item status: ${args.status}`);
  const status = args.status;
  if (status === "voided") throw new Error("Partial item voids are not supported. Cancel an unstarted unpaid ticket or use the full refund workflow.");
  if (!args.orderItemId || !args.expectedStatus || !isKdsItemStatus(args.expectedStatus)) throw new Error("KDS item and expected status are required");
  const clientKey = normalizeIdempotencyKey(args.idempotencyKey);
  if (!clientKey) throw new Error("KDS command idempotency key is required");
  const commandKey = buildScopedIdempotencyKey(`kds:${context.session?.itemId}`, clientKey);
  const eventKey = `kds-command:${commandKey}`;
  const expectedStatus = args.expectedStatus;
  const requestFingerprint = fingerprintInput({ orderItemId: args.orderItemId, expectedStatus, status });
  const receipt = await context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx;
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-kds-command:${commandKey}`);
    const admittedActorId = await requireCurrentCoffeeKdsOperator(tx, context.session);
    let item = await tx.orderItem.findUnique({ where: { id: args.orderItemId }, select: { id: true, storeId: true, barStatus: true, station: true, orderId: true } });
    if (!item?.orderId) throw new Error("KDS order item not found");
    const locatedOrderId = item.orderId;
    await lockCoffeeOrder(tx, locatedOrderId);
    const actorId = await requireCurrentCoffeeKdsOperator(tx, context.session);
    if (actorId !== admittedActorId) throw new Error("Not authorized to operate the KDS");
    item = await tx.orderItem.findUnique({ where: { id: args.orderItemId }, select: { id: true, storeId: true, barStatus: true, station: true, orderId: true } });
    if (!item?.orderId || item.orderId !== locatedOrderId || !item.barStatus || !isKdsItemStatus(item.barStatus)) throw new Error("KDS order item is invalid");
    const order = await tx.cafeOrder.findUnique({ where: { id: item.orderId }, select: { id: true, storeId: true, status: true, total: true, discount: true, payments: { select: { status: true, amount: true, refundIdempotencyKey: true } } } });
    if (!order || !order.status) throw new Error("KDS cafe order not found");
    const storeId = await getPrimaryCoffeeStoreId(tx);
    assertCoffeeStoreOwnership(order.storeId, storeId, "Cafe order");
    assertCoffeeStoreOwnership(item.storeId, storeId, "KDS order item");
    if (order.status === "open") throw new Error("Cannot bump an item before the pickup request is accepted");
    if (status === "handed_off") assertCafeSettlement(order.payments || [], Number(order.total) - Number(order.discount || 0));
    if (["cancelled", "refunded"].includes(order.status)) throw new Error(`Cannot bump an item on a ${order.status} order`);
    if (!["accepted", "paid", "in_bar_queue", "preparing", "ready", "completed"].includes(order.status)) throw new Error("KDS cafe order state is invalid");
    const receipt2 = await tx.coffeeCommandReceipt.findUnique({ where: { eventKey } });
    if (receipt2) {
      const payload = receipt2.payload && typeof receipt2.payload === "object" ? receipt2.payload : {};
      if (receipt2.storeId !== storeId || receipt2.aggregateType !== "order_item" || receipt2.aggregateId !== item.id || receipt2.eventType !== "kitchen_item.status_changed" || payload.orderId !== order.id || payload.actorId !== actorId || payload.requestFingerprint !== requestFingerprint) {
        throw new Error("KDS command key was reused with a different request");
      }
      return committedReceipt(tx, { itemId: item.id, orderId: order.id, storeId, actorId, idempotencyKey: clientKey, expectedStatus, requestedStatus: status });
    }
    if (TERMINAL_ORDER_STATUSES.has(order.status)) throw new Error(`Cannot bump an item on a ${order.status} order`);
    if (item.barStatus !== args.expectedStatus) throw new Error("KDS item changed; refresh before issuing a new command");
    const transition = evaluateKdsItemTransition(item.barStatus, status);
    if (transition.replay) throw new Error("KDS status replay requires the original command key");
    const now = /* @__PURE__ */ new Date();
    const timestamp19 = itemTimestamp(status);
    await tx.orderItem.update({
      where: { id: item.id },
      data: { barStatus: status, ...timestamp19 ? { [timestamp19]: now } : {} }
    });
    const siblings = await tx.orderItem.findMany({ where: { orderId: item.orderId }, select: { barStatus: true } });
    const statuses = siblings.map((sibling) => {
      if (!sibling.barStatus || !isKdsItemStatus(sibling.barStatus)) throw new Error("KDS sibling item state is invalid");
      return sibling.barStatus;
    });
    if (!statuses.length) throw new Error("KDS order has no items to roll up");
    const orderStatus = advanceKdsOrderStatus(order.status, rollupCafeOrderStatus(statuses));
    if (orderStatus !== order.status) {
      const timestampField = orderTimestamp(orderStatus);
      await tx.cafeOrder.update({
        where: { id: order.id },
        data: { status: orderStatus, ...timestampField ? { [timestampField]: now } : {} }
      });
    }
    await recordCoffeeCommandReceipt(tx, {
      storeId,
      eventKey,
      eventType: "kitchen_item.status_changed",
      aggregateType: "order_item",
      aggregateId: item.id,
      occurredAt: now,
      payload: { actorId, requestFingerprint, orderItemId: item.id, orderId: order.id, station: item.station || "unassigned", previousStatus: item.barStatus, status, orderStatus }
    });
    return committedReceipt(tx, { itemId: item.id, orderId: order.id, storeId, actorId, idempotencyKey: clientKey, expectedStatus, requestedStatus: status });
  }, TX_OPTIONS3);
  return receipt;
}
var TX_OPTIONS3, TERMINAL_ORDER_STATUSES;
var init_updateCafeOrderItemStatus = __esm({
  "features/keystone/mutations/updateCafeOrderItemStatus.ts"() {
    "use strict";
    init_access();
    init_coffeeKdsAuthority();
    init_idempotency();
    init_coffeeOrderPolicy();
    init_coffeeCommandReceipt();
    init_kdsPolicy();
    TX_OPTIONS3 = { maxWait: 5e3, timeout: 1e4, isolationLevel: "ReadCommitted" };
    TERMINAL_ORDER_STATUSES = /* @__PURE__ */ new Set(["cancelled", "refunded", "completed"]);
  }
});

// features/keystone/mutations/getCafeOrder.ts
async function getCafeOrder(_root, args, context) {
  if (!args.orderId) return null;
  const isStaff = permissions.canReadOrders({ session: context.session });
  const actorId = context.session?.listKey === "User" ? context.session.itemId : null;
  if (!isStaff && !actorId && !args.secretKey) return null;
  const proof = await context.prisma.cafeOrder.findUnique({
    where: { id: args.orderId },
    select: { customerId: true, secretKey: true }
  });
  if (!proof || !isStaff && !(actorId && proof.customerId === actorId) && !cafeReceiptKeyMatches(args.secretKey, proof.secretKey)) return null;
  const order = await context.sudo().query.CafeOrder.findOne({
    where: { id: args.orderId },
    query: `
      id
      orderNumber
      status
      handoffCode
      pickupName
      promisedAt
      subtotal
      tax
      tip
      total
      currencyCode
      specialInstructions
      paidAt
      customerEmail
      discount
      loyaltyAccount { id }
      payments { status amount refundIdempotencyKey }
      customer { id }
      orderItems { id quantity itemNameSnapshot imagePathSnapshot customizationsSummary modifierSnapshot specialInstructions price }
    `
  });
  if (!order) return null;
  return {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    handoffCode: order.handoffCode,
    pickupName: order.pickupName,
    promisedAt: order.promisedAt,
    subtotal: order.subtotal,
    tax: order.tax,
    tip: order.tip || 0,
    total: order.total,
    currencyCode: order.currencyCode || "USD",
    specialInstructions: order.specialInstructions || null,
    paidAt: order.paidAt || null,
    // Rewards state for the receipt: the same settlement rule applyCafeLoyalty enforces.
    customerEmail: order.customerEmail || null,
    rewardsLinked: Boolean(order.loyaltyAccount?.id),
    rewardsEligible: (() => {
      const payable = Number(order.total || 0) - Number(order.discount || 0);
      return payable > 0 && hasCafeSettlement(Array.isArray(order.payments) ? order.payments : [], payable);
    })(),
    orderItems: await Promise.all((order.orderItems || []).map(async (item) => ({
      ...item,
      imagePathSnapshot: await resolveCafeImageUrl(context, item.imagePathSnapshot),
      modifierSnapshot: Array.isArray(item.modifierSnapshot) ? item.modifierSnapshot : []
    })))
  };
}
var init_getCafeOrder = __esm({
  "features/keystone/mutations/getCafeOrder.ts"() {
    "use strict";
    init_access();
    init_cafeStorefrontPolicy();
    init_coffeeOrderPolicy();
  }
});

// features/keystone/mutations/getCafeLoyaltyAccount.ts
function normalizeEmail2(email) {
  return email?.trim().toLowerCase() || null;
}
async function getCafeLoyaltyAccount(_root, args, context) {
  const email = normalizeEmail2(args.email);
  if (!email) return null;
  const isStaff = permissions.canReadLoyalty({ session: context.session }) || permissions.canManageLoyalty({ session: context.session });
  if (!isStaff) {
    if (!args.orderId && context.session?.listKey === "User" && context.session.itemId) {
      const user = await context.prisma.user.findUnique({ where: { id: context.session.itemId }, select: { email: true } });
      if (normalizeEmail2(user?.email) !== email) return null;
      const store2 = await context.prisma.storeSetting.findUnique({ where: { singletonKey: "primary" }, select: { id: true } });
      if (!store2?.id) return null;
      const own = await context.sudo().query.LoyaltyAccount.findMany({
        where: { customerEmail: { equals: email }, store: { id: { equals: store2.id } } },
        take: 1,
        query: "id customerEmail pointsBalance drinkCredits nextRewardProgress"
      });
      return own[0] || null;
    }
    if (!args.orderId || !args.secretKey) return null;
    const proof = await context.sudo().query.CafeOrder.findOne({
      where: { id: args.orderId },
      query: "id customerEmail secretKey"
    });
    if (!proof || !proof.secretKey || proof.secretKey !== args.secretKey) {
      return null;
    }
    if (normalizeEmail2(proof.customerEmail) !== email) {
      return null;
    }
    const linked = await context.sudo().query.CafeOrder.findOne({ where: { id: proof.id }, query: "id loyaltyAccount { id }" });
    if (!linked?.loyaltyAccount?.id) {
      return null;
    }
    return context.sudo().query.LoyaltyAccount.findOne({
      where: { id: linked.loyaltyAccount.id },
      query: "id customerEmail pointsBalance drinkCredits nextRewardProgress"
    });
  }
  const store = await context.prisma.storeSetting.findUnique({ where: { singletonKey: "primary" }, select: { id: true } });
  if (!store?.id) return null;
  const accounts = await context.sudo().query.LoyaltyAccount.findMany({
    where: { customerEmail: { equals: email }, store: { id: { equals: store.id } } },
    take: 1,
    query: "id customerName customerEmail customerPhone status tier pointsBalance lifetimePoints drinkCredits visits lastVisitAt nextRewardProgress"
  });
  return accounts[0] || null;
}
var init_getCafeLoyaltyAccount = __esm({
  "features/keystone/mutations/getCafeLoyaltyAccount.ts"() {
    "use strict";
    init_access();
  }
});

// features/keystone/mutations/loyaltyLink.ts
function normalizeLoyaltyEmail(email) {
  return email?.trim().toLowerCase() || null;
}
function loyaltyLinkDecision(input) {
  const { account, user } = input;
  if (!account || !user?.id) return "skip";
  if (account.customerId) return account.customerId === user.id ? "linked" : "skip";
  const email = normalizeLoyaltyEmail(user.email);
  if (!email || email !== normalizeLoyaltyEmail(account.customerEmail)) return "skip";
  if (user.loyaltyAccountId && user.loyaltyAccountId !== account.id) return "skip";
  return "link";
}
var init_loyaltyLink = __esm({
  "features/keystone/mutations/loyaltyLink.ts"() {
    "use strict";
  }
});

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
async function applyCafeLoyalty(_root, args, context) {
  const isOperator = permissions.canManageLoyalty({ session: context.session });
  const email = normalizeEmail3(args.customerEmail);
  if (!args.orderId) throw new Error("Order id is required");
  if (!email) throw new Error("Customer email is required to apply loyalty");
  if (args.redeemDrinkCredit) {
    throw new Error("Drink-credit redemption is unavailable until it is integrated with tender authorization");
  }
  const customerName = args.customerName?.trim() || null;
  const customerPhone = normalizePhone2(args.customerPhone);
  if ((customerName?.length || 0) > 200 || (customerPhone?.length || 0) > 40) throw new Error("Customer name or phone is too long");
  const requestFingerprint = fingerprintInput({ orderId: args.orderId, customerEmail: email, customerName, customerPhone });
  const eventKey = `loyalty:${args.orderId}:earned:v1`;
  const accountId = await context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx;
    await lockCoffeeOrder(tx, args.orderId);
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `loyalty-account:${email}`);
    const actorId = isOperator ? await requireCurrentCoffeeCapability(rawTx, context.session, ["canManageLoyalty"], "Not authorized to apply loyalty") : null;
    const order = await tx.cafeOrder.findUnique({
      where: { id: args.orderId },
      select: {
        id: true,
        secretKey: true,
        storeId: true,
        customerId: true,
        subtotal: true,
        total: true,
        discount: true,
        customerName: true,
        customerEmail: true,
        customerPhone: true,
        loyaltyAccountId: true,
        payments: { select: { status: true, amount: true, refundIdempotencyKey: true } }
      }
    });
    if (!order) throw new Error("Order not found");
    const isOrderCustomer = context.session?.listKey === "User" && Boolean(order.customerId) && order.customerId === context.session.itemId;
    if (!isOperator && !isOrderCustomer && (!order.secretKey || !args.secretKey || args.secretKey !== order.secretKey)) {
      throw new Error("You do not have access to apply loyalty to this order");
    }
    const storeId = await getPrimaryCoffeeStoreId(tx);
    assertCoffeeStoreOwnership(order.storeId, storeId, "Order");
    const orderEmail = normalizeEmail3(String(order.customerEmail || ""));
    if (!isOperator && (!orderEmail || email !== orderEmail)) {
      throw cafeCustomerError("Use the email this order was placed with");
    }
    const payments = Array.isArray(order.payments) ? order.payments : [];
    const payableAmount = Number(order.total || 0) - Number(order.discount || 0);
    if (payableAmount <= 0 || !hasCafeSettlement(payments, payableAmount)) throw cafeCustomerError("Rewards apply once the order is paid in full");
    if (order.loyaltyAccountId) {
      const receipt = await tx.coffeeCommandReceipt.findUnique({ where: { eventKey } });
      const payload = receipt?.payload && typeof receipt.payload === "object" ? receipt.payload : null;
      let matches;
      if (payload && typeof payload.requestFingerprint === "string") {
        matches = payload.requestFingerprint === requestFingerprint;
      } else {
        const linked = await tx.loyaltyAccount.findUnique({ where: { id: String(order.loyaltyAccountId) }, select: { customerEmail: true } });
        matches = normalizeEmail3(String(linked?.customerEmail || "")) === email;
      }
      if (!matches) throw cafeCustomerError("Rewards were already applied to this order with different details");
      return String(order.loyaltyAccountId);
    }
    const now = /* @__PURE__ */ new Date();
    const earnedPoints = pointsForSubtotal(Number(order.subtotal || 0));
    const existing = await tx.loyaltyAccount.findFirst({ where: { customerEmail: email } });
    const signedInUser = isOrderCustomer ? await tx.user.findUnique({ where: { id: String(order.customerId) }, select: { id: true, email: true, loyaltyAccount: { select: { id: true } } } }) : null;
    const signedIn = signedInUser ? { id: signedInUser.id, email: signedInUser.email, loyaltyAccountId: signedInUser.loyaltyAccount?.id || null } : null;
    let id;
    let newlyEarnedCredits;
    if (existing) {
      assertCoffeeStoreOwnership(existing.storeId, storeId, "Loyalty account");
      const ownerId = existing.customerId ? String(existing.customerId) : null;
      const isSignedInOwner = Boolean(ownerId) && context.session?.listKey === "User" && context.session.itemId === ownerId && String(order.customerId || "") === ownerId;
      const link = loyaltyLinkDecision({ account: { id: String(existing.id), customerId: ownerId, customerEmail: String(existing.customerEmail || "") }, user: signedIn }) === "link";
      if (!isOperator && !isSignedInOwner && !link) {
        throw cafeCustomerError("This email already has a rewards account. Sign in to that account, or ask the cafe to apply this purchase.");
      }
      if ((existing.status || "active") !== "active") throw cafeCustomerError("This rewards account is paused or closed, so the purchase was not applied");
      const pointsAfterEarn = Number(existing.pointsBalance || 0) + earnedPoints;
      newlyEarnedCredits = Math.floor(pointsAfterEarn / 100);
      const updated = await tx.loyaltyAccount.update({
        where: { id: existing.id },
        data: {
          pointsBalance: pointsAfterEarn % 100,
          lifetimePoints: Number(existing.lifetimePoints || 0) + earnedPoints,
          drinkCredits: Number(existing.drinkCredits || 0) + newlyEarnedCredits,
          visits: Number(existing.visits || 0) + 1,
          firstVisitAt: existing.firstVisitAt || now,
          lastVisitAt: now,
          ...link && signedIn ? { customerId: signedIn.id } : {}
        },
        select: { id: true }
      });
      id = updated.id;
    } else {
      newlyEarnedCredits = Math.floor(earnedPoints / 100);
      const created = await tx.loyaltyAccount.create({
        data: {
          storeId,
          customerName: customerName || order.customerName || email,
          customerEmail: email,
          customerPhone: customerPhone || order.customerPhone || "",
          status: "active",
          tier: "regular",
          pointsBalance: earnedPoints % 100,
          lifetimePoints: earnedPoints,
          drinkCredits: newlyEarnedCredits,
          visits: 1,
          firstVisitAt: now,
          lastVisitAt: now,
          // New accounts opened by the signed-in customer belong to them; guests stay email-only.
          ...signedIn && signedIn.email?.trim().toLowerCase() === email && !signedIn.loyaltyAccountId ? { customerId: signedIn.id } : {}
        },
        select: { id: true }
      });
      id = created.id;
    }
    await tx.cafeOrder.update({ where: { id: args.orderId }, data: { loyaltyAccountId: id } });
    await tx.loyaltyEvent.create({
      data: {
        accountId: id,
        orderId: args.orderId,
        type: "earned",
        pointsDelta: earnedPoints,
        drinkCreditsDelta: newlyEarnedCredits,
        note: `Earned ${earnedPoints} points on order ${args.orderId}`,
        createdById: actorId
      }
    });
    await recordCoffeeCommandReceipt(tx, {
      storeId,
      eventKey,
      eventType: "loyalty.earned",
      aggregateType: "loyalty_account",
      aggregateId: id,
      occurredAt: now,
      payload: { accountId: id, orderId: args.orderId, earnedPoints, drinkCreditsEarned: newlyEarnedCredits, appliedBy: actorId, requestFingerprint }
    });
    return id;
  }, TX_OPTIONS4);
  return context.sudo().query.LoyaltyAccount.findOne({ where: { id: accountId }, query: isOperator ? ACCOUNT_QUERY : GUEST_ACCOUNT_QUERY });
}
var TX_OPTIONS4, ACCOUNT_QUERY, GUEST_ACCOUNT_QUERY;
var init_applyCafeLoyalty = __esm({
  "features/keystone/mutations/applyCafeLoyalty.ts"() {
    "use strict";
    init_access();
    init_coffeeCommandReceipt();
    init_coffeeOrderPolicy();
    init_coffeeKdsAuthority();
    init_idempotency();
    init_cafeCustomerError();
    init_loyaltyLink();
    TX_OPTIONS4 = { maxWait: 5e3, timeout: 1e4, isolationLevel: "ReadCommitted" };
    ACCOUNT_QUERY = "id customerName customerEmail status tier pointsBalance lifetimePoints drinkCredits visits lastVisitAt nextRewardProgress";
    GUEST_ACCOUNT_QUERY = "id customerEmail pointsBalance drinkCredits nextRewardProgress";
  }
});

// features/keystone/mutations/linkCoffeeCustomerLoyalty.ts
async function linkCoffeeCustomerLoyalty(_root, _args, context) {
  const userId = context.session?.listKey === "User" && context.session.itemId ? String(context.session.itemId) : null;
  if (!userId) return false;
  return context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx;
    const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, email: true, loyaltyAccount: { select: { id: true } } } });
    const email = normalizeLoyaltyEmail(user?.email);
    if (!user || !email) return false;
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `loyalty-account:${email}`);
    const store = await tx.storeSetting.findUnique({ where: { singletonKey: "primary" }, select: { id: true } });
    if (!store) return false;
    const account = await tx.loyaltyAccount.findFirst({ where: { customerEmail: email, storeId: store.id }, select: { id: true, customerId: true, customerEmail: true } });
    const decision = loyaltyLinkDecision({ account, user: { id: user.id, email: user.email, loyaltyAccountId: user.loyaltyAccount?.id || null } });
    if (decision === "linked") return true;
    if (decision !== "link" || !account) return false;
    await tx.loyaltyAccount.update({ where: { id: account.id }, data: { customerId: user.id } });
    await recordCoffeeCommandReceipt(tx, {
      storeId: store.id,
      eventKey: `loyalty:${account.id}:customer-linked:${user.id}`,
      eventType: "loyalty.customer_linked",
      aggregateType: "loyalty_account",
      aggregateId: account.id,
      payload: { accountId: account.id, customerId: user.id, via: "sign_in" }
    });
    return true;
  }, { maxWait: 5e3, timeout: 1e4, isolationLevel: "ReadCommitted" });
}
var init_linkCoffeeCustomerLoyalty = __esm({
  "features/keystone/mutations/linkCoffeeCustomerLoyalty.ts"() {
    "use strict";
    init_coffeeCommandReceipt();
    init_loyaltyLink();
  }
});

// features/integrations/payment/manual.ts
var manual_exports = {};
__export(manual_exports, {
  capturePaymentFunction: () => capturePaymentFunction2,
  createPaymentFunction: () => createPaymentFunction2,
  generatePaymentLinkFunction: () => generatePaymentLinkFunction2,
  getPaymentStatusFunction: () => getPaymentStatusFunction2,
  handleWebhookFunction: () => handleWebhookFunction2,
  refundPaymentFunction: () => refundPaymentFunction2
});
async function createPaymentFunction2(input) {
  return {
    success: true,
    provider: "pp_system_default",
    providerPaymentId: `manual_${(0, import_node_crypto7.randomUUID)()}`,
    status: "pending",
    amount: input.amount,
    currencyCode: input.currencyCode,
    data: { message: "Offline payment remains pending until an authorized operator records settlement." }
  };
}
async function capturePaymentFunction2(input) {
  return { success: true, provider: "pp_system_default", providerPaymentId: input.providerPaymentId, status: "captured", amount: input.amount };
}
async function refundPaymentFunction2(input) {
  return {
    success: true,
    provider: "pp_system_default",
    providerPaymentId: input.providerPaymentId,
    status: "refunded",
    amount: input.amount,
    data: { reason: input.reason || "operator_refund", boundary: "Cafe cash-ledger refund only. External card refunds require separately recorded terminal evidence." }
  };
}
async function getPaymentStatusFunction2(input) {
  return { success: true, provider: "pp_system_default", providerPaymentId: input.providerPaymentId, status: "pending" };
}
async function generatePaymentLinkFunction2(input) {
  return createPaymentFunction2(input);
}
async function handleWebhookFunction2(input) {
  void input;
  throw new Error("Manual/offline payments do not accept webhooks");
}
var import_node_crypto7;
var init_manual = __esm({
  "features/integrations/payment/manual.ts"() {
    "use strict";
    import_node_crypto7 = require("node:crypto");
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
function apiBase() {
  return PAYPAL_API;
}
function credentials() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error("PayPal is not configured");
  return { clientId, clientSecret };
}
async function accessToken() {
  const { clientId, clientSecret } = credentials();
  const response = await fetch(`${apiBase()}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: "grant_type=client_credentials",
    signal: AbortSignal.timeout(1e4)
  });
  const payload = await response.json();
  if (!response.ok || !payload.access_token) throw new ProviderError(payload.error_description || "PayPal authentication failed");
  return payload.access_token;
}
async function paypalRequest(path, method = "GET", body, idempotencyKey) {
  const response = await fetch(`${apiBase()}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${await accessToken()}`,
      "Content-Type": "application/json",
      ...idempotencyKey ? { "PayPal-Request-Id": idempotencyKey } : {}
    },
    body: body === void 0 ? void 0 : JSON.stringify(body),
    signal: AbortSignal.timeout(1e4)
  });
  const payload = await response.json();
  if (!response.ok) throw new ProviderError(payload.message || "PayPal request failed");
  return payload;
}
function formatAmount(amount) {
  return (amount / 100).toFixed(2);
}
function parseAmount(value) {
  if (!value) return null;
  const amount = Math.round(Number(value) * 100);
  return Number.isSafeInteger(amount) ? amount : null;
}
function adapterResult2(payload, fallbackAmount) {
  return {
    success: true,
    provider: "pp_paypal_paypal",
    providerPaymentId: payload.id,
    status: payload.status?.toLowerCase(),
    amount: parseAmount(payload.amount?.value) ?? fallbackAmount,
    currencyCode: payload.amount?.currency_code,
    data: payload
  };
}
async function createPaymentFunction3(input) {
  const payload = await paypalRequest("/v2/checkout/orders", "POST", {
    intent: "CAPTURE",
    purchase_units: [{
      custom_id: input.orderId,
      invoice_id: input.paymentId,
      amount: {
        currency_code: input.currencyCode.toUpperCase(),
        value: formatAmount(input.amount)
      }
    }]
  }, input.idempotencyKey);
  return {
    ...adapterResult2(payload, input.amount),
    data: {
      ...payload,
      checkoutUrl: payload.links?.find((link) => link.rel === "approve")?.href || null
    }
  };
}
async function capturePaymentFunction3(input) {
  const payload = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(input.providerPaymentId)}/capture`, "POST", {});
  return adapterResult2(payload, input.amount);
}
async function refundPaymentFunction3(input) {
  const payload = await paypalRequest(`/v2/payments/captures/${encodeURIComponent(input.providerPaymentId)}/refund`, "POST", {
    ...input.amount == null ? {} : { amount: { value: formatAmount(input.amount), currency_code: (input.currencyCode || "USD").toUpperCase() } },
    note_to_payer: input.reason
  }, input.idempotencyKey);
  return { ...adapterResult2(payload, input.amount), status: payload.status === "COMPLETED" ? "refunded" : payload.status?.toLowerCase() };
}
async function getPaymentStatusFunction3(input) {
  return adapterResult2(await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(input.providerPaymentId)}`));
}
async function generatePaymentLinkFunction3(input) {
  return createPaymentFunction3(input);
}
function classify(type) {
  if (type === "PAYMENT.CAPTURE.COMPLETED") return "succeeded";
  if (type === "PAYMENT.CAPTURE.DENIED" || type === "PAYMENT.CAPTURE.DECLINED" || type === "CHECKOUT.PAYMENT-APPROVAL.REVERSED") return "failed";
  return "ignored";
}
async function handleWebhookFunction3(input) {
  const event = JSON.parse(input.rawBody);
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) throw new Error("PayPal webhook is not configured");
  const requiredHeaders = [
    "paypal-auth-algo",
    "paypal-cert-url",
    "paypal-transmission-id",
    "paypal-transmission-sig",
    "paypal-transmission-time"
  ];
  if (requiredHeaders.some((header) => !input.headers[header])) throw new Error("PayPal signature headers are incomplete");
  const verification = await paypalRequest("/v1/notifications/verify-webhook-signature", "POST", {
    auth_algo: input.headers["paypal-auth-algo"],
    cert_url: input.headers["paypal-cert-url"],
    transmission_id: input.headers["paypal-transmission-id"],
    transmission_sig: input.headers["paypal-transmission-sig"],
    transmission_time: input.headers["paypal-transmission-time"],
    webhook_id: webhookId,
    webhook_event: event
  });
  if (verification.verification_status !== "SUCCESS") throw new Error("Invalid PayPal webhook signature");
  const resource = event.resource || {};
  const unit = resource.purchase_units?.[0];
  const eventId = String(event.id || "").trim();
  const eventType = String(event.event_type || "").trim();
  const providerPaymentId = String(resource.supplementary_data?.related_ids?.order_id || resource.id || "").trim();
  if (!eventId || !eventType || !providerPaymentId) throw new Error("PayPal webhook identity is incomplete");
  return {
    eventId,
    eventType,
    providerPaymentId,
    paymentId: resource.invoice_id || unit?.invoice_id || null,
    orderId: resource.custom_id || unit?.custom_id || null,
    status: classify(eventType),
    amount: parseAmount(resource.amount?.value || unit?.amount?.value),
    currencyCode: resource.amount?.currency_code || unit?.amount?.currency_code || null
  };
}
var PAYPAL_API;
var init_paypal = __esm({
  "features/integrations/payment/paypal.ts"() {
    "use strict";
    init_providerError();
    PAYPAL_API = "https://api-m.paypal.com";
  }
});

// features/integrations/payment/index.ts
function normalizePaymentProviderCode(value) {
  const code = PROVIDER_ALIASES[value.trim().toLowerCase()];
  if (!code) throw new Error("Unsupported payment provider");
  return code;
}
function isOnlinePaymentProviderCode(code) {
  return ONLINE_PAYMENT_PROVIDER_CODES.includes(code);
}
function assertCustomerPaymentProvider(code) {
  if (!isOnlinePaymentProviderCode(code)) {
    throw new Error("Manual/offline payments are operator-only and cannot settle public checkout");
  }
}
function getPaymentProviderAdapter(code) {
  return paymentProviderAdapters[code]();
}
var ONLINE_PAYMENT_PROVIDER_CODES, OFFLINE_PAYMENT_PROVIDER_CODE, paymentProviderAdapters, PROVIDER_ALIASES;
var init_payment = __esm({
  "features/integrations/payment/index.ts"() {
    "use strict";
    ONLINE_PAYMENT_PROVIDER_CODES = ["pp_stripe_stripe", "pp_paypal_paypal"];
    OFFLINE_PAYMENT_PROVIDER_CODE = "pp_system_default";
    paymentProviderAdapters = Object.freeze({
      pp_system_default: () => Promise.resolve().then(() => (init_manual(), manual_exports)),
      pp_stripe_stripe: () => Promise.resolve().then(() => (init_stripe(), stripe_exports)),
      pp_paypal_paypal: () => Promise.resolve().then(() => (init_paypal(), paypal_exports))
    });
    PROVIDER_ALIASES = Object.freeze({
      manual: OFFLINE_PAYMENT_PROVIDER_CODE,
      cash: OFFLINE_PAYMENT_PROVIDER_CODE,
      pp_system_default: OFFLINE_PAYMENT_PROVIDER_CODE,
      stripe: "pp_stripe_stripe",
      pp_stripe_stripe: "pp_stripe_stripe",
      paypal: "pp_paypal_paypal",
      pp_paypal_paypal: "pp_paypal_paypal"
    });
  }
});

// features/keystone/utils/paymentProviderAdapter.ts
function getStaticPaymentProviderCode(provider) {
  const code = normalizePaymentProviderCode(provider.code);
  if (code !== provider.code) throw new Error(`Payment provider record must use canonical code ${code}`);
  return code;
}
async function executePaymentProviderAdapter({
  provider,
  functionName,
  args
}) {
  const code = getStaticPaymentProviderCode(provider);
  const adapter = await getPaymentProviderAdapter(code);
  const fn = adapter[functionName];
  if (typeof fn !== "function") throw new Error(`Payment provider ${code} does not support ${functionName}`);
  const callable = fn;
  return await callable(args);
}
var init_paymentProviderAdapter = __esm({
  "features/keystone/utils/paymentProviderAdapter.ts"() {
    "use strict";
    init_payment();
  }
});

// features/keystone/lib/onlinePayment.ts
function stripeKeysPresent(env = process.env) {
  return Boolean(env.STRIPE_SECRET_KEY?.trim() && env.STRIPE_WEBHOOK_SECRET?.trim());
}
async function onlinePaymentReady(prisma) {
  if (!stripeKeysPresent()) return false;
  const provider = await prisma.paymentProvider.findUnique({ where: { code: "pp_stripe_stripe" }, select: { isInstalled: true } });
  return provider?.isInstalled === true;
}
function validPaymentReturnUrl(value) {
  if (typeof value !== "string" || value.length > 2e3) return null;
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.pathname !== "/order-confirmed" || url.username || url.password) return null;
    return url.toString();
  } catch {
    return null;
  }
}
var init_onlinePayment = __esm({
  "features/keystone/lib/onlinePayment.ts"() {
    "use strict";
  }
});

// features/keystone/mutations/initiateCafePaymentSession.ts
async function initiateCafePaymentSession(_root, args, context) {
  if (!args.orderId) throw new Error("Order id is required");
  if (!args.paymentProvider) throw new Error("Payment provider is required");
  const providerCode = normalizePaymentProviderCode(args.paymentProvider);
  if (providerCode !== "pp_stripe_stripe") throw cafeCustomerError("Online payment is by card only");
  if (!await onlinePaymentReady(context.prisma)) throw cafeCustomerError("Online payment isn't available. Pay at pickup.");
  const returnUrl = validPaymentReturnUrl(args.returnUrl);
  if (!returnUrl) throw new Error("Payment return URL is invalid");
  const isStaff = permissions.canManagePayments({ session: context.session }) || permissions.canManageOrders({ session: context.session });
  if (!isStaff) assertCustomerPaymentProvider(providerCode);
  const sudo = context.sudo();
  const order = await sudo.query.CafeOrder.findOne({
    where: { id: args.orderId },
    query: "id secretKey orderNumber total discount currencyCode customerEmail customerName status store { id } customer { id } payments { id status provider providerPaymentId amount idempotencyKey paymentProvider { id code isInstalled } }"
  });
  if (!order) throw new Error("Order not found");
  if (!order.store?.id) throw new Error("Order store ownership is missing");
  const isOwner = context.session?.listKey === "User" && order.customer?.id === context.session.itemId;
  const hasValidSecret = cafeReceiptKeyMatches(args.secretKey, order.secretKey);
  if (!isStaff && !isOwner && !hasValidSecret) throw cafeCustomerError("This order could not be verified");
  if (TERMINAL_ORDER_STATUSES2.has(order.status)) throw cafeCustomerError("This order can no longer be paid online");
  const payableAmount = Math.max(0, Number(order.total || 0) - Number(order.discount || 0));
  if (!Number.isSafeInteger(payableAmount) || payableAmount <= 0) throw cafeCustomerError("This order has nothing to pay");
  const payments = order.payments || [];
  if (payments.some((payment2) => payment2.status === "captured")) throw cafeCustomerError("This order is already paid");
  const clientKey = normalizeIdempotencyKey(args.idempotencyKey);
  if (!clientKey) throw new Error("Payment idempotency key is required");
  const scope = context.session?.listKey === "User" ? context.session.itemId : order.id;
  const scopedKey5 = buildScopedIdempotencyKey(`payment:${scope}`, clientKey);
  const [provider] = await sudo.query.PaymentProvider.findMany({
    where: { code: { equals: providerCode }, isInstalled: { equals: true } },
    take: 1,
    query: "id code isInstalled"
  });
  if (!provider) throw cafeCustomerError("Online payment isn't available. Pay at pickup.");
  for (const pending of payments.filter((payment2) => payment2.provider === providerCode && (payment2.status === "pending" || payment2.status === "authorized"))) {
    const sessionId = String(pending.providerPaymentId || "");
    if (!sessionId.startsWith("cs_")) continue;
    const state = await executePaymentProviderAdapter({ provider, functionName: "getPaymentStatusFunction", args: { providerPaymentId: sessionId } });
    const checkoutUrl = typeof state.data?.checkoutUrl === "string" ? state.data.checkoutUrl : null;
    if (state.status === "open" && checkoutUrl) {
      return { success: true, paymentId: pending.id, provider: providerCode, providerPaymentId: sessionId, status: "pending", amount: pending.amount ?? payableAmount, checkoutUrl, error: null };
    }
    if (state.status === "complete") {
      return { success: true, paymentId: pending.id, provider: providerCode, providerPaymentId: sessionId, status: "processing", amount: pending.amount ?? payableAmount, checkoutUrl: null, error: null };
    }
    await sudo.db.Payment.updateOne({ where: { id: pending.id }, data: { status: "failed", failureMessage: "Hosted payment page expired" } });
  }
  const claim = await context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx;
    await lockCoffeeOrder(tx, order.id);
    const lockedOrder = await tx.cafeOrder.findUnique({
      where: { id: order.id },
      select: {
        id: true,
        storeId: true,
        status: true,
        payments: { select: { id: true, status: true, provider: true, providerPaymentId: true, amount: true, idempotencyKey: true } }
      }
    });
    if (!lockedOrder) throw new Error("Order not found");
    if (lockedOrder.storeId !== order.store?.id) throw new Error("Order store ownership changed");
    if (TERMINAL_ORDER_STATUSES2.has(String(lockedOrder.status))) throw cafeCustomerError("This order can no longer be paid online");
    const lockedPayments = Array.isArray(lockedOrder.payments) ? lockedOrder.payments : [];
    if (lockedPayments.some((candidate) => candidate.status === "captured")) throw cafeCustomerError("This order is already paid");
    const keyed = lockedPayments.find((candidate) => candidate.idempotencyKey === scopedKey5);
    if (keyed && keyed.status !== "failed") return { payment: keyed, reused: true };
    const created = await tx.payment.create({
      data: {
        orderId: order.id,
        storeId: order.store?.id,
        paymentProviderId: provider.id,
        // A retried key after a failed page gets a fresh row; the key stays unique per attempt.
        idempotencyKey: keyed ? `${scopedKey5}:${Date.now()}` : scopedKey5,
        status: "pending",
        method: "card",
        amount: payableAmount,
        currencyCode: order.currencyCode || "USD",
        provider: providerCode,
        providerPaymentId: ""
      },
      select: { id: true, status: true, provider: true, providerPaymentId: true, amount: true, idempotencyKey: true }
    });
    return { payment: created, reused: false };
  }, { maxWait: 5e3, timeout: 1e4, isolationLevel: "ReadCommitted" });
  const payment = claim.payment;
  if (claim.reused && payment.providerPaymentId) {
    const state = await executePaymentProviderAdapter({ provider, functionName: "getPaymentStatusFunction", args: { providerPaymentId: String(payment.providerPaymentId) } });
    const checkoutUrl = typeof state.data?.checkoutUrl === "string" ? state.data.checkoutUrl : null;
    return { success: Boolean(checkoutUrl) || state.status === "complete", paymentId: payment.id, provider: providerCode, providerPaymentId: payment.providerPaymentId, status: state.status === "complete" ? "processing" : "pending", amount: payment.amount ?? payableAmount, checkoutUrl, error: null };
  }
  let adapterResult3;
  try {
    adapterResult3 = await executePaymentProviderAdapter({
      provider,
      functionName: "generatePaymentLinkFunction",
      args: {
        orderId: order.id,
        paymentId: payment.id,
        // Stripe's own idempotency: a retried request returns the same hosted page.
        idempotencyKey: `${payment.id}:checkout`,
        amount: payableAmount,
        currencyCode: order.currencyCode || "USD",
        customerEmail: order.customerEmail,
        customerName: order.customerName,
        description: `Order #${order.orderNumber}`,
        returnUrl,
        metadata: { orderNumber: order.orderNumber }
      }
    });
  } catch (error) {
    adapterResult3 = { success: false, provider: providerCode, status: "failed", error: error instanceof Error ? error.message : "Payment provider request failed" };
  }
  await sudo.db.Payment.updateOne({
    where: { id: payment.id },
    data: {
      status: adapterResult3.success ? "pending" : "failed",
      providerPaymentId: adapterResult3.providerPaymentId || "",
      // Provider text stays in the ledger for staff; customers get a fixed message.
      failureMessage: adapterResult3.success ? "" : String(adapterResult3.error || "Payment provider request failed").slice(0, 500)
    }
  });
  if (!adapterResult3.success) throw cafeCustomerError("Online payment couldn't start. Try again or pay at pickup.");
  return {
    success: true,
    paymentId: payment.id,
    provider: providerCode,
    providerPaymentId: adapterResult3.providerPaymentId,
    status: "pending",
    amount: adapterResult3.amount ?? payableAmount,
    checkoutUrl: typeof adapterResult3.data?.checkoutUrl === "string" ? adapterResult3.data.checkoutUrl : null,
    error: null
  };
}
var TERMINAL_ORDER_STATUSES2;
var init_initiateCafePaymentSession = __esm({
  "features/keystone/mutations/initiateCafePaymentSession.ts"() {
    "use strict";
    init_payment();
    init_access();
    init_paymentProviderAdapter();
    init_idempotency();
    init_coffeeOrderPolicy();
    init_cafeStorefrontPolicy();
    init_cafeCustomerError();
    init_onlinePayment();
    TERMINAL_ORDER_STATUSES2 = /* @__PURE__ */ new Set(["paid", "completed", "cancelled", "refunded"]);
  }
});

// features/keystone/mutations/getCoffeeStore.ts
async function getCoffeeStore(_root, _args, context) {
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
    `
  });
  if (!store) return null;
  const contactEmail = String(store.contactEmail || "").trim();
  const isStaffLogin = contactEmail ? await context.prisma.user.count({ where: { email: { equals: contactEmail, mode: "insensitive" }, roleId: { not: null } } }) > 0 : false;
  const onlinePayment = await onlinePaymentReady(context.prisma).catch(() => false);
  return { ...store, onlinePayment, contactEmail: isStaffLogin ? "" : contactEmail, logoIcon: sanitizeStoreLogoSvg(store.logoIcon || ""), logoColor: normalizeStoreLogoColor(store.logoColor) };
}
var init_getCoffeeStore = __esm({
  "features/keystone/mutations/getCoffeeStore.ts"() {
    "use strict";
    init_sanitize_store_logo();
    init_store_logo();
    init_onlinePayment();
  }
});

// features/keystone/mutations/getCoffeeMenu.ts
function itemAvailability(item, store, stock) {
  if (!item.available) return "unavailable";
  if (stock.soldOut.has(String(item.id))) return "sold_out";
  const windows = Array.isArray(item.serviceWindows) ? item.serviceWindows : ["all_day"];
  if (getCoffeeOrderingAvailability(store, /* @__PURE__ */ new Date(), windows).orderingOpen) return "now";
  const earliest = cafeEarliestPickupMinutes(Number(store.pickupLeadTimeMinutes) || 12, [item.prepTimeMinutes]);
  return coffeeFirstPickupMinutes(store, earliest, [windows]) == null ? "unavailable" : "later";
}
async function readMenuStock(context, storeId, rows) {
  return cafeMenuStock(context.prisma, storeId, rows.map((row) => ({
    id: String(row.id),
    inventoryItemId: row.inventoryItemId ?? null,
    modifiers: Array.isArray(row.modifiers) ? row.modifiers : []
  })));
}
async function storefrontItem(context, item, store, stock) {
  if (!item) return null;
  const category = item.category;
  const availability = itemAvailability(item, store, stock);
  const modifiers = Array.isArray(item.modifiers) ? item.modifiers : [];
  return {
    ...item,
    available: availability === "now" || availability === "later",
    availability,
    serviceWindows: void 0,
    inventoryItemId: void 0,
    category: category ? { id: category.id, name: category.name } : null,
    temperatureOptions: Array.isArray(item.temperatureOptions) ? item.temperatureOptions : [],
    dietaryFlags: Array.isArray(item.dietaryFlags) ? item.dietaryFlags : [],
    modifiers: modifiers.map((modifier) => ({ ...modifier, inStock: Boolean(modifier.inStock) && !stock.modifiersOut.has(String(modifier.id)) })),
    primaryImageUrl: await resolveCafeImageUrl(context, cafeMenuItemImageReference(item)),
    menuItemImages: void 0
  };
}
function encodeCursor2(cursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}
function decodeCursor2(value, expected) {
  try {
    if (value.length > 1024) throw new Error();
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (typeof parsed.name !== "string" || typeof parsed.id !== "string" || !parsed.id) throw new Error();
    if (parsed.storeId !== expected.storeId || parsed.search !== expected.search || parsed.categoryId !== expected.categoryId) throw new Error();
    return parsed;
  } catch {
    throw new Error("This menu page link is out of date. Reload the menu.");
  }
}
async function getCoffeeMenu(_root, args, context) {
  const store = await context.prisma.storeSetting.findUnique({ where: { singletonKey: "primary" }, select: { id: true, timezone: true, weeklyHours: true, pickupLeadTimeMinutes: true } });
  if (!store) return args.menuItemId ? { item: null } : { categories: [], items: [], nextCursor: null, hasUncategorized: false };
  const storeId = String(store.id);
  if (args.menuItemId) {
    const item = await context.prisma.menuItem.findFirst({
      where: { id: args.menuItemId, storeId, ...PUBLISHED_MENU_ITEM_WHERE },
      select: itemSelect
    });
    return { item: await storefrontItem(context, item, store, await readMenuStock(context, storeId, item ? [item] : [])) };
  }
  const search = (args.search || "").trim().slice(0, 100);
  const categoryId = (args.categoryId || "").trim().slice(0, 255);
  const filters = [{ storeId }, PUBLISHED_MENU_ITEM_WHERE];
  if (categoryId === UNCATEGORIZED) filters.push({ categoryId: null });
  else if (categoryId) filters.push({ categoryId });
  if (search) {
    filters.push({ OR: [
      { name: { contains: search, mode: "insensitive" } },
      { shortDescription: { contains: search, mode: "insensitive" } },
      { category: { name: { contains: search, mode: "insensitive" } } }
    ] });
  }
  if (args.after) {
    const cursor = decodeCursor2(args.after, { storeId, search, categoryId });
    filters.push({ OR: [{ name: { gt: cursor.name } }, { name: cursor.name, id: { gt: cursor.id } }] });
  }
  const [categories, rows, uncategorizedCount] = await Promise.all([
    context.prisma.menuCategory.findMany({
      where: { storeId, active: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
      take: MAX_CATEGORIES,
      select: { id: true, name: true, description: true, active: true, sortOrder: true }
    }),
    context.prisma.menuItem.findMany({
      where: { AND: filters },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      take: STOREFRONT_MENU_PAGE_SIZE + 1,
      select: itemSelect
    }),
    context.prisma.menuItem.count({ where: { storeId, available: true, categoryId: null } })
  ]);
  const page = rows.slice(0, STOREFRONT_MENU_PAGE_SIZE);
  const last = page[page.length - 1];
  const stock = await readMenuStock(context, storeId, page);
  return {
    categories,
    items: await Promise.all(page.map((item) => storefrontItem(context, item, store, stock))),
    nextCursor: rows.length > STOREFRONT_MENU_PAGE_SIZE && last ? encodeCursor2({ storeId, search, categoryId, name: String(last.name), id: String(last.id) }) : null,
    hasUncategorized: uncategorizedCount > 0
  };
}
var STOREFRONT_MENU_PAGE_SIZE, MAX_CATEGORIES, UNCATEGORIZED, itemSelect;
var init_getCoffeeMenu = __esm({
  "features/keystone/mutations/getCoffeeMenu.ts"() {
    "use strict";
    init_coffeeAvailability();
    init_cafeMenuStock();
    init_cafeStorefrontPolicy();
    STOREFRONT_MENU_PAGE_SIZE = 48;
    MAX_CATEGORIES = 100;
    UNCATEGORIZED = "uncategorized";
    itemSelect = {
      id: true,
      name: true,
      shortDescription: true,
      price: true,
      available: true,
      featured: true,
      popular: true,
      imageUrl: true,
      prepTimeMinutes: true,
      caffeineMg: true,
      barStation: true,
      temperatureOptions: true,
      dietaryFlags: true,
      serviceWindows: true,
      ...MENU_STOCK_ITEM_SELECT,
      category: { select: { id: true, name: true, active: true } },
      modifiers: {
        orderBy: [{ modifierGroup: "asc" }, { name: "asc" }, { id: "asc" }],
        select: {
          id: true,
          name: true,
          modifierGroup: true,
          modifierGroupLabel: true,
          priceAdjustment: true,
          required: true,
          minSelections: true,
          maxSelections: true,
          defaultSelected: true,
          inStock: true,
          ...MENU_STOCK_MODIFIER_SELECT
        }
      },
      menuItemImages: { orderBy: { order: "asc" }, take: 1, select: { imagePath: true, image_id: true, image_extension: true } }
    };
  }
});

// features/keystone/mutations/updateCateringOrderStatus.ts
async function updateCateringOrderStatus(_root, args, context) {
  if (!permissions.canManageOrders({ session: context.session })) throw new Error("Not authorized to update catering order status");
  const id = await context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx;
    await requireCurrentCoffeeCapability(tx, context.session, ["canManageOrders"], "Not authorized to update catering order status");
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-catering:${args.cateringOrderId}`);
    const existing = await tx.cateringOrder.findUnique({ where: { id: args.cateringOrderId } });
    if (!existing) throw new Error("Catering order not found");
    const storeId = await getPrimaryCoffeeStoreId(tx);
    assertCoffeeStoreOwnership(existing.storeId, storeId, "Catering order");
    const transition = evaluateTransition(CATERING_ORDER_TRANSITIONS, String(existing.status), args.status);
    if (transition.replay) return String(existing.id);
    if (args.status === "quoted" && (Number(existing.subtotalCents || 0) <= 0 || !(existing.eventAt instanceof Date))) {
      throw new Error("Enter the quoted amount and the event date before marking this inquiry quoted.");
    }
    await tx.cateringOrder.update({ where: { id: existing.id }, data: { status: args.status } });
    await recordCoffeeCommandReceipt(tx, {
      storeId,
      eventKey: `catering:${String(existing.id)}:status:${args.status}:v1`,
      eventType: "catering.status_changed",
      aggregateType: "catering_order",
      aggregateId: String(existing.id),
      // Snapshot the terms the transition was accepted against.
      payload: {
        cateringOrderId: String(existing.id),
        cateringNumber: String(existing.cateringNumber),
        previousStatus: String(existing.status),
        status: args.status,
        terms: { eventAt: existing.eventAt instanceof Date ? existing.eventAt.toISOString() : null, guestCount: Number(existing.guestCount || 0), subtotalCents: Number(existing.subtotalCents || 0) }
      }
    });
    return String(existing.id);
  }, TX_OPTIONS5);
  return context.sudo().query.CateringOrder.findOne({ where: { id }, query });
}
var TX_OPTIONS5, query;
var init_updateCateringOrderStatus = __esm({
  "features/keystone/mutations/updateCateringOrderStatus.ts"() {
    "use strict";
    init_access();
    init_coffeeCommandReceipt();
    init_coffeeKdsAuthority();
    init_transitionPolicy();
    TX_OPTIONS5 = { maxWait: 5e3, timeout: 1e4, isolationLevel: "Serializable" };
    query = "id cateringNumber status store { id }";
  }
});

// features/keystone/mutations/coffeeCoverageCommands.ts
function conflict(error) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2034";
}
async function serializable(context, operation) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      return await context.prisma.$transaction((rawTx) => operation(rawTx), TX_OPTIONS6);
    } catch (error) {
      if (!conflict(error) || attempt === 3) throw error;
    }
  }
  throw new Error("Transaction retry limit exceeded");
}
function requireKey(value, label) {
  const key = normalizeIdempotencyKey(value);
  if (!key) throw new Error(`${label} idempotency key is required`);
  return key;
}
async function replayReceipt(tx, eventKey, storeId, requestFingerprint, message) {
  const receipt = await tx.coffeeCommandReceipt.findUnique({ where: { eventKey } });
  if (!receipt) return null;
  const payload = receipt.payload && typeof receipt.payload === "object" ? receipt.payload : {};
  if (receipt.storeId !== storeId || payload.requestFingerprint !== requestFingerprint) throw new Error(message);
  return String(receipt.aggregateId);
}
function cateringNumber(timezone, at = /* @__PURE__ */ new Date()) {
  let date = at.toISOString().slice(2, 10).replace(/-/g, "");
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: timezone || "America/New_York", year: "2-digit", month: "2-digit", day: "2-digit" }).formatToParts(at);
    const part = (type) => parts.find((entry) => entry.type === type)?.value || "";
    date = `${part("year")}${part("month")}${part("day")}`;
  } catch {
  }
  return `CAT-${date}-${(0, import_node_crypto8.randomBytes)(3).toString("hex").toUpperCase()}`;
}
function validCateringEventAt(value, now = /* @__PURE__ */ new Date()) {
  const at = new Date(value);
  if (!Number.isFinite(at.getTime())) return { ok: false, message: "Choose the event date and time" };
  if (at.getTime() < now.getTime() + CATERING_LEAD_HOURS * 36e5) return { ok: false, message: "Catering needs at least 24 hours' notice" };
  if (at.getTime() > now.getTime() + CATERING_HORIZON_DAYS * 864e5) return { ok: false, message: "Choose a date within the next year" };
  return { ok: true, at };
}
function cateringReceipt(row) {
  const status = String(row.status || "inquiry");
  return {
    id: String(row.id),
    cateringNumber: String(row.cateringNumber),
    status,
    eventAt: row.eventAt instanceof Date ? row.eventAt.toISOString() : row.eventAt ? String(row.eventAt) : null,
    guestCount: Number(row.guestCount || 0),
    deliveryAddress: row.deliveryAddress ? String(row.deliveryAddress) : null,
    // The amount is the customer's once it has been quoted.
    quotedCents: status === "inquiry" || status === "cancelled" ? null : Number(row.subtotalCents || 0),
    createdAt: row.createdAt instanceof Date ? row.createdAt.toISOString() : String(row.createdAt || "")
  };
}
async function requestCafeCatering(_root, args, context) {
  const parsed = cateringInput.safeParse(args);
  if (!parsed.success) throw cafeCustomerError(parsed.error.issues[0]?.message || "Check the catering details");
  const input = parsed.data;
  const clientKey = requireKey(input.idempotencyKey, "Catering request");
  const eventAt = validCateringEventAt(input.eventAt);
  if (!eventAt.ok) throw cafeCustomerError(eventAt.message);
  const scopedKey5 = buildScopedIdempotencyKey(`catering-request:${input.customerEmail}`, clientKey);
  const eventKey = `catering-request:${scopedKey5}`;
  const request = {
    customerName: input.customerName,
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone || "",
    eventAt: eventAt.at.toISOString(),
    guestCount: input.guestCount,
    deliveryAddress: input.deliveryAddress || "",
    notes: input.notes || ""
  };
  const requestFingerprint = fingerprintInput(request);
  const id = await serializable(context, async (tx) => {
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", eventKey);
    const store = await tx.storeSetting.findUnique({ where: { singletonKey: "primary" }, select: { id: true, timezone: true } });
    if (!store) throw cafeCustomerError("Catering requests aren't available right now");
    const storeId = String(store.id);
    const replay = await replayReceipt(tx, eventKey, storeId, requestFingerprint, "This catering request was already sent with different details");
    if (replay) return replay;
    const open = await tx.cateringOrder.findMany({ where: { storeId, customerEmail: input.customerEmail, status: { in: ["inquiry", "quoted"] } }, select: { id: true }, take: 6 });
    if (open.length >= 5) throw cafeCustomerError("This email already has 5 open catering requests. The cafe will be in touch about those first.");
    const created = await tx.cateringOrder.create({
      data: {
        storeId,
        cateringNumber: cateringNumber(store.timezone ? String(store.timezone) : null),
        customerName: request.customerName,
        customerEmail: request.customerEmail,
        status: "inquiry",
        eventAt: eventAt.at,
        guestCount: request.guestCount,
        deliveryAddress: request.deliveryAddress,
        subtotalCents: 0,
        notes: request.notes,
        metadata: { source: "storefront", customerPhone: request.customerPhone, customerId: context.session?.listKey === "User" ? context.session.itemId : null }
      }
    });
    await recordCoffeeCommandReceipt(tx, {
      storeId,
      eventKey,
      eventType: "catering.requested",
      aggregateType: "catering_order",
      aggregateId: String(created.id),
      payload: { requestFingerprint, cateringOrderId: String(created.id), cateringNumber: String(created.cateringNumber), eventAt: request.eventAt, guestCount: request.guestCount }
    });
    return String(created.id);
  });
  const row = await context.prisma.cateringOrder.findUnique({ where: { id } });
  if (!row) throw new Error("Catering request not found");
  return cateringReceipt(row);
}
async function getCoffeeCustomerCatering(_root, _args, context) {
  const customerId = context.session?.listKey === "User" ? context.session.itemId : null;
  if (!customerId) throw new Error("Sign in to view catering requests");
  const user = await context.prisma.user.findUnique({ where: { id: customerId }, select: { email: true } });
  const email = String(user?.email || "").trim().toLowerCase();
  if (!email) return [];
  const rows = await context.prisma.cateringOrder.findMany({ where: { customerEmail: email }, orderBy: [{ eventAt: "desc" }, { id: "desc" }], take: 20 });
  return rows.map(cateringReceipt);
}
function planLoyaltyAdjustment(account, pointsDelta, drinkCreditsDelta) {
  const points = Number(account.pointsBalance || 0) + pointsDelta;
  if (points < 0) return { ok: false, message: "That would take points below zero" };
  const rolled = Math.floor(points / 100);
  const credits = Number(account.drinkCredits || 0) + drinkCreditsDelta + rolled;
  if (credits < 0) return { ok: false, message: "That would take drink credits below zero" };
  return {
    ok: true,
    pointsBalance: points % 100,
    drinkCredits: credits,
    lifetimePoints: Number(account.lifetimePoints || 0) + Math.max(0, pointsDelta),
    creditsDelta: drinkCreditsDelta + rolled
  };
}
async function adjustCoffeeLoyaltyAccount(_root, args, context) {
  if (!permissions.canManageLoyalty({ session: context.session })) throw new Error("Not authorized to manage rewards");
  const clientKey = requireKey(args.idempotencyKey, "Rewards adjustment");
  const pointsDelta = Number(args.pointsDelta || 0);
  const drinkCreditsDelta = Number(args.drinkCreditsDelta || 0);
  if (![pointsDelta, drinkCreditsDelta].every((value) => Number.isSafeInteger(value) && Math.abs(value) <= 1e5)) throw cafeCustomerError("Adjustments must be whole numbers");
  const status = args.status ? String(args.status) : null;
  const tier = args.tier ? String(args.tier) : null;
  if (status && !LOYALTY_STATUSES.has(status)) throw cafeCustomerError("Choose active, paused or closed");
  if (tier && !LOYALTY_TIERS.has(tier)) throw cafeCustomerError("Choose a listed tier");
  const note = String(args.note || "").trim().slice(0, 500);
  if (!note) throw cafeCustomerError("Enter a reason for the adjustment");
  if (!pointsDelta && !drinkCreditsDelta && !status && !tier) throw cafeCustomerError("Nothing to change");
  const id = await serializable(context, async (tx) => {
    const actorId = await requireCurrentCoffeeCapability(tx, context.session, ["canManageLoyalty"], "Not authorized to manage rewards");
    const eventKey = `loyalty-adjust:${buildScopedIdempotencyKey(`loyalty-adjust:${actorId}`, clientKey)}`;
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-loyalty:${args.accountId}`);
    const storeId = await getPrimaryCoffeeStoreId(tx);
    const requestFingerprint = fingerprintInput({ accountId: args.accountId, pointsDelta, drinkCreditsDelta, status, tier, note });
    const replay = await replayReceipt(tx, eventKey, storeId, requestFingerprint, "This adjustment was already recorded with different details. Refresh and try again.");
    if (replay) return replay;
    const account = await tx.loyaltyAccount.findUnique({ where: { id: args.accountId } });
    if (!account) throw new Error("Rewards account not found");
    assertCoffeeStoreOwnership(account.storeId, storeId, "Rewards account");
    if (status) evaluateTransition(LOYALTY_ACCOUNT_TRANSITIONS, String(account.status || "active"), status);
    const plan = planLoyaltyAdjustment(account, pointsDelta, drinkCreditsDelta);
    if (!plan.ok) throw cafeCustomerError(plan.message);
    await tx.loyaltyAccount.update({
      where: { id: account.id },
      data: {
        pointsBalance: plan.pointsBalance,
        drinkCredits: plan.drinkCredits,
        lifetimePoints: plan.lifetimePoints,
        ...status ? { status } : {},
        ...tier ? { tier } : {}
      }
    });
    const changes = [status && status !== account.status ? `status ${String(account.status)} \u2192 ${status}` : "", tier && tier !== account.tier ? `tier ${String(account.tier)} \u2192 ${tier}` : ""].filter(Boolean).join(", ");
    await tx.loyaltyEvent.create({
      data: {
        accountId: account.id,
        type: "manual_adjustment",
        pointsDelta,
        drinkCreditsDelta: plan.creditsDelta,
        note: changes ? `${note} (${changes})` : note,
        createdById: actorId
      }
    });
    await recordCoffeeCommandReceipt(tx, {
      storeId,
      eventKey,
      eventType: "loyalty.adjusted",
      aggregateType: "loyalty_account",
      aggregateId: String(account.id),
      payload: { requestFingerprint, accountId: String(account.id), pointsDelta, drinkCreditsDelta: plan.creditsDelta, status: status || String(account.status), tier: tier || String(account.tier) }
    });
    return String(account.id);
  });
  return context.sudo().query.LoyaltyAccount.findOne({ where: { id }, query: "id status tier pointsBalance lifetimePoints drinkCredits visits" });
}
async function cancelCoffeePurchaseOrder(_root, args, context) {
  if (!permissions.canManageInventory({ session: context.session })) throw new Error("Not authorized to manage coffee inventory");
  const reason = String(args.reason || "").trim().slice(0, 500);
  return serializable(context, async (tx) => {
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-po:${args.purchaseOrderId}`);
    const actorId = await requireCurrentCoffeeCapability(tx, context.session, ["canManageInventory"], "Not authorized to manage coffee inventory");
    const storeId = await getPrimaryCoffeeStoreId(tx);
    const order = await tx.purchaseOrder.findUnique({ where: { id: args.purchaseOrderId } });
    if (!order) throw new Error("Purchase order not found");
    assertCoffeeStoreOwnership(order.storeId, storeId, "Purchase order");
    if (order.status === "cancelled") return order;
    if (!canTransition(PURCHASE_ORDER_TRANSITIONS, String(order.status), "cancelled")) throw cafeCustomerError(`A ${String(order.status)} purchase order can't be cancelled`);
    const notes = reason ? [String(order.notes || "").trim(), `Cancelled: ${reason}`].filter(Boolean).join("\n") : order.notes;
    const updated = await tx.purchaseOrder.update({ where: { id: order.id }, data: { status: "cancelled", notes } });
    await recordCoffeeCommandReceipt(tx, {
      storeId,
      eventKey: `purchase-order:${String(order.id)}:cancelled:v1`,
      eventType: "purchase_order.cancelled",
      aggregateType: "purchase_order",
      aggregateId: String(order.id),
      payload: { purchaseOrderId: String(order.id), poNumber: String(order.poNumber), previousStatus: String(order.status), cancelledBy: actorId, reason }
    });
    return updated;
  });
}
var import_node_crypto8, import_zod3, TX_OPTIONS6, CATERING_LEAD_HOURS, CATERING_HORIZON_DAYS, cateringInput, LOYALTY_STATUSES, LOYALTY_TIERS;
var init_coffeeCoverageCommands = __esm({
  "features/keystone/mutations/coffeeCoverageCommands.ts"() {
    "use strict";
    import_node_crypto8 = require("node:crypto");
    import_zod3 = require("zod");
    init_access();
    init_coffeeCommandReceipt();
    init_cafeCustomerError();
    init_transitionPolicy();
    init_coffeeKdsAuthority();
    init_idempotency();
    TX_OPTIONS6 = { maxWait: 5e3, timeout: 1e4, isolationLevel: "Serializable" };
    CATERING_LEAD_HOURS = 24;
    CATERING_HORIZON_DAYS = 365;
    cateringInput = import_zod3.z.object({
      customerName: import_zod3.z.string().trim().min(1, "Enter your name").max(200),
      customerEmail: import_zod3.z.string().trim().toLowerCase().email("Enter a valid email").max(320),
      customerPhone: import_zod3.z.string().trim().max(50).optional().nullable(),
      eventAt: import_zod3.z.string().trim().min(1, "Choose the event date and time"),
      guestCount: import_zod3.z.number().int("Guests must be a whole number").min(1, "Enter at least 1 guest").max(1e3, "For more than 1000 guests, contact the cafe"),
      deliveryAddress: import_zod3.z.string().trim().max(500).optional().nullable(),
      notes: import_zod3.z.string().trim().max(2e3).optional().nullable(),
      idempotencyKey: import_zod3.z.string()
    });
    LOYALTY_STATUSES = /* @__PURE__ */ new Set(["active", "paused", "closed"]);
    LOYALTY_TIERS = /* @__PURE__ */ new Set(["regular", "neighborhood", "house_account"]);
  }
});

// features/keystone/mutations/updateSubscriptionStatus.ts
async function updateSubscriptionStatus(_root, args, context) {
  if (!permissions.canManageLoyalty({ session: context.session })) throw new Error("Not authorized to update subscription status");
  const id = await context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx;
    await requireCurrentCoffeeCapability(tx, context.session, ["canManageLoyalty"], "Not authorized to update subscription status");
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-subscription:${args.subscriptionId}`);
    const existing = await tx.subscription.findUnique({ where: { id: args.subscriptionId } });
    if (!existing) throw new Error("Subscription not found");
    const storeId = await getPrimaryCoffeeStoreId(tx);
    assertCoffeeStoreOwnership(existing.storeId, storeId, "Subscription");
    const transition = evaluateTransition(SUBSCRIPTION_TRANSITIONS, String(existing.status), args.status);
    if (transition.replay) return String(existing.id);
    const now = /* @__PURE__ */ new Date();
    const sequence = await tx.coffeeCommandReceipt.count({ where: { storeId, aggregateType: "subscription", aggregateId: String(existing.id), eventType: "subscription.status_changed" } }) + 1;
    await tx.subscription.update({ where: { id: existing.id }, data: { status: args.status, ...args.status === "cancelled" ? { cancelledAt: now } : {} } });
    await recordCoffeeCommandReceipt(tx, {
      storeId,
      eventKey: `subscription:${String(existing.id)}:status:${sequence}:${String(existing.status)}:${args.status}:v2`,
      eventType: "subscription.status_changed",
      aggregateType: "subscription",
      aggregateId: String(existing.id),
      occurredAt: now,
      payload: { subscriptionId: String(existing.id), subscriptionNumber: String(existing.subscriptionNumber), sequence, previousStatus: String(existing.status), status: args.status }
    });
    return String(existing.id);
  }, TX_OPTIONS7);
  return context.sudo().query.Subscription.findOne({ where: { id }, query: query2 });
}
var TX_OPTIONS7, query2;
var init_updateSubscriptionStatus = __esm({
  "features/keystone/mutations/updateSubscriptionStatus.ts"() {
    "use strict";
    init_access();
    init_coffeeCommandReceipt();
    init_coffeeKdsAuthority();
    init_transitionPolicy();
    TX_OPTIONS7 = { maxWait: 5e3, timeout: 1e4, isolationLevel: "Serializable" };
    query2 = "id subscriptionNumber status cancelledAt store { id }";
  }
});

// features/keystone/mutations/updatePosOrderStatus.ts
async function updatePosOrderStatus(_root, args, context) {
  if (!permissions.canManageOrders({ session: context.session })) throw new Error("Not authorized to update POS order status");
  if (args.status === "paid" || args.status === "refunded") throw new Error("POS financial status is controlled by payment settlement and refunds");
  const id = await context.prisma.$transaction(async (rawTx) => {
    await requireCurrentCoffeeCapability(rawTx, context.session, ["canManageOrders"], "Not authorized to update POS order status");
    const tx = rawTx;
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-pos-order:${args.posOrderId}`);
    const existing = await tx.posOrder.findUnique({ where: { id: args.posOrderId } });
    if (!existing) throw new Error("POS order not found");
    const storeId = await getPrimaryCoffeeStoreId(tx);
    assertCoffeeStoreOwnership(existing.storeId, storeId, "POS order");
    const transition = evaluateTransition(POS_ORDER_TRANSITIONS, String(existing.status), args.status);
    if (transition.replay) return String(existing.id);
    const now = /* @__PURE__ */ new Date();
    await tx.posOrder.update({
      where: { id: existing.id },
      data: { status: args.status, ...["paid", "voided", "refunded"].includes(args.status) ? { closedAt: existing.closedAt || now } : {} }
    });
    await recordCoffeeCommandReceipt(tx, {
      storeId,
      eventKey: `pos-order:${String(existing.id)}:status:${args.status}:v1`,
      eventType: "pos_order.status_changed",
      aggregateType: "pos_order",
      aggregateId: String(existing.id),
      occurredAt: now,
      payload: { posOrderId: String(existing.id), receiptNumber: String(existing.receiptNumber), previousStatus: String(existing.status), status: args.status }
    });
    return String(existing.id);
  }, TX_OPTIONS8);
  return context.sudo().query.PosOrder.findOne({ where: { id }, query: query3 });
}
var TX_OPTIONS8, query3;
var init_updatePosOrderStatus = __esm({
  "features/keystone/mutations/updatePosOrderStatus.ts"() {
    "use strict";
    init_access();
    init_coffeeCommandReceipt();
    init_transitionPolicy();
    init_coffeeKdsAuthority();
    TX_OPTIONS8 = { maxWait: 5e3, timeout: 1e4, isolationLevel: "Serializable" };
    query3 = "id receiptNumber status closedAt store { id }";
  }
});

// features/keystone/mutations/giftCards.ts
var giftCards_exports = {};
__export(giftCards_exports, {
  GIFT_CARD_AMOUNTS: () => GIFT_CARD_AMOUNTS,
  confirmCafeGiftCardOrder: () => confirmCafeGiftCardOrder,
  creditCafeGiftCardInTransaction: () => creditCafeGiftCardInTransaction,
  getCafeGiftCardOptions: () => getCafeGiftCardOptions,
  getCafeGiftCards: () => getCafeGiftCards,
  giftCardTender: () => giftCardTender,
  lookupCafeGiftCard: () => lookupCafeGiftCard,
  normalizeGiftCode: () => normalizeGiftCode,
  redeemCafeGiftCardInTransaction: () => redeemCafeGiftCardInTransaction,
  refundCafeGiftCard: () => refundCafeGiftCard,
  settleCafeGiftCard: () => settleCafeGiftCard,
  settleCafeGiftCardFromWebhook: () => settleCafeGiftCardFromWebhook,
  startCafeGiftCardCheckout: () => startCafeGiftCardCheckout
});
function newCode() {
  return (0, import_node_crypto9.randomBytes)(6).toString("hex").toUpperCase().match(/.{4}/g).join("-");
}
function normalizeGiftCode(code) {
  const raw = String(code || "").toUpperCase().replace(/[^0-9A-F]/g, "");
  return raw.length === 12 ? raw.match(/.{4}/g).join("-") : "";
}
function orderToken(giftCardId) {
  const secret = process.env.SESSION_SECRET || "";
  if (secret.length < 32) throw new Error("SESSION_SECRET must be at least 32 characters long");
  return (0, import_node_crypto9.createHmac)("sha256", secret).update(`coffee-gift:${giftCardId}`).digest("hex");
}
function tokenOk(giftCardId, token) {
  if (!giftCardId || !token || token.length !== 64) return false;
  const a = Buffer.from(orderToken(giftCardId));
  const b = Buffer.from(token);
  return a.length === b.length && (0, import_node_crypto9.timingSafeEqual)(a, b);
}
function giftReturnBase(value) {
  if (typeof value !== "string" || value.length > 2e3) return null;
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.pathname !== "/gift-cards" || url.username || url.password) return null;
    url.search = "";
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}
async function getCafeGiftCardOptions(_root, _args, context) {
  const prisma = context.sudo().prisma;
  const store = await prisma.storeSetting.findUnique({ where: { singletonKey: "primary" }, select: { currencyCode: true } });
  return { online: await onlinePaymentReady(prisma), amounts: GIFT_CARD_AMOUNTS, currencyCode: String(store?.currencyCode || "USD") };
}
async function startCafeGiftCardCheckout(_root, args, context) {
  if (!GIFT_CARD_AMOUNTS.includes(args.amount)) throw cafeCustomerError("Choose one of the gift card amounts.");
  const purchaserName = String(args.purchaserName || "").trim();
  const purchaserEmail = String(args.purchaserEmail || "").trim().toLowerCase();
  const recipientEmail = String(args.recipientEmail || "").trim().toLowerCase() || purchaserEmail;
  const recipientName = String(args.recipientName || "").trim() || purchaserName;
  const message = String(args.message || "").trim();
  if (!purchaserName || purchaserName.length > 120 || recipientName.length > 120) throw cafeCustomerError("Enter your name.");
  if (!EMAIL.test(purchaserEmail) || !EMAIL.test(recipientEmail) || recipientEmail.length > 320) throw cafeCustomerError("Enter a valid email address.");
  if (message.length > 300) throw cafeCustomerError("Keep the message under 300 characters.");
  const key = String(args.idempotencyKey || "");
  if (!/^[A-Za-z0-9-]{16,100}$/.test(key)) throw new Error("Gift card idempotency key is required");
  const base = giftReturnBase(args.returnUrl);
  if (!base) throw new Error("Gift card return URL is invalid");
  const prisma = context.sudo().prisma;
  if (!await onlinePaymentReady(prisma)) throw cafeCustomerError("Online gift cards aren't available right now. Ask at the counter.");
  const store = await prisma.storeSetting.findUnique({ where: { singletonKey: "primary" }, select: { id: true, name: true, currencyCode: true } });
  if (!store) throw cafeCustomerError("Gift cards aren't available right now.");
  const expiresAt = /* @__PURE__ */ new Date();
  expiresAt.setFullYear(expiresAt.getFullYear() + 5);
  const card = await prisma.giftCard.create({ data: {
    storeId: store.id,
    code: newCode(),
    status: "pending",
    initialValue: args.amount,
    balance: 0,
    currencyCode: String(store.currencyCode || "USD"),
    purchaserName,
    purchaserEmail,
    recipientName,
    recipientEmail,
    message,
    expiresAt,
    ledger: []
  } });
  const back = new URL(base);
  back.searchParams.set("card", card.id);
  back.searchParams.set("token", orderToken(card.id));
  const cancel = new URL(back);
  cancel.searchParams.set("result", "cancelled");
  try {
    const stripe = await Promise.resolve().then(() => (init_stripe(), stripe_exports));
    const session = await stripe.createHostedCheckout({
      amount: args.amount,
      currencyCode: card.currencyCode,
      name: `${store.name || "Cafe"} gift card \xB7 ${usd(args.amount)}`,
      successUrl: back.toString(),
      cancelUrl: cancel.toString(),
      idempotencyKey: `gift-card:${key}`,
      customerEmail: purchaserEmail,
      metadata: { purpose: "gift_card", giftCardId: card.id }
    });
    if (!session.id || !session.url) throw new Error("Stripe did not open a checkout");
    await prisma.giftCard.update({ where: { id: card.id }, data: { providerPaymentId: session.id } });
    return { success: true, checkoutUrl: session.url };
  } catch (error) {
    console.error("Gift card checkout could not be opened:", error instanceof Error ? error.message : "unknown");
    await prisma.giftCard.update({ where: { id: card.id }, data: { status: "cancelled" } });
    throw cafeCustomerError("Online gift cards aren't available right now. Ask at the counter.");
  }
}
async function settleCafeGiftCard(prisma, giftCardId) {
  const card = await prisma.giftCard.findUnique({ where: { id: giftCardId } });
  if (!card) throw cafeCustomerError("Gift card order not found.");
  if (card.status === "pending" && String(card.providerPaymentId || "").startsWith("cs_")) {
    const stripe = await Promise.resolve().then(() => (init_stripe(), stripe_exports));
    const remote = await stripe.readHostedCheckout(card.providerPaymentId);
    if (remote.state === "expired") {
      await prisma.giftCard.updateMany({ where: { id: card.id, status: "pending" }, data: { status: "cancelled" } });
    } else if (remote.state === "paid") {
      if (remote.amount !== card.initialValue || remote.currency.toUpperCase() !== String(card.currencyCode).toUpperCase()) throw cafeCustomerError("The amount paid doesn't match the gift card. Contact the caf\xE9.");
      const now = /* @__PURE__ */ new Date();
      await prisma.$transaction(async (tx) => {
        const ledger = [{ at: now.toISOString(), type: "purchase", amount: card.initialValue, balance: card.initialValue, ref: remote.paymentIntent || card.providerPaymentId }];
        const claimed = await tx.giftCard.updateMany({ where: { id: card.id, status: "pending" }, data: { status: "active", balance: card.initialValue, activatedAt: now, ledger } });
        if (!claimed.count) return;
        await recordCoffeeCommandReceipt(tx, {
          storeId: card.storeId,
          eventKey: `gift-card:${card.id}:sold:v1`,
          eventType: "gift_card.sold",
          aggregateType: "gift_card",
          aggregateId: card.id,
          occurredAt: now,
          payload: { giftCardId: card.id, amount: card.initialValue, currencyCode: card.currencyCode, providerPaymentId: card.providerPaymentId }
        });
      });
    }
  }
  return prisma.giftCard.findUnique({ where: { id: card.id } });
}
async function confirmCafeGiftCardOrder(_root, args, context) {
  if (!tokenOk(args.giftCardId, args.token)) throw cafeCustomerError("We couldn't find that gift card order.");
  const card = await settleCafeGiftCard(context.sudo().prisma, args.giftCardId);
  const live = card.status === "active" || card.status === "redeemed";
  return {
    status: card.status,
    amount: card.initialValue,
    currencyCode: card.currencyCode,
    recipientName: card.recipientName,
    recipientEmail: card.recipientEmail,
    code: live ? card.code : null,
    expiresAt: card.expiresAt ? new Date(card.expiresAt).toISOString() : null
  };
}
async function settleCafeGiftCardFromWebhook(prisma, giftCardId) {
  try {
    await settleCafeGiftCard(prisma, giftCardId);
  } catch (error) {
    console.error("Gift card webhook settlement failed:", error instanceof Error ? error.message : "unknown");
  }
}
async function settleWaiting(prisma) {
  const waiting = await prisma.giftCard.findMany({ where: { status: "pending", providerPaymentId: { startsWith: "cs_" }, createdAt: { gte: new Date(Date.now() - 2 * 864e5) } }, select: { id: true }, take: 20 });
  for (const card of waiting) await settleCafeGiftCard(prisma, card.id).catch(() => void 0);
}
function cardView(card, canManage) {
  const ledger = ledgerOf(card.ledger);
  return {
    id: card.id,
    code: card.code,
    status: card.status,
    initialValue: card.initialValue,
    balance: card.balance,
    currencyCode: card.currencyCode,
    purchaserName: card.purchaserName || null,
    recipientName: card.recipientName || null,
    recipientEmail: canManage ? card.recipientEmail || null : null,
    activatedAt: card.activatedAt ? new Date(card.activatedAt).toISOString() : null,
    expiresAt: card.expiresAt ? new Date(card.expiresAt).toISOString() : null,
    // A purchase is refundable to the buyer's card only while none of it has been spent.
    canRefund: canManage && card.status === "active" && card.balance === card.initialValue && !ledger.some((row) => row.type === "redeem")
  };
}
async function getCafeGiftCards(_root, args, context) {
  if (!permissions.canReadPayments({ session: context.session })) throw new Error("Not authorized to read gift cards");
  await settleWaiting(context.sudo().prisma);
  const search = String(args.search || "").trim().slice(0, 120);
  const code = normalizeGiftCode(search);
  const where = {
    status: { in: ["active", "redeemed", "cancelled"] },
    ...search ? { OR: [...code ? [{ code }] : [], { recipientName: { contains: search, mode: "insensitive" } }, { purchaserName: { contains: search, mode: "insensitive" } }, { recipientEmail: { contains: search, mode: "insensitive" } }] } : {}
  };
  const [cards, outstanding] = await Promise.all([
    context.prisma.giftCard.findMany({ where, orderBy: [{ activatedAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }], take: 100 }),
    context.prisma.giftCard.aggregate({ where: { status: "active" }, _sum: { balance: true }, _count: { _all: true } })
  ]);
  const canManage = permissions.canManagePayments({ session: context.session });
  return { outstandingCents: Number(outstanding._sum.balance || 0), activeCount: outstanding._count._all, cards: cards.map((card) => cardView(card, canManage)) };
}
async function lookupCafeGiftCard(_root, args, context) {
  if (!permissions.canManagePayments({ session: context.session })) throw new Error("Not authorized to look up gift cards");
  const code = normalizeGiftCode(args.code);
  if (!code) throw cafeCustomerError("Enter the 12-character gift card code.");
  let card = await context.prisma.giftCard.findUnique({ where: { code } });
  if (card?.status === "pending") card = await settleCafeGiftCard(context.sudo().prisma, card.id);
  if (!card || card.status === "pending") throw cafeCustomerError("No gift card with that code.");
  return cardView(card, true);
}
async function redeemCafeGiftCardInTransaction(tx, input) {
  const code = normalizeGiftCode(input.code);
  if (!code) throw cafeCustomerError("Enter the 12-character gift card code.");
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "coffee-gift-card", code);
  const card = await tx.giftCard.findUnique({ where: { code } });
  if (!card || card.storeId !== input.storeId || card.status !== "active") throw cafeCustomerError("That gift card isn't active.");
  if (card.expiresAt && new Date(card.expiresAt) < input.now) throw cafeCustomerError("That gift card has expired.");
  if (card.balance < input.amount) throw cafeCustomerError(`That gift card has ${usd(card.balance)} left. Take this order by cash or card instead.`);
  const balance = card.balance - input.amount;
  const ledger = [...ledgerOf(card.ledger), { at: input.now.toISOString(), type: "redeem", amount: input.amount, balance, ref: input.ref }];
  await tx.giftCard.update({ where: { id: card.id }, data: { balance, status: balance === 0 ? "redeemed" : "active", ledger } });
  return { id: card.id, code: card.code, balance };
}
async function creditCafeGiftCardInTransaction(tx, input) {
  const code = normalizeGiftCode(input.code);
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "coffee-gift-card", code);
  const card = await tx.giftCard.findUnique({ where: { code } });
  if (!card) throw new Error("The gift card for this payment was not found");
  const balance = card.balance + input.amount;
  const ledger = [...ledgerOf(card.ledger), { at: input.now.toISOString(), type: "refund", amount: input.amount, balance, ref: input.ref }];
  await tx.giftCard.update({ where: { id: card.id }, data: { balance, status: card.status === "redeemed" ? "active" : card.status, ledger } });
}
async function refundCafeGiftCard(_root, args, context) {
  if (!permissions.canManagePayments({ session: context.session })) throw new Error("Not authorized to refund gift cards");
  const prisma = context.prisma;
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "coffee-gift-card-id", args.giftCardId);
    const actorId = await requireCurrentCoffeeCapability(tx, context.session, ["canManagePayments"], "Not authorized to refund gift cards");
    const card = await tx.giftCard.findUnique({ where: { id: args.giftCardId } });
    if (!card) throw new Error("Gift card not found");
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "coffee-gift-card", card.code);
    const storeId = await getPrimaryCoffeeStoreId(tx);
    if (card.storeId !== storeId) throw new Error("Gift card not found");
    if (card.status === "cancelled" && card.refundedAt) return { card, replay: true };
    if (!cardView(card, true).canRefund) throw cafeCustomerError("Only an unused gift card can be refunded to the buyer's card.");
    const stripe = await Promise.resolve().then(() => (init_stripe(), stripe_exports));
    const remote = await stripe.readHostedCheckout(String(card.providerPaymentId || ""));
    if (!remote.paymentIntent) throw cafeCustomerError("This purchase hasn't finished settling. Try again shortly.");
    const refund = await stripe.refundPaymentFunction({ providerPaymentId: remote.paymentIntent, amount: card.initialValue, reason: String(args.reason || "Gift card refund").slice(0, 200), idempotencyKey: `gift-card-refund:${card.id}`, currencyCode: card.currencyCode });
    if (!refund?.success || !["refunded", "pending"].includes(String(refund.status))) throw cafeCustomerError("The card refund didn't go through. Nothing was changed.");
    const now = /* @__PURE__ */ new Date();
    const ledger = [...ledgerOf(card.ledger), { at: now.toISOString(), type: "cancel", amount: card.balance, balance: 0, ref: String(refund.providerPaymentId || "refund") }];
    const updated = await tx.giftCard.update({ where: { id: card.id }, data: { status: "cancelled", balance: 0, refundedAt: now, ledger } });
    await recordCoffeeCommandReceipt(tx, {
      storeId,
      eventKey: `gift-card:${card.id}:refunded:v1`,
      eventType: "gift_card.refunded",
      aggregateType: "gift_card",
      aggregateId: card.id,
      occurredAt: now,
      payload: { giftCardId: card.id, amount: card.initialValue, refundedBy: actorId, providerRefundId: String(refund.providerPaymentId || "") || null }
    });
    return { card: updated, replay: false };
  }, { maxWait: 5e3, timeout: 2e4, isolationLevel: "ReadCommitted" });
  return cardView(result.card, true);
}
var import_node_crypto9, GIFT_CARD_AMOUNTS, EMAIL, usd, ledgerOf, giftCardTender;
var init_giftCards = __esm({
  "features/keystone/mutations/giftCards.ts"() {
    "use strict";
    import_node_crypto9 = require("node:crypto");
    init_access();
    init_cafeCustomerError();
    init_coffeeCommandReceipt();
    init_onlinePayment();
    init_coffeeKdsAuthority();
    GIFT_CARD_AMOUNTS = [1500, 2500, 5e3, 7500, 1e4];
    EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    usd = (cents2) => `$${(cents2 / 100).toFixed(cents2 % 100 ? 2 : 0)}`;
    ledgerOf = (value) => Array.isArray(value) ? value : [];
    giftCardTender = {
      providerPaymentId: (code) => `gift_card:${normalizeGiftCode(code)}:${(0, import_node_crypto9.randomUUID)()}`,
      codeOf: (providerPaymentId) => String(providerPaymentId || "").split(":")[1] || ""
    };
  }
});

// features/keystone/mutations/loyaltyReversal.ts
function reverseLoyaltyEarning(current, earnedPoints) {
  const points = Number(earnedPoints);
  const lifetimePoints = Number(current.lifetimePoints || 0);
  const visits = Number(current.visits || 0);
  if (!Number.isSafeInteger(points) || points < 0 || lifetimePoints < points || visits < 1) {
    return { ok: false, error: "Loyalty history requires reconciliation before refund" };
  }
  const drinkCredits = Number(current.drinkCredits || 0);
  const remaining = Number(current.pointsBalance || 0) + drinkCredits * 100 - points;
  if (remaining < 0) return { ok: false, error: "Spent loyalty rewards require a manual refund reconciliation" };
  const credits = Math.floor(remaining / 100);
  return {
    ok: true,
    next: { pointsBalance: remaining % 100, drinkCredits: credits, lifetimePoints: lifetimePoints - points, visits: visits - 1 },
    drinkCreditsDelta: credits - drinkCredits
  };
}
var init_loyaltyReversal = __esm({
  "features/keystone/mutations/loyaltyReversal.ts"() {
    "use strict";
  }
});

// features/keystone/mutations/refundCafePayment.ts
async function refundCafePayment(_root, args, context) {
  requireCafeTenderOperator(context.session);
  const clientKey = normalizeIdempotencyKey(args.idempotencyKey);
  if (!clientKey) throw new Error("Refund idempotency key is required");
  const locator = await context.sudo().query.Payment.findOne({ where: { id: args.paymentId }, query: "id order { id }" });
  if (!locator?.order?.id) throw new Error("Payment order not found");
  const key = buildScopedIdempotencyKey(`refund:${args.paymentId}:${context.session?.itemId || "operator"}`, clientKey);
  const reason = args.reason?.trim() || "operator_refund";
  const externalReference = args.externalRefundReference?.trim() || "";
  if (reason.length > 500 || externalReference.length > 200) throw new Error("Refund reason or terminal reference is too long");
  await context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx;
    await lockCoffeeOrder(tx, locator.order.id);
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-payment:${args.paymentId}`);
    await requireCurrentCoffeeCapability(rawTx, context.session, ["canManageOrders"], "Not authorized to record cafe payments");
    const actorId = await requireCurrentCoffeeCapability(rawTx, context.session, ["canManagePayments"], "Not authorized to record cafe payments");
    const payment = await tx.payment.findUnique({ where: { id: args.paymentId } });
    if (!payment) throw new Error("Payment not found");
    const storeId = await getPrimaryCoffeeStoreId(tx);
    assertCoffeeStoreOwnership(payment.storeId, storeId, "Payment");
    const amount = args.amount == null ? Number(payment.amount) : Number(args.amount);
    if (!Number.isSafeInteger(amount) || amount <= 0 || amount !== Number(payment.amount)) throw new Error("Only full refunds of the captured amount are currently supported");
    const requestFingerprint = fingerprintInput({ paymentId: args.paymentId, actorId, amount, currencyCode: String(payment.currencyCode || ""), reason, externalRefundReference: externalReference || null });
    if (payment.status === "refunded") {
      if (payment.refundIdempotencyKey !== key) throw new Error("Payment was already refunded by another request");
      const receipt = await tx.coffeeCommandReceipt.findUnique({ where: { eventKey: `payment:${args.paymentId}:refunded:v1` } });
      const payload = receipt?.payload && typeof receipt.payload === "object" ? receipt.payload : null;
      const matches = payload && typeof payload.requestFingerprint === "string" ? payload.requestFingerprint === requestFingerprint : Boolean(payload) && payload.reason === reason && (payload.externalRefundReference ?? null) === (externalReference || null) && Number(payload.amount) === amount;
      if (!matches) throw new Error("This refund was already recorded with a different reason or terminal reference");
      return;
    }
    if (payment.status !== "captured") throw new Error(`Cannot refund payment with status ${String(payment.status)}`);
    evaluateTransition(PAYMENT_TRANSITIONS, "captured", "refunded");
    const isOnline = payment.provider === "pp_stripe_stripe";
    if (!isOnline && payment.provider !== "pp_system_default") throw new Error("Refunds for this payment provider aren't supported");
    if (!["cash", "card", "gift_card"].includes(String(payment.method))) throw new Error("Unsupported refund tender");
    const isGiftCard = payment.method === "gift_card";
    let refundTarget = String(payment.providerPaymentId || "");
    if (isOnline && refundTarget.startsWith("cs_")) {
      const page = await executePaymentProviderAdapter({ provider: { code: "pp_stripe_stripe" }, functionName: "getPaymentStatusFunction", args: { providerPaymentId: refundTarget } }).catch(() => null);
      const intent = page?.data?.payment_intent;
      refundTarget = typeof intent === "string" ? intent : "";
    }
    if (isOnline && !refundTarget.startsWith("pi_")) throw cafeCustomerError("This online payment hasn't finished settling. Try the refund again shortly.");
    if (!isOnline && payment.method === "card" && externalReference.length < 4) throw new Error("Record the external terminal refund reference before updating the cafe ledger");
    if (payment.refundIdempotencyKey && payment.refundIdempotencyKey !== key) throw new Error("A different refund request already owns this payment");
    const order = await tx.cafeOrder.findUnique({
      where: { id: payment.orderId },
      select: { id: true, storeId: true, status: true, total: true, discount: true, loyaltyAccountId: true, payments: { select: { id: true, status: true, amount: true, refundIdempotencyKey: true } } }
    });
    if (!order) throw new Error("Payment order not found");
    assertCoffeeStoreOwnership(order.storeId, storeId, "Payment order");
    evaluateTransition(CAFE_ORDER_TRANSITIONS, String(order.status), "refunded");
    const orderPayments = Array.isArray(order.payments) ? order.payments : [];
    assertCafeSettlement(orderPayments, Number(order.total || 0) - Number(order.discount || 0));
    if (!orderPayments.some((candidate) => candidate.id === payment.id && candidate.status === "captured")) throw new Error("Refund payment does not match the order's full settlement");
    let shiftId = null;
    let shift = null;
    if (!isOnline && !isGiftCard) {
      const shifts = await tx.registerShift.findMany({ where: { storeId, status: "open" }, take: 2, orderBy: { openedAt: "asc" }, select: { id: true } });
      if (shifts.length !== 1) throw new Error("Refunds require exactly one open payout register shift");
      shiftId = String(shifts[0].id);
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-register-shift:${shiftId}`);
      shift = await tx.registerShift.findUnique({ where: { id: shiftId } });
      if (!shift || shift.status !== "open") throw new Error("The payout register closed before the refund was recorded");
      assertCoffeeStoreOwnership(shift.storeId, storeId, "Payout register");
      const drawerCashCents = Number(shift.openingCashCents || 0) + Number(shift.cashSalesCents || 0) - Number(shift.cashRefundsCents || 0) + Number(shift.payInsCents || 0) - Number(shift.payOutsCents || 0);
      if (payment.method === "cash" && amount > drawerCashCents) {
        throw new Error(`Cash refund exceeds the ${(Math.max(0, drawerCashCents) / 100).toFixed(2)} expected in the payout drawer`);
      }
    }
    if (order.loyaltyAccountId) {
      const account = await tx.loyaltyAccount.findUnique({ where: { id: order.loyaltyAccountId } });
      if (!account) throw new Error("Loyalty account requires reconciliation before refund");
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `loyalty-account:${String(account.customerEmail)}`);
      const current = await tx.loyaltyAccount.findUnique({ where: { id: account.id } });
      if (!current) throw new Error("Loyalty account not found");
      assertCoffeeStoreOwnership(current.storeId, storeId, "Loyalty account");
      const earned = await tx.loyaltyEvent.findMany({ where: { orderId: order.id, accountId: current.id, type: "earned" }, take: 2 });
      if (earned.length !== 1) throw new Error("Loyalty earning evidence requires reconciliation before refund");
      const points = Number(earned[0].pointsDelta || 0);
      const reversal = reverseLoyaltyEarning({
        pointsBalance: Number(current.pointsBalance || 0),
        drinkCredits: Number(current.drinkCredits || 0),
        lifetimePoints: Number(current.lifetimePoints || 0),
        visits: Number(current.visits || 0)
      }, points);
      if (!reversal.ok) throw new Error(reversal.error);
      await tx.loyaltyAccount.update({ where: { id: current.id }, data: reversal.next });
      await tx.loyaltyEvent.create({ data: { accountId: current.id, orderId: order.id, type: "refund_reversal", pointsDelta: -points, drinkCreditsDelta: reversal.drinkCreditsDelta, note: `Reversed ${points} points earned on this order after full refund of payment ${args.paymentId}`, createdById: actorId } });
    }
    const now = /* @__PURE__ */ new Date();
    let providerRefundId = null;
    if (isOnline) {
      const result = await executePaymentProviderAdapter({
        provider: { code: "pp_stripe_stripe" },
        functionName: "refundPaymentFunction",
        args: { providerPaymentId: refundTarget, amount, reason, idempotencyKey: `refund:${key}`, currencyCode: String(payment.currencyCode || "USD") }
      }).catch(() => null);
      if (!result?.success || !["refunded", "pending"].includes(String(result.status))) throw cafeCustomerError("The card refund didn't go through. Nothing was recorded; try again.");
      providerRefundId = result.providerPaymentId ? String(result.providerPaymentId) : null;
    } else if (isGiftCard) {
      await creditCafeGiftCardInTransaction(tx, { code: giftCardTender.codeOf(String(payment.providerPaymentId)), amount, ref: `refund:${String(payment.id)}`, now });
    } else if (shift && shiftId) {
      const isCash = payment.method === "cash";
      const cashRefundsCents = Number(shift.cashRefundsCents || 0) + (isCash ? amount : 0);
      const cardRefundsCents = Number(shift.cardRefundsCents || 0) + (isCash ? 0 : amount);
      await tx.registerShift.update({ where: { id: shiftId }, data: { cashRefundsCents, cardRefundsCents, expectedCashCents: Math.max(0, Number(shift.openingCashCents || 0) + Number(shift.cashSalesCents || 0) - cashRefundsCents + Number(shift.payInsCents || 0) - Number(shift.payOutsCents || 0)) } });
    }
    const refundNote = isGiftCard ? `${reason}; returned to gift card` : isOnline ? `${reason}; card refund ${providerRefundId || "issued"}` : externalReference ? `${reason}; external terminal refund ${externalReference}` : reason;
    await tx.payment.update({ where: { id: payment.id }, data: { status: "refunded", refundIdempotencyKey: key, refundedAmount: amount, refundReason: refundNote, refundedAt: now, refundRegisterShiftId: shiftId, failureMessage: "" } });
    await tx.cafeOrder.update({ where: { id: order.id }, data: { status: "refunded" } });
    await tx.posOrder.updateMany({ where: { cafeOrderId: order.id, status: "paid" }, data: { status: "refunded" } });
    await tx.paymentEvent.create({ data: { replayKey: `refund:${args.paymentId}`, storeId, providerCode: String(payment.provider || "manual"), providerEventId: providerRefundId || `refund:${args.paymentId}`, eventType: "payment.refunded", payloadHash: (0, import_node_crypto10.createHash)("sha256").update(requestFingerprint).digest("hex"), status: "processed", paymentId: payment.id, orderId: order.id, processedAt: now }, select: { id: true } });
    await recordCoffeeCommandReceipt(tx, { storeId, eventKey: `payment:${args.paymentId}:refunded:v1`, eventType: "payment.refunded", aggregateType: "payment", aggregateId: args.paymentId, occurredAt: now, payload: { paymentId: args.paymentId, orderId: String(order.id), originalRegisterShiftId: String(payment.registerShiftId || "") || null, refundRegisterShiftId: shiftId, refundedBy: actorId, requestFingerprint, method: String(payment.method), amount, currencyCode: String(payment.currencyCode), reason, externalRefundReference: externalReference || null } });
  }, { maxWait: 5e3, timeout: 2e4, isolationLevel: "ReadCommitted" });
  return context.sudo().query.Payment.findOne({ where: { id: args.paymentId }, query: query4 });
}
var import_node_crypto10, query4;
var init_refundCafePayment = __esm({
  "features/keystone/mutations/refundCafePayment.ts"() {
    "use strict";
    import_node_crypto10 = require("node:crypto");
    init_coffeeCommandReceipt();
    init_idempotency();
    init_coffeeKdsAuthority();
    init_coffeeOrderPolicy();
    init_paymentProviderAdapter();
    init_giftCards();
    init_cafeCustomerError();
    init_loyaltyReversal();
    init_transitionPolicy();
    query4 = "id status method amount currencyCode providerPaymentId refundIdempotencyKey refundedAmount refundReason refundedAt order { id status } registerShift { id status } refundRegisterShift { id shiftNumber }";
  }
});

// features/keystone/lib/menu-temperature.ts
function defaultTemperatureOptions(barStation) {
  if (barStation === "cold_bar") return ["iced"];
  if (barStation === "pastry_case" || barStation === "retail_shelf") return [];
  return ["hot"];
}
var MENU_TEMPERATURES;
var init_menu_temperature = __esm({
  "features/keystone/lib/menu-temperature.ts"() {
    "use strict";
    MENU_TEMPERATURES = ["hot", "iced", "blended"];
  }
});

// features/keystone/mutations/manageCoffeeMenu.ts
function requireMenuManager(context) {
  if (!permissions.canManageProducts({ session: context.session }) || !context.session?.itemId) throw new Error("Not authorized to manage the coffee menu");
}
function scopedKey(context, purpose, value) {
  const normalized = normalizeIdempotencyKey(value);
  if (!normalized) throw new Error(`${purpose} idempotency key is required`);
  return buildScopedIdempotencyKey(`${purpose}:${context.session?.itemId}`, normalized);
}
async function lockCoffeeMenuItem(tx, menuItemId) {
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "coffee-menu-item", menuItemId);
}
async function beginMenuCommand(tx, context, key) {
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-menu-command:${key}`);
  const actorId = await requireCurrentCoffeeCapability(tx, context.session, ["canManageProducts"], "Not authorized to manage the coffee menu");
  const storeId = await getPrimaryCoffeeStoreId(tx);
  return { actorId, storeId };
}
async function findMenuReceipt(tx, key, expected) {
  const receipt = await tx.coffeeCommandReceipt.findUnique({ where: { eventKey: `menu-command:${key}` } });
  if (!receipt) return null;
  const payload = receipt.payload && typeof receipt.payload === "object" ? receipt.payload : {};
  if (receipt.storeId !== expected.storeId || receipt.eventType !== expected.eventType || receipt.aggregateType !== expected.aggregateType || payload.actorId !== expected.actorId || payload.requestFingerprint !== expected.requestFingerprint) throw new Error(REUSED_KEY_MESSAGE);
  return String(receipt.aggregateId);
}
function revision(value) {
  const date = value instanceof Date ? value : new Date(String(value || ""));
  return Number.isFinite(date.getTime()) ? date.toISOString() : "";
}
function assertExpectedRevision(row, expectedUpdatedAt) {
  if (expectedUpdatedAt == null) return;
  if (revision(row.updatedAt) !== revision(expectedUpdatedAt)) throw new Error(STALE_MESSAGE);
}
function price(value) {
  const cents2 = Number(value);
  if (!Number.isSafeInteger(cents2) || cents2 < 0 || cents2 > 1e7) throw new Error("Menu price must be a non-negative integer amount in cents");
  return cents2;
}
function itemName(value) {
  const name2 = value.trim();
  if (!name2 || name2.length > 200) throw new Error("Menu item name is required");
  return name2;
}
function shortDescription(value) {
  const text35 = value.trim();
  if (text35.length > 1e3) throw new Error("Short description must be 1000 characters or fewer");
  return text35;
}
function prepTime(value) {
  const minutes = Number(value);
  if (!Number.isSafeInteger(minutes) || minutes < 0 || minutes > 240) throw new Error("Prep time must be a whole number of minutes between 0 and 240");
  return minutes;
}
function station(value) {
  if (!STATIONS.has(value)) throw new Error("Menu item station is invalid");
  return value;
}
async function scopedCategory(tx, storeId, categoryId) {
  const category = await tx.menuCategory.findUnique({ where: { id: categoryId } });
  if (!category) throw new Error("Menu category was not found");
  assertCoffeeStoreOwnership(category.storeId, storeId, "Menu category");
  return String(category.id);
}
async function createCoffeeMenuCategory(_root, args, context) {
  requireMenuManager(context);
  const name2 = args.name.trim();
  if (!name2 || name2.length > 120) throw new Error("Category name is required");
  const description = (args.description || "").trim();
  if (description.length > 1e3) throw new Error("Category description must be 1000 characters or fewer");
  const sortOrder = Number(args.sortOrder ?? 0);
  if (!Number.isSafeInteger(sortOrder) || Math.abs(sortOrder) > 1e5) throw new Error("Category sort order must be a whole number");
  const key = scopedKey(context, "menu-category-create", args.idempotencyKey);
  const requestFingerprint = fingerprintInput({ name: name2, description, sortOrder });
  return context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx;
    const { actorId, storeId } = await beginMenuCommand(tx, context, key);
    const replayId = await findMenuReceipt(tx, key, { storeId, actorId, eventType: "menu_category.created", aggregateType: "menu_category", requestFingerprint });
    if (replayId) {
      const replay = await tx.menuCategory.findUnique({ where: { id: replayId } });
      if (!replay) throw new Error("Menu category was not found");
      assertCoffeeStoreOwnership(replay.storeId, storeId, "Menu category");
      return replay;
    }
    const category = await tx.menuCategory.create({ data: { storeId, name: name2, description, sortOrder, active: true } });
    await recordCoffeeCommandReceipt(tx, {
      storeId,
      eventKey: `menu-command:${key}`,
      eventType: "menu_category.created",
      aggregateType: "menu_category",
      aggregateId: String(category.id),
      payload: { actorId, requestFingerprint, menuCategoryId: String(category.id), name: name2, description, sortOrder }
    });
    return category;
  }, TX_OPTIONS9);
}
async function createCoffeeMenuItem(_root, args, context) {
  requireMenuManager(context);
  const intent = {
    name: itemName(args.name),
    price: price(args.price),
    categoryId: args.categoryId || null,
    station: station(args.barStation || "espresso_bar"),
    shortDescription: shortDescription(args.shortDescription || ""),
    prepTimeMinutes: prepTime(args.prepTimeMinutes ?? 5)
  };
  const key = scopedKey(context, "menu-item-create", args.idempotencyKey);
  const requestFingerprint = fingerprintInput(intent);
  return context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx;
    const { actorId, storeId } = await beginMenuCommand(tx, context, key);
    const replayId = await findMenuReceipt(tx, key, { storeId, actorId, eventType: "menu_item.created", aggregateType: "menu_item", requestFingerprint });
    if (replayId) {
      const replay = await tx.menuItem.findUnique({ where: { id: replayId } });
      if (!replay) throw new Error("Menu item was not found");
      assertCoffeeStoreOwnership(replay.storeId, storeId, "Menu item");
      return replay;
    }
    if (await tx.menuItem.findUnique({ where: { idempotencyKey: key } })) throw new Error(REUSED_KEY_MESSAGE);
    if (intent.categoryId) await scopedCategory(tx, storeId, intent.categoryId);
    const item = await tx.menuItem.create({
      data: {
        idempotencyKey: key,
        storeId,
        name: intent.name,
        price: intent.price,
        shortDescription: intent.shortDescription,
        available: true,
        prepTimeMinutes: intent.prepTimeMinutes,
        barStation: intent.station,
        temperatureOptions: defaultTemperatureOptions(intent.station),
        serviceWindows: ["all_day"],
        categoryId: intent.categoryId
      }
    });
    await recordCoffeeCommandReceipt(tx, {
      storeId,
      eventKey: `menu-command:${key}`,
      eventType: "menu_item.created",
      aggregateType: "menu_item",
      aggregateId: String(item.id),
      payload: { actorId, requestFingerprint, menuItemId: String(item.id), ...intent }
    });
    return item;
  }, TX_OPTIONS9);
}
async function updateCoffeeMenuItem(_root, args, context) {
  requireMenuManager(context);
  const key = scopedKey(context, "menu-item-update", args.idempotencyKey);
  const changes = {};
  if (args.name != null) changes.name = itemName(args.name);
  if (args.shortDescription != null) changes.shortDescription = shortDescription(args.shortDescription);
  if (args.clearCategory) changes.categoryId = null;
  else if (args.categoryId) changes.categoryId = args.categoryId;
  if (args.barStation != null) changes.barStation = station(args.barStation);
  if (args.prepTimeMinutes != null) changes.prepTimeMinutes = prepTime(args.prepTimeMinutes);
  if (args.price != null) changes.price = price(args.price);
  if (args.available != null) changes.available = args.available;
  if (args.featured != null) changes.featured = args.featured;
  if (args.popular != null) changes.popular = args.popular;
  if (!Object.keys(changes).length) throw new Error("No menu item changes were provided");
  const expectedUpdatedAt = args.expectedUpdatedAt ? revision(args.expectedUpdatedAt) : null;
  if (args.expectedUpdatedAt && !expectedUpdatedAt) throw new Error(STALE_MESSAGE);
  const requestFingerprint = fingerprintInput({ menuItemId: args.menuItemId, changes, expectedUpdatedAt });
  return context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx;
    const { actorId, storeId } = await beginMenuCommand(tx, context, key);
    await lockCoffeeMenuItem(tx, args.menuItemId);
    const item = await tx.menuItem.findUnique({ where: { id: args.menuItemId } });
    if (!item) throw new Error("Menu item was not found");
    assertCoffeeStoreOwnership(item.storeId, storeId, "Menu item");
    if (await findMenuReceipt(tx, key, { storeId, actorId, eventType: "menu_item.updated", aggregateType: "menu_item", requestFingerprint })) return item;
    assertExpectedRevision(item, expectedUpdatedAt);
    if (typeof changes.categoryId === "string") await scopedCategory(tx, storeId, changes.categoryId);
    const updated = await tx.menuItem.update({ where: { id: args.menuItemId }, data: changes });
    await recordCoffeeCommandReceipt(tx, {
      storeId,
      eventKey: `menu-command:${key}`,
      eventType: "menu_item.updated",
      aggregateType: "menu_item",
      aggregateId: args.menuItemId,
      payload: { actorId, requestFingerprint, menuItemId: args.menuItemId, changes, previousRevision: revision(item.updatedAt) }
    });
    return updated;
  }, TX_OPTIONS9);
}
function normalizedInventory(args) {
  const inventoryAction = args.inventoryAction || "unreviewed";
  if (!["unreviewed", "none", "add", "substitute"].includes(inventoryAction)) throw new Error("Unsupported modifier inventory action");
  if (["none", "unreviewed"].includes(inventoryAction)) return { inventoryAction, inventoryItemId: null, replacesInventoryItemId: null, inventoryQuantity: 0 };
  if (!args.inventoryItemId) throw new Error("Select the inventory consumed by this modifier");
  const quantity = Number(args.inventoryQuantity || 0);
  if (inventoryAction === "add" && (!Number.isFinite(quantity) || quantity <= 0 || quantity > 1e6 || Math.abs(quantity * 1e4 - Math.round(quantity * 1e4)) > 1e-7)) throw new Error("Add-on quantity must be positive with at most four decimal places");
  if (inventoryAction === "substitute" && !args.replacesInventoryItemId) throw new Error("Select the base ingredient this modifier replaces");
  return {
    inventoryAction,
    inventoryItemId: args.inventoryItemId,
    replacesInventoryItemId: inventoryAction === "substitute" ? args.replacesInventoryItemId || null : null,
    inventoryQuantity: inventoryAction === "add" ? quantity : 0
  };
}
async function validateInventory(tx, storeId, inventory) {
  if (!inventory.inventoryItemId) return;
  const target = await tx.inventoryItem.findUnique({ where: { id: inventory.inventoryItemId } });
  if (!target) throw new Error("Select the inventory consumed by this modifier");
  assertCoffeeStoreOwnership(target.storeId, storeId, "Modifier inventory");
  if (inventory.inventoryAction === "substitute") {
    const source = inventory.replacesInventoryItemId ? await tx.inventoryItem.findUnique({ where: { id: inventory.replacesInventoryItemId } }) : null;
    if (!source || source.id === target.id || source.unit !== target.unit) throw new Error("Substitution needs a different base ingredient in the same unit");
    assertCoffeeStoreOwnership(source.storeId, storeId, "Modifier base inventory");
  }
}
function storedInventory(modifier) {
  return {
    inventoryAction: String(modifier.inventoryAction || "unreviewed"),
    inventoryItemId: modifier.inventoryItemId ? String(modifier.inventoryItemId) : null,
    replacesInventoryItemId: modifier.replacesInventoryItemId ? String(modifier.replacesInventoryItemId) : null,
    inventoryQuantity: Number(modifier.inventoryQuantity || 0)
  };
}
function modifierPrice(value) {
  const cents2 = Number(value);
  if (!Number.isSafeInteger(cents2) || cents2 < -1e7 || cents2 > 1e7) throw new Error("Modifier adjustment must be an integer amount in cents");
  return cents2;
}
function modifierRule(args) {
  const name2 = args.name.trim();
  const modifierGroup = args.modifierGroup.trim();
  if (!name2 || name2.length > 200 || !MODIFIER_GROUPS.has(modifierGroup)) throw new Error("Modifier name and a supported cafe modifier group are required");
  const minSelections = Math.max(args.required ? 1 : 0, Number(args.minSelections || 0));
  const maxSelections = Number(args.maxSelections ?? 1);
  if (!Number.isSafeInteger(minSelections) || !Number.isSafeInteger(maxSelections) || minSelections < 0 || maxSelections < 1 || maxSelections > 20 || minSelections > maxSelections) throw new Error("Modifier selection bounds are invalid");
  return { name: name2, modifierGroup, modifierGroupLabel: args.modifierGroupLabel?.trim() || modifierGroup.replaceAll("_", " "), priceAdjustment: modifierPrice(args.priceAdjustment), required: Boolean(args.required), minSelections, maxSelections, defaultSelected: Boolean(args.defaultSelected) };
}
async function createCoffeeMenuModifier(_root, args, context) {
  requireMenuManager(context);
  const key = scopedKey(context, "menu-modifier-create", args.idempotencyKey);
  const rule = modifierRule(args);
  const inventory = normalizedInventory(args);
  const inStock = args.inStock !== false && inventory.inventoryAction !== "unreviewed";
  const requestFingerprint = fingerprintInput({ menuItemId: args.menuItemId, rule, inventory, inStock });
  return context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx;
    const { actorId, storeId } = await beginMenuCommand(tx, context, key);
    await lockCoffeeMenuItem(tx, args.menuItemId);
    const item = await tx.menuItem.findUnique({ where: { id: args.menuItemId } });
    if (!item) throw new Error("Menu item was not found");
    assertCoffeeStoreOwnership(item.storeId, storeId, "Menu item");
    const replayId = await findMenuReceipt(tx, key, { storeId, actorId, eventType: "menu_modifier.created", aggregateType: "menu_modifier", requestFingerprint });
    if (replayId) {
      const replay = await tx.menuItemModifier.findUnique({ where: { id: replayId } });
      if (!replay || replay.menuItemId !== args.menuItemId) throw new Error(REUSED_KEY_MESSAGE);
      return replay;
    }
    if (await tx.menuItemModifier.findUnique({ where: { idempotencyKey: key } })) throw new Error(REUSED_KEY_MESSAGE);
    await validateInventory(tx, storeId, inventory);
    const modifier = await tx.menuItemModifier.create({ data: { ...rule, ...inventory, inStock, storeId, menuItemId: args.menuItemId, idempotencyKey: key } });
    await recordCoffeeCommandReceipt(tx, {
      storeId,
      eventKey: `menu-command:${key}`,
      eventType: "menu_modifier.created",
      aggregateType: "menu_modifier",
      aggregateId: String(modifier.id),
      payload: { actorId, requestFingerprint, modifierId: String(modifier.id), menuItemId: args.menuItemId, ...rule, ...inventory, inStock }
    });
    return modifier;
  }, TX_OPTIONS9);
}
async function updateCoffeeMenuModifier(_root, args, context) {
  requireMenuManager(context);
  const key = scopedKey(context, "menu-modifier-update", args.idempotencyKey);
  const requested = modifierRule(args);
  const requestedInventory = args.inventoryAction != null ? normalizedInventory(args) : null;
  const expectedUpdatedAt = args.expectedUpdatedAt ? revision(args.expectedUpdatedAt) : null;
  if (args.expectedUpdatedAt && !expectedUpdatedAt) throw new Error(STALE_MESSAGE);
  const ruleFieldsProvided = { required: args.required != null, minSelections: args.minSelections != null, maxSelections: args.maxSelections != null, defaultSelected: args.defaultSelected != null };
  const requestFingerprint = fingerprintInput({ modifierId: args.modifierId, rule: requested, ruleFieldsProvided, inventory: requestedInventory, expectedUpdatedAt });
  return context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx;
    const { actorId, storeId } = await beginMenuCommand(tx, context, key);
    const located = await tx.menuItemModifier.findUnique({ where: { id: args.modifierId } });
    if (!located?.menuItemId) throw new Error("Menu modifier was not found");
    const menuItemId = String(located.menuItemId);
    await lockCoffeeMenuItem(tx, menuItemId);
    const modifier = await tx.menuItemModifier.findUnique({ where: { id: args.modifierId }, include: { menuItem: true } });
    if (!modifier || !modifier.menuItem || modifier.menuItemId !== menuItemId) throw new Error("Menu modifier was not found");
    assertCoffeeStoreOwnership(modifier.menuItem.storeId, storeId, "Menu modifier item");
    assertCoffeeStoreOwnership(modifier.storeId, storeId, "Menu modifier");
    if (await findMenuReceipt(tx, key, { storeId, actorId, eventType: "menu_modifier.updated", aggregateType: "menu_modifier", requestFingerprint })) return modifier;
    assertExpectedRevision(modifier, expectedUpdatedAt);
    const rule = modifierRule({
      ...args,
      required: ruleFieldsProvided.required ? args.required : Boolean(modifier.required),
      minSelections: ruleFieldsProvided.minSelections ? args.minSelections : Number(modifier.minSelections || 0),
      maxSelections: ruleFieldsProvided.maxSelections ? args.maxSelections : Number(modifier.maxSelections ?? 1),
      defaultSelected: ruleFieldsProvided.defaultSelected ? args.defaultSelected : Boolean(modifier.defaultSelected)
    });
    const inventory = requestedInventory || storedInventory(modifier);
    if (requestedInventory) await validateInventory(tx, storeId, requestedInventory);
    const data = { ...rule, ...requestedInventory || {} };
    if (inventory.inventoryAction === "unreviewed" && modifier.inStock) data.inStock = false;
    const updated = await tx.menuItemModifier.update({ where: { id: args.modifierId }, data });
    await recordCoffeeCommandReceipt(tx, {
      storeId,
      eventKey: `menu-command:${key}`,
      eventType: "menu_modifier.updated",
      aggregateType: "menu_modifier",
      aggregateId: args.modifierId,
      payload: { actorId, requestFingerprint, modifierId: args.modifierId, menuItemId, ...rule, ...inventory, previousRevision: revision(modifier.updatedAt) }
    });
    return updated;
  }, TX_OPTIONS9);
}
async function updateCoffeeModifierStock(_root, args, context) {
  requireMenuManager(context);
  const key = scopedKey(context, "menu-modifier-stock", args.idempotencyKey);
  const expectedUpdatedAt = args.expectedUpdatedAt ? revision(args.expectedUpdatedAt) : null;
  if (args.expectedUpdatedAt && !expectedUpdatedAt) throw new Error(STALE_MESSAGE);
  const requestFingerprint = fingerprintInput({ modifierId: args.modifierId, inStock: args.inStock, expectedUpdatedAt });
  return context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx;
    const { actorId, storeId } = await beginMenuCommand(tx, context, key);
    const located = await tx.menuItemModifier.findUnique({ where: { id: args.modifierId } });
    if (!located?.menuItemId) throw new Error("Menu modifier was not found");
    const menuItemId = String(located.menuItemId);
    await lockCoffeeMenuItem(tx, menuItemId);
    const modifier = await tx.menuItemModifier.findUnique({ where: { id: args.modifierId }, include: { menuItem: true } });
    if (!modifier || !modifier.menuItem || modifier.menuItemId !== menuItemId) throw new Error("Menu modifier was not found");
    assertCoffeeStoreOwnership(modifier.menuItem.storeId, storeId, "Menu modifier item");
    if (await findMenuReceipt(tx, key, { storeId, actorId, eventType: "menu_modifier.stock_changed", aggregateType: "menu_modifier", requestFingerprint })) return modifier;
    assertExpectedRevision(modifier, expectedUpdatedAt);
    if (args.inStock && String(modifier.inventoryAction || "unreviewed") === "unreviewed") throw new Error("Choose how this option affects inventory before offering it");
    const updated = await tx.menuItemModifier.update({ where: { id: args.modifierId }, data: { inStock: args.inStock } });
    await recordCoffeeCommandReceipt(tx, {
      storeId,
      eventKey: `menu-command:${key}`,
      eventType: "menu_modifier.stock_changed",
      aggregateType: "menu_modifier",
      aggregateId: args.modifierId,
      payload: { actorId, requestFingerprint, modifierId: args.modifierId, menuItemId, inStock: args.inStock, previousRevision: revision(modifier.updatedAt) }
    });
    return updated;
  }, TX_OPTIONS9);
}
var TX_OPTIONS9, STATIONS, MODIFIER_GROUPS, STALE_MESSAGE, REUSED_KEY_MESSAGE;
var init_manageCoffeeMenu = __esm({
  "features/keystone/mutations/manageCoffeeMenu.ts"() {
    "use strict";
    init_access();
    init_coffeeCommandReceipt();
    init_coffeeKdsAuthority();
    init_idempotency();
    init_menu_temperature();
    TX_OPTIONS9 = { maxWait: 5e3, timeout: 1e4, isolationLevel: "Serializable" };
    STATIONS = /* @__PURE__ */ new Set(["espresso_bar", "cold_bar", "brew_bar", "pastry_case", "retail_shelf"]);
    MODIFIER_GROUPS = /* @__PURE__ */ new Set(["size", "milk", "espresso", "syrup", "sweetness", "temperature", "ice", "topping", "bakery_prep", "grind"]);
    STALE_MESSAGE = "This menu entry changed since you opened it. Reload to see the latest version before saving.";
    REUSED_KEY_MESSAGE = "This menu change was already submitted with different details. Reload and try again.";
  }
});

// features/keystone/mutations/acceptCafePickupOrder.ts
function modifierSnapshotIds(value) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => entry && typeof entry === "object" && "id" in entry ? [String(entry.id)] : []);
}
function assertCafePickupAcceptanceAvailability(settings, lines, at, promisedAt) {
  for (const line of lines) {
    const item = line.menuItem;
    const itemName2 = String(item?.name || "Menu item");
    if (!item?.id || item.available !== true) throw cafeCustomerError(`${itemName2} is currently unavailable`);
    const serviceWindows = Array.isArray(item.serviceWindows) ? item.serviceWindows.map(String) : ["all_day"];
    assertCoffeeOrderingAvailable(settings, at, serviceWindows);
    assertCoffeeOrderingAvailable(settings, promisedAt, serviceWindows);
    const currentModifiers = Array.isArray(item.modifiers) ? item.modifiers : [];
    const snapshots = Array.isArray(line.modifierSnapshot) ? line.modifierSnapshot : [];
    const selected = [];
    for (const snapshot of snapshots) {
      const modifier = currentModifiers.find((candidate) => String(candidate.id) === String(snapshot?.id ?? ""));
      if (!modifier || modifier.inStock !== true) {
        throw cafeCustomerError(`${String(modifier?.name || "A selected option")} is currently unavailable`);
      }
      if (String(modifier.name ?? "") !== String(snapshot.name ?? "") || (modifier.modifierGroup || "default") !== String(snapshot.group ?? "") || Number(modifier.priceAdjustment || 0) !== Number(snapshot.priceAdjustment || 0)) throw new Error(OPTIONS_CHANGED_MESSAGE);
      selected.push(modifier);
    }
    try {
      validateCafeModifierSelections({ name: itemName2, modifiers: currentModifiers }, selected);
    } catch {
      throw new Error(OPTIONS_CHANGED_MESSAGE);
    }
  }
}
async function lockAndReadAdmissionLines(tx, orderId) {
  const refs = await tx.orderItem.findMany({ where: { orderId }, select: { menuItemId: true } });
  const menuItemIds = [...new Set(refs.map((ref) => ref.menuItemId).filter((id) => typeof id === "string" && id.length > 0))].sort();
  for (const menuItemId of menuItemIds) await lockCoffeeMenuItem(tx, menuItemId);
  return tx.orderItem.findMany({ where: { orderId }, orderBy: { createdAt: "asc" }, ...ADMISSION_ORDER_ITEMS_SELECT });
}
async function admitOpenCafeOrder(tx, order, storeId) {
  const settings = await tx.storeSetting.findUnique({ where: { id: storeId }, select: { pickupLeadTimeMinutes: true, pickupWindowMinutes: true, pickupCapacityPerWindow: true, timezone: true, weeklyHours: true } });
  if (!settings) throw new Error("Pickup capacity settings are invalid");
  const now = /* @__PURE__ */ new Date();
  const orderLines = Array.isArray(order.orderItems) ? order.orderItems : [];
  if (order.fulfillmentType !== "pickup") {
    assertCoffeeOrderingAvailable(settings, now);
    assertCafePickupAcceptanceAvailability(settings, orderLines, now, now);
    return null;
  }
  const requestedPromisedAt = new Date(String(order.promisedAt || ""));
  let promisedAt = requestedPromisedAt;
  if (!Number.isFinite(requestedPromisedAt.getTime()) || requestedPromisedAt.getTime() <= now.getTime()) {
    const serviceWindowSets = orderLines.map((line) => Array.isArray(line.menuItem?.serviceWindows) ? line.menuItem.serviceWindows.map(String) : ["all_day"]);
    const offset = coffeeFirstPickupMinutes(settings, Math.max(5, Number(settings.pickupLeadTimeMinutes || 12)), serviceWindowSets, now);
    if (offset == null) throw cafeCustomerError("The cafe is closed for pickup at that time");
    promisedAt = new Date(now.getTime() + offset * 6e4);
  }
  assertCoffeeOrderingAvailable(settings, promisedAt);
  const windowMinutes = Math.max(5, Number(settings.pickupWindowMinutes || 15));
  const windowMs = windowMinutes * 6e4;
  const windowStart = new Date(Math.floor(promisedAt.getTime() / windowMs) * windowMs);
  const windowEnd = new Date(windowStart.getTime() + windowMs);
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", "coffee-pickup-capacity", windowStart.toISOString());
  const locked = await readLockedPickupSettings(tx);
  if (Math.max(5, Number(locked.pickupWindowMinutes || 15)) !== windowMinutes) throw new Error(PICKUP_SETTINGS_CHANGED_MESSAGE);
  if (promisedAt !== requestedPromisedAt && Math.max(5, Number(locked.pickupLeadTimeMinutes || 12)) !== Math.max(5, Number(settings.pickupLeadTimeMinutes || 12))) throw new Error(PICKUP_SETTINGS_CHANGED_MESSAGE);
  const reservations = await tx.cafeOrder.count({ where: { storeId, id: { not: order.id }, fulfillmentType: "pickup", promisedAt: { gte: windowStart, lt: windowEnd }, status: { in: ["accepted", "paid", "in_bar_queue", "preparing", "ready"] } } });
  if (reservations >= Math.max(1, Number(locked.pickupCapacityPerWindow || 20))) throw cafeCustomerError("The requested pickup window is at capacity");
  assertCafePickupAcceptanceAvailability(settings, orderLines, promisedAt, promisedAt);
  return promisedAt;
}
async function acceptCafePickupOrder(_root, args, context) {
  if (!permissions.canManageOrders({ session: context.session })) throw new Error("Not authorized to accept cafe orders");
  const clientKey = normalizeIdempotencyKey(args.idempotencyKey);
  if (!clientKey) throw new Error("Order acceptance idempotency key is required");
  if (!args.orderId) throw new Error("Order id is required");
  const operatorId = context.session?.itemId || "operator";
  const scopedKey5 = buildScopedIdempotencyKey(`accept-order:${operatorId}`, clientKey);
  const eventKey = `order-acceptance:${scopedKey5}`;
  const requestFingerprint = fingerprintInput({ orderId: args.orderId });
  const orderId = await context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx;
    await lockCoffeeOrder(tx, args.orderId);
    const actorId = await requireCurrentCoffeeCapability(rawTx, context.session, ["canManageOrders"], "Not authorized to accept cafe orders");
    const order = await tx.cafeOrder.findUnique({
      where: { id: args.orderId },
      select: {
        id: true,
        storeId: true,
        orderNumber: true,
        status: true,
        fulfillmentType: true,
        promisedAt: true,
        paidAt: true
      }
    });
    if (!order) throw new Error("Cafe order not found");
    const storeId = await getPrimaryCoffeeStoreId(tx);
    assertCoffeeStoreOwnership(String(order.storeId), storeId, "Cafe order");
    const receipt = await tx.coffeeCommandReceipt.findUnique({ where: { eventKey } });
    if (receipt) {
      const payload = receipt.payload && typeof receipt.payload === "object" ? receipt.payload : {};
      if (receipt.storeId !== storeId || receipt.aggregateId !== String(order.id) || payload.acceptedBy !== actorId || payload.requestFingerprint !== requestFingerprint) {
        throw new Error("This acceptance request key was already used for a different order");
      }
      return String(order.id);
    }
    if (["accepted", "paid", "in_bar_queue", "preparing", "ready", "completed"].includes(String(order.status))) throw cafeCustomerError("This pickup request was already accepted. Refresh to see its current status.");
    if (order.status !== "open") throw new Error(`Only an open unpaid pickup request can be accepted; current status is ${String(order.status)}`);
    if (order.fulfillmentType !== "pickup") throw new Error("Only pickup requests use the acceptance workflow");
    const orderLines = await lockAndReadAdmissionLines(tx, String(order.id));
    const promisedAt = await admitOpenCafeOrder(tx, { ...order, orderItems: orderLines }, storeId);
    const lines = orderLines.map((line) => {
      const menuItem = line.menuItem;
      return { menuItemId: String(menuItem?.id || ""), fallbackInventoryItemId: menuItem?.inventoryItemId ? String(menuItem.inventoryItemId) : null, quantity: Number(line.quantity || 0), modifierIds: modifierSnapshotIds(line.modifierSnapshot) };
    });
    const requirements = await getCafeInventoryRequirements(tx, storeId, lines);
    await consumeCafeInventoryRequirements(tx, { storeId, orderId: String(order.id), orderNumber: String(order.orderNumber), requirements, createdById: actorId, reason: `Accepted pickup ${String(order.orderNumber)}` });
    const paidOnline = order.paidAt != null;
    await tx.cafeOrder.update({ where: { id: order.id }, data: { status: paidOnline ? "paid" : "accepted", promisedAt } });
    const inventoryRequirementEvidence = [];
    for (const requirement of requirements) {
      if (requirement.kind === "prep") inventoryRequirementEvidence.push({ kind: requirement.kind, prepBatchId: requirement.prepBatchId, quantity: requirement.quantity });
      else inventoryRequirementEvidence.push({ kind: requirement.kind, inventoryItemId: requirement.inventoryItemId, quantity: requirement.quantity });
    }
    await recordCoffeeCommandReceipt(tx, {
      storeId,
      eventKey,
      eventType: "order.accepted",
      aggregateType: "cafe_order",
      aggregateId: String(order.id),
      payload: { orderId: String(order.id), orderNumber: String(order.orderNumber), acceptedBy: actorId, requestFingerprint, inventoryRequirements: inventoryRequirementEvidence }
    });
    return String(order.id);
  }, { maxWait: 5e3, timeout: 1e4, isolationLevel: "ReadCommitted" });
  return context.sudo().query.CafeOrder.findOne({ where: { id: orderId }, query: ORDER_QUERY2 });
}
var ORDER_QUERY2, OPTIONS_CHANGED_MESSAGE, ADMISSION_ORDER_ITEMS_SELECT;
var init_acceptCafePickupOrder = __esm({
  "features/keystone/mutations/acceptCafePickupOrder.ts"() {
    "use strict";
    init_access();
    init_coffeeOrderPolicy();
    init_manageCoffeeMenu();
    init_coffeeCommandReceipt();
    init_coffeeAvailability();
    init_coffeeInventoryConsumption();
    init_idempotency();
    init_coffeeKdsAuthority();
    init_cafeCustomerError();
    ORDER_QUERY2 = "id orderNumber status fulfillmentType pickupName promisedAt total orderItems { id quantity itemNameSnapshot modifierSnapshot menuItem { id } }";
    OPTIONS_CHANGED_MESSAGE = "The options on this order changed since it was placed; ask the customer to review it.";
    ADMISSION_ORDER_ITEMS_SELECT = { select: { quantity: true, modifierSnapshot: true, menuItem: { select: { id: true, name: true, available: true, inventoryItemId: true, serviceWindows: true, modifiers: { select: { id: true, name: true, inStock: true, modifierGroup: true, modifierGroupLabel: true, priceAdjustment: true, required: true, minSelections: true, maxSelections: true, inventoryAction: true } } } } } };
  }
});

// features/keystone/mutations/recordCafePayment.ts
async function recordCafePayment(_root, args, context) {
  requireCafeTenderOperator(context.session);
  if (!args.orderId) throw new Error("Order id is required");
  if (!["cash", "card", "gift_card"].includes(args.method)) throw new Error("Recorded payment method must be cash, card or gift card");
  const giftCode = args.method === "gift_card" ? normalizeGiftCode(args.giftCardCode || "") : "";
  if (args.method === "gift_card" && !giftCode) throw cafeCustomerError("Enter the 12-character gift card code.");
  if (args.method !== "gift_card" && args.giftCardCode) throw new Error("A gift card code applies only to a gift card payment");
  const externalCardReference = args.externalCardReference?.trim() || "";
  if (args.method === "card") {
    if (args.externalCardApproved !== true) throw new Error("Confirm the card terminal approved this exact amount before recording the card payment");
    if (!/^[A-Za-z0-9#._:\/-]{4,64}$/.test(externalCardReference)) throw new Error("Enter the terminal approval or reference code (4-64 letters, numbers or #._:/-)");
  } else if (externalCardReference || args.externalCardApproved) throw new Error("A terminal reference applies only to an external card payment");
  const providerPaymentId = args.method === "cash" ? `cash_${(0, import_node_crypto11.randomUUID)()}` : args.method === "gift_card" ? giftCardTender.providerPaymentId(giftCode) : `external_terminal:${externalCardReference}`;
  const clientKey = normalizeIdempotencyKey(args.idempotencyKey);
  if (!clientKey) throw new Error("Recorded payment idempotency key is required");
  const scope = context.session?.listKey === "User" ? context.session.itemId : "operator";
  const scopedKey5 = buildScopedIdempotencyKey(`record-payment:${scope}`, clientKey);
  await releaseAbandonedOnlinePayments(context.prisma, args.orderId);
  const paymentId = await context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx;
    await lockCoffeeOrder(tx, args.orderId);
    await requireCurrentCoffeeCapability(rawTx, context.session, ["canManageOrders"], "Not authorized to record cafe payments");
    const actorId = await requireCurrentCoffeeCapability(rawTx, context.session, ["canManagePayments"], "Not authorized to record cafe payments");
    const order = await tx.cafeOrder.findUnique({
      where: { id: args.orderId },
      select: {
        id: true,
        storeId: true,
        orderNumber: true,
        status: true,
        total: true,
        discount: true,
        currencyCode: true,
        tip: true,
        fulfillmentType: true,
        promisedAt: true,
        payments: { select: { id: true, status: true, method: true, idempotencyKey: true, providerPaymentId: true } }
      }
    });
    if (!order) throw new Error("Cafe order not found");
    const storeId = await getPrimaryCoffeeStoreId(tx);
    assertCoffeeStoreOwnership(String(order.storeId), storeId, "Cafe order");
    const payments = Array.isArray(order.payments) ? order.payments : [];
    const replay = payments.find((payment2) => payment2.idempotencyKey === scopedKey5);
    if (replay) {
      if (replay.status !== "captured" || replay.method !== args.method || args.method === "card" && replay.providerPaymentId !== providerPaymentId || args.method === "gift_card" && giftCardTender.codeOf(String(replay.providerPaymentId)) !== giftCode) throw new Error("Recorded payment idempotency key conflicts with existing evidence");
      return String(replay.id);
    }
    if (!["open", "accepted", "in_bar_queue", "preparing", "ready"].includes(String(order.status))) throw new Error(`Cannot record settlement for an order with status ${String(order.status)}`);
    if (payments.some((payment2) => ["pending", "authorized", "captured"].includes(String(payment2.status)))) {
      throw new Error("Order already has an active payment attempt");
    }
    const amount = Number(order.total || 0) - Number(order.discount || 0);
    if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error("Order payable amount is invalid");
    if (args.method === "card") {
      const duplicate = await tx.payment.findFirst({ where: { storeId, method: "card", providerPaymentId }, select: { id: true } });
      if (duplicate) throw new Error("This terminal approval reference is already recorded on another sale");
    }
    const provider = await tx.paymentProvider.findUnique({ where: { code: "pp_system_default" }, select: { id: true } });
    if (!provider) throw new Error("System payment provider is not configured");
    const openShifts = await tx.registerShift.findMany({ where: { storeId, status: "open" }, take: 2, orderBy: { openedAt: "asc" }, select: { id: true } });
    if (openShifts.length !== 1) throw new Error("Exactly one open register shift is required to record pay-at-pickup settlement");
    const candidateShift = openShifts[0];
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-register-shift:${String(candidateShift.id)}`);
    const registerShift = await tx.registerShift.findUnique({ where: { id: candidateShift.id } });
    if (!registerShift || registerShift.status !== "open") throw new Error("The register shift closed before settlement was recorded");
    assertCoffeeStoreOwnership(String(registerShift.storeId), storeId, "Register shift");
    const admissionLines = order.status === "open" ? await lockAndReadAdmissionLines(tx, String(order.id)) : [];
    const admittedPromisedAt = order.status === "open" ? await admitOpenCafeOrder(tx, { ...order, orderItems: admissionLines }, storeId) : null;
    if (order.status === "open") {
      const requirements = await getCafeInventoryRequirements(tx, storeId, admissionLines.map((rawLine) => {
        const line = rawLine;
        const menuItem = line.menuItem;
        const snapshots = Array.isArray(line.modifierSnapshot) ? line.modifierSnapshot : [];
        return { menuItemId: String(menuItem?.id || ""), fallbackInventoryItemId: menuItem?.inventoryItemId ? String(menuItem.inventoryItemId) : null, quantity: Number(line.quantity || 0), modifierIds: snapshots.map((snapshot) => String(snapshot.id || "")).filter(Boolean) };
      }));
      await consumeCafeInventoryRequirements(tx, { storeId, orderId: String(order.id), orderNumber: String(order.orderNumber), requirements, reason: `Pickup settlement ${String(order.orderNumber)}`, createdById: actorId });
    }
    const settledAt = /* @__PURE__ */ new Date();
    if (args.method === "gift_card") await redeemCafeGiftCardInTransaction(tx, { storeId, code: giftCode, amount, ref: `order:${String(order.orderNumber)}`, now: settledAt });
    const payment = await tx.payment.create({
      data: {
        orderId: order.id,
        storeId,
        paymentProviderId: provider.id,
        idempotencyKey: scopedKey5,
        status: "captured",
        method: args.method,
        amount,
        currencyCode: String(order.currencyCode || "USD"),
        provider: "pp_system_default",
        providerPaymentId,
        processedAt: settledAt,
        registerShiftId: String(registerShift.id),
        metadata: {
          tender: args.method === "cash" ? { method: "cash", evidence: "cash_received_at_register" } : args.method === "gift_card" ? { method: "gift_card", evidence: "gift_card_ledger_debit", giftCardCode: giftCode } : { method: "external_card", evidence: "operator_attested_terminal_approval", terminalReference: externalCardReference, attestedById: actorId, attestedAt: settledAt.toISOString(), providerVerified: false }
        }
      },
      select: { id: true }
    });
    await tx.cafeOrder.update({ where: { id: order.id }, data: { status: ["open", "accepted"].includes(String(order.status)) ? "paid" : order.status, paidAt: settledAt, ...admittedPromisedAt ? { promisedAt: admittedPromisedAt } : {} } });
    const isCash = args.method === "cash";
    const cashSalesCents = Number(registerShift.cashSalesCents || 0) + (isCash ? amount : 0);
    const cardSalesCents = Number(registerShift.cardSalesCents || 0) + (args.method === "card" ? amount : 0);
    await tx.registerShift.update({
      where: { id: registerShift.id },
      data: {
        cashSalesCents,
        cardSalesCents,
        tipsCents: Number(registerShift.tipsCents || 0) + Number(order.tip || 0),
        expectedCashCents: Number(registerShift.openingCashCents || 0) + cashSalesCents - Number(registerShift.cashRefundsCents || 0) + Number(registerShift.payInsCents || 0) - Number(registerShift.payOutsCents || 0)
      }
    });
    await recordCoffeeCommandReceipt(tx, {
      storeId,
      eventKey: `payment:${payment.id}:captured:v1`,
      eventType: "payment.captured",
      aggregateType: "payment",
      aggregateId: payment.id,
      occurredAt: settledAt,
      payload: { paymentId: payment.id, orderId: String(order.id), orderNumber: String(order.orderNumber), registerShiftId: String(registerShift.id), recordedBy: actorId, method: args.method, amount, currencyCode: String(order.currencyCode || "USD"), externalCardReference: externalCardReference || null, requestFingerprint: fingerprintInput({ orderId: String(order.id), actorId, method: args.method, amount, externalCardReference: externalCardReference || null, externalCardApproved: args.method === "card" }) }
    });
    return payment.id;
  }, TX_OPTIONS10);
  return context.sudo().query.Payment.findOne({ where: { id: paymentId }, query: PAYMENT_QUERY });
}
var import_node_crypto11, TX_OPTIONS10, PAYMENT_QUERY;
var init_recordCafePayment = __esm({
  "features/keystone/mutations/recordCafePayment.ts"() {
    "use strict";
    import_node_crypto11 = require("node:crypto");
    init_coffeeOrderPolicy();
    init_onlinePaymentRelease();
    init_coffeeCommandReceipt();
    init_idempotency();
    init_coffeeInventoryConsumption();
    init_acceptCafePickupOrder();
    init_coffeeKdsAuthority();
    init_giftCards();
    init_cafeCustomerError();
    TX_OPTIONS10 = { maxWait: 5e3, timeout: 1e4, isolationLevel: "ReadCommitted" };
    PAYMENT_QUERY = "id status method amount currencyCode provider providerPaymentId processedAt order { id status }";
  }
});

// features/keystone/mutations/handleCafePaymentWebhook.ts
function replayKey(providerCode, eventId) {
  return `${providerCode}:${eventId}`;
}
function payloadHash(rawBody) {
  return (0, import_node_crypto12.createHash)("sha256").update(rawBody).digest("hex");
}
function assertSettlementMatches(payment, providerCode, verified) {
  if (payment.provider !== providerCode) throw new Error("Webhook provider does not match payment");
  if (verified.orderId && verified.orderId !== payment.orderId) throw new Error("Webhook order does not match payment");
  if (verified.amount == null || verified.amount !== payment.amount) throw new Error("Webhook amount does not match payment");
  if (!verified.currencyCode || verified.currencyCode.toUpperCase() !== payment.currencyCode.toUpperCase()) {
    throw new Error("Webhook currency does not match payment");
  }
}
async function findPayment(tx, providerCode, verified) {
  if (verified.paymentId) {
    return tx.payment.findUnique({ where: { id: verified.paymentId }, include: { order: true } });
  }
  return tx.payment.findFirst({
    where: { provider: providerCode, providerPaymentId: verified.providerPaymentId },
    include: { order: true }
  });
}
async function handleCafePaymentWebhook(_root, args, context) {
  if (!isOnlinePaymentProviderCode(args.providerCode)) throw new Error("Webhook provider not found");
  if (!args.rawBody || Buffer.byteLength(args.rawBody, "utf8") > 1024 * 1024) throw new Error("Invalid webhook body");
  const [provider] = await context.sudo().query.PaymentProvider.findMany({
    where: { code: { equals: args.providerCode }, isInstalled: { equals: true } },
    take: 1,
    query: "id code"
  });
  if (!provider) throw new Error("Payment provider is not installed");
  const verified = await executePaymentProviderAdapter({
    provider,
    functionName: "handleWebhookFunction",
    args: { rawBody: args.rawBody, headers: args.headers }
  });
  if (!verified.eventId || verified.eventId.length > 255) throw new Error("Verified webhook event id is invalid");
  if (verified.giftCardId) {
    if (verified.status === "succeeded" || verified.status === "failed") {
      const { settleCafeGiftCardFromWebhook: settleCafeGiftCardFromWebhook2 } = await Promise.resolve().then(() => (init_giftCards(), giftCards_exports));
      await settleCafeGiftCardFromWebhook2(context.prisma, verified.giftCardId);
    }
    return { success: true, replayed: false, paymentId: null, orderId: null };
  }
  const key = replayKey(provider.code, verified.eventId);
  const hash = payloadHash(args.rawBody);
  return context.prisma.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(
      "SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))",
      "coffee-payment-webhook",
      key
    );
    const storeId = await getPrimaryCoffeeStoreId(tx);
    const existing = await tx.paymentEvent.findUnique({
      where: { replayKey: key },
      select: { id: true, storeId: true, payloadHash: true, paymentId: true, orderId: true }
    });
    if (existing) {
      assertCoffeeStoreOwnership(existing.storeId, storeId, "Payment event");
      if (existing.payloadHash !== hash) throw new Error("Webhook replay key is bound to different payload evidence");
      return { success: true, replayed: true, paymentId: existing.paymentId, orderId: existing.orderId };
    }
    const payment = await findPayment(tx, provider.code, verified);
    if (verified.status !== "ignored" && !payment) throw new Error("Webhook payment was not found");
    if (payment) {
      assertCoffeeStoreOwnership(payment.storeId, storeId, "Payment");
      if (payment.order) assertCoffeeStoreOwnership(payment.order.storeId, storeId, "Payment order");
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-payment:${payment.id}`);
    }
    if (verified.status === "succeeded" && payment) {
      assertSettlementMatches(payment, provider.code, verified);
      if (payment.status !== "captured" && canTransition(PAYMENT_TRANSITIONS, String(payment.status), "captured")) {
        const cancelled = Boolean(payment.order && TERMINAL_UNSETTLED_ORDER_STATUSES.has(payment.order.status || ""));
        const settledAt = /* @__PURE__ */ new Date();
        await tx.payment.update({
          where: { id: payment.id },
          data: {
            status: "captured",
            processedAt: settledAt,
            failureMessage: cancelled ? "Paid after the order was cancelled; refund it" : ""
            // The hosted page reference (cs_…) stays: the evidence trigger makes it immutable once
            // assigned, and refunds resolve its payment intent from Stripe.
          }
        });
        if (payment.orderId && !cancelled) {
          const status = payment.order?.status === "accepted" ? "paid" : void 0;
          await tx.cafeOrder.update({ where: { id: payment.orderId }, data: { paidAt: settledAt, ...status ? { status } : {} } });
        }
      }
    } else if (verified.status === "failed" && payment && canTransition(PAYMENT_TRANSITIONS, String(payment.status), "failed") && payment.status !== "failed") {
      await tx.payment.update({
        where: { id: payment.id },
        data: { status: "failed", failureMessage: `Provider event ${verified.eventType}` }
      });
    }
    await tx.paymentEvent.create({
      data: {
        replayKey: key,
        storeId,
        providerCode: provider.code,
        providerEventId: verified.eventId,
        eventType: verified.eventType,
        payloadHash: hash,
        status: verified.status === "ignored" ? "ignored" : "processed",
        paymentId: payment?.id || null,
        orderId: payment?.orderId || verified.orderId || null,
        processedAt: /* @__PURE__ */ new Date()
      },
      select: { id: true }
    });
    await recordCoffeeCommandReceipt(tx, {
      storeId,
      eventKey: `payment-webhook:${key}:v1`,
      eventType: `payment.${verified.status}`,
      aggregateType: "payment",
      aggregateId: payment?.id || verified.paymentId || verified.providerPaymentId || verified.eventId,
      payload: { providerCode: provider.code, providerEventId: verified.eventId, eventType: verified.eventType, status: verified.status, paymentId: payment?.id || null, orderId: payment?.orderId || verified.orderId || null, amount: verified.amount ?? null, currencyCode: verified.currencyCode || null }
    });
    return { success: true, replayed: false, paymentId: payment?.id || null, orderId: payment?.orderId || verified.orderId || null };
  }, { maxWait: 5e3, timeout: 1e4, isolationLevel: "Serializable" });
}
var import_node_crypto12, TERMINAL_UNSETTLED_ORDER_STATUSES;
var init_handleCafePaymentWebhook = __esm({
  "features/keystone/mutations/handleCafePaymentWebhook.ts"() {
    "use strict";
    import_node_crypto12 = require("node:crypto");
    init_payment();
    init_paymentProviderAdapter();
    init_transitionPolicy();
    init_coffeeCommandReceipt();
    TERMINAL_UNSETTLED_ORDER_STATUSES = /* @__PURE__ */ new Set(["cancelled", "refunded"]);
  }
});

// features/platform/onboarding/lib/seed.json
var seed_default;
var init_seed = __esm({
  "features/platform/onboarding/lib/seed.json"() {
    seed_default = {
      minimal: {
        storeInfo: {
          name: "Neighborhood Roast",
          tagline: "Seasonal coffee, pastries, and pantry staples.",
          description: "A neighborhood coffee bar for espresso, pastries, and order-ahead pickup.",
          address: "128 Market Street, Brooklyn, NY 11201",
          phone: "",
          contactEmail: "hello@neighborhoodroast.local",
          currencyCode: "USD",
          locale: "en-US",
          timezone: "America/New_York",
          weeklyHours: [
            { day: "Monday", open: "07:00", close: "17:00" },
            { day: "Tuesday", open: "07:00", close: "17:00" },
            { day: "Wednesday", open: "07:00", close: "17:00" },
            { day: "Thursday", open: "07:00", close: "17:00" },
            { day: "Friday", open: "07:00", close: "17:00" },
            { day: "Saturday", open: "08:00", close: "16:00" },
            { day: "Sunday", open: "08:00", close: "15:00" }
          ],
          pickupLeadTimeMinutes: 12,
          pickupWindowMinutes: 15,
          pickupCapacityPerWindow: 20,
          taxRateBasisPoints: 887.5
        },
        categories: [
          { name: "Espresso", description: "Core espresso bar drinks.", sortOrder: 1 },
          { name: "Pastries", description: "Fresh bakery favorites.", sortOrder: 2 }
        ],
        menuItems: [
          { name: "Americano", shortDescription: "Double espresso topped with hot water.", price: 425, prepTimeMinutes: 4, barStation: "espresso_bar", temperatureOptions: ["hot"], featured: true, popular: true, categoryName: "Espresso", imageUrl: "/images/americano.jpg" },
          { name: "Vanilla Latte", shortDescription: "Espresso, milk, and house vanilla.", price: 625, prepTimeMinutes: 5, barStation: "espresso_bar", temperatureOptions: ["hot"], featured: true, popular: true, categoryName: "Espresso", imageUrl: "/images/vanilla-latte.jpg" },
          { name: "Almond Croissant", shortDescription: "Butter croissant with almond cream.", price: 495, prepTimeMinutes: 2, barStation: "pastry_case", temperatureOptions: [], featured: false, popular: true, categoryName: "Pastries", imageUrl: "/images/almond-croissant.jpg" }
        ],
        modifiers: [
          { menuItemName: "Americano", name: "12 oz", modifierGroup: "size", modifierGroupLabel: "Size", priceAdjustment: 0, defaultSelected: true, required: true, minSelections: 1, maxSelections: 1, inventoryAction: "none" },
          { menuItemName: "Americano", name: "16 oz", modifierGroup: "size", modifierGroupLabel: "Size", priceAdjustment: 75, defaultSelected: false, required: true, minSelections: 1, maxSelections: 1, inventoryAction: "none" },
          { menuItemName: "Vanilla Latte", name: "Whole Milk", modifierGroup: "milk", modifierGroupLabel: "Milk", priceAdjustment: 0, defaultSelected: true, required: true, minSelections: 1, maxSelections: 1, inventoryAction: "none" },
          { menuItemName: "Vanilla Latte", name: "Oat Milk", modifierGroup: "milk", modifierGroupLabel: "Milk", priceAdjustment: 80, defaultSelected: false, required: true, minSelections: 1, maxSelections: 1, inventoryAction: "substitute", inventoryItemName: "Oat Milk", replacesInventoryItemName: "Whole Milk" }
        ],
        inventoryItems: [
          { name: "Espresso Beans", sku: "COF-BEAN-G", unit: "g", currentStock: "12000", parLevel: "12000", reorderPoint: "8000", costPerUnit: 2 },
          { name: "Whole Milk", sku: "MIL-WHOLE-GL", unit: "gal", currentStock: "8", parLevel: "8", reorderPoint: "4", costPerUnit: 480 },
          { name: "Almond Croissant", sku: "PAS-ALM-EA", unit: "each", currentStock: "24", parLevel: "24", reorderPoint: "12", costPerUnit: 185 },
          { name: "Oat Milk", sku: "MIL-OAT-GL", unit: "gal", currentStock: "6", parLevel: "6", reorderPoint: "3", costPerUnit: 720 },
          { name: "Vanilla Syrup", sku: "SYR-VAN-L", unit: "l", currentStock: "4", parLevel: "4", reorderPoint: "2", costPerUnit: 925 }
        ],
        paymentProviders: [
          { name: "Stripe", code: "pp_stripe_stripe", isInstalled: false },
          { name: "PayPal", code: "pp_paypal_paypal", isInstalled: false },
          { name: "Manual / Cash", code: "pp_system_default", isInstalled: true }
        ],
        recipes: [
          { name: "Americano build", menuItemName: "Americano", status: "active", yieldQuantity: "1", yieldUnit: "serving", prepInstructions: "Pull an 18 g double shot and finish with hot water; both sizes use the same coffee dose.", allergenNotes: "None by default." },
          { name: "Vanilla Latte build", menuItemName: "Vanilla Latte", status: "active", yieldQuantity: "1", yieldUnit: "serving", prepInstructions: "Pull espresso, add vanilla, and steam the selected milk for a 12 oz drink.", allergenNotes: "Contains milk unless an alternate milk is selected." }
        ],
        ingredients: [
          { recipeName: "Americano build", name: "Espresso dose", inventoryItemName: "Espresso Beans", quantity: "18", unit: "g", optional: false },
          { recipeName: "Vanilla Latte build", name: "Espresso dose", inventoryItemName: "Espresso Beans", quantity: "18", unit: "g", optional: false },
          { recipeName: "Vanilla Latte build", name: "Milk choice", inventoryItemName: "Whole Milk", quantity: "0.08", unit: "gal", optional: false },
          { recipeName: "Vanilla Latte build", name: "Vanilla syrup", inventoryItemName: "Vanilla Syrup", quantity: "0.03", unit: "l", optional: false }
        ],
        suppliers: [],
        purchaseOrders: [],
        staffShifts: [],
        loyaltyAccounts: [],
        cateringOrders: []
      },
      full: {
        storeInfo: {
          name: "Neighborhood Roast",
          tagline: "Seasonal coffee, pastries, and pantry staples.",
          description: "A neighborhood coffee bar for espresso, pastries, and order-ahead pickup.",
          address: "128 Market Street, Brooklyn, NY 11201",
          phone: "",
          contactEmail: "hello@neighborhoodroast.local",
          currencyCode: "USD",
          locale: "en-US",
          timezone: "America/New_York",
          weeklyHours: [
            { day: "Monday", open: "07:00", close: "17:00" },
            { day: "Tuesday", open: "07:00", close: "17:00" },
            { day: "Wednesday", open: "07:00", close: "17:00" },
            { day: "Thursday", open: "07:00", close: "17:00" },
            { day: "Friday", open: "07:00", close: "17:00" },
            { day: "Saturday", open: "08:00", close: "16:00" },
            { day: "Sunday", open: "08:00", close: "15:00" }
          ],
          pickupLeadTimeMinutes: 12,
          pickupWindowMinutes: 15,
          pickupCapacityPerWindow: 20,
          taxRateBasisPoints: 887.5
        },
        categories: [
          { name: "Espresso", description: "Core espresso bar drinks.", sortOrder: 1 },
          { name: "Signature Drinks", description: "Seasonal and house specials.", sortOrder: 2 },
          { name: "Pastries", description: "Fresh bakery favorites.", sortOrder: 3 },
          { name: "Retail Beans", description: "Whole beans and brew-at-home staples.", sortOrder: 4 }
        ],
        menuItems: [
          { name: "Americano", shortDescription: "Double espresso topped with hot water.", price: 425, prepTimeMinutes: 4, barStation: "espresso_bar", temperatureOptions: ["hot"], featured: true, popular: true, categoryName: "Espresso", imageUrl: "/images/americano.jpg" },
          { name: "Vanilla Latte", shortDescription: "Espresso, milk, and house vanilla.", price: 625, prepTimeMinutes: 5, barStation: "espresso_bar", temperatureOptions: ["hot"], featured: true, popular: true, categoryName: "Signature Drinks", imageUrl: "/images/vanilla-latte.jpg" },
          { name: "Cardamom Cold Brew", shortDescription: "Slow-steeped cold brew with sweet spice.", price: 575, prepTimeMinutes: 3, barStation: "cold_bar", temperatureOptions: ["iced"], featured: true, popular: false, categoryName: "Signature Drinks", imageUrl: "/images/cardamom-cold-brew.jpg" },
          { name: "Almond Croissant", shortDescription: "Butter croissant with almond cream.", price: 495, prepTimeMinutes: 2, barStation: "pastry_case", temperatureOptions: [], featured: false, popular: true, categoryName: "Pastries", imageUrl: "/images/almond-croissant.jpg" },
          { name: "House Blend Beans", shortDescription: "12 oz bag of our house blend, whole bean or ground to order.", price: 1800, prepTimeMinutes: 0, barStation: "retail_shelf", temperatureOptions: [], featured: false, popular: false, categoryName: "Retail Beans", imageUrl: "/images/house-blend-beans.jpg" }
        ],
        modifiers: [
          { menuItemName: "Americano", name: "12 oz", modifierGroup: "size", modifierGroupLabel: "Size", priceAdjustment: 0, defaultSelected: true, required: true, minSelections: 1, maxSelections: 1, inventoryAction: "none" },
          { menuItemName: "Americano", name: "16 oz", modifierGroup: "size", modifierGroupLabel: "Size", priceAdjustment: 75, defaultSelected: false, required: true, minSelections: 1, maxSelections: 1, inventoryAction: "none" },
          { menuItemName: "Vanilla Latte", name: "12 oz", modifierGroup: "size", modifierGroupLabel: "Size", priceAdjustment: 0, defaultSelected: true, required: true, minSelections: 1, maxSelections: 1, inventoryAction: "none" },
          { menuItemName: "Vanilla Latte", name: "Whole Milk", modifierGroup: "milk", modifierGroupLabel: "Milk", priceAdjustment: 0, defaultSelected: true, required: true, minSelections: 1, maxSelections: 1, inventoryAction: "none" },
          { menuItemName: "Vanilla Latte", name: "Oat Milk", modifierGroup: "milk", modifierGroupLabel: "Milk", priceAdjustment: 80, defaultSelected: false, required: true, minSelections: 1, maxSelections: 1, inventoryAction: "substitute", inventoryItemName: "Oat Milk", replacesInventoryItemName: "Whole Milk" },
          { menuItemName: "Cardamom Cold Brew", name: "Regular Ice", modifierGroup: "ice", modifierGroupLabel: "Ice", priceAdjustment: 0, defaultSelected: true, required: false, minSelections: 0, maxSelections: 1, inventoryAction: "none" },
          { menuItemName: "Cardamom Cold Brew", name: "Light Ice", modifierGroup: "ice", modifierGroupLabel: "Ice", priceAdjustment: 0, defaultSelected: false, required: false, minSelections: 0, maxSelections: 1, inventoryAction: "none" },
          { menuItemName: "House Blend Beans", name: "Whole bean", modifierGroup: "grind", modifierGroupLabel: "Grind", priceAdjustment: 0, defaultSelected: true, required: true, minSelections: 1, maxSelections: 1, inventoryAction: "none" },
          { menuItemName: "House Blend Beans", name: "Drip", modifierGroup: "grind", modifierGroupLabel: "Grind", priceAdjustment: 0, defaultSelected: false, required: true, minSelections: 1, maxSelections: 1, inventoryAction: "none" },
          { menuItemName: "House Blend Beans", name: "Espresso", modifierGroup: "grind", modifierGroupLabel: "Grind", priceAdjustment: 0, defaultSelected: false, required: true, minSelections: 1, maxSelections: 1, inventoryAction: "none" }
        ],
        inventoryItems: [
          { name: "Espresso Beans", sku: "COF-BEAN-G", unit: "g", supplierName: "Common Thread Coffee Supply", currentStock: "12000", parLevel: "12000", reorderPoint: "8000", costPerUnit: 2 },
          { name: "Whole Milk", sku: "MIL-WHOLE-GL", unit: "gal", supplierName: "Common Thread Coffee Supply", currentStock: "8", parLevel: "8", reorderPoint: "4", costPerUnit: 480 },
          { name: "Oat Milk", sku: "MIL-OAT-GL", unit: "gal", supplierName: "Common Thread Coffee Supply", currentStock: "12", parLevel: "12", reorderPoint: "6", costPerUnit: 720 },
          { name: "Vanilla Syrup", sku: "SYR-VAN-L", unit: "l", supplierName: "Common Thread Coffee Supply", currentStock: "4", parLevel: "4", reorderPoint: "2", costPerUnit: 925 },
          { name: "Cardamom Syrup", sku: "SYR-CARD-L", unit: "l", supplierName: "Common Thread Coffee Supply", currentStock: "2", parLevel: "2", reorderPoint: "1", costPerUnit: 1e3 },
          { name: "Almond Croissant", sku: "PAS-ALM-EA", unit: "each", supplierName: "Common Thread Coffee Supply", currentStock: "24", parLevel: "24", reorderPoint: "12", costPerUnit: 185 },
          { name: "Cold Brew Concentrate", sku: "COF-COLD-GL", unit: "gal", supplierName: "Common Thread Coffee Supply", currentStock: "4", parLevel: "4", reorderPoint: "2", costPerUnit: 1850 },
          { name: "House Blend Beans", sku: "COF-HOUSE-12", unit: "each", category: "retail", supplierName: "Common Thread Coffee Supply", currentStock: "18", parLevel: "18", reorderPoint: "8", costPerUnit: 920 }
        ],
        paymentProviders: [
          { name: "Stripe", code: "pp_stripe_stripe", isInstalled: false },
          { name: "PayPal", code: "pp_paypal_paypal", isInstalled: false },
          { name: "Manual / Cash", code: "pp_system_default", isInstalled: true }
        ],
        suppliers: [
          { name: "Common Thread Coffee Supply", status: "active", contactName: "Renee Ortiz", email: "orders@commonthread.example", phone: "+1 (718) 555-0168", leadTimeDays: 3, notes: "Example supplier; replace with your own supplier details." }
        ],
        recipes: [
          { name: "Americano build", menuItemName: "Americano", status: "active", yieldQuantity: "1", yieldUnit: "serving", prepInstructions: "Pull an 18 g double shot and finish with hot water; both sizes use the same coffee dose.", allergenNotes: "None by default." },
          { name: "Vanilla Latte build", menuItemName: "Vanilla Latte", status: "active", yieldQuantity: "1", yieldUnit: "serving", prepInstructions: "Pull espresso, add vanilla, and steam the selected milk for a 12 oz drink.", allergenNotes: "Contains milk unless an alternate milk is selected." },
          { name: "Cardamom Cold Brew build", menuItemName: "Cardamom Cold Brew", status: "active", yieldQuantity: "1", yieldUnit: "serving", prepInstructions: "Measure concentrate, dilute, add cardamom syrup, and finish over selected ice.", allergenNotes: "None by default." }
        ],
        ingredients: [
          { recipeName: "Americano build", name: "Espresso dose", inventoryItemName: "Espresso Beans", quantity: "18", unit: "g", optional: false },
          { recipeName: "Vanilla Latte build", name: "Espresso dose", inventoryItemName: "Espresso Beans", quantity: "18", unit: "g", optional: false },
          { recipeName: "Vanilla Latte build", name: "Milk choice", inventoryItemName: "Whole Milk", quantity: "0.08", unit: "gal", optional: false, notes: "Oat Milk option explicitly replaces this inventory ID; names are never used at sale time." },
          { recipeName: "Vanilla Latte build", name: "Vanilla syrup", inventoryItemName: "Vanilla Syrup", quantity: "0.03", unit: "l", optional: false },
          { recipeName: "Cardamom Cold Brew build", name: "Cold brew concentrate", inventoryItemName: "Cold Brew Concentrate", quantity: "0.10", unit: "gal", optional: false },
          { recipeName: "Cardamom Cold Brew build", name: "Cardamom syrup", inventoryItemName: "Cardamom Syrup", quantity: "0.02", unit: "l", optional: false }
        ],
        purchaseOrders: [],
        staffShifts: [],
        loyaltyAccounts: [],
        cateringOrders: []
      }
    };
  }
});

// features/platform/onboarding/lib/onboardingSchema.ts
function duplicates(values) {
  const seen = /* @__PURE__ */ new Set();
  const repeated = /* @__PURE__ */ new Set();
  for (const value of values) (seen.has(value) ? repeated : seen).add(value);
  return [...repeated];
}
function onboardingDataErrors(data) {
  const errors = [];
  const unique = (label, values) => {
    for (const value of duplicates(values)) errors.push(`${label} "${value}" appears more than once`);
  };
  unique("Category", data.categories.map((entry) => entry.name));
  unique("Menu item", data.menuItems.map((entry) => entry.name));
  unique("Modifier", data.modifiers.map((entry) => `${entry.menuItemName} \xB7 ${entry.name}`));
  unique("Inventory item", data.inventoryItems.map((entry) => entry.name));
  unique("Payment provider", data.paymentProviders.map((entry) => entry.code.toLowerCase()));
  unique("Supplier", data.suppliers.map((entry) => entry.name));
  unique("Recipe", data.recipes.map((entry) => entry.name));
  unique("Ingredient", data.ingredients.map((entry) => `${entry.recipeName} \xB7 ${entry.name}`));
  unique("Purchase order", data.purchaseOrders.map((entry) => entry.poNumber));
  unique("Staff shift", data.staffShifts.map((entry) => entry.shiftNumber));
  unique("Loyalty account", data.loyaltyAccounts.map((entry) => entry.customerEmail.toLowerCase()));
  unique("Catering inquiry", data.cateringOrders.map((entry) => entry.cateringNumber));
  const categories = new Set(data.categories.map((entry) => entry.name));
  const menuItems = new Set(data.menuItems.map((entry) => entry.name));
  const stock = new Map(data.inventoryItems.map((entry) => [entry.name, entry]));
  const recipes = new Map(data.recipes.map((entry) => [entry.name, entry]));
  const suppliers = new Set(data.suppliers.map((entry) => entry.name));
  for (const item of data.menuItems) if (!categories.has(item.categoryName)) errors.push(`Onboarding category is missing for ${item.name}`);
  for (const modifier of data.modifiers) {
    if (!menuItems.has(modifier.menuItemName)) errors.push(`Onboarding menu item is missing for modifier ${modifier.name}`);
    if (modifier.inventoryAction === "none" || modifier.inventoryAction === "unreviewed") continue;
    const target = stock.get(modifier.inventoryItemName || "");
    if (!target) {
      errors.push(`Missing inventory for modifier ${modifier.name}`);
      continue;
    }
    if (modifier.inventoryAction === "add" && !(modifier.inventoryQuantity > 0)) errors.push(`Invalid add-on quantity for ${modifier.name}`);
    if (modifier.inventoryAction === "substitute") {
      const base = stock.get(modifier.replacesInventoryItemName || "");
      const baseInRecipe = Boolean(base) && data.ingredients.some((ingredient) => ingredient.inventoryItemName === base?.name && !ingredient.optional && recipes.get(ingredient.recipeName)?.menuItemName === modifier.menuItemName);
      if (!base || base.name === target.name || base.unit !== target.unit || !baseInRecipe) errors.push(`Invalid base recipe substitution for ${modifier.name}`);
    }
  }
  const activeRecipes = data.recipes.filter((recipe) => recipe.status === "active");
  for (const menuItem of duplicates(activeRecipes.map((recipe) => recipe.menuItemName))) errors.push(`${menuItem} can have only one active recipe`);
  for (const recipe of data.recipes) if (!menuItems.has(recipe.menuItemName)) errors.push(`Onboarding menu item is missing for recipe ${recipe.name}`);
  for (const ingredient of data.ingredients) {
    const item = stock.get(ingredient.inventoryItemName);
    if (!item || !recipes.has(ingredient.recipeName) || item.unit !== ingredient.unit) errors.push(`Invalid inventory unit, quantity or recipe for ${ingredient.name}`);
  }
  for (const order of data.purchaseOrders) {
    if (!suppliers.has(order.supplierName) || !stock.has(order.inventoryItemName)) errors.push(`Onboarding dependency is missing for purchase order ${order.poNumber}`);
  }
  return errors;
}
function parseOnboardingData(input) {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.issues.slice(0, 20).map((issue) => issue.path.length ? `${issue.path.join(".")}: ${issue.message}` : issue.message)
    };
  }
  const errors = onboardingDataErrors(parsed.data);
  return errors.length ? { success: false, errors } : { success: true, data: parsed.data };
}
var import_zod4, BAR_STATIONS, MODIFIER_GROUPS2, INVENTORY_UNITS, INVENTORY_CATEGORIES, SUPPLIER_STATUSES, RECIPE_STATUSES, STAFF_ROLES, LOYALTY_STATUSES2, LOYALTY_TIERS2, MAX_QUANTITY, decimalString, int2, text34, name, storeInfoSchema, categorySchema, menuItemSchema, modifierSchema, inventorySchema, providerSchema, supplierSchema, recipeSchema, ingredientSchema, purchaseOrderSchema, staffShiftSchema, loyaltyAccountSchema, cateringOrderSchema, onboardingSchema;
var init_onboardingSchema = __esm({
  "features/platform/onboarding/lib/onboardingSchema.ts"() {
    "use strict";
    import_zod4 = require("zod");
    init_store_locale_policy();
    init_store_settings_input();
    init_brand_colors();
    init_sanitize_store_logo();
    init_store_logo();
    init_menu_temperature();
    BAR_STATIONS = ["espresso_bar", "cold_bar", "brew_bar", "pastry_case", "retail_shelf"];
    MODIFIER_GROUPS2 = ["size", "milk", "espresso", "syrup", "sweetness", "temperature", "ice", "topping", "bakery_prep", "grind"];
    INVENTORY_UNITS = ["each", "lb", "oz", "g", "gal", "l"];
    INVENTORY_CATEGORIES = ["coffee", "milk", "syrup", "tea", "bakery", "retail", "packaging"];
    SUPPLIER_STATUSES = ["active", "paused", "archived"];
    RECIPE_STATUSES = ["draft", "active", "archived"];
    STAFF_ROLES = ["barista", "shift_lead", "kitchen", "manager"];
    LOYALTY_STATUSES2 = ["active", "paused", "closed"];
    LOYALTY_TIERS2 = ["regular", "neighborhood", "house_account"];
    MAX_QUANTITY = 1e9;
    decimalString = (label, { positive: positive3 = false } = {}) => import_zod4.z.string().trim().regex(/^\d{1,10}(\.\d{1,4})?$/, `${label} must be a number with up to 4 decimal places`).refine((value) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) && numeric <= MAX_QUANTITY && (!positive3 || numeric > 0);
    }, positive3 ? `${label} must be greater than 0` : `${label} is too large`);
    int2 = (min, max) => import_zod4.z.number().int().min(min).max(max);
    text34 = (max) => import_zod4.z.string().trim().max(max);
    name = import_zod4.z.string().trim().min(1).max(200);
    storeInfoSchema = import_zod4.z.object({
      name,
      tagline: text34(300).default(""),
      description: text34(2e3).default(""),
      address: import_zod4.z.string().trim().min(1, "Store address is required").max(500),
      phone: text34(100).default(""),
      contactEmail: import_zod4.z.string().trim().email("Enter a valid store contact email"),
      currencyCode: import_zod4.z.literal("USD").default("USD"),
      locale: import_zod4.z.literal("en-US").default("en-US"),
      timezone: import_zod4.z.string().trim().max(100).refine(validCoffeeTimezone, "Invalid store timezone").default("America/New_York"),
      brandColor: import_zod4.z.enum(COFFEE_BRAND_COLOR_VALUES).default(DEFAULT_COFFEE_BRAND_COLOR),
      logoIcon: import_zod4.z.string().max(1e5).default(DEFAULT_STORE_LOGO_ICON).refine((value) => Boolean(sanitizeStoreLogoSvg(value)), "Store logo must be a valid, safe SVG document").transform((value) => sanitizeStoreLogoSvg(value)),
      logoColor: import_zod4.z.union([import_zod4.z.string(), import_zod4.z.number()]).default(DEFAULT_STORE_LOGO_COLOR).transform(normalizeStoreLogoColor),
      weeklyHours: weeklyHoursSchema.default([]),
      pickupLeadTimeMinutes: int2(PICKUP_LIMITS.pickupLeadTimeMinutes.min, PICKUP_LIMITS.pickupLeadTimeMinutes.max).default(12),
      pickupWindowMinutes: int2(PICKUP_LIMITS.pickupWindowMinutes.min, PICKUP_LIMITS.pickupWindowMinutes.max).default(15),
      pickupCapacityPerWindow: int2(PICKUP_LIMITS.pickupCapacityPerWindow.min, PICKUP_LIMITS.pickupCapacityPerWindow.max).default(20),
      // The merchant's own sales-tax rate; setup never assumes one.
      taxRateBasisPoints: import_zod4.z.number().min(PICKUP_LIMITS.taxRateBasisPoints.min).max(PICKUP_LIMITS.taxRateBasisPoints.max).refine((value) => Math.abs(Math.round(value * 100) - value * 100) < 1e-6, "Tax rate allows at most two decimals of a basis point")
    }).strict();
    categorySchema = import_zod4.z.object({ name, description: text34(2e3).default(""), sortOrder: int2(0, 1e4).default(0) }).strict();
    menuItemSchema = import_zod4.z.object({
      name,
      shortDescription: text34(1e3).default(""),
      price: int2(0, 1e6),
      prepTimeMinutes: int2(0, 240).default(5),
      barStation: import_zod4.z.enum(BAR_STATIONS).default("espresso_bar"),
      // Omitted = the station default (cold bar iced, pastry and retail none, otherwise hot).
      temperatureOptions: import_zod4.z.array(import_zod4.z.enum(MENU_TEMPERATURES)).max(3).optional(),
      featured: import_zod4.z.boolean().default(false),
      popular: import_zod4.z.boolean().default(false),
      imageUrl: import_zod4.z.string().trim().max(1e3).regex(/^\/[^/\\]/, "Menu images must be a site path such as /images/latte.jpg").optional(),
      categoryName: name,
      caffeineMg: int2(0, 2e3).optional(),
      calories: int2(0, 5e3).optional()
    }).strict();
    modifierSchema = import_zod4.z.object({
      inventoryAction: import_zod4.z.enum(["none", "add", "substitute", "unreviewed"]).default("unreviewed"),
      inventoryItemName: name.optional(),
      replacesInventoryItemName: name.optional(),
      inventoryQuantity: import_zod4.z.number().nonnegative().max(MAX_QUANTITY).default(0),
      menuItemName: name,
      name,
      modifierGroup: import_zod4.z.enum(MODIFIER_GROUPS2).default("milk"),
      modifierGroupLabel: text34(200).default("Modifier"),
      priceAdjustment: int2(-1e5, 1e5).default(0),
      defaultSelected: import_zod4.z.boolean().default(false),
      required: import_zod4.z.boolean().default(false),
      minSelections: int2(0, 20).default(0),
      maxSelections: int2(1, 20).default(1)
    }).strict().refine((modifier) => modifier.minSelections <= modifier.maxSelections, "Modifier minimum selections cannot exceed the maximum");
    inventorySchema = import_zod4.z.object({
      name,
      sku: text34(100).default(""),
      unit: import_zod4.z.enum(INVENTORY_UNITS).default("each"),
      category: import_zod4.z.enum(INVENTORY_CATEGORIES).optional(),
      supplierName: text34(200).optional(),
      quantityOnHand: decimalString("Quantity on hand").optional(),
      currentStock: decimalString("Current stock").optional(),
      parLevel: decimalString("Par level").default("0"),
      reorderPoint: decimalString("Reorder point").default("0"),
      costPerUnit: int2(0, 1e8).default(0),
      active: import_zod4.z.boolean().optional()
    }).strict();
    providerSchema = import_zod4.z.object({ name, code: import_zod4.z.string().trim().min(1).max(100), isInstalled: import_zod4.z.boolean().default(false) }).strict();
    supplierSchema = import_zod4.z.object({
      name,
      status: import_zod4.z.enum(SUPPLIER_STATUSES).default("active"),
      contactName: text34(200).default(""),
      email: import_zod4.z.union([import_zod4.z.literal(""), import_zod4.z.string().trim().email("Enter a valid supplier email")]).default(""),
      phone: text34(100).default(""),
      leadTimeDays: int2(0, 365).default(0),
      notes: text34(2e3).default("")
    }).strict();
    recipeSchema = import_zod4.z.object({
      name,
      menuItemName: name,
      status: import_zod4.z.enum(RECIPE_STATUSES).default("active"),
      yieldQuantity: decimalString("Recipe yield", { positive: true }).default("1"),
      yieldUnit: text34(50).default("serving"),
      prepInstructions: text34(4e3).default(""),
      allergenNotes: text34(2e3).default("")
    }).strict();
    ingredientSchema = import_zod4.z.object({
      recipeName: name,
      name,
      inventoryItemName: name,
      quantity: decimalString("Ingredient quantity", { positive: true }),
      unit: import_zod4.z.enum(INVENTORY_UNITS),
      optional: import_zod4.z.boolean().default(false),
      notes: text34(2e3).default("")
    }).strict();
    purchaseOrderSchema = import_zod4.z.object({
      poNumber: import_zod4.z.string().trim().min(1).max(100),
      supplierName: name,
      inventoryItemName: name,
      orderedQuantity: decimalString("Ordered quantity", { positive: true }),
      unitCostCents: int2(0, 1e8),
      status: import_zod4.z.literal("submitted"),
      orderedOffsetDays: int2(-365, 0),
      expectedOffsetDays: int2(0, 365),
      notes: text34(2e3).default("")
    }).strict().refine((order) => Number(order.orderedQuantity) * order.unitCostCents <= Number.MAX_SAFE_INTEGER, "Purchase order total is too large");
    staffShiftSchema = import_zod4.z.object({
      shiftNumber: import_zod4.z.string().trim().min(1).max(100),
      role: import_zod4.z.enum(STAFF_ROLES),
      status: import_zod4.z.literal("scheduled"),
      startsOffsetHours: int2(0, 24 * 60),
      durationHours: import_zod4.z.number().positive().max(24),
      notes: text34(2e3).default("")
    }).strict();
    loyaltyAccountSchema = import_zod4.z.object({
      customerName: name,
      customerEmail: import_zod4.z.string().trim().email(),
      customerPhone: text34(100).default(""),
      status: import_zod4.z.enum(LOYALTY_STATUSES2).default("active"),
      tier: import_zod4.z.enum(LOYALTY_TIERS2).default("regular"),
      pointsBalance: import_zod4.z.literal(0).default(0),
      lifetimePoints: import_zod4.z.literal(0).default(0),
      drinkCredits: import_zod4.z.literal(0).default(0),
      visits: import_zod4.z.literal(0).default(0)
    }).strict();
    cateringOrderSchema = import_zod4.z.object({
      cateringNumber: import_zod4.z.string().trim().min(1).max(100),
      customerName: name,
      customerEmail: import_zod4.z.string().trim().email(),
      status: import_zod4.z.literal("inquiry"),
      eventOffsetDays: int2(1, 730),
      guestCount: int2(1, 1e4),
      deliveryAddress: text34(500).default(""),
      subtotalCents: import_zod4.z.literal(0),
      notes: text34(2e3).default("")
    }).strict();
    onboardingSchema = import_zod4.z.object({
      storeInfo: storeInfoSchema,
      categories: import_zod4.z.array(categorySchema).max(100),
      menuItems: import_zod4.z.array(menuItemSchema).max(500),
      modifiers: import_zod4.z.array(modifierSchema).max(2e3),
      inventoryItems: import_zod4.z.array(inventorySchema).max(1e3),
      paymentProviders: import_zod4.z.array(providerSchema).max(10),
      suppliers: import_zod4.z.array(supplierSchema).max(100).default([]),
      recipes: import_zod4.z.array(recipeSchema).max(500).default([]),
      ingredients: import_zod4.z.array(ingredientSchema).max(2e3).default([]),
      purchaseOrders: import_zod4.z.array(purchaseOrderSchema).max(100).default([]),
      staffShifts: import_zod4.z.array(staffShiftSchema).max(100).default([]),
      loyaltyAccounts: import_zod4.z.array(loyaltyAccountSchema).max(100).default([]),
      cateringOrders: import_zod4.z.array(cateringOrderSchema).max(100).default([])
    }).strict();
  }
});

// features/keystone/mutations/runCoffeeOnboarding.ts
function categoryForInventory(name2) {
  const value = name2.toLowerCase();
  if (value.includes("milk")) return "milk";
  if (value.includes("syrup")) return "syrup";
  if (value.includes("croissant") || value.includes("dough")) return "bakery";
  return "coffee";
}
function selectedData(args) {
  const seed = args.template === "custom" ? null : seed_default[args.template];
  const source = seed ? { ...seed, storeInfo: { logoIcon: DEFAULT_STORE_LOGO_ICON, logoColor: DEFAULT_STORE_LOGO_COLOR, ...seed.storeInfo } } : args.data;
  const result = parseOnboardingData(source);
  if (!result.success) throw new Error(`Setup data is invalid: ${result.errors.join("; ")}`);
  for (const provider of result.data.paymentProviders) normalizePaymentProviderCode(provider.code);
  return result.data;
}
function bump(counts, key) {
  counts[key] += 1;
}
function offsetDate(now, input) {
  return new Date(now.getTime() + (Number(input.days || 0) * 24 + Number(input.hours || 0)) * 60 * 60 * 1e3);
}
async function upsertNamed(list33, storeId, name2, data) {
  const existing = await list33.findFirst({ where: { name: name2, storeId }, select: { id: true } });
  if (existing) return { ...existing, created: false };
  return { ...await list33.create({ data, select: { id: true } }), created: true };
}
async function runInTransaction(rawTx, data, userId, session, template) {
  await requireCurrentCoffeeCapability(rawTx, session, ["canManageOnboarding"], "You do not have permission to run coffee shop onboarding");
  const tx = rawTx;
  await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", "coffee-onboarding");
  const counts = { storeSettings: 0, categories: 0, menuItems: 0, modifiers: 0, inventoryItems: 0, paymentProviders: 0, suppliers: 0, recipes: 0, ingredients: 0, purchaseOrders: 0, staffShifts: 0, loyaltyAccounts: 0, cateringOrders: 0 };
  const existingStore = await tx.storeSetting.findUnique({ where: { singletonKey: "primary" }, select: { id: true, logoIcon: true, logoColor: true } });
  let storeId;
  if (existingStore) {
    storeId = existingStore.id;
    const repair = {};
    if (!existingStore.logoIcon?.trim()) repair.logoIcon = data.storeInfo.logoIcon;
    if (existingStore.logoColor == null || existingStore.logoColor === "") repair.logoColor = data.storeInfo.logoColor;
    if (Object.keys(repair).length) await tx.storeSetting.update({ where: { id: storeId }, data: repair, select: { id: true } });
  } else {
    const storeInfo = template === "custom" ? data.storeInfo : { ...data.storeInfo, contactEmail: "" };
    storeId = (await tx.storeSetting.create({ data: { singletonKey: "primary", ...storeInfo }, select: { id: true } })).id;
    bump(counts, "storeSettings");
  }
  const categoryIds = /* @__PURE__ */ new Map();
  for (const category of data.categories) {
    const record = await upsertNamed(tx.menuCategory, storeId, category.name, { ...category, storeId, active: true });
    categoryIds.set(category.name, record.id);
    if (record.created) bump(counts, "categories");
  }
  const inventoryIds = /* @__PURE__ */ new Map();
  for (const inventory of data.inventoryItems) {
    const existing = await tx.inventoryItem.findFirst({ where: { name: inventory.name, storeId }, select: { id: true } });
    const inventoryData = {
      name: inventory.name,
      storeId,
      sku: inventory.sku,
      category: inventory.category || categoryForInventory(inventory.name),
      supplierName: inventory.supplierName || null,
      unit: inventory.unit,
      parLevel: inventory.parLevel,
      reorderPoint: inventory.reorderPoint,
      costPerUnit: inventory.costPerUnit
    };
    const openingStock = inventory.currentStock || inventory.quantityOnHand || "0";
    const record = existing ? existing : await tx.inventoryItem.create({
      data: { ...inventoryData, currentStock: openingStock },
      select: { id: true }
    });
    if (!existing && Number(openingStock) > 0) {
      await tx.stockMovement.create({
        data: { storeId, inventoryItemId: record.id, type: "adjustment", quantity: openingStock, reason: "Opening stock", createdById: userId },
        select: { id: true }
      });
    }
    inventoryIds.set(inventory.name, record.id);
    if (!existing) bump(counts, "inventoryItems");
  }
  const menuItemIds = /* @__PURE__ */ new Map();
  for (const item of data.menuItems) {
    const categoryId = categoryIds.get(item.categoryName);
    if (!categoryId) throw new Error(`Onboarding category is missing for ${item.name}`);
    const inventoryId = inventoryIds.get(INVENTORY_BY_MENU_ITEM[item.name]);
    const record = await upsertNamed(tx.menuItem, storeId, item.name, {
      name: item.name,
      storeId,
      shortDescription: item.shortDescription,
      price: item.price,
      prepTimeMinutes: item.prepTimeMinutes,
      barStation: item.barStation,
      temperatureOptions: item.temperatureOptions ?? defaultTemperatureOptions(item.barStation),
      featured: item.featured,
      popular: item.popular,
      imageUrl: item.imageUrl || null,
      caffeineMg: item.caffeineMg,
      calories: item.calories,
      available: true,
      categoryId,
      inventoryItemId: inventoryId || null
    });
    menuItemIds.set(item.name, record.id);
    if (item.imageUrl && record.created) {
      const image2 = await tx.menuItemImage.findFirst({ where: { menuItems: { some: { id: record.id } } }, select: { id: true } });
      const imageData = { imagePath: item.imageUrl, altText: item.name, order: 0 };
      if (!image2) await tx.menuItemImage.create({ data: { ...imageData, menuItems: { connect: { id: record.id } } }, select: { id: true } });
    }
    if (record.created) bump(counts, "menuItems");
  }
  for (const modifier of data.modifiers) {
    const menuItemId = menuItemIds.get(modifier.menuItemName);
    if (!menuItemId) throw new Error(`Onboarding menu item is missing for modifier ${modifier.name}`);
    const existing = await tx.menuItemModifier.findFirst({ where: { name: modifier.name, menuItemId }, select: { id: true } });
    const modifierData = {
      storeId,
      inventoryAction: modifier.inventoryAction,
      inventoryItemId: modifier.inventoryItemName ? inventoryIds.get(modifier.inventoryItemName) : null,
      replacesInventoryItemId: modifier.replacesInventoryItemName ? inventoryIds.get(modifier.replacesInventoryItemName) : null,
      inventoryQuantity: modifier.inventoryQuantity,
      name: modifier.name,
      modifierGroup: modifier.modifierGroup,
      modifierGroupLabel: modifier.modifierGroupLabel,
      priceAdjustment: modifier.priceAdjustment,
      defaultSelected: modifier.defaultSelected,
      required: modifier.required,
      minSelections: modifier.minSelections,
      maxSelections: modifier.maxSelections,
      menuItemId,
      inStock: true
    };
    if (!existing) {
      await tx.menuItemModifier.create({ data: modifierData, select: { id: true } });
      bump(counts, "modifiers");
    }
  }
  const supplierIds = /* @__PURE__ */ new Map();
  for (const supplier of data.suppliers) {
    const record = await upsertNamed(tx.supplier, storeId, supplier.name, { ...supplier, storeId });
    supplierIds.set(supplier.name, record.id);
    if (record.created) bump(counts, "suppliers");
  }
  const recipeIds = /* @__PURE__ */ new Map();
  for (const recipe of data.recipes) {
    const { menuItemName, ...recipeData } = recipe;
    const menuItemId = menuItemIds.get(menuItemName);
    if (!menuItemId) throw new Error(`Onboarding menu item is missing for recipe ${recipe.name}`);
    const record = await upsertNamed(tx.recipe, storeId, recipe.name, { ...recipeData, menuItemId, storeId, active: true });
    recipeIds.set(recipe.name, record.id);
    if (record.created) bump(counts, "recipes");
  }
  for (const ingredient of data.ingredients) {
    const recipeId = recipeIds.get(ingredient.recipeName);
    const inventoryItemId = inventoryIds.get(ingredient.inventoryItemName);
    if (!recipeId || !inventoryItemId) throw new Error(`Onboarding dependency is missing for ingredient ${ingredient.name}`);
    const existing = await tx.ingredient.findFirst({ where: { recipeId, inventoryItemId, name: ingredient.name, storeId }, select: { id: true } });
    const ingredientData = { storeId, recipeId, inventoryItemId, name: ingredient.name, quantity: ingredient.quantity, unit: ingredient.unit, optional: ingredient.optional, notes: ingredient.notes };
    if (!existing) {
      await tx.ingredient.create({ data: ingredientData, select: { id: true } });
      bump(counts, "ingredients");
    }
  }
  const now = /* @__PURE__ */ new Date();
  for (const purchaseOrder of data.purchaseOrders) {
    const supplierId = supplierIds.get(purchaseOrder.supplierName);
    const inventoryItemId = inventoryIds.get(purchaseOrder.inventoryItemName);
    if (!supplierId || !inventoryItemId) throw new Error(`Onboarding dependency is missing for purchase order ${purchaseOrder.poNumber}`);
    const existing = await tx.purchaseOrder.findUnique({ where: { poNumber: purchaseOrder.poNumber }, select: { id: true } });
    if (existing) continue;
    await tx.purchaseOrder.create({ data: { storeId, supplierId, inventoryItemId, poNumber: purchaseOrder.poNumber, orderedQuantity: purchaseOrder.orderedQuantity, unitCostCents: purchaseOrder.unitCostCents, subtotalCents: Math.round(Number(purchaseOrder.orderedQuantity) * purchaseOrder.unitCostCents), status: purchaseOrder.status, orderedAt: offsetDate(now, { days: purchaseOrder.orderedOffsetDays }), expectedAt: offsetDate(now, { days: purchaseOrder.expectedOffsetDays }), notes: purchaseOrder.notes, idempotencyKey: `onboarding:${purchaseOrder.poNumber}` }, select: { id: true } });
    bump(counts, "purchaseOrders");
  }
  for (const shift of data.staffShifts) {
    const existing = await tx.staffShift.findUnique({ where: { shiftNumber: shift.shiftNumber }, select: { id: true } });
    if (!existing) {
      const startsAt = offsetDate(now, { hours: shift.startsOffsetHours });
      await tx.staffShift.create({ data: { storeId, staffId: userId, idempotencyKey: `onboarding:${shift.shiftNumber}`, shiftNumber: shift.shiftNumber, role: shift.role, status: shift.status, startsAt, endsAt: offsetDate(startsAt, { hours: shift.durationHours }), notes: shift.notes }, select: { id: true } });
      bump(counts, "staffShifts");
    }
  }
  for (const account of data.loyaltyAccounts) {
    const email = account.customerEmail.toLowerCase();
    const existing = await tx.loyaltyAccount.findFirst({ where: { storeId, customerEmail: email }, select: { id: true } });
    if (!existing) {
      await tx.loyaltyAccount.create({ data: { ...account, customerEmail: email, storeId }, select: { id: true } });
      bump(counts, "loyaltyAccounts");
    }
  }
  for (const catering of data.cateringOrders) {
    const existing = await tx.cateringOrder.findUnique({ where: { cateringNumber: catering.cateringNumber }, select: { id: true } });
    if (!existing) {
      await tx.cateringOrder.create({ data: { storeId, cateringNumber: catering.cateringNumber, customerName: catering.customerName, customerEmail: catering.customerEmail.toLowerCase(), status: catering.status, eventAt: offsetDate(now, { days: catering.eventOffsetDays }), guestCount: catering.guestCount, deliveryAddress: catering.deliveryAddress, subtotalCents: 0, notes: catering.notes }, select: { id: true } });
      bump(counts, "cateringOrders");
    }
  }
  for (const providerInput of data.paymentProviders) {
    const code = normalizePaymentProviderCode(providerInput.code);
    const providerData = { name: providerInput.name, code, metadata: { configuredBy: "onboarding" } };
    const existing = await tx.paymentProvider.findUnique({ where: { code }, select: { id: true } });
    if (!existing) {
      await tx.paymentProvider.create({ data: { ...providerData, isInstalled: code === "pp_system_default" }, select: { id: true } });
      bump(counts, "paymentProviders");
    }
  }
  await tx.user.update({ where: { id: userId }, data: { onboardingStatus: "completed" }, select: { id: true } });
  await recordCoffeeCommandReceipt(tx, {
    storeId,
    eventKey: `store:${storeId}:onboarding:${fingerprintInput(data).slice(0, 24)}:completed:v1`,
    eventType: "store.onboarding_completed",
    aggregateType: "store",
    aggregateId: storeId,
    payload: { storeId, templateCounts: counts }
  });
  return counts;
}
async function runCoffeeOnboarding(_root, args, context) {
  const userId = context.session?.itemId;
  if (!userId || !permissions.canManageOnboarding({ session: context.session })) {
    throw new Error("You do not have permission to run coffee shop onboarding");
  }
  if (!(/* @__PURE__ */ new Set(["minimal", "full", "custom"])).has(args.template)) throw new Error("Invalid onboarding template");
  const data = selectedData(args);
  const counts = await context.prisma.$transaction(
    (tx) => runInTransaction(tx, data, userId, context.session, args.template),
    // Bounded below the GraphQL execution deadline so a timed-out request rolls back
    // instead of committing after the response was already sent.
    { maxWait: 2e3, timeout: 7e3, isolationLevel: "Serializable" }
  );
  return { status: "completed", ...counts };
}
var INVENTORY_BY_MENU_ITEM;
var init_runCoffeeOnboarding = __esm({
  "features/keystone/mutations/runCoffeeOnboarding.ts"() {
    "use strict";
    init_payment();
    init_idempotency();
    init_seed();
    init_onboardingSchema();
    init_store_logo();
    init_access();
    init_coffeeCommandReceipt();
    init_coffeeKdsAuthority();
    init_menu_temperature();
    INVENTORY_BY_MENU_ITEM = {
      "Almond Croissant": "Almond Croissant",
      "House Blend Beans": "House Blend Beans"
    };
  }
});

// features/keystone/mutations/registerShiftOperations.ts
function requireRegisterOperator(context) {
  const canOperate = permissions.canManageOrders({ session: context.session });
  if (!canOperate || !context.session?.itemId) throw new Error("Not authorized to operate register shifts");
  return context.session.itemId;
}
async function requireCurrentRegisterOperator(tx, context) {
  await requireCurrentCoffeeCapability(tx, context.session, ["canManageOrders"], "Not authorized to operate register shifts");
}
function cents(value, label, allowZero = true) {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < (allowZero ? 0 : 1) || parsed > 1e8) {
    throw new Error(`${label} must be a valid integer amount in cents`);
  }
  return parsed;
}
function scopedKey2(context, purpose, value) {
  const normalized = normalizeIdempotencyKey(value);
  if (!normalized) throw new Error(`${purpose} idempotency key is required`);
  return buildScopedIdempotencyKey(`${purpose}:${context.session?.itemId}`, normalized);
}
function reference(prefix, value) {
  return `${prefix}-${(0, import_node_crypto13.createHash)("sha256").update(value).digest("hex").slice(0, 12).toUpperCase()}`;
}
function expectedCash(shift) {
  return Number(shift.openingCashCents || 0) + Number(shift.cashSalesCents || 0) - Number(shift.cashRefundsCents || 0) + Number(shift.payInsCents || 0) - Number(shift.payOutsCents || 0);
}
async function openRegisterShift(_root, args, context) {
  const userId = requireRegisterOperator(context);
  const registerName = args.registerName?.trim();
  if (!registerName || registerName.length > 100) throw new Error("Register name is required");
  const openingCashCents = cents(args.openingCashCents, "Opening cash");
  const key = scopedKey2(context, "register-open", args.idempotencyKey);
  return context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx;
    await requireCurrentRegisterOperator(tx, context);
    const storeId = await getPrimaryCoffeeStoreId(tx);
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-register-open:${storeId}`);
    const replay = await tx.registerShift.findUnique({ where: { idempotencyKey: key } });
    if (replay) {
      if (replay.registerName !== registerName || Number(replay.openingCashCents) !== openingCashCents) throw new Error("Register idempotency key conflicts with different opening data");
      return replay;
    }
    const alreadyOpen = await tx.registerShift.findFirst({
      where: { storeId, status: "open" }
    });
    if (alreadyOpen) throw new Error("This single-register cafe already has an open shift; close it before opening another");
    const shift = await tx.registerShift.create({
      data: {
        idempotencyKey: key,
        storeId,
        shiftNumber: reference("REG", key),
        registerName,
        status: "open",
        openingCashCents,
        expectedCashCents: openingCashCents,
        openedById: userId,
        openedAt: /* @__PURE__ */ new Date()
      }
    });
    await recordCoffeeCommandReceipt(tx, {
      storeId,
      eventKey: `register-shift:${String(shift.id)}:opened:v1`,
      eventType: "register_shift.opened",
      aggregateType: "register_shift",
      aggregateId: String(shift.id),
      payload: { shiftId: String(shift.id), shiftNumber: String(shift.shiftNumber), registerName, openingCashCents }
    });
    return shift;
  }, TX_OPTIONS11);
}
async function recordRegisterCashMovement(_root, args, context) {
  const userId = requireRegisterOperator(context);
  if (!MOVEMENT_TYPES.has(args.type)) throw new Error("Invalid register cash movement type");
  const amountCents = cents(args.amountCents, "Cash movement", false);
  const reason = args.reason?.trim();
  if (!reason || reason.length > 500) throw new Error("Cash movement reason is required");
  const key = scopedKey2(context, "register-movement", args.idempotencyKey);
  return context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx;
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-register-shift:${args.registerShiftId}`);
    await requireCurrentRegisterOperator(tx, context);
    const replay = await tx.cashMovement.findUnique({ where: { idempotencyKey: key } });
    if (replay) {
      if (replay.registerShiftId !== args.registerShiftId || replay.type !== args.type || Number(replay.amountCents) !== amountCents || replay.reason !== reason) throw new Error("Cash movement idempotency key conflicts with different data");
      return replay;
    }
    const shift = await tx.registerShift.findUnique({ where: { id: args.registerShiftId } });
    if (!shift) throw new Error("Register shift not found");
    const storeId = await getPrimaryCoffeeStoreId(tx);
    assertCoffeeStoreOwnership(shift.storeId, storeId, "Register shift");
    if (shift.status !== "open") throw new Error("Cash movements require an open register shift");
    const isPayIn = args.type === "pay_in";
    const availableCashCents = expectedCash(shift);
    if (!isPayIn && amountCents > availableCashCents) {
      throw new Error(`${args.type === "cash_drop" ? "Cash drop" : "Pay out"} exceeds the ${(Math.max(0, availableCashCents) / 100).toFixed(2)} expected in the drawer`);
    }
    const payInsCents = assertCafeMoneyCents(Number(shift.payInsCents || 0) + (isPayIn ? amountCents : 0), "Shift pay-ins");
    const payOutsCents = assertCafeMoneyCents(Number(shift.payOutsCents || 0) + (isPayIn ? 0 : amountCents), "Shift pay-outs");
    await tx.registerShift.update({
      where: { id: args.registerShiftId },
      data: {
        payInsCents,
        payOutsCents,
        expectedCashCents: Number(shift.openingCashCents || 0) + Number(shift.cashSalesCents || 0) - Number(shift.cashRefundsCents || 0) + payInsCents - payOutsCents
      }
    });
    const movement = await tx.cashMovement.create({
      data: {
        idempotencyKey: key,
        storeId,
        movementNumber: reference("CASH", key),
        registerShiftId: args.registerShiftId,
        type: args.type,
        amountCents,
        reason,
        recordedById: userId,
        recordedAt: /* @__PURE__ */ new Date()
      }
    });
    await recordCoffeeCommandReceipt(tx, {
      storeId,
      eventKey: `cash-movement:${String(movement.id)}:recorded:v1`,
      eventType: "register_cash.recorded",
      aggregateType: "register_shift",
      aggregateId: args.registerShiftId,
      payload: { movementId: String(movement.id), shiftId: args.registerShiftId, type: args.type, amountCents, reason }
    });
    return movement;
  }, TX_OPTIONS11);
}
async function closeRegisterShift(_root, args, context) {
  const userId = requireRegisterOperator(context);
  const countedCashCents = cents(args.countedCashCents, "Counted cash");
  const key = scopedKey2(context, "register-close", args.idempotencyKey);
  return context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx;
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-register-shift:${args.registerShiftId}`);
    await requireCurrentRegisterOperator(tx, context);
    const shift = await tx.registerShift.findUnique({ where: { id: args.registerShiftId } });
    if (!shift) throw new Error("Register shift not found");
    const storeId = await getPrimaryCoffeeStoreId(tx);
    assertCoffeeStoreOwnership(shift.storeId, storeId, "Register shift");
    if (shift.status === "closed") {
      if (shift.closeIdempotencyKey !== key || Number(shift.countedCashCents) !== countedCashCents) throw new Error("Register shift was already closed with different evidence");
      return shift;
    }
    const expectedCashCents = expectedCash(shift);
    const closed = await tx.registerShift.update({
      where: { id: args.registerShiftId },
      data: {
        closeIdempotencyKey: key,
        status: "closed",
        expectedCashCents,
        countedCashCents,
        cashVarianceCents: countedCashCents - expectedCashCents,
        closedById: userId,
        closedAt: /* @__PURE__ */ new Date()
      }
    });
    await recordCoffeeCommandReceipt(tx, {
      storeId,
      eventKey: `register-shift:${args.registerShiftId}:closed:v1`,
      eventType: "register_shift.closed",
      aggregateType: "register_shift",
      aggregateId: args.registerShiftId,
      payload: { shiftId: args.registerShiftId, expectedCashCents, countedCashCents, varianceCents: countedCashCents - expectedCashCents }
    });
    return closed;
  }, TX_OPTIONS11);
}
var import_node_crypto13, TX_OPTIONS11, MOVEMENT_TYPES;
var init_registerShiftOperations = __esm({
  "features/keystone/mutations/registerShiftOperations.ts"() {
    "use strict";
    import_node_crypto13 = require("node:crypto");
    init_access();
    init_coffeeCommandReceipt();
    init_idempotency();
    init_coffeeKdsAuthority();
    init_coffeePricing();
    TX_OPTIONS11 = { maxWait: 5e3, timeout: 1e4, isolationLevel: "ReadCommitted" };
    MOVEMENT_TYPES = /* @__PURE__ */ new Set(["pay_in", "pay_out", "cash_drop"]);
  }
});

// features/keystone/mutations/staffShiftOperations.ts
function requireStaffManager(context) {
  if (!permissions.canManageSettings({ session: context.session }) || !context.session?.itemId) {
    throw new Error("Not authorized to manage staff shifts");
  }
  return context.session.itemId;
}
function scopedKey3(context, purpose, value) {
  const normalized = normalizeIdempotencyKey(value);
  if (!normalized) throw new Error(`${purpose} idempotency key is required`);
  return buildScopedIdempotencyKey(`${purpose}:${context.session?.itemId}`, normalized);
}
function shiftReference(key) {
  return `STAFF-${(0, import_node_crypto14.createHash)("sha256").update(key).digest("hex").slice(0, 12).toUpperCase()}`;
}
function instant(value, label) {
  if (typeof value !== "string" || !INSTANT.test(value)) throw new Error(`${label} must be a full date and time`);
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`${label} is invalid`);
  return parsed;
}
function evaluateStaffShiftTransition(current, next) {
  if (!(current in STAFF_TRANSITIONS) || !(next in STAFF_TRANSITIONS)) throw new Error("Unsupported staff shift status");
  if (current === next) return { replay: true };
  if (!STAFF_TRANSITIONS[current].includes(next)) throw new Error(`Cannot transition staff shift from ${current} to ${next}`);
  return { replay: false };
}
async function scheduleCoffeeStaffShift(_root, args, context) {
  requireStaffManager(context);
  if (!STAFF_ROLES2.has(args.role)) throw new Error("Unsupported staff shift role");
  if (typeof args.staffId !== "string" || !args.staffId || args.staffId.length > 255) throw new Error("Staff member is required");
  const startsAt = instant(args.startsAt, "Shift start");
  const endsAt = instant(args.endsAt, "Shift end");
  if (endsAt <= startsAt) throw new Error("Shift end must be after its start");
  const notes = typeof args.notes === "string" ? args.notes.trim() : "";
  if (notes.length > 500) throw new Error("Notes must be 500 characters or fewer");
  const key = scopedKey3(context, "staff-shift-schedule", args.idempotencyKey);
  return context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx;
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", key);
    const actorId = await requireCurrentCoffeeCapability(tx, context.session, ["canManageSettings"], "Not authorized to manage staff shifts");
    const storeId = await getPrimaryCoffeeStoreId(tx);
    const requestFingerprint = fingerprintInput({ purpose: "staff-shift-schedule", storeId, actorId, staffId: args.staffId, role: args.role, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), notes });
    const replay = await tx.staffShift.findUnique({ where: { idempotencyKey: key } });
    if (replay) {
      assertCoffeeStoreOwnership(replay.storeId, storeId, "Staff shift");
      const metadata = replay.metadata && typeof replay.metadata === "object" ? replay.metadata : {};
      if (metadata.requestFingerprint !== requestFingerprint) throw new Error("This shift request was already submitted with different details. Refresh the page and schedule the new shift again.");
      return replay;
    }
    const staff = await tx.user.findUnique({ where: { id: args.staffId }, select: { id: true, roleId: true, role: { select: { canAccessDashboard: true } } } });
    if (!staff?.role?.canAccessDashboard) throw new Error("Staff member is not authorized for the cafe dashboard");
    const shift = await tx.staffShift.create({
      data: {
        idempotencyKey: key,
        shiftNumber: shiftReference(key),
        storeId,
        staffId: args.staffId,
        role: args.role,
        status: "scheduled",
        startsAt,
        endsAt,
        notes,
        metadata: { scheduledBy: actorId, requestFingerprint }
      }
    });
    await recordCoffeeCommandReceipt(tx, {
      storeId,
      eventKey: `staff-shift:${String(shift.id)}:scheduled:v1`,
      eventType: "staff_shift.scheduled",
      aggregateType: "staff_shift",
      aggregateId: String(shift.id),
      payload: { shiftId: String(shift.id), shiftNumber: String(shift.shiftNumber), staffId: args.staffId, role: args.role, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() }
    });
    return shift;
  }, TX_OPTIONS12);
}
async function updateCoffeeStaffShiftStatus(_root, args, context) {
  requireStaffManager(context);
  const commandKey = scopedKey3(context, "staff-shift-transition", args.idempotencyKey);
  if (typeof args.staffShiftId !== "string" || !args.staffShiftId) throw new Error("Staff shift is required");
  if (!(args.status in STAFF_TRANSITIONS)) throw new Error("Unsupported staff shift status");
  const expectedStatus = args.expectedStatus ?? null;
  if (expectedStatus !== null && !(expectedStatus in STAFF_TRANSITIONS)) throw new Error("Unsupported expected staff shift status");
  const eventKey = `staff-shift-command:${commandKey}`;
  return context.prisma.$transaction(async (rawTx) => {
    const tx = rawTx;
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", eventKey);
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-staff-shift:${args.staffShiftId}`);
    const actorId = await requireCurrentCoffeeCapability(tx, context.session, ["canManageSettings"], "Not authorized to manage staff shifts");
    const storeId = await getPrimaryCoffeeStoreId(tx);
    const shift = await tx.staffShift.findUnique({ where: { id: args.staffShiftId } });
    if (!shift) throw new Error("Staff shift not found");
    assertCoffeeStoreOwnership(shift.storeId, storeId, "Staff shift");
    const requestFingerprint = fingerprintInput({ purpose: "staff-shift-transition", storeId, actorId, staffShiftId: args.staffShiftId, status: args.status, expectedStatus });
    const receipt = await tx.coffeeCommandReceipt.findUnique({ where: { eventKey } });
    if (receipt) {
      const payload = receipt.payload && typeof receipt.payload === "object" ? receipt.payload : {};
      if (receipt.storeId !== storeId || receipt.aggregateType !== "staff_shift" || receipt.aggregateId !== args.staffShiftId || payload.actorId !== actorId || payload.requestFingerprint !== requestFingerprint) {
        throw new Error("This shift action key was already used for a different shift change. Refresh and try again.");
      }
      return shift;
    }
    const current = String(shift.status || "");
    if (expectedStatus !== null && current !== expectedStatus) throw new Error(`This shift is now ${current.replaceAll("_", " ")}. Refresh before changing it.`);
    const transition = evaluateStaffShiftTransition(current, args.status);
    if (transition.replay) throw new Error(`This shift is already ${current.replaceAll("_", " ")}. Refresh to see its latest status.`);
    const now = /* @__PURE__ */ new Date();
    const updated = await tx.staffShift.update({
      where: { id: args.staffShiftId },
      data: {
        status: args.status,
        ...args.status === "clocked_in" ? { clockInAt: now } : {},
        ...args.status === "completed" ? { clockOutAt: now } : {}
      }
    });
    await recordCoffeeCommandReceipt(tx, {
      storeId,
      eventKey,
      eventType: "staff_shift.status_changed",
      aggregateType: "staff_shift",
      aggregateId: args.staffShiftId,
      occurredAt: now,
      payload: { shiftId: args.staffShiftId, previousStatus: current, status: args.status, occurredAt: now.toISOString(), actorId, requestFingerprint }
    });
    return updated;
  }, TX_OPTIONS12);
}
var import_node_crypto14, STAFF_ROLES2, STAFF_TRANSITIONS, INSTANT, TX_OPTIONS12;
var init_staffShiftOperations = __esm({
  "features/keystone/mutations/staffShiftOperations.ts"() {
    "use strict";
    import_node_crypto14 = require("node:crypto");
    init_access();
    init_coffeeCommandReceipt();
    init_coffeeKdsAuthority();
    init_idempotency();
    STAFF_ROLES2 = /* @__PURE__ */ new Set(["barista", "shift_lead", "kitchen", "manager"]);
    STAFF_TRANSITIONS = {
      scheduled: ["clocked_in", "missed"],
      clocked_in: ["completed"],
      completed: [],
      missed: []
    };
    INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
    TX_OPTIONS12 = { maxWait: 5e3, timeout: 1e4, isolationLevel: "Serializable" };
  }
});

// features/keystone/mutations/coffeeInventoryOperations.ts
function conflict2(error) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2034";
}
async function serializable2(context, operation) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await context.prisma.$transaction((rawTx) => operation(rawTx), TX_OPTIONS13);
    } catch (error) {
      if (!conflict2(error) || attempt === MAX_RETRIES) throw error;
    }
  }
  throw new Error("Inventory transaction retry limit exceeded");
}
function requireInventoryManager(context) {
  if (!permissions.canManageInventory({ session: context.session })) throw new Error("Not authorized to manage coffee inventory");
  return context.session?.itemId || "";
}
async function currentInventoryScope(tx, context) {
  const actorId = await requireCurrentCoffeeCapability(tx, context.session, ["canManageInventory"], "Not authorized to manage coffee inventory");
  const store = await tx.storeSetting.findUnique({ where: { singletonKey: "primary" }, select: { id: true, timezone: true } });
  if (!store) throw new Error("Primary coffee store is not configured");
  const timeZone = typeof store.timezone === "string" && validCoffeeTimezone(store.timezone) ? store.timezone : null;
  return { actorId, storeId: store.id, timeZone };
}
function scopedKey4(context, purpose, key) {
  const normalized = normalizeIdempotencyKey(key);
  if (!normalized) throw new Error(`${purpose} idempotency key is required`);
  return buildScopedIdempotencyKey(`${purpose}:${context.session?.itemId}`, normalized);
}
function reference2(prefix, key) {
  return `${prefix}-${(0, import_node_crypto15.createHash)("sha256").update(key).digest("hex").slice(0, 12).toUpperCase()}`;
}
function notesText(value) {
  const notes = typeof value === "string" ? value.trim() : "";
  if (notes.length > 500) throw new Error("Notes must be 500 characters or fewer");
  return notes;
}
function requiredId(value, label) {
  if (typeof value !== "string" || !value.trim() || value.length > 255) throw new Error(`${label} is required`);
  return value.trim();
}
function optionalInstant(value, label) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !INSTANT2.test(value)) throw new Error(`${label} must be a full date and time`);
  const instant2 = new Date(value);
  if (!Number.isFinite(instant2.getTime())) throw new Error(`${label} is not a valid date and time`);
  return instant2;
}
function storedFingerprint(row) {
  const metadata = row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata) ? row.metadata : {};
  return typeof metadata.requestFingerprint === "string" ? metadata.requestFingerprint : null;
}
function assertSameRequest(existing, storeId, requestFingerprint, label) {
  assertCoffeeStoreOwnership(existing.storeId, storeId, label);
  if (storedFingerprint(existing) !== requestFingerprint) {
    throw new Error(`This ${label.toLowerCase()} request was already submitted with different details. Refresh the page and submit the new details again.`);
  }
}
function allocationUnits(lots) {
  return [
    ...lots.allocations.map((allocation) => ({ inventoryLotId: allocation.inventoryLotId, units: stockUnits(allocation.quantity, "Allocated quantity") })),
    ...lots.untrackedQuantity > 0 ? [{ inventoryLotId: null, units: stockUnits(lots.untrackedQuantity, "Allocated quantity") }] : []
  ];
}
async function createCoffeePurchaseOrder(_root, args, context) {
  requireInventoryManager(context);
  const key = scopedKey4(context, "coffee-purchase-order", args.idempotencyKey);
  const supplierId = requiredId(args.supplierId, "Supplier");
  const inventoryItemId = requiredId(args.inventoryItemId, "Inventory item");
  const quantityUnits = stockUnits(args.orderedQuantity, "Ordered quantity");
  const unitCostCents = Number(args.unitCostCents);
  if (!Number.isSafeInteger(unitCostCents) || unitCostCents < 0 || unitCostCents > MAX_INT) throw new Error("Unit cost must be a non-negative amount in cents");
  const subtotalCents = stockCostCents(quantityUnits, unitCostCents);
  const expectedDate = args.expectedAt ? String(args.expectedAt) : null;
  if (expectedDate && !isBusinessDate(expectedDate)) throw new Error("Expected date must be a valid calendar date");
  const notes = notesText(args.notes);
  return serializable2(context, async (tx) => {
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", key);
    const { actorId, storeId, timeZone } = await currentInventoryScope(tx, context);
    const requestFingerprint = fingerprintInput({ purpose: "purchase-order", storeId, actorId, supplierId, inventoryItemId, quantityUnits, unitCostCents, expectedDate, notes });
    const existing = await tx.purchaseOrder.findUnique({ where: { idempotencyKey: key } });
    if (existing) {
      assertSameRequest(existing, storeId, requestFingerprint, "Purchase order");
      return existing;
    }
    const [supplier, inventoryItem] = await Promise.all([
      tx.supplier.findUnique({ where: { id: supplierId }, select: { id: true, storeId: true, status: true } }),
      tx.inventoryItem.findUnique({ where: { id: inventoryItemId }, select: { id: true, storeId: true, unit: true } })
    ]);
    if (!supplier || supplier.status !== "active") throw new Error("Purchase order supplier is not active");
    if (!inventoryItem) throw new Error("Purchase order inventory item was not found");
    assertCoffeeStoreOwnership(supplier.storeId, storeId, "Supplier");
    assertCoffeeStoreOwnership(inventoryItem.storeId, storeId, "Inventory item");
    const unit = String(inventoryItem.unit || "each");
    stockUnits(stockNumber(quantityUnits), "Ordered quantity", { unit });
    if (expectedDate && !timeZone) throw new Error("Set a valid store timezone before entering an expected date");
    const expectedAt = expectedDate && timeZone ? storeDayStart(expectedDate, timeZone) : null;
    const order = await tx.purchaseOrder.create({
      data: {
        idempotencyKey: key,
        storeId,
        poNumber: reference2("PO", key),
        supplierId,
        inventoryItemId,
        orderedQuantity: stockDecimal(quantityUnits),
        unitCostCents,
        status: "submitted",
        orderedAt: /* @__PURE__ */ new Date(),
        expectedAt,
        subtotalCents,
        notes,
        metadata: { requestFingerprint, createdById: actorId, unit, expectedDate }
      }
    });
    await recordCoffeeCommandReceipt(tx, {
      storeId,
      eventKey: `purchase-order:${String(order.id)}:submitted:v1`,
      eventType: "purchase_order.submitted",
      aggregateType: "purchase_order",
      aggregateId: String(order.id),
      payload: { purchaseOrderId: String(order.id), poNumber: String(order.poNumber), supplierId, inventoryItemId, quantity: stockNumber(quantityUnits), unit, unitCostCents, subtotalCents }
    });
    return order;
  });
}
async function receiveCoffeePurchaseOrder(_root, args, context) {
  requireInventoryManager(context);
  const purchaseOrderId = requiredId(args.purchaseOrderId, "Purchase order");
  const expiresAt = optionalInstant(args.expiresAt, "Lot expiry");
  return serializable2(context, async (tx) => {
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-po:${purchaseOrderId}`);
    const { actorId, storeId } = await currentInventoryScope(tx, context);
    const order = await tx.purchaseOrder.findUnique({
      where: { id: purchaseOrderId },
      include: { inventoryItem: true, supplier: true }
    });
    if (!order) throw new Error("Purchase order not found");
    assertCoffeeStoreOwnership(order.storeId, storeId, "Purchase order");
    const inventoryItem = order.inventoryItem;
    assertCoffeeStoreOwnership(inventoryItem?.storeId, storeId, "Purchase order inventory item");
    assertCoffeeStoreOwnership(order.supplier?.storeId, storeId, "Purchase order supplier");
    const existingLot = await tx.inventoryLot.findFirst({ where: { purchaseOrderId } });
    if (order.status === "received" && existingLot) {
      const recordedExpiry = existingLot.expiresAt ? new Date(existingLot.expiresAt).getTime() : null;
      if (recordedExpiry !== (expiresAt ? expiresAt.getTime() : null)) throw new Error("This purchase order was already received with a different expiry. Refresh to see the recorded lot.");
      return existingLot;
    }
    if (!canTransition(PURCHASE_ORDER_TRANSITIONS, String(order.status), "received") || existingLot) throw new Error(`Cannot receive purchase order with status ${String(order.status)}`);
    const inventoryItemId = String(order.inventoryItemId || "");
    if (!inventoryItemId) throw new Error("Purchase order has no inventory item");
    const quantityUnits = storedStockUnits(order.orderedQuantity);
    if (quantityUnits <= 0) throw new Error("Purchase order quantity is invalid");
    const now = /* @__PURE__ */ new Date();
    if (expiresAt && expiresAt.getTime() <= now.getTime()) throw new Error("Lot expiry must be after the receipt time. Record expired goods as waste instead of receiving them as usable stock.");
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-inventory:${inventoryItemId}`);
    const unit = String(inventoryItem?.unit || "each");
    const orderedUnit = order.metadata?.unit;
    if (typeof orderedUnit === "string" && orderedUnit !== unit) throw new Error("The inventory item's unit changed after this purchase order was placed; review the order before receiving it");
    const lot = await tx.inventoryLot.create({
      data: {
        lotNumber: reference2("LOT", String(order.idempotencyKey || order.id)),
        storeId,
        purchaseOrderId: String(order.id),
        inventoryItemId,
        supplierId: order.supplierId || null,
        quantityReceived: stockDecimal(quantityUnits),
        quantityRemaining: stockDecimal(quantityUnits),
        unitCostCents: Number(order.unitCostCents || 0),
        receivedAt: now,
        expiresAt,
        status: "active",
        metadata: { unit, receivedById: actorId, fullReceiptConfirmed: true, expiryRecorded: Boolean(expiresAt) }
      }
    });
    await tx.inventoryItem.update({ where: { id: inventoryItemId }, data: { currentStock: { increment: stockDecimal(quantityUnits) } } });
    const movement = await tx.stockMovement.create({
      data: { storeId, inventoryItemId, purchaseOrderId: String(order.id), inventoryLotId: String(lot.id), type: "received", quantity: stockDecimal(quantityUnits), reason: `Received ${String(order.poNumber)}`, createdById: actorId }
    });
    await tx.purchaseOrder.update({ where: { id: String(order.id) }, data: { status: "received", receivedAt: now } });
    await recordCoffeeCommandReceipt(tx, {
      storeId,
      eventKey: `purchase-order:${String(order.id)}:received:v1`,
      eventType: "purchase_order.received",
      aggregateType: "purchase_order",
      aggregateId: String(order.id),
      occurredAt: now,
      payload: { purchaseOrderId: String(order.id), lotId: String(lot.id), stockMovementId: String(movement.id), inventoryItemId, quantity: stockNumber(quantityUnits), unit, expiresAt: expiresAt ? expiresAt.toISOString() : null }
    });
    return lot;
  });
}
async function completeCoffeePrepBatch(_root, args, context) {
  requireInventoryManager(context);
  const key = scopedKey4(context, "coffee-prep-batch", args.idempotencyKey);
  const recipeId = requiredId(args.recipeId, "Recipe");
  const madeUnits = stockUnits(args.quantityMade, "Quantity made");
  const expiresAt = optionalInstant(args.expiresAt, "Prep expiry");
  const notes = notesText(args.notes);
  return serializable2(context, async (tx) => {
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", key);
    const { actorId, storeId } = await currentInventoryScope(tx, context);
    const requestFingerprint = fingerprintInput({ purpose: "prep-batch", storeId, actorId, recipeId, madeUnits, expiresAt: expiresAt ? expiresAt.toISOString() : null, notes });
    const existing = await tx.prepBatch.findUnique({ where: { idempotencyKey: key } });
    if (existing) {
      assertSameRequest(existing, storeId, requestFingerprint, "Prep batch");
      return existing;
    }
    const now = /* @__PURE__ */ new Date();
    if (expiresAt && expiresAt.getTime() <= now.getTime()) throw new Error("Prep expiry must be after the time the batch is completed");
    const recipe = await tx.recipe.findUnique({
      where: { id: recipeId },
      include: { from_Ingredient_recipe: { include: { inventoryItem: true } } }
    });
    if (!recipe || recipe.active !== true || recipe.status !== "active") throw new Error("Recipe is not active");
    assertCoffeeStoreOwnership(recipe.storeId, storeId, "Recipe");
    const yieldUnits = stockUnits(recipe.yieldQuantity, "Recipe yield");
    const outputUnit = String(recipe.yieldUnit || "").trim();
    if (!outputUnit) throw new Error("Recipe yield unit is required before prep");
    if (COUNTED_OUTPUT_UNITS2.has(outputUnit)) stockUnits(stockNumber(madeUnits), "Quantity made", { unit: "each" });
    const ingredients = Array.isArray(recipe.from_Ingredient_recipe) ? recipe.from_Ingredient_recipe : [];
    if (ingredients.length === 0) throw new Error("Recipe has no ingredients");
    const requiredByInventory = /* @__PURE__ */ new Map();
    const snapshot = [];
    for (const ingredient of ingredients) {
      if (ingredient.optional) continue;
      assertCoffeeStoreOwnership(ingredient.storeId, storeId, `Ingredient ${String(ingredient.name)}`);
      const inventory = ingredient.inventoryItem;
      if (!inventory) throw new Error(`Ingredient ${String(ingredient.name)} has no inventory item`);
      assertCoffeeStoreOwnership(inventory.storeId, storeId, `Inventory for ${String(ingredient.name)}`);
      const unit = String(inventory.unit || "each");
      if (String(ingredient.unit) !== unit) throw new Error(`Ingredient ${String(ingredient.name)} unit does not match inventory`);
      const ingredientUnits = stockUnits(ingredient.quantity, `Ingredient ${String(ingredient.name)} quantity`);
      const product = BigInt(ingredientUnits) * BigInt(madeUnits);
      const divisor = BigInt(yieldUnits);
      const two = BigInt(2);
      const units = Number((product * two + divisor) / (divisor * two));
      if (units <= 0) throw new Error(`Prep quantity for ${String(ingredient.name)} is below the 0.0001 ${unit} stock resolution; increase the batch size`);
      if (unit === "each" && units % STOCK_SCALE !== 0) throw new Error(`Prep would use a fraction of an item for ${String(ingredient.name)}; adjust the batch size`);
      const id = String(inventory.id);
      const existingRequirement = requiredByInventory.get(id);
      requiredByInventory.set(id, {
        id,
        unit,
        units: (existingRequirement?.units || 0) + units,
        name: existingRequirement ? `${existingRequirement.name}, ${String(ingredient.name)}` : String(ingredient.name)
      });
      snapshot.push({ ingredientId: String(ingredient.id), inventoryItemId: id, quantity: stockDecimal(ingredientUnits), unit });
    }
    const required = [...requiredByInventory.values()].sort((a, b) => a.id.localeCompare(b.id));
    if (required.length === 0) throw new Error("Recipe has no inventory-backed ingredients");
    for (const item of required) {
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-inventory:${item.id}`);
      const inventory = await tx.inventoryItem.findUnique({ where: { id: item.id }, select: { currentStock: true } });
      if (!inventory || storedStockUnits(inventory.currentStock) < item.units) throw new Error(`Insufficient inventory for ${item.name}`);
    }
    const batch = await tx.prepBatch.create({
      data: {
        idempotencyKey: key,
        storeId,
        batchNumber: reference2("BATCH", key),
        recipeId,
        status: "completed",
        preparedById: actorId,
        quantityMade: stockDecimal(madeUnits),
        quantityRemaining: stockDecimal(madeUnits),
        startedAt: now,
        completedAt: now,
        expiresAt,
        notes,
        // Frozen production facts: later recipe edits never change what this batch consumed or yields.
        metadata: {
          requestFingerprint,
          outputUnit,
          recipeSnapshot: { recipeId, name: String(recipe.name || ""), yieldQuantity: stockDecimal(yieldUnits), yieldUnit: outputUnit, ingredients: snapshot },
          consumption: required.map((item) => ({ inventoryItemId: item.id, quantity: stockDecimal(item.units), unit: item.unit }))
        }
      }
    });
    for (const item of required) {
      const stock = await tx.inventoryItem.findUnique({ where: { id: item.id }, select: { currentStock: true } });
      const lots = await consumeActiveInventoryLots(tx, item.id, stockNumber(item.units), { openingStock: stock?.currentStock ?? 0 });
      await tx.inventoryItem.update({ where: { id: item.id }, data: { currentStock: { decrement: stockDecimal(item.units) } } });
      for (const allocation of allocationUnits(lots)) await tx.stockMovement.create({
        data: { storeId, inventoryItemId: item.id, inventoryLotId: allocation.inventoryLotId, prepBatchId: String(batch.id), type: "sale", quantity: stockDecimal(-allocation.units), reason: `Prep batch ${String(batch.batchNumber)}`, createdById: actorId }
      });
    }
    await recordCoffeeCommandReceipt(tx, {
      storeId,
      eventKey: `prep-batch:${String(batch.id)}:completed:v1`,
      eventType: "prep_batch.completed",
      aggregateType: "prep_batch",
      aggregateId: String(batch.id),
      payload: { prepBatchId: String(batch.id), batchNumber: String(batch.batchNumber), recipeId, quantityMade: stockNumber(madeUnits), outputUnit, ingredients: required.map((item) => ({ inventoryItemId: item.id, quantity: stockNumber(item.units), unit: item.unit })) }
    });
    return batch;
  });
}
async function recordCoffeeWaste(_root, args, context) {
  requireInventoryManager(context);
  const key = scopedKey4(context, "coffee-waste", args.idempotencyKey);
  const quantityUnits = stockUnits(args.quantity, "Waste quantity");
  const inventoryItemId = args.inventoryItemId ? requiredId(args.inventoryItemId, "Inventory item") : null;
  const prepBatchId = args.prepBatchId ? requiredId(args.prepBatchId, "Prep batch") : null;
  if (Boolean(inventoryItemId) === Boolean(prepBatchId)) throw new Error("Waste must reference exactly one inventory item or prep batch");
  if (!WASTE_REASON_SET.has(args.reason)) throw new Error("Choose a waste reason: expired, damaged, overproduction or quality");
  const notes = notesText(args.notes);
  return serializable2(context, async (tx) => {
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", key);
    const { actorId, storeId } = await currentInventoryScope(tx, context);
    const requestFingerprint = fingerprintInput({ purpose: "waste", storeId, actorId, inventoryItemId, prepBatchId, quantityUnits, reason: args.reason, notes });
    const existing = await tx.wasteLog.findUnique({ where: { idempotencyKey: key } });
    if (existing) {
      assertSameRequest(existing, storeId, requestFingerprint, "Waste log");
      return existing;
    }
    let unit = "each";
    let costCents = 0;
    let allocations = [];
    if (inventoryItemId) {
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-inventory:${inventoryItemId}`);
      const inventory = await tx.inventoryItem.findUnique({ where: { id: inventoryItemId }, select: { storeId: true, currentStock: true, unit: true, costPerUnit: true } });
      if (!inventory) throw new Error("Inventory item not found");
      assertCoffeeStoreOwnership(inventory.storeId, storeId, "Inventory item");
      unit = String(inventory.unit || "each");
      stockUnits(stockNumber(quantityUnits), "Waste quantity", { unit });
      if (storedStockUnits(inventory.currentStock) < quantityUnits) throw new Error("Insufficient inventory to record waste");
      costCents = stockCostCents(quantityUnits, Number(inventory.costPerUnit || 0));
      const lots = await consumeActiveInventoryLots(tx, inventoryItemId, stockNumber(quantityUnits), { openingStock: inventory.currentStock, waste: true });
      allocations = allocationUnits(lots);
      await tx.inventoryItem.update({ where: { id: inventoryItemId }, data: { currentStock: { decrement: stockDecimal(quantityUnits) } } });
    } else if (prepBatchId) {
      await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-prep-batch:${prepBatchId}`);
      const batch = await tx.prepBatch.findUnique({ where: { id: prepBatchId }, include: { recipe: { select: { yieldUnit: true } } } });
      if (!batch) throw new Error("Prep batch not found");
      assertCoffeeStoreOwnership(batch.storeId, storeId, "Prep batch");
      const metadata = batch.metadata && typeof batch.metadata === "object" ? batch.metadata : {};
      unit = typeof metadata.outputUnit === "string" && metadata.outputUnit ? metadata.outputUnit : String(batch.recipe?.yieldUnit || "serving");
      if (COUNTED_OUTPUT_UNITS2.has(unit)) stockUnits(stockNumber(quantityUnits), "Waste quantity", { unit: "each" });
      const remaining = storedStockUnits(batch.quantityRemaining) - quantityUnits;
      if (remaining < 0) throw new Error("Insufficient prepared quantity to record waste");
      await tx.prepBatch.update({ where: { id: prepBatchId }, data: { quantityRemaining: stockDecimal(remaining), ...remaining === 0 ? { status: "discarded" } : {} } });
    }
    const waste = await tx.wasteLog.create({
      data: {
        idempotencyKey: key,
        storeId,
        logNumber: reference2("WASTE", key),
        inventoryItemId,
        prepBatchId,
        reason: args.reason,
        quantity: stockDecimal(quantityUnits),
        unit,
        costCents,
        loggedById: actorId,
        loggedAt: /* @__PURE__ */ new Date(),
        notes,
        metadata: { requestFingerprint }
      }
    });
    let stockMovementId = null;
    if (inventoryItemId) for (const allocation of allocations) {
      const movement = await tx.stockMovement.create({
        data: { storeId, inventoryItemId, inventoryLotId: allocation.inventoryLotId, wasteLogId: String(waste.id), type: "waste", quantity: stockDecimal(-allocation.units), reason: args.reason, notes, createdById: actorId }
      });
      stockMovementId = String(movement.id);
    }
    await recordCoffeeCommandReceipt(tx, {
      storeId,
      eventKey: `waste:${String(waste.id)}:recorded:v1`,
      eventType: "waste.recorded",
      aggregateType: "waste",
      aggregateId: String(waste.id),
      payload: { wasteId: String(waste.id), inventoryItemId, prepBatchId, stockMovementId, quantity: stockNumber(quantityUnits), unit, reason: args.reason, costCents }
    });
    return waste;
  });
}
async function recordCoffeeStockCount(_root, args, context) {
  requireInventoryManager(context);
  const key = scopedKey4(context, "coffee-stock-count", args.idempotencyKey);
  const inventoryItemId = requiredId(args.inventoryItemId, "Inventory item");
  const countedUnits = stockUnits(args.countedQuantity, "Counted quantity", { allowZero: true });
  const notes = notesText(args.notes);
  const eventKey = `stock-count:${(0, import_node_crypto15.createHash)("sha256").update(key).digest("hex")}`;
  return serializable2(context, async (tx) => {
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", key);
    const { actorId, storeId } = await currentInventoryScope(tx, context);
    const requestFingerprint = fingerprintInput({ purpose: "stock-count", storeId, actorId, inventoryItemId, countedUnits, notes });
    const receipt = await tx.coffeeCommandReceipt.findUnique({ where: { eventKey } });
    if (receipt) {
      const payload = receipt.payload && typeof receipt.payload === "object" ? receipt.payload : {};
      if (receipt.storeId !== storeId || receipt.aggregateId !== inventoryItemId || payload.requestFingerprint !== requestFingerprint) {
        throw new Error("This stock count request was already submitted with different details. Refresh the page and submit the new details again.");
      }
      const recorded = await tx.inventoryItem.findUnique({ where: { id: inventoryItemId } });
      if (!recorded) throw new Error("Inventory item not found");
      return recorded;
    }
    await tx.$executeRawUnsafe("SELECT pg_advisory_xact_lock(hashtext($1))", `coffee-inventory:${inventoryItemId}`);
    const inventory = await tx.inventoryItem.findUnique({ where: { id: inventoryItemId }, select: { storeId: true, currentStock: true, unit: true } });
    if (!inventory) throw new Error("Inventory item not found");
    assertCoffeeStoreOwnership(inventory.storeId, storeId, "Inventory item");
    const unit = String(inventory.unit || "each");
    stockUnits(stockNumber(countedUnits), "Counted quantity", { allowZero: true, unit });
    const { previousUnits, deltaUnits } = planStockCount(inventory.currentStock, countedUnits);
    const trimmedLots = await trimLotsToStock(tx, inventoryItemId, inventory.currentStock);
    const reason = "Stock count";
    const movementIds = [];
    if (deltaUnits !== 0) {
      const allocations = deltaUnits < 0 ? allocationUnits(await consumeActiveInventoryLots(tx, inventoryItemId, stockNumber(-deltaUnits), { openingStock: inventory.currentStock, waste: true })).map((allocation) => ({ ...allocation, units: -allocation.units })) : [{ inventoryLotId: null, units: deltaUnits }];
      for (const [index, allocation] of allocations.entries()) {
        const movement = await tx.stockMovement.create({
          data: { idempotencyKey: index === 0 ? key : `${key}:${index}`, storeId, inventoryItemId, inventoryLotId: allocation.inventoryLotId, type: "adjustment", quantity: stockDecimal(allocation.units), reason, notes, createdById: actorId }
        });
        movementIds.push(String(movement.id));
      }
      await tx.inventoryItem.update({ where: { id: inventoryItemId }, data: { currentStock: stockDecimal(countedUnits) } });
    }
    await recordCoffeeCommandReceipt(tx, {
      storeId,
      eventKey,
      eventType: "inventory.counted",
      aggregateType: "inventory_item",
      aggregateId: inventoryItemId,
      payload: { requestFingerprint, inventoryItemId, stockMovementIds: movementIds, previousQuantity: stockNumber(previousUnits), countedQuantity: stockNumber(countedUnits), adjustment: stockNumber(deltaUnits), unit, countedById: actorId, trimmedLots }
    });
    const updated = await tx.inventoryItem.findUnique({ where: { id: inventoryItemId } });
    if (!updated) throw new Error("Inventory item not found");
    return updated;
  });
}
var import_node_crypto15, TX_OPTIONS13, MAX_RETRIES, MAX_INT, WASTE_REASONS, WASTE_REASON_SET, COUNTED_OUTPUT_UNITS2, INSTANT2;
var init_coffeeInventoryOperations = __esm({
  "features/keystone/mutations/coffeeInventoryOperations.ts"() {
    "use strict";
    import_node_crypto15 = require("node:crypto");
    init_access();
    init_coffeeCommandReceipt();
    init_store_locale_policy();
    init_businessDate();
    init_transitionPolicy();
    init_coffeeKdsAuthority();
    init_idempotency();
    init_inventoryLots();
    TX_OPTIONS13 = { maxWait: 5e3, timeout: 1e4, isolationLevel: "Serializable" };
    MAX_RETRIES = 3;
    MAX_INT = 2147483647;
    WASTE_REASONS = ["expired", "damaged", "overproduction", "quality"];
    WASTE_REASON_SET = new Set(WASTE_REASONS);
    COUNTED_OUTPUT_UNITS2 = /* @__PURE__ */ new Set(["serving", "each"]);
    INSTANT2 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/;
  }
});

// features/keystone/mutations/index.ts
function extendGraphqlSchema(baseSchema) {
  return (0, import_schema.mergeSchemas)({
    schemas: [baseSchema],
    typeDefs: [graphql7`
      type Query {
        redirectToInit: Boolean
        getCafeGiftCardOptions: CafeGiftCardOptions!
        confirmCafeGiftCardOrder(giftCardId: ID!, token: String!): CafeGiftCardOrder!
        getCafeGiftCards(search: String): CafeGiftCardList!
        lookupCafeGiftCard(code: String!): CafeGiftCardView!
        getCafeOrder(orderId: ID!, secretKey: String): CafeOrderProjection
        getCafeLoyaltyAccount(email: String!, orderId: ID, secretKey: String): CafeLoyaltyProjection
        getCoffeeKdsRecoveryScope: CoffeeKdsRecoveryScope
        getCoffeeCustomerOrders(after: ID): CoffeeCustomerOrderPage!
        getCoffeeCustomerCatering: [CafeCateringReceipt!]!
        getCoffeeStore: CoffeeStorefrontSettings
        getCoffeeMenu(menuItemId: ID, search: String, categoryId: ID, after: String): CoffeeMenuProjection!
      }

      type Mutation {
        registerCoffeeCustomer(name: String!, email: String!, password: String!): Boolean!
        updateCoffeeCustomerProfile(name: String!, phone: String): Boolean!
        linkCoffeeCustomerLoyalty: Boolean!
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
          idempotencyKey: String
          receiptKey: String
          registerShiftId: ID
          tipCents: Int
          quoteFingerprint: String
          externalCardReference: String
          externalCardApproved: Boolean
          cashTenderedCents: Int
          items: [CafePickupOrderItemInput!]!
        ): CafeOrderReceipt!

        updateCafeOrderStatus(
          orderId: ID!
          status: String!
        ): CoffeeOrderStatusReceipt

        updateCafeOrderItemStatus(
          orderItemId: ID!
          status: String!
          expectedStatus: String!
          idempotencyKey: String!
        ): CoffeeKdsCommandReceipt!

        updateCateringOrderStatus(
          cateringOrderId: ID!
          status: String!
        ): CateringOrder

        requestCafeCatering(
          customerName: String!
          customerEmail: String!
          customerPhone: String
          eventAt: String!
          guestCount: Int!
          deliveryAddress: String
          notes: String
          idempotencyKey: String!
        ): CafeCateringReceipt!

        adjustCoffeeLoyaltyAccount(
          accountId: ID!
          pointsDelta: Int
          drinkCreditsDelta: Int
          status: String
          tier: String
          note: String!
          idempotencyKey: String!
        ): LoyaltyAccount

        cancelCoffeePurchaseOrder(
          purchaseOrderId: ID!
          reason: String
        ): PurchaseOrder!

        updateSubscriptionStatus(
          subscriptionId: ID!
          status: String!
        ): Subscription

        updatePosOrderStatus(
          posOrderId: ID!
          status: String!
        ): PosOrder

        applyCafeLoyalty(
          orderId: ID!
          secretKey: String
          customerEmail: String!
          customerName: String
          customerPhone: String
          redeemDrinkCredit: Boolean
        ): CafeLoyaltyProjection

        initiateCafePaymentSession(
          orderId: ID!
          secretKey: String
          paymentProvider: String!
          idempotencyKey: String
          returnUrl: String
        ): CafePaymentSessionResult

        refundCafePayment(
          paymentId: ID!
          amount: Int
          reason: String
          externalRefundReference: String
          idempotencyKey: String!
        ): CoffeePaymentReceipt

        acceptCafePickupOrder(
          orderId: ID!
          idempotencyKey: String!
        ): CafeOrder

        recordCafePayment(
          orderId: ID!
          method: String!
          idempotencyKey: String!
          externalCardReference: String
          externalCardApproved: Boolean
          giftCardCode: String
        ): CoffeePaymentReceipt

        startCafeGiftCardCheckout(
          amount: Int!
          purchaserName: String!
          purchaserEmail: String!
          recipientName: String
          recipientEmail: String
          message: String
          returnUrl: String!
          idempotencyKey: String!
        ): CafeGiftCardCheckout!

        refundCafeGiftCard(giftCardId: ID!, reason: String): CafeGiftCardView!

        handleCafePaymentWebhook(
          providerCode: String!
          rawBody: String!
          headers: JSON!
        ): CafePaymentWebhookResult!

        runCoffeeOnboarding(
          template: String!
          data: JSON
        ): CoffeeOnboardingResult!

        createCoffeePurchaseOrder(
          supplierId: ID!
          inventoryItemId: ID!
          orderedQuantity: Float!
          unitCostCents: Int!
          expectedAt: String
          notes: String
          idempotencyKey: String!
        ): PurchaseOrder!

        receiveCoffeePurchaseOrder(
          purchaseOrderId: ID!
          expiresAt: String
        ): InventoryLot!

        completeCoffeePrepBatch(
          recipeId: ID!
          quantityMade: Float!
          expiresAt: String
          notes: String
          idempotencyKey: String!
        ): PrepBatch!

        recordCoffeeWaste(
          inventoryItemId: ID
          prepBatchId: ID
          quantity: Float!
          reason: String!
          notes: String
          idempotencyKey: String!
        ): WasteLog!

        recordCoffeeStockCount(
          inventoryItemId: ID!
          countedQuantity: Float!
          notes: String
          idempotencyKey: String!
        ): InventoryItem!

        openRegisterShift(
          registerName: String!
          openingCashCents: Int!
          idempotencyKey: String!
        ): RegisterShift!

        recordRegisterCashMovement(
          registerShiftId: ID!
          type: String!
          amountCents: Int!
          reason: String!
          idempotencyKey: String!
        ): CashMovement!

        closeRegisterShift(
          registerShiftId: ID!
          countedCashCents: Int!
          idempotencyKey: String!
        ): RegisterShift!

        createCoffeeMenuCategory(
          name: String!
          description: String
          sortOrder: Int
          idempotencyKey: String!
        ): MenuCategory!

        createCoffeeMenuItem(
          name: String!
          price: Int!
          categoryId: ID
          barStation: String
          shortDescription: String
          prepTimeMinutes: Int
          idempotencyKey: String!
        ): MenuItem!

        updateCoffeeMenuItem(
          menuItemId: ID!
          name: String
          shortDescription: String
          categoryId: ID
          clearCategory: Boolean
          barStation: String
          prepTimeMinutes: Int
          price: Int
          available: Boolean
          featured: Boolean
          popular: Boolean
          expectedUpdatedAt: String
          idempotencyKey: String!
        ): MenuItem!

        createCoffeeMenuModifier(
          inventoryAction: String
          inventoryItemId: ID
          replacesInventoryItemId: ID
          inventoryQuantity: Float
          menuItemId: ID!
          name: String!
          modifierGroup: String!
          modifierGroupLabel: String
          priceAdjustment: Int!
          required: Boolean
          minSelections: Int
          maxSelections: Int
          defaultSelected: Boolean
          inStock: Boolean
          idempotencyKey: String!
        ): MenuItemModifier!

        updateCoffeeMenuModifier(
          inventoryAction: String
          inventoryItemId: ID
          replacesInventoryItemId: ID
          inventoryQuantity: Float
          modifierId: ID!
          name: String!
          modifierGroup: String!
          modifierGroupLabel: String
          priceAdjustment: Int!
          required: Boolean
          minSelections: Int
          maxSelections: Int
          defaultSelected: Boolean
          inStock: Boolean
          expectedUpdatedAt: String
          idempotencyKey: String!
        ): MenuItemModifier!

        updateCoffeeModifierStock(
          modifierId: ID!
          inStock: Boolean!
          expectedUpdatedAt: String
          idempotencyKey: String!
        ): MenuItemModifier!

        scheduleCoffeeStaffShift(
          staffId: ID!
          role: String!
          startsAt: String!
          endsAt: String!
          notes: String
          idempotencyKey: String!
        ): StaffShift!

        updateCoffeeStaffShiftStatus(
          staffShiftId: ID!
          status: String!
          expectedStatus: String
          idempotencyKey: String!
        ): StaffShift!
      }

      type CoffeePaymentOrder { id: ID! status: String }
      type CoffeePaymentReceipt {
        id: ID!
        status: String
        method: String
        amount: Int
        currencyCode: String
        provider: String
        providerPaymentId: String
        processedAt: String
        refundedAmount: Int
        refundedAt: String
        order: CoffeePaymentOrder
      }
      type CoffeeOrderStatusItem { id: ID! barStatus: String }
      type CoffeeOrderStatusReceipt {
        id: ID!
        orderNumber: String
        status: String
        startedAt: String
        readyAt: String
        completedAt: String
        orderItems: [CoffeeOrderStatusItem!]
      }
      type CoffeeKdsRecoveryScope { actorId: ID! storeId: ID! }
      type CoffeeKdsCommandOrder {
        id: ID!
        orderNumber: String!
        status: String!
        pickupName: String
        promisedAt: String
      }
      type CoffeeKdsCommandReceipt {
        id: ID!
        quantity: Int!
        itemNameSnapshot: String!
        customizationsSummary: String
        barStatus: String!
        station: String
        queuedAt: String
        startedAt: String
        readyAt: String
        handedOffAt: String
        idempotencyKey: String!
        expectedStatus: String!
        requestedStatus: String!
        actorId: ID!
        storeId: ID!
        order: CoffeeKdsCommandOrder!
      }
      type CoffeeCustomerOrder { id: ID!, orderNumber: String!, status: String!, total: Int!, currencyCode: String!, createdAt: DateTime! }
      type CoffeeCustomerOrderPage { orders: [CoffeeCustomerOrder!]!, nextCursor: ID }
      type CoffeeStorefrontSettings {
        name: String!
        tagline: String
        description: String
        address: String
        phone: String
        contactEmail: String
        currencyCode: String!
        locale: String!
        timezone: String!
        brandColor: String!
        logoIcon: String
        logoColor: String
        weeklyHours: JSON
        pickupLeadTimeMinutes: Int
        onlinePayment: Boolean!
      }

      type CoffeeOnboardingResult {
        status: String!
        storeSettings: Int!
        categories: Int!
        menuItems: Int!
        modifiers: Int!
        inventoryItems: Int!
        paymentProviders: Int!
        suppliers: Int!
        recipes: Int!
        ingredients: Int!
        purchaseOrders: Int!
        staffShifts: Int!
        loyaltyAccounts: Int!
        cateringOrders: Int!
      }

      type CafePaymentWebhookResult {
        success: Boolean!
        replayed: Boolean!
        paymentId: ID
        orderId: ID
      }

      type CafePaymentSessionResult {
        success: Boolean!
        paymentId: ID
        provider: String
        providerPaymentId: String
        status: String
        amount: Int
        checkoutUrl: String
        error: String
      }

      type CafeGiftCardOptions { online: Boolean! amounts: [Int!]! currencyCode: String! }
      type CafeGiftCardCheckout { success: Boolean! checkoutUrl: String }
      type CafeGiftCardOrder { status: String! amount: Int! currencyCode: String! recipientName: String recipientEmail: String code: String expiresAt: String }
      type CafeGiftCardView {
        id: ID! code: String! status: String! initialValue: Int! balance: Int! currencyCode: String!
        purchaserName: String recipientName: String recipientEmail: String activatedAt: String expiresAt: String canRefund: Boolean!
      }
      type CafeGiftCardList { outstandingCents: Int! activeCount: Int! cards: [CafeGiftCardView!]! }

      input CafePickupOrderItemInput {
        menuItemId: ID!
        quantity: Int!
        modifierIds: [ID!]
        specialInstructions: String
      }
    `, coffeeBoundaryTypeDefs],
    resolvers: {
      Query: {
        redirectToInit: redirectToInit_default,
        getCafeGiftCardOptions,
        confirmCafeGiftCardOrder,
        getCafeGiftCards,
        lookupCafeGiftCard,
        getCoffeeCustomerOrders,
        getCoffeeCustomerCatering,
        getCafeOrder,
        getCafeLoyaltyAccount,
        getCoffeeKdsRecoveryScope,
        getCoffeeStore,
        getCoffeeMenu,
        getCoffeeOrderQueue,
        getCoffeeKdsBoard,
        getCoffeeMenuManager,
        getCoffeeMenuInventoryOptions,
        getCoffeePosRegister,
        quoteCafeOrder,
        getCoffeeReports,
        getCoffeeOperations
      },
      Mutation: {
        registerCoffeeCustomer,
        updateCoffeeCustomerProfile,
        linkCoffeeCustomerLoyalty,
        createCafePickupOrder,
        updateCafeOrderStatus,
        updateCafeOrderItemStatus,
        updateCateringOrderStatus,
        requestCafeCatering,
        adjustCoffeeLoyaltyAccount,
        cancelCoffeePurchaseOrder,
        updateSubscriptionStatus,
        updatePosOrderStatus,
        applyCafeLoyalty,
        initiateCafePaymentSession,
        refundCafePayment,
        acceptCafePickupOrder,
        recordCafePayment,
        startCafeGiftCardCheckout,
        refundCafeGiftCard,
        handleCafePaymentWebhook,
        runCoffeeOnboarding,
        createCoffeePurchaseOrder,
        receiveCoffeePurchaseOrder,
        completeCoffeePrepBatch,
        recordCoffeeWaste,
        recordCoffeeStockCount,
        openRegisterShift,
        recordRegisterCashMovement,
        closeRegisterShift,
        createCoffeeMenuCategory,
        createCoffeeMenuItem,
        createCoffeeMenuModifier,
        updateCoffeeMenuItem,
        updateCoffeeMenuModifier,
        updateCoffeeModifierStock,
        scheduleCoffeeStaffShift,
        updateCoffeeStaffShiftStatus
      }
    }
  });
}
var import_schema, graphql7;
var init_mutations = __esm({
  "features/keystone/mutations/index.ts"() {
    "use strict";
    import_schema = require("@graphql-tools/schema");
    init_coffeeCustomerAccount();
    init_coffeeBoundarySchema();
    init_coffeeBoundaryQueries();
    init_redirectToInit();
    init_createCafePickupOrder();
    init_updateCafeOrderStatus();
    init_updateCafeOrderItemStatus();
    init_coffeeKdsAuthority();
    init_getCafeOrder();
    init_getCafeLoyaltyAccount();
    init_applyCafeLoyalty();
    init_linkCoffeeCustomerLoyalty();
    init_initiateCafePaymentSession();
    init_getCoffeeStore();
    init_getCoffeeMenu();
    init_updateCateringOrderStatus();
    init_coffeeCoverageCommands();
    init_updateSubscriptionStatus();
    init_updatePosOrderStatus();
    init_refundCafePayment();
    init_recordCafePayment();
    init_acceptCafePickupOrder();
    init_handleCafePaymentWebhook();
    init_runCoffeeOnboarding();
    init_giftCards();
    init_registerShiftOperations();
    init_staffShiftOperations();
    init_manageCoffeeMenu();
    init_coffeeInventoryOperations();
    graphql7 = String.raw;
  }
});

// features/keystone/lib/email-layout.ts
function storeNameFromEnv(fallback = "Coffee Shop") {
  const match = /^\s*"?([^"<]+?)"?\s*</.exec(process.env.SMTP_FROM || "");
  return match?.[1]?.trim() || fallback;
}
function emailButton(label, href) {
  return `<table role="presentation" border="0" cellspacing="0" cellpadding="0" style="margin:8px 0 24px;">
<tr><td class="em-btn" align="center" bgcolor="${C.button}" style="border-radius:8px;background:${C.button};">
<a class="em-btn-a" href="${escapeHtml(href)}" target="_blank" style="display:inline-block;padding:14px 28px;font-family:${FONT};font-size:16px;font-weight:600;line-height:20px;color:${C.buttonText};text-decoration:none;border-radius:8px;">${escapeHtml(label)}</a>
</td></tr></table>`;
}
function emailLayout(input) {
  const store = escapeHtml(input.storeName || storeNameFromEnv());
  const support = escapeHtml(input.supportEmail || SUPPORT_EMAIL);
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(input.title)}</title>
<style>
:root { color-scheme: light dark; supported-color-schemes: light dark; }
body { margin:0; padding:0; -webkit-text-size-adjust:100%; }
a { color:${C.link}; }
@media (max-width: 620px) { .em-pad { padding-left:20px !important; padding-right:20px !important; } }
@media (prefers-color-scheme: dark) {
  .em-canvas { background:#09090b !important; }
  .em-card { background:#18181b !important; border-color:#27272a !important; }
  .em-text { color:#fafafa !important; }
  .em-muted { color:#a1a1aa !important; }
  .em-line { border-color:#3f3f46 !important; }
  .em-panel { background:#27272a !important; border-color:#3f3f46 !important; color:#fafafa !important; }
  .em-btn { background:#fafafa !important; }
  .em-btn-a { color:#18181b !important; }
  .em-link { color:#fafafa !important; }
}
[data-ogsc] .em-text { color:#fafafa !important; }
[data-ogsc] .em-muted { color:#a1a1aa !important; }
[data-ogsb] .em-canvas { background:#09090b !important; }
[data-ogsb] .em-card { background:#18181b !important; }
</style>
</head>
<body class="em-canvas" style="margin:0;padding:0;background:${C.canvas};">
${input.preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all;">${escapeHtml(input.preheader)}</div>` : ""}
<table role="presentation" class="em-canvas" width="100%" border="0" cellspacing="0" cellpadding="0" bgcolor="${C.canvas}" style="background:${C.canvas};">
<tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;">
<tr><td class="em-pad" style="padding:8px 32px 20px;font-family:${FONT};font-size:18px;line-height:24px;font-weight:700;letter-spacing:-0.01em;"><span class="em-text" style="color:${C.text};">${store}</span></td></tr>
<tr><td class="em-card" bgcolor="${C.card}" style="background:${C.card};border:1px solid ${C.line};border-radius:12px;">
<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
<tr><td class="em-pad" style="padding:32px 32px 16px;">
<h1 class="em-text" style="margin:0 0 16px;font-family:${FONT};font-size:24px;line-height:32px;font-weight:700;letter-spacing:-0.02em;color:${C.text};">${escapeHtml(input.title)}</h1>
${input.body}
</td></tr>
</table>
</td></tr>
<tr><td class="em-pad" style="padding:20px 32px 8px;font-family:${FONT};font-size:13px;line-height:20px;color:${C.subtle};">
<span class="em-muted" style="color:${C.subtle};">${input.footerNote ? `${input.footerNote}<br>` : ""}Questions? Email <a class="em-link" href="mailto:${support}" style="color:${C.muted};text-decoration:underline;">${support}</a>.<br>${store}</span>
</td></tr>
</table>
</td></tr>
</table>
</body>
</html>`;
}
var SUPPORT_EMAIL, FONT, C, escapeHtml, p, emailParagraph, emailMuted;
var init_email_layout = __esm({
  "features/keystone/lib/email-layout.ts"() {
    "use strict";
    SUPPORT_EMAIL = "hello@coffee-shop.openship.org";
    FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";
    C = {
      canvas: "#f4f4f5",
      card: "#ffffff",
      text: "#18181b",
      muted: "#52525b",
      subtle: "#71717a",
      line: "#e4e4e7",
      panel: "#fafafa",
      button: "#18181b",
      buttonText: "#ffffff",
      link: "#18181b"
    };
    escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
    p = (html, style = "") => `<p class="em-text" style="margin:0 0 16px;font-family:${FONT};font-size:16px;line-height:24px;color:${C.text};${style}">${html}</p>`;
    emailParagraph = p;
    emailMuted = (html) => `<p class="em-muted" style="margin:0 0 16px;font-family:${FONT};font-size:14px;line-height:22px;color:${C.muted};">${html}</p>`;
  }
});

// features/keystone/context.ts
var context_exports = {};
__export(context_exports, {
  keystoneContext: () => keystoneContext
});
var import_context, PrismaModule, keystoneContext;
var init_context = __esm({
  "features/keystone/context.ts"() {
    "use strict";
    import_context = require("@keystone-6/core/context");
    init_keystone();
    PrismaModule = __toESM(require("@prisma/client"));
    keystoneContext = globalThis.keystoneContext ?? (0, import_context.getContext)(keystone_default, PrismaModule);
    globalThis.keystoneContext = keystoneContext;
  }
});

// features/keystone/lib/mail.ts
function getBaseUrlForEmails() {
  if (process.env.SMTP_STORE_LINK) {
    return process.env.SMTP_STORE_LINK;
  }
  console.warn("SMTP_STORE_LINK not set. Please add SMTP_STORE_LINK to your environment variables for email links to work properly.");
  return "";
}
function passwordResetEmail({ url }) {
  return emailLayout({
    preheader: "Use this link to choose a new password.",
    title: "Reset your password",
    body: `${emailParagraph("We received a request to reset the password for your account. Use the button below to choose a new one.")}
${emailButton("Reset password", url)}
${emailMuted("If you did not request this, you can safely ignore this email. Your password will not change.")}`
  });
}
async function sendPasswordResetEmail(resetToken, to, baseUrl) {
  const frontendUrl = baseUrl || getBaseUrlForEmails();
  const { keystoneContext: keystoneContext2 } = await Promise.resolve().then(() => (init_context(), context_exports));
  const user = await keystoneContext2.sudo().prisma.user.findUnique({
    where: { email: to },
    select: { role: { select: { canAccessDashboard: true } } }
  });
  const resetPath = user?.role?.canAccessDashboard ? "/dashboard/reset" : "/account/reset";
  const info = await transport.sendMail({
    to,
    from: process.env.SMTP_FROM,
    subject: "Your password reset token!",
    html: passwordResetEmail({
      url: `${frontendUrl}${resetPath}?token=${encodeURIComponent(resetToken)}`
    })
  });
  if (process.env.SMTP_USER?.includes("ethereal.email")) {
    console.log(`\u{1F4E7} Message Sent!  Preview it at ${(0, import_nodemailer.getTestMessageUrl)(info)}`);
  }
}
var import_nodemailer, transport;
var init_mail = __esm({
  "features/keystone/lib/mail.ts"() {
    "use strict";
    import_nodemailer = require("nodemailer");
    init_email_layout();
    transport = (0, import_nodemailer.createTransport)({
      // @ts-ignore
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASSWORD
      }
    });
  }
});

// features/keystone/lib/s3-storage.ts
function s3ForcePathStyle(endpoint2) {
  let hostname = "";
  try {
    hostname = endpoint2 ? new URL(endpoint2).hostname : "";
  } catch {
  }
  return !(hostname === "storageapi.dev" || hostname.endsWith(".storageapi.dev"));
}
var init_s3_storage = __esm({
  "features/keystone/lib/s3-storage.ts"() {
    "use strict";
  }
});

// features/keystone/database-url.ts
function pooledDatabaseUrl(url, role = "web") {
  if (!url || !/^postgres(ql)?:\/\//.test(url)) return url;
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.searchParams.has("connection_limit")) return url;
  const override = Number(process.env[OVERRIDE_ENV[role]]);
  parsed.searchParams.set("connection_limit", String(Number.isInteger(override) && override > 0 ? override : POOL_SIZES[role]));
  return parsed.toString();
}
var POOL_SIZES, OVERRIDE_ENV;
var init_database_url = __esm({
  "features/keystone/database-url.ts"() {
    "use strict";
    POOL_SIZES = { web: 15, worker: 5 };
    OVERRIDE_ENV = {
      web: "DATABASE_CONNECTION_LIMIT",
      worker: "DATABASE_CONNECTION_LIMIT_WORKER"
    };
  }
});

// features/keystone/lib/keystonePrismaErrors.ts
function isKeystonePrismaError(value) {
  return value instanceof Error && value.extensions?.code === "KS_PRISMA_ERROR";
}
function rethrowKeystonePrismaError(value) {
  if (!isKeystonePrismaError(value)) return value;
  const prisma = value.extensions.prisma ?? {};
  throw Object.assign(value, { code: prisma.code, meta: prisma.meta, clientVersion: prisma.clientVersion });
}
function throwing(result) {
  if (!result || typeof result.then !== "function") return rethrowKeystonePrismaError(result);
  const settled = () => result.then(rethrowKeystonePrismaError);
  return new Proxy(result, {
    get(target, key) {
      if (key === "then") return (ok, fail) => settled().then(ok, fail);
      if (key === "catch") return (fail) => settled().catch(fail);
      if (key === "finally") return (done) => settled().finally(done);
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    }
  });
}
function throwingDelegate(delegate) {
  const cached = delegates.get(delegate);
  if (cached) return cached;
  const wrapped = new Proxy(delegate, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? (...args) => throwing(value.apply(target, args)) : value;
    }
  });
  delegates.set(delegate, wrapped);
  return wrapped;
}
function throwKeystonePrismaErrors(client) {
  const cached = clients.get(client);
  if (cached) return cached;
  const wrapped = new Proxy(client, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      if (key === "$transaction" && typeof value === "function") {
        return (work, ...options) => {
          if (typeof work === "function") return value.call(target, (tx) => work(throwKeystonePrismaErrors(tx)), ...options);
          return Promise.resolve(value.call(target, work, ...options)).then((results) => Array.isArray(results) ? results.map(rethrowKeystonePrismaError) : results);
        };
      }
      if (key === "$extends" && typeof value === "function") return (...args) => throwKeystonePrismaErrors(value.apply(target, args));
      if (typeof key === "string" && RAW_METHOD.test(key) && typeof value === "function") return (...args) => throwing(value.apply(target, args));
      if (typeof value === "function") return value.bind(target);
      if (typeof key === "string" && !key.startsWith("$") && value && typeof value === "object" && typeof value.findFirst === "function") return throwingDelegate(value);
      return value;
    }
  });
  clients.set(client, wrapped);
  return wrapped;
}
var RAW_METHOD, clients, delegates;
var init_keystonePrismaErrors = __esm({
  "features/keystone/lib/keystonePrismaErrors.ts"() {
    "use strict";
    RAW_METHOD = /^\$(queryRaw|executeRaw|queryRawUnsafe|executeRawUnsafe|queryRawTyped|runCommandRaw)$/;
    clients = /* @__PURE__ */ new WeakMap();
    delegates = /* @__PURE__ */ new WeakMap();
  }
});

// features/keystone/index.ts
function productionEnv(name2, developmentFallback) {
  if (process.env[name2]) return process.env[name2];
  if (process.env.NODE_ENV === "production") {
    throw new Error(`${name2} is required in production`);
  }
  return developmentFallback;
}
var import_auth, import_core34, import_config, databaseURL, sessionSecret, sessionConfig, bucketName, region, accessKeyId, secretAccessKey, endpoint, withAuth, keystone_default;
var init_keystone = __esm({
  "features/keystone/index.ts"() {
    "use strict";
    import_auth = require("@keystone-6/auth");
    import_core34 = require("@keystone-6/core");
    import_config = require("dotenv/config");
    init_models();
    init_revocableSession();
    init_mutations();
    init_mail();
    init_s3_storage();
    init_database_url();
    init_keystonePrismaErrors();
    databaseURL = process.env.DATABASE_URL;
    if (!databaseURL) {
      throw new Error("DATABASE_URL is required");
    }
    sessionSecret = process.env.SESSION_SECRET;
    if (!sessionSecret || sessionSecret.length < 32) {
      throw new Error("SESSION_SECRET must be at least 32 characters long");
    }
    sessionConfig = {
      maxAge: 60 * 60 * 24 * 30,
      secret: sessionSecret
    };
    bucketName = productionEnv("S3_BUCKET_NAME", "keystone-test");
    region = productionEnv("S3_REGION", "ap-southeast-2");
    accessKeyId = productionEnv("S3_ACCESS_KEY_ID", "keystone");
    secretAccessKey = productionEnv("S3_SECRET_ACCESS_KEY", "keystone");
    endpoint = productionEnv("S3_ENDPOINT", "https://sfo3.digitaloceanspaces.com");
    ({ withAuth } = (0, import_auth.createAuth)({
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
    }));
    keystone_default = withAuth(
      (0, import_core34.config)({
        db: {
          provider: "postgresql",
          url: pooledDatabaseUrl(databaseURL),
          // Keystone returns failed queries as values; this makes them throw so transactions roll back.
          extendPrismaClient: throwKeystonePrismaErrors,
          extendPrismaSchema: (schema) => `${schema}

model GraphQLRateLimitBucket {
  bucketKey   String
  windowStart DateTime @postgresql.Timestamptz
  requestCount Int @default(0)
  costUnits    Int @default(0)
  expiresAt    DateTime @postgresql.Timestamptz

  @@id([bucketKey, windowStart])
  @@index([expiresAt])
}
`
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
            forcePathStyle: s3ForcePathStyle(endpoint)
          }
        },
        ui: {
          isAccessAllowed: ({ session }) => session?.data.role?.canAccessDashboard ?? false
        },
        session: revocableStatelessSessions(sessionConfig),
        graphql: {
          extendGraphqlSchema
        }
      })
    );
  }
});

// keystone.ts
var keystone_exports = {};
__export(keystone_exports, {
  default: () => keystone_default2
});
module.exports = __toCommonJS(keystone_exports);
init_keystone();
var keystone_default2 = keystone_default;
//# sourceMappingURL=config.js.map
