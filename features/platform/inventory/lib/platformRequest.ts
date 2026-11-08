import { ClientError, GraphQLClient } from "graphql-request";

import { getAuthHeaders } from "@/features/dashboard/lib/cookies";
import { getServerGraphQLTarget } from "@/features/dashboard/lib/getBaseUrl";
import { PUBLIC_REQUEST_ERROR } from "@/features/dashboard/lib/security";
import { CAFE_CUSTOMER_ERROR_CODE } from "@/features/keystone/lib/cafeCustomerError";

export type PlatformResponse<T> = { success: true; data: T } | { success: false; error: string };

export const ACCESS_DENIED_MESSAGE = "You don't have permission to make this change.";

/** Pulls the hook messages out of Keystone's "You provided invalid data…\n  - List: message" text. */
export function validationMessages(message: string): string[] {
  return message
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("- "))
    .map((line) => line.slice(2).replace(/^[A-Za-z][\w.]*:\s*/, "").trim())
    .filter(Boolean);
}

/** Server-only GraphQL request for staff writes on generic lists. Keeps Keystone validation
 *  messages (written by our hooks) and cafe command refusals; every other failure stays generic. */
export async function platformRequest<T>(query: string, variables: Record<string, unknown> = {}): Promise<PlatformResponse<T>> {
  try {
    // Built per request, so the signed identity is the CURRENT visitor's.
    const target = await getServerGraphQLTarget();
    const client = new GraphQLClient(target.endpoint, { credentials: "include", redirect: "error", ...(target.fetch ? { fetch: target.fetch } : {}), headers: (await getAuthHeaders()) || {} });
    return { success: true, data: await client.request<T>(query, variables) };
  } catch (error) {
    if (error instanceof ClientError) {
      const errors = error.response.errors ?? [];
      const customer = errors.find((entry) => entry.extensions?.code === CAFE_CUSTOMER_ERROR_CODE || entry.extensions?.code === "OPERATION_REFUSED");
      if (customer && typeof customer.message === "string") return { success: false, error: customer.message };
      const validation = errors.find((entry) => entry.extensions?.code === "KS_VALIDATION_FAILURE");
      if (validation && typeof validation.message === "string") {
        const messages = validationMessages(validation.message);
        if (messages.length) return { success: false, error: messages.join(" ") };
      }
      if (errors.some((entry) => entry.extensions?.code === "KS_ACCESS_DENIED")) return { success: false, error: ACCESS_DENIED_MESSAGE };
    }
    return { success: false, error: PUBLIC_REQUEST_ERROR };
  }
}
