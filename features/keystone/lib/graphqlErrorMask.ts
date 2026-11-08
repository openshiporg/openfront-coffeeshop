import { maskError } from "graphql-yoga";
import { GraphQLError } from "graphql";
import { constraintRefusal } from "./constraintRefusal";

// Production masks unexpected errors as "Unexpected error.". A refusal from our own command code is a plain
// `Error` written for staff ("Shift end must be after its start"), so it passes through tagged OPERATION_REFUSED
// and the dashboard shows it. Library and provider errors are subclasses (PrismaClient*, TypeError,
// ProviderError) or carry driver text, so they stay masked; their text is still in the server log.
const DRIVER_TEXT = /prisma|invocation|postgres|ECONN|ETIMEDOUT|socket|undefined|null\b.*\bread|stack|SELECT |INSERT |UPDATE |stripe|paypal|https?:\/\//i;
export function isGuardMessage(error: Error) {
  return error.constructor === Error && error.message.length > 0 && error.message.length <= 300 && !DRIVER_TEXT.test(error.message);
}

export function maskCoffeeError(error: unknown, message: string, isDev?: boolean) {
  const original = error instanceof GraphQLError ? error.originalError : error;
  // A database rule (CHECK, partial unique index) that refused the write, said in words.
  const refusal = constraintRefusal(original);
  const refused = refusal ?? (original instanceof Error && isGuardMessage(original) ? original.message : null);
  if (error instanceof GraphQLError && refused) {
    return new GraphQLError(refused, { nodes: error.nodes, source: error.source, positions: error.positions, path: error.path, extensions: { code: "OPERATION_REFUSED" } });
  }
  return maskError(error, message, isDev);
}
