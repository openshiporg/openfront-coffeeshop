import { mergeSchemas } from "@graphql-tools/schema";
import { registerCoffeeCustomer, getCoffeeCustomerOrders, updateCoffeeCustomerProfile } from "./coffeeCustomerAccount";
import { coffeeBoundaryTypeDefs } from "./coffeeBoundarySchema";
import {
  getCoffeeKdsBoard,
  getCoffeeMenuInventoryOptions,
  getCoffeeMenuManager,
  getCoffeeOperations,
  getCoffeeOrderQueue,
  getCoffeePosRegister,
  getCoffeeReports,
  quoteCafeOrder,
} from "./coffeeBoundaryQueries";
import type { GraphQLSchema } from 'graphql';
import redirectToInit from "./redirectToInit";
import createCafePickupOrder from "./createCafePickupOrder";
import updateCafeOrderStatus from "./updateCafeOrderStatus";
import updateCafeOrderItemStatus from "./updateCafeOrderItemStatus";
import { getCoffeeKdsRecoveryScope } from "./coffeeKdsAuthority";
import getCafeOrder from "./getCafeOrder";
import getCafeLoyaltyAccount from "./getCafeLoyaltyAccount";
import applyCafeLoyalty from "./applyCafeLoyalty";
import initiateCafePaymentSession from "./initiateCafePaymentSession";
import getCoffeeStore from "./getCoffeeStore";
import getCoffeeMenu from "./getCoffeeMenu";
import updateCateringOrderStatus from "./updateCateringOrderStatus";
import updateSubscriptionStatus from "./updateSubscriptionStatus";
import updatePosOrderStatus from "./updatePosOrderStatus";
import refundCafePayment from "./refundCafePayment";
import recordCafePayment from "./recordCafePayment";
import acceptCafePickupOrder from "./acceptCafePickupOrder";
import handleCafePaymentWebhook from "./handleCafePaymentWebhook";
import runCoffeeOnboarding from "./runCoffeeOnboarding";
import {
  closeRegisterShift,
  openRegisterShift,
  recordRegisterCashMovement,
} from "./registerShiftOperations";
import { scheduleCoffeeStaffShift, updateCoffeeStaffShiftStatus } from "./staffShiftOperations";
import { createCoffeeMenuCategory, createCoffeeMenuItem, createCoffeeMenuModifier, updateCoffeeMenuItem, updateCoffeeMenuModifier, updateCoffeeModifierStock } from "./manageCoffeeMenu";
import {
  completeCoffeePrepBatch,
  createCoffeePurchaseOrder,
  receiveCoffeePurchaseOrder,
  recordCoffeeWaste,
} from "./coffeeInventoryOperations";

const graphql = String.raw;

export function extendGraphqlSchema(baseSchema: GraphQLSchema) {
  return mergeSchemas({
    schemas: [baseSchema],
    typeDefs: [graphql`
      type Query {
        redirectToInit: Boolean
        getCafeOrder(orderId: ID!, secretKey: String): CafeOrderProjection
        getCafeLoyaltyAccount(email: String!, orderId: ID, secretKey: String): CafeLoyaltyProjection
        getCoffeeKdsRecoveryScope: CoffeeKdsRecoveryScope
        getCoffeeCustomerOrders(after: ID): CoffeeCustomerOrderPage!
        getCoffeeStore: CoffeeStorefrontSettings
        getCoffeeMenu(menuItemId: ID, search: String, categoryId: ID, after: String): CoffeeMenuProjection!
      }

      type Mutation {
        registerCoffeeCustomer(name: String!, email: String!, password: String!): Boolean!
        updateCoffeeCustomerProfile(name: String!, phone: String): Boolean!
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
        ): CoffeePaymentReceipt

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
        error: String
      }

      input CafePickupOrderItemInput {
        menuItemId: ID!
        quantity: Int!
        modifierIds: [ID!]
        specialInstructions: String
      }
    `, coffeeBoundaryTypeDefs],
    resolvers: {
      Query: { 
        redirectToInit,
        getCoffeeCustomerOrders,
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
        getCoffeeOperations,
      },
      Mutation: {
        registerCoffeeCustomer,
        updateCoffeeCustomerProfile,
        createCafePickupOrder,
        updateCafeOrderStatus,
        updateCafeOrderItemStatus,
        updateCateringOrderStatus,
        updateSubscriptionStatus,
        updatePosOrderStatus,
        applyCafeLoyalty,
        initiateCafePaymentSession,
        refundCafePayment,
        acceptCafePickupOrder,
      recordCafePayment,
        handleCafePaymentWebhook,
        runCoffeeOnboarding,
        createCoffeePurchaseOrder,
        receiveCoffeePurchaseOrder,
        completeCoffeePrepBatch,
        recordCoffeeWaste,
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
        updateCoffeeStaffShiftStatus,
      },
    },
  });
}