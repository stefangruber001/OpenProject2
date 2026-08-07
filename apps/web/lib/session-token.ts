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
 * server has nothing to delete. For two people on a pilot that is the right
 * trade; the mitigation is a short lifetime, and rotating SESSION_SECRET
 * invalidates every token everywhere, immediately.
 *
 * Web Crypto rather than node:crypto on purpose: this runs in middleware as well
 * as in route handlers, and middleware does not always get the Node runtime.
 */

/** Eight hours: a working day, so nobody is asked to sign in mid-job. */
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

export const SESSION_COOKIE = "canei_session";

interface Payload {
  /** Who. The email they signed in with. */
  sub: string;
  /** When this stops being true, seconds since the epoch. */
  exp: number;
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
): Promise<string> {
  const payload: Payload = { sub: email, exp: nowSeconds + SESSION_TTL_SECONDS };
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
): Promise<string | null> {
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
  return payload.sub;
}

/**
 * The Set-Cookie value for a session.
 *
 * HttpOnly so script cannot read it, SameSite=Lax so another site cannot cause
 * a request that carries it, Secure unless this is plain-HTTP local development
 * — a Secure cookie is silently dropped over http://localhost:3000 and the
 * resulting "login does nothing" is unpleasant to diagnose.
 */
export function sessionCookie(token: string, secure: boolean): string {
  return [
    `${SESSION_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : "",
    `Max-Age=${SESSION_TTL_SECONDS}`,
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
