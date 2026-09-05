/**
 * The address the OUTSIDE WORLD reaches this server on.
 *
 * WHAT WAS WRONG. Activation links were built from `new URL(req.url).origin`.
 * Inside the container that is the address the process bound to — `0.0.0.0:3000`
 * — not the address anybody can type. So an administrator inviting a colleague
 * was handed
 *
 *     https://0.0.0.0:3000/activate?token=…
 *
 * to send over WhatsApp, which resolves to nothing on the recipient's phone.
 * The account was created, the token was valid, and the only way in was a link
 * that could not work.
 *
 * `login/route.ts` already carries half of this lesson — it redirects with a
 * relative path precisely because the reconstructed absolute one pointed at
 * `app:3000`. A relative path is not available here: an invitation link is
 * pasted into a message and must be absolute.
 *
 * WHERE THE TRUTH IS. Behind a TLS-terminating proxy the request the app sees
 * is plain HTTP against an internal name, so the only honest sources are the
 * proxy's own headers or explicit configuration:
 *
 *   1. `ERP_PUBLIC_URL` — set it and it wins, for the operator who needs to be
 *      certain what links will say without reading proxy configuration.
 *   2. `X-Forwarded-Host` / `X-Forwarded-Proto` — what Caddy sets in front of
 *      this app today, so the fix needs no new configuration to work.
 *   3. the `Host` header — right when the app is reached directly.
 *   4. `req.url` — the last resort, and the thing that was wrong.
 *
 * Only the first entry of a comma-separated forwarded header is read: a chain
 * of proxies appends, and the client-facing one is first.
 */

/**
 * Addresses that mean "this machine" and can never be sent to somebody else.
 *
 * Anchored at BOTH ends with an optional port. Half-anchored, `127\.` matched
 * the first four characters of `127.0.0.1` and then demanded a colon, so the
 * commonest loopback address of all read as a public one.
 */
const INTERNAL =
  /^(0\.0\.0\.0|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|localhost|\[?::1\]?|app|host\.docker\.internal)(:\d+)?$/i;

export function isInternalHost(host: string): boolean {
  return INTERNAL.test(host.trim());
}

const first = (v: string | null): string => (v || "").split(",")[0]?.trim() || "";

export function publicOrigin(req: Request): string {
  const configured = (process.env.ERP_PUBLIC_URL || "").trim();
  if (configured) return configured.replace(/\/+$/, "");

  const host = first(req.headers.get("x-forwarded-host")) || first(req.headers.get("host"));
  if (host && !isInternalHost(host)) {
    const proto =
      first(req.headers.get("x-forwarded-proto")) ||
      (new URL(req.url).protocol === "https:" ? "https" : "http");
    return `${proto}://${host}`;
  }
  return new URL(req.url).origin;
}

/**
 * True when the best origin we could find still cannot be sent to anybody.
 *
 * The caller uses this to say so on screen rather than handing over a link that
 * looks fine and resolves to nothing — which is exactly how this shipped.
 */
export function originIsReachable(origin: string): boolean {
  try {
    return !isInternalHost(new URL(origin).host);
  } catch {
    return false;
  }
}
