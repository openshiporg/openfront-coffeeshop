import { ClientError, GraphQLClient } from "graphql-request";
import { getAuthHeaders } from "@/features/dashboard/lib/cookies";
import { getGraphQLEndpoint } from "@/features/dashboard/lib/getBaseUrl";
import { PUBLIC_REQUEST_ERROR } from "@/features/dashboard/lib/security";
import { validationMessages } from "./recipeMath";

export type RecipeResponse<T> = { success: true; data: T } | { success: false; error: string };

const ACCESS_DENIED = "Your role can't change recipes.";

/** Like keystoneClient, but keeps Keystone validation messages (written for the operator by the
 *  Recipe and Ingredient hooks) and reports access denial. Every other failure stays generic. */
export async function recipeRequest<T>(query: string, variables: Record<string, unknown> = {}): Promise<RecipeResponse<T>> {
  try {
    const client = new GraphQLClient(await getGraphQLEndpoint(), { credentials: "include", redirect: "error", headers: (await getAuthHeaders()) || {} });
    return { success: true, data: await client.request<T>(query, variables) };
  } catch (error) {
    const errors = error instanceof ClientError ? error.response.errors ?? [] : [];
    const messages = errors
      .filter((entry) => entry.extensions?.code === "KS_VALIDATION_FAILURE" && typeof entry.message === "string")
      .flatMap((entry) => validationMessages(entry.message));
    if (messages.length) return { success: false, error: [...new Set(messages)].join(". ") };
    if (errors.some((entry) => entry.extensions?.code === "KS_ACCESS_DENIED")) return { success: false, error: ACCESS_DENIED };
    return { success: false, error: PUBLIC_REQUEST_ERROR };
  }
}
