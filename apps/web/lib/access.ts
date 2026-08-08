/**
 * Who is signed in, and which company's books they are working on.
 *
 * There are two ways to be signed in, and the difference is only how you proved
 * it — not what you may then do:
 *
 *   NAMED    An account in ERP_USERS. The audit trail carries their address.
 *
 *   SHARED   The one password in ERP_ACCESS_PASSWORD, handed out with the link
 *            so an owner or operator evaluating the system can sign in on their
 *            own laptop without anybody creating them an account first.
 *
 * BOTH REACH THE LIVE DATA. That is the point: what is being shown is the real
 * system, not a sample of it. It also means a shared-password session can change
 * and delete real records, so the two things that make it safe are operational
 * rather than technical — take a backup before a session, and rotate
 * ERP_ACCESS_PASSWORD (or SESSION_SECRET) afterwards. See
 * docs/PILOT-WITHOUT-CLOUDFLARE.md.
 *
 * The role is still carried on the session, because the audit trail should say
 * whether a change came from a named colleague or from somebody holding the
 * shared password. That distinction is worth keeping even when the permissions
 * are identical.
 *
 * THE `~` TENANT. The workspace is one static file served to everybody, so it
 * cannot have a company baked into it. It asks for `~`, meaning "the company
 * this deployment is for", resolved here. It is not a real tenant id and cannot
 * collide with one — tenant ids are slugs.
 */
import { SESSION_COOKIE, readSession, type SessionRole } from "./session-token";

/** The alias the workspace asks for when it does not name a company. */
export const SELF_TENANT = "~";

export interface Session {
  /** The name written into the audit trail. */
  user: string;
  role: SessionRole;
}

/** The company this deployment is for. */
export function defaultTenant(): string {
  return process.env.ERP_DEFAULT_TENANT?.trim() || "diorka";
}

/** Whether the shared link-and-password route is switched on. */
export function sharedAccessEnabled(): boolean {
  return Boolean(process.env.ERP_ACCESS_PASSWORD?.trim());
}

function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const raw = part.trim();
    const i = raw.indexOf("=");
    if (i > 0 && raw.slice(0, i) === name) return raw.slice(i + 1);
  }
  return undefined;
}

/**
 * The session on this request, or null when no login is configured at all.
 *
 * Null rather than an exception keeps the single-seat deployment working: no
 * accounts, no cookie, one operator named in configuration. `requireUser`
 * remains the thing that refuses to write without an identity.
 */
export async function sessionFrom(req: Request): Promise<Session | null> {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret) return null;
  const token = readCookie(req.headers.get("cookie"), SESSION_COOKIE);
  const claims = await readSession(token, secret, Math.floor(Date.now() / 1000));
  return claims ? { user: claims.sub, role: claims.role } : null;
}

/** Turn the company in a URL into a concrete one, resolving the `~` alias. */
export function resolveTenant(param: string): string {
  return param === SELF_TENANT ? defaultTenant() : param;
}

/** Convenience for route handlers. */
export async function tenantFor(_req: Request, param: string): Promise<string> {
  return resolveTenant(param);
}
