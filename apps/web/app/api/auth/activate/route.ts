/**
 * Accepting an invitation or a password reset.
 *
 * Deliberately NOT under /api/[tenant]: the person following this link is not
 * signed in — that is the point of the link — so there is no session to resolve
 * a tenant from. It uses the deployment's own company, the same one the login
 * page authenticates against.
 *
 * Rate-limited on the same counter as the login form. A token is 32 random
 * bytes and guessing one is not a realistic attack, but an endpoint that runs a
 * database lookup and an scrypt hash for anybody who asks is worth a limit
 * regardless.
 */
import { defaultTenant } from "@/lib/access";
import { guarded, json } from "@/lib/api";
import { check, clientKey, recordFailure, recordSuccess } from "@/lib/rate-limit";
import { activate } from "@/lib/user-admin";

export const dynamic = "force-dynamic";

export async function POST(req: Request): Promise<Response> {
  return guarded(async () => {
    const keys = [`activate:${clientKey(req)}`];
    const verdict = check(keys);
    if (!verdict.allowed)
      return json({ error: "RATE_LIMITED", retryAfter: verdict.retryAfter }, 429);

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const token = String(body.token ?? "");
    const password = String(body.password ?? "");
    if (!token) {
      recordFailure(keys);
      return json({ error: "BAD_REQUEST", message: "That link is no longer valid." }, 400);
    }
    try {
      const { email } = await activate(defaultTenant(), token, password);
      recordSuccess(keys);
      return json({ email });
    } catch (e) {
      recordFailure(keys);
      throw e;
    }
  });
}
