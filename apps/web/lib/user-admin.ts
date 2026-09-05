/**
 * Managing accounts: create, change, disable, invite, activate.
 *
 * The rules that stop this becoming a hole live HERE rather than in the route
 * handlers, because there are five handlers and one set of rules, and a rule
 * enforced in four places out of five is not a rule.
 *
 * WHAT THE ENVIRONMENT VARIABLE STILL DOES. `ERP_USERS` remains readable, as the
 * bootstrap: a server with no rows must still let somebody in to create the
 * first account. Those accounts are admin and active, because they are the
 * people who held the keys before there was a screen. A row always wins over an
 * environment entry for the same address, so migrating somebody is a matter of
 * creating them properly and deleting a line from `.env` — in that order, never
 * the other way round.
 */
import { randomBytes } from "node:crypto";
import { FactoryError } from "@repo/kernel";
import * as db from "@repo/db";
import { hashPassword } from "./auth";
import {
  hashToken,
  isRole,
  mintToken,
  roleMay,
  toView,
  wouldOrphanAdmins,
  envUsers,
  type UserRecord,
  type UserRole,
  type UserView,
} from "./users";

function store(tenantId: string) {
  return new db.PrismaUserStore(db.prisma, tenantId);
}

function fromRow(r: {
  email: string;
  name: string;
  role: string;
  state: string;
  hash: string;
  sessionsValidFrom: Date;
  createdAt: Date;
  createdBy: string;
  disabledAt: Date | null;
}): UserRecord {
  return {
    email: r.email,
    name: r.name,
    // A role or state that is not one we know is read as the most restrictive
    // thing it could be. Guessing generously at a value nobody wrote is how a
    // typo in a database becomes an authorisation decision.
    role: isRole(r.role) ? r.role : "gestoria",
    state: r.state === "active" || r.state === "invited" ? r.state : "disabled",
    hash: r.hash,
    sessionsValidFrom: r.sessionsValidFrom,
    createdAt: r.createdAt,
    createdBy: r.createdBy,
    disabledAt: r.disabledAt,
  };
}

/**
 * Everybody who may sign in to this company, rows and environment together.
 *
 * Rows win on a clash, so an account properly created through the screen
 * supersedes the `.env` line it replaces without anybody having to get the
 * order of two edits right.
 */
export async function allUsers(tenantId: string): Promise<UserRecord[]> {
  let rows: UserRecord[] = [];
  try {
    rows = (await store(tenantId).list()).map(fromRow);
  } catch {
    // No database configured, or it is unreachable. The environment accounts
    // are then the only way in, and refusing to fall back would lock the
    // company out of their own system over an outage in a feature they may
    // not even use yet.
    rows = [];
  }
  const seen = new Set(rows.map((u) => u.email));
  return [...rows, ...envUsers().filter((u) => !seen.has(u.email))];
}

/**
 * THE SINGLE-SEAT OPERATOR IS THE ADMINISTRATOR OF THEIR OWN SERVER.
 *
 * A deployment with no accounts and no shared password has one identity:
 * `ERP_OPERATOR`, the name `requireUser` stamps on every record so the audit
 * trail is attributable. That person has no row and no environment account, so
 * `findUser` used to answer null for them — which was harmless while nothing
 * asked, and became a lockout the moment the command runner started asking.
 * They could not record an invoice on a server that is entirely theirs.
 *
 * Narrow on purpose. It applies ONLY when sign-in is not configured at all, so
 * it can never widen a deployment that does have accounts: there,
 * `requireUser` returns whoever the session cookie names and never this value.
 */
function singleSeatOperator(): UserRecord | null {
  const operator = process.env.ERP_OPERATOR?.trim();
  if (!operator) return null;
  const configured =
    Boolean(process.env.ERP_USERS?.trim()) || Boolean(process.env.ERP_ACCESS_PASSWORD?.trim());
  if (configured && process.env.SESSION_SECRET?.trim()) return null;
  const epoch = new Date(0);
  return {
    email: operator.trim().toLowerCase(),
    name: operator,
    role: "admin",
    state: "active",
    // No password: there is nothing to sign in to. This record exists to answer
    // "what may they do", not "is this them" — that question was already
    // settled by the configuration itself.
    hash: "",
    sessionsValidFrom: epoch,
    createdAt: epoch,
    createdBy: "env",
    disabledAt: null,
  };
}

/** The one user, or null. */
export async function findUser(tenantId: string, email: string): Promise<UserRecord | null> {
  const wanted = email.trim().toLowerCase();
  const found = (await allUsers(tenantId)).find((u) => u.email === wanted);
  if (found) return found;
  const solo = singleSeatOperator();
  return solo && solo.email === wanted ? solo : null;
}

/**
 * May this person do this?
 *
 * Unknown address → no. That covers a shared-password session, which has no
 * account behind it and must never manage users: it is a credential handed to
 * people outside the company to look at a real register.
 */
export async function may(tenantId: string, email: string, permission: string): Promise<boolean> {
  const u = await findUser(tenantId, email);
  if (!u || u.state !== "active") return false;
  return roleMay(u.role, permission);
}

/** Throws unless they may. */
export async function require_(tenantId: string, email: string, permission: string): Promise<void> {
  if (!(await may(tenantId, email, permission)))
    throw new FactoryError("UNAUTHENTICATED", `You do not have permission to ${permission}.`);
}

export interface Invitation {
  /** The address to send, or to copy when no mail can leave. */
  link: string;
  /** Where the temporary password is typed: the sign-in page. */
  loginUrl: string;
  /**
   * A password that works right now, or "" when this account could not be given
   * one (an `ERP_USERS` bootstrap account has no row to write it to).
   */
  tempPassword: string;
  expiresAt: string;
  /** False when `email-out@1` has no real adapter and nothing was actually sent. */
  delivered: boolean;
}

/**
 * A temporary password somebody can read off a screen and type on a phone.
 *
 * Three groups of four from an alphabet with no `O/0`, `I/l/1` or `S/5`: the
 * characters that get read back wrong are exactly the ones that turn "the
 * password does not work" into a support call. 33^12 is about 60 bits, which is
 * far more than a password living for one sign-in needs, and the grouping is
 * what makes it transcribable at all — an unbroken twelve-character string gets
 * copied wrong by hand every time.
 */
const PW_ALPHABET = "ABCDEFGHJKLMNPQRTUVWXYZ23456789#@";
function mintTempPassword(): string {
  const bytes = randomBytes(12);
  const chars = [...bytes].map((b) => PW_ALPHABET[b % PW_ALPHABET.length]);
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8, 12)]
    .map((g) => g.join(""))
    .join("-");
}

/**
 * Issue an invitation or a password reset.
 *
 * TWO WAYS IN, ON PURPOSE. The link still exists and still lets the person
 * choose their own password — that is the better credential and it is what the
 * reset flow has always been. But an activation link alone is what the operator
 * met in practice: a wall of URL pasted into WhatsApp, opened on a phone,
 * leading to a form. So the invitation now ALSO carries a temporary password
 * and the address of the sign-in page. Copy, paste, in.
 *
 * The temporary password is written to the account immediately, which is what
 * makes it work; the account stays `invited` until somebody actually signs in,
 * so the screen can still say who has not been in yet.
 *
 * Any outstanding link for this person is retired first. Without that, a link
 * mailed a month ago still sets the password on an account whose invitation was
 * reissued precisely because the first one went astray. Issuing a new
 * invitation replaces the temporary password for the same reason.
 */
export async function issueInvitation(
  tenantId: string,
  email: string,
  purpose: "activation" | "reset",
  by: string,
  origin: string,
): Promise<Invitation> {
  const s = store(tenantId);
  const base = origin.replace(/\/$/, "");
  const { raw, hash, expiresAt } = mintToken();
  await s.revokeTokens(email);
  await s.putToken({ tokenHash: hash, email, purpose, expiresAt, createdBy: by });

  /* Never at the cost of the invitation itself. A bootstrap account from
     `ERP_USERS` has no row to write a password to, and a database that blinks
     must not turn "invite a colleague" into an error — the link is still a
     complete answer on its own. */
  let tempPassword = "";
  try {
    const candidate = mintTempPassword();
    await s.update(email.trim().toLowerCase(), {
      hash: await hashPassword(candidate),
      // Every session that existed before this password did is over. If the
      // reason for the reset was that somebody else had the old one, leaving
      // their session alive would defeat the exercise — the same rule
      // `activate` follows.
      sessionsValidFrom: new Date(),
    });
    tempPassword = candidate;
  } catch {
    tempPassword = "";
  }

  return {
    link: `${base}/activate?token=${encodeURIComponent(raw)}`,
    loginUrl: `${base}/login`,
    tempPassword,
    expiresAt: expiresAt.toISOString(),
    delivered: false, // set by the caller once a real adapter reports success
  };
}

export async function listUsers(tenantId: string): Promise<UserView[]> {
  const users = await allUsers(tenantId);
  let pending = new Set<string>();
  try {
    pending = await store(tenantId).pendingInvites();
  } catch {
    /* no database: nobody has an outstanding invitation, because none can exist */
  }
  return users.map((u) => toView(u, pending.has(u.email)));
}

export async function createUser(
  tenantId: string,
  data: { email: string; name: string; role: string },
  by: string,
): Promise<UserRecord> {
  const email = data.email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    throw new FactoryError("BAD_REQUEST", "That does not look like an email address.");
  if (!isRole(data.role)) throw new FactoryError("BAD_REQUEST", `Unknown role "${data.role}".`);
  if (await findUser(tenantId, email))
    throw new FactoryError("INVALID_STATE", `${email} already has an account.`);
  return fromRow(
    await store(tenantId).create({ email, name: data.name.trim(), role: data.role, createdBy: by }),
  );
}

/**
 * Change somebody's name, role or state.
 *
 * Two rules, and both exist because of the same failure: a system nobody can
 * administer. The last admin may not step down and may not disable themselves,
 * and a disabled admin counts as no admin at all.
 *
 * Disabling also moves `sessionsValidFrom` forward, which is what actually ends
 * that person's sessions — the row change alone would leave them working until
 * their token expired, which for a named account is thirty days.
 */
export async function updateUser(
  tenantId: string,
  email: string,
  patch: { name?: string; role?: string; state?: string },
): Promise<UserRecord> {
  const wanted = email.trim().toLowerCase();
  const users = await allUsers(tenantId);
  const target = users.find((u) => u.email === wanted);
  if (!target) throw new FactoryError("NOT_FOUND", `No account for ${wanted}.`);

  const role = patch.role === undefined ? undefined : patch.role;
  if (role !== undefined && !isRole(role))
    throw new FactoryError("BAD_REQUEST", `Unknown role "${role}".`);
  const state = patch.state;
  if (state !== undefined && state !== "active" && state !== "disabled")
    throw new FactoryError(
      "BAD_REQUEST",
      `State must be "active" or "disabled" — "invited" is reached by creating an account, not by editing one.`,
    );

  if (
    (role !== undefined || state !== undefined) &&
    wouldOrphanAdmins(users, wanted, {
      ...(role !== undefined ? { role: role as UserRole } : {}),
      ...(state !== undefined ? { state: state as "active" | "disabled" } : {}),
    })
  ) {
    throw new FactoryError(
      "INVALID_STATE",
      "That would leave nobody able to administer the system. Give somebody else the admin role first.",
    );
  }

  if (target.createdBy === "env" && !(await rowExists(tenantId, wanted))) {
    throw new FactoryError(
      "INVALID_STATE",
      `${wanted} is configured in the server's environment, not in this screen. ` +
        `Create them here first, then remove the ERP_USERS entry.`,
    );
  }

  const data: Parameters<db.PrismaUserStore["update"]>[1] = {};
  if (patch.name !== undefined) data.name = patch.name.trim();
  if (role !== undefined) data.role = role;
  if (state !== undefined) {
    data.state = state;
    data.disabledAt = state === "disabled" ? new Date() : null;
    // Both directions move the stamp. Re-enabling somebody should not silently
    // revive a token issued before they were disabled.
    data.sessionsValidFrom = new Date();
  }
  return fromRow(await store(tenantId).update(wanted, data));
}

async function rowExists(tenantId: string, email: string): Promise<boolean> {
  try {
    return Boolean(await store(tenantId).find(email));
  } catch {
    return false;
  }
}

/**
 * Accept an invitation or a reset: the invited person sets their own password.
 *
 * Every failure answers the same way. Distinguishing "no such token" from
 * "expired" from "already used" would help somebody holding a stolen link work
 * out what to try next, and helps a legitimate user not at all — they will ask
 * for a new one either way.
 */
export async function activate(
  tenantId: string,
  rawToken: string,
  password: string,
): Promise<{ email: string }> {
  const bad = () =>
    new FactoryError("BAD_REQUEST", "That link is no longer valid. Ask for a new one.");
  if (password.length < 10)
    throw new FactoryError("BAD_REQUEST", "Choose a password of at least 10 characters.");

  const s = store(tenantId);
  const row = await s.findToken(hashToken(rawToken));
  if (!row || row.usedAt || row.expiresAt <= new Date()) throw bad();

  const user = await findUser(tenantId, row.email);
  if (!user || user.state === "disabled") throw bad();

  await s.update(row.email, {
    hash: await hashPassword(password),
    state: "active",
    // Setting a password ends every session that existed before it. If the
    // reason for the reset was that somebody else had the old one, leaving
    // their session alive would defeat the whole exercise.
    sessionsValidFrom: new Date(),
    disabledAt: null,
  });
  await s.useToken(row.tokenHash);
  return { email: row.email };
}

/**
 * Is this session still good for this person?
 *
 * Checked on every request that matters rather than only at sign-in, because
 * "disabled" has to take effect while somebody is already signed in — that is
 * the entire point of being able to disable them.
 */
export async function sessionStillValid(
  tenantId: string,
  email: string,
  issuedAtSeconds: number,
): Promise<boolean> {
  const u = await findUser(tenantId, email);
  if (!u) return false;
  if (u.state !== "active") return false;
  return issuedAtSeconds >= Math.floor(u.sessionsValidFrom.getTime() / 1000);
}

/**
 * Check a sign-in against the rows AND the environment.
 *
 * This is what `authenticate()` in auth.ts used to be, widened to see accounts
 * created through the screen. It is here rather than there because it needs the
 * company — a row is tenant-scoped and an environment entry is not.
 */
export async function authenticateUser(
  tenantId: string,
  email: string,
  password: string,
): Promise<string | null> {
  const { authenticateAgainst } = await import("./users");
  const found = await authenticateAgainst(await allUsers(tenantId), email, password);
  if (!found) return null;

  /* SIGNING IN IS WHAT ACTIVATION MEANS NOW, so the promotion happens here
     rather than in the route — there are two callers and one rule, and a rule
     enforced in one of two places is not a rule. It is also not optional:
     `sessionStillValid` requires `active`, so an invited account that signed in
     and stayed invited would be handed a cookie and then refused on its very
     next request, which reads as a broken login rather than a rejected one. */
  if (found.state === "invited") {
    try {
      await store(tenantId).update(found.email, { state: "active", disabledAt: null });
    } catch {
      /* No row to promote — an `ERP_USERS` account is already active by
         definition and never reaches this branch. Nothing to repair, and
         refusing a correct password over it would be the worse answer. */
    }
  }
  return found.email;
}
