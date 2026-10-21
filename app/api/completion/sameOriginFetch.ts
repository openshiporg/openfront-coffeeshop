type FetchLike = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

function requestUrl(input: RequestInfo | URL) {
  if (input instanceof URL) return input;
  if (typeof input === "string") return new URL(input);
  return new URL(input.url);
}

function setCookieValues(headers: Headers) {
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const value = headers.get("set-cookie");
  return value ? [value] : [];
}

function cookiePair(setCookie: string) {
  return setCookie.split(";", 1)[0]?.trim() || "";
}

/** A request-local fetch for one MCP endpoint. It never mutates or wraps global fetch. */
export function createSameOriginMcpFetch(
  endpoint: URL,
  requestCookie: string,
  fetchImpl: FetchLike = fetch,
): FetchLike {
  const cookies = new Map<string, string>();

  for (const pair of requestCookie.split(";")) {
    const normalized = pair.trim();
    const separator = normalized.indexOf("=");
    if (separator > 0) cookies.set(normalized.slice(0, separator), normalized);
  }

  return async (input, init) => {
    const url = requestUrl(input);
    const isExactMcpEndpoint = url.origin === endpoint.origin && url.pathname === endpoint.pathname;
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));

    if (isExactMcpEndpoint && cookies.size > 0) {
      headers.set("cookie", [...cookies.values()].join("; "));
    } else {
      headers.delete("cookie");
      headers.delete("authorization");
    }

    const response = await fetchImpl(input, { ...init, headers });
    if (isExactMcpEndpoint) {
      for (const value of setCookieValues(response.headers)) {
        const pair = cookiePair(value);
        const separator = pair.indexOf("=");
        if (separator > 0) cookies.set(pair.slice(0, separator), pair);
      }
    }
    return response;
  };
}
