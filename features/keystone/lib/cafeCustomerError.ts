import { GraphQLError } from "graphql";

export const CAFE_CUSTOMER_ERROR_CODE = "CAFE_CUSTOMER_ERROR";

/** A rejection written for the customer (sold out, closed, at capacity). GraphQL errors pass the
 *  server's error masking, so the storefront can show this message instead of a generic one. */
export function cafeCustomerError(message: string) {
  return new GraphQLError(message, { extensions: { code: CAFE_CUSTOMER_ERROR_CODE } });
}
