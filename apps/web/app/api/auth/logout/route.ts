/**
 * Signing out.
 *
 * Clears the cookie. Worth being honest about what that does and does not do:
 * the token itself stays valid until it expires, because there is no session
 * store to delete it from (see `lib/session-token.ts`). Clearing the cookie
 * ends the session on this device, which is what "sign out" means to the person
 * pressing it. To end every session everywhere — a lost phone — rotate
 * SESSION_SECRET on the server.
 *
 * POST only. A GET would let any page on the internet sign somebody out by
 * including an image pointing at this URL.
 */
import { clearedCookie } from "@/lib/session-token";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const secure = proto ? proto === "https" : new URL(req.url).protocol === "https:";
  // Relative Location: behind a TLS-terminating proxy, a URL rebuilt from
  // req.url points at the internal http:// address of the container.
  const res = new Response(null, { status: 303, headers: { Location: "/login" } });
  res.headers.append("Set-Cookie", clearedCookie(secure));
  return res;
}
