/**
 * Who may sign in, and checking that they can.
 *
 * Accounts come from one environment variable rather than a database table:
 *
 *   ERP_USERS="ana@example.com:scrypt$16384$8$1$<salt>$<hash>,luis@example.com:scrypt$..."
 *
 * That is a pilot-shaped decision and worth being explicit about. Two people
 * need accounts; a users table needs a migration, a way to create the first
 * account, a way to reset a password, and an admin screen to do it in — none of
 * which helps anybody until there is a third person. Moving to a table later
 * changes this file and nothing else, because everything above it asks one
 * question: "is this email and password a real account?"
 *
 * Passwords are never stored, only scrypt hashes with a per-user salt. scrypt
 * is memory-hard, so the usual answer to a stolen hash file — try a few billion
 * candidates on a graphics card — costs real money instead. It is in Node's
 * standard library, so this needs no dependency.
 *
 * Generate a hash with:  node apps/web/scripts/hash-password.mjs
 */
import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

/** Cost parameters. N=16384 is ~16MB and a few tens of milliseconds per attempt. */
const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 64;

function scryptAsync(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // maxmem must be raised explicitly: the default is 32MB and N=16384 with
    // r=8 needs 128*N*r ≈ 16MB plus overhead, which lands close enough to the
    // limit that Node refuses on some builds.
    scrypt(password, salt, KEYLEN, { N, r: R, p: P, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(password, salt);
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}

/**
 * Does this password match this stored hash?
 *
 * Reads the cost parameters out of the stored string rather than assuming the
 * constants above, so hashes made before a parameter change keep working — a
 * hash format that cannot outlive its own constants forces everybody to reset
 * their password the day you decide to make it stronger.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const n = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  if (!Number.isSafeInteger(n) || !Number.isSafeInteger(r) || !Number.isSafeInteger(p))
    return false;
  // A hostile ERP_USERS could otherwise ask for a cost that hangs the process.
  if (n > 1 << 20 || r > 32 || p > 16) return false;

  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[4]!, "base64");
    expected = Buffer.from(parts[5]!, "base64");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;

  let actual: Buffer;
  try {
    actual = await new Promise<Buffer>((resolve, reject) => {
      scrypt(
        password,
        salt,
        expected.length,
        { N: n, r, p, maxmem: 256 * 1024 * 1024 },
        (err, key) => (err ? reject(err) : resolve(key)),
      );
    });
  } catch {
    return false;
  }
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export interface Account {
  email: string;
  hash: string;
}

/**
 * The configured accounts.
 *
 * Emails are lower-cased on both sides, because somebody's phone will
 * capitalise the first letter of their address and being unable to sign in for
 * that reason is a miserable half-hour.
 */
export function accounts(): Account[] {
  const raw = process.env.ERP_USERS?.trim();
  if (!raw) return [];
  return raw
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((entry) => {
      // Split on the FIRST colon only: the hash contains none, but an address
      // is the part before it and splitting greedily would mangle the hash.
      const i = entry.indexOf(":");
      if (i <= 0) return null;
      const email = entry.slice(0, i).trim().toLowerCase();
      const hash = entry.slice(i + 1).trim();
      return email && hash ? { email, hash } : null;
    })
    .filter((a): a is Account => a !== null);
}

/**
 * Check a sign-in attempt. Returns the canonical email, or null.
 *
 * An unknown address is checked against a decoy hash rather than returned
 * immediately. Without that, a wrong address answers noticeably faster than a
 * wrong password, and that difference is enough to enumerate who has an account
 * here — which for a company of two is most of the way to a targeted guess.
 */
const DECOY =
  "scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

export async function authenticate(email: string, password: string): Promise<string | null> {
  const wanted = email.trim().toLowerCase();
  const found = accounts().find((a) => a.email === wanted);
  const ok = await verifyPassword(password, found?.hash ?? DECOY);
  return ok && found ? found.email : null;
}

/** True when sign-in is configured at all. */
export function loginConfigured(): boolean {
  return accounts().length > 0 && Boolean(process.env.SESSION_SECRET?.trim());
}
