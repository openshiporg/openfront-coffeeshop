import { ClientError, GraphQLClient } from "graphql-request";
import { getAuthHeaders } from "@/features/dashboard/lib/cookies";
import { getGraphQLEndpoint } from "@/features/dashboard/lib/getBaseUrl";
import { PUBLIC_REQUEST_ERROR } from "@/features/dashboard/lib/security";
import { CAFE_CUSTOMER_ERROR_CODE } from "@/features/keystone/lib/cafeCustomerError";

export type CafeResponse<T> = { success: true; data: T } | { success: false; error: string; customerMessage: string | null };

/** Like keystoneClient, but keeps the message of a rejection written for the customer
 *  (sold out, closed, at capacity). Every other failure stays generic. */
export async function cafeRequest<T>(query: string, variables: Record<string, unknown>): Promise<CafeResponse<T>> {
  try {
    const client = new GraphQLClient(await getGraphQLEndpoint(), { credentials: "include", redirect: "error", headers: (await getAuthHeaders()) || {} });
    return { success: true, data: await client.request<T>(query, variables) };
  } catch (error) {
    const customer = error instanceof ClientError
      ? error.response.errors?.find((entry) => entry.extensions?.code === CAFE_CUSTOMER_ERROR_CODE)
      : undefined;
    const customerMessage = typeof customer?.message === "string" ? customer.message : null;
    return { success: false, error: customerMessage || PUBLIC_REQUEST_ERROR, customerMessage };
  }
}
