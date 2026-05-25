import { mergeSchemas } from "@graphql-tools/schema";
import type { GraphQLSchema } from 'graphql';
import redirectToInit from "./redirectToInit";
import createCafePickupOrder from "./createCafePickupOrder";
import updateCafeOrderStatus from "./updateCafeOrderStatus";
import getCafeOrder from "./getCafeOrder";
import getCafeLoyaltyAccount from "./getCafeLoyaltyAccount";
import applyCafeLoyalty from "./applyCafeLoyalty";
import initiateCafePaymentSession from "./initiateCafePaymentSession";

const graphql = String.raw;

export function extendGraphqlSchema(baseSchema: GraphQLSchema) {
  return mergeSchemas({
    schemas: [baseSchema],
    typeDefs: graphql`
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
        redirectToInit,
        getCafeOrder,
        getCafeLoyaltyAccount,
      },
      Mutation: {
        createCafePickupOrder,
        updateCafeOrderStatus,
        applyCafeLoyalty,
        initiateCafePaymentSession,
      },
    },
  });
}