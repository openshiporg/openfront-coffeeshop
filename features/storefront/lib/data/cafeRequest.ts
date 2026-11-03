import { ClientError, GraphQLClient } from "graphql-request";
import { getAuthHeaders } from "@/features/dashboard/lib/cookies";
import { getServerGraphQLTarget } from "@/features/dashboard/lib/getBaseUrl";
import { PUBLIC_REQUEST_ERROR } from "@/features/dashboard/lib/security";
import { CAFE_CUSTOMER_ERROR_CODE } from "@/features/keystone/lib/cafeCustomerError";

export type CafeResponse<T> = { success: true; data: T } | { success: false; error: string; customerMessage: string | null };

/** Like keystoneClient, but keeps the message of a rejection written for the customer
 *  (sold out, closed, at capacity). Every other failure stays generic. */
export async function cafeRequest<T>(query: string, variables: Record<string, unknown>): Promise<CafeResponse<T>> {
  try {
    // Built per request, so the signed identity is the CURRENT visitor's.
    const target = await getServerGraphQLTarget();
    const client = new GraphQLClient(target.endpoint, { credentials: "include", redirect: "error", ...(target.fetch ? { fetch: target.fetch } : {}), headers: (await getAuthHeaders()) || {} });
    return { success: true, data: await client.request<T>(query, variables) };
  } catch (error) {
    const customer = error instanceof ClientError
      ? error.response.errors?.find((entry) => entry.extensions?.code === CAFE_CUSTOMER_ERROR_CODE)
      : undefined;
    const customerMessage = typeof customer?.message === "string" ? customer.message : null;
    return { success: false, error: customerMessage || PUBLIC_REQUEST_ERROR, customerMessage };
  }
}
