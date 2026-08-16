/**
 * Where a redirect is allowed to send the browser: a path on this site, ever.
 *
 * This is the "?next=" validator, in one place, because it existed in three —
 * the login route, the login page and the language switch each had their own
 * copy of `startsWith("/") && !startsWith("//")` — and all three shared the
 * same hole: `"/\\evil.com"` passes that test, and the WHATWG URL parser (which
 * is to say every browser) treats a backslash after the first slash exactly
 * like a second slash, so a relative `Location: /\evil.com` resolves to
 * `https://evil.com/`. Measured, not recalled:
 *
 *     new URL("/\\evil.com", "https://good.example/").href
 *     → "https://evil.com/"
 *
 * The rule became reachable when redirects here went RELATIVE — which they must
 * be: this app lives behind a TLS-terminating proxy, and a route handler that
 * rebuilds an absolute URL from `req.url` gets the container's own bind address
 * (`https://0.0.0.0:3000/login`, photographed on a phone). A relative Location
 * is resolved by the browser against the address it actually used, so it is
 * right under any proxy — and this validator is what keeps "relative" meaning
 * "this site".
 */
export function safeReturnPath(raw: unknown): string {
  const p = typeof raw === "string" ? raw : "";
  // One leading slash, then neither slash nor backslash: rejects "" (not a
  // path), "https://evil" (no leading slash), "//evil" (scheme-relative), and
  // "/\evil" (backslash — the same thing to a browser).
  return /^\/(?![/\\])/.test(p) ? p : "/";
}
