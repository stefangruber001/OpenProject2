/**
 * The lock on the door.
 *
 * Every request goes through here before it reaches a page, a workspace file or
 * an API route. Without a valid session the answer is a redirect to the login
 * page, or a 401 for anything under /api.
 *
 * DEFAULT DENY. The list below is what may be reached *without* signing in, and
 * it is short. Everything not on it is protected, including routes added
 * tomorrow by somebody who has never read this file — which is the only way a
 * lock stays locked. The opposite arrangement, a list of protected paths, fails
 * open every time somebody forgets to add to it.
 *
 * When sign-in is not configured, this does nothing. That is deliberate: the
 * single-seat deployment reachable only over an SSH tunnel has no accounts and
 * needs none, and a middleware that redirected to a login page nobody can use
 * would take it down. `lib/session.ts` is what refuses to write without an
 * identity, in every mode.
 */
import { NextResponse, type NextRequest } from "next/server";
import {
  SESSION_COOKIE,
  readSession,
  sessionCookie,
  signSession,
  ttlFor,
} from "@/lib/session-token";

// Node rather than Edge: this reads process.env, and the rest of the app is
// Node anyway. Web Crypto is available in both, so the token check itself would
// work either way.
export const config = {
  runtime: "nodejs",
  // Static assets and the Next.js build output are excluded here rather than in
  // code, so protected requests are the only ones that pay for a check.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

/** Reachable without signing in. Keep this list as short as it is now. */
function isPublic(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/api/auth/login" ||
    pathname === "/api/auth/logout" ||
    // Health is how the machine checks itself, from inside, with no browser and
    // no cookie. It reports whether the process is up and the database is
    // reachable — it exposes no company data.
    pathname === "/api/health" ||
    // The link preview. WhatsApp and Slack fetch the page and its image with no
    // session at all, so an image behind the login produces a card with no
    // thumbnail — the exact symptom this is here to avoid. Nothing under
    // /brand/ is company data; it is a logo and a picture of a logo.
    pathname.startsWith("/brand/")
  );
}

export async function middleware(req: NextRequest) {
  const secret = process.env.SESSION_SECRET?.trim();
  // Either named accounts or the shared password means this deployment has a
  // login. Checking only ERP_USERS would have left a server reached purely
  // through the shared link — no named accounts, password set — with the lock
  // switched off entirely and every page served to anyone who found the address.
  const anyLogin =
    Boolean(process.env.ERP_USERS?.trim()) || Boolean(process.env.ERP_ACCESS_PASSWORD?.trim());

  // Not a login-protected deployment. Nothing to enforce.
  if (!secret || !anyLogin) return NextResponse.next();

  const { pathname, search } = req.nextUrl;
  if (isPublic(pathname)) return NextResponse.next();

  const now = Math.floor(Date.now() / 1000);
  const claims = await readSession(req.cookies.get(SESSION_COOKIE)?.value, secret, now);
  // Signed in, by either route. Both reach the same live data — the difference
  // between a named account and the shared password is recorded in the audit
  // trail, not enforced here.
  if (claims) {
    const res = NextResponse.next();
    // Sliding renewal: past the halfway mark, mint a fresh token. Someone who
    // keeps using the system is therefore never signed out, while somebody who
    // stops still expires on schedule. Without this a fixed expiry logs people
    // out mid-job on a fixed date no matter how active they are — and being
    // logged out while standing on a building site is what makes people pick a
    // password they can type one-handed.
    const remaining = claims.exp - now;
    if (remaining > 0 && remaining < ttlFor(claims.role) / 2) {
      const fresh = await signSession(claims.sub, secret, now, claims.role);
      res.headers.append(
        "Set-Cookie",
        sessionCookie(fresh, req.nextUrl.protocol === "https:", claims.role),
      );
    }
    return res;
  }

  // An API caller gets a status code it can act on. Redirecting one to an HTML
  // login page produces the classic "unexpected token < in JSON" instead of
  // something a client can recognise as "sign in again".
  if (pathname.startsWith("/api/")) {
    return NextResponse.json(
      {
        error: "UNAUTHENTICATED",
        message: "Not signed in, or the session has expired. Reload the page to sign in again.",
      },
      { status: 401 },
    );
  }

  const to = req.nextUrl.clone();
  to.pathname = "/login";
  to.search = "";
  // Where they were going, so signing in lands them there instead of the home
  // page. Only ever a path on this site — see the check in the login route.
  to.searchParams.set("next", pathname + search);
  return NextResponse.redirect(to);
}
