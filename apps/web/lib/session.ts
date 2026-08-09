/**
 * Who is acting.
 *
 * Every mutating engine method takes the acting user as its final argument and
 * writes it to `state.audit`. On a system that will hold tax records, that name
 * has to be a person, and it has to come from the server — a name in a request
 * body is a claim, not an identity.
 *
 * There are two modes, and which one is live is decided by configuration, never
 * by the request:
 *
 *   PUBLISHED  CF_ACCESS_TEAM_DOMAIN + CF_ACCESS_AUD are set. An identity
 *              provider sits in front of the application and every request
 *              carries a signed assertion of who signed in. That signature is
 *              verified here, and the email inside it is the acting user.
 *
 *   LOGIN      ERP_USERS + SESSION_SECRET are set. The application has its own
 *              accounts and its own signed session cookie — no third party
 *              involved, no domain required. The acting user is whoever the
 *              cookie says, once its signature checks out.
 *
 *   SINGLE-SEAT  None of the above. There is no login, the application is
 *              reachable only over a tunnel from one machine, and the single
 *              operator is named in configuration. Honest while it is true.
 *
 * Both modes fail closed. What is NOT acceptable is defaulting to "system" or ""
 * and producing an audit trail that reads as if nobody did anything.
 *
 * WHY THE SIGNATURE IS CHECKED RATHER THAN THE HEADER READ. The proxy also
 * forwards a plain email header, and reading it would be four lines instead of
 * this file. But a header is only trustworthy if the request cannot have come
 * from anywhere else, and "the application is only reachable through the proxy"
 * is a deployment fact, not an enforced one — one published port, one added
 * network, one future migration, and every request can name whoever it likes as
 * the author of an invoice. The assertion is signed by the identity provider
 * and verified against its published keys, so it holds regardless of how the
 * request arrived.
 */
import { createPublicKey, createVerify, timingSafeEqual } from "node:crypto";
import { FactoryError } from "@repo/kernel";
import { SESSION_COOKIE, readSession } from "./session-token";

/**
 * One cookie out of a Cookie header.
 *
 * Split on ";" and take everything after the FIRST "=" — a session token is
 * base64url and contains none, but writing `split("=")[1]` here is how a value
 * that ever does contain one gets silently truncated into an invalid signature.
 */
function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const raw = part.trim();
    const i = raw.indexOf("=");
    if (i > 0 && raw.slice(0, i) === name) return raw.slice(i + 1);
  }
  return undefined;
}

/** Claims this application cares about. Everything else in the token is ignored. */
interface AccessClaims {
  email?: string;
  aud?: string | string[];
  iss?: string;
  exp?: number;
  nbf?: number;
}

interface Jwk {
  kid?: string;
  kty?: string;
  alg?: string;
}

function unauthenticated(reason: string): FactoryError {
  // The reason is deliberately coarse. A precise one ("signature invalid" vs
  // "wrong audience") tells an attacker which half of a forgery attempt worked.
  return new FactoryError(
    "UNAUTHENTICATED",
    "Not signed in, or the session has expired. Reload the page to sign in again.",
    { reason },
  );
}

function b64urlToBuffer(part: string): Buffer {
  return Buffer.from(part.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function decodeJson(part: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(b64urlToBuffer(part).toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw unauthenticated("token segment is not an object");
  }
  return parsed as Record<string, unknown>;
}

/**
 * The identity provider's public keys, cached.
 *
 * Cached because otherwise every single ERP command makes an outbound HTTPS
 * request before it can do anything, and the provider being briefly unreachable
 * would take the ERP down with it. Refreshed on an unknown key id as well as on
 * expiry, so a key rotation is picked up immediately rather than after the TTL.
 */
const KEYS_TTL_MS = 60 * 60 * 1000;
let keyCache: { keys: Jwk[]; fetchedAt: number } | null = null;

async function jwks(teamDomain: string, force: boolean): Promise<Jwk[]> {
  const fresh = keyCache && Date.now() - keyCache.fetchedAt < KEYS_TTL_MS;
  if (keyCache && fresh && !force) return keyCache.keys;

  const url = `https://${teamDomain}/cdn-cgi/access/certs`;
  let body: unknown;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    body = await res.json();
  } catch (cause) {
    // Serving stale keys beats refusing every write because a key server
    // blipped. They are public signing keys; an hour-old copy still proves the
    // signature. Only when there is no copy at all is this fatal.
    if (keyCache) return keyCache.keys;
    throw new FactoryError(
      "CONFIG_INVALID",
      `Cannot reach the identity provider's key set at ${url}: ${String(cause)}`,
    );
  }

  const keys =
    body && typeof body === "object" && Array.isArray((body as { keys?: unknown }).keys)
      ? ((body as { keys: Jwk[] }).keys ?? [])
      : [];
  if (keys.length === 0) {
    throw new FactoryError("CONFIG_INVALID", `The key set at ${url} contains no keys.`);
  }
  keyCache = { keys, fetchedAt: Date.now() };
  return keys;
}

function verifySignature(token: string, jwk: Jwk): boolean {
  const [header, payload, signature] = token.split(".");
  try {
    const key = createPublicKey({ key: jwk as never, format: "jwk" });
    return createVerify("RSA-SHA256")
      .update(`${header}.${payload}`)
      .verify(key, b64urlToBuffer(signature!));
  } catch {
    // A malformed key or signature is a failed verification, not a crash.
    return false;
  }
}

function audienceMatches(aud: AccessClaims["aud"], expected: string): boolean {
  const list = aud === undefined ? [] : Array.isArray(aud) ? aud : [aud];
  const want = Buffer.from(expected);
  return list.some((a) => {
    const got = Buffer.from(String(a));
    return got.length === want.length && timingSafeEqual(got, want);
  });
}

async function identityFromAssertion(
  req: Request,
  teamDomain: string,
  audience: string,
): Promise<string> {
  const token = req.headers.get("cf-access-jwt-assertion")?.trim();
  if (!token) throw unauthenticated("no assertion on the request");

  const parts = token.split(".");
  if (parts.length !== 3) throw unauthenticated("assertion is not a three-part token");

  const header = decodeJson(parts[0]!);
  // Pinned to RS256. Accepting whatever the token names is how "alg: none" and
  // the HMAC-with-the-public-key confusion get in — the algorithm is a property
  // of how this deployment is configured, not something a caller may choose.
  if (header.alg !== "RS256") throw unauthenticated(`unexpected algorithm ${String(header.alg)}`);

  const kid = typeof header.kid === "string" ? header.kid : "";
  let keys = await jwks(teamDomain, false);
  let key = keys.find((k) => k.kid === kid);
  if (!key) {
    // Unknown key id almost always means a rotation since the last fetch.
    keys = await jwks(teamDomain, true);
    key = keys.find((k) => k.kid === kid);
  }
  if (!key) throw unauthenticated("assertion signed by an unknown key");
  if (!verifySignature(token, key)) throw unauthenticated("signature did not verify");

  const claims = decodeJson(parts[1]!) as AccessClaims;

  // Audience binds the token to THIS application. Without it, a token minted for
  // any other application behind the same identity provider would be accepted
  // here — a valid signature is not the same as permission to be in this system.
  if (!audienceMatches(claims.aud, audience)) throw unauthenticated("wrong audience");

  const expectedIssuer = `https://${teamDomain}`;
  if (claims.iss !== expectedIssuer) throw unauthenticated("wrong issuer");

  const now = Math.floor(Date.now() / 1000);
  if (typeof claims.exp !== "number" || claims.exp <= now) throw unauthenticated("expired");
  if (typeof claims.nbf === "number" && claims.nbf > now + 60)
    throw unauthenticated("not yet valid");

  const email = claims.email?.trim();
  if (!email) throw unauthenticated("assertion carries no email");
  return email;
}

/**
 * The acting user for this request.
 *
 * Async because verifying a signature may need the provider's key set. Takes the
 * request because identity is a property of the request, not of the process —
 * that distinction is the entire difference between one seat and several.
 */
export async function requireUser(req: Request): Promise<string> {
  const teamDomain = process.env.CF_ACCESS_TEAM_DOMAIN?.trim();
  const audience = process.env.CF_ACCESS_AUD?.trim();

  // Half-configured is refused rather than quietly downgraded. A deployment that
  // meant to require login and lost one variable would otherwise fall back to
  // the single-seat name and keep serving, with every change in the audit trail
  // attributed to somebody who was not there.
  if (Boolean(teamDomain) !== Boolean(audience)) {
    throw new FactoryError(
      "CONFIG_INVALID",
      "Sign-in is half-configured: CF_ACCESS_TEAM_DOMAIN and CF_ACCESS_AUD must " +
        "both be set, or neither. Refusing to fall back to a single shared " +
        "operator name while one of them is present.",
    );
  }

  if (teamDomain && audience) return identityFromAssertion(req, teamDomain, audience);

  // Our own login. Checked here as well as in middleware, not instead of it:
  // middleware is a route-matching rule and this is the thing that actually
  // stamps a name onto a stored record. A future route excluded from the
  // matcher by accident must not become a way to write anonymously.
  const secret = process.env.SESSION_SECRET?.trim();
  // Either named accounts or the shared password counts as "sign-in is
  // configured" — a deployment reached only through the shared link has no
  // named accounts at all, and must still refuse anonymous writes.
  const usersConfigured =
    Boolean(process.env.ERP_USERS?.trim()) || Boolean(process.env.ERP_ACCESS_PASSWORD?.trim());
  if (Boolean(secret) !== usersConfigured) {
    throw new FactoryError(
      "CONFIG_INVALID",
      "Sign-in is half-configured: SESSION_SECRET must be set alongside ERP_USERS " +
        "or ERP_ACCESS_PASSWORD, and vice versa. Refusing to fall back to a single " +
        "shared operator name while one of them is present.",
    );
  }
  if (secret && usersConfigured) {
    const cookie = readCookie(req.headers.get("cookie"), SESSION_COOKIE);
    const claims = await readSession(cookie, secret, Math.floor(Date.now() / 1000));
    if (!claims) throw unauthenticated("no valid session cookie");

    // A valid signature is not the whole question. Somebody disabled an hour
    // ago still holds a perfectly well-signed token — for a named account, for
    // up to thirty days. Being able to disable them has to mean something while
    // they are already signed in, or it only stops them signing in AGAIN, which
    // is not what anybody means by the word.
    //
    // Shared sessions have no account behind them, so there is nothing to check
    // and they are left alone; ERP_ACCESS_PASSWORD is the lever for those.
    if (claims.role === "staff") {
      const { sessionStillValid } = await import("./user-admin");
      const { defaultTenant } = await import("./access");
      const ok = await sessionStillValid(defaultTenant(), claims.sub, claims.iat).catch(
        // A database that cannot be reached must not lock everybody out of a
        // system that worked five minutes ago. The signature was still valid;
        // fall back to trusting it, and let the outage be an outage rather than
        // a lockout.
        () => true,
      );
      if (!ok) throw unauthenticated("this account is no longer active");
    }
    return claims.sub;
  }

  const operator = process.env.ERP_OPERATOR?.trim();
  if (!operator) {
    throw new FactoryError(
      "CONFIG_INVALID",
      "No operator identity. Set ERP_OPERATOR to the name of the person using " +
        "this server, so every change is attributable. Anonymous writes to an " +
        "invoice register are not something this API will do.",
    );
  }
  return operator;
}
