/**
 * Signed session tokens.
 *
 * A cookie the browser can edit is not a session — it is a suggestion. So the
 * cookie carries who you are and when it stops being true, plus a signature the
 * server makes with a secret nobody else has. Change a byte of either and the
 * signature stops matching.
 *
 * WHY THERE IS NO SESSION TABLE. A signed token needs no storage, which means no
 * migration, no cleanup job, and no lookup on every request. The cost is that
 * signing out cannot invalidate a token that has already been issued — the
 * server has nothing to delete. For a handful of people on a pilot that is the
 * right trade, and rotating SESSION_SECRET invalidates every token everywhere,
 * immediately.
 *
 * That cost got LARGER when named sessions went from eight hours to thirty days
 * (below), and it is worth being straight about rather than leaving the old
 * "the mitigation is a short lifetime" standing next to a long one: a token
 * taken from a lost phone stays good until it expires or the secret is rotated.
 * Rotation is the lever, `ops/` is where it lives, and a real revocation list is
 * the thing to build if this ever outgrows a pilot.
 *
 * Web Crypto rather than node:crypto on purpose: this runs in middleware as well
 * as in route handlers, and middleware does not always get the Node runtime.
 */

/**
 * How long a session lasts, by how it was obtained.
 *
 * A named account gets thirty days, and the cookie is re-issued whenever it is
 * more than halfway through (see the middleware), so somebody who uses the
 * system regularly is never asked again. Eight hours sounded prudent and was
 * not: it meant signing in most mornings, on a phone, on a building site, which
 * is how people end up choosing a password short enough to type one-handed.
 * Length here buys a stronger password there.
 *
 * The shared link-and-password is deliberately much shorter. That credential is
 * handed to people outside the company to look at a real register; it should
 * stop working on its own, and a prospect being asked again the next day is the
 * point rather than a cost.
 */
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;
export const SHARED_TTL_SECONDS = 12 * 60 * 60;

/** The lifetime for a session of this kind. */
export function ttlFor(role: SessionRole): number {
  return role === "shared" ? SHARED_TTL_SECONDS : SESSION_TTL_SECONDS;
}

export const SESSION_COOKIE = "canei_session";

/**
 * How this session proved who it is.
 *
 * "staff" is a named account in ERP_USERS. "shared" is somebody who used the one
 * password handed out with the link. Both reach the same live data — the role
 * exists so the audit trail can say which of the two a change came from, which
 * is worth recording even when the permissions are identical.
 */
export type SessionRole = "staff" | "shared";

interface Payload {
  /** Who. The email they signed in with, or a shared-session label. */
  sub: string;
  /** When this stops being true, seconds since the epoch. */
  exp: number;
  /** Absent in tokens minted before roles existed — read as "staff". */
  role?: SessionRole;
  /**
   * When this token was issued, seconds since the epoch.
   *
   * This is what makes disabling somebody mean anything. There is no session
   * table to delete a row from, so each user carries a `sessionsValidFrom`
   * stamp instead and a token issued before it is refused. Moving that stamp
   * forward ends one person's sessions everywhere; rotating SESSION_SECRET,
   * the only lever that existed before, ends everybody's.
   *
   * Absent in tokens minted before this existed. Those read as issued at 0,
   * which means the first time anybody is disabled or resets a password, the
   * pre-existing tokens for THAT PERSON stop working — correct, and the safe
   * direction to be wrong in.
   */
  iat?: number;
}

export interface SessionClaims {
  sub: string;
  role: SessionRole;
  /** Unix seconds. Exposed so a caller can renew a session before it lapses. */
  exp: number;
  /** Unix seconds. 0 for a token minted before issue times were recorded. */
  iat: number;
}

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Built on an explicit ArrayBuffer rather than via Uint8Array.from, so the
// result is a plain byte array and not one that might be backed by shared
// memory. Web Crypto will not accept the latter, and the return type is left to
// inference precisely so that distinction survives.
function unb64url(s: string) {
  const padded = s.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  const out = new Uint8Array(new ArrayBuffer(raw.length));
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function key(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

/** Mint a token for someone who has just proved who they are. */
export async function signSession(
  email: string,
  secret: string,
  nowSeconds: number,
  role: SessionRole = "staff",
): Promise<string> {
  const payload: Payload = { sub: email, exp: nowSeconds + ttlFor(role), role, iat: nowSeconds };
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await key(secret), enc.encode(body));
  return `${body}.${b64url(new Uint8Array(sig))}`;
}

/**
 * The email inside a token, or null.
 *
 * Null for every failure — bad signature, expired, malformed, wrong shape. The
 * caller's response is the same in every case (send them to the login page), and
 * distinguishing them in the return type invites someone to treat "expired" as
 * "nearly valid".
 */
export async function readSession(
  token: string | undefined,
  secret: string,
  nowSeconds: number,
): Promise<SessionClaims | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  let ok = false;
  try {
    // subtle.verify rather than comparing strings: it does not leak, through
    // timing, how much of a forged signature was correct.
    ok = await crypto.subtle.verify("HMAC", await key(secret), unb64url(sig), enc.encode(body));
  } catch {
    return null; // Malformed base64 is a failed verification, not a crash.
  }
  if (!ok) return null;

  let payload: Payload;
  try {
    payload = JSON.parse(new TextDecoder().decode(unb64url(body))) as Payload;
  } catch {
    return null;
  }
  if (typeof payload?.sub !== "string" || !payload.sub) return null;
  if (typeof payload?.exp !== "number" || payload.exp <= nowSeconds) return null;
  // Absent means a token minted before roles existed, which was always a named
  // account. An unknown role is refused rather than assumed — guessing at a
  // value nobody wrote is how a typo becomes an authorisation decision.
  const role = payload.role === undefined ? "staff" : payload.role;
  if (role !== "staff" && role !== "shared") return null;
  const iat = typeof payload.iat === "number" && payload.iat >= 0 ? payload.iat : 0;
  return { sub: payload.sub, role, exp: payload.exp, iat };
}

/**
 * The Set-Cookie value for a session.
 *
 * HttpOnly so script cannot read it, SameSite=Lax so another site cannot cause
 * a request that carries it, Secure unless this is plain-HTTP local development
 * — a Secure cookie is silently dropped over http://localhost:3000 and the
 * resulting "login does nothing" is unpleasant to diagnose.
 */
export function sessionCookie(token: string, secure: boolean, role: SessionRole = "staff"): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
    // Must match the token's own expiry. If the cookie outlives the token the
    // browser keeps sending something the server already rejects, and the user
    // sees the login page with no explanation of why they were signed out.
    `Max-Age=${ttlFor(role)}`,
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearedCookie(secure: boolean): string {
  return [
    `${SESSION_COOKIE}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
    "Max-Age=0",
  ]
    .filter(Boolean)
    .join("; ");
}
