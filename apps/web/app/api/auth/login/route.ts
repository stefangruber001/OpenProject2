/**
 * Signing in.
 *
 * Accepts the login form, checks the password, and sets the session cookie.
 * Answers with a redirect so it works from a plain HTML form — no JavaScript
 * needed, which keeps the login page working in the phone app's web view even
 * if something else on the page fails to load.
 */
import { isSharedPassword, loginConfigured } from "@/lib/auth";
import { defaultTenant, sharedAccessEnabled } from "@/lib/access";
import { authenticateUser } from "@/lib/user-admin";
import { safeReturnPath } from "@/lib/return-path";
import { sessionCookie, signSession } from "@/lib/session-token";
import { check, clientKey, recordFailure, recordSuccess } from "@/lib/rate-limit";
import { randomUUID } from "node:crypto";

export const dynamic = "force-dynamic";

/**
 * Where to send somebody after they sign in.
 *
 * Only a path on this site. Without this check, `?next=https://evil.example`
 * turns our login page into a convincing way to hand somebody to a site of
 * one's choosing — they signed in at the real address, so the redirect is
 * trusted. The shared validator also closes the two slash-shaped cases this
 * file's own copy missed nothing by but the language switch's did:
 * protocol-relative `//evil.example`, and `/\evil.example` — a backslash after
 * the first slash IS a second slash to every browser's URL parser, which
 * matters precisely because these redirects are relative and the browser is
 * the one resolving them.
 */
const safeNext = safeReturnPath;

function isSecureRequest(req: Request): boolean {
  // Behind a TLS-terminating proxy the connection to the app is plain HTTP, so
  // the proxy's header is the only evidence the browser used HTTPS.
  const proto = req.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  if (proto) return proto === "https";
  return new URL(req.url).protocol === "https:";
}

/**
 * Redirect to a path, never to a reconstructed absolute URL.
 *
 * Behind a TLS-terminating proxy the request the application sees is plain HTTP
 * against an internal name, so `new URL(path, req.url)` produces
 * `http://app:3000/…` — which is where the browser then goes. A relative
 * Location is resolved by the browser against the address it actually used, and
 * is explicitly allowed. It also cannot be tricked into pointing off-site.
 */
function redirect(path: string, extraHeaders: [string, string][] = []): Response {
  const res = new Response(null, { status: 303, headers: { Location: path } });
  for (const [k, v] of extraHeaders) res.headers.append(k, v);
  return res;
}

function back(params: Record<string, string>): Response {
  const q = new URLSearchParams(params).toString();
  return redirect(`/login${q ? `?${q}` : ""}`);
}

export async function POST(req: Request): Promise<Response> {
  if (!loginConfigured()) {
    return Response.json(
      {
        error: "CONFIG_INVALID",
        message: "Sign-in is not configured on this server (ERP_USERS and SESSION_SECRET).",
      },
      { status: 500 },
    );
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return back({ error: "1" });
  }
  const email = String(form.get("email") ?? "");
  const password = String(form.get("password") ?? "");
  const next = safeNext(String(form.get("next") ?? "/"));

  // Slow an automated attempt. Counted against the network address AND the
  // address being tried, because either alone has a hole: by-email lets one
  // password be sprayed across many accounts, by-network locks out a whole
  // office when one person forgets their password.
  const keys = [`ip:${clientKey(req)}`, `email:${email.trim().toLowerCase() || "(shared)"}`];
  const verdict = check(keys);
  if (!verdict.allowed) {
    // Refused before the password is checked, so a locked-out attacker cannot
    // even measure how long the check took.
    return back({
      error: "rate",
      retry: String(verdict.retryAfter),
      ...(next !== "/" ? { next } : {}),
    });
  }

  // The shared password, with no address at all — that is the whole point: a
  // link and a password, nothing to set up per person. Reachable only when no
  // address was typed, so somebody with a named account never falls into a
  // shared session by mistyping their own password.
  if (!email.trim() && sharedAccessEnabled() && isSharedPassword(password)) {
    // A short random label per session. Several people use one password, and an
    // audit trail reading "invitado" twelve times cannot be followed;
    // "invitado-4f2a" at least tells one tester's changes from another's.
    recordSuccess(keys);
    const label = `invitado-${randomUUID().slice(0, 4)}`;
    const token = await signSession(
      label,
      process.env.SESSION_SECRET!.trim(),
      Math.floor(Date.now() / 1000),
      "shared",
    );
    return redirect(next, [["Set-Cookie", sessionCookie(token, isSecureRequest(req), "shared")]]);
  }

  // Rows first, environment second — otherwise an account created through the
  // screen can be invited, can set a password, and still cannot sign in.
  const who = await authenticateUser(defaultTenant(), email, password);
  if (!who) {
    recordFailure(keys);
    // One message for both "no such account" and "wrong password". Which one it
    // was is exactly what somebody guessing wants to learn.
    return back({ error: "1", ...(next !== "/" ? { next } : {}) });
  }
  recordSuccess(keys);

  const token = await signSession(
    who,
    process.env.SESSION_SECRET!.trim(),
    Math.floor(Date.now() / 1000),
    "staff",
  );
  return redirect(next, [["Set-Cookie", sessionCookie(token, isSecureRequest(req), "staff")]]);
}
