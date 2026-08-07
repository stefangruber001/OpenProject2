/**
 * Tests for who the system believes is acting.
 *
 * These are not shape tests. Each one is a way somebody could end up writing to
 * an invoice register under a name that is not theirs, and the assertion is that
 * the attempt is refused. A forged token that reached `state.audit` would be
 * invisible afterwards — the record would simply say a colleague did it.
 *
 * The identity provider's key set is real RSA generated per run rather than a
 * fixture, so a signature that verifies here verifies for the right reason.
 */
import { generateKeyPairSync, createSign, randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { requireUser } from "./session";

const TEAM = "canei.cloudflareaccess.com";
const AUD = "a".repeat(64);
const KID = "test-key-1";

const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: "jwk" }), kid: KID, alg: "RS256", use: "sig" };

/** A second, unrelated key — an attacker's, signing tokens the provider never saw. */
const other = generateKeyPairSync("rsa", { modulusLength: 2048 });

const b64url = (b: Buffer | string) =>
  Buffer.from(b).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

function token(
  claims: Record<string, unknown> = {},
  opts: { kid?: string; alg?: string; key?: typeof privateKey; signed?: boolean } = {},
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(
    JSON.stringify({ alg: opts.alg ?? "RS256", kid: opts.kid ?? KID, typ: "JWT" }),
  );
  const payload = b64url(
    JSON.stringify({
      email: "stefan@caneisubirats.com",
      aud: [AUD],
      iss: `https://${TEAM}`,
      exp: now + 3600,
      iat: now,
      ...claims,
    }),
  );
  if (opts.signed === false) return `${header}.${payload}.${b64url("not-a-signature")}`;
  const sig = createSign("RSA-SHA256")
    .update(`${header}.${payload}`)
    .sign(opts.key ?? privateKey);
  return `${header}.${payload}.${b64url(sig)}`;
}

const withToken = (t?: string) =>
  new Request("https://erp.example.com/api/x/erp/command", {
    method: "POST",
    headers: t ? { "cf-access-jwt-assertion": t } : {},
  });

/** Every attempt to be somebody must fail with UNAUTHENTICATED, not merely fail. */
async function expectRejected(req: Request, code = "UNAUTHENTICATED") {
  await expect(requireUser(req)).rejects.toMatchObject({ code });
}

describe("requireUser", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
    delete process.env.CF_ACCESS_TEAM_DOMAIN;
    delete process.env.CF_ACCESS_AUD;
    delete process.env.ERP_OPERATOR;
    vi.restoreAllMocks();
    // The key set is public data over HTTPS; serving it locally keeps these
    // tests offline and lets a rotation be simulated.
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ keys: [jwk] }), { status: 200 })),
    );
  });
  afterEach(() => {
    process.env = env;
  });

  describe("single-seat mode (no identity provider configured)", () => {
    it("names the configured operator", async () => {
      process.env.ERP_OPERATOR = "Stefan Gruber";
      await expect(requireUser(withToken())).resolves.toBe("Stefan Gruber");
    });

    it("refuses to write anonymously when no operator is named", async () => {
      await expectRejected(withToken(), "CONFIG_INVALID");
    });

    it("ignores an assertion nobody asked to verify", async () => {
      // Without the provider configured there is nothing to check a token
      // against, so accepting the email inside one would be accepting a claim.
      process.env.ERP_OPERATOR = "Stefan Gruber";
      const forged = token({ email: "attacker@example.com" }, { key: other.privateKey });
      await expect(requireUser(withToken(forged))).resolves.toBe("Stefan Gruber");
    });
  });

  describe("half-configured", () => {
    it("refuses rather than silently downgrading to the shared name", async () => {
      // The dangerous failure: a deployment that meant to require login loses one
      // variable and keeps serving, attributing everyone's work to one person.
      process.env.CF_ACCESS_TEAM_DOMAIN = TEAM;
      process.env.ERP_OPERATOR = "Stefan Gruber";
      await expectRejected(withToken(token()), "CONFIG_INVALID");
    });

    it("refuses when only the audience is set", async () => {
      process.env.CF_ACCESS_AUD = AUD;
      process.env.ERP_OPERATOR = "Stefan Gruber";
      await expectRejected(withToken(token()), "CONFIG_INVALID");
    });
  });

  describe("published mode", () => {
    beforeEach(() => {
      process.env.CF_ACCESS_TEAM_DOMAIN = TEAM;
      process.env.CF_ACCESS_AUD = AUD;
      // Present, and must never be used — a signed-in colleague's changes must
      // not be stamped with the single-seat name.
      process.env.ERP_OPERATOR = "Stefan Gruber";
    });

    it("returns the signed-in email, not the configured operator", async () => {
      await expect(
        requireUser(withToken(token({ email: "ignacio@caneisubirats.com" }))),
      ).resolves.toBe("ignacio@caneisubirats.com");
    });

    it("rejects a request with no assertion", async () => {
      await expectRejected(withToken());
    });

    it("rejects a token signed by the wrong key", async () => {
      await expectRejected(withToken(token({}, { key: other.privateKey })));
    });

    it("rejects a token whose signature is garbage", async () => {
      await expectRejected(withToken(token({}, { signed: false })));
    });

    it("rejects alg:none — an unsigned token is not an identity", async () => {
      const now = Math.floor(Date.now() / 1000);
      const h = b64url(JSON.stringify({ alg: "none", kid: KID, typ: "JWT" }));
      const p = b64url(
        JSON.stringify({ email: "attacker@example.com", aud: [AUD], exp: now + 60 }),
      );
      await expectRejected(withToken(`${h}.${p}.`));
    });

    it("rejects HS256 — the public key must not become an HMAC secret", async () => {
      await expectRejected(withToken(token({}, { alg: "HS256" })));
    });

    it("rejects a token minted for a different application", async () => {
      // Same provider, same signature, different audience. A valid signature is
      // not permission to be in THIS system.
      await expectRejected(withToken(token({ aud: ["b".repeat(64)] })));
    });

    it("rejects a token with no audience at all", async () => {
      await expectRejected(withToken(token({ aud: undefined })));
    });

    it("rejects a token from a different identity provider", async () => {
      await expectRejected(withToken(token({ iss: "https://evil.cloudflareaccess.com" })));
    });

    it("rejects an expired session", async () => {
      await expectRejected(withToken(token({ exp: Math.floor(Date.now() / 1000) - 1 })));
    });

    it("rejects a token that carries no email", async () => {
      await expectRejected(withToken(token({ email: undefined })));
    });

    it("rejects something that is not a token", async () => {
      await expectRejected(withToken("Bearer hunter2"));
    });

    it("refetches the key set when the key id is unknown, so a rotation is not an outage", async () => {
      // A fresh module, because the key cache lives at module scope and the
      // tests above have already warmed it. Starting cold is what makes the two
      // fetches below mean what they say: the first serves the stale set, the
      // unknown key id forces the second.
      vi.resetModules();
      const { requireUser: freshRequireUser } = await import("./session");

      const rotated = generateKeyPairSync("rsa", { modulusLength: 2048 });
      const rotatedJwk = {
        ...rotated.publicKey.export({ format: "jwk" }),
        kid: "test-key-2",
        alg: "RS256",
      };
      let call = 0;
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          call += 1;
          const keys = call === 1 ? [jwk] : [jwk, rotatedJwk];
          return new Response(JSON.stringify({ keys }), { status: 200 });
        }),
      );
      const t = token(
        { email: "ignacio@caneisubirats.com" },
        { kid: "test-key-2", key: rotated.privateKey },
      );
      await expect(freshRequireUser(withToken(t))).resolves.toBe("ignacio@caneisubirats.com");
      expect(call).toBe(2);
    });

    it("serves stale keys rather than refusing every write when the provider blips", async () => {
      // Warm the cache with a good fetch.
      await requireUser(withToken(token()));
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new Error("ECONNRESET");
        }),
      );
      await expect(requireUser(withToken(token({ email: "a@caneisubirats.com" })))).resolves.toBe(
        "a@caneisubirats.com",
      );
    });

    it("does not leak which half of a forgery failed", async () => {
      // Two very different failures must read identically to the caller.
      const a = await requireUser(withToken(token({}, { key: other.privateKey }))).catch((e) => e);
      const b = await requireUser(withToken(token({ aud: ["z".repeat(64)] }))).catch((e) => e);
      expect(a.message).toBe(b.message);
    });

    it("accepts a unique audience value, not a prefix of it", async () => {
      process.env.CF_ACCESS_AUD = randomUUID();
      await expectRejected(withToken(token({ aud: [`${process.env.CF_ACCESS_AUD}-extra`] })));
    });
  });
});
