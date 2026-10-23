// Browsers and crawlers still request /favicon.ico; the store icon is the SVG in public/.
// A relative Location keeps the redirect on the public host behind a proxy.
export function GET() {
  return new Response(null, { status: 308, headers: { Location: "/favicon.svg" } });
}
