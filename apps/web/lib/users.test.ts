import { afterEach, describe, expect, it } from "vitest";
import { hashPassword } from "./auth";
import {
  authenticateAgainst,
  hashToken,
  mintToken,
  permissionsOf,
  roleMay,
  sameToken,
  wouldOrphanAdmins,
  type UserRecord,
} from "./users";

const base = (over: Partial<UserRecord> = {}): UserRecord => ({
  email: "ana@example.com",
  name: "Ana",
  role: "admin",
  state: "active",
  hash: "",
  sessionsValidFrom: new Date(0),
  createdAt: new Date(0),
  createdBy: "env",
  disabledAt: null,
  ...over,
});

describe("roles", () => {
  it("admin may everything", () => {
    expect(roleMay("admin", "user.manage")).toBe(true);
    expect(roleMay("admin", "anything.at.all")).toBe(true);
  });

  it("gestoría reads and exports but never sees a margin", () => {
    expect(roleMay("gestoria", "erp.read")).toBe(true);
    expect(roleMay("gestoria", "export")).toBe(true);
    // The exclusion is the reason this role exists, so it is asserted rather
    // than left as a line in a document.
    expect(roleMay("gestoria", "margin.read")).toBe(false);
    expect(roleMay("gestoria", "erp.write")).toBe(false);
    expect(roleMay("gestoria", "party.bank.read")).toBe(false);
  });

  it("site records work and touches no money", () => {
    expect(roleMay("site", "erp.write.site")).toBe(true);
    expect(roleMay("site", "photo.capture")).toBe(true);
    expect(roleMay("site", "money.read")).toBe(false);
    expect(roleMay("site", "margin.read")).toBe(false);
  });

  it("only admin may manage users", () => {
    for (const r of ["backoffice", "site", "gestoria"] as const)
      expect(roleMay(r, "user.manage")).toBe(false);
  });

  it("no role is accidentally empty", () => {
    for (const r of ["admin", "backoffice", "site", "gestoria"] as const)
      expect(permissionsOf(r).length).toBeGreaterThan(0);
  });
});

describe("activation tokens", () => {
  it("stores a digest, never the token itself", () => {
    const { raw, hash } = mintToken();
    expect(hash).not.toContain(raw);
    expect(hash).toHaveLength(64);
    expect(hashToken(raw)).toBe(hash);
  });

  it("two tokens never collide", () => {
    const seen = new Set(Array.from({ length: 50 }, () => mintToken().raw));
    expect(seen.size).toBe(50);
  });

  it("expires within the invitation window", () => {
    const { expiresAt } = mintToken();
    const days = (expiresAt.getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(6.9);
    expect(days).toBeLessThan(7.1);
  });

  it("compares digests without leaking where they differ", () => {
    const a = hashToken("one");
    expect(sameToken(a, a)).toBe(true);
    expect(sameToken(a, hashToken("two"))).toBe(false);
    expect(sameToken(a, "short")).toBe(false);
  });
});

describe("signing in", () => {
  it("accepts an active account with the right password", async () => {
    const users = [base({ hash: await hashPassword("correct horse") })];
    expect(await authenticateAgainst(users, "ana@example.com", "correct horse")).toBeTruthy();
    expect(await authenticateAgainst(users, "ana@example.com", "wrong")).toBeNull();
  });

  it("is case-insensitive about the address", async () => {
    const users = [base({ hash: await hashPassword("pw") })];
    expect(await authenticateAgainst(users, "  ANA@Example.com ", "pw")).toBeTruthy();
  });

  it("refuses a disabled account even with the right password", async () => {
    const hash = await hashPassword("pw");
    expect(await authenticateAgainst([base({ hash })], "ana@example.com", "pw")).toBeTruthy();
    expect(
      await authenticateAgainst([base({ hash, state: "disabled" })], "ana@example.com", "pw"),
    ).toBeNull();
  });

  it("refuses an invitation that has not been accepted yet", async () => {
    // No password has been set, so there is nothing to match. An empty hash
    // must never behave like an empty password.
    const users = [base({ state: "invited", hash: "" })];
    expect(await authenticateAgainst(users, "ana@example.com", "")).toBeNull();
  });

  it("refuses an unknown address without saying so", async () => {
    const users = [base({ hash: await hashPassword("pw") })];
    expect(await authenticateAgainst(users, "nobody@example.com", "pw")).toBeNull();
  });
});

describe("the last admin", () => {
  const ana = base({ email: "ana@example.com", role: "admin" });
  const luis = base({ email: "luis@example.com", role: "backoffice" });

  it("cannot step down to another role", () => {
    expect(wouldOrphanAdmins([ana, luis], "ana@example.com", { role: "backoffice" })).toBe(true);
  });

  it("cannot disable themselves", () => {
    expect(wouldOrphanAdmins([ana, luis], "ana@example.com", { state: "disabled" })).toBe(true);
  });

  it("may do either once there is a second admin", () => {
    const eva = base({ email: "eva@example.com", role: "admin" });
    expect(wouldOrphanAdmins([ana, eva, luis], "ana@example.com", { role: "site" })).toBe(false);
    expect(wouldOrphanAdmins([ana, eva, luis], "ana@example.com", { state: "disabled" })).toBe(
      false,
    );
  });

  it("counts a DISABLED admin as no admin at all", () => {
    const eva = base({ email: "eva@example.com", role: "admin", state: "disabled" });
    expect(wouldOrphanAdmins([ana, eva], "ana@example.com", { state: "disabled" })).toBe(true);
  });
});

describe("ending somebody's sessions", () => {
  // Sessions are signed and stateless, so there is no row to delete. Each token
  // carries when it was issued and each user a stamp; a token older than the
  // stamp is refused. These assert the arithmetic that decision rests on.
  const validFrom = (u: UserRecord) => Math.floor(u.sessionsValidFrom.getTime() / 1000);

  it("a token issued before the stamp is stale", () => {
    const u = base({ sessionsValidFrom: new Date(2_000_000_000_000) });
    expect(1_999_999_999 < validFrom(u)).toBe(true);
  });

  it("a token issued after the stamp is still good", () => {
    const u = base({ sessionsValidFrom: new Date(1_000_000_000_000) });
    expect(1_000_000_001 < validFrom(u)).toBe(false);
  });

  it("a token with no issue time reads as issued at 0, so it goes stale first", () => {
    // Tokens minted before iat existed. Being wrong in this direction costs one
    // person one extra sign-in; the other direction leaves a disabled colleague
    // signed in.
    const u = base({ sessionsValidFrom: new Date(1) });
    expect(0 < validFrom(u)).toBe(false);
    const u2 = base({ sessionsValidFrom: new Date(5000) });
    expect(0 < validFrom(u2)).toBe(true);
  });
});

/**
 * THE LOCKOUT THIS PINS.
 *
 * A single-seat deployment names one person in `ERP_OPERATOR` and configures no
 * accounts at all; `requireUser` returns that name so every record is
 * attributable. They have no row and no environment account, so `findUser`
 * answered null — harmless while nothing consulted a permission, and a total
 * lockout the moment the command runner started to. It shipped as far as the
 * smoke job, which refused a plain `addParty` with "you do not have permission
 * to erp.write" on a server that belonged entirely to the person asking.
 *
 * The rule is narrow on purpose, and both halves are worth holding: the lone
 * operator IS the administrator, and the moment real sign-in exists the
 * synthetic record must disappear — otherwise a name in an environment
 * variable would outrank the accounts.
 */
describe("the single-seat operator", () => {
  const env = { ...process.env };
  afterEach(() => {
    process.env = { ...env };
  });

  const findUser = async (email: string) => {
    const { findUser: f } = await import("./user-admin");
    return f("reformas-demo", email);
  };

  it("is an administrator of their own server", async () => {
    process.env.ERP_OPERATOR = "Stefan Gruber";
    delete process.env.ERP_USERS;
    delete process.env.ERP_ACCESS_PASSWORD;
    delete process.env.SESSION_SECRET;
    const u = await findUser("stefan gruber");
    expect(u?.role).toBe("admin");
    expect(u?.state).toBe("active");
    expect(roleMay(u!.role, "erp.write")).toBe(true);
    expect(roleMay(u!.role, "erp.read.all")).toBe(true);
  });

  it("is nobody once real sign-in is configured", async () => {
    process.env.ERP_OPERATOR = "Stefan Gruber";
    process.env.ERP_USERS = "ana@example.com:scrypt$16384$8$1$c2FsdA==$aGFzaA==";
    process.env.SESSION_SECRET = "s".repeat(32);
    expect(await findUser("stefan gruber")).toBeNull();
  });

  it("does not exist when nobody was named", async () => {
    delete process.env.ERP_OPERATOR;
    delete process.env.ERP_USERS;
    delete process.env.SESSION_SECRET;
    expect(await findUser("anybody")).toBeNull();
  });
});
