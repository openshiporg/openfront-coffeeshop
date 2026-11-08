/** A failure reported by a payment provider. Its text is the provider's (Stripe/PayPal wording, request
 *  ids), so it is a subclass: the GraphQL route only passes plain `Error` refusals through to staff,
 *  and this one stays masked as "Unexpected error." while its text is kept in the server log. */
export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderError";
  }
}
