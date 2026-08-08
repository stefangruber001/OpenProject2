/**
 * Tests for the pilot's own login.
 *
 * This is the only thing standing between the internet and a company's invoice
 * register once ports 80/443 are open, so each test below is a way in rather
 * than a shape assertion: a forged cookie, an expired one, a token re-signed
 * with a different secret, a redirect that leaves the site.
 */
import { describe, expect, it } from "vitest";
import {
  accounts,
  authenticate,
  hashPassword,
  isSharedPassword,
  loginConfigured,
  sharedPassword,
  verifyPassword,
} from "./auth";
import {
  SESSION_TTL_SECONDS,
  clearedCookie,
  readSession,
  sessionCookie,
  signSession,
} from "./session-token";

const SECRET = "a-long-random-server-secret-value";
const NOW = 1_800_000_000;

describe("password hashing", () => {
  it("accepts the right password", async () => {
    const h = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("correct horse battery staple", h)).resolves.toBe(true);
  });

  it("rejects the wrong password", async () => {
    const h = await hashPassword("correct horse battery staple");
    await expect(verifyPassword("Correct horse battery staple", h)).resolves.toBe(false);
    await expect(verifyPassword("", h)).resolves.toBe(false);
  });

  it("never stores the password itself", async () => {
    const h = await hashPassword("hunter2-hunter2-hunter2");
    expect(h).not.toContain("hunter2");
  });

  it("salts, so two people with the same password do not share a hash", async () => {
    const a = await hashPassword("same password twice");
    const b = await hashPassword("same password twice");
    expect(a).not.toBe(b);
    await expect(verifyPassword("same password twice", a)).resolves.toBe(true);
    await expect(verifyPassword("same password twice", b)).resolves.toBe(true);
  });

  it("treats a malformed stored hash as a failure rather than throwing", async () => {
    for (const bad of [
      "",
      "nonsense",
      "scrypt$x$8$1$AA==$AA==",
      "bcrypt$1$2$3$4$5",
      "scrypt$16384$8$1$$",
    ]) {
      await expect(verifyPassword("anything", bad)).resolves.toBe(false);
    }
  });

  it("refuses an absurd cost parameter instead of hanging the server", async () => {
    // A hostile or fat-fingered ERP_USERS entry must not be a way to wedge the
    // process for everybody.
    const started = Date.now();
    await expect(verifyPassword("x", `scrypt$${2 ** 30}$8$1$AAAA$AAAA`)).resolves.toBe(false);
    expect(Date.now() - started).toBeLessThan(1000);
  });
});

describe("the account list", () => {
  const withUsers = async (value: string | undefined, fn: () => Promise<void> | void) => {
    const old = process.env.ERP_USERS;
    if (value === undefined) delete process.env.ERP_USERS;
    else process.env.ERP_USERS = value;
    try {
      await fn();
    } finally {
      if (old === undefined) delete process.env.ERP_USERS;
      else process.env.ERP_USERS = old;
    }
  };

  it("is empty when unset, so nothing accidentally has an account", async () => {
    await withUsers(undefined, () => {
      expect(accounts()).toEqual([]);
      expect(loginConfigured()).toBe(false);
    });
  });

  it("reads several people", async () => {
    const h = await hashPassword("one two three four");
    await withUsers(`ana@example.com:${h}, luis@example.com:${h}`, () => {
      expect(accounts().map((a) => a.email)).toEqual(["ana@example.com", "luis@example.com"]);
    });
  });

  it("lower-cases addresses, because a phone will capitalise one", async () => {
    const h = await hashPassword("one two three four");
    await withUsers(`Ana@Example.com:${h}`, async () => {
      await expect(authenticate("ana@example.com", "one two three four")).resolves.toBe(
        "ana@example.com",
      );
      await expect(authenticate("ANA@EXAMPLE.COM", "one two three four")).resolves.toBe(
        "ana@example.com",
      );
    });
  });

  it("does not mangle a hash that contains separators", async () => {
    // The hash format is full of "$" and base64 can end in "=". Splitting the
    // entry greedily rather than on the first colon corrupts it.
    const h = await hashPassword("one two three four");
    expect(h).toContain("$");
    await withUsers(`ana@example.com:${h}`, () => {
      expect(accounts()[0]?.hash).toBe(h);
    });
  });

  it("refuses an unknown address and a wrong password identically", async () => {
    const h = await hashPassword("one two three four");
    await withUsers(`ana@example.com:${h}`, async () => {
      await expect(authenticate("nobody@example.com", "one two three four")).resolves.toBeNull();
      await expect(authenticate("ana@example.com", "wrong")).resolves.toBeNull();
    });
  });

  it("takes comparable time for an unknown address as for a wrong password", async () => {
    // Otherwise the response time says whether an address has an account here,
    // which for a company of two is most of a targeted guess.
    const h = await hashPassword("one two three four");
    await withUsers(`ana@example.com:${h}`, async () => {
      const t0 = Date.now();
      await authenticate("nobody@example.com", "guess");
      const unknown = Date.now() - t0;
      const t1 = Date.now();
      await authenticate("ana@example.com", "guess");
      const wrongPassword = Date.now() - t1;
      // Deliberately loose — this is a shared CI runner, not a lab. The failure
      // being guarded against is a near-instant return, not a few milliseconds.
      expect(unknown).toBeGreaterThan(wrongPassword / 5);
    });
  });
});

describe("session tokens", () => {
  it("carries the role, so a shared session is distinguishable afterwards", async () => {
    const t = await signSession("invitado-4f2a", SECRET, NOW, "shared");
    await expect(readSession(t, SECRET, NOW + 60)).resolves.toEqual({
      sub: "invitado-4f2a",
      role: "shared",
    });
  });

  it("round-trips the signed-in email", async () => {
    const t = await signSession("ana@example.com", SECRET, NOW);
    await expect(readSession(t, SECRET, NOW + 60)).resolves.toEqual({
      sub: "ana@example.com",
      role: "staff",
    });
  });

  it("rejects a token signed with a different secret", async () => {
    const t = await signSession("ana@example.com", SECRET, NOW);
    await expect(readSession(t, "some-other-secret-entirely", NOW + 60)).resolves.toBeNull();
  });

  it("rejects a token whose payload was edited", async () => {
    // The attack this exists for: sign in as yourself, change the name in the
    // cookie, act as somebody else.
    const t = await signSession("ana@example.com", SECRET, NOW);
    const [, sig] = t.split(".");
    const forged =
      Buffer.from(JSON.stringify({ sub: "boss@example.com", exp: NOW + 9999 })).toString(
        "base64url",
      ) +
      "." +
      sig;
    await expect(readSession(forged, SECRET, NOW + 60)).resolves.toBeNull();
  });

  it("rejects an expired session", async () => {
    const t = await signSession("ana@example.com", SECRET, NOW);
    await expect(readSession(t, SECRET, NOW + SESSION_TTL_SECONDS + 1)).resolves.toBeNull();
  });

  it("rejects nothing, rubbish, and the shape without a signature", async () => {
    for (const bad of [undefined, "", "not-a-token", "only-one-part", "a.b.c", "."]) {
      await expect(readSession(bad, SECRET, NOW)).resolves.toBeNull();
    }
  });

  it("marks the cookie HttpOnly and SameSite, and Secure over HTTPS", () => {
    const c = sessionCookie("tok", true);
    expect(c).toContain("HttpOnly");
    expect(c).toContain("SameSite=Lax");
    expect(c).toContain("Secure");
    // Over plain HTTP a Secure cookie is silently dropped and login appears to
    // do nothing at all.
    expect(sessionCookie("tok", false)).not.toContain("Secure");
  });

  it("expires the cookie on sign-out", () => {
    expect(clearedCookie(true)).toContain("Max-Age=0");
  });
});

/**
 * The shared password — one link, one password, handed to somebody evaluating
 * the system on their own laptop.
 *
 * It reaches the LIVE data, so these are not conveniences: each is a way a
 * session could be created by somebody who does not have the password.
 */
describe("the shared access password", () => {
  const withShared = async (value: string | undefined, fn: () => Promise<void> | void) => {
    const old = process.env.ERP_ACCESS_PASSWORD;
    if (value === undefined) delete process.env.ERP_ACCESS_PASSWORD;
    else process.env.ERP_ACCESS_PASSWORD = value;
    try {
      await fn();
    } finally {
      if (old === undefined) delete process.env.ERP_ACCESS_PASSWORD;
      else process.env.ERP_ACCESS_PASSWORD = old;
    }
  };

  it("is off unless configured, so nothing has a shared way in by default", async () => {
    await withShared(undefined, () => {
      expect(sharedPassword()).toBeNull();
      expect(isSharedPassword("")).toBe(false);
      expect(isSharedPassword("anything")).toBe(false);
    });
  });

  it("accepts the exact password and nothing else", async () => {
    await withShared("Obras-2026-Barcelona", () => {
      expect(isSharedPassword("Obras-2026-Barcelona")).toBe(true);
      expect(isSharedPassword("obras-2026-barcelona")).toBe(false);
      expect(isSharedPassword("Obras-2026-Barcelon")).toBe(false);
      expect(isSharedPassword("Obras-2026-Barcelona ")).toBe(false);
      expect(isSharedPassword("")).toBe(false);
    });
  });

  it("does not accept a prefix — the comparison is not a startsWith", async () => {
    await withShared("Obras-2026-Barcelona", () => {
      expect(isSharedPassword("Obras")).toBe(false);
      expect(isSharedPassword("O")).toBe(false);
    });
  });

  it("counts as a configured login even with no named accounts", async () => {
    // A deployment reached only through the shared link has no ERP_USERS at all.
    // If that did not count as "sign-in is configured", the middleware would
    // switch itself off and serve every page to anyone who found the address.
    const oldUsers = process.env.ERP_USERS;
    const oldSecret = process.env.SESSION_SECRET;
    delete process.env.ERP_USERS;
    process.env.SESSION_SECRET = "a-secret";
    await withShared("Obras-2026-Barcelona", () => {
      expect(loginConfigured()).toBe(true);
    });
    await withShared(undefined, () => {
      expect(loginConfigured()).toBe(false);
    });
    if (oldUsers === undefined) delete process.env.ERP_USERS;
    else process.env.ERP_USERS = oldUsers;
    if (oldSecret === undefined) delete process.env.SESSION_SECRET;
    else process.env.SESSION_SECRET = oldSecret;
  });
});
