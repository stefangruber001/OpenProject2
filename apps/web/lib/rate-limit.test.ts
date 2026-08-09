import { beforeEach, describe, expect, it } from "vitest";
import { LIMITS, check, clientKey, recordFailure, recordSuccess, reset } from "./rate-limit";

beforeEach(() => reset());

const KEYS = ["ip:1.2.3.4", "email:ana@example.com"];

describe("slowing an automated attempt", () => {
  it("allows an attempt when nothing has failed", () => {
    expect(check(KEYS)).toEqual({ allowed: true, retryAfter: 0 });
  });

  it("allows the attempts up to the limit, then refuses", () => {
    for (let i = 0; i < LIMITS.MAX_ATTEMPTS; i++) {
      expect(check(KEYS).allowed).toBe(true);
      recordFailure(KEYS);
    }
    const v = check(KEYS);
    expect(v.allowed).toBe(false);
    expect(v.retryAfter).toBeGreaterThan(0);
  });

  it("forgets the failures once somebody signs in", () => {
    for (let i = 0; i < LIMITS.MAX_ATTEMPTS; i++) recordFailure(KEYS);
    expect(check(KEYS).allowed).toBe(false);
    // Seven mistypes then a success must not leave a strike behind for the
    // eighth honest mistake to trip over.
    recordSuccess(KEYS);
    expect(check(KEYS).allowed).toBe(true);
  });

  it("lets the window expire", () => {
    const t0 = 1_000_000;
    for (let i = 0; i < LIMITS.MAX_ATTEMPTS; i++) recordFailure(KEYS, t0);
    expect(check(KEYS, t0 + 1000).allowed).toBe(false);
    expect(check(KEYS, t0 + LIMITS.WINDOW_MS + 1).allowed).toBe(true);
  });

  it("counts each key separately, so either can refuse", () => {
    // Spraying one password across many addresses is caught by the network key
    // even though no single address has failed enough times.
    for (let i = 0; i < LIMITS.MAX_ATTEMPTS; i++) recordFailure(["ip:1.2.3.4", `email:u${i}@x.es`]);
    expect(check(["ip:1.2.3.4", "email:fresh@x.es"]).allowed).toBe(false);
    expect(check(["ip:9.9.9.9", "email:fresh@x.es"]).allowed).toBe(true);
  });

  it("locks one address without touching another person on the same connection", () => {
    for (let i = 0; i < LIMITS.MAX_ATTEMPTS; i++) recordFailure(["email:ana@example.com"]);
    expect(check(["ip:1.2.3.4", "email:ana@example.com"]).allowed).toBe(false);
    expect(check(["ip:1.2.3.4", "email:luis@example.com"]).allowed).toBe(true);
  });
});

describe("identifying the caller", () => {
  const req = (headers: Record<string, string>) =>
    new Request("https://example.test/api/auth/login", { headers });

  it("prefers the forwarded address, since behind a proxy the socket is the proxy", () => {
    expect(clientKey(req({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });

  it("falls back to the real-ip header", () => {
    expect(clientKey(req({ "x-real-ip": "203.0.113.9" }))).toBe("203.0.113.9");
  });

  it("has a name for the case where neither is present", () => {
    // "unknown" is one bucket everybody shares, which is the safe direction:
    // it can over-limit, never under-limit.
    expect(clientKey(req({}))).toBe("unknown");
  });
});
