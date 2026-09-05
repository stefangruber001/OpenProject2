/**
 * The people who may sign in, and what each of them may do.
 *
 * Accounts used to be one environment variable — `ERP_USERS` in the server's
 * `.env`, alongside the database password, so adding a colleague meant handing
 * somebody the keys to everything. `auth.ts` predicted this move and said it
 * would "change this file and nothing else"; this is that file.
 *
 * WHAT IS DELIBERATE HERE
 *
 * **The admin never learns the password.** Creating a user issues a single-use,
 * time-limited token and stores only its SHA-256. The invited person follows the
 * link and chooses their own password. The script this replaces generated a
 * password and printed it to the admin, which means the admin knew a credential
 * somebody else is responsible for — and people reuse passwords.
 *
 * **Disable, never delete.** The audit trail has to keep resolving who did what.
 * A deleted row turns every entry that person authored into an unattributable
 * one, which on a system holding tax records is worse than a stale name.
 *
 * **Disabling really ends their sessions.** Session tokens are signed and
 * stateless, so there is nothing to delete. Each token carries when it was
 * issued and each user carries `sessionsValidFrom`; a token older than the stamp
 * is refused. Moving that stamp forward logs one person out everywhere, which
 * rotating `SESSION_SECRET` could only achieve by logging out the whole company.
 *
 * **The environment variable still works.** It is the bootstrap: a server with
 * no rows yet must still let somebody in to create the first account, and a
 * pilot already running on `ERP_USERS` must not lose access the day this ships.
 * Rows win where both exist.
 */
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { accounts as envAccounts, verifyPassword } from "./auth";

/** What somebody may do. Ordered from most to least. */
export const ROLES = ["admin", "backoffice", "site", "gestoria"] as const;
export type UserRole = (typeof ROLES)[number];

/** Where an account is in its life. */
export const STATES = ["invited", "active", "disabled"] as const;
export type UserState = (typeof STATES)[number];

export interface UserRecord {
  email: string;
  name: string;
  role: UserRole;
  state: UserState;
  hash: string;
  sessionsValidFrom: Date;
  createdAt: Date;
  createdBy: string;
  disabledAt: Date | null;
}

/** The user as a screen should see them — never the hash. */
export interface UserView {
  email: string;
  name: string;
  role: UserRole;
  state: UserState;
  createdAt: string;
  createdBy: string;
  disabledAt: string | null;
  /** True while an invitation is outstanding and unexpired. */
  invitePending: boolean;
}

export function isRole(v: unknown): v is UserRole {
  return typeof v === "string" && (ROLES as readonly string[]).includes(v);
}

/**
 * What each role may do.
 *
 * Permission names are opaque strings so a screen asks a question rather than
 * testing a role — `may(session, "user.manage")` survives a fourth role being
 * added, `role === "admin"` does not.
 *
 * `gestoria` is the specification's third profile: the accountant reads and
 * exports, and sees **no margins and no commercial prices**. That exclusion is
 * the reason the role exists, so it is expressed as the absence of a permission
 * rather than as a note in a document.
 */
const GRANTS: Record<UserRole, string[]> = {
  admin: ["*"],
  backoffice: [
    "erp.read",
    "erp.read.all",
    "erp.write",
    "money.read",
    "margin.read",
    "export",
    "party.bank.read",
  ],
  /* Site worker: records what happened on the job, and only their own. No
     money, nothing about margin — and, since this became a boundary rather
     than a label, no `erp.read.all` either: the document they are sent holds
     their own hours and the jobs they are assigned to, and nothing else. */
  site: ["erp.read", "erp.write.site", "photo.capture"],
  // Read-and-export only, and explicitly not margin.read or party.bank.read.
  gestoria: ["erp.read", "erp.read.all", "money.read", "export"],
};

export function permissionsOf(role: UserRole): string[] {
  return GRANTS[role] ?? [];
}

export function roleMay(role: UserRole, permission: string): boolean {
  const granted = permissionsOf(role);
  return granted.includes("*") || granted.includes(permission);
}

/**
 * The invitation window.
 *
 * Seven days is long enough to survive a holiday and short enough that a link
 * forwarded into a mail thread stops working before it is forgotten about.
 */
export const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

/** A fresh token: the raw half goes in the link, the hash half into the table. */
export function mintToken(): { raw: string; hash: string; expiresAt: Date } {
  const raw = randomBytes(32).toString("base64url");
  return { raw, hash: hashToken(raw), expiresAt: new Date(Date.now() + TOKEN_TTL_MS) };
}

/**
 * SHA-256, not scrypt.
 *
 * A password is short and guessable, so verifying it is deliberately expensive.
 * A token is 32 random bytes: there is nothing to guess, so the slow hash buys
 * nothing and would only make the activation page feel broken. What matters is
 * that the stored form is not usable as a link, and a digest gives that.
 */
export function hashToken(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

/** Constant-time compare of two hex digests. */
export function sameToken(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  if (x.length !== y.length) {
    timingSafeEqual(x, x);
    return false;
  }
  return timingSafeEqual(x, y);
}

export function toView(u: UserRecord, invitePending: boolean): UserView {
  return {
    email: u.email,
    name: u.name,
    role: u.role,
    state: u.state,
    createdAt: u.createdAt.toISOString(),
    createdBy: u.createdBy,
    disabledAt: u.disabledAt ? u.disabledAt.toISOString() : null,
    invitePending,
  };
}

/**
 * The accounts configured in the environment, as user records.
 *
 * They are always `admin` and always `active`: they are the people who had the
 * keys before there was a screen, and pretending otherwise would lock the pilot
 * out of the very screen that replaces them.
 */
export function envUsers(): UserRecord[] {
  const epoch = new Date(0);
  return envAccounts().map((a) => ({
    email: a.email,
    name: "",
    role: "admin" as UserRole,
    state: "active" as UserState,
    hash: a.hash,
    sessionsValidFrom: epoch,
    createdAt: epoch,
    createdBy: "env",
    disabledAt: null,
  }));
}

/**
 * Check a sign-in against a set of accounts.
 *
 * An unknown address is still checked against a decoy, for the same reason
 * `auth.ts` does it: a wrong address answering faster than a wrong password
 * tells an attacker who has an account here.
 *
 * A disabled account, and an invited one that has not set a password yet, both
 * fail the same way a wrong password does. Saying "this account is disabled"
 * would be friendlier and would also confirm the address exists.
 */
const DECOY =
  "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

export async function authenticateAgainst(
  users: UserRecord[],
  email: string,
  password: string,
): Promise<UserRecord | null> {
  const wanted = email.trim().toLowerCase();
  const found = users.find((u) => u.email === wanted);
  const usable = found && found.state === "active" && found.hash !== "";
  const ok = await verifyPassword(password, usable ? found.hash : DECOY);
  return ok && usable ? found : null;
}

/**
 * Would this change leave the system with nobody who can administer it?
 *
 * The last remaining admin cannot disable themselves or step down to another
 * role. There is no recovery from that short of editing the database by hand,
 * and the person who does it will be the one who most needs the screen back.
 */
export function wouldOrphanAdmins(
  users: UserRecord[],
  email: string,
  next: { role?: UserRole; state?: UserState },
): boolean {
  const stillAdmin = (u: UserRecord) => {
    const role = u.email === email && next.role ? next.role : u.role;
    const state = u.email === email && next.state ? next.state : u.state;
    return role === "admin" && state !== "disabled";
  };
  return !users.some(stillAdmin);
}
